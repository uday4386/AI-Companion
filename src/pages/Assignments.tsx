import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ChevronRight, ClipboardList, Info, TrendingUp, UserRound, Users } from 'lucide-react';
import clsx from 'clsx';
import { useFetch } from '@/hooks/useFetch';
import { api, buildQuery } from '@/lib/api';
import type { DirectoryUser, ErrorItem } from '@/lib/types';
import { OPEN_STATUSES, ROLE_LABEL, tone } from '@/lib/constants';
import { relativeTime } from '@/lib/format';
import { PageHeader } from '@/components/layout/Topbar';
import { Card, CardBody, CardHeader } from '@/components/ui/Card';
import { Avatar } from '@/components/ui/Avatar';
import { PriorityBadge, StatusBadge } from '@/components/StatusBadge';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { Skeleton } from '@/components/ui/Spinner';

interface ListResponse {
  items: ErrorItem[];
  pagination: { total: number };
}

const PRIORITY_RANK: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3 };

export default function AssignmentsPage() {
  const query = buildQuery({ status: OPEN_STATUSES.join(','), pageSize: 100, sort: 'priority' });
  const { data, loading, error } = useFetch<ListResponse>(`/api/errors${query}`, [query]);
  const [directory, setDirectory] = useState<DirectoryUser[]>([]);

  useEffect(() => {
    void api
      .get<{ users: DirectoryUser[] }>('/api/directory')
      .then((result) => setDirectory(result.users))
      .catch(() => undefined);
  }, []);

  const columns = useMemo(() => {
    const items = (data?.items ?? []).slice().sort((a, b) => PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority]);
    const unassigned = items.filter((item) => !item.assignedTo);
    const byUser = new Map<string, { user: DirectoryUser; items: ErrorItem[] }>();
    for (const item of items) {
      if (!item.assignedTo) continue;
      const user = directory.find((person) => person.id === item.assignedTo?.id) ?? {
        id: item.assignedTo.id,
        fullName: item.assignedTo.fullName,
        email: '',
        role: 'member' as const,
        avatarTone: item.assignedTo.avatarTone,
      };
      const entry = byUser.get(user.id) ?? { user, items: [] };
      entry.items.push(item);
      byUser.set(user.id, entry);
    }
    return { unassigned, assigned: [...byUser.values()].sort((a, b) => b.items.length - a.items.length) };
  }, [data, directory]);

  const totalOpen = data?.items.length ?? 0;
  const critical = (data?.items ?? []).filter((item) => item.priority === 'critical').length;

  return (
    <div className="animate-fade-in">
      <PageHeader
        breadcrumb={[{ label: 'Workspace' }, { label: 'Assignments' }]}
        title="Assignment board"
        description="Balance the open queue across the team. Assigning a report to an owner moves it to Assigned automatically."
        actions={
          <Link to="/errors?assignedTo=unassigned">
            <Button variant="secondary" size="sm">
              <UserRound className="h-3.5 w-3.5" /> Unassigned queue
            </Button>
          </Link>
        }
      />

      <div className="mb-4 grid gap-4 sm:grid-cols-3">
        <Card className="p-4">
          <div className="flex items-center justify-between">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Open reports</p>
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-brand-50 text-brand-600 dark:bg-brand-500/15 dark:text-brand-300">
              <ClipboardList className="h-3.5 w-3.5" />
            </span>
          </div>
          <p className="mt-2 text-[24px] font-bold leading-none text-slate-900 dark:text-white">{totalOpen}</p>
          <p className="mt-2 text-[11.5px] text-slate-500 dark:text-slate-400">Across {columns.assigned.length} owners</p>
        </Card>
        <Card className="p-4">
          <div className="flex items-center justify-between">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Unassigned</p>
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-amber-50 text-amber-600 dark:bg-amber-500/15 dark:text-amber-300">
              <UserRound className="h-3.5 w-3.5" />
            </span>
          </div>
          <p className="mt-2 text-[24px] font-bold leading-none text-slate-900 dark:text-white">{columns.unassigned.length}</p>
          <p className="mt-2 text-[11.5px] text-slate-500 dark:text-slate-400">Waiting for an owner</p>
        </Card>
        <Card className="p-4">
          <div className="flex items-center justify-between">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Critical open</p>
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-rose-50 text-rose-600 dark:bg-rose-500/15 dark:text-rose-300">
              <TrendingUp className="h-3.5 w-3.5" />
            </span>
          </div>
          <p className="mt-2 text-[24px] font-bold leading-none text-slate-900 dark:text-white">{critical}</p>
          <p className="mt-2 text-[11.5px] text-slate-500 dark:text-slate-400">Needs immediate attention</p>
        </Card>
      </div>

      {error ? (
        <Card className="p-6">
          <EmptyState title="Could not load assignments" description={error} />
        </Card>
      ) : loading && !data ? (
        <div className="grid gap-4 md:grid-cols-3">
          {Array.from({ length: 3 }).map((_, index) => (
            <Card key={index} className="space-y-3 p-4">
              <Skeleton className="h-4 w-32" />
              {Array.from({ length: 4 }).map((__, i) => (
                <Skeleton key={i} className="h-20 w-full" />
              ))}
            </Card>
          ))}
        </div>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-3">
          <Column
            title="Unassigned"
            subtitle="Needs an owner"
            tone="amber"
            items={columns.unassigned}
            href={`/errors?assignedTo=unassigned&status=${OPEN_STATUSES.join(',')}`}
            emptyLabel="Everything has an owner"
          />
          {columns.assigned.map(({ user, items }) => (
            <Column
              key={user.id}
              title={user.fullName}
              subtitle={user.email ? ROLE_LABEL[user.role] : 'Assignee'}
              user={user}
              items={items}
              href={`/errors?assignedTo=${user.id}`}
              emptyLabel="No open work"
            />
          ))}
          {!columns.assigned.length ? (
            <Card className="flex min-h-[220px] items-center justify-center">
              <EmptyState
                compact
                icon={Users}
                title="No assigned work yet"
                description="Assign a report from its detail page and it will appear here."
                action={
                  <Link to="/errors">
                    <Button variant="secondary" size="sm">
                      Browse the queue
                    </Button>
                  </Link>
                }
              />
            </Card>
          ) : null}
        </div>
      )}

      <Card className="mt-4">
        <CardHeader icon={Info} title="How assignment works" description="A quick reminder of the enforced rules" />
        <CardBody className="grid gap-3 text-[12px] text-slate-600 sm:grid-cols-3 dark:text-slate-300">
          <p className="rounded-lg bg-slate-50 p-3 dark:bg-white/[0.04]">
            <span className="font-semibold text-slate-800 dark:text-slate-100">Admins only.</span> Assignment is restricted to Admin accounts and recorded in the
            audit log.
          </p>
          <p className="rounded-lg bg-slate-50 p-3 dark:bg-white/[0.04]">
            <span className="font-semibold text-slate-800 dark:text-slate-100">Auto-transition.</span> Assigning an untriaged report moves it from Submitted or
            Under Review to Assigned.
          </p>
          <p className="rounded-lg bg-slate-50 p-3 dark:bg-white/[0.04]">
            <span className="font-semibold text-slate-800 dark:text-slate-100">Notifications.</span> The assignee and the submitter are both notified when ownership
            changes.
          </p>
        </CardBody>
      </Card>
    </div>
  );
}

function Column({
  title,
  subtitle,
  items,
  href,
  user,
  tone: toneName = 'slate',
  emptyLabel,
}: {
  title: string;
  subtitle: string;
  items: ErrorItem[];
  href: string;
  user?: DirectoryUser;
  tone?: string;
  emptyLabel: string;
}) {
  const classes = tone(toneName);
  return (
    <div className="flex flex-col rounded-2xl border border-slate-200/80 bg-slate-100/40 dark:border-white/[0.07] dark:bg-white/[0.015]">
      <div className="flex items-center gap-2.5 px-3.5 py-3">
        {user ? (
          <Avatar name={user.fullName} tone={user.avatarTone} size="sm" />
        ) : (
          <span className={clsx('flex h-7 w-7 items-center justify-center rounded-full', classes.softBg, classes.text)}>
            <UserRound className="h-3.5 w-3.5" />
          </span>
        )}
        <div className="min-w-0 flex-1">
          <p className="truncate text-[12.5px] font-semibold text-slate-800 dark:text-slate-100">{title}</p>
          <p className="truncate text-[10.5px] text-slate-500 dark:text-slate-400">{subtitle}</p>
        </div>
        <span className="rounded-full bg-white px-2 py-0.5 text-[10.5px] font-bold text-slate-500 shadow-sm dark:bg-white/10 dark:text-slate-300">{items.length}</span>
      </div>

      <div className="flex-1 space-y-2 px-2.5 pb-2.5">
        {items.length ? (
          items.slice(0, 5).map((item) => (
            <Link
              key={item.id}
              to={`/errors/${item.id}`}
              className="group block rounded-xl border border-slate-200/80 bg-white p-3 shadow-sm transition hover:-translate-y-0.5 hover:border-brand-300 hover:shadow-md dark:border-white/[0.07] dark:bg-slate-900/70 dark:hover:border-brand-500/30"
            >
              <div className="flex items-center justify-between gap-2">
                <span className="font-mono text-[9.5px] font-semibold uppercase tracking-wide text-brand-600 dark:text-brand-300">{item.errorCode}</span>
                <PriorityBadge priority={item.priority} size="sm" />
              </div>
              <p className="mt-1 line-clamp-2 text-[12px] font-medium leading-snug text-slate-700 group-hover:text-brand-700 dark:text-slate-200 dark:group-hover:text-brand-300">
                {item.title}
              </p>
              <div className="mt-2 flex items-center justify-between gap-2">
                <StatusBadge status={item.status} size="sm" />
                <span className="text-[10px] text-slate-400">{relativeTime(item.updatedAt)}</span>
              </div>
            </Link>
          ))
        ) : (
          <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-slate-200 px-3 py-6 text-center dark:border-white/10">
            <ClipboardList className="h-4 w-4 text-slate-300 dark:text-slate-600" />
            <p className="mt-1.5 text-[11px] text-slate-400">{emptyLabel}</p>
          </div>
        )}
        {items.length > 5 ? (
          <Link to={href} className="flex items-center justify-between rounded-lg px-2 py-1.5 text-[11px] font-semibold text-brand-600 hover:bg-white dark:text-brand-300 dark:hover:bg-white/[0.06]">
            View {items.length - 5} more <ChevronRight className="h-3 w-3" />
          </Link>
        ) : items.length ? (
          <Link to={href} className="flex items-center justify-between rounded-lg px-2 py-1.5 text-[11px] font-semibold text-slate-400 hover:text-brand-600 dark:hover:text-brand-300">
            Open filtered queue <ChevronRight className="h-3 w-3" />
          </Link>
        ) : null}
      </div>
    </div>
  );
}
