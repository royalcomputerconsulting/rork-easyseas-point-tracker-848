import React from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import createContextHook from '@nkzw/create-context-hook';
import { pointsFromCoinIn, getRewardForPoints, normalizeOfferCode, isMarketingCode, CONVERSIONS } from '@/constants/financials';
import { estimateRetail } from '@/lib/retailEstimator';
import { useQueryClient } from '@tanstack/react-query';

export interface ReceiptSourceItem {
  cruiseId: string;
  ship: string;
  departureDate: string;
  retailCabinValue: number;
  fare: number;
  taxesAndFees: number;
  gratuities: number;
  nextCruiseCertificateApplied?: number;
  actualPaid: number;
  offerCode?: string;
}

export interface StatementLineItem {
  category: 'SPA' | 'DINING' | 'INTERNET' | 'ESCAPE' | 'SHORE_EX' | 'OTHER';
  amount: number;
}

export interface StatementSourceItem {
  cruiseId: string;
  ship: string;
  departureDate: string;
  clubRoyaleCoinIn: number;
  extras: StatementLineItem[];
}

export interface WinningsSourceItem {
  cruiseId: string;
  amountBroughtHome: number;
}

export type CertificateType = 'FCC' | 'NEXT_CRUISE' | 'OTHER';

export interface CertificateItem {
  id: string;
  type: CertificateType;
  cruiseId?: string;
  code?: string;
  valueUSD: number;
  earnedDate?: string;
  expiresOn?: string;
  notes?: string;
  linkedCruiseId?: string;
  redeemedOnCruiseId?: string;
  usedOnCruiseId?: string;
  isUsed?: boolean;
}

export interface PointsEntry {
  cruiseId: string;
  points: number;
}

export interface CruiseFinancialSummary {
  cruiseId: string;
  ship: string;
  date: string;
  retailCabinValue: number;
  outOfPocket: number;
  coinIn: number;
  pointsEarned: number;
  normalizedOfferCode?: string;
  rewardLevelCode?: string;
  rewardLevelText?: string;
  freePlayMax?: number;
  winningsBroughtHome: number;
  extrasValue: number;
  totalValueBack: number;
  roiPercent: number;
  pointsToNextTier: number;
}

export interface RealtimeConfidence {
  cruiseId: string;
  confidence: number;
  smoothedPoints: number;
}

interface FinancialsState {
  receipts: ReceiptSourceItem[];
  statements: StatementSourceItem[];
  winnings: WinningsSourceItem[];
  userPointsByCruise: Record<string, number>;
  certificates: CertificateItem[];
  setReceipts: (items: ReceiptSourceItem[]) => Promise<void>;
  setStatements: (items: StatementSourceItem[]) => Promise<void>;
  setWinnings: (items: WinningsSourceItem[]) => Promise<void>;
  setUserPoints: (cruiseId: string, points: number) => Promise<void>;
  getCruiseSummary: (cruiseId: string) => CruiseFinancialSummary | null;
  getAllSummaries: () => CruiseFinancialSummary[];
  getAnalyticsTotals: (sinceISO?: string) => {
    totalCoinIn: number;
    totalPoints: number;
    totalRetailValue: number;
    totalOutOfPocket: number;
    weightedRoi: number;
  };
  getTopByROI: (limit: number) => CruiseFinancialSummary[];
  addCertificate: (cert: CertificateItem) => Promise<void>;
  updateCertificate: (id: string, patch: Partial<CertificateItem>) => Promise<void>;
  removeCertificate: (id: string) => Promise<void>;
  getRealtimeConfidence: (cruiseId: string) => RealtimeConfidence;
}

const KEYS = {
  RECEIPTS: '@fin_receipts',
  STATEMENTS: '@fin_statements',
  WINNINGS: '@fin_winnings',
  USER_POINTS: '@fin_user_points_by_cruise',
  CERTIFICATES: '@fin_certificates',
};

function toExtrasValue(items: StatementLineItem[]): number {
  return items.reduce((sum, it) => sum + (it.amount || 0), 0);
}

function computeSummary(
  receipt: ReceiptSourceItem | undefined,
  statement: StatementSourceItem | undefined,
  winning: WinningsSourceItem | undefined,
  userPointsOverride: number | undefined
): CruiseFinancialSummary | null {
  if (!receipt && !statement) return null;
  const ship = receipt?.ship ?? statement?.ship ?? '';
  const date = receipt?.departureDate ?? statement?.departureDate ?? '';
  const retailCabinValue = receipt?.retailCabinValue ?? 0;
  const fare = receipt?.fare ?? 0;
  const taxesAndFees = receipt?.taxesAndFees ?? 0;
  const gratuities = receipt?.gratuities ?? 0;
  const outOfPocket = fare + taxesAndFees + gratuities;
  const coinIn = statement?.clubRoyaleCoinIn ?? 0;
  const calcPoints = pointsFromCoinIn(coinIn);
  const pointsEarned = userPointsOverride != null ? Math.max(0, Math.floor(userPointsOverride)) : calcPoints;
  const normalizedOfferCode = normalizeOfferCode(receipt?.offerCode);
  const isMarketing = isMarketingCode(normalizedOfferCode);
  const rewardTier = isMarketing ? undefined : getRewardForPoints(pointsEarned);
  const winningsBroughtHome = winning?.amountBroughtHome ?? 0;
  const extrasValue = toExtrasValue(statement?.extras ?? []);
  const totalValueBack = retailCabinValue + winningsBroughtHome + extrasValue;
  const roiPercent = outOfPocket > 0 ? (totalValueBack / outOfPocket) * 100 : 0;
  const remainderToNext = (() => {
    const tiers = [40000, 25000, 15000, 9000, 6500, 4000, 3000, 2000, 1500, 1200, 800, 600, 400];
    const sorted = [...tiers].sort((a, b) => a - b);
    for (let i = 0; i < sorted.length; i++) {
      if (pointsEarned < sorted[i]) return sorted[i] - pointsEarned;
    }
    return 0;
  })();
  return {
    cruiseId: receipt?.cruiseId ?? statement?.cruiseId ?? '',
    ship,
    date,
    retailCabinValue,
    outOfPocket,
    coinIn,
    pointsEarned,
    normalizedOfferCode,
    rewardLevelCode: rewardTier?.code,
    rewardLevelText: rewardTier?.reward,
    freePlayMax: rewardTier?.freePlayMax,
    winningsBroughtHome,
    extrasValue,
    totalValueBack,
    roiPercent,
    pointsToNextTier: remainderToNext,
  };
}

export const [FinancialsProvider, useFinancials] = createContextHook<FinancialsState>(() => {
  const [receipts, setReceiptsState] = React.useState<ReceiptSourceItem[]>([]);
  const [statements, setStatementsState] = React.useState<StatementSourceItem[]>([]);
  const [winnings, setWinningsState] = React.useState<WinningsSourceItem[]>([]);
  const [userPointsByCruise, setUserPointsByCruise] = React.useState<Record<string, number>>({});
  const [certificates, setCertificates] = React.useState<CertificateItem[]>([]);
  const queryClient = useQueryClient();

  const invalidateFinancialQueries = React.useCallback(() => {
    try {
      queryClient.invalidateQueries({ queryKey: ['financials'] });
      queryClient.invalidateQueries({ queryKey: ['financials.analyticsSummary'] });
      queryClient.invalidateQueries({ queryKey: ['financials.financialOverview'] });
      queryClient.invalidateQueries({ queryKey: ['financials.casinoAnalytics'] });
      queryClient.invalidateQueries({ queryKey: ['financials.rankings'] });
      queryClient.invalidateQueries({ queryKey: ['financials.cruisesTable'] });
    } catch (e) {
      console.error('[Financials] invalidateFinancialQueries error', e);
    }
  }, [queryClient]);


  React.useEffect(() => {
    const load = async () => {
      try {
        const [r, s, w, p, c] = await Promise.all([
          AsyncStorage.getItem(KEYS.RECEIPTS),
          AsyncStorage.getItem(KEYS.STATEMENTS),
          AsyncStorage.getItem(KEYS.WINNINGS),
          AsyncStorage.getItem(KEYS.USER_POINTS),
          AsyncStorage.getItem(KEYS.CERTIFICATES),
        ]);
        const receiptsLoaded: ReceiptSourceItem[] = r ? JSON.parse(r) as ReceiptSourceItem[] : [];
        const statementsLoaded: StatementSourceItem[] = s ? JSON.parse(s) as StatementSourceItem[] : [];
        const winningsLoaded: WinningsSourceItem[] = w ? JSON.parse(w) as WinningsSourceItem[] : [];
        const userPointsLoaded: Record<string, number> = p ? JSON.parse(p) as Record<string, number> : {};
        const certificatesLoaded: CertificateItem[] = c ? JSON.parse(c) as CertificateItem[] : [];

        const seeded = seedRetailAndExtras(receiptsLoaded, statementsLoaded);

        setReceiptsState(seeded.receipts);
        setStatementsState(seeded.statements);
        setWinningsState(winningsLoaded);
        setUserPointsByCruise(userPointsLoaded);
        setCertificates(certificatesLoaded);

        try {
          await AsyncStorage.setItem(KEYS.RECEIPTS, JSON.stringify(seeded.receipts));
          await AsyncStorage.setItem(KEYS.STATEMENTS, JSON.stringify(seeded.statements));
        } catch (persistErr) {
          console.error('[Financials] Failed to persist seeded financials', persistErr);
        }
      } catch (e) {
        console.error('[Financials] Failed to load persisted financials', e);
      }
    };
    load();
  }, []);

  const setReceipts = React.useCallback(async (items: ReceiptSourceItem[]) => {
    console.log('[Financials] setReceipts called', { count: items.length });
    setReceiptsState(items);
    try { await AsyncStorage.setItem(KEYS.RECEIPTS, JSON.stringify(items)); } catch (e) { console.error(e); }
    try { invalidateFinancialQueries(); } catch (e) { console.error('[Financials] setReceipts invalidate error', e); }
  }, [invalidateFinancialQueries]);

  const setStatements = React.useCallback(async (items: StatementSourceItem[]) => {
    console.log('[Financials] setStatements called', { count: items.length });
    setStatementsState(items);
    try { await AsyncStorage.setItem(KEYS.STATEMENTS, JSON.stringify(items)); } catch (e) { console.error(e); }
    try { invalidateFinancialQueries(); } catch (e) { console.error('[Financials] setStatements invalidate error', e); }
  }, [invalidateFinancialQueries]);

  const setWinnings = React.useCallback(async (items: WinningsSourceItem[]) => {
    console.log('[Financials] setWinnings called', { count: items.length });
    setWinningsState(items);
    try { await AsyncStorage.setItem(KEYS.WINNINGS, JSON.stringify(items)); } catch (e) { console.error(e); }
    try { invalidateFinancialQueries(); } catch (e) { console.error('[Financials] setWinnings invalidate error', e); }
  }, [invalidateFinancialQueries]);

  const addCertificate = React.useCallback(async (cert: CertificateItem) => {
    const exists = certificates.find(x => x.id === cert.id);
    const next = exists ? certificates.map(x => (x.id === cert.id ? cert : x)) : [...certificates, cert];
    setCertificates(next);
    try { await AsyncStorage.setItem(KEYS.CERTIFICATES, JSON.stringify(next)); } catch (e) { console.error(e); }
  }, [certificates]);

  const updateCertificate = React.useCallback(async (id: string, patch: Partial<CertificateItem>) => {
    const next = certificates.map(x => (x.id === id ? { ...x, ...patch } : x));
    setCertificates(next);
    try { await AsyncStorage.setItem(KEYS.CERTIFICATES, JSON.stringify(next)); } catch (e) { console.error(e); }
  }, [certificates]);

  const removeCertificate = React.useCallback(async (id: string) => {
    const next = certificates.filter(x => x.id !== id);
    setCertificates(next);
    try { await AsyncStorage.setItem(KEYS.CERTIFICATES, JSON.stringify(next)); } catch (e) { console.error(e); }
  }, [certificates]);


  const setUserPoints = React.useCallback(async (cruiseId: string, points: number) => {
    const safe = Math.max(0, Math.floor(points));
    const next = { ...userPointsByCruise, [cruiseId]: safe };
    setUserPointsByCruise(next);
    try { await AsyncStorage.setItem(KEYS.USER_POINTS, JSON.stringify(next)); } catch (e) { console.error(e); }
    invalidateFinancialQueries();
  }, [userPointsByCruise, invalidateFinancialQueries]);

  const getCruiseSummary = React.useCallback((cruiseId: string): CruiseFinancialSummary | null => {
    const r = receipts.find(x => x.cruiseId === cruiseId);
    const s = statements.find(x => x.cruiseId === cruiseId);
    const w = winnings.find(x => x.cruiseId === cruiseId);
    const override = userPointsByCruise[cruiseId];
    return computeSummary(r, s, w, override);
  }, [receipts, statements, winnings, userPointsByCruise]);

  const getAllSummaries = React.useCallback((): CruiseFinancialSummary[] => {
    const cruiseIds = new Set<string>();
    receipts.forEach(x => cruiseIds.add(x.cruiseId));
    statements.forEach(x => cruiseIds.add(x.cruiseId));
    const all: CruiseFinancialSummary[] = [];
    cruiseIds.forEach(id => {
      const sum = getCruiseSummary(id);
      if (sum) all.push(sum);
    });
    return all.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  }, [receipts, statements, getCruiseSummary]);

  const getAnalyticsTotals = React.useCallback((sinceISO?: string) => {
    const since = sinceISO ? new Date(sinceISO).getTime() : 0;
    const list = getAllSummaries().filter(s => (new Date(s.date).getTime() >= since));
    const totals = list.reduce((acc, s) => {
      acc.totalCoinIn += s.coinIn;
      acc.totalPoints += s.pointsEarned;
      acc.totalRetailValue += s.retailCabinValue + s.extrasValue;
      acc.totalOutOfPocket += s.outOfPocket;
      const weight = s.outOfPocket > 0 ? s.outOfPocket : 0;
      acc.weightSum += weight;
      acc.weighted += weight * s.roiPercent;
      return acc;
    }, { totalCoinIn: 0, totalPoints: 0, totalRetailValue: 0, totalOutOfPocket: 0, weighted: 0, weightSum: 0 });
    const weightedRoi = totals.weightSum > 0 ? totals.weighted / totals.weightSum : 0;
    return { totalCoinIn: totals.totalCoinIn, totalPoints: totals.totalPoints, totalRetailValue: totals.totalRetailValue, totalOutOfPocket: totals.totalOutOfPocket, weightedRoi };
  }, [getAllSummaries]);

  const getTopByROI = React.useCallback((limit: number) => {
    const list = getAllSummaries();
    return [...list].sort((a, b) => (b.totalValueBack / (b.outOfPocket || 1)) - (a.totalValueBack / (a.outOfPocket || 1))).slice(0, Math.max(0, limit));
  }, [getAllSummaries]);

  const getRealtimeConfidence = React.useCallback((cruiseId: string): RealtimeConfidence => {
    const summary = getCruiseSummary(cruiseId);
    const hasReceipt = receipts.some(r => r.cruiseId === cruiseId);
    const hasStatement = statements.some(s => s.cruiseId === cruiseId);
    const override = userPointsByCruise[cruiseId];

    let confidence = 0;
    if (hasReceipt) confidence += 0.4;
    if (hasStatement) confidence += 0.4;
    if (override != null) confidence += 0.2;
    confidence = Math.min(1, Math.max(0, confidence));

    const calc = summary?.pointsEarned ?? 0;
    const smoothedPoints = simpleSMA([calc, override ?? calc].filter(n => typeof n === 'number'), 2);

    return { cruiseId, confidence, smoothedPoints };
  }, [getCruiseSummary, receipts, statements, userPointsByCruise]);

  return {
    receipts,
    statements,
    winnings,
    userPointsByCruise,
    certificates,
    setReceipts,
    setStatements,
    setWinnings,
    setUserPoints,
    getCruiseSummary,
    getAllSummaries,
    getAnalyticsTotals,
    getTopByROI,
    addCertificate,
    updateCertificate,
    removeCertificate,
    getRealtimeConfidence,
  };
});

export function usePointsConversion() {
  const pointPerCoinIn = CONVERSIONS.pointPerCoinIn;
  const toPoints = React.useCallback((coinIn: number) => pointsFromCoinIn(coinIn), []);
  const toCoinIn = React.useCallback((points: number) => Math.max(0, points * pointPerCoinIn), [pointPerCoinIn]);
  return { pointPerCoinIn, toPoints, toCoinIn };
}

export function useConfidence(cruiseId: string): { cruiseId: string; confidence: number; smoothedPoints: number } {
  const { getRealtimeConfidence, receipts, statements, userPointsByCruise } = useFinancials();
  const memo = React.useMemo(() => {
    const res = getRealtimeConfidence(cruiseId);
    return res;
  }, [cruiseId, getRealtimeConfidence, receipts, statements, userPointsByCruise]);
  return memo;
}

function simpleSMA(series: number[], window: number): number {
  const clean = series.filter(n => Number.isFinite(n));
  if (clean.length === 0) return 0;
  const slice = clean.slice(-Math.max(1, window));
  const sum = slice.reduce((a, b) => a + b, 0);
  return sum / slice.length;
}

function seedRetailAndExtras(
  existingReceipts: ReceiptSourceItem[],
  existingStatements: StatementSourceItem[],
): { receipts: ReceiptSourceItem[]; statements: StatementSourceItem[] } {
  try {
    const byCruiseReceipts = new Map(existingReceipts.map(r => [r.cruiseId, r] as const));
    const byCruiseStatements = new Map(existingStatements.map(s => [s.cruiseId, s] as const));

    const NIGHTS_BY_ID: Record<string, number> = {
      '2665774': 7,
      '6242276': 4,
      '5156149': 4,
      '5207254': 4,
      '2501764': 7,
      '7871133': 7,
      '236930': 7,
      '7836829': 7,
    };

    const seeds: ReceiptSourceItem[] = [
      // Star of the Seas
      (() => {
        const est = estimateRetail({ ship: 'Star of the Seas', nights: NIGHTS_BY_ID['2665774'] });
        return {
          cruiseId: '2665774',
          ship: 'Star of the Seas',
          departureDate: '2025-08-27',
          retailCabinValue: est.retailCabinValue,
          fare: 0,
          taxesAndFees: est.taxesAndFees,
          gratuities: est.gratuities,
          actualPaid: 0,
        } as ReceiptSourceItem;
      })(),
      // Radiance of the Seas
      (() => {
        const est = estimateRetail({ ship: 'Radiance of the Seas', nights: NIGHTS_BY_ID['7836829'] });
        return {
          cruiseId: '7836829',
          ship: 'Radiance of the Seas',
          departureDate: '2025-09-26',
          retailCabinValue: est.retailCabinValue,
          fare: 0,
          taxesAndFees: est.taxesAndFees,
          gratuities: est.gratuities,
          actualPaid: 0,
        } as ReceiptSourceItem;
      })(),
      // Navigator examples (completed)
      (() => {
        const est = estimateRetail({ ship: 'Navigator of the Seas', nights: NIGHTS_BY_ID['6242276'] });
        return {
          cruiseId: '6242276',
          ship: 'Navigator of the Seas',
          departureDate: '2025-08-01',
          retailCabinValue: est.retailCabinValue,
          fare: 0,
          taxesAndFees: est.taxesAndFees,
          gratuities: est.gratuities,
          actualPaid: 0,
        } as ReceiptSourceItem;
      })(),
      (() => {
        const est = estimateRetail({ ship: 'Navigator of the Seas', nights: NIGHTS_BY_ID['5156149'] });
        return {
          cruiseId: '5156149',
          ship: 'Navigator of the Seas',
          departureDate: '2025-09-08',
          retailCabinValue: est.retailCabinValue,
          fare: 0,
          taxesAndFees: est.taxesAndFees,
          gratuities: est.gratuities,
          actualPaid: 0,
        } as ReceiptSourceItem;
      })(),
      (() => {
        const est = estimateRetail({ ship: 'Navigator of the Seas', nights: NIGHTS_BY_ID['5207254'] });
        return {
          cruiseId: '5207254',
          ship: 'Navigator of the Seas',
          departureDate: '2025-09-15',
          retailCabinValue: est.retailCabinValue,
          fare: 0,
          taxesAndFees: est.taxesAndFees,
          gratuities: est.gratuities,
          actualPaid: 0,
        } as ReceiptSourceItem;
      })(),
      // Harmony, Wonder, Ovation estimations
      (() => {
        const est = estimateRetail({ ship: 'Harmony of the Seas', nights: NIGHTS_BY_ID['2501764'] });
        return {
          cruiseId: '2501764',
          ship: 'Harmony of the Seas',
          departureDate: '2025-04-20',
          retailCabinValue: est.retailCabinValue,
          fare: 0,
          taxesAndFees: est.taxesAndFees,
          gratuities: est.gratuities,
          actualPaid: 0,
        } as ReceiptSourceItem;
      })(),
      (() => {
        const est = estimateRetail({ ship: 'Wonder of the Seas', nights: NIGHTS_BY_ID['7871133'] });
        return {
          cruiseId: '7871133',
          ship: 'Wonder of the Seas',
          departureDate: '2025-03-09',
          retailCabinValue: est.retailCabinValue,
          fare: 0,
          taxesAndFees: est.taxesAndFees,
          gratuities: est.gratuities,
          actualPaid: 0,
        } as ReceiptSourceItem;
      })(),
      (() => {
        const est = estimateRetail({ ship: 'Ovation of the Seas', nights: NIGHTS_BY_ID['236930'] });
        return {
          cruiseId: '236930',
          ship: 'Ovation of the Seas',
          departureDate: '2025-07-29',
          retailCabinValue: est.retailCabinValue,
          fare: 0,
          taxesAndFees: est.taxesAndFees,
          gratuities: est.gratuities,
          actualPaid: 0,
        } as ReceiptSourceItem;
      })(),
    ];

    const mergedReceipts: ReceiptSourceItem[] = [...existingReceipts];
    seeds.forEach(seed => {
      const cur = byCruiseReceipts.get(seed.cruiseId);
      if (!cur) mergedReceipts.push(seed);
      else {
        const next = { ...cur } as ReceiptSourceItem;
        if ((next.retailCabinValue ?? 0) === 0 && seed.retailCabinValue > 0) next.retailCabinValue = seed.retailCabinValue;
        if ((next.taxesAndFees ?? 0) === 0 && (seed.taxesAndFees ?? 0) > 0) next.taxesAndFees = seed.taxesAndFees;
        if ((next.gratuities ?? 0) === 0 && (seed.gratuities ?? 0) > 0) next.gratuities = seed.gratuities;
        Object.assign(cur, next);
      }
    });

    const starExtras: StatementLineItem[] = [
      { category: 'SPA', amount: 300 },
      { category: 'ESCAPE', amount: 39.99 },
      { category: 'DINING', amount: 60 },
    ];

    const mergedStatements: StatementSourceItem[] = [...existingStatements];
    const star = byCruiseStatements.get('2665774');
    if (star) {
      const existingExtrasTotal = toExtrasValue(star.extras ?? []);
      const seedExtrasTotal = toExtrasValue(starExtras);
      if (existingExtrasTotal < seedExtrasTotal) {
        star.extras = [...(star.extras ?? []), ...starExtras];
      }
    } else {
      mergedStatements.push({
        cruiseId: '2665774',
        ship: 'Star of the Seas',
        departureDate: '2025-08-27',
        clubRoyaleCoinIn: 0,
        extras: starExtras,
      });
    }

    return { receipts: mergedReceipts, statements: mergedStatements };
  } catch (e) {
    console.error('[Financials] seedRetailAndExtras error', e);
    return { receipts: existingReceipts, statements: existingStatements };
  }
}
