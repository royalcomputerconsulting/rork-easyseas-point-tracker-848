import { z } from 'zod';
import { publicProcedure } from '../../../create-context';
import { memoryStore } from '../../_stores/memory';
import { calculateOfferValue, type OfferValueCalculationResult } from '../calculateOfferValue';

export const calculateOfferValueProcedure = publicProcedure
  .input(z.object({
    offerId: z.string(),
    cruiseId: z.string().optional(),
  }))
  .query(({ input }): OfferValueCalculationResult | null => {
    console.log('[tRPC] Calculating offer value:', input);
    
    const offer = memoryStore.getCasinoOffer(input.offerId);
    if (!offer) {
      console.error('[tRPC] Offer not found:', input.offerId);
      return null;
    }
    
    let cruise = undefined;
    if (input.cruiseId) {
      cruise = memoryStore.getCruise(input.cruiseId);
      if (!cruise) {
        console.warn('[tRPC] Cruise not found:', input.cruiseId);
      }
    }
    
    const result = calculateOfferValue({ offer, cruise });
    console.log('[tRPC] Calculated offer value:', result.compValue);
    
    return result;
  });
