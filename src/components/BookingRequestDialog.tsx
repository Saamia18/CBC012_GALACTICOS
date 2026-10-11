import React, { useMemo, useState } from 'react';
import { AlertTriangle, CalendarPlus, Clock, X } from 'lucide-react';
import { BookingDraft, BookingRecord, BookingStatus, ResourceUnit } from '../types/scheduling';
import { hasIntervalOverlap } from '../lib/schedulingData';

interface BookingRequestDialogProps {
  resource: ResourceUnit;
  bookings: BookingRecord[];
  onCreateBooking: (draft: BookingDraft) => Promise<void>;
  onClose: () => void;
}

const ACTIVE_STATUSES: BookingStatus[] = ['confirmed', 'pending', 'in-use', 'checked-in', 'maintenance'];

const localDateTimeInput = (date: Date) => {
  const offset = date.getTimezoneOffset();
  return new Date(date.getTime() - offset * 60_000).toISOString().slice(0, 16);
};

const addHours = (date: Date, hours: number) => {
  const next = new Date(date);
  next.setHours(next.getHours() + hours);
  return next;
};

const nextDefaultSlot = () => {
  const start = new Date();
  start.setMinutes(start.getMinutes() < 30 ? 30 : 60, 0, 0);
  return { start, end: addHours(start, 2) };
};

const safeIso = (value: string) => {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '' : date.toISOString();
};

const findAlternatives = (resource: ResourceUnit, bookings: BookingRecord[], requestedStart: string, requestedEnd: string) => {
  const duration = new Date(requestedEnd).getTime() - new Date(requestedStart).getTime();
  const start = new Date(requestedStart);
  const options: string[] = [];

  for (let offset = 1; offset <= 18 && options.length < 3; offset += 1) {
    const candidateStart = addHours(start, offset);
    const candidateEnd = new Date(candidateStart.getTime() + duration);
    const hasConflict = bookings.some(
      (booking) =>
        booking.equipmentId === resource.id &&
        ACTIVE_STATUSES.includes(booking.status) &&
        hasIntervalOverlap(booking.startAt, booking.endAt, candidateStart.toISOString(), candidateEnd.toISOString()),
    );

    if (!hasConflict) {
      options.push(
        `${candidateStart.toLocaleString(undefined, { weekday: 'short', hour: 'numeric', minute: '2-digit' })} - ${candidateEnd.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })}`,
      );
    }
  }

  return options;
};

export const BookingRequestDialog: React.FC<BookingRequestDialogProps> = ({ resource, bookings, onCreateBooking, onClose }) => {
  const defaults = useMemo(() => nextDefaultSlot(), []);
  const [startAt, setStartAt] = useState(localDateTimeInput(defaults.start));
  const [endAt, setEndAt] = useState(localDateTimeInput(defaults.end));
  const [requesterName, setRequesterName] = useState('Campus user');
  const [purpose, setPurpose] = useState('Equipment reservation');
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const alternatives = useMemo(
    () => {
      const startIso = safeIso(startAt);
      const endIso = safeIso(endAt);
      return startIso && endIso ? findAlternatives(resource, bookings, startIso, endIso) : [];
    },
    [bookings, endAt, resource, startAt],
  );

  const submitBooking = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSaving(true);
    setFormError(null);

    try {
      const startIso = safeIso(startAt);
      const endIso = safeIso(endAt);
      if (!startIso || !endIso) throw new Error('Choose a valid start and end time.');
      await onCreateBooking({
        equipmentId: resource.id,
        startAt: startIso,
        endAt: endIso,
        requesterName,
        purpose,
        status: 'confirmed',
      });
      onClose();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Unable to create booking.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[85] flex items-center justify-center bg-black/45 p-4 backdrop-blur-sm"
      onMouseDown={(event) => event.target === event.currentTarget && onClose()}
      role="dialog"
      aria-modal="true"
      aria-label={`Book ${resource.name} ${resource.unitId}`}
    >
      <form onSubmit={submitBooking} className="w-full max-w-lg rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 text-[var(--text)] shadow-glass">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="section-kicker flex items-center gap-2">
              <CalendarPlus className="h-4 w-4" />
              Equipment Booking
            </div>
            <h3 className="mt-1 text-lg font-semibold">
              {resource.name} <span className="font-mono text-cyan-500">{resource.unitId}</span>
            </h3>
            <p className="mt-1 text-xs text-[var(--muted)]">{resource.buildingName}</p>
          </div>
          <button type="button" onClick={onClose} className="rounded-lg p-2 text-[var(--muted)] hover:bg-[var(--surface-muted)] hover:text-[var(--text)]" title="Close">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <label className="text-xs text-[var(--muted)]">
            Start
            <input type="datetime-local" value={startAt} onChange={(event) => setStartAt(event.target.value)} className="control-surface mt-1 w-full rounded-xl px-3 py-2 text-sm outline-none" required />
          </label>
          <label className="text-xs text-[var(--muted)]">
            End
            <input type="datetime-local" value={endAt} onChange={(event) => setEndAt(event.target.value)} className="control-surface mt-1 w-full rounded-xl px-3 py-2 text-sm outline-none" required />
          </label>
          <label className="text-xs text-[var(--muted)]">
            Requester
            <input value={requesterName} onChange={(event) => setRequesterName(event.target.value)} className="control-surface mt-1 w-full rounded-xl px-3 py-2 text-sm outline-none" required />
          </label>
          <label className="text-xs text-[var(--muted)]">
            Required details
            <input value={purpose} onChange={(event) => setPurpose(event.target.value)} className="control-surface mt-1 w-full rounded-xl px-3 py-2 text-sm outline-none" required />
          </label>
        </div>

        {formError && (
          <div className="mt-4 rounded-xl border border-rose-400/30 bg-rose-500/10 p-3 text-xs text-rose-700 dark:text-rose-100">
            <div className="flex items-start gap-2 font-semibold">
              <AlertTriangle className="h-4 w-4 shrink-0" />
              <span>{formError}</span>
            </div>
            <div className="mt-2 opacity-85">
              Suggested alternatives: {alternatives.join(', ') || 'No nearby gap found.'}
            </div>
          </div>
        )}

        <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-xs text-[var(--muted)]">
            <Clock className="h-4 w-4" />
            Overlap and maintenance checks use shared booking state.
          </div>
          <div className="flex gap-2">
            <button type="button" onClick={onClose} className="secondary-button">Cancel</button>
            <button type="submit" disabled={saving} className="primary-button disabled:opacity-60">
              {saving ? 'Checking...' : 'Confirm booking'}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
};
