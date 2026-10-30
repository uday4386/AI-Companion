# Sentinel — Error Noting & Tracking System

A production-shaped web application for reporting, triaging and resolving defects across multiple
applications. Team Members capture the evidence; Admins own the workflow — every status change,
assignment, role change and export is permission-checked on the server and written to an audit trail.

![stack](https://img.shields.io/badge/React%2018-TypeScript-3178c6) ![stack](https://img.shields.io/badge/Express-SQLite-2f6f4f) ![stack](https://img.shields.io/badge/Tailwind-Dark%20mode-0ea5e9)

---

## Quick start

```bash
npm install
npm run dev          # http://localhost:3000 — seeds the demo workspace on first start
```

`npm run dev` serves the React app through Vite middleware and the API from the same Express
process, so there is one origin, one port and no proxy configuration.

| Command | What it does |
| --- | --- |
| `npm run dev` | Express + Vite middleware, hot reload, auto-seed if the database is empty |
| `npm run build` | Production build into `dist/` |
| `npm start` | Production server (`NODE_ENV=production`), serves `dist/` and the API |
| `npm run seed` | Re-seed demo data (`npm run seed -- --force` wipes and rebuilds) |
| `npm test` | HTTP-level API/permission test suite (`node:test`, no extra dependency) |
| `npm run typecheck` | `tsc --noEmit` |

Requirements: **Node 22.5+** (the app uses the built-in `node:sqlite` module — no native build step),
no external database, no mail server, no cloud services.

### Demo accounts

All seeded users share the password **`Passw0rd!`**.

| Email | Name | Role |
| --- | --- | --- |
| `admin@entt.dev` | Ayesha Khan | Admin |
| `marcus@entt.dev` | Marcus Feld | Admin |
| `member@entt.dev` | Rahul Verma | Team Member |
| `priya@entt.dev`, `daniel@entt.dev`, `sofia@entt.dev`, `kenji@entt.dev`, `fatima@entt.dev` | — | Team Member |
| `tom@entt.dev` | Tom Okafor | Team Member (inactive — proves the account-status guard) |

The seed also creates **35 reports** across every status, 6 applications, comments (public and
admin-only), screenshot evidence, notifications, an audit history, 2 pending access requests and
1 pending + 1 expired invitation.

---

## What the product does

### Team Members
- Submit a report with application, module, category, priority, environment, reproduction steps,
  expected/actual result, and up to 5 attachments (5 MB each, 10 per report).
- Track their own reports on a personal dashboard (open items, resolution rate, trend, recent activity).
- Comment publicly, or add private notes that only Admins can see.
- Browse "Submitted by me" / "Assigned to me" with search, filters and sorting.
- Read notifications; every state change on their reports produces one.

### Admins
- See everything: every application, every member, every report.
- Move reports through a **server-enforced lifecycle** with reason requirements and audit entries.
- Assign a responsible owner, archive reports, add internal notes.
- Manage users: invite, resend/revoke invitations, change role, deactivate/reactivate, force a
  password reset. The last active Admin cannot be demoted or deactivated.
- Review access requests and approve them into a role with a one-time invitation link.
- Configure the workspace: record visibility, member submissions, reason-for-closure, upload limit.
- Manage the application catalogue (name, colour, active/inactive).
- Read the audit trail, filter by action, entity, date, or "sensitive only".
- Export filtered reports as **CSV, XLSX or PDF** from the dashboard, queue and reports page.

### Security model
- Session cookie `entt_session` is `httpOnly` + `SameSite=Lax` (Bearer tokens are also accepted for
  scripts and tests).
- Passwords: `scrypt` with a per-user salt; password policy is 8+ characters with letters and digits.
- Role and account status are **never** writable through the profile endpoint.
- Changing a role or deactivating an account revokes that user's sessions immediately.
- Non-owners receive `404` (not `403`) for foreign reports, so record IDs cannot be probed.
- Attachments are never public: the file stream is served by an authorised endpoint.
- Sensitive endpoints are rate limited (`RATE_LIMITED`), inputs are validated with shared enums, and
  uploads are restricted by MIME type and size.
- Security headers are set on every response (`nosniff`, strict referrer policy, no
  `x-powered-by`, tightened cross-domain policy). Frame embedding is intentionally not blocked so
  the app can render inside the sandboxed preview iframe.

---

## Workflow

```
submitted ─┬─► under_review ─┬─► assigned ─► in_progress ─► resolved ─► closed
           │                 ├─► in_progress        │                 │
           ├─► assigned      └─► resolved           └─► on_hold ──────┤
           ├─► on_hold                                                       
           └─► rejected ─────────────────────────────► reopened ◄────closed
```

| From | Allowed next statuses |
| --- | --- |
| submitted | under_review, assigned, on_hold, rejected |
| under_review | assigned, in_progress, on_hold, resolved, rejected |
| assigned | in_progress, on_hold, resolved, rejected, under_review |
| in_progress | on_hold, resolved, rejected, assigned |
| on_hold | in_progress, assigned, resolved, rejected |
| resolved | closed, reopened |
| rejected | reopened |
| reopened | under_review, assigned, in_progress, on_hold, resolved, rejected |
| closed | reopened |

- Invalid transitions → `422 INVALID_TRANSITION` (even for Admins).
- `rejected`, `reopened`, `on_hold`, `closed` require a written reason → `400 REASON_REQUIRED`.
- `resolved` requires a resolution summary → `400 RESOLUTION_REQUIRED`.
- Assigning an untriaged report moves it to `assigned`; resolution/closure timestamps are stamped once.

### Visibility policy
| `team_visibility` | Member can see |
| --- | --- |
| `own_or_assigned` (default) | only reports they submitted or are assigned to |
| `team_wide` | every report in the workspace |

Admins always see everything. The policy is read from the database at request time, so a settings
change applies immediately (no restart).

---

## API map

All responses are JSON; errors are `{ error, code }`. Authentication is a session cookie or
`Authorization: Bearer <token>` (the login response also returns the token).

| Area | Endpoints |
| --- | --- |
| Auth | `POST /api/auth/login` · `POST /api/auth/logout` · `GET /api/auth/me` · `POST /api/auth/change-password` · `POST /api/auth/forgot-password` · `POST /api/auth/reset-password` · `GET /api/auth/invitation/:token` · `POST /api/auth/accept-invitation` · `POST /api/auth/resend-invitation/:id` |
| Public intake | `POST /api/auth/access-request` (no account required) |
| Meta | `GET /api/meta` (statuses, priorities, categories, modules, limits, settings, visibility label) |
| Reports | `GET/POST /api/errors` · `GET/PATCH /api/errors/:id` · `POST /api/errors/:id/status` · `PATCH /api/errors/:id/assign` · `POST /api/errors/:id/archive` · `GET /api/errors/facets` |
| Evidence | `POST /api/errors/:id/attachments` · `GET …/attachments/:attachmentId/download` · `DELETE …/attachments/:attachmentId` |
| Discussion | `POST /api/errors/:id/comments` · `DELETE /api/errors/:id/comments/:commentId` |
| Users | `GET /api/users` · `GET /api/users/:id` · `PATCH /api/users/profile` · `PATCH /api/users/:id/role` · `PATCH /api/users/:id/status` · `POST /api/users/:id/reset-password` · `POST /api/users/invite` · `GET /api/directory` |
| Invitations | `GET /api/invitations` · `DELETE /api/invitations/:id` |
| Access requests | `GET /api/access-requests` · `PATCH /api/access-requests/:id` (`approve` / `reject`) |
| Notifications | `GET /api/notifications` · `GET /api/notifications/recent` · `GET /api/notifications/unread-count` · `PATCH /api/notifications/:id/read` · `PATCH /api/notifications/:id/unread` · `POST /api/notifications/read-all` |
| Reports & exports | `GET /api/reports/dashboard` · `GET /api/reports/analytics` · `GET /api/reports/export?format=csv\|xlsx\|pdf` |
| Admin config | `PATCH /api/settings` · `GET/POST /api/applications` · `PATCH /api/applications/:id` · `GET /api/audit-logs` |
| Health | `GET /api/health` |

Reports support `search`, `applicationId`, `status`, `priority`, `category`, `module`, `assigneeId`,
`dateFrom`, `dateTo`, `scope` (`mine` / `assigned`), `sort` (`newest`, `oldest`, `priority`,
`updated`) and `page` / `pageSize`.

### Error codes
`VALIDATION` · `UNAUTHENTICATED` · `INVALID_CREDENTIALS` · `INVALID_TOKEN` · `ACCOUNT_INACTIVE` ·
`FORBIDDEN` · `NOT_FOUND` · `INVALID_TRANSITION` · `REASON_REQUIRED` · `RESOLUTION_REQUIRED` ·
`LAST_ADMIN` · `SELF_ACTION` · `NO_CHANGE` · `CONFLICT` · `GONE` · `EXPIRED` · `RATE_LIMITED` ·
`SUBMISSION_DISABLED` · `UNSUPPORTED_FILE_TYPE` · `FILE_TOO_LARGE` · `PAYLOAD_TOO_LARGE` ·
`TOO_MANY_FILES` · `SERVER_ERROR`

---

## Architecture

```
server/
  config.js        statuses, transitions, priorities, categories, limits (single source of truth)
  db.js            node:sqlite connection, WAL, schema migrations, helpers (q, getSetting, writeAudit)
  auth.js          scrypt hashing, sessions, cookie helpers, attachUser/requireAuth/requireAdmin
  access.js        record-level visibility + permission helpers
  notify.js        notification fan-out (assignee, admins, requester)
  app.js           express app factory: headers, rate limits, routers, SPA fallback, error handler
  index.js         bootstrap: auto-seed, Vite middleware in dev, static dist in production
  xlsx.js          dependency-free XLSX writer (zip + shared strings + sheet XML)
  routes/          auth, users, errors, applications, notifications, reports, audit
  seed/            deterministic demo dataset + seeder
  tests/           HTTP-level permission and workflow suite
src/
  contexts/        theme, toast, auth (session + unread badge + workspace settings)
  components/ui/   button, card, badge, fields, modal/confirm, avatar, empty states, pagination, tabs, switch
  components/      error table, status badges, stat cards, charts (recharts), sidebar/topbar layout
  pages/           dashboard, queue, detail, submit, assignments, reports, users, access requests,
                   notifications, audit logs, settings, profile, auth flows, 404
```

- **Database**: SQLite via `node:sqlite` in WAL mode, stored at `server/data/entt.sqlite`
  (`DATA_DIR` / `DB_PATH` override). Schema auto-creates on boot.
- **Uploads**: `server/uploads` (`UPLOAD_DIR`), streamed through an authorised endpoint.
- **Exports**: CSV and XLSX generated natively (no external library), PDF via `pdfkit`.
- **Charts**: `recharts`, lazy-loaded so the initial bundle stays ~225 kB.
- **Frontend**: React 18 + TypeScript (strict) + Tailwind, dark mode, keyboard-accessible modals,
  responsive sidebar, empty/loading/error states everywhere.

### Configuration
| Variable | Default | Purpose |
| --- | --- | --- |
| `PORT` | `3000` | HTTP port |
| `HOST` | `0.0.0.0` | Listen address |
| `NODE_ENV` | `development` | `production` serves `dist/` and hides reset-token hints |
| `DATA_DIR` / `DB_PATH` | `server/data` | SQLite location |
| `UPLOAD_DIR` | `server/uploads` | Evidence storage |
| `COOKIE_SECURE` | `false` | Set to `true` behind HTTPS |

---

## Tests

```bash
npm test
```

21 tests run against a real Express instance and a throwaway database (no mocks), covering:

- anonymous access is rejected everywhere; wrong passwords and inactive accounts cannot sign in;
- the server derives submitter, initial status and error code (client-supplied values are ignored);
- members see only their own/assigned records; foreign IDs return `404`;
- members cannot change status, assign, archive, invite, manage users, read audit logs, export or
  post internal notes — even by calling the API directly;
- members cannot promote themselves through the profile endpoint;
- the lifecycle rejects invalid transitions and enforces reasons / resolution summaries;
- attachments are private, type-checked and size-limited;
- invitations are single-use and revocable; approving an access request provisions the right role;
- role changes and deactivations revoke live sessions;
- the last active Admin cannot be deactivated and Admins cannot deactivate themselves;
- exports return valid CSV/XLSX/PDF and are audited;
- settings changes are admin-only and take effect immediately;
- password reset invalidates existing sessions.

---

## Notes & limitations

- Email is not wired up (no SMTP in this environment): invitations and reset links are returned to
  the Admin in the API response and surfaced in the UI as a copyable URL. Password reset exposes the
  one-hour token **only outside production**; in production the response is deliberately generic.
- Rate limiting is in-memory and per-process — fine for a single instance; use a shared store if the
  API is scaled horizontally.
- The demo dataset is deterministic; `npm run seed -- --force` returns the workspace to a known state.
