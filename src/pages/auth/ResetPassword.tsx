import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowLeft, CheckCircle2, Eye, EyeOff, KeyRound } from 'lucide-react';
import { AuthShell, FormError } from './AuthShell';
import { Field, Input } from '@/components/ui/Field';
import { Button } from '@/components/ui/Button';
import { api, ApiError } from '@/lib/api';

export default function ResetPasswordPage() {
  const [params] = useSearchParams();
  const token = params.get('token') ?? '';
  const navigate = useNavigate();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [show, setShow] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (password !== confirm) {
      setError('Passwords do not match.');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      await api.post('/api/auth/reset-password', { token, newPassword: password });
      setDone(true);
      window.setTimeout(() => navigate('/login', { replace: true }), 2600);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not reset your password.');
    } finally {
      setLoading(false);
    }
  };

  if (!token) {
    return (
      <AuthShell title="Reset link missing" subtitle="This page needs a valid reset token from your email.">
        <div className="rounded-2xl border border-amber-200 bg-amber-50/70 p-4 text-[13px] text-amber-800 dark:border-amber-500/25 dark:bg-amber-500/10 dark:text-amber-200">
          The reset link is incomplete. Request a new link from the sign-in page.
        </div>
        <Link to="/forgot-password">
          <Button className="mt-4" fullWidth>
            Request a new link
          </Button>
        </Link>
      </AuthShell>
    );
  }

  return (
    <AuthShell
      title={done ? 'Password updated' : 'Choose a new password'}
      subtitle={done ? 'You can now sign in with your new password.' : 'Use at least 8 characters, including letters and numbers.'}
      footer={
        <Link to="/login" className="inline-flex items-center gap-1.5 text-[12.5px] font-medium text-slate-500 hover:text-brand-600 dark:text-slate-400 dark:hover:text-brand-300">
          <ArrowLeft className="h-3.5 w-3.5" /> Back to sign in
        </Link>
      }
    >
      {done ? (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50/70 p-5 dark:border-emerald-500/25 dark:bg-emerald-500/10">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-white text-emerald-600 shadow-sm dark:bg-emerald-500/20 dark:text-emerald-300">
            <CheckCircle2 className="h-5 w-5" />
          </span>
          <p className="mt-3 text-[13px] text-emerald-800 dark:text-emerald-200">All previous sessions were signed out. Redirecting to sign in…</p>
        </div>
      ) : (
        <form onSubmit={submit} className="space-y-4">
          <FormError message={error} />
          <Field label="New password" htmlFor="password" required>
            <div className="relative">
              <KeyRound className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <Input
                id="password"
                type={show ? 'text' : 'password'}
                className="pl-9 pr-10"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                required
                minLength={8}
                autoFocus
              />
              <button
                type="button"
                onClick={() => setShow((value) => !value)}
                className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-1.5 text-slate-400 hover:text-slate-600"
                aria-label={show ? 'Hide password' : 'Show password'}
              >
                {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </Field>
          <Field label="Confirm password" htmlFor="confirm" required>
            <Input
              id="confirm"
              type={show ? 'text' : 'password'}
              value={confirm}
              onChange={(event) => setConfirm(event.target.value)}
              required
              minLength={8}
            />
          </Field>
          <Button type="submit" fullWidth size="lg" loading={loading}>
            Update password
          </Button>
        </form>
      )}
    </AuthShell>
  );
}
