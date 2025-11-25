import { publicProcedure } from '../../../create-context';
import { loadCruisesDatabase, loadBookedCruises, loadOffers } from '../../_utils/dataLoader';
import type { PlayerContext, ShipContext, OfferContext, ContextIntelligence } from '@/types/context';

export const contextProcedure = publicProcedure.query(async () => {
  console.log('[Context] Computing context intelligence...');
  
  const cruises = await loadCruisesDatabase();
  const booked = await loadBookedCruises();
  const offers = await loadOffers();
  
  console.log('[Context] Loaded data:', { cruises: cruises.length, booked: booked.length, offers: offers.length });
  
  const playerContext = computePlayerContext(booked);
  const topShips = computeTopShips(booked);
  const activeOffers = computeActiveOffers(offers);
  const insights = generateInsights(playerContext, topShips, activeOffers);
  
  const result: ContextIntelligence = {
    player: playerContext,
    topShips,
    activeOffers,
    insights,
    timestamp: new Date().toISOString(),
  };
  
  console.log('[Context] Context computed:', result);
  
  return result;
});

function computePlayerContext(booked: any[]): PlayerContext {
  const completed = booked.filter(c => c.status === 'completed');
  const upcoming = booked.filter(c => c.status === 'booked');
  
  const totalPoints = completed.reduce((sum, c) => sum + (c.clubRoyalePoints || 0), 0);
  const totalSpend = completed.reduce((sum, c) => sum + (c.totalSpend || 0), 0);
  const avgSpend = completed.length > 0 ? totalSpend / completed.length : 0;
  
  let tier: 'Diamond' | 'Diamond Plus' | 'Diamond Elite' = 'Diamond';
  let pointsToNext = 700 - totalPoints;
  
  if (totalPoints >= 1400) {
    tier = 'Diamond Elite';
    pointsToNext = 0;
  } else if (totalPoints >= 700) {
    tier = 'Diamond Plus';
    pointsToNext = 1400 - totalPoints;
  }
  
  const sortedCompleted = completed.sort((a, b) => 
    new Date(b.endDate || b.startDate).getTime() - new Date(a.endDate || a.startDate).getTime()
  );
  
  const sortedUpcoming = upcoming.sort((a, b) => 
    new Date(a.startDate).getTime() - new Date(b.startDate).getTime()
  );
  
  return {
    tier,
    currentPoints: totalPoints,
    pointsToNextTier: pointsToNext,
    cruisePace: completed.length > 0 ? 365 / completed.length : 0,
    avgSpendPerCruise: avgSpend,
    totalCruises: booked.length,
    completedCruises: completed.length,
    upcomingCruises: upcoming.length,
    lastCruiseDate: sortedCompleted[0]?.endDate || sortedCompleted[0]?.startDate,
    nextCruiseDate: sortedUpcoming[0]?.startDate,
  };
}

function computeTopShips(booked: any[]): ShipContext[] {
  const shipMap = new Map<string, any[]>();
  
  booked.forEach(cruise => {
    const ship = cruise.ship || 'Unknown';
    if (!shipMap.has(ship)) {
      shipMap.set(ship, []);
    }
    shipMap.get(ship)!.push(cruise);
  });
  
  const shipContexts: ShipContext[] = [];
  
  shipMap.forEach((cruises, ship) => {
    const completed = cruises.filter(c => c.status === 'completed');
    const totalFreePlay = completed.reduce((sum, c) => sum + (c.freePlay || 0), 0);
    const totalWin = completed.reduce((sum, c) => sum + (c.totalWin || 0), 0);
    const avgFreePlay = completed.length > 0 ? totalFreePlay / completed.length : 0;
    const avgWin = completed.length > 0 ? totalWin / completed.length : 0;
    const avgROI = avgFreePlay > 0 ? (avgWin / avgFreePlay) * 100 : 0;
    
    let profitability: 'high' | 'medium' | 'low' = 'low';
    if (avgROI > 150) profitability = 'high';
    else if (avgROI > 100) profitability = 'medium';
    
    const sortedCruises = cruises.sort((a, b) => 
      new Date(b.endDate || b.startDate).getTime() - new Date(a.endDate || a.startDate).getTime()
    );
    
    shipContexts.push({
      ship,
      totalCruises: cruises.length,
      avgROI,
      avgFreePlay,
      avgWin,
      profitability,
      lastSailed: sortedCruises[0]?.endDate || sortedCruises[0]?.startDate,
    });
  });
  
  return shipContexts
    .sort((a, b) => b.avgROI - a.avgROI)
    .slice(0, 5);
}

function computeActiveOffers(offers: any[]): OfferContext[] {
  const now = new Date();
  
  return offers
    .filter(offer => {
      if (!offer.expiryDate) return true;
      return new Date(offer.expiryDate) > now;
    })
    .map(offer => {
      const expiryDate = offer.expiryDate || new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString();
      const daysUntilExpiry = Math.ceil((new Date(expiryDate).getTime() - now.getTime()) / (24 * 60 * 60 * 1000));
      
      const freePlay = offer.freePlay || 0;
      const estimatedValue = freePlay * 1.2;
      
      let roiSignal: 'strong' | 'moderate' | 'weak' = 'weak';
      if (freePlay >= 500) roiSignal = 'strong';
      else if (freePlay >= 200) roiSignal = 'moderate';
      
      return {
        offerId: offer.id,
        title: offer.title || offer.name || 'Untitled Offer',
        freePlay,
        estimatedValue,
        expiryDate,
        daysUntilExpiry,
        applicableShips: offer.ships || [],
        roiSignal,
      };
    })
    .sort((a, b) => b.freePlay - a.freePlay)
    .slice(0, 10);
}

function generateInsights(player: PlayerContext, ships: ShipContext[], offers: OfferContext[]): string[] {
  const insights: string[] = [];
  
  if (player.pointsToNextTier > 0 && player.pointsToNextTier <= 100) {
    insights.push(`You're only ${player.pointsToNextTier} points away from ${player.tier === 'Diamond' ? 'Diamond Plus' : 'Diamond Elite'}!`);
  }
  
  if (player.upcomingCruises > 0) {
    insights.push(`${player.upcomingCruises} cruise${player.upcomingCruises > 1 ? 's' : ''} booked`);
  }
  
  const highProfitShips = ships.filter(s => s.profitability === 'high');
  if (highProfitShips.length > 0) {
    insights.push(`${highProfitShips[0].ship} has your best ROI at ${highProfitShips[0].avgROI.toFixed(0)}%`);
  }
  
  const expiringOffers = offers.filter(o => o.daysUntilExpiry <= 7);
  if (expiringOffers.length > 0) {
    insights.push(`${expiringOffers.length} offer${expiringOffers.length > 1 ? 's' : ''} expiring soon`);
  }
  
  const strongOffers = offers.filter(o => o.roiSignal === 'strong');
  if (strongOffers.length > 0) {
    insights.push(`${strongOffers.length} high-value offer${strongOffers.length > 1 ? 's' : ''} available`);
  }
  
  return insights;
}
