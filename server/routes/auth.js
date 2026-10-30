import express from 'express';
import crypto from 'node:crypto';
import { q, uid, nowIso, writeAudit, allSettings } from '../db.js';
import {
  hashPassword,
  verifyPassword,
  createSession,
  setSessionCookie,
  clearSessionCookie,
  destroySession,
  serializeUser,
  findUserByEmail,
  findUserByLogin,
  findUserById,
  touchLogin,
  requireAuth,
  SESSION_COOKIE,
} from '../auth.js';
import { notifyAdmins, notifyUser } from '../notify.js';
import { visibilityLabel } from '../access.js';

const router = express.Router();
const RESET_TTL_MS = 60 * 60 * 1000;
const INVITE_TTL_MS = 7 * 24 * 60 * 60 * 1000;

const isEmail = (value) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(String(value || '').trim());
const passwordIssue = (pw) => {
  if (!pw || String(pw).length < 8) return 'Password must be at least 8 characters.';
  if (!/[a-zA-Z]/.test(pw) || !/[0-9]/.test(pw)) return 'Password must include letters and numbers.';
  return null;
};

/* ------------------------------ session ------------------------------ */

router.get('/me', (req, res) => {
  if (!req.user) {
    if (req.deactivatedUser) {
      return res.status(403).json({ error: 'Your account has been deactivated. Contact an administrator.', code: 'ACCOUNT_INACTIVE' });
    }
    return res.status(401).json({ error: 'Not signed in.', code: 'UNAUTHENTICATED' });
  }
  const unread = q.get(
    'SELECT COUNT(*) AS c FROM notifications WHERE recipient_id = ? AND is_read = 0',
    req.user.id,
  );
  res.json({
    user: serializeUser(req.user),
    unreadNotifications: unread?.c ?? 0,
    settings: allSettings(),
    visibility: visibilityLabel(),
  });
});

router.post('/login', (req, res) => {
  // `identifier` is the preferred key; `email` is accepted for older clients.
  const identifier = String(req.body?.identifier ?? req.body?.email ?? '').trim();
  const password = String(req.body?.password || '');
  const looksLikeIdentifier = isEmail(identifier) || /^[A-Za-z0-9._-]{3,64}$/.test(identifier);
  if (!looksLikeIdentifier || !password) {
    return res.status(400).json({ error: 'Enter your email or username and password.', code: 'VALIDATION' });
  }

  const user = findUserByLogin(identifier);
  if (!user || !verifyPassword(password, user.password_hash, user.password_salt)) {
    writeAudit({
      actorId: user?.id ?? null,
      actorName: user?.full_name ?? identifier,
      action: 'auth.login_failed',
      entityType: 'profile',
      entityId: user?.id ?? null,
      metadata: { identifier },
    });
    return res.status(401).json({ error: 'Incorrect email, username or password.', code: 'INVALID_CREDENTIALS' });
  }

  if (user.account_status !== 'active') {
    return res.status(403).json({
      error: 'Your account is deactivated. An administrator must reactivate it before you can sign in.',
      code: 'ACCOUNT_INACTIVE',
    });
  }

  const session = createSession(user.id, req.get('user-agent'));
  setSessionCookie(res, session, req);
  touchLogin(user.id);
  writeAudit({
    actorId: user.id,
    actorName: user.full_name,
    action: 'auth.login',
    entityType: 'profile',
    entityId: user.id,
  });

  const fresh = findUserById(user.id);
  res.json({ user: serializeUser(fresh), settings: allSettings(), token: session.id });
});

router.post('/logout', (req, res) => {
  const header = req.get('authorization') || '';
  const token = header.toLowerCase().startsWith('bearer ') ? header.slice(7).trim() : req.cookies?.[SESSION_COOKIE];
  if (req.user) {
    writeAudit({
      actorId: req.user.id,
      actorName: req.user.full_name,
      action: 'auth.logout',
      entityType: 'profile',
      entityId: req.user.id,
    });
  }
  destroySession(token);
  clearSessionCookie(res, req);
  res.json({ ok: true });
});

router.post('/change-password', requireAuth, (req, res) => {
  const { currentPassword, newPassword } = req.body || {};
  if (!verifyPassword(currentPassword, req.user.password_hash, req.user.password_salt)) {
    return res.status(400).json({ error: 'Your current password is incorrect.', code: 'VALIDATION' });
  }
  const issue = passwordIssue(newPassword);
  if (issue) return res.status(400).json({ error: issue, code: 'VALIDATION' });

  const { hash, salt } = hashPassword(newPassword);
  q.run(
    'UPDATE profiles SET password_hash = ?, password_salt = ?, updated_at = ? WHERE id = ?',
    hash,
    salt,
    nowIso(),
    req.user.id,
  );
  // Sign out every other session; keep the one that made the change.
  q.run('DELETE FROM sessions WHERE user_id = ? AND id != ?', req.user.id, req.sessionId ?? '');
  writeAudit({
    actorId: req.user.id,
    actorName: req.user.full_name,
    action: 'auth.password_changed',
    entityType: 'profile',
    entityId: req.user.id,
  });
  res.json({ ok: true });
});

/* --------------------------- password reset --------------------------- */

router.post('/forgot-password', (req, res) => {
  const email = String(req.body?.email || '').trim();
  const generic = {
    ok: true,
    message: 'If an account exists for that email, a reset link has been generated.',
  };
  if (!isEmail(email)) return res.status(400).json({ error: 'Enter a valid email address.', code: 'VALIDATION' });

  const user = findUserByEmail(email);
  if (!user) return res.json(generic);

  const token = crypto.randomBytes(24).toString('hex');
  const expiresAt = new Date(Date.now() + RESET_TTL_MS).toISOString();
  q.run(
    `INSERT INTO password_resets (token, user_id, created_at, expires_at, used_at)
     VALUES (?, ?, ?, ?, NULL)`,
    token,
    user.id,
    nowIso(),
    expiresAt,
  );
  writeAudit({
    actorId: user.id,
    actorName: user.full_name,
    action: 'auth.password_reset_requested',
    entityType: 'profile',
    entityId: user.id,
  });

  // In a production deployment the token is emailed. This environment has no
  // mail transport, so the token is surfaced in the response outside production.
  const payload = { ...generic };
  if (process.env.NODE_ENV !== 'production') {
    payload.devResetToken = token;
    payload.devResetUrl = `/reset-password?token=${token}`;
    payload.devNote = 'No email provider is configured in this environment, so the reset link is shown here.';
  }
  res.json(payload);
});

router.post('/reset-password', (req, res) => {
  const token = String(req.body?.token || '');
  const newPassword = String(req.body?.newPassword || '');
  const issue = passwordIssue(newPassword);
  if (issue) return res.status(400).json({ error: issue, code: 'VALIDATION' });

  const reset = q.get('SELECT * FROM password_resets WHERE token = ?', token);
  if (!reset || reset.used_at || new Date(reset.expires_at).getTime() < Date.now()) {
    return res.status(400).json({ error: 'This reset link is invalid or has expired.', code: 'INVALID_TOKEN' });
  }

  const { hash, salt } = hashPassword(newPassword);
  q.run('UPDATE profiles SET password_hash = ?, password_salt = ?, updated_at = ? WHERE id = ?', hash, salt, nowIso(), reset.user_id);
  q.run('UPDATE password_resets SET used_at = ? WHERE token = ?', nowIso(), token);
  q.run('DELETE FROM sessions WHERE user_id = ?', reset.user_id);
  writeAudit({
    actorId: reset.user_id,
    actorName: findUserById(reset.user_id)?.full_name ?? null,
    action: 'auth.password_reset_completed',
    entityType: 'profile',
    entityId: reset.user_id,
  });
  res.json({ ok: true });
});

/* ------------------------- access requests --------------------------- */

router.post('/access-request', (req, res) => {
  const fullName = String(req.body?.fullName || '').trim();
  const email = String(req.body?.email || '').trim();
  const reason = String(req.body?.requestReason || '').trim();

  if (fullName.length < 2) return res.status(400).json({ error: 'Enter your full name.', code: 'VALIDATION' });
  if (!isEmail(email)) return res.status(400).json({ error: 'Enter a valid work email.', code: 'VALIDATION' });
  if (reason.length < 10) {
    return res.status(400).json({ error: 'Tell us briefly why you need access (at least 10 characters).', code: 'VALIDATION' });
  }

  if (findUserByEmail(email)) {
    return res.status(409).json({ error: 'An account already exists for this email. Try signing in instead.', code: 'CONFLICT' });
  }
  const pending = q.get(
    "SELECT id FROM access_requests WHERE email = ? AND request_status = 'pending'",
    email,
  );
  if (pending) {
    return res.status(409).json({ error: 'An access request for this email is already awaiting review.', code: 'CONFLICT' });
  }

  const id = uid();
  q.run(
    `INSERT INTO access_requests (id, full_name, email, request_reason, request_status, created_at)
     VALUES (?, ?, ?, ?, 'pending', ?)`,
    id,
    fullName,
    email,
    reason,
    nowIso(),
  );
  notifyAdmins({
    type: 'access_requested',
    title: 'New access request',
    message: `${fullName} (${email}) requested access.`,
  });
  writeAudit({
    actorName: fullName,
    action: 'access_request.submitted',
    entityType: 'access_request',
    entityId: id,
    metadata: { email },
  });
  res.status(201).json({ ok: true, message: 'Request received. An administrator will review it shortly.' });
});

/* --------------------------- invitations ----------------------------- */

router.get('/invitation/:token', (req, res) => {
  const inv = q.get('SELECT * FROM invitations WHERE token = ?', req.params.token);
  if (!inv) return res.status(404).json({ error: 'This invitation link is invalid.', code: 'NOT_FOUND' });
  const expired = new Date(inv.expires_at).getTime() < Date.now();
  res.json({
    invitation: {
      email: inv.email,
      fullName: inv.full_name,
      role: inv.role,
      status: inv.status === 'pending' && expired ? 'expired' : inv.status,
    },
  });
});

router.post('/accept-invitation', (req, res) => {
  const token = String(req.body?.token || '');
  const password = String(req.body?.password || '');
  const fullName = String(req.body?.fullName || '').trim();

  const inv = q.get('SELECT * FROM invitations WHERE token = ?', token);
  if (!inv) return res.status(404).json({ error: 'This invitation link is invalid.', code: 'NOT_FOUND' });
  if (inv.status !== 'pending') {
    return res.status(409).json({ error: `This invitation has already been ${inv.status}.`, code: 'CONFLICT' });
  }
  if (new Date(inv.expires_at).getTime() < Date.now()) {
    return res.status(410).json({ error: 'This invitation has expired. Ask an administrator for a new one.', code: 'EXPIRED' });
  }
  const issue = passwordIssue(password);
  if (issue) return res.status(400).json({ error: issue, code: 'VALIDATION' });

  const existing = findUserByEmail(inv.email);
  if (existing) {
    return res.status(409).json({ error: 'An account already exists for this email. Try signing in.', code: 'CONFLICT' });
  }

  const { hash, salt } = hashPassword(password);
  const ts = nowIso();
  const id = uid();
  q.run(
    `INSERT INTO profiles (id, full_name, email, role, account_status, avatar_tone, password_hash, password_salt, created_at, updated_at)
     VALUES (?, ?, ?, ?, 'active', ?, ?, ?, ?, ?)`,
    id,
    fullName || inv.full_name,
    inv.email,
    inv.role,
    'indigo',
    hash,
    salt,
    ts,
    ts,
  );
  q.run("UPDATE invitations SET status = 'accepted', accepted_at = ? WHERE id = ?", ts, inv.id);

  notifyAdmins({
    type: 'account_created',
    title: 'Invitation accepted',
    message: `${fullName || inv.full_name} (${inv.email}) activated their ${inv.role === 'admin' ? 'Admin' : 'Team Member'} account.`,
    excludeUserId: id,
  });
  writeAudit({
    actorId: id,
    actorName: fullName || inv.full_name,
    action: 'invitation.accepted',
    entityType: 'invitation',
    entityId: inv.id,
    metadata: { email: inv.email, role: inv.role },
  });

  const session = createSession(id, req.get('user-agent'));
  setSessionCookie(res, session, req);
  touchLogin(id);
  res.status(201).json({ user: serializeUser(findUserById(id)), settings: allSettings(), token: session.id });
});

router.post('/resend-invitation/:id', requireAuth, (req, res, next) => {
  // Admin-only. Re-issues an invitation token for a pending/expired invite.
  if (req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Admin privileges are required for this action.', code: 'FORBIDDEN' });
  }
  try {
    const inv = q.get('SELECT * FROM invitations WHERE id = ?', req.params.id);
    if (!inv) return res.status(404).json({ error: 'Invitation not found.', code: 'NOT_FOUND' });
    const token = crypto.randomBytes(24).toString('hex');
    q.run(
      "UPDATE invitations SET token = ?, status = 'pending', created_at = ?, expires_at = ? WHERE id = ?",
      token,
      nowIso(),
      new Date(Date.now() + INVITE_TTL_MS).toISOString(),
      inv.id,
    );
    writeAudit({
      actorId: req.user.id,
      actorName: req.user.full_name,
      action: 'invitation.resent',
      entityType: 'invitation',
      entityId: inv.id,
    });
    res.json({ ok: true, inviteUrl: `/invite/${token}`, token });
  } catch (err) {
    next(err);
  }
});

export default router;
