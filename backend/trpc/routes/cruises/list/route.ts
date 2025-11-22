import { z } from 'zod';
import { publicProcedure } from '../../../create-context';
import { memoryStore } from '../../_stores/memory';

export const listCruisesProcedure = publicProcedure
  .input(z.object({
    search: z.string().optional(),
    cabinType: z.string().optional(),
    line: z.string().optional(),
    region: z.string().optional(),
    limit: z.number().default(25),
    offset: z.number().default(0)
  }))
  .query(async ({ input }) => {
    console.log('[tRPC] cruises.list called with:', input);
    console.log('[tRPC] Total cruises in memory store:', memoryStore.cruises.length);
    
    // Get all cruises from memory store, sorted by next sailing date
    let filtered = memoryStore.getCruises({
      line: input.line,
      region: input.region
    }).sort((a, b) => new Date(a.departureDate).getTime() - new Date(b.departureDate).getTime());
    
    // Apply search filter
    if (input.search) {
      const search = input.search.toLowerCase();
      filtered = filtered.filter(cruise => 
        cruise.ship.toLowerCase().includes(search) ||
        cruise.itineraryName.toLowerCase().includes(search) ||
        cruise.departurePort.toLowerCase().includes(search)
      );
    }
    
    // Apply cabin type filter
    if (input.cabinType) {
      const cabinType = input.cabinType;
      filtered = filtered.filter(cruise => 
        cruise.cabinType === cabinType ||
        (cruise.stateroomTypes && cruise.stateroomTypes.includes(cabinType))
      );
    }
    
    const total = filtered.length;
    const results = filtered.slice(input.offset, input.offset + input.limit);
    
    console.log(`[tRPC] Returning ${results.length} cruises out of ${total} filtered (${memoryStore.cruises.length} total in store)`);
    
    return {
      cruises: results,
      total,
      hasMore: input.offset + input.limit < total
    };
  });