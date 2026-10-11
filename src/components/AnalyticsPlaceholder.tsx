import React from 'react';
import { Database, RefreshCw, X } from 'lucide-react';
import { AdminOverrideDashboard } from './AdminOverrideDashboard';
import { DemandIntelligenceDashboard } from './DemandIntelligenceDashboard';
import { EquipmentCatalog } from './EquipmentCatalog';
import { GanttBookingCalendar } from './GanttBookingCalendar';
import { MyBookingsQRCode } from './MyBookingsQRCode';
import { WaitlistCascadeDashboard } from './WaitlistCascadeDashboard';
import { useSchedulingData } from '../lib/schedulingData';

interface AnalyticsPlaceholderProps {
  scheduling: ReturnType<typeof useSchedulingData>;
}

export const AnalyticsPlaceholder: React.FC<AnalyticsPlaceholderProps> = ({ scheduling }) => {
  return (
    <section
      id="dashboard"
      className="min-h-screen scroll-mt-4 border-t border-[var(--border)] bg-[var(--page-bg)] px-4 py-12 text-[var(--text)] md:px-8"
    >
      <span id="analytics" className="block h-0 w-0 overflow-hidden" aria-hidden="true" />
      <div className="mx-auto max-w-[1500px]">
        <div className="mb-8 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <span className="section-kicker">
              Tier B · Scheduling Intelligence
            </span>
            <h2 className="section-title mt-2">
              Booking calendar and demand planning
            </h2>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="compact-stat">
              <Database className="h-4 w-4 text-cyan-300" />
              {scheduling.sourceLabel}
            </span>
            <button
              type="button"
              onClick={() => void scheduling.refresh()}
              className="primary-button"
            >
              <RefreshCw className={`h-4 w-4 ${scheduling.loading ? 'animate-spin' : ''}`} />
              Refresh
            </button>
          </div>
        </div>

        <ToastStack toasts={scheduling.toasts} onDismiss={scheduling.dismissToast} />

        <div className="space-y-8">
          <EquipmentCatalog resources={scheduling.resources} />
          <GanttBookingCalendar
            resources={scheduling.resources}
            bookings={scheduling.bookings}
            sourceLabel={scheduling.sourceLabel}
            loading={scheduling.loading}
            error={scheduling.error}
            onCreateBooking={scheduling.createBooking}
            onCancelBooking={scheduling.cancelBooking}
          />
          <MyBookingsQRCode
            bookings={scheduling.bookings}
            onCheckIn={scheduling.checkInBooking}
            onCheckOut={scheduling.checkOutBooking}
          />
          <WaitlistCascadeDashboard
            resources={scheduling.resources}
            entries={scheduling.waitlistEntries}
            priorityFormula={scheduling.priorityFormula}
            onJoinWaitlist={scheduling.joinWaitlist}
            onAcceptOffer={scheduling.acceptWaitlistOffer}
            onDeclineOffer={scheduling.declineWaitlistOffer}
            onExpireOffer={scheduling.expireWaitlistOffer}
            onCancelEntry={scheduling.cancelWaitlistEntry}
          />
          <AdminOverrideDashboard
            resources={scheduling.resources}
            bookings={scheduling.bookings}
            auditLog={scheduling.auditLog}
            onApplyOverride={scheduling.applyAdminOverride}
          />
          <DemandIntelligenceDashboard
            resources={scheduling.resources}
            bookings={scheduling.bookings}
            waitlistPressure={scheduling.waitlistPressure}
            sourceLabel={scheduling.sourceLabel}
          />
        </div>
      </div>
    </section>
  );
};

const ToastStack: React.FC<{
  toasts: Array<{ id: string; tone: 'success' | 'warning' | 'info' | 'error'; title: string; message: string }>;
  onDismiss: (toastId: string) => void;
}> = ({ toasts, onDismiss }) => {
  if (toasts.length === 0) return null;

  const toneClass = {
    success: 'border-emerald-400/30 bg-emerald-950/80 text-emerald-100',
    warning: 'border-amber-400/30 bg-amber-950/80 text-amber-100',
    info: 'border-cyan-400/30 bg-cyan-950/80 text-cyan-100',
    error: 'border-rose-400/30 bg-rose-950/80 text-rose-100',
  };

  return (
    <div className="fixed bottom-5 right-5 z-[90] w-[min(420px,calc(100vw-40px))] space-y-2">
      {toasts.map((toast) => (
        <div key={toast.id} className={`rounded-lg border p-3 shadow-glass backdrop-blur ${toneClass[toast.tone]}`}>
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="text-sm font-semibold text-white">{toast.title}</div>
              <div className="mt-1 text-xs leading-5 opacity-90">{toast.message}</div>
            </div>
            <button type="button" onClick={() => onDismiss(toast.id)} className="rounded-md p-1 text-white/70 hover:bg-white/10 hover:text-white" title="Dismiss">
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      ))}
    </div>
  );
};
