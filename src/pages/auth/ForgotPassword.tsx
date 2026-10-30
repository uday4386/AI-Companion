import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, KeyRound, Mail, ShieldCheck } from 'lucide-react';
import { AuthShell, FormError } from './AuthShell';
import { Field, Input } from '@/components/ui/Field';
import { Button } from '@/components/ui/Button';
import { api, ApiError } from '@/lib/api';

interface ForgotResponse {
  ok: boolean;
  message: string;
  devResetUrl?: string;
  devNote?: string;
}

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ForgotResponse | null>(null);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const data = await api.post<ForgotResponse>('/api/auth/forgot-password', { email });
      setResult(data);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not create a reset link.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthShell
      title="Reset your password"
      subtitle="Enter your work email and we will generate a secure, single-use reset link that expires in one hour."
      footer={
        <Link to="/login" className="inline-flex items-center gap-1.5 text-[12.5px] font-medium text-slate-500 hover:text-brand-600 dark:text-slate-400 dark:hover:text-brand-300">
          <ArrowLeft className="h-3.5 w-3.5" /> Back to sign in
        </Link>
      }
    >
      <FormError message={error} />
      {result ? (
        <div className="space-y-4">
          <div className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-white/10 dark:bg-white/[0.03]">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-50 text-brand-600 dark:bg-brand-500/15 dark:text-brand-300">
              <ShieldCheck className="h-4 w-4" />
            </span>
            <p className="mt-2.5 text-[13px] leading-relaxed text-slate-600 dark:text-slate-300">{result.message}</p>
          </div>
          {result.devResetUrl ? (
            <div className="rounded-2xl border border-amber-200 bg-amber-50/80 p-4 dark:border-amber-500/25 dark:bg-amber-500/10">
              <p className="text-[10.5px] font-semibold uppercase tracking-wider text-amber-700 dark:text-amber-300">Development environment</p>
              <p className="mt-1 text-[12px] leading-relaxed text-amber-800/80 dark:text-amber-200/70">{result.devNote}</p>
              <Link to={result.devResetUrl}>
                <Button size="sm" className="mt-3" variant="secondary">
                  <KeyRound className="h-3.5 w-3.5" /> Open reset link
                </Button>
              </Link>
            </div>
          ) : null}
        </div>
      ) : (
        <form onSubmit={submit} className="space-y-4">
          <Field label="Work email" htmlFor="email" required>
            <Input
              id="email"
              type="email"
              placeholder="you@company.com"
              leadingIcon={Mail}
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              required
              autoFocus
            />
          </Field>
          <Button type="submit" fullWidth size="lg" loading={loading}>
            Send reset link
          </Button>
        </form>
      )}
    </AuthShell>
  );
}
