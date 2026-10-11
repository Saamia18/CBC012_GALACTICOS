import { MOCK_BUILDINGS } from '../data/mock';
import { BookingRecord } from '../types/scheduling';

export type HeatmapRange = 'today' | 'week' | 'month';

export interface BuildingUsageStats {
  count: number;
  hours: number;
  intensity: number;
}

export const heatmapWindow = (range: HeatmapRange) => {
  const end = new Date();
  const start = new Date(end);
  if (range === 'today') {
    start.setHours(0, 0, 0, 0);
  } else if (range === 'week') {
    start.setDate(start.getDate() - 6);
    start.setHours(0, 0, 0, 0);
  } else {
    start.setDate(start.getDate() - 29);
    start.setHours(0, 0, 0, 0);
  }
  return { start, end };
};

export const overlapHours = (booking: BookingRecord, start: Date, end: Date) => {
  const overlapStart = Math.max(new Date(booking.startAt).getTime(), start.getTime());
  const overlapEnd = Math.min(new Date(booking.endAt).getTime(), end.getTime());
  return Math.max(0, (overlapEnd - overlapStart) / 3_600_000);
};

export const heatColorFor = (intensity: number) => {
  if (intensity >= 0.78) return '#ef4444';
  if (intensity >= 0.52) return '#f97316';
  if (intensity >= 0.28) return '#eab308';
  if (intensity > 0) return '#22c55e';
  return '#0ea5e9';
};

export const buildCampusUsageHeatmap = (bookings: BookingRecord[], range: HeatmapRange) => {
  const windowRange = heatmapWindow(range);
  const stats = Object.fromEntries(
    MOCK_BUILDINGS.map((building) => [building.id, { count: 0, hours: 0, intensity: 0 }]),
  ) as Record<string, BuildingUsageStats>;

  bookings
    .filter((booking) => !['cancelled', 'maintenance'].includes(booking.status))
    .forEach((booking) => {
      const hours = overlapHours(booking, windowRange.start, windowRange.end);
      if (hours <= 0) return;
      const current = stats[booking.buildingId] ?? { count: 0, hours: 0, intensity: 0 };
      current.count += 1;
      current.hours += hours;
      stats[booking.buildingId] = current;
    });

  const max = Math.max(1, ...Object.values(stats).map((item) => item.count + item.hours * 0.35));
  Object.values(stats).forEach((item) => {
    item.intensity = Math.min(1, (item.count + item.hours * 0.35) / max);
  });

  return {
    byBuilding: stats,
    max,
    totalBookings: Object.values(stats).reduce((sum, item) => sum + item.count, 0),
    totalHours: Object.values(stats).reduce((sum, item) => sum + item.hours, 0),
    hottest: MOCK_BUILDINGS.map((building) => ({ building, usage: stats[building.id] }))
      .sort((a, b) => b.usage.intensity - a.usage.intensity)[0],
  };
};
