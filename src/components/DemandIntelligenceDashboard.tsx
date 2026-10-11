import React, { useMemo, useState } from 'react';
import { Activity, BarChart3, CalendarRange, Flame, Lightbulb, TrendingUp } from 'lucide-react';
import { BookingRecord, EquipmentCategory, ResourceUnit } from '../types/scheduling';
import {
  applyDemandFilters,
  buildForecastSeries,
  buildHeatmap,
  buildRecommendations,
  buildingDemand,
  dateRangeFromPreset,
  rankCategories,
  rankUnits,
  supplyDemand,
} from '../utils/forecasting';

interface DemandIntelligenceDashboardProps {
  resources: ResourceUnit[];
  bookings: BookingRecord[];
  waitlistPressure: Record<string, number>;
}

const CATEGORIES: Array<EquipmentCategory | 'all'> = ['all', 'DSLR Camera', 'GPU Cluster', 'VR Headset', 'Microscope', '3D Printer', 'Projector', 'Lab Kit', 'Testing Device'];
const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export const DemandIntelligenceDashboard: React.FC<DemandIntelligenceDashboardProps> = ({ resources, bookings, waitlistPressure }) => {
  const [rangeDays, setRangeDays] = useState(30);
  const [building, setBuilding] = useState('all');
  const [category, setCategory] = useState<EquipmentCategory | 'all'>('all');
  const [horizon, setHorizon] = useState(14);

  const buildings = useMemo(() => Array.from(new Map(resources.map((resource) => [resource.buildingId, resource.buildingName])).entries()), [resources]);
  const dateRange = useMemo(() => dateRangeFromPreset(rangeDays), [rangeDays]);
  const filteredBookings = useMemo(() => applyDemandFilters(bookings, { dateRange, building, category }), [bookings, building, category, dateRange]);
  const filteredResources = useMemo(
    () =>
      resources.filter((resource) => {
        if (building !== 'all' && resource.buildingId !== building) return false;
        if (category !== 'all' && resource.category !== category) return false;
        return true;
      }),
    [building, category, resources],
  );
  const forecast = useMemo(() => buildForecastSeries(filteredBookings, horizon), [filteredBookings, horizon]);
  const categoryRanks = useMemo(() => rankCategories(filteredBookings, filteredResources), [filteredBookings, filteredResources]);
  const unitRanks = useMemo(() => rankUnits(filteredBookings, filteredResources), [filteredBookings, filteredResources]);
  const heatmap = useMemo(() => buildHeatmap(filteredBookings), [filteredBookings]);
  const demandByBuilding = useMemo(() => buildingDemand(filteredBookings), [filteredBookings]);
  const supplyPoints = useMemo(() => supplyDemand(filteredBookings, filteredResources, horizon), [filteredBookings, filteredResources, horizon]);
  const recommendations = useMemo(() => buildRecommendations(categoryRanks, unitRanks, heatmap, supplyPoints, waitlistPressure), [categoryRanks, heatmap, supplyPoints, unitRanks, waitlistPressure]);

  const predictedRequests = forecast.slice(-horizon).reduce((sum, point) => sum + point.forecast, 0);
  const utilization = Math.round((filteredBookings.length / Math.max(1, filteredResources.length * Math.ceil(rangeDays / 7) * 5)) * 100);
  const peakCell = [...heatmap].sort((a, b) => b.value - a.value)[0];
  const shortageCount = supplyPoints.filter((point) => point.shortage > 0).length;

  return (
    <section id="demand-intelligence" className="scroll-mt-6 rounded-lg border border-emerald-500/20 bg-slate-950/70 p-4 md:p-5 shadow-glass">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <div className="flex items-center gap-2 text-xs font-mono uppercase tracking-widest text-emerald-300">
            <TrendingUp className="h-4 w-4" />
            Demand Intelligence
          </div>
          <h2 className="mt-2 text-xl font-semibold text-white">Forecasting and allocation signals</h2>
          <div className="mt-1 text-xs text-slate-400">{filteredBookings.length} bookings analyzed · {filteredResources.length} units in scope</div>
        </div>
        <div className="grid gap-2 sm:grid-cols-4">
          <select value={rangeDays} onChange={(event) => setRangeDays(Number(event.target.value))} className="rounded-md border border-slate-800 bg-slate-950 px-3 py-2 text-sm text-slate-300">
            <option value={7}>Last 7 days</option>
            <option value={14}>Last 14 days</option>
            <option value={30}>Last 30 days</option>
          </select>
          <select value={building} onChange={(event) => setBuilding(event.target.value)} className="rounded-md border border-slate-800 bg-slate-950 px-3 py-2 text-sm text-slate-300">
            <option value="all">All buildings</option>
            {buildings.map(([id, label]) => (
              <option key={id} value={id}>
                {label}
              </option>
            ))}
          </select>
          <select value={category} onChange={(event) => setCategory(event.target.value as EquipmentCategory | 'all')} className="rounded-md border border-slate-800 bg-slate-950 px-3 py-2 text-sm text-slate-300">
            {CATEGORIES.map((item) => (
              <option key={item} value={item}>
                {item === 'all' ? 'All categories' : item}
              </option>
            ))}
          </select>
          <select value={horizon} onChange={(event) => setHorizon(Number(event.target.value))} className="rounded-md border border-slate-800 bg-slate-950 px-3 py-2 text-sm text-slate-300">
            <option value={7}>7-day forecast</option>
            <option value={14}>14-day forecast</option>
            <option value={30}>30-day forecast</option>
          </select>
        </div>
      </div>

      <div className="mt-5 grid gap-3 md:grid-cols-4">
        <Metric icon={<CalendarRange className="h-4 w-4" />} label="Predicted requests" value={predictedRequests} />
        <Metric icon={<Activity className="h-4 w-4" />} label="Utilization" value={`${utilization}%`} />
        <Metric icon={<Flame className="h-4 w-4" />} label="Peak period" value={peakCell ? `${DAY_LABELS[peakCell.day]} ${peakCell.hour}:00` : 'No data'} />
        <Metric icon={<BarChart3 className="h-4 w-4" />} label="Shortage risks" value={shortageCount} tone={shortageCount ? 'warning' : 'normal'} />
      </div>

      <div className="mt-5 grid gap-5 xl:grid-cols-[1.35fr_1fr]">
        <Panel title="Historical vs Forecast Demand">
          <ForecastChart data={forecast} />
        </Panel>
        <Panel title="Highest Demand Categories">
          <RankedBars data={categoryRanks.slice(0, 6)} />
        </Panel>
      </div>

      <div className="mt-5 grid gap-5 xl:grid-cols-[1fr_1fr]">
        <Panel title="Ranked Equipment Units">
          <RankedBars data={unitRanks.slice(0, 7)} compact />
        </Panel>
        <Panel title="Day x Hour Utilization Heatmap">
          <Heatmap cells={heatmap} />
        </Panel>
      </div>

      <div className="mt-5 grid gap-5 xl:grid-cols-[1fr_1fr]">
        <Panel title="Demand Across Occupied Buildings">
          <SimpleBars data={demandByBuilding.map((item) => ({ label: item.label, value: item.count }))} />
        </Panel>
        <Panel title="Supply vs Demand">
          <SupplyDemandChart data={supplyPoints} />
        </Panel>
      </div>

      <Panel title="Recommended Actions" className="mt-5">
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {recommendations.map((item) => (
            <div key={`${item.title}-${item.target}`} className={`rounded-lg border p-3 ${item.tone === 'warning' ? 'border-amber-400/30 bg-amber-950/20' : item.tone === 'success' ? 'border-emerald-400/30 bg-emerald-950/20' : 'border-cyan-400/30 bg-cyan-950/20'}`}>
              <div className="flex items-start gap-2">
                <Lightbulb className="mt-0.5 h-4 w-4 shrink-0 text-cyan-300" />
                <div>
                  <h3 className="text-sm font-semibold text-white">{item.title}</h3>
                  <p className="mt-1 text-xs leading-5 text-slate-300">{item.reason}</p>
                  <a href={item.target === 'calendar' ? '#calendar' : '#calendar'} className="mt-2 inline-flex text-xs font-semibold text-cyan-300 hover:text-cyan-200">
                    View related calendar data
                  </a>
                </div>
              </div>
            </div>
          ))}
        </div>
      </Panel>
    </section>
  );
};

const Metric: React.FC<{ icon: React.ReactNode; label: string; value: string | number; tone?: 'normal' | 'warning' }> = ({ icon, label, value, tone = 'normal' }) => (
  <div className={`rounded-lg border p-3 ${tone === 'warning' ? 'border-amber-400/30 bg-amber-950/20' : 'border-slate-800 bg-slate-950'}`}>
    <div className="flex items-center gap-2 text-xs text-slate-500">
      <span className="text-cyan-300">{icon}</span>
      {label}
    </div>
    <div className="mt-2 text-xl font-semibold text-white">{value}</div>
  </div>
);

const Panel: React.FC<{ title: string; children: React.ReactNode; className?: string }> = ({ title, children, className = '' }) => (
  <div className={`rounded-lg border border-slate-800 bg-slate-950 p-4 ${className}`}>
    <h3 className="mb-4 text-sm font-semibold text-white">{title}</h3>
    {children}
  </div>
);

const ForecastChart: React.FC<{ data: ReturnType<typeof buildForecastSeries> }> = ({ data }) => {
  const max = Math.max(1, ...data.map((point) => Math.max(point.historical ?? 0, point.forecast)));
  const width = 760;
  const height = 220;
  const padding = 28;
  const points = data.map((point, index) => {
    const x = padding + (index / Math.max(1, data.length - 1)) * (width - padding * 2);
    const y = height - padding - (point.forecast / max) * (height - padding * 2);
    return `${x},${y}`;
  });

  return (
    <div className="overflow-x-auto">
      <svg viewBox={`0 0 ${width} ${height}`} className="min-w-[680px]">
        <defs>
          <linearGradient id="forecastFill" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="#22d3ee" stopOpacity="0.35" />
            <stop offset="100%" stopColor="#22d3ee" stopOpacity="0" />
          </linearGradient>
        </defs>
        {[0, 0.25, 0.5, 0.75, 1].map((tick) => (
          <line key={tick} x1={padding} x2={width - padding} y1={padding + tick * (height - padding * 2)} y2={padding + tick * (height - padding * 2)} stroke="#1e293b" />
        ))}
        <polyline points={points.join(' ')} fill="none" stroke="#22d3ee" strokeWidth="3" />
        <polygon points={`${padding},${height - padding} ${points.join(' ')} ${width - padding},${height - padding}`} fill="url(#forecastFill)" />
        {data.map((point, index) => {
          const x = padding + (index / Math.max(1, data.length - 1)) * (width - padding * 2);
          const historicalY = point.historical === null ? null : height - padding - (point.historical / max) * (height - padding * 2);
          return historicalY === null ? null : <circle key={point.label} cx={x} cy={historicalY} r="3" fill="#f59e0b" />;
        })}
      </svg>
      <div className="mt-2 flex gap-4 text-xs text-slate-400">
        <span className="inline-flex items-center gap-2"><span className="h-2 w-6 rounded bg-cyan-300" /> Forecast baseline</span>
        <span className="inline-flex items-center gap-2"><span className="h-2 w-2 rounded-full bg-amber-400" /> Historical count</span>
      </div>
    </div>
  );
};

const RankedBars: React.FC<{ data: Array<{ label: string; count: number; utilization: number }>; compact?: boolean }> = ({ data, compact }) => {
  const max = Math.max(1, ...data.map((item) => item.count));
  return (
    <div className="space-y-3">
      {data.map((item) => (
        <div key={item.label}>
          <div className="mb-1 flex justify-between gap-3 text-xs">
            <span className="truncate text-slate-300">{item.label}</span>
            <span className="font-mono text-cyan-300">{item.count}</span>
          </div>
          <div className={`rounded bg-slate-900 ${compact ? 'h-2' : 'h-3'}`}>
            <div className="h-full rounded bg-cyan-400" style={{ width: `${Math.max(3, (item.count / max) * 100)}%` }} />
          </div>
        </div>
      ))}
    </div>
  );
};

const Heatmap: React.FC<{ cells: ReturnType<typeof buildHeatmap> }> = ({ cells }) => {
  const max = Math.max(1, ...cells.map((cell) => cell.value));
  const hours = Array.from(new Set(cells.map((cell) => cell.hour)));
  return (
    <div className="overflow-x-auto">
      <div className="grid min-w-[620px] gap-1" style={{ gridTemplateColumns: `42px repeat(${hours.length}, minmax(30px, 1fr))` }}>
        <div />
        {hours.map((hour) => (
          <div key={hour} className="text-center text-[10px] text-slate-500">{hour}</div>
        ))}
        {DAY_LABELS.map((day, dayIndex) => (
          <React.Fragment key={day}>
            <div className="py-1 text-xs text-slate-500">{day}</div>
            {hours.map((hour) => {
              const value = cells.find((cell) => cell.day === dayIndex && cell.hour === hour)?.value ?? 0;
              const opacity = 0.12 + (value / max) * 0.88;
              return <div key={`${day}-${hour}`} title={`${day} ${hour}:00 · ${value} bookings`} className="h-7 rounded border border-slate-900" style={{ backgroundColor: `rgba(34, 211, 238, ${opacity})` }} />;
            })}
          </React.Fragment>
        ))}
      </div>
    </div>
  );
};

const SimpleBars: React.FC<{ data: Array<{ label: string; value: number }> }> = ({ data }) => {
  const max = Math.max(1, ...data.map((item) => item.value));
  return (
    <div className="space-y-3">
      {data.length === 0 && <div className="text-sm text-slate-500">No demand in the current filter.</div>}
      {data.map((item) => (
        <div key={item.label} className="grid grid-cols-[1fr_3fr_42px] items-center gap-3 text-xs">
          <span className="truncate text-slate-300">{item.label}</span>
          <div className="h-3 rounded bg-slate-900">
            <div className="h-full rounded bg-emerald-400" style={{ width: `${Math.max(3, (item.value / max) * 100)}%` }} />
          </div>
          <span className="font-mono text-emerald-300">{item.value}</span>
        </div>
      ))}
    </div>
  );
};

const SupplyDemandChart: React.FC<{ data: ReturnType<typeof supplyDemand> }> = ({ data }) => (
  <div className="space-y-3">
    {data.map((item) => {
      const max = Math.max(1, item.supply, item.demand);
      return (
        <div key={item.category}>
          <div className="mb-1 flex justify-between text-xs">
            <span className="text-slate-300">{item.category}</span>
            <span className={item.shortage ? 'text-amber-300' : 'text-slate-500'}>{item.shortage ? `${item.shortage} short` : 'covered'}</span>
          </div>
          <div className="grid gap-1">
            <div className="h-2 rounded bg-slate-900"><div className="h-full rounded bg-emerald-400" style={{ width: `${(item.supply / max) * 100}%` }} /></div>
            <div className="h-2 rounded bg-slate-900"><div className="h-full rounded bg-amber-400" style={{ width: `${(item.demand / max) * 100}%` }} /></div>
          </div>
        </div>
      );
    })}
    <div className="flex gap-4 text-xs text-slate-400">
      <span className="inline-flex items-center gap-2"><span className="h-2 w-5 rounded bg-emerald-400" /> Practical supply</span>
      <span className="inline-flex items-center gap-2"><span className="h-2 w-5 rounded bg-amber-400" /> Forecast demand</span>
    </div>
  </div>
);
