/**
 * Domain configuration for the Error Noting & Tracking System.
 * Single source of truth for statuses, transitions, priorities and categories.
 * The server validates every transition against this file — the UI only mirrors it.
 */

export const ROLES = ['admin', 'member'];
export const ACCOUNT_STATUSES = ['active', 'inactive'];

export const STATUSES = [
  'submitted',
  'under_review',
  'assigned',
  'in_progress',
  'on_hold',
  'resolved',
  'rejected',
  'reopened',
  'closed',
];

export const STATUS_META = {
  submitted: { label: 'Submitted', tone: 'sky', description: 'Newly created; awaiting Admin review.' },
  under_review: { label: 'Under Review', tone: 'violet', description: 'Admin is reviewing the report or requesting clarification.' },
  assigned: { label: 'Assigned', tone: 'indigo', description: 'A responsible owner has been selected.' },
  in_progress: { label: 'In Progress', tone: 'amber', description: 'Investigation or corrective work is underway.' },
  on_hold: { label: 'On Hold', tone: 'slate', description: 'Work is paused pending a dependency or further information.' },
  resolved: { label: 'Resolved', tone: 'emerald', description: 'A solution or workaround has been recorded; awaiting confirmation.' },
  rejected: { label: 'Rejected', tone: 'rose', description: 'Invalid, duplicate, out of scope or not actionable.' },
  reopened: { label: 'Reopened', tone: 'orange', description: 'Previously resolved/closed issue requires further work.' },
  closed: { label: 'Closed', tone: 'neutral', description: 'Admin has completed the workflow and confirmed closure.' },
};

/** Statuses in which the workflow is still live (used for "open" counters). */
export const OPEN_STATUSES = ['submitted', 'under_review', 'assigned', 'in_progress', 'on_hold', 'reopened'];

/**
 * Server-enforced lifecycle. Any status not listed as a target is rejected
 * with HTTP 422 even if the caller is an Admin.
 */
export const STATUS_TRANSITIONS = {
  submitted: ['under_review', 'assigned', 'on_hold', 'rejected'],
  under_review: ['assigned', 'in_progress', 'on_hold', 'resolved', 'rejected'],
  assigned: ['in_progress', 'on_hold', 'resolved', 'rejected', 'under_review'],
  in_progress: ['on_hold', 'resolved', 'rejected', 'assigned'],
  on_hold: ['in_progress', 'assigned', 'resolved', 'rejected'],
  resolved: ['closed', 'reopened'],
  rejected: ['reopened'],
  reopened: ['under_review', 'assigned', 'in_progress', 'on_hold', 'resolved', 'rejected'],
  closed: ['reopened'],
};

/** Transitions that require a written reason (audit + notification copy). */
export const REASON_REQUIRED = ['rejected', 'reopened', 'on_hold', 'closed'];

export const PRIORITIES = ['critical', 'high', 'medium', 'low'];
export const PRIORITY_META = {
  critical: { label: 'Critical', tone: 'rose', weight: 1 },
  high: { label: 'High', tone: 'orange', weight: 2 },
  medium: { label: 'Medium', tone: 'amber', weight: 3 },
  low: { label: 'Low', tone: 'slate', weight: 4 },
};

export const CATEGORIES = ['Functional', 'UI', 'Data', 'Integration', 'Performance', 'Security', 'Other'];

export const DEFAULT_MODULES = [
  'Authentication',
  'Dashboard',
  'Reports',
  'Material Creation',
  'Purchase Orders',
  'User Management',
  'Notifications',
  'Integrations',
  'Billing',
];

export const COMMENT_VISIBILITY = ['public', 'admin'];

export const NOTIFICATION_TYPES = [
  'error_submitted',
  'status_changed',
  'assigned',
  'comment_added',
  'admin_remark',
  'access_requested',
  'access_approved',
  'account_created',
];

export const LIMITS = {
  maxAttachmentBytes: 5 * 1024 * 1024,
  maxAttachmentsPerUpload: 5,
  maxAttachmentsPerError: 10,
  allowedMimeTypes: [
    'image/png',
    'image/jpeg',
    'image/gif',
    'image/webp',
    'image/svg+xml',
    'application/pdf',
    'text/plain',
    'text/csv',
    'application/json',
    'application/zip',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  ],
};

export const DEFAULT_SETTINGS = {
  team_visibility: 'own_or_assigned', // 'own_or_assigned' | 'team_wide'
  allow_member_submissions: 'true',
  require_reason_for_closure: 'true',
  max_upload_mb: '5',
};

export function isValidTransition(from, to) {
  return Boolean(STATUS_TRANSITIONS[from]?.includes(to));
}

export function nextStatuses(from) {
  return STATUS_TRANSITIONS[from] ?? [];
}
