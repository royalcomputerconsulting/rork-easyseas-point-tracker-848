import { BookedCruise, Cruise } from '@/types/models';

export type CabinCategory = 'Interior' | 'Oceanview' | 'Balcony' | 'Junior Suite' | 'Suite' | 'Solo' | string;

export interface LoyaltyCruiseInput {
  nights: number;
  cabinType?: CabinCategory;
  isSolo?: boolean;
  endDate?: string;
}

export interface LoyaltyProgress {
  currentPoints: number;
  targetPoints: number;
  pointsLeft: number;
  pointsFromUpcoming: number;
  pointsLeftAfterUpcoming: number;
  avgNightsPerCruise: number;
  nightsLeftAt1x: number;
  cruisesLeftAtAvg: number;
  sevenNightCruisesLeft: number;
  estimatedMonthsToTarget: number;
}

export const LOYALTY_TARGET = 700;

export function cabinMultiplier(cabinType?: string, isSolo?: boolean, guests?: number): number {
  if (guests === 1 || isSolo) {
    return 2;
  }
  return 1;
}

export function calcCruiseLoyaltyPoints(nights: number, cabinType?: string, isSolo?: boolean, guests?: number): number {
  const mult = cabinMultiplier(cabinType, isSolo, guests);
  return Math.max(0, Math.round(nights * mult));
}

export function toLoyaltyInputs(list: (Partial<Cruise> | Partial<BookedCruise>)[]): LoyaltyCruiseInput[] {
  return list
    .filter(Boolean)
    .map((c) => {
      const nights = typeof (c as any).nights === 'number' ? (c as any).nights as number : 0;
      const cabinType = (c as any).cabinType as string | undefined;
      const guests = typeof (c as any).guests === 'number' ? (c as any).guests : 2;
      const isSolo = guests === 1 ? true : undefined;
      const endDate = (c as any).returnDate ?? (c as any).endDate;
      return { nights, cabinType, isSolo, endDate } as LoyaltyCruiseInput;
    })
    .filter((c) => c.nights > 0);
}

export function computeLoyaltyProgress(
  completed: LoyaltyCruiseInput[],
  upcoming: LoyaltyCruiseInput[] = [],
  targetPoints: number = LOYALTY_TARGET,
  overrideCurrentPoints?: number
): LoyaltyProgress {
  const calculatedPoints = completed.reduce((sum, c) => sum + calcCruiseLoyaltyPoints(c.nights, c.cabinType, c.isSolo), 0);
  const currentPoints = overrideCurrentPoints !== undefined ? overrideCurrentPoints : calculatedPoints;

  const pointsFromUpcoming = upcoming.reduce((sum, c) => sum + calcCruiseLoyaltyPoints(c.nights, c.cabinType, c.isSolo), 0);

  const pointsLeft = Math.max(0, targetPoints - currentPoints);
  const pointsLeftAfterUpcoming = Math.max(0, pointsLeft - pointsFromUpcoming);

  const recentForAvg = completed.slice(-5);
  const avgNightsPerCruise = recentForAvg.length > 0
    ? recentForAvg.reduce((s, c) => s + c.nights, 0) / recentForAvg.length
    : 4; // sensible default

  const nightsLeftAt1x = pointsLeftAfterUpcoming;
  const cruisesLeftAtAvg = avgNightsPerCruise > 0 ? Math.ceil(nightsLeftAt1x / avgNightsPerCruise) : nightsLeftAt1x;
  const sevenNightCruisesLeft = Math.ceil(nightsLeftAt1x / 7);

  const hasUpcoming = upcoming.length > 0;
  const monthsPerCruise = hasUpcoming ? 1 : 2;
  const estimatedMonthsToTarget = cruisesLeftAtAvg * monthsPerCruise;

  return {
    currentPoints,
    targetPoints,
    pointsLeft,
    pointsFromUpcoming,
    pointsLeftAfterUpcoming,
    avgNightsPerCruise: Number(avgNightsPerCruise.toFixed(1)),
    nightsLeftAt1x,
    cruisesLeftAtAvg,
    sevenNightCruisesLeft,
    estimatedMonthsToTarget,
  };
}
