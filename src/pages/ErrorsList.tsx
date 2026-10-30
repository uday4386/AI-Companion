import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import {
  ChevronDown,
  Download,
  Filter,
  Plus,
  RotateCcw,
  Search,
  SlidersHorizontal,
  UserRound,
  X,
} from 'lucide-react';
import clsx from 'clsx';
import { useFetch } from '@/hooks/useFetch';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/contexts/ToastContext';
import { api, buildQuery } from '@/lib/api';
import type { DirectoryUser, ErrorItem, Pagination as PaginationType, Status } from '@/lib/types';
import { CATEGORIES, OPEN_STATUSES, PRIORITY_ORDER, STATUS_LABEL, STATUS_ORDER, STATUS_TONE, tone } from '@/lib/constants';
import { PageHeader } from '@/components/layout/Topbar';
import { ErrorTable, SortSelect } from '@/components/ErrorTable';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input, Select } from '@/components/ui/Field';
import { Pagination } from '@/components/ui/Pagination';
import { Menu, MenuItem, MenuLabel } from '@/components/ui/Menu';
import { Badge } from '@/components/ui/Badge';
import { PageLoader } from '@/components/ui/Spinner';

interface ListResponse {
  items: ErrorItem[];
  pagination: PaginationType;
  sort: string;
}

interface Facets {
  counts: Record<Status, number>;
  total: number;
}

const FILTER_KEYS = ['search', 'status', 'priority', 'applicationId', 'module', 'category', 'assignedTo', 'submittedBy', 'dateFrom', 'dateTo', 'scope'];

export default function ErrorsListPage() {
  const [params, setParams] = useSearchParams();
  const { user, meta } = useAuth();
  const toast = useToast();
  const isAdmin = user?.role === 'admin';

  const [showFilters, setShowFilters] = useState(false);
  const [searchValue, setSearchValue] = useState(params.get('search') ?? '');
  const [applications, setApplications] = useState<{ id: string; name: string }[]>([]);
  const [directory, setDirectory] = useState<DirectoryUser[]>([]);

  const statusFilter = (params.get('status') ?? '').split(',').filter(Boolean) as Status[];
  const scope = params.get('scope') ?? '';
  const page = Number(params.get('page') ?? '1') || 1;
  const pageSize = Number(params.get('pageSize') ?? '10') || 10;
  const sort = params.get('sort') ?? 'newest';

  const update = (patch: Record<string, string | null>, options: { resetPage?: boolean } = {}) => {
    const next = new URLSearchParams(params);
    for (const [key, value] of Object.entries(patch)) {
      if (value === null || value === '') next.delete(key);
      else next.set(key, value);
    }
    if (options.resetPage !== false) next.delete('page');
    setParams(next, { replace: true });
  };

  const query = useMemo(() => {
    const entries: Record<string, string> = {};
    params.forEach((value, key) => {
      if (value) entries[key] = value;
    });
    return buildQuery(entries);
  }, [params]);

  const list = useFetch<ListResponse>(`/api/errors${query}`, [query]);

  const facetParams = useMemo(() => {
    const next = new URLSearchParams(params);
    next.delete('status');
    next.delete('page');
    const entries: Record<string, string> = {};
    next.forEach((value, key) => {
      if (value) entries[key] = value;
    });
    return buildQuery(entries);
  }, [params]);

  const facets = useFetch<Facets>(`/api/errors/facets${facetParams}`, [facetParams]);

  useEffect(() => {
    void api
      .get<{ applications: { id: string; name: string }[] }>('/api/applications')
      .then((data) => setApplications(data.applications))
      .catch(() => undefined);
    if (isAdmin) {
      void api
        .get<{ users: DirectoryUser[] }>('/api/directory')
        .then((data) => setDirectory(data.users))
        .catch(() => undefined);
    }
  }, [isAdmin]);

  // Keep the local search box in sync when the URL changes (e.g. global search).
  useEffect(() => {
    setSearchValue(params.get('search') ?? '');
  }, [params.get('search')]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      if (searchValue !== (params.get('search') ?? '')) update({ search: searchValue || null });
    }, 350);
    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchValue]);

  const toggleStatus = (status: Status) => {
    const next = statusFilter.includes(status) ? statusFilter.filter((s) => s !== status) : [...statusFilter, status];
    update({ status: next.join(',') || null });
  };

  const activeFilters = FILTER_KEYS.filter((key) => key !== 'scope' && params.get(key)).length;
  const total = list.data?.pagination.total ?? 0;

  const exportData = async (format: 'csv' | 'xlsx' | 'pdf') => {
    try {
      const entries: Record<string, string> = {};
      params.forEach((value, key) => {
        if (value && !['page', 'pageSize'].includes(key)) entries[key] = value;
      });
      await api.download(`/api/reports/export${buildQuery({ ...entries, format })}`, `error-report.${format}`);
      toast.success('Export started', `Downloading ${format.toUpperCase()} with the current filters.`);
    } catch (error) {
      toast.error('Export failed', (error as Error).message);
    }
  };

  const clearAll = () => {
    const next = new URLSearchParams();
    if (!isAdmin) next.set('scope', 'mine');
    setParams(next, { replace: true });
    setSearchValue('');
  };

  const heading = isAdmin ? 'Error queue' : scope === 'assigned' ? 'Assigned to me' : scope === 'mine' ? 'Submitted by me' : 'My errors';

  return (
    <div className="animate-fade-in">
      <PageHeader
        breadcrumb={[{ label: 'Workspace' }, { label: 'Errors' }, ...(scope ? [{ label: heading }] : [])]}
        title={
          <span className="flex items-center gap-2.5">
            {heading}
            <span className="rounded-lg bg-slate-100 px-2 py-0.5 text-[13px] font-semibold text-slate-500 dark:bg-white/[0.08] dark:text-slate-300">
              {total}
            </span>
          </span>
        }
        description={
          isAdmin
            ? 'Every report your team has submitted, with the full triage and resolution toolset.'
            : 'Reports you submitted or that are assigned to you. Admins control status changes — you can add context at any time.'
        }
        actions={
          <>
            <Button variant="secondary" size="sm" onClick={() => setShowFilters((value) => !value)} className="relative">
              <SlidersHorizontal className="h-3.5 w-3.5" /> Filters
              {activeFilters ? (
                <span className="ml-0.5 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-brand-600 px-1 text-[9.5px] font-bold text-white">
                  {activeFilters}
                </span>
              ) : null}
            </Button>
            {isAdmin ? (
              <Menu
                trigger={({ toggle }) => (
                  <Button variant="secondary" size="sm" onClick={toggle}>
                    <Download className="h-3.5 w-3.5" /> Export <ChevronDown className="h-3 w-3 opacity-60" />
                  </Button>
                )}
              >
                {({ close }) => (
                  <div>
                    <MenuLabel>Export current view</MenuLabel>
                    <MenuItem
                      onClick={() => {
                        close();
                        void exportData('csv');
                      }}
                    >
                      CSV spreadsheet
                    </MenuItem>
                    <MenuItem
                      onClick={() => {
                        close();
                        void exportData('xlsx');
                      }}
                    >
                      Excel workbook (.xlsx)
                    </MenuItem>
                    <MenuItem
                      onClick={() => {
                        close();
                        void exportData('pdf');
                      }}
                    >
                      PDF report
                    </MenuItem>
                  </div>
                )}
              </Menu>
            ) : null}
            <Link to="/errors/new">
              <Button size="sm">
                <Plus className="h-4 w-4" /> New error
              </Button>
            </Link>
          </>
        }
      />

      {!isAdmin ? (
        <div className="mb-4 inline-flex rounded-xl bg-slate-100/80 p-1 dark:bg-white/[0.05]">
          {[
            { value: '', label: 'All visible to me' },
            { value: 'mine', label: 'Submitted by me' },
            { value: 'assigned', label: 'Assigned to me' },
          ].map((option) => {
            const active = scope === option.value;
            return (
              <button
                key={option.value}
                type="button"
                onClick={() => update({ scope: option.value || null })}
                className={clsx(
                  'rounded-lg px-3 py-1.5 text-[12.5px] font-semibold transition',
                  active
                    ? 'bg-white text-slate-900 shadow-sm dark:bg-white/[0.1] dark:text-white'
                    : 'text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200',
                )}
              >
                {option.label}
              </button>
            );
          })}
        </div>
      ) : null}

      <Card className="overflow-visible">
        <div className="flex flex-col gap-3 border-b border-slate-100 p-4 dark:border-white/[0.06]">
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative min-w-[220px] flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <Input
                value={searchValue}
                onChange={(event) => setSearchValue(event.target.value)}
                placeholder="Search by error ID, title or keyword…"
                className="h-9 pl-9 text-[13px]"
                aria-label="Search errors"
              />
              {searchValue ? (
                <button
                  type="button"
                  onClick={() => setSearchValue('')}
                  className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-1 text-slate-400 hover:text-slate-600"
                  aria-label="Clear search"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              ) : null}
            </div>
            <SortSelect value={sort} onChange={(value) => update({ sort: value === 'newest' ? null : value })} />
            {scope === 'assigned' && !isAdmin ? null : isAdmin ? (
              <Button
                variant={params.get('assignedTo') === user?.id ? 'subtle' : 'secondary'}
                size="sm"
                onClick={() => update({ assignedTo: params.get('assignedTo') === user?.id ? null : user!.id })}
              >
                <UserRound className="h-3.5 w-3.5" /> Assigned to me
              </Button>
            ) : null}
            {activeFilters ? (
              <Button variant="ghost" size="sm" onClick={clearAll}>
                <RotateCcw className="h-3.5 w-3.5" /> Reset
              </Button>
            ) : null}
          </div>

          <div className="flex flex-wrap items-center gap-1.5">
            <button
              type="button"
              onClick={() => update({ status: null })}
              className={clsx(
                'inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11.5px] font-semibold ring-1 ring-inset transition',
                statusFilter.length === 0
                  ? 'bg-slate-900 text-white ring-slate-900 dark:bg-white dark:text-slate-900 dark:ring-white'
                  : 'bg-white text-slate-600 ring-slate-200 hover:bg-slate-50 dark:bg-white/[0.04] dark:text-slate-300 dark:ring-white/10 dark:hover:bg-white/[0.08]',
              )}
            >
              All statuses
              <span className={clsx('rounded-full px-1 text-[10px]', statusFilter.length === 0 ? 'bg-white/20' : 'bg-slate-100 dark:bg-white/10')}>
                {facets.data?.total ?? total}
              </span>
            </button>
            {STATUS_ORDER.map((status) => {
              const classes = tone(STATUS_TONE[status]);
              const count = facets.data?.counts?.[status] ?? 0;
              const active = statusFilter.includes(status);
              return (
                <button
                  key={status}
                  type="button"
                  onClick={() => toggleStatus(status)}
                  aria-pressed={active}
                  className={clsx(
                    'inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11.5px] font-semibold ring-1 ring-inset transition',
                    active ? classes.badge : 'bg-white text-slate-600 ring-slate-200 hover:bg-slate-50 dark:bg-white/[0.04] dark:text-slate-300 dark:ring-white/10 dark:hover:bg-white/[0.08]',
                  )}
                >
                  <span className={clsx('h-1.5 w-1.5 rounded-full', classes.dot)} />
                  {STATUS_LABEL[status]}
                  <span className="text-[10px] opacity-70">{count}</span>
                </button>
              );
            })}
            <button
              type="button"
              onClick={() => update({ status: OPEN_STATUSES.join(',') })}
              className="rounded-full border border-dashed border-slate-300 px-2.5 py-1 text-[11.5px] font-semibold text-slate-500 transition hover:border-brand-300 hover:text-brand-600 dark:border-white/15 dark:text-slate-400 dark:hover:border-brand-500/40 dark:hover:text-brand-300"
            >
              Open only
            </button>
          </div>
        </div>

        {showFilters ? (
          <div className="border-b border-slate-100 bg-slate-50/60 p-4 dark:border-white/[0.06] dark:bg-white/[0.02]">
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <label className="block">
                <span className="label">Application</span>
                <Select
                  value={params.get('applicationId') ?? ''}
                  onChange={(event) => update({ applicationId: event.target.value || null })}
                  className="h-9 py-0 text-[12.5px]"
                >
                  <option value="">All applications</option>
                  {applications.map((app) => (
                    <option key={app.id} value={app.id}>
                      {app.name}
                    </option>
                  ))}
                </Select>
              </label>
              <label className="block">
                <span className="label">Module</span>
                <Select value={params.get('module') ?? ''} onChange={(event) => update({ module: event.target.value || null })} className="h-9 py-0 text-[12.5px]">
                  <option value="">All modules</option>
                  {(meta?.modules ?? []).map((module) => (
                    <option key={module} value={module}>
                      {module}
                    </option>
                  ))}
                </Select>
              </label>
              <label className="block">
                <span className="label">Category</span>
                <Select value={params.get('category') ?? ''} onChange={(event) => update({ category: event.target.value || null })} className="h-9 py-0 text-[12.5px]">
                  <option value="">All categories</option>
                  {CATEGORIES.map((category) => (
                    <option key={category} value={category}>
                      {category}
                    </option>
                  ))}
                </Select>
              </label>
              <label className="block">
                <span className="label">Priority</span>
                <Select value={params.get('priority') ?? ''} onChange={(event) => update({ priority: event.target.value || null })} className="h-9 py-0 text-[12.5px]">
                  <option value="">All priorities</option>
                  {PRIORITY_ORDER.map((priority) => (
                    <option key={priority} value={priority}>
                      {priority[0].toUpperCase() + priority.slice(1)}
                    </option>
                  ))}
                </Select>
              </label>
              {isAdmin ? (
                <>
                  <label className="block">
                    <span className="label">Assignee</span>
                    <Select value={params.get('assignedTo') ?? ''} onChange={(event) => update({ assignedTo: event.target.value || null })} className="h-9 py-0 text-[12.5px]">
                      <option value="">Anyone</option>
                      <option value="unassigned">Unassigned</option>
                      {directory.map((person) => (
                        <option key={person.id} value={person.id}>
                          {person.fullName}
                        </option>
                      ))}
                    </Select>
                  </label>
                  <label className="block">
                    <span className="label">Submitted by</span>
                    <Select value={params.get('submittedBy') ?? ''} onChange={(event) => update({ submittedBy: event.target.value || null })} className="h-9 py-0 text-[12.5px]">
                      <option value="">Anyone</option>
                      {directory.map((person) => (
                        <option key={person.id} value={person.id}>
                          {person.fullName}
                        </option>
                      ))}
                    </Select>
                  </label>
                </>
              ) : null}
              <label className="block">
                <span className="label">Created from</span>
                <Input type="date" value={params.get('dateFrom') ?? ''} onChange={(event) => update({ dateFrom: event.target.value || null })} className="h-9 py-0 text-[12.5px]" />
              </label>
              <label className="block">
                <span className="label">Created to</span>
                <Input type="date" value={params.get('dateTo') ?? ''} onChange={(event) => update({ dateTo: event.target.value || null })} className="h-9 py-0 text-[12.5px]" />
              </label>
            </div>
          </div>
        ) : null}

        {activeFilters ? (
          <div className="flex flex-wrap items-center gap-1.5 border-b border-slate-100 px-4 py-2.5 dark:border-white/[0.06]">
            <span className="flex items-center gap-1 text-[10.5px] font-semibold uppercase tracking-wide text-slate-400">
              <Filter className="h-3 w-3" /> Active
            </span>
            {params.get('applicationId') ? (
              <FilterChip
                label={applications.find((a) => a.id === params.get('applicationId'))?.name ?? 'Application'}
                onRemove={() => update({ applicationId: null })}
              />
            ) : null}
            {params.get('module') ? <FilterChip label={params.get('module')!} onRemove={() => update({ module: null })} /> : null}
            {params.get('category') ? <FilterChip label={params.get('category')!} onRemove={() => update({ category: null })} /> : null}
            {params.get('priority') ? <FilterChip label={`Priority: ${params.get('priority')}`} onRemove={() => update({ priority: null })} /> : null}
            {params.get('assignedTo') ? (
              <FilterChip
                label={
                  params.get('assignedTo') === 'unassigned'
                    ? 'Unassigned'
                    : `Assignee: ${directory.find((d) => d.id === params.get('assignedTo'))?.fullName ?? 'selected'}`
                }
                onRemove={() => update({ assignedTo: null })}
              />
            ) : null}
            {params.get('submittedBy') ? (
              <FilterChip label={`By: ${directory.find((d) => d.id === params.get('submittedBy'))?.fullName ?? 'selected'}`} onRemove={() => update({ submittedBy: null })} />
            ) : null}
            {params.get('dateFrom') ? <FilterChip label={`From ${params.get('dateFrom')}`} onRemove={() => update({ dateFrom: null })} /> : null}
            {params.get('dateTo') ? <FilterChip label={`To ${params.get('dateTo')}`} onRemove={() => update({ dateTo: null })} /> : null}
            {statusFilter.length ? <FilterChip label={`${statusFilter.length} statuses`} onRemove={() => update({ status: null })} /> : null}
            {params.get('search') ? <FilterChip label={`“${params.get('search')}”`} onRemove={() => update({ search: null })} /> : null}
          </div>
        ) : null}

        <ErrorTable
          items={list.data?.items ?? []}
          loading={list.loading}
          sort={sort}
          onSortChange={(value) => update({ sort: value === 'newest' ? null : value })}
          emptyTitle={activeFilters ? 'No reports match these filters' : 'No reports yet'}
          emptyDescription={
            activeFilters
              ? 'Try widening the filters or clearing the search to see more of the queue.'
              : isAdmin
                ? 'Reports submitted by your team will appear here.'
                : 'Submit your first error report to start tracking it.'
          }
          emptyAction={
            activeFilters ? (
              <Button variant="secondary" size="sm" onClick={clearAll}>
                <RotateCcw className="h-3.5 w-3.5" /> Clear filters
              </Button>
            ) : (
              <Link to="/errors/new">
                <Button size="sm">
                  <Plus className="h-4 w-4" /> Submit an error
                </Button>
              </Link>
            )
          }
        />

        {list.data?.items?.length ? (
          <div className="border-t border-slate-100 dark:border-white/[0.06]">
            <Pagination
              pagination={list.data.pagination}
              onPageChange={(next) => update({ page: String(next) }, { resetPage: false })}
              onPageSizeChange={(size) => update({ pageSize: String(size), page: null })}
            />
          </div>
        ) : null}
      </Card>

      {list.error ? (
        <p className="mt-3 text-center text-xs text-rose-600 dark:text-rose-400">{list.error}</p>
      ) : null}
    </div>
  );
}

function FilterChip({ label, onRemove }: { label: string; onRemove: () => void }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-md bg-slate-100 py-0.5 pl-2 pr-1 text-[11px] font-medium text-slate-600 dark:bg-white/[0.08] dark:text-slate-300">
      {label}
      <button type="button" onClick={onRemove} className="rounded p-0.5 text-slate-400 hover:bg-slate-200 hover:text-slate-600 dark:hover:bg-white/10" aria-label={`Remove ${label} filter`}>
        <X className="h-3 w-3" />
      </button>
    </span>
  );
}
