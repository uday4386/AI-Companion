import crypto from 'node:crypto';
import { q, nowIso, writeAudit } from './db.js';

export const SESSION_COOKIE = 'entt_session';
const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000;

/* ------------------------------------------------------------------ */
/* Password hashing (scrypt, per-user salt, constant-time comparison)  */
/* ------------------------------------------------------------------ */

export function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(String(password), salt, 64).toString('hex');
  return { hash, salt };
}

export function verifyPassword(password, hash, salt) {
  if (!hash || !salt) return false;
  const expected = Buffer.from(hash, 'hex');
  const actual = crypto.scryptSync(String(password), salt, 64);
  return expected.length === actual.length && crypto.timingSafeEqual(expected, actual);
}

/* ------------------------------------------------------------------ */
/* Sessions                                                            */
/* ------------------------------------------------------------------ */

export function createSession(userId, userAgent = '') {
  const id = crypto.randomBytes(32).toString('hex');
  const now = new Date();
  const expires = new Date(now.getTime() + SESSION_TTL_MS);
  q.run(
    'INSERT INTO sessions (id, user_id, user_agent, created_at, expires_at) VALUES (?, ?, ?, ?, ?)',
    id,
    userId,
    String(userAgent).slice(0, 255),
    now.toISOString(),
    expires.toISOString(),
  );
  return { id, expiresAt: expires };
}

export function destroySession(id) {
  if (!id) return;
  q.run('DELETE FROM sessions WHERE id = ?', id);
}

/**
 * Cookie attributes.
 *
 * The app is frequently embedded in a cross-site iframe (preview environments,
 * partner portals). Browsers drop `SameSite=Lax` cookies in that context, which
 * silently logs the user out on every reload. When the request arrives over
 * HTTPS we therefore issue `SameSite=None; Secure`, which is the only
 * combination that survives an iframe. Plain-HTTP local development keeps
 * `Lax`, because `None` without `Secure` is rejected outright.
 */
function cookieOptions(req) {
  const secure = Boolean(req?.secure) || process.env.COOKIE_SECURE === 'true';
  return {
    httpOnly: true,
    sameSite: secure ? 'none' : 'lax',
    secure,
    path: '/',
  };
}

export function setSessionCookie(res, session, req) {
  res.cookie(SESSION_COOKIE, session.id, {
    ...cookieOptions(req),
    expires: session.expiresAt,
  });
}

export function clearSessionCookie(res, req) {
  res.clearCookie(SESSION_COOKIE, cookieOptions(req));
}

export function serializeUser(row) {
  if (!row) return null;
  return {
    id: row.id,
    fullName: row.full_name,
    email: row.email,
    username: row.username ?? null,
    role: row.role,
    accountStatus: row.account_status,
    jobTitle: row.job_title,
    department: row.department,
    avatarTone: row.avatar_tone,
    lastLoginAt: row.last_login_at,
    createdAt: row.created_at,
  };
}

export function findUserById(id) {
  return q.get('SELECT * FROM profiles WHERE id = ?', id);
}

export function findUserByEmail(email) {
  return q.get('SELECT * FROM profiles WHERE email = ?', String(email).trim());
}

/**
 * Sign-in accepts either a full email address or a short username.
 * `bbox5259` and `bbox5259@example.com` therefore resolve independently and
 * an identifier can never match two different accounts.
 */
export function findUserByLogin(identifier) {
  const value = String(identifier ?? '').trim();
  if (!value) return null;
  if (value.includes('@')) return findUserByEmail(value);
  return q.get('SELECT * FROM profiles WHERE username = ?', value);
}

/* ------------------------------------------------------------------ */
/* Middleware                                                          */
/* ------------------------------------------------------------------ */

function readToken(req) {
  const header = req.get?.('authorization') || req.headers?.authorization || '';
  if (header.toLowerCase().startsWith('bearer ')) return header.slice(7).trim();
  return req.cookies?.[SESSION_COOKIE] || null;
}

export function attachUser(req, _res, next) {
  req.user = null;
  const token = readToken(req);
  if (!token) return next();

  const session = q.get('SELECT * FROM sessions WHERE id = ?', token);
  if (!session) return next();

  if (new Date(session.expires_at).getTime() < Date.now()) {
    q.run('DELETE FROM sessions WHERE id = ?', token);
    return next();
  }

  const user = findUserById(session.user_id);
  if (!user) return next();

  if (user.account_status !== 'active') {
    q.run('DELETE FROM sessions WHERE id = ?', token);
    req.deactivatedUser = true;
    return next();
  }

  req.user = user;
  req.sessionId = token;
  next();
}

export function requireAuth(req, res, next) {
  if (req.deactivatedUser) {
    return res.status(403).json({
      error: 'Your account has been deactivated. Contact an administrator.',
      code: 'ACCOUNT_INACTIVE',
    });
  }
  if (!req.user) {
    return res.status(401).json({ error: 'Authentication required.', code: 'UNAUTHENTICATED' });
  }
  next();
}

export function requireAdmin(req, res, next) {
  if (!req.user) {
    return res.status(401).json({ error: 'Authentication required.', code: 'UNAUTHENTICATED' });
  }
  if (req.user.role !== 'admin') {
    writeAudit({
      actorId: req.user.id,
      actorName: req.user.full_name,
      action: 'security.denied',
      entityType: 'endpoint',
      entityId: req.originalUrl,
      metadata: { method: req.method, requiredRole: 'admin', role: req.user.role },
    });
    return res.status(403).json({
      error: 'Admin privileges are required for this action.',
      code: 'FORBIDDEN',
    });
  }
  next();
}

export function touchLogin(userId) {
  const ts = nowIso();
  q.run('UPDATE profiles SET last_login_at = ?, updated_at = ? WHERE id = ?', ts, ts, userId);
}
