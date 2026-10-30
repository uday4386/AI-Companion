# Testing Sentinel

Two ways to test: **automated** (one command, 30 tests) and **manual** (a guided click-through
below). Manual testing starts from an empty workspace, so the first steps create the data you need.

---

## 0. Get in

| | |
| --- | --- |
| URL | the preview on port 3000 (or `http://localhost:3000` locally) |
| Username | `bbox5259` |
| Password | `Mxcoradm@5259` |

The login form accepts the username **or** `bbox5259@sentinel.local`. If you're in an embedded
preview, hard-reload once (`Ctrl+Shift+R`) so the current bundle loads.

**Reset to a clean workspace at any point:**

```bash
npm run seed -- --reset     # deletes all data + uploads, recreates just the admin
```

---

## 1. Automated: `npm test`

```bash
npm test
```

Runs 30 tests against a real Express server and a throwaway database (no mocks, doesn't touch your
data). It covers:

- anonymous requests rejected; wrong password / wrong identifier / inactive account refused
- the bootstrap admin exists, is idempotent, and signs in by username **and** email
- empty workspace really is empty (no demo rows)
- server owns submitter, status and error code — client-supplied values are ignored
- members see only their own/assigned reports; foreign IDs return `404`, not `403`
- members blocked from status change, assignment, archiving, user admin, audit logs, exports,
  internal notes — enforced at the API, so bypassing the UI doesn't help
- members can't promote themselves through the profile endpoint
- lifecycle rejects invalid transitions (`422`), requires reasons and resolution summaries
- attachments are private, type-checked and size-limited
- invitations are single-use and revocable; access-request approval provisions the right role
- role change and deactivation revoke live sessions immediately
- last active admin can't be deactivated; admins can't deactivate themselves
- CSV/XLSX/PDF exports are valid and audited; settings are admin-only and apply instantly
- password reset invalidates existing sessions

Other useful commands: `npm run typecheck`, `npm run build`.

---

## 2. Manual: the 10-minute happy path

Follow in order — each step unblocks the next.

### Step 1 — Add an application (required before any report)
**Settings → Applications → Add application** → e.g. `Payments API`, pick a colour → **Create**.

> Nothing can be filed until an application exists. The submit form tells you this explicitly.

### Step 2 — File a report
**Errors → New report** (or the `New error report` button in the sidebar):

- Title: `Export button returns an empty file`
- Application: the one you just created · Module: `Reports` · Category: `Functional` · Priority: `High`
- Description (15+ chars), then any reproduction steps

Submit → you land on the report detail. Status is **Submitted**, and the ID looks like `ERR-2026-0001`.

### Step 3 — Walk the lifecycle (as admin)
On the report page, use the **Move this report to** buttons:

1. Click **Under Review** → confirm.
2. Click **Assigned** → pick yourself or a teammate → confirm.
3. Click **In Progress**, then **Resolved** → this one **demands a resolution summary**.
4. Then **Closed** → **demands a written reason**.

Try to break it: open a report and jump straight to **Closed** from *Submitted* — the UI only offers
legal moves, and the API returns `422 INVALID_TRANSITION` if you force it. Clearing the reason field
and confirming gives `400 REASON_REQUIRED`.

### Step 4 — Evidence and discussion
On the same report: **Upload** a screenshot/PDF/txt (max 5 MB, 10 per report). Try a `.html` file —
it's refused with `UNSUPPORTED_FILE_TYPE`. Post a comment, and as admin tick **Internal note** — the
note is invisible to members.

### Step 5 — Invite a Team Member
**User management → Invite user** → name + email → **Create invitation**. No mail server is
configured, so the one-time link is shown — copy it. Open it in a private window
(`/invite/<token>`), set a password, and you're signed in as a member.

### Step 6 — Prove the role boundary (the important test)
Still signed in as the **member**:

| Do this | Expected |
| --- | --- |
| Look at the sidebar | No Reports/Users/Audit/Access requests — admin-only |
| Open someone else's report by pasting its URL | `404` page, not "forbidden" (IDs can't be probed) |
| Visit `/users` directly | bounced to `/dashboard` |
| Try to change a status | no status buttons exist; the API returns `403` |
| Visit `/errors?scope=mine` | only your own reports |

### Step 7 — Notifications
Sign back in as admin. The bell shows unread counts: assignment, status change, comment, and the
new submission each produced one. **Notifications** page groups by date; click a row to jump to the
report; use mark-read/unread and **Mark all read**.

### Step 8 — Reports and exports
**Reports & analytics**: switch Group by (application / status / priority), then export **CSV**,
**XLSX** and **PDF** — three real files. Each export is written to the audit log.

### Step 9 — Audit trail
**Audit logs**: every action you just took is listed with actor, entity and timestamp. Expand a row
to see the metadata JSON (e.g. `{"from":"submitted","to":"under_review"}`). Toggle **Sensitive only**
to see role/status/settings changes and exports.

### Step 10 — Settings and access control
**Settings → Workspace**:
- Change **Record visibility** to *Team-wide* → members can now see everything (verify by reloading
  as the member).
- Turn **Allow member submissions** off → submitting as a member is refused.
- Set **Max upload size**, toggle **reason required for closure**.

**Settings → Security** — change your password. Everything else stays signed in; other sessions are
revoked.

### Extras worth trying
- **Access requests**: log out → **Request access** → submit → sign in as admin → **Access
  requests** → approve with a role → get a one-time invite link. Try approving the same request twice
  (blocked, `409`).
- **User management**: change a member's role while they're signed in — their session is revoked
  immediately. Try deactivating the only other admin (`409 LAST_ADMIN`), or deactivating yourself
  (`400 SELF_ACTION`).
- **Forgot password** flow from the login page.
- **Dark mode** toggle in the topbar; resize to mobile width for the slide-out sidebar.
- **404**: visit `/nonsense`.

---

## 3. What "passing" looks like

- Every action that changes state produces an audit row and, for affected people, a notification.
- Nothing a member can do — in the UI *or* by calling `/api` with curl — can change status, assign,
  export, or read someone else's report.
- Illegal workflow moves are refused with a specific error code, never silently ignored.
- Killing the server mid-session and restarting keeps you signed in (7-day session), and a stale
  bundle reloads instead of showing a blank page.

## 4. Known limitations (expected, not bugs)

- No email delivery: invite/reset links are surfaced in the UI for you to copy.
- Attachments preview inline for images only; other types download.
- Notifications refresh on load and after actions — there's no live push.
- Rate limiting is in-memory, so it resets on restart.
