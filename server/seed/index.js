/**
 * Workspace bootstrap.
 *
 * This application ships with **no demo data**. A freshly created database
 * contains exactly one account — the workspace administrator — which is what
 * you sign in with on first run.
 *
 * Credentials can be overridden with environment variables:
 *   BOOTSTRAP_ADMIN_USERNAME  (default: bbox5259)
 *   BOOTSTRAP_ADMIN_PASSWORD  (default: Mxcoradm@5259)
 *   BOOTSTRAP_ADMIN_EMAIL     (default: bbox5259@sentinel.local)
 *   BOOTSTRAP_ADMIN_NAME      (default: Workspace Administrator)
 *
 * Once the admin exists these values are ignored; change the password from
 * Settings → Security instead.
 */
import fs from 'node:fs';
import path from 'node:path';
import { q, uid, nowIso, UPLOAD_DIR } from '../db.js';
import { hashPassword } from '../auth.js';
import { DEFAULT_SETTINGS } from '../config.js';

export const ADMIN_USERNAME = process.env.BOOTSTRAP_ADMIN_USERNAME || 'bbox5259';
export const ADMIN_PASSWORD = process.env.BOOTSTRAP_ADMIN_PASSWORD || 'Mxcoradm@5259';
export const ADMIN_EMAIL = process.env.BOOTSTRAP_ADMIN_EMAIL || `${ADMIN_USERNAME}@sentinel.local`;
export const ADMIN_NAME = process.env.BOOTSTRAP_ADMIN_NAME || 'Workspace Administrator';

/** Child → parent order, so foreign keys never block the wipe. */
const TABLES = [
  'error_attachments',
  'error_comments',
  'error_status_history',
  'errors',
  'notifications',
  'audit_logs',
  'sessions',
  'password_resets',
  'invitations',
  'access_requests',
  'applications',
  'profiles',
  'settings',
];

export function isEmpty() {
  return (q.get('SELECT COUNT(*) AS c FROM profiles')?.c ?? 0) === 0;
}

function clearUploads() {
  const errorsDir = path.join(UPLOAD_DIR, 'errors');
  try {
    fs.rmSync(errorsDir, { recursive: true, force: true });
  } catch {
    /* uploads may not exist yet */
  }
  fs.mkdirSync(errorsDir, { recursive: true });
}

/** Remove every row and every uploaded file. Irreversible. */
export function resetWorkspace() {
  q.tx(() => {
    for (const table of TABLES) q.run(`DELETE FROM ${table}`);
  });
  clearUploads();
}

/**
 * Create the administrator account when the workspace has no accounts yet.
 * Idempotent: safe to call on every boot.
 */
export function ensureAdmin() {
  if (!isEmpty()) {
    return { created: false, username: ADMIN_USERNAME };
  }

  const { hash, salt } = hashPassword(ADMIN_PASSWORD);
  const now = nowIso();
  q.run(
    `INSERT INTO profiles (id, full_name, email, username, role, account_status, job_title, department,
       avatar_tone, password_hash, password_salt, created_at, updated_at)
     VALUES (?, ?, ?, ?, 'admin', 'active', 'System Administrator', 'Operations', 'indigo', ?, ?, ?, ?)`,
    uid(),
    ADMIN_NAME,
    ADMIN_EMAIL,
    ADMIN_USERNAME,
    hash,
    salt,
    now,
    now,
  );

  // Keep the documented defaults in the table so the settings screen shows
  // exactly what the server enforces.
  for (const [key, value] of Object.entries(DEFAULT_SETTINGS)) {
    q.run('INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value', key, value);
  }

  return { created: true, username: ADMIN_USERNAME };
}

/** Fresh workspace: wipe everything, then create only the administrator. */
export function bootstrapWorkspace() {
  resetWorkspace();
  return ensureAdmin();
}
