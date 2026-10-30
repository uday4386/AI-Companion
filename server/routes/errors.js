import express from 'express';
import multer from 'multer';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { q, uid, nowIso, writeAudit, getSetting, nextErrorCode, UPLOAD_DIR } from '../db.js';
import { requireAuth, requireAdmin } from '../auth.js';
import { canViewError, assertVisible, memberVisibilitySql, canViewAdminNotes } from '../access.js';
import { notifyUser, notifyAdmins } from '../notify.js';
import {
  STATUSES,
  STATUS_META,
  PRIORITIES,
  PRIORITY_META,
  CATEGORIES,
  REASON_REQUIRED,
  isValidTransition,
  nextStatuses,
  LIMITS,
} from '../config.js';

const router = express.Router();

/* ------------------------------ helpers ------------------------------ */

const MAX_UPLOAD_BYTES = 20 * 1024 * 1024;

const storage = multer.diskStorage({
  destination(req, _file, cb) {
    const dir = path.join(UPLOAD_DIR, 'errors', req.params.id || 'tmp');
    fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename(_req, file, cb) {
    const ext = path.extname(file.originalname || '').slice(0, 12).replace(/[^.\w]/g, '');
    cb(null, `${crypto.randomBytes(12).toString('hex')}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: MAX_UPLOAD_BYTES, files: LIMITS.maxAttachmentsPerUpload },
  fileFilter(_req, file, cb) {
    if (!LIMITS.allowedMimeTypes.includes(file.mimetype)) {
      const err = new Error(`Unsupported file type: ${file.mimetype || 'unknown'}. Upload images, PDF, text, CSV, JSON, ZIP or Office documents.`);
      err.code = 'UNSUPPORTED_FILE_TYPE';
      return cb(err);
    }
    cb(null, true);
  },
});

function removeUploaded(files = []) {
  for (const f of files) {
    try { fs.unlinkSync(f.path); } catch { /* ignore */ }
  }
}

function serializeError(row) {
  return {
    id: row.id,
    errorCode: row.error_code,
    title: row.title,
    application: row.application_id
      ? { id: row.application_id, name: row.application_name, color: row.application_color }
      : null,
    module: row.module,
    category: row.category,
    priority: row.priority,
    status: row.status,
    submittedBy: row.submitted_by
      ? { id: row.submitted_by, fullName: row.submitter_name, avatarTone: row.submitter_tone }
      : null,
    assignedTo: row.assigned_to
      ? { id: row.assigned_to, fullName: row.assignee_name, avatarTone: row.assignee_tone }
      : null,
    description: row.description,
    reproductionSteps: row.reproduction_steps,
    expectedResult: row.expected_result,
    actualResult: row.actual_result,
    adminRemark: row.admin_remark,
    resolutionSummary: row.resolution_summary,
    rootCause: row.root_cause,
    isArchived: Boolean(row.is_archived),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    resolvedAt: row.resolved_at,
    closedAt: row.closed_at,
    commentCount: row.comment_count ?? undefined,
    attachmentCount: row.attachment_count ?? undefined,
  };
}

const BASE_SELECT = `
  SELECT e.*,
    a.name AS application_name,
    a.color AS application_color,
    s.full_name AS submitter_name,
    s.avatar_tone AS submitter_tone,
    t.full_name AS assignee_name,
    t.avatar_tone AS assignee_tone,
    (SELECT COUNT(*) FROM error_comments c WHERE c.error_id = e.id) AS comment_count,
    (SELECT COUNT(*) FROM error_attachments at WHERE at.error_id = e.id) AS attachment_count
  FROM errors e
  JOIN applications a ON a.id = e.application_id
  JOIN profiles s ON s.id = e.submitted_by
  LEFT JOIN profiles t ON t.id = e.assigned_to
`;

function buildFilters(req) {
  const conds = [];
  const params = [];
  const { search, status, priority, applicationId, module, category, submittedBy, assignedTo, dateFrom, dateTo, scope, includeArchived } = req.query;

  const vis = memberVisibilitySql(req.user);
  conds.push(vis.clause);
  params.push(...vis.params);

  if (scope === 'mine') {
    conds.push('e.submitted_by = ?');
    params.push(req.user.id);
  }
  if (scope === 'assigned') {
    conds.push('e.assigned_to = ?');
    params.push(req.user.id);
  }
  if (search) {
    conds.push('(e.error_code LIKE ? OR e.title LIKE ? OR e.description LIKE ? OR a.name LIKE ?)');
    const like = `%${search}%`;
    params.push(like, like, like, like);
  }
  if (status) {
    const list = String(status).split(',').map((s) => s.trim()).filter((s) => STATUSES.includes(s));
    if (list.length) {
      conds.push(`e.status IN (${list.map(() => '?').join(',')})`);
      params.push(...list);
    }
  }
  if (priority) {
    const list = String(priority).split(',').map((s) => s.trim()).filter((s) => PRIORITIES.includes(s));
    if (list.length) {
      conds.push(`e.priority IN (${list.map(() => '?').join(',')})`);
      params.push(...list);
    }
  }
  if (applicationId) {
    conds.push('e.application_id = ?');
    params.push(String(applicationId));
  }
  if (module) {
    conds.push('e.module = ?');
    params.push(String(module));
  }
  if (category && CATEGORIES.includes(String(category))) {
    conds.push('e.category = ?');
    params.push(String(category));
  }
  if (submittedBy) {
    conds.push('e.submitted_by = ?');
    params.push(String(submittedBy));
  }
  if (assignedTo === 'unassigned') {
    conds.push('e.assigned_to IS NULL');
  } else if (assignedTo) {
    conds.push('e.assigned_to = ?');
    params.push(String(assignedTo));
  }
  if (dateFrom) {
    conds.push('e.created_at >= ?');
    params.push(`${dateFrom}T00:00:00.000Z`);
  }
  if (dateTo) {
    conds.push('e.created_at <= ?');
    params.push(`${dateTo}T23:59:59.999Z`);
  }
  if (includeArchived !== 'true') conds.push('e.is_archived = 0');

  return { where: conds.join(' AND '), params };
}

const SORTS = {
  newest: 'e.created_at DESC',
  oldest: 'e.created_at ASC',
  updated: 'e.updated_at DESC',
  priority: `CASE e.priority WHEN 'critical' THEN 1 WHEN 'high' THEN 2 WHEN 'medium' THEN 3 ELSE 4 END ASC, e.created_at DESC`,
  status: `CASE e.status WHEN 'submitted' THEN 1 WHEN 'under_review' THEN 2 WHEN 'assigned' THEN 3 WHEN 'in_progress' THEN 4 WHEN 'reopened' THEN 5 WHEN 'on_hold' THEN 6 WHEN 'resolved' THEN 7 WHEN 'rejected' THEN 8 ELSE 9 END ASC, e.created_at DESC`,
};

/* ------------------------------- list -------------------------------- */

router.get('/', requireAuth, (req, res) => {
  const { where, params } = buildFilters(req);
  const sort = SORTS[String(req.query.sort || 'newest')] || SORTS.newest;
  const page = Math.max(1, Number.parseInt(req.query.page ?? '1', 10) || 1);
  const pageSize = Math.min(100, Math.max(5, Number.parseInt(req.query.pageSize ?? '10', 10) || 10));
  const offset = (page - 1) * pageSize;

  const total = q.get(`SELECT COUNT(*) AS c FROM errors e JOIN applications a ON a.id = e.application_id WHERE ${where}`, ...params)?.c ?? 0;
  const rows = q.all(`${BASE_SELECT} WHERE ${where} ORDER BY ${sort} LIMIT ? OFFSET ?`, ...params, pageSize, offset);

  res.json({
    items: rows.map(serializeError),
    pagination: { page, pageSize, total, totalPages: Math.max(1, Math.ceil(total / pageSize)) },
    sort: req.query.sort || 'newest',
  });
});

/** Status buckets for the current filter set (ignoring the status filter). */
router.get('/facets', requireAuth, (req, res) => {
  const query = { ...req.query };
  delete query.status;
  const { where, params } = buildFilters({ ...req, query });
  const rows = q.all(
    `SELECT e.status, COUNT(*) AS c FROM errors e JOIN applications a ON a.id = e.application_id WHERE ${where} GROUP BY e.status`,
    ...params,
  );
  const counts = Object.fromEntries(STATUSES.map((s) => [s, 0]));
  let total = 0;
  for (const row of rows) {
    counts[row.status] = row.c;
    total += row.c;
  }
  res.json({ counts, total });
});

/* ------------------------------ create ------------------------------- */

router.post('/', requireAuth, (req, res) => {
  if (req.user.role === 'member' && getSetting('allow_member_submissions') === 'false') {
    return res.status(403).json({ error: 'Error submissions are currently restricted to Admins.', code: 'SUBMISSION_DISABLED' });
  }

  const {
    title, applicationId, module, category, priority,
    description, reproductionSteps, expectedResult, actualResult, adminRemark,
  } = req.body || {};

  const errors = {};
  if (!String(title || '').trim() || String(title).trim().length < 6) errors.title = 'Title must be at least 6 characters.';
  if (!applicationId) errors.applicationId = 'Select the application affected.';
  if (!String(module || '').trim()) errors.module = 'Module is required.';
  if (!CATEGORIES.includes(String(category))) errors.category = 'Select a valid category.';
  if (!PRIORITIES.includes(String(priority))) errors.priority = 'Select a priority.';
  if (!String(description || '').trim() || String(description).trim().length < 15) {
    errors.description = 'Describe the observed behaviour in at least 15 characters.';
  }
  if (Object.keys(errors).length) {
    return res.status(400).json({ error: 'Please correct the highlighted fields.', code: 'VALIDATION', fields: errors });
  }

  const app = q.get('SELECT * FROM applications WHERE id = ?', String(applicationId));
  if (!app) return res.status(400).json({ error: 'Selected application does not exist.', code: 'VALIDATION', fields: { applicationId: 'Unknown application.' } });

  const now = nowIso();
  const id = uid();

  const created = q.tx(() => {
    const code = nextErrorCode();
    q.run(
      `INSERT INTO errors (id, error_code, title, application_id, module, category, priority, description,
        reproduction_steps, expected_result, actual_result, submitted_by, assigned_to, status, admin_remark,
        is_archived, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, 'submitted', ?, 0, ?, ?)`,
      id,
      code,
      String(title).trim(),
      app.id,
      String(module).trim(),
      String(category),
      String(priority),
      String(description).trim(),
      String(reproductionSteps || '').trim() || null,
      String(expectedResult || '').trim() || null,
      String(actualResult || '').trim() || null,
      req.user.id,
      req.user.role === 'admin' ? (String(adminRemark || '').trim() || null) : null,
      now,
      now,
    );
    q.run(
      `INSERT INTO error_status_history (id, error_id, old_status, new_status, changed_by, change_reason, changed_at)
       VALUES (?, ?, NULL, 'submitted', ?, 'Report created', ?)`,
      uid(),
      id,
      req.user.id,
      now,
    );
    return q.get(`${BASE_SELECT} WHERE e.id = ?`, id);
  });

  notifyAdmins({
    type: 'error_submitted',
    title: 'New error submitted',
    message: `${created.error_code} · ${created.title}`,
    errorId: id,
    excludeUserId: req.user.id,
  });
  writeAudit({
    actorId: req.user.id,
    actorName: req.user.full_name,
    action: 'error.created',
    entityType: 'error',
    entityId: id,
    metadata: { errorCode: created.error_code, title: created.title, priority: created.priority },
  });

  res.status(201).json({ error: serializeError(created) });
});

/* ------------------------------ detail ------------------------------- */

router.get('/:id', requireAuth, (req, res) => {
  const row = q.get(`${BASE_SELECT} WHERE e.id = ?`, req.params.id);
  if (!assertVisible(req.user, row, res)) return;

  const isAdmin = req.user.role === 'admin';
  const attachments = q.all(
    `SELECT at.*, p.full_name AS uploader_name
     FROM error_attachments at JOIN profiles p ON p.id = at.uploaded_by
     WHERE at.error_id = ? ORDER BY at.created_at ASC`,
    row.id,
  ).map((a) => ({
    id: a.id,
    originalFilename: a.original_filename,
    mimeType: a.mime_type,
    sizeBytes: a.size_bytes,
    uploadedBy: a.uploader_name,
    createdAt: a.created_at,
    url: `/api/errors/${row.id}/attachments/${a.id}/download`,
  }));

  const comments = q.all(
    `SELECT c.*, p.full_name AS author_name, p.role AS author_role, p.avatar_tone AS author_tone
     FROM error_comments c JOIN profiles p ON p.id = c.author_id
     WHERE c.error_id = ? ${isAdmin ? '' : "AND c.visibility = 'public'"}
     ORDER BY c.created_at ASC`,
    row.id,
  ).map((c) => ({
    id: c.id,
    text: c.comment_text,
    visibility: c.visibility,
    author: { id: c.author_id, fullName: c.author_name, role: c.author_role, avatarTone: c.author_tone },
    createdAt: c.created_at,
  }));

  const history = q.all(
    `SELECT h.*, p.full_name AS actor_name, p.role AS actor_role
     FROM error_status_history h JOIN profiles p ON p.id = h.changed_by
     WHERE h.error_id = ? ORDER BY h.changed_at ASC`,
    row.id,
  ).map((h) => ({
    id: h.id,
    oldStatus: h.old_status,
    newStatus: h.new_status,
    reason: h.change_reason,
    actor: { id: h.changed_by, fullName: h.actor_name, role: h.actor_role },
    changedAt: h.changed_at,
  }));

  const isOwn = row.submitted_by === req.user.id;
  const canEditCore = isAdmin || (isOwn && ['submitted', 'under_review'].includes(row.status));

  res.json({
    error: serializeError(row),
    attachments,
    comments,
    history,
    permissions: {
      canChangeStatus: isAdmin,
      canAssign: isAdmin,
      canComment: true,
      canEditCore,
      canEditAdminFields: isAdmin,
      canUpload: isAdmin || isOwn || row.assigned_to === req.user.id,
      canArchive: isAdmin,
      canViewAdminNotes: canViewAdminNotes(req.user),
    },
    availableTransitions: isAdmin ? nextStatuses(row.status).map((s) => ({ value: s, ...STATUS_META[s], reasonRequired: REASON_REQUIRED.includes(s) })) : [],
  });
});

/* ------------------------------- update ------------------------------ */

router.patch('/:id', requireAuth, (req, res) => {
  const row = q.get('SELECT * FROM errors WHERE id = ?', req.params.id);
  if (!assertVisible(req.user, row, res)) return;

  const isAdmin = req.user.role === 'admin';
  const isOwn = row.submitted_by === req.user.id;
  const editableCore = isAdmin || (isOwn && ['submitted', 'under_review'].includes(row.status));

  const body = req.body || {};
  const coreFields = ['title', 'applicationId', 'module', 'category', 'priority', 'description', 'reproductionSteps', 'expectedResult', 'actualResult'];
  const adminFields = ['adminRemark', 'resolutionSummary', 'rootCause'];
  const touchesCore = coreFields.some((f) => body[f] !== undefined);
  const touchesAdmin = adminFields.some((f) => body[f] !== undefined);

  if (touchesCore && !editableCore) {
    return res.status(403).json({
      error: 'Core details can no longer be edited after review. Add a comment with the new information instead.',
      code: 'FORBIDDEN',
    });
  }
  if (touchesAdmin && !isAdmin) {
    return res.status(403).json({ error: 'Only Admins can edit remarks and resolution details.', code: 'FORBIDDEN' });
  }
  if (!touchesCore && !touchesAdmin) {
    return res.status(400).json({ error: 'No editable fields were provided.', code: 'VALIDATION' });
  }

  if (body.title !== undefined && String(body.title).trim().length < 6) {
    return res.status(400).json({ error: 'Title must be at least 6 characters.', code: 'VALIDATION', fields: { title: 'Too short.' } });
  }
  if (body.priority !== undefined && !PRIORITIES.includes(String(body.priority))) {
    return res.status(400).json({ error: 'Invalid priority.', code: 'VALIDATION' });
  }
  if (body.category !== undefined && !CATEGORIES.includes(String(body.category))) {
    return res.status(400).json({ error: 'Invalid category.', code: 'VALIDATION' });
  }
  if (body.applicationId !== undefined && !q.get('SELECT id FROM applications WHERE id = ?', String(body.applicationId))) {
    return res.status(400).json({ error: 'Application not found.', code: 'VALIDATION' });
  }
  if (body.description !== undefined && String(body.description).trim().length < 15) {
    return res.status(400).json({ error: 'Description must be at least 15 characters.', code: 'VALIDATION' });
  }

  const map = {
    title: 'title',
    applicationId: 'application_id',
    module: 'module',
    category: 'category',
    priority: 'priority',
    description: 'description',
    reproductionSteps: 'reproduction_steps',
    expectedResult: 'expected_result',
    actualResult: 'actual_result',
    adminRemark: 'admin_remark',
    resolutionSummary: 'resolution_summary',
    rootCause: 'root_cause',
  };

  const sets = [];
  const params = [];
  const diff = {};
  for (const [field, column] of Object.entries(map)) {
    if (body[field] === undefined) continue;
    const value = typeof body[field] === 'string' ? body[field].trim() : body[field];
    const next = value === '' ? null : value;
    if ((row[column] ?? null) === (next ?? null)) continue;
    sets.push(`${column} = ?`);
    params.push(next ?? null);
    diff[field] = { from: row[column] ?? null, to: next ?? null };
  }
  if (!sets.length) return res.json({ error: serializeError(q.get(`${BASE_SELECT} WHERE e.id = ?`, row.id)) });

  sets.push('updated_at = ?');
  params.push(nowIso(), row.id);
  q.run(`UPDATE errors SET ${sets.join(', ')} WHERE id = ?`, ...params);

  writeAudit({
    actorId: req.user.id,
    actorName: req.user.full_name,
    action: 'error.updated',
    entityType: 'error',
    entityId: row.id,
    metadata: { errorCode: row.error_code, changes: diff },
  });

  if (isAdmin && diff.adminRemark) {
    notifyUser(row.submitted_by, {
      type: 'admin_remark',
      title: 'Admin note added',
      message: `${row.error_code}: an administrator added or updated a note on your report.`,
      errorId: row.id,
    });
  }
  if (isAdmin && diff.assigned_to === undefined && diff.resolutionSummary) {
    if (row.assigned_to) {
      notifyUser(row.assigned_to, {
        type: 'admin_remark',
        title: 'Resolution details updated',
        message: `${row.error_code}: resolution details were updated.`,
        errorId: row.id,
      });
    }
  }

  res.json({ error: serializeError(q.get(`${BASE_SELECT} WHERE e.id = ?`, row.id)) });
});

/* ----------------------------- assignment ---------------------------- */

router.patch('/:id/assign', requireAuth, requireAdmin, (req, res) => {
  const row = q.get('SELECT * FROM errors WHERE id = ?', req.params.id);
  if (!row) return res.status(404).json({ error: 'Error record not found.', code: 'NOT_FOUND' });

  const assigneeId = req.body?.assigneeId ? String(req.body.assigneeId) : null;
  let assignee = null;
  if (assigneeId) {
    assignee = q.get("SELECT * FROM profiles WHERE id = ? AND account_status = 'active'", assigneeId);
    if (!assignee) return res.status(400).json({ error: 'Select an active team member.', code: 'VALIDATION' });
  }
  if ((row.assigned_to ?? null) === (assigneeId ?? null)) {
    return res.json({ error: serializeError(q.get(`${BASE_SELECT} WHERE e.id = ?`, row.id)) });
  }

  const previous = row.assigned_to;
  const now = nowIso();
  let status = row.status;
  let statusChanged = false;

  if (assigneeId && ['submitted', 'under_review'].includes(row.status)) {
    status = 'assigned';
    statusChanged = true;
  } else if (!assigneeId && row.status === 'assigned') {
    status = 'under_review';
    statusChanged = true;
  }

  q.tx(() => {
    q.run('UPDATE errors SET assigned_to = ?, status = ?, updated_at = ? WHERE id = ?', assigneeId, status, now, row.id);
    if (statusChanged) {
      q.run(
        `INSERT INTO error_status_history (id, error_id, old_status, new_status, changed_by, change_reason, changed_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        uid(),
        row.id,
        row.status,
        status,
        req.user.id,
        assigneeId ? `Assigned to ${assignee.full_name}` : 'Assignment removed',
        now,
      );
    }
  });

  writeAudit({
    actorId: req.user.id,
    actorName: req.user.full_name,
    action: 'error.assigned',
    entityType: 'error',
    entityId: row.id,
    metadata: { errorCode: row.error_code, from: previous, to: assigneeId, statusFrom: row.status, statusTo: status },
  });

  const refreshed = q.get(`${BASE_SELECT} WHERE e.id = ?`, row.id);

  if (assigneeId && assigneeId !== req.user.id) {
    notifyUser(assigneeId, {
      type: 'assigned',
      title: 'Error assigned to you',
      message: `${row.error_code} · ${row.title} (${PRIORITY_META[row.priority].label} priority)`,
      errorId: row.id,
    });
  }
  if (previous && previous !== assigneeId && previous !== req.user.id) {
    notifyUser(previous, {
      type: 'assigned',
      title: 'Error reassigned',
      message: `${row.error_code} is no longer assigned to you.`,
      errorId: row.id,
    });
  }
  if (row.submitted_by !== req.user.id) {
    notifyUser(row.submitted_by, {
      type: 'status_changed',
      title: assigneeId ? 'Your report was assigned' : 'Assignment changed on your report',
      message: assigneeId
        ? `${row.error_code} was assigned to ${assignee.full_name}.`
        : `${row.error_code} no longer has an assignee.`,
      errorId: row.id,
    });
  }

  res.json({ error: serializeError(refreshed) });
});

/* ------------------------------ status ------------------------------- */

router.post('/:id/status', requireAuth, requireAdmin, (req, res) => {
  const row = q.get('SELECT * FROM errors WHERE id = ?', req.params.id);
  if (!row) return res.status(404).json({ error: 'Error record not found.', code: 'NOT_FOUND' });

  const target = String(req.body?.status || '');
  const reason = String(req.body?.reason || '').trim();
  const resolutionSummary = req.body?.resolutionSummary !== undefined ? String(req.body.resolutionSummary).trim() : undefined;
  const rootCause = req.body?.rootCause !== undefined ? String(req.body.rootCause).trim() : undefined;

  if (!STATUSES.includes(target)) {
    return res.status(400).json({ error: 'Unknown status.', code: 'VALIDATION' });
  }
  if (target === row.status) {
    return res.status(409).json({ error: `The report is already ${STATUS_META[target].label}.`, code: 'NO_CHANGE' });
  }
  if (!isValidTransition(row.status, target)) {
    return res.status(422).json({
      error: `Cannot move from ${STATUS_META[row.status].label} to ${STATUS_META[target].label}.`,
      code: 'INVALID_TRANSITION',
      allowed: nextStatuses(row.status),
    });
  }
  const closureReasonRequired = getSetting('require_reason_for_closure') !== 'false';
  const needsReason = REASON_REQUIRED.includes(target) && !(target === 'closed' && !closureReasonRequired);
  if (needsReason && reason.length < 5) {
    return res.status(400).json({
      error: `A reason of at least 5 characters is required to mark this report as ${STATUS_META[target].label}.`,
      code: 'REASON_REQUIRED',
      fields: { reason: 'Required' },
    });
  }
  if (target === 'resolved' && !(resolutionSummary ?? row.resolution_summary)) {
    return res.status(400).json({
      error: 'Record what was done to resolve the error before marking it Resolved.',
      code: 'RESOLUTION_REQUIRED',
      fields: { resolutionSummary: 'Required' },
    });
  }

  const now = nowIso();
  const sets = ['status = ?', 'updated_at = ?'];
  const params = [target, now];
  if (resolutionSummary !== undefined) {
    sets.push('resolution_summary = ?');
    params.push(resolutionSummary || null);
  }
  if (rootCause !== undefined) {
    sets.push('root_cause = ?');
    params.push(rootCause || null);
  }
  if (req.body?.adminRemark !== undefined) {
    sets.push('admin_remark = ?');
    params.push(String(req.body.adminRemark).trim() || null);
  }
  if (target === 'resolved') {
    sets.push('resolved_at = ?');
    params.push(now);
  }
  if (target === 'closed') {
    sets.push('closed_at = ?');
    params.push(now);
    if (!row.resolved_at) {
      sets.push('resolved_at = ?');
      params.push(now);
    }
  }
  if (target === 'reopened') {
    sets.push('resolved_at = NULL', 'closed_at = NULL');
  }

  q.tx(() => {
    q.run(`UPDATE errors SET ${sets.join(', ')} WHERE id = ?`, ...params, row.id);
    q.run(
      `INSERT INTO error_status_history (id, error_id, old_status, new_status, changed_by, change_reason, changed_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      uid(),
      row.id,
      row.status,
      target,
      req.user.id,
      reason || null,
      now,
    );
  });

  writeAudit({
    actorId: req.user.id,
    actorName: req.user.full_name,
    action: 'error.status_changed',
    entityType: 'error',
    entityId: row.id,
    metadata: { errorCode: row.error_code, from: row.status, to: target, reason: reason || null },
  });

  const recipients = new Set([row.submitted_by, row.assigned_to].filter(Boolean));
  recipients.delete(req.user.id);
  for (const recipient of recipients) {
    notifyUser(recipient, {
      type: 'status_changed',
      title: `Status updated to ${STATUS_META[target].label}`,
      message: `${row.error_code} · ${row.title}${reason ? ` — ${reason}` : ''}`,
      errorId: row.id,
    });
  }

  res.json({
    error: serializeError(q.get(`${BASE_SELECT} WHERE e.id = ?`, row.id)),
    availableTransitions: nextStatuses(target).map((s) => ({ value: s, ...STATUS_META[s], reasonRequired: REASON_REQUIRED.includes(s) })),
  });
});

/* ------------------------------ comments ----------------------------- */

router.post('/:id/comments', requireAuth, (req, res) => {
  const row = q.get('SELECT * FROM errors WHERE id = ?', req.params.id);
  if (!assertVisible(req.user, row, res)) return;

  const text = String(req.body?.text || '').trim();
  const visibility = String(req.body?.visibility || 'public');
  if (text.length < 2) return res.status(400).json({ error: 'Comment cannot be empty.', code: 'VALIDATION' });
  if (text.length > 4000) return res.status(400).json({ error: 'Comment is too long (max 4000 characters).', code: 'VALIDATION' });
  if (!['public', 'admin'].includes(visibility)) {
    return res.status(400).json({ error: 'Invalid visibility.', code: 'VALIDATION' });
  }
  if (visibility === 'admin' && req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Only Admins can post internal notes.', code: 'FORBIDDEN' });
  }

  const id = uid();
  const now = nowIso();
  q.run(
    `INSERT INTO error_comments (id, error_id, author_id, comment_text, visibility, created_at)
     VALUES (?, ?, ?, ?, ?, ?)`,
    id,
    row.id,
    req.user.id,
    text,
    visibility,
    now,
  );
  q.run('UPDATE errors SET updated_at = ? WHERE id = ?', now, row.id);

  const isInternal = visibility === 'admin';
  const recipients = new Set(
    isInternal ? [] : [row.submitted_by, row.assigned_to, ...q.all("SELECT id FROM profiles WHERE role = 'admin'").map((r) => r.id)],
  );
  recipients.delete(req.user.id);
  for (const recipient of recipients) {
    if (!recipient) continue;
    notifyUser(recipient, {
      type: 'comment_added',
      title: 'New comment on a report',
      message: `${row.error_code} · ${req.user.full_name}: ${text.slice(0, 120)}`,
      errorId: row.id,
    });
  }
  writeAudit({
    actorId: req.user.id,
    actorName: req.user.full_name,
    action: isInternal ? 'error.admin_note_added' : 'error.comment_added',
    entityType: 'error',
    entityId: row.id,
    metadata: { errorCode: row.error_code, visibility },
  });

  const comment = q.get(
    `SELECT c.*, p.full_name AS author_name, p.role AS author_role, p.avatar_tone AS author_tone
     FROM error_comments c JOIN profiles p ON p.id = c.author_id WHERE c.id = ?`,
    id,
  );
  res.status(201).json({
    comment: {
      id: comment.id,
      text: comment.comment_text,
      visibility: comment.visibility,
      author: { id: comment.author_id, fullName: comment.author_name, role: comment.author_role, avatarTone: comment.author_tone },
      createdAt: comment.created_at,
    },
  });
});

router.delete('/:id/comments/:commentId', requireAuth, (req, res) => {
  const comment = q.get('SELECT * FROM error_comments WHERE id = ? AND error_id = ?', req.params.commentId, req.params.id);
  if (!comment) return res.status(404).json({ error: 'Comment not found.', code: 'NOT_FOUND' });
  if (comment.author_id !== req.user.id && req.user.role !== 'admin') {
    return res.status(403).json({ error: 'You can only delete your own comments.', code: 'FORBIDDEN' });
  }
  q.run('DELETE FROM error_comments WHERE id = ?', comment.id);
  writeAudit({
    actorId: req.user.id,
    actorName: req.user.full_name,
    action: 'error.comment_deleted',
    entityType: 'error',
    entityId: comment.error_id,
  });
  res.json({ ok: true });
});

/* ----------------------------- attachments --------------------------- */

router.post('/:id/attachments', requireAuth, (req, res) => {
  upload.array('files', LIMITS.maxAttachmentsPerUpload)(req, res, (uploadErr) => {
    if (uploadErr) {
      removeUploaded(req.files);
      const message = uploadErr.code === 'LIMIT_FILE_SIZE'
        ? 'One of the files is larger than the 20 MB hard limit.'
        : uploadErr.code === 'LIMIT_FILE_COUNT'
          ? `Upload at most ${LIMITS.maxAttachmentsPerUpload} files at once.`
          : uploadErr.message || 'Upload failed.';
      return res.status(400).json({ error: message, code: uploadErr.code || 'UPLOAD_FAILED' });
    }

    const row = q.get('SELECT * FROM errors WHERE id = ?', req.params.id);
    if (!row) {
      removeUploaded(req.files);
      return res.status(404).json({ error: 'Error record not found.', code: 'NOT_FOUND' });
    }
    const allowed = req.user.role === 'admin' || row.submitted_by === req.user.id || row.assigned_to === req.user.id;
    if (!allowed) {
      removeUploaded(req.files);
      return res.status(403).json({ error: 'You cannot add evidence to this report.', code: 'FORBIDDEN' });
    }

    const files = req.files || [];
    if (!files.length) return res.status(400).json({ error: 'Select at least one file to upload.', code: 'VALIDATION' });

    const configuredMaxMb = Number.parseInt(getSetting('max_upload_mb'), 10) || 5;
    const limitBytes = configuredMaxMb * 1024 * 1024;
    const oversized = files.filter((f) => f.size > limitBytes);
    if (oversized.length) {
      removeUploaded(files);
      return res.status(400).json({
        error: `Each file must be ${configuredMaxMb} MB or smaller. Remove: ${oversized.map((f) => f.originalname).join(', ')}.`,
        code: 'FILE_TOO_LARGE',
      });
    }

    const existing = q.get('SELECT COUNT(*) AS c FROM error_attachments WHERE error_id = ?', row.id)?.c ?? 0;
    if (existing + files.length > LIMITS.maxAttachmentsPerError) {
      removeUploaded(files);
      return res.status(400).json({
        error: `This report already has ${existing} files. A maximum of ${LIMITS.maxAttachmentsPerError} attachments per report is allowed.`,
        code: 'TOO_MANY_FILES',
      });
    }

    const now = nowIso();
    const inserted = files.map((file) => {
      const id = uid();
      const relative = path.relative(UPLOAD_DIR, file.path).split(path.sep).join('/');
      q.run(
        `INSERT INTO error_attachments (id, error_id, storage_path, original_filename, mime_type, size_bytes, uploaded_by, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        id,
        row.id,
        relative,
        file.originalname.slice(0, 200),
        file.mimetype,
        file.size,
        req.user.id,
        now,
      );
      return {
        id,
        originalFilename: file.originalname,
        mimeType: file.mimetype,
        sizeBytes: file.size,
        uploadedBy: req.user.full_name,
        createdAt: now,
        url: `/api/errors/${row.id}/attachments/${id}/download`,
      };
    });

    q.run('UPDATE errors SET updated_at = ? WHERE id = ?', now, row.id);
    writeAudit({
      actorId: req.user.id,
      actorName: req.user.full_name,
      action: 'error.attachment_added',
      entityType: 'error',
      entityId: row.id,
      metadata: { errorCode: row.error_code, files: files.map((f) => f.originalname) },
    });

    res.status(201).json({ attachments: inserted });
  });
});

router.get('/:id/attachments/:attachmentId/download', requireAuth, (req, res) => {
  const row = q.get('SELECT * FROM errors WHERE id = ?', req.params.id);
  if (!assertVisible(req.user, row, res)) return;

  const file = q.get('SELECT * FROM error_attachments WHERE id = ? AND error_id = ?', req.params.attachmentId, req.params.id);
  if (!file) return res.status(404).json({ error: 'Attachment not found.', code: 'NOT_FOUND' });

  const absolute = path.resolve(UPLOAD_DIR, file.storage_path);
  if (!absolute.startsWith(path.resolve(UPLOAD_DIR)) || !fs.existsSync(absolute)) {
    return res.status(410).json({ error: 'The stored file is no longer available.', code: 'GONE' });
  }

  const download = req.query.download === '1';
  writeAudit({
    actorId: req.user.id,
    actorName: req.user.full_name,
    action: 'error.attachment_downloaded',
    entityType: 'error',
    entityId: row.id,
    metadata: { file: file.original_filename },
  });

  res.setHeader('Content-Type', file.mime_type);
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader(
    'Content-Disposition',
    `${download ? 'attachment' : 'inline'}; filename="${file.original_filename.replace(/["\\]/g, '')}"`,
  );
  if (file.mime_type === 'image/svg+xml') {
    res.setHeader('Content-Security-Policy', "default-src 'none'; style-src 'unsafe-inline'");
  }
  fs.createReadStream(absolute).pipe(res);
});

router.delete('/:id/attachments/:attachmentId', requireAuth, (req, res) => {
  const row = q.get('SELECT * FROM errors WHERE id = ?', req.params.id);
  if (!row) return res.status(404).json({ error: 'Error record not found.', code: 'NOT_FOUND' });

  const file = q.get('SELECT * FROM error_attachments WHERE id = ? AND error_id = ?', req.params.attachmentId, req.params.id);
  if (!file) return res.status(404).json({ error: 'Attachment not found.', code: 'NOT_FOUND' });

  const isOwner = file.uploaded_by === req.user.id;
  if (req.user.role !== 'admin' && !(isOwner && !['closed', 'resolved'].includes(row.status))) {
    return res.status(403).json({ error: 'You cannot remove this attachment.', code: 'FORBIDDEN' });
  }

  const absolute = path.resolve(UPLOAD_DIR, file.storage_path);
  try { fs.unlinkSync(absolute); } catch { /* file already gone */ }
  q.run('DELETE FROM error_attachments WHERE id = ?', file.id);
  writeAudit({
    actorId: req.user.id,
    actorName: req.user.full_name,
    action: 'error.attachment_removed',
    entityType: 'error',
    entityId: row.id,
    metadata: { file: file.original_filename },
  });
  res.json({ ok: true });
});

/* ------------------------------ archive ------------------------------ */

router.post('/:id/archive', requireAuth, requireAdmin, (req, res) => {
  const row = q.get('SELECT * FROM errors WHERE id = ?', req.params.id);
  if (!row) return res.status(404).json({ error: 'Error record not found.', code: 'NOT_FOUND' });
  const archive = req.body?.archived !== false;
  q.run('UPDATE errors SET is_archived = ?, updated_at = ? WHERE id = ?', archive ? 1 : 0, nowIso(), row.id);
  writeAudit({
    actorId: req.user.id,
    actorName: req.user.full_name,
    action: archive ? 'error.archived' : 'error.restored',
    entityType: 'error',
    entityId: row.id,
    metadata: { errorCode: row.error_code },
  });
  res.json({ ok: true, archived: archive });
});

export { serializeError, buildFilters, BASE_SELECT };
export default router;
