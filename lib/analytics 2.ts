import { useMemo } from 'react';
import { trpc, isBackendEnabled } from '@/lib/trpc';

export type AnalyticsFilters = {
  dateFrom?: string;
  dateTo?: string;
  ships?: string[];
  ports?: string[];
};

export type MergedCruiseRecord = {
  cruiseId: string;
  ship: string;
  departureDate: string;
  returnDate?: string;
  nights?: number;
  // Receipt side
  retailPrice?: number;
  amountPaid?: number;
  freePlay?: number;
  hasReceipts: boolean;
  receiptCount: number;
  // Statement side
  casinoSpend?: number;
  totalOnboard?: number;
  hasStatements: boolean;
  statementCount: number;
  // Derived
  savings: number;
  roi: number;
  valuePerPoint: number;
};

export type MergeConflict = {
  cruiseId?: string;
  ship?: string;
  departureDate?: string;
  type: 'duplicate-receipt-link' | 'duplicate-statement-link' | 'date-mismatch' | 'ship-mismatch';
  details: string;
};

function normalizeShip(name?: string): string {
  return (name || '').replace(/[®™]/g, '').trim().toLowerCase();
}

function withinRange(date: string, from?: string, to?: string): boolean {
  if (!from && !to) return true;
  const t = new Date(date).getTime();
  if (Number.isNaN(t)) return false;
  if (from && t < new Date(from).getTime()) return false;
  if (to && t > new Date(to).getTime()) return false;
  return true;
}

export function useMergedAnalytics(filters?: AnalyticsFilters) {
  // Source queries
  const receiptAnalytics = trpc.analytics.getReceiptAnalytics.useQuery(undefined, {
    enabled: isBackendEnabled,
  });

  const crossRef = trpc.directAnalytics.crossReferenceReceiptsAndStatements.useQuery(undefined, {
    enabled: isBackendEnabled,
  });

  const financialSummary = trpc.cruises.getCruiseFinancialSummary.useQuery({}, {
    enabled: isBackendEnabled,
  });

  const isLoading = !!isBackendEnabled && (
    receiptAnalytics.isLoading || crossRef.isLoading || financialSummary.isLoading
  );

  const isError = receiptAnalytics.isError || crossRef.isError || financialSummary.isError;

  const merged = useMemo(() => {
    const conflicts: MergeConflict[] = [];
    const records: MergedCruiseRecord[] = [];

    const byKey = new Map<string, MergedCruiseRecord>();

    const listA = receiptAnalytics.data?.cruiseBreakdown ?? [];
    for (const a of listA) {
      const key = `${normalizeShip(a.ship)}|${a.departureDate}`;
      if (!withinRange(a.departureDate, filters?.dateFrom, filters?.dateTo)) continue;
      if (filters?.ships && filters.ships.length > 0 && !filters.ships.map(normalizeShip).includes(normalizeShip(a.ship))) continue;

      const base: MergedCruiseRecord = {
        cruiseId: a.cruiseId,
        ship: a.ship,
        departureDate: a.departureDate,
        nights: undefined,
        hasReceipts: a.hasReceipts ?? true,
        receiptCount: a.receiptCount ?? 1,
        hasStatements: a.hasStatements ?? false,
        statementCount: a.statementCount ?? 0,
        retailPrice: a.retailPrice ?? 0,
        amountPaid: a.amountPaid ?? 0,
        freePlay: a.freePlay ?? 0,
        casinoSpend: a.clubRoyaleEntertainment ?? 0,
        totalOnboard: undefined,
        savings: Math.max(0, (a.retailPrice ?? 0) - (a.amountPaid ?? 0)),
        roi: (a.amountPaid ?? 0) > 0 ? (((a.retailPrice ?? 0) + (a.freePlay ?? 0) - (a.amountPaid ?? 0)) / (a.amountPaid ?? 1)) * 100 : 0,
        valuePerPoint: 0,
      };
      if (byKey.has(key)) {
        conflicts.push({ type: 'duplicate-receipt-link', details: `Duplicate receipt match for ${key}`, ship: a.ship, departureDate: a.departureDate });
      }
      byKey.set(key, base);
    }

    const listB = crossRef.data?.cruises ?? [];
    for (const b of listB) {
      const ship = b.cruise?.ship ?? '';
      const date = b.cruise?.departureDate ?? '';
      if (!ship || !date) continue;
      if (!withinRange(date, filters?.dateFrom, filters?.dateTo)) continue;
      if (filters?.ships && filters.ships.length > 0 && !filters.ships.map(normalizeShip).includes(normalizeShip(ship))) continue;

      const key = `${normalizeShip(ship)}|${date}`;
      const existing = byKey.get(key);
      const retailFromReceipts = b.analytics?.totalReceiptSpending ?? 0;
      const onboardFromStatements = b.analytics?.totalStatementSpending ?? 0;

      if (existing) {
        existing.hasStatements = b.analytics?.hasStatementData ?? existing.hasStatements;
        existing.statementCount = b.analytics?.statementCount ?? existing.statementCount;
        existing.totalOnboard = onboardFromStatements;
        // If receipt side missing, fill
        if (!existing.retailPrice || existing.retailPrice === 0) existing.retailPrice = retailFromReceipts;
        if (!existing.amountPaid || existing.amountPaid === 0) existing.amountPaid = retailFromReceipts;
        existing.savings = Math.max(0, (existing.retailPrice ?? 0) - (existing.amountPaid ?? 0));
        existing.roi = (existing.amountPaid ?? 0) > 0 ? (((existing.retailPrice ?? 0) + (existing.freePlay ?? 0) - (existing.amountPaid ?? 0)) / (existing.amountPaid ?? 1)) * 100 : 0;
      } else {
        byKey.set(key, {
          cruiseId: b.cruise.id,
          ship,
          departureDate: date,
          returnDate: b.cruise.returnDate,
          nights: b.cruise.nights,
          hasReceipts: b.analytics?.hasReceiptData ?? false,
          receiptCount: b.analytics?.receiptCount ?? 0,
          hasStatements: b.analytics?.hasStatementData ?? false,
          statementCount: b.analytics?.statementCount ?? 0,
          retailPrice: retailFromReceipts,
          amountPaid: retailFromReceipts,
          freePlay: 0,
          casinoSpend: onboardFromStatements,
          totalOnboard: onboardFromStatements,
          savings: Math.max(0, retailFromReceipts - retailFromReceipts),
          roi: 0,
          valuePerPoint: 0,
        });
      }
    }

    const finList = financialSummary.data?.cruiseFinancials ?? [];
    for (const f of finList) {
      const key = `${normalizeShip(f.ship)}|${f.departureDate}`;
      const existing = byKey.get(key);
      if (!withinRange(f.departureDate, filters?.dateFrom, filters?.dateTo)) continue;
      if (filters?.ships && filters.ships.length > 0 && !filters.ships.map(normalizeShip).includes(normalizeShip(f.ship))) continue;

      const points = f.financial.pointsEarned ?? 0;
      if (existing) {
        const retail = f.financial.totalRetailValue ?? existing.retailPrice ?? 0;
        const paid = f.financial.totalPaid ?? existing.amountPaid ?? 0;
        existing.retailPrice = retail;
        existing.amountPaid = paid;
        existing.casinoSpend = f.financial.casinoSpend ?? existing.casinoSpend;
        existing.savings = Math.max(0, retail - paid);
        existing.roi = paid > 0 ? (((retail + (existing.freePlay ?? 0)) - paid) / paid) * 100 : existing.roi;
        existing.valuePerPoint = points > 0 ? existing.savings / points : 0;
      } else {
        byKey.set(key, {
          cruiseId: f.cruiseId,
          ship: f.ship,
          departureDate: f.departureDate,
          nights: f.nights,
          hasReceipts: f.hasReceiptData,
          receiptCount: f.hasReceiptData ? 1 : 0,
          hasStatements: f.hasStatementData,
          statementCount: f.hasStatementData ? 1 : 0,
          retailPrice: f.financial.totalRetailValue ?? 0,
          amountPaid: f.financial.totalPaid ?? 0,
          freePlay: 0,
          casinoSpend: f.financial.casinoSpend ?? 0,
          totalOnboard: f.financial.totalSpent ?? 0,
          savings: Math.max(0, (f.financial.totalRetailValue ?? 0) - (f.financial.totalPaid ?? 0)),
          roi: (f.financial.totalPaid ?? 0) > 0 ? (((f.financial.totalRetailValue ?? 0) - (f.financial.totalPaid ?? 0)) / (f.financial.totalPaid ?? 1)) * 100 : 0,
          valuePerPoint: points > 0 ? ((f.financial.totalRetailValue ?? 0) - (f.financial.totalPaid ?? 0)) / points : 0,
        });
      }
    }

    byKey.forEach((v) => records.push(v));

    records.sort((a, b) => new Date(b.departureDate).getTime() - new Date(a.departureDate).getTime());

    return { records, conflicts };
  }, [receiptAnalytics.data, crossRef.data, financialSummary.data, filters?.dateFrom, filters?.dateTo, filters?.ships?.join(','), filters?.ports?.join(',')]);

  return {
    isLoading,
    isError,
    errors: {
      receipt: receiptAnalytics.error,
      crossRef: crossRef.error,
      financial: financialSummary.error,
    },
    merged,
    sources: {
      receiptAnalytics: receiptAnalytics.data,
      crossRef: crossRef.data,
      financialSummary: financialSummary.data,
    },
    refetchAll: async () => {
      await Promise.all([
        receiptAnalytics.refetch(),
        crossRef.refetch(),
        financialSummary.refetch(),
      ]);
    },
  } as const;
}
