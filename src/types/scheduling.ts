export type EquipmentCategory =
  | 'DSLR Camera'
  | 'GPU Cluster'
  | 'VR Headset'
  | 'Microscope'
  | '3D Printer'
  | 'Projector'
  | 'Lab Kit'
  | 'Testing Device';

export type BookingStatus = 'confirmed' | 'pending' | 'in-use' | 'checked-in' | 'checked-out' | 'cancelled' | 'maintenance';

export type CalendarView = 'day' | 'week' | 'month';

export type CampusRole = 'Student' | 'Faculty' | 'Researcher' | 'Lab Admin' | 'Club Lead';

export type WaitlistStatus = 'waiting' | 'offered' | 'accepted' | 'declined' | 'expired' | 'cancelled' | 'booked';

export type AdminActionType =
  | 'approve-request'
  | 'reject-request'
  | 'resolve-conflict'
  | 'maintenance-block'
  | 'maintenance-clear'
  | 'override-decision'
  | 'booking-cancelled'
  | 'waitlist-offer'
  | 'waitlist-accepted'
  | 'waitlist-declined'
  | 'waitlist-expired';

export interface ResourceUnit {
  id: string;
  name: string;
  unitId: string;
  category: EquipmentCategory;
  buildingId: string;
  buildingName: string;
  status: 'available' | 'booked' | 'maintenance';
}

export interface BookingRecord {
  id: string;
  equipmentId: string;
  equipmentName: string;
  unitId: string;
  category: EquipmentCategory;
  buildingId: string;
  buildingName: string;
  requesterName: string;
  requesterRole: string;
  purpose: string;
  startAt: string;
  endAt: string;
  status: BookingStatus;
  source: 'supabase' | 'demo' | 'local';
  qrToken: string;
  checkedInAt?: string;
  checkedOutAt?: string;
}

export interface BookingDraft {
  equipmentId: string;
  startAt: string;
  endAt: string;
  requesterName: string;
  purpose: string;
  status: BookingStatus;
}

export interface WaitlistEntry {
  id: string;
  equipmentId: string;
  equipmentName: string;
  unitId: string;
  buildingName: string;
  requestedStartAt: string;
  requestedEndAt: string;
  userName: string;
  userRole: CampusRole;
  urgency: number;
  noShowPenalty: number;
  priorityScore: number;
  status: WaitlistStatus;
  createdAt: string;
  offerExpiresAt?: string;
  offeredStartAt?: string;
  offeredEndAt?: string;
  notes?: string;
}

export interface WaitlistDraft {
  equipmentId: string;
  requestedStartAt: string;
  requestedEndAt: string;
  userName: string;
  userRole: CampusRole;
  urgency: number;
  noShowPenalty: number;
  notes?: string;
}

export interface AdminAuditEntry {
  id: string;
  action: AdminActionType;
  target: string;
  reason: string;
  actor: string;
  timestamp: string;
}

export interface AdminOverrideDraft {
  action: AdminActionType;
  targetId: string;
  reason: string;
  actor: string;
  equipmentId?: string;
  startAt?: string;
  endAt?: string;
}

export interface ToastMessage {
  id: string;
  tone: 'success' | 'warning' | 'info' | 'error';
  title: string;
  message: string;
}

export interface SchedulingDataset {
  resources: ResourceUnit[];
  bookings: BookingRecord[];
  waitlistEntries: WaitlistEntry[];
  waitlistPressure: Record<string, number>;
  auditLog: AdminAuditEntry[];
  source: 'demo';
  sourceLabel: string;
}

export interface DateRangeFilter {
  start: Date;
  end: Date;
}
