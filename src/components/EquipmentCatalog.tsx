import React, { useMemo, useState } from 'react';
import { CalendarPlus, CheckCircle2, Search, SlidersHorizontal, Zap } from 'lucide-react';
import { MOCK_EQUIPMENT } from '../data/mock';
import { ResourceUnit } from '../types/scheduling';
import { useCampusStore } from '../store/campusStore';

interface EquipmentCatalogProps {
  resources: ResourceUnit[];
}

const categories = ['all', 'DSLR Camera', 'GPU Cluster', 'VR Headset', 'Microscope', '3D Printer', 'Projector', 'Lab Kit', 'Testing Device'] as const;
const availability = ['all', 'available', 'booked', 'maintenance'] as const;

export const EquipmentCatalog: React.FC<EquipmentCatalogProps> = ({ resources }) => {
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState<(typeof categories)[number]>('all');
  const [status, setStatus] = useState<(typeof availability)[number]>('all');
  const selectUnit = useCampusStore((state) => state.selectUnit);

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return resources.filter((resource) => {
      const unit = MOCK_EQUIPMENT[resource.id];
      if (category !== 'all' && resource.category !== category) return false;
      if (status !== 'all' && resource.status !== status) return false;
      if (!needle) return true;
      return `${resource.name} ${resource.unitId} ${resource.category} ${resource.buildingName} ${unit?.specs.model ?? ''}`
        .toLowerCase()
        .includes(needle);
    });
  }, [category, query, resources, status]);

  return (
    <section id="equipment" className="section-surface scroll-mt-6 rounded-2xl p-4 md:p-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <div className="section-kicker">Equipment</div>
          <h2 className="section-title mt-2">Equipment Catalogue</h2>
        </div>
        <div className="compact-stat">
          <CheckCircle2 className="h-4 w-4 text-emerald-500" />
          {filtered.length} visible units
        </div>
      </div>

      <div className="mt-5 grid gap-3 lg:grid-cols-[1fr_220px_190px]">
        <label className="control-surface flex items-center gap-2 rounded-xl px-3 py-2">
          <Search className="h-4 w-4 text-cyan-500" />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search equipment, model, building"
            className="w-full bg-transparent text-sm outline-none placeholder:text-[var(--muted)]"
          />
        </label>
        <label className="control-surface flex items-center gap-2 rounded-xl px-3 py-2">
          <SlidersHorizontal className="h-4 w-4 text-cyan-500" />
          <select value={category} onChange={(event) => setCategory(event.target.value as (typeof categories)[number])} className="w-full bg-transparent text-sm outline-none">
            {categories.map((item) => (
              <option key={item} value={item}>
                {item === 'all' ? 'All categories' : item}
              </option>
            ))}
          </select>
        </label>
        <select value={status} onChange={(event) => setStatus(event.target.value as (typeof availability)[number])} className="control-surface rounded-xl px-3 py-2 text-sm outline-none">
          {availability.map((item) => (
            <option key={item} value={item}>
              {item === 'all' ? 'All availability' : item}
            </option>
          ))}
        </select>
      </div>

      <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {filtered.map((resource) => {
          const unit = MOCK_EQUIPMENT[resource.id];
          return (
            <article key={resource.id} className="catalog-card rounded-2xl p-4">
              <div className="flex items-start gap-3">
                <div className="icon-tile h-11 w-11 rounded-xl">
                  {unit && <img src={unit.iconUrl} alt="" className="h-8 w-8 object-contain" />}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-3">
                    <h3 className="truncate text-sm font-semibold text-[var(--text)]">
                      {resource.name} <span className="font-mono text-xs text-cyan-500">{resource.unitId}</span>
                    </h3>
                    <StatusPill status={resource.status} />
                  </div>
                  <p className="mt-1 truncate text-xs text-[var(--muted)]">{resource.category}</p>
                  <p className="mt-1 truncate text-xs text-[var(--muted)]">{resource.buildingName}</p>
                </div>
              </div>
              <p className="mt-3 line-clamp-2 min-h-10 text-xs leading-5 text-[var(--muted)]">{unit?.specs.model ?? 'Campus equipment'}</p>
              <div className="mt-4 flex gap-2">
                <button type="button" onClick={() => selectUnit(resource.id)} className="secondary-button flex-1">
                  View on map
                </button>
                <button type="button" disabled={resource.status !== 'available'} className="primary-button flex-1 disabled:cursor-not-allowed disabled:opacity-50">
                  <CalendarPlus className="h-3.5 w-3.5" />
                  Book
                </button>
              </div>
            </article>
          );
        })}
      </div>

      {filtered.length === 0 && (
        <div className="mt-5 rounded-2xl border border-dashed border-[var(--border)] p-8 text-center text-sm text-[var(--muted)]">
          No equipment matches those filters.
        </div>
      )}
    </section>
  );
};

const StatusPill: React.FC<{ status: ResourceUnit['status'] }> = ({ status }) => (
  <span
    className={`inline-flex items-center gap-1 rounded-full px-2 py-1 text-[11px] font-semibold capitalize ${
      status === 'available'
        ? 'bg-emerald-500/15 text-emerald-500'
        : status === 'maintenance'
        ? 'bg-amber-500/15 text-amber-500'
        : 'bg-rose-500/15 text-rose-500'
    }`}
  >
    <Zap className="h-3 w-3" />
    {status}
  </span>
);
