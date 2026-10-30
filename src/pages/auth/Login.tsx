import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { ArrowRight, Eye, EyeOff, KeyRound, UserRound } from 'lucide-react';
import { AuthShell, FormError } from './AuthShell';
import { Field, Input } from '@/components/ui/Field';
import { Button } from '@/components/ui/Button';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/contexts/ToastContext';
import { ApiError } from '@/lib/api';

export default function LoginPage() {
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const toast = useToast();
  const from = (location.state as { from?: string } | null)?.from;

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const user = await login(identifier.trim(), password);
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
        <p className="text-center text-[12.5px] text-slate-500 dark:text-slate-400">
          Need an account?{' '}
          <Link to="/request-access" className="link">
            Request access
          </Link>
        </p>
      }
    >
      <FormError message={error} />
      <form onSubmit={submit} className="space-y-4">
        <Field label="Email or username" htmlFor="identifier" required>
          <Input
            id="identifier"
            type="text"
            autoComplete="username"
            autoCapitalize="none"
            spellCheck={false}
            placeholder="you@company.com or your username"
            leadingIcon={UserRound}
            value={identifier}
            onChange={(event) => setIdentifier(event.target.value)}
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
