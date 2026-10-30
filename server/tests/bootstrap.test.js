/**
 * Workspace bootstrap tests.
 *
 * The product ships with no demo data: a fresh database contains exactly one
 * administrator account, and that account can sign in with either its username
 * or its email address.
 */
import test, { after, before } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'entt-bootstrap-'));
process.env.DB_PATH = path.join(TMP, 'bootstrap.sqlite');
process.env.DATA_DIR = TMP;
process.env.UPLOAD_DIR = path.join(TMP, 'uploads');
process.env.NODE_ENV = 'test';

// Keep the assertions independent of any developer environment variables.
delete process.env.BOOTSTRAP_ADMIN_USERNAME;
delete process.env.BOOTSTRAP_ADMIN_PASSWORD;
delete process.env.BOOTSTRAP_ADMIN_EMAIL;
delete process.env.BOOTSTRAP_ADMIN_NAME;

const { q } = await import('../db.js');
const { verifyPassword } = await import('../auth.js');
const { ADMIN_EMAIL, ADMIN_PASSWORD, ADMIN_USERNAME, bootstrapWorkspace, ensureAdmin, isEmpty } = await import('../seed/index.js');
const { createApp } = await import('../app.js');

const app = await createApp();
let server;
let base;

before(async () => {
  server = app.listen(0);
  await new Promise((resolve) => server.once('listening', resolve));
  base = `http://127.0.0.1:${server.address().port}`;
});

after(async () => {
  await new Promise((resolve) => server.close(resolve));
  fs.rmSync(TMP, { recursive: true, force: true });
});

async function loginIdentifier(identifier, password = ADMIN_PASSWORD) {
  const res = await fetch(`${base}/api/auth/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ identifier, password }),
  });
  return { status: res.status, data: await res.json() };
}

test('a fresh workspace is empty', () => {
  assert.equal(isEmpty(), true);
  assert.equal(q.get('SELECT COUNT(*) AS c FROM profiles').c, 0);
});

test('the bootstrap admin uses the requested credentials', () => {
  const result = ensureAdmin();
  assert.equal(result.created, true);
  assert.equal(ADMIN_USERNAME, 'bbox5259');
  assert.equal(ADMIN_PASSWORD, 'Mxcoradm@5259');

  const admin = q.get('SELECT * FROM profiles WHERE username = ?', 'bbox5259');
  assert.ok(admin, 'admin row must exist');
  assert.equal(admin.role, 'admin');
  assert.equal(admin.account_status, 'active');
  assert.equal(admin.email, ADMIN_EMAIL);
  assert.equal(admin.email, 'bbox5259@sentinel.local');
  assert.ok(verifyPassword('Mxcoradm@5259', admin.password_hash, admin.password_salt));
  assert.ok(!verifyPassword('Passw0rd!', admin.password_hash, admin.password_salt), 'the old demo password must not work');
});

test('bootstrap is idempotent', () => {
  const again = ensureAdmin();
  assert.equal(again.created, false);
  assert.equal(q.get('SELECT COUNT(*) AS c FROM profiles').c, 1);
});

test('no demo data is created', () => {
  assert.equal(q.get('SELECT COUNT(*) AS c FROM errors').c, 0);
  assert.equal(q.get('SELECT COUNT(*) AS c FROM applications').c, 0);
  assert.equal(q.get('SELECT COUNT(*) AS c FROM profiles').c, 1);
  assert.equal(q.get('SELECT COUNT(*) AS c FROM notifications').c, 0);
  assert.equal(q.get('SELECT COUNT(*) AS c FROM access_requests').c, 0);
  assert.equal(q.get('SELECT COUNT(*) AS c FROM invitations').c, 0);
});

test('the admin signs in with the username', async () => {
  const result = await loginIdentifier('bbox5259');
  assert.equal(result.status, 200, JSON.stringify(result.data));
  assert.equal(result.data.user.role, 'admin');
  assert.equal(result.data.user.username, 'bbox5259');
  assert.ok(result.data.token);
});

test('the admin signs in with the email, case-insensitively', async () => {
  assert.equal((await loginIdentifier('bbox5259@sentinel.local')).status, 200);
  assert.equal((await loginIdentifier('BBOX5259')).status, 200);
  assert.equal((await loginIdentifier('  bbox5259  ')).status, 200);
});

test('bad credentials and unknown identifiers are rejected', async () => {
  assert.equal((await loginIdentifier('bbox5259', 'Passw0rd!')).status, 401);
  assert.equal((await loginIdentifier('admin@entt.dev', 'Passw0rd!')).status, 401);
  assert.equal((await loginIdentifier('nobody-here', 'Mxcoradm@5259')).status, 401);
  assert.equal((await loginIdentifier('bbox5259', '')).status, 400);
});

test('the admin session can reach the admin-only API', async () => {
  const { data } = await loginIdentifier('bbox5259');
  const headers = { authorization: `Bearer ${data.token}` };
  for (const pathname of ['/api/users', '/api/audit-logs', '/api/access-requests', '/api/reports/export?format=csv']) {
    const res = await fetch(`${base}${pathname}`, { headers });
    assert.equal(res.status, 200, `${pathname} should be available to the bootstrap admin`);
  }
  const me = await (await fetch(`${base}/api/auth/me`, { headers })).json();
  assert.equal(me.user.username, 'bbox5259');
  assert.equal(me.user.role, 'admin');
});

test('--reset clears data and recreates only the admin', () => {
  const admin = q.get("SELECT * FROM profiles WHERE username = 'bbox5259'");
  q.run(
    `INSERT INTO applications (id, name, description, color, is_active, created_by, created_at)
     VALUES ('app-temp', 'Temporary', NULL, 'indigo', 1, ?, ?)`,
    admin.id,
    new Date().toISOString(),
  );
  q.run(
    `INSERT INTO errors (id, error_code, title, application_id, module, category, priority, description,
       submitted_by, status, is_archived, created_at, updated_at)
     VALUES ('err-temp', 'ERR-2026-9999', 'Temp report', 'app-temp', 'M', 'Functional', 'low', 'temporary row',
       ?, 'submitted', 0, ?, ?)`,
    admin.id,
    new Date().toISOString(),
    new Date().toISOString(),
  );

  const result = bootstrapWorkspace();
  assert.equal(result.created, true);
  assert.equal(q.get('SELECT COUNT(*) AS c FROM profiles').c, 1);
  assert.equal(q.get('SELECT COUNT(*) AS c FROM errors').c, 0);
  assert.equal(q.get('SELECT COUNT(*) AS c FROM applications').c, 0);
  assert.equal(q.get("SELECT COUNT(*) AS c FROM profiles WHERE username = 'bbox5259'").c, 1);
});
