import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { useTheme } from '@/contexts/ThemeContext';

interface TrendPoint {
  label: string;
  submitted: number;
  resolved: number;
}

interface TrendTooltipProps {
  active?: boolean;
  payload?: { name?: string; value?: number; color?: string; dataKey?: string }[];
  label?: string;
}

function TrendTooltip({ active, payload, label }: TrendTooltipProps) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs shadow-pop dark:border-white/10 dark:bg-slate-900">
      <p className="mb-1.5 font-semibold text-slate-700 dark:text-slate-200">{label}</p>
      {payload.map((entry) => (
        <div key={entry.dataKey} className="flex items-center gap-2 py-0.5">
          <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: entry.color }} />
          <span className="text-slate-500 dark:text-slate-400">{entry.dataKey === 'submitted' ? 'Submitted' : 'Resolved'}</span>
          <span className="ml-auto font-semibold text-slate-800 dark:text-slate-100">{entry.value}</span>
        </div>
      ))}
    </div>
  );
}

export function TrendChart({ data, height = 260 }: { data: TrendPoint[]; height?: number }) {
  const { theme } = useTheme();
  const grid = theme === 'dark' ? 'rgba(148,163,184,0.14)' : 'rgba(148,163,184,0.22)';

  return (
    <div style={{ height }} className="w-full">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
          <defs>
            <linearGradient id="submittedFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#6366f1" stopOpacity={0.32} />
              <stop offset="100%" stopColor="#6366f1" stopOpacity={0.02} />
            </linearGradient>
            <linearGradient id="resolvedFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#10b981" stopOpacity={0.28} />
              <stop offset="100%" stopColor="#10b981" stopOpacity={0.02} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="4 4" stroke={grid} vertical={false} />
          <XAxis dataKey="label" axisLine={false} tickLine={false} dy={8} />
          <YAxis axisLine={false} tickLine={false} allowDecimals={false} width={44} />
          <Tooltip content={<TrendTooltip />} cursor={{ stroke: grid, strokeWidth: 1 }} />
          <Area
            type="monotone"
            dataKey="submitted"
            stroke="#6366f1"
            strokeWidth={2.4}
            fill="url(#submittedFill)"
            dot={false}
            activeDot={{ r: 4, strokeWidth: 2, stroke: theme === 'dark' ? '#0f172a' : '#fff' }}
          />
          <Area
            type="monotone"
            dataKey="resolved"
            stroke="#10b981"
            strokeWidth={2.4}
            fill="url(#resolvedFill)"
            dot={false}
            activeDot={{ r: 4, strokeWidth: 2, stroke: theme === 'dark' ? '#0f172a' : '#fff' }}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

export function ChartLegend({ items }: { items: { label: string; color: string }[] }) {
  return (
    <div className="flex flex-wrap items-center gap-4">
      {items.map((item) => (
        <span key={item.label} className="inline-flex items-center gap-1.5 text-[11.5px] font-medium text-slate-500 dark:text-slate-400">
          <span className="h-2 w-2 rounded-full" style={{ backgroundColor: item.color }} />
          {item.label}
        </span>
      ))}
    </div>
  );
}
