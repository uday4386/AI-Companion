import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AtSign, Bell, BellOff, CheckCheck, MessageSquare, ShieldAlert, UserPlus, Zap } from 'lucide-react';
import clsx from 'clsx';
import { useAuth } from '@/contexts/AuthContext';
import { useFetch } from '@/hooks/useFetch';
import { useToast } from '@/contexts/ToastContext';
import { api } from '@/lib/api';
import type { NotificationItem, Pagination } from '@/lib/types';
import { formatDate, formatTime, relativeTime } from '@/lib/format';
import { PageHeader } from '@/components/layout/Topbar';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Tabs } from '@/components/ui/Tabs';
import { EmptyState } from '@/components/ui/EmptyState';
import { TableSkeleton } from '@/components/ui/Spinner';
import { Pagination as Pager } from '@/components/ui/Pagination';

interface NotificationsResponse {
  items: NotificationItem[];
  unread: number;
  pagination: Pagination;
}

const ICONS: Record<string, { icon: React.ComponentType<{ className?: string }>; tone: string }> = {
  error_submitted: { icon: Zap, tone: 'bg-sky-50 text-sky-600 dark:bg-sky-500/15 dark:text-sky-300' },
  status_changed: { icon: ShieldAlert, tone: 'bg-violet-50 text-violet-600 dark:bg-violet-500/15 dark:text-violet-300' },
  assigned: { icon: AtSign, tone: 'bg-indigo-50 text-indigo-600 dark:bg-indigo-500/15 dark:text-indigo-300' },
  comment_added: { icon: MessageSquare, tone: 'bg-amber-50 text-amber-600 dark:bg-amber-500/15 dark:text-amber-300' },
  admin_remark: { icon: ShieldAlert, tone: 'bg-brand-50 text-brand-600 dark:bg-brand-500/15 dark:text-brand-300' },
  access_requested: { icon: UserPlus, tone: 'bg-rose-50 text-rose-600 dark:bg-rose-500/15 dark:text-rose-300' },
  access_approved: { icon: UserPlus, tone: 'bg-emerald-50 text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-300' },
  account_created: { icon: UserPlus, tone: 'bg-slate-100 text-slate-600 dark:bg-white/[0.08] dark:text-slate-300' },
};

export default function NotificationsPage() {
  const [tab, setTab] = useState<'all' | 'unread'>('all');
  const [page, setPage] = useState(1);
  const query = `/api/notifications?filter=${tab === 'unread' ? 'unread' : 'all'}&page=${page}&pageSize=20`;
  const { data, loading, refetch } = useFetch<NotificationsResponse>(query, [query]);
  const { unread, setUnread, refreshUnread } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();

  const grouped = useMemo(() => {
    const groups: { label: string; items: NotificationItem[] }[] = [];
    for (const item of data?.items ?? []) {
      const date = new Date(item.createdAt);
      const today = new Date();
      const yesterday = new Date(Date.now() - 86_400_000);
      const label =
        date.toDateString() === today.toDateString()
          ? 'Today'
          : date.toDateString() === yesterday.toDateString()
            ? 'Yesterday'
            : formatDate(date);
      const group = groups.find((entry) => entry.label === label);
      if (group) group.items.push(item);
      else groups.push({ label, items: [item] });
    }
    return groups;
  }, [data]);

  const markAll = async () => {
    try {
      await api.post('/api/notifications/read-all');
      setUnread(0);
      refetch();
      toast.success('All notifications marked as read');
    } catch {
      toast.error('Could not update notifications');
    }
  };

  const open = async (item: NotificationItem) => {
    if (!item.isRead) {
      try {
        await api.patch(`/api/notifications/${item.id}/read`);
        await refreshUnread();
      } catch {
        /* ignore */
      }
    }
    if (item.errorId) navigate(`/errors/${item.errorId}`);
    else if (item.type.startsWith('access')) navigate('/access-requests');
  };

  const toggleRead = async (item: NotificationItem) => {
    try {
      await api.patch(`/api/notifications/${item.id}/${item.isRead ? 'unread' : 'read'}`);
      refetch();
      await refreshUnread();
    } catch {
      toast.error('Could not update the notification');
    }
  };

  return (
    <div className="animate-fade-in">
      <PageHeader
        breadcrumb={[{ label: 'Workspace' }, { label: 'Notifications' }]}
        title="Notifications"
        description="Status changes, assignments, comments and access activity — everything that mentions you."
        actions={
          <Button variant="secondary" size="sm" onClick={markAll} disabled={(data?.unread ?? unread) === 0}>
            <CheckCheck className="h-3.5 w-3.5" /> Mark all as read
          </Button>
        }
      />

      <Card>
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-4 pt-1 dark:border-white/[0.06]">
          <Tabs
            items={[
              { value: 'all', label: 'All', icon: Bell },
              { value: 'unread', label: 'Unread', count: data?.unread ?? unread, icon: BellOff },
            ]}
            value={tab}
            onChange={(value) => {
              setTab(value as 'all' | 'unread');
              setPage(1);
            }}
          />
          <p className="pb-2 text-[11px] text-slate-400">{data?.pagination.total ?? 0} total</p>
        </div>

        {loading ? (
          <TableSkeleton rows={6} columns={3} />
        ) : grouped.length ? (
          <div>
            {grouped.map((group) => (
              <div key={group.label}>
                <p className="border-b border-slate-100 bg-slate-50/70 px-4 py-1.5 text-[10.5px] font-semibold uppercase tracking-wide text-slate-500 dark:border-white/[0.06] dark:bg-white/[0.02] dark:text-slate-400">
                  {group.label}
                </p>
                <div className="divide-y divide-slate-100 dark:divide-white/[0.05]">
                  {group.items.map((item) => {
                    const config = ICONS[item.type] ?? { icon: Bell, tone: 'bg-slate-100 text-slate-500 dark:bg-white/[0.06] dark:text-slate-300' };
                    const Icon = config.icon;
                    return (
                      <div
                        key={item.id}
                        className={clsx('group flex items-start gap-3 px-4 py-3 transition hover:bg-slate-50/70 dark:hover:bg-white/[0.03]', !item.isRead && 'bg-brand-50/30 dark:bg-brand-500/[0.04]')}
                      >
                        <button type="button" onClick={() => void open(item)} className="flex min-w-0 flex-1 items-start gap-3 text-left">
                          <span className={clsx('mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg', config.tone)}>
                            <Icon className="h-4 w-4" />
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="flex flex-wrap items-center gap-2">
                              <span className="text-[12.5px] font-semibold text-slate-800 dark:text-slate-100">{item.title}</span>
                              {item.errorCode ? (
                                <span className="font-mono text-[9.5px] font-semibold uppercase tracking-wide text-brand-600 dark:text-brand-300">{item.errorCode}</span>
                              ) : null}
                              {!item.isRead ? <span className="h-1.5 w-1.5 rounded-full bg-brand-500" /> : null}
                            </span>
                            {item.message ? <span className="mt-0.5 block text-[11.5px] leading-relaxed text-slate-500 dark:text-slate-400">{item.message}</span> : null}
                            <span className="mt-1 block text-[10.5px] text-slate-400">
                              {relativeTime(item.createdAt)} · {formatTime(item.createdAt)}
                            </span>
                          </span>
                        </button>
                        <button
                          type="button"
                          onClick={() => void toggleRead(item)}
                          className="shrink-0 rounded-lg px-2 py-1 text-[10.5px] font-semibold text-slate-400 opacity-0 transition hover:bg-slate-100 hover:text-slate-600 group-hover:opacity-100 dark:hover:bg-white/10 dark:hover:text-slate-200"
                        >
                          {item.isRead ? 'Mark unread' : 'Mark read'}
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
            <div className="border-t border-slate-100 dark:border-white/[0.06]">
              <Pager pagination={data!.pagination} onPageChange={setPage} />
            </div>
          </div>
        ) : (
          <EmptyState
            icon={BellOff}
            title={tab === 'unread' ? 'No unread notifications' : 'No notifications yet'}
            description={
              tab === 'unread'
                ? 'You have read everything. New activity will appear here and in the bell menu.'
                : 'When a report you care about changes status or gets a comment, it will show up here.'
            }
          />
        )}
      </Card>
    </div>
  );
}
