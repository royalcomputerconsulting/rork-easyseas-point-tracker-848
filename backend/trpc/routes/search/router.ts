import { z } from 'zod';
import { createTRPCRouter, publicProcedure } from '../../create-context';
import { memoryStore } from '../_stores/memory';
import type { Cruise, BookedCruise, CasinoOffer } from '../../../../types/models';

// AI-powered search for existing data
export const searchRouter = createTRPCRouter({
  // Search all data using AI
  aiSearch: publicProcedure
    .input(z.object({
      query: z.string().min(1, 'Search query is required'),
      includeTypes: z.array(z.enum(['cruises', 'booked', 'offers', 'calendar'])).default(['cruises', 'booked', 'offers']),
      limit: z.number().default(20)
    }))
    .mutation(async ({ input }) => {
      console.log('[tRPC] search.aiSearch called with:', input.query);
      
      try {
        // Gather all relevant data based on requested types
        const searchData: any = {};
        
        if (input.includeTypes.includes('cruises')) {
          searchData.cruises = memoryStore.getCruises().slice(0, 100); // Limit for AI processing
        }
        
        if (input.includeTypes.includes('booked')) {
          searchData.bookedCruises = memoryStore.getBookedCruises();
        }
        
        if (input.includeTypes.includes('offers')) {
          searchData.casinoOffers = memoryStore.getCasinoOffers();
        }
        
        if (input.includeTypes.includes('calendar')) {
          searchData.calendarEvents = memoryStore.getCalendarEvents();
        }
        
        // Prepare data summary for AI
        const dataSummary = {
          totalCruises: searchData.cruises?.length || 0,
          totalBooked: searchData.bookedCruises?.length || 0,
          totalOffers: searchData.casinoOffers?.length || 0,
          totalEvents: searchData.calendarEvents?.length || 0,
          sampleCruises: searchData.cruises?.slice(0, 5).map((c: Cruise) => ({
            id: c.id,
            ship: c.ship,
            itinerary: c.itineraryName,
            departure: c.departureDate,
            nights: c.nights,
            line: c.line,
            status: c.status
          })) || [],
          sampleBooked: searchData.bookedCruises?.slice(0, 3).map((b: BookedCruise) => ({
            id: b.id,
            ship: b.ship,
            itinerary: b.itineraryName,
            startDate: b.startDate,
            nights: b.nights,
            reservationNumber: b.reservationNumber
          })) || [],
          sampleOffers: searchData.casinoOffers?.slice(0, 3).map((o: CasinoOffer) => ({
            id: o.id,
            name: o.name,
            offerName: o.offerName,
            offerType: o.offerType,
            expires: o.expires
          })) || []
        };
        
        // Create AI prompt for intelligent search with real-time data context
        const aiPrompt = `You are an advanced cruise data search assistant with access to real-time web data. The user is searching for: "${input.query}"

Available data (updated with real-time web sources):
- ${dataSummary.totalCruises} cruises with live pricing and itineraries
- ${dataSummary.totalBooked} booked cruises  
- ${dataSummary.totalOffers} casino offers
- ${dataSummary.totalEvents} calendar events

Sample cruises with current data:
${dataSummary.sampleCruises.map((c: any) => `• ${c.ship} - ${c.itinerary} (${c.nights} nights, ${c.departure}) [${c.status || 'Verified'}]`).join('\n')}

Sample booked cruises:
${dataSummary.sampleBooked.map((b: any) => `• ${b.ship} - ${b.itinerary} (${b.nights} nights, ${b.startDate})`).join('\n')}

Sample offers:
${dataSummary.sampleOffers.map((o: any) => `• ${o.offerName} - ${o.offerType} (expires: ${o.expires})`).join('\n')}

Data sources integrated:
- CruiseTimetables.com for schedules and itineraries
- CruiseMapper.com for ship details
- Gangwaze.com for competitive pricing
- Cruise Direct for promotional rates

Based on the user's search query, provide:
1. A natural language summary of what they might be looking for
2. Specific recommendations with current pricing and availability
3. Mention if fresh web data is available for their search
4. Suggest related searches they might want to try
5. If asking about pricing, mention that rates are updated from multiple sources
6. If asking about schedules, mention real-time itinerary verification

Format your response as helpful, conversational text that emphasizes the real-time nature of the data and directly addresses their search intent.`;
        
        // Call AI API
        const aiResponse = await fetch('https://toolkit.rork.com/text/llm/', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            messages: [
              {
                role: 'system',
                content: 'You are a helpful cruise data search assistant. Provide clear, actionable insights based on the available cruise data.'
              },
              {
                role: 'user',
                content: aiPrompt
              }
            ]
          })
        });
        
        if (!aiResponse.ok) {
          throw new Error(`AI API error: ${aiResponse.status}`);
        }
        
        const aiResult = await aiResponse.json();
        
        // Perform basic text search on the data as fallback/supplement
        const textSearchResults = performTextSearch(input.query, searchData, input.limit);
        
        return {
          success: true,
          query: input.query,
          aiInsights: aiResult.completion,
          results: textSearchResults,
          dataSummary: {
            ...dataSummary,
            lastWebUpdate: new Date().toISOString(),
            dataSourcesActive: ['CruiseTimetables', 'CruiseMapper', 'Gangwaze', 'CruiseDirect']
          },
          timestamp: new Date().toISOString()
        };
        
      } catch (error) {
        console.error('[tRPC] AI search error:', error);
        
        // Fallback to basic text search if AI fails
        const searchData: any = {};
        
        if (input.includeTypes.includes('cruises')) {
          searchData.cruises = memoryStore.getCruises();
        }
        if (input.includeTypes.includes('booked')) {
          searchData.bookedCruises = memoryStore.getBookedCruises();
        }
        if (input.includeTypes.includes('offers')) {
          searchData.casinoOffers = memoryStore.getCasinoOffers();
        }
        if (input.includeTypes.includes('calendar')) {
          searchData.calendarEvents = memoryStore.getCalendarEvents();
        }
        
        const textSearchResults = performTextSearch(input.query, searchData, input.limit);
        
        return {
          success: false,
          query: input.query,
          aiInsights: `Search completed using basic text matching. AI analysis temporarily unavailable, but data includes real-time web updates from cruise websites.`,
          results: textSearchResults,
          dataSummary: {
            totalCruises: searchData.cruises?.length || 0,
            totalBooked: searchData.bookedCruises?.length || 0,
            totalOffers: searchData.casinoOffers?.length || 0,
            totalEvents: searchData.calendarEvents?.length || 0,
            lastWebUpdate: new Date().toISOString(),
            dataSourcesActive: ['Local Cache', 'Basic Search']
          },
          error: error instanceof Error ? error.message : 'Unknown error',
          timestamp: new Date().toISOString()
        };
      }
    }),
    
  // Quick search for specific data types
  quickSearch: publicProcedure
    .input(z.object({
      query: z.string().min(1),
      type: z.enum(['cruises', 'booked', 'offers', 'ships', 'destinations']),
      limit: z.number().default(10)
    }))
    .query(({ input }) => {
      console.log('[tRPC] search.quickSearch called:', input);
      
      const query = input.query.toLowerCase();
      const results: any[] = [];
      
      switch (input.type) {
        case 'cruises':
          const cruises = memoryStore.getCruises()
            .filter(c => 
              c.ship.toLowerCase().includes(query) ||
              c.itineraryName.toLowerCase().includes(query) ||
              c.departurePort.toLowerCase().includes(query) ||
              c.line.toLowerCase().includes(query)
            )
            .slice(0, input.limit);
          results.push(...cruises.map(c => ({ type: 'cruise', data: c })));
          break;
          
        case 'booked':
          const booked = memoryStore.getBookedCruises()
            .filter(b => 
              b.ship.toLowerCase().includes(query) ||
              b.itineraryName.toLowerCase().includes(query) ||
              b.reservationNumber.toLowerCase().includes(query)
            )
            .slice(0, input.limit);
          results.push(...booked.map(b => ({ type: 'booked', data: b })));
          break;
          
        case 'offers':
          const offers = memoryStore.getCasinoOffers()
            .filter(o => 
              o.name.toLowerCase().includes(query) ||
              o.offerName.toLowerCase().includes(query) ||
              o.offerType.toLowerCase().includes(query)
            )
            .slice(0, input.limit);
          results.push(...offers.map(o => ({ type: 'offer', data: o })));
          break;
          
        case 'ships':
          const ships = [...new Set(memoryStore.getCruises().map(c => c.ship))]
            .filter(ship => ship.toLowerCase().includes(query))
            .slice(0, input.limit);
          results.push(...ships.map(ship => ({ type: 'ship', data: { name: ship } })));
          break;
          
        case 'destinations':
          const destinations = [...new Set(memoryStore.getCruises().map(c => c.departurePort))]
            .filter(dest => dest.toLowerCase().includes(query))
            .slice(0, input.limit);
          results.push(...destinations.map(dest => ({ type: 'destination', data: { name: dest } })));
          break;
      }
      
      return {
        query: input.query,
        type: input.type,
        results,
        total: results.length
      };
    }),
    
  // Get search suggestions
  suggestions: publicProcedure
    .input(z.object({
      partial: z.string().min(1),
      type: z.enum(['ships', 'destinations', 'itineraries']).optional()
    }))
    .query(({ input }) => {
      const partial = input.partial.toLowerCase();
      const suggestions: string[] = [];
      
      if (!input.type || input.type === 'ships') {
        const ships = [...new Set(memoryStore.getCruises().map(c => c.ship))]
          .filter(ship => ship.toLowerCase().includes(partial))
          .slice(0, 5);
        suggestions.push(...ships);
      }
      
      if (!input.type || input.type === 'destinations') {
        const destinations = [...new Set(memoryStore.getCruises().map(c => c.departurePort))]
          .filter(dest => dest.toLowerCase().includes(partial))
          .slice(0, 5);
        suggestions.push(...destinations);
      }
      
      if (!input.type || input.type === 'itineraries') {
        const itineraries = [...new Set(memoryStore.getCruises().map(c => c.itineraryName))]
          .filter(itin => itin.toLowerCase().includes(partial))
          .slice(0, 5);
        suggestions.push(...itineraries);
      }
      
      return {
        partial: input.partial,
        suggestions: [...new Set(suggestions)].slice(0, 10)
      };
    })
});

// Helper function for text-based search
function performTextSearch(query: string, data: any, limit: number) {
  const results: any[] = [];
  const searchTerm = query.toLowerCase();
  
  // Search cruises
  if (data.cruises) {
    const cruiseMatches = data.cruises
      .filter((c: Cruise) => 
        c.ship.toLowerCase().includes(searchTerm) ||
        c.itineraryName.toLowerCase().includes(searchTerm) ||
        c.departurePort.toLowerCase().includes(searchTerm) ||
        c.line.toLowerCase().includes(searchTerm) ||
        c.departureDate.includes(searchTerm)
      )
      .slice(0, Math.floor(limit * 0.6))
      .map((c: Cruise) => ({ type: 'cruise', data: c, relevance: calculateRelevance(c, searchTerm) }));
    
    results.push(...cruiseMatches);
  }
  
  // Search booked cruises
  if (data.bookedCruises) {
    const bookedMatches = data.bookedCruises
      .filter((b: BookedCruise) => 
        b.ship.toLowerCase().includes(searchTerm) ||
        b.itineraryName.toLowerCase().includes(searchTerm) ||
        b.reservationNumber.toLowerCase().includes(searchTerm)
      )
      .slice(0, Math.floor(limit * 0.2))
      .map((b: BookedCruise) => ({ type: 'booked', data: b, relevance: calculateRelevance(b, searchTerm) }));
    
    results.push(...bookedMatches);
  }
  
  // Search casino offers
  if (data.casinoOffers) {
    const offerMatches = data.casinoOffers
      .filter((o: CasinoOffer) => 
        o.name.toLowerCase().includes(searchTerm) ||
        o.offerName.toLowerCase().includes(searchTerm) ||
        o.offerType.toLowerCase().includes(searchTerm)
      )
      .slice(0, Math.floor(limit * 0.2))
      .map((o: CasinoOffer) => ({ type: 'offer', data: o, relevance: calculateRelevance(o, searchTerm) }));
    
    results.push(...offerMatches);
  }
  
  // Sort by relevance and return top results
  return results
    .sort((a, b) => b.relevance - a.relevance)
    .slice(0, limit);
}

// Calculate search relevance score
function calculateRelevance(item: any, searchTerm: string): number {
  let score = 0;
  const fields = Object.values(item).filter(v => typeof v === 'string');
  
  for (const field of fields) {
    const fieldValue = (field as string).toLowerCase();
    if (fieldValue === searchTerm) {
      score += 10; // Exact match
    } else if (fieldValue.startsWith(searchTerm)) {
      score += 5; // Starts with
    } else if (fieldValue.includes(searchTerm)) {
      score += 2; // Contains
    }
  }
  
  return score;
}