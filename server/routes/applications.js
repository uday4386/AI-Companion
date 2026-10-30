import express from 'express';
import { q, uid, nowIso, writeAudit, allSettings, getSetting } from '../db.js';
import { requireAuth, requireAdmin } from '../auth.js';
import { CATEGORIES, PRIORITIES, PRIORITY_META, STATUSES, STATUS_META, DEFAULT_MODULES, LIMITS } from '../config.js';
import { visibilityLabel } from '../access.js';

const router = express.Router();

/** Metadata the UI needs to render selects, badges and policy hints. */
router.get('/meta', requireAuth, (_req, res) => {
  const modulesInUse = q.all('SELECT DISTINCT module FROM errors ORDER BY module').map((r) => r.module);
  const modules = [...new Set([...DEFAULT_MODULES, ...modulesInUse])].sort();

  res.json({
    statuses: STATUSES.map((value) => ({ value, ...STATUS_META[value] })),
    priorities: PRIORITIES.map((value) => ({ value, ...PRIORITY_META[value] })),
    categories: CATEGORIES,
    modules,
    limits: {
      maxAttachmentMb: Number.parseInt(getSetting('max_upload_mb'), 10) || 5,
      maxAttachmentsPerUpload: LIMITS.maxAttachmentsPerUpload,
      maxAttachmentsPerError: LIMITS.maxAttachmentsPerError,
      allowedMimeTypes: LIMITS.allowedMimeTypes,
    },
    settings: allSettings(),
    visibility: visibilityLabel(),
  });
});

router.get('/applications', requireAuth, (_req, res) => {
  const rows = q.all(
    `SELECT a.*,
       (SELECT COUNT(*) FROM errors e WHERE e.application_id = a.id AND e.is_archived = 0) AS error_count,
       (SELECT COUNT(*) FROM errors e WHERE e.application_id = a.id AND e.status NOT IN ('closed','rejected','resolved') AND e.is_archived = 0) AS open_count
     FROM applications a ORDER BY a.is_active DESC, a.name`,
  );
  res.json({
    applications: rows.map((r) => ({
      id: r.id,
      name: r.name,
      description: r.description,
      color: r.color,
      isActive: Boolean(r.is_active),
      errorCount: r.error_count,
      openCount: r.open_count,
      createdAt: r.created_at,
    })),
  });
});

router.post('/applications', requireAuth, requireAdmin, (req, res) => {
  const name = String(req.body?.name || '').trim();
  const description = String(req.body?.description || '').trim();
  const color = String(req.body?.color || 'indigo');
  if (name.length < 2) return res.status(400).json({ error: 'Application name is required.', code: 'VALIDATION' });
  if (q.get('SELECT id FROM applications WHERE name = ?', name)) {
    return res.status(409).json({ error: 'An application with this name already exists.', code: 'CONFLICT' });
  }
  const id = uid();
  q.run(
    'INSERT INTO applications (id, name, description, color, is_active, created_by, created_at) VALUES (?, ?, ?, ?, 1, ?, ?)',
    id,
    name,
    description || null,
    color,
    req.user.id,
    nowIso(),
  );
  writeAudit({
    actorId: req.user.id,
    actorName: req.user.full_name,
    action: 'application.created',
    entityType: 'application',
    entityId: id,
    metadata: { name },
  });
  res.status(201).json({ application: { id, name, description, color, isActive: true, errorCount: 0, openCount: 0 } });
});

router.patch('/applications/:id', requireAuth, requireAdmin, (req, res) => {
  const app = q.get('SELECT * FROM applications WHERE id = ?', req.params.id);
  if (!app) return res.status(404).json({ error: 'Application not found.', code: 'NOT_FOUND' });

  const name = req.body?.name !== undefined ? String(req.body.name).trim() : app.name;
  const description = req.body?.description !== undefined ? String(req.body.description).trim() : app.description;
  const color = req.body?.color !== undefined ? String(req.body.color) : app.color;
  const isActive = req.body?.isActive !== undefined ? Boolean(req.body.isActive) : Boolean(app.is_active);

  if (name.length < 2) return res.status(400).json({ error: 'Application name is required.', code: 'VALIDATION' });
  const duplicate = q.get('SELECT id FROM applications WHERE name = ? AND id != ?', name, app.id);
  if (duplicate) return res.status(409).json({ error: 'An application with this name already exists.', code: 'CONFLICT' });

  q.run(
    'UPDATE applications SET name = ?, description = ?, color = ?, is_active = ? WHERE id = ?',
    name,
    description || null,
    color,
    isActive ? 1 : 0,
    app.id,
  );
  writeAudit({
    actorId: req.user.id,
    actorName: req.user.full_name,
    action: 'application.updated',
    entityType: 'application',
    entityId: app.id,
    metadata: { name, isActive },
  });
  res.json({ ok: true });
});

export default router;
