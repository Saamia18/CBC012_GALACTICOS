import React, { useEffect, useMemo, useState } from 'react';
import { AlertOctagon, Check, ClipboardList, Hammer, ShieldCheck, Wrench, X } from 'lucide-react';
import { AdminActionType, AdminAuditEntry, AdminOverrideDraft, BookingRecord, BookingStatus, ResourceUnit } from '../types/scheduling';
import { hasIntervalOverlap } from '../lib/schedulingData';

interface AdminOverrideDashboardProps {
  resources: ResourceUnit[];
  bookings: BookingRecord[];
  auditLog: AdminAuditEntry[];
  onApplyOverride: (draft: AdminOverrideDraft) => Promise<void>;
}

const localDateTimeInput = (date: Date) => {
  const offset = date.getTimezoneOffset();
  return new Date(date.getTime() - offset * 60_000).toISOString().slice(0, 16);
};

const formatDateTime = (iso: string) =>
  new Date(iso).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });

const toIsoDateTime = (value: string) => {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
};

const ACTION_LABEL: Record<AdminActionType, string> = {
  'group-target': 'Group target',
  'approve-request': 'Approve request',
  'reject-request': 'Reject request',
  'resolve-conflict': 'Resolve conflict',
  'maintenance-block': 'Block maintenance',
  'maintenance-clear': 'Clear maintenance',
  'override-decision': 'Override cascade',
  'booking-cancelled': 'Booking cancelled',
  'waitlist-offer': 'Waitlist offer',
  'waitlist-accepted': 'Waitlist accepted',
  'waitlist-declined': 'Waitlist declined',
  'waitlist-expired': 'Waitlist expired',
};

export const AdminOverrideDashboard: React.FC<AdminOverrideDashboardProps> = ({ resources, bookings, auditLog, onApplyOverride }) => {
  const pendingBookings = useMemo(() => bookings.filter((booking) => booking.status === 'pending'), [bookings]);
  const activeBookings = useMemo(() => bookings.filter((booking) => ['confirmed', 'pending', 'in-use', 'checked-in', 'maintenance'].includes(booking.status)), [bookings]);
  const conflicts = useMemo(
    () =>
      activeBookings.filter((booking, index) =>
        activeBookings.some(
          (other, otherIndex) =>
            otherIndex > index &&
            other.equipmentId === booking.equipmentId &&
            hasIntervalOverlap(other.startAt, other.endAt, booking.startAt, booking.endAt),
        ),
      ),
    [activeBookings],
  );
  const urgentRequests = useMemo(
    () =>
      bookings
        .filter((booking) => booking.status === 'pending' || (booking.status === 'confirmed' && new Date(booking.startAt).getTime() - Date.now() < 12 * 60 * 60_000))
        .slice(0, 8),
    [bookings],
  );

  const [reason, setReason] = useState('');
  const [actor, setActor] = useState('Demo Admin');
  const [equipmentId, setEquipmentId] = useState(resources[0]?.id ?? '');
  const [startAt, setStartAt] = useState(() => localDateTimeInput(new Date(Date.now() + 2 * 60 * 60_000)));
  const [endAt, setEndAt] = useState(() => localDateTimeInput(new Date(Date.now() + 4 * 60 * 60_000)));
  const [selectedBookingId, setSelectedBookingId] = useState(pendingBookings[0]?.id ?? bookings[0]?.id ?? '');
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    if (bookings.length === 0) {
      setSelectedBookingId('');
      return;
    }
    if (!bookings.some((booking) => booking.id === selectedBookingId)) {
      setSelectedBookingId(pendingBookings[0]?.id ?? bookings[0].id);
    }
  }, [bookings, pendingBookings, selectedBookingId]);

  useEffect(() => {
    if (resources.length > 0 && !resources.some((resource) => resource.id === equipmentId)) {
      setEquipmentId(resources[0].id);
    }
  }, [equipmentId, resources]);

  const requireReason = async (draft: Omit<AdminOverrideDraft, 'reason' | 'actor'>, label: string) => {
    setFormError(null);
    if (!reason.trim()) {
      setFormError('A reason is required for every admin override.');
      return;
    }
    if (!draft.targetId) {
      setFormError('Choose a booking or equipment target before applying an override.');
      return;
    }
    if ((draft.action === 'maintenance-block' || draft.action === 'override-decision') && (!draft.startAt || !draft.endAt || new Date(draft.endAt) <= new Date(draft.startAt))) {
      setFormError('Choose a valid start and end time before applying this action.');
      return;
    }
    const confirmed = window.confirm(`${label}\n\nReason: ${reason}\n\nThis is a frontend demo action. Continue?`);
    if (!confirmed) return;
    try {
      await onApplyOverride({ ...draft, reason, actor });
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Unable to apply admin action.');
    }
  };

  const statusTone = (status: BookingStatus) =>
    status === 'confirmed' || status === 'in-use'
      ? 'text-emerald-300'
      : status === 'checked-in'
      ? 'text-cyan-300'
      : status === 'checked-out'
      ? 'text-slate-400'
      : status === 'pending'
      ? 'text-amber-300'
      : status === 'maintenance'
      ? 'text-rose-300'
      : 'text-slate-500';

  const applyTimedAction = (action: 'maintenance-block' | 'override-decision', label: string) => {
    const startIso = toIsoDateTime(startAt);
    const endIso = toIsoDateTime(endAt);
    void requireReason({ action, targetId: equipmentId, equipmentId, startAt: startIso ?? undefined, endAt: endIso ?? undefined }, label);
  };

  return (
    <section id="admin-override" className="scroll-mt-6 rounded-lg border border-rose-500/20 bg-slate-950/70 p-4 md:p-5 shadow-glass">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <div className="flex items-center gap-2 text-xs font-mono uppercase tracking-widest text-rose-300">
            <ShieldCheck className="h-4 w-4" />
            Admin Override
          </div>
          <h2 className="mt-2 text-xl font-semibold text-white">Exceptional controls and audit trail</h2>
        </div>
        <div className="grid grid-cols-3 gap-3 text-center">
          <Metric label="Pending" value={pendingBookings.length} />
          <Metric label="Conflicts" value={conflicts.length} tone={conflicts.length ? 'warning' : 'normal'} />
          <Metric label="Audit Items" value={auditLog.length} />
        </div>
      </div>

      <div className="mt-5 grid gap-5 xl:grid-cols-[380px_1fr]">
        <div className="rounded-lg border border-slate-800 bg-slate-950 p-4">
          <div className="mb-4 flex items-center gap-2 text-sm font-semibold text-white">
            <Hammer className="h-4 w-4 text-rose-300" />
            Override Console
          </div>
          <div className="space-y-3">
            <label className="block text-xs text-slate-400">
              Actor
              <input value={actor} onChange={(event) => setActor(event.target.value)} className="mt-1 w-full rounded-md border border-slate-800 bg-slate-900 px-3 py-2 text-sm text-slate-200" />
            </label>
            <label className="block text-xs text-slate-400">
              Required reason
              <textarea value={reason} onChange={(event) => setReason(event.target.value)} rows={3} className="mt-1 w-full rounded-md border border-slate-800 bg-slate-900 px-3 py-2 text-sm text-slate-200" placeholder="Example: Emergency calibration after lens fault report" />
            </label>
            <label className="block text-xs text-slate-400">
              Booking target
              <select value={selectedBookingId} onChange={(event) => setSelectedBookingId(event.target.value)} className="mt-1 w-full rounded-md border border-slate-800 bg-slate-900 px-3 py-2 text-sm text-slate-200">
                {bookings.slice(0, 80).map((booking) => (
                  <option key={booking.id} value={booking.id}>
                    {booking.equipmentName} {booking.unitId} · {booking.status}
                  </option>
                ))}
              </select>
            </label>
            <div className="grid grid-cols-2 gap-2">
              <button type="button" onClick={() => void requireReason({ action: 'group-target', targetId: selectedBookingId }, 'Group related booking targets for review?')} className="rounded-md bg-cyan-400 px-3 py-2 text-xs font-semibold text-slate-950 hover:bg-cyan-300">
                Group
              </button>
              <button type="button" onClick={() => void requireReason({ action: 'approve-request', targetId: selectedBookingId }, 'Approve this booking request?')} className="rounded-md bg-emerald-400 px-3 py-2 text-xs font-semibold text-slate-950 hover:bg-emerald-300">
                <Check className="inline h-3.5 w-3.5" /> Approve
              </button>
              <button type="button" onClick={() => void requireReason({ action: 'reject-request', targetId: selectedBookingId }, 'Reject this booking request?')} className="rounded-md bg-slate-800 px-3 py-2 text-xs font-semibold text-slate-200 hover:bg-slate-700">
                <X className="inline h-3.5 w-3.5" /> Reject
              </button>
              <button type="button" onClick={() => void requireReason({ action: 'resolve-conflict', targetId: selectedBookingId }, 'Cancel this booking to resolve an exception?')} className="rounded-md bg-amber-300 px-3 py-2 text-xs font-semibold text-slate-950 hover:bg-amber-200">
                Resolve
              </button>
              <button type="button" onClick={() => applyTimedAction('override-decision', 'Force a cascade review for this slot?')} className="rounded-md bg-cyan-400 px-3 py-2 text-xs font-semibold text-slate-950 hover:bg-cyan-300">
                Cascade
              </button>
            </div>

            <div className="rounded-md border border-slate-800 bg-slate-900/60 p-3">
              <div className="mb-3 flex items-center gap-2 text-xs font-semibold text-slate-200">
                <Wrench className="h-4 w-4 text-rose-300" />
                Maintenance Safety
              </div>
              <label className="block text-xs text-slate-400">
                Equipment
                <select value={equipmentId} onChange={(event) => setEquipmentId(event.target.value)} className="mt-1 w-full rounded-md border border-slate-800 bg-slate-950 px-3 py-2 text-sm text-slate-200">
                  {resources.map((resource) => (
                    <option key={resource.id} value={resource.id}>
                      {resource.name} {resource.unitId}
                    </option>
                  ))}
                </select>
              </label>
              <div className="mt-3 grid gap-2 sm:grid-cols-2">
                <label className="text-xs text-slate-400">
                  Start
                  <input type="datetime-local" value={startAt} onChange={(event) => setStartAt(event.target.value)} className="mt-1 w-full rounded-md border border-slate-800 bg-slate-950 px-3 py-2 text-sm text-slate-200" />
                </label>
                <label className="text-xs text-slate-400">
                  End
                  <input type="datetime-local" value={endAt} onChange={(event) => setEndAt(event.target.value)} className="mt-1 w-full rounded-md border border-slate-800 bg-slate-950 px-3 py-2 text-sm text-slate-200" />
                </label>
              </div>
              <div className="mt-3 grid grid-cols-2 gap-2">
                <button type="button" onClick={() => applyTimedAction('maintenance-block', 'Block this equipment for maintenance?')} className="rounded-md bg-rose-500 px-3 py-2 text-xs font-semibold text-white hover:bg-rose-400">
                  Block
                </button>
                <button type="button" onClick={() => void requireReason({ action: 'maintenance-clear', targetId: equipmentId, equipmentId }, 'Clear maintenance blocks for this equipment?')} className="rounded-md border border-slate-700 px-3 py-2 text-xs font-semibold text-slate-300 hover:bg-slate-900">
                  Clear
                </button>
              </div>
            </div>
            {formError && <div className="rounded-md border border-rose-400/30 bg-rose-950/30 p-3 text-xs text-rose-200">{formError}</div>}
          </div>
        </div>

        <div className="grid gap-5">
          <div className="rounded-lg border border-slate-800 bg-slate-950 p-4">
            <h3 className="mb-4 flex items-center gap-2 text-sm font-semibold text-white">
              <AlertOctagon className="h-4 w-4 text-amber-300" />
              Urgent Requests and Exceptional Bookings
            </h3>
            <div className="grid gap-3 md:grid-cols-2">
              {urgentRequests.map((booking) => (
                <button key={booking.id} type="button" onClick={() => setSelectedBookingId(booking.id)} className={`rounded-lg border p-3 text-left transition hover:border-cyan-400/40 ${selectedBookingId === booking.id ? 'border-cyan-400/50 bg-cyan-950/20' : 'border-slate-800 bg-slate-900/40'}`}>
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="font-semibold text-white">{booking.equipmentName} <span className="font-mono text-cyan-300">{booking.unitId}</span></div>
                      <div className="mt-1 text-xs text-slate-400">{booking.requesterName} · {booking.requesterRole}</div>
                    </div>
                    <span className={`text-xs capitalize ${statusTone(booking.status)}`}>{booking.status}</span>
                  </div>
                  <div className="mt-2 text-xs leading-5 text-slate-400">{formatDateTime(booking.startAt)} - {formatDateTime(booking.endAt)}</div>
                </button>
              ))}
            </div>
          </div>

          <div className="rounded-lg border border-slate-800 bg-slate-950 p-4">
            <h3 className="mb-4 flex items-center gap-2 text-sm font-semibold text-white">
              <ClipboardList className="h-4 w-4 text-rose-300" />
              Audit Log
            </h3>
            <div className="max-h-[380px] space-y-3 overflow-auto pr-2">
              {auditLog.map((entry) => (
                <div key={entry.id} className="rounded-md border border-slate-800 bg-slate-900/50 p-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="text-sm font-semibold text-white">{ACTION_LABEL[entry.action]}</div>
                    <div className="text-xs text-slate-500">{formatDateTime(entry.timestamp)}</div>
                  </div>
                  <div className="mt-1 text-xs text-slate-400">{entry.target} · {entry.actor}</div>
                  <div className="mt-2 text-xs leading-5 text-slate-300">{entry.reason}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

const Metric: React.FC<{ label: string; value: number; tone?: 'normal' | 'warning' }> = ({ label, value, tone = 'normal' }) => (
  <div className={`rounded-lg border px-4 py-3 ${tone === 'warning' ? 'border-amber-400/30 bg-amber-950/20' : 'border-slate-800 bg-slate-950'}`}>
    <div className="text-xl font-semibold text-white">{value}</div>
    <div className="text-xs text-slate-500">{label}</div>
  </div>
);
