import express from 'express';
import { q } from '../db.js';
import { requireAuth, requireAdmin } from '../auth.js';

const router = express.Router();

const ACTION_LABELS = {
  'error.created': 'Error created',
  'error.updated': 'Error details updated',
  'error.assigned': 'Assignment changed',
  'error.status_changed': 'Status changed',
  'error.comment_added': 'Comment added',
  'error.admin_note_added': 'Internal note added',
  'error.comment_deleted': 'Comment deleted',
  'error.attachment_added': 'Attachment uploaded',
  'error.attachment_removed': 'Attachment removed',
  'error.attachment_downloaded': 'Attachment downloaded',
  'error.archived': 'Error archived',
  'error.restored': 'Error restored',
  'user.invited': 'User invited',
  'user.role_changed': 'Role changed',
  'user.status_changed': 'Account status changed',
  'user.password_reset': 'Password reset by admin',
  'invitation.accepted': 'Invitation accepted',
  'invitation.revoked': 'Invitation revoked',
  'invitation.resent': 'Invitation re-issued',
  'access_request.submitted': 'Access requested',
  'access_request.approved': 'Access request approved',
  'access_request.rejected': 'Access request rejected',
  'application.created': 'Application created',
  'application.updated': 'Application updated',
  'settings.updated': 'Settings updated',
  'auth.login': 'Signed in',
  'auth.logout': 'Signed out',
  'auth.login_failed': 'Failed sign-in attempt',
  'auth.password_changed': 'Password changed',
  'auth.password_reset_requested': 'Password reset requested',
  'auth.password_reset_completed': 'Password reset completed',
  'profile.updated': 'Profile updated',
  'report.exported': 'Report exported',
  'security.denied': 'Blocked privilege escalation',
};

router.get('/audit-logs', requireAuth, requireAdmin, (req, res) => {
  const conds = ['1=1'];
  const params = [];
  if (req.query.search) {
    conds.push('(a.action LIKE ? OR a.actor_name LIKE ? OR a.entity_id LIKE ? OR a.metadata LIKE ?)');
    const like = `%${req.query.search}%`;
    params.push(like, like, like, like);
  }
  if (req.query.action) {
    conds.push('a.action = ?');
    params.push(String(req.query.action));
  }
  if (req.query.entityType) {
    conds.push('a.entity_type = ?');
    params.push(String(req.query.entityType));
  }
  if (req.query.actorId) {
    conds.push('a.actor_id = ?');
    params.push(String(req.query.actorId));
  }
  if (req.query.dateFrom) {
    conds.push('a.created_at >= ?');
    params.push(`${req.query.dateFrom}T00:00:00.000Z`);
  }
  if (req.query.dateTo) {
    conds.push('a.created_at <= ?');
    params.push(`${req.query.dateTo}T23:59:59.999Z`);
  }
  if (req.query.sensitive === 'true') {
    conds.push("a.action IN ('user.role_changed','user.status_changed','settings.updated','security.denied','report.exported')");
  }

  const page = Math.max(1, Number.parseInt(req.query.page ?? '1', 10) || 1);
  const pageSize = Math.min(100, Math.max(5, Number.parseInt(req.query.pageSize ?? '25', 10) || 25));
  const where = conds.join(' AND ');

  const total = q.get(`SELECT COUNT(*) AS c FROM audit_logs a WHERE ${where}`, ...params)?.c ?? 0;
  const rows = q.all(
    `SELECT a.*, e.error_code
     FROM audit_logs a LEFT JOIN errors e ON e.id = a.entity_id AND a.entity_type = 'error'
     WHERE ${where} ORDER BY a.created_at DESC LIMIT ? OFFSET ?`,
    ...params,
    pageSize,
    (page - 1) * pageSize,
  );

  res.json({
    items: rows.map((r) => ({
      id: r.id,
      action: r.action,
      actionLabel: ACTION_LABELS[r.action] || r.action,
      actorId: r.actor_id,
      actorName: r.actor_name || 'System',
      entityType: r.entity_type,
      entityId: r.entity_id,
      errorCode: r.error_code,
      metadata: r.metadata ? JSON.parse(r.metadata) : null,
      createdAt: r.created_at,
    })),
    actions: Object.entries(ACTION_LABELS).map(([value, label]) => ({ value, label })),
    pagination: { page, pageSize, total, totalPages: Math.max(1, Math.ceil(total / pageSize)) },
  });
});

export default router;
