import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts';
import { tone } from '@/lib/constants';
import type { Status } from '@/lib/types';

interface Slice {
  value: Status;
  label: string;
  tone: string;
  count: number;
}

export function StatusDonut({ data, total, height = 210 }: { data: Slice[]; total: number; height?: number }) {
  const slices = data.filter((item) => item.count > 0);

  return (
    <div className="flex flex-col items-center gap-4 sm:flex-row sm:items-center">
      <div className="relative shrink-0" style={{ width: height, height }}>
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={slices.length ? slices : [{ value: 'submitted' as Status, label: 'No data', tone: 'slate', count: 1 }]}
              dataKey="count"
              nameKey="label"
              innerRadius="66%"
              outerRadius="94%"
              paddingAngle={slices.length > 1 ? 2.5 : 0}
              stroke="none"
              startAngle={90}
              endAngle={-270}
            >
              {(slices.length ? slices : [{ tone: 'slate', label: 'No data', value: 'submitted' as Status, count: 1 }]).map((slice) => (
                <Cell key={slice.value} fill={tone(slice.tone).hex} opacity={slices.length ? 1 : 0.25} />
              ))}
            </Pie>
            {slices.length ? (
              <Tooltip
                formatter={(value: number, _name, entry) => [`${value}`, (entry?.payload as Slice)?.label ?? '']}
                contentStyle={{ borderRadius: 12, border: '1px solid rgba(148,163,184,.3)', fontSize: 12 }}
              />
            ) : null}
          </PieChart>
        </ResponsiveContainer>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-[24px] font-bold leading-none text-slate-900 dark:text-white">{total}</span>
          <span className="mt-1 text-[10.5px] font-semibold uppercase tracking-wide text-slate-400">Reports</span>
        </div>
      </div>

      <div className="grid w-full grid-cols-2 gap-x-4 gap-y-2 sm:grid-cols-1">
        {data
          .filter((item) => item.count > 0)
          .sort((a, b) => b.count - a.count)
          .map((item) => (
            <div key={item.value} className="flex items-center justify-between gap-2 text-xs">
              <span className="flex min-w-0 items-center gap-1.5 text-slate-600 dark:text-slate-300">
                <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ backgroundColor: tone(item.tone).hex }} />
                <span className="truncate">{item.label}</span>
              </span>
              <span className="font-semibold text-slate-800 dark:text-slate-100">{item.count}</span>
            </div>
          ))}
      </div>
    </div>
  );
}
