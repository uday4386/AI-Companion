import { NavLink, useLocation } from 'react-router-dom';
import {
  Activity,
  BarChart3,
  Bell,
  ChevronRight,
  ClipboardList,
  FileWarning,
  LayoutDashboard,
  LifeBuoy,
  Plus,
  ScrollText,
  Settings,
  ShieldCheck,
  UserCheck,
  Users,
  X,
} from 'lucide-react';
import clsx from 'clsx';
import { useAuth } from '@/contexts/AuthContext';
import { Avatar } from '@/components/ui/Avatar';
import { ROLE_LABEL } from '@/lib/constants';
import { Link } from 'react-router-dom';

interface NavItem {
  to: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  badge?: number;
  match?: (pathname: string, search: string) => boolean;
}

interface NavGroup {
  label: string;
  items: NavItem[];
}

export function Sidebar({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { user, unread, settings } = useAuth();
  const location = useLocation();
  const isAdmin = user?.role === 'admin';

  const isActive = (item: NavItem) =>
    item.match
      ? item.match(location.pathname, location.search)
      : location.pathname === item.to || (item.to !== '/dashboard' && location.pathname.startsWith(`${item.to}/`));

  const adminNav: NavGroup[] = [
    {
      label: 'Workspace',
      items: [
        { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
        {
          to: '/errors',
          label: 'All errors',
          icon: FileWarning,
          match: (pathname, search) => pathname === '/errors' && !search.includes('scope=mine') && location.pathname !== '/errors/new',
        },
        { to: '/assignments', label: 'Assignments', icon: ClipboardList },
        { to: '/notifications', label: 'Notifications', icon: Bell, badge: unread },
      ],
    },
    {
      label: 'Insights',
      items: [
        { to: '/reports', label: 'Reports & analytics', icon: BarChart3 },
        { to: '/audit-logs', label: 'Audit logs', icon: ScrollText },
      ],
    },
    {
      label: 'Administration',
      items: [
        { to: '/users', label: 'User management', icon: Users },
        { to: '/access-requests', label: 'Access requests', icon: UserCheck },
        { to: '/settings', label: 'Settings', icon: Settings },
      ],
    },
  ];

  const memberNav: NavGroup[] = [
    {
      label: 'Workspace',
      items: [
        { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
        {
          to: '/errors/new',
          label: 'Submit new error',
          icon: Plus,
          match: (pathname) => pathname === '/errors/new',
        },
        {
          to: '/errors?scope=mine',
          label: 'My errors',
          icon: FileWarning,
          match: (pathname, search) => pathname === '/errors' && search.includes('scope=mine'),
        },
        {
          to: '/errors?scope=assigned',
          label: 'Assigned to me',
          icon: Activity,
          match: (pathname, search) => pathname === '/errors' && search.includes('scope=assigned'),
        },
        { to: '/notifications', label: 'Notifications', icon: Bell, badge: unread },
      ],
    },
    {
      label: 'Account',
      items: [{ to: '/profile', label: 'My profile', icon: Users }],
    },
  ];

  const groups = isAdmin ? adminNav : memberNav;

  return (
    <>
      <div
        className={clsx(
          'fixed inset-0 z-40 bg-slate-950/50 backdrop-blur-sm transition-opacity lg:hidden',
          open ? 'opacity-100' : 'pointer-events-none opacity-0',
        )}
        onClick={onClose}
        aria-hidden
      />
      <aside
        className={clsx(
          'fixed inset-y-0 left-0 z-50 flex w-[268px] flex-col bg-[#141333] bg-gradient-to-b from-[#1b1a46] via-[#141333] to-[#0d0c22] text-white shadow-2xl transition-transform duration-300 lg:translate-x-0',
          open ? 'translate-x-0' : '-translate-x-full',
        )}
        aria-label="Primary navigation"
      >
        <div className="pointer-events-none absolute inset-0 overflow-hidden opacity-[0.35]" aria-hidden>
          <div className="absolute -right-24 -top-20 h-64 w-64 rounded-full bg-brand-500/40 blur-3xl" />
          <div className="absolute -left-16 bottom-32 h-52 w-52 rounded-full bg-violet-500/20 blur-3xl" />
          <div className="absolute inset-0 bg-grid opacity-[0.18]" />
        </div>

        <div className="relative flex items-center justify-between px-5 pb-4 pt-5">
          <Link to="/dashboard" className="flex items-center gap-2.5" onClick={onClose}>
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-brand-400 to-violet-500 shadow-lg shadow-brand-900/40">
              <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" aria-hidden>
                <path d="M5 7.5h14M5 12h9M5 16.5h10" stroke="white" strokeWidth="2" strokeLinecap="round" />
                <circle cx="17.5" cy="16.5" r="2.6" fill="#34d399" stroke="#1b1a46" strokeWidth="1.2" />
              </svg>
            </span>
            <span>
              <span className="block text-[15px] font-bold leading-tight tracking-tight">Sentinel</span>
              <span className="block text-[10.5px] font-medium uppercase tracking-[0.14em] text-indigo-300/70">Error tracking</span>
            </span>
          </Link>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-indigo-200/70 hover:bg-white/10 hover:text-white lg:hidden"
            aria-label="Close navigation"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="relative px-4">
          <Link
            to="/errors/new"
            onClick={onClose}
            className="flex w-full items-center justify-between gap-2 rounded-xl bg-white/[0.09] px-3 py-2.5 text-[13px] font-semibold text-white ring-1 ring-inset ring-white/10 transition hover:bg-white/[0.14]"
          >
            <span className="flex items-center gap-2">
              <Plus className="h-4 w-4 text-brand-300" />
              New error report
            </span>
            <span className="rounded-md bg-white/10 px-1.5 py-0.5 font-mono text-[10px] text-indigo-200">N</span>
          </Link>
        </div>

        <nav className="relative mt-5 flex-1 space-y-6 overflow-y-auto px-3 pb-4">
          {groups.map((group) => (
            <div key={group.label}>
              <p className="px-3 pb-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-indigo-300/50">{group.label}</p>
              <div className="space-y-0.5">
                {group.items.map((item) => {
                  const active = isActive(item);
                  return (
                    <NavLink
                      key={item.to}
                      to={item.to}
                      onClick={onClose}
                      className={clsx('nav-link group', active && 'nav-link-active')}
                      aria-current={active ? 'page' : undefined}
                    >
                      <item.icon className={clsx('h-[17px] w-[17px] shrink-0', active ? 'text-brand-300' : 'text-indigo-300/70')} />
                      <span className="flex-1">{item.label}</span>
                      {item.badge ? (
                        <span className="rounded-full bg-rose-500 px-1.5 py-0.5 text-[10px] font-bold leading-none text-white shadow-sm">
                          {item.badge > 99 ? '99+' : item.badge}
                        </span>
                      ) : null}
                      {active ? <ChevronRight className="h-3.5 w-3.5 text-indigo-300/70" /> : null}
                    </NavLink>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>

        <div className="relative space-y-3 border-t border-white/[0.08] px-4 py-4">
          <div className="rounded-xl bg-white/[0.05] p-3 ring-1 ring-inset ring-white/[0.07]">
            <div className="flex items-center gap-2 text-[10.5px] font-semibold uppercase tracking-wide text-indigo-300/70">
              {isAdmin ? <ShieldCheck className="h-3.5 w-3.5" /> : <LifeBuoy className="h-3.5 w-3.5" />}
              {isAdmin ? 'Admin workspace' : 'Access policy'}
            </div>
            <p className="mt-1.5 text-[11px] leading-relaxed text-indigo-100/60">
              {isAdmin
                ? 'You can triage, assign and transition every report. Changes are audited.'
                : settings.team_visibility === 'team_wide'
                  ? 'Your team shares all reports. You can comment but not change status.'
                  : 'You can view errors you submitted or are assigned to. Only Admins change status.'}
            </p>
          </div>
          <Link
            to="/profile"
            onClick={onClose}
            className="flex items-center gap-2.5 rounded-xl px-1 py-1 transition hover:bg-white/[0.06]"
          >
            <Avatar name={user?.fullName} tone={user?.avatarTone} size="md" />
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[12.5px] font-semibold text-white">{user?.fullName}</span>
              <span className="block truncate text-[10.5px] text-indigo-200/60">{user ? ROLE_LABEL[user.role] : ''}</span>
            </span>
          </Link>
        </div>
      </aside>
    </>
  );
}
