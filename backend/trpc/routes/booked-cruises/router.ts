import { z } from 'zod';
import { publicProcedure, createTRPCRouter } from '../../create-context';
import { memoryStore } from '../_stores/memory';
import { STATIC_BOOKED_CRUISES } from '@/state/staticBooked';
import type { Cruise } from '@/types/models';

function ensureUnifiedCruiseFromBooked(input: {
  ship: string;
  departureDate: string;
  returnDate?: string;
  nights?: number;
  itineraryName?: string;
  departurePort?: string;
  portsRoute?: string;
}): Cruise | null {
  try {
    const allCruises = memoryStore.getCruises();
    const found = allCruises.find(c =>
      c.ship.toLowerCase().trim() === (input.ship || '').toLowerCase().trim() &&
      c.departureDate === input.departureDate
    );
    if (found) return found;

    const nights = input.nights && input.nights > 0 ? input.nights : 7;
    const ensured = memoryStore.createCruise({
      ship: input.ship,
      line: 'Royal Caribbean',
      itineraryName: input.itineraryName || '',
      uniqueCruiseId: undefined,
      departureDate: input.departureDate,
      returnDate: input.returnDate || memoryStore.calculateReturnDate(input.departureDate, nights) || input.departureDate,
      nights,
      departurePort: input.departurePort || '',
      region: undefined,
      cabinType: 'Interior',
      stateroomTypes: ['Interior'],
      status: 'on_sale',
      value: '0',
      offerCode: '',
      offerName: '',
      offerExpirationDate: ''
    });
    return ensured;
  } catch (e) {
    console.warn('[tRPC] ensureUnifiedCruiseFromBooked failed:', e);
    return null;
  }
}

export const bookedCruisesRouter = createTRPCRouter({
  list: publicProcedure.query(() => {
    console.log('[tRPC] Getting booked cruises list from unified system');
    const bookedCruises = memoryStore.getBookedCruises();
    
    if (bookedCruises.length === 0) {
      console.log('[tRPC] No booked cruises in memory store, using static data as fallback');
      return STATIC_BOOKED_CRUISES.map(staticCruise => ({
        ...staticCruise,
        departureDate: staticCruise.departureDate,
        returnDate: staticCruise.returnDate,
        line: 'Royal Caribbean',
        region: 'Caribbean',
        stateroomTypes: ['Interior', 'Oceanview', 'Balcony', 'Suite'],
        status: 'on_sale' as const
      }));
    }
    
    return bookedCruises;
  }),

  completed: publicProcedure.query(() => {
    console.log('[tRPC] Getting completed cruises (past cruises with receipts/statements)');
    return memoryStore.getCompletedCruises();
  }),

  get: publicProcedure
    .input(z.object({ id: z.string() }))
    .query(({ input }) => {
      console.log('[tRPC] Getting booked cruise:', input.id);
      
      let cruise = memoryStore.getCruise(input.id);
      if (cruise) {
        console.log('[tRPC] Found cruise in unified system:', cruise.ship);
        return cruise;
      }
      
      const bookedCruise = memoryStore.getBookedCruise(input.id);
      if (bookedCruise) {
        console.log('[tRPC] Found cruise in legacy booked system:', bookedCruise.ship);
        return bookedCruise;
      }
      
      if (input.id.startsWith('booked-') || input.id.startsWith('completed-')) {
        console.log('[tRPC] Looking for static booked cruise with ID:', input.id);
        
        const staticCruise = STATIC_BOOKED_CRUISES.find(c => c.id === input.id);
        if (staticCruise) {
          console.log('[tRPC] Found exact match in static booked cruises:', staticCruise.ship, staticCruise.departureDate);
          const ensured = ensureUnifiedCruiseFromBooked({
            ship: staticCruise.ship,
            departureDate: staticCruise.departureDate,
            returnDate: staticCruise.returnDate,
            nights: staticCruise.nights,
            itineraryName: staticCruise.itineraryName,
            departurePort: staticCruise.departurePort,
            portsRoute: staticCruise.portsRoute,
          });
          return ensured || ({
            ...staticCruise,
            departureDate: staticCruise.departureDate,
            returnDate: staticCruise.returnDate,
            line: 'Royal Caribbean',
            region: 'Caribbean',
            stateroomTypes: ['Interior', 'Oceanview', 'Balcony', 'Suite'],
            status: 'on_sale' as const
          } as any);
        } else {
          console.log('[tRPC] No exact match, trying pattern matching in static data');
          
          const bookedCruises = [...memoryStore.getBookedCruises(), ...STATIC_BOOKED_CRUISES];
          console.log('[tRPC] Available booked cruises (including static):', bookedCruises.map(c => ({ 
            id: c.id, 
            ship: c.ship, 
            departureDate: (c as any).departureDate
          })));
          
          const idParts = input.id.replace('booked-', '').replace('completed-', '').split('-');
          if (idParts.length >= 2) {
            const shipPart = idParts.slice(0, -1).join(' ').toLowerCase();
            const indexPart = idParts[idParts.length - 1];
            
            console.log('[tRPC] Searching for ship containing:', shipPart, 'with index:', indexPart);
            
            const matchingCruises = bookedCruises.filter(c => {
              const shipName = (c.ship || '').toLowerCase();
              return shipName.includes(shipPart) || shipName.includes('navigator');
            });
            
            console.log('[tRPC] Matching cruises found:', matchingCruises.length);
            
            if (matchingCruises.length > 0) {
              const index = parseInt(indexPart) - 1;
              const foundCruise = (index >= 0 && index < matchingCruises.length) ? matchingCruises[index] : matchingCruises[0];
              const cruiseDate = (foundCruise as any).departureDate;
              console.log('[tRPC] Found cruise by pattern matching:', foundCruise.ship, cruiseDate);
              const ensured = ensureUnifiedCruiseFromBooked({
                ship: foundCruise.ship,
                departureDate: (foundCruise as any).departureDate,
                returnDate: (foundCruise as any).returnDate,
                nights: (foundCruise as any).nights,
                itineraryName: (foundCruise as any).itineraryName,
                departurePort: (foundCruise as any).departurePort,
                portsRoute: (foundCruise as any).portsRoute,
              });
              return ensured || (foundCruise as any);
            }
          }
        }
      }
      
      console.error('[tRPC] Cruise not found in either system:', input.id);
      console.error('[tRPC] Available cruise IDs:', memoryStore.getCruises().map(c => c.id));
      console.error('[tRPC] Available booked cruise IDs:', memoryStore.getBookedCruises().map(c => c.id));
      throw new Error('Booked cruise not found');
    }),

  create: publicProcedure
    .input(
      z.object({
        cruiseId: z.string().optional(),
        ship: z.string(),
        departureDate: z.string().optional(),
        returnDate: z.string().optional(),
        startDate: z.string().optional(),
        endDate: z.string().optional(),
        nights: z.number(),
        itineraryName: z.string(),
        departurePort: z.string(),
        portsRoute: z.string(),
        reservationNumber: z.string(),
        guests: z.number(),
        daysToGo: z.number(),
        paidFare: z.number().optional(),
        actualFare: z.number().optional(),
        currentMarketPrice: z.number().optional(),
        actualSavings: z.number().optional(),
        projectedSavings: z.number().optional(),
      }).superRefine((val, ctx) => {
        if (!val.departureDate && !val.startDate) {
          ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'departureDate or startDate is required' });
        }
      })
    )
    .mutation(({ input }) => {
      const effectiveDeparture = input.departureDate ?? input.startDate!;
      const effectiveEnd = input.returnDate ?? input.endDate;

      console.log('[tRPC] Creating booked cruise:', input.ship, 'for date:', effectiveDeparture);
      console.log('[tRPC] Reservation number:', input.reservationNumber);
      console.log('[tRPC] Cruise ID (if provided):', input.cruiseId);
      
      const existingUnifiedCruises = memoryStore.getBookedCruises();
      const existingLegacyBooked = memoryStore.getLegacyBookedCruises();
      
      const alreadyBookedUnified = existingUnifiedCruises.find(bc => 
        bc.ship === input.ship && 
        bc.departureDate === effectiveDeparture &&
        bc.reservationNumber === input.reservationNumber
      );
      
      const alreadyBookedLegacy = existingLegacyBooked.find?.((bc: any) => {
        return bc.ship === input.ship && (bc.departureDate === effectiveDeparture || bc.startDate === effectiveDeparture) && bc.reservationNumber === input.reservationNumber;
      });
      
      if (alreadyBookedUnified) {
        console.log('[tRPC] Cruise already booked in unified system, returning existing:', alreadyBookedUnified.id);
        return alreadyBookedUnified;
      }
      if (alreadyBookedLegacy) {
        console.log('[tRPC] Cruise already booked in legacy system, returning existing:', alreadyBookedLegacy.id);
        return alreadyBookedLegacy;
      }
      
      let retDate = effectiveEnd || undefined;
      if (!retDate && effectiveDeparture && input.nights) {
        const calculatedEndDate = memoryStore.calculateReturnDate(effectiveDeparture, input.nights);
        if (calculatedEndDate) {
          retDate = calculatedEndDate;
          console.log(`[tRPC] Calculated missing returnDate for ${input.ship}: ${effectiveDeparture} + ${input.nights} nights = ${retDate}`);
        }
      }
      
      const bookedCruise = memoryStore.createBookedCruise({
        cruiseId: input.cruiseId,
        ship: input.ship,
        departureDate: effectiveDeparture,
        returnDate: retDate || effectiveDeparture,
        nights: input.nights,
        itineraryName: input.itineraryName,
        departurePort: input.departurePort,
        portsRoute: input.portsRoute,
        reservationNumber: input.reservationNumber,
        guests: input.guests,
        daysToGo: input.daysToGo,
        paidFare: input.paidFare,
        actualFare: input.actualFare,
        currentMarketPrice: input.currentMarketPrice,
        actualSavings: input.actualSavings,
        projectedSavings: input.projectedSavings,
      });

      ensureUnifiedCruiseFromBooked({
        ship: input.ship,
        departureDate: effectiveDeparture,
        returnDate: retDate || effectiveDeparture,
        nights: input.nights,
        itineraryName: input.itineraryName,
        departurePort: input.departurePort,
        portsRoute: input.portsRoute,
      });
      
      console.log('[tRPC] ✅ Created new booked cruise:', {
        id: bookedCruise.id,
        ship: bookedCruise.ship,
        departureDate: bookedCruise.departureDate,
        returnDate: bookedCruise.returnDate,
        reservationNumber: bookedCruise.reservationNumber
      });
      
      let updatedCruise: any = null;
      
      if (input.cruiseId) {
        console.log('[tRPC] Strategy 1: Updating cruise by provided cruiseId:', input.cruiseId);
        updatedCruise = memoryStore.updateCruise(input.cruiseId, {
          bookingId: bookedCruise.id,
          reservationNumber: input.reservationNumber,
          guests: input.guests,
          daysToGo: input.daysToGo
        });
        
        if (updatedCruise) {
          console.log('[tRPC] ✅ Successfully marked cruise as booked using cruiseId');
        } else {
          console.warn('[tRPC] ⚠️ Could not find cruise by cruiseId:', input.cruiseId);
        }
      }
      
      if (!updatedCruise) {
        console.log('[tRPC] Strategy 2: Searching for cruise by ship + date');
        const allCruises = memoryStore.getCruises();
        console.log('[tRPC] Total cruises in store:', allCruises.length);
        
        const matchingCruise = allCruises.find(c => {
          const shipMatch = c.ship.toLowerCase().trim() === input.ship.toLowerCase().trim();
          const dateMatch = c.departureDate === effectiveDeparture;
          console.log(`[tRPC] Checking cruise: ${c.ship} (${c.departureDate}) - shipMatch: ${shipMatch}, dateMatch: ${dateMatch}`);
          return shipMatch && dateMatch;
        });
        
        if (matchingCruise) {
          console.log('[tRPC] Found matching cruise by ship + date:', matchingCruise.id);
          updatedCruise = memoryStore.updateCruise(matchingCruise.id, {
            bookingId: bookedCruise.id,
            reservationNumber: input.reservationNumber,
            guests: input.guests,
            daysToGo: input.daysToGo
          });
          
          if (updatedCruise) {
            console.log('[tRPC] ✅ Successfully marked cruise as booked using ship + date match');
          }
        } else {
          console.warn('[tRPC] ⚠️ No matching cruise found by ship + date');
          console.warn('[tRPC] Available cruises:', allCruises.map(c => `${c.ship} (${c.departureDate})`));
        }
      }
      
      if (!updatedCruise) {
        console.warn('[tRPC] ⚠️ WARNING: Could not update original cruise. The cruise will appear in Booked Cruises but may not show as booked in All Cruises.');
        console.warn('[tRPC] This is expected if the cruise was not imported from cruises.xlsx');
      }
      
      return bookedCruise;
    }),

  update: publicProcedure
    .input(
      z.object({
        id: z.string(),
        cruiseId: z.string().optional(),
        ship: z.string().optional(),
        departureDate: z.string().optional(),
        returnDate: z.string().optional(),
        startDate: z.string().optional(),
        endDate: z.string().optional(),
        nights: z.number().optional(),
        itineraryName: z.string().optional(),
        departurePort: z.string().optional(),
        portsRoute: z.string().optional(),
        reservationNumber: z.string().optional(),
        guests: z.number().optional(),
        daysToGo: z.number().optional(),
        paidFare: z.number().optional(),
        actualFare: z.number().optional(),
        currentMarketPrice: z.number().optional(),
        actualSavings: z.number().optional(),
        projectedSavings: z.number().optional(),
      })
    )
    .mutation(({ input }) => {
      console.log('[tRPC] Updating booked cruise:', input.id);
      const { id, ...data } = input as any;

      const departureDate = data.departureDate ?? data.startDate;
      const returnDate = data.returnDate ?? data.endDate;

      const payload: any = { ...data };
      if (departureDate) payload.departureDate = departureDate;
      if (returnDate) payload.returnDate = returnDate;
      delete payload.startDate;
      delete payload.endDate;

      const updated = memoryStore.updateBookedCruise(id, payload);
      if (!updated) {
        throw new Error('Booked cruise not found');
      }

      if (updated.ship && updated.departureDate) {
        ensureUnifiedCruiseFromBooked({
          ship: updated.ship,
          departureDate: updated.departureDate,
          returnDate: updated.returnDate,
          nights: updated.nights,
          itineraryName: updated.itineraryName,
          departurePort: updated.departurePort,
          portsRoute: updated.portsRoute,
        });
      }
      return updated;
    }),

  delete: publicProcedure
    .input(z.object({ id: z.string() }))
    .mutation(({ input }) => {
      console.log('[tRPC] Deleting booked cruise:', input.id);
      const deleted = memoryStore.deleteBookedCruise(input.id);
      if (!deleted) {
        throw new Error('Booked cruise not found');
      }
      return { ok: true };
    }),

  reconcileFromStatic: publicProcedure
    .mutation(() => {
      console.log('[tRPC] Reconciling cruises from static booked data into unified store');
      let created = 0;
      STATIC_BOOKED_CRUISES.forEach(sc => {
        const ensured = ensureUnifiedCruiseFromBooked({
          ship: sc.ship,
          departureDate: sc.departureDate,
          returnDate: sc.returnDate,
          nights: sc.nights,
          itineraryName: sc.itineraryName,
          departurePort: sc.departurePort,
          portsRoute: sc.portsRoute,
        });
        if (ensured) created++;
      });
      console.log('[tRPC] Reconciliation complete. Created/ensured:', created);
      return { created };
    }),

  exportCsv: publicProcedure
    .query(() => {
      try {
        console.log('[tRPC] Exporting booked cruises CSV');
        const source = memoryStore.getBookedCruises();
        const rows = (source.length > 0 ? source : STATIC_BOOKED_CRUISES).map((c: any) => ({
          Ship: String(c.ship ?? ''),
          SailingDate: String(c.departureDate ?? c.startDate ?? ''),
          ReturnDate: String(c.returnDate ?? c.endDate ?? ''),
          Nights: Number(c.nights ?? 0),
          Itinerary: String(c.itineraryName ?? ''),
          DeparturePort: String(c.departurePort ?? ''),
          BookingNumber: String(c.reservationNumber ?? c.bookingNumber ?? ''),
          Guests: Number(c.guests ?? 0),
          DaysToGo: Number(c.daysToGo ?? 0),
          PaidFare: Number(c.paidFare ?? c.actualFare ?? 0),
          CurrentMarketPrice: Number(c.currentMarketPrice ?? 0),
          ActualSavings: Number(c.actualSavings ?? 0),
          ProjectedSavings: Number(c.projectedSavings ?? 0),
        }));

        const headers = [
          'Ship','SailingDate','ReturnDate','Nights','Itinerary','DeparturePort','BookingNumber','Guests','DaysToGo','PaidFare','CurrentMarketPrice','ActualSavings','ProjectedSavings'
        ];
        const csv = [headers.join(',')]
          .concat(
            rows.map(r => headers.map(h => {
              const v = (r as any)[h];
              if (typeof v === 'string') {
                const needsQuote = v.includes(',') || v.includes('"') || v.includes('\n');
                const safe = v.replace(/"/g, '""');
                return needsQuote ? `"${safe}"` : safe;
              }
              return String(Number.isFinite(v) ? v : '');
            }).join(','))
          )
          .join('\n');

        const filename = `booked-cruises-${new Date().toISOString().slice(0,10)}.csv`;
        return { filename, csv };
      } catch (e: any) {
        console.error('[tRPC] exportCsv failed', e);
        throw new Error(e?.message ?? 'Failed to export CSV');
      }
    }),
});
