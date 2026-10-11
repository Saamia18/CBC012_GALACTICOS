import { BookingRecord, BookingStatus, DateRangeFilter, EquipmentCategory, ResourceUnit } from '../types/scheduling';

export interface DemandFilters {
  dateRange: DateRangeFilter;
  building: string;
  category: EquipmentCategory | 'all';
}

export interface ForecastPoint {
  label: string;
  historical: number | null;
  forecast: number;
}

export interface RankedDemand {
  id: string;
  label: string;
  count: number;
  utilization: number;
}

export interface HeatCell {
  day: number;
  hour: number;
  value: number;
}

export interface SupplyDemandPoint {
  category: EquipmentCategory;
  supply: number;
  demand: number;
  shortage: number;
}

export interface Recommendation {
  title: string;
  reason: string;
  target: string;
  tone: 'success' | 'warning' | 'info';
}

const ACTIVE_STATUSES: BookingStatus[] = ['confirmed', 'pending', 'in-use', 'checked-in', 'checked-out', 'maintenance'];

const overlapsRange = (booking: BookingRecord, start: Date, end: Date) =>
  new Date(booking.startAt) < end && new Date(booking.endAt) > start;

export const applyDemandFilters = (bookings: BookingRecord[], filters: DemandFilters) =>
  bookings.filter((booking) => {
    if (!ACTIVE_STATUSES.includes(booking.status)) return false;
    if (!overlapsRange(booking, filters.dateRange.start, filters.dateRange.end)) return false;
    if (filters.building !== 'all' && booking.buildingId !== filters.building) return false;
    if (filters.category !== 'all' && booking.category !== filters.category) return false;
    return true;
  });

export const dateRangeFromPreset = (days: number) => {
  const end = new Date();
  end.setHours(23, 59, 59, 999);
  const start = new Date(end);
  start.setDate(start.getDate() - days + 1);
  start.setHours(0, 0, 0, 0);
  return { start, end };
};

const daysBetween = (start: Date, end: Date) => Math.max(1, Math.ceil((end.getTime() - start.getTime()) / 86_400_000));

export const buildForecastSeries = (bookings: BookingRecord[], horizonDays: number): ForecastPoint[] => {
  const now = new Date();
  const historyStart = new Date(now);
  historyStart.setDate(historyStart.getDate() - 13);
  historyStart.setHours(0, 0, 0, 0);

  const dailyCounts = Array.from({ length: 14 }, (_, index) => {
    const day = new Date(historyStart);
    day.setDate(day.getDate() + index);
    const next = new Date(day);
    next.setDate(next.getDate() + 1);
    return bookings.filter((booking) => ACTIVE_STATUSES.includes(booking.status) && overlapsRange(booking, day, next)).length;
  });

  const recentAverage = dailyCounts.slice(-7).reduce((sum, count) => sum + count, 0) / 7;
  const priorAverage = dailyCounts.slice(0, 7).reduce((sum, count) => sum + count, 0) / 7;
  const trend = Math.max(-1.5, Math.min(1.5, recentAverage - priorAverage));
  const byWeekday = Array.from({ length: 7 }, (_, weekday) => {
    const matchingDays = dailyCounts.filter((_, index) => {
      const day = new Date(historyStart);
      day.setDate(day.getDate() + index);
      return day.getDay() === weekday;
    });
    return matchingDays.length ? matchingDays.reduce((sum, count) => sum + count, 0) / matchingDays.length : recentAverage;
  });

  const historical = dailyCounts.map((count, index) => {
    const date = new Date(historyStart);
    date.setDate(date.getDate() + index);
    return {
      label: date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }),
      historical: count,
      forecast: Math.round(Math.max(0, count)),
    };
  });

  const forecast = Array.from({ length: horizonDays }, (_, index) => {
    const date = new Date(now);
    date.setDate(date.getDate() + index + 1);
    const seasonal = byWeekday[date.getDay()] ?? recentAverage;
    return {
      label: date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }),
      historical: null,
      forecast: Math.round(Math.max(0, seasonal + trend * ((index + 1) / Math.max(7, horizonDays)))),
    };
  });

  return [...historical, ...forecast];
};

export const rankCategories = (bookings: BookingRecord[], resources: ResourceUnit[]): RankedDemand[] => {
  const supply = resources.reduce<Record<string, number>>((acc, resource) => {
    acc[resource.category] = (acc[resource.category] ?? 0) + 1;
    return acc;
  }, {});
  const counts = bookings.reduce<Record<string, number>>((acc, booking) => {
    acc[booking.category] = (acc[booking.category] ?? 0) + 1;
    return acc;
  }, {});
  return Object.entries(supply)
    .map(([category, supplyCount]) => ({
      id: category,
      label: category,
      count: counts[category] ?? 0,
      utilization: supplyCount ? (counts[category] ?? 0) / supplyCount : 0,
    }))
    .sort((a, b) => b.count - a.count);
};

export const rankUnits = (bookings: BookingRecord[], resources: ResourceUnit[]): RankedDemand[] => {
  const counts = bookings.reduce<Record<string, number>>((acc, booking) => {
    acc[booking.equipmentId] = (acc[booking.equipmentId] ?? 0) + 1;
    return acc;
  }, {});
  return resources
    .map((resource) => ({
      id: resource.id,
      label: `${resource.name} ${resource.unitId}`,
      count: counts[resource.id] ?? 0,
      utilization: counts[resource.id] ?? 0,
    }))
    .sort((a, b) => b.count - a.count);
};

export const buildHeatmap = (bookings: BookingRecord[]): HeatCell[] => {
  const cells: HeatCell[] = [];
  for (let day = 0; day < 7; day += 1) {
    for (let hour = 8; hour <= 20; hour += 1) {
      cells.push({ day, hour, value: 0 });
    }
  }

  bookings.forEach((booking) => {
    const start = new Date(booking.startAt);
    const end = new Date(booking.endAt);
    for (let cursor = new Date(start); cursor < end; cursor.setHours(cursor.getHours() + 1)) {
      const hour = cursor.getHours();
      const cell = cells.find((item) => item.day === cursor.getDay() && item.hour === hour);
      if (cell) cell.value += 1;
    }
  });

  return cells;
};

export const buildingDemand = (bookings: BookingRecord[]) => {
  const counts = bookings.reduce<Record<string, { label: string; count: number }>>((acc, booking) => {
    acc[booking.buildingId] = acc[booking.buildingId] ?? { label: booking.buildingName, count: 0 };
    acc[booking.buildingId].count += 1;
    return acc;
  }, {});
  return Object.values(counts).sort((a, b) => b.count - a.count);
};

export const supplyDemand = (bookings: BookingRecord[], resources: ResourceUnit[], horizonDays: number): SupplyDemandPoint[] => {
  const filteredResourceCategories = resources.reduce<Record<string, number>>((acc, resource) => {
    acc[resource.category] = (acc[resource.category] ?? 0) + 1;
    return acc;
  }, {});
  const durationDays = daysBetween(
    bookings.length ? new Date(Math.min(...bookings.map((booking) => new Date(booking.startAt).getTime()))) : new Date(),
    bookings.length ? new Date(Math.max(...bookings.map((booking) => new Date(booking.endAt).getTime()))) : new Date(),
  );
  const demand = bookings.reduce<Record<string, number>>((acc, booking) => {
    acc[booking.category] = (acc[booking.category] ?? 0) + 1;
    return acc;
  }, {});

  return Object.entries(filteredResourceCategories)
    .map(([category, supplyCount]) => {
      const projectedDemand = Math.round(((demand[category] ?? 0) / durationDays) * horizonDays);
      const weeklyCapacity = Math.max(1, supplyCount * Math.ceil(horizonDays / 7) * 5);
      return {
        category: category as EquipmentCategory,
        supply: weeklyCapacity,
        demand: projectedDemand,
        shortage: Math.max(0, projectedDemand - weeklyCapacity),
      };
    })
    .sort((a, b) => b.demand - a.demand);
};

export const buildRecommendations = (
  categoryRanks: RankedDemand[],
  unitRanks: RankedDemand[],
  heatmap: HeatCell[],
  supplyPoints: SupplyDemandPoint[],
  waitlistPressure: Record<string, number>,
): Recommendation[] => {
  const topCategory = categoryRanks[0];
  const topUnit = unitRanks[0];
  const peak = [...heatmap].sort((a, b) => b.value - a.value)[0];
  const shortage = supplyPoints.find((point) => point.shortage > 0);
  const waitlistedUnit = Object.entries(waitlistPressure).sort((a, b) => b[1] - a[1])[0];
  const quieter = [...heatmap].filter((cell) => cell.hour >= 8 && cell.hour <= 18).sort((a, b) => a.value - b.value)[0];
  const weekday = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  return [
    topCategory
      ? {
          title: `${topCategory.label} demand is leading the forecast`,
          reason: `${topCategory.count} active or recent requests put this category at the top of the filtered window.`,
          target: topCategory.id,
          tone: 'info',
        }
      : null,
    topUnit
      ? {
          title: `${topUnit.label} needs close monitoring`,
          reason: `${topUnit.count} requests make it the most contested individual unit in the current filter.`,
          target: topUnit.id,
          tone: 'warning',
        }
      : null,
    peak
      ? {
          title: `Peak pressure clusters around ${weekday[peak.day]} ${peak.hour}:00`,
          reason: `${peak.value} overlapping usage signals this as a likely rush period.`,
          target: 'calendar',
          tone: 'warning',
        }
      : null,
    quieter
      ? {
          title: `Quieter booking window: ${weekday[quieter.day]} ${quieter.hour}:00`,
          reason: `Only ${quieter.value} filtered bookings touch this hour, so it is a better suggested alternative.`,
          target: 'calendar',
          tone: 'success',
        }
      : null,
    shortage
      ? {
          title: `${shortage.category} may exceed available supply`,
          reason: `Projected demand is ${shortage.demand} against an estimated practical supply of ${shortage.supply}.`,
          target: shortage.category,
          tone: 'warning',
        }
      : null,
    waitlistedUnit
      ? {
          title: `Waitlist pressure is visible on ${waitlistedUnit[0]}`,
          reason: `${waitlistedUnit[1]} pending requests indicate unmet demand for that physical unit.`,
          target: waitlistedUnit[0],
          tone: 'info',
        }
      : null,
  ].filter((item): item is Recommendation => Boolean(item)).slice(0, 5);
};
