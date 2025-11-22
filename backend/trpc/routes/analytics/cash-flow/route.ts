import { z } from "zod";
import { protectedProcedure } from "../../../create-context";
import { memoryStore } from "../../_stores/memory";
import type { FinancialsRecord, BookedCruise, CasinoOffer } from "@/types/models";

interface MonthlyProjection {
  month: string;
  year: number;
  cruiseSpend: number;
  certificatesUsed: number;
  netCash: number;
  cruisesBooked: number;
  projectedPoints: number;
}

interface CertificateBalance {
  type: string;
  count: number;
  totalValue: number;
  expiringIn30Days: number;
  expiringIn60Days: number;
  expiringIn90Days: number;
}

interface SpendingPaceAlert {
  type: "warning" | "danger" | "info";
  message: string;
  currentPace: number;
  targetPace: number;
  variance: number;
}

export const cashFlowProcedure = protectedProcedure
  .input(
    z.object({
      monthsAhead: z.number().min(1).max(24).default(12),
      monthlyBudget: z.number().optional(),
      yearlyBudget: z.number().optional(),
    })
  )
  .query(async ({ input, ctx }) => {
    const userId = "default";
    const cruises = memoryStore.getCruises();
    const bookedCruises = memoryStore.getBookedCruises();
    const financials = memoryStore.getFinancials();
    const offers = memoryStore.getCasinoOffers();

    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();

    const monthlyProjections: MonthlyProjection[] = [];
    let cumulativeCash = 0;

    const historicalData = financials.slice(-12);
    const avgMonthlySpend =
      historicalData.reduce((sum: number, f: FinancialsRecord) => sum + Math.abs(f.amount || 0), 0) /
      Math.max(historicalData.length, 1);

    for (let i = 0; i < input.monthsAhead; i++) {
      const projMonth = new Date(currentYear, currentMonth + i, 1);
      const monthStr = projMonth.toLocaleDateString("en-US", {
        month: "short",
        year: "numeric",
      });

      const cruisesInMonth = bookedCruises.filter((cruise: any) => {
        if (!cruise.sailDate) return false;
        const sailDate = new Date(cruise.sailDate);
        return (
          sailDate.getMonth() === projMonth.getMonth() &&
          sailDate.getFullYear() === projMonth.getFullYear()
        );
      });

      let monthSpend = 0;
      let certificatesUsed = 0;
      let projectedPoints = 0;

      cruisesInMonth.forEach((cruise: any) => {
        const cruisePrice = cruise.totalPrice || cruise.cruisePrice || 0;
        monthSpend += cruisePrice;

        if (cruise.onboardCredit) {
          certificatesUsed += cruise.onboardCredit;
        }

        projectedPoints +=
          ((cruise.estimatedCoinIn || 0) / 5) * (cruise.pointsMultiplier || 1);
      });

      if (cruisesInMonth.length === 0 && i < 6) {
        monthSpend = avgMonthlySpend * 0.8;
        projectedPoints = 5000;
      }

      const netCash = monthSpend - certificatesUsed;
      cumulativeCash += netCash;

      monthlyProjections.push({
        month: monthStr,
        year: projMonth.getFullYear(),
        cruiseSpend: monthSpend,
        certificatesUsed,
        netCash,
        cruisesBooked: cruisesInMonth.length,
        projectedPoints,
      });
    }

    const certificateBalances: CertificateBalance[] = [];
    const certificateTypes = new Map<string, number[]>();

    offers.forEach((offer: CasinoOffer) => {
      if (offer.onboardCredit && offer.onboardCredit > 0) {
        const key = `$${offer.onboardCredit} OBC`;
        if (!certificateTypes.has(key)) {
          certificateTypes.set(key, []);
        }
        certificateTypes.get(key)!.push(offer.onboardCredit);
      }

      if (offer.freePlay && offer.freePlay > 0) {
        const key = `$${offer.freePlay} Free Play`;
        if (!certificateTypes.has(key)) {
          certificateTypes.set(key, []);
        }
        certificateTypes.get(key)!.push(offer.freePlay);
      }
    });

    certificateTypes.forEach((values, type) => {
      const totalValue = values.reduce((sum, val) => sum + val, 0);
      certificateBalances.push({
        type,
        count: values.length,
        totalValue,
        expiringIn30Days: Math.floor(values.length * 0.1),
        expiringIn60Days: Math.floor(values.length * 0.15),
        expiringIn90Days: Math.floor(values.length * 0.2),
      });
    });

    const spendingAlerts: SpendingPaceAlert[] = [];
    const next3MonthsSpend = monthlyProjections
      .slice(0, 3)
      .reduce((sum, m) => sum + m.netCash, 0);
    const avgMonthlyProjected = next3MonthsSpend / 3;

    if (input.monthlyBudget) {
      const variance =
        ((avgMonthlyProjected - input.monthlyBudget) / input.monthlyBudget) *
        100;

      if (variance > 20) {
        spendingAlerts.push({
          type: "danger",
          message: `Your projected spending is ${variance.toFixed(0)}% over monthly budget`,
          currentPace: avgMonthlyProjected,
          targetPace: input.monthlyBudget,
          variance,
        });
      } else if (variance > 10) {
        spendingAlerts.push({
          type: "warning",
          message: `You're trending ${variance.toFixed(0)}% over monthly budget`,
          currentPace: avgMonthlyProjected,
          targetPace: input.monthlyBudget,
          variance,
        });
      } else {
        spendingAlerts.push({
          type: "info",
          message: "Spending is within budget targets",
          currentPace: avgMonthlyProjected,
          targetPace: input.monthlyBudget,
          variance,
        });
      }
    }

    const yearlyProjectedSpend = monthlyProjections
      .slice(0, 12)
      .reduce((sum, m) => sum + m.netCash, 0);

    if (input.yearlyBudget) {
      const yearlyVariance =
        ((yearlyProjectedSpend - input.yearlyBudget) / input.yearlyBudget) *
        100;

      if (yearlyVariance > 15) {
        spendingAlerts.push({
          type: "danger",
          message: `Annual projection is ${yearlyVariance.toFixed(0)}% over yearly budget`,
          currentPace: yearlyProjectedSpend,
          targetPace: input.yearlyBudget,
          variance: yearlyVariance,
        });
      }
    }

    const totalCertificateValue = certificateBalances.reduce(
      (sum, cert) => sum + cert.totalValue,
      0
    );

    const redemptionStrategy = {
      immediateAction: [] as string[],
      upcomingOpportunities: [] as string[],
      longTermPlan: [] as string[],
    };

    certificateBalances.forEach((cert) => {
      if (cert.expiringIn30Days > 0) {
        redemptionStrategy.immediateAction.push(
          `Use ${cert.expiringIn30Days} ${cert.type} expiring in 30 days`
        );
      }
      if (cert.expiringIn60Days > 0) {
        redemptionStrategy.upcomingOpportunities.push(
          `Plan to use ${cert.expiringIn60Days} ${cert.type} within 60 days`
        );
      }
      if (cert.count > cert.expiringIn30Days + cert.expiringIn60Days) {
        const remaining =
          cert.count - cert.expiringIn30Days - cert.expiringIn60Days;
        redemptionStrategy.longTermPlan.push(
          `${remaining} ${cert.type} available for future bookings`
        );
      }
    });

    const summary = {
      totalProjectedSpend: yearlyProjectedSpend,
      totalCertificateValue,
      netProjectedCash: yearlyProjectedSpend - totalCertificateValue * 0.3,
      avgMonthlySpend: avgMonthlyProjected,
      totalCruisesProjected: monthlyProjections.reduce(
        (sum, m) => sum + m.cruisesBooked,
        0
      ),
      totalProjectedPoints: monthlyProjections.reduce(
        (sum, m) => sum + m.projectedPoints,
        0
      ),
    };

    return {
      monthlyProjections,
      certificateBalances,
      redemptionStrategy,
      spendingAlerts,
      summary,
      metadata: {
        generatedAt: new Date().toISOString(),
        projectionPeriod: `${input.monthsAhead} months`,
        budgetTracking: {
          monthly: input.monthlyBudget || null,
          yearly: input.yearlyBudget || null,
        },
      },
    };
  });
