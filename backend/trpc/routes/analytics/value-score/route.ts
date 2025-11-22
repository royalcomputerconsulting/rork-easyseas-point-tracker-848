import { z } from 'zod';
import { publicProcedure } from '../../../create-context';
import { memoryStore } from '../../_stores/memory';

/**
 * FEATURE 4: CRUISE VALUE SCORE (0-100)
 * 
 * A unified scoring system that weighs multiple factors to determine
 * the overall value and attractiveness of each cruise opportunity.
 * 
 * Scoring Components:
 * - ROI potential (25%)
 * - Offer value (20%)
 * - Ship profitability from history (15%)
 * - Schedule fit (15%)
 * - Departure port distance (10%)
 * - Cabin type match (10%)
 * - Real-time market pricing (5%)
 */

interface ValueScoreFactors {
  roiScore: number;
  offerValueScore: number;
  shipProfitabilityScore: number;
  scheduleScore: number;
  portDistanceScore: number;
  cabinMatchScore: number;
  pricingScore: number;
}

interface CruiseValueScore {
  cruiseId: string;
  ship: string;
  itinerary: string;
  departureDate: string;
  totalScore: number;
  factors: ValueScoreFactors;
  recommendation: 'excellent' | 'good' | 'fair' | 'poor';
  insights: string[];
}

const WEIGHTS = {
  roi: 0.25,
  offerValue: 0.20,
  shipProfitability: 0.15,
  schedule: 0.15,
  portDistance: 0.10,
  cabinMatch: 0.10,
  pricing: 0.05,
} as const;

const PORT_DISTANCES: Record<string, number> = {
  'Los Angeles': 0,
  'Long Beach': 0,
  'San Pedro': 0,
  'San Diego': 10,
  'Galveston': 50,
  'Fort Lauderdale': 70,
  'Miami': 70,
  'Port Canaveral': 70,
  'Seattle': 80,
  'Vancouver': 85,
  'New York': 90,
  'Boston': 95,
  'Baltimore': 75,
} as const;

function calculateROIScore(cruiseId: string): number {
  const analytics = memoryStore.getCasinoAnalytics(cruiseId);
  if (!analytics || analytics.length === 0) {
    const allAnalytics = memoryStore.getAllCasinoAnalytics();
    if (allAnalytics.length === 0) return 50;
    const avgROI = allAnalytics.reduce((sum, a) => sum + a.roi, 0) / allAnalytics.length;
    return Math.min(100, Math.max(0, avgROI));
  }
  
  const roi = analytics[0].roi;
  return Math.min(100, Math.max(0, roi));
}

function calculateOfferValueScore(cruiseId: string): number {
  const cruise = memoryStore.getCruises().find(c => c.id === cruiseId);
  if (!cruise) return 0;
  
  const offers = memoryStore.getCasinoOffers();
  const applicableOffers = offers.filter(offer => {
    if (offer.offerCode && cruise.offerCode) {
      return offer.offerCode === cruise.offerCode;
    }
    if (offer.sailingDates && cruise.departureDate) {
      return offer.sailingDates.some(date => date === cruise.departureDate);
    }
    return false;
  });
  
  if (applicableOffers.length === 0) return 30;
  
  const totalValue = applicableOffers.reduce((sum, offer) => {
    const value = parseFloat(offer.tradeInValue?.replace(/[$,]/g, '') || '0');
    return sum + value;
  }, 0);
  
  const normalizedValue = Math.min(100, (totalValue / 50));
  return normalizedValue;
}

function calculateShipProfitabilityScore(ship: string): number {
  const allCruises = memoryStore.getCruises();
  const shipCruises = allCruises.filter(c => 
    c.ship?.toLowerCase().includes(ship.toLowerCase())
  );
  
  if (shipCruises.length === 0) return 50;
  
  const allAnalytics = memoryStore.getAllCasinoAnalytics();
  const shipAnalytics = shipCruises
    .map(c => allAnalytics.find(a => a.cruiseId === c.id))
    .filter(Boolean);
  
  if (shipAnalytics.length === 0) return 50;
  
  const avgROI = shipAnalytics.reduce((sum, a) => sum + (a?.roi || 0), 0) / shipAnalytics.length;
  return Math.min(100, Math.max(0, avgROI));
}

function calculateScheduleScore(departureDate: string): number {
  const departure = new Date(departureDate);
  const now = new Date();
  const daysUntil = Math.floor((departure.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
  
  if (daysUntil < 0) return 0;
  if (daysUntil < 30) return 30;
  if (daysUntil > 365) return 40;
  
  const bookedCruises = memoryStore.getBookedCruises();
  const hasConflict = bookedCruises.some(booked => {
    const bookedStart = new Date(booked.departureDate);
    const bookedEnd = new Date(booked.returnDate);
    return departure >= bookedStart && departure <= bookedEnd;
  });
  
  if (hasConflict) return 0;
  
  const optimalRange = daysUntil >= 60 && daysUntil <= 180;
  return optimalRange ? 100 : 70;
}

function calculatePortDistanceScore(departurePort: string): number {
  const port = Object.keys(PORT_DISTANCES).find(p => 
    departurePort?.toLowerCase().includes(p.toLowerCase())
  );
  
  if (!port) return 50;
  
  const distance = PORT_DISTANCES[port as keyof typeof PORT_DISTANCES];
  return Math.max(0, 100 - distance);
}

function calculateCabinMatchScore(cabinType: string | undefined): number {
  if (!cabinType) return 50;
  
  const cabin = cabinType.toLowerCase();
  if (cabin.includes('suite')) return 100;
  if (cabin.includes('balcony')) return 80;
  if (cabin.includes('oceanview') || cabin.includes('ocean view')) return 60;
  if (cabin.includes('interior')) return 40;
  
  return 50;
}

function calculatePricingScore(cruiseId: string): number {
  const cruise = memoryStore.getCruises().find(c => c.id === cruiseId);
  if (!cruise) return 50;
  
  const hasPricing = cruise.interiorPrice || cruise.balconyPrice || cruise.pricing?.interior;
  if (!hasPricing) return 50;
  
  const lowestPrice = Math.min(
    cruise.interiorPrice || Infinity,
    cruise.oceanviewPrice || Infinity,
    cruise.balconyPrice || Infinity,
    cruise.suitePrice || Infinity
  );
  
  if (lowestPrice === Infinity) return 50;
  
  const avgPrice = 1500;
  const priceRatio = avgPrice / lowestPrice;
  return Math.min(100, Math.max(0, priceRatio * 50));
}

function calculateTotalScore(factors: ValueScoreFactors): number {
  return (
    factors.roiScore * WEIGHTS.roi +
    factors.offerValueScore * WEIGHTS.offerValue +
    factors.shipProfitabilityScore * WEIGHTS.shipProfitability +
    factors.scheduleScore * WEIGHTS.schedule +
    factors.portDistanceScore * WEIGHTS.portDistance +
    factors.cabinMatchScore * WEIGHTS.cabinMatch +
    factors.pricingScore * WEIGHTS.pricing
  );
}

function generateInsights(cruise: any, factors: ValueScoreFactors, totalScore: number): string[] {
  const insights: string[] = [];
  
  if (factors.roiScore >= 75) {
    insights.push('Excellent ROI potential based on historical data');
  } else if (factors.roiScore < 25) {
    insights.push('Lower ROI potential - consider other options');
  }
  
  if (factors.offerValueScore >= 70) {
    insights.push('Strong casino offer value available');
  }
  
  if (factors.shipProfitabilityScore >= 80) {
    insights.push(`${cruise.ship} has proven to be highly profitable`);
  }
  
  if (factors.scheduleScore === 0) {
    insights.push('Schedule conflict detected with booked cruise');
  } else if (factors.scheduleScore >= 90) {
    insights.push('Perfect timing - optimal booking window');
  }
  
  if (factors.portDistanceScore >= 90) {
    insights.push('No airfare needed - driving distance from Phoenix');
  } else if (factors.portDistanceScore < 30) {
    insights.push('Consider airfare costs from Phoenix');
  }
  
  if (factors.cabinMatchScore >= 90) {
    insights.push('Cabin type matches your preferences perfectly');
  }
  
  if (totalScore >= 80) {
    insights.push('🌟 Top-tier opportunity - highly recommended');
  } else if (totalScore < 40) {
    insights.push('⚠️ Multiple concerns - proceed with caution');
  }
  
  return insights;
}

function getRecommendation(score: number): 'excellent' | 'good' | 'fair' | 'poor' {
  if (score >= 80) return 'excellent';
  if (score >= 60) return 'good';
  if (score >= 40) return 'fair';
  return 'poor';
}

export const cruiseValueScoreProcedure = publicProcedure
  .input(z.object({
    cruiseIds: z.array(z.string()).optional(),
  }))
  .query(({ input }) => {
    console.log('[tRPC] Calculating cruise value scores');
    
    const cruises = memoryStore.getCruises();
    const targetCruises = input.cruiseIds 
      ? cruises.filter(c => input.cruiseIds!.includes(c.id))
      : cruises;
    
    const scores: CruiseValueScore[] = targetCruises.map(cruise => {
      const factors: ValueScoreFactors = {
        roiScore: calculateROIScore(cruise.id),
        offerValueScore: calculateOfferValueScore(cruise.id),
        shipProfitabilityScore: calculateShipProfitabilityScore(cruise.ship),
        scheduleScore: calculateScheduleScore(cruise.departureDate),
        portDistanceScore: calculatePortDistanceScore(cruise.departurePort || ''),
        cabinMatchScore: calculateCabinMatchScore(cruise.cabinType),
        pricingScore: calculatePricingScore(cruise.id),
      };
      
      const totalScore = Math.round(calculateTotalScore(factors));
      const insights = generateInsights(cruise, factors, totalScore);
      const recommendation = getRecommendation(totalScore);
      
      return {
        cruiseId: cruise.id,
        ship: cruise.ship,
        itinerary: cruise.itineraryName,
        departureDate: cruise.departureDate,
        totalScore,
        factors,
        recommendation,
        insights,
      };
    });
    
    scores.sort((a, b) => b.totalScore - a.totalScore);
    
    const summary = {
      totalCruisesScored: scores.length,
      excellentCount: scores.filter(s => s.recommendation === 'excellent').length,
      goodCount: scores.filter(s => s.recommendation === 'good').length,
      fairCount: scores.filter(s => s.recommendation === 'fair').length,
      poorCount: scores.filter(s => s.recommendation === 'poor').length,
      averageScore: scores.length > 0 
        ? Math.round(scores.reduce((sum, s) => sum + s.totalScore, 0) / scores.length)
        : 0,
      topCruises: scores.slice(0, 5),
    };
    
    return {
      scores,
      summary,
      weights: WEIGHTS,
      generatedAt: new Date().toISOString(),
    };
  });
