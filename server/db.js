import { DatabaseSync } from 'node:sqlite';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import crypto from 'node:crypto';
import { DEFAULT_SETTINGS } from './config.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const ROOT_DIR = path.resolve(__dirname, '..');
export const DATA_DIR = process.env.DATA_DIR || path.join(ROOT_DIR, 'server', 'data');
export const UPLOAD_DIR = process.env.UPLOAD_DIR || path.join(ROOT_DIR, 'server', 'uploads');
export const DB_PATH = process.env.DB_PATH || path.join(DATA_DIR, 'entt.sqlite');

fs.mkdirSync(DATA_DIR, { recursive: true });
fs.mkdirSync(UPLOAD_DIR, { recursive: true });

export const db = new DatabaseSync(DB_PATH);
db.exec('PRAGMA journal_mode = WAL;');
db.exec('PRAGMA foreign_keys = ON;');

const SCHEMA = `
CREATE TABLE IF NOT EXISTS profiles (
  id              TEXT PRIMARY KEY,
  full_name       TEXT NOT NULL,
  email           TEXT NOT NULL UNIQUE COLLATE NOCASE,
  role            TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('admin','member')),
  account_status  TEXT NOT NULL DEFAULT 'active' CHECK (account_status IN ('active','inactive')),
  job_title       TEXT,
  department      TEXT,
  avatar_tone     TEXT NOT NULL DEFAULT 'indigo',
  password_hash   TEXT,
  password_salt   TEXT,
  last_login_at   TEXT,
  created_at      TEXT NOT NULL,
  updated_at      TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS sessions (
  id          TEXT PRIMARY KEY,
  user_id     TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  user_agent  TEXT,
  created_at  TEXT NOT NULL,
  expires_at  TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);

CREATE TABLE IF NOT EXISTS invitations (
  id          TEXT PRIMARY KEY,
  email       TEXT NOT NULL COLLATE NOCASE,
  full_name   TEXT NOT NULL,
  role        TEXT NOT NULL CHECK (role IN ('admin','member')),
  token       TEXT NOT NULL UNIQUE,
  status      TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','accepted','revoked','expired')),
  invited_by  TEXT REFERENCES profiles(id),
  created_at  TEXT NOT NULL,
  expires_at  TEXT NOT NULL,
  accepted_at TEXT
);
CREATE INDEX IF NOT EXISTS idx_invitations_status ON invitations(status, created_at DESC);

CREATE TABLE IF NOT EXISTS password_resets (
  token      TEXT PRIMARY KEY,
  user_id    TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  created_at TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  used_at    TEXT
);

CREATE TABLE IF NOT EXISTS access_requests (
  id              TEXT PRIMARY KEY,
  full_name       TEXT NOT NULL,
  email           TEXT NOT NULL COLLATE NOCASE,
  request_reason  TEXT,
  request_status  TEXT NOT NULL DEFAULT 'pending' CHECK (request_status IN ('pending','approved','rejected')),
  reviewed_by     TEXT REFERENCES profiles(id),
  reviewed_at     TEXT,
  review_note     TEXT,
  created_at      TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_access_requests_status ON access_requests(request_status, created_at DESC);

CREATE TABLE IF NOT EXISTS applications (
  id          TEXT PRIMARY KEY,
  name        TEXT NOT NULL UNIQUE,
  description TEXT,
  color       TEXT NOT NULL DEFAULT 'indigo',
  is_active   INTEGER NOT NULL DEFAULT 1,
  created_by  TEXT REFERENCES profiles(id),
  created_at  TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS errors (
  id                  TEXT PRIMARY KEY,
  error_code          TEXT NOT NULL UNIQUE,
  title               TEXT NOT NULL,
  application_id      TEXT NOT NULL REFERENCES applications(id),
  module              TEXT NOT NULL,
  category            TEXT NOT NULL,
  priority            TEXT NOT NULL CHECK (priority IN ('critical','high','medium','low')),
  description         TEXT NOT NULL,
  reproduction_steps  TEXT,
  expected_result     TEXT,
  actual_result       TEXT,
  submitted_by        TEXT NOT NULL REFERENCES profiles(id),
  assigned_to         TEXT REFERENCES profiles(id),
  status              TEXT NOT NULL DEFAULT 'submitted' CHECK (status IN ('submitted','under_review','assigned','in_progress','on_hold','resolved','rejected','reopened','closed')),
  admin_remark        TEXT,
  resolution_summary  TEXT,
  root_cause          TEXT,
  is_archived         INTEGER NOT NULL DEFAULT 0,
  created_at          TEXT NOT NULL,
  updated_at          TEXT NOT NULL,
  resolved_at         TEXT,
  closed_at           TEXT
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_errors_code ON errors(error_code);
CREATE INDEX IF NOT EXISTS idx_errors_submitter ON errors(submitted_by, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_errors_status_priority ON errors(status, priority);
CREATE INDEX IF NOT EXISTS idx_errors_assignee ON errors(assigned_to, status);
CREATE INDEX IF NOT EXISTS idx_errors_app ON errors(application_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_errors_updated ON errors(updated_at DESC);

CREATE TABLE IF NOT EXISTS error_attachments (
  id                TEXT PRIMARY KEY,
  error_id          TEXT NOT NULL REFERENCES errors(id) ON DELETE CASCADE,
  storage_path      TEXT NOT NULL,
  original_filename TEXT NOT NULL,
  mime_type         TEXT NOT NULL,
  size_bytes        INTEGER NOT NULL,
  uploaded_by       TEXT NOT NULL REFERENCES profiles(id),
  created_at        TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_attachments_error ON error_attachments(error_id);

CREATE TABLE IF NOT EXISTS error_comments (
  id           TEXT PRIMARY KEY,
  error_id     TEXT NOT NULL REFERENCES errors(id) ON DELETE CASCADE,
  author_id    TEXT NOT NULL REFERENCES profiles(id),
  comment_text TEXT NOT NULL,
  visibility   TEXT NOT NULL DEFAULT 'public' CHECK (visibility IN ('public','admin')),
  created_at   TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_comments_error ON error_comments(error_id, created_at);

CREATE TABLE IF NOT EXISTS error_status_history (
  id            TEXT PRIMARY KEY,
  error_id      TEXT NOT NULL REFERENCES errors(id) ON DELETE CASCADE,
  old_status    TEXT,
  new_status    TEXT NOT NULL,
  changed_by    TEXT NOT NULL REFERENCES profiles(id),
  change_reason TEXT,
  changed_at    TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_history_error ON error_status_history(error_id, changed_at DESC);

CREATE TABLE IF NOT EXISTS notifications (
  id           TEXT PRIMARY KEY,
  recipient_id TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  error_id     TEXT REFERENCES errors(id) ON DELETE CASCADE,
  type         TEXT NOT NULL,
  title        TEXT NOT NULL,
  message      TEXT,
  is_read      INTEGER NOT NULL DEFAULT 0,
  created_at   TEXT NOT NULL,
  read_at      TEXT
);
CREATE INDEX IF NOT EXISTS idx_notifications_recipient ON notifications(recipient_id, is_read, created_at DESC);

CREATE TABLE IF NOT EXISTS audit_logs (
  id          TEXT PRIMARY KEY,
  actor_id    TEXT REFERENCES profiles(id),
  actor_name  TEXT,
  action      TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id   TEXT,
  metadata    TEXT,
  created_at  TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_audit_created ON audit_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_entity ON audit_logs(entity_type, entity_id);

CREATE TABLE IF NOT EXISTS settings (
  key   TEXT PRIMARY KEY,
  value TEXT NOT NULL
);
`;

db.exec(SCHEMA);

export const nowIso = () => new Date().toISOString();
export const uid = () => crypto.randomUUID();
export const today = () => new Date().toISOString().slice(0, 10);

export const q = {
  all(sql, ...params) {
    return db.prepare(sql).all(...params);
  },
  get(sql, ...params) {
    return db.prepare(sql).get(...params);
  },
  run(sql, ...params) {
    return db.prepare(sql).run(...params);
  },
  tx(fn) {
    db.exec('BEGIN');
    try {
      const result = fn();
      db.exec('COMMIT');
      return result;
    } catch (err) {
      try { db.exec('ROLLBACK'); } catch { /* ignore */ }
      throw err;
    }
  },
};

export function getSetting(key) {
  const row = q.get('SELECT value FROM settings WHERE key = ?', key);
  return row?.value ?? DEFAULT_SETTINGS[key] ?? null;
}

export function setSetting(key, value) {
  q.run(
    `INSERT INTO settings (key, value) VALUES (?, ?)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
    key,
    String(value),
  );
}

export function allSettings() {
  const rows = q.all('SELECT key, value FROM settings');
  const out = { ...DEFAULT_SETTINGS };
  for (const row of rows) out[row.key] = row.value;
  return out;
}

/** Concurrency-safe, human readable error code: ERR-<year>-<sequence>. */
export function nextErrorCode(year = new Date().getUTCFullYear()) {
  const prefix = `ERR-${year}-`;
  const row = q.get(
    `SELECT error_code FROM errors WHERE error_code LIKE ? ORDER BY error_code DESC LIMIT 1`,
    `${prefix}%`,
  );
  const last = row ? Number.parseInt(row.error_code.slice(prefix.length), 10) : 0;
  return `${prefix}${String((Number.isNaN(last) ? 0 : last) + 1).padStart(4, '0')}`;
}

export function writeAudit({ actorId = null, actorName = null, action, entityType, entityId = null, metadata = null }) {
  q.run(
    `INSERT INTO audit_logs (id, actor_id, actor_name, action, entity_type, entity_id, metadata, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    uid(),
    actorId,
    actorName,
    action,
    entityType,
    entityId,
    metadata ? JSON.stringify(metadata) : null,
    nowIso(),
  );
}
