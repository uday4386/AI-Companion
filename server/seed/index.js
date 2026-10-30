import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { db, q, uid, UPLOAD_DIR, setSetting } from '../db.js';
import { hashPassword } from '../auth.js';
import { APPS, USERS, ERRORS, ACCESS_REQUESTS, INVITATIONS, DEMO_PASSWORD } from './dataset.js';

const DAY = 86400000;
const now = Date.now();

const iso = (ms) => new Date(ms).toISOString();
const pad4 = (n) => String(n).padStart(4, '0');

/** Extra comments added at seed time (kept here so demo inboxes have unread items). */
const EXTRA_COMMENTS = [
  { error: 18, author: 'admin', hoursAgo: 3, text: 'Reproduced on staging. The range is stored in component state only — moving it to the URL is a small fix, picking it up this sprint.' },
  { error: 17, author: 'admin', hoursAgo: 5, text: 'Could you attach the network waterfall from the warehouse terminal? Want to confirm the payload size before we change the picker.' },
  { error: 5, author: 'admin', hoursAgo: 20, text: 'Finance needs the affected transaction list by Friday. Please post it here when ready.', visibility: 'admin' },
];

const STATUS_CHAINS = {
  submitted: ['submitted'],
  under_review: ['submitted', 'under_review'],
  assigned: ['submitted', 'under_review', 'assigned'],
  in_progress: ['submitted', 'under_review', 'assigned', 'in_progress'],
  on_hold: ['submitted', 'under_review', 'assigned', 'in_progress', 'on_hold'],
  resolved: ['submitted', 'under_review', 'assigned', 'in_progress', 'resolved'],
  closed: ['submitted', 'under_review', 'assigned', 'in_progress', 'resolved', 'closed'],
  rejected: ['submitted', 'under_review', 'rejected'],
  reopened: ['submitted', 'under_review', 'assigned', 'in_progress', 'resolved', 'reopened'],
};

function transitionReason(from, to, assigneeName) {
  if (to === 'under_review') return 'Intake review started';
  if (to === 'assigned') return assigneeName ? `Assigned to ${assigneeName}` : 'Assigned to the owning team';
  if (to === 'in_progress') return 'Investigation started';
  if (to === 'on_hold') return 'Paused pending a third-party dependency';
  if (to === 'resolved') return 'Fix verified on staging';
  if (to === 'closed') return 'Verified in production and signed off';
  if (to === 'rejected') return 'Duplicate or out of scope — see Admin remark';
  if (to === 'reopened') return 'Issue reoccurred after the last release';
  return `Moved from ${from}`;
}

function screenshotSvg({ code, title, message, tone = '#dc2626' }) {
  const wrap = (text, max) => {
    const words = String(text).split(' ');
    const lines = [];
    let line = '';
    for (const word of words) {
      if ((line + ' ' + word).trim().length > max) {
        lines.push(line.trim());
        line = word;
      } else {
        line += ` ${word}`;
      }
    }
    if (line.trim()) lines.push(line.trim());
    return lines.slice(0, 3);
  };
  const lines = wrap(message, 74);
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1280" height="800" viewBox="0 0 1280 800">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#f8fafc"/><stop offset="100%" stop-color="#eef2ff"/>
    </linearGradient>
  </defs>
  <rect width="1280" height="800" fill="url(#bg)"/>
  <rect width="1280" height="56" fill="#ffffff"/>
  <circle cx="28" cy="28" r="6" fill="#f87171"/><circle cx="48" cy="28" r="6" fill="#fbbf24"/><circle cx="68" cy="28" r="6" fill="#34d399"/>
  <rect x="96" y="16" width="520" height="24" rx="8" fill="#f1f5f9"/>
  <text x="110" y="33" font-family="Inter, Arial, sans-serif" font-size="13" fill="#64748b">https://admin.northwind.example/errors/${code.toLowerCase()}</text>
  <rect x="0" y="56" width="248" height="744" fill="#1e1b4b"/>
  <text x="28" y="100" font-family="Inter, Arial, sans-serif" font-size="15" font-weight="700" fill="#ffffff">Error Tracking</text>
  <text x="28" y="122" font-family="Inter, Arial, sans-serif" font-size="11" fill="#a5b4fc">Northwind Platform</text>
  ${['Dashboard', 'All Errors', 'Assignments', 'Reports', 'User Management', 'Audit Logs'].map((item, i) => `<g><rect x="16" y="${160 + i * 48}" width="216" height="36" rx="10" fill="${i === 1 ? '#4338ca' : 'transparent'}"/><text x="32" y="${183 + i * 48}" font-family="Inter, Arial, sans-serif" font-size="13" fill="${i === 1 ? '#ffffff' : '#c7d2fe'}">${item}</text></g>`).join('')}
  <text x="288" y="120" font-family="Inter, Arial, sans-serif" font-size="12" fill="#6366f1" font-weight="700">${code}</text>
  <text x="288" y="156" font-family="Inter, Arial, sans-serif" font-size="28" font-weight="700" fill="#0f172a">${title.replace(/&/g, '&amp;')}</text>
  <rect x="288" y="190" width="120" height="26" rx="13" fill="#fee2e2"/>
  <text x="308" y="208" font-family="Inter, Arial, sans-serif" font-size="12" fill="#b91c1c" font-weight="600">Critical</text>
  <rect x="288" y="248" width="880" height="150" rx="16" fill="#ffffff" stroke="#e2e8f0"/>
  <rect x="288" y="248" width="6" height="150" rx="3" fill="${tone}"/>
  <text x="320" y="286" font-family="Inter, Arial, sans-serif" font-size="15" font-weight="700" fill="${tone}">Application error captured</text>
  ${lines.map((line, i) => `<text x="320" y="${318 + i * 24}" font-family="Inter, Arial, sans-serif" font-size="14" fill="#334155">${line.replace(/&/g, '&amp;').replace(/</g, '&lt;')}</text>`).join('')}
  <rect x="288" y="430" width="432" height="310" rx="16" fill="#0b1120"/>
  <text x="312" y="466" font-family="ui-monospace, SFMono-Regular, Menlo, monospace" font-size="12" fill="#94a3b8">console — trace</text>
  ${['TypeError: Cannot read properties of undefined', "  at resolveSession (auth/session.ts:142:19)", "  at async handleCallback (auth/callback.ts:63:11)", "  at async layer.insertBefore (router.ts:184:5)", 'POST /api/session 500 — 1.2s'].map((line, i) => `<text x="312" y="${498 + i * 26}" font-family="ui-monospace, SFMono-Regular, Menlo, monospace" font-size="12" fill="${i === 0 ? '#fca5a5' : '#cbd5e1'}">${line}</text>`).join('')}
  <rect x="744" y="430" width="424" height="310" rx="16" fill="#ffffff" stroke="#e2e8f0"/>
  <text x="768" y="466" font-family="Inter, Arial, sans-serif" font-size="13" font-weight="700" fill="#0f172a">Environment</text>
  ${[['Build', 'web-4.12.3'], ['Browser', 'Chrome 128 · macOS'], ['User', 'ops.admin@northwind.example'], ['Captured', new Date().toUTCString()], ['Region', 'ap-south-1']].map(([k, v], i) => `<g><text x="768" y="${500 + i * 34}" font-family="Inter, Arial, sans-serif" font-size="12" fill="#64748b">${k}</text><text x="900" y="${500 + i * 34}" font-family="Inter, Arial, sans-serif" font-size="12" fill="#0f172a" font-weight="600">${v}</text></g>`).join('')}
  <rect x="904" y="120" width="264" height="76" rx="14" fill="#ffffff" stroke="#e2e8f0"/>
  <text x="924" y="150" font-family="Inter, Arial, sans-serif" font-size="12" fill="#64748b">Open critical errors</text>
  <text x="924" y="180" font-family="Inter, Arial, sans-serif" font-size="26" font-weight="700" fill="#0f172a">7</text>
</svg>`;
}

function clearDatabase() {
  const tables = [
    'error_status_history', 'error_comments', 'error_attachments', 'notifications', 'audit_logs',
    'password_resets', 'sessions', 'errors', 'invitations', 'access_requests', 'applications',
    'profiles', 'settings',
  ];
  for (const table of tables) db.exec(`DELETE FROM ${table}`);
  const dir = path.join(UPLOAD_DIR, 'errors');
  if (fs.existsSync(dir)) fs.rmSync(dir, { recursive: true, force: true });
}

export function seedDatabase({ force = false } = {}) {
  const existing = q.get('SELECT COUNT(*) AS c FROM profiles')?.c ?? 0;
  if (existing > 0 && !force) return { skipped: true };
  if (force) clearDatabase();

  const { hash, salt } = hashPassword(DEMO_PASSWORD);
  const nowIso = iso(now);

  /* ------------------------------- users ------------------------------- */
  const userMap = {};
  for (const [index, user] of USERS.entries()) {
    const id = uid();
    userMap[user.key] = { id, ...user };
    q.run(
      `INSERT INTO profiles (id, full_name, email, role, account_status, job_title, department, avatar_tone,
        password_hash, password_salt, last_login_at, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      id,
      user.fullName,
      user.email,
      user.role,
      user.inactive ? 'inactive' : 'active',
      user.jobTitle,
      user.department,
      user.tone,
      hash,
      salt,
      iso(now - (index + 1) * 3600000),
      iso(now - (240 - index * 3) * DAY),
      nowIso,
    );
  }
  const admin = userMap.admin;
  const adminUsers = [userMap.admin, userMap.marcus];

  /* --------------------------- applications --------------------------- */
  const appMap = {};
  for (const [index, app] of APPS.entries()) {
    const id = uid();
    appMap[app.name] = { id, ...app };
    q.run(
      'INSERT INTO applications (id, name, description, color, is_active, created_by, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
      id,
      app.name,
      app.description,
      app.color,
      app.active ? 1 : 0,
      admin.id,
      iso(now - (220 - index * 4) * DAY),
    );
  }

  /* ------------------------------ settings ---------------------------- */
  setSetting('team_visibility', 'own_or_assigned');
  setSetting('allow_member_submissions', 'true');
  setSetting('require_reason_for_closure', 'true');
  setSetting('max_upload_mb', '5');

  /* ------------------------------- errors ------------------------------ */
  const ordered = [...ERRORS]
    .map((e, index) => ({ ...e, sourceIndex: index }))
    .sort((a, b) => b.daysAgo - a.daysAgo);

  const yearCounters = {};
  const insertedErrors = [];

  for (const template of ordered) {
    const createdMs = now - template.daysAgo * DAY - (template.daysAgo === 0 ? 2 * 3600000 : 9 * 3600000);
    const year = new Date(createdMs).getUTCFullYear();
    yearCounters[year] = (yearCounters[year] || 0) + 1;
    const errorCode = `ERR-${year}-${pad4(yearCounters[year])}`;

    const id = uid();
    const submitter = userMap[template.submitter];
    const assignee = template.assignee ? userMap[template.assignee] : null;
    const reviewer = template.priority === 'critical' ? userMap.admin : adminUsers[template.sourceIndex % 2];

    const chain = STATUS_CHAINS[template.status];
    const history = [];
    let cursor = createdMs;
    for (const [stepIndex, status] of chain.entries()) {
      if (stepIndex > 0) {
        const gap = (6 + ((template.sourceIndex + stepIndex) % 4) * 5) * 3600000;
        cursor = Math.min(cursor + gap, now - 30 * 60000);
      }
      history.push({
        status,
        at: iso(cursor),
        actor: stepIndex === 0 ? submitter : reviewer,
        reason: stepIndex === 0 ? 'Report created' : transitionReason(chain[stepIndex - 1], status, assignee?.fullName),
      });
    }

    const lastAt = history[history.length - 1].at;
    const resolvedStep = history.find((h) => h.status === 'resolved');
    const closedStep = history.find((h) => h.status === 'closed');
    const isAssigned = chain.includes('assigned') && template.status !== 'rejected';

    q.run(
      `INSERT INTO errors (id, error_code, title, application_id, module, category, priority, description,
        reproduction_steps, expected_result, actual_result, submitted_by, assigned_to, status, admin_remark,
        resolution_summary, root_cause, is_archived, created_at, updated_at, resolved_at, closed_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?, ?, ?)`,
      id,
      errorCode,
      template.title,
      appMap[template.app].id,
      template.module,
      template.category,
      template.priority,
      template.description,
      template.steps ?? null,
      template.expected ?? null,
      template.actual ?? null,
      submitter.id,
      isAssigned ? assignee?.id ?? null : null,
      template.status,
      template.adminRemark ?? null,
      template.resolution ?? null,
      template.rootCause ?? null,
      iso(createdMs),
      lastAt,
      resolvedStep?.at ?? null,
      closedStep?.at ?? null,
    );

    for (const step of history) {
      q.run(
        `INSERT INTO error_status_history (id, error_id, old_status, new_status, changed_by, change_reason, changed_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        uid(),
        id,
        step.status === 'submitted' ? null : history[history.indexOf(step) - 1].status,
        step.status,
        step.actor.id,
        step.reason,
        step.at,
      );
    }

    insertedErrors.push({
      id,
      errorCode,
      title: template.title,
      status: template.status,
      priority: template.priority,
      createdAt: iso(createdMs),
      submitter,
      assignee: isAssigned ? assignee : null,
      reviewer,
      history,
      sourceIndex: template.sourceIndex,
      template,
    });
  }

  /* ----------------------------- comments ------------------------------ */
  for (const entry of insertedErrors) {
    const defs = [
      ...(entry.template.comments ?? []).map((c) => ({ ...c, at: iso(new Date(entry.createdAt).getTime() + 6 * 3600000) })),
      ...EXTRA_COMMENTS.filter((c) => c.error === entry.sourceIndex).map((c) => ({
        author: c.author,
        text: c.text,
        visibility: c.visibility ?? 'public',
        at: iso(now - c.hoursAgo * 3600000),
      })),
    ];
    for (const comment of defs) {
      const author = userMap[comment.author] ?? admin;
      q.run(
        `INSERT INTO error_comments (id, error_id, author_id, comment_text, visibility, created_at)
         VALUES (?, ?, ?, ?, ?, ?)`,
        uid(),
        entry.id,
        author.id,
        comment.text,
        comment.visibility ?? 'public',
        comment.at,
      );
    }
  }

  /* ---------------------------- attachments ---------------------------- */
  const withScreenshots = insertedErrors.filter((e) =>
    [0, 4, 6, 19, 17, 28].includes(e.sourceIndex),
  );
  for (const entry of withScreenshots) {
    const dir = path.join(UPLOAD_DIR, 'errors', entry.id);
    fs.mkdirSync(dir, { recursive: true });
    const filename = `${crypto.randomBytes(10).toString('hex')}-screenshot.svg`;
    const svg = screenshotSvg({
      code: entry.errorCode,
      title: entry.title,
      message: entry.template.description,
      tone: entry.priority === 'critical' ? '#dc2626' : '#4f46e5',
    });
    const absolute = path.join(dir, filename);
    fs.writeFileSync(absolute, svg, 'utf8');
    q.run(
      `INSERT INTO error_attachments (id, error_id, storage_path, original_filename, mime_type, size_bytes, uploaded_by, created_at)
       VALUES (?, ?, ?, ?, 'image/svg+xml', ?, ?, ?)`,
      uid(),
      entry.id,
      `errors/${entry.id}/${filename}`,
      `screenshot-${entry.errorCode.toLowerCase()}.svg`,
      Buffer.byteLength(svg, 'utf8'),
      entry.submitter.id,
      iso(new Date(entry.createdAt).getTime() + 2 * 3600000),
    );
  }

  /* --------------------------- notifications --------------------------- */
  const notify = (recipientId, { type, title, message = null, errorId = null, at }) => {
    if (!recipientId) return;
    const read = new Date(at).getTime() < now - 12 * DAY;
    q.run(
      `INSERT INTO notifications (id, recipient_id, error_id, type, title, message, is_read, created_at, read_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      uid(),
      recipientId,
      errorId,
      type,
      title,
      message,
      read ? 1 : 0,
      at,
      read ? iso(new Date(at).getTime() + 3600000) : null,
    );
  };

  for (const entry of insertedErrors) {
    for (const [index, step] of entry.history.entries()) {
      if (index === 0) {
        for (const adminUser of adminUsers) {
          if (adminUser.id === entry.submitter.id) continue;
          notify(adminUser.id, {
            type: 'error_submitted',
            title: 'New error submitted',
            message: `${entry.errorCode} · ${entry.title}`,
            errorId: entry.id,
            at: step.at,
          });
        }
        continue;
      }
      if (step.actor.id !== entry.submitter.id) {
        notify(entry.submitter.id, {
          type: 'status_changed',
          title: `Status updated to ${step.status.replace(/_/g, ' ')}`,
          message: `${entry.errorCode} · ${step.reason}`,
          errorId: entry.id,
          at: step.at,
        });
      }
      if (step.status === 'assigned' && entry.assignee) {
        notify(entry.assignee.id, {
          type: 'assigned',
          title: 'Error assigned to you',
          message: `${entry.errorCode} · ${entry.title}`,
          errorId: entry.id,
          at: step.at,
        });
      }
    }
  }

  for (const entry of insertedErrors) {
    const comments = q.all(
      'SELECT c.*, p.full_name AS author FROM error_comments c JOIN profiles p ON p.id = c.author_id WHERE c.error_id = ? AND c.visibility = ?',
      entry.id,
      'public',
    );
    for (const comment of comments) {
      const recipients = new Set([entry.submitter.id, entry.assignee?.id, ...adminUsers.map((a) => a.id)]);
      recipients.delete(comment.author_id);
      for (const recipient of recipients) {
        notify(recipient, {
          type: 'comment_added',
          title: 'New comment on a report',
          message: `${entry.errorCode} · ${comment.author}: ${comment.comment_text.slice(0, 110)}`,
          errorId: entry.id,
          at: comment.created_at,
        });
      }
    }
  }

  /* ------------------------------ audit -------------------------------- */
  const audit = (actorId, actorName, action, entityType, entityId, at, metadata = null) => {
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
      at,
    );
  };

  for (const entry of insertedErrors) {
    audit(entry.submitter.id, entry.submitter.fullName, 'error.created', 'error', entry.id, entry.createdAt, {
      errorCode: entry.errorCode,
      title: entry.title,
      priority: entry.priority,
    });
    for (const [index, step] of entry.history.entries()) {
      if (index === 0) continue;
      if (step.status === 'assigned') {
        audit(step.actor.id, step.actor.fullName, 'error.assigned', 'error', entry.id, step.at, {
          errorCode: entry.errorCode,
          to: entry.assignee?.fullName ?? null,
        });
      }
      audit(step.actor.id, step.actor.fullName, 'error.status_changed', 'error', entry.id, step.at, {
        errorCode: entry.errorCode,
        from: entry.history[index - 1].status,
        to: step.status,
        reason: step.reason,
      });
    }
  }

  for (const user of Object.values(userMap)) {
    audit(user.id, user.fullName, 'auth.login', 'profile', user.id, iso(now - (1 + Math.random() * 6) * 3600000));
  }

  /* ------------------------- access requests --------------------------- */
  for (const request of ACCESS_REQUESTS) {
    const id = uid();
    const createdAt = iso(now - request.daysAgo * DAY);
    q.run(
      `INSERT INTO access_requests (id, full_name, email, request_reason, request_status, reviewed_by, reviewed_at, review_note, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      id,
      request.fullName,
      request.email,
      request.requestReason,
      request.status,
      request.status === 'pending' ? null : admin.id,
      request.status === 'pending' ? null : iso(now - (request.daysAgo - 1) * DAY),
      request.reviewNote ?? null,
      createdAt,
    );
    audit(null, request.fullName, 'access_request.submitted', 'access_request', id, createdAt, { email: request.email });
    if (request.status !== 'pending') {
      audit(
        admin.id,
        admin.fullName,
        `access_request.${request.status === 'approved' ? 'approved' : 'rejected'}`,
        'access_request',
        id,
        iso(now - (request.daysAgo - 1) * DAY),
        { email: request.email },
      );
    } else {
      for (const adminUser of adminUsers) {
        notify(adminUser.id, {
          type: 'access_requested',
          title: 'New access request',
          message: `${request.fullName} (${request.email}) requested access.`,
          at: createdAt,
        });
      }
    }
  }

  /* --------------------------- invitations ---------------------------- */
  for (const invite of INVITATIONS) {
    const id = uid();
    const token = crypto.randomBytes(20).toString('hex');
    const createdAt = iso(now - invite.daysAgo * DAY);
    const status = invite.expiresInDays < 0 && invite.status === 'pending' ? 'expired' : invite.status;
    q.run(
      `INSERT INTO invitations (id, email, full_name, role, token, status, invited_by, created_at, expires_at, accepted_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NULL)`,
      id,
      invite.email,
      invite.fullName,
      invite.role,
      token,
      status,
      admin.id,
      createdAt,
      iso(now + invite.expiresInDays * DAY),
    );
    audit(admin.id, admin.fullName, 'user.invited', 'invitation', id, createdAt, { email: invite.email, role: invite.role });
  }

  audit(admin.id, admin.fullName, 'settings.updated', 'settings', null, iso(now - 30 * DAY), {
    changes: [{ key: 'team_visibility', value: 'own_or_assigned' }],
  });

  return {
    skipped: false,
    users: Object.keys(userMap).length,
    applications: APPS.length,
    errors: insertedErrors.length,
  };
}
