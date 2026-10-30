import { useState } from 'react';
import { Save, UserRound } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/contexts/ToastContext';
import { api, ApiError } from '@/lib/api';
import type { User } from '@/lib/types';
import { ROLE_LABEL } from '@/lib/constants';
import { Avatar } from '@/components/ui/Avatar';
import { Button } from '@/components/ui/Button';
import { Field, Input } from '@/components/ui/Field';
import { Badge } from '@/components/ui/Badge';

export function ProfileForm() {
  const { user, refresh } = useAuth();
  const toast = useToast();
  const [form, setForm] = useState({
    fullName: user?.fullName ?? '',
    jobTitle: user?.jobTitle ?? '',
    department: user?.department ?? '',
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await api.patch<{ user: User }>('/api/users/profile', form);
      await refresh();
      toast.success('Profile updated');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not save your profile.');
    } finally {
      setBusy(false);
    }
  };

  if (!user) return null;

  return (
    <div className="grid gap-5 lg:grid-cols-[1fr_280px]">
      <form onSubmit={submit} className="space-y-4">
        {error ? (
          <div role="alert" className="rounded-xl border border-rose-200 bg-rose-50 px-3.5 py-2.5 text-[12.5px] font-medium text-rose-700 dark:border-rose-500/25 dark:bg-rose-500/10 dark:text-rose-300">
            {error}
          </div>
        ) : null}
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Full name" required>
            <Input value={form.fullName} onChange={(event) => setForm((prev) => ({ ...prev, fullName: event.target.value }))} required />
          </Field>
          <Field label="Email" hint="Contact an Admin if this needs to change.">
            <Input value={user.email} disabled />
          </Field>
          <Field label="Job title">
            <Input value={form.jobTitle} onChange={(event) => setForm((prev) => ({ ...prev, jobTitle: event.target.value }))} placeholder="e.g. QA Engineer" />
          </Field>
          <Field label="Department">
            <Input value={form.department} onChange={(event) => setForm((prev) => ({ ...prev, department: event.target.value }))} placeholder="e.g. Quality Engineering" />
          </Field>
        </div>
        <div className="flex justify-end">
          <Button type="submit" loading={busy}>
            <Save className="h-4 w-4" /> Save profile
          </Button>
        </div>
      </form>

      <div className="rounded-2xl border border-slate-200/80 bg-slate-50/60 p-4 text-center dark:border-white/10 dark:bg-white/[0.02]">
        <Avatar name={user.fullName} tone={user.avatarTone} size="lg" className="mx-auto" />
        <p className="mt-2.5 text-[13px] font-semibold text-slate-800 dark:text-slate-100">{user.fullName}</p>
        <p className="text-[11px] text-slate-500 dark:text-slate-400">{user.jobTitle || 'Team member'}</p>
        <div className="mt-2 flex justify-center">
          <Badge color={user.role === 'admin' ? 'indigo' : 'slate'} size="sm">
            {ROLE_LABEL[user.role]}
          </Badge>
        </div>
        <div className="mt-3 space-y-1.5 border-t border-slate-200/70 pt-3 text-left text-[11px] text-slate-500 dark:border-white/10 dark:text-slate-400">
          <p className="flex items-center gap-1.5">
            <UserRound className="h-3 w-3" /> Account: {user.accountStatus}
          </p>
          <p>Role changes are restricted to Admins and audited.</p>
        </div>
      </div>
    </div>
  );
}

export function SecurityForm() {
  const toast = useToast();
  const [form, setForm] = useState({ currentPassword: '', newPassword: '', confirm: '' });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (form.newPassword !== form.confirm) {
      setError('New passwords do not match.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await api.post('/api/auth/change-password', {
        currentPassword: form.currentPassword,
        newPassword: form.newPassword,
      });
      toast.success('Password changed', 'Use your new password the next time you sign in.');
      setForm({ currentPassword: '', newPassword: '', confirm: '' });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not change your password.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} className="max-w-lg space-y-4">
      {error ? (
        <div role="alert" className="rounded-xl border border-rose-200 bg-rose-50 px-3.5 py-2.5 text-[12.5px] font-medium text-rose-700 dark:border-rose-500/25 dark:bg-rose-500/10 dark:text-rose-300">
          {error}
        </div>
      ) : null}
      <Field label="Current password" required>
        <Input type="password" value={form.currentPassword} onChange={(event) => setForm((prev) => ({ ...prev, currentPassword: event.target.value }))} autoComplete="current-password" required />
      </Field>
      <Field label="New password" required hint="At least 8 characters with letters and numbers.">
        <Input type="password" value={form.newPassword} onChange={(event) => setForm((prev) => ({ ...prev, newPassword: event.target.value }))} autoComplete="new-password" required minLength={8} />
      </Field>
      <Field label="Confirm new password" required>
        <Input type="password" value={form.confirm} onChange={(event) => setForm((prev) => ({ ...prev, confirm: event.target.value }))} autoComplete="new-password" required minLength={8} />
      </Field>
      <Button type="submit" loading={busy}>
        Update password
      </Button>
    </form>
  );
}
