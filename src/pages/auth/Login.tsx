import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { ArrowRight, Eye, EyeOff, KeyRound, Mail, ShieldCheck, UserRound } from 'lucide-react';
import { AuthShell, FormError } from './AuthShell';
import { Field, Input } from '@/components/ui/Field';
import { Button } from '@/components/ui/Button';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/contexts/ToastContext';
import { ApiError } from '@/lib/api';

const DEMO_ACCOUNTS = [
  { label: 'Admin', email: 'admin@entt.dev', icon: ShieldCheck, description: 'Full queue, users, reports' },
  { label: 'Team Member', email: 'member@entt.dev', icon: UserRound, description: 'Submit and track reports' },
];

const DEMO_PASSWORD = 'Passw0rd!';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const toast = useToast();
  const from = (location.state as { from?: string } | null)?.from;

  const submit = async (event: React.FormEvent, credentials?: { email: string; password: string }) => {
    event.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const user = await login(credentials?.email ?? email, credentials?.password ?? password);
      toast.success(`Welcome back, ${user.fullName.split(' ')[0]}`);
      navigate(from && from !== '/login' ? from : '/dashboard', { replace: true });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Unable to sign in. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthShell
      title="Sign in to Sentinel"
      subtitle="Use your work account. Access is granted by an administrator — there is no public sign-up."
      footer={
        <div className="space-y-5">
          <p className="text-center text-[12.5px] text-slate-500 dark:text-slate-400">
            Need an account?{' '}
            <Link to="/request-access" className="link">
              Request access
            </Link>
          </p>

          <div className="rounded-2xl border border-slate-200/80 bg-white/70 p-3.5 dark:border-white/10 dark:bg-white/[0.03]">
            <p className="mb-2.5 text-[10.5px] font-semibold uppercase tracking-[0.12em] text-slate-400">Demo accounts</p>
            <div className="grid gap-2 sm:grid-cols-2">
              {DEMO_ACCOUNTS.map((account) => (
                <button
                  key={account.email}
                  type="button"
                  onClick={(event) => {
                    setEmail(account.email);
                    setPassword(DEMO_PASSWORD);
                    void submit(event as unknown as React.FormEvent, { email: account.email, password: DEMO_PASSWORD });
                  }}
                  className="group flex items-center gap-2.5 rounded-xl border border-slate-200 bg-white px-2.5 py-2 text-left transition hover:border-brand-300 hover:bg-brand-50/40 dark:border-white/10 dark:bg-white/[0.04] dark:hover:border-brand-500/40 dark:hover:bg-brand-500/[0.08]"
                >
                  <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-brand-50 text-brand-600 dark:bg-brand-500/15 dark:text-brand-300">
                    <account.icon className="h-3.5 w-3.5" />
                  </span>
                  <span className="min-w-0">
                    <span className="block text-[12px] font-semibold text-slate-800 dark:text-slate-100">{account.label}</span>
                    <span className="block truncate text-[10px] text-slate-500 dark:text-slate-400">{account.description}</span>
                  </span>
                </button>
              ))}
            </div>
            <p className="mt-2 text-[10.5px] text-slate-400">
              Password for every demo account: <span className="font-mono text-slate-500 dark:text-slate-400">{DEMO_PASSWORD}</span>
            </p>
          </div>
        </div>
      }
    >
      <FormError message={error} />
      <form onSubmit={submit} className="space-y-4">
        <Field label="Work email" htmlFor="email" required>
          <Input
            id="email"
            type="email"
            autoComplete="username"
            placeholder="you@company.com"
            leadingIcon={Mail}
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            required
            autoFocus
          />
        </Field>

        <Field label="Password" htmlFor="password" required>
          <div className="relative">
            <KeyRound className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <Input
              id="password"
              type={showPassword ? 'text' : 'password'}
              autoComplete="current-password"
              placeholder="Enter your password"
              className="pl-9 pr-10"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              required
            />
            <button
              type="button"
              onClick={() => setShowPassword((value) => !value)}
              className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-1.5 text-slate-400 transition hover:text-slate-600 dark:hover:text-slate-200"
              aria-label={showPassword ? 'Hide password' : 'Show password'}
            >
              {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
        </Field>

        <div className="flex items-center justify-between">
          <span className="text-[11.5px] text-slate-400 dark:text-slate-500">Sessions expire after 7 days of inactivity</span>
          <Link to="/forgot-password" className="text-[12px] font-medium text-brand-600 hover:underline dark:text-brand-300">
            Forgot password?
          </Link>
        </div>

        <Button type="submit" fullWidth size="lg" loading={loading} className="mt-2">
          Sign in <ArrowRight className="h-4 w-4" />
        </Button>
      </form>
    </AuthShell>
  );
}
