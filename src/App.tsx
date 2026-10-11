import React, { useEffect, useMemo, useState } from 'react';
import { CampusCanvas } from './scene/CampusCanvas';
import { SciFiHeader } from './components/SciFiHeader';
import { EquipmentModal } from './components/EquipmentModal';
import { BuildingContextCard } from './components/BuildingContextCard';
import { StatusLegend } from './components/StatusLegend';
import { ViewportControls } from './components/ViewportControls';
import { ScrollIndicator } from './components/ScrollIndicator';
import { AnalyticsPlaceholder } from './components/AnalyticsPlaceholder';
import { SidebarNav } from './components/SidebarNav';
import { useSchedulingData } from './lib/schedulingData';
import { buildCampusUsageHeatmap, HeatmapRange } from './utils/usageHeatmap';
import { AppTheme, ThemeToggle } from './components/ThemeToggle';

import { ErrorBoundary } from './components/ErrorBoundary';

export const App: React.FC = () => {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [heatmapEnabled, setHeatmapEnabled] = useState(false);
  const [theme, setTheme] = useState<AppTheme>(() => (localStorage.getItem('zeroclash-theme') as AppTheme | null) ?? 'dark');
  const heatmapRange: HeatmapRange = 'week';
  const scheduling = useSchedulingData();

  useEffect(() => {
    localStorage.setItem('zeroclash-theme', theme);
    document.documentElement.dataset.theme = theme;
    document.documentElement.classList.toggle('theme-light', theme === 'light');
    document.documentElement.classList.toggle('theme-dark', theme === 'dark');
  }, [theme]);

  const heatmapStats = useMemo(() => {
    return buildCampusUsageHeatmap(scheduling.bookings, heatmapRange);
  }, [heatmapRange, scheduling.bookings]);

  return (
    <div className={`min-h-screen font-sans select-none ${theme === 'light' ? 'theme-light' : 'theme-dark'}`}>
      <SidebarNav collapsed={sidebarCollapsed} onCollapsedChange={setSidebarCollapsed} />
      <main className={`min-h-screen transition-[padding] duration-300 ${sidebarCollapsed ? 'lg:pl-20' : 'lg:pl-72'}`}>
        {/* 100vh Hero Section */}
        <section id="campus-map" className="relative w-full h-screen overflow-hidden scroll-mt-4 bg-[var(--app-bg)]">
          {/* 3D Isometric Digital Twin Canvas */}
          <div className="absolute inset-0 z-0">
            <ErrorBoundary>
              <CampusCanvas heatmapEnabled={heatmapEnabled} buildingUsage={heatmapStats.byBuilding} usageMax={heatmapStats.max} />
            </ErrorBoundary>
          </div>

          {/* Top Center UI Overlay: Sci-fi Bracket Frame Title + Glowing Search Bar */}
          <header className="absolute top-5 inset-x-0 z-30 flex items-start justify-center pointer-events-none px-4">
            <SciFiHeader />
            <div className="pointer-events-auto absolute right-4 top-0 md:right-6">
              <ThemeToggle theme={theme} onToggle={() => setTheme((current) => (current === 'dark' ? 'light' : 'dark'))} />
            </div>
          </header>

          <div className="absolute left-4 top-24 z-40 md:left-6">
            <button
              type="button"
              onClick={() => setHeatmapEnabled((enabled) => !enabled)}
              className={`inline-flex items-center gap-2 rounded-full border px-4 py-2.5 text-sm font-semibold shadow-glass backdrop-blur-xl transition ${
                heatmapEnabled
                  ? 'border-orange-300 bg-orange-400 text-slate-950 shadow-[0_0_24px_rgba(251,146,60,0.45)]'
                  : 'border-orange-400/40 bg-slate-950/82 text-orange-100 hover:border-orange-300 hover:bg-orange-400 hover:text-slate-950'
              }`}
              aria-pressed={heatmapEnabled}
            >
              <span aria-hidden="true">🔥</span>
              Usage Heatmap
            </button>
          </div>

          {/* Modal Overlay: Glassmorphic anchored inspection card */}
          <EquipmentModal />
          <BuildingContextCard />

          {/* Bottom Left UI Overlay: Equipment Status Legend */}
          <div className="absolute bottom-6 left-6 z-20 pointer-events-none">
            <StatusLegend />
          </div>

          {/* Bottom Center UI Overlay: Scroll Down to Analytics Indicator */}
          <div className="absolute bottom-6 inset-x-0 z-20 flex justify-center pointer-events-none">
            <ScrollIndicator />
          </div>

          {/* Bottom Right UI Overlay: Zoom controls, layers toggle, sci-fi sparkle */}
          <div className="absolute bottom-6 right-6 z-20 pointer-events-none">
            <ViewportControls />
          </div>
        </section>

        {/* Below the Fold Section */}
        <AnalyticsPlaceholder scheduling={scheduling} />
      </main>
    </div>
  );
};

export default App;
