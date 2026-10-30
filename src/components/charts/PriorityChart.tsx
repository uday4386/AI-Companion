import { Bar, BarChart, Cell, ResponsiveContainer, Tooltip, XAxis } from 'recharts';
import { tone } from '@/lib/constants';
import type { Priority } from '@/lib/types';

interface PriorityDatum {
  value: Priority;
  label: string;
  tone: string;
  count: number;
}

export function PriorityChart({ data, height = 190 }: { data: PriorityDatum[]; height?: number }) {
  return (
    <div style={{ height }} className="w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 4, left: 4, bottom: 0 }} barCategoryGap="28%">
          <XAxis dataKey="label" axisLine={false} tickLine={false} dy={6} />
          <Tooltip
            cursor={{ fill: 'rgba(148,163,184,0.08)' }}
            formatter={(value: number, _name, entry) => [`${value} reports`, (entry?.payload as PriorityDatum)?.label ?? '']}
            contentStyle={{ borderRadius: 12, border: '1px solid rgba(148,163,184,.3)', fontSize: 12 }}
          />
          <Bar dataKey="count" radius={[7, 7, 3, 3]} maxBarSize={46}>
            {data.map((item) => (
              <Cell key={item.value} fill={tone(item.tone).hex} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export function BarList({
  items,
  emptyLabel = 'No data yet',
}: {
  items: { key: string; label: string; count: number; color?: string; hint?: string }[];
  emptyLabel?: string;
}) {
  const max = Math.max(...items.map((item) => item.count), 1);
  if (!items.length) return <p className="py-6 text-center text-xs text-slate-400">{emptyLabel}</p>;

  return (
    <div className="space-y-3">
      {items.map((item) => (
        <div key={item.key}>
          <div className="flex items-center justify-between gap-3 text-xs">
            <span className="flex min-w-0 items-center gap-2 text-slate-600 dark:text-slate-300">
              {item.color ? <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ backgroundColor: item.color }} /> : null}
              <span className="truncate font-medium">{item.label}</span>
            </span>
            <span className="flex shrink-0 items-center gap-2">
              {item.hint ? <span className="text-[10.5px] text-slate-400">{item.hint}</span> : null}
              <span className="font-semibold text-slate-800 dark:text-slate-100">{item.count}</span>
            </span>
          </div>
          <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-slate-100 dark:bg-white/[0.06]">
            <div
              className="h-full rounded-full transition-all duration-500"
              style={{ width: `${Math.max(3, (item.count / max) * 100)}%`, backgroundColor: item.color ?? '#6366f1' }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}
