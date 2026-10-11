import { BookingRecord, ResourceUnit, SchedulingDataset, WaitlistEntry, AdminAuditEntry } from '../types/scheduling';
import { supabase, hasSupabaseCredentials } from './supabaseClient';

type EquipmentRow = {
  id: string;
  name: string;
  unit_id: string;
  category: ResourceUnit['category'];
  building_id: string;
  building_name: string;
  status: ResourceUnit['status'];
};

type BookingRow = {
  id: string;
  equipment_id: string;
  equipment_name: string;
  unit_id: string;
  category: BookingRecord['category'];
  building_id: string;
  building_name: string;
  requester_name: string;
  requester_role: string;
  purpose: string;
  start_at: string;
  end_at: string;
  status: BookingRecord['status'];
  source: BookingRecord['source'];
  qr_token: string;
  checked_in_at: string | null;
  checked_out_at: string | null;
};

type WaitlistRow = {
  id: string;
  equipment_id: string;
  equipment_name: string;
  unit_id: string;
  building_name: string;
  requested_start_at: string;
  requested_end_at: string;
  user_name: string;
  user_role: WaitlistEntry['userRole'];
  urgency: number;
  no_show_penalty: number;
  priority_score: number;
  status: WaitlistEntry['status'];
  created_at: string;
  offer_expires_at: string | null;
  offered_start_at: string | null;
  offered_end_at: string | null;
  notes: string | null;
};

type AuditRow = {
  id: string;
  action: AdminAuditEntry['action'];
  target: string;
  reason: string;
  actor: string;
  created_at: string;
};

const toEquipmentRow = (resource: ResourceUnit): EquipmentRow => ({
  id: resource.id,
  name: resource.name,
  unit_id: resource.unitId,
  category: resource.category,
  building_id: resource.buildingId,
  building_name: resource.buildingName,
  status: resource.status,
});

const toResource = (row: EquipmentRow): ResourceUnit => ({
  id: row.id,
  name: row.name,
  unitId: row.unit_id,
  category: row.category,
  buildingId: row.building_id,
  buildingName: row.building_name,
  status: row.status,
});

const toBookingRow = (booking: BookingRecord): BookingRow => ({
  id: booking.id,
  equipment_id: booking.equipmentId,
  equipment_name: booking.equipmentName,
  unit_id: booking.unitId,
  category: booking.category,
  building_id: booking.buildingId,
  building_name: booking.buildingName,
  requester_name: booking.requesterName,
  requester_role: booking.requesterRole,
  purpose: booking.purpose,
  start_at: booking.startAt,
  end_at: booking.endAt,
  status: booking.status,
  source: booking.source === 'demo' ? 'supabase' : booking.source,
  qr_token: booking.qrToken,
  checked_in_at: booking.checkedInAt ?? null,
  checked_out_at: booking.checkedOutAt ?? null,
});

const toBooking = (row: BookingRow): BookingRecord => ({
  id: row.id,
  equipmentId: row.equipment_id,
  equipmentName: row.equipment_name,
  unitId: row.unit_id,
  category: row.category,
  buildingId: row.building_id,
  buildingName: row.building_name,
  requesterName: row.requester_name,
  requesterRole: row.requester_role,
  purpose: row.purpose,
  startAt: row.start_at,
  endAt: row.end_at,
  status: row.status,
  source: row.source,
  qrToken: row.qr_token,
  checkedInAt: row.checked_in_at ?? undefined,
  checkedOutAt: row.checked_out_at ?? undefined,
});

const toWaitlistRow = (entry: WaitlistEntry): WaitlistRow => ({
  id: entry.id,
  equipment_id: entry.equipmentId,
  equipment_name: entry.equipmentName,
  unit_id: entry.unitId,
  building_name: entry.buildingName,
  requested_start_at: entry.requestedStartAt,
  requested_end_at: entry.requestedEndAt,
  user_name: entry.userName,
  user_role: entry.userRole,
  urgency: entry.urgency,
  no_show_penalty: entry.noShowPenalty,
  priority_score: entry.priorityScore,
  status: entry.status,
  created_at: entry.createdAt,
  offer_expires_at: entry.offerExpiresAt ?? null,
  offered_start_at: entry.offeredStartAt ?? null,
  offered_end_at: entry.offeredEndAt ?? null,
  notes: entry.notes ?? null,
});

const toWaitlistEntry = (row: WaitlistRow): WaitlistEntry => ({
  id: row.id,
  equipmentId: row.equipment_id,
  equipmentName: row.equipment_name,
  unitId: row.unit_id,
  buildingName: row.building_name,
  requestedStartAt: row.requested_start_at,
  requestedEndAt: row.requested_end_at,
  userName: row.user_name,
  userRole: row.user_role,
  urgency: row.urgency,
  noShowPenalty: row.no_show_penalty,
  priorityScore: row.priority_score,
  status: row.status,
  createdAt: row.created_at,
  offerExpiresAt: row.offer_expires_at ?? undefined,
  offeredStartAt: row.offered_start_at ?? undefined,
  offeredEndAt: row.offered_end_at ?? undefined,
  notes: row.notes ?? undefined,
});

const toAuditRow = (entry: AdminAuditEntry): AuditRow => ({
  id: entry.id,
  action: entry.action,
  target: entry.target,
  reason: entry.reason,
  actor: entry.actor,
  created_at: entry.timestamp,
});

const toAuditEntry = (row: AuditRow): AdminAuditEntry => ({
  id: row.id,
  action: row.action,
  target: row.target,
  reason: row.reason,
  actor: row.actor,
  timestamp: row.created_at,
});

const waitlistPressure = (entries: WaitlistEntry[]) =>
  entries.reduce<Record<string, number>>((acc, entry) => {
    if (entry.status === 'waiting' || entry.status === 'offered') acc[entry.equipmentId] = (acc[entry.equipmentId] ?? 0) + 1;
    return acc;
  }, {});

export const isSupabaseEnabled = () => hasSupabaseCredentials && Boolean(supabase);

export const loadSupabaseSchedulingDataset = async (fallbackResources: ResourceUnit[]): Promise<SchedulingDataset | null> => {
  if (!supabase) return null;

  const { data: existingEquipment, error: equipmentError } = await supabase
    .from('zero_clash_equipment')
    .select('*')
    .order('name', { ascending: true });
  if (equipmentError) throw equipmentError;

  let equipmentRows = (existingEquipment ?? []) as EquipmentRow[];
  if (equipmentRows.length === 0) {
    const { data: seeded, error: seedError } = await supabase
      .from('zero_clash_equipment')
      .upsert(fallbackResources.map(toEquipmentRow), { onConflict: 'id' })
      .select('*')
      .order('name', { ascending: true });
    if (seedError) throw seedError;
    equipmentRows = (seeded ?? []) as EquipmentRow[];
  }

  const [bookingResult, waitlistResult, auditResult] = await Promise.all([
    supabase.from('zero_clash_bookings').select('*').order('start_at', { ascending: true }),
    supabase.from('zero_clash_waitlist_entries').select('*').order('created_at', { ascending: false }),
    supabase.from('zero_clash_audit_log').select('*').order('created_at', { ascending: false }).limit(80),
  ]);

  if (bookingResult.error) throw bookingResult.error;
  if (waitlistResult.error) throw waitlistResult.error;
  if (auditResult.error) throw auditResult.error;

  const waitlistEntries = ((waitlistResult.data ?? []) as WaitlistRow[]).map(toWaitlistEntry);

  return {
    resources: equipmentRows.map(toResource),
    bookings: ((bookingResult.data ?? []) as BookingRow[]).map(toBooking),
    waitlistEntries,
    waitlistPressure: waitlistPressure(waitlistEntries),
    auditLog: ((auditResult.data ?? []) as AuditRow[]).map(toAuditEntry),
    source: 'supabase',
    sourceLabel: 'Campus equipment scheduling',
  };
};

export const persistEquipmentRows = async (resources: ResourceUnit[]) => {
  if (!supabase) return;
  const { error } = await supabase.from('zero_clash_equipment').upsert(resources.map(toEquipmentRow), { onConflict: 'id' });
  if (error) throw error;
};

export const persistBookingRow = async (booking: BookingRecord) => {
  if (!supabase) return;
  const { error } = await supabase.from('zero_clash_bookings').upsert(toBookingRow(booking), { onConflict: 'id' });
  if (error) throw error;
};

export const persistWaitlistRow = async (entry: WaitlistEntry) => {
  if (!supabase) return;
  const { error } = await supabase.from('zero_clash_waitlist_entries').upsert(toWaitlistRow(entry), { onConflict: 'id' });
  if (error) throw error;
};

export const persistAuditRows = async (entries: AdminAuditEntry[]) => {
  if (!supabase || entries.length === 0) return;
  const { error } = await supabase.from('zero_clash_audit_log').upsert(entries.map(toAuditRow), { onConflict: 'id' });
  if (error) throw error;
};
