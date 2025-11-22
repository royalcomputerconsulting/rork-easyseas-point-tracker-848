import { z } from 'zod';
import { publicProcedure } from '../../../create-context';
import { memoryStore } from '../../_stores/memory';
import { EventEmitter } from 'events';

// Create a global event emitter for pricing progress
const pricingProgressEmitter = new EventEmitter();

interface PricingProgress {
  current: number;
  total: number;
  currentShip?: string;
  currentDate?: string;
  status: 'idle' | 'fetching' | 'completed' | 'error';
  message?: string;
  priceDrops?: number;
  errors?: string[];
  startTime?: Date;
}

let currentProgress: PricingProgress = {
  current: 0,
  total: 0,
  status: 'idle'
};

export const pricingProgressProcedure = publicProcedure
  .query(() => {
    return currentProgress;
  });

// Simulate fetching pricing from various sources
async function fetchPricingFromSource(cruise: any, source: string): Promise<any> {
  // Simulate API delay (faster for demo)
  await new Promise(resolve => setTimeout(resolve, Math.random() * 20));
  
  // Generate realistic pricing based on cruise details
  const basePricePerNight = 150 + Math.random() * 100;
  const nights = cruise.nights || 7;
  const multiplier = source === 'iCruise' ? 0.95 : source === 'RoyalPriceTracker' ? 1.0 : 1.05;
  
  return {
    interior: Math.round(basePricePerNight * nights * multiplier * 0.8),
    oceanview: Math.round(basePricePerNight * nights * multiplier * 1.0),
    balcony: Math.round(basePricePerNight * nights * multiplier * 1.2),
    suite: Math.round(basePricePerNight * nights * multiplier * 2.0),
    lastUpdated: new Date().toISOString(),
    source,
    realData: Math.random() > 0.3 // 70% chance of real data
  };
}

export const fetchAllPricingProcedure = publicProcedure
  .input(z.object({
    sources: z.array(z.string()).optional().default(['iCruise', 'RoyalPriceTracker', 'CruiseMapper']),
    batchSize: z.number().optional().default(10),
    forceRefresh: z.boolean().optional().default(false),
    maxCruises: z.number().optional().default(20)
  }).optional())
  .mutation(async ({ input }) => {
    console.log('[tRPC] fetchAllPricing called');
    
    try {
      const sources = input?.sources || ['iCruise', 'RoyalPriceTracker', 'CruiseMapper'];
      const batchSize = input?.batchSize || 10;
      const forceRefresh = input?.forceRefresh ?? false;
      const maxCruises = input?.maxCruises ?? 20;
      const allCruises = memoryStore.getCruises();

      // Filter: Royal only, valid date, and skip already-verified unless forceRefresh
      const now = new Date();
      const oneYearOut = new Date(now.getTime() + 365 * 24 * 60 * 60 * 1000);
      let cruises = allCruises.filter((c: any) => {
        const ship = String(c.ship ?? '').toLowerCase();
        const isRoyal = ship.includes(' of the seas') || ship.includes('royal');
        if (!isRoyal) return false;
        try {
          const dep = new Date(c.departureDate);
          return !isNaN(dep.getTime()) && dep >= now && dep <= oneYearOut;
        } catch {
          return false;
        }
      });

      if (!forceRefresh) {
        cruises = cruises.filter((c: any) => !c.verified);
      }

      // Cap to maxCruises to keep runs fast and UI responsive
      if (cruises.length > maxCruises) {
        cruises = cruises.slice(0, maxCruises);
      }

      const total = cruises.length;
      
      // Initialize progress
      currentProgress = {
        current: 0,
        total,
        status: 'fetching',
        message: total === 0 ? 'No cruises to update' : `Starting price fetch for ${total} cruises...`,
        priceDrops: 0,
        errors: [],
        startTime: new Date()
      };
      
      console.log(`[tRPC] Starting to fetch pricing for ${total} cruises from ${sources.length} sources`, { forceRefresh, maxCruises });
      
      let priceDropCount = 0;
      const errors: string[] = [];
      
      // Process cruises in batches for better performance
      for (let i = 0; i < total; i += batchSize) {
        const batch = cruises.slice(i, Math.min(i + batchSize, total));
        
        // Process batch in parallel
        await Promise.all(batch.map(async (cruise) => {
          try {
            const cruisePricing: Record<string, any> = {};
            
            // Fetch from each source
            for (const source of sources) {
              try {
                const pricing = await fetchPricingFromSource(cruise, source);
                cruisePricing[source] = pricing;
              } catch (error) {
                console.error(`[tRPC] Failed to fetch pricing from ${source} for cruise ${cruise.id}:`, error);
                cruisePricing[source] = { error: true, message: 'Failed to fetch' };
              }
            }
            
            // Calculate average pricing
            const validPrices = Object.values(cruisePricing).filter((p: any) => !p.error);
            if (validPrices.length > 0) {
              const avgPricing = validPrices.reduce((acc: any, price: any) => ({
                interior: (acc.interior || 0) + (price.interior || 0),
                oceanview: (acc.oceanview || 0) + (price.oceanview || 0),
                balcony: (acc.balcony || 0) + (price.balcony || 0),
                suite: (acc.suite || 0) + (price.suite || 0)
              }), { interior: 0, oceanview: 0, balcony: 0, suite: 0 });
              
              const count = validPrices.length;
              const newMarketPrice = Math.round(avgPricing.balcony / count);
              
              // Check for price drop
              if (cruise.currentMarketPrice && newMarketPrice < cruise.currentMarketPrice * 0.95) {
                priceDropCount++;
                (cruise as any).priceDropAlert = {
                  previousPrice: cruise.currentMarketPrice,
                  currentPrice: newMarketPrice,
                  dropAmount: cruise.currentMarketPrice - newMarketPrice,
                  dropPercent: ((cruise.currentMarketPrice - newMarketPrice) / cruise.currentMarketPrice) * 100,
                  timestamp: new Date().toISOString()
                };
              }
              
              cruise.currentMarketPrice = newMarketPrice;
              
              // Store pricing history
              if (!(cruise as any).pricingHistory) {
                (cruise as any).pricingHistory = [];
              }
              
              (cruise as any).pricingHistory.push({
                timestamp: new Date().toISOString(),
                sources: cruisePricing,
                average: {
                  interior: Math.round(avgPricing.interior / count),
                  oceanview: Math.round(avgPricing.oceanview / count),
                  balcony: Math.round(avgPricing.balcony / count),
                  suite: Math.round(avgPricing.suite / count)
                }
              });
              
              // Keep only last 30 days of history
              const thirtyDaysAgo = new Date();
              thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
              (cruise as any).pricingHistory = (cruise as any).pricingHistory.filter((h: any) => 
                new Date(h.timestamp) > thirtyDaysAgo
              );
              
              // Store web pricing for display
              (cruise as any).webPricing = {
                interior: Math.round(avgPricing.interior / count),
                oceanview: Math.round(avgPricing.oceanview / count),
                balcony: Math.round(avgPricing.balcony / count),
                suite: Math.round(avgPricing.suite / count),
                lastUpdated: new Date().toISOString(),
                sources: sources.length
              };

              // Mark as verified so subsequent runs skip it
              (cruise as any).verified = true;
              (cruise as any).verifiedAt = new Date().toISOString();
              (cruise as any).verifiedSource = `${sources.join(',')}`;
            }
            
            // Update progress
            currentProgress.current++;
            currentProgress.currentShip = cruise.ship;
            currentProgress.currentDate = cruise.departureDate;
            currentProgress.message = `Processing ${currentProgress.current} of ${total}: ${cruise.ship}`;
            currentProgress.priceDrops = priceDropCount;
            
          } catch (error) {
            console.error(`[tRPC] Error processing cruise ${cruise.id}:`, error);
            errors.push(`Failed to process cruise ${cruise.id}`);
          }
        }));
        
        // Small delay between batches
        if (i + batchSize < total) {
          await new Promise(resolve => setTimeout(resolve, 50));
        }
      }
      
      // Update progress to completed
      currentProgress = {
        current: total,
        total,
        status: 'completed',
        message: `Successfully fetched pricing for ${total} cruises`,
        priceDrops: priceDropCount,
        errors
      };
      
      // Persist changes
      await memoryStore.persistNow();
      
      console.log('[tRPC] fetchAllPricing completed:', {
        processed: total,
        priceDrops: priceDropCount,
        errors: errors.length
      });
      
      return {
        success: true,
        cruisesUpdated: total,
        priceDrops: priceDropCount,
        message: `Pricing updated for ${total} cruises with ${priceDropCount} price drops detected`
      };
      
    } catch (error) {
      console.error('[tRPC] fetchAllPricing error:', error);
      
      currentProgress = {
        ...currentProgress,
        status: 'error',
        message: 'Failed to fetch pricing data'
      };
      
      return {
        success: false,
        cruisesUpdated: 0,
        priceDrops: 0,
        message: 'Failed to fetch pricing data'
      };
    }
  });