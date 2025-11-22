import { publicProcedure } from '../../../create-context';
import { memoryStore } from '../../_stores/memory';

export const casinoAnalyticsProcedure = publicProcedure.query(() => {
  console.log('[tRPC] Casino Analytics - Phase 1: System Context Awareness');
  
  const userProfile = memoryStore.getUserProfile();
  const statements = memoryStore.getCruiseStatements();
  const receipts = memoryStore.getReceipts();
  const cruises = memoryStore.getCruises();
  const bookedCruises = memoryStore.getBookedCruises();
  const allAnalytics = memoryStore.getAllCasinoAnalytics();

  const today = new Date();
  const bookedFuture = bookedCruises.filter(c => {
    try {
      const depDate = new Date(c.departureDate);
      return depDate > today;
    } catch {
      return false;
    }
  });

  let totalCoinIn = 0;
  let totalPoints = 0;
  let totalRetailCosts = 0;
  let totalPointsEarned = 0;

  const cruiseMetrics = cruises.map(cruise => {
    const cruiseStatements = statements.filter(s => s.cruiseId === cruise.id);
    const cruiseReceipts = receipts.filter(r => r.cruiseId === cruise.id);
    const cruiseAnalytics = allAnalytics.find(a => a.cruiseId === cruise.id);

    const casinoSpend = cruiseStatements.reduce((sum: number, s: any) => {
      const amount = s.clubRoyaleEntertainmentCharges || s.casino || 0;
      return sum + (typeof amount === 'string' ? parseFloat(amount.replace(/[$,]/g, '')) : amount);
    }, 0);

    const retailCost = cruiseReceipts.reduce((sum: number, r: any) => {
      return sum + (r.totalFare || 0) + (r.taxesAndFees || 0);
    }, 0);

    const points = Math.floor(casinoSpend / 5);
    
    totalCoinIn += casinoSpend;
    totalPoints += points;
    totalRetailCosts += retailCost;
    totalPointsEarned += points;

    const roi = cruiseAnalytics?.roi || 0;

    return {
      cruiseId: cruise.id,
      ship: cruise.ship,
      departureDate: cruise.departureDate,
      nights: cruise.nights || 7,
      casinoSpend,
      points,
      retailCost,
      roi,
      hasReceipt: cruiseReceipts.length > 0,
      hasStatement: cruiseStatements.length > 0,
    };
  }).filter(m => m.hasReceipt || m.hasStatement);

  const totalSeaDays = cruiseMetrics.reduce((sum, m) => {
    const nights = m.nights || 7;
    const seaDays = Math.floor(nights * 0.7);
    return sum + seaDays;
  }, 0);

  const totalPortDays = cruiseMetrics.reduce((sum, m) => {
    const nights = m.nights || 7;
    const portDays = Math.ceil(nights * 0.3);
    return sum + portDays;
  }, 0);

  const pointsPerDay = cruiseMetrics.length > 0 ? 
    totalPointsEarned / (cruiseMetrics.reduce((sum, m) => sum + (m.nights || 7), 0)) : 0;

  const pointsPerSeaDay = totalSeaDays > 0 ? totalPointsEarned / totalSeaDays : 0;
  const pointsPerPortDay = totalPortDays > 0 ? totalPointsEarned / totalPortDays : 0;

  const avgROI = cruiseMetrics.length > 0 ? 
    cruiseMetrics.reduce((sum, m) => sum + m.roi, 0) / cruiseMetrics.length : 0;

  const currentTier = userProfile?.level || 'PRIME';
  const currentPoints = userProfile?.points || 0;

  const cruisesCompleted = cruiseMetrics.length;
  const avgCoinInPerCruise = cruisesCompleted > 0 ? totalCoinIn / cruisesCompleted : 0;

  const gameTypeAnalysis = {
    slots: Math.floor(totalCoinIn * 0.7),
    tableGames: Math.floor(totalCoinIn * 0.2),
    videoPoker: Math.floor(totalCoinIn * 0.1),
  };

  return {
    playerContext: {
      tier: currentTier,
      currentPoints,
      bookedCruises: bookedFuture.length,
      cruisesCompleted,
      totalCoinIn,
      avgCoinInPerCruise,
      pointsPerDay,
      pointsPerSeaDay,
      pointsPerPortDay,
      avgROI,
    },
    spendingMetrics: {
      totalCoinIn,
      totalPoints: totalPointsEarned,
      totalRetailCosts,
      avgRetailCostPerCruise: cruisesCompleted > 0 ? totalRetailCosts / cruisesCompleted : 0,
    },
    gameTypeAnalysis,
    cruiseMetrics: cruiseMetrics.slice(0, 10),
    summary: {
      message: 'Phase 1: System Context Awareness - Player metrics calculated',
      timestamp: new Date().toISOString(),
    },
  };
});
