/**
 * End-to-end API tests for the Error Noting & Tracking System.
 *
 * These tests exercise the security boundary directly over HTTP — not through
 * the UI — because the requirement is that a Team Member cannot change status,
 * assign work or manage users even when calling the API directly.
 *
 * Run with: npm test
 */
import test, { after, before } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'entt-test-'));
process.env.DB_PATH = path.join(TMP, 'test.sqlite');
process.env.DATA_DIR = TMP;
process.env.UPLOAD_DIR = path.join(TMP, 'uploads');
process.env.NODE_ENV = 'test';

const { createApp } = await import('../app.js');
const { q, uid, nowIso } = await import('../db.js');
const { hashPassword } = await import('../auth.js');

const app = await createApp();
let server;
let base;

const PASSWORD = 'TestPass1';
const ids = {};

function insertUser({ key, name, email, role = 'member', status = 'active' }) {
  const { hash, salt } = hashPassword(PASSWORD);
  const id = uid();
  const now = nowIso();
  q.run(
    `INSERT INTO profiles (id, full_name, email, role, account_status, job_title, department, avatar_tone,
      password_hash, password_salt, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, 'QA', 'Engineering', 'indigo', ?, ?, ?, ?)`,
    id,
    name,
    email,
    role,
    status,
    hash,
    salt,
    now,
    now,
  );
  ids[key] = { id, email, name, role };
  return ids[key];
}

let appId;

before(async () => {
  insertUser({ key: 'admin', name: 'Ada Admin', email: 'admin@test.local', role: 'admin' });
  insertUser({ key: 'memberA', name: 'Mia Member', email: 'mia@test.local' });
  insertUser({ key: 'memberB', name: 'Ben Builder', email: 'ben@test.local' });
  insertUser({ key: 'memberC', name: 'Cara Close', email: 'cara@test.local' });
  insertUser({ key: 'inactive', name: 'Ian Inactive', email: 'ian@test.local', status: 'inactive' });

  appId = uid();
  q.run(
    'INSERT INTO applications (id, name, description, color, is_active, created_by, created_at) VALUES (?, ?, ?, ?, 1, ?, ?)',
    appId,
    'Test Application',
    'Used by the automated test suite',
    'indigo',
    ids.admin.id,
    nowIso(),
  );

  server = app.listen(0);
  await new Promise((resolve) => server.once('listening', resolve));
  base = `http://127.0.0.1:${server.address().port}`;
});

after(async () => {
  await new Promise((resolve) => server.close(resolve));
  fs.rmSync(TMP, { recursive: true, force: true });
});

/* ------------------------------- helpers ------------------------------- */

async function request(method, pathname, { token, body, form, headers = {} } = {}) {
  const response = await fetch(`${base}${pathname}`, {
    method,
    headers: {
      ...(form ? {} : body !== undefined ? { 'content-type': 'application/json' } : {}),
      ...(token ? { authorization: `Bearer ${token}` } : {}),
      ...headers,
    },
    body: form ?? (body !== undefined ? JSON.stringify(body) : undefined),
    redirect: 'manual',
  });
  const contentType = response.headers.get('content-type') || '';
  const data = contentType.includes('json') ? await response.json() : await response.text();
  return { status: response.status, data, headers: response.headers };
}

async function login(email, password = PASSWORD) {
  const result = await request('POST', '/api/auth/login', { body: { email, password } });
  return result;
}

const tokenCache = new Map();

async function freshToken(key) {
  tokenCache.delete(key);
  return tokenFor(key);
}

async function tokenFor(key) {
  if (tokenCache.has(key)) return tokenCache.get(key);
  const result = await login(ids[key].email);
  assert.equal(result.status, 200, `login failed for ${key}: ${JSON.stringify(result.data)}`);
  tokenCache.set(key, result.data.token);
  return result.data.token;
}

async function createError(token, overrides = {}) {
  const body = {
    title: 'Checkout button stays disabled after retry',
    applicationId: appId,
    module: 'Checkout',
    category: 'Functional',
    priority: 'high',
    description: 'Submitting the payment form twice leaves the button disabled until a full reload.',
    reproductionSteps: '1. Submit the form\n2. Press retry',
    expectedResult: 'The button re-enables',
    actualResult: 'The button stays disabled',
    ...overrides,
  };
  const result = await request('POST', '/api/errors', { token, body });
  assert.equal(result.status, 201, JSON.stringify(result.data));
  return result.data.error;
}

/* ------------------------------ auth basics ---------------------------- */

test('health endpoint is public', async () => {
  const result = await request('GET', '/api/health');
  assert.equal(result.status, 200);
  assert.equal(result.data.ok, true);
});

test('protected endpoints reject anonymous callers', async () => {
  for (const pathname of ['/api/errors', '/api/reports/dashboard', '/api/users', '/api/notifications', '/api/meta']) {
    const result = await request('GET', pathname);
    assert.equal(result.status, 401, `${pathname} should require authentication`);
  }
});

test('wrong password and inactive accounts cannot sign in', async () => {
  const wrong = await login('mia@test.local', 'not-the-password');
  assert.equal(wrong.status, 401);

  const inactive = await login(ids.inactive.email);
  assert.equal(inactive.status, 403);
  assert.equal(inactive.data.code, 'ACCOUNT_INACTIVE');
});

test('server derives the submitter, initial status and error code', async () => {
  const memberToken = await tokenFor('memberA');
  const created = await createError(memberToken, {
    submittedBy: ids.memberB.id,
    status: 'closed',
    errorCode: 'HACK-0001',
    assignedTo: ids.admin.id,
  });

  assert.equal(created.submittedBy.id, ids.memberA.id, 'submitter must be the authenticated user');
  assert.equal(created.status, 'submitted', 'status must be server-derived');
  assert.match(created.errorCode, /^ERR-\d{4}-\d{4}$/);
  assert.equal(created.assignedTo, null);
  ids.memberError = created;

  const detail = await request('GET', `/api/errors/${created.id}`, { token: memberToken });
  assert.equal(detail.status, 200);
  assert.equal(detail.data.history.length, 1);
  assert.equal(detail.data.history[0].newStatus, 'submitted');
  assert.equal(detail.data.permissions.canChangeStatus, false);
  assert.deepEqual(detail.data.availableTransitions, []);
});

/* --------------------------- visibility rules -------------------------- */

test('team members only see their own or assigned records', async () => {
  const benToken = await tokenFor('memberB');
  const benError = await createError(benToken, { title: 'Ben finds a warehouse defect' });

  const miaToken = await tokenFor('memberA');
  const miaList = await request('GET', '/api/errors', { token: miaToken });
  assert.equal(miaList.status, 200);
  const codes = miaList.data.items.map((item) => item.id);
  assert.ok(codes.includes(ids.memberError.id), 'own report must be visible');
  assert.ok(!codes.includes(benError.id), 'another member’s report must not be visible');

  const peek = await request('GET', `/api/errors/${benError.id}`, { token: miaToken });
  assert.equal(peek.status, 404, 'IDOR attempts must be indistinguishable from missing records');

  const adminToken = await tokenFor('admin');
  const adminList = await request('GET', '/api/errors', { token: adminToken });
  assert.ok(adminList.data.items.some((item) => item.id === benError.id));
  ids.benError = benError;
});

test('admins can assign a report and the assignee can then see it', async () => {
  const adminToken = await tokenFor('admin');
  const result = await request('PATCH', `/api/errors/${ids.benError.id}/assign`, {
    token: adminToken,
    body: { assigneeId: ids.memberA.id },
  });
  assert.equal(result.status, 200);
  assert.equal(result.data.error.assignedTo.id, ids.memberA.id);
  assert.equal(result.data.error.status, 'assigned', 'assignment moves an untriaged report to Assigned');

  const miaToken = await tokenFor('memberA');
  const peek = await request('GET', `/api/errors/${ids.benError.id}`, { token: miaToken });
  assert.equal(peek.status, 200, 'the assignee must be able to read the report');
  assert.equal(peek.data.permissions.canAssign, false);

  const notification = q.get(
    "SELECT * FROM notifications WHERE recipient_id = ? AND error_id = ? AND type = 'assigned'",
    ids.memberA.id,
    ids.benError.id,
  );
  assert.ok(notification, 'assignee must be notified');
  assert.equal(notification.is_read, 0);
});

/* --------------------------- permission denials ------------------------ */

test('team members cannot perform admin operations', async () => {
  const memberToken = await tokenFor('memberA');
  const errorId = ids.memberError.id;

  const statusChange = await request('POST', `/api/errors/${errorId}/status`, { token: memberToken, body: { status: 'closed' } });
  assert.equal(statusChange.status, 403);
  assert.equal(statusChange.data.code, 'FORBIDDEN');

  const assignment = await request('PATCH', `/api/errors/${errorId}/assign`, { token: memberToken, body: { assigneeId: ids.memberA.id } });
  assert.equal(assignment.status, 403);

  const userList = await request('GET', '/api/users', { token: memberToken });
  assert.equal(userList.status, 403);

  const audit = await request('GET', '/api/audit-logs', { token: memberToken });
  assert.equal(audit.status, 403);

  const exportAttempt = await request('GET', '/api/reports/export?format=csv', { token: memberToken });
  assert.equal(exportAttempt.status, 403);

  const internalNote = await request('POST', `/api/errors/${errorId}/comments`, {
    token: memberToken,
    body: { text: 'Trying to add an internal note', visibility: 'admin' },
  });
  assert.equal(internalNote.status, 403);

  const archive = await request('POST', `/api/errors/${errorId}/archive`, { token: memberToken, body: {} });
  assert.equal(archive.status, 403);

  const userAdmin = await request('GET', '/api/access-requests', { token: memberToken });
  assert.equal(userAdmin.status, 403);
});

test('a member cannot elevate their own role or account status', async () => {
  const memberToken = await tokenFor('memberA');

  const selfRole = await request('PATCH', `/api/users/${ids.memberA.id}/role`, { token: memberToken, body: { role: 'admin' } });
  assert.equal(selfRole.status, 403);

  const selfStatus = await request('PATCH', `/api/users/${ids.memberA.id}/status`, { token: memberToken, body: { accountStatus: 'active' } });
  assert.equal(selfStatus.status, 403);

  const profile = await request('PATCH', '/api/users/profile', {
    token: memberToken,
    body: { fullName: 'Mia Member', role: 'admin', accountStatus: 'active' },
  });
  assert.equal(profile.status, 200);
  assert.equal(profile.data.user.role, 'member', 'role must not be writable through the profile endpoint');
  assert.equal(profile.data.user.accountStatus, 'active');
});

/* --------------------------- status lifecycle -------------------------- */

test('the lifecycle rejects invalid transitions', async () => {
  const adminToken = await tokenFor('admin');
  const result = await request('POST', `/api/errors/${ids.memberError.id}/status`, {
    token: adminToken,
    body: { status: 'closed', reason: 'Skipping the whole workflow' },
  });
  assert.equal(result.status, 422);
  assert.equal(result.data.code, 'INVALID_TRANSITION');
});

test('rejection and closure require reasons, resolution requires a summary', async () => {
  const adminToken = await tokenFor('admin');
  const second = await createError(adminToken, { title: 'Duplicate invoice shows in the ledger twice' });

  const advance = await request('POST', `/api/errors/${second.id}/status`, {
    token: adminToken,
    body: { status: 'under_review', reason: 'Reviewing with finance' },
  });
  assert.equal(advance.status, 200);

  const rejectNoReason = await request('POST', `/api/errors/${second.id}/status`, { token: adminToken, body: { status: 'rejected' } });
  assert.equal(rejectNoReason.status, 400);
  assert.equal(rejectNoReason.data.code, 'REASON_REQUIRED');

  const reject = await request('POST', `/api/errors/${second.id}/status`, {
    token: adminToken,
    body: { status: 'rejected', reason: 'Duplicate of the reconciliation defect' },
  });
  assert.equal(reject.status, 200);

  const history = await request('GET', `/api/errors/${second.id}`, { token: adminToken });
  const transitions = history.data.history.map((entry) => entry.newStatus);
  assert.deepEqual(transitions, ['submitted', 'under_review', 'rejected']);
  const rejection = history.data.history.at(-1);
  assert.equal(rejection.reason, 'Duplicate of the reconciliation defect');
  assert.equal(rejection.actor.id, ids.admin.id);

  // Reopen, then attempt to resolve without a summary.
  const reopen = await request('POST', `/api/errors/${second.id}/status`, {
    token: adminToken,
    body: { status: 'reopened', reason: 'Recurred after the patch' },
  });
  assert.equal(reopen.status, 200);

  const toAssigned = await request('PATCH', `/api/errors/${second.id}/assign`, { token: adminToken, body: { assigneeId: ids.memberB.id } });
  assert.equal(toAssigned.status, 200);

  const inProgress = await request('POST', `/api/errors/${second.id}/status`, { token: adminToken, body: { status: 'in_progress' } });
  assert.equal(inProgress.status, 200);

  const resolveNoSummary = await request('POST', `/api/errors/${second.id}/status`, { token: adminToken, body: { status: 'resolved' } });
  assert.equal(resolveNoSummary.status, 400);
  assert.equal(resolveNoSummary.data.code, 'RESOLUTION_REQUIRED');

  const resolved = await request('POST', `/api/errors/${second.id}/status`, {
    token: adminToken,
    body: { status: 'resolved', resolutionSummary: 'Idempotency check added to the ledger writer.' },
  });
  assert.equal(resolved.status, 200);
  assert.ok(resolved.data.error.resolvedAt);

  const closeNoReason = await request('POST', `/api/errors/${second.id}/status`, { token: adminToken, body: { status: 'closed' } });
  assert.equal(closeNoReason.status, 400);

  const closed = await request('POST', `/api/errors/${second.id}/status`, {
    token: adminToken,
    body: { status: 'closed', reason: 'Verified in production by finance' },
  });
  assert.equal(closed.status, 200);
  assert.ok(closed.data.error.closedAt);

  const submittedAgain = await request('GET', `/api/errors/${second.id}`, { token: adminToken });
  const last = submittedAgain.data.history.at(-1);
  assert.equal(last.newStatus, 'closed');
  assert.equal(last.actor.role, 'admin');

  const audit = q.get("SELECT * FROM audit_logs WHERE action = 'error.status_changed' AND entity_id = ? ORDER BY created_at DESC", second.id);
  assert.ok(audit, 'status changes must be audited');
  const metadata = JSON.parse(audit.metadata);
  assert.equal(metadata.to, 'closed');
});

/* ----------------------------- attachments ---------------------------- */

test('attachments are private and validated', async () => {
  const miaToken = await tokenFor('memberA');
  const benToken = await tokenFor('memberB');
  const errorId = ids.memberError.id;

  const form = new FormData();
  form.append('files', new Blob([Buffer.from('console trace\nTypeError: boom')], { type: 'text/plain' }), 'console.log');
  const upload = await request('POST', `/api/errors/${errorId}/attachments`, { token: miaToken, form });
  assert.equal(upload.status, 201, JSON.stringify(upload.data));
  const attachment = upload.data.attachments[0];
  assert.equal(attachment.originalFilename, 'console.log');

  const ownerDownload = await request('GET', `/api/errors/${errorId}/attachments/${attachment.id}/download`, { token: miaToken });
  assert.equal(ownerDownload.status, 200);
  assert.match(ownerDownload.data, /TypeError: boom/);

  const strangerDownload = await request('GET', `/api/errors/${errorId}/attachments/${attachment.id}/download`, { token: benToken });
  assert.equal(strangerDownload.status, 404, 'non-owners must not read private evidence');

  const anonymous = await fetch(`${base}/api/errors/${errorId}/attachments/${attachment.id}/download`);
  assert.equal(anonymous.status, 401);

  const badForm = new FormData();
  badForm.append('files', new Blob([Buffer.from('<script>alert(1)</script>')], { type: 'text/html' }), 'evil.html');
  const badType = await request('POST', `/api/errors/${errorId}/attachments`, { token: miaToken, form: badForm });
  assert.equal(badType.status, 400);
  assert.equal(badType.data.code, 'UNSUPPORTED_FILE_TYPE');

  const bigForm = new FormData();
  bigForm.append('files', new Blob([Buffer.alloc(6 * 1024 * 1024, 97)], { type: 'text/plain' }), 'huge.log');
  const tooBig = await request('POST', `/api/errors/${errorId}/attachments`, { token: miaToken, form: bigForm });
  assert.equal(tooBig.status, 400);
  assert.equal(tooBig.data.code, 'FILE_TOO_LARGE');
});

/* ------------------------- invitations and access --------------------- */

test('invitations are single-use and create the invited role', async () => {
  const adminToken = await tokenFor('admin');
  const invite = await request('POST', '/api/users/invite', {
    token: adminToken,
    body: { fullName: 'Nina New', email: 'nina@test.local', role: 'member' },
  });
  assert.equal(invite.status, 201);
  const invitePath = invite.data.inviteUrl;
  assert.match(invitePath, /^\/invite\//);

  const token = invitePath.split('/').pop();
  const preview = await request('GET', `/api/auth/invitation/${token}`);
  assert.equal(preview.status, 200);
  assert.equal(preview.data.invitation.status, 'pending');

  const accepted = await request('POST', '/api/auth/accept-invitation', {
    body: { token, password: 'FreshPass1', fullName: 'Nina New' },
  });
  assert.equal(accepted.status, 201, JSON.stringify(accepted.data));
  assert.equal(accepted.data.user.role, 'member');
  assert.ok(accepted.data.token);

  const reuse = await request('POST', '/api/auth/accept-invitation', { body: { token, password: 'OtherPass1' } });
  assert.equal(reuse.status, 409);

  const loginAgain = await login('nina@test.local', 'FreshPass1');
  assert.equal(loginAgain.status, 200);

  // Revoked invitations cannot be used.
  const second = await request('POST', '/api/users/invite', {
    token: adminToken,
    body: { fullName: 'Ravi Revoked', email: 'ravi@test.local', role: 'member' },
  });
  const secondToken = second.data.inviteUrl.split('/').pop();
  const invitationRow = q.get('SELECT id FROM invitations ORDER BY created_at DESC LIMIT 1');
  const revoked = await request('DELETE', `/api/invitations/${invitationRow.id}`, { token: adminToken });
  assert.equal(revoked.status, 200);
  const useRevoked = await request('POST', '/api/auth/accept-invitation', { body: { token: secondToken, password: 'FreshPass1' } });
  assert.equal(useRevoked.status, 409);
});

test('access requests require admin approval before an account exists', async () => {
  const requestResult = await request('POST', '/api/auth/access-request', {
    body: {
      fullName: 'Olga Outsider',
      email: 'olga@outside.local',
      requestReason: 'I am joining the QA team and need to report defects.',
    },
  });
  assert.equal(requestResult.status, 201);

  const pendingLogin = await login('olga@outside.local', 'AnyPass1');
  assert.equal(pendingLogin.status, 401, 'no account should exist before approval');

  const memberToken = await tokenFor('memberA');
  const forbidden = await request('GET', '/api/access-requests', { token: memberToken });
  assert.equal(forbidden.status, 403);

  const adminToken = await tokenFor('admin');
  const list = await request('GET', '/api/access-requests?status=pending', { token: adminToken });
  assert.equal(list.status, 200);
  const pending = list.data.requests.find((item) => item.email === 'olga@outside.local');
  assert.ok(pending);

  const approve = await request('PATCH', `/api/access-requests/${pending.id}`, {
    token: adminToken,
    body: { action: 'approve', role: 'member' },
  });
  assert.equal(approve.status, 200);
  assert.ok(approve.data.inviteUrl);

  const alreadyReviewed = await request('PATCH', `/api/access-requests/${pending.id}`, {
    token: adminToken,
    body: { action: 'reject' },
  });
  assert.equal(alreadyReviewed.status, 409);
});

/* --------------------- account state and session hygiene -------------- */

test('deactivation blocks existing sessions and new sign-ins', async () => {
  const caraToken = await tokenFor('memberC');
  const adminToken = await tokenFor('admin');

  const deactivate = await request('PATCH', `/api/users/${ids.memberC.id}/status`, { token: adminToken, body: { accountStatus: 'inactive' } });
  assert.equal(deactivate.status, 200);

  const staleSession = await request('GET', '/api/errors', { token: caraToken });
  assert.equal(staleSession.status, 401, 'the deactivation revoked the session');
  assert.ok(['SESSION_INVALID', 'UNAUTHENTICATED'].includes(staleSession.data.code));

  const blockedLogin = await login(ids.memberC.email);
  assert.equal(blockedLogin.status, 403);

  const reactivate = await request('PATCH', `/api/users/${ids.memberC.id}/status`, { token: adminToken, body: { accountStatus: 'active' } });
  assert.equal(reactivate.status, 200);
  assert.equal((await login(ids.memberC.email)).status, 200);
});

test('role changes revoke the affected user’s sessions', async () => {
  const benToken = await tokenFor('memberB');
  const adminToken = await tokenFor('admin');

  const promote = await request('PATCH', `/api/users/${ids.memberB.id}/role`, { token: adminToken, body: { role: 'admin' } });
  assert.equal(promote.status, 200);
  assert.equal(promote.data.user.role, 'admin');

  const stale = await request('GET', '/api/users', { token: benToken });
  assert.equal(stale.status, 401, 'a pre-existing session must not inherit the new role');

  tokenCache.delete('memberB');
  const fresh = await tokenFor('memberB');
  const nowAllowed = await request('GET', '/api/users', { token: fresh });
  assert.equal(nowAllowed.status, 200);

  // Restore the member role and check the last-admin guard is not triggered.
  const demote = await request('PATCH', `/api/users/${ids.memberB.id}/role`, { token: adminToken, body: { role: 'member' } });
  assert.equal(demote.status, 200);
});

test('an admin cannot deactivate themselves', async () => {
  const adminToken = await tokenFor('admin');
  const selfDeactivate = await request('PATCH', `/api/users/${ids.admin.id}/status`, { token: adminToken, body: { accountStatus: 'inactive' } });
  assert.equal(selfDeactivate.status, 400);
  assert.equal(selfDeactivate.data.code, 'SELF_ACTION');
});

/* ------------------------------ reporting ----------------------------- */

test('reports, filters and analytics respect access rules', async () => {
  const adminToken = await tokenFor('admin');
  const dashboard = await request('GET', '/api/reports/dashboard', { token: adminToken });
  assert.equal(dashboard.status, 200);
  assert.equal(dashboard.data.scope, 'admin');
  assert.ok(dashboard.data.cards.total >= 3);
  assert.equal(dashboard.data.trend.length, 6);
  assert.ok(Array.isArray(dashboard.data.pendingActions));

  const filtered = await request('GET', '/api/errors?priority=high&status=submitted&search=checkout', { token: adminToken });
  assert.equal(filtered.status, 200);
  for (const item of filtered.data.items) {
    assert.equal(item.priority, 'high');
    assert.equal(item.status, 'submitted');
  }

  const facets = await request('GET', '/api/errors/facets', { token: adminToken });
  assert.equal(facets.status, 200);
  assert.ok(facets.data.total >= filtered.data.items.length);
  assert.ok('submitted' in facets.data.counts);

  const analytics = await request('GET', '/api/reports/analytics?groupBy=priority', { token: adminToken });
  assert.equal(analytics.status, 200);
  assert.equal(analytics.data.groupBy, 'priority');
  assert.ok(analytics.data.rows.length >= 1);

  const memberToken = await tokenFor('memberA');
  const memberDashboard = await request('GET', '/api/reports/dashboard', { token: memberToken });
  assert.equal(memberDashboard.data.scope, 'member');
  assert.equal(memberDashboard.data.users, null, 'member dashboards must not include user administration data');
  assert.equal(memberDashboard.data.workload.length, 0);
});

test('exports produce valid CSV, XLSX and PDF files', async () => {
  const adminToken = await tokenFor('admin');

  const csv = await request('GET', '/api/reports/export?format=csv', { token: adminToken });
  assert.equal(csv.status, 200);
  assert.match(csv.headers.get('content-type'), /text\/csv/);
  assert.match(String(csv.data), /Error ID,Title,Application/);
  assert.match(String(csv.data), /ERR-\d{4}-\d{4}/);

  const pdf = await fetch(`${base}/api/reports/export?format=pdf`, { headers: { authorization: `Bearer ${adminToken}` } });
  const pdfBuffer = Buffer.from(await pdf.arrayBuffer());
  assert.equal(pdf.status, 200);
  assert.equal(pdfBuffer.subarray(0, 4).toString(), '%PDF');

  const xlsx = await fetch(`${base}/api/reports/export?format=xlsx`, { headers: { authorization: `Bearer ${adminToken}` } });
  const xlsxBuffer = Buffer.from(await xlsx.arrayBuffer());
  assert.equal(xlsx.status, 200);
  assert.equal(xlsxBuffer.subarray(0, 2).toString(), 'PK', 'xlsx must be a zip container');

  const audited = q.get("SELECT COUNT(*) AS c FROM audit_logs WHERE action = 'report.exported'");
  assert.ok(audited.c >= 3, 'every export is recorded in the audit trail');
});

test('audit logs capture sensitive actions with actor metadata', async () => {
  const adminToken = await tokenFor('admin');
  const result = await request('GET', '/api/audit-logs?pageSize=100', { token: adminToken });
  assert.equal(result.status, 200);
  const actions = new Set(result.data.items.map((item) => item.action));
  for (const action of ['error.created', 'error.status_changed', 'error.assigned', 'user.invited', 'access_request.approved', 'auth.login', 'report.exported']) {
    assert.ok(actions.has(action), `expected audit action ${action}`);
  }
  const sensitive = await request('GET', '/api/audit-logs?sensitive=true', { token: adminToken });
  for (const item of sensitive.data.items) {
    assert.ok(['user.role_changed', 'user.status_changed', 'settings.updated', 'security.denied', 'report.exported'].includes(item.action));
  }
});

test('settings changes are admin-only and take effect', async () => {
  const memberToken = await tokenFor('memberA');
  const denied = await request('PATCH', '/api/settings', { token: memberToken, body: { team_visibility: 'team_wide' } });
  assert.equal(denied.status, 403);

  const adminToken = await tokenFor('admin');
  const saved = await request('PATCH', '/api/settings', { token: adminToken, body: { team_visibility: 'team_wide' } });
  assert.equal(saved.status, 200);

  const benToken = await freshToken('memberB');
  const wide = await request('GET', '/api/errors', { token: benToken });
  assert.equal(wide.status, 200, JSON.stringify(wide.data));
  assert.ok(wide.data.items.some((item) => item.id === ids.memberError.id), 'team-wide visibility exposes all reports');

  const invalid = await request('PATCH', '/api/settings', { token: adminToken, body: { team_visibility: 'everyone-on-earth' } });
  assert.equal(invalid.status, 400);

  const restore = await request('PATCH', '/api/settings', { token: adminToken, body: { team_visibility: 'own_or_assigned' } });
  assert.equal(restore.status, 200);
});

test('password reset flow invalidates previous sessions', async () => {
  const ninaToken = (await login('nina@test.local', 'FreshPass1')).data.token;
  const forgot = await request('POST', '/api/auth/forgot-password', { body: { email: 'nina@test.local' } });
  assert.equal(forgot.status, 200);
  assert.ok(forgot.data.devResetToken, 'development builds return the reset token because no mail transport exists');

  const reset = await request('POST', '/api/auth/reset-password', {
    body: { token: forgot.data.devResetToken, newPassword: 'BetterPass2' },
  });
  assert.equal(reset.status, 200);

  const reused = await request('POST', '/api/auth/reset-password', {
    body: { token: forgot.data.devResetToken, newPassword: 'AnotherPass3' },
  });
  assert.equal(reused.status, 400);

  const staleSession = await request('GET', '/api/errors', { token: ninaToken });
  assert.equal(staleSession.status, 401);

  assert.equal((await login('nina@test.local', 'BetterPass2')).status, 200);
});
