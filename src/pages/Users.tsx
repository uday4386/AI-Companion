import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Check,
  ChevronDown,
  Copy,
  KeyRound,
  Mail,
  MailPlus,
  MoreHorizontal,
  Search,
  ShieldCheck,
  UserCheck,
  UserCog,
  UserPlus,
  UserRound,
  UserX,
  Users as UsersIcon,
} from 'lucide-react';
import clsx from 'clsx';
import { useAuth } from '@/contexts/AuthContext';
import { useFetch } from '@/hooks/useFetch';
import { useToast } from '@/contexts/ToastContext';
import { api, ApiError } from '@/lib/api';
import type { Invitation, Role, UserDetail, UserRow, UserSummary } from '@/lib/types';
import { ROLE_LABEL } from '@/lib/constants';
import { formatDate, formatDateTime, relativeTime } from '@/lib/format';
import { PageHeader } from '@/components/layout/Topbar';
import { Card, CardBody, CardHeader } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Field, Input, Select } from '@/components/ui/Field';
import { Avatar } from '@/components/ui/Avatar';
import { Badge } from '@/components/ui/Badge';
import { Modal, ConfirmDialog } from '@/components/ui/Modal';
import { Menu, MenuItem, MenuLabel, MenuSeparator } from '@/components/ui/Menu';
import { Tabs } from '@/components/ui/Tabs';
import { EmptyState } from '@/components/ui/EmptyState';
import { TableSkeleton } from '@/components/ui/Spinner';
import { StatusBadge } from '@/components/StatusBadge';

interface UsersResponse {
  users: UserRow[];
  summary: UserSummary;
}

interface InvitationsResponse {
  invitations: Invitation[];
}

const ROLE_TONE: Record<Role, string> = { admin: 'indigo', member: 'slate' };
const INVITE_TONE: Record<string, string> = { pending: 'amber', accepted: 'emerald', revoked: 'rose', expired: 'slate' };

export default function UsersPage() {
  const { user: currentUser } = useAuth();
  const toast = useToast();
  const [tab, setTab] = useState<'people' | 'invitations'>('people');
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const users = useFetch<UsersResponse>('/api/users', []);
  const invitations = useFetch<InvitationsResponse>('/api/invitations', []);

  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteForm, setInviteForm] = useState({ fullName: '', email: '', role: 'member' as Role });
  const [inviteBusy, setInviteBusy] = useState(false);
  const [inviteError, setInviteError] = useState<string | null>(null);
  const [inviteLink, setInviteLink] = useState<string | null>(null);

  const [roleTarget, setRoleTarget] = useState<{ user: UserRow; role: Role } | null>(null);
  const [roleBusy, setRoleBusy] = useState(false);

  const [statusTarget, setStatusTarget] = useState<UserRow | null>(null);
  const [statusBusy, setStatusBusy] = useState(false);

  const [resetTarget, setResetTarget] = useState<UserRow | null>(null);
  const [resetBusy, setResetBusy] = useState(false);
  const [tempPassword, setTempPassword] = useState<string | null>(null);

  const [activityTarget, setActivityTarget] = useState<UserRow | null>(null);
  const activity = useFetch<UserDetail>(activityTarget ? `/api/users/${activityTarget.id}` : null, [activityTarget?.id]);

  const filtered = useMemo(() => {
    const list = users.data?.users ?? [];
    return list.filter((row) => {
      const needle = search.toLowerCase();
      const matchesSearch =
        !needle ||
        row.fullName.toLowerCase().includes(needle) ||
        row.email.toLowerCase().includes(needle) ||
        (row.username ?? '').toLowerCase().includes(needle);
      const matchesRole = !roleFilter || row.role === roleFilter;
      return matchesSearch && matchesRole;
    });
  }, [users.data, search, roleFilter]);

  const summary = users.data?.summary;

  const copy = async (value: string, label = 'Link copied') => {
    try {
      await navigator.clipboard.writeText(value);
      toast.success(label);
    } catch {
      toast.error('Could not copy to clipboard');
    }
  };

  const submitInvite = async () => {
    setInviteBusy(true);
    setInviteError(null);
    try {
      const result = await api.post<{ inviteUrl: string; message: string }>('/api/users/invite', inviteForm);
      setInviteLink(`${window.location.origin}${result.inviteUrl}`);
      toast.success('Invitation created', 'Share the activation link with your teammate.');
      setInviteForm({ fullName: '', email: '', role: 'member' });
      users.refetch();
      invitations.refetch();
    } catch (err) {
      setInviteError(err instanceof ApiError ? err.message : 'Could not create the invitation.');
    } finally {
      setInviteBusy(false);
    }
  };

  const changeRole = async () => {
    if (!roleTarget) return;
    setRoleBusy(true);
    try {
      await api.patch(`/api/users/${roleTarget.user.id}/role`, { role: roleTarget.role });
      toast.success('Role updated', `${roleTarget.user.fullName} is now ${ROLE_LABEL[roleTarget.role]}.`);
      setRoleTarget(null);
      users.refetch();
    } catch (err) {
      toast.error('Could not change role', err instanceof ApiError ? err.message : undefined);
    } finally {
      setRoleBusy(false);
    }
  };

  const changeStatus = async () => {
    if (!statusTarget) return;
    setStatusBusy(true);
    const next = statusTarget.accountStatus === 'active' ? 'inactive' : 'active';
    try {
      await api.patch(`/api/users/${statusTarget.id}/status`, { accountStatus: next });
      toast.success(next === 'active' ? 'Account activated' : 'Account deactivated');
      setStatusTarget(null);
      users.refetch();
    } catch (err) {
      toast.error('Could not update the account', err instanceof ApiError ? err.message : undefined);
    } finally {
      setStatusBusy(false);
    }
  };

  const resetPassword = async () => {
    if (!resetTarget) return;
    setResetBusy(true);
    try {
      const result = await api.post<{ temporaryPassword: string }>(`/api/users/${resetTarget.id}/reset-password`);
      setTempPassword(result.temporaryPassword);
      toast.success('Temporary password generated');
    } catch (err) {
      toast.error('Could not reset the password', err instanceof ApiError ? err.message : undefined);
    } finally {
      setResetBusy(false);
    }
  };

  const revokeInvite = async (invitation: Invitation) => {
    try {
      await api.delete(`/api/invitations/${invitation.id}`);
      toast.success('Invitation revoked');
      invitations.refetch();
    } catch (err) {
      toast.error('Could not revoke', err instanceof ApiError ? err.message : undefined);
    }
  };

  const reissueInvite = async (invitation: Invitation) => {
    try {
      const result = await api.post<{ inviteUrl: string }>(`/api/auth/resend-invitation/${invitation.id}`);
      await copy(`${window.location.origin}${result.inviteUrl}`, 'New invitation link copied');
      invitations.refetch();
    } catch (err) {
      toast.error('Could not re-issue the invitation', err instanceof ApiError ? err.message : undefined);
    }
  };

  return (
    <div className="animate-fade-in">
      <PageHeader
        breadcrumb={[{ label: 'Administration' }, { label: 'User management' }]}
        title="User management"
        description="Provision access, review roles and deactivate accounts. Only Admins can invite users — there is no public sign-up."
        actions={
          <>
            <Link to="/access-requests">
              <Button variant="secondary" size="sm">
                <UserCheck className="h-3.5 w-3.5" /> Access requests
                {summary?.pendingRequests ? (
                  <span className="ml-1 rounded-full bg-brand-600 px-1.5 py-0.5 text-[10px] font-bold text-white">{summary.pendingRequests}</span>
                ) : null}
              </Button>
            </Link>
            <Button size="sm" onClick={() => setInviteOpen(true)}>
              <UserPlus className="h-3.5 w-3.5" /> Invite user
            </Button>
          </>
        }
      />

      <div className="mb-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Card className="p-4">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">People</p>
          <p className="mt-2 text-[24px] font-bold leading-none text-slate-900 dark:text-white">{summary?.total ?? '—'}</p>
          <p className="mt-2 text-[11.5px] text-slate-500 dark:text-slate-400">
            {summary?.active ?? 0} active · {summary?.inactive ?? 0} inactive
          </p>
        </Card>
        <Card className="p-4">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Admins</p>
          <p className="mt-2 text-[24px] font-bold leading-none text-slate-900 dark:text-white">{summary?.admins ?? '—'}</p>
          <p className="mt-2 text-[11.5px] text-slate-500 dark:text-slate-400">{summary?.members ?? 0} team members</p>
        </Card>
        <Card className="p-4">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Pending access</p>
          <p className="mt-2 text-[24px] font-bold leading-none text-slate-900 dark:text-white">{summary?.pendingRequests ?? '—'}</p>
          <p className="mt-2 text-[11.5px] text-slate-500 dark:text-slate-400">Awaiting review</p>
        </Card>
        <Card className="p-4">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Open invitations</p>
          <p className="mt-2 text-[24px] font-bold leading-none text-slate-900 dark:text-white">{summary?.pendingInvites ?? '—'}</p>
          <p className="mt-2 text-[11.5px] text-slate-500 dark:text-slate-400">Links not yet used</p>
        </Card>
      </div>

      <Card>
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-4 pt-1 dark:border-white/[0.06]">
          <Tabs
            items={[
              { value: 'people', label: 'People', count: summary?.total, icon: UsersIcon },
              { value: 'invitations', label: 'Invitations', count: invitations.data?.invitations.length, icon: MailPlus },
            ]}
            value={tab}
            onChange={(value) => setTab(value as 'people' | 'invitations')}
          />
          {tab === 'people' ? (
            <div className="flex items-center gap-2 pb-2">
              <div className="relative">
                <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
                <Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search people…" className="h-8 w-[190px] pl-8 text-[12px]" />
              </div>
              <Select value={roleFilter} onChange={(event) => setRoleFilter(event.target.value)} className="h-8 w-[130px] py-0 text-[12px]">
                <option value="">All roles</option>
                <option value="admin">Admins</option>
                <option value="member">Team members</option>
              </Select>
            </div>
          ) : null}
        </div>

        {tab === 'people' ? (
          users.loading ? (
            <TableSkeleton rows={6} columns={5} />
          ) : filtered.length ? (
            <div className="table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Person</th>
                    <th>Role</th>
                    <th>Account</th>
                    <th className="hidden lg:table-cell">Reports</th>
                    <th className="hidden md:table-cell">Last sign-in</th>
                    <th className="w-10">
                      <span className="sr-only">Actions</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((row) => {
                    const isSelf = row.id === currentUser?.id;
                    return (
                      <tr key={row.id} className="group">
                        <td>
                          <div className="flex items-center gap-2.5">
                            <Avatar name={row.fullName} tone={row.avatarTone} size="sm" />
                            <div className="min-w-0">
                              <p className="flex items-center gap-1.5 truncate text-[12.5px] font-semibold text-slate-800 dark:text-slate-100">
                                {row.fullName}
                                {isSelf ? <span className="rounded bg-slate-100 px-1 py-0.5 text-[9px] font-semibold uppercase text-slate-500 dark:bg-white/10 dark:text-slate-400">you</span> : null}
                              </p>
                              <p className="truncate text-[11px] text-slate-500 dark:text-slate-400">
                                {row.username ? <span className="font-mono text-slate-400 dark:text-slate-500">@{row.username} · </span> : null}
                                {row.email}
                              </p>
                              {row.jobTitle ? <p className="truncate text-[10.5px] text-slate-400">{row.jobTitle}</p> : null}
                            </div>
                          </div>
                        </td>
                        <td>
                          <Badge color={ROLE_TONE[row.role]} size="sm">
                            {row.role === 'admin' ? <ShieldCheck className="h-3 w-3" /> : null}
                            {ROLE_LABEL[row.role]}
                          </Badge>
                        </td>
                        <td>
                          <span
                            className={clsx(
                              'badge',
                              row.accountStatus === 'active'
                                ? 'bg-emerald-50 text-emerald-700 ring-emerald-600/20 dark:bg-emerald-500/10 dark:text-emerald-300 dark:ring-emerald-400/25'
                                : 'bg-slate-100 text-slate-500 ring-slate-400/20 dark:bg-white/[0.06] dark:text-slate-400 dark:ring-white/10',
                            )}
                          >
                            <span className={clsx('h-1.5 w-1.5 rounded-full', row.accountStatus === 'active' ? 'bg-emerald-500' : 'bg-slate-400')} />
                            {row.accountStatus === 'active' ? 'Active' : 'Inactive'}
                          </span>
                        </td>
                        <td className="hidden lg:table-cell">
                          <div className="text-[11.5px] text-slate-600 dark:text-slate-300">
                            {row.submittedCount} submitted · {row.assignedOpen} open
                          </div>
                        </td>
                        <td className="hidden md:table-cell">
                          <span className="text-[11.5px] text-slate-500 dark:text-slate-400">{row.lastLoginAt ? relativeTime(row.lastLoginAt) : 'Never'}</span>
                        </td>
                        <td>
                          <Menu
                            trigger={({ toggle }) => (
                              <button
                                type="button"
                                onClick={toggle}
                                className="rounded-lg p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-white/10 dark:hover:text-slate-200"
                                aria-label={`Actions for ${row.fullName}`}
                              >
                                <MoreHorizontal className="h-4 w-4" />
                              </button>
                            )}
                          >
                            {({ close }) => (
                              <div>
                                <MenuLabel>{row.fullName}</MenuLabel>
                                <MenuItem
                                  icon={UserRound}
                                  onClick={() => {
                                    close();
                                    setActivityTarget(row);
                                  }}
                                >
                                  View profile &amp; activity
                                </MenuItem>
                                {!isSelf ? (
                                  <>
                                    <MenuItem
                                      icon={UserCog}
                                      onClick={() => {
                                        close();
                                        setRoleTarget({ user: row, role: row.role });
                                      }}
                                    >
                                      Change role
                                    </MenuItem>
                                    <MenuSeparator />
                                    <MenuItem
                                      icon={KeyRound}
                                      onClick={() => {
                                        close();
                                        setResetTarget(row);
                                        setTempPassword(null);
                                      }}
                                    >
                                      Reset password
                                    </MenuItem>
                                    <MenuItem
                                      icon={row.accountStatus === 'active' ? UserX : UserCheck}
                                      danger={row.accountStatus === 'active'}
                                      onClick={() => {
                                        close();
                                        setStatusTarget(row);
                                      }}
                                    >
                                      {row.accountStatus === 'active' ? 'Deactivate account' : 'Activate account'}
                                    </MenuItem>
                                  </>
                                ) : (
                                  <p className="px-2.5 py-2 text-[11px] text-slate-400">You cannot change your own role or account status.</p>
                                )}
                              </div>
                            )}
                          </Menu>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <EmptyState title="No people match your filters" description="Try a different search term or role." />
          )
        ) : (
          <div className="p-4">
            {invitations.data?.invitations.length ? (
              <div className="table-wrap">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Invited person</th>
                      <th>Role</th>
                      <th>Status</th>
                      <th className="hidden md:table-cell">Invited</th>
                      <th className="hidden lg:table-cell">Expires</th>
                      <th className="text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {invitations.data.invitations.map((invitation) => (
                      <tr key={invitation.id}>
                        <td>
                          <p className="text-[12.5px] font-semibold text-slate-800 dark:text-slate-100">{invitation.fullName}</p>
                          <p className="text-[11px] text-slate-500 dark:text-slate-400">{invitation.email}</p>
                        </td>
                        <td>
                          <Badge color={ROLE_TONE[invitation.role]} size="sm">
                            {ROLE_LABEL[invitation.role]}
                          </Badge>
                        </td>
                        <td>
                          <Badge color={INVITE_TONE[invitation.status] ?? 'slate'} size="sm">
                            {invitation.status}
                          </Badge>
                        </td>
                        <td className="hidden md:table-cell text-[11.5px] text-slate-500 dark:text-slate-400">
                          {formatDate(invitation.createdAt)}
                          <span className="block text-[10.5px] text-slate-400">by {invitation.invitedBy ?? 'Admin'}</span>
                        </td>
                        <td className="hidden lg:table-cell text-[11.5px] text-slate-500 dark:text-slate-400">{formatDate(invitation.expiresAt)}</td>
                        <td>
                          <div className="flex items-center justify-end gap-1">
                            {invitation.status === 'pending' ? (
                              <>
                                <Button
                                  variant="ghost"
                                  size="icon-sm"
                                  onClick={() => void copy(`${window.location.origin}${invitation.inviteUrl}`, 'Invitation link copied')}
                                  aria-label="Copy invitation link"
                                  title="Copy link"
                                >
                                  <Copy className="h-3.5 w-3.5" />
                                </Button>
                                <Button variant="ghost" size="sm" onClick={() => void revokeInvite(invitation)}>
                                  Revoke
                                </Button>
                              </>
                            ) : invitation.status === 'expired' ? (
                              <Button variant="secondary" size="sm" onClick={() => void reissueInvite(invitation)}>
                                Re-issue
                              </Button>
                            ) : (
                              <span className="text-[11px] text-slate-400">{invitation.acceptedAt ? `Joined ${formatDate(invitation.acceptedAt)}` : '—'}</span>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <EmptyState
                icon={Mail}
                title="No invitations yet"
                description="Invite a teammate to create their account. Invitations expire after seven days."
                action={<Button size="sm" onClick={() => setInviteOpen(true)}>Invite user</Button>}
              />
            )}
            <p className="mt-3 text-[11px] leading-relaxed text-slate-400">
              This environment has no email provider configured, so invitation links are surfaced here for the Admin to share securely. In production the link would be
              emailed automatically.
            </p>
          </div>
        )}
      </Card>

      {/* Invite modal */}
      <Modal
        open={inviteOpen}
        onClose={() => {
          setInviteOpen(false);
          setInviteLink(null);
          setInviteError(null);
        }}
        title="Invite a teammate"
        description="Only Admins can create accounts. The invite link is single-use and expires in 7 days."
        footer={
          inviteLink ? (
            <Button onClick={() => setInviteOpen(false)}>Done</Button>
          ) : (
            <>
              <Button variant="ghost" onClick={() => setInviteOpen(false)} disabled={inviteBusy}>
                Cancel
              </Button>
              <Button onClick={submitInvite} loading={inviteBusy}>
                <UserPlus className="h-4 w-4" /> Create invitation
              </Button>
            </>
          )
        }
      >
        {inviteLink ? (
          <div className="space-y-3">
            <div className="rounded-xl border border-emerald-200 bg-emerald-50/70 p-3.5 dark:border-emerald-500/25 dark:bg-emerald-500/10">
              <p className="flex items-center gap-1.5 text-[12px] font-semibold text-emerald-800 dark:text-emerald-200">
                <Check className="h-3.5 w-3.5" /> Invitation created
              </p>
              <p className="mt-1 text-[11.5px] leading-relaxed text-emerald-700/80 dark:text-emerald-200/70">
                Share this one-time link with the invitee. They will set their own password and activate the account.
              </p>
            </div>
            <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 p-2 dark:border-white/10 dark:bg-white/[0.04]">
              <code className="min-w-0 flex-1 truncate text-[11px] text-slate-600 dark:text-slate-300">{inviteLink}</code>
              <Button variant="secondary" size="sm" onClick={() => void copy(inviteLink)}>
                <Copy className="h-3.5 w-3.5" /> Copy
              </Button>
            </div>
            <p className="text-[11px] text-slate-400">No email provider is configured in this environment, so the link is shown instead of being emailed.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {inviteError ? (
              <div role="alert" className="rounded-xl border border-rose-200 bg-rose-50 px-3.5 py-2.5 text-[12.5px] font-medium text-rose-700 dark:border-rose-500/25 dark:bg-rose-500/10 dark:text-rose-300">
                {inviteError}
              </div>
            ) : null}
            <Field label="Full name" required>
              <Input value={inviteForm.fullName} onChange={(event) => setInviteForm((prev) => ({ ...prev, fullName: event.target.value }))} placeholder="e.g. Arjun Mehta" autoFocus />
            </Field>
            <Field label="Work email" required>
              <Input type="email" value={inviteForm.email} onChange={(event) => setInviteForm((prev) => ({ ...prev, email: event.target.value }))} placeholder="arjun@company.com" />
            </Field>
            <Field label="Role" hint="Admins can manage users and change status. Give this carefully.">
              <Select value={inviteForm.role} onChange={(event) => setInviteForm((prev) => ({ ...prev, role: event.target.value as Role }))}>
                <option value="member">Team Member — submit and track reports</option>
                <option value="admin">Admin — full access including user management</option>
              </Select>
            </Field>
          </div>
        )}
      </Modal>

      {/* Role change */}
      <ConfirmDialog
        open={Boolean(roleTarget)}
        title="Change this person’s role?"
        description={
          <span>
            {roleTarget?.user.fullName} will become <span className="font-semibold">{roleTarget ? ROLE_LABEL[roleTarget.role] : ''}</span>. Their active sessions are revoked
            and the change is written to the audit log.
          </span>
        }
        tone="primary"
        confirmLabel="Update role"
        pending={roleBusy}
        onCancel={() => setRoleTarget(null)}
        onConfirm={changeRole}
      >
        {roleTarget ? (
          <Field label="New role">
            <Select value={roleTarget.role} onChange={(event) => setRoleTarget({ ...roleTarget, role: event.target.value as Role })}>
              <option value="member">Team Member</option>
              <option value="admin">Admin</option>
            </Select>
          </Field>
        ) : null}
      </ConfirmDialog>

      {/* Status change */}
      <ConfirmDialog
        open={Boolean(statusTarget)}
        title={statusTarget?.accountStatus === 'active' ? 'Deactivate this account?' : 'Reactivate this account?'}
        description={
          statusTarget?.accountStatus === 'active'
            ? `${statusTarget?.fullName} will be signed out immediately and blocked from all protected data until reactivated.`
            : `${statusTarget?.fullName} will regain access with their existing role and password.`
        }
        tone={statusTarget?.accountStatus === 'active' ? 'danger' : 'primary'}
        confirmLabel={statusTarget?.accountStatus === 'active' ? 'Deactivate' : 'Activate'}
        pending={statusBusy}
        onCancel={() => setStatusTarget(null)}
        onConfirm={changeStatus}
      />

      {/* Reset password */}
      <Modal
        open={Boolean(resetTarget)}
        onClose={() => {
          setResetTarget(null);
          setTempPassword(null);
        }}
        title="Reset password"
        description={`A temporary password will be generated for ${resetTarget?.fullName ?? ''} and all their sessions will be signed out.`}
        footer={
          tempPassword ? (
            <Button onClick={() => { setResetTarget(null); setTempPassword(null); }}>Done</Button>
          ) : (
            <>
              <Button variant="ghost" onClick={() => setResetTarget(null)} disabled={resetBusy}>
                Cancel
              </Button>
              <Button onClick={resetPassword} loading={resetBusy}>
                <KeyRound className="h-4 w-4" /> Generate password
              </Button>
            </>
          )
        }
      >
        {tempPassword ? (
          <div className="space-y-3">
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 dark:border-white/10 dark:bg-white/[0.04]">
              <p className="text-[10.5px] font-semibold uppercase tracking-wide text-slate-400">Temporary password</p>
              <div className="mt-1 flex items-center gap-2">
                <code className="flex-1 font-mono text-[15px] font-semibold text-slate-800 dark:text-slate-100">{tempPassword}</code>
                <Button variant="secondary" size="sm" onClick={() => void copy(tempPassword, 'Temporary password copied')}>
                  <Copy className="h-3.5 w-3.5" /> Copy
                </Button>
              </div>
            </div>
            <p className="text-[11.5px] leading-relaxed text-slate-500 dark:text-slate-400">
              Share this securely and ask the teammate to change it from <span className="font-medium">My profile → Security</span> after signing in. It is not shown
              again.
            </p>
          </div>
        ) : (
          <p className="text-[12.5px] leading-relaxed text-slate-600 dark:text-slate-300">
            Prefer asking the user to use <span className="font-medium">Forgot password</span> on the sign-in page? That flow keeps the password private to them.
          </p>
        )}
      </Modal>

      {/* Activity modal */}
      <Modal
        open={Boolean(activityTarget)}
        onClose={() => setActivityTarget(null)}
        title={activityTarget?.fullName ?? 'Profile'}
        description={activityTarget?.email}
        size="lg"
      >
        {activity.loading ? (
          <TableSkeleton rows={4} columns={3} />
        ) : activity.data ? (
          <div className="space-y-5">
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {[
                { label: 'Submitted', value: activity.data.counts.submitted },
                { label: 'Assigned', value: activity.data.counts.assigned },
                { label: 'Resolved', value: activity.data.counts.resolved },
                { label: 'Comments', value: activity.data.counts.comments },
              ].map((item) => (
                <div key={item.label} className="rounded-xl bg-slate-50 p-3 text-center dark:bg-white/[0.04]">
                  <p className="text-[18px] font-bold leading-none text-slate-900 dark:text-white">{item.value}</p>
                  <p className="mt-1 text-[10px] font-semibold uppercase tracking-wide text-slate-400">{item.label}</p>
                </div>
              ))}
            </div>

            <div>
              <p className="text-[10.5px] font-semibold uppercase tracking-wide text-slate-400">Role &amp; account</p>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <Badge color={ROLE_TONE[activity.data.user.role]}>{ROLE_LABEL[activity.data.user.role]}</Badge>
                <Badge color={activity.data.user.accountStatus === 'active' ? 'emerald' : 'slate'}>{activity.data.user.accountStatus}</Badge>
                <span className="text-[11px] text-slate-400">Joined {formatDate(activity.data.user.createdAt)}</span>
                <span className="text-[11px] text-slate-400">· Last sign-in {activity.data.user.lastLoginAt ? formatDateTime(activity.data.user.lastLoginAt) : 'never'}</span>
              </div>
            </div>

            <div>
              <p className="text-[10.5px] font-semibold uppercase tracking-wide text-slate-400">Recent reports</p>
              <div className="mt-2 space-y-1.5">
                {activity.data.recentErrors.length ? (
                  activity.data.recentErrors.map((item) => (
                    <Link
                      key={item.id}
                      to={`/errors/${item.id}`}
                      onClick={() => setActivityTarget(null)}
                      className="flex items-center gap-2 rounded-lg border border-slate-100 px-2.5 py-2 transition hover:border-brand-200 hover:bg-brand-50/30 dark:border-white/[0.06] dark:hover:border-brand-500/30 dark:hover:bg-brand-500/[0.06]"
                    >
                      <span className="font-mono text-[9.5px] font-semibold uppercase text-brand-600 dark:text-brand-300">{item.errorCode}</span>
                      <span className="min-w-0 flex-1 truncate text-[12px] text-slate-700 dark:text-slate-200">{item.title}</span>
                      <StatusBadge status={item.status} size="sm" />
                    </Link>
                  ))
                ) : (
                  <p className="text-[11.5px] text-slate-400">No reports yet.</p>
                )}
              </div>
            </div>

            <div>
              <p className="text-[10.5px] font-semibold uppercase tracking-wide text-slate-400">Activity</p>
              <div className="mt-2 space-y-1.5">
                {activity.data.activity.slice(0, 8).map((item) => (
                  <div key={item.id} className="flex items-center justify-between gap-3 rounded-lg bg-slate-50 px-2.5 py-1.5 dark:bg-white/[0.03]">
                    <span className="truncate text-[11.5px] text-slate-600 dark:text-slate-300">{item.action.replace(/[._]/g, ' ')}</span>
                    <span className="shrink-0 text-[10px] text-slate-400">{relativeTime(item.createdAt)}</span>
                  </div>
                ))}
                {!activity.data.activity.length ? <p className="text-[11.5px] text-slate-400">No recorded activity.</p> : null}
              </div>
            </div>
          </div>
        ) : null}
      </Modal>
    </div>
  );
}
