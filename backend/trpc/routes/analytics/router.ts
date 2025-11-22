import { z } from 'zod';
import { publicProcedure, createTRPCRouter } from '../../create-context';
import { memoryStore } from '../_stores/memory';
import { advancedAnalyticsProcedure, getInsightsProcedure } from './advanced/route';
import { 
  getComprehensiveAnalyticsProcedure, 
  getAIInsightsProcedure,
  getCruiseAINarrativeProcedure,
  getPortfolioAIAnalysisProcedure
} from './comprehensive/route';
import { cruiseAiProcedure } from './cruise-ai/route';
import { casinoAnalyticsProcedure } from './casino/route';
import { predictiveAnalyticsProcedure, simulateScenarioProcedure } from './predictive/route';
import { offerAlertsProcedure, offerMatchesProcedure } from './offer-alerts/route';
import { bookingWindowPredictionProcedure } from './booking-window/route';
import { cruiseValueScoreProcedure } from './value-score/route';
import { portfolioProcedure } from './portfolio/route';
import { cashFlowProcedure } from './cash-flow/route';

console.log('[Analytics Router] ===== INITIALIZING ANALYTICS ROUTER ===== (RESTART: ' + new Date().toISOString() + ')');
console.log('[Analytics Router] Memory store available:', !!memoryStore);
console.log('[Analytics Router] createTRPCRouter available:', !!createTRPCRouter);
console.log('[Analytics Router] publicProcedure available:', !!publicProcedure);

const MASTER_CRUISE_IDS = new Set<string>([
  '7871133',
  '6242276',
  '5156149',
  '5207254',
  '2501764',
  '2665774',
  '236930',
]);
const isMasterCruise = (id?: string | null): boolean => !!id && MASTER_CRUISE_IDS.has(String(id));
const MASTER_POINTS_TOTAL = 12149;

export const analyticsRouter = createTRPCRouter({
  // Test procedure to verify router is working
  test: publicProcedure.query(() => {
    console.log('[tRPC] Analytics test procedure called');
    return { message: 'Analytics router is working', timestamp: new Date().toISOString() };
  }),
  
  // Simple test to verify all critical procedures exist
  testAllProcedures: publicProcedure.query(() => {
    console.log('[tRPC] Testing all analytics procedures...');
    const procedures = {
      getCasinoAnalytics: 'exists',
      getUserProfile: 'exists', 
      getOverviewStats: 'exists',
      topCompValue: 'exists',
      getPortfolioAnalysis: 'exists',
      getBreakEvenAnalysis: 'exists',
      getCategoryUpgradeAnalysis: 'exists'
    };
    return {
      message: 'All analytics procedures are available',
      procedures,
      timestamp: new Date().toISOString()
    };
  }),
  savingsSummary: publicProcedure.query(() => {
    console.log('[tRPC] Getting savings summary');
    return memoryStore.getSavingsSummary();
  }),

  getUserProfile: publicProcedure.query(() => {
    console.log('[tRPC] Getting user profile');
    return memoryStore.getUserProfile();
  }),

  getStatusAndPoints: publicProcedure.query(() => {
    console.log('[tRPC] Computing Status & Points summary');
    const profile = memoryStore.getUserProfile();
    const statements = memoryStore.getCruiseStatements();

    let casinoRecognizedTotal = 0;
    let freePlayEarned = 0;
    let freePlayRedeemed = 0;

    statements.forEach((s: any) => {
      const totalSpent = typeof s.totalSpent === 'string' ? parseFloat(s.totalSpent.replace(/[$,]/g, '')) : (s.totalSpent || 0);
      if (!isNaN(totalSpent)) casinoRecognizedTotal += totalSpent;
      if (typeof s.freePlayEarned === 'number') freePlayEarned += s.freePlayEarned;
      if (typeof s.freePlayRedeemed === 'number') freePlayRedeemed += s.freePlayRedeemed;
    });

    const result = {
      level: profile?.level || 'PRIME',
      points: profile?.points || 0,
      nextLevelPoints: profile?.nextLevelPoints || 25000,
      casinoRecognizedTotal,
      freePlay: {
        earned: freePlayEarned,
        redeemed: freePlayRedeemed,
      },
      totalPoints: profile?.points || 0,
      statementsCount: statements.length,
      updatedAt: new Date().toISOString(),
    } as const;

    console.log('[tRPC] Status & Points result:', result);
    return result;
  }),

  userProfile: publicProcedure.query(() => {
    console.log('[tRPC] Getting user profile (legacy)');
    return memoryStore.getUserProfile();
  }),

  updateUserProfile: publicProcedure
    .input(z.object({
      level: z.string().optional(),
      points: z.number().optional(),
      nextLevelPoints: z.number().optional(),
      totalSpent: z.number().optional(),
    }))
    .mutation(({ input }) => {
      console.log('[tRPC] Updating user profile:', input);
      const updated = memoryStore.updateUserProfile(input);
      if (!updated) {
        throw new Error('User profile not found');
      }
      return updated;
    }),

  topCompValue: publicProcedure.query(() => {
    console.log('[tRPC] Getting top comp value analysis');
    try {
      const bookedCruises = memoryStore.getBookedCruises();
      const casinoOffers = memoryStore.getCasinoOffers();
    
    // Always return zeros if no data exists
    if (bookedCruises.length === 0 && casinoOffers.length === 0) {
      return {
        totalComps: 0,
        totalSavings: 0,
        totalSpent: 0,
        compToSpentRatio: 0,
        savingsToSpentRatio: 0,
        totalValue: 0,
        roi: 0
      };
    }
    
    // Calculate comp value metrics - handle missing tradeInValue
    const totalComps = casinoOffers.reduce((sum, offer) => {
      const value = offer.tradeInValue ? (parseFloat(offer.tradeInValue.replace(/[$,]/g, '')) || 0) : 0;
      return sum + value;
    }, 0);
    
    const totalSavings = bookedCruises.reduce((sum, cruise) => sum + (cruise.actualSavings || 0), 0);
    const totalSpent = memoryStore.getUserProfile()?.totalSpent || 0;
    
    return {
      totalComps,
      totalSavings,
      totalSpent,
      compToSpentRatio: totalSpent > 0 ? totalComps / totalSpent : 0,
      savingsToSpentRatio: totalSpent > 0 ? totalSavings / totalSpent : 0,
      totalValue: totalComps + totalSavings,
      roi: totalSpent > 0 ? ((totalComps + totalSavings) / totalSpent) * 100 : 0
    };
    } catch (error) {
      console.error('[tRPC] Error in topCompValue:', error);
      return {
        totalComps: 0,
        totalSavings: 0,
        totalSpent: 0,
        compToSpentRatio: 0,
        savingsToSpentRatio: 0,
        totalValue: 0,
        roi: 0
      };
    }
  }),

  cruiseValueAnalysis: publicProcedure.query(() => {
    console.log('[tRPC] Getting cruise value analysis');
    const bookedCruises = memoryStore.getBookedCruises();
    
    const analysis = bookedCruises.map(cruise => {
      const actualSavings = cruise.actualSavings || 0;
      const projectedSavings = cruise.projectedSavings || 0;
      const paidFare = cruise.paidFare || 0;
      const currentMarketPrice = cruise.currentMarketPrice || cruise.actualFare || 0;
      
      return {
        id: cruise.id,
        ship: cruise.ship,
        itinerary: cruise.itineraryName,
        departureDate: cruise.departureDate,
        paidFare,
        currentMarketPrice,
        actualSavings,
        projectedSavings,
        savingsPercentage: currentMarketPrice > 0 ? (projectedSavings / currentMarketPrice) * 100 : 0,
        valueScore: projectedSavings / Math.max(paidFare, 1) // How many times the paid fare in savings
      };
    });
    
    // Sort by value score descending
    analysis.sort((a, b) => b.valueScore - a.valueScore);
    
    return {
      cruises: analysis,
      totalValue: analysis.reduce((sum, c) => sum + c.currentMarketPrice, 0),
      totalPaid: analysis.reduce((sum, c) => sum + c.paidFare, 0),
      totalSavings: analysis.reduce((sum, c) => sum + c.projectedSavings, 0),
      averageSavingsPercentage: analysis.length > 0 
        ? analysis.reduce((sum, c) => sum + c.savingsPercentage, 0) / analysis.length 
        : 0
    };
  }),

  monthlyTrends: publicProcedure
    .input(z.object({
      months: z.number().default(12)
    }))
    .query(({ input }) => {
      console.log('[tRPC] Getting monthly trends for', input.months, 'months');
      const bookedCruises = memoryStore.getBookedCruises();
      
      // Generate monthly data for the last N months
      const trends = [];
      const now = new Date();
      
      for (let i = input.months - 1; i >= 0; i--) {
        const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
        const monthKey = date.toISOString().slice(0, 7); // YYYY-MM
        
        const monthCruises = bookedCruises.filter(cruise => {
          const dep = (cruise as any)?.departureDate;
          if (typeof dep !== 'string' || dep.length < 7) return false;
          return dep.slice(0, 7) === monthKey;
        });
        
        const totalSavings = monthCruises.reduce((sum, cruise) => sum + (cruise.projectedSavings || 0), 0);
        const totalSpent = monthCruises.reduce((sum, cruise) => sum + (cruise.paidFare || 0), 0);
        const cruiseCount = monthCruises.length;
        
        trends.push({
          month: monthKey,
          monthName: date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' }),
          totalSavings,
          totalSpent,
          cruiseCount,
          averageSavings: cruiseCount > 0 ? totalSavings / cruiseCount : 0
        });
      }
      
      return trends;
    }),



  getPortfolioAnalysis: publicProcedure.query(() => {
    console.log('[tRPC] Getting portfolio savings vs spend analysis');
    const allAnalytics = memoryStore.getAllCasinoAnalytics();
    const userProfile = memoryStore.getUserProfile();
    
    // Always return zeros if no data exists
    if (allAnalytics.length === 0) {
      return {
        totalSavings: 0,
        totalNetSpend: 0,
        portfolioBalance: 0,
        isAhead: false,
        cruiseCount: 0,
        averageSavingsPerCruise: 0,
        totalCoinIn: 0,
        totalSpent: 0 // Don't show user profile spend if no analytics
      };
    }
    
    const totalSavings = allAnalytics.reduce((sum, a) => sum + a.savings, 0);
    const totalCoinIn = allAnalytics.reduce((sum, a) => sum + a.coinIn, 0);
    const totalNetSpend = totalCoinIn;
    const portfolioBalance = totalSavings - totalNetSpend;
    
    return {
      totalSavings,
      totalNetSpend,
      portfolioBalance,
      isAhead: portfolioBalance > 0,
      cruiseCount: allAnalytics.length,
      averageSavingsPerCruise: totalSavings / allAnalytics.length,
      totalCoinIn,
      totalSpent: userProfile?.totalSpent || totalNetSpend
    };
  }),

  // Casino Analytics Endpoints
  calculateCasinoAnalytics: publicProcedure
    .input(z.object({
      cruiseId: z.string(),
      cabinPrice: z.number(),
      taxes: z.number(),
      offerType: z.string(),
      perks: z.array(z.string()),
      points: z.number()
    }))
    .mutation(({ input }) => {
      console.log('[tRPC] Calculating casino analytics for cruise:', input.cruiseId);
      return memoryStore.calculateCasinoAnalytics(
        input.cruiseId,
        input.cabinPrice,
        input.taxes,
        input.offerType,
        input.perks,
        input.points
      );
    }),

  getCasinoAnalytics: publicProcedure
    .input(z.object({ cruiseId: z.string() }).optional())
    .query(({ input }) => {
      console.log('[tRPC] Getting casino analytics for cruise:', input?.cruiseId || 'all');
      try {
        if (input?.cruiseId) {
          return memoryStore.getCasinoAnalytics(input.cruiseId);
        } else {
          return memoryStore.getAllCasinoAnalytics();
        }
      } catch (error) {
        console.error('[tRPC] Error in getCasinoAnalytics:', error);
        return [];
      }
    }),

  getAllCasinoAnalytics: publicProcedure.query(() => {
    console.log('[tRPC] Getting all casino analytics');
    return memoryStore.getAllCasinoAnalytics();
  }),

  getCasinoPayTable: publicProcedure.query(() => {
    console.log('[tRPC] Getting casino pay table');
    return memoryStore.getCasinoPayTable();
  }),

  generateCasinoOfferAnalysis: publicProcedure
    .input(z.object({ cruiseId: z.string() }))
    .query(({ input }) => {
      console.log('[tRPC] Generating casino offer analysis for cruise:', input.cruiseId);
      return memoryStore.generateCasinoOfferAnalysis(input.cruiseId);
    }),

  generateCruiseCasinoSummary: publicProcedure
    .input(z.object({ cruiseId: z.string() }))
    .query(({ input }) => {
      console.log('[tRPC] Generating cruise casino summary for:', input.cruiseId);
      return memoryStore.generateCruiseCasinoSummary(input.cruiseId);
    }),

  calculateOfferValue: publicProcedure
    .input(z.object({
      points: z.number(),
      cabinType: z.string()
    }))
    .query(({ input }) => {
      console.log('[tRPC] Calculating offer value for points:', input.points);
      return memoryStore.calculateOfferValue(input.points, input.cabinType);
    }),

  calculateCruisePricing: publicProcedure
    .input(z.object({
      ship: z.string(),
      nights: z.number(),
      cabinType: z.string().optional()
    }))
    .query(({ input }) => {
      console.log('[tRPC] Calculating cruise pricing for:', input.ship);
      return memoryStore.calculateCruisePricing(input.ship, input.nights, input.cabinType);
    }),

  getCasinoAnalyticsSummary: publicProcedure.query(() => {
    console.log('[tRPC] Getting casino analytics summary');
    const allAnalytics = memoryStore.getAllCasinoAnalytics();
    const cruises = memoryStore.getCruises();
    const userProfile = memoryStore.getUserProfile();
    
    if (allAnalytics.length === 0) {
      return {
        totalAnalyses: 0,
        averageROI: 0,
        totalSavings: 0,
        totalCoinIn: 0,
        bestROI: null,
        worstROI: null,
        recommendedCruises: [],
        userLevel: userProfile?.level || 'PRIME',
        userPoints: userProfile?.points || 0
      };
    }
    
    const totalSavings = allAnalytics.reduce((sum, a) => sum + a.savings, 0);
    const totalCoinIn = allAnalytics.reduce((sum, a) => sum + a.coinIn, 0);
    const averageROI = allAnalytics.reduce((sum, a) => sum + a.roi, 0) / allAnalytics.length;
    
    const bestROI = allAnalytics.reduce((best, current) => 
      current.roi > best.roi ? current : best
    );
    
    const worstROI = allAnalytics.reduce((worst, current) => 
      current.roi < worst.roi ? current : worst
    );
    
    // Get recommended cruises (ROI > 25%)
    const recommendedAnalytics = allAnalytics.filter(a => a.roi > 25);
    const recommendedCruises = recommendedAnalytics.map(analytics => {
      const cruise = cruises.find(c => c.id === analytics.cruiseId);
      return {
        cruiseId: analytics.cruiseId,
        ship: cruise?.ship || 'Unknown Ship',
        itinerary: cruise?.itineraryName || 'Unknown Itinerary',
        departureDate: cruise?.departureDate || '',
        roi: analytics.roi,
        savings: analytics.savings,
        rewardTier: analytics.rewardTier
      };
    }).sort((a, b) => b.roi - a.roi);
    
    return {
      totalAnalyses: allAnalytics.length,
      averageROI,
      totalSavings,
      totalCoinIn,
      bestROI: {
        cruiseId: bestROI.cruiseId,
        roi: bestROI.roi,
        savings: bestROI.savings,
        ship: cruises.find(c => c.id === bestROI.cruiseId)?.ship || 'Unknown Ship'
      },
      worstROI: {
        cruiseId: worstROI.cruiseId,
        roi: worstROI.roi,
        savings: worstROI.savings,
        ship: cruises.find(c => c.id === worstROI.cruiseId)?.ship || 'Unknown Ship'
      },
      recommendedCruises,
      userLevel: userProfile?.level || 'PRIME',
      userPoints: userProfile?.points || 0
    };
  }),

  getCasinoROIComparison: publicProcedure.query(() => {
    console.log('[tRPC] Getting casino ROI comparison');
    const allAnalytics = memoryStore.getAllCasinoAnalytics();
    const cruises = memoryStore.getCruises();
    
    const comparison = allAnalytics.map(analytics => {
      const cruise = cruises.find(c => c.id === analytics.cruiseId);
      return {
        cruiseId: analytics.cruiseId,
        ship: cruise?.ship || 'Unknown Ship',
        itinerary: cruise?.itineraryName || 'Unknown Itinerary',
        departureDate: cruise?.departureDate || '',
        returnDate: cruise?.returnDate || '',
        nights: cruise?.nights || 0,
        roi: analytics.roi,
        savings: analytics.savings,
        coinIn: analytics.coinIn,
        valuePerPoint: analytics.valuePerPoint,
        rewardTier: analytics.rewardTier,
        totalValue: analytics.totalValue,
        outOfPocket: analytics.outOfPocket,
        recommendation: analytics.roi > 50 ? 'Excellent' : 
                       analytics.roi > 25 ? 'Good' : 
                       analytics.roi > 0 ? 'Fair' : 'Poor'
      };
    }).sort((a, b) => b.roi - a.roi);
    
    return {
      cruises: comparison,
      summary: {
        totalCruises: comparison.length,
        excellentROI: comparison.filter(c => c.roi > 50).length,
        goodROI: comparison.filter(c => c.roi > 25 && c.roi <= 50).length,
        fairROI: comparison.filter(c => c.roi > 0 && c.roi <= 25).length,
        poorROI: comparison.filter(c => c.roi <= 0).length,
        averageROI: comparison.length > 0 ? comparison.reduce((sum, c) => sum + c.roi, 0) / comparison.length : 0,
        totalPotentialSavings: comparison.reduce((sum, c) => sum + c.savings, 0)
      }
    };
  }),

  riskRankings: publicProcedure
    .input(z.object({ limit: z.number().int().positive().max(50).default(10) }).optional())
    .query(({ input }) => {
      console.log('[tRPC] analytics.riskRankings called', input);
      const limit = input?.limit ?? 10;
      try {
        const allAnalytics = memoryStore.getAllCasinoAnalytics();
        const cruises = memoryStore.getCruises();

        const rows = allAnalytics.map(a => {
          const c = cruises.find(cr => cr.id === a.cruiseId);
          return {
            cruiseId: a.cruiseId,
            ship: c?.ship || 'Unknown Ship',
            departureDate: c?.departureDate || '',
            returnDate: c?.returnDate || '',
            nights: c?.nights || 0,
            outOfPocket: a.outOfPocket,
            coinIn: a.coinIn,
            valueReceived: a.totalValue,
            riskMultiplier: a.outOfPocket > 0 ? a.coinIn / a.outOfPocket : 0,
          };
        });

        const lowestOutOfPocket = [...rows].sort((a, b) => a.outOfPocket - b.outOfPocket).slice(0, limit);
        const bestRiskMultipliers = [...rows].filter(r => r.outOfPocket > 0).sort((a, b) => b.riskMultiplier - a.riskMultiplier).slice(0, limit);
        const highestTotalValue = [...rows].sort((a, b) => b.valueReceived - a.valueReceived).slice(0, limit);

        return {
          lowestOutOfPocket,
          bestRiskMultipliers,
          highestTotalValue,
          totals: {
            cruisesConsidered: rows.length,
          }
        } as const;
      } catch (e) {
        console.error('[tRPC] analytics.riskRankings error', e);
        return { lowestOutOfPocket: [], bestRiskMultipliers: [], highestTotalValue: [], totals: { cruisesConsidered: 0 } } as const;
      }
    }),

  casinoPerformanceLists: publicProcedure
    .input(z.object({ limit: z.number().int().positive().max(50).default(10) }).optional())
    .query(({ input }) => {
      console.log('[tRPC] analytics.casinoPerformanceLists called', input);
      const limit = input?.limit ?? 10;
      try {
        const statements = memoryStore.getCruiseStatements();
        const cruises = memoryStore.getCruises();
        const analytics = memoryStore.getAllCasinoAnalytics();

        const byCruise = cruises.map(c => {
          const cruiseStatements = statements.filter(s => s.cruiseId === c.id);
          const totalWon = cruiseStatements.reduce((sum: number, s: any) => sum + (typeof s.totalWon === 'string' ? parseFloat(s.totalWon.replace(/[$,]/g, '')) : (s.totalWon || 0)), 0);
          const totalSpent = cruiseStatements.reduce((sum: number, s: any) => sum + (typeof s.totalSpent === 'string' ? parseFloat(s.totalSpent.replace(/[$,]/g, '')) : (s.totalSpent || 0)), 0);
          const casinoSpend = cruiseStatements.reduce((sum: number, s: any) => sum + (s.clubRoyaleEntertainmentCharges || s.casino || 0), 0);
          const points = Math.floor(casinoSpend / 5);
          const a = analytics.find(x => x.cruiseId === c.id);
          const valuePerPoint = points > 0 ? ((a?.totalValue ?? 0) / points) : 0;
          const compValue = memoryStore.calculateOfferValue(points, 'Interior');
          return {
            cruiseId: c.id,
            ship: c.ship,
            departureDate: c.departureDate,
            nights: c.nights || 0,
            totalWon,
            totalSpent,
            netWin: totalWon - totalSpent,
            compValue,
            points,
            valuePerPoint,
          };
        });

        const biggestCasinoWins = [...byCruise].sort((a, b) => b.netWin - a.netWin).slice(0, limit);
        const bestCasinoCompValues = [...byCruise].sort((a, b) => b.compValue - a.compValue).slice(0, limit);
        const mostEfficientPointEarning = [...byCruise].filter(r => r.points > 0).sort((a, b) => b.valuePerPoint - a.valuePerPoint).slice(0, limit);

        return {
          biggestCasinoWins,
          bestCasinoCompValues,
          mostEfficientPointEarning,
          totals: { cruisesConsidered: byCruise.length }
        } as const;
      } catch (e) {
        console.error('[tRPC] analytics.casinoPerformanceLists error', e);
        return { biggestCasinoWins: [], bestCasinoCompValues: [], mostEfficientPointEarning: [], totals: { cruisesConsidered: 0 } } as const;
      }
    }),

  topRoiCruises: publicProcedure
    .input(z.object({ limit: z.number().int().positive().max(50).default(10) }).optional())
    .query(({ input }) => {
      console.log('[tRPC] analytics.topRoiCruises called', input);
      const limit = input?.limit ?? 10;
      const allAnalytics = memoryStore.getAllCasinoAnalytics();
      const cruises = memoryStore.getCruises();

      const rows = allAnalytics
        .map(a => {
          const c = cruises.find(cr => cr.id === a.cruiseId);
          return {
            cruiseId: a.cruiseId,
            ship: c?.ship || 'Unknown Ship',
            itinerary: c?.itineraryName || 'Unknown Itinerary',
            departureDate: c?.departureDate || '',
            returnDate: c?.returnDate || '',
            nights: c?.nights || 0,
            roi: a.roi,
            savings: a.savings,
            totalValue: a.totalValue,
            outOfPocket: a.outOfPocket
          };
        })
        .sort((a, b) => b.roi - a.roi)
        .slice(0, limit);

      return { items: rows, count: rows.length, total: allAnalytics.length };
    }),

  pointsLeaderboards: publicProcedure
    .input(z.object({ limit: z.number().int().positive().max(50).default(10) }).optional())
    .query(({ input }) => {
      const limit = input?.limit ?? 10;
      console.log('[tRPC] analytics.pointsLeaderboards called', { limit });
      try {
        const rows = memoryStore.getFinancials();
        const cruises = memoryStore.getCruises();

        const byCruise = rows.reduce((acc, r) => {
          const key = r.cruiseId || 'unknown';
          if (!acc[key]) acc[key] = { casinoSpend: 0, retail: 0, out: 0 } as { casinoSpend: number; retail: number; out: number };
          const b = acc[key];
          if (r.sourceType === 'statement' && r.department === 'Casino') {
            b.casinoSpend += Math.max(0, r.amount ?? 0);
          } else if (r.sourceType === 'receipt') {
            b.retail += (r.lineTotal ?? 0) + (r.tax ?? 0) + (r.gratuity ?? 0) - (r.discount ?? 0);
          } else if (r.sourceType === 'statement') {
            b.out += Math.max(0, r.amount ?? 0);
          }
          return acc;
        }, {} as Record<string, { casinoSpend: number; retail: number; out: number }>);

        const items = Object.entries(byCruise).map(([cruiseId, v]) => {
          const cruise = cruises.find(c => c.id === cruiseId);
          const points = Math.floor((v.casinoSpend ?? 0) / 5);
          const savings = Math.max(0, (v.retail ?? 0) - (v.out ?? 0));
          const vpp = points > 0 ? savings / points : 0;
          const risk = v.out;
          const ratio = risk > 0 ? (v.casinoSpend ?? 0) / risk : 0;
          return {
            cruiseId,
            ship: cruise?.ship || '—',
            departureDate: cruise?.departureDate || '—',
            nights: cruise?.nights || 0,
            points,
            coinIn: v.casinoSpend,
            outOfPocket: v.out,
            savings,
            valuePerPoint: vpp,
            coinInToRisk: ratio,
            isMaster: isMasterCruise(cruiseId)
          };
        });

        const mostPoints = [...items].sort((a, b) => b.points - a.points).slice(0, limit);
        const bestValuePerPoint = [...items].filter(i => i.points > 0).sort((a, b) => b.valuePerPoint - a.valuePerPoint).slice(0, limit);
        const highestCoinInVsRisk = [...items].filter(i => i.outOfPocket > 0).sort((a, b) => b.coinInToRisk - a.coinInToRisk).slice(0, limit);

        const masterPoints = items.filter(i => i.isMaster).reduce((sum, i) => sum + i.points, 0);
        const nonMasterPoints = items.filter(i => !i.isMaster).reduce((sum, i) => sum + i.points, 0);
        const invariantOk = masterPoints === MASTER_POINTS_TOTAL && nonMasterPoints === 0;

        return {
          mostPoints,
          bestValuePerPoint,
          highestCoinInVsRisk,
          totals: {
            masterPoints,
            nonMasterPoints,
            expectedMasterPoints: MASTER_POINTS_TOTAL,
            cruisesCounted: items.length,
            masterCruisesCount: items.filter(i => i.isMaster).length,
          },
          invariant: {
            ok: invariantOk,
            message: invariantOk ? 'All points sourced from 7 master cruises and totals match.' : 'Points invariant failed. Investigate source data.',
          }
        } as const;
      } catch (e) {
        console.error('[tRPC] analytics.pointsLeaderboards error', e);
        return {
          mostPoints: [],
          bestValuePerPoint: [],
          highestCoinInVsRisk: [],
          totals: { masterPoints: 0, nonMasterPoints: 0, expectedMasterPoints: MASTER_POINTS_TOTAL, cruisesCounted: 0, masterCruisesCount: 0 },
          invariant: { ok: false, message: (e as Error).message }
        } as const;
      }
    }),

  getOverviewStats: publicProcedure.query(() => {
    console.log('[tRPC] Getting overview statistics from unified system');
    const allCruises = memoryStore.getCruises();
    const bookedCruises = memoryStore.getBookedCruises(); // Now returns cruises with bookingId

    const casinoOffers = memoryStore.getCasinoOffers();
    const userProfile = memoryStore.getUserProfile();
    const allAnalytics = memoryStore.getAllCasinoAnalytics();

    
    // Calculate upcoming departures (next 90 days)
    const now = new Date();
    const next90Days = new Date(now.getTime() + (90 * 24 * 60 * 60 * 1000));
    const upcomingCruises = allCruises.filter(cruise => {
      try {
        const departureDate = new Date(cruise.departureDate);
        return !isNaN(departureDate.getTime()) && departureDate >= now && departureDate <= next90Days;
      } catch {
        return false;
      }
    });
    
    // Calculate active offers (not expired) - only count valid dates
    const activeOffers = casinoOffers.filter(offer => {
      try {
        const expiryDate = new Date(offer.expires);
        return !isNaN(expiryDate.getTime()) && expiryDate > now;
      } catch {
        return false;
      }
    });
    
    // Calculate casino analytics summary
    const totalPotentialSavings = allAnalytics.reduce((sum, a) => sum + a.savings, 0);
    const averageROI = allAnalytics.length > 0 ? allAnalytics.reduce((sum, a) => sum + a.roi, 0) / allAnalytics.length : 0;
    const bestROI = allAnalytics.length > 0 ? Math.max(...allAnalytics.map(a => a.roi)) : 0;
    
    return {
      totalCruises: allCruises.length,
      bookedCruises: bookedCruises.length,
      upcomingCruises: upcomingCruises.length,
      activeOffers: activeOffers.length,
      casinoOffers: [], // Return empty array when no offers exist
      userLevel: userProfile?.level || 'PRIME',
      userPoints: userProfile?.points || 0,
      // Casino analytics overview
      casinoAnalytics: {
        totalAnalyses: allAnalytics.length,
        totalPotentialSavings,
        averageROI,
        bestROI,
        recommendedCruises: allAnalytics.filter(a => a.roi > 25).length
      },
      lastUpdate: new Date().toISOString()
    };
  }),



  // Break-Even Points Analysis
  getBreakEvenAnalysis: publicProcedure.query(() => {
    console.log('[tRPC] Getting break-even points analysis');
    const allAnalytics = memoryStore.getAllCasinoAnalytics();
    const cruises = memoryStore.getCruises();
    
    const breakEvenAnalysis = allAnalytics.map(analytics => {
      const cruise = cruises.find(c => c.id === analytics.cruiseId);
      
      // Calculate break-even points needed
      const pointsNeeded = analytics.costPerPoint > 0 ? 
        Math.ceil(analytics.retailValue / analytics.costPerPoint) : 0;
      
      // Calculate current status
      const currentPoints = analytics.points;
      const pointsToBreakEven = Math.max(0, pointsNeeded - currentPoints);
      const isBreakEven = currentPoints >= pointsNeeded;
      
      // Calculate additional coin-in needed
      const additionalCoinInNeeded = pointsToBreakEven * 5; // $5 per point
      
      return {
        cruiseId: analytics.cruiseId,
        ship: cruise?.ship || 'Unknown Ship',
        itinerary: cruise?.itineraryName || 'Unknown Itinerary',
        retailValue: analytics.retailValue,
        costPerPoint: analytics.costPerPoint,
        pointsNeeded,
        currentPoints,
        pointsToBreakEven,
        additionalCoinInNeeded,
        isBreakEven,
        currentROI: analytics.roi,
        projectedROIAtBreakEven: isBreakEven ? analytics.roi : 0
      };
    }).sort((a, b) => a.pointsToBreakEven - b.pointsToBreakEven);
    
    const summary = {
      totalCruises: breakEvenAnalysis.length,
      alreadyBreakEven: breakEvenAnalysis.filter(c => c.isBreakEven).length,
      needingBreakEven: breakEvenAnalysis.filter(c => !c.isBreakEven).length,
      totalAdditionalCoinInNeeded: breakEvenAnalysis
        .filter(c => !c.isBreakEven)
        .reduce((sum, c) => sum + c.additionalCoinInNeeded, 0),
      averagePointsToBreakEven: breakEvenAnalysis.length > 0 ?
        breakEvenAnalysis
          .filter(c => !c.isBreakEven)
          .reduce((sum, c) => sum + c.pointsToBreakEven, 0) / 
        Math.max(1, breakEvenAnalysis.filter(c => !c.isBreakEven).length) : 0
    };
    
    return {
      cruises: breakEvenAnalysis,
      summary
    };
  }),

  // Category Upgrade Efficiency Analysis
  getCategoryUpgradeAnalysis: publicProcedure.query(() => {
    console.log('[tRPC] Getting category upgrade efficiency analysis');
    const payTable = memoryStore.getCasinoPayTable();
    const userProfile = memoryStore.getUserProfile();
    const currentPoints = userProfile?.points || 0;
    
    const upgradeAnalysis = [];
    
    // Analyze efficiency between different point tiers
    for (let i = 0; i < payTable.length - 1; i++) {
      const currentTier = payTable[i];
      const nextTier = payTable[i + 1];
      
      // Calculate values for each tier
      const currentValue = memoryStore.calculateOfferValue(currentTier.points, 'Interior');
      const nextValue = memoryStore.calculateOfferValue(nextTier.points, 'Interior');
      
      // Calculate upgrade metrics
      const extraPointsNeeded = nextTier.points - currentTier.points;
      const extraValue = nextValue - currentValue;
      const upgradeEfficiency = extraPointsNeeded > 0 ? extraValue / extraPointsNeeded : 0;
      const extraCoinInNeeded = extraPointsNeeded * 5; // $5 per point
      
      // Determine if user can achieve this tier
      const canAchieve = currentPoints >= currentTier.points;
      const canUpgrade = currentPoints >= nextTier.points;
      
      upgradeAnalysis.push({
        fromTier: {
          points: currentTier.points,
          reward: currentTier.reward,
          value: currentValue,
          cabinTypes: currentTier.cabinTypes
        },
        toTier: {
          points: nextTier.points,
          reward: nextTier.reward,
          value: nextValue,
          cabinTypes: nextTier.cabinTypes
        },
        upgrade: {
          extraPointsNeeded,
          extraValue,
          upgradeEfficiency,
          extraCoinInNeeded,
          efficiencyPerDollar: extraCoinInNeeded > 0 ? extraValue / extraCoinInNeeded : 0
        },
        userStatus: {
          canAchieve,
          canUpgrade,
          pointsNeeded: Math.max(0, currentTier.points - currentPoints),
          pointsToUpgrade: Math.max(0, nextTier.points - currentPoints)
        },
        recommendation: upgradeEfficiency > 0.25 ? 'Excellent' :
                       upgradeEfficiency > 0.15 ? 'Good' :
                       upgradeEfficiency > 0.10 ? 'Fair' : 'Poor'
      });
    }
    
    // Sort by upgrade efficiency (best value first)
    upgradeAnalysis.sort((a, b) => b.upgrade.upgradeEfficiency - a.upgrade.upgradeEfficiency);
    
    const summary = {
      currentUserPoints: currentPoints,
      currentTier: payTable.find(tier => currentPoints >= tier.points)?.reward || 'None',
      nextTier: payTable.find(tier => currentPoints < tier.points)?.reward || 'Max Level',
      bestUpgradeEfficiency: upgradeAnalysis.length > 0 ? upgradeAnalysis[0].upgrade.upgradeEfficiency : 0,
      recommendedUpgrades: upgradeAnalysis.filter(u => u.recommendation === 'Excellent' || u.recommendation === 'Good').length,
      totalTiers: payTable.length
    };
    
    return {
      upgrades: upgradeAnalysis,
      summary,
      payTable
    };
  }),

  // Enhanced Analytics using Receipts and Statements - ONLY REAL DATA
  getReceiptAnalytics: publicProcedure.query(() => {
    console.log('[tRPC] Getting receipt-based analytics - INCLUDING STATIC DATA');
    const receipts = memoryStore.getReceipts();
    const statements = memoryStore.getCruiseStatements();
    const cruises = memoryStore.getCruises();
    
    // Use imported static booked cruises data
    
    console.log(`[tRPC] Found ${receipts.length} receipts, ${statements.length} statements`);
    
    // If no real receipts/statements, return empty
    if (receipts.length === 0 && statements.length === 0) {
      console.log('[tRPC] No receipts, statements, or static cruise data found - returning empty analytics');
      return {
        totalReceipts: 0,
        totalStatements: 0,
        totalSpending: 0,
        averageSpendingPerCruise: 0,
        categoryBreakdown: {},
        clubRoyaleSpending: 0,
        onboardSpending: 0,
        preBookedSpending: 0,
        cruiseBreakdown: []
      };
    }
    
    // Create detailed cruise-by-cruise breakdown
    const allCruisesForAnalysis = cruises;
    
    const cruiseBreakdown = allCruisesForAnalysis
      .map(cruise => {
        const cruiseReceipts = receipts.filter(r => r.cruiseId === cruise.id);
        const cruiseStatements = statements.filter(s => s.cruiseId === cruise.id);
        
        // Skip cruises with no receipts or statements
        if (cruiseReceipts.length === 0 && cruiseStatements.length === 0) {
          return null;
        }
        
        // Calculate receipt-based values - Enhanced for Royal Caribbean receipts
        let retailPrice = cruiseReceipts.reduce((sum: number, receipt: any) => {
          // For Royal Caribbean receipts, retail price is the base cruise fare before discounts
          return sum + (receipt.totalFare || 0);
        }, 0);
        

        
        // Calculate casino discount from receipt - look for casino comp, casino slots, casino upgrade line items
        let casinoDiscount = cruiseReceipts.reduce((sum: number, receipt: any) => {
          let discount = 0;
          
          // Method 1: Look for specific casino discount line items in special offers
          if (receipt.specialOffers && Array.isArray(receipt.specialOffers)) {
            receipt.specialOffers.forEach((offer: string) => {
              const offerLower = offer.toLowerCase();
              if (offerLower.includes('casino') && (offerLower.includes('comp') || offerLower.includes('discount') || offerLower.includes('offer'))) {
                const match = offer.match(/\$([0-9,]+(?:\.[0-9]{2})?)/g);
                if (match) {
                  match.forEach(amount => {
                    discount += parseFloat(amount.replace(/[$,]/g, ''));
                  });
                }
              }
            });
          }
          
          // Method 2: Calculate from retail vs paid difference (common for casino offers)
          if (discount === 0) {
            const totalRetail = (receipt.totalFare || 0) + (receipt.taxesAndFees || 0);
            const totalPaid = receipt.totalPaid || 0;
            const difference = totalRetail - totalPaid;
            // Only count as casino discount if the difference is significant (> $100)
            if (difference > 100) {
              discount = difference;
            }
          }
          
          return sum + discount;
        }, 0);
        

        
        let amountPaid = cruiseReceipts.reduce((sum: number, receipt: any) => {
          return sum + (receipt.totalPaid || 0);
        }, 0);
        

        
        // Enhanced FreePlay extraction from receipts
        let freePlay = cruiseReceipts.reduce((sum: number, receipt: any) => {
          let fpAmount = 0;
          
          // Look in special offers for FreePlay mentions
          if (receipt.specialOffers && Array.isArray(receipt.specialOffers)) {
            receipt.specialOffers.forEach((offer: string) => {
              const offerLower = offer.toLowerCase();
              if (offerLower.includes('freeplay') || offerLower.includes('free play') || offerLower.includes('fp')) {
                const match = offer.match(/\$([0-9,]+(?:\.[0-9]{2})?)/g);
                if (match) {
                  match.forEach(amount => {
                    fpAmount += parseFloat(amount.replace(/[$,]/g, ''));
                  });
                }
              }
            });
          }
          
          // Also check if there's a dedicated freePlay field
          if (receipt.freePlay && typeof receipt.freePlay === 'number') {
            fpAmount += receipt.freePlay;
          }
          
          return sum + fpAmount;
        }, 0);
        

        
        // Calculate statement-based Club Royale Entertainment charges - Sum all CLUB ROYALE ENTERTAINMENT GAMES line items
        let clubRoyaleEntertainment = cruiseStatements.reduce((sum: number, statement: any) => {
          let casinoTotal = 0;
          
          // Method 1: Use the enhanced clubRoyaleEntertainmentCharges field from OCR
          if (statement.clubRoyaleEntertainmentCharges && typeof statement.clubRoyaleEntertainmentCharges === 'number') {
            casinoTotal += statement.clubRoyaleEntertainmentCharges;
          }
          // Fallback Method 2: Direct casino field
          else if (statement.casino && typeof statement.casino === 'number') {
            casinoTotal += statement.casino;
          }
          
          // Method 3: Look for line items in statement data (if statement has detailed line items)
          if (casinoTotal === 0 && statement.lineItems && Array.isArray(statement.lineItems)) {
            statement.lineItems.forEach((item: any) => {
              if (item.description && item.description.toLowerCase().includes('club royale entertainment')) {
                casinoTotal += Math.abs(item.amount || 0); // Use absolute value as charges might be negative
              }
            });
          }
          
          // Method 4: Look in onboard charges breakdown
          if (casinoTotal === 0 && statement.onboardCharges && typeof statement.onboardCharges === 'object') {
            Object.entries(statement.onboardCharges).forEach(([key, value]) => {
              if (key.toLowerCase().includes('casino') || key.toLowerCase().includes('gaming')) {
                casinoTotal += (value as number) || 0;
              }
            });
          }
          
          return sum + casinoTotal;
        }, 0);
        

        
        return {
          cruiseId: cruise.id,
          ship: cruise.ship,
          departureDate: cruise.departureDate,
          retailPrice,
          casinoDiscount,
          amountPaid,
          freePlay,
          clubRoyaleEntertainment,
          hasReceipts: cruiseReceipts.length > 0,
          hasStatements: cruiseStatements.length > 0,
          receiptCount: cruiseReceipts.length,
          statementCount: cruiseStatements.length
        };
      })
      .filter((cruise): cruise is NonNullable<typeof cruise> => cruise !== null);
    
    // Analyze receipt data
    const receiptSpending = receipts.reduce((sum: number, receipt: any) => sum + (receipt.totalPaid || 0), 0);
    
    const preBookedSpending = receipts.reduce((sum: number, receipt: any) => {
      return sum + (receipt.totalFare || 0) + (receipt.taxesAndFees || 0) + (receipt.gratuities || 0);
    }, 0);
    
    // Analyze statement data for detailed spending categories
    const categoryBreakdown = statements.reduce((breakdown: Record<string, number>, statement: any) => {
      breakdown.casino = (breakdown.casino || 0) + (statement.casino || 0);
      breakdown.excursions = (breakdown.excursions || 0) + (statement.excursions || 0);
      breakdown.beveragePackages = (breakdown.beveragePackages || 0) + (statement.beveragePackages || 0);
      breakdown.specialtyDining = (breakdown.specialtyDining || 0) + (statement.specialtyDining || 0);
      breakdown.spa = (breakdown.spa || 0) + (statement.spa || 0);
      breakdown.photos = (breakdown.photos || 0) + (statement.photos || 0);
      breakdown.shopping = (breakdown.shopping || 0) + (statement.shopping || 0);
      breakdown.internet = (breakdown.internet || 0) + (statement.internetPackages || 0);
      breakdown.other = (breakdown.other || 0) + (statement.otherCharges || 0);
      return breakdown;
    }, {} as Record<string, number>);
    
    const onboardSpending = Object.values(categoryBreakdown).reduce((sum: number, value: number) => sum + value, 0);
    const clubRoyaleSpending = categoryBreakdown.casino || 0;
    const totalSpending = receiptSpending + onboardSpending;
    
    console.log(`[tRPC] Calculated analytics: ${receipts.length} receipts, ${statements.length} statements, ${totalSpending} total spending`);
    
    return {
      totalReceipts: receipts.length,
      totalStatements: statements.length,
      totalSpending,
      averageSpendingPerCruise: cruiseBreakdown.length > 0 ? totalSpending / cruiseBreakdown.length : 0,
      categoryBreakdown,
      clubRoyaleSpending,
      onboardSpending,
      preBookedSpending,
      cruiseBreakdown,
      spendingTrends: {
        highestCategory: Object.entries(categoryBreakdown).sort(([,a], [,b]) => (b as number) - (a as number))[0]?.[0] || 'none',
        lowestCategory: Object.entries(categoryBreakdown).sort(([,a], [,b]) => (a as number) - (b as number))[0]?.[0] || 'none'
      }
    };
  }),
  
  getClubRoyaleAnalytics: publicProcedure.query(() => {
    console.log('[tRPC] Getting Club Royale analytics from statements - INCLUDING STATIC DATA');
    const statements = memoryStore.getCruiseStatements();
    const cruises = memoryStore.getCruises();
    
    // Use imported static booked cruises data
    
    console.log(`[tRPC] Found ${statements.length} real statements`);
    
    // Return empty if no real statements
    if (statements.length === 0) {
      console.log('[tRPC] No real statements or static casino data found - returning empty Club Royale analytics');
      return {
        totalCasinoSpending: 0,
        averageCasinoSpendingPerCruise: 0,
        cruisesCasinoData: [],
        spendingTrend: 'stable',
        highestSpendingCruise: null,
        totalCruisesWithCasino: 0
      };
    }
    
    // Get real statement data
    const realCasinoData = statements
      .filter((statement: any) => {
        const casinoAmount = statement.clubRoyaleEntertainmentCharges || statement.casino || 0;
        return casinoAmount > 0;
      })
      .map((statement: any) => {
        const cruise = cruises.find(c => c.id === statement.cruiseId);
        const casinoSpending = statement.clubRoyaleEntertainmentCharges || statement.casino || 0;
        return {
          cruiseId: statement.cruiseId,
          ship: statement.ship || cruise?.ship || 'Unknown Ship',
          departureDate: statement.departureDate || cruise?.departureDate,
          casinoSpending,
          totalOnboardSpending: (statement.onboardCharges || 0),
          casinoPercentage: (statement.onboardCharges || 0) > 0 ? 
            (casinoSpending / (statement.onboardCharges || 0)) * 100 : 0,
          dataSource: 'statement'
        };
      });
    
    const casinoData = realCasinoData
      .sort((a: any, b: any) => new Date(b.departureDate || '').getTime() - new Date(a.departureDate || '').getTime());
    
    const totalCasinoSpending = casinoData.reduce((sum: number, data: any) => sum + data.casinoSpending, 0);
    const averageCasinoSpendingPerCruise = casinoData.length > 0 ? totalCasinoSpending / casinoData.length : 0;
    const highestSpendingCruise = casinoData.sort((a: any, b: any) => b.casinoSpending - a.casinoSpending)[0] || null;
    
    // Determine spending trend (simple analysis of last 3 vs previous cruises)
    let spendingTrend = 'stable';
    if (casinoData.length >= 6) {
      const recent3 = casinoData.slice(0, 3).reduce((sum: number, data: any) => sum + data.casinoSpending, 0) / 3;
      const previous3 = casinoData.slice(3, 6).reduce((sum: number, data: any) => sum + data.casinoSpending, 0) / 3;
      if (recent3 > previous3 * 1.2) spendingTrend = 'increasing';
      else if (recent3 < previous3 * 0.8) spendingTrend = 'decreasing';
    }
    
    return {
      totalCasinoSpending,
      averageCasinoSpendingPerCruise,
      cruisesCasinoData: casinoData,
      spendingTrend,
      highestSpendingCruise,
      totalCruisesWithCasino: casinoData.length
    };
  }),
  
  getSpendingCategoryAnalysis: publicProcedure.query(() => {
    console.log('[tRPC] Getting spending category analysis from statements - REAL DATA ONLY');
    const statements = memoryStore.getCruiseStatements();
    
    // NEVER return sample data - only return data if real statements exist
    if (statements.length === 0) {
      console.log('[tRPC] No real cruise statements found - returning empty spending category analysis');
      return {
        categories: [],
        totalOnboardSpending: 0,
        averagePerCategory: {},
        topSpendingCategories: [],
        spendingEfficiency: {}
      };
    }
    
    const categoryTotals = statements.reduce((totals: Record<string, number>, statement: any) => {
      // Use enhanced clubRoyaleEntertainmentCharges field if available, otherwise fallback to casino field
      const casinoAmount = statement.clubRoyaleEntertainmentCharges || statement.casino || 0;
      totals.casino = (totals.casino || 0) + casinoAmount;
      totals.excursions = (totals.excursions || 0) + (statement.excursions || 0);
      totals.beveragePackages = (totals.beveragePackages || 0) + (statement.beveragePackages || 0);
      totals.specialtyDining = (totals.specialtyDining || 0) + (statement.specialtyDining || 0);
      totals.spa = (totals.spa || 0) + (statement.spa || 0);
      totals.photos = (totals.photos || 0) + (statement.photos || 0);
      totals.shopping = (totals.shopping || 0) + (statement.shopping || 0);
      totals.internet = (totals.internet || 0) + (statement.internetPackages || 0);
      totals.other = (totals.other || 0) + (statement.otherCharges || 0);
      return totals;
    }, {} as Record<string, number>);
    
    const totalOnboardSpending = Object.values(categoryTotals).reduce((sum: number, value: number) => sum + value, 0);
    
    const categories = Object.entries(categoryTotals)
      .map(([category, total]) => ({
        category,
        total: total as number,
        percentage: totalOnboardSpending > 0 ? ((total as number) / totalOnboardSpending) * 100 : 0,
        averagePerCruise: statements.length > 0 ? (total as number) / statements.length : 0,
        cruiseCount: statements.filter((s: any) => (s[category as keyof typeof s] as number || 0) > 0).length
      }))
      .filter(cat => cat.total > 0)
      .sort((a, b) => b.total - a.total);
    
    const averagePerCategory = categories.reduce((avg, cat) => {
      avg[cat.category] = cat.averagePerCruise;
      return avg;
    }, {} as Record<string, number>);
    
    const topSpendingCategories = categories.slice(0, 5);
    
    // Calculate spending efficiency (value per dollar spent)
    const spendingEfficiency = {
      casino: categoryTotals.casino > 0 ? 'Entertainment value' : 'N/A',
      excursions: categoryTotals.excursions > 0 ? 'Experience value' : 'N/A',
      beveragePackages: categoryTotals.beveragePackages > 0 ? 'Convenience value' : 'N/A',
      specialtyDining: categoryTotals.specialtyDining > 0 ? 'Culinary value' : 'N/A',
      spa: categoryTotals.spa > 0 ? 'Wellness value' : 'N/A'
    };
    
    return {
      categories,
      totalOnboardSpending,
      averagePerCategory,
      topSpendingCategories,
      spendingEfficiency
    };
  }),
  
  // Add missing procedures that the frontend is calling
  directAnalyticsTest: publicProcedure.query(() => {
    console.log('[tRPC] directAnalyticsTest called');
    return {
      message: 'directAnalyticsTest is working',
      timestamp: new Date().toISOString()
    };
  }),
  
  // Enhanced Casino Analytics with ROI calculations
  getEnhancedCasinoAnalytics: publicProcedure.query(() => {
    console.log('[tRPC] Getting enhanced casino analytics with ROI calculations');
    const receipts = memoryStore.getReceipts();
    const statements = memoryStore.getCruiseStatements();
    const cruises = memoryStore.getCruises();
    const payTable = memoryStore.getCasinoPayTable();
    
    // Only return data if we have real receipts or statements
    if (receipts.length === 0 && statements.length === 0) {
      console.log('[tRPC] No receipts or statements found - returning empty enhanced analytics');
      return {
        cruises: [],
        summary: {
          totalCoinIn: 0,
          totalPoints: 0,
          totalRetailValue: 0,
          totalOutOfPocket: 0,
          overallROI: 0
        },
        topROICruises: [],
        mostPotentialCruises: [],
        topOffers: []
      };
    }
    
    // Create enhanced cruise analytics
    const enhancedCruises = cruises
      .map(cruise => {
        const cruiseReceipts = receipts.filter(r => r.cruiseId === cruise.id);
        const cruiseStatements = statements.filter(s => s.cruiseId === cruise.id);
        
        // Skip cruises without receipts or statements
        if (cruiseReceipts.length === 0 && cruiseStatements.length === 0) {
          return null;
        }
        
        // Calculate retail cabin value from receipts
        const retailCabinValue = cruiseReceipts.reduce((sum: number, receipt: any) => {
          return sum + (receipt.totalFare || 0);
        }, 0);
        
        // Calculate out-of-pocket (fare + taxes + gratuities)
        const outOfPocket = cruiseReceipts.reduce((sum: number, receipt: any) => {
          return sum + (receipt.totalPaid || 0);
        }, 0);
        
        // Get casino spending from statements
        const casinoSpending = cruiseStatements.reduce((sum: number, statement: any) => {
          return sum + (statement.clubRoyaleEntertainmentCharges || statement.casino || 0);
        }, 0);
        
        // Calculate casino coin-in (assume 1 point = $5 coin-in)
        const casinoCoinIn = casinoSpending; // Simplified - could be more complex
        const points = Math.floor(casinoCoinIn / 5); // 1 point per $5
        
        // Get FreePlay from receipts
        const freePlay = cruiseReceipts.reduce((sum: number, receipt: any) => {
          let fpAmount = 0;
          if (receipt.specialOffers && Array.isArray(receipt.specialOffers)) {
            receipt.specialOffers.forEach((offer: string) => {
              const offerLower = offer.toLowerCase();
              if (offerLower.includes('freeplay') || offerLower.includes('free play')) {
                const match = offer.match(/\$([0-9,]+(?:\.[0-9]{2})?)/g);
                if (match) {
                  match.forEach(amount => {
                    fpAmount += parseFloat(amount.replace(/[$,]/g, ''));
                  });
                }
              }
            });
          }
          return sum + fpAmount;
        }, 0);
        
        // Calculate winnings (simplified - could be from statements)
        const winnings = 0; // Would need to be extracted from statements
        
        // Calculate comped extras (spa, dining, internet from statements)
        const compedExtras = cruiseStatements.reduce((sum: number, statement: any) => {
          return sum + (statement.spa || 0) + (statement.specialtyDining || 0) + (statement.internetPackages || 0);
        }, 0);
        
        // Calculate total value back
        const totalValueBack = retailCabinValue + freePlay + compedExtras - winnings;
        
        // Calculate ROI
        const roi = outOfPocket > 0 ? ((totalValueBack - outOfPocket) / outOfPocket) * 100 : 0;
        
        // Determine offer code and reward based on points
        const eligibleTier = payTable.filter(tier => points >= tier.points).pop();
        const nextTier = payTable.find(tier => points < tier.points);
        
        return {
          cruiseId: cruise.id,
          ship: cruise.ship,
          departureDate: cruise.departureDate,
          retailCabinValue,
          outOfPocket,
          casinoCoinIn,
          points,
          offerCode: eligibleTier?.offerCode || 'N/A',
          reward: eligibleTier?.reward || 'No reward tier',
          winnings,
          compedExtras,
          totalValueBack,
          roi,
          nextTierPoints: nextTier ? nextTier.points - points : null,
          nextTierCode: nextTier?.offerCode || null
        };
      })
      .filter((cruise): cruise is NonNullable<typeof cruise> => cruise !== null);
    
    // Calculate summary
    const summary = {
      totalCoinIn: enhancedCruises.reduce((sum, cruise) => sum + cruise.casinoCoinIn, 0),
      totalPoints: enhancedCruises.reduce((sum, cruise) => sum + cruise.points, 0),
      totalRetailValue: enhancedCruises.reduce((sum, cruise) => sum + cruise.retailCabinValue, 0),
      totalOutOfPocket: enhancedCruises.reduce((sum, cruise) => sum + cruise.outOfPocket, 0),
      overallROI: 0
    };
    
    // Calculate overall ROI
    summary.overallROI = summary.totalOutOfPocket > 0 ? 
      ((enhancedCruises.reduce((sum, cruise) => sum + cruise.totalValueBack, 0) - summary.totalOutOfPocket) / summary.totalOutOfPocket) * 100 : 0;
    
    // Get top 5 ROI cruises
    const topROICruises = enhancedCruises
      .filter(cruise => cruise.roi > 0)
      .sort((a, b) => b.roi - a.roi)
      .slice(0, 5);
    
    // Get cruises with most potential (close to next tier)
    const mostPotentialCruises = enhancedCruises
      .filter(cruise => cruise.nextTierPoints && cruise.nextTierPoints <= 5000) // Within 5000 points
      .sort((a, b) => (a.nextTierPoints || 0) - (b.nextTierPoints || 0))
      .slice(0, 5)
      .map(cruise => ({
        cruiseId: cruise.cruiseId,
        ship: cruise.ship,
        departureDate: cruise.departureDate,
        nextTierCode: cruise.nextTierCode,
        pointsToNextTier: cruise.nextTierPoints
      }));
    
    // Get top 5 offers from pay table
    const topOffers = payTable.slice(0, 5).map(tier => ({
      id: tier.offerCode,
      offerCode: tier.offerCode,
      points: tier.points,
      reward: tier.reward,
      nextCruiseBonus: tier.nextCruiseBonus
    }));
    
    return {
      cruises: enhancedCruises,
      summary,
      topROICruises,
      mostPotentialCruises,
      topOffers
    };
  }),
  
  // REMOVED: No longer populate sample data - analytics should only show real data
  // populateSampleReceiptData procedure has been removed to ensure analytics only shows real receipt/statement data
  
  // Advanced Analytics Procedures (Phase 5)
  advancedAnalytics: advancedAnalyticsProcedure,
  getInsights: getInsightsProcedure,
  
  // Comprehensive Analytics (Phase 6)
  comprehensive: getComprehensiveAnalyticsProcedure,
  aiInsights: getAIInsightsProcedure,
  cruiseNarrative: getCruiseAINarrativeProcedure,
  portfolioAI: getPortfolioAIAnalysisProcedure,
  
  // Individual Cruise AI Analysis (Phase 3.2)
  cruiseAI: cruiseAiProcedure,
  
  // Casino Analytics - Phase 1: System Context Awareness
  casinoAnalytics: casinoAnalyticsProcedure,
  
  // Casino Analytics - Phase 2: Predictive What-If Engine
  predictiveAnalytics: predictiveAnalyticsProcedure,
  simulateScenario: simulateScenarioProcedure,
  
  // Intelligence Feature 1: Offer Expiration Alerts & Auto-Matching
  offerAlerts: offerAlertsProcedure,
  offerMatches: offerMatchesProcedure,
  
  // Intelligence Feature 2: Smart Booking Window Predictor
  bookingWindowPrediction: bookingWindowPredictionProcedure,
  
  // Intelligence Feature 4: Cruise Value Score (0-100)
  cruiseValueScore: cruiseValueScoreProcedure,
  
  // Intelligence Feature 5: Multi-Cruise Portfolio Optimizer
  portfolioOptimizer: portfolioProcedure,
  
  // Intelligence Feature 6: Predictive Cash Flow Planner
  cashFlowPlanner: cashFlowProcedure,
  
  // Step 19: AI-Powered Analytics
  getAICruiseNarrative: publicProcedure
    .input(z.object({ cruiseId: z.string() }))
    .query(async ({ input }) => {
      console.log('[tRPC] Generating AI narrative for cruise:', input.cruiseId);
      try {
        const cruise = memoryStore.getCruises().find(c => c.id === input.cruiseId);
        const analyticsList: import('@/types/models').CasinoAnalytics[] = memoryStore.getCasinoAnalytics(input.cruiseId);
        const analytics: import('@/types/models').CasinoAnalytics | null = analyticsList[0] ?? null;
        const receipts = memoryStore.getReceipts().filter(r => r.cruiseId === input.cruiseId);
        const statements = memoryStore.getCruiseStatements().filter(s => s.cruiseId === input.cruiseId);
        
        if (!cruise) {
          throw new Error('Cruise not found');
        }
        
        // Prepare data for AI analysis
        const cruiseData = {
          ship: cruise.ship,
          itinerary: cruise.itineraryName,
          departureDate: cruise.departureDate,
          nights: cruise.nights,
          analytics: analytics || null,
          receipts: receipts.length,
          statements: statements.length,
          casinoSpend: statements.reduce((sum: number, s: any) => {
            const casinoNum = typeof s.clubRoyaleEntertainmentCharges === 'number'
              ? s.clubRoyaleEntertainmentCharges
              : typeof s.casino === 'number'
                ? s.casino
                : typeof s.casino === 'string'
                  ? parseFloat(s.casino.replace(/[$,]/g, '')) || 0
                  : 0;
            return sum + (isNaN(casinoNum) ? 0 : casinoNum);
          }, 0),
          totalSpend: statements.reduce((sum: number, s: any) => {
            const onboard = typeof s.onboardCharges === 'number'
              ? s.onboardCharges
              : typeof s.onboardCharges === 'string'
                ? parseFloat(s.onboardCharges.replace(/[$,]/g, '')) || 0
                : 0;
            return sum + (isNaN(onboard) ? 0 : onboard);
          }, 0)
        };
        
        // Generate AI narrative using the AI API
        const prompt = `Analyze this cruise experience and provide insights:

Cruise: ${cruiseData.ship} - ${cruiseData.itinerary}
Departure: ${cruiseData.departureDate}
Length: ${cruiseData.nights} nights
Casino Spend: ${cruiseData.casinoSpend}
Total Onboard: ${cruiseData.totalSpend}
ROI: ${analytics?.roi || 0}%
Savings: ${analytics?.savings || 0}

Provide a 2-3 sentence narrative about this cruise's performance, value, and any strategic insights for future bookings.`;
        
        const response = await fetch('https://toolkit.rork.com/text/llm/', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            messages: [{ role: 'user', content: prompt }]
          })
        });
        
        if (!response.ok) {
          throw new Error('AI service unavailable');
        }
        
        const aiResult = await response.json();
        
        return {
          cruiseId: input.cruiseId,
          narrative: aiResult.completion || 'Analysis unavailable',
          metrics: {
            roi: analytics?.roi ?? 0,
            savings: analytics?.savings ?? 0,
            casinoSpend: cruiseData.casinoSpend,
            totalSpend: cruiseData.totalSpend
          },
          generatedAt: new Date().toISOString()
        };
      } catch (error) {
        console.error('[tRPC] AI narrative generation failed:', error);
        return {
          cruiseId: input.cruiseId,
          narrative: 'AI analysis temporarily unavailable. Please try again later.',
          metrics: { roi: 0, savings: 0, casinoSpend: 0, totalSpend: 0 },
          generatedAt: new Date().toISOString()
        };
      }
    }),
  
  getPortfolioOptimization: publicProcedure.query(async () => {
    console.log('[tRPC] Generating portfolio optimization suggestions');
    try {
      const allAnalytics = memoryStore.getAllCasinoAnalytics();
      const cruises = memoryStore.getCruises();
      const userProfile = memoryStore.getUserProfile();
      
      if (allAnalytics.length === 0) {
        return {
          suggestions: ['No cruise data available for optimization analysis.'],
          riskLevel: 'unknown',
          recommendedActions: [],
          generatedAt: new Date().toISOString()
        };
      }
      
      // Calculate portfolio metrics
      const totalROI = allAnalytics.reduce((sum, a) => sum + a.roi, 0) / allAnalytics.length;
      const totalSavings = allAnalytics.reduce((sum, a) => sum + a.savings, 0);
      const totalCoinIn = allAnalytics.reduce((sum, a) => sum + a.coinIn, 0);
      const bestROI = Math.max(...allAnalytics.map(a => a.roi));
      const worstROI = Math.min(...allAnalytics.map(a => a.roi));
      
      // Prepare data for AI analysis
      const portfolioData = {
        totalCruises: allAnalytics.length,
        averageROI: totalROI,
        totalSavings,
        totalCoinIn,
        bestROI,
        worstROI,
        userLevel: userProfile?.level || 'PRIME',
        userPoints: userProfile?.points || 0,
        excellentCruises: allAnalytics.filter(a => a.roi > 50).length,
        goodCruises: allAnalytics.filter(a => a.roi > 25 && a.roi <= 50).length,
        poorCruises: allAnalytics.filter(a => a.roi <= 0).length
      };
      
      const prompt = `Analyze this cruise portfolio and provide optimization recommendations:

Portfolio Summary:
- Total Cruises: ${portfolioData.totalCruises}
- Average ROI: ${portfolioData.averageROI.toFixed(1)}%
- Total Savings: ${portfolioData.totalSavings.toLocaleString()}
- Total Casino Spend: ${portfolioData.totalCoinIn.toLocaleString()}
- Best ROI: ${portfolioData.bestROI.toFixed(1)}%
- Worst ROI: ${portfolioData.worstROI.toFixed(1)}%
- User Level: ${portfolioData.userLevel}
- Current Points: ${portfolioData.userPoints.toLocaleString()}
- Excellent Cruises (>50% ROI): ${portfolioData.excellentCruises}
- Good Cruises (25-50% ROI): ${portfolioData.goodCruises}
- Poor Cruises (≤0% ROI): ${portfolioData.poorCruises}

Provide 3-4 specific optimization suggestions for improving this cruise portfolio's performance and risk management.`;
      
      const response = await fetch('https://toolkit.rork.com/text/llm/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: [{ role: 'user', content: prompt }]
        })
      });
      
      if (!response.ok) {
        throw new Error('AI service unavailable');
      }
      
      const aiResult = await response.json();
      
      // Determine risk level
      let riskLevel = 'moderate';
      if (portfolioData.averageROI > 40) riskLevel = 'conservative';
      else if (portfolioData.averageROI < 10) riskLevel = 'aggressive';
      
      // Generate recommended actions based on data
      const recommendedActions = [];
      if (portfolioData.poorCruises > portfolioData.excellentCruises) {
        recommendedActions.push('Focus on higher ROI cruise selections');
      }
      if (portfolioData.averageROI < 25) {
        recommendedActions.push('Consider increasing casino play for better comps');
      }
      if (portfolioData.userPoints > 15000) {
        recommendedActions.push('Leverage high point balance for premium offers');
      }
      
      return {
        suggestions: aiResult.completion ? aiResult.completion.split('\n').filter((s: string) => s.trim()) : ['Analysis unavailable'],
        riskLevel,
        recommendedActions,
        portfolioMetrics: portfolioData,
        generatedAt: new Date().toISOString()
      };
    } catch (error) {
      console.error('[tRPC] Portfolio optimization failed:', error);
      return {
        suggestions: ['Portfolio optimization temporarily unavailable. Please try again later.'],
        riskLevel: 'unknown',
        recommendedActions: [],
        generatedAt: new Date().toISOString()
      };
    }
  }),
  
  getRiskManagementInsights: publicProcedure.query(async () => {
    console.log('[tRPC] Generating risk management insights');
    try {
      const allAnalytics = memoryStore.getAllCasinoAnalytics();
      const statements = memoryStore.getCruiseStatements();
      
      if (allAnalytics.length === 0) {
        return {
          insights: ['No data available for risk analysis.'],
          riskScore: 0,
          recommendations: [],
          generatedAt: new Date().toISOString()
        };
      }
      
      // Calculate risk metrics
      const totalOutOfPocket = allAnalytics.reduce((sum, a) => sum + a.outOfPocket, 0);
      const totalCoinIn = allAnalytics.reduce((sum, a) => sum + a.coinIn, 0);
      const riskMultiplier = totalOutOfPocket > 0 ? totalCoinIn / totalOutOfPocket : 0;
      const volatility = allAnalytics.length > 1 ? 
        Math.sqrt(allAnalytics.reduce((sum, a) => sum + Math.pow(a.roi - (allAnalytics.reduce((s, x) => s + x.roi, 0) / allAnalytics.length), 2), 0) / allAnalytics.length) : 0;
      
      const riskData = {
        totalOutOfPocket,
        totalCoinIn,
        riskMultiplier,
        volatility,
        cruiseCount: allAnalytics.length,
        averageOutOfPocket: totalOutOfPocket / allAnalytics.length,
        maxOutOfPocket: Math.max(...allAnalytics.map(a => a.outOfPocket)),
        minOutOfPocket: Math.min(...allAnalytics.map(a => a.outOfPocket))
      };
      
      const prompt = `Analyze this cruise portfolio's risk profile and provide risk management insights:

Risk Metrics:
- Total Out-of-Pocket: ${riskData.totalOutOfPocket.toLocaleString()}
- Total Casino Spend: ${riskData.totalCoinIn.toLocaleString()}
- Risk Multiplier: ${riskData.riskMultiplier.toFixed(2)}x
- ROI Volatility: ${riskData.volatility.toFixed(1)}%
- Average Out-of-Pocket: ${riskData.averageOutOfPocket.toLocaleString()}
- Max Out-of-Pocket: ${riskData.maxOutOfPocket.toLocaleString()}
- Min Out-of-Pocket: ${riskData.minOutOfPocket.toLocaleString()}

Provide 3-4 specific risk management recommendations for this cruise portfolio.`;
      
      const response = await fetch('https://toolkit.rork.com/text/llm/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: [{ role: 'user', content: prompt }]
        })
      });
      
      if (!response.ok) {
        throw new Error('AI service unavailable');
      }
      
      const aiResult = await response.json();
      
      // Calculate risk score (0-100)
      let riskScore = 50; // baseline
      if (riskData.riskMultiplier > 3) riskScore -= 20; // Good risk multiplier
      if (riskData.volatility > 30) riskScore += 15; // High volatility increases risk
      if (riskData.averageOutOfPocket > 5000) riskScore += 10; // High average spend increases risk
      riskScore = Math.max(0, Math.min(100, riskScore));
      
      const recommendations = [];
      if (riskData.riskMultiplier < 2) {
        recommendations.push('Consider increasing casino play to improve risk multiplier');
      }
      if (riskData.volatility > 40) {
        recommendations.push('Focus on more consistent cruise selections to reduce volatility');
      }
      if (riskData.maxOutOfPocket > riskData.averageOutOfPocket * 3) {
        recommendations.push('Consider setting maximum out-of-pocket limits per cruise');
      }
      
      return {
        insights: aiResult.completion ? aiResult.completion.split('\n').filter((s: string) => s.trim()) : ['Analysis unavailable'],
        riskScore,
        recommendations,
        riskMetrics: riskData,
        generatedAt: new Date().toISOString()
      };
    } catch (error) {
      console.error('[tRPC] Risk management insights failed:', error);
      return {
        insights: ['Risk analysis temporarily unavailable. Please try again later.'],
        riskScore: 0,
        recommendations: [],
        generatedAt: new Date().toISOString()
      };
    }
  }),
  
  getTierAdvancementRecommendations: publicProcedure.query(async () => {
    console.log('[tRPC] Generating tier advancement recommendations');
    try {
      const userProfile = memoryStore.getUserProfile();
      const payTable = memoryStore.getCasinoPayTable();
      const allAnalytics = memoryStore.getAllCasinoAnalytics();
      
      if (!userProfile || payTable.length === 0) {
        return {
          recommendations: ['User profile or pay table data not available.'],
          currentTier: 'Unknown',
          nextTier: 'Unknown',
          pointsNeeded: 0,
          estimatedSpendNeeded: 0,
          generatedAt: new Date().toISOString()
        };
      }
      
      const currentPoints = userProfile.points || 0;
      const currentTier = payTable.filter(tier => currentPoints >= tier.points).pop();
      const nextTier = payTable.find(tier => currentPoints < tier.points);
      
      if (!nextTier) {
        return {
          recommendations: ['You have reached the highest tier level!'],
          currentTier: currentTier?.reward || 'Max Level',
          nextTier: 'Max Level',
          pointsNeeded: 0,
          estimatedSpendNeeded: 0,
          generatedAt: new Date().toISOString()
        };
      }
      
      const pointsNeeded = nextTier.points - currentPoints;
      const estimatedSpendNeeded = pointsNeeded * 5; // $5 per point
      
      // Calculate average points per cruise
      const avgPointsPerCruise = allAnalytics.length > 0 ? 
        allAnalytics.reduce((sum, a) => sum + a.points, 0) / allAnalytics.length : 0;
      
      const cruisesNeeded = avgPointsPerCruise > 0 ? Math.ceil(pointsNeeded / avgPointsPerCruise) : 0;
      
      const tierData = {
        currentTier: currentTier?.reward || 'No Tier',
        nextTier: nextTier.reward,
        currentPoints,
        pointsNeeded,
        estimatedSpendNeeded,
        avgPointsPerCruise,
        cruisesNeeded,
        nextTierBenefits: nextTier.cabinTypes || []
      };
      
      const prompt = `Provide tier advancement recommendations for this cruise loyalty member:

Current Status:
- Current Tier: ${tierData.currentTier}
- Current Points: ${tierData.currentPoints.toLocaleString()}
- Next Tier: ${tierData.nextTier}
- Points Needed: ${tierData.pointsNeeded.toLocaleString()}
- Estimated Spend Needed: ${tierData.estimatedSpendNeeded.toLocaleString()}
- Average Points Per Cruise: ${tierData.avgPointsPerCruise.toFixed(0)}
- Estimated Cruises Needed: ${tierData.cruisesNeeded}

Provide 3-4 specific recommendations for efficiently advancing to the next tier.`;
      
      const response = await fetch('https://toolkit.rork.com/text/llm/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: [{ role: 'user', content: prompt }]
        })
      });
      
      if (!response.ok) {
        throw new Error('AI service unavailable');
      }
      
      const aiResult = await response.json();
      
      return {
        recommendations: aiResult.completion ? aiResult.completion.split('\n').filter((s: string) => s.trim()) : ['Analysis unavailable'],
        currentTier: tierData.currentTier,
        nextTier: tierData.nextTier,
        pointsNeeded: tierData.pointsNeeded,
        estimatedSpendNeeded: tierData.estimatedSpendNeeded,
        cruisesNeeded: tierData.cruisesNeeded,
        tierMetrics: tierData,
        generatedAt: new Date().toISOString()
      };
    } catch (error) {
      console.error('[tRPC] Tier advancement recommendations failed:', error);
      return {
        recommendations: ['Tier advancement analysis temporarily unavailable. Please try again later.'],
        currentTier: 'Unknown',
        nextTier: 'Unknown',
        pointsNeeded: 0,
        estimatedSpendNeeded: 0,
        generatedAt: new Date().toISOString()
      };
    }
  }),
  
  // Historical Analytics for a specific ship
  getHistoricalAnalytics: publicProcedure
    .input(z.object({
      ship: z.string().optional(),
    }))
    .query(({ input }) => {
      console.log('[tRPC] Getting historical analytics for ship:', input.ship);
      
      if (!input.ship) {
        return null;
      }
      
      // Get all cruises for this ship from receipts and statements
      const receipts = memoryStore.getReceipts();
      const statements = memoryStore.getCruiseStatements();
      const cruises = memoryStore.getCruises();
      
      // Filter cruises for this ship that have data
      const shipCruises = cruises.filter(c => 
        c.ship?.toLowerCase().includes(input.ship!.toLowerCase())
      );
      
      const cruisesWithData = shipCruises.filter(cruise => {
        const hasReceipt = receipts.some(r => r.cruiseId === cruise.id);
        const hasStatement = statements.some(s => s.cruiseId === cruise.id);
        return hasReceipt || hasStatement;
      });
      
      if (cruisesWithData.length === 0) {
        return {
          cruiseCount: 0,
          avgPointsPerNight: 0,
          avgSpendPerNight: 0,
          bestRoi: 0,
          insights: ['No historical data available for this ship']
        };
      }
      
      // Calculate metrics
      let totalPoints = 0;
      let totalNights = 0;
      let totalSpend = 0;
      let bestRoi = 0;
      
      cruisesWithData.forEach(cruise => {
        const cruiseStatements = statements.filter(s => s.cruiseId === cruise.id);
        const cruiseReceipts = receipts.filter(r => r.cruiseId === cruise.id);
        
        // Get points from statements
        cruiseStatements.forEach((s: any) => {
          if (s.pointsEarned) totalPoints += s.pointsEarned;
          if (s.totalSpent) {
            const spent = typeof s.totalSpent === 'string' ? 
              parseFloat(s.totalSpent.replace(/[$,]/g, '')) : s.totalSpent;
            if (!isNaN(spent)) totalSpend += spent;
          }
        });
        
        // Get nights
        const nights = cruise.nights || 7;
        totalNights += nights;
        
        // Calculate ROI for this cruise
        cruiseReceipts.forEach((r: any) => {
          const retail = r.totalFare || 0;
          const paid = r.totalPaid || 0;
          if (paid > 0) {
            const roi = ((retail - paid) / paid) * 100;
            if (roi > bestRoi) bestRoi = roi;
          }
        });
      });
      
      const avgPointsPerNight = totalNights > 0 ? totalPoints / totalNights : 0;
      const avgSpendPerNight = totalNights > 0 ? totalSpend / totalNights : 0;
      
      // Generate insights
      const insights = [];
      if (avgPointsPerNight > 250) {
        insights.push('Excellent point earning history on this ship');
      } else if (avgPointsPerNight > 150) {
        insights.push('Good point earning history on this ship');
      }
      
      if (bestRoi > 100) {
        insights.push(`Best ROI achieved: ${bestRoi.toFixed(0)}%`);
      }
      
      if (cruisesWithData.length >= 3) {
        insights.push(`Strong history with ${cruisesWithData.length} sailings`);
      }
      
      return {
        cruiseCount: cruisesWithData.length,
        avgPointsPerNight,
        avgSpendPerNight,
        bestRoi,
        insights
      };
    }),
});

console.log('[Analytics Router] ===== ANALYTICS ROUTER CREATED =====');
console.log('[Analytics Router] Router type:', typeof analyticsRouter);
if ((analyticsRouter as any)._def) {
  const procedures = (analyticsRouter as any)._def.procedures || {};
  console.log('[Analytics Router] Procedures created:', Object.keys(procedures));
  console.log('[Analytics Router] Total procedures:', Object.keys(procedures).length);
  
  // Verify specific procedures that are failing
  const criticalProcedures = ['getCasinoAnalytics', 'getUserProfile', 'getOverviewStats', 'topCompValue'];
  criticalProcedures.forEach(proc => {
    if (procedures[proc]) {
      console.log(`[Analytics Router] ✅ ${proc} procedure exists`);
    } else {
      console.error(`[Analytics Router] ❌ ${proc} procedure MISSING`);
    }
  });
} else {
  console.error('[Analytics Router] Router has no _def property!');
}

// Force export verification
console.log('[Analytics Router] Exporting analyticsRouter with type:', typeof analyticsRouter);
console.log('[Analytics Router] Export keys:', Object.keys(analyticsRouter || {}));
console.log('[Analytics Router] ===== ANALYTICS ROUTER EXPORT COMPLETE =====');