import { Link, useNavigate } from 'react-router-dom';
import { ArrowDownWideNarrow, ChevronRight, MessageSquare, Paperclip } from 'lucide-react';
import clsx from 'clsx';
import type { ErrorItem } from '@/lib/types';
import { Avatar } from './ui/Avatar';
import { PriorityBadge, StatusBadge } from './StatusBadge';
import { EmptyState } from './ui/EmptyState';
import { TableSkeleton } from './ui/Spinner';
import { relativeTime } from '@/lib/format';
import { tone } from '@/lib/constants';

interface ErrorTableProps {
  items: ErrorItem[];
  loading?: boolean;
  emptyTitle?: string;
  emptyDescription?: string;
  emptyAction?: React.ReactNode;
  sort?: string;
  onSortChange?: (sort: string) => void;
}

const SORTABLE = [
  { key: 'newest', label: 'Newest' },
  { key: 'updated', label: 'Recently updated' },
  { key: 'priority', label: 'Priority' },
  { key: 'status', label: 'Status' },
  { key: 'oldest', label: 'Oldest' },
];

export function ErrorTable({ items, loading, emptyTitle = 'No reports found', emptyDescription, emptyAction, sort, onSortChange }: ErrorTableProps) {
  const navigate = useNavigate();

  if (loading) {
    return (
      <div className="overflow-hidden">
        <TableSkeleton rows={7} columns={6} />
      </div>
    );
  }

  if (!items.length) {
    return <EmptyState title={emptyTitle} description={emptyDescription} action={emptyAction} />;
  }

  return (
    <>
      {/* Desktop table */}
      <div className="table-wrap hidden md:block">
        <table className="data-table">
          <thead>
            <tr>
              <th scope="col">Report</th>
              <th scope="col">Status</th>
              <th scope="col">Priority</th>
              <th scope="col">Assignee</th>
              <th scope="col" className="hidden lg:table-cell">Submitted by</th>
              <th scope="col">
                {onSortChange ? (
                  <span className="inline-flex items-center gap-1">
                    Activity
                    <ArrowDownWideNarrow className="h-3 w-3 opacity-60" />
                  </span>
                ) : (
                  'Activity'
                )}
              </th>
              <th scope="col" className="w-8">
                <span className="sr-only">Open</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {items.map((item) => {
              const application = item.application;
              const appTone = tone(application?.color);
              return (
                <tr key={item.id} className="group cursor-pointer" onClick={() => navigate(`/errors/${item.id}`)}>
                  <td className="max-w-[420px]">
                    <div className="flex items-start gap-3">
                      <span
                        className={clsx('mt-1.5 h-8 w-1 shrink-0 rounded-full')}
                        style={{ backgroundColor: appTone.hex, opacity: 0.85 }}
                        aria-hidden
                      />
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <Link
                            to={`/errors/${item.id}`}
                            onClick={(event) => event.stopPropagation()}
                            className="font-mono text-[10.5px] font-semibold uppercase tracking-wide text-brand-600 hover:underline dark:text-brand-300"
                          >
                            {item.errorCode}
                          </Link>
                          {application ? (
                            <span className="text-[11px] text-slate-400 dark:text-slate-500">
                              {application.name} · {item.module}
                            </span>
                          ) : null}
                        </div>
                        <p className="mt-0.5 truncate text-[13.5px] font-semibold text-slate-800 group-hover:text-brand-700 dark:text-slate-100 dark:group-hover:text-brand-200">
                          {item.title}
                        </p>
                      </div>
                    </div>
                  </td>
                  <td>
                    <StatusBadge status={item.status} size="sm" />
                  </td>
                  <td>
                    <PriorityBadge priority={item.priority} size="sm" />
                  </td>
                  <td>
                    {item.assignedTo ? (
                      <span className="flex items-center gap-2">
                        <Avatar name={item.assignedTo.fullName} tone={item.assignedTo.avatarTone} size="xs" />
                        <span className="truncate text-[12.5px] text-slate-600 dark:text-slate-300">{item.assignedTo.fullName}</span>
                      </span>
                    ) : (
                      <span className="text-[11.5px] font-medium text-slate-400 dark:text-slate-500">Unassigned</span>
                    )}
                  </td>
                  <td className="hidden lg:table-cell">
                    <span className="flex items-center gap-2">
                      <Avatar name={item.submittedBy?.fullName} tone={item.submittedBy?.avatarTone} size="xs" />
                      <span className="truncate text-[12.5px] text-slate-600 dark:text-slate-300">{item.submittedBy?.fullName}</span>
                    </span>
                  </td>
                  <td>
                    <div className="flex flex-col gap-1">
                      <span className="text-[11.5px] font-medium text-slate-500 dark:text-slate-400" title={item.updatedAt}>
                        {relativeTime(item.updatedAt)}
                      </span>
                      <span className="flex items-center gap-2.5 text-[11px] text-slate-400 dark:text-slate-500">
                        <span className="inline-flex items-center gap-1">
                          <MessageSquare className="h-3 w-3" /> {item.commentCount ?? 0}
                        </span>
                        <span className="inline-flex items-center gap-1">
                          <Paperclip className="h-3 w-3" /> {item.attachmentCount ?? 0}
                        </span>
                      </span>
                    </div>
                  </td>
                  <td>
                    <ChevronRight className="h-4 w-4 text-slate-300 transition group-hover:translate-x-0.5 group-hover:text-brand-500 dark:text-slate-600" />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Mobile cards */}
      <div className="divide-y divide-slate-100 md:hidden dark:divide-white/[0.06]">
        {items.map((item) => (
          <Link key={item.id} to={`/errors/${item.id}`} className="block px-4 py-3.5 transition active:bg-slate-50 dark:active:bg-white/[0.03]">
            <div className="flex items-center justify-between gap-2">
              <span className="font-mono text-[10.5px] font-semibold uppercase text-brand-600 dark:text-brand-300">{item.errorCode}</span>
              <StatusBadge status={item.status} size="sm" />
            </div>
            <p className="mt-1 text-[13.5px] font-semibold leading-snug text-slate-800 dark:text-slate-100">{item.title}</p>
            <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px] text-slate-500 dark:text-slate-400">
              <PriorityBadge priority={item.priority} size="sm" />
              <span>{item.application?.name}</span>
              <span className="text-slate-300 dark:text-slate-600">•</span>
              <span>{item.assignedTo ? `Assigned to ${item.assignedTo.fullName}` : 'Unassigned'}</span>
              <span className="ml-auto">{relativeTime(item.updatedAt)}</span>
            </div>
          </Link>
        ))}
      </div>
    </>
  );
}

export function SortSelect({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  return (
    <label className="inline-flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
      <span className="hidden sm:inline">Sort</span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="h-8 rounded-lg border border-slate-200 bg-white pl-2 pr-7 text-xs font-medium text-slate-700 outline-none dark:border-white/10 dark:bg-white/[0.04] dark:text-slate-200"
      >
        {SORTABLE.map((option) => (
          <option key={option.key} value={option.key}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}
