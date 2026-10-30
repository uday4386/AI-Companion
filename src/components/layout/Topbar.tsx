import { useEffect, useRef, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { ChevronsUpDown, LogOut, Menu as MenuIcon, Moon, Search, Settings, ShieldCheck, Sun, User as UserIcon } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/contexts/ThemeContext';
import { Avatar } from '@/components/ui/Avatar';
import { Menu, MenuItem, MenuLabel, MenuSeparator } from '@/components/ui/Menu';
import { ROLE_LABEL } from '@/lib/constants';
import { NotificationBell } from './NotificationBell';

const TITLES: { match: (path: string) => boolean; title: string; subtitle?: string }[] = [
  { match: (p) => p === '/dashboard', title: 'Dashboard' },
  { match: (p) => p === '/errors/new', title: 'Submit new error', subtitle: 'Report a defect with evidence' },
  { match: (p) => /^\/errors\/[^/]+$/.test(p), title: 'Error details' },
  { match: (p) => p === '/errors', title: 'Error queue' },
  { match: (p) => p === '/assignments', title: 'Assignments' },
  { match: (p) => p === '/reports', title: 'Reports & analytics' },
  { match: (p) => p === '/users', title: 'User management' },
  { match: (p) => p === '/access-requests', title: 'Access requests' },
  { match: (p) => p === '/notifications', title: 'Notifications' },
  { match: (p) => p === '/audit-logs', title: 'Audit logs' },
  { match: (p) => p === '/settings', title: 'Settings' },
  { match: (p) => p === '/profile', title: 'My profile' },
];

export function Topbar({ onMenu }: { onMenu: () => void }) {
  const { user, logout } = useAuth();
  const { theme, toggle } = useTheme();
  const location = useLocation();
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const meta = TITLES.find((item) => item.match(location.pathname));
  const isAdmin = user?.role === 'admin';

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        inputRef.current?.focus();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    const trimmed = query.trim();
    navigate(trimmed ? `/errors?search=${encodeURIComponent(trimmed)}` : '/errors');
    setQuery('');
  };

  return (
    <header className="sticky top-0 z-30 border-b border-slate-200/70 bg-white/85 backdrop-blur-xl dark:border-white/[0.07] dark:bg-[#070b16]/85">
      <div className="flex h-16 items-center gap-3 px-4 sm:px-6 lg:px-8">
        <button
          type="button"
          onClick={onMenu}
          className="inline-flex h-9 w-9 items-center justify-center rounded-xl text-slate-500 transition hover:bg-slate-100 hover:text-slate-800 lg:hidden dark:text-slate-400 dark:hover:bg-white/[0.07]"
          aria-label="Open navigation"
        >
          <MenuIcon className="h-5 w-5" />
        </button>

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h1 className="truncate text-[15.5px] font-semibold text-slate-900 dark:text-white">{meta?.title ?? 'Sentinel'}</h1>
            {isAdmin ? (
              <span className="hidden items-center gap-1 rounded-md bg-brand-50 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-brand-700 sm:inline-flex dark:bg-brand-500/15 dark:text-brand-300">
                <ShieldCheck className="h-3 w-3" /> Admin
              </span>
            ) : null}
          </div>
          {meta?.subtitle ? <p className="hidden truncate text-[11.5px] text-slate-500 sm:block dark:text-slate-400">{meta.subtitle}</p> : null}
        </div>

        <form onSubmit={submit} className="hidden md:block">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
            <input
              ref={inputRef}
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search errors, IDs, keywords…"
              aria-label="Search errors"
              className="h-9 w-[248px] rounded-xl border border-slate-200 bg-slate-50/80 pl-9 pr-14 text-[12.5px] text-slate-700 outline-none transition placeholder:text-slate-400 focus:w-[300px] focus:border-brand-300 focus:bg-white focus:ring-4 focus:ring-brand-500/10 dark:border-white/10 dark:bg-white/[0.04] dark:text-slate-200 dark:placeholder:text-slate-500 dark:focus:border-brand-500/40 dark:focus:bg-white/[0.06]"
            />
            <span className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2">
              <kbd className="kbd">⌘K</kbd>
            </span>
          </div>
        </form>

        <div className="flex items-center gap-0.5">
          <button
            type="button"
            onClick={toggle}
            className="inline-flex h-9 w-9 items-center justify-center rounded-xl text-slate-500 transition hover:bg-slate-100 hover:text-slate-800 dark:text-slate-400 dark:hover:bg-white/[0.07] dark:hover:text-white"
            aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} theme`}
            title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} theme`}
          >
            {theme === 'dark' ? <Sun className="h-[18px] w-[18px]" /> : <Moon className="h-[18px] w-[18px]" />}
          </button>

          <NotificationBell />

          <div className="mx-1.5 hidden h-6 w-px bg-slate-200 sm:block dark:bg-white/10" />

          <Menu
            trigger={({ toggle: openMenu }) => (
              <button
                type="button"
                onClick={openMenu}
                className="flex items-center gap-2 rounded-xl p-1 pr-2 transition hover:bg-slate-100 dark:hover:bg-white/[0.06]"
                aria-label="Open account menu"
              >
                <Avatar name={user?.fullName} tone={user?.avatarTone} size="sm" />
                <span className="hidden max-w-[120px] truncate text-[12.5px] font-semibold text-slate-700 sm:block dark:text-slate-200">
                  {user?.fullName}
                </span>
                <ChevronsUpDown className="hidden h-3.5 w-3.5 text-slate-400 sm:block" />
              </button>
            )}
          >
            {({ close }) => (
              <div>
                <div className="px-2.5 py-2">
                  <p className="truncate text-[13px] font-semibold text-slate-900 dark:text-white">{user?.fullName}</p>
                  <p className="truncate text-[11px] text-slate-500 dark:text-slate-400">{user?.email}</p>
                  <span className="mt-1.5 inline-flex rounded-md bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate-600 dark:bg-white/10 dark:text-slate-300">
                    {user ? ROLE_LABEL[user.role] : ''}
                  </span>
                </div>
                <MenuSeparator />
                <MenuLabel>Account</MenuLabel>
                <MenuItem
                  icon={UserIcon}
                  onClick={() => {
                    close();
                    navigate('/profile');
                  }}
                >
                  My profile
                </MenuItem>
                <MenuItem
                  icon={Settings}
                  onClick={() => {
                    close();
                    navigate('/settings');
                  }}
                >
                  Settings
                </MenuItem>
                <MenuSeparator />
                <MenuItem
                  icon={LogOut}
                  danger
                  onClick={async () => {
                    close();
                    await logout();
                    navigate('/login', { replace: true });
                  }}
                >
                  Sign out
                </MenuItem>
              </div>
            )}
          </Menu>
        </div>
      </div>
      <div className="h-px w-full bg-gradient-to-r from-transparent via-brand-500/20 to-transparent" aria-hidden />
      <div className="border-t border-slate-100 px-4 py-2 md:hidden dark:border-white/[0.06]">
        <form onSubmit={submit} className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search error ID or title…"
            aria-label="Search errors"
            className="h-9 w-full rounded-xl border border-slate-200 bg-slate-50/80 pl-9 pr-3 text-[12.5px] text-slate-700 outline-none focus:border-brand-300 focus:bg-white dark:border-white/10 dark:bg-white/[0.04] dark:text-slate-200"
          />
        </form>
      </div>
    </header>
  );
}

export function PageHeader({
  title,
  description,
  actions,
  breadcrumb,
}: {
  title: React.ReactNode;
  description?: React.ReactNode;
  actions?: React.ReactNode;
  breadcrumb?: { label: string; to?: string }[];
}) {
  return (
    <div className="mb-6">
      {breadcrumb?.length ? (
        <nav className="mb-2 flex items-center gap-1.5 text-[11.5px] text-slate-400 dark:text-slate-500" aria-label="Breadcrumb">
          {breadcrumb.map((item, index) => (
            <span key={`${item.label}-${index}`} className="flex items-center gap-1.5">
              {index > 0 ? <span className="text-slate-300 dark:text-slate-600">/</span> : null}
              {item.to ? (
                <Link to={item.to} className="transition hover:text-brand-600 dark:hover:text-brand-300">
                  {item.label}
                </Link>
              ) : (
                <span className="text-slate-500 dark:text-slate-400">{item.label}</span>
              )}
            </span>
          ))}
        </nav>
      ) : null}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-[22px] font-bold leading-tight tracking-tight text-slate-900 dark:text-white sm:text-[26px]">{title}</h1>
          {description ? <p className="mt-1 max-w-2xl text-[13px] leading-relaxed text-slate-500 dark:text-slate-400">{description}</p> : null}
        </div>
        {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
      </div>
    </div>
  );
}
