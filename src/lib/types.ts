export type Role = 'admin' | 'member';
export type AccountStatus = 'active' | 'inactive';
export type Status =
  | 'submitted'
  | 'under_review'
  | 'assigned'
  | 'in_progress'
  | 'on_hold'
  | 'resolved'
  | 'rejected'
  | 'reopened'
  | 'closed';
export type Priority = 'critical' | 'high' | 'medium' | 'low';
export type CommentVisibility = 'public' | 'admin';

export interface User {
  id: string;
  fullName: string;
  email: string;
  role: Role;
  accountStatus: AccountStatus;
  jobTitle: string | null;
  department: string | null;
  avatarTone: string;
  lastLoginAt: string | null;
  createdAt: string;
}

export interface DirectoryUser {
  id: string;
  fullName: string;
  email: string;
  role: Role;
  avatarTone: string;
}

export interface Application {
  id: string;
  name: string;
  description: string | null;
  color: string;
  isActive: boolean;
  errorCount: number;
  openCount: number;
  createdAt?: string;
}

export interface ErrorItem {
  id: string;
  errorCode: string;
  title: string;
  application: { id: string; name: string; color: string } | null;
  module: string;
  category: string;
  priority: Priority;
  status: Status;
  submittedBy: { id: string; fullName: string; avatarTone: string } | null;
  assignedTo: { id: string; fullName: string; avatarTone: string } | null;
  description: string;
  reproductionSteps: string | null;
  expectedResult: string | null;
  actualResult: string | null;
  adminRemark: string | null;
  resolutionSummary: string | null;
  rootCause: string | null;
  isArchived: boolean;
  createdAt: string;
  updatedAt: string;
  resolvedAt: string | null;
  closedAt: string | null;
  commentCount?: number;
  attachmentCount?: number;
}

export interface Attachment {
  id: string;
  originalFilename: string;
  mimeType: string;
  sizeBytes: number;
  uploadedBy: string;
  createdAt: string;
  url: string;
}

export interface ErrorComment {
  id: string;
  text: string;
  visibility: CommentVisibility;
  author: { id: string; fullName: string; role: Role; avatarTone: string };
  createdAt: string;
}

export interface HistoryEntry {
  id: string;
  oldStatus: Status | null;
  newStatus: Status;
  reason: string | null;
  actor: { id: string; fullName: string; role: Role };
  changedAt: string;
}

export interface Transition {
  value: Status;
  label: string;
  tone: string;
  description: string;
  reasonRequired: boolean;
}

export interface ErrorDetail {
  error: ErrorItem;
  attachments: Attachment[];
  comments: ErrorComment[];
  history: HistoryEntry[];
  permissions: {
    canChangeStatus: boolean;
    canAssign: boolean;
    canComment: boolean;
    canEditCore: boolean;
    canEditAdminFields: boolean;
    canUpload: boolean;
    canArchive: boolean;
    canViewAdminNotes: boolean;
  };
  availableTransitions: Transition[];
}

export interface Pagination {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

export interface NotificationItem {
  id: string;
  type: string;
  title: string;
  message: string | null;
  isRead: boolean;
  errorId: string | null;
  errorCode: string | null;
  createdAt: string;
  readAt: string | null;
}

export interface StatusMeta {
  value: Status;
  label: string;
  tone: string;
  description: string;
}

export interface PriorityMeta {
  value: Priority;
  label: string;
  tone: string;
  weight: number;
}

export interface Meta {
  statuses: StatusMeta[];
  priorities: PriorityMeta[];
  categories: string[];
  modules: string[];
  limits: {
    maxAttachmentMb: number;
    maxAttachmentsPerUpload: number;
    maxAttachmentsPerError: number;
    allowedMimeTypes: string[];
  };
  settings: Record<string, string>;
  visibility: string;
}

export interface DashboardCards {
  total: number;
  open: number;
  submitted: number;
  underReview: number;
  assigned: number;
  inProgress: number;
  onHold: number;
  resolved: number;
  rejected: number;
  reopened: number;
  closed: number;
  unassignedOpen: number;
  criticalOpen: number;
  avgResolutionDays: number | null;
  resolvedThisMonth: number;
  submittedThisWeek: number;
  resolutionRate: number;
  myAssignments?: number;
  myResolved?: number;
}

export interface PendingAction {
  key: string;
  label: string;
  count: number;
  href: string;
  tone: string;
}

export interface WorkloadRow {
  id: string;
  fullName: string;
  role: Role;
  avatarTone: string;
  open: number;
  completed: number;
}

export interface DashboardData {
  scope: 'admin' | 'member';
  visibility: string;
  generatedAt: string;
  cards: DashboardCards;
  statusBreakdown: { value: Status; label: string; tone: string; count: number }[];
  priorityBreakdown: { value: Priority; label: string; tone: string; count: number }[];
  applicationBreakdown: { id: string; name: string; color: string; count: number; open: number }[];
  moduleBreakdown: { module: string; count: number }[];
  categoryBreakdown: { category: string; count: number }[];
  trend: { month: string; label: string; submitted: number; resolved: number }[];
  recent: ErrorItem[];
  pendingActions: PendingAction[];
  workload: WorkloadRow[];
  users: null | {
    active: number;
    inactive: number;
    admins: number;
    pendingRequests: number;
    pendingInvites: number;
  };
  unreadNotifications: number;
}

export interface AnalyticsRow {
  key: string;
  label: string;
  total: number;
  open: number;
  completed: number;
  rejected: number;
  avgResolutionDays: number | null;
  completionRate: number;
}

export interface AnalyticsData {
  groupBy: string;
  rows: AnalyticsRow[];
  trend: { month: string; label: string; submitted: number; resolved: number }[];
  topSubmitters: { id: string; fullName: string; avatarTone: string; total: number; resolved: number }[];
  priorityMatrix: { priority: Priority; status: Status; count: number }[];
}

export interface UserRow extends User {
  submittedCount: number;
  assignedOpen: number;
  resolvedCount: number;
}

export interface UserSummary {
  total: number;
  admins: number;
  members: number;
  active: number;
  inactive: number;
  pendingRequests: number;
  pendingInvites: number;
}

export interface UserDetail {
  user: User;
  counts: { submitted: number; assigned: number; resolved: number; comments: number };
  activity: { id: string; action: string; entityType: string; entityId: string | null; metadata: Record<string, unknown> | null; createdAt: string }[];
  recentErrors: { id: string; errorCode: string; title: string; status: Status; priority: Priority; application: string; createdAt: string }[];
}

export interface Invitation {
  id: string;
  email: string;
  fullName: string;
  role: Role;
  status: 'pending' | 'accepted' | 'revoked' | 'expired';
  invitedBy: string | null;
  createdAt: string;
  expiresAt: string;
  acceptedAt: string | null;
  inviteUrl: string;
}

export interface AccessRequest {
  id: string;
  fullName: string;
  email: string;
  requestReason: string | null;
  requestStatus: 'pending' | 'approved' | 'rejected';
  reviewedBy: string | null;
  reviewedAt: string | null;
  reviewNote: string | null;
  createdAt: string;
}

export interface AuditLogItem {
  id: string;
  action: string;
  actionLabel: string;
  actorId: string | null;
  actorName: string;
  entityType: string;
  entityId: string | null;
  errorCode: string | null;
  metadata: Record<string, unknown> | null;
  createdAt: string;
}
