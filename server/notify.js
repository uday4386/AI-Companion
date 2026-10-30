import { q, uid, nowIso } from './db.js';

export function notifyUser(recipientId, { type, title, message = null, errorId = null }) {
  if (!recipientId) return null;
  const id = uid();
  q.run(
    `INSERT INTO notifications (id, recipient_id, error_id, type, title, message, is_read, created_at)
     VALUES (?, ?, ?, ?, ?, ?, 0, ?)`,
    id,
    recipientId,
    errorId,
    type,
    title,
    message,
    nowIso(),
  );
  return id;
}

export function notifyAdmins({ type, title, message = null, errorId = null, excludeUserId = null }) {
  const admins = q.all("SELECT id FROM profiles WHERE role = 'admin' AND account_status = 'active'");
  for (const admin of admins) {
    if (admin.id === excludeUserId) continue;
    notifyUser(admin.id, { type, title, message, errorId });
  }
}
