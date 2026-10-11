import React, { useMemo, useState } from 'react';
import { AlertTriangle, CalendarDays, ChevronLeft, ChevronRight, Clock, Plus, Search, X } from 'lucide-react';
import { BookingDraft, BookingRecord, BookingStatus, CalendarView, EquipmentCategory, ResourceUnit } from '../types/scheduling';
import { hasIntervalOverlap } from '../lib/schedulingData';
import { EquipmentIconTile } from './EquipmentIconTile';

interface GanttBookingCalendarProps {
  resources: ResourceUnit[];
  bookings: BookingRecord[];
  sourceLabel: string;
  loading: boolean;
  error: string | null;
  onCreateBooking: (draft: BookingDraft) => Promise<void>;
  onCancelBooking: (bookingId: string) => Promise<void>;
}

interface SlotDraft {
  resource: ResourceUnit;
  startAt: string;
  endAt: string;
}

const ACTIVE_STATUSES: BookingStatus[] = ['confirmed', 'pending', 'in-use', 'checked-in', 'maintenance'];
const CATEGORIES: Array<EquipmentCategory | 'all'> = ['all', 'DSLR Camera', 'GPU Cluster', 'VR Headset', 'Microscope', '3D Printer', 'Projector', 'Lab Kit', 'Testing Device'];
const AVAILABILITY: Array<ResourceUnit['status'] | 'all'> = ['all', 'available', 'booked', 'maintenance'];

const STATUS_COLORS: Record<BookingStatus, string> = {
  confirmed: 'border-emerald-500/30 bg-emerald-500/16 text-emerald-700 dark:text-emerald-100',
  pending: 'border-amber-500/35 bg-amber-500/16 text-amber-800 dark:text-amber-100',
  'in-use': 'border-cyan-500/35 bg-cyan-500/16 text-cyan-800 dark:text-cyan-100',
  'checked-in': 'border-blue-500/35 bg-blue-500/16 text-blue-800 dark:text-blue-100',
  'checked-out': 'border-slate-500/35 bg-slate-500/14 text-slate-700 dark:text-slate-100',
  cancelled: 'border-slate-400/30 bg-slate-400/12 text-slate-600 dark:text-slate-300',
  maintenance: 'border-rose-500/35 bg-rose-500/16 text-rose-800 dark:text-rose-100',
};

const startOfDay = (date: Date) => {
  const next = new Date(date);
  next.setHours(0, 0, 0, 0);
  return next;
};

const addDays = (date: Date, days: number) => {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
};

const addHours = (date: Date, hours: number) => {
  const next = new Date(date);
  next.setHours(next.getHours() + hours);
  return next;
};

const inputDate = (date: Date) => date.toISOString().slice(0, 10);

const localDateTimeInput = (date: Date) => {
  const offset = date.getTimezoneOffset();
  return new Date(date.getTime() - offset * 60_000).toISOString().slice(0, 16);
};

const visibleRange = (cursor: Date, view: CalendarView) => {
  if (view === 'day') {
    const start = addHours(startOfDay(cursor), 8);
    return { start, end: addHours(start, 12), stepHours: 1, slotWidth: 92 };
  }
  if (view === 'week') {
    const start = startOfDay(addDays(cursor, -cursor.getDay()));
    return { start, end: addDays(start, 7), stepHours: 12, slotWidth: 118 };
  }
  const start = new Date(cursor.getFullYear(), cursor.getMonth(), 1);
  return { start, end: new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1), stepHours: 24, slotWidth: 76 };
};

const rangeLabel = (start: Date, end: Date, view: CalendarView) => {
  if (view === 'day') return start.toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' });
  if (view === 'month') return start.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
  return `${start.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })} - ${addDays(end, -1).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}`;
};

const markerLabel = (date: Date, view: CalendarView) => {
  if (view === 'day') return date.toLocaleTimeString(undefined, { hour: 'numeric' });
  return date.toLocaleDateString(undefined, { weekday: 'short', day: 'numeric' });
};

const bookingTime = (booking: BookingRecord) =>
  `${new Date(booking.startAt).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })} - ${new Date(booking.endAt).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })}`;

const sameDay = (a: Date, b: Date) => a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();

const findAlternatives = (resource: ResourceUnit, bookings: BookingRecord[], requestedStart: string, requestedEnd: string) => {
  const duration = new Date(requestedEnd).getTime() - new Date(requestedStart).getTime();
  const start = new Date(requestedStart);
  const options: string[] = [];
  for (let offset = 1; offset <= 16 && options.length < 3; offset += 1) {
    const candidateStart = addHours(start, offset);
    const candidateEnd = new Date(candidateStart.getTime() + duration);
    const hasConflict = bookings.some(
      (booking) =>
        booking.equipmentId === resource.id &&
        ACTIVE_STATUSES.includes(booking.status) &&
        hasIntervalOverlap(booking.startAt, booking.endAt, candidateStart.toISOString(), candidateEnd.toISOString()),
    );
    if (!hasConflict) {
      options.push(`${candidateStart.toLocaleString(undefined, { weekday: 'short', hour: 'numeric', minute: '2-digit' })} - ${candidateEnd.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })}`);
    }
  }
  return options;
};

export const GanttBookingCalendar: React.FC<GanttBookingCalendarProps> = ({
  resources,
  bookings,
  sourceLabel,
  loading,
  error,
  onCreateBooking,
  onCancelBooking,
}) => {
  const [view, setView] = useState<CalendarView>('week');
  const [cursor, setCursor] = useState(() => new Date());
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState<EquipmentCategory | 'all'>('all');
  const [availability, setAvailability] = useState<ResourceUnit['status'] | 'all'>('all');
  const [slotDraft, setSlotDraft] = useState<SlotDraft | null>(null);
  const [selectedBooking, setSelectedBooking] = useState<BookingRecord | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const range = useMemo(() => visibleRange(cursor, view), [cursor, view]);
  const markers = useMemo(() => {
    const slots: Date[] = [];
    for (let marker = new Date(range.start); marker < range.end; marker = addHours(marker, range.stepHours)) {
      slots.push(new Date(marker));
    }
    return slots;
  }, [range]);

  const filteredResources = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return resources.filter((resource) => {
      if (category !== 'all' && resource.category !== category) return false;
      if (availability !== 'all' && resource.status !== availability) return false;
      if (!needle) return true;
      return `${resource.name} ${resource.unitId} ${resource.category} ${resource.buildingName}`.toLowerCase().includes(needle);
    });
  }, [availability, category, query, resources]);

  const visibleBookings = useMemo(
    () =>
      bookings.filter((booking) => {
        if (!filteredResources.some((resource) => resource.id === booking.equipmentId)) return false;
        return hasIntervalOverlap(booking.startAt, booking.endAt, range.start.toISOString(), range.end.toISOString());
      }),
    [bookings, filteredResources, range.end, range.start],
  );

  const activeBookings = visibleBookings.filter((booking) => ACTIVE_STATUSES.includes(booking.status));
  const conflicts = activeBookings.filter((booking, index) =>
    activeBookings.some((other, otherIndex) => otherIndex > index && other.equipmentId === booking.equipmentId && hasIntervalOverlap(other.startAt, other.endAt, booking.startAt, booking.endAt)),
  );

  const handleShift = (direction: number) => {
    const days = view === 'day' ? 1 : view === 'week' ? 7 : 31;
    setCursor((current) => addDays(current, direction * days));
  };

  const openSlot = (resource: ResourceUnit, startAt: Date) => {
    const endAt = view === 'day' ? addHours(startAt, 1) : addHours(startAt, 4);
    setSlotDraft({ resource, startAt: startAt.toISOString(), endAt: endAt.toISOString() });
    setFormError(null);
  };

  const submitBooking = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!slotDraft) return;
    const form = new FormData(event.currentTarget);
    const draft: BookingDraft = {
      equipmentId: slotDraft.resource.id,
      startAt: new Date(String(form.get('startAt'))).toISOString(),
      endAt: new Date(String(form.get('endAt'))).toISOString(),
      requesterName: String(form.get('requesterName') || 'Campus user'),
      purpose: String(form.get('purpose') || 'Equipment reservation'),
      status: 'confirmed',
    };
    setSaving(true);
    setFormError(null);
    try {
      await onCreateBooking(draft);
      setSlotDraft(null);
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Unable to create booking.');
    } finally {
      setSaving(false);
    }
  };

  const totalWidth = markers.length * range.slotWidth;
  const rangeMs = range.end.getTime() - range.start.getTime();

  return (
    <section id="calendar" className="section-surface scroll-mt-6 rounded-2xl p-4 md:p-5">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <div className="section-kicker flex items-center gap-2">
            <CalendarDays className="h-4 w-4" />
            Booking Calendar
          </div>
          <h2 className="section-title mt-2">{rangeLabel(range.start, range.end, view)}</h2>
          <div className="mt-2 text-xs text-[var(--muted)]">{sourceLabel}{loading ? ' · Updating...' : ''}</div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="control-surface flex rounded-xl p-1">
            {(['day', 'week', 'month'] as CalendarView[]).map((item) => (
              <button key={item} type="button" onClick={() => setView(item)} className={`rounded-lg px-3 py-1.5 text-xs font-semibold capitalize transition ${view === item ? 'bg-cyan-400 text-slate-950' : 'text-[var(--muted)] hover:text-[var(--text)]'}`}>
                {item}
              </button>
            ))}
          </div>
          <button type="button" onClick={() => handleShift(-1)} className="secondary-button px-2" title="Previous range">
            <ChevronLeft className="h-4 w-4" />
          </button>
          <button type="button" onClick={() => setCursor(new Date())} className="secondary-button">
            Today
          </button>
          <button type="button" onClick={() => handleShift(1)} className="secondary-button px-2" title="Next range">
            <ChevronRight className="h-4 w-4" />
          </button>
          <input type="date" value={inputDate(cursor)} onChange={(event) => setCursor(new Date(event.target.value))} className="control-surface rounded-xl px-3 py-2 text-xs outline-none" />
        </div>
      </div>

      <div className="mt-4 grid gap-2 md:grid-cols-[1fr_220px_180px]">
        <label className="control-surface flex items-center gap-2 rounded-xl px-3 py-2">
          <Search className="h-4 w-4 text-cyan-500" />
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search equipment or building" className="w-full bg-transparent text-sm outline-none placeholder:text-[var(--muted)]" />
        </label>
        <select value={category} onChange={(event) => setCategory(event.target.value as EquipmentCategory | 'all')} className="control-surface rounded-xl px-3 py-2 text-sm outline-none">
          {CATEGORIES.map((item) => (
            <option key={item} value={item}>{item === 'all' ? 'All categories' : item}</option>
          ))}
        </select>
        <select value={availability} onChange={(event) => setAvailability(event.target.value as ResourceUnit['status'] | 'all')} className="control-surface rounded-xl px-3 py-2 text-sm outline-none">
          {AVAILABILITY.map((item) => (
            <option key={item} value={item}>{item === 'all' ? 'All availability' : item}</option>
          ))}
        </select>
      </div>

      <div className="mt-4 grid grid-cols-3 gap-2">
        <Metric label="Units" value={filteredResources.length} />
        <Metric label="Bookings" value={activeBookings.length} />
        <Metric label="Conflicts" value={conflicts.length} warning={conflicts.length > 0} />
      </div>

      {error && (
        <div className="mt-4 flex items-start gap-2 rounded-xl border border-amber-400/30 bg-amber-500/10 p-3 text-xs text-amber-700 dark:text-amber-100">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {view === 'month' ? (
        <MonthView
          cursor={cursor}
          bookings={visibleBookings}
          onSelectBooking={setSelectedBooking}
          onShowDay={(date) => {
            setCursor(date);
            setView('day');
          }}
        />
      ) : (
        <div className="mt-4 overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--surface-strong)]">
          <div className="max-h-[520px] overflow-auto">
            <div className="grid min-w-max" style={{ gridTemplateColumns: `220px ${totalWidth}px` }}>
              <div className="sticky left-0 top-0 z-30 border-b border-r border-[var(--border)] bg-[var(--surface-strong)] px-3 py-2 text-[11px] font-semibold uppercase tracking-widest text-[var(--muted)]">Equipment</div>
              <div className="sticky top-0 z-20 grid border-b border-[var(--border)] bg-[var(--surface-strong)]" style={{ gridTemplateColumns: `repeat(${markers.length}, ${range.slotWidth}px)` }}>
                {markers.map((marker) => (
                  <div key={marker.toISOString()} className="border-r border-[var(--border)] px-2 py-2 text-[11px] font-medium text-[var(--muted)]">
                    {markerLabel(marker, view)}
                  </div>
                ))}
              </div>

              {filteredResources.map((resource) => {
                const rowBookings = visibleBookings.filter((booking) => booking.equipmentId === resource.id);
                return (
                  <React.Fragment key={resource.id}>
                    <div className="sticky left-0 z-10 min-h-[58px] border-r border-t border-[var(--border)] bg-[var(--surface-strong)] p-2.5">
                      <div className="flex items-center gap-2">
                        <EquipmentIconTile equipmentId={resource.id} category={resource.category} name={`${resource.name} ${resource.unitId}`} status={resource.status} size="sm" />
                        <div className="min-w-0">
                          <div className="truncate text-xs font-semibold text-[var(--text)]">{resource.name} <span className="font-mono text-cyan-500">{resource.unitId}</span></div>
                          <div className="truncate text-[11px] text-[var(--muted)]">{resource.buildingName}</div>
                        </div>
                      </div>
                    </div>
                    <div className="relative grid min-h-[58px] border-t border-[var(--border)]" style={{ gridTemplateColumns: `repeat(${markers.length}, ${range.slotWidth}px)` }}>
                      {markers.map((marker) => (
                        <button key={marker.toISOString()} type="button" onClick={() => openSlot(resource, marker)} className="group border-r border-[var(--border)] text-left transition hover:bg-cyan-400/8" title={`Create booking for ${resource.name}`}>
                          <Plus className="mx-auto mt-5 h-3.5 w-3.5 text-transparent transition group-hover:text-cyan-500" />
                        </button>
                      ))}
                      {rowBookings.map((booking) => {
                        const start = Math.max(new Date(booking.startAt).getTime(), range.start.getTime());
                        const end = Math.min(new Date(booking.endAt).getTime(), range.end.getTime());
                        const left = ((start - range.start.getTime()) / rangeMs) * totalWidth;
                        const width = Math.max(24, ((end - start) / rangeMs) * totalWidth);
                        const canShowText = width >= 92;
                        const canShowTime = width >= 132;
                        return (
                          <button
                            key={booking.id}
                            type="button"
                            onClick={() => setSelectedBooking(booking)}
                            title={`${booking.equipmentName} ${booking.unitId} · ${bookingTime(booking)} · ${booking.status}`}
                            className={`absolute top-2 h-10 rounded-xl border px-2 text-left text-xs shadow-sm transition hover:z-30 hover:-translate-y-0.5 focus:z-30 focus:outline-none focus:ring-2 focus:ring-cyan-400/60 ${STATUS_COLORS[booking.status]}`}
                            style={{ left, width }}
                          >
                            {canShowText ? (
                              <span className="flex h-full items-center gap-1.5">
                                <EquipmentIconTile equipmentId={booking.equipmentId} category={booking.category} name={booking.equipmentName} status={booking.status} size="xs" />
                                <span className="min-w-0">
                                  <span className="block truncate font-semibold">{booking.equipmentName}</span>
                                  {canShowTime && <span className="block truncate text-[10px] opacity-75">{bookingTime(booking)}</span>}
                                </span>
                              </span>
                            ) : (
                              <span className="flex h-full items-center justify-center">
                                <EquipmentIconTile equipmentId={booking.equipmentId} category={booking.category} name={booking.equipmentName} status={booking.status} size="xs" />
                              </span>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  </React.Fragment>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {!loading && filteredResources.length === 0 && <div className="mt-4 rounded-2xl border border-dashed border-[var(--border)] p-8 text-center text-sm text-[var(--muted)]">No resources match the active filters.</div>}

      {slotDraft && (
        <Dialog onClose={() => setSlotDraft(null)}>
          <form onSubmit={submitBooking} className="w-full max-w-lg rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 shadow-glass">
            <DialogHeader title="New booking" subtitle={`${slotDraft.resource.name} ${slotDraft.resource.unitId} · ${slotDraft.resource.buildingName}`} onClose={() => setSlotDraft(null)} />
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <Field label="Start"><input name="startAt" type="datetime-local" defaultValue={localDateTimeInput(new Date(slotDraft.startAt))} className="control-surface mt-1 w-full rounded-xl px-3 py-2 text-sm outline-none" /></Field>
              <Field label="End"><input name="endAt" type="datetime-local" defaultValue={localDateTimeInput(new Date(slotDraft.endAt))} className="control-surface mt-1 w-full rounded-xl px-3 py-2 text-sm outline-none" /></Field>
              <Field label="Requester"><input name="requesterName" defaultValue="Campus user" className="control-surface mt-1 w-full rounded-xl px-3 py-2 text-sm outline-none" /></Field>
              <Field label="Purpose"><input name="purpose" defaultValue="Equipment reservation" className="control-surface mt-1 w-full rounded-xl px-3 py-2 text-sm outline-none" /></Field>
            </div>
            {formError && (
              <div className="mt-4 rounded-xl border border-rose-400/30 bg-rose-500/10 p-3 text-xs text-rose-700 dark:text-rose-100">
                <div className="font-semibold">{formError}</div>
                <div className="mt-2 opacity-85">Suggested alternatives: {findAlternatives(slotDraft.resource, bookings, slotDraft.startAt, slotDraft.endAt).join(', ') || 'No nearby gap found.'}</div>
              </div>
            )}
            <div className="mt-5 flex justify-end gap-2">
              <button type="button" onClick={() => setSlotDraft(null)} className="secondary-button">Cancel</button>
              <button type="submit" disabled={saving} className="primary-button disabled:opacity-60">{saving ? 'Saving...' : 'Create booking'}</button>
            </div>
          </form>
        </Dialog>
      )}

      {selectedBooking && (
        <Dialog onClose={() => setSelectedBooking(null)}>
          <div className="w-full max-w-md rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 shadow-glass">
            <DialogHeader title={`${selectedBooking.equipmentName} ${selectedBooking.unitId}`} subtitle="Booking details" onClose={() => setSelectedBooking(null)} />
            <div className="mt-4 space-y-2 text-sm text-[var(--muted)]">
              <p><span className="text-[var(--text)]">Status:</span> <span className="capitalize">{selectedBooking.status}</span></p>
              <p><span className="text-[var(--text)]">When:</span> {new Date(selectedBooking.startAt).toLocaleString()} - {new Date(selectedBooking.endAt).toLocaleString()}</p>
              <p><span className="text-[var(--text)]">Borrower:</span> {selectedBooking.requesterName} ({selectedBooking.requesterRole})</p>
              <p><span className="text-[var(--text)]">Purpose:</span> {selectedBooking.purpose}</p>
              <p><span className="text-[var(--text)]">Building:</span> {selectedBooking.buildingName}</p>
            </div>
            <div className="mt-5 flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 text-xs text-[var(--muted)]"><Clock className="h-4 w-4" /> Conflict-safe intervals</div>
              {selectedBooking.status !== 'cancelled' && (
                <button type="button" onClick={() => void onCancelBooking(selectedBooking.id).then(() => setSelectedBooking(null))} className="rounded-xl bg-rose-500 px-4 py-2 text-sm font-semibold text-white hover:bg-rose-400">
                  Cancel booking
                </button>
              )}
            </div>
          </div>
        </Dialog>
      )}
    </section>
  );
};

const MonthView: React.FC<{
  cursor: Date;
  bookings: BookingRecord[];
  onSelectBooking: (booking: BookingRecord) => void;
  onShowDay: (date: Date) => void;
}> = ({ cursor, bookings, onSelectBooking, onShowDay }) => {
  const monthStart = new Date(cursor.getFullYear(), cursor.getMonth(), 1);
  const gridStart = startOfDay(addDays(monthStart, -monthStart.getDay()));
  const days = Array.from({ length: 42 }, (_, index) => addDays(gridStart, index));

  return (
    <div className="mt-4 overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--surface-strong)]">
      <div className="grid grid-cols-7 border-b border-[var(--border)]">
        {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => (
          <div key={day} className="px-3 py-2 text-xs font-semibold text-[var(--muted)]">{day}</div>
        ))}
      </div>
      <div className="grid grid-cols-7">
        {days.map((day) => {
          const dayBookings = bookings.filter((booking) => sameDay(new Date(booking.startAt), day));
          const inMonth = day.getMonth() === cursor.getMonth();
          return (
            <div key={day.toISOString()} className={`min-h-28 border-b border-r border-[var(--border)] p-2 ${inMonth ? '' : 'opacity-45'}`}>
              <button type="button" onClick={() => onShowDay(day)} className="mb-1 rounded-full px-2 py-0.5 text-xs font-semibold text-[var(--muted)] hover:bg-[var(--surface-muted)]">
                {day.getDate()}
              </button>
              <div className="space-y-1">
                {dayBookings.slice(0, 3).map((booking) => (
                  <button
                    key={booking.id}
                    type="button"
                    onClick={() => onSelectBooking(booking)}
                    className={`flex w-full items-center gap-1.5 rounded-lg border px-1.5 py-1 text-left text-[11px] ${STATUS_COLORS[booking.status]}`}
                    title={`${booking.equipmentName} · ${bookingTime(booking)} · ${booking.status}`}
                    aria-label={`${booking.equipmentName}, ${bookingTime(booking)}, ${booking.status}`}
                  >
                    <EquipmentIconTile equipmentId={booking.equipmentId} category={booking.category} name={booking.equipmentName} status={booking.status} size="xs" />
                    <span className="truncate text-[10px]">{new Date(booking.startAt).toLocaleTimeString(undefined, { hour: 'numeric' })}</span>
                  </button>
                ))}
                {dayBookings.length > 3 && (
                  <button type="button" onClick={() => onShowDay(day)} className="rounded-lg px-2 py-1 text-[11px] font-semibold text-cyan-500 hover:bg-cyan-400/10">
                    +{dayBookings.length - 3} more
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

const Metric: React.FC<{ label: string; value: string | number; warning?: boolean }> = ({ label, value, warning = false }) => (
  <div className={`rounded-xl border px-3 py-2 ${warning ? 'border-amber-400/30 bg-amber-500/10' : 'border-[var(--border)] bg-[var(--surface-strong)]'}`}>
    <div className="text-[11px] text-[var(--muted)]">{label}</div>
    <div className="mt-0.5 text-base font-semibold text-[var(--text)]">{value}</div>
  </div>
);

const Dialog: React.FC<{ children: React.ReactNode; onClose: () => void }> = ({ children, onClose }) => (
  <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/45 p-4 backdrop-blur-sm" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
    {children}
  </div>
);

const DialogHeader: React.FC<{ title: string; subtitle: string; onClose: () => void }> = ({ title, subtitle, onClose }) => (
  <div className="flex items-start justify-between gap-4">
    <div>
      <div className="section-kicker">{subtitle}</div>
      <h3 className="mt-1 text-lg font-semibold text-[var(--text)]">{title}</h3>
    </div>
    <button type="button" onClick={onClose} className="rounded-lg p-2 text-[var(--muted)] hover:bg-[var(--surface-muted)] hover:text-[var(--text)]" title="Close">
      <X className="h-4 w-4" />
    </button>
  </div>
);

const Field: React.FC<{ label: string; children: React.ReactNode }> = ({ label, children }) => (
  <label className="text-xs text-[var(--muted)]">
    {label}
    {children}
  </label>
);
