import React, { useEffect } from 'react';
import { MapPin, X } from 'lucide-react';
import { MOCK_BUILDINGS, MOCK_EQUIPMENT } from '../data/mock';
import { useCampusStore } from '../store/campusStore';

export const BuildingContextCard: React.FC = () => {
  const selectedBuildingId = useCampusStore((state) => state.selectedBuildingId);
  const selectedUnitId = useCampusStore((state) => state.selectedUnitId);
  const selectUnit = useCampusStore((state) => state.selectUnit);
  const clearMapSelection = useCampusStore((state) => state.clearMapSelection);

  const building = MOCK_BUILDINGS.find((item) => item.id === selectedBuildingId);

  useEffect(() => {
    if (!selectedBuildingId) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') clearMapSelection();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [clearMapSelection, selectedBuildingId]);

  if (!building) return null;

  const units = building.equipmentIds.map((id) => MOCK_EQUIPMENT[id]).filter(Boolean);

  return (
    <aside className="map-context-card pointer-events-auto absolute bottom-24 left-4 z-30 w-[min(340px,calc(100vw-32px))] rounded-2xl p-4 md:left-6" onPointerDown={(event) => event.stopPropagation()}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 text-[11px] font-mono uppercase tracking-widest text-cyan-400">
            <MapPin className="h-3.5 w-3.5" />
            Selected building
          </div>
          <h2 className="mt-1 text-sm font-semibold text-[var(--text)]">{building.name}</h2>
          <p className="mt-1 text-xs text-[var(--muted)]">{building.code}</p>
        </div>
        <button type="button" onClick={clearMapSelection} className="rounded-lg p-1.5 text-[var(--muted)] transition hover:bg-[var(--surface-muted)] hover:text-[var(--text)]" title="Close details" aria-label="Close building details">
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="mt-3 space-y-2">
        {units.length > 0 ? (
          units.map((unit) => (
            <button
              key={unit.id}
              type="button"
              onClick={() => selectUnit(unit.id)}
              className={`flex w-full items-center gap-3 rounded-xl border px-3 py-2 text-left transition ${
                selectedUnitId === unit.id
                  ? 'border-cyan-400/50 bg-cyan-400/10'
                  : 'border-[var(--border)] bg-[var(--surface-muted)] hover:border-cyan-400/40'
              }`}
            >
              <img src={unit.iconUrl} alt="" className="h-7 w-7 rounded-lg object-contain" />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-xs font-semibold text-[var(--text)]">
                  {unit.name} <span className="font-mono text-cyan-500">{unit.unitNumber}</span>
                </span>
                <span className="block truncate text-[11px] text-[var(--muted)]">{unit.statusText}</span>
              </span>
              <span
                className={`h-2.5 w-2.5 rounded-full ${
                  unit.status === 'available' ? 'bg-emerald-400' : unit.status === 'maintenance' ? 'bg-amber-400' : 'bg-rose-400'
                }`}
              />
            </button>
          ))
        ) : (
          <div className="rounded-xl border border-dashed border-[var(--border)] p-3 text-xs text-[var(--muted)]">
            No equipment assigned to this building.
          </div>
        )}
      </div>
    </aside>
  );
};
