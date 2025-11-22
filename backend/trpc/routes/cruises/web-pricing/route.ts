import { publicProcedure } from '../../../create-context';
import { z } from 'zod';
import { memoryStore } from '../../_stores/memory';
import { scrapeWithFallback } from './multi-source-scraper';

function generateRealisticPricing(ship: string, nights: number): any {
  const shipClasses: Record<string, { interior: number; oceanview: number; balcony: number; suite: number }> = {
    'Oasis': { interior: 150, oceanview: 180, balcony: 220, suite: 400 },
    'Quantum': { interior: 140, oceanview: 170, balcony: 210, suite: 380 },
    'Freedom': { interior: 120, oceanview: 150, balcony: 180, suite: 320 },
    'Voyager': { interior: 110, oceanview: 140, balcony: 170, suite: 300 },
    'Radiance': { interior: 100, oceanview: 130, balcony: 160, suite: 280 },
    'Default': { interior: 90, oceanview: 120, balcony: 150, suite: 250 }
  };
  
  let shipClass = 'Default';
  const shipLower = ship.toLowerCase();
  
  if (shipLower.includes('oasis') || shipLower.includes('allure') || shipLower.includes('harmony') || shipLower.includes('symphony') || shipLower.includes('wonder') || shipLower.includes('star')) {
    shipClass = 'Oasis';
  } else if (shipLower.includes('quantum') || shipLower.includes('anthem') || shipLower.includes('ovation') || shipLower.includes('spectrum')) {
    shipClass = 'Quantum';
  } else if (shipLower.includes('freedom') || shipLower.includes('liberty') || shipLower.includes('independence')) {
    shipClass = 'Freedom';
  } else if (shipLower.includes('voyager') || shipLower.includes('explorer') || shipLower.includes('adventure') || shipLower.includes('navigator') || shipLower.includes('mariner')) {
    shipClass = 'Voyager';
  } else if (shipLower.includes('radiance') || shipLower.includes('brilliance') || shipLower.includes('serenade') || shipLower.includes('jewel')) {
    shipClass = 'Radiance';
  }
  
  const baseRates = shipClasses[shipClass];
  
  return {
    interior: Math.round(baseRates.interior * nights * 2 * 1.15),
    oceanview: Math.round(baseRates.oceanview * nights * 2 * 1.15),
    balcony: Math.round(baseRates.balcony * nights * 2 * 1.15),
    suite: Math.round(baseRates.suite * nights * 2 * 1.15),
  };
}

export const webPricingProcedure = publicProcedure
  .input(z.object({
    cruiseId: z.string().optional(),
    forceRefresh: z.boolean().default(false),
    sources: z.array(z.string()).optional(),
    useRealData: z.boolean().default(true),
  }))
  .query(async ({ input }) => {
    console.log('[WebPricing] Multi-source pricing check for cruise:', input.cruiseId);
    console.log('[WebPricing] Use real data:', input.useRealData);
    
    try {
      const now = new Date();
      let cruisesToCheck: any[] = [];
      
      if (input.cruiseId) {
        const cruise = memoryStore.getCruise(input.cruiseId);
        if (cruise) {
          console.log('[WebPricing] Found cruise:', {
            id: cruise.id,
            ship: cruise.ship,
            departureDate: cruise.departureDate,
            nights: cruise.nights
          });
          cruisesToCheck = [cruise];
        } else {
          console.error('[WebPricing] Cruise not found with ID:', input.cruiseId);
        }
      } else {
        const allCruises = memoryStore.getCruises();
        const next90Days = new Date(now.getTime() + (90 * 24 * 60 * 60 * 1000));
        
        cruisesToCheck = allCruises.filter(cruise => {
          const departureDate = new Date(cruise.departureDate);
          return departureDate >= now && departureDate <= next90Days;
        }).slice(0, 5);
      }
      
      console.log('[WebPricing] Processing', cruisesToCheck.length, 'cruises');
      
      const pricingResults = await Promise.all(
        cruisesToCheck.map(async (cruise) => {
          const nights = cruise.nights || 7;
          let pricing = generateRealisticPricing(cruise.ship, nights);
          let itinerary = null;
          let verified = false;
          let source = 'Estimated';
          let error = null;
          
          if (input.useRealData) {
            // Handle both departureDate and 'Sailing Date' field names
            const sailingDate = cruise.departureDate || (cruise as any)['Sailing Date'] || (cruise as any).sailingDate;
            
            console.log(`[WebPricing] Scraping real data for ${cruise.ship}...`);
            console.log(`[WebPricing] Sailing date: ${sailingDate}, nights: ${nights}`);
            
            if (!sailingDate) {
              error = 'No sailing date available for this cruise';
              console.error(`[WebPricing] No sailing date found for cruise ${cruise.ship}`);
            } else {
              const scraperResult = await scrapeWithFallback(
                cruise.ship,
                sailingDate,
                nights
              );
            
              if (scraperResult.success && scraperResult.pricing) {
                pricing = {
                  interior: scraperResult.pricing.interior || pricing.interior,
                  oceanview: scraperResult.pricing.oceanview || pricing.oceanview,
                  balcony: scraperResult.pricing.balcony || pricing.balcony,
                  suite: scraperResult.pricing.suite || pricing.suite,
                };
                verified = true;
                source = scraperResult.source;
                
                if (scraperResult.itinerary) {
                  itinerary = scraperResult.itinerary;
                  
                  if (cruise.itineraryName !== scraperResult.itinerary.description) {
                    cruise.itineraryName = scraperResult.itinerary.description;
                    cruise.verified = true;
                    cruise.verifiedSource = source;
                    cruise.verifiedAt = new Date().toISOString();
                    cruise.updatedAt = new Date().toISOString();
                  }
                }
              } else {
                error = scraperResult.error || 'Cannot find cruise data';
                console.log(`[WebPricing] ❌ Failed to scrape ${cruise.ship}:`, error);
              }
            }
          }
          
          return {
            cruiseId: cruise.id,
            ship: cruise.ship,
            itineraryName: cruise.itineraryName,
            departureDate: cruise.departureDate,
            nights,
            currentPricing: pricing,
            webPricing: {
              [source]: pricing
            },
            priceChanges: {},
            alerts: error ? [{
              severity: 'medium',
              message: error,
              source: 'multi-source-scraper'
            }] : [],
            itinerary,
            verified,
            verifiedSource: source,
            verifiedAt: verified ? new Date().toISOString() : null,
            error,
          };
        })
      );
      
      const totalVerified = pricingResults.filter(r => r.verified).length;
      const totalAlerts = pricingResults.filter(r => r.error).length;
      const sourcesUsed = [...new Set(pricingResults.map(r => r.verifiedSource).filter(Boolean))];
      
      const summary = {
        totalCruisesChecked: pricingResults.length,
        totalVerified,
        totalAlerts,
        priceDropAlerts: 0,
        sourcesUsed,
        lastUpdated: new Date().toISOString(),
      };
      
      const payload = { results: pricingResults, summary };
      memoryStore.setWebPricingSnapshot(payload);
      
      console.log('[WebPricing] Completed pricing check:', summary);
      return payload;
    } catch (error) {
      console.error('[WebPricing] Error in web pricing check:', error);
      throw new Error(`Web pricing check failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  });

export const pricingProgressProcedure = publicProcedure
  .query(() => {
    return {
      current: 0,
      total: 0,
      status: 'idle' as const,
      message: 'Ready'
    };
  });
