import { publicProcedure } from '../../../create-context';
import { memoryStore } from '../../_stores/memory';
import { z } from 'zod';

export const portfolioOptimizationProcedure = publicProcedure
  .input(z.object({
    optimizationType: z.enum(['roi', 'risk', 'points', 'balanced']).optional(),
  }).optional())
  .query(({ input }) => {
    console.log('[tRPC] Portfolio Optimization - Phase 3');
    
    const cruises = memoryStore.getCruises();
    const bookedCruises = memoryStore.getBookedCruises();
    const allAnalytics = memoryStore.getAllCasinoAnalytics();
    const statements = memoryStore.getCruiseStatements();
    const receipts = memoryStore.getReceipts();
    const userProfile = memoryStore.getUserProfile();
    const casinoOffers = memoryStore.getCasinoOffers();
    
    if (allAnalytics.length === 0) {
      return {
        recommendations: [],
        portfolioScore: 0,
        optimizationSuggestions: [],
        shipRecommendations: [],
        cabinTypeOptimization: [],
        message: 'Complete more cruises to receive optimization recommendations.',
      };
    }
    
    const today = new Date();
    const avgROI = allAnalytics.reduce((sum, a) => sum + a.roi, 0) / allAnalytics.length;
    const totalCoinIn = allAnalytics.reduce((sum, a) => sum + a.coinIn, 0);
    const totalSavings = allAnalytics.reduce((sum, a) => sum + a.savings, 0);
    const avgCoinInPerCruise = totalCoinIn / allAnalytics.length;
    
    const shipAnalysis = allAnalytics.reduce((acc, analytics) => {
      const cruise = cruises.find(c => c.id === analytics.cruiseId);
      if (!cruise) return acc;
      
      const ship = cruise.ship;
      if (!acc[ship]) {
        acc[ship] = {
          ship,
          cruiseCount: 0,
          totalROI: 0,
          avgROI: 0,
          totalSavings: 0,
          avgSavings: 0,
          totalCoinIn: 0,
          avgCoinIn: 0,
        };
      }
      
      acc[ship].cruiseCount++;
      acc[ship].totalROI += analytics.roi;
      acc[ship].totalSavings += analytics.savings;
      acc[ship].totalCoinIn += analytics.coinIn;
      
      return acc;
    }, {} as Record<string, any>);
    
    Object.keys(shipAnalysis).forEach(ship => {
      const data = shipAnalysis[ship];
      data.avgROI = data.totalROI / data.cruiseCount;
      data.avgSavings = data.totalSavings / data.cruiseCount;
      data.avgCoinIn = data.totalCoinIn / data.cruiseCount;
    });
    
    const shipRankings = Object.values(shipAnalysis)
      .sort((a: any, b: any) => b.avgROI - a.avgROI)
      .slice(0, 5);
    
    const cabinTypeAnalysis = allAnalytics.reduce((acc, analytics) => {
      const cruise = cruises.find(c => c.id === analytics.cruiseId);
      if (!cruise || !cruise.cabinType) return acc;
      
      const cabinType = cruise.cabinType;
      if (!acc[cabinType]) {
        acc[cabinType] = {
          cabinType,
          cruiseCount: 0,
          totalROI: 0,
          avgROI: 0,
          totalSavings: 0,
          avgSavings: 0,
          totalOutOfPocket: 0,
          avgOutOfPocket: 0,
        };
      }
      
      acc[cabinType].cruiseCount++;
      acc[cabinType].totalROI += analytics.roi;
      acc[cabinType].totalSavings += analytics.savings;
      acc[cabinType].totalOutOfPocket += analytics.outOfPocket;
      
      return acc;
    }, {} as Record<string, any>);
    
    Object.keys(cabinTypeAnalysis).forEach(cabinType => {
      const data = cabinTypeAnalysis[cabinType];
      data.avgROI = data.totalROI / data.cruiseCount;
      data.avgSavings = data.totalSavings / data.cruiseCount;
      data.avgOutOfPocket = data.totalOutOfPocket / data.cruiseCount;
    });
    
    const cabinTypeRankings = Object.values(cabinTypeAnalysis)
      .sort((a: any, b: any) => b.avgROI - a.avgROI);
    
    const recommendations = [];
    
    if (avgROI > 50) {
      recommendations.push({
        type: 'success',
        priority: 'low',
        title: '🎯 Excellent Portfolio Performance',
        description: `Your average ROI of ${avgROI.toFixed(1)}% is exceptional. Continue your current strategy.`,
        action: null,
      });
    } else if (avgROI > 25) {
      recommendations.push({
        type: 'info',
        priority: 'medium',
        title: '✅ Good Portfolio Performance',
        description: `Your average ROI of ${avgROI.toFixed(1)}% is solid. Consider optimizing for higher returns.`,
        action: 'Focus on ships and cabin types with highest ROI',
      });
    } else {
      recommendations.push({
        type: 'warning',
        priority: 'high',
        title: '⚠️ Portfolio Optimization Needed',
        description: `Your average ROI of ${avgROI.toFixed(1)}% could be improved significantly.`,
        action: 'Review ship and cabin type selections, increase casino play',
      });
    }
    
    if (shipRankings.length > 0 && shipRankings[0].avgROI > avgROI * 1.2) {
      recommendations.push({
        type: 'success',
        priority: 'high',
        title: `🚢 Ship Optimization: ${shipRankings[0].ship}`,
        description: `${shipRankings[0].ship} delivers ${shipRankings[0].avgROI.toFixed(1)}% average ROI across ${shipRankings[0].cruiseCount} cruises.`,
        action: `Prioritize ${shipRankings[0].ship} for future bookings`,
      });
    }
    
    const worstShips = Object.values(shipAnalysis)
      .filter((s: any) => s.avgROI < avgROI * 0.7)
      .sort((a: any, b: any) => a.avgROI - b.avgROI);
    
    if (worstShips.length > 0) {
      recommendations.push({
        type: 'warning',
        priority: 'medium',
        title: `📉 Underperforming Ships`,
        description: `${worstShips.map((s: any) => s.ship).join(', ')} have below-average ROI. Consider avoiding or adjusting strategy.`,
        action: 'Shift bookings to higher-performing ships',
      });
    }
    
    const bestCabinType = cabinTypeRankings[0];
    if (bestCabinType && bestCabinType.avgROI > avgROI * 1.15) {
      recommendations.push({
        type: 'info',
        priority: 'medium',
        title: `🛏 Cabin Type Optimization`,
        description: `${bestCabinType.cabinType} cabins deliver ${bestCabinType.avgROI.toFixed(1)}% ROI with $${bestCabinType.avgOutOfPocket.toFixed(0)} avg out-of-pocket.`,
        action: `Consider ${bestCabinType.cabinType} for future bookings`,
      });
    }
    
    const upcomingBookedCruises = bookedCruises.filter(c => {
      try {
        const depDate = new Date(c.departureDate);
        return depDate > today;
      } catch {
        return false;
      }
    });
    
    if (upcomingBookedCruises.length === 0) {
      recommendations.push({
        type: 'info',
        priority: 'high',
        title: '📅 No Upcoming Cruises',
        description: 'You have no upcoming cruises booked. Consider booking cruises on high-performing ships.',
        action: 'Review available casino offers and book strategically',
      });
    }
    
    const excellentCruises = allAnalytics.filter(a => a.roi > 50).length;
    const poorCruises = allAnalytics.filter(a => a.roi <= 0).length;
    
    if (poorCruises > excellentCruises) {
      recommendations.push({
        type: 'warning',
        priority: 'high',
        title: '🔴 Portfolio Imbalance',
        description: `You have ${poorCruises} poor-performing cruises vs ${excellentCruises} excellent ones.`,
        action: 'Focus on consistent high-ROI bookings',
      });
    }
    
    if (avgCoinInPerCruise < 5000 && userProfile && userProfile.points < 10000) {
      recommendations.push({
        type: 'info',
        priority: 'medium',
        title: '🎰 Increase Casino Play',
        description: `Your average coin-in of $${avgCoinInPerCruise.toFixed(0)}/cruise is moderate. Increasing play could unlock better offers.`,
        action: 'Target $7500+ coin-in per cruise for premium offers',
      });
    }
    
    let portfolioScore = 50;
    if (avgROI > 40) portfolioScore += 20;
    else if (avgROI > 25) portfolioScore += 10;
    else if (avgROI < 10) portfolioScore -= 15;
    
    if (excellentCruises > poorCruises) portfolioScore += 15;
    if (totalSavings > totalCoinIn * 0.3) portfolioScore += 10;
    if (upcomingBookedCruises.length >= 2) portfolioScore += 5;
    
    portfolioScore = Math.max(0, Math.min(100, portfolioScore));
    
    const optimizationSuggestions = [];
    
    if (input?.optimizationType === 'roi' || input?.optimizationType === 'balanced') {
      optimizationSuggestions.push({
        category: 'ROI Optimization',
        suggestions: [
          `Book cruises on ${shipRankings.slice(0, 2).map((s: any) => s.ship).join(' or ')} for best ROI`,
          `Target ${bestCabinType?.cabinType || 'Interior'} cabins for optimal value`,
          `Maintain casino spend above $${(avgCoinInPerCruise * 1.2).toFixed(0)}/cruise`,
        ],
      });
    }
    
    if (input?.optimizationType === 'risk' || input?.optimizationType === 'balanced') {
      const lowRiskShips = Object.values(shipAnalysis)
        .filter((s: any) => s.cruiseCount >= 2)
        .sort((a: any, b: any) => {
          const aVariance = Math.abs(a.avgROI - avgROI);
          const bVariance = Math.abs(b.avgROI - avgROI);
          return aVariance - bVariance;
        })
        .slice(0, 2);
      
      optimizationSuggestions.push({
        category: 'Risk Management',
        suggestions: [
          `Focus on proven ships: ${lowRiskShips.map((s: any) => s.ship).join(', ')}`,
          `Set max out-of-pocket limit of $${(bestCabinType?.avgOutOfPocket * 1.5 || 5000).toFixed(0)}/cruise`,
          `Diversify cabin types to reduce variance`,
        ],
      });
    }
    
    if (input?.optimizationType === 'points' || input?.optimizationType === 'balanced') {
      const highCoinInShips = Object.values(shipAnalysis)
        .sort((a: any, b: any) => b.avgCoinIn - a.avgCoinIn)
        .slice(0, 2);
      
      optimizationSuggestions.push({
        category: 'Points Maximization',
        suggestions: [
          `Target ${highCoinInShips.map((s: any) => s.ship).join(' or ')} for highest coin-in`,
          `Aim for ${Math.ceil((userProfile?.nextLevelPoints || 25000) / 5)} coin-in for next tier`,
          `Book longer cruises (7+ nights) for more casino time`,
        ],
      });
    }
    
    return {
      recommendations: recommendations.sort((a, b) => {
        const priorityWeight = { high: 3, medium: 2, low: 1 };
        return priorityWeight[b.priority as keyof typeof priorityWeight] - priorityWeight[a.priority as keyof typeof priorityWeight];
      }),
      portfolioScore,
      optimizationSuggestions,
      shipRecommendations: shipRankings.map((s: any) => ({
        ship: s.ship,
        avgROI: s.avgROI,
        cruiseCount: s.cruiseCount,
        totalSavings: s.totalSavings,
        recommendation: s.avgROI > avgROI * 1.15 ? 'Highly Recommended' :
                       s.avgROI > avgROI ? 'Recommended' :
                       s.avgROI > avgROI * 0.85 ? 'Neutral' : 'Avoid',
      })),
      cabinTypeOptimization: cabinTypeRankings.map((c: any) => ({
        cabinType: c.cabinType,
        avgROI: c.avgROI,
        avgOutOfPocket: c.avgOutOfPocket,
        avgSavings: c.avgSavings,
        cruiseCount: c.cruiseCount,
        recommendation: c.avgROI > avgROI * 1.15 ? 'Highly Recommended' :
                       c.avgROI > avgROI ? 'Recommended' :
                       c.avgROI > avgROI * 0.85 ? 'Neutral' : 'Consider Alternatives',
      })),
      summary: {
        portfolioScore,
        avgROI,
        totalCruises: allAnalytics.length,
        excellentCruises,
        poorCruises,
        totalSavings,
        avgCoinInPerCruise,
      },
      timestamp: new Date().toISOString(),
    };
  });
