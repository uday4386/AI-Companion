import express from 'express';
import crypto from 'node:crypto';
import { q, uid, nowIso, writeAudit, getSetting } from '../db.js';
import { requireAuth, requireAdmin, serializeUser, findUserById, hashPassword } from '../auth.js';
import { notifyUser, notifyAdmins } from '../notify.js';
import { ROLES, ACCOUNT_STATUSES } from '../config.js';

const router = express.Router();
const INVITE_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const isEmail = (v) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(String(v || '').trim());

/* ------------------------------ directory ----------------------------- */

/** Lightweight directory used by assignee pickers and avatar stacks. */
router.get('/directory', requireAuth, (_req, res) => {
  const rows = q.all(
    "SELECT id, full_name, email, role, avatar_tone, account_status FROM profiles WHERE account_status = 'active' ORDER BY full_name",
  );
  res.json({
    users: rows.map((r) => ({
      id: r.id,
      fullName: r.full_name,
      email: r.email,
      role: r.role,
      avatarTone: r.avatar_tone,
    })),
  });
});

/* ------------------------------- profile ------------------------------ */

router.patch('/users/profile', requireAuth, (req, res) => {
  const fullName = String(req.body?.fullName ?? req.user.full_name).trim();
  const jobTitle = String(req.body?.jobTitle ?? req.user.job_title ?? '').trim();
  const department = String(req.body?.department ?? req.user.department ?? '').trim();
  if (fullName.length < 2) return res.status(400).json({ error: 'Full name is required.', code: 'VALIDATION' });

  // Role and account status are intentionally not writable here.
  q.run(
    'UPDATE profiles SET full_name = ?, job_title = ?, department = ?, updated_at = ? WHERE id = ?',
    fullName,
    jobTitle || null,
    department || null,
    nowIso(),
    req.user.id,
  );
  writeAudit({
    actorId: req.user.id,
    actorName: fullName,
    action: 'profile.updated',
    entityType: 'profile',
    entityId: req.user.id,
  });
  res.json({ user: serializeUser(findUserById(req.user.id)) });
});

/* -------------------------------- users ------------------------------- */

router.get('/users', requireAuth, requireAdmin, (req, res) => {
  const { role, status, search } = req.query;
  const where = ['1=1'];
  const params = [];
  if (role && ROLES.includes(String(role))) {
    where.push('p.role = ?');
    params.push(role);
  }
  if (status && ACCOUNT_STATUSES.includes(String(status))) {
    where.push('p.account_status = ?');
    params.push(status);
  }
  if (search) {
    where.push('(p.full_name LIKE ? OR p.email LIKE ?)');
    params.push(`%${search}%`, `%${search}%`);
  }

  const rows = q.all(
    `SELECT p.*,
       (SELECT COUNT(*) FROM errors e WHERE e.submitted_by = p.id) AS submitted_count,
       (SELECT COUNT(*) FROM errors e WHERE e.assigned_to = p.id AND e.status NOT IN ('closed','rejected')) AS assigned_open,
       (SELECT COUNT(*) FROM errors e WHERE e.assigned_to = p.id AND e.status = 'resolved') AS resolved_count
     FROM profiles p
     WHERE ${where.join(' AND ')}
     ORDER BY CASE p.role WHEN 'admin' THEN 0 ELSE 1 END, p.full_name`,
    ...params,
  );

  res.json({
    users: rows.map((r) => ({
      ...serializeUser(r),
      submittedCount: r.submitted_count,
      assignedOpen: r.assigned_open,
      resolvedCount: r.resolved_count,
    })),
    summary: {
      total: q.get('SELECT COUNT(*) AS c FROM profiles')?.c ?? 0,
      admins: q.get("SELECT COUNT(*) AS c FROM profiles WHERE role = 'admin'")?.c ?? 0,
      members: q.get("SELECT COUNT(*) AS c FROM profiles WHERE role = 'member'")?.c ?? 0,
      active: q.get("SELECT COUNT(*) AS c FROM profiles WHERE account_status = 'active'")?.c ?? 0,
      inactive: q.get("SELECT COUNT(*) AS c FROM profiles WHERE account_status = 'inactive'")?.c ?? 0,
      pendingRequests: q.get("SELECT COUNT(*) AS c FROM access_requests WHERE request_status = 'pending'")?.c ?? 0,
      pendingInvites: q.get("SELECT COUNT(*) AS c FROM invitations WHERE status = 'pending'")?.c ?? 0,
    },
  });
});

router.get('/users/:id', requireAuth, requireAdmin, (req, res) => {
  const user = findUserById(req.params.id);
  if (!user) return res.status(404).json({ error: 'User not found.', code: 'NOT_FOUND' });

  const counts = q.get(
    `SELECT
       (SELECT COUNT(*) FROM errors WHERE submitted_by = ?) AS submitted,
       (SELECT COUNT(*) FROM errors WHERE assigned_to = ?) AS assigned,
       (SELECT COUNT(*) FROM errors WHERE assigned_to = ? AND status = 'resolved') AS resolved,
       (SELECT COUNT(*) FROM error_comments WHERE author_id = ?) AS comments`,
    req.params.id,
    req.params.id,
    req.params.id,
    req.params.id,
  );

  const activity = q.all(
    `SELECT id, action, entity_type, entity_id, metadata, created_at
     FROM audit_logs WHERE actor_id = ? ORDER BY created_at DESC LIMIT 20`,
    req.params.id,
  ).map((row) => ({ ...row, metadata: row.metadata ? JSON.parse(row.metadata) : null }));

  const recentErrors = q.all(
    `SELECT e.id, e.error_code, e.title, e.status, e.priority, e.created_at, a.name AS application
     FROM errors e JOIN applications a ON a.id = e.application_id
     WHERE e.submitted_by = ? OR e.assigned_to = ?
     ORDER BY e.created_at DESC LIMIT 8`,
    req.params.id,
    req.params.id,
  ).map((r) => ({
    id: r.id,
    errorCode: r.error_code,
    title: r.title,
    status: r.status,
    priority: r.priority,
    application: r.application,
    createdAt: r.created_at,
  }));

  res.json({
    user: serializeUser(user),
    counts: {
      submitted: counts?.submitted ?? 0,
      assigned: counts?.assigned ?? 0,
      resolved: counts?.resolved ?? 0,
      comments: counts?.comments ?? 0,
    },
    activity: activity.map((a) => ({
      id: a.id,
      action: a.action,
      entityType: a.entity_type,
      entityId: a.entity_id,
      metadata: a.metadata,
      createdAt: a.created_at,
    })),
    recentErrors,
  });
});

router.patch('/users/:id/role', requireAuth, requireAdmin, (req, res) => {
  const { role } = req.body || {};
  if (!ROLES.includes(role)) return res.status(400).json({ error: 'Invalid role.', code: 'VALIDATION' });
  const target = findUserById(req.params.id);
  if (!target) return res.status(404).json({ error: 'User not found.', code: 'NOT_FOUND' });
  if (target.id === req.user.id) {
    return res.status(400).json({ error: 'You cannot change your own role.', code: 'SELF_ACTION' });
  }
  if (target.role === role) return res.json({ user: serializeUser(target) });

  if (target.role === 'admin' && role === 'member') {
    const admins = q.get("SELECT COUNT(*) AS c FROM profiles WHERE role = 'admin' AND account_status = 'active'")?.c ?? 0;
    if (admins <= 1) {
      return res.status(409).json({ error: 'At least one active Admin must remain. Promote another user first.', code: 'LAST_ADMIN' });
    }
  }

  q.run('UPDATE profiles SET role = ?, updated_at = ? WHERE id = ?', role, nowIso(), target.id);
  // A role change must not leave a stale privileged session alive.
  q.run('DELETE FROM sessions WHERE user_id = ?', target.id);
  writeAudit({
    actorId: req.user.id,
    actorName: req.user.full_name,
    action: 'user.role_changed',
    entityType: 'profile',
    entityId: target.id,
    metadata: { from: target.role, to: role, email: target.email },
  });
  notifyUser(target.id, {
    type: 'account_created',
    title: 'Your role was updated',
    message: `${req.user.full_name} changed your role to ${role === 'admin' ? 'Admin' : 'Team Member'}.`,
  });
  res.json({ user: serializeUser(findUserById(target.id)) });
});

router.patch('/users/:id/status', requireAuth, requireAdmin, (req, res) => {
  const { accountStatus } = req.body || {};
  if (!ACCOUNT_STATUSES.includes(accountStatus)) {
    return res.status(400).json({ error: 'Invalid account status.', code: 'VALIDATION' });
  }
  const target = findUserById(req.params.id);
  if (!target) return res.status(404).json({ error: 'User not found.', code: 'NOT_FOUND' });
  if (target.id === req.user.id) {
    return res.status(400).json({ error: 'You cannot deactivate your own account.', code: 'SELF_ACTION' });
  }
  if (target.role === 'admin' && target.account_status === 'active' && accountStatus === 'inactive') {
    const admins = q.get("SELECT COUNT(*) AS c FROM profiles WHERE role = 'admin' AND account_status = 'active'")?.c ?? 0;
    if (admins <= 1) {
      return res.status(409).json({ error: 'At least one active Admin must remain.', code: 'LAST_ADMIN' });
    }
  }

  q.run('UPDATE profiles SET account_status = ?, updated_at = ? WHERE id = ?', accountStatus, nowIso(), target.id);
  if (accountStatus === 'inactive') q.run('DELETE FROM sessions WHERE user_id = ?', target.id);
  writeAudit({
    actorId: req.user.id,
    actorName: req.user.full_name,
    action: 'user.status_changed',
    entityType: 'profile',
    entityId: target.id,
    metadata: { from: target.account_status, to: accountStatus, email: target.email },
  });
  if (accountStatus === 'inactive') {
    notifyUser(target.id, {
      type: 'account_created',
      title: 'Your account was deactivated',
      message: `${req.user.full_name} deactivated your access. Contact an administrator to restore it.`,
    });
  }
  res.json({ user: serializeUser(findUserById(target.id)) });
});

router.post('/users/:id/reset-password', requireAuth, requireAdmin, (req, res) => {
  const target = findUserById(req.params.id);
  if (!target) return res.status(404).json({ error: 'User not found.', code: 'NOT_FOUND' });
  const tempPassword = `Temp-${crypto.randomBytes(4).toString('hex')}`;
  const { hash, salt } = hashPassword(tempPassword);
  q.run('UPDATE profiles SET password_hash = ?, password_salt = ?, updated_at = ? WHERE id = ?', hash, salt, nowIso(), target.id);
  q.run('DELETE FROM sessions WHERE user_id = ?', target.id);
  writeAudit({
    actorId: req.user.id,
    actorName: req.user.full_name,
    action: 'user.password_reset',
    entityType: 'profile',
    entityId: target.id,
  });
  res.json({ ok: true, temporaryPassword: tempPassword });
});

/* ----------------------------- invitations ---------------------------- */

router.get('/invitations', requireAuth, requireAdmin, (_req, res) => {
  const rows = q.all(
    `SELECT i.*, p.full_name AS invited_by_name
     FROM invitations i LEFT JOIN profiles p ON p.id = i.invited_by
     ORDER BY i.created_at DESC`,
  );
  res.json({
    invitations: rows.map((r) => ({
      id: r.id,
      email: r.email,
      fullName: r.full_name,
      role: r.role,
      status: r.status === 'pending' && new Date(r.expires_at).getTime() < Date.now() ? 'expired' : r.status,
      invitedBy: r.invited_by_name,
      createdAt: r.created_at,
      expiresAt: r.expires_at,
      acceptedAt: r.accepted_at,
      inviteUrl: `/invite/${r.token}`,
    })),
  });
});

router.post('/users/invite', requireAuth, requireAdmin, (req, res) => {
  const email = String(req.body?.email || '').trim();
  const fullName = String(req.body?.fullName || '').trim();
  const role = String(req.body?.role || 'member');
  if (!isEmail(email)) return res.status(400).json({ error: 'Enter a valid email address.', code: 'VALIDATION' });
  if (fullName.length < 2) return res.status(400).json({ error: 'Enter the person’s full name.', code: 'VALIDATION' });
  if (!ROLES.includes(role)) return res.status(400).json({ error: 'Invalid role.', code: 'VALIDATION' });
  if (findUserById(email) || q.get('SELECT id FROM profiles WHERE email = ?', email)) {
    return res.status(409).json({ error: 'A user with this email already exists.', code: 'CONFLICT' });
  }
  const existingInvite = q.get("SELECT id, token FROM invitations WHERE email = ? AND status = 'pending'", email);
  if (existingInvite && new Date(q.get('SELECT expires_at FROM invitations WHERE id = ?', existingInvite.id).expires_at).getTime() > Date.now()) {
    return res.status(409).json({
      error: 'A pending invitation already exists for this email.',
      code: 'CONFLICT',
      inviteUrl: `/invite/${existingInvite.token}`,
    });
  }

  const token = crypto.randomBytes(24).toString('hex');
  const id = uid();
  q.run(
    `INSERT INTO invitations (id, email, full_name, role, token, status, invited_by, created_at, expires_at)
     VALUES (?, ?, ?, ?, ?, 'pending', ?, ?, ?)`,
    id,
    email,
    fullName,
    role,
    token,
    req.user.id,
    nowIso(),
    new Date(Date.now() + INVITE_TTL_MS).toISOString(),
  );
  writeAudit({
    actorId: req.user.id,
    actorName: req.user.full_name,
    action: 'user.invited',
    entityType: 'invitation',
    entityId: id,
    metadata: { email, role },
  });
  res.status(201).json({
    ok: true,
    inviteUrl: `/invite/${token}`,
    token,
    message: 'Invitation created. Share the one-time link with the teammate to activate their account.',
  });
});

router.delete('/invitations/:id', requireAuth, requireAdmin, (req, res) => {
  const inv = q.get('SELECT * FROM invitations WHERE id = ?', req.params.id);
  if (!inv) return res.status(404).json({ error: 'Invitation not found.', code: 'NOT_FOUND' });
  q.run("UPDATE invitations SET status = 'revoked' WHERE id = ?", inv.id);
  writeAudit({
    actorId: req.user.id,
    actorName: req.user.full_name,
    action: 'invitation.revoked',
    entityType: 'invitation',
    entityId: inv.id,
    metadata: { email: inv.email },
  });
  res.json({ ok: true });
});

/* --------------------------- access requests -------------------------- */

router.get('/access-requests', requireAuth, requireAdmin, (req, res) => {
  const status = String(req.query.status || 'all');
  const rows = q.all(
    `SELECT ar.*, p.full_name AS reviewer_name
     FROM access_requests ar LEFT JOIN profiles p ON p.id = ar.reviewed_by
     ${status !== 'all' ? 'WHERE ar.request_status = ?' : ''}
     ORDER BY ar.created_at DESC`,
    ...(status !== 'all' ? [status] : []),
  );
  res.json({
    requests: rows.map((r) => ({
      id: r.id,
      fullName: r.full_name,
      email: r.email,
      requestReason: r.request_reason,
      requestStatus: r.request_status,
      reviewedBy: r.reviewer_name,
      reviewedAt: r.reviewed_at,
      reviewNote: r.review_note,
      createdAt: r.created_at,
    })),
    summary: {
      pending: q.get("SELECT COUNT(*) AS c FROM access_requests WHERE request_status = 'pending'")?.c ?? 0,
      approved: q.get("SELECT COUNT(*) AS c FROM access_requests WHERE request_status = 'approved'")?.c ?? 0,
      rejected: q.get("SELECT COUNT(*) AS c FROM access_requests WHERE request_status = 'rejected'")?.c ?? 0,
    },
  });
});

router.patch('/access-requests/:id', requireAuth, requireAdmin, (req, res) => {
  const { action, note = '', role = 'member' } = req.body || {};
  if (!['approve', 'reject'].includes(action)) {
    return res.status(400).json({ error: 'Action must be approve or reject.', code: 'VALIDATION' });
  }
  const request = q.get('SELECT * FROM access_requests WHERE id = ?', req.params.id);
  if (!request) return res.status(404).json({ error: 'Access request not found.', code: 'NOT_FOUND' });
  if (request.request_status !== 'pending') {
    return res.status(409).json({ error: 'This request has already been reviewed.', code: 'CONFLICT' });
  }
  if (action === 'approve' && !ROLES.includes(role)) {
    return res.status(400).json({ error: 'Invalid role.', code: 'VALIDATION' });
  }

  const ts = nowIso();
  q.run(
    'UPDATE access_requests SET request_status = ?, reviewed_by = ?, reviewed_at = ?, review_note = ? WHERE id = ?',
    action === 'approve' ? 'approved' : 'rejected',
    req.user.id,
    ts,
    String(note).slice(0, 500) || null,
    request.id,
  );

  let inviteUrl = null;
  if (action === 'approve') {
    const existingUser = q.get('SELECT id FROM profiles WHERE email = ?', request.email);
    if (existingUser) {
      return res.status(409).json({ error: 'A user with this email already exists.', code: 'CONFLICT' });
    }
    const token = crypto.randomBytes(24).toString('hex');
    const id = uid();
    q.run(
      `INSERT INTO invitations (id, email, full_name, role, token, status, invited_by, created_at, expires_at)
       VALUES (?, ?, ?, ?, ?, 'pending', ?, ?, ?)`,
      id,
      request.email,
      request.full_name,
      role,
      token,
      req.user.id,
      ts,
      new Date(Date.now() + INVITE_TTL_MS).toISOString(),
    );
    inviteUrl = `/invite/${token}`;
  }

  writeAudit({
    actorId: req.user.id,
    actorName: req.user.full_name,
    action: `access_request.${action === 'approve' ? 'approved' : 'rejected'}`,
    entityType: 'access_request',
    entityId: request.id,
    metadata: { email: request.email, role: action === 'approve' ? role : null, note },
  });

  res.json({ ok: true, inviteUrl, message: action === 'approve' ? 'Approved. Share the activation link with the requester.' : 'Request rejected.' });
});

/* ------------------------------- settings ----------------------------- */

router.patch('/settings', requireAuth, requireAdmin, (req, res) => {
  const allowed = {
    team_visibility: ['own_or_assigned', 'team_wide'],
    allow_member_submissions: ['true', 'false'],
    require_reason_for_closure: ['true', 'false'],
    max_upload_mb: ['1', '2', '5', '10', '20'],
  };
  const changes = [];
  for (const [key, value] of Object.entries(req.body || {})) {
    if (!allowed[key]) continue;
    if (!allowed[key].includes(String(value))) {
      return res.status(400).json({ error: `Invalid value for ${key}.`, code: 'VALIDATION' });
    }
    q.run(
      `INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
      key,
      String(value),
    );
    changes.push({ key, value: String(value) });
  }
  if (changes.length) {
    writeAudit({
      actorId: req.user.id,
      actorName: req.user.full_name,
      action: 'settings.updated',
      entityType: 'settings',
      metadata: { changes },
    });
  }
  res.json({ ok: true, settings: Object.fromEntries(changes.map((c) => [c.key, c.value])), teamVisibility: getSetting('team_visibility') });
});

export default router;
