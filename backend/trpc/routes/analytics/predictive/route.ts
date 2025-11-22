import { z } from 'zod';
import { publicProcedure } from '../../../create-context';
import { memoryStore } from '../../_stores/memory';

export const predictiveAnalyticsProcedure = publicProcedure.query(() => {
  console.log('[tRPC] Casino Analytics - Phase 2: Predictive What-If Engine');
  
  const userProfile = memoryStore.getUserProfile();
  const statements = memoryStore.getCruiseStatements();
  const cruises = memoryStore.getCruises();
  const allAnalytics = memoryStore.getAllCasinoAnalytics();
  const payTable = memoryStore.getCasinoPayTable();

  const currentPoints = userProfile?.points || 0;
  const currentTier = userProfile?.level || 'PRIME';

  const historicalCruises = cruises.map(cruise => {
    const cruiseStatements = statements.filter(s => s.cruiseId === cruise.id);
    const casinoSpend = cruiseStatements.reduce((sum: number, s: any) => {
      const amount = s.clubRoyaleEntertainmentCharges || s.casino || 0;
      return sum + (typeof amount === 'string' ? parseFloat(amount.replace(/[$,]/g, '')) : amount);
    }, 0);

    const points = Math.floor(casinoSpend / 5);
    const cruiseAnalytics = allAnalytics.find(a => a.cruiseId === cruise.id);
    const roi = cruiseAnalytics?.roi || 0;

    return {
      cruiseId: cruise.id,
      ship: cruise.ship,
      nights: cruise.nights || 7,
      casinoSpend,
      points,
      roi,
    };
  }).filter(c => c.casinoSpend > 0);

  const avgCoinInPerCruise = historicalCruises.length > 0 ?
    historicalCruises.reduce((sum, c) => sum + c.casinoSpend, 0) / historicalCruises.length : 0;
  
  const avgPointsPerCruise = historicalCruises.length > 0 ?
    historicalCruises.reduce((sum, c) => sum + c.points, 0) / historicalCruises.length : 0;

  const avgHistoricalROI = historicalCruises.length > 0 ?
    historicalCruises.reduce((sum, c) => sum + c.roi, 0) / historicalCruises.length : 0;

  const currentTierData = payTable.find(t => t.reward === currentTier);
  const nextTierIndex = payTable.findIndex(t => t.points > currentPoints);
  const nextTier = nextTierIndex >= 0 ? payTable[nextTierIndex] : null;

  let tierForecasting = null;
  if (nextTier && avgPointsPerCruise > 0) {
    const pointsNeeded = nextTier.points - currentPoints;
    const cruisesNeeded = Math.ceil(pointsNeeded / avgPointsPerCruise);
    const avgDaysPerCruise = historicalCruises.length > 0 ?
      historicalCruises.reduce((sum, c) => sum + (c.nights || 7), 0) / historicalCruises.length : 7;
    const daysNeeded = Math.ceil(cruisesNeeded * avgDaysPerCruise);

    tierForecasting = {
      currentTier,
      currentPoints,
      nextTier: nextTier.reward,
      nextTierPoints: nextTier.points,
      pointsNeeded,
      cruisesNeeded,
      daysNeeded,
      avgPointsPerCruise,
      avgCoinInPerCruise,
      estimatedSpendNeeded: Math.ceil(pointsNeeded * 5),
      projection: `At your average coin-in of $${avgCoinInPerCruise.toFixed(0)}, you'll reach ${nextTier.reward} in ${cruisesNeeded} cruise${cruisesNeeded > 1 ? 's' : ''} or ${daysNeeded} days.`,
    };
  } else if (!nextTier) {
    tierForecasting = {
      currentTier,
      currentPoints,
      nextTier: 'Max Tier Reached',
      nextTierPoints: currentPoints,
      pointsNeeded: 0,
      cruisesNeeded: 0,
      daysNeeded: 0,
      avgPointsPerCruise,
      avgCoinInPerCruise,
      estimatedSpendNeeded: 0,
      projection: `You have reached the maximum tier level!`,
    };
  }

  const roiProjections = [];
  const futureCruiseCounts = [1, 3, 5, 10];
  for (const count of futureCruiseCounts) {
    const projectedPoints = currentPoints + (avgPointsPerCruise * count);
    const projectedTierData = payTable.filter(t => projectedPoints >= t.points).pop();
    const projectedROI = avgHistoricalROI * (1 + (count * 0.02));
    
    roiProjections.push({
      cruisesFromNow: count,
      projectedPoints,
      projectedTier: projectedTierData?.reward || 'PRIME',
      projectedROI: projectedROI,
      projectedTotalValue: count * avgCoinInPerCruise * (1 + projectedROI / 100),
      projectedTotalSpend: count * avgCoinInPerCruise,
    });
  }

  const monteCarloSimulations = 1000;
  const roiVariance = Math.sqrt(
    historicalCruises.reduce((sum, c) => {
      return sum + Math.pow(c.roi - avgHistoricalROI, 2);
    }, 0) / Math.max(1, historicalCruises.length)
  );

  const simulations = [];
  for (let i = 0; i < monteCarloSimulations; i++) {
    const randomROI = avgHistoricalROI + (Math.random() - 0.5) * 2 * roiVariance;
    const randomFreePlay = avgCoinInPerCruise * 0.1 * (0.8 + Math.random() * 0.4);
    const randomOutOfPocket = avgCoinInPerCruise * (0.85 + Math.random() * 0.3);
    
    simulations.push({
      roi: randomROI,
      freePlay: randomFreePlay,
      outOfPocket: randomOutOfPocket,
    });
  }

  const sortedROIs = simulations.map(s => s.roi).sort((a, b) => a - b);
  const sortedFreePlay = simulations.map(s => s.freePlay).sort((a, b) => a - b);
  const sortedOutOfPocket = simulations.map(s => s.outOfPocket).sort((a, b) => a - b);

  const p10Index = Math.floor(monteCarloSimulations * 0.1);
  const p50Index = Math.floor(monteCarloSimulations * 0.5);
  const p90Index = Math.floor(monteCarloSimulations * 0.9);

  const riskCurve = {
    roi: {
      worst10: sortedROIs[p10Index],
      median: sortedROIs[p50Index],
      best10: sortedROIs[p90Index],
      expectedValue: avgHistoricalROI,
      variance: roiVariance,
    },
    freePlay: {
      worst10: sortedFreePlay[p10Index],
      median: sortedFreePlay[p50Index],
      best10: sortedFreePlay[p90Index],
    },
    outOfPocket: {
      worst10: sortedOutOfPocket[p10Index],
      median: sortedOutOfPocket[p50Index],
      best10: sortedOutOfPocket[p90Index],
    },
    simulationCount: monteCarloSimulations,
    note: 'Monte Carlo simulation showing possible outcome ranges',
  };

  return {
    tierForecasting,
    roiProjections,
    riskCurve,
    historicalBaseline: {
      avgCoinInPerCruise,
      avgPointsPerCruise,
      avgHistoricalROI,
      cruisesAnalyzed: historicalCruises.length,
    },
    summary: {
      message: 'Phase 2: Predictive What-If Engine - Forecasting and risk analysis complete',
      timestamp: new Date().toISOString(),
    },
  };
});

export const simulateScenarioProcedure = publicProcedure
  .input(z.object({
    futureCruises: z.number().min(1).max(50),
    avgCoinIn: z.number().min(0).optional(),
    targetTier: z.string().optional(),
  }))
  .query(({ input }) => {
    console.log('[tRPC] Simulating scenario:', input);
    
    const userProfile = memoryStore.getUserProfile();
    const statements = memoryStore.getCruiseStatements();
    const cruises = memoryStore.getCruises();
    const allAnalytics = memoryStore.getAllCasinoAnalytics();
    const payTable = memoryStore.getCasinoPayTable();

    const currentPoints = userProfile?.points || 0;
    
    const historicalCruises = cruises.map(cruise => {
      const cruiseStatements = statements.filter(s => s.cruiseId === cruise.id);
      const casinoSpend = cruiseStatements.reduce((sum: number, s: any) => {
        const amount = s.clubRoyaleEntertainmentCharges || s.casino || 0;
        return sum + (typeof amount === 'string' ? parseFloat(amount.replace(/[$,]/g, '')) : amount);
      }, 0);
      const cruiseAnalytics = allAnalytics.find(a => a.cruiseId === cruise.id);
      return {
        casinoSpend,
        roi: cruiseAnalytics?.roi || 0,
      };
    }).filter(c => c.casinoSpend > 0);

    const defaultAvgCoinIn = historicalCruises.length > 0 ?
      historicalCruises.reduce((sum, c) => sum + c.casinoSpend, 0) / historicalCruises.length : 5000;
    
    const avgHistoricalROI = historicalCruises.length > 0 ?
      historicalCruises.reduce((sum, c) => sum + c.roi, 0) / historicalCruises.length : 0;

    const simulatedCoinIn = input.avgCoinIn || defaultAvgCoinIn;
    const pointsPerCruise = Math.floor(simulatedCoinIn / 5);
    const projectedPoints = currentPoints + (pointsPerCruise * input.futureCruises);
    
    const projectedTierData = payTable.filter(t => projectedPoints >= t.points).pop();
    const projectedROI = avgHistoricalROI * (1 + (input.futureCruises * 0.02));
    
    const targetTierData = input.targetTier ? 
      payTable.find(t => t.reward === input.targetTier) : null;
    
    let targetAnalysis = null;
    if (targetTierData) {
      const pointsToTarget = Math.max(0, targetTierData.points - currentPoints);
      const cruisesNeeded = pointsPerCruise > 0 ? Math.ceil(pointsToTarget / pointsPerCruise) : 0;
      const spendNeeded = pointsToTarget * 5;
      
      targetAnalysis = {
        targetTier: targetTierData.reward,
        pointsNeeded: pointsToTarget,
        cruisesNeeded,
        spendNeeded,
        achievable: input.futureCruises >= cruisesNeeded,
      };
    }

    return {
      scenario: {
        futureCruises: input.futureCruises,
        avgCoinInPerCruise: simulatedCoinIn,
        pointsPerCruise,
      },
      projection: {
        currentPoints,
        projectedPoints,
        projectedTier: projectedTierData?.reward || 'PRIME',
        projectedROI,
        projectedTotalSpend: simulatedCoinIn * input.futureCruises,
        projectedTotalValue: simulatedCoinIn * input.futureCruises * (1 + projectedROI / 100),
      },
      targetAnalysis,
      timestamp: new Date().toISOString(),
    };
  });
