import { z } from 'zod';
import { publicProcedure } from '../../../create-context';
import { memoryStore } from '../../_stores/memory';
import type { Cruise } from '@/types/models';

interface PriceHistoryPoint {
  date: string;
  cabinType: 'interior' | 'oceanview' | 'balcony' | 'suite';
  price: number;
  source: string;
}

interface BookingWindowAnalysis {
  cruiseId: string;
  ship: string;
  itineraryName: string;
  departureDate: string;
  daysUntilDeparture: number;
  
  currentPricing: {
    interior?: number;
    oceanview?: number;
    balcony?: number;
    suite?: number;
  };
  
  lowestPricing: {
    interior?: number;
    oceanview?: number;
    balcony?: number;
    suite?: number;
    recordedAt?: string;
  };
  
  priceHistory: PriceHistoryPoint[];
  
  priceDrops: {
    cabinType: string;
    oldPrice: number;
    newPrice: number;
    dropAmount: number;
    dropPercentage: number;
    date: string;
  }[];
  
  bookingRecommendation: {
    timing: 'book-now' | 'wait' | 'monitor' | 'peak-passed';
    confidence: 'high' | 'medium' | 'low';
    reason: string;
    estimatedSavings?: number;
  };
  
  historicalPattern: {
    isAtHistoricalLow: boolean;
    percentileRank: number; // 0-100, where 100 = highest price, 0 = lowest
    averagePrice: number;
    trendDirection: 'increasing' | 'decreasing' | 'stable';
  };
}

const analyzePriceHistory = (cruise: Cruise): PriceHistoryPoint[] => {
  const history: PriceHistoryPoint[] = [];
  
  if (cruise.pricingCurrent) {
    const current = cruise.pricingCurrent;
    const date = current.fetchedAt || new Date().toISOString();
    
    if (current.interior) history.push({ date, cabinType: 'interior', price: current.interior, source: current.source || 'current' });
    if (current.oceanview) history.push({ date, cabinType: 'oceanview', price: current.oceanview, source: current.source || 'current' });
    if (current.balcony) history.push({ date, cabinType: 'balcony', price: current.balcony, source: current.source || 'current' });
    if (current.suite) history.push({ date, cabinType: 'suite', price: current.suite, source: current.source || 'current' });
  }
  
  if (cruise.pricingLowest) {
    const lowest = cruise.pricingLowest;
    const date = lowest.fetchedAt || new Date().toISOString();
    
    if (lowest.interior) history.push({ date, cabinType: 'interior', price: lowest.interior, source: 'lowest' });
    if (lowest.oceanview) history.push({ date, cabinType: 'oceanview', price: lowest.oceanview, source: 'lowest' });
    if (lowest.balcony) history.push({ date, cabinType: 'balcony', price: lowest.balcony, source: 'lowest' });
    if (lowest.suite) history.push({ date, cabinType: 'suite', price: lowest.suite, source: 'lowest' });
  }
  
  if (cruise.interiorPrice) history.push({ date: cruise.updatedAt, cabinType: 'interior', price: cruise.interiorPrice, source: 'cruise-data' });
  if (cruise.oceanviewPrice) history.push({ date: cruise.updatedAt, cabinType: 'oceanview', price: cruise.oceanviewPrice, source: 'cruise-data' });
  if (cruise.balconyPrice) history.push({ date: cruise.updatedAt, cabinType: 'balcony', price: cruise.balconyPrice, source: 'cruise-data' });
  if (cruise.suitePrice) history.push({ date: cruise.updatedAt, cabinType: 'suite', price: cruise.suitePrice, source: 'cruise-data' });
  
  return history.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
};

const detectPriceDrops = (history: PriceHistoryPoint[]): {
  cabinType: string;
  oldPrice: number;
  newPrice: number;
  dropAmount: number;
  dropPercentage: number;
  date: string;
}[] => {
  const drops: any[] = [];
  const byCabinType = new Map<string, PriceHistoryPoint[]>();
  
  history.forEach(point => {
    if (!byCabinType.has(point.cabinType)) {
      byCabinType.set(point.cabinType, []);
    }
    byCabinType.get(point.cabinType)!.push(point);
  });
  
  byCabinType.forEach((points, cabinType) => {
    for (let i = 1; i < points.length; i++) {
      const prev = points[i - 1];
      const curr = points[i];
      
      if (curr.price < prev.price) {
        const dropAmount = prev.price - curr.price;
        const dropPercentage = (dropAmount / prev.price) * 100;
        
        if (dropPercentage >= 5) {
          drops.push({
            cabinType,
            oldPrice: prev.price,
            newPrice: curr.price,
            dropAmount,
            dropPercentage,
            date: curr.date
          });
        }
      }
    }
  });
  
  return drops.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
};

const calculateHistoricalPattern = (cruise: Cruise, history: PriceHistoryPoint[]) => {
  if (history.length === 0) {
    return {
      isAtHistoricalLow: false,
      percentileRank: 50,
      averagePrice: 0,
      trendDirection: 'stable' as const
    };
  }
  
  const balconyPrices = history.filter(h => h.cabinType === 'balcony').map(h => h.price);
  const currentBalcony = cruise.pricingCurrent?.balcony || cruise.balconyPrice;
  
  if (balconyPrices.length === 0 || !currentBalcony) {
    return {
      isAtHistoricalLow: false,
      percentileRank: 50,
      averagePrice: 0,
      trendDirection: 'stable' as const
    };
  }
  
  const minPrice = Math.min(...balconyPrices);
  const maxPrice = Math.max(...balconyPrices);
  const avgPrice = balconyPrices.reduce((sum, p) => sum + p, 0) / balconyPrices.length;
  
  const isAtHistoricalLow = currentBalcony <= minPrice * 1.05;
  
  const percentileRank = maxPrice > minPrice 
    ? ((currentBalcony - minPrice) / (maxPrice - minPrice)) * 100 
    : 50;
  
  let trendDirection: 'increasing' | 'decreasing' | 'stable' = 'stable';
  if (balconyPrices.length >= 2) {
    const recent = balconyPrices.slice(-3);
    const older = balconyPrices.slice(0, Math.max(1, balconyPrices.length - 3));
    
    const recentAvg = recent.reduce((sum, p) => sum + p, 0) / recent.length;
    const olderAvg = older.reduce((sum, p) => sum + p, 0) / older.length;
    
    if (recentAvg > olderAvg * 1.1) trendDirection = 'increasing';
    else if (recentAvg < olderAvg * 0.9) trendDirection = 'decreasing';
  }
  
  return {
    isAtHistoricalLow,
    percentileRank: Math.round(percentileRank),
    averagePrice: Math.round(avgPrice),
    trendDirection
  };
};

const generateBookingRecommendation = (
  cruise: Cruise,
  daysUntilDeparture: number,
  priceDrops: any[],
  historicalPattern: any
): BookingWindowAnalysis['bookingRecommendation'] => {
  const currentBalcony = cruise.pricingCurrent?.balcony || cruise.balconyPrice || 0;
  const lowestBalcony = cruise.pricingLowest?.balcony || currentBalcony;
  
  if (historicalPattern.isAtHistoricalLow) {
    return {
      timing: 'book-now',
      confidence: 'high',
      reason: 'Price is at historical low. Book immediately to lock in savings.',
      estimatedSavings: currentBalcony > lowestBalcony ? currentBalcony - lowestBalcony : 0
    };
  }
  
  if (daysUntilDeparture <= 60) {
    if (historicalPattern.percentileRank <= 30) {
      return {
        timing: 'book-now',
        confidence: 'high',
        reason: 'Excellent price within 60 days of departure. Last-minute deals unlikely.'
      };
    } else {
      return {
        timing: 'monitor',
        confidence: 'medium',
        reason: 'Close to departure but price not optimal. Monitor for last-minute drops.'
      };
    }
  }
  
  if (daysUntilDeparture >= 180) {
    if (historicalPattern.trendDirection === 'decreasing') {
      return {
        timing: 'wait',
        confidence: 'medium',
        reason: 'Prices are trending down. Wait 30-60 days for better deals.',
        estimatedSavings: Math.round(currentBalcony * 0.15)
      };
    } else {
      return {
        timing: 'monitor',
        confidence: 'low',
        reason: 'Early booking window. Monitor price trends over next 60 days.'
      };
    }
  }
  
  const recentDrops = priceDrops.filter(d => {
    const dropDate = new Date(d.date);
    const daysSinceDrop = Math.floor((Date.now() - dropDate.getTime()) / (1000 * 60 * 60 * 24));
    return daysSinceDrop <= 14;
  });
  
  if (recentDrops.length > 0 && recentDrops[0].dropPercentage >= 10) {
    return {
      timing: 'book-now',
      confidence: 'high',
      reason: `Recent ${recentDrops[0].dropPercentage.toFixed(0)}% price drop. Likely won't go lower.`,
      estimatedSavings: recentDrops[0].dropAmount
    };
  }
  
  if (historicalPattern.percentileRank <= 25) {
    return {
      timing: 'book-now',
      confidence: 'high',
      reason: 'Price is in bottom 25% of historical range. Excellent value.'
    };
  }
  
  if (historicalPattern.percentileRank >= 75) {
    return {
      timing: 'wait',
      confidence: 'medium',
      reason: 'Price is in top 25% of range. Wait for price drop.',
      estimatedSavings: Math.round(currentBalcony * 0.2)
    };
  }
  
  return {
    timing: 'monitor',
    confidence: 'medium',
    reason: 'Price is average. Continue monitoring for optimal timing.'
  };
};

export const getBookingWindowPredictionProcedure = publicProcedure
  .input(z.object({
    cruiseId: z.string()
  }))
  .query(({ input }) => {
    console.log('[Intelligence] Getting booking window prediction for cruise:', input.cruiseId);
    
    const cruise = memoryStore.getCruise(input.cruiseId);
    
    if (!cruise) {
      throw new Error(`Cruise not found: ${input.cruiseId}`);
    }
    
    const today = new Date();
    const departureDate = new Date(cruise.departureDate);
    const daysUntilDeparture = Math.ceil((departureDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    
    const history = analyzePriceHistory(cruise);
    const priceDrops = detectPriceDrops(history);
    const historicalPattern = calculateHistoricalPattern(cruise, history);
    const recommendation = generateBookingRecommendation(cruise, daysUntilDeparture, priceDrops, historicalPattern);
    
    const analysis: BookingWindowAnalysis = {
      cruiseId: cruise.id,
      ship: cruise.ship,
      itineraryName: cruise.itineraryName,
      departureDate: cruise.departureDate,
      daysUntilDeparture,
      
      currentPricing: {
        interior: cruise.pricingCurrent?.interior || cruise.interiorPrice || undefined,
        oceanview: cruise.pricingCurrent?.oceanview || cruise.oceanviewPrice || undefined,
        balcony: cruise.pricingCurrent?.balcony || cruise.balconyPrice || undefined,
        suite: cruise.pricingCurrent?.suite || cruise.suitePrice || undefined
      },
      
      lowestPricing: {
        interior: cruise.pricingLowest?.interior || undefined,
        oceanview: cruise.pricingLowest?.oceanview || undefined,
        balcony: cruise.pricingLowest?.balcony || undefined,
        suite: cruise.pricingLowest?.suite || undefined,
        recordedAt: cruise.pricingLowest?.fetchedAt || undefined
      },
      
      priceHistory: history,
      priceDrops,
      bookingRecommendation: recommendation,
      historicalPattern
    };
    
    console.log('[Intelligence] Booking window analysis:', {
      cruise: cruise.ship,
      daysUntil: daysUntilDeparture,
      recommendation: recommendation.timing,
      confidence: recommendation.confidence
    });
    
    return analysis;
  });

export const getAllBookingWindowsProcedure = publicProcedure
  .input(z.object({
    minDaysOut: z.number().default(0),
    maxDaysOut: z.number().default(365),
    onlyBookNow: z.boolean().default(false)
  }))
  .query(({ input }) => {
    console.log('[Intelligence] Getting all booking windows:', input);
    
    const cruises = memoryStore.getCruises();
    const today = new Date();
    
    const analyses = cruises
      .filter(cruise => {
        const departureDate = new Date(cruise.departureDate);
        const daysUntil = Math.ceil((departureDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
        return daysUntil >= input.minDaysOut && daysUntil <= input.maxDaysOut;
      })
      .map(cruise => {
        const departureDate = new Date(cruise.departureDate);
        const daysUntilDeparture = Math.ceil((departureDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
        
        const history = analyzePriceHistory(cruise);
        const priceDrops = detectPriceDrops(history);
        const historicalPattern = calculateHistoricalPattern(cruise, history);
        const recommendation = generateBookingRecommendation(cruise, daysUntilDeparture, priceDrops, historicalPattern);
        
        return {
          cruiseId: cruise.id,
          ship: cruise.ship,
          itineraryName: cruise.itineraryName,
          departureDate: cruise.departureDate,
          daysUntilDeparture,
          currentPricing: {
            interior: cruise.pricingCurrent?.interior || cruise.interiorPrice || undefined,
            oceanview: cruise.pricingCurrent?.oceanview || cruise.oceanviewPrice || undefined,
            balcony: cruise.pricingCurrent?.balcony || cruise.balconyPrice || undefined,
            suite: cruise.pricingCurrent?.suite || cruise.suitePrice || undefined
          },
          lowestPricing: {
            interior: cruise.pricingLowest?.interior || undefined,
            oceanview: cruise.pricingLowest?.oceanview || undefined,
            balcony: cruise.pricingLowest?.balcony || undefined,
            suite: cruise.pricingLowest?.suite || undefined,
            recordedAt: cruise.pricingLowest?.fetchedAt || undefined
          },
          priceHistory: history,
          priceDrops,
          bookingRecommendation: recommendation,
          historicalPattern
        } as BookingWindowAnalysis;
      })
      .filter(analysis => {
        if (input.onlyBookNow) {
          return analysis.bookingRecommendation.timing === 'book-now';
        }
        return true;
      })
      .sort((a, b) => {
        const priorityOrder = { 'book-now': 4, 'monitor': 3, 'wait': 2, 'peak-passed': 1 };
        const aScore = priorityOrder[a.bookingRecommendation.timing];
        const bScore = priorityOrder[b.bookingRecommendation.timing];
        
        if (aScore !== bScore) return bScore - aScore;
        
        return a.daysUntilDeparture - b.daysUntilDeparture;
      });
    
    const summary = {
      total: analyses.length,
      bookNow: analyses.filter(a => a.bookingRecommendation.timing === 'book-now').length,
      monitor: analyses.filter(a => a.bookingRecommendation.timing === 'monitor').length,
      wait: analyses.filter(a => a.bookingRecommendation.timing === 'wait').length,
      atHistoricalLow: analyses.filter(a => a.historicalPattern.isAtHistoricalLow).length,
      recentDrops: analyses.filter(a => a.priceDrops.length > 0).length,
      totalPotentialSavings: analyses.reduce((sum, a) => 
        sum + (a.bookingRecommendation.estimatedSavings || 0), 0
      )
    };
    
    console.log('[Intelligence] Booking window summary:', summary);
    
    return {
      analyses,
      summary,
      timestamp: new Date().toISOString()
    };
  });

export const trackPriceDropAlertsProcedure = publicProcedure
  .input(z.object({
    minDropPercentage: z.number().default(10),
    daysToCheck: z.number().default(14)
  }))
  .query(({ input }) => {
    console.log('[Intelligence] Tracking price drop alerts:', input);
    
    const cruises = memoryStore.getCruises();
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - input.daysToCheck);
    
    const alerts = cruises
      .map(cruise => {
        const history = analyzePriceHistory(cruise);
        const drops = detectPriceDrops(history);
        
        const recentSignificantDrops = drops.filter(drop => {
          const dropDate = new Date(drop.date);
          return dropDate >= cutoffDate && drop.dropPercentage >= input.minDropPercentage;
        });
        
        if (recentSignificantDrops.length === 0) return null;
        
        return {
          cruiseId: cruise.id,
          ship: cruise.ship,
          itineraryName: cruise.itineraryName,
          departureDate: cruise.departureDate,
          drops: recentSignificantDrops,
          biggestDrop: recentSignificantDrops.reduce((max, drop) => 
            drop.dropPercentage > max.dropPercentage ? drop : max
          ),
          currentPricing: {
            balcony: cruise.pricingCurrent?.balcony || cruise.balconyPrice
          }
        };
      })
      .filter((alert): alert is NonNullable<typeof alert> => alert !== null)
      .sort((a, b) => b.biggestDrop.dropPercentage - a.biggestDrop.dropPercentage);
    
    console.log('[Intelligence] Found price drop alerts:', alerts.length);
    
    return {
      alerts,
      summary: {
        totalAlerts: alerts.length,
        averageDropPercentage: alerts.length > 0 
          ? alerts.reduce((sum, a) => sum + a.biggestDrop.dropPercentage, 0) / alerts.length 
          : 0,
        totalSavings: alerts.reduce((sum, a) => sum + a.biggestDrop.dropAmount, 0)
      },
      timestamp: new Date().toISOString()
    };
  });
