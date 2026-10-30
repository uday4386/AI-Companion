import express from 'express';
import PDFDocument from 'pdfkit';
import { q, writeAudit, getSetting } from '../db.js';
import { requireAuth, requireAdmin } from '../auth.js';
import { buildFilters, serializeError, BASE_SELECT } from './errors.js';
import { buildXlsx } from '../xlsx.js';
import {
  STATUSES,
  STATUS_META,
  PRIORITIES,
  PRIORITY_META,
  OPEN_STATUSES,
} from '../config.js';

const router = express.Router();

const MONTH_LABELS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const OPEN_SQL = `('${OPEN_STATUSES.join("','")}')`;

function monthKeys(count) {
  const keys = [];
  const now = new Date();
  for (let i = count - 1; i >= 0; i -= 1) {
    const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1));
    keys.push({ key: `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`, label: MONTH_LABELS[d.getUTCMonth()] });
  }
  return keys;
}

/** Scope-only filters (visibility + application) without status/date narrowing. */
function scopeFilters(user, applicationId) {
  const query = {};
  if (applicationId) query.applicationId = applicationId;
  return buildFilters({ user, query });
}

function countBy(where, params, column) {
  return q.all(
    `SELECT ${column} AS k, COUNT(*) AS c FROM errors e JOIN applications a ON a.id = e.application_id WHERE ${where} GROUP BY ${column}`,
    ...params,
  );
}

/* ----------------------------- dashboard ----------------------------- */

router.get('/dashboard', requireAuth, (req, res) => {
  const isAdmin = req.user.role === 'admin';
  const { where, params } = buildFilters(req);
  const trendScope = scopeFilters(req.user, req.query.applicationId);

  const statusRows = countBy(where, params, 'e.status');
  const statusCounts = Object.fromEntries(STATUSES.map((s) => [s, 0]));
  for (const row of statusRows) statusCounts[row.k] = row.c;
  const total = Object.values(statusCounts).reduce((a, b) => a + b, 0);
  const open = OPEN_STATUSES.reduce((sum, s) => sum + statusCounts[s], 0);

  const priorityRows = countBy(where, params, 'e.priority');
  const priorityCounts = Object.fromEntries(PRIORITIES.map((p) => [p, 0]));
  for (const row of priorityRows) priorityCounts[row.k] = row.c;

  const unassignedOpen = q.get(
    `SELECT COUNT(*) AS c FROM errors e JOIN applications a ON a.id = e.application_id
     WHERE ${where} AND e.assigned_to IS NULL AND e.status IN ${OPEN_SQL}`,
    ...params,
  )?.c ?? 0;

  const criticalOpen = q.get(
    `SELECT COUNT(*) AS c FROM errors e JOIN applications a ON a.id = e.application_id
     WHERE ${where} AND e.priority = 'critical' AND e.status IN ${OPEN_SQL}`,
    ...params,
  )?.c ?? 0;

  const avgResolution = q.get(
    `SELECT AVG(julianday(e.resolved_at) - julianday(e.created_at)) AS d
     FROM errors e JOIN applications a ON a.id = e.application_id
     WHERE ${where} AND e.resolved_at IS NOT NULL`,
    ...params,
  )?.d;

  const startOfMonth = new Date(Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth(), 1)).toISOString();
  const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

  const resolvedThisMonth = q.get(
    `SELECT COUNT(*) AS c FROM errors e JOIN applications a ON a.id = e.application_id
     WHERE ${where} AND e.resolved_at >= ?`,
    ...params,
    startOfMonth,
  )?.c ?? 0;

  const submittedThisWeek = q.get(
    `SELECT COUNT(*) AS c FROM errors e JOIN applications a ON a.id = e.application_id
     WHERE ${where} AND e.created_at >= ?`,
    ...params,
    weekAgo,
  )?.c ?? 0;

  const recent = q.all(`${BASE_SELECT} WHERE ${where} ORDER BY e.updated_at DESC LIMIT 6`, ...params).map(serializeError);

  const applicationRows = q.all(
    `SELECT a.id, a.name, a.color, COUNT(e.id) AS total,
       SUM(CASE WHEN e.status IN ${OPEN_SQL} THEN 1 ELSE 0 END) AS open
     FROM applications a JOIN errors e ON e.application_id = a.id
     WHERE ${where} GROUP BY a.id ORDER BY total DESC`,
    ...params,
  );

  const modules = countBy(where, params, 'e.module')
    .map((r) => ({ module: r.k, count: r.c }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 6);

  const categories = countBy(where, params, 'e.category')
    .map((r) => ({ category: r.k, count: r.c }))
    .sort((a, b) => b.count - a.count);

  const months = monthKeys(6);
  const submittedTrend = q.all(
    `SELECT strftime('%Y-%m', e.created_at) AS m, COUNT(*) AS c FROM errors e JOIN applications a ON a.id = e.application_id
     WHERE ${trendScope.where} GROUP BY m`,
    ...trendScope.params,
  );
  const resolvedTrend = q.all(
    `SELECT strftime('%Y-%m', e.resolved_at) AS m, COUNT(*) AS c FROM errors e JOIN applications a ON a.id = e.application_id
     WHERE ${trendScope.where} AND e.resolved_at IS NOT NULL GROUP BY m`,
    ...trendScope.params,
  );
  const submittedMap = Object.fromEntries(submittedTrend.map((r) => [r.m, r.c]));
  const resolvedMap = Object.fromEntries(resolvedTrend.map((r) => [r.m, r.c]));
  const trend = months.map((m) => ({
    month: m.key,
    label: m.label,
    submitted: submittedMap[m.key] ?? 0,
    resolved: resolvedMap[m.key] ?? 0,
  }));

  const cards = {
    total,
    open,
    submitted: statusCounts.submitted,
    underReview: statusCounts.under_review,
    assigned: statusCounts.assigned,
    inProgress: statusCounts.in_progress,
    onHold: statusCounts.on_hold,
    resolved: statusCounts.resolved,
    rejected: statusCounts.rejected,
    reopened: statusCounts.reopened,
    closed: statusCounts.closed,
    unassignedOpen,
    criticalOpen,
    avgResolutionDays: avgResolution ? Math.round(avgResolution * 10) / 10 : null,
    resolvedThisMonth,
    submittedThisWeek,
    resolutionRate: total ? Math.round(((statusCounts.resolved + statusCounts.closed) / total) * 100) : 0,
  };

  const pendingActions = [];
  let workload = [];
  let users = null;

  if (isAdmin) {
    users = {
      active: q.get("SELECT COUNT(*) AS c FROM profiles WHERE account_status = 'active' AND role = 'member'")?.c ?? 0,
      inactive: q.get("SELECT COUNT(*) AS c FROM profiles WHERE account_status = 'inactive'")?.c ?? 0,
      admins: q.get("SELECT COUNT(*) AS c FROM profiles WHERE role = 'admin'")?.c ?? 0,
      pendingRequests: q.get("SELECT COUNT(*) AS c FROM access_requests WHERE request_status = 'pending'")?.c ?? 0,
      pendingInvites: q.get("SELECT COUNT(*) AS c FROM invitations WHERE status = 'pending'")?.c ?? 0,
    };

    pendingActions.push({
      key: 'access_requests',
      label: 'Access requests awaiting review',
      count: users.pendingRequests,
      href: '/access-requests',
      tone: 'violet',
    });
    pendingActions.push({
      key: 'unassigned',
      label: 'Open reports without an assignee',
      count: unassignedOpen,
      href: '/errors?assignedTo=unassigned&status=' + OPEN_STATUSES.join(','),
      tone: 'amber',
    });
    pendingActions.push({
      key: 'critical',
      label: 'Critical reports still open',
      count: criticalOpen,
      href: '/errors?priority=critical&status=' + OPEN_STATUSES.join(','),
      tone: 'rose',
    });
    pendingActions.push({
      key: 'awaiting_closure',
      label: 'Resolved reports awaiting closure',
      count: statusCounts.resolved,
      href: '/errors?status=resolved',
      tone: 'emerald',
    });
    if (users.pendingInvites) {
      pendingActions.push({
        key: 'invitations',
        label: 'Pending invitations',
        count: users.pendingInvites,
        href: '/users',
        tone: 'indigo',
      });
    }

    workload = q.all(
      `SELECT p.id, p.full_name, p.role, p.avatar_tone,
         SUM(CASE WHEN e.status IN ${OPEN_SQL} THEN 1 ELSE 0 END) AS open,
         SUM(CASE WHEN e.status IN ('resolved','closed') THEN 1 ELSE 0 END) AS completed
       FROM profiles p JOIN errors e ON e.assigned_to = p.id
       WHERE ${where}
       GROUP BY p.id ORDER BY open DESC, completed DESC LIMIT 5`,
      ...params,
    ).map((r) => ({
      id: r.id,
      fullName: r.full_name,
      role: r.role,
      avatarTone: r.avatar_tone,
      open: r.open,
      completed: r.completed,
    }));
  } else {
    cards.myAssignments = q.get(
      `SELECT COUNT(*) AS c FROM errors WHERE assigned_to = ? AND status IN ${OPEN_SQL} AND is_archived = 0`,
      req.user.id,
    )?.c ?? 0;
    cards.myResolved = q.get(
      "SELECT COUNT(*) AS c FROM errors WHERE submitted_by = ? AND status IN ('resolved','closed') AND is_archived = 0",
      req.user.id,
    )?.c ?? 0;

    pendingActions.push({
      key: 'my_open',
      label: 'Your reports still in progress',
      count: open,
      href: '/errors?scope=mine&status=' + OPEN_STATUSES.join(','),
      tone: 'amber',
    });
    pendingActions.push({
      key: 'resolved',
      label: 'Resolved reports you can review',
      count: statusCounts.resolved,
      href: '/errors?scope=mine&status=resolved',
      tone: 'emerald',
    });
  }

  const unread = q.get('SELECT COUNT(*) AS c FROM notifications WHERE recipient_id = ? AND is_read = 0', req.user.id)?.c ?? 0;

  res.json({
    scope: isAdmin ? 'admin' : 'member',
    visibility: getSetting('team_visibility'),
    generatedAt: new Date().toISOString(),
    cards,
    statusBreakdown: STATUSES.map((value) => ({ value, label: STATUS_META[value].label, tone: STATUS_META[value].tone, count: statusCounts[value] })),
    priorityBreakdown: PRIORITIES.map((value) => ({ value, label: PRIORITY_META[value].label, tone: PRIORITY_META[value].tone, count: priorityCounts[value] })),
    applicationBreakdown: applicationRows.map((r) => ({ id: r.id, name: r.name, color: r.color, count: r.total, open: r.open })),
    moduleBreakdown: modules,
    categoryBreakdown: categories,
    trend,
    recent,
    pendingActions,
    workload,
    users,
    unreadNotifications: unread,
  });
});

/* ----------------------------- analytics ----------------------------- */

const GROUP_MAP = {
  application: { column: 'a.name', join: '' },
  module: { column: 'e.module', join: '' },
  category: { column: 'e.category', join: '' },
  priority: { column: 'e.priority', join: '' },
  status: { column: 'e.status', join: '' },
  submitter: { column: 's.full_name', join: 'JOIN profiles s ON s.id = e.submitted_by' },
  assignee: { column: "COALESCE(t.full_name, 'Unassigned')", join: 'LEFT JOIN profiles t ON t.id = e.assigned_to' },
};

router.get('/analytics', requireAuth, requireAdmin, (req, res) => {
  const groupBy = GROUP_MAP[String(req.query.groupBy || 'application')] ? String(req.query.groupBy) : 'application';
  const group = GROUP_MAP[groupBy];
  const { where, params } = buildFilters(req);

  const rows = q.all(
    `SELECT ${group.column} AS k,
       COUNT(*) AS total,
       SUM(CASE WHEN e.status IN ${OPEN_SQL} THEN 1 ELSE 0 END) AS open,
       SUM(CASE WHEN e.status IN ('resolved','closed') THEN 1 ELSE 0 END) AS completed,
       SUM(CASE WHEN e.status = 'rejected' THEN 1 ELSE 0 END) AS rejected,
       AVG(CASE WHEN e.resolved_at IS NOT NULL THEN julianday(e.resolved_at) - julianday(e.created_at) END) AS avg_days
     FROM errors e
     JOIN applications a ON a.id = e.application_id
     ${group.join}
     WHERE ${where}
     GROUP BY ${group.column}
     ORDER BY total DESC`,
    ...params,
  );

  const months = monthKeys(12);
  const trendScope = scopeFilters(req.user, req.query.applicationId);
  const submitted = q.all(
    `SELECT strftime('%Y-%m', e.created_at) AS m, COUNT(*) AS c FROM errors e JOIN applications a ON a.id = e.application_id WHERE ${trendScope.where} GROUP BY m`,
    ...trendScope.params,
  );
  const resolved = q.all(
    `SELECT strftime('%Y-%m', e.resolved_at) AS m, COUNT(*) AS c FROM errors e JOIN applications a ON a.id = e.application_id WHERE ${trendScope.where} AND e.resolved_at IS NOT NULL GROUP BY m`,
    ...trendScope.params,
  );
  const subMap = Object.fromEntries(submitted.map((r) => [r.m, r.c]));
  const resMap = Object.fromEntries(resolved.map((r) => [r.m, r.c]));

  const topSubmitters = q.all(
    `SELECT p.id, p.full_name, p.avatar_tone, COUNT(*) AS total,
       SUM(CASE WHEN e.status IN ('resolved','closed') THEN 1 ELSE 0 END) AS resolved
     FROM errors e JOIN applications a ON a.id = e.application_id JOIN profiles p ON p.id = e.submitted_by
     WHERE ${where} GROUP BY p.id ORDER BY total DESC LIMIT 8`,
    ...params,
  );

  const priorityMatrix = q.all(
    `SELECT priority, status, COUNT(*) AS c FROM errors e JOIN applications a ON a.id = e.application_id
     WHERE ${where} GROUP BY priority, status`,
    ...params,
  );

  res.json({
    groupBy,
    rows: rows.map((r) => ({
      key: r.k,
      label: r.k,
      total: r.total,
      open: r.open,
      completed: r.completed,
      rejected: r.rejected,
      avgResolutionDays: r.avg_days ? Math.round(r.avg_days * 10) / 10 : null,
      completionRate: r.total ? Math.round(((r.completed + r.rejected) / r.total) * 100) : 0,
    })),
    trend: months.map((m) => ({
      month: m.key,
      label: m.label,
      submitted: subMap[m.key] ?? 0,
      resolved: resMap[m.key] ?? 0,
    })),
    topSubmitters: topSubmitters.map((r) => ({
      id: r.id,
      fullName: r.full_name,
      avatarTone: r.avatar_tone,
      total: r.total,
      resolved: r.resolved,
    })),
    priorityMatrix: priorityMatrix.map((r) => ({ priority: r.priority, status: r.status, count: r.c })),
  });
});

/* ------------------------------ exports ------------------------------ */

const EXPORT_COLUMNS = [
  { key: 'errorCode', label: 'Error ID', width: 16, pdf: 78 },
  { key: 'title', label: 'Title', width: 42, pdf: 150 },
  { key: 'application', label: 'Application', width: 20, pdf: 85 },
  { key: 'module', label: 'Module', width: 20, pdf: 82 },
  { key: 'category', label: 'Category', width: 14, pdf: 62 },
  { key: 'priority', label: 'Priority', width: 10, pdf: 52 },
  { key: 'status', label: 'Status', width: 14, pdf: 62 },
  { key: 'submittedBy', label: 'Submitted By', width: 20, pdf: 82 },
  { key: 'assignedTo', label: 'Assignee', width: 20, pdf: 82 },
  { key: 'createdAt', label: 'Created', width: 20, pdf: 78 },
  { key: 'updatedAt', label: 'Updated', width: 20, pdf: 78 },
  { key: 'resolutionDays', label: 'Days to resolve', width: 14, pdf: 52 },
  { key: 'description', label: 'Description', width: 70, pdf: 0 },
  { key: 'reproductionSteps', label: 'Steps to reproduce', width: 60, pdf: 0 },
  { key: 'expectedResult', label: 'Expected result', width: 40, pdf: 0 },
  { key: 'actualResult', label: 'Actual result', width: 40, pdf: 0 },
  { key: 'adminRemark', label: 'Admin remark', width: 40, pdf: 0 },
  { key: 'resolutionSummary', label: 'Resolution', width: 40, pdf: 0 },
];

function exportRows(req) {
  const { where, params } = buildFilters(req);
  const rows = q.all(
    `${BASE_SELECT} WHERE ${where} ORDER BY e.created_at DESC LIMIT 5000`,
    ...params,
  ).map((row) => {
    const item = serializeError(row);
    const days = row.resolved_at
      ? Math.max(0, Math.round((new Date(row.resolved_at) - new Date(row.created_at)) / 86400000))
      : '';
    return {
      ...item,
      application: item.application?.name ?? '',
      submittedBy: item.submittedBy?.fullName ?? '',
      assignedTo: item.assignedTo?.fullName ?? '',
      priority: PRIORITY_META[row.priority]?.label ?? row.priority,
      status: STATUS_META[row.status]?.label ?? row.status,
      resolutionDays: days,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      reproductionSteps: row.reproduction_steps ?? '',
      expectedResult: row.expected_result ?? '',
      actualResult: row.actual_result ?? '',
      adminRemark: row.admin_remark ?? '',
      resolutionSummary: row.resolution_summary ?? '',
    };
  });
  return rows;
}

function filterSummary(query) {
  const parts = [];
  if (query.status) parts.push(`Status: ${String(query.status).split(',').map((s) => STATUS_META[s]?.label || s).join(', ')}`);
  if (query.priority) parts.push(`Priority: ${String(query.priority).split(',').map((p) => PRIORITY_META[p]?.label || p).join(', ')}`);
  if (query.search) parts.push(`Search: "${query.search}"`);
  if (query.category) parts.push(`Category: ${query.category}`);
  if (query.module) parts.push(`Module: ${query.module}`);
  if (query.dateFrom || query.dateTo) parts.push(`Dates: ${query.dateFrom || 'start'} → ${query.dateTo || 'today'}`);
  return parts.length ? parts.join(' · ') : 'All accessible records';
}

router.get('/export', requireAuth, requireAdmin, (req, res) => {
  const format = String(req.query.format || 'csv').toLowerCase();
  if (!['csv', 'xlsx', 'pdf'].includes(format)) {
    return res.status(400).json({ error: 'Unsupported export format.', code: 'VALIDATION' });
  }

  const rows = exportRows(req);
  const stamp = new Date().toISOString().slice(0, 10);
  const filenameBase = `error-report-${stamp}`;
  const summary = filterSummary(req.query);

  writeAudit({
    actorId: req.user.id,
    actorName: req.user.full_name,
    action: 'report.exported',
    entityType: 'report',
    metadata: { format, rows: rows.length, filters: req.query },
  });

  if (format === 'csv') {
    const columns = EXPORT_COLUMNS;
    const escape = (value) => {
      const str = value === null || value === undefined ? '' : String(value);
      return /[",\n\r]/.test(str) ? `"${str.replace(/"/g, '""')}"` : str;
    };
    const lines = [
      [`Error Noting & Tracking System — report generated ${new Date().toISOString()}`],
      [`Filters: ${summary}`],
      [`Records: ${rows.length}`],
      [],
      columns.map((c) => c.label),
      ...rows.map((row) => columns.map((c) => escape(row[c.key]))),
    ];
    const csv = `\uFEFF${lines.map((line) => line.join(',')).join('\r\n')}`;
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filenameBase}.csv"`);
    return res.send(csv);
  }

  if (format === 'xlsx') {
    const header = EXPORT_COLUMNS.map((c) => c.label);
    const data = rows.map((row) => EXPORT_COLUMNS.map((c) => row[c.key]));
    const meta = [
      ['Error Noting & Tracking System'],
      ['Generated', new Date().toISOString()],
      ['Filters', summary],
      ['Records', rows.length],
      [],
    ];
    const buffer = buildXlsx([...meta, header, ...data], { sheetName: 'Errors' });
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${filenameBase}.xlsx"`);
    return res.send(buffer);
  }

  // PDF
  const doc = new PDFDocument({ size: 'A4', layout: 'landscape', margin: 32, bufferPages: true });
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="${filenameBase}.pdf"`);
  doc.pipe(res);

  const pdfColumns = EXPORT_COLUMNS.filter((c) => c.pdf > 0);
  const pageWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right;

  const drawHeader = () => {
    doc.font('Helvetica-Bold').fontSize(15).fillColor('#1e1b4b').text('Error Noting & Tracking System', { continued: false });
    doc.font('Helvetica').fontSize(8.5).fillColor('#4b5563');
    doc.text(`Generated ${new Date().toLocaleString('en-GB')} · ${rows.length} record(s) · ${summary}`);
    doc.moveDown(0.6);

    let x = doc.page.margins.left;
    const y = doc.y;
    doc.rect(x, y - 4, pageWidth, 18).fill('#312e81');
    doc.font('Helvetica-Bold').fontSize(7.5).fillColor('#ffffff');
    for (const col of pdfColumns) {
      doc.text(col.label, x + 3, y, { width: col.pdf - 6, ellipsis: true, lineBreak: false });
      x += col.pdf;
    }
    doc.fillColor('#111827');
    doc.y = y + 18;
    doc.font('Helvetica').fontSize(7.5);
  };

  drawHeader();

  rows.forEach((row, index) => {
    if (doc.y > doc.page.height - doc.page.margins.bottom - 30) {
      doc.addPage();
      drawHeader();
    }
    let x = doc.page.margins.left;
    const y = doc.y;
    if (index % 2 === 1) doc.rect(x, y - 2, pageWidth, 14).fill('#f3f4f6');
    doc.fillColor('#111827');
    for (const col of pdfColumns) {
      const value = row[col.key] === null || row[col.key] === undefined ? '' : String(row[col.key]);
      doc.text(value, x + 3, y, { width: col.pdf - 6, ellipsis: true, lineBreak: false });
      x += col.pdf;
    }
    doc.y = y + 14;
  });

  const range = doc.bufferedPageRange();
  for (let i = 0; i < range.count; i += 1) {
    doc.switchToPage(i);
    doc.font('Helvetica').fontSize(7).fillColor('#6b7280').text(
      `Page ${i + 1} of ${range.count} · confidential — internal use only`,
      doc.page.margins.left,
      doc.page.height - 22,
      { lineBreak: false },
    );
  }
  doc.end();
});

export default router;
