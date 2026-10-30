import { Fragment, useState } from 'react';
import { ChevronDown, ScrollText, Search, ShieldCheck } from 'lucide-react';
import clsx from 'clsx';
import { useFetch } from '@/hooks/useFetch';
import type { AuditLogItem, Pagination } from '@/lib/types';
import { formatDateTime, relativeTime } from '@/lib/format';
import { PageHeader } from '@/components/layout/Topbar';
import { Card } from '@/components/ui/Card';
import { Input, Select, Field } from '@/components/ui/Field';
import { Pagination as Pager } from '@/components/ui/Pagination';
import { EmptyState } from '@/components/ui/EmptyState';
import { TableSkeleton } from '@/components/ui/Spinner';
import { Badge } from '@/components/ui/Badge';
import { Switch } from '@/components/ui/Switch';

interface AuditResponse {
  items: AuditLogItem[];
  actions: { value: string; label: string }[];
  pagination: Pagination;
}

const ENTITY_TYPES = ['error', 'profile', 'invitation', 'access_request', 'application', 'settings', 'report'];

export default function AuditLogsPage() {
  const [search, setSearch] = useState('');
  const [action, setAction] = useState('');
  const [entityType, setEntityType] = useState('');
  const [sensitive, setSensitive] = useState(false);
  const [dateFrom, setDateFrom] = useState('');
  const [page, setPage] = useState(1);
  const [expanded, setExpanded] = useState<string | null>(null);

  const params = new URLSearchParams();
  if (search) params.set('search', search);
  if (action) params.set('action', action);
  if (entityType) params.set('entityType', entityType);
  if (sensitive) params.set('sensitive', 'true');
  if (dateFrom) params.set('dateFrom', dateFrom);
  params.set('page', String(page));
  params.set('pageSize', '25');

  const { data, loading, refetch } = useFetch<AuditResponse>(`/api/audit-logs?${params.toString()}`, [params.toString()]);

  return (
    <div className="animate-fade-in">
      <PageHeader
        breadcrumb={[{ label: 'Insights' }, { label: 'Audit logs' }]}
        title="Audit logs"
        description="An immutable record of sensitive actions: role and status changes, assignments, exports and blocked privilege attempts."
        actions={
          <div className="flex items-center gap-2 rounded-xl bg-emerald-50 px-3 py-2 text-[11px] font-semibold text-emerald-700 ring-1 ring-inset ring-emerald-600/20 dark:bg-emerald-500/10 dark:text-emerald-300 dark:ring-emerald-400/25">
            <ShieldCheck className="h-3.5 w-3.5" /> Append-only
          </div>
        }
      />

      <Card>
        <div className="grid gap-3 border-b border-slate-100 p-4 sm:grid-cols-2 lg:grid-cols-4 dark:border-white/[0.06]">
          <Field label="Search">
            <Input
              value={search}
              onChange={(event) => {
                setSearch(event.target.value);
                setPage(1);
              }}
              placeholder="Actor, action or entity…"
              leadingIcon={Search}
              className="h-9 py-0 text-[12.5px]"
            />
          </Field>
          <Field label="Action">
            <Select
              value={action}
              onChange={(event) => {
                setAction(event.target.value);
                setPage(1);
              }}
              className="h-9 py-0 text-[12.5px]"
            >
              <option value="">All actions</option>
              {(data?.actions ?? []).map((item) => (
                <option key={item.value} value={item.value}>
                  {item.label}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Entity">
            <Select
              value={entityType}
              onChange={(event) => {
                setEntityType(event.target.value);
                setPage(1);
              }}
              className="h-9 py-0 text-[12.5px]"
            >
              <option value="">All entities</option>
              {ENTITY_TYPES.map((type) => (
                <option key={type} value={type}>
                  {type.replace('_', ' ')}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="From">
            <Input
              type="date"
              value={dateFrom}
              onChange={(event) => {
                setDateFrom(event.target.value);
                setPage(1);
              }}
              className="h-9 py-0 text-[12.5px]"
            />
          </Field>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-4 py-2.5 dark:border-white/[0.06]">
          <div className="flex items-center gap-2 text-[11.5px] font-medium text-slate-600 dark:text-slate-300">
            <Switch checked={sensitive} onChange={setSensitive} size="sm" />
            <span>Sensitive only</span>
            <span className="text-[11px] text-slate-400">Role changes, account state, settings and exports</span>
          </div>
          <span className="text-[11px] text-slate-400">
            {data?.pagination.total ?? 0} events · page {data?.pagination.page ?? 1} of {data?.pagination.totalPages ?? 1}
          </span>
        </div>

        {loading ? (
          <TableSkeleton rows={8} columns={5} />
        ) : data?.items.length ? (
          <>
            <div className="table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    <th className="w-40">When</th>
                    <th>Actor</th>
                    <th>Action</th>
                    <th className="hidden md:table-cell">Entity</th>
                    <th className="w-10" />
                  </tr>
                </thead>
                <tbody>
                  {data.items.map((item) => (
                    <Fragment key={item.id}>
                      <tr
                        className="cursor-pointer"
                        onClick={() => setExpanded(expanded === item.id ? null : item.id)}
                      >
                        <td>
                          <span className="block text-[11.5px] font-medium text-slate-600 dark:text-slate-300">{relativeTime(item.createdAt)}</span>
                          <span className="block text-[10.5px] text-slate-400">{formatDateTime(item.createdAt)}</span>
                        </td>
                        <td>
                          <span className="text-[12.5px] font-semibold text-slate-700 dark:text-slate-200">{item.actorName}</span>
                          <span className="block text-[10.5px] text-slate-400">{item.actorId ? 'authenticated' : 'unauthenticated'}</span>
                        </td>
                        <td>
                          <span className="flex flex-wrap items-center gap-1.5">
                            <Badge color={item.action.includes('denied') ? 'rose' : item.action.includes('user') || item.action.includes('invitation') ? 'indigo' : item.action.includes('error') ? 'sky' : 'slate'} size="sm">
                              {item.actionLabel}
                            </Badge>
                            {item.errorCode ? <span className="font-mono text-[9.5px] text-slate-400">{item.errorCode}</span> : null}
                          </span>
                        </td>
                        <td className="hidden md:table-cell">
                          <span className="text-[11.5px] text-slate-500 dark:text-slate-400">{item.entityType}</span>
                        </td>
                        <td>
                          <ChevronDown className={clsx('h-4 w-4 text-slate-300 transition', expanded === item.id && 'rotate-180')} />
                        </td>
                      </tr>
                      {expanded === item.id ? (
                        <tr>
                          <td colSpan={5} className="bg-slate-50/70 dark:bg-white/[0.02]">
                            <div className="space-y-1.5">
                              <p className="text-[10.5px] font-semibold uppercase tracking-wide text-slate-400">Metadata</p>
                              <pre className="max-h-64 overflow-auto rounded-lg border border-slate-200 bg-white p-3 font-mono text-[11px] leading-relaxed text-slate-600 dark:border-white/10 dark:bg-slate-950/60 dark:text-slate-300">
                                {JSON.stringify(item.metadata ?? { note: 'No additional metadata recorded' }, null, 2)}
                              </pre>
                              <p className="text-[10.5px] text-slate-400">
                                Action <span className="font-mono">{item.action}</span> · entity id <span className="font-mono">{item.entityId ?? '—'}</span>
                              </p>
                            </div>
                          </td>
                        </tr>
                      ) : null}
                    </Fragment>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="border-t border-slate-100 dark:border-white/[0.06]">
              <Pager pagination={data.pagination} onPageChange={setPage} />
            </div>
          </>
        ) : (
          <EmptyState icon={ScrollText} title="No audit events match these filters" description="Adjust the search or clear the sensitive-only toggle." />
        )}
      </Card>
    </div>
  );
}
