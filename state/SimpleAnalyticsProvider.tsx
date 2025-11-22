import React from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import createContextHook from '@nkzw/create-context-hook';
import { estimateRetail } from '@/lib/retailEstimator';
import { useCruiseStore } from '@/state/CruiseStore';
import { useAppState } from '@/state/AppStateProvider';
import type { Cruise, BookedCruise } from '@/types/models';

export interface SimpleCruise {
  id: string;
  ship: string;
  sailDate: string;
  endDate: string;
  nights: number;
  retailPrice: number;
  casinoComp: number;
  amountPaid: number;
  freePlay: number;
  pointsEarned: number;
  winnings: number;
  onboardSpend: number;
  taxesFees: number;
  retailCabin?: number;
  retailExtras?: number;
  retailNotes?: string;
  retailSourceUrl?: string;
  actualCostPerPoint?: number;
  usedCruiseCertificate?: number;
}

export interface DerivedMetrics {
  roiPct: number;
  coinIn: number;
  valuePerPoint: number;
  roiBadge: 'High' | 'Medium' | 'Low';
}

export interface SimpleAnalyticsData {
  cruises: SimpleCruise[];
  totals: {
    totalCruises: number;
    totalPoints: number;
    totalRetailValue: number;
    totalAmountPaid: number;
    totalSavings: number;
    averageROI: number;
    totalCoinIn: number;
    totalActualRisk: number;
    totalOutOfPocket: number;
    dollarPerPoint: number;
    totalSpent: number;
  };
  derivedById: Record<string, DerivedMetrics>;
  lastRecalcAt: number;
  forceRecalc: () => void;
  updateCruise?: (id: string, changes: Partial<Pick<SimpleCruise, 'pointsEarned' | 'winnings' | 'amountPaid' | 'taxesFees' | 'casinoComp' | 'freePlay' | 'retailCabin' | 'retailExtras'>>) => Promise<void>;
  bulkUpdate?: (updates: Array<{ id: string; changes: Partial<Pick<SimpleCruise, 'pointsEarned' | 'winnings' | 'amountPaid' | 'taxesFees' | 'casinoComp' | 'freePlay' | 'retailCabin' | 'retailExtras'>> }>) => Promise<void>;
}

const STORAGE_KEYS = {
  CRUISES: '@simple_analytics_cruises_v1',
} as const;

const CRUISE_DATA: SimpleCruise[] = [
  {
    id: '7871133',
    ship: 'Wonder of the Seas',
    sailDate: '2025-03-09',
    endDate: '2025-03-16',
    nights: 7,
    retailPrice: 0,
    casinoComp: 0,
    amountPaid: 0,
    freePlay: 0,
    pointsEarned: 0,
    winnings: 0,
    onboardSpend: 0,
    taxesFees: 0,
    retailCabin: 0,
    retailExtras: 0,
  },
  {
    id: '2501764',
    ship: 'Harmony of the Seas',
    sailDate: '2025-04-20',
    endDate: '2025-04-27',
    nights: 7,
    retailPrice: 2150,
    casinoComp: 1350,
    amountPaid: 175.25,
    freePlay: 0,
    pointsEarned: 2000,
    winnings: 2100,
    onboardSpend: 0,
    taxesFees: 175.25,
    retailCabin: 2150,
    retailExtras: 0,
  },
  {
    id: '2901567',
    ship: 'Wonder of the Seas',
    sailDate: '2025-07-13',
    endDate: '2025-07-20',
    nights: 7,
    retailPrice: 2200,
    casinoComp: 1300,
    amountPaid: 158.44,
    freePlay: 0,
    pointsEarned: 0,
    winnings: 0,
    onboardSpend: 0,
    taxesFees: 158.44,
    retailCabin: 2200,
    retailExtras: 0,
  },
  {
    id: '236930',
    ship: 'Ovation of the Seas',
    sailDate: '2025-07-29',
    endDate: '2025-08-05',
    nights: 7,
    retailPrice: 0,
    casinoComp: 0,
    amountPaid: 0,
    freePlay: 0,
    pointsEarned: 317,
    winnings: 0,
    onboardSpend: 0,
    taxesFees: 0,
    retailCabin: 0,
    retailExtras: 0,
  },
  {
    id: '6242276',
    ship: 'Navigator of the Seas',
    sailDate: '2025-08-01',
    endDate: '2025-08-05',
    nights: 4,
    retailPrice: 0,
    casinoComp: 0,
    amountPaid: 0,
    freePlay: 0,
    pointsEarned: 0,
    winnings: 0,
    onboardSpend: 0,
    taxesFees: 0,
    retailCabin: 0,
    retailExtras: 0,
  },
  {
    id: '7815951',
    ship: 'Ovation of the Seas',
    sailDate: '2025-08-26',
    endDate: '2025-09-02',
    nights: 7,
    retailPrice: 1588,
    casinoComp: 946,
    amountPaid: 149.10,
    freePlay: 0,
    pointsEarned: 0,
    winnings: 0,
    onboardSpend: 0,
    taxesFees: 110.10,
    retailCabin: 1588,
    retailExtras: 0,
  },
  {
    id: '2665774',
    ship: 'Star of the Seas',
    sailDate: '2025-08-27',
    endDate: '2025-08-31',
    nights: 4,
    retailPrice: 4590,
    casinoComp: 3380,
    amountPaid: 162.37,
    freePlay: 0,
    pointsEarned: 4581,
    winnings: 700,
    onboardSpend: 0,
    taxesFees: 162.37,
    retailCabin: 4590,
    retailExtras: 0,
  },
  {
    id: '3156149',
    ship: 'Navigator of the Seas',
    sailDate: '2025-09-08',
    endDate: '2025-09-12',
    nights: 4,
    retailPrice: 999,
    casinoComp: 620,
    amountPaid: 136.58,
    freePlay: 0,
    pointsEarned: 976,
    winnings: 189,
    onboardSpend: 0,
    taxesFees: 136.58,
    retailCabin: 999,
    retailExtras: 0,
  },
  {
    id: '5207254',
    ship: 'Navigator of the Seas',
    sailDate: '2025-09-15',
    endDate: '2025-09-19',
    nights: 4,
    retailPrice: 1050,
    casinoComp: 675,
    amountPaid: 132.50,
    freePlay: 0,
    pointsEarned: 817,
    winnings: 100,
    onboardSpend: 0,
    taxesFees: 132.50,
    retailCabin: 1050,
    retailExtras: 0,
  },
  {
    id: '7836829',
    ship: 'Radiance of the Seas',
    sailDate: '2025-09-26',
    endDate: '2025-10-04',
    nights: 8,
    retailPrice: 1850,
    casinoComp: 1220,
    amountPaid: 172.13,
    freePlay: 0,
    pointsEarned: 2030,
    winnings: 300,
    onboardSpend: 0,
    taxesFees: 172.13,
    retailCabin: 1850,
    retailExtras: 0,
  },
  {
    id: '1428001',
    ship: 'Quantum of the Seas',
    sailDate: '2025-10-02',
    endDate: '2025-10-06',
    nights: 4,
    retailPrice: 2000,
    casinoComp: 0,
    amountPaid: 0,
    freePlay: 0,
    pointsEarned: 2517,
    winnings: 700,
    onboardSpend: 0,
    taxesFees: 0,
    retailCabin: 2000,
    retailExtras: 0,
  },
  {
    id: '2755395',
    ship: 'Liberty of the Seas',
    sailDate: '2025-10-16',
    endDate: '2025-10-25',
    nights: 9,
    retailPrice: 2450,
    casinoComp: 1550,
    amountPaid: 195,
    freePlay: 0,
    pointsEarned: 7482,
    winnings: 1488,
    onboardSpend: 0,
    taxesFees: 195,
    retailCabin: 2450,
    retailExtras: 0,
  },
  {
    id: '4372586',
    ship: 'Quantum of the Seas',
    sailDate: '2025-11-10',
    endDate: '2025-11-14',
    nights: 4,
    retailPrice: 1036,
    casinoComp: 1036,
    amountPaid: 138.24,
    freePlay: 0,
    pointsEarned: 0,
    winnings: 0,
    onboardSpend: 0,
    taxesFees: 138.24,
    retailCabin: 1036,
    retailExtras: 0,
  },
  {
    id: '6458636',
    ship: 'Harmony of the Seas',
    sailDate: '2026-03-16',
    endDate: '2026-04-01',
    nights: 16,
    retailPrice: 4454,
    casinoComp: 4454,
    amountPaid: 200,
    freePlay: 0,
    pointsEarned: 0,
    winnings: 0,
    onboardSpend: 0,
    taxesFees: 229.19,
    retailCabin: 4454,
    retailExtras: 0,
  },
];

function calculateTotals(cruises: SimpleCruise[]): SimpleAnalyticsData['totals'] {
  const totalCruises = cruises.length;
  const totalPoints = cruises.reduce((sum, c) => sum + (c.pointsEarned || 0), 0);
  const totalRetailValue = cruises.reduce((sum, c) => sum + ((c.retailCabin ?? 0) + (c.retailExtras ?? 0)), 0);
  const totalAmountPaid = cruises.reduce((sum, c) => sum + (c.amountPaid || 0), 0);
  
  const totalOutOfPocket = cruises.reduce((sum, c) => {
    const laidOut = (c.amountPaid || 0) + (c.taxesFees || 0) - (c.usedCruiseCertificate || 0);
    const netOutOfPocket = laidOut - (c.winnings || 0);
    return sum + netOutOfPocket;
  }, 0);
  
  const totalSavings = totalRetailValue - totalOutOfPocket;
  const averageROI = totalOutOfPocket > 0 ? (totalSavings / totalOutOfPocket) * 100 : 0;
  const totalCoinIn = totalPoints * 5;
  const totalActualRisk = totalAmountPaid;
  
  const totalSpent = cruises.reduce((sum, c) => {
    const laidOut = (c.amountPaid || 0) + (c.taxesFees || 0) - (c.usedCruiseCertificate || 0);
    return sum + laidOut;
  }, 0);
  
  const dollarPerPoint = totalPoints > 0 ? totalSpent / totalPoints : 0;

  return {
    totalCruises,
    totalPoints,
    totalRetailValue,
    totalAmountPaid,
    totalSavings,
    averageROI,
    totalCoinIn,
    totalActualRisk,
    totalOutOfPocket,
    dollarPerPoint,
    totalSpent,
  };
}

export const [SimpleAnalyticsProvider, useSimpleAnalytics] = createContextHook<SimpleAnalyticsData>(() => {
  const { cruises: realCruises } = useCruiseStore();
  const { localData, userPoints } = useAppState();
  const [cruises, setCruises] = React.useState<SimpleCruise[]>([]);

  const [derivedById, setDerivedById] = React.useState<Record<string, DerivedMetrics>>({});
  const [lastRecalcAt, setLastRecalcAt] = React.useState<number>(0);

  const recomputeDerived = React.useCallback((list: SimpleCruise[]) => {
    const map: Record<string, DerivedMetrics> = {};
    for (const c of list) {
      const roi = calculateCruiseROI(c);
      const coin = calculateCoinIn(c);
      const vpp = calculateValuePerPoint(c);
      const badge: 'High' | 'Medium' | 'Low' = roi >= 300 ? 'High' : roi >= 150 ? 'Medium' : 'Low';
      map[c.id] = { roiPct: roi, coinIn: coin, valuePerPoint: vpp, roiBadge: badge };
    }
    setDerivedById(map);
    const ts = Date.now();
    setLastRecalcAt(ts);
    console.log('[SimpleAnalytics] Recomputed derived metrics at', new Date(ts).toISOString());
  }, []);

  React.useEffect(() => {
    const load = async () => {
      try {
        console.log('[SimpleAnalytics] STEP 2.1: Loading hardcoded cruise data with financial details');
        
        console.log('[SimpleAnalytics] Loaded', CRUISE_DATA.length, 'completed cruises with financial data');
        setCruises(CRUISE_DATA);
        recomputeDerived(CRUISE_DATA);
        await AsyncStorage.setItem(STORAGE_KEYS.CRUISES, JSON.stringify(CRUISE_DATA));
      } catch (e) {
        console.error('[SimpleAnalytics] Failed to load cruise data', e);
        const fallback: SimpleCruise[] = [];
        setCruises(fallback);
        recomputeDerived(fallback);
      }
    };
    load();
  }, [recomputeDerived]);

  const persist = React.useCallback(async (next: SimpleCruise[]) => {
    try {
      await AsyncStorage.setItem(STORAGE_KEYS.CRUISES, JSON.stringify(next));
      console.log('[SimpleAnalytics] Persisted cruises', next.length);
    } catch (e) {
      console.error('[SimpleAnalytics] Persist failed', e);
    }
  }, []);

  const updateCruise = React.useCallback(async (id: string, changes: Partial<Pick<SimpleCruise, 'pointsEarned' | 'winnings' | 'amountPaid' | 'taxesFees' | 'casinoComp' | 'freePlay' | 'retailCabin' | 'retailExtras'>>) => {
    setCruises((prev) => {
      const next = prev.map((c) => (c.id === id ? { ...c, ...changes } : c));
      persist(next);
      recomputeDerived(next);
      return next;
    });
  }, [persist, recomputeDerived]);

  const bulkUpdate = React.useCallback(async (updates: Array<{ id: string; changes: Partial<Pick<SimpleCruise, 'pointsEarned' | 'winnings' | 'amountPaid' | 'taxesFees' | 'casinoComp' | 'freePlay' | 'retailCabin' | 'retailExtras'>> }>) => {
    setCruises((prev) => {
      const map = new Map(updates.map((u) => [u.id, u.changes]));
      const next = prev.map((c) => (map.has(c.id) ? { ...c, ...(map.get(c.id) as object) } : c));
      persist(next);
      recomputeDerived(next);
      return next;
    });
  }, [persist, recomputeDerived]);

  const forceRecalc = React.useCallback(() => {
    recomputeDerived(cruises);
  }, [recomputeDerived, cruises]);

  const data: SimpleAnalyticsData = React.useMemo(() => {
    return { cruises, totals: calculateTotals(cruises), derivedById, lastRecalcAt, forceRecalc, updateCruise, bulkUpdate };
  }, [cruises, derivedById, lastRecalcAt, forceRecalc, updateCruise, bulkUpdate]);

  return data;
});

export function calculateCruiseROI(cruise: SimpleCruise): number {
  const retailValue = (cruise.retailCabin ?? 0) + (cruise.retailExtras ?? 0);
  const casinoValue = (cruise.casinoComp || 0) + (cruise.freePlay || 0);
  const totalLaidOut = (cruise.amountPaid || 0) + (cruise.taxesFees || 0) - (cruise.usedCruiseCertificate || 0);
  const netCost = totalLaidOut - (cruise.winnings || 0);
  const totalValue = retailValue + casinoValue;
  const savings = totalValue - netCost;
  if (totalLaidOut === 0) return 0;
  return (savings / totalLaidOut) * 100;
}

export function calculateValuePerPoint(cruise: SimpleCruise): number {
  if (!cruise?.pointsEarned || cruise.pointsEarned <= 0) return 0;
  const retailValue = (cruise.retailCabin ?? 0) + (cruise.retailExtras ?? 0);
  const casinoValue = (cruise.casinoComp || 0) + (cruise.freePlay || 0);
  const winnings = cruise.winnings || 0;
  const totalValueReceived = retailValue + casinoValue + winnings;
  const totalLaidOut = (cruise.amountPaid || 0) + (cruise.taxesFees || 0) - (cruise.usedCruiseCertificate || 0);
  const netOutOfPocket = totalLaidOut - winnings;
  const netValue = totalValueReceived - netOutOfPocket;
  return netValue / cruise.pointsEarned;
}

export function calculateRetailValue(cruise: SimpleCruise): number {
  return (cruise.retailCabin ?? 0) + (cruise.retailExtras ?? 0);
}

export function calculateCoinIn(cruise: SimpleCruise): number {
  return (cruise.pointsEarned || 0) * 5;
}

export function calculateRiskMultiplier(cruise: SimpleCruise): number {
  if (!cruise?.amountPaid || cruise.amountPaid <= 0) return 0;
  const coinIn = calculateCoinIn(cruise);
  return coinIn / cruise.amountPaid;
}

export function calculateActualCostPerPoint(cruise: SimpleCruise): number {
  if (!cruise?.pointsEarned || cruise.pointsEarned <= 0) return 5;
  const totalLaidOut = (cruise.amountPaid || 0) + (cruise.taxesFees || 0) - (cruise.usedCruiseCertificate || 0);
  const winnings = cruise.winnings || 0;
  const netOutOfPocket = totalLaidOut - winnings;
  return netOutOfPocket / cruise.pointsEarned;
}

export function calculateActualCoinIn(cruise: SimpleCruise): number {
  const actualCostPerPoint = calculateActualCostPerPoint(cruise);
  return (cruise.pointsEarned || 0) * actualCostPerPoint;
}

export function calculateNetProfit(cruise: SimpleCruise): number {
  return (cruise.winnings || 0);
}

/**
 * Calculates the Casino Comp amount based on the room category booked and port taxes/fees.
 * 
 * Formula: Casino Comp = (Cabin Price × Number of Guests) + Port Taxes & Fees
 * 
 * @param params.cabinPrice - The price of the booked cabin category (interior, oceanview, balcony, or suite)
 * @param params.portTaxesFees - The port taxes and fees amount
 * @param params.numberOfGuests - Number of guests (defaults to 2)
 * 
 * @returns The calculated Casino Comp amount
 * 
 * @example
 * // For a balcony cabin at $1500 per person with $200 in taxes/fees for 2 guests:
 * const casinoComp = calculateCasinoComp({
 *   cabinPrice: 1500,
 *   portTaxesFees: 200,
 *   numberOfGuests: 2
 * });
 * // Returns: (1500 × 2) + 200 = 3200
 */
export function calculateCasinoComp(params: {
  cabinPrice: number;
  portTaxesFees: number;
  numberOfGuests?: number;
}): number {
  const guests = params.numberOfGuests || 2;
  return (params.cabinPrice * guests) + params.portTaxesFees;
}
