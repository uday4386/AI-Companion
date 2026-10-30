import { useState } from 'react';
import { Check, ClipboardCheck, Copy, Inbox, Mail, ShieldCheck, UserCheck, UserX, X } from 'lucide-react';
import { useFetch } from '@/hooks/useFetch';
import { useToast } from '@/contexts/ToastContext';
import { api, ApiError } from '@/lib/api';
import type { AccessRequest, Role } from '@/lib/types';
import { ROLE_LABEL } from '@/lib/constants';
import { formatDateTime, relativeTime } from '@/lib/format';
import { PageHeader } from '@/components/layout/Topbar';
import { Card, CardBody, CardHeader } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Field, Select, Textarea } from '@/components/ui/Field';
import { Modal, ConfirmDialog } from '@/components/ui/Modal';
import { EmptyState } from '@/components/ui/EmptyState';
import { TableSkeleton } from '@/components/ui/Spinner';
import { Tabs } from '@/components/ui/Tabs';

interface RequestsResponse {
  requests: AccessRequest[];
  summary: { pending: number; approved: number; rejected: number };
}

const STATUS_TONE: Record<string, string> = { pending: 'amber', approved: 'emerald', rejected: 'rose' };

export default function AccessRequestsPage() {
  const toast = useToast();
  const [tab, setTab] = useState<'pending' | 'approved' | 'rejected' | 'all'>('pending');
  const { data, loading, refetch } = useFetch<RequestsResponse>(`/api/access-requests?status=${tab}`, [tab]);

  const [approveTarget, setApproveTarget] = useState<AccessRequest | null>(null);
  const [role, setRole] = useState<Role>('member');
  const [busy, setBusy] = useState(false);
  const [inviteLink, setInviteLink] = useState<string | null>(null);

  const [rejectTarget, setRejectTarget] = useState<AccessRequest | null>(null);
  const [note, setNote] = useState('');
  const [rejectBusy, setRejectBusy] = useState(false);

  const approve = async () => {
    if (!approveTarget) return;
    setBusy(true);
    try {
      const result = await api.patch<{ inviteUrl: string | null }>(`/api/access-requests/${approveTarget.id}`, {
        action: 'approve',
        role,
        note: '',
      });
      setInviteLink(result.inviteUrl ? `${window.location.origin}${result.inviteUrl}` : null);
      toast.success('Access approved', 'An activation link has been created for the requester.');
      refetch();
    } catch (err) {
      toast.error('Could not approve', err instanceof ApiError ? err.message : undefined);
    } finally {
      setBusy(false);
    }
  };

  const reject = async () => {
    if (!rejectTarget) return;
    setRejectBusy(true);
    try {
      await api.patch(`/api/access-requests/${rejectTarget.id}`, { action: 'reject', note });
      toast.success('Request rejected');
      setRejectTarget(null);
      setNote('');
      refetch();
    } catch (err) {
      toast.error('Could not reject', err instanceof ApiError ? err.message : undefined);
    } finally {
      setRejectBusy(false);
    }
  };

  const copyLink = async () => {
    if (!inviteLink) return;
    try {
      await navigator.clipboard.writeText(inviteLink);
      toast.success('Invitation link copied');
    } catch {
      toast.error('Could not copy the link');
    }
  };

  return (
    <div className="animate-fade-in">
      <PageHeader
        breadcrumb={[{ label: 'Administration' }, { label: 'Access requests' }]}
        title="Access requests"
        description="Access is invite-only. Review each request, then approve with a role or reject with a reason."
        actions={
          <div className="flex items-center gap-2 rounded-xl bg-white px-3 py-2 text-[11.5px] text-slate-500 shadow-sm ring-1 ring-slate-200/80 dark:bg-white/[0.04] dark:text-slate-400 dark:ring-white/10">
            <ShieldCheck className="h-3.5 w-3.5 text-brand-500" />
            Approval creates a one-time activation link
          </div>
        }
      />

      <div className="mb-4 grid gap-4 sm:grid-cols-3">
        {[
          { label: 'Pending review', value: data?.summary.pending ?? 0, icon: Inbox, tone: 'amber' },
          { label: 'Approved', value: data?.summary.approved ?? 0, icon: UserCheck, tone: 'emerald' },
          { label: 'Rejected', value: data?.summary.rejected ?? 0, icon: UserX, tone: 'rose' },
        ].map((card) => (
          <Card key={card.label} className="flex items-center gap-3 p-4">
            <span
              className={`flex h-9 w-9 items-center justify-center rounded-xl ${
                card.tone === 'amber'
                  ? 'bg-amber-50 text-amber-600 dark:bg-amber-500/15 dark:text-amber-300'
                  : card.tone === 'emerald'
                    ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-300'
                    : 'bg-rose-50 text-rose-600 dark:bg-rose-500/15 dark:text-rose-300'
              }`}
            >
              <card.icon className="h-4 w-4" />
            </span>
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">{card.label}</p>
              <p className="text-[20px] font-bold leading-tight text-slate-900 dark:text-white">{card.value}</p>
            </div>
          </Card>
        ))}
      </div>

      <Card>
        <div className="border-b border-slate-100 px-4 pt-1 dark:border-white/[0.06]">
          <Tabs
            items={[
              { value: 'pending', label: 'Pending', count: data?.summary.pending },
              { value: 'approved', label: 'Approved', count: data?.summary.approved },
              { value: 'rejected', label: 'Rejected', count: data?.summary.rejected },
              { value: 'all', label: 'All requests' },
            ]}
            value={tab}
            onChange={(value) => setTab(value as typeof tab)}
          />
        </div>

        {loading ? (
          <TableSkeleton rows={4} columns={4} />
        ) : data?.requests.length ? (
          <div className="divide-y divide-slate-100 dark:divide-white/[0.06]">
            {data.requests.map((request) => (
              <div key={request.id} className="flex flex-col gap-3 p-4 sm:flex-row sm:items-start">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-[13.5px] font-semibold text-slate-900 dark:text-white">{request.fullName}</p>
                    <Badge color={STATUS_TONE[request.requestStatus] ?? 'slate'} size="sm">
                      {request.requestStatus}
                    </Badge>
                    <span className="text-[11px] text-slate-400">requested {relativeTime(request.createdAt)}</span>
                  </div>
                  <p className="mt-0.5 flex items-center gap-1 text-[11.5px] text-slate-500 dark:text-slate-400">
                    <Mail className="h-3 w-3" /> {request.email}
                  </p>
                  <p className="mt-2 rounded-lg bg-slate-50 px-3 py-2 text-[12px] leading-relaxed text-slate-600 dark:bg-white/[0.04] dark:text-slate-300">
                    “{request.requestReason}”
                  </p>
                  {request.reviewedAt ? (
                    <p className="mt-1.5 text-[10.5px] text-slate-400">
                      Reviewed by {request.reviewedBy ?? 'an Admin'} on {formatDateTime(request.reviewedAt)}
                      {request.reviewNote ? ` · ${request.reviewNote}` : ''}
                    </p>
                  ) : null}
                </div>
                {request.requestStatus === 'pending' ? (
                  <div className="flex shrink-0 items-center gap-2">
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => {
                        setRejectTarget(request);
                        setNote('');
                      }}
                    >
                      <X className="h-3.5 w-3.5" /> Reject
                    </Button>
                    <Button
                      size="sm"
                      onClick={() => {
                        setApproveTarget(request);
                        setRole('member');
                        setInviteLink(null);
                      }}
                    >
                      <Check className="h-3.5 w-3.5" /> Approve
                    </Button>
                  </div>
                ) : null}
              </div>
            ))}
          </div>
        ) : (
          <EmptyState
            icon={ClipboardCheck}
            title={tab === 'pending' ? 'No pending requests' : 'Nothing here'}
            description={tab === 'pending' ? 'New access requests from the sign-in page will appear here for review.' : 'No requests with this status.'}
          />
        )}
      </Card>

      <Card className="mt-4">
        <CardHeader icon={ShieldCheck} title="Access policy" description="The controls this page enforces" />
        <CardBody className="grid gap-3 text-[12px] sm:grid-cols-3">
          {[
            ['No public sign-up', 'Accounts only exist after an Admin approves a request or sends an invitation.'],
            ['Least privilege', 'Approving as Team Member grants submission and tracking only. Admin grants full queue and user control.'],
            ['Single-use links', 'Activation links expire after seven days and are invalidated when revoked.'],
          ].map(([title, text]) => (
            <div key={title} className="rounded-xl bg-slate-50 p-3 dark:bg-white/[0.04]">
              <p className="font-semibold text-slate-800 dark:text-slate-100">{title}</p>
              <p className="mt-1 leading-relaxed text-slate-500 dark:text-slate-400">{text}</p>
            </div>
          ))}
        </CardBody>
      </Card>

      <Modal
        open={Boolean(approveTarget)}
        onClose={() => setApproveTarget(null)}
        title={inviteLink ? 'Access approved' : `Approve ${approveTarget?.fullName ?? 'request'}`}
        description={inviteLink ? 'Share the activation link with the requester.' : 'Choose the role to grant. An activation link will be generated.'}
        footer={
          inviteLink ? (
            <Button onClick={() => setApproveTarget(null)}>Done</Button>
          ) : (
            <>
              <Button variant="ghost" onClick={() => setApproveTarget(null)} disabled={busy}>
                Cancel
              </Button>
              <Button onClick={approve} loading={busy}>
                <UserCheck className="h-4 w-4" /> Approve request
              </Button>
            </>
          )
        }
      >
        {inviteLink ? (
          <div className="space-y-3">
            <div className="rounded-xl border border-emerald-200 bg-emerald-50/70 p-3.5 dark:border-emerald-500/25 dark:bg-emerald-500/10">
              <p className="flex items-center gap-1.5 text-[12px] font-semibold text-emerald-800 dark:text-emerald-200">
                <Check className="h-3.5 w-3.5" /> Invitation created as {ROLE_LABEL[role]}
              </p>
              <p className="mt-1 text-[11.5px] leading-relaxed text-emerald-700/80 dark:text-emerald-200/70">
                {approveTarget?.email} can now activate their account. This link is single-use and expires in seven days.
              </p>
            </div>
            <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 p-2 dark:border-white/10 dark:bg-white/[0.04]">
              <code className="min-w-0 flex-1 truncate text-[11px] text-slate-600 dark:text-slate-300">{inviteLink}</code>
              <Button variant="secondary" size="sm" onClick={copyLink}>
                <Copy className="h-3.5 w-3.5" /> Copy
              </Button>
            </div>
          </div>
        ) : (
          <Field label="Grant role" hint="Admins can manage users, roles and statuses. Choose this only when required.">
            <Select value={role} onChange={(event) => setRole(event.target.value as Role)}>
              <option value="member">Team Member</option>
              <option value="admin">Admin</option>
            </Select>
          </Field>
        )}
      </Modal>

      <ConfirmDialog
        open={Boolean(rejectTarget)}
        title="Reject this request?"
        description={`${rejectTarget?.fullName ?? 'The requester'} will not receive an account. The reason is stored for the audit trail.`}
        confirmLabel="Reject request"
        pending={rejectBusy}
        onCancel={() => setRejectTarget(null)}
        onConfirm={reject}
      >
        <Field label="Reason (recorded)" hint="Optional but helpful for the audit trail.">
          <Textarea value={note} onChange={(event) => setNote(event.target.value)} rows={3} placeholder="e.g. Role already covered by the analytics team." />
        </Field>
      </ConfirmDialog>
    </div>
  );
}
