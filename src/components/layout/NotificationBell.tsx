import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AtSign, Bell, CheckCheck, MessageSquare, ShieldAlert, UserPlus, Zap } from 'lucide-react';
import clsx from 'clsx';
import { useAuth } from '@/contexts/AuthContext';
import { useFetch } from '@/hooks/useFetch';
import { api } from '@/lib/api';
import { relativeTime } from '@/lib/format';
import type { NotificationItem } from '@/lib/types';
import { Menu } from '@/components/ui/Menu';
import { useToast } from '@/contexts/ToastContext';

const ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  error_submitted: Zap,
  status_changed: ShieldAlert,
  assigned: AtSign,
  comment_added: MessageSquare,
  admin_remark: ShieldAlert,
  access_requested: UserPlus,
  access_approved: UserPlus,
  account_created: UserPlus,
};

export function NotificationBell() {
  const { unread, setUnread } = useAuth();
  const { data, refetch } = useFetch<{ items: NotificationItem[] }>('/api/notifications/recent');
  const [busy, setBusy] = useState(false);
  const navigate = useNavigate();
  const toast = useToast();

  const openItem = async (item: NotificationItem) => {
    if (!item.isRead) {
      try {
        await api.patch(`/api/notifications/${item.id}/read`);
        setUnread(Math.max(0, unread - 1));
      } catch {
        /* keep navigation regardless */
      }
    }
    if (item.errorId) navigate(`/errors/${item.errorId}`);
    else navigate('/notifications');
  };

  const markAll = async () => {
    setBusy(true);
    try {
      await api.post('/api/notifications/read-all');
      setUnread(0);
      refetch();
      toast.success('All notifications marked as read');
    } catch {
      toast.error('Could not update notifications');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Menu
      panelClassName="w-[360px] max-w-[calc(100vw-2rem)] p-0"
      trigger={({ toggle, open }) => (
        <button
          type="button"
          onClick={toggle}
          aria-label={`Notifications${unread ? `, ${unread} unread` : ''}`}
          aria-expanded={open}
          className="relative inline-flex h-9 w-9 items-center justify-center rounded-xl text-slate-500 transition hover:bg-slate-100 hover:text-slate-800 dark:text-slate-400 dark:hover:bg-white/[0.07] dark:hover:text-white"
        >
          <Bell className="h-[18px] w-[18px]" />
          {unread > 0 ? (
            <span className="absolute right-1 top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-rose-500 px-1 text-[9.5px] font-bold leading-none text-white ring-2 ring-white dark:ring-slate-950">
              {unread > 9 ? '9+' : unread}
            </span>
          ) : null}
        </button>
      )}
    >
      {({ close }) => (
        <div>
          <div className="flex items-center justify-between gap-2 border-b border-slate-100 px-3.5 py-3 dark:border-white/[0.07]">
            <div>
              <p className="text-[13px] font-semibold text-slate-900 dark:text-white">Notifications</p>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">{unread ? `${unread} unread` : 'You are all caught up'}</p>
            </div>
            <button
              type="button"
              onClick={markAll}
              disabled={busy || unread === 0}
              className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-[11px] font-semibold text-brand-600 transition hover:bg-brand-50 disabled:opacity-40 dark:text-brand-300 dark:hover:bg-brand-500/10"
            >
              <CheckCheck className="h-3.5 w-3.5" /> Mark all
            </button>
          </div>

          <div className="max-h-[340px] overflow-y-auto">
            {data?.items?.length ? (
              data.items.map((item) => {
                const Icon = ICONS[item.type] ?? Bell;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => {
                      close();
                      void openItem(item);
                    }}
                    className={clsx(
                      'flex w-full items-start gap-2.5 px-3.5 py-3 text-left transition hover:bg-slate-50 dark:hover:bg-white/[0.04]',
                      !item.isRead && 'bg-brand-50/40 dark:bg-brand-500/[0.06]',
                    )}
                  >
                    <span
                      className={clsx(
                        'mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg',
                        item.isRead
                          ? 'bg-slate-100 text-slate-500 dark:bg-white/[0.06] dark:text-slate-400'
                          : 'bg-brand-100 text-brand-700 dark:bg-brand-500/15 dark:text-brand-300',
                      )}
                    >
                      <Icon className="h-3.5 w-3.5" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="flex items-start justify-between gap-2">
                        <span className="text-[12.5px] font-semibold text-slate-800 dark:text-slate-100">{item.title}</span>
                        {!item.isRead ? <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-brand-500" /> : null}
                      </span>
                      {item.message ? (
                        <span className="mt-0.5 line-clamp-2 block text-[11.5px] leading-relaxed text-slate-500 dark:text-slate-400">{item.message}</span>
                      ) : null}
                      <span className="mt-1 block text-[10.5px] text-slate-400 dark:text-slate-500">{relativeTime(item.createdAt)}</span>
                    </span>
                  </button>
                );
              })
            ) : (
              <div className="px-4 py-8 text-center">
                <Bell className="mx-auto h-5 w-5 text-slate-300 dark:text-slate-600" />
                <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">No notifications yet</p>
              </div>
            )}
          </div>

          <div className="border-t border-slate-100 p-1.5 dark:border-white/[0.07]">
            <button
              type="button"
              onClick={() => {
                close();
                navigate('/notifications');
              }}
              className="w-full rounded-lg px-3 py-2 text-[12px] font-semibold text-slate-600 transition hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-white/[0.06]"
            >
              View all notifications
            </button>
          </div>
        </div>
      )}
    </Menu>
  );
}
