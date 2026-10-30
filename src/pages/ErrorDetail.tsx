import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  AlertCircle,
  ArrowRight,
  Archive,
  CalendarClock,
  CheckCircle2,
  ChevronRight,
  ClipboardCheck,
  Clock,
  Copy,
  FileWarning,
  History,
  Info,
  Layers,
  Lock,
  MessageSquare,
  Paperclip,
  Pencil,
  Send,
  ShieldCheck,
  Sparkles,
  Trash2,
  Upload,
  UserRound,
  X,
} from 'lucide-react';
import clsx from 'clsx';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/contexts/ToastContext';
import { useFetch } from '@/hooks/useFetch';
import { api, ApiError } from '@/lib/api';
import type { Attachment, DirectoryUser, ErrorDetail as ErrorDetailType, Transition } from '@/lib/types';
import { CATEGORIES, PRIORITY_LABEL, PRIORITY_ORDER, ROLE_LABEL, STATUS_LABEL, tone } from '@/lib/constants';
import { formatBytes, formatDate, formatDateTime, relativeTime } from '@/lib/format';
import { PageHeader } from '@/components/layout/Topbar';
import { Card, CardBody, CardHeader } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Field, Input, Select, Textarea } from '@/components/ui/Field';
import { Modal, ConfirmDialog } from '@/components/ui/Modal';
import { Avatar } from '@/components/ui/Avatar';
import { Badge } from '@/components/ui/Badge';
import { StatusBadge, PriorityBadge, ApplicationTag } from '@/components/StatusBadge';
import { EmptyState } from '@/components/ui/EmptyState';
import { PageLoader, Spinner } from '@/components/ui/Spinner';
import { AttachmentCard } from '@/components/AttachmentCard';

function Section({
  title,
  icon: Icon,
  children,
  action,
}: {
  title: string;
  icon?: React.ComponentType<{ className?: string }>;
  children: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <Card>
      <CardHeader title={title} icon={Icon} action={action} />
      <CardBody>{children}</CardBody>
    </Card>
  );
}

function MetaRow({ label, value, icon: Icon }: { label: string; value: React.ReactNode; icon?: React.ComponentType<{ className?: string }> }) {
  return (
    <div className="flex items-start justify-between gap-3 py-1.5">
      <span className="flex items-center gap-1.5 text-[11.5px] text-slate-500 dark:text-slate-400">
        {Icon ? <Icon className="h-3.5 w-3.5" /> : null}
        {label}
      </span>
      <span className="text-right text-[12px] font-medium text-slate-700 dark:text-slate-200">{value}</span>
    </div>
  );
}

export default function ErrorDetailPage() {
  const { id = '' } = useParams();
  const { user, meta } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const { data, loading, error, refetch } = useFetch<ErrorDetailType>(`/api/errors/${id}`, [id]);

  const [directory, setDirectory] = useState<DirectoryUser[]>([]);
  const [transition, setTransition] = useState<Transition | null>(null);
  const [transitionReason, setTransitionReason] = useState('');
  const [resolution, setResolution] = useState('');
  const [rootCause, setRootCause] = useState('');
  const [transitionError, setTransitionError] = useState<string | null>(null);
  const [transitionBusy, setTransitionBusy] = useState(false);

  const [assignOpen, setAssignOpen] = useState(false);
  const [assigneeId, setAssigneeId] = useState('');
  const [assignBusy, setAssignBusy] = useState(false);

  const [editOpen, setEditOpen] = useState(false);
  const [editForm, setEditForm] = useState<Record<string, string>>({});
  const [editBusy, setEditBusy] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);

  const [notesOpen, setNotesOpen] = useState(false);
  const [notesForm, setNotesForm] = useState({ adminRemark: '', resolutionSummary: '', rootCause: '' });
  const [notesBusy, setNotesBusy] = useState(false);

  const [comment, setComment] = useState('');
  const [internal, setInternal] = useState(false);
  const [commentBusy, setCommentBusy] = useState(false);

  const [uploading, setUploading] = useState(false);
  const [deleteAttachment, setDeleteAttachment] = useState<Attachment | null>(null);
  const [preview, setPreview] = useState<{ attachment: Attachment; url: string } | null>(null);
  const [archiveOpen, setArchiveOpen] = useState(false);
  const [archiveBusy, setArchiveBusy] = useState(false);

  const fileRef = useRef<HTMLInputElement>(null);
  const isAdmin = user?.role === 'admin';
  const detail = data;

  useEffect(() => {
    if (!detail?.permissions.canAssign) return;
    void api
      .get<{ users: DirectoryUser[] }>('/api/directory')
      .then((data) => setDirectory(data.users))
      .catch(() => undefined);
  }, [detail?.permissions.canAssign]);

  const resolutionDays = useMemo(() => {
    if (!detail?.error.resolvedAt) return null;
    return Math.max(0, Math.round((new Date(detail.error.resolvedAt).getTime() - new Date(detail.error.createdAt).getTime()) / 86_400_000));
  }, [detail]);

  if (loading && !detail) {
    return <PageLoader label="Loading report…" />;
  }

  if (error || !detail) {
    return (
      <Card>
        <EmptyState
          icon={FileWarning}
          title="Report not available"
          description={error ?? 'This record does not exist, or you do not have access to it.'}
          action={
            <Link to="/errors">
              <Button variant="secondary">Back to the queue</Button>
            </Link>
          }
        />
      </Card>
    );
  }

  const { error: report, permissions, availableTransitions, comments, attachments, history } = detail;

  const openTransition = (item: Transition) => {
    setTransition(item);
    setTransitionReason('');
    setResolution(report.resolutionSummary ?? '');
    setRootCause(report.rootCause ?? '');
    setTransitionError(null);
  };

  const submitTransition = async () => {
    if (!transition) return;
    setTransitionBusy(true);
    setTransitionError(null);
    try {
      await api.post(`/api/errors/${report.id}/status`, {
        status: transition.value,
        reason: transitionReason,
        ...(transition.value === 'resolved' || transition.value === 'closed' ? { resolutionSummary: resolution, rootCause } : {}),
      });
      toast.success(`Moved to ${STATUS_LABEL[transition.value]}`, `${report.errorCode} was updated and the submitter was notified.`);
      setTransition(null);
      refetch();
    } catch (err) {
      if (err instanceof ApiError) {
        setTransitionError(err.message);
        if (err.fields?.reason) setTransitionError('A reason is required for this transition.');
      } else setTransitionError('Could not update the status.');
    } finally {
      setTransitionBusy(false);
    }
  };

  const submitAssignment = async () => {
    setAssignBusy(true);
    try {
      await api.patch(`/api/errors/${report.id}/assign`, { assigneeId: assigneeId || null });
      toast.success(assigneeId ? 'Report assigned' : 'Assignment removed', assigneeId ? 'The assignee has been notified.' : undefined);
      setAssignOpen(false);
      refetch();
    } catch (err) {
      toast.error('Could not assign', err instanceof ApiError ? err.message : undefined);
    } finally {
      setAssignBusy(false);
    }
  };

  const openEdit = () => {
    setEditForm({
      title: report.title,
      applicationId: report.application?.id ?? '',
      module: report.module,
      category: report.category,
      priority: report.priority,
      description: report.description,
      reproductionSteps: report.reproductionSteps ?? '',
      expectedResult: report.expectedResult ?? '',
      actualResult: report.actualResult ?? '',
    });
    setEditError(null);
    setEditOpen(true);
  };

  const submitEdit = async () => {
    setEditBusy(true);
    setEditError(null);
    try {
      await api.patch(`/api/errors/${report.id}`, editForm);
      toast.success('Report updated');
      setEditOpen(false);
      refetch();
    } catch (err) {
      setEditError(err instanceof ApiError ? err.message : 'Could not save changes.');
    } finally {
      setEditBusy(false);
    }
  };

  const openNotes = () => {
    setNotesForm({
      adminRemark: report.adminRemark ?? '',
      resolutionSummary: report.resolutionSummary ?? '',
      rootCause: report.rootCause ?? '',
    });
    setNotesOpen(true);
  };

  const submitNotes = async () => {
    setNotesBusy(true);
    try {
      await api.patch(`/api/errors/${report.id}`, notesForm);
      toast.success('Admin notes saved');
      setNotesOpen(false);
      refetch();
    } catch (err) {
      toast.error('Could not save notes', err instanceof ApiError ? err.message : undefined);
    } finally {
      setNotesBusy(false);
    }
  };

  const submitComment = async (event: React.FormEvent) => {
    event.preventDefault();
    if (comment.trim().length < 2) return;
    setCommentBusy(true);
    try {
      await api.post(`/api/errors/${report.id}/comments`, { text: comment, visibility: internal ? 'admin' : 'public' });
      setComment('');
      setInternal(false);
      refetch();
    } catch (err) {
      toast.error('Comment not posted', err instanceof ApiError ? err.message : undefined);
    } finally {
      setCommentBusy(false);
    }
  };

  const removeComment = async (commentId: string) => {
    try {
      await api.delete(`/api/errors/${report.id}/comments/${commentId}`);
      refetch();
    } catch (err) {
      toast.error('Could not delete comment', err instanceof ApiError ? err.message : undefined);
    }
  };

  const uploadFiles = async (files: FileList) => {
    setUploading(true);
    try {
      const form = new FormData();
      Array.from(files).forEach((file) => form.append('files', file));
      await api.upload(`/api/errors/${report.id}/attachments`, form);
      toast.success('Evidence uploaded');
      refetch();
    } catch (err) {
      toast.error('Upload failed', err instanceof ApiError ? err.message : undefined);
    } finally {
      setUploading(false);
    }
  };

  const confirmDeleteAttachment = async () => {
    if (!deleteAttachment) return;
    try {
      await api.delete(`/api/errors/${report.id}/attachments/${deleteAttachment.id}`);
      toast.success('Attachment removed');
      setDeleteAttachment(null);
      refetch();
    } catch (err) {
      toast.error('Could not remove attachment', err instanceof ApiError ? err.message : undefined);
    }
  };

  const toggleArchive = async () => {
    setArchiveBusy(true);
    try {
      await api.post(`/api/errors/${report.id}/archive`, { archived: !report.isArchived });
      toast.success(report.isArchived ? 'Report restored' : 'Report archived');
      setArchiveOpen(false);
      refetch();
    } catch (err) {
      toast.error('Could not archive', err instanceof ApiError ? err.message : undefined);
    } finally {
      setArchiveBusy(false);
    }
  };

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(`${window.location.origin}/errors/${report.id}`);
      toast.success('Link copied to clipboard');
    } catch {
      toast.error('Could not copy the link');
    }
  };

  return (
    <div className="animate-fade-in">
      <PageHeader
        breadcrumb={[{ label: 'Workspace' }, { label: 'Errors', to: '/errors' }, { label: report.errorCode }]}
        title={
          <span className="flex flex-wrap items-center gap-2.5">
            <span className="font-mono text-[13px] font-semibold text-brand-600 dark:text-brand-300">{report.errorCode}</span>
            <span className="text-slate-300 dark:text-slate-600">/</span>
            <span className="max-w-3xl text-balance">{report.title}</span>
          </span>
        }
        description={
          <span className="flex flex-wrap items-center gap-2">
            <StatusBadge status={report.status} />
            <PriorityBadge priority={report.priority} />
            <ApplicationTag application={report.application} />
            <span className="text-slate-300 dark:text-slate-600">·</span>
            <span>{report.module}</span>
            <span className="text-slate-300 dark:text-slate-600">·</span>
            <span>{report.category}</span>
            {report.isArchived ? <Badge color="slate">Archived</Badge> : null}
          </span>
        }
        actions={
          <>
            <Button variant="ghost" size="sm" onClick={copyLink}>
              <Copy className="h-3.5 w-3.5" /> <span className="hidden sm:inline">Copy link</span>
            </Button>
            {permissions.canEditCore ? (
              <Button variant="secondary" size="sm" onClick={openEdit}>
                <Pencil className="h-3.5 w-3.5" /> Edit details
              </Button>
            ) : null}
            {permissions.canArchive ? (
              <Button variant="secondary" size="sm" onClick={() => setArchiveOpen(true)}>
                <Archive className="h-3.5 w-3.5" /> {report.isArchived ? 'Restore' : 'Archive'}
              </Button>
            ) : null}
          </>
        }
      />

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_360px]">
        <div className="space-y-4">
          <Card>
            <CardHeader
              icon={FileWarning}
              title="Report"
              description={`Submitted by ${report.submittedBy?.fullName ?? 'unknown'} · ${formatDateTime(report.createdAt)}`}
              action={
                <div className="flex items-center gap-2">
                  {report.submittedBy ? <Avatar name={report.submittedBy.fullName} tone={report.submittedBy.avatarTone} size="sm" /> : null}
                </div>
              }
            />
            <CardBody className="space-y-5">
              <div>
                <p className="text-[10.5px] font-semibold uppercase tracking-[0.1em] text-slate-400">Description</p>
                <p className="mt-1.5 whitespace-pre-wrap text-[13.5px] leading-relaxed text-slate-700 dark:text-slate-300">{report.description}</p>
              </div>

              {report.reproductionSteps ? (
                <div>
                  <p className="text-[10.5px] font-semibold uppercase tracking-[0.1em] text-slate-400">Steps to reproduce</p>
                  <ol className="mt-2 space-y-1.5">
                    {report.reproductionSteps.split(/\r?\n/).filter(Boolean).map((step, index) => (
                      <li key={index} className="flex gap-2.5 text-[13px] leading-relaxed text-slate-700 dark:text-slate-300">
                        <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-md bg-slate-100 text-[10.5px] font-bold text-slate-500 dark:bg-white/[0.07] dark:text-slate-400">
                          {index + 1}
                        </span>
                        <span>{step.replace(/^\s*\d+[.)]\s*/, '')}</span>
                      </li>
                    ))}
                  </ol>
                </div>
              ) : null}

              {report.expectedResult || report.actualResult ? (
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="rounded-xl border border-emerald-200/70 bg-emerald-50/50 p-3.5 dark:border-emerald-500/20 dark:bg-emerald-500/[0.06]">
                    <p className="flex items-center gap-1.5 text-[10.5px] font-semibold uppercase tracking-wide text-emerald-700 dark:text-emerald-300">
                      <CheckCircle2 className="h-3.5 w-3.5" /> Expected
                    </p>
                    <p className="mt-1.5 text-[12.5px] leading-relaxed text-emerald-900/80 dark:text-emerald-100/70">{report.expectedResult || '—'}</p>
                  </div>
                  <div className="rounded-xl border border-rose-200/70 bg-rose-50/50 p-3.5 dark:border-rose-500/20 dark:bg-rose-500/[0.06]">
                    <p className="flex items-center gap-1.5 text-[10.5px] font-semibold uppercase tracking-wide text-rose-700 dark:text-rose-300">
                      <AlertCircle className="h-3.5 w-3.5" /> Actual
                    </p>
                    <p className="mt-1.5 text-[12.5px] leading-relaxed text-rose-900/80 dark:text-rose-100/70">{report.actualResult || '—'}</p>
                  </div>
                </div>
              ) : null}

              {permissions.canEditAdminFields && report.adminRemark ? (
                <div className="rounded-xl border border-brand-200/60 bg-brand-50/40 p-3.5 dark:border-brand-500/20 dark:bg-brand-500/[0.06]">
                  <p className="flex items-center gap-1.5 text-[10.5px] font-semibold uppercase tracking-wide text-brand-700 dark:text-brand-300">
                    <ShieldCheck className="h-3.5 w-3.5" /> Admin remark (visible to the submitter)
                  </p>
                  <p className="mt-1.5 text-[12.5px] leading-relaxed text-brand-900/80 dark:text-brand-100/70">{report.adminRemark}</p>
                </div>
              ) : null}

              {report.resolutionSummary ? (
                <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-3.5 dark:border-white/10 dark:bg-white/[0.03]">
                  <p className="flex items-center gap-1.5 text-[10.5px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                    <ClipboardCheck className="h-3.5 w-3.5" /> Resolution
                  </p>
                  <p className="mt-1.5 text-[12.5px] leading-relaxed text-slate-700 dark:text-slate-300">{report.resolutionSummary}</p>
                  {report.rootCause ? (
                    <p className="mt-2 text-[11.5px] text-slate-500 dark:text-slate-400">
                      <span className="font-semibold">Root cause:</span> {report.rootCause}
                    </p>
                  ) : null}
                </div>
              ) : null}
            </CardBody>
          </Card>

          <Card>
            <CardHeader
              icon={Paperclip}
              title="Evidence"
              description={`${attachments.length} of ${meta?.limits.maxAttachmentsPerError ?? 10} files · private to authorised users`}
              action={
                permissions.canUpload ? (
                  <>
                    <input
                      ref={fileRef}
                      type="file"
                      multiple
                      className="sr-only"
                      onChange={(event) => {
                        if (event.target.files?.length) void uploadFiles(event.target.files);
                        event.target.value = '';
                      }}
                    />
                    <Button variant="secondary" size="sm" loading={uploading} onClick={() => fileRef.current?.click()}>
                      <Upload className="h-3.5 w-3.5" /> Upload
                    </Button>
                  </>
                ) : null
              }
            />
            <CardBody>
              {attachments.length ? (
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                  {attachments.map((attachment) => (
                    <AttachmentCard
                      key={attachment.id}
                      attachment={attachment}
                      canDelete={isAdmin || (permissions.canUpload && !['resolved', 'closed'].includes(report.status))}
                      onDelete={() => setDeleteAttachment(attachment)}
                      onPreview={(item, url) => setPreview({ attachment: item, url })}
                    />
                  ))}
                </div>
              ) : (
                <div className="rounded-xl border border-dashed border-slate-200 px-4 py-8 text-center dark:border-white/10">
                  <Paperclip className="mx-auto h-5 w-5 text-slate-300 dark:text-slate-600" />
                  <p className="mt-2 text-[12.5px] font-medium text-slate-600 dark:text-slate-300">No evidence attached</p>
                  <p className="mt-0.5 text-[11.5px] text-slate-400">
                    Screenshots and logs help engineers reproduce the issue faster.
                  </p>
                </div>
              )}
            </CardBody>
          </Card>

          <Card>
            <CardHeader
              icon={MessageSquare}
              title="Conversation"
              description={`${comments.length} ${comments.length === 1 ? 'message' : 'messages'} · public comments are visible to the submitter`}
            />
            <CardBody className="space-y-4">
              {comments.length ? (
                <div className="space-y-4">
                  {comments.map((item) => {
                    const isInternal = item.visibility === 'admin';
                    const canDelete = item.author.id === user?.id || isAdmin;
                    return (
                      <div key={item.id} className="group flex gap-3">
                        <Avatar name={item.author.fullName} tone={item.author.avatarTone} size="sm" />
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-1.5">
                            <span className="text-[12.5px] font-semibold text-slate-800 dark:text-slate-100">{item.author.fullName}</span>
                            <span className="rounded bg-slate-100 px-1 py-0.5 text-[9.5px] font-semibold uppercase tracking-wide text-slate-500 dark:bg-white/10 dark:text-slate-400">
                              {ROLE_LABEL[item.author.role]}
                            </span>
                            {isInternal ? (
                              <span className="inline-flex items-center gap-0.5 rounded bg-amber-100 px-1 py-0.5 text-[9.5px] font-semibold uppercase tracking-wide text-amber-700 dark:bg-amber-500/15 dark:text-amber-300">
                                <Lock className="h-2.5 w-2.5" /> internal
                              </span>
                            ) : null}
                            <span className="text-[10.5px] text-slate-400">{relativeTime(item.createdAt)}</span>
                            {canDelete ? (
                              <button
                                type="button"
                                onClick={() => void removeComment(item.id)}
                                className="ml-auto rounded p-1 text-slate-300 opacity-0 transition hover:bg-rose-50 hover:text-rose-500 group-hover:opacity-100 dark:hover:bg-rose-500/10"
                                aria-label="Delete comment"
                              >
                                <Trash2 className="h-3 w-3" />
                              </button>
                            ) : null}
                          </div>
                          <div
                            className={clsx(
                              'mt-1.5 rounded-xl border px-3.5 py-2.5 text-[12.5px] leading-relaxed',
                              isInternal
                                ? 'border-amber-200/70 bg-amber-50/60 text-amber-900 dark:border-amber-500/20 dark:bg-amber-500/[0.08] dark:text-amber-100/80'
                                : 'border-slate-200 bg-slate-50/60 text-slate-700 dark:border-white/10 dark:bg-white/[0.03] dark:text-slate-300',
                            )}
                          >
                            <p className="whitespace-pre-wrap">{item.text}</p>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="flex flex-col items-center py-6 text-center">
                  <MessageSquare className="h-5 w-5 text-slate-300 dark:text-slate-600" />
                  <p className="mt-2 text-[12.5px] font-medium text-slate-600 dark:text-slate-300">Start the conversation</p>
                  <p className="mt-0.5 text-[11.5px] text-slate-400">Ask a clarifying question or add reproduction detail.</p>
                </div>
              )}

              {permissions.canComment ? (
                <form onSubmit={submitComment} className="border-t border-slate-100 pt-4 dark:border-white/[0.06]">
                  <div className="flex items-start gap-2.5">
                    <Avatar name={user?.fullName} tone={user?.avatarTone} size="sm" className="mt-1" />
                    <div className="min-w-0 flex-1 space-y-2">
                      <Textarea
                        value={comment}
                        onChange={(event) => setComment(event.target.value)}
                        rows={3}
                        placeholder={internal ? 'Add an internal note (Admins only)…' : 'Write a comment visible to the submitter and assignee…'}
                        className={clsx('text-[12.5px]', internal && 'border-amber-300 bg-amber-50/40 focus:border-amber-400 dark:border-amber-500/30 dark:bg-amber-500/[0.06]')}
                      />
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        {isAdmin ? (
                          <button
                            type="button"
                            onClick={() => setInternal((value) => !value)}
                            className={clsx(
                              'inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-[11px] font-semibold transition',
                              internal
                                ? 'bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300'
                                : 'text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-white/[0.06]',
                            )}
                          >
                            <Lock className="h-3 w-3" /> Internal note
                          </button>
                        ) : (
                          <p className="text-[10.5px] text-slate-400">Comments notify the Admins and anyone assigned.</p>
                        )}
                        <Button type="submit" size="sm" loading={commentBusy} disabled={comment.trim().length < 2}>
                          <Send className="h-3.5 w-3.5" /> Post
                        </Button>
                      </div>
                    </div>
                  </div>
                </form>
              ) : null}
            </CardBody>
          </Card>
        </div>

        {/* Right rail */}
        <div className="space-y-4">
          <Card>
            <CardHeader icon={Layers} title="Workflow" description={isAdmin ? 'Admins control the lifecycle' : 'Read-only for team members'} />
            <CardBody className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-[10.5px] font-semibold uppercase tracking-wide text-slate-400">Current status</p>
                  <div className="mt-1.5">
                    <StatusBadge status={report.status} />
                  </div>
                </div>
                {resolutionDays !== null ? (
                  <div className="text-right">
                    <p className="text-[10.5px] font-semibold uppercase tracking-wide text-slate-400">Resolution</p>
                    <p className="mt-1 text-[12px] font-semibold text-slate-700 dark:text-slate-200">{resolutionDays === 0 ? 'Same day' : `${resolutionDays} days`}</p>
                  </div>
                ) : null}
              </div>

              {isAdmin ? (
                <div className="space-y-2">
                  <p className="text-[10.5px] font-semibold uppercase tracking-wide text-slate-400">Move this report to</p>
                  {availableTransitions.length ? (
                    availableTransitions.map((item) => {
                      const classes = tone(item.tone);
                      return (
                        <button
                          key={item.value}
                          type="button"
                          onClick={() => openTransition(item)}
                          className={clsx(
                            'group flex w-full items-center gap-2.5 rounded-xl border px-3 py-2.5 text-left transition hover:-translate-y-0.5 hover:shadow-sm',
                            'border-slate-200 bg-white dark:border-white/10 dark:bg-white/[0.03]',
                          )}
                        >
                          <span className={clsx('h-2 w-2 rounded-full', classes.dot)} />
                          <span className="flex-1">
                            <span className="block text-[12.5px] font-semibold text-slate-700 dark:text-slate-200">{item.label}</span>
                            <span className="block text-[10.5px] leading-snug text-slate-400">{item.description}</span>
                          </span>
                          <ChevronRight className="h-3.5 w-3.5 text-slate-300 transition group-hover:translate-x-0.5 group-hover:text-brand-500 dark:text-slate-600" />
                        </button>
                      );
                    })
                  ) : (
                    <p className="rounded-lg bg-slate-50 px-3 py-2 text-[11.5px] text-slate-500 dark:bg-white/[0.04] dark:text-slate-400">
                      No transitions available from this status.
                    </p>
                  )}
                </div>
              ) : (
                <div className="flex items-start gap-2 rounded-xl bg-slate-50 p-3 text-[11.5px] leading-relaxed text-slate-500 dark:bg-white/[0.04] dark:text-slate-400">
                  <Lock className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                  Only Admins can change status. Add a comment if you have new information or the issue needs to be reopened.
                </div>
              )}

              <div className="border-t border-slate-100 pt-3 dark:border-white/[0.06]">
                <p className="text-[10.5px] font-semibold uppercase tracking-wide text-slate-400">Assignee</p>
                <div className="mt-2 flex items-center gap-2.5">
                  {report.assignedTo ? (
                    <>
                      <Avatar name={report.assignedTo.fullName} tone={report.assignedTo.avatarTone} size="sm" />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[12.5px] font-semibold text-slate-700 dark:text-slate-200">{report.assignedTo.fullName}</p>
                        <p className="text-[10.5px] text-slate-400">Responsible owner</p>
                      </div>
                    </>
                  ) : (
                    <>
                      <span className="flex h-7 w-7 items-center justify-center rounded-full border border-dashed border-slate-300 text-slate-400 dark:border-white/20">
                        <UserRound className="h-3.5 w-3.5" />
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="text-[12.5px] font-medium text-slate-500 dark:text-slate-400">Unassigned</p>
                        <p className="text-[10.5px] text-slate-400">Pick an owner to move this forward</p>
                      </div>
                    </>
                  )}
                  {permissions.canAssign ? (
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => {
                        setAssigneeId(report.assignedTo?.id ?? '');
                        setAssignOpen(true);
                      }}
                    >
                      {report.assignedTo ? 'Change' : 'Assign'}
                    </Button>
                  ) : null}
                </div>
              </div>
            </CardBody>
          </Card>

          <Card>
            <CardHeader icon={History} title="Status history" description="Immutable audit trail of every transition" />
            <CardBody className="pt-4">
              <ol className="relative space-y-4 border-l border-slate-200 pl-5 dark:border-white/10">
                {history.map((entry, index) => {
                  const classes = tone(
                    entry.newStatus === 'submitted'
                      ? 'sky'
                      : entry.newStatus === 'under_review'
                        ? 'violet'
                        : entry.newStatus === 'assigned'
                          ? 'indigo'
                          : entry.newStatus === 'in_progress'
                            ? 'amber'
                            : entry.newStatus === 'on_hold'
                              ? 'slate'
                              : entry.newStatus === 'resolved'
                                ? 'emerald'
                                : entry.newStatus === 'rejected'
                                  ? 'rose'
                                  : entry.newStatus === 'reopened'
                                    ? 'orange'
                                    : 'neutral',
                  );
                  return (
                    <li key={entry.id} className="relative">
                      <span className={clsx('absolute -left-[26px] top-1 flex h-3 w-3 items-center justify-center rounded-full ring-4 ring-white dark:ring-slate-900', classes.dot)} />
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className="text-[12px] font-semibold text-slate-800 dark:text-slate-100">
                          {entry.oldStatus ? `${STATUS_LABEL[entry.oldStatus]} → ${STATUS_LABEL[entry.newStatus]}` : STATUS_LABEL[entry.newStatus]}
                        </span>
                        {index === history.length - 1 ? <Badge color="indigo" size="sm">current</Badge> : null}
                      </div>
                      <p className="mt-0.5 text-[11px] text-slate-500 dark:text-slate-400">
                        {entry.actor.fullName} · {formatDateTime(entry.changedAt)}
                      </p>
                      {entry.reason ? (
                        <p className="mt-1.5 rounded-lg bg-slate-50 px-2.5 py-1.5 text-[11.5px] leading-relaxed text-slate-600 dark:bg-white/[0.04] dark:text-slate-300">
                          {entry.reason}
                        </p>
                      ) : null}
                    </li>
                  );
                })}
              </ol>
            </CardBody>
          </Card>

          {isAdmin ? (
            <Card>
              <CardHeader
                icon={ShieldCheck}
                title="Admin notes"
                description="Internal context for the admin team"
                action={
                  <Button variant="ghost" size="sm" onClick={openNotes}>
                    <Pencil className="h-3 w-3" /> Edit
                  </Button>
                }
              />
              <CardBody className="space-y-3 pt-3">
                <div>
                  <p className="text-[10.5px] font-semibold uppercase tracking-wide text-slate-400">Remark visible to submitter</p>
                  <p className="mt-1 text-[12px] leading-relaxed text-slate-600 dark:text-slate-300">{report.adminRemark || <span className="text-slate-400">Not set</span>}</p>
                </div>
                <div>
                  <p className="text-[10.5px] font-semibold uppercase tracking-wide text-slate-400">Root cause</p>
                  <p className="mt-1 text-[12px] leading-relaxed text-slate-600 dark:text-slate-300">{report.rootCause || <span className="text-slate-400">Not documented</span>}</p>
                </div>
                <div>
                  <p className="text-[10.5px] font-semibold uppercase tracking-wide text-slate-400">Resolution summary</p>
                  <p className="mt-1 text-[12px] leading-relaxed text-slate-600 dark:text-slate-300">{report.resolutionSummary || <span className="text-slate-400">Not recorded</span>}</p>
                </div>
              </CardBody>
            </Card>
          ) : null}

          <Card>
            <CardHeader icon={Info} title="Report details" />
            <CardBody className="divide-y divide-slate-100 pt-1 dark:divide-white/[0.06]">
              <MetaRow label="Error ID" value={<span className="font-mono text-[11.5px]">{report.errorCode}</span>} />
              <MetaRow label="Application" value={report.application?.name ?? '—'} />
              <MetaRow label="Module" value={report.module} />
              <MetaRow label="Category" value={report.category} />
              <MetaRow label="Priority" value={PRIORITY_LABEL[report.priority]} />
              <MetaRow label="Submitted by" value={report.submittedBy?.fullName ?? '—'} />
              <MetaRow label="Created" value={formatDate(report.createdAt)} icon={CalendarClock} />
              <MetaRow label="Last updated" value={relativeTime(report.updatedAt)} icon={Clock} />
              {report.resolvedAt ? <MetaRow label="Resolved" value={formatDate(report.resolvedAt)} icon={CheckCircle2} /> : null}
              {report.closedAt ? <MetaRow label="Closed" value={formatDate(report.closedAt)} icon={ClipboardCheck} /> : null}
            </CardBody>
          </Card>
        </div>
      </div>

      {/* Transition modal */}
      <Modal
        open={Boolean(transition)}
        onClose={() => setTransition(null)}
        title={`Move report to ${transition?.label ?? ''}`}
        description={transition?.description}
        footer={
          <>
            <Button variant="ghost" onClick={() => setTransition(null)} disabled={transitionBusy}>
              Cancel
            </Button>
            <Button onClick={submitTransition} loading={transitionBusy}>
              Confirm {transition?.label}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          {transitionError ? (
            <div role="alert" className="rounded-xl border border-rose-200 bg-rose-50 px-3.5 py-2.5 text-[12.5px] font-medium text-rose-700 dark:border-rose-500/25 dark:bg-rose-500/10 dark:text-rose-300">
              {transitionError}
            </div>
          ) : null}
          {transition?.reasonRequired ? (
            <Field label="Reason" required hint="Stored permanently in the status history and audit log, and shared with the submitter.">
              <Textarea value={transitionReason} onChange={(event) => setTransitionReason(event.target.value)} rows={3} placeholder={`Why is this report being marked ${transition.label}?`} autoFocus />
            </Field>
          ) : (
            <Field label="Note (optional)" hint="Optional context for the status history.">
              <Textarea value={transitionReason} onChange={(event) => setTransitionReason(event.target.value)} rows={2} placeholder="Add a short note…" />
            </Field>
          )}

          {transition?.value === 'resolved' || transition?.value === 'closed' ? (
            <>
              <Field label="Resolution summary" required hint="What was done to fix or mitigate the issue. Visible to the submitter.">
                <Textarea value={resolution} onChange={(event) => setResolution(event.target.value)} rows={3} placeholder="Describe the fix, the workaround or the mitigation…" />
              </Field>
              <Field label="Root cause (optional)">
                <Textarea value={rootCause} onChange={(event) => setRootCause(event.target.value)} rows={2} placeholder="Why did this happen?" />
              </Field>
            </>
          ) : null}
        </div>
      </Modal>

      {/* Assignment modal */}
      <Modal
        open={assignOpen}
        onClose={() => setAssignOpen(false)}
        title="Assign this report"
        description="The assignee receives a notification and the report moves to Assigned if it was awaiting triage."
        footer={
          <>
            <Button variant="ghost" onClick={() => setAssignOpen(false)} disabled={assignBusy}>
              Cancel
            </Button>
            <Button onClick={submitAssignment} loading={assignBusy}>
              Save assignment
            </Button>
          </>
        }
      >
        <Field label="Assignee">
          <Select value={assigneeId} onChange={(event) => setAssigneeId(event.target.value)}>
            <option value="">Unassigned</option>
            {directory.map((person) => (
              <option key={person.id} value={person.id}>
                {person.fullName} · {ROLE_LABEL[person.role]}
              </option>
            ))}
          </Select>
        </Field>
      </Modal>

      {/* Edit modal */}
      <Modal
        open={editOpen}
        onClose={() => setEditOpen(false)}
        title="Edit report details"
        description="Core fields can be edited until review starts. After that, add a comment instead."
        size="lg"
        footer={
          <>
            <Button variant="ghost" onClick={() => setEditOpen(false)} disabled={editBusy}>
              Cancel
            </Button>
            <Button onClick={submitEdit} loading={editBusy}>
              Save changes
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          {editError ? (
            <div role="alert" className="rounded-xl border border-rose-200 bg-rose-50 px-3.5 py-2.5 text-[12.5px] font-medium text-rose-700 dark:border-rose-500/25 dark:bg-rose-500/10 dark:text-rose-300">
              {editError}
            </div>
          ) : null}
          <Field label="Title" required>
            <Input value={editForm.title ?? ''} onChange={(event) => setEditForm((prev) => ({ ...prev, title: event.target.value }))} />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Module" required>
              <Input value={editForm.module ?? ''} onChange={(event) => setEditForm((prev) => ({ ...prev, module: event.target.value }))} />
            </Field>
            <Field label="Category" required>
              <Select value={editForm.category ?? ''} onChange={(event) => setEditForm((prev) => ({ ...prev, category: event.target.value }))}>
                {CATEGORIES.map((category) => (
                  <option key={category} value={category}>
                    {category}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Priority" required>
              <Select value={editForm.priority ?? ''} onChange={(event) => setEditForm((prev) => ({ ...prev, priority: event.target.value }))}>
                {PRIORITY_ORDER.map((priority) => (
                  <option key={priority} value={priority}>
                    {PRIORITY_LABEL[priority]}
                  </option>
                ))}
              </Select>
            </Field>
          </div>
          <Field label="Description" required>
            <Textarea value={editForm.description ?? ''} onChange={(event) => setEditForm((prev) => ({ ...prev, description: event.target.value }))} rows={4} />
          </Field>
          <Field label="Steps to reproduce">
            <Textarea value={editForm.reproductionSteps ?? ''} onChange={(event) => setEditForm((prev) => ({ ...prev, reproductionSteps: event.target.value }))} rows={4} />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Expected result">
              <Textarea value={editForm.expectedResult ?? ''} onChange={(event) => setEditForm((prev) => ({ ...prev, expectedResult: event.target.value }))} rows={3} />
            </Field>
            <Field label="Actual result">
              <Textarea value={editForm.actualResult ?? ''} onChange={(event) => setEditForm((prev) => ({ ...prev, actualResult: event.target.value }))} rows={3} />
            </Field>
          </div>
        </div>
      </Modal>

      {/* Admin notes modal */}
      <Modal
        open={notesOpen}
        onClose={() => setNotesOpen(false)}
        title="Admin notes"
        description="Remarks and resolution details are shared with authorised users and recorded in the audit log."
        size="lg"
        footer={
          <>
            <Button variant="ghost" onClick={() => setNotesOpen(false)} disabled={notesBusy}>
              Cancel
            </Button>
            <Button onClick={submitNotes} loading={notesBusy}>
              Save notes
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <Field label="Admin remark" hint="Visible to the submitter on the report.">
            <Textarea value={notesForm.adminRemark} onChange={(event) => setNotesForm((prev) => ({ ...prev, adminRemark: event.target.value }))} rows={3} />
          </Field>
          <Field label="Root cause">
            <Textarea value={notesForm.rootCause} onChange={(event) => setNotesForm((prev) => ({ ...prev, rootCause: event.target.value }))} rows={2} />
          </Field>
          <Field label="Resolution summary">
            <Textarea value={notesForm.resolutionSummary} onChange={(event) => setNotesForm((prev) => ({ ...prev, resolutionSummary: event.target.value }))} rows={3} />
          </Field>
        </div>
      </Modal>

      <ConfirmDialog
        open={Boolean(deleteAttachment)}
        title="Remove attachment?"
        description={
          <>
            <span className="font-medium">{deleteAttachment?.originalFilename}</span> ({formatBytes(deleteAttachment?.sizeBytes)}) will be deleted from private
            storage and the audit log will record the removal.
          </>
        }
        confirmLabel="Remove file"
        onCancel={() => setDeleteAttachment(null)}
        onConfirm={confirmDeleteAttachment}
      />

      <ConfirmDialog
        open={archiveOpen}
        title={report.isArchived ? 'Restore this report?' : 'Archive this report?'}
        description={
          report.isArchived
            ? 'The report will return to the active queue.'
            : 'Archived reports are hidden from the default queue but remain available with the “include archived” filter. History is preserved.'
        }
        tone={report.isArchived ? 'primary' : 'danger'}
        confirmLabel={report.isArchived ? 'Restore' : 'Archive'}
        pending={archiveBusy}
        onCancel={() => setArchiveOpen(false)}
        onConfirm={toggleArchive}
      />

      <Modal open={Boolean(preview)} onClose={() => setPreview(null)} title={preview?.attachment.originalFilename ?? 'Preview'} size="xl">
        {preview ? (
          <div className="flex flex-col items-center gap-3">
            <img src={preview.url} alt={preview.attachment.originalFilename} className="max-h-[65vh] w-auto rounded-xl border border-slate-200 object-contain dark:border-white/10" />
            <div className="flex items-center gap-3 text-[11.5px] text-slate-500 dark:text-slate-400">
              <span>{formatBytes(preview.attachment.sizeBytes)}</span>
              <span className="flex items-center gap-1">
                <Lock className="h-3 w-3" /> Private attachment
              </span>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => void api.download(`${preview.attachment.url}?download=1`, preview.attachment.originalFilename)}
              >
                Download original
              </Button>
            </div>
          </div>
        ) : null}
      </Modal>

      {/* resolution note strip */}
      {report.status === 'resolved' && !isAdmin ? (
        <div className="mt-4 flex items-start gap-2 rounded-xl border border-emerald-200 bg-emerald-50/70 px-4 py-3 text-[12px] text-emerald-800 dark:border-emerald-500/25 dark:bg-emerald-500/10 dark:text-emerald-200">
          <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
          An Admin marked this report Resolved. If the issue still occurs, add a comment and ask for it to be reopened.
        </div>
      ) : null}

      <div className="mt-4 flex items-center justify-between rounded-xl border border-slate-200/70 bg-white px-4 py-2.5 text-[11px] text-slate-400 dark:border-white/[0.07] dark:bg-white/[0.02]">
        <span className="inline-flex items-center gap-1.5">
          <Sparkles className="h-3.5 w-3.5" /> Every change on this page is audited with the acting user and timestamp.
        </span>
        <button type="button" onClick={() => navigate(-1)} className="inline-flex items-center gap-1 font-semibold text-slate-500 hover:text-brand-600 dark:text-slate-400 dark:hover:text-brand-300">
          Back <ArrowRight className="h-3 w-3" />
        </button>
      </div>
    </div>
  );
}
