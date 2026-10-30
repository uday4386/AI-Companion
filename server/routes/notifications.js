import express from 'express';
import { q, nowIso } from '../db.js';
import { requireAuth } from '../auth.js';

const router = express.Router();

function serialize(row) {
  return {
    id: row.id,
    type: row.type,
    title: row.title,
    message: row.message,
    isRead: Boolean(row.is_read),
    errorId: row.error_id,
    errorCode: row.error_code ?? null,
    createdAt: row.created_at,
    readAt: row.read_at,
  };
}

router.get('/', requireAuth, (req, res) => {
  const filter = req.query.filter === 'unread' ? 'AND n.is_read = 0' : '';
  const type = req.query.type ? 'AND n.type = ?' : '';
  const params = [req.user.id];
  if (type) params.push(String(req.query.type));

  const page = Math.max(1, Number.parseInt(req.query.page ?? '1', 10) || 1);
  const pageSize = Math.min(100, Math.max(5, Number.parseInt(req.query.pageSize ?? '20', 10) || 20));

  const total = q.get(
    `SELECT COUNT(*) AS c FROM notifications n WHERE n.recipient_id = ? ${filter} ${type}`,
    ...params,
  )?.c ?? 0;

  const rows = q.all(
    `SELECT n.*, e.error_code FROM notifications n LEFT JOIN errors e ON e.id = n.error_id
     WHERE n.recipient_id = ? ${filter} ${type}
     ORDER BY n.created_at DESC LIMIT ? OFFSET ?`,
    ...params,
    pageSize,
    (page - 1) * pageSize,
  );

  const unread = q.get('SELECT COUNT(*) AS c FROM notifications WHERE recipient_id = ? AND is_read = 0', req.user.id)?.c ?? 0;

  res.json({
    items: rows.map(serialize),
    unread,
    pagination: { page, pageSize, total, totalPages: Math.max(1, Math.ceil(total / pageSize)) },
  });
});

router.get('/unread-count', requireAuth, (req, res) => {
  const unread = q.get('SELECT COUNT(*) AS c FROM notifications WHERE recipient_id = ? AND is_read = 0', req.user.id)?.c ?? 0;
  res.json({ unread });
});

router.get('/recent', requireAuth, (req, res) => {
  const rows = q.all(
    `SELECT n.*, e.error_code FROM notifications n LEFT JOIN errors e ON e.id = n.error_id
     WHERE n.recipient_id = ? ORDER BY n.created_at DESC LIMIT 8`,
    req.user.id,
  );
  res.json({ items: rows.map(serialize) });
});

router.patch('/:id/read', requireAuth, (req, res) => {
  const row = q.get('SELECT * FROM notifications WHERE id = ? AND recipient_id = ?', req.params.id, req.user.id);
  if (!row) return res.status(404).json({ error: 'Notification not found.', code: 'NOT_FOUND' });
  if (!row.is_read) {
    q.run('UPDATE notifications SET is_read = 1, read_at = ? WHERE id = ?', nowIso(), row.id);
  }
  res.json({ ok: true });
});

router.patch('/:id/unread', requireAuth, (req, res) => {
  const row = q.get('SELECT * FROM notifications WHERE id = ? AND recipient_id = ?', req.params.id, req.user.id);
  if (!row) return res.status(404).json({ error: 'Notification not found.', code: 'NOT_FOUND' });
  q.run('UPDATE notifications SET is_read = 0, read_at = NULL WHERE id = ?', row.id);
  res.json({ ok: true });
});

router.post('/read-all', requireAuth, (req, res) => {
  const ids = Array.isArray(req.body?.ids) ? req.body.ids : null;
  const now = nowIso();
  if (ids?.length) {
    const placeholders = ids.map(() => '?').join(',');
    q.run(
      `UPDATE notifications SET is_read = 1, read_at = ? WHERE recipient_id = ? AND id IN (${placeholders})`,
      now,
      req.user.id,
      ...ids,
    );
  } else {
    q.run('UPDATE notifications SET is_read = 1, read_at = ? WHERE recipient_id = ? AND is_read = 0', now, req.user.id);
  }
  res.json({ ok: true });
});

export default router;
