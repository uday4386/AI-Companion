import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import {
  AppWindow,
  Check,
  Eye,
  Globe2,
  KeyRound,
  Layers,
  Palette,
  Plus,
  Save,
  ShieldCheck,
  SlidersHorizontal,
  Upload,
  UserRound,
} from 'lucide-react';
import clsx from 'clsx';
import { useAuth } from '@/contexts/AuthContext';
import { useFetch } from '@/hooks/useFetch';
import { useToast } from '@/contexts/ToastContext';
import { api, ApiError } from '@/lib/api';
import type { Application } from '@/lib/types';
import { APPLICATION_COLORS, tone } from '@/lib/constants';
import { PageHeader } from '@/components/layout/Topbar';
import { Card, CardBody, CardHeader } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Field, Input, Select, Textarea } from '@/components/ui/Field';
import { Switch } from '@/components/ui/Switch';
import { Badge } from '@/components/ui/Badge';
import { Modal } from '@/components/ui/Modal';
import { Tabs } from '@/components/ui/Tabs';
import { Skeleton } from '@/components/ui/Spinner';
import { ProfileForm, SecurityForm } from '@/components/settings/ProfileForm';

interface ApplicationsResponse {
  applications: Application[];
}

export default function SettingsPage() {
  const { user, settings, refresh, visibility } = useAuth();
  const [params, setParams] = useSearchParams();
  const isAdmin = user?.role === 'admin';
  const tab = params.get('tab') ?? (isAdmin ? 'workspace' : 'profile');

  const tabs = [
    ...(isAdmin
      ? [
          { value: 'workspace', label: 'Workspace', icon: SlidersHorizontal },
          { value: 'applications', label: 'Applications', icon: AppWindow },
        ]
      : []),
    { value: 'profile', label: 'Profile', icon: UserRound },
    { value: 'security', label: 'Security', icon: KeyRound },
  ];

  const changeTab = (value: string) => {
    const next = new URLSearchParams(params);
    next.set('tab', value);
    setParams(next, { replace: true });
  };

  return (
    <div className="animate-fade-in">
      <PageHeader
        breadcrumb={[{ label: isAdmin ? 'Administration' : 'Account' }, { label: 'Settings' }]}
        title="Settings"
        description={isAdmin ? 'Control workspace policy, applications and your own account security.' : 'Manage your profile details and password.'}
      />

      <div className="mb-4">
        <Tabs items={tabs} value={tab} onChange={changeTab} variant="pill" />
      </div>

      {tab === 'workspace' && isAdmin ? <WorkspaceSettings /> : null}
      {tab === 'applications' && isAdmin ? <ApplicationsSettings /> : null}
      {tab === 'profile' ? (
        <Card>
          <CardHeader icon={UserRound} title="Profile" description="How your name appears on reports, comments and notifications" />
          <CardBody>
            <ProfileForm />
          </CardBody>
        </Card>
      ) : null}
      {tab === 'security' ? (
        <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
          <Card>
            <CardHeader icon={KeyRound} title="Password" description="Passwords are hashed with scrypt and never stored in plain text" />
            <CardBody>
              <SecurityForm />
            </CardBody>
          </Card>
          <div className="space-y-4">
            <Card>
              <CardHeader icon={ShieldCheck} title="Session & access" />
              <CardBody className="space-y-2.5 text-[12px] text-slate-600 dark:text-slate-300">
                <p className="rounded-lg bg-slate-50 p-3 dark:bg-white/[0.04]">
                  Sessions expire after 7 days. Changing your password or role signs out other sessions.
                </p>
                <p className="rounded-lg bg-slate-50 p-3 dark:bg-white/[0.04]">
                  Your role: <span className="font-semibold">{user?.role === 'admin' ? 'Admin' : 'Team Member'}</span>. Roles can only be changed by an Admin.
                </p>
                <p className="rounded-lg bg-slate-50 p-3 dark:bg-white/[0.04]">
                  Visibility policy: <span className="font-semibold">{visibility || 'own or assigned'}</span>.
                </p>
              </CardBody>
            </Card>
            <Card>
              <CardHeader icon={Eye} title="Need to change more?" />
              <CardBody className="text-[12px] leading-relaxed text-slate-600 dark:text-slate-300">
                Your email address and department are managed by an Admin.{' '}
                {isAdmin ? (
                  <Link to="/users" className="link">
                    Open user management
                  </Link>
                ) : (
                  <span>Ask your Admin to make those changes.</span>
                )}
              </CardBody>
            </Card>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function WorkspaceSettings() {
  const { settings, refresh, visibility } = useAuth();
  const toast = useToast();
  const [form, setForm] = useState({
    team_visibility: settings.team_visibility ?? 'own_or_assigned',
    allow_member_submissions: settings.allow_member_submissions ?? 'true',
    require_reason_for_closure: settings.require_reason_for_closure ?? 'true',
    max_upload_mb: settings.max_upload_mb ?? '5',
  });
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setForm({
      team_visibility: settings.team_visibility ?? 'own_or_assigned',
      allow_member_submissions: settings.allow_member_submissions ?? 'true',
      require_reason_for_closure: settings.require_reason_for_closure ?? 'true',
      max_upload_mb: settings.max_upload_mb ?? '5',
    });
  }, [settings]);

  const save = async () => {
    setBusy(true);
    try {
      await api.patch('/api/settings', form);
      await refresh();
      toast.success('Workspace policy saved', 'The change applies immediately for every user.');
    } catch (err) {
      toast.error('Could not save settings', err instanceof ApiError ? err.message : undefined);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
      <div className="space-y-4">
        <Card>
          <CardHeader icon={Eye} title="Record visibility" description="Decides which errors a Team Member can see" />
          <CardBody className="space-y-3">
            {[
              {
                value: 'own_or_assigned',
                title: 'Own and assigned reports',
                description: 'Members see only the errors they submitted or were assigned to. Recommended for sensitive environments.',
                icon: UserRound,
              },
              {
                value: 'team_wide',
                title: 'All team reports',
                description: 'Members see every report. They still cannot change status, assign work or manage users.',
                icon: Globe2,
              },
            ].map((option) => {
              const active = form.team_visibility === option.value;
              return (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => setForm((prev) => ({ ...prev, team_visibility: option.value }))}
                  className={clsx(
                    'flex w-full items-start gap-3 rounded-xl border p-3.5 text-left transition',
                    active
                      ? 'border-brand-300 bg-brand-50/50 ring-2 ring-brand-500/10 dark:border-brand-500/40 dark:bg-brand-500/[0.08]'
                      : 'border-slate-200 bg-white hover:border-brand-200 dark:border-white/10 dark:bg-white/[0.03] dark:hover:border-brand-500/30',
                  )}
                >
                  <span
                    className={clsx(
                      'flex h-8 w-8 shrink-0 items-center justify-center rounded-lg',
                      active ? 'bg-brand-600 text-white' : 'bg-slate-100 text-slate-500 dark:bg-white/[0.06] dark:text-slate-300',
                    )}
                  >
                    <option.icon className="h-4 w-4" />
                  </span>
                  <span className="flex-1">
                    <span className="flex items-center gap-2 text-[13px] font-semibold text-slate-800 dark:text-slate-100">
                      {option.title}
                      {active ? <Check className="h-3.5 w-3.5 text-brand-600 dark:text-brand-300" /> : null}
                    </span>
                    <span className="mt-0.5 block text-[11.5px] leading-relaxed text-slate-500 dark:text-slate-400">{option.description}</span>
                  </span>
                </button>
              );
            })}
          </CardBody>
        </Card>

        <Card>
          <CardHeader icon={SlidersHorizontal} title="Submission policy" description="Who can create reports and what evidence is accepted" />
          <CardBody className="space-y-4">
            <Switch
              checked={form.allow_member_submissions === 'true'}
              onChange={(value) => setForm((prev) => ({ ...prev, allow_member_submissions: value ? 'true' : 'false' }))}
              label="Allow Team Members to submit errors"
              description="When off, only Admins can create reports."
            />
            <div className="h-px bg-slate-100 dark:bg-white/[0.06]" />
            <Switch
              checked={form.require_reason_for_closure === 'true'}
              onChange={(value) => setForm((prev) => ({ ...prev, require_reason_for_closure: value ? 'true' : 'false' }))}
              label="Require a reason when closing or rejecting"
              description="Reasons are stored in the status history and visible to the submitter."
            />
            <div className="h-px bg-slate-100 dark:bg-white/[0.06]" />
            <Field label="Maximum attachment size" hint="Applies to every new upload. Existing files are unaffected.">
              <Select value={form.max_upload_mb} onChange={(event) => setForm((prev) => ({ ...prev, max_upload_mb: event.target.value }))} className="max-w-[180px]">
                {['1', '2', '5', '10', '20'].map((value) => (
                  <option key={value} value={value}>
                    {value} MB
                  </option>
                ))}
              </Select>
            </Field>
          </CardBody>
        </Card>

        <div className="flex justify-end">
          <Button onClick={save} loading={busy}>
            <Save className="h-4 w-4" /> Save workspace settings
          </Button>
        </div>
      </div>

      <div className="space-y-4">
        <Card>
          <CardHeader icon={ShieldCheck} title="Non-negotiable controls" />
          <CardBody className="space-y-2 text-[11.5px] leading-relaxed text-slate-600 dark:text-slate-300">
            {[
              'Only Admins can change error status, enforced on the server.',
              'Only Admins can invite, approve, deactivate or change roles.',
              'Every attempt to use an admin-only endpoint is logged, including failures.',
              'Attachments are stored privately and only served to authorised users.',
            ].map((item) => (
              <p key={item} className="flex gap-2 rounded-lg bg-slate-50 p-2.5 dark:bg-white/[0.04]">
                <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-500" /> {item}
              </p>
            ))}
          </CardBody>
        </Card>
        <Card>
          <CardHeader icon={Layers} title="Current policy" />
          <CardBody className="space-y-1.5 text-[11.5px] text-slate-600 dark:text-slate-300">
            <p className="flex justify-between gap-2">
              <span className="text-slate-400">Visibility</span>
              <span className="font-semibold text-right">{visibility}</span>
            </p>
            <p className="flex justify-between gap-2">
              <span className="text-slate-400">Member submissions</span>
              <span className="font-semibold">{form.allow_member_submissions === 'true' ? 'Enabled' : 'Admin only'}</span>
            </p>
            <p className="flex justify-between gap-2">
              <span className="text-slate-400">Upload limit</span>
              <span className="font-semibold">{form.max_upload_mb} MB</span>
            </p>
          </CardBody>
        </Card>
      </div>
    </div>
  );
}

function ApplicationsSettings() {
  const toast = useToast();
  const { data, loading, refetch } = useFetch<ApplicationsResponse>('/api/applications', []);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Application | null>(null);
  const [form, setForm] = useState({ name: '', description: '', color: 'indigo' });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const openNew = () => {
    setEditing(null);
    setForm({ name: '', description: '', color: 'indigo' });
    setError(null);
    setModalOpen(true);
  };

  const openEdit = (app: Application) => {
    setEditing(app);
    setForm({ name: app.name, description: app.description ?? '', color: app.color });
    setError(null);
    setModalOpen(true);
  };

  const save = async () => {
    setBusy(true);
    setError(null);
    try {
      if (editing) await api.patch(`/api/applications/${editing.id}`, form);
      else await api.post('/api/applications', form);
      toast.success(editing ? 'Application updated' : 'Application created');
      setModalOpen(false);
      refetch();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not save the application.');
    } finally {
      setBusy(false);
    }
  };

  const toggleActive = async (app: Application) => {
    try {
      await api.patch(`/api/applications/${app.id}`, { isActive: !app.isActive });
      toast.success(app.isActive ? 'Application deactivated' : 'Application activated');
      refetch();
    } catch (err) {
      toast.error('Could not update', err instanceof ApiError ? err.message : undefined);
    }
  };

  return (
    <Card>
      <CardHeader
        icon={AppWindow}
        title="Applications"
        description="The list of systems your team reports errors against. Deactivated applications stay on old reports."
        action={
          <Button size="sm" onClick={openNew}>
            <Plus className="h-3.5 w-3.5" /> Add application
          </Button>
        }
      />
      {loading ? (
        <CardBody className="space-y-3">
          {Array.from({ length: 4 }).map((_, index) => (
            <Skeleton key={index} className="h-16 w-full" />
          ))}
        </CardBody>
      ) : (
        <div className="divide-y divide-slate-100 dark:divide-white/[0.06]">
          {(data?.applications ?? []).map((app) => {
            const classes = tone(app.color);
            return (
              <div key={app.id} className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center">
                <span className={clsx('flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-[13px] font-bold', classes.softBg, classes.text)}>
                  {app.name.slice(0, 2).toUpperCase()}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-[13px] font-semibold text-slate-800 dark:text-slate-100">{app.name}</p>
                    <Badge color={app.isActive ? 'emerald' : 'slate'} size="sm">
                      {app.isActive ? 'Active' : 'Inactive'}
                    </Badge>
                  </div>
                  <p className="mt-0.5 text-[11.5px] text-slate-500 dark:text-slate-400">{app.description || 'No description'}</p>
                  <p className="mt-1 text-[10.5px] text-slate-400">
                    {app.errorCount} reports · {app.openCount} open
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <Switch checked={app.isActive} onChange={() => void toggleActive(app)} size="sm" />
                  <Button variant="secondary" size="sm" onClick={() => openEdit(app)}>
                    Edit
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editing ? 'Edit application' : 'Add application'}
        description="Applications group reports and drive the breakdown charts."
        footer={
          <>
            <Button variant="ghost" onClick={() => setModalOpen(false)} disabled={busy}>
              Cancel
            </Button>
            <Button onClick={save} loading={busy}>
              {editing ? 'Save changes' : 'Create application'}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          {error ? (
            <div role="alert" className="rounded-xl border border-rose-200 bg-rose-50 px-3.5 py-2.5 text-[12.5px] font-medium text-rose-700 dark:border-rose-500/25 dark:bg-rose-500/10 dark:text-rose-300">
              {error}
            </div>
          ) : null}
          <Field label="Name" required>
            <Input value={form.name} onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value }))} placeholder="e.g. Customer Mobile App" autoFocus />
          </Field>
          <Field label="Description">
            <Textarea value={form.description} onChange={(event) => setForm((prev) => ({ ...prev, description: event.target.value }))} rows={2} placeholder="What does this application do?" />
          </Field>
          <Field label="Colour" hint="Used for badges and charts.">
            <div className="flex flex-wrap gap-2">
              {APPLICATION_COLORS.map((color) => (
                <button
                  key={color}
                  type="button"
                  onClick={() => setForm((prev) => ({ ...prev, color }))}
                  className={clsx('flex h-8 w-8 items-center justify-center rounded-lg transition', form.color === color ? 'ring-2 ring-offset-2 ring-slate-400 dark:ring-offset-slate-900' : 'hover:scale-105')}
                  style={{ backgroundColor: tone(color).hex }}
                  aria-label={`Use ${color}`}
                  aria-pressed={form.color === color}
                >
                  {form.color === color ? <Check className="h-4 w-4 text-white" /> : <Palette className="h-3.5 w-3.5 text-white/80" />}
                </button>
              ))}
            </div>
          </Field>
        </div>
      </Modal>
    </Card>
  );
}

export function UploadLimitHint() {
  return (
    <p className="flex items-center gap-1.5 text-[11px] text-slate-400">
      <Upload className="h-3 w-3" /> Upload limits are configurable by Admins.
    </p>
  );
}
