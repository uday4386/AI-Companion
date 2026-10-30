import { useEffect, useState } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { Topbar } from './Topbar';

export function AppLayout() {
  const [open, setOpen] = useState(false);
  const location = useLocation();

  useEffect(() => {
    setOpen(false);
  }, [location.pathname, location.search]);

  return (
    <div className="min-h-screen">
      <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden" aria-hidden>
        <div className="absolute -left-40 -top-40 h-[420px] w-[420px] rounded-full bg-brand-400/[0.07] blur-3xl dark:bg-brand-500/[0.08]" />
        <div className="absolute -right-32 top-24 h-[360px] w-[360px] rounded-full bg-violet-400/[0.06] blur-3xl dark:bg-violet-500/[0.06]" />
      </div>

      <Sidebar open={open} onClose={() => setOpen(false)} />

      <div className="lg:pl-[268px]">
        <Topbar onMenu={() => setOpen(true)} />
        <main className="mx-auto w-full max-w-[1560px] px-4 pb-16 pt-6 sm:px-6 lg:px-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
