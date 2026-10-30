import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useFetch } from '@/hooks/useFetch';
import { AuthShell, FormError } from './AuthShell';
import { Field, Input } from '@/components/ui/Field';
import { Button } from '@/components/ui/Button';
import { PageLoader } from '@/components/ui/Spinner';
import { EmptyState } from '@/components/ui/EmptyState';
import { api, ApiError, tokenStore } from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/contexts/ToastContext';
import { ROLE_LABEL } from '@/lib/constants';
import type { Role } from '@/lib/types';

interface InvitationPreview {
  invitation: { email: string; fullName: string; role: Role; status: 'pending' | 'accepted' | 'revoked' | 'expired' };
}

export default function AcceptInvitationPage() {
  const { token = '' } = useParams();
  const { data, loading, error } = useFetch<InvitationPreview>(`/api/auth/invitation/${token}`);
  const [fullName, setFullName] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [formError, setFormError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const navigate = useNavigate();
  const { refresh } = useAuth();
  const toast = useToast();

  const invitation = data?.invitation;

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (password !== confirm) {
      setFormError('Passwords do not match.');
      return;
    }
    setPending(true);
    setFormError(null);
    try {
      const result = await api.post<{ token: string }>('/api/auth/accept-invitation', {
        token,
        password,
        fullName: fullName || invitation?.fullName,
      });
      tokenStore.set(result.token);
      await refresh();
      toast.success('Account activated', 'Welcome to Sentinel.');
      navigate('/dashboard', { replace: true });
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : 'Could not activate your account.');
    } finally {
      setPending(false);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <PageLoader label="Validating invitation…" />
      </div>
    );
  }

  if (error || !invitation) {
    return (
      <AuthShell title="Invitation not found" subtitle="This link may be incomplete or has already been used.">
        <div className="card">
          <EmptyState
            title="We could not validate this invitation"
            description={error ?? 'Ask an administrator to issue a new invitation link.'}
            action={
              <Link to="/login">
                <Button variant="secondary">Go to sign in</Button>
              </Link>
            }
          />
        </div>
      </AuthShell>
    );
  }

  if (invitation.status !== 'pending') {
    const copy: Record<string, string> = {
      accepted: 'This invitation has already been used. Sign in with the password you created.',
      revoked: 'An administrator revoked this invitation. Request access again if you still need an account.',
      expired: 'This invitation has expired. Ask an administrator to re-issue it from User management.',
    };
    return (
      <AuthShell title="Invitation unavailable" subtitle={copy[invitation.status] ?? 'This invitation can no longer be used.'}>
        <Link to="/login">
          <Button fullWidth>Go to sign in</Button>
        </Link>
      </AuthShell>
    );
  }

  return (
    <AuthShell
      title={`Join Sentinel, ${invitation.fullName.split(' ')[0]}`}
      subtitle={`${invitation.email} has been invited as a ${ROLE_LABEL[invitation.role]}. Set a password to activate the account.`}
      footer={
        <p className="text-center text-[11.5px] text-slate-400">
          Invitation links are single-use and expire automatically. Never share yours.
        </p>
      }
    >
      <div className="mb-4 flex items-center justify-between rounded-xl border border-brand-200/70 bg-brand-50/60 px-3.5 py-2.5 text-[12px] dark:border-brand-500/20 dark:bg-brand-500/[0.08]">
        <span className="text-brand-800 dark:text-brand-200">
          Role: <span className="font-semibold">{ROLE_LABEL[invitation.role]}</span>
        </span>
        <span className="inline-flex items-center gap-1 text-[10.5px] font-medium uppercase tracking-wide text-brand-600/80 dark:text-brand-300/80">
          One-time link
        </span>
      </div>

      <FormError message={formError} />
      <form onSubmit={submit} className="space-y-4">
        <Field label="Full name" htmlFor="fullName" required>
          <Input id="fullName" defaultValue={invitation.fullName} onChange={(event) => setFullName(event.target.value)} required />
        </Field>
        <Field label="Create password" htmlFor="password" required hint="Minimum 8 characters with at least one letter and one number.">
          <Input id="password" type="password" value={password} onChange={(event) => setPassword(event.target.value)} required minLength={8} autoFocus />
        </Field>
        <Field label="Confirm password" htmlFor="confirm" required>
          <Input id="confirm" type="password" value={confirm} onChange={(event) => setConfirm(event.target.value)} required minLength={8} />
        </Field>
        <Button type="submit" fullWidth size="lg" loading={pending}>
          Activate account
        </Button>
      </form>
    </AuthShell>
  );
}
