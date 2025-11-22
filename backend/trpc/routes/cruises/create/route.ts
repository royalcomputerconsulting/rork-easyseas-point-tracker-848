import { z } from 'zod';
import { publicProcedure } from '../../../create-context';
import { memoryStore } from '../../_stores/memory';

export const createCruiseProcedure = publicProcedure
  .input(z.object({
    ship: z.string(),
    itineraryName: z.string(),
    departurePort: z.string(),
    departureDate: z.string(),
    returnDate: z.string(),
    nights: z.number(),
    line: z.string(),
    region: z.string().optional(),
    stateroomTypes: z.array(z.string()),
    status: z.enum(['on_sale', 'sold_out', 'canceled']),
    cabinNumber: z.string().optional(),
    categoryBooked: z.string().optional(),
  }))
  .mutation(({ input }) => {
    console.log('[tRPC] Creating cruise:', input.ship);
    
    const cruise = memoryStore.createCruise({
      ship: input.ship,
      itineraryName: input.itineraryName,
      departurePort: input.departurePort,
      departureDate: input.departureDate,
      returnDate: input.returnDate,
      nights: input.nights,
      line: input.line,
      region: input.region || 'Unknown',
      stateroomTypes: input.stateroomTypes,
      status: input.status,
      cabinNumber: input.cabinNumber,
      categoryBooked: input.categoryBooked,
    });
    
    return cruise;
  });