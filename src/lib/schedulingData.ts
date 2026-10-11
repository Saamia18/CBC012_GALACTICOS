import { useCallback, useEffect, useMemo, useState } from 'react';
import { MOCK_EQUIPMENT, EquipmentUnit } from '../data/mock';
import {
  AdminActionType,
  AdminAuditEntry,
  AdminOverrideDraft,
  BookingDraft,
  BookingRecord,
  BookingStatus,
  CampusRole,
  EquipmentCategory,
  ResourceUnit,
  SchedulingDataset,
  ToastMessage,
  WaitlistDraft,
  WaitlistEntry,
} from '../types/scheduling';

const OFFER_WINDOW_MS = 10 * 60 * 1000;
const ACTIVE_STATUSES: BookingStatus[] = ['confirmed', 'pending', 'in-use', 'checked-in', 'maintenance'];
const MAINTENANCE_SAFE_STATUSES: BookingStatus[] = ['maintenance'];

const CATEGORY_BY_TYPE: Record<EquipmentUnit['type'], EquipmentCategory> = {
  camera: 'DSLR Camera',
  gpu: 'GPU Cluster',
  vr: 'VR Headset',
  microscope: 'Microscope',
  printer: '3D Printer',
  projector: 'Projector',
  labkit: 'Lab Kit',
  device: 'Testing Device',
};

const ROLE_WEIGHT: Record<CampusRole, number> = {
  'Lab Admin': 30,
  Faculty: 26,
  Researcher: 24,
  'Club Lead': 18,
  Student: 14,
};

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));

export const createQrToken = (bookingId: string, equipmentId: string, startAt: string) => `ZC|${bookingId}|${equipmentId}|${startAt}`;

export const parseQrToken = (payload: string) => {
  const [prefix, bookingId, equipmentId, startAt] = payload.trim().split('|');
  if (prefix !== 'ZC' || !bookingId || !equipmentId || !startAt) return null;
  return { bookingId, equipmentId, startAt };
};

export const calculatePriorityScore = (role: CampusRole, urgency: number, noShowPenalty: number) =>
  clamp(Math.round(ROLE_WEIGHT[role] + urgency * 12 - noShowPenalty * 2), 0, 100);

export const priorityFormula = 'Role weight + urgency x 12 - no-show penalty x 2';

export const categoryForUnit = (unit: EquipmentUnit): EquipmentCategory => CATEGORY_BY_TYPE[unit.type];

export const getLocalResources = (): ResourceUnit[] =>
  Object.values(MOCK_EQUIPMENT).map((unit) => ({
    id: unit.id,
    name: unit.name,
    unitId: unit.unitNumber,
    category: categoryForUnit(unit),
    buildingId: unit.buildingId,
    buildingName: unit.buildingName,
    status: unit.status,
  }));

const hourIso = (date: Date, hour: number, dayOffset = 0) => {
  const next = new Date(date);
  next.setDate(next.getDate() + dayOffset);
  next.setHours(hour, 0, 0, 0);
  return next.toISOString();
};

const addHoursIso = (iso: string, hours: number) => {
  const date = new Date(iso);
  date.setHours(date.getHours() + hours);
  return date.toISOString();
};

export const hasIntervalOverlap = (
  existingStart: string,
  existingEnd: string,
  requestedStart: string,
  requestedEnd: string,
) => new Date(existingStart) < new Date(requestedEnd) && new Date(existingEnd) > new Date(requestedStart);

export const buildDemoBookings = (resources: ResourceUnit[], anchor = new Date()): BookingRecord[] => {
  const today = new Date(anchor);
  today.setHours(0, 0, 0, 0);
  const demandCycle = ['eq-cam-01', 'eq-cam-04', 'eq-gpu-01', 'eq-vr-01', 'eq-print-01', 'eq-proj-01', 'eq-micro-02', 'eq-labkit-01', 'eq-device-01'];
  const bookings: BookingRecord[] = [];

  for (let day = -28; day <= 14; day += 1) {
    const dayOfWeek = new Date(today.getFullYear(), today.getMonth(), today.getDate() + day).getDay();
    const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
    const dailyCount = isWeekend ? 3 : 5 + (Math.abs(day) % 3);
    for (let index = 0; index < dailyCount; index += 1) {
      const equipmentId = demandCycle[(day + 60 + index * 2) % demandCycle.length];
      const resource = resources.find((item) => item.id === equipmentId);
      if (!resource) continue;
      const startHour = 9 + ((index * 2 + dayOfWeek) % 8);
      const startAt = hourIso(today, startHour, day);
      const endAt = addHoursIso(startAt, equipmentId.includes('gpu') ? 4 : 2 + (index % 2));
      const now = Date.now();
      const status: BookingStatus =
        resource.status === 'maintenance' && day >= 0 && day <= 1
          ? 'maintenance'
          : new Date(startAt).getTime() <= now && new Date(endAt).getTime() > now
          ? 'in-use'
          : day > 0 && index % 5 === 0
          ? 'pending'
          : 'confirmed';

      bookings.push({
        id: `demo-${day}-${index}-${equipmentId}`,
        equipmentId,
        equipmentName: resource.name,
        unitId: resource.unitId,
        category: resource.category,
        buildingId: resource.buildingId,
        buildingName: resource.buildingName,
        requesterName: ['Anika Rao', 'Dr. Evelyn Reed', 'Robotics Club', 'Media Society', 'Daniel Zhang'][index % 5],
        requesterRole: ['Student', 'Faculty', 'Lab Admin', 'Researcher'][index % 4],
        purpose: ['Course project', 'Research lab', 'Studio production', 'Prototype validation'][index % 4],
        startAt,
        endAt,
        status,
        source: 'demo',
        qrToken: createQrToken(`demo-${day}-${index}-${equipmentId}`, equipmentId, startAt),
      });
    }
  }

  const liveResource = resources.find((item) => item.id === 'eq-device-01') ?? resources[0];
  if (liveResource) {
    const startAt = new Date(Date.now() - 5 * 60_000).toISOString();
    const endAt = new Date(Date.now() + 2 * 60 * 60_000).toISOString();
    const id = `demo-live-${liveResource.id}`;
    bookings.push({
      id,
      equipmentId: liveResource.id,
      equipmentName: liveResource.name,
      unitId: liveResource.unitId,
      category: liveResource.category,
      buildingId: liveResource.buildingId,
      buildingName: liveResource.buildingName,
      requesterName: 'Demo QR User',
      requesterRole: 'Student',
      purpose: 'Live QR check-in test booking',
      startAt,
      endAt,
      status: 'confirmed',
      source: 'demo',
      qrToken: createQrToken(id, liveResource.id, startAt),
    });
  }

  return bookings;
};

const createAudit = (action: AdminActionType, target: string, reason: string, actor = 'Demo Admin'): AdminAuditEntry => ({
  id: `audit-${crypto.randomUUID()}`,
  action,
  target,
  reason,
  actor,
  timestamp: new Date().toISOString(),
});

const createToast = (tone: ToastMessage['tone'], title: string, message: string): ToastMessage => ({
  id: `toast-${crypto.randomUUID()}`,
  tone,
  title,
  message,
});

const buildWaitlistPressure = (entries: WaitlistEntry[]) =>
  entries.reduce<Record<string, number>>((acc, entry) => {
    if (entry.status === 'waiting' || entry.status === 'offered') acc[entry.equipmentId] = (acc[entry.equipmentId] ?? 0) + 1;
    return acc;
  }, {});

const hasEquipmentConflict = (
  bookings: BookingRecord[],
  equipmentId: string,
  startAt: string,
  endAt: string,
  ignoreBookingId?: string,
  statuses = ACTIVE_STATUSES,
) =>
  bookings.some(
    (booking) =>
      booking.id !== ignoreBookingId &&
      booking.equipmentId === equipmentId &&
      statuses.includes(booking.status) &&
      hasIntervalOverlap(booking.startAt, booking.endAt, startAt, endAt),
  );

const isUnderMaintenance = (bookings: BookingRecord[], resources: ResourceUnit[], equipmentId: string, startAt: string, endAt: string) => {
  const resource = resources.find((item) => item.id === equipmentId);
  if (resource?.status === 'maintenance') return true;
  return hasEquipmentConflict(bookings, equipmentId, startAt, endAt, undefined, MAINTENANCE_SAFE_STATUSES);
};

const rankWaitlist = (entries: WaitlistEntry[]) =>
  [...entries].sort((a, b) => b.priorityScore - a.priorityScore || new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());

const activateNextOffer = (
  dataset: SchedulingDataset,
  equipmentId: string,
  startAt: string,
  endAt: string,
  reason: string,
  actor = 'Cascade Engine',
) => {
  if (isUnderMaintenance(dataset.bookings, dataset.resources, equipmentId, startAt, endAt)) {
    return {
      dataset: {
        ...dataset,
        auditLog: [createAudit('waitlist-offer', equipmentId, 'No offer made because the equipment is under maintenance.', actor), ...dataset.auditLog],
      },
      toast: createToast('warning', 'No cascade offer', 'The freed slot is blocked by maintenance safety.'),
    };
  }

  if (hasEquipmentConflict(dataset.bookings, equipmentId, startAt, endAt)) {
    return {
      dataset,
      toast: createToast('warning', 'No cascade offer', 'Another active booking already occupies that slot.'),
    };
  }

  const eligible = rankWaitlist(
    dataset.waitlistEntries.filter(
      (entry) =>
        entry.equipmentId === equipmentId &&
        entry.status === 'waiting' &&
        hasIntervalOverlap(entry.requestedStartAt, entry.requestedEndAt, startAt, endAt),
    ),
  );

  const next = eligible[0];
  if (!next) {
    return {
      dataset: {
        ...dataset,
        auditLog: [createAudit('waitlist-offer', equipmentId, 'No eligible waitlist entries for the freed slot.', actor), ...dataset.auditLog],
      },
      toast: createToast('info', 'Queue empty', 'No eligible waitlist entry matched the freed slot.'),
    };
  }

  const offerExpiresAt = new Date(Date.now() + OFFER_WINDOW_MS).toISOString();
  const updatedEntries = dataset.waitlistEntries.map((entry) =>
    entry.id === next.id
      ? {
          ...entry,
          status: 'offered' as const,
          offerExpiresAt,
          offeredStartAt: startAt,
          offeredEndAt: endAt,
        }
      : entry,
  );

  const updatedDataset = {
    ...dataset,
    waitlistEntries: updatedEntries,
    waitlistPressure: buildWaitlistPressure(updatedEntries),
    auditLog: [
      createAudit('waitlist-offer', `${next.userName} · ${next.equipmentName}`, `${reason} Offered ${new Date(startAt).toLocaleString()} slot for 10 simulated minutes.`, actor),
      ...dataset.auditLog,
    ],
  };

  return {
    dataset: updatedDataset,
    toast: createToast('success', 'Cascade offer sent', `${next.userName} is now first in line for ${next.equipmentName}.`),
  };
};

const buildDemoWaitlist = (resources: ResourceUnit[], bookings: BookingRecord[]) => {
  const candidates = bookings
    .filter((booking) => booking.status === 'confirmed' || booking.status === 'pending')
    .filter((booking) => new Date(booking.startAt).getTime() > Date.now())
    .slice(0, 10);

  const names = ['Meera Iyer', 'Jon Bell', 'Priya Nair', 'Aarav Shah', 'Mina Park', 'Luca Rossi', 'Nadia Chen', 'Ishaan Mehta', 'Tara Singh', 'Omar Khan'];
  const roles: CampusRole[] = ['Student', 'Researcher', 'Faculty', 'Club Lead', 'Lab Admin'];

  return candidates.map((booking, index) => {
    const resource = resources.find((item) => item.id === booking.equipmentId);
    const urgency = 2 + (index % 4);
    const noShowPenalty = index % 3 === 0 ? 3 : index % 5 === 0 ? 8 : 0;
    const userRole = roles[index % roles.length];
    const requestedStart = new Date(booking.startAt);
    requestedStart.setMinutes(requestedStart.getMinutes() - (index % 2) * 30);
    const requestedEnd = new Date(booking.endAt);
    requestedEnd.setMinutes(requestedEnd.getMinutes() + (index % 3) * 20);

    return {
      id: `wait-${index}-${booking.equipmentId}`,
      equipmentId: booking.equipmentId,
      equipmentName: resource?.name ?? booking.equipmentName,
      unitId: resource?.unitId ?? booking.unitId,
      buildingName: resource?.buildingName ?? booking.buildingName,
      requestedStartAt: requestedStart.toISOString(),
      requestedEndAt: requestedEnd.toISOString(),
      userName: names[index % names.length],
      userRole,
      urgency,
      noShowPenalty,
      priorityScore: calculatePriorityScore(userRole, urgency, noShowPenalty),
      status: 'waiting' as const,
      createdAt: new Date(Date.now() - (index + 1) * 18 * 60_000).toISOString(),
      notes: ['Capstone shoot', 'Grant deadline', 'Studio practicum', 'Lab milestone'][index % 4],
    };
  });
};

const buildDemoDataset = (): SchedulingDataset => {
  const resources = getLocalResources();
  const bookings = buildDemoBookings(resources);
  const waitlistEntries = buildDemoWaitlist(resources, bookings);
  return {
    resources,
    bookings,
    waitlistEntries,
    waitlistPressure: buildWaitlistPressure(waitlistEntries),
    auditLog: [
      createAudit('override-decision', 'Frontend demo mode', 'Role permissions, timers, and overrides are simulations only; backend enforcement is not active.', 'System'),
    ],
    source: 'demo',
    sourceLabel: 'Frontend demo mode · shared mock state · no Supabase connection',
  };
};

export const useSchedulingData = () => {
  const [dataset, setDataset] = useState<SchedulingDataset>(() => buildDemoDataset());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  const pushToast = useCallback((toast: ToastMessage) => {
    setToasts((current) => [toast, ...current].slice(0, 4));
  }, []);

  const dismissToast = useCallback((toastId: string) => {
    setToasts((current) => current.filter((toast) => toast.id !== toastId));
  }, []);

  useEffect(() => {
    if (toasts.length === 0) return;
    const timer = window.setTimeout(() => {
      setToasts((current) => current.slice(0, -1));
    }, 5000);
    return () => window.clearTimeout(timer);
  }, [toasts]);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    await Promise.resolve();
    const next = buildDemoDataset();
    setDataset(next);
    setLoading(false);
    pushToast(createToast('info', 'Demo data refreshed', 'Bookings, waitlist queues, admin log, and forecasts were reset to shared mock state.'));
  }, [pushToast]);

  const createBooking = useCallback(
    async (draft: BookingDraft) => {
      if (new Date(draft.endAt) <= new Date(draft.startAt)) {
        throw new Error('End time must be after start time.');
      }
      if (new Date(draft.startAt).getTime() < Date.now() - 60_000) {
        throw new Error('Start time cannot be in the past.');
      }

      const resource = dataset.resources.find((item) => item.id === draft.equipmentId);
      if (!resource) throw new Error('Selected equipment could not be found.');
      if (isUnderMaintenance(dataset.bookings, dataset.resources, draft.equipmentId, draft.startAt, draft.endAt)) {
        throw new Error('This unit is blocked for maintenance in that interval.');
      }
      if (hasEquipmentConflict(dataset.bookings, draft.equipmentId, draft.startAt, draft.endAt)) {
        throw new Error('That unit already has a booking in this interval.');
      }

      const booking: BookingRecord = {
        id: `local-${crypto.randomUUID()}`,
        equipmentId: resource.id,
        equipmentName: resource.name,
        unitId: resource.unitId,
        category: resource.category,
        buildingId: resource.buildingId,
        buildingName: resource.buildingName,
        requesterName: draft.requesterName || 'Demo borrower',
        requesterRole: 'Campus user',
        purpose: draft.purpose || 'New equipment reservation',
        startAt: draft.startAt,
        endAt: draft.endAt,
        status: draft.status,
        source: 'local',
        qrToken: '',
      };
      booking.qrToken = createQrToken(booking.id, booking.equipmentId, booking.startAt);
      setDataset((current) => ({ ...current, bookings: [...current.bookings, booking] }));
      pushToast(createToast('success', 'Booking created', `${resource.name} ${resource.unitId} is reserved.`));
    },
    [dataset, pushToast],
  );

  const cancelBooking = useCallback(
    async (bookingId: string, reason = 'Booking cancelled; cascade evaluated the freed slot.', actor = 'Campus Scheduler') => {
      let toast: ToastMessage | null = null;
      setDataset((current) => {
        const cancelled = current.bookings.find((booking) => booking.id === bookingId);
        if (!cancelled) return current;
        const withCancelled = {
          ...current,
          bookings: current.bookings.map((booking) => (booking.id === bookingId ? { ...booking, status: 'cancelled' as BookingStatus } : booking)),
          auditLog: [createAudit('booking-cancelled', `${cancelled.equipmentName} ${cancelled.unitId}`, reason, actor), ...current.auditLog],
        };
        const result = activateNextOffer(withCancelled, cancelled.equipmentId, cancelled.startAt, cancelled.endAt, reason, 'Cascade Engine');
        toast = result.toast;
        return result.dataset;
      });
      if (toast) pushToast(toast);
    },
    [pushToast],
  );

  const joinWaitlist = useCallback(
    async (draft: WaitlistDraft) => {
      const resource = dataset.resources.find((item) => item.id === draft.equipmentId);
      if (!resource) throw new Error('Selected equipment could not be found.');
      if (new Date(draft.requestedEndAt) <= new Date(draft.requestedStartAt)) throw new Error('Requested end time must be after start time.');

      const entry: WaitlistEntry = {
        id: `wait-${crypto.randomUUID()}`,
        equipmentId: resource.id,
        equipmentName: resource.name,
        unitId: resource.unitId,
        buildingName: resource.buildingName,
        requestedStartAt: draft.requestedStartAt,
        requestedEndAt: draft.requestedEndAt,
        userName: draft.userName,
        userRole: draft.userRole,
        urgency: draft.urgency,
        noShowPenalty: draft.noShowPenalty,
        priorityScore: calculatePriorityScore(draft.userRole, draft.urgency, draft.noShowPenalty),
        status: 'waiting',
        createdAt: new Date().toISOString(),
        notes: draft.notes,
      };

      setDataset((current) => {
        const entries = [...current.waitlistEntries, entry];
        return {
          ...current,
          waitlistEntries: entries,
          waitlistPressure: buildWaitlistPressure(entries),
        };
      });
      pushToast(createToast('success', 'Joined waitlist', `${entry.userName} entered the ${resource.name} queue with priority ${entry.priorityScore}.`));
    },
    [dataset.resources, pushToast],
  );

  const acceptWaitlistOffer = useCallback(
    async (entryId: string) => {
      let toast: ToastMessage | null = null;
      setDataset((current) => {
        const entry = current.waitlistEntries.find((item) => item.id === entryId);
        if (!entry || entry.status !== 'offered' || !entry.offeredStartAt || !entry.offeredEndAt) return current;
        if (new Date(entry.offerExpiresAt ?? '').getTime() <= Date.now()) {
          const expired = current.waitlistEntries.map((item) => (item.id === entryId ? { ...item, status: 'expired' as const } : item));
          const result = activateNextOffer({ ...current, waitlistEntries: expired, waitlistPressure: buildWaitlistPressure(expired) }, entry.equipmentId, entry.offeredStartAt, entry.offeredEndAt, 'Previous waitlist offer expired.', 'Cascade Engine');
          toast = result.toast;
          return result.dataset;
        }
        if (isUnderMaintenance(current.bookings, current.resources, entry.equipmentId, entry.offeredStartAt, entry.offeredEndAt)) {
          toast = createToast('error', 'Offer blocked', 'Maintenance safety prevents this offer from becoming a booking.');
          return current;
        }
        if (hasEquipmentConflict(current.bookings, entry.equipmentId, entry.offeredStartAt, entry.offeredEndAt)) {
          toast = createToast('error', 'Offer conflict', 'Another confirmed booking now occupies this slot.');
          return current;
        }

        const resource = current.resources.find((item) => item.id === entry.equipmentId);
        if (!resource) return current;
        const booking: BookingRecord = {
          id: `local-${crypto.randomUUID()}`,
          equipmentId: resource.id,
          equipmentName: resource.name,
          unitId: resource.unitId,
          category: resource.category,
          buildingId: resource.buildingId,
          buildingName: resource.buildingName,
          requesterName: entry.userName,
          requesterRole: entry.userRole,
          purpose: entry.notes || 'Accepted waitlist cascade offer',
          startAt: entry.offeredStartAt,
          endAt: entry.offeredEndAt,
          status: 'confirmed',
          source: 'local',
          qrToken: '',
        };
        booking.qrToken = createQrToken(booking.id, booking.equipmentId, booking.startAt);
        const entries = current.waitlistEntries.map((item) => (item.id === entryId ? { ...item, status: 'booked' as const } : item));
        toast = createToast('success', 'Offer accepted', `${entry.userName} now has the freed ${resource.name} slot.`);
        return {
          ...current,
          bookings: [...current.bookings, booking],
          waitlistEntries: entries,
          waitlistPressure: buildWaitlistPressure(entries),
          auditLog: [createAudit('waitlist-accepted', `${entry.userName} · ${resource.name}`, 'Waitlist user accepted the simulated 10-minute offer.', 'Cascade Engine'), ...current.auditLog],
        };
      });
      if (toast) pushToast(toast);
    },
    [pushToast],
  );

  const advanceWaitlistOffer = useCallback(
    async (entryId: string, status: 'declined' | 'expired') => {
      let toast: ToastMessage | null = null;
      setDataset((current) => {
        const entry = current.waitlistEntries.find((item) => item.id === entryId);
        if (!entry || !entry.offeredStartAt || !entry.offeredEndAt) return current;
        const entries = current.waitlistEntries.map((item) => (item.id === entryId ? { ...item, status } : item));
        const action = status === 'declined' ? 'waitlist-declined' : 'waitlist-expired';
        const result = activateNextOffer(
          {
            ...current,
            waitlistEntries: entries,
            waitlistPressure: buildWaitlistPressure(entries),
            auditLog: [createAudit(action, `${entry.userName} · ${entry.equipmentName}`, `Offer ${status}; cascade moved to the next eligible entry.`, 'Cascade Engine'), ...current.auditLog],
          },
          entry.equipmentId,
          entry.offeredStartAt,
          entry.offeredEndAt,
          `Previous offer ${status}.`,
          'Cascade Engine',
        );
        toast = result.toast;
        return result.dataset;
      });
      if (toast) pushToast(toast);
    },
    [pushToast],
  );

  const declineWaitlistOffer = useCallback((entryId: string) => advanceWaitlistOffer(entryId, 'declined'), [advanceWaitlistOffer]);
  const expireWaitlistOffer = useCallback((entryId: string) => advanceWaitlistOffer(entryId, 'expired'), [advanceWaitlistOffer]);

  const cancelWaitlistEntry = useCallback(
    async (entryId: string) => {
      setDataset((current) => {
        const entries = current.waitlistEntries.map((entry) => (entry.id === entryId ? { ...entry, status: 'cancelled' as const } : entry));
        return { ...current, waitlistEntries: entries, waitlistPressure: buildWaitlistPressure(entries) };
      });
      pushToast(createToast('info', 'Waitlist entry cancelled', 'The queue was re-ranked immediately.'));
    },
    [pushToast],
  );

  const applyAdminOverride = useCallback(
    async (draft: AdminOverrideDraft) => {
      if (!draft.reason.trim()) throw new Error('A reason is required for every admin action.');
      let toast: ToastMessage | null = null;

      setDataset((current) => {
        const audit = createAudit(draft.action, draft.targetId, draft.reason, draft.actor || 'Demo Admin');
        if (draft.action === 'approve-request') {
          const booking = current.bookings.find((item) => item.id === draft.targetId);
          if (!booking) return current;
          if (isUnderMaintenance(current.bookings, current.resources, booking.equipmentId, booking.startAt, booking.endAt)) {
            toast = createToast('error', 'Approval blocked', 'Maintenance safety prevents approving this request.');
            return current;
          }
          if (hasEquipmentConflict(current.bookings, booking.equipmentId, booking.startAt, booking.endAt, booking.id, ['confirmed', 'in-use', 'maintenance'])) {
            toast = createToast('error', 'Approval blocked', 'Approving this request would overlap another active booking.');
            return current;
          }
          toast = createToast('success', 'Request approved', `${booking.equipmentName} request is now confirmed.`);
          return {
            ...current,
            bookings: current.bookings.map((item) => (item.id === draft.targetId ? { ...item, status: 'confirmed' as BookingStatus } : item)),
            auditLog: [audit, ...current.auditLog],
          };
        }

        if (draft.action === 'reject-request' || draft.action === 'resolve-conflict') {
          const booking = current.bookings.find((item) => item.id === draft.targetId);
          if (!booking) return current;
          toast = createToast('warning', draft.action === 'reject-request' ? 'Request rejected' : 'Conflict resolved', `${booking.equipmentName} booking was cancelled.`);
          return {
            ...current,
            bookings: current.bookings.map((item) => (item.id === draft.targetId ? { ...item, status: 'cancelled' as BookingStatus } : item)),
            auditLog: [audit, ...current.auditLog],
          };
        }

        if (draft.action === 'maintenance-block' && draft.equipmentId && draft.startAt && draft.endAt) {
          const resource = current.resources.find((item) => item.id === draft.equipmentId);
          if (!resource) return current;
          if (hasEquipmentConflict(current.bookings, resource.id, draft.startAt, draft.endAt, undefined, ['confirmed', 'in-use'])) {
            toast = createToast('error', 'Maintenance blocked', 'Maintenance cannot be placed over an active confirmed booking.');
            return current;
          }
          const maintenanceBooking: BookingRecord = {
            id: `maintenance-${crypto.randomUUID()}`,
            equipmentId: resource.id,
            equipmentName: resource.name,
            unitId: resource.unitId,
            category: resource.category,
            buildingId: resource.buildingId,
            buildingName: resource.buildingName,
            requesterName: draft.actor || 'Demo Admin',
            requesterRole: 'Admin',
            purpose: `Maintenance block: ${draft.reason}`,
            startAt: draft.startAt,
            endAt: draft.endAt,
            status: 'maintenance',
            source: 'local',
            qrToken: '',
          };
          maintenanceBooking.qrToken = createQrToken(maintenanceBooking.id, maintenanceBooking.equipmentId, maintenanceBooking.startAt);
          toast = createToast('warning', 'Maintenance block added', `${resource.name} is blocked for safety.`);
          return {
            ...current,
            resources: current.resources.map((item) => (item.id === resource.id ? { ...item, status: 'maintenance' as const } : item)),
            bookings: [...current.bookings, maintenanceBooking],
            auditLog: [audit, ...current.auditLog],
          };
        }

        if (draft.action === 'maintenance-clear' && draft.equipmentId) {
          const resource = current.resources.find((item) => item.id === draft.equipmentId);
          if (!resource) return current;
          toast = createToast('success', 'Maintenance cleared', `${resource.name} is available for future safe bookings.`);
          return {
            ...current,
            resources: current.resources.map((item) => (item.id === resource.id ? { ...item, status: 'available' as const } : item)),
            bookings: current.bookings.map((booking) => (booking.equipmentId === resource.id && booking.status === 'maintenance' ? { ...booking, status: 'cancelled' as BookingStatus } : booking)),
            auditLog: [audit, ...current.auditLog],
          };
        }

        if (draft.action === 'override-decision' && draft.equipmentId && draft.startAt && draft.endAt) {
          const result = activateNextOffer(current, draft.equipmentId, draft.startAt, draft.endAt, draft.reason, draft.actor || 'Demo Admin');
          toast = result.toast;
          return {
            ...result.dataset,
            auditLog: [audit, ...result.dataset.auditLog],
          };
        }

        return { ...current, auditLog: [audit, ...current.auditLog] };
      });

      if (toast) pushToast(toast);
    },
    [pushToast],
  );

  const checkInBooking = useCallback(
    async (payload: string, actor = 'Demo borrower') => {
      const parsed = parseQrToken(payload);
      if (!parsed) throw new Error('Invalid ZeroClash QR payload.');

      let toast: ToastMessage | null = null;
      setDataset((current) => {
        const booking = current.bookings.find((item) => item.id === parsed.bookingId);
        if (!booking || booking.equipmentId !== parsed.equipmentId || booking.startAt !== parsed.startAt || booking.qrToken !== payload.trim()) {
          toast = createToast('error', 'Invalid QR scan', 'This QR code does not match an active ZeroClash booking.');
          return current;
        }
        if (!['confirmed', 'in-use'].includes(booking.status)) {
          toast = createToast('error', 'Check-in blocked', `Booking status is ${booking.status}.`);
          return current;
        }
        if (booking.checkedInAt) {
          toast = createToast('warning', 'Already checked in', `${booking.equipmentName} ${booking.unitId} was already checked in.`);
          return current;
        }
        const now = Date.now();
        const starts = new Date(booking.startAt).getTime();
        const ends = new Date(booking.endAt).getTime();
        if (now < starts - 15 * 60_000 || now > ends) {
          toast = createToast('error', 'Outside booking window', 'Check-in opens 15 minutes before the booking and closes at the scheduled end time.');
          return current;
        }
        const checkedInAt = new Date().toISOString();
        toast = createToast('success', 'Check-in complete', `${booking.equipmentName} ${booking.unitId} is now checked in.`);
        return {
          ...current,
          bookings: current.bookings.map((item) =>
            item.id === booking.id ? { ...item, status: 'checked-in' as BookingStatus, checkedInAt } : item,
          ),
          auditLog: [createAudit('override-decision', `${booking.equipmentName} ${booking.unitId}`, `QR check-in recorded by ${actor}.`, 'QR Demo'), ...current.auditLog],
        };
      });
      if (toast) pushToast(toast);
    },
    [pushToast],
  );

  const checkOutBooking = useCallback(
    async (payload: string, actor = 'Demo borrower') => {
      const parsed = parseQrToken(payload);
      if (!parsed) throw new Error('Invalid ZeroClash QR payload.');

      let toast: ToastMessage | null = null;
      setDataset((current) => {
        const booking = current.bookings.find((item) => item.id === parsed.bookingId);
        if (!booking || booking.equipmentId !== parsed.equipmentId || booking.startAt !== parsed.startAt || booking.qrToken !== payload.trim()) {
          toast = createToast('error', 'Invalid QR scan', 'This QR code does not match a ZeroClash booking.');
          return current;
        }
        if (!booking.checkedInAt) {
          toast = createToast('error', 'Check-out blocked', 'This booking has not been checked in yet.');
          return current;
        }
        if (booking.checkedOutAt || booking.status === 'checked-out') {
          toast = createToast('warning', 'Already checked out', `${booking.equipmentName} ${booking.unitId} was already returned.`);
          return current;
        }
        if (booking.status !== 'checked-in') {
          toast = createToast('error', 'Unauthorized check-out', 'Only a checked-in booking can be checked out in this demo.');
          return current;
        }
        const checkedOutAt = new Date().toISOString();
        toast = createToast('success', 'Check-out complete', `${booking.equipmentName} ${booking.unitId} has been returned.`);
        return {
          ...current,
          bookings: current.bookings.map((item) =>
            item.id === booking.id ? { ...item, status: 'checked-out' as BookingStatus, checkedOutAt } : item,
          ),
          auditLog: [createAudit('override-decision', `${booking.equipmentName} ${booking.unitId}`, `QR check-out recorded by ${actor}.`, 'QR Demo'), ...current.auditLog],
        };
      });
      if (toast) pushToast(toast);
    },
    [pushToast],
  );

  return useMemo(
    () => ({
      ...dataset,
      loading,
      error,
      toasts,
      refresh,
      createBooking,
      cancelBooking,
      joinWaitlist,
      acceptWaitlistOffer,
      declineWaitlistOffer,
      expireWaitlistOffer,
      cancelWaitlistEntry,
      applyAdminOverride,
      checkInBooking,
      checkOutBooking,
      dismissToast,
      offerWindowMs: OFFER_WINDOW_MS,
      priorityFormula,
    }),
    [
      acceptWaitlistOffer,
      applyAdminOverride,
      cancelBooking,
      cancelWaitlistEntry,
      checkInBooking,
      checkOutBooking,
      createBooking,
      dataset,
      declineWaitlistOffer,
      dismissToast,
      error,
      expireWaitlistOffer,
      joinWaitlist,
      loading,
      refresh,
      toasts,
    ],
  );
};
