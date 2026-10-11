import React, { useEffect, useMemo, useState } from 'react';
import { AlarmClock, CheckCircle2, ListPlus, ShieldAlert, TimerReset, XCircle } from 'lucide-react';
import { CampusRole, ResourceUnit, WaitlistDraft, WaitlistEntry } from '../types/scheduling';
import { calculatePriorityScore } from '../lib/schedulingData';
import { EquipmentIconTile } from './EquipmentIconTile';

interface WaitlistCascadeDashboardProps {
  resources: ResourceUnit[];
  entries: WaitlistEntry[];
  priorityFormula: string;
  onJoinWaitlist: (draft: WaitlistDraft) => Promise<void>;
  onAcceptOffer: (entryId: string) => Promise<void>;
  onDeclineOffer: (entryId: string) => Promise<void>;
  onExpireOffer: (entryId: string) => Promise<void>;
  onCancelEntry: (entryId: string) => Promise<void>;
}

const ROLES: CampusRole[] = ['Student', 'Club Lead', 'Researcher', 'Faculty', 'Lab Admin'];

const localDateTimeInput = (date: Date) => {
  const offset = date.getTimezoneOffset();
  return new Date(date.getTime() - offset * 60_000).toISOString().slice(0, 16);
};

const formatDateTime = (iso: string) =>
  new Date(iso).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });

const countdownText = (expiresAt?: string) => {
  if (!expiresAt) return 'No active offer';
  const remaining = Math.max(0, new Date(expiresAt).getTime() - Date.now());
  const minutes = Math.floor(remaining / 60_000);
  const seconds = Math.floor((remaining % 60_000) / 1000);
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
};

export const WaitlistCascadeDashboard: React.FC<WaitlistCascadeDashboardProps> = ({
  resources,
  entries,
  priorityFormula,
  onJoinWaitlist,
  onAcceptOffer,
  onDeclineOffer,
  onExpireOffer,
  onCancelEntry,
}) => {
  const [nowTick, setNowTick] = useState(0);
  const [equipmentId, setEquipmentId] = useState(resources[0]?.id ?? '');
  const [userName, setUserName] = useState('Demo Student');
  const [userRole, setUserRole] = useState<CampusRole>('Student');
  const [urgency, setUrgency] = useState(3);
  const [noShowPenalty, setNoShowPenalty] = useState(0);
  const [notes, setNotes] = useState('Course project deadline');
  const [startAt, setStartAt] = useState(() => localDateTimeInput(new Date(Date.now() + 60 * 60_000)));
  const [endAt, setEndAt] = useState(() => localDateTimeInput(new Date(Date.now() + 3 * 60 * 60_000)));
  const [formError, setFormError] = useState<string | null>(null);
  const [selectedEntryId, setSelectedEntryId] = useState<string | null>(entries[0]?.id ?? null);

  useEffect(() => {
    const timer = window.setInterval(() => setNowTick((value) => value + 1), 1000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    const expired = entries.filter((entry) => entry.status === 'offered' && entry.offerExpiresAt && new Date(entry.offerExpiresAt).getTime() <= Date.now());
    expired.forEach((entry) => void onExpireOffer(entry.id));
  }, [entries, nowTick, onExpireOffer]);

  const rankedEntries = useMemo(
    () =>
      [...entries].sort((a, b) => {
        if (a.equipmentName !== b.equipmentName) return a.equipmentName.localeCompare(b.equipmentName);
        return b.priorityScore - a.priorityScore || new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
      }),
    [entries],
  );

  const queuePositions = useMemo(() => {
    const positions = new Map<string, number>();
    const grouped = new Map<string, WaitlistEntry[]>();
    entries.forEach((entry) => {
      if (!['waiting', 'offered'].includes(entry.status)) return;
      grouped.set(entry.equipmentId, [...(grouped.get(entry.equipmentId) ?? []), entry]);
    });
    grouped.forEach((queue) => {
      queue
        .sort((a, b) => b.priorityScore - a.priorityScore || new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
        .forEach((entry, index) => positions.set(entry.id, index + 1));
    });
    return positions;
  }, [entries]);

  const offeredCount = entries.filter((entry) => entry.status === 'offered').length;
  const waitingCount = entries.filter((entry) => entry.status === 'waiting').length;
  const previewScore = calculatePriorityScore(userRole, urgency, noShowPenalty);
  const selectedEntry = rankedEntries.find((entry) => entry.id === selectedEntryId) ?? rankedEntries[0] ?? null;

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setFormError(null);
    try {
      await onJoinWaitlist({
        equipmentId,
        requestedStartAt: new Date(startAt).toISOString(),
        requestedEndAt: new Date(endAt).toISOString(),
        userName,
        userRole,
        urgency,
        noShowPenalty,
        notes,
      });
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Unable to join waitlist.');
    }
  };

  return (
    <section id="waitlist-cascade" className="scroll-mt-6 rounded-lg border border-amber-500/20 bg-slate-950/70 p-4 md:p-5 shadow-glass">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <div className="flex items-center gap-2 text-xs font-mono uppercase tracking-widest text-amber-300">
            <TimerReset className="h-4 w-4" />
            Waitlist Cascade
          </div>
          <h2 className="mt-2 text-xl font-semibold text-white">Priority Queue</h2>
          <div className="mt-2 inline-flex rounded-md border border-amber-400/25 bg-amber-500/10 px-2.5 py-1 text-[11px] text-amber-200">
            {priorityFormula}
          </div>
        </div>
        <div className="grid grid-cols-3 gap-3 text-center">
          <Metric label="Waiting" value={waitingCount} />
          <Metric label="Offered" value={offeredCount} tone="warning" />
          <Metric label="Total Queue" value={entries.length} />
        </div>
      </div>

      <div className="mt-5 grid gap-5 xl:grid-cols-[380px_1fr]">
        <form onSubmit={submit} className="rounded-lg border border-slate-800 bg-slate-950 p-4">
          <div className="mb-4 flex items-center gap-2 text-sm font-semibold text-white">
            <ListPlus className="h-4 w-4 text-amber-300" />
            Join Waitlist
          </div>
          <div className="space-y-3">
            <label className="block text-xs text-slate-400">
              Equipment
              <select value={equipmentId} onChange={(event) => setEquipmentId(event.target.value)} className="mt-1 w-full rounded-md border border-slate-800 bg-slate-900 px-3 py-2 text-sm text-slate-200">
                {resources.map((resource) => (
                  <option key={resource.id} value={resource.id}>
                    {resource.name} {resource.unitId} · {resource.buildingName}
                  </option>
                ))}
              </select>
            </label>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="text-xs text-slate-400">
                Requested start
                <input type="datetime-local" value={startAt} onChange={(event) => setStartAt(event.target.value)} className="mt-1 w-full rounded-md border border-slate-800 bg-slate-900 px-3 py-2 text-sm text-slate-200" />
              </label>
              <label className="text-xs text-slate-400">
                Requested end
                <input type="datetime-local" value={endAt} onChange={(event) => setEndAt(event.target.value)} className="mt-1 w-full rounded-md border border-slate-800 bg-slate-900 px-3 py-2 text-sm text-slate-200" />
              </label>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="text-xs text-slate-400">
                Requester
                <input value={userName} onChange={(event) => setUserName(event.target.value)} className="mt-1 w-full rounded-md border border-slate-800 bg-slate-900 px-3 py-2 text-sm text-slate-200" />
              </label>
              <label className="text-xs text-slate-400">
                Role
                <select value={userRole} onChange={(event) => setUserRole(event.target.value as CampusRole)} className="mt-1 w-full rounded-md border border-slate-800 bg-slate-900 px-3 py-2 text-sm text-slate-200">
                  {ROLES.map((role) => (
                    <option key={role} value={role}>
                      {role}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <label className="block text-xs text-slate-400">
              Project urgency: {urgency}
              <input type="range" min={1} max={5} value={urgency} onChange={(event) => setUrgency(Number(event.target.value))} className="mt-2 w-full accent-amber-300" />
            </label>
            <label className="block text-xs text-slate-400">
              No-show penalty: {noShowPenalty}
              <input type="range" min={0} max={10} value={noShowPenalty} onChange={(event) => setNoShowPenalty(Number(event.target.value))} className="mt-2 w-full accent-rose-400" />
            </label>
            <label className="block text-xs text-slate-400">
              Notes
              <input value={notes} onChange={(event) => setNotes(event.target.value)} className="mt-1 w-full rounded-md border border-slate-800 bg-slate-900 px-3 py-2 text-sm text-slate-200" />
            </label>
            <div className="rounded-md border border-amber-400/30 bg-amber-950/20 p-3 text-xs text-amber-100">
              Transparent priority preview: <span className="font-semibold text-white">{previewScore}</span>
            </div>
            {formError && <div className="rounded-md border border-rose-400/30 bg-rose-950/30 p-3 text-xs text-rose-200">{formError}</div>}
            <button type="submit" className="w-full rounded-md bg-amber-300 px-4 py-2 text-sm font-semibold text-slate-950 hover:bg-amber-200">
              Join Waitlist
            </button>
          </div>
        </form>

        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_360px]">
          <div className="rounded-lg border border-slate-800 bg-slate-950 p-4">
            <div className="grid grid-cols-[repeat(auto-fill,minmax(78px,1fr))] gap-3">
              {rankedEntries.map((entry) => {
                const position = queuePositions.get(entry.id);
                const isSelected = selectedEntry?.id === entry.id;
                const isOffered = entry.status === 'offered';
                return (
                  <button
                    key={entry.id}
                    type="button"
                    onClick={() => setSelectedEntryId(entry.id)}
                    className={`group relative flex min-h-[86px] flex-col items-center justify-center rounded-xl border p-2 text-center transition hover:-translate-y-0.5 hover:border-cyan-400/40 ${
                      isSelected ? 'border-cyan-400/60 bg-cyan-950/25' : 'border-slate-800 bg-slate-900/35'
                    }`}
                    title={`${entry.equipmentName} ${entry.unitId} · ${entry.userName} · ${entry.status}`}
                    aria-label={`${entry.equipmentName} ${entry.unitId}, queue ${position ?? 'closed'}, priority ${entry.priorityScore}, ${entry.status}`}
                  >
                    <EquipmentIconTile equipmentId={entry.equipmentId} name={entry.equipmentName} selected={isSelected} status={isOffered ? 'pending' : entry.status === 'booked' ? 'available' : 'booked'} size="lg" />
                    <span className="mt-2 flex items-center gap-1.5 text-[11px] font-semibold text-slate-200">
                      <span className="font-mono text-cyan-300">{position ? `#${position}` : '--'}</span>
                      <span className="text-slate-600">/</span>
                      <span>{entry.priorityScore}</span>
                    </span>
                    {isOffered && <span className="absolute right-1.5 top-1.5 h-2.5 w-2.5 rounded-full bg-amber-300 shadow-[0_0_10px_rgba(252,211,77,0.8)]" aria-label="Active offer" />}
                  </button>
                );
              })}
            </div>
            {rankedEntries.length === 0 && (
              <div className="flex items-center gap-2 p-6 text-sm text-slate-500">
                <ShieldAlert className="h-4 w-4" />
                No waitlist entries yet.
              </div>
            )}
          </div>

          <div className="rounded-lg border border-slate-800 bg-slate-950 p-4">
            {selectedEntry ? (
              <WaitlistDetail
                entry={selectedEntry}
                position={queuePositions.get(selectedEntry.id)}
                onAcceptOffer={onAcceptOffer}
                onDeclineOffer={onDeclineOffer}
                onCancelEntry={onCancelEntry}
              />
            ) : (
              <div className="text-sm text-slate-500">Select an equipment tile.</div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
};

const Metric: React.FC<{ label: string; value: number; tone?: 'normal' | 'warning' }> = ({ label, value, tone = 'normal' }) => (
  <div className={`rounded-lg border px-4 py-3 ${tone === 'warning' ? 'border-amber-400/30 bg-amber-950/20' : 'border-slate-800 bg-slate-950'}`}>
    <div className="flex justify-center text-amber-300">
      <AlarmClock className="h-4 w-4" />
    </div>
    <div className="mt-1 text-xl font-semibold text-white">{value}</div>
    <div className="text-xs text-slate-500">{label}</div>
  </div>
);

const WaitlistDetail: React.FC<{
  entry: WaitlistEntry;
  position?: number;
  onAcceptOffer: (entryId: string) => Promise<void>;
  onDeclineOffer: (entryId: string) => Promise<void>;
  onCancelEntry: (entryId: string) => Promise<void>;
}> = ({ entry, position, onAcceptOffer, onDeclineOffer, onCancelEntry }) => {
  const isOffered = entry.status === 'offered';

  return (
    <div>
      <div className="flex items-start gap-3">
        <EquipmentIconTile equipmentId={entry.equipmentId} name={entry.equipmentName} status={isOffered ? 'pending' : entry.status === 'booked' ? 'available' : 'booked'} size="lg" selected />
        <div className="min-w-0">
          <div className="truncate text-sm font-semibold text-white">
            {entry.equipmentName} <span className="font-mono text-cyan-300">{entry.unitId}</span>
          </div>
          <div className="mt-1 text-xs text-slate-400">{entry.buildingName}</div>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-3 gap-2">
        <DetailMetric label="Queue" value={position ? `#${position}` : 'Closed'} />
        <DetailMetric label="Priority" value={entry.priorityScore} />
        <DetailMetric label="Status" value={entry.status} />
      </div>

      <div className="mt-4 space-y-2 rounded-lg border border-slate-800 bg-slate-900/45 p-3 text-xs text-slate-300">
        <DetailRow label="Requester" value={`${entry.userName} · ${entry.userRole}`} />
        <DetailRow label="Start" value={formatDateTime(entry.requestedStartAt)} />
        <DetailRow label="End" value={formatDateTime(entry.requestedEndAt)} />
        <DetailRow label="Score inputs" value={`Urgency ${entry.urgency} · Penalty ${entry.noShowPenalty}`} />
        {entry.notes && <DetailRow label="Notes" value={entry.notes} />}
        {isOffered && <DetailRow label="Offer" value={`Expires in ${countdownText(entry.offerExpiresAt)}`} tone="warning" />}
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        {isOffered && (
          <>
            <button type="button" onClick={() => void onAcceptOffer(entry.id)} className="rounded-md bg-emerald-400 px-3 py-2 text-xs font-semibold text-slate-950 hover:bg-emerald-300">
              <CheckCircle2 className="mr-1 inline h-3.5 w-3.5" /> Accept
            </button>
            <button type="button" onClick={() => void onDeclineOffer(entry.id)} className="rounded-md bg-slate-800 px-3 py-2 text-xs font-semibold text-slate-200 hover:bg-slate-700">
              Decline
            </button>
          </>
        )}
        {entry.status === 'waiting' && (
          <button type="button" onClick={() => void onCancelEntry(entry.id)} className="rounded-md border border-slate-700 px-3 py-2 text-xs font-semibold text-slate-300 hover:bg-slate-900">
            Cancel
          </button>
        )}
        {entry.status === 'expired' && <span className="inline-flex items-center gap-1 text-xs text-rose-300"><XCircle className="h-3.5 w-3.5" /> Expired</span>}
        {entry.status === 'booked' && <span className="inline-flex items-center gap-1 text-xs text-emerald-300"><CheckCircle2 className="h-3.5 w-3.5" /> Booked</span>}
      </div>
    </div>
  );
};

const DetailMetric: React.FC<{ label: string; value: string | number }> = ({ label, value }) => (
  <div className="rounded-lg border border-slate-800 bg-slate-900/50 p-2">
    <div className="text-[10px] uppercase tracking-widest text-slate-500">{label}</div>
    <div className="mt-1 truncate text-sm font-semibold capitalize text-white">{value}</div>
  </div>
);

const DetailRow: React.FC<{ label: string; value: string; tone?: 'normal' | 'warning' }> = ({ label, value, tone = 'normal' }) => (
  <div className="grid grid-cols-[76px_1fr] gap-3">
    <span className="text-slate-500">{label}</span>
    <span className={tone === 'warning' ? 'font-mono text-amber-300' : 'text-slate-200'}>{value}</span>
  </div>
);
