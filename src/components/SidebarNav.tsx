import React, { useEffect, useMemo, useState } from 'react';
import {
  Boxes,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  LayoutDashboard,
  Map,
  Menu,
  QrCode,
  ShieldCheck,
  TimerReset,
  TrendingUp,
  X,
} from 'lucide-react';

interface NavItem {
  id: string;
  label: string;
  targetId: string;
  icon: React.ComponentType<{ className?: string }>;
}

const NAV_ITEMS: NavItem[] = [
  { id: 'dashboard', label: 'Dashboard', targetId: 'dashboard', icon: LayoutDashboard },
  { id: 'campus-map', label: '3D Campus Map', targetId: 'campus-map', icon: Map },
  { id: 'equipment', label: 'Equipment', targetId: 'equipment', icon: Boxes },
  { id: 'calendar', label: 'Gantt Booking Calendar', targetId: 'calendar', icon: CalendarDays },
  { id: 'my-bookings', label: 'My Bookings', targetId: 'my-bookings', icon: QrCode },
  { id: 'demand', label: 'Demand Forecasting', targetId: 'demand-intelligence', icon: TrendingUp },
  { id: 'waitlist', label: 'Waitlist Cascade', targetId: 'waitlist-cascade', icon: TimerReset },
  { id: 'admin', label: 'Admin Override', targetId: 'admin-override', icon: ShieldCheck },
];

interface SidebarNavProps {
  collapsed: boolean;
  onCollapsedChange: (collapsed: boolean) => void;
}

export const SidebarNav: React.FC<SidebarNavProps> = ({ collapsed, onCollapsedChange }) => {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [activeTarget, setActiveTarget] = useState('campus-map');

  const observedTargets = useMemo(() => NAV_ITEMS.map((item) => item.targetId), []);

  useEffect(() => {
    const elements = observedTargets
      .map((targetId) => document.getElementById(targetId))
      .filter((element): element is HTMLElement => Boolean(element));

    if (elements.length === 0) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((entry) => entry.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
        if (visible?.target.id) {
          setActiveTarget(visible.target.id);
        }
      },
      {
        rootMargin: '-22% 0px -56% 0px',
        threshold: [0.02, 0.12, 0.25, 0.45, 0.65],
      },
    );

    elements.forEach((element) => observer.observe(element));
    return () => observer.disconnect();
  }, [observedTargets]);

  const scrollToTarget = (targetId: string) => {
    const target = document.getElementById(targetId);
    if (!target) return;
    setActiveTarget(targetId);
    target.scrollIntoView({ behavior: 'smooth', block: 'start' });
    setMobileOpen(false);
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setMobileOpen(true)}
        className="fixed left-4 top-4 z-[95] rounded-lg border border-[var(--border)] bg-[var(--surface)] p-2 text-[var(--text)] shadow-glass backdrop-blur lg:hidden"
        title="Open navigation"
      >
        <Menu className="h-5 w-5" />
      </button>

      {mobileOpen && (
        <button
          type="button"
          className="fixed inset-0 z-[92] bg-black/45 backdrop-blur-sm lg:hidden"
          onClick={() => setMobileOpen(false)}
          aria-label="Close navigation overlay"
        />
      )}

      <aside
        className={`fixed inset-y-0 left-0 z-[96] flex flex-col border-r border-[var(--border)] bg-[var(--surface)] shadow-glass backdrop-blur-xl transition-all duration-300 ${
          collapsed ? 'lg:w-20' : 'lg:w-72'
        } ${mobileOpen ? 'w-72 translate-x-0' : 'w-72 -translate-x-full lg:translate-x-0'}`}
      >
        <div className="flex h-20 items-center justify-between border-b border-[var(--border)] px-4">
          <div className={`min-w-0 transition-opacity ${collapsed ? 'lg:opacity-0' : 'opacity-100'}`}>
            <div className="text-xs font-mono uppercase tracking-[0.24em] text-cyan-500">ZeroClash</div>
            <div className="mt-1 truncate text-sm font-semibold text-[var(--text)]">ZeroClash</div>
          </div>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => onCollapsedChange(!collapsed)}
              className="hidden rounded-md p-2 text-[var(--muted)] hover:bg-[var(--surface-muted)] hover:text-[var(--text)] lg:inline-flex"
              title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            >
              {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
            </button>
            <button
              type="button"
              onClick={() => setMobileOpen(false)}
              className="rounded-md p-2 text-[var(--muted)] hover:bg-[var(--surface-muted)] hover:text-[var(--text)] lg:hidden"
              title="Close navigation"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-4">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const isActive = activeTarget === item.targetId || (item.targetId === 'dashboard' && activeTarget === 'analytics');
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => scrollToTarget(item.targetId)}
                className={`group flex w-full items-center gap-3 rounded-lg border px-3 py-3 text-left text-sm transition ${
                  isActive
                    ? 'border-cyan-400/45 bg-cyan-400/12 text-[var(--text)] shadow-[inset_0_0_18px_rgba(34,211,238,0.08)]'
                    : 'border-transparent text-[var(--muted)] hover:border-cyan-500/20 hover:bg-[var(--surface-muted)] hover:text-[var(--text)]'
                }`}
                title={collapsed ? item.label : undefined}
              >
                <Icon className={`h-5 w-5 shrink-0 ${isActive ? 'text-cyan-400' : 'text-[var(--muted)] group-hover:text-cyan-400'}`} />
                <span className={`truncate transition-opacity ${collapsed ? 'lg:pointer-events-none lg:opacity-0' : 'opacity-100'}`}>
                  {item.label}
                </span>
              </button>
            );
          })}
        </nav>

        <div className="border-t border-[var(--border)] p-3">
          <div className={`rounded-lg border border-[var(--border)] bg-[var(--surface-muted)] p-3 ${collapsed ? 'lg:px-2' : ''}`}>
            <div className="text-[11px] font-mono uppercase tracking-widest text-[var(--muted)]">Mode</div>
            <div className={`mt-1 text-xs text-[var(--text)] ${collapsed ? 'lg:hidden' : ''}`}>Frontend demo</div>
            <div className={`mt-2 h-1.5 rounded-full bg-[var(--border)] ${collapsed ? 'lg:hidden' : ''}`}>
              <div className="h-full w-2/3 rounded-full bg-cyan-400" />
            </div>
          </div>
        </div>
      </aside>
    </>
  );
};
