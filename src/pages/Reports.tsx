import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { BarChart3, CheckCircle2, ChevronDown, Clock, Download, FileSpreadsheet, Filter, Percent, RefreshCw, TrendingUp, Users } from 'lucide-react';
import clsx from 'clsx';
import { useFetch } from '@/hooks/useFetch';
import { api, buildQuery } from '@/lib/api';
import { useToast } from '@/contexts/ToastContext';
import type { AnalyticsData, AnalyticsRow } from '@/lib/types';
import { CATEGORIES, PRIORITY_LABEL, PRIORITY_ORDER, PRIORITY_TONE, STATUS_LABEL, STATUS_ORDER, STATUS_TONE, tone } from '@/lib/constants';
import { formatDate, percent } from '@/lib/format';
import { PageHeader } from '@/components/layout/Topbar';
import { Card, CardBody, CardHeader } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Select } from '@/components/ui/Field';
import { Tabs } from '@/components/ui/Tabs';
import { TrendChart } from '@/components/charts/TrendChart';
import { Avatar } from '@/components/ui/Avatar';
import { Menu, MenuItem, MenuLabel } from '@/components/ui/Menu';
import { EmptyState } from '@/components/ui/EmptyState';
import { Skeleton } from '@/components/ui/Spinner';

const GROUP_TABS = [
  { value: 'application', label: 'Application' },
  { value: 'module', label: 'Module' },
  { value: 'category', label: 'Category' },
  { value: 'priority', label: 'Priority' },
  { value: 'status', label: 'Status' },
  { value: 'submitter', label: 'Submitter' },
  { value: 'assignee', label: 'Assignee' },
];

export default function ReportsPage() {
  const toast = useToast();
  const [groupBy, setGroupBy] = useState('application');
  const [range, setRange] = useState('90');
  const [applicationId, setApplicationId] = useState('');
  const [category, setCategory] = useState('');
  const [priority, setPriority] = useState('');
  const [applications, setApplications] = useState<{ id: string; name: string }[]>([]);

  const dateFrom = useMemo(() => {
    if (range === 'all') return undefined;
    return new Date(Date.now() - Number(range) * 86_400_000).toISOString().slice(0, 10);
  }, [range]);

  const filters = { dateFrom, applicationId, category, priority };
  const query = buildQuery({ ...filters, groupBy });
  const { data, loading, error, refetch } = useFetch<AnalyticsData>(`/api/reports/analytics${query}`, [query]);

  useEffect(() => {
    void api
      .get<{ applications: { id: string; name: string }[] }>('/api/applications')
      .then((result) => setApplications(result.applications))
      .catch(() => undefined);
  }, []);

  const totals = useMemo(() => {
    const rows = data?.rows ?? [];
    const total = rows.reduce((sum, row) => sum + row.total, 0);
    const open = rows.reduce((sum, row) => sum + row.open, 0);
    const completed = rows.reduce((sum, row) => sum + row.completed, 0);
    const rejected = rows.reduce((sum, row) => sum + row.rejected, 0);
    const weighted = rows.reduce((sum, row) => sum + (row.avgResolutionDays ?? 0) * row.completed, 0);
    return {
      total,
      open,
      completed,
      rejected,
      completionRate: total ? Math.round(((completed + rejected) / total) * 100) : 0,
      avgResolutionDays: completed ? Math.round((weighted / completed) * 10) / 10 : null,
    };
  }, [data]);

  const exportData = async (format: 'csv' | 'xlsx' | 'pdf') => {
    try {
      await api.download(`/api/reports/export${buildQuery({ ...filters, format })}`, `error-report.${format}`);
      toast.success('Export ready', `Downloading ${format.toUpperCase()} with the current filters.`);
    } catch (err) {
      toast.error('Export failed', (err as Error).message);
    }
  };

  const groupLabel = GROUP_TABS.find((tab) => tab.value === groupBy)?.label ?? 'Group';

  return (
    <div className="animate-fade-in">
      <PageHeader
        breadcrumb={[{ label: 'Insights' }, { label: 'Reports & analytics' }]}
        title="Reports & analytics"
        description="Understand volume, ageing and resolution performance. Every export respects the filters applied here."
        actions={
          <>
            <Button variant="secondary" size="sm" onClick={refetch}>
              <RefreshCw className={clsx('h-3.5 w-3.5', loading && 'animate-spin')} /> Refresh
            </Button>
            <Menu
              trigger={({ toggle }) => (
                <Button size="sm" onClick={toggle}>
                  <Download className="h-3.5 w-3.5" /> Export <ChevronDown className="h-3 w-3 opacity-70" />
                </Button>
              )}
            >
              {({ close }) => (
                <div>
                  <MenuLabel>Export report</MenuLabel>
                  <MenuItem
                    onClick={() => {
                      close();
                      void exportData('csv');
                    }}
                  >
                    <FileSpreadsheet className="h-4 w-4" /> CSV spreadsheet
                  </MenuItem>
                  <MenuItem
                    onClick={() => {
                      close();
                      void exportData('xlsx');
                    }}
                  >
                    <FileSpreadsheet className="h-4 w-4" /> Excel workbook
                  </MenuItem>
                  <MenuItem
                    onClick={() => {
                      close();
                      void exportData('pdf');
                    }}
                  >
                    <FileSpreadsheet className="h-4 w-4" /> PDF report
                  </MenuItem>
                </div>
              )}
            </Menu>
          </>
        }
      />

      <Card className="mb-4">
        <CardBody className="flex flex-wrap items-end gap-3 p-4">
          <span className="flex items-center gap-2 pb-1 text-[11px] font-semibold uppercase tracking-wide text-slate-400">
            <Filter className="h-3.5 w-3.5" /> Filters
          </span>
          <label className="block">
            <span className="label">Period</span>
            <Select value={range} onChange={(event) => setRange(event.target.value)} className="h-9 min-w-[140px] py-0 text-[12.5px]">
              <option value="30">Last 30 days</option>
              <option value="90">Last 90 days</option>
              <option value="365">Last 12 months</option>
              <option value="all">All time</option>
            </Select>
          </label>
          <label className="block">
            <span className="label">Application</span>
            <Select value={applicationId} onChange={(event) => setApplicationId(event.target.value)} className="h-9 min-w-[170px] py-0 text-[12.5px]">
              <option value="">All applications</option>
              {applications.map((app) => (
                <option key={app.id} value={app.id}>
                  {app.name}
                </option>
              ))}
            </Select>
          </label>
          <label className="block">
            <span className="label">Category</span>
            <Select value={category} onChange={(event) => setCategory(event.target.value)} className="h-9 min-w-[140px] py-0 text-[12.5px]">
              <option value="">All categories</option>
              {CATEGORIES.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </Select>
          </label>
          <label className="block">
            <span className="label">Priority</span>
            <Select value={priority} onChange={(event) => setPriority(event.target.value)} className="h-9 min-w-[130px] py-0 text-[12.5px]">
              <option value="">All priorities</option>
              {PRIORITY_ORDER.map((item) => (
                <option key={item} value={item}>
                  {PRIORITY_LABEL[item]}
                </option>
              ))}
            </Select>
          </label>
          <div className="ml-auto flex items-center gap-2 pb-1 text-[11.5px] text-slate-500 dark:text-slate-400">
            <span className="inline-flex items-center gap-1 rounded-lg bg-slate-50 px-2 py-1 dark:bg-white/[0.04]">
              {dateFrom ? formatDate(dateFrom) : 'All time'} <span className="text-slate-300 dark:text-slate-600">→</span> {formatDate(new Date())}
            </span>
          </div>
        </CardBody>
      </Card>

      {error ? (
        <Card>
          <EmptyState title="Could not load analytics" description={error} action={<Button variant="secondary" onClick={refetch}>Retry</Button>} />
        </Card>
      ) : loading && !data ? (
        <div className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {Array.from({ length: 4 }).map((_, index) => (
              <Card key={index} className="p-4">
                <Skeleton className="h-3 w-20" />
                <Skeleton className="mt-3 h-7 w-24" />
              </Card>
            ))}
          </div>
          <Card className="p-5">
            <Skeleton className="h-4 w-40" />
            <Skeleton className="mt-4 h-64 w-full" />
          </Card>
        </div>
      ) : data ? (
        <div className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <MetricTile label="Reports in period" value={totals.total} icon={BarChart3} color="indigo" hint={`${totals.open} still open`} />
            <MetricTile label="Completion rate" value={`${totals.completionRate}%`} icon={Percent} color="emerald" hint={`${totals.completed} resolved or closed`} />
            <MetricTile label="Avg. resolution" value={totals.avgResolutionDays ? `${totals.avgResolutionDays}d` : '—'} icon={Clock} color="violet" hint="From submission to resolved" />
            <MetricTile label="Rejected" value={totals.rejected} icon={CheckCircle2} color="rose" hint={`${percent(totals.rejected, Math.max(totals.total, 1))}% of volume`} />
          </div>

          <Card>
            <CardHeader
              icon={TrendingUp}
              title="Volume over the last 12 months"
              description="Submitted against resolved, based on the current filters"
              action={<span className="text-[11px] text-slate-400">{formatDate(new Date(Date.now() - 365 * 86400000))} → {formatDate(new Date())}</span>}
            />
            <CardBody>
              <TrendChart data={data.trend} height={280} />
            </CardBody>
          </Card>

          <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
            <Card>
              <CardHeader
                icon={BarChart3}
                title={`Breakdown by ${groupLabel.toLowerCase()}`}
                description="Sorted by volume. Completion includes resolved, closed and rejected reports."
              />
              <div className="px-4 pt-3">
                <Tabs items={GROUP_TABS} value={groupBy} onChange={setGroupBy} variant="pill" />
              </div>
              <div className="table-wrap mt-2">
                <table className="data-table min-w-[720px]">
                  <thead>
                    <tr>
                      <th>{groupLabel}</th>
                      <th className="text-right">Reports</th>
                      <th className="text-right">Open</th>
                      <th className="text-right">Completed</th>
                      <th className="text-right">Rejected</th>
                      <th className="text-right">Avg. days</th>
                      <th className="w-[160px]">Completion</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.rows.length ? (
                      data.rows.map((row) => (
                        <tr key={row.key}>
                          <td className="font-medium text-slate-800 dark:text-slate-100">
                            {groupBy === 'priority' ? PRIORITY_LABEL[row.key as keyof typeof PRIORITY_LABEL] ?? row.label : null}
                            {groupBy === 'status' ? STATUS_LABEL[row.key as keyof typeof STATUS_LABEL] ?? row.label : null}
                            {groupBy !== 'priority' && groupBy !== 'status' ? row.label : null}
                          </td>
                          <td className="text-right font-semibold text-slate-800 dark:text-slate-100">{row.total}</td>
                          <td className="text-right text-slate-600 dark:text-slate-300">{row.open}</td>
                          <td className="text-right text-slate-600 dark:text-slate-300">{row.completed}</td>
                          <td className="text-right text-slate-500 dark:text-slate-400">{row.rejected}</td>
                          <td className="text-right text-slate-600 dark:text-slate-300">{row.avgResolutionDays ?? '—'}</td>
                          <td>
                            <div className="flex items-center gap-2">
                              <div className="h-1.5 w-20 overflow-hidden rounded-full bg-slate-100 dark:bg-white/10">
                                <div className="h-full rounded-full bg-brand-500" style={{ width: `${row.completionRate}%` }} />
                              </div>
                              <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">{row.completionRate}%</span>
                            </div>
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={7}>
                          <EmptyState compact title="No data for these filters" description="Try a wider period or clear a filter." />
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </Card>

            <div className="space-y-4">
              <Card>
                <CardHeader icon={Users} title="Top submitters" description="Most reports in this period" />
                <CardBody className="space-y-2.5 pt-3">
                  {data.topSubmitters.length ? (
                    data.topSubmitters.map((person, index) => (
                      <div key={person.id} className="flex items-center gap-2.5">
                        <span className="w-4 text-[10.5px] font-bold text-slate-400">{index + 1}</span>
                        <Avatar name={person.fullName} tone={person.avatarTone} size="sm" />
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-[12px] font-semibold text-slate-700 dark:text-slate-200">{person.fullName}</p>
                          <p className="text-[10px] text-slate-400">{person.resolved} resolved</p>
                        </div>
                        <span className="text-[12px] font-bold text-slate-800 dark:text-slate-100">{person.total}</span>
                      </div>
                    ))
                  ) : (
                    <p className="py-4 text-center text-xs text-slate-400">No submissions in this period</p>
                  )}
                </CardBody>
              </Card>

              <Card>
                <CardHeader icon={FileSpreadsheet} title="Export this report" description="Includes filters, timestamps and full detail" />
                <CardBody className="space-y-2 pt-3">
                  <Button variant="secondary" fullWidth size="sm" onClick={() => void exportData('csv')}>
                    Download CSV
                  </Button>
                  <Button variant="secondary" fullWidth size="sm" onClick={() => void exportData('xlsx')}>
                    Download Excel (.xlsx)
                  </Button>
                  <Button variant="secondary" fullWidth size="sm" onClick={() => void exportData('pdf')}>
                    Download PDF
                  </Button>
                  <p className="pt-1 text-[10.5px] leading-relaxed text-slate-400">
                    Exports respect your permissions and the filters above. Each export is recorded in the audit log.
                  </p>
                </CardBody>
              </Card>
            </div>
          </div>

          <Card>
            <CardHeader icon={BarChart3} title="Priority × status matrix" description="Where risk sits across the lifecycle" />
            <div className="table-wrap">
              <table className="data-table min-w-[760px]">
                <thead>
                  <tr>
                    <th className="sticky left-0 bg-slate-50/90 dark:bg-slate-900">Priority</th>
                    {STATUS_ORDER.map((status) => (
                      <th key={status} className="text-center">
                        {STATUS_LABEL[status]}
                      </th>
                    ))}
                    <th className="text-right">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {PRIORITY_ORDER.map((priorityValue) => {
                    const cells = STATUS_ORDER.map((status) => ({
                      status,
                      count: data.priorityMatrix.find((cell) => cell.priority === priorityValue && cell.status === status)?.count ?? 0,
                    }));
                    const rowTotal = cells.reduce((sum, cell) => sum + cell.count, 0);
                    return (
                      <tr key={priorityValue}>
                        <td className="font-medium">
                          <span className={clsx('badge', tone(PRIORITY_TONE[priorityValue]).badge)}>{PRIORITY_LABEL[priorityValue]}</span>
                        </td>
                        {cells.map((cell) => {
                          const max = Math.max(...data.priorityMatrix.map((entry) => entry.count), 1);
                          const intensity = cell.count / max;
                          return (
                            <td key={cell.status} className="text-center">
                              <Link
                                to={`/errors?priority=${priorityValue}&status=${cell.status}`}
                                className="inline-flex h-7 w-9 items-center justify-center rounded-md text-[11.5px] font-semibold transition hover:ring-2 hover:ring-brand-400/50"
                                style={{
                                  backgroundColor: cell.count ? `${tone(STATUS_TONE[cell.status]).hex}${Math.round(12 + intensity * 38).toString(16).padStart(2, '0')}` : undefined,
                                  color: cell.count ? undefined : 'rgb(148 163 184)',
                                }}
                                title={`${cell.count} ${PRIORITY_LABEL[priorityValue]} reports in ${STATUS_LABEL[cell.status]}`}
                              >
                                {cell.count || '·'}
                              </Link>
                            </td>
                          );
                        })}
                        <td className="text-right font-semibold text-slate-800 dark:text-slate-100">{rowTotal}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      ) : null}
    </div>
  );
}

function MetricTile({
  label,
  value,
  icon: Icon,
  color,
  hint,
}: {
  label: string;
  value: React.ReactNode;
  icon: React.ComponentType<{ className?: string }>;
  color: string;
  hint?: string;
}) {
  const classes = tone(color);
  return (
    <Card className="p-4">
      <div className="flex items-start justify-between gap-2">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">{label}</p>
        <span className={clsx('flex h-7 w-7 items-center justify-center rounded-lg', classes.softBg, classes.text)}>
          <Icon className="h-3.5 w-3.5" />
        </span>
      </div>
      <p className="mt-2.5 text-[24px] font-bold leading-none text-slate-900 dark:text-white">{value}</p>
      {hint ? <p className="mt-2 text-[11px] text-slate-500 dark:text-slate-400">{hint}</p> : null}
    </Card>
  );
}

export type { AnalyticsRow };
