import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  AlertOctagon,
  ArrowRight,
  ArrowUpRight,
  BarChart3,
  Bell,
  CheckCircle2,
  ChevronRight,
  CircleDot,
  ClipboardList,
  Clock,
  Download,
  FileWarning,
  Inbox,
  Layers,
  Plus,
  RefreshCw,
  ShieldAlert,
  Sparkles,
  TrendingUp,
  UserCheck,
  Users,
} from 'lucide-react';
import clsx from 'clsx';
import { useAuth } from '@/contexts/AuthContext';
import { useFetch } from '@/hooks/useFetch';
import type { DashboardData } from '@/lib/types';
import { buildQuery } from '@/lib/api';
import { greeting, longDate, percent, relativeTime } from '@/lib/format';
import { tone } from '@/lib/constants';
import { PageHeader } from '@/components/layout/Topbar';
import { StatCard } from '@/components/StatCard';
import { Card, CardBody, CardHeader, SectionHeading } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Select } from '@/components/ui/Field';
import { Avatar } from '@/components/ui/Avatar';
import { StatusBadge, PriorityBadge } from '@/components/StatusBadge';
import { ChartLegend, TrendChart } from '@/components/charts/TrendChart';
import { StatusDonut } from '@/components/charts/StatusDonut';
import { BarList, PriorityChart } from '@/components/charts/PriorityChart';
import { EmptyState } from '@/components/ui/EmptyState';
import { CardSkeleton, Skeleton } from '@/components/ui/Spinner';
import { useToast } from '@/contexts/ToastContext';

const RANGES = [
  { value: '30', label: 'Last 30 days' },
  { value: '90', label: 'Last 90 days' },
  { value: '365', label: 'Last 12 months' },
  { value: 'all', label: 'All time' },
];

export default function DashboardPage() {
  const { user } = useAuth();
  const [range, setRange] = useState('90');
  const [applicationId, setApplicationId] = useState('');
  const toast = useToast();

  const dateFrom = useMemo(() => {
    if (range === 'all') return undefined;
    const days = Number(range);
    return new Date(Date.now() - days * 86_400_000).toISOString().slice(0, 10);
  }, [range]);

  const query = buildQuery({ dateFrom, applicationId });
  const { data, loading, error, refetch } = useFetch<DashboardData>(`/api/reports/dashboard${query}`, [query]);

  const exportReport = async (format: 'csv' | 'xlsx' | 'pdf') => {
    try {
      const { api } = await import('@/lib/api');
      await api.download(`/api/reports/export${buildQuery({ format, dateFrom, applicationId })}`, `error-report.${format}`);
      toast.success('Export ready', `Your ${format.toUpperCase()} download has started.`);
    } catch (err) {
      toast.error('Export failed', (err as Error).message);
    }
  };

  const isAdmin = user?.role === 'admin';
  const firstName = user?.fullName.split(' ')[0] ?? '';

  return (
    <div className="animate-fade-in">
      <PageHeader
        breadcrumb={[{ label: 'Workspace' }, { label: 'Dashboard' }]}
        title={
          <span className="flex flex-wrap items-baseline gap-x-2">
            {greeting()}, {firstName}
            <span className="text-[15px] font-normal text-slate-400 dark:text-slate-500">{longDate()}</span>
          </span>
        }
        description={
          isAdmin
            ? 'Live health of the error queue — triage the backlog, spot risk and keep every report moving.'
            : 'Track everything you have reported or been assigned, with the latest updates from the admin team.'
        }
        actions={
          <>
            <Select
              value={applicationId}
              onChange={(event) => setApplicationId(event.target.value)}
              className="h-9 w-auto min-w-[150px] py-0 text-[12.5px]"
              aria-label="Filter by application"
            >
              <option value="">All applications</option>
              {(data?.applicationBreakdown ?? []).map((app) => (
                <option key={app.id} value={app.id}>
                  {app.name}
                </option>
              ))}
            </Select>
            <Select
              value={range}
              onChange={(event) => setRange(event.target.value)}
              className="h-9 w-auto min-w-[140px] py-0 text-[12.5px]"
              aria-label="Date range"
            >
              {RANGES.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </Select>
            <Button variant="secondary" size="sm" onClick={refetch} aria-label="Refresh dashboard">
              <RefreshCw className={clsx('h-3.5 w-3.5', loading && 'animate-spin')} />
              <span className="hidden sm:inline">Refresh</span>
            </Button>
            {isAdmin ? (
              <div className="flex overflow-hidden rounded-xl border border-slate-200 bg-white text-slate-700 shadow-sm dark:border-white/10 dark:bg-white/[0.04] dark:text-slate-200">
                {(['csv', 'xlsx', 'pdf'] as const).map((format) => (
                  <button
                    key={format}
                    type="button"
                    onClick={() => void exportReport(format)}
                    className="px-2.5 py-2 text-[11px] font-semibold uppercase tracking-wide transition hover:bg-slate-50 dark:hover:bg-white/[0.08]"
                    title={`Export ${format.toUpperCase()}`}
                  >
                    {format}
                  </button>
                ))}
              </div>
            ) : null}
            <Link to="/errors/new">
              <Button size="sm">
                <Plus className="h-4 w-4" /> New error
              </Button>
            </Link>
          </>
        }
      />

      {error ? (
        <Card className="p-6">
          <EmptyState
            icon={ShieldAlert}
            title="Dashboard unavailable"
            description={error}
            action={<Button variant="secondary" onClick={refetch}>Retry</Button>}
          />
        </Card>
      ) : loading && !data ? (
        <>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {Array.from({ length: 4 }).map((_, index) => (
              <CardSkeleton key={index} />
            ))}
          </div>
          <div className="mt-4 grid gap-4 lg:grid-cols-3">
            <div className="card lg:col-span-2 p-5">
              <Skeleton className="h-4 w-40" />
              <Skeleton className="mt-6 h-56 w-full" />
            </div>
            <CardSkeleton />
          </div>
        </>
      ) : data ? (
        <div className="space-y-4">
          {isAdmin ? <AdminKpis data={data} /> : <MemberKpis data={data} />}

          <div className="grid gap-4 lg:grid-cols-3">
            <Card className="lg:col-span-2">
              <CardHeader
                icon={TrendingUp}
                title="Submission vs resolution trend"
                description="Rolling six-month view — reports created against reports resolved"
                action={<ChartLegend items={[{ label: 'Submitted', color: '#6366f1' }, { label: 'Resolved', color: '#10b981' }]} />}
              />
              <CardBody className="pt-4">
                <TrendChart data={data.trend} height={264} />
              </CardBody>
            </Card>

            <Card>
              <CardHeader icon={Layers} title="Status distribution" description="Where the queue sits today" />
              <CardBody>
                <StatusDonut data={data.statusBreakdown} total={data.cards.total} height={186} />
                <Link
                  to="/errors"
                  className="mt-5 flex items-center justify-between rounded-xl bg-slate-50 px-3 py-2.5 text-[12px] font-semibold text-slate-600 transition hover:bg-slate-100 dark:bg-white/[0.04] dark:text-slate-300 dark:hover:bg-white/[0.07]"
                >
                  Open the full queue <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              </CardBody>
            </Card>
          </div>

          <div className="grid gap-4 lg:grid-cols-3">
            <Card>
              <CardHeader icon={AlertOctagon} title="Priority mix" description="Open risk across the queue" />
              <CardBody className="pt-2">
                <PriorityChart data={data.priorityBreakdown} height={176} />
                <div className="mt-2 grid grid-cols-2 gap-2 text-[11.5px]">
                  <div className="rounded-lg bg-rose-50 px-2.5 py-2 dark:bg-rose-500/10">
                    <p className="font-semibold text-rose-700 dark:text-rose-300">{data.cards.criticalOpen} critical open</p>
                    <p className="text-rose-600/70 dark:text-rose-300/60">Requires immediate triage</p>
                  </div>
                  <div className="rounded-lg bg-slate-50 px-2.5 py-2 dark:bg-white/[0.04]">
                    <p className="font-semibold text-slate-700 dark:text-slate-200">{data.cards.unassignedOpen} unassigned</p>
                    <p className="text-slate-500 dark:text-slate-400">No owner yet</p>
                  </div>
                </div>
              </CardBody>
            </Card>

            <Card>
              <CardHeader
                icon={BarChart3}
                title="Applications"
                description="Reports by application"
                action={
                  isAdmin ? (
                    <Link to="/settings?tab=applications" className="text-[11.5px] font-semibold text-brand-600 hover:underline dark:text-brand-300">
                      Manage
                    </Link>
                  ) : null
                }
              />
              <CardBody>
                <BarList
                  items={data.applicationBreakdown.map((app) => ({
                    key: app.id,
                    label: app.name,
                    count: app.count,
                    color: tone(app.color).hex,
                    hint: `${app.open} open`,
                  }))}
                  emptyLabel="No applications yet"
                />
              </CardBody>
            </Card>

            {isAdmin ? (
              <Card>
                <CardHeader icon={Users} title="Team workload" description="Open assignments per teammate" />
                <CardBody className="space-y-3">
                  {data.workload.length ? (
                    data.workload.map((member) => {
                      const total = member.open + member.completed;
                      return (
                        <Link
                          key={member.id}
                          to={`/errors?assignedTo=${member.id}`}
                          className="flex items-center gap-3 rounded-xl p-1 transition hover:bg-slate-50 dark:hover:bg-white/[0.04]"
                        >
                          <Avatar name={member.fullName} tone={member.avatarTone} size="sm" />
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center justify-between gap-2">
                              <span className="truncate text-[12.5px] font-semibold text-slate-700 dark:text-slate-200">{member.fullName}</span>
                              <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">{member.open} open</span>
                            </div>
                            <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-slate-100 dark:bg-white/[0.07]">
                              <div
                                className="h-full rounded-full bg-brand-500"
                                style={{ width: `${total ? Math.max(4, percent(member.open, total)) : 0}%` }}
                              />
                            </div>
                          </div>
                        </Link>
                      );
                    })
                  ) : (
                    <p className="py-4 text-center text-xs text-slate-400">No assignments in this period</p>
                  )}
                  {data.users ? (
                    <div className="mt-1 grid grid-cols-3 gap-2 border-t border-slate-100 pt-3 text-center dark:border-white/[0.06]">
                      <div>
                        <p className="text-[15px] font-bold text-slate-800 dark:text-slate-100">{data.users.active}</p>
                        <p className="text-[10px] font-medium uppercase tracking-wide text-slate-400">Members</p>
                      </div>
                      <div>
                        <p className="text-[15px] font-bold text-slate-800 dark:text-slate-100">{data.users.pendingRequests}</p>
                        <p className="text-[10px] font-medium uppercase tracking-wide text-slate-400">Requests</p>
                      </div>
                      <div>
                        <p className="text-[15px] font-bold text-slate-800 dark:text-slate-100">{data.users.inactive}</p>
                        <p className="text-[10px] font-medium uppercase tracking-wide text-slate-400">Inactive</p>
                      </div>
                    </div>
                  ) : null}
                </CardBody>
              </Card>
            ) : (
              <Card>
                <CardHeader icon={Bell} title="Latest notifications" description="Updates on your reports" action={<Link to="/notifications" className="text-[11.5px] font-semibold text-brand-600 hover:underline dark:text-brand-300">View all</Link>} />
                <CardBody className="pt-3">
                  <MemberNotifications />
                </CardBody>
              </Card>
            )}
          </div>

          <div className="grid gap-4 lg:grid-cols-3">
            <Card className="lg:col-span-2">
              <CardHeader
                icon={ClipboardList}
                title="Recently updated"
                description="The reports that moved most recently"
                action={
                  <Link to="/errors" className="inline-flex items-center gap-1 text-[11.5px] font-semibold text-brand-600 hover:underline dark:text-brand-300">
                    View all <ChevronRight className="h-3 w-3" />
                  </Link>
                }
              />
              <div className="divide-y divide-slate-100 dark:divide-white/[0.05]">
                {data.recent.length ? (
                  data.recent.map((item) => (
                    <Link
                      key={item.id}
                      to={`/errors/${item.id}`}
                      className="group flex items-center gap-3 px-5 py-3 transition hover:bg-slate-50/80 dark:hover:bg-white/[0.03]"
                    >
                      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-500 dark:bg-white/[0.06] dark:text-slate-400">
                        <FileWarning className="h-4 w-4" />
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-mono text-[10px] font-semibold uppercase text-brand-600 dark:text-brand-300">{item.errorCode}</span>
                          <span className="text-[10.5px] text-slate-400">{item.application?.name}</span>
                        </div>
                        <p className="truncate text-[12.5px] font-semibold text-slate-700 group-hover:text-brand-700 dark:text-slate-200 dark:group-hover:text-brand-300">
                          {item.title}
                        </p>
                      </div>
                      <div className="hidden items-center gap-2 sm:flex">
                        <PriorityBadge priority={item.priority} size="sm" />
                        <StatusBadge status={item.status} size="sm" />
                      </div>
                      <span className="hidden w-20 shrink-0 text-right text-[10.5px] text-slate-400 lg:block">{relativeTime(item.updatedAt)}</span>
                      <ChevronRight className="h-4 w-4 shrink-0 text-slate-300 group-hover:translate-x-0.5 group-hover:text-brand-500 dark:text-slate-600" />
                    </Link>
                  ))
                ) : (
                  <EmptyState compact icon={Inbox} title="Nothing updated yet" description="Reports will appear here as the team works on them." />
                )}
              </div>
            </Card>

            <Card>
              <CardHeader icon={Sparkles} title="Pending actions" description="What needs attention right now" />
              <CardBody className="space-y-2">
                {data.pendingActions.length ? (
                  data.pendingActions.map((action) => {
                    const classes = tone(action.tone);
                    return (
                      <Link
                        key={action.key}
                        to={action.href}
                        className="group flex items-center gap-3 rounded-xl border border-slate-100 px-3 py-2.5 transition hover:border-brand-200 hover:bg-brand-50/30 dark:border-white/[0.06] dark:hover:border-brand-500/30 dark:hover:bg-brand-500/[0.06]"
                      >
                        <span className={clsx('flex h-7 w-7 items-center justify-center rounded-lg', classes.softBg, classes.text)}>
                          <span className="text-[12px] font-bold">{action.count}</span>
                        </span>
                        <span className="flex-1 text-[12px] font-medium text-slate-600 dark:text-slate-300">{action.label}</span>
                        <ArrowUpRight className="h-3.5 w-3.5 text-slate-300 transition group-hover:text-brand-500 dark:text-slate-600" />
                      </Link>
                    );
                  })
                ) : (
                  <div className="py-6 text-center">
                    <CheckCircle2 className="mx-auto h-6 w-6 text-emerald-500" />
                    <p className="mt-2 text-xs font-medium text-slate-500 dark:text-slate-400">Nothing pending. Great work.</p>
                  </div>
                )}
                <div className="mt-3 rounded-xl bg-gradient-to-br from-brand-600 to-violet-600 p-3.5 text-white">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-brand-100/80">Queue health</p>
                  <div className="mt-1.5 flex items-end justify-between">
                    <div>
                      <p className="text-[22px] font-bold leading-none">{data.cards.resolutionRate}%</p>
                      <p className="text-[10.5px] text-brand-100/70">resolved or closed</p>
                    </div>
                    <div className="text-right">
                      <p className="text-[22px] font-bold leading-none">{data.cards.avgResolutionDays ?? '—'}</p>
                      <p className="text-[10.5px] text-brand-100/70">avg days to resolve</p>
                    </div>
                  </div>
                </div>
              </CardBody>
            </Card>
          </div>

          {isAdmin ? (
            <Card>
              <CardHeader icon={CircleDot} title="Lifecycle snapshot" description="Every report by current status" />
              <CardBody className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
                {data.statusBreakdown.map((status) => {
                  const classes = tone(status.tone);
                  return (
                    <Link
                      key={status.value}
                      to={`/errors?status=${status.value}`}
                      className="group rounded-xl border border-slate-100 p-3 transition hover:-translate-y-0.5 hover:border-brand-200 hover:shadow-sm dark:border-white/[0.06] dark:hover:border-brand-500/30"
                    >
                      <span className="flex items-center gap-1.5 text-[10.5px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                        <span className={clsx('h-1.5 w-1.5 rounded-full', classes.dot)} />
                        {status.label}
                      </span>
                      <p className="mt-1 text-[20px] font-bold leading-none text-slate-900 dark:text-white">{status.count}</p>
                    </Link>
                  );
                })}
              </CardBody>
            </Card>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function AdminKpis({ data }: { data: DashboardData }) {
  const { cards, trend } = data;
  const bar = (key: 'submitted' | 'resolved') => trend.slice(-6).map((point) => Math.max(10, percent(point[key], Math.max(...trend.map((t) => t[key]), 1))));
  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <StatCard
        label="Total reports"
        value={cards.total}
        icon={FileWarning}
        color="indigo"
        emphasis
        hint={`${cards.open} still open · ${cards.closed} closed`}
        bars={bar('submitted')}
      />
      <StatCard
        label="Awaiting triage"
        value={cards.submitted}
        icon={Clock}
        color="sky"
        hint={`${cards.underReview} under review right now`}
      />
      <StatCard
        label="Critical & open"
        value={cards.criticalOpen}
        icon={AlertOctagon}
        color="rose"
        hint={`${cards.unassignedOpen} open reports have no owner`}
      />
      <StatCard
        label="Resolved this month"
        value={cards.resolvedThisMonth}
        icon={CheckCircle2}
        color="emerald"
        hint={`${cards.resolutionRate}% lifetime resolution rate`}
        bars={bar('resolved')}
      />
    </div>
  );
}

function MemberKpis({ data }: { data: DashboardData }) {
  const { cards } = data;
  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <StatCard label="Reports in view" value={cards.total} icon={FileWarning} color="indigo" emphasis hint={`${cards.open} still in progress`} />
      <StatCard label="Assigned to you" value={cards.myAssignments ?? 0} icon={ClipboardList} color="amber" hint="Open work you own" />
      <StatCard label="Resolved" value={cards.resolved} icon={CheckCircle2} color="emerald" hint={`${cards.myResolved ?? 0} of your reports completed`} />
      <StatCard label="Avg resolution" value={cards.avgResolutionDays ? `${cards.avgResolutionDays}d` : '—'} icon={TrendingUp} color="violet" hint={`${cards.submittedThisWeek} submitted in the last 7 days`} />
    </div>
  );
}

function MemberNotifications() {
  const { data } = useFetch<{ items: { id: string; title: string; message: string | null; createdAt: string; isRead: boolean; errorId: string | null }[] }>(
    '/api/notifications/recent',
  );
  if (!data?.items?.length) {
    return (
      <div className="py-6 text-center">
        <CheckCircle2 className="mx-auto h-5 w-5 text-emerald-500" />
        <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">No updates yet</p>
      </div>
    );
  }
  return (
    <div className="space-y-1">
      {data.items.slice(0, 4).map((item) => (
        <Link
          key={item.id}
          to={item.errorId ? `/errors/${item.errorId}` : '/notifications'}
          className="flex items-start gap-2 rounded-lg p-2 transition hover:bg-slate-50 dark:hover:bg-white/[0.04]"
        >
          <span className={clsx('mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full', item.isRead ? 'bg-slate-300 dark:bg-slate-600' : 'bg-brand-500')} />
          <span className="min-w-0">
            <span className="block text-[12px] font-medium text-slate-700 dark:text-slate-200">{item.title}</span>
            <span className="block truncate text-[10.5px] text-slate-400">{relativeTime(item.createdAt)}</span>
          </span>
        </Link>
      ))}
    </div>
  );
}
