import { Link } from 'react-router-dom';
import { ArrowLeft, Compass } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/Button';

export default function NotFoundPage() {
  const { user } = useAuth();
  return (
    <div className="flex min-h-[70vh] items-center justify-center px-4">
      <div className="w-full max-w-md text-center">
        <p className="font-mono text-[12px] font-semibold uppercase tracking-[0.2em] text-brand-500">404</p>
        <h1 className="mt-2 text-[26px] font-bold tracking-tight text-slate-900 dark:text-white">This page took a detour</h1>
        <p className="mt-2 text-[13px] leading-relaxed text-slate-500 dark:text-slate-400">
          The page you requested does not exist, or you no longer have access to it. Check the address or head back to your workspace.
        </p>
        <div className="mt-6 flex items-center justify-center gap-2">
          <Link to={user ? '/dashboard' : '/login'}>
            <Button>
              <Compass className="h-4 w-4" /> {user ? 'Go to dashboard' : 'Go to sign in'}
            </Button>
          </Link>
          <Link to={user ? '/errors' : '/request-access'}>
            <Button variant="secondary">
              <ArrowLeft className="h-4 w-4" /> {user ? 'Browse the queue' : 'Request access'}
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
}
