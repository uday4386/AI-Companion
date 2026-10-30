import { Link } from 'react-router-dom';
import { CheckCircle2, ShieldCheck, Sparkles, TrendingUp } from 'lucide-react';

const HIGHLIGHTS = [
  {
    icon: ShieldCheck,
    title: 'Role-enforced by the server',
    description: 'Only Admins change status, assign work and manage access. Members keep full visibility of their own reports.',
  },
  {
    icon: TrendingUp,
    title: 'Every report ends in resolution',
    description: 'A guided lifecycle from Submitted to Closed, with a permanent audit trail of who changed what and why.',
  },
  {
    icon: Sparkles,
    title: 'Evidence that travels with the bug',
    description: 'Screenshots, logs and reproduction steps stay attached to the report — no more lost context in chat threads.',
  },
];

export function AuthShell({
  title,
  subtitle,
  children,
  footer,
}: {
  title: React.ReactNode;
  subtitle: React.ReactNode;
  children: React.ReactNode;
  footer?: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen bg-slate-50 dark:bg-[#070b16]">
      {/* Brand panel */}
      <div className="relative hidden w-[46%] max-w-[620px] flex-col justify-between overflow-hidden bg-[#141333] bg-gradient-to-br from-[#1e1b4b] via-[#141333] to-[#0b0a1e] px-10 py-10 text-white lg:flex xl:px-14">
        <div className="pointer-events-none absolute inset-0" aria-hidden>
          <div className="absolute -right-20 -top-24 h-80 w-80 rounded-full bg-brand-500/30 blur-3xl" />
          <div className="absolute -bottom-24 -left-16 h-96 w-96 rounded-full bg-violet-500/20 blur-3xl" />
          <div className="absolute inset-0 bg-grid opacity-[0.15]" />
        </div>

        <div className="relative">
          <Link to="/" className="inline-flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-brand-400 to-violet-500 shadow-lg shadow-brand-900/40">
              <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" aria-hidden>
                <path d="M5 7.5h14M5 12h9M5 16.5h10" stroke="white" strokeWidth="2" strokeLinecap="round" />
                <circle cx="17.5" cy="16.5" r="2.6" fill="#34d399" stroke="#1b1a46" strokeWidth="1.2" />
              </svg>
            </span>
            <span>
              <span className="block text-[16px] font-bold leading-tight">Sentinel</span>
              <span className="block text-[10.5px] font-medium uppercase tracking-[0.16em] text-indigo-300/70">Error tracking</span>
            </span>
          </Link>
        </div>

        <div className="relative">
          <p className="inline-flex items-center gap-1.5 rounded-full bg-white/[0.07] px-3 py-1 text-[11px] font-semibold text-indigo-200 ring-1 ring-inset ring-white/10">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" /> Error noting &amp; tracking system
          </p>
          <h2 className="mt-5 max-w-md text-[32px] font-bold leading-[1.15] tracking-tight text-balance">
            Every defect, from first report to verified fix.
          </h2>
          <p className="mt-3 max-w-md text-[13.5px] leading-relaxed text-indigo-100/70">
            One shared queue for application errors — with evidence, ownership and a complete history of every decision.
          </p>

          <div className="mt-8 space-y-5">
            {HIGHLIGHTS.map((item) => (
              <div key={item.title} className="flex gap-3.5">
                <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white/[0.08] text-brand-300 ring-1 ring-inset ring-white/10">
                  <item.icon className="h-4 w-4" />
                </span>
                <div>
                  <p className="text-[13px] font-semibold text-white">{item.title}</p>
                  <p className="mt-0.5 max-w-sm text-[12px] leading-relaxed text-indigo-100/60">{item.description}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="relative">
          <div className="rounded-2xl border border-white/10 bg-white/[0.05] p-4 backdrop-blur">
            <div className="flex items-center justify-between">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-indigo-200/70">This week</p>
              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-400/10 px-2 py-0.5 text-[10px] font-semibold text-emerald-300">
                <CheckCircle2 className="h-3 w-3" /> 12 resolved
              </span>
            </div>
            <div className="mt-3 flex items-end gap-2">
              {[38, 62, 48, 74, 58, 86, 66].map((height, index) => (
                <div key={index} className="flex-1">
                  <div
                    className="rounded-t-md bg-gradient-to-t from-brand-500/40 to-brand-300/80"
                    style={{ height: `${height * 0.62}px` }}
                  />
                </div>
              ))}
            </div>
            <div className="mt-2 flex justify-between text-[9.5px] uppercase tracking-wide text-indigo-200/40">
              <span>Mon</span>
              <span>Tue</span>
              <span>Wed</span>
              <span>Thu</span>
              <span>Fri</span>
              <span>Sat</span>
              <span>Sun</span>
            </div>
          </div>
          <p className="mt-4 text-[11px] text-indigo-200/40">Confidential — for authorised team members only.</p>
        </div>
      </div>

      {/* Form panel */}
      <div className="flex w-full flex-1 items-center justify-center px-5 py-10 sm:px-8">
        <div className="w-full max-w-[420px]">
          <div className="mb-8 flex items-center gap-2.5 lg:hidden">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-brand-500 to-violet-600 shadow">
              <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" aria-hidden>
                <path d="M5 7.5h14M5 12h9M5 16.5h10" stroke="white" strokeWidth="2" strokeLinecap="round" />
                <circle cx="17.5" cy="16.5" r="2.6" fill="#34d399" stroke="#1b1a46" strokeWidth="1.2" />
              </svg>
            </span>
            <span>
              <span className="block text-[15px] font-bold leading-tight text-slate-900 dark:text-white">Sentinel</span>
              <span className="block text-[10px] font-medium uppercase tracking-[0.14em] text-slate-400">Error tracking</span>
            </span>
          </div>

          <h1 className="text-[24px] font-bold tracking-tight text-slate-900 dark:text-white">{title}</h1>
          <p className="mt-1.5 text-[13.5px] leading-relaxed text-slate-500 dark:text-slate-400">{subtitle}</p>

          <div className="mt-7">{children}</div>
          {footer ? <div className="mt-6">{footer}</div> : null}
        </div>
      </div>
    </div>
  );
}

export function FormError({ message }: { message?: string | null }) {
  if (!message) return null;
  return (
    <div
      role="alert"
      className="mb-4 flex items-start gap-2 rounded-xl border border-rose-200 bg-rose-50 px-3.5 py-2.5 text-[12.5px] font-medium text-rose-700 dark:border-rose-500/25 dark:bg-rose-500/10 dark:text-rose-300"
    >
      <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-rose-500" />
      {message}
    </div>
  );
}
