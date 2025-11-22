import { z } from 'zod';
import { publicProcedure } from '../../../create-context';
import { memoryStore } from '../../_stores/memory';

export const fetchPricingProcedure = publicProcedure
  .input(z.object({
    cruiseId: z.string()
  }))
  .mutation(async ({ input }) => {
    console.log('[Pricing] Fetching pricing for cruise:', input.cruiseId);
    
    try {
      const cruise = memoryStore.getCruise(input.cruiseId);
      
      if (!cruise) {
        throw new Error('Cruise not found');
      }
      
      console.log('[Pricing] Found cruise:', {
        ship: cruise.ship,
        departureDate: cruise.departureDate,
        nights: cruise.nights
      });
      
      // For now, return a placeholder response
      // In a real implementation, you would call a pricing API here
      return {
        success: true,
        cruise: {
          id: cruise.id,
          ship: cruise.ship,
          departureDate: cruise.departureDate,
          nights: cruise.nights
        },
        pricing: {
          currentPrice: null,
          lastUpdated: new Date().toISOString(),
          source: 'manual',
          message: 'Pricing API integration pending. Please check Royal Caribbean website manually.'
        }
      };
    } catch (error) {
      console.error('[Pricing] Error fetching pricing:', error);
      throw new Error(`Failed to fetch pricing: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  });
