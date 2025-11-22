import { z } from 'zod';
import { publicProcedure } from '../../../create-context';
import { memoryStore } from '../../_stores/memory';
import { STATIC_BOOKED_CRUISES } from '@/state/staticBooked';

// Casino strategy cruise data for analytics
const CASINO_STRATEGY_CRUISES = [
  {
    id: '2665774',
    ship: 'Star of the Seas',
    departureDate: '2025-08-27',
    returnDate: '2025-09-03',
    nights: 7,
    itineraryName: '7 Night Western Caribbean',
    departurePort: 'Port Canaveral, Florida',
    line: 'Royal Caribbean',
    region: 'Caribbean',
    stateroomTypes: ['Interior', 'Oceanview', 'Balcony', 'Suite'],
    status: 'on_sale' as const,
    isBooked: true,
    winningsBroughtHome: 1200,
    cruisePointsEarned: 4581
  },
  {
    id: '3156149',
    ship: 'Navigator of the Seas',
    departureDate: '2025-08-19',
    returnDate: '2025-08-23',
    nights: 4,
    itineraryName: '4 Night Baja Mexico',
    departurePort: 'Los Angeles, California',
    line: 'Royal Caribbean',
    region: 'Mexican Riviera',
    stateroomTypes: ['Interior', 'Oceanview', 'Balcony', 'Suite'],
    status: 'on_sale' as const,
    isBooked: true,
    winningsBroughtHome: 1200,
    cruisePointsEarned: 3000
  },
  {
    id: '7871133',
    ship: 'Wonder of the Seas',
    departureDate: '2025-07-15',
    returnDate: '2025-07-22',
    nights: 7,
    itineraryName: '7 Night Eastern Caribbean',
    departurePort: 'Port Canaveral, Florida',
    line: 'Royal Caribbean',
    region: 'Caribbean',
    stateroomTypes: ['Interior', 'Oceanview', 'Balcony', 'Suite'],
    status: 'on_sale' as const,
    isBooked: true,
    winningsBroughtHome: 800,
    cruisePointsEarned: 3562
  },
  {
    id: '5207254',
    ship: 'Navigator of the Seas',
    departureDate: '2025-08-01',
    returnDate: '2025-08-05',
    nights: 4,
    itineraryName: '4 Night Baja Mexico',
    departurePort: 'Los Angeles, California',
    line: 'Royal Caribbean',
    region: 'Mexican Riviera',
    stateroomTypes: ['Interior', 'Oceanview', 'Balcony', 'Suite'],
    status: 'on_sale' as const,
    isBooked: true,
    winningsBroughtHome: 589,
    cruisePointsEarned: 976
  },
  {
    id: '236930',
    ship: 'Ovation of the Seas',
    departureDate: '2025-06-15',
    returnDate: '2025-06-22',
    nights: 7,
    itineraryName: '7 Night Alaska Inside Passage',
    departurePort: 'Seattle, Washington',
    line: 'Royal Caribbean',
    region: 'Alaska',
    stateroomTypes: ['Interior', 'Oceanview', 'Balcony', 'Suite'],
    status: 'on_sale' as const,
    isBooked: true,
    winningsBroughtHome: 400,
    cruisePointsEarned: 2030
  },
  {
    id: '2501764',
    ship: 'Harmony of the Seas',
    departureDate: '2025-05-20',
    returnDate: '2025-05-27',
    nights: 7,
    itineraryName: '7 Night Western Caribbean',
    departurePort: 'Port Canaveral, Florida',
    line: 'Royal Caribbean',
    region: 'Caribbean',
    stateroomTypes: ['Interior', 'Oceanview', 'Balcony', 'Suite'],
    status: 'on_sale' as const,
    isBooked: true,
    winningsBroughtHome: 200,
    cruisePointsEarned: 1000
  },
  {
    id: '1234567',
    ship: 'Navigator of the Seas',
    departureDate: '2025-09-15',
    returnDate: '2025-09-19',
    nights: 4,
    itineraryName: '4 Night Baja Mexico',
    departurePort: 'Los Angeles, California',
    line: 'Royal Caribbean',
    region: 'Mexican Riviera',
    stateroomTypes: ['Interior', 'Oceanview', 'Balcony', 'Suite'],
    status: 'on_sale' as const,
    isBooked: true,
    winningsBroughtHome: 300,
    cruisePointsEarned: 1200
  }
];

export const getCruiseProcedure = publicProcedure
  .input(z.object({
    id: z.string(),
  }))
  .query(({ input }) => {
    console.log('[tRPC getCruise] Looking for cruise ID:', input.id);
    
    // Celebrity cruises are stored client-side in CelebrityProvider, not in backend
    // Return null for Celebrity cruises so the frontend can handle them
    if (input.id && String(input.id).startsWith('celeb-cruise-')) {
      console.log('[tRPC getCruise] Celebrity cruise detected, returning null (handled client-side)');
      return null;
    }
    
    // First check if this is a casino strategy cruise ID
    const casinoCruise = CASINO_STRATEGY_CRUISES.find(c => c.id === input.id);
    if (casinoCruise) {
      console.log('[tRPC getCruise] Found casino strategy cruise:', casinoCruise.ship, casinoCruise.departureDate);
      return casinoCruise;
    }
    
    // Try to find in the unified cruises system
    let cruise: any = memoryStore.getCruise(input.id);
    
    // If not found, try to find in static booked cruises data
    if (!cruise) {
      console.log('[tRPC getCruise] Not found in memory store, checking static booked cruises');
      
      // First try exact ID match in static data
      const staticCruise = STATIC_BOOKED_CRUISES.find(c => c.id === input.id);
      if (staticCruise) {
        const depDate = (staticCruise as any).startDate || staticCruise.departureDate;
        const retDate = (staticCruise as any).endDate || staticCruise.returnDate;
        console.log('[tRPC getCruise] Found exact match in static booked cruises:', staticCruise.ship, depDate);
        // Convert static cruise to the expected format
        cruise = {
          ...staticCruise,
          departureDate: depDate,
          returnDate: retDate,
          line: 'Royal Caribbean',
          region: 'Caribbean',
          stateroomTypes: ['Interior', 'Oceanview', 'Balcony', 'Suite'],
          status: 'on_sale' as const,
          itineraryName: staticCruise.itineraryName || 'Unknown Itinerary',
          departurePort: staticCruise.departurePort || 'Unknown Port'
        };
      }
    }
    
    if (!cruise) {
      console.error('[tRPC getCruise] Cruise not found with ID:', input.id);
      console.error('[tRPC getCruise] Available static cruise IDs:', STATIC_BOOKED_CRUISES.map(c => `${c.id} (${c.ship})`).join(', '));
      console.error('[tRPC getCruise] Available memory cruise IDs:', memoryStore.getCruises().map(c => c.id).join(', '));
      return null;
    }
    
    console.log('[tRPC getCruise] Returning cruise:', cruise.ship, cruise.departureDate || (cruise as any).startDate);
    return cruise;
  });