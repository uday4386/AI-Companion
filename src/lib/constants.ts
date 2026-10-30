import type { Priority, Role, Status } from './types';

export interface ToneClasses {
  badge: string;
  dot: string;
  text: string;
  softBg: string;
  border: string;
  hex: string;
}

const TONES: Record<string, ToneClasses> = {
  sky: {
    badge: 'bg-sky-50 text-sky-700 ring-sky-600/20 dark:bg-sky-500/10 dark:text-sky-300 dark:ring-sky-400/25',
    dot: 'bg-sky-500',
    text: 'text-sky-600 dark:text-sky-400',
    softBg: 'bg-sky-500/10',
    border: 'border-sky-500/30',
    hex: '#0ea5e9',
  },
  violet: {
    badge: 'bg-violet-50 text-violet-700 ring-violet-600/20 dark:bg-violet-500/10 dark:text-violet-300 dark:ring-violet-400/25',
    dot: 'bg-violet-500',
    text: 'text-violet-600 dark:text-violet-400',
    softBg: 'bg-violet-500/10',
    border: 'border-violet-500/30',
    hex: '#8b5cf6',
  },
  indigo: {
    badge: 'bg-indigo-50 text-indigo-700 ring-indigo-600/20 dark:bg-indigo-500/10 dark:text-indigo-300 dark:ring-indigo-400/25',
    dot: 'bg-indigo-500',
    text: 'text-indigo-600 dark:text-indigo-400',
    softBg: 'bg-indigo-500/10',
    border: 'border-indigo-500/30',
    hex: '#6366f1',
  },
  amber: {
    badge: 'bg-amber-50 text-amber-700 ring-amber-600/20 dark:bg-amber-500/10 dark:text-amber-300 dark:ring-amber-400/25',
    dot: 'bg-amber-500',
    text: 'text-amber-600 dark:text-amber-400',
    softBg: 'bg-amber-500/10',
    border: 'border-amber-500/30',
    hex: '#f59e0b',
  },
  slate: {
    badge: 'bg-slate-100 text-slate-600 ring-slate-500/20 dark:bg-slate-500/10 dark:text-slate-300 dark:ring-slate-400/20',
    dot: 'bg-slate-400',
    text: 'text-slate-600 dark:text-slate-300',
    softBg: 'bg-slate-500/10',
    border: 'border-slate-400/30',
    hex: '#64748b',
  },
  emerald: {
    badge: 'bg-emerald-50 text-emerald-700 ring-emerald-600/20 dark:bg-emerald-500/10 dark:text-emerald-300 dark:ring-emerald-400/25',
    dot: 'bg-emerald-500',
    text: 'text-emerald-600 dark:text-emerald-400',
    softBg: 'bg-emerald-500/10',
    border: 'border-emerald-500/30',
    hex: '#10b981',
  },
  rose: {
    badge: 'bg-rose-50 text-rose-700 ring-rose-600/20 dark:bg-rose-500/10 dark:text-rose-300 dark:ring-rose-400/25',
    dot: 'bg-rose-500',
    text: 'text-rose-600 dark:text-rose-400',
    softBg: 'bg-rose-500/10',
    border: 'border-rose-500/30',
    hex: '#f43f5e',
  },
  orange: {
    badge: 'bg-orange-50 text-orange-700 ring-orange-600/20 dark:bg-orange-500/10 dark:text-orange-300 dark:ring-orange-400/25',
    dot: 'bg-orange-500',
    text: 'text-orange-600 dark:text-orange-400',
    softBg: 'bg-orange-500/10',
    border: 'border-orange-500/30',
    hex: '#f97316',
  },
  neutral: {
    badge: 'bg-slate-100 text-slate-700 ring-slate-500/20 dark:bg-white/[0.06] dark:text-slate-300 dark:ring-white/10',
    dot: 'bg-slate-500',
    text: 'text-slate-600 dark:text-slate-300',
    softBg: 'bg-slate-500/10',
    border: 'border-slate-500/30',
    hex: '#475569',
  },
  teal: {
    badge: 'bg-teal-50 text-teal-700 ring-teal-600/20 dark:bg-teal-500/10 dark:text-teal-300 dark:ring-teal-400/25',
    dot: 'bg-teal-500',
    text: 'text-teal-600 dark:text-teal-400',
    softBg: 'bg-teal-500/10',
    border: 'border-teal-500/30',
    hex: '#14b8a6',
  },
};

export function tone(name: string | undefined | null): ToneClasses {
  return TONES[name ?? 'slate'] ?? TONES.slate;
}

export const STATUS_TONE: Record<Status, string> = {
  submitted: 'sky',
  under_review: 'violet',
  assigned: 'indigo',
  in_progress: 'amber',
  on_hold: 'slate',
  resolved: 'emerald',
  rejected: 'rose',
  reopened: 'orange',
  closed: 'neutral',
};

export const STATUS_LABEL: Record<Status, string> = {
  submitted: 'Submitted',
  under_review: 'Under Review',
  assigned: 'Assigned',
  in_progress: 'In Progress',
  on_hold: 'On Hold',
  resolved: 'Resolved',
  rejected: 'Rejected',
  reopened: 'Reopened',
  closed: 'Closed',
};

export const STATUS_ORDER: Status[] = [
  'submitted',
  'under_review',
  'assigned',
  'in_progress',
  'on_hold',
  'resolved',
  'reopened',
  'rejected',
  'closed',
];

export const PRIORITY_TONE: Record<Priority, string> = {
  critical: 'rose',
  high: 'orange',
  medium: 'amber',
  low: 'slate',
};

export const PRIORITY_LABEL: Record<Priority, string> = {
  critical: 'Critical',
  high: 'High',
  medium: 'Medium',
  low: 'Low',
};

export const PRIORITY_ORDER: Priority[] = ['critical', 'high', 'medium', 'low'];

export const APP_TONE_HEX: Record<string, string> = {
  indigo: '#6366f1',
  sky: '#0ea5e9',
  emerald: '#10b981',
  amber: '#f59e0b',
  violet: '#8b5cf6',
  rose: '#f43f5e',
  teal: '#14b8a6',
  orange: '#f97316',
  slate: '#64748b',
};

export const ROLE_LABEL: Record<Role, string> = { admin: 'Admin', member: 'Team Member' };

export const AVATAR_TONES: Record<string, string> = {
  indigo: 'bg-indigo-500/15 text-indigo-700 ring-indigo-500/25 dark:text-indigo-300',
  sky: 'bg-sky-500/15 text-sky-700 ring-sky-500/25 dark:text-sky-300',
  rose: 'bg-rose-500/15 text-rose-700 ring-rose-500/25 dark:text-rose-300',
  amber: 'bg-amber-500/15 text-amber-700 ring-amber-500/25 dark:text-amber-300',
  emerald: 'bg-emerald-500/15 text-emerald-700 ring-emerald-500/25 dark:text-emerald-300',
  violet: 'bg-violet-500/15 text-violet-700 ring-violet-500/25 dark:text-violet-300',
  orange: 'bg-orange-500/15 text-orange-700 ring-orange-500/25 dark:text-orange-300',
  teal: 'bg-teal-500/15 text-teal-700 ring-teal-500/25 dark:text-teal-300',
  slate: 'bg-slate-500/15 text-slate-700 ring-slate-500/25 dark:text-slate-300',
};

export const APPLICATION_COLORS = ['indigo', 'sky', 'emerald', 'amber', 'violet', 'rose', 'teal', 'orange'];

export const OPEN_STATUSES: Status[] = ['submitted', 'under_review', 'assigned', 'in_progress', 'on_hold', 'reopened'];

export const CATEGORIES = ['Functional', 'UI', 'Data', 'Integration', 'Performance', 'Security', 'Other'];
