import { createTRPCRouter, publicProcedure } from "./create-context";
import { z } from 'zod';
import hiRoute from "./routes/example/hi/route";
import { cruisesRouter } from "./routes/cruises/router";
import { bookedCruisesRouter } from "./routes/booked-cruises/router";
import { casinoOffersRouter } from "./routes/casino-offers/router";
import { calendarRouter } from "./routes/calendar/router";
import { analyticsRouter } from "./routes/analytics/router";
import { importRouter } from "./routes/import/router";
import { ocrRouter } from "./routes/ocr/router";
import { searchRouter } from "./routes/search/router";
import { backupRouter } from "./routes/backup/router";
import { memoryStore } from "./routes/_stores/memory";
import { preloadFromDataFolder } from "./routes/import/startup";
import { financialsRouter } from './routes/financials/router';
import { retailPricingRouter } from './routes/retail-pricing/route';
import { fveRouter } from './routes/fve/router';

console.log('[tRPC] ===== CLEAN APP ROUTER INITIALIZATION =====');
console.log('[tRPC] Timestamp:', new Date().toISOString());

// Verify all routers are properly imported
console.log('[tRPC] Verifying router imports...');
console.log('[tRPC] cruisesRouter:', typeof cruisesRouter, !!cruisesRouter);
console.log('[tRPC] bookedCruisesRouter:', typeof bookedCruisesRouter, !!bookedCruisesRouter);
console.log('[tRPC] analyticsRouter:', typeof analyticsRouter, !!analyticsRouter);
console.log('[tRPC] calendarRouter:', typeof calendarRouter, !!calendarRouter);
console.log('[tRPC] casinoOffersRouter:', typeof casinoOffersRouter, !!casinoOffersRouter);

// Initialize memory store and preload data from DATA folder
try {
  console.log('[tRPC] Attempting to preload data from DATA folder...');
  preloadFromDataFolder().then((result) => {
    console.log('[tRPC] DATA folder preload completed:', result);
    if (result.ok) {
      console.log('[tRPC] Successfully loaded data:', result.imported);
    } else {
      console.log('[tRPC] DATA folder preload failed, but app will continue with empty data');
    }
  }).catch((error) => {
    console.error('[tRPC] DATA folder preload error (non-critical):', error);
  });
} catch (error) {
  console.error('[tRPC] Error during initialization:', error);
}

export const appRouter = createTRPCRouter({
  // Example route
  example: createTRPCRouter({
    hi: hiRoute,
  }),
  
  // Main routers - these are the core routers that should work
  cruises: cruisesRouter,
  bookedCruises: bookedCruisesRouter,
  casinoOffers: casinoOffersRouter,
  calendar: calendarRouter,
  analytics: analyticsRouter,
  import: importRouter,
  ocr: ocrRouter,
  search: searchRouter,
  backup: backupRouter,
  financials: financialsRouter,
  retailPricing: retailPricingRouter,
  fve: fveRouter,



  // Compatibility aliases for clients calling paths like "trpc/cruises.list"
  'trpc/cruises': cruisesRouter,
  'trpc/bookedCruises': bookedCruisesRouter,
  'trpc/casinoOffers': casinoOffersRouter,
  'trpc/financials': financialsRouter,
  'trpc/retailPricing': retailPricingRouter,
  'trpc/fve': fveRouter,
  'trpc/backup': backupRouter,
  
  // Add missing trpc/status procedure
  'trpc/status': publicProcedure
    .query(() => {
      console.log('[tRPC] trpc/status check called');
      try {
        return {
          cruises: memoryStore.getCruises().length,
          bookedCruises: memoryStore.getBookedCruises().length,
          casinoOffers: memoryStore.getCasinoOffers().length,
          calendarEvents: memoryStore.getCalendarEvents().length,
          lastImport: memoryStore.lastImport,
          timestamp: new Date().toISOString()
        };
      } catch (error) {
        console.error('[tRPC] Error in trpc/status check:', error);
        return {
          cruises: 0,
          bookedCruises: 0,
          casinoOffers: 0,
          calendarEvents: 0,
          lastImport: null,
          timestamp: new Date().toISOString(),
          error: error instanceof Error ? error.message : 'Unknown error'
        };
      }
    }),

  // Add missing trpc/ping for clients calling "trpc/ping"
  'trpc/ping': publicProcedure
    .query(() => {
      console.log('[tRPC] trpc/ping called');
      return { message: 'pong', timestamp: new Date().toISOString(), status: 'ok' };
    }),

  // Add missing trpc/directCalendar procedure
  'trpc/directCalendar': createTRPCRouter({
    events: publicProcedure
      .input(z.object({
        source: z.enum(['tripit', 'booked', 'manual']).optional(),
        dateRange: z.object({
          from: z.string(),
          to: z.string()
        }).optional()
      }).optional())
      .query(({ input }) => {
        console.log('[tRPC] trpc/directCalendar.events called with input:', input);
        try {
          const allEvents = memoryStore.getCalendarEvents();
          console.log('[tRPC] Total events in store:', allEvents.length);
          
          let filteredEvents = [...allEvents];
          
          if (input?.source) {
            filteredEvents = filteredEvents.filter(e => e.source === input.source);
            console.log('[tRPC] After source filter:', filteredEvents.length);
          }
          
          if (input?.dateRange) {
            const { from, to } = input.dateRange;
            filteredEvents = filteredEvents.filter(e => 
              e.startDate >= from && e.endDate <= to
            );
            console.log('[tRPC] After date filter:', filteredEvents.length);
          }
          
          filteredEvents.sort((a, b) => 
            new Date(a.startDate).getTime() - new Date(b.startDate).getTime()
          );
          
          console.log('[tRPC] Returning', filteredEvents.length, 'filtered events');
          return filteredEvents;
        } catch (error) {
          console.error('[tRPC] Error in trpc/directCalendar.events:', error);
          return [];
        }
      })
  }),
  
  // Direct casino offers procedure to fix 404 errors
  'trpc/directCasinoOffers': createTRPCRouter({
    list: publicProcedure
      .query(() => {
        console.log('[tRPC] trpc/directCasinoOffers.list called');
        try {
          const offers = memoryStore.getCasinoOffers();
          console.log('[tRPC] Found', offers.length, 'casino offers in memory store');
          return offers;
        } catch (error) {
          console.error('[tRPC] Error in trpc/directCasinoOffers.list:', error);
          return [];
        }
      })
  }),
  'trpc/directBookedCruises': createTRPCRouter({
    list: publicProcedure
      .query(() => {
        console.log('[tRPC] trpc/directBookedCruises.list called');
        try {
          const bookedCruises = memoryStore.getBookedCruises();
          console.log('[tRPC] Found', bookedCruises.length, 'booked cruises in memory store');
          return bookedCruises;
        } catch (error) {
          console.error('[tRPC] Error in trpc/directBookedCruises.list:', error);
          return [];
        }
      })
  }),
  'trpc/directCruises': createTRPCRouter({
    list: publicProcedure
      .input(z.object({
        search: z.string().optional(),
        cabinType: z.string().optional(),
        limit: z.number().default(25),
        offset: z.number().default(0)
      }))
      .query(({ input }) => {
        console.log('[tRPC] trpc/directCruises.list called with input:', input);
        try {
          const cruises = memoryStore.getCruises();
          console.log('[tRPC] Found', cruises.length, 'cruises in memory store');
          
          let filteredCruises = [...cruises];
          
          // Apply search filter
          if (input.search) {
            const searchLower = input.search.toLowerCase();
            filteredCruises = filteredCruises.filter(cruise => 
              cruise.ship?.toLowerCase().includes(searchLower) ||
              cruise.itineraryName?.toLowerCase().includes(searchLower) ||
              cruise.departurePort?.toLowerCase().includes(searchLower)
            );
          }
          
          // Apply cabin type filter
          if (input.cabinType) {
            filteredCruises = filteredCruises.filter(cruise => 
              cruise.cabinType === input.cabinType
            );
          }
          
          const total = filteredCruises.length;
          const paginatedCruises = filteredCruises.slice(input.offset, input.offset + input.limit);
          
          console.log('[tRPC] Returning', paginatedCruises.length, 'cruises out of', total, 'total');
          
          return {
            cruises: paginatedCruises,
            total,
            hasMore: input.offset + input.limit < total
          };
        } catch (error) {
          console.error('[tRPC] Error in trpc/directCruises.list:', error);
          return { cruises: [], total: 0, hasMore: false };
        }
      })
  }),

  'trpc/calendar': calendarRouter,
  'trpc/analytics': analyticsRouter,
  'trpc/ocr': ocrRouter,

  // Add missing procedures that frontend is calling
  'trpc/directAnalytics': createTRPCRouter({
    getUserProfile: publicProcedure
      .query(() => {
        console.log('[tRPC] trpc/directAnalytics.getUserProfile called');
        try {
          const profile = memoryStore.getUserProfile();
          console.log('[tRPC] User profile found:', profile ? 'yes' : 'no');
          if (profile) {
            console.log('[tRPC] User profile data:', { level: profile.level, points: profile.points });
          }
          return profile;
        } catch (error) {
          console.error('[tRPC] Error in trpc/directAnalytics.getUserProfile:', error);
          return null;
        }
      }),
    getOverviewStats: publicProcedure
      .query(() => {
        console.log('[tRPC] trpc/directAnalytics.getOverviewStats called');
        try {
          const cruises = memoryStore.getCruises();
          const bookedCruises = memoryStore.getBookedCruises();
          const casinoOffers = memoryStore.getCasinoOffers();
          const userProfile = memoryStore.getUserProfile();
          const allAnalytics = memoryStore.getAllCasinoAnalytics();
          
          console.log('[tRPC] Data counts:', {
            cruises: cruises.length,
            bookedCruises: bookedCruises.length,
            casinoOffers: casinoOffers.length,
            analytics: allAnalytics.length,
            userProfile: userProfile ? 'exists' : 'null'
          });
          
          const now = new Date();
          const next90Days = new Date(now.getTime() + (90 * 24 * 60 * 60 * 1000));
          const upcomingCruises = cruises.filter(cruise => {
            try {
              const departureDate = new Date(cruise.departureDate);
              return !isNaN(departureDate.getTime()) && departureDate >= now && departureDate <= next90Days;
            } catch {
              return false;
            }
          });
          
          const activeOffers = casinoOffers.filter(offer => {
            try {
              const expiryDate = new Date(offer.expires);
              return !isNaN(expiryDate.getTime()) && expiryDate > now;
            } catch {
              return false;
            }
          });
          
          const totalPotentialSavings = allAnalytics.reduce((sum, a) => sum + a.savings, 0);
          const averageROI = allAnalytics.length > 0 ? allAnalytics.reduce((sum, a) => sum + a.roi, 0) / allAnalytics.length : 0;
          const bestROI = allAnalytics.length > 0 ? Math.max(...allAnalytics.map(a => a.roi)) : 0;
          
          const result = {
            totalCruises: cruises.length,
            bookedCruises: bookedCruises.length,
            upcomingCruises: upcomingCruises.length,
            activeOffers: activeOffers.length,
            casinoOffers: [],
            userLevel: userProfile?.level || 'PRIME',
            userPoints: userProfile?.points || 0,
            casinoAnalytics: {
              totalAnalyses: allAnalytics.length,
              totalPotentialSavings,
              averageROI,
              bestROI,
              recommendedCruises: allAnalytics.filter(a => a.roi > 25).length
            },
            lastUpdate: new Date().toISOString()
          };
          
          console.log('[tRPC] Calculated overview stats:', result);
          return result;
        } catch (error) {
          console.error('[tRPC] Error in trpc/directAnalytics.getOverviewStats:', error);
          return {
            totalCruises: 0,
            bookedCruises: 0,
            upcomingCruises: 0,
            activeOffers: 0,
            casinoOffers: [],
            userLevel: 'PRIME',
            userPoints: 0,
            casinoAnalytics: {
              totalAnalyses: 0,
              totalPotentialSavings: 0,
              averageROI: 0,
              bestROI: 0,
              recommendedCruises: 0
            },
            lastUpdate: new Date().toISOString()
          };
        }
      }),
    crossReferenceReceiptsAndStatements: publicProcedure
      .query(() => {
        console.log('[tRPC] trpc/directAnalytics.crossReferenceReceiptsAndStatements called');
        try {
          const cruises = memoryStore.getCruises();
          const receipts = memoryStore.getReceipts();
          const statements = memoryStore.getCruiseStatements();
          
          // Cross-reference receipts and statements with cruises
          const crossReference = cruises.map(cruise => {
            // Find matching receipts by ship name and approximate date
            const matchingReceipts = receipts.filter(receipt => {
              if (receipt.cruiseId === cruise.id) return true;
              
              // Try to match by ship name
              const shipMatch = receipt.ship && cruise.ship && 
                receipt.ship.toLowerCase().includes(cruise.ship.toLowerCase().split(' ')[0]);
              
              // Try to match by date (within cruise date range)
              let dateMatch = false;
              if (receipt.departureDate && cruise.departureDate && cruise.returnDate) {
                const receiptDate = new Date(receipt.departureDate);
                const depDate = new Date(cruise.departureDate);
                const retDate = new Date(cruise.returnDate);
                dateMatch = receiptDate >= depDate && receiptDate <= retDate;
              }
              
              return shipMatch || dateMatch;
            });
            
            // Find matching statements by ship name and approximate date
            const matchingStatements = statements.filter(statement => {
              if (statement.cruiseId === cruise.id) return true;
              
              // Try to match by ship name
              const shipMatch = statement.shipName && cruise.ship && 
                statement.shipName.toLowerCase().includes(cruise.ship.toLowerCase().split(' ')[0]);
              
              // Try to match by date
              let dateMatch = false;
              if (statement.cruiseDate && cruise.departureDate && cruise.returnDate) {
                const statementDate = new Date(statement.cruiseDate);
                const depDate = new Date(cruise.departureDate);
                const retDate = new Date(cruise.returnDate);
                dateMatch = statementDate >= depDate && statementDate <= retDate;
              }
              
              return shipMatch || dateMatch;
            });
            
            // Calculate total spending from receipts
            const totalReceiptSpending = matchingReceipts.reduce((sum, receipt) => {
              const amount = receipt.totalPaid || 0;
              return sum + amount;
            }, 0);
            
            // Calculate total spending from statements
            const totalStatementSpending = matchingStatements.reduce((sum, statement) => {
              const amount = parseFloat(statement.totalSpent?.replace(/[$,]/g, '') || '0');
              return sum + (isNaN(amount) ? 0 : amount);
            }, 0);
            
            // Determine if this is a past or future cruise
            const today = new Date();
            const departureDate = new Date(cruise.departureDate);
            const isPastCruise = departureDate < today;
            
            return {
              cruise: {
                id: cruise.id,
                ship: cruise.ship,
                itineraryName: cruise.itineraryName,
                departureDate: cruise.departureDate,
                returnDate: cruise.returnDate,
                nights: cruise.nights,
                isPastCruise
              },
              receipts: matchingReceipts.map(r => ({
                id: r.id,
                ship: r.ship,
                departureDate: r.departureDate,
                totalPaid: r.totalPaid,
                reservationNumber: r.reservationNumber,
                confidence: r.cruiseId === cruise.id ? 'high' : 'medium'
              })),
              statements: matchingStatements.map(s => ({
                id: s.id,
                shipName: s.shipName || 'Unknown',
                cruiseDate: s.cruiseDate || 'Unknown',
                totalSpent: s.totalSpent || 0,
                confidence: s.cruiseId === cruise.id ? 'high' : 'medium'
              })),
              analytics: {
                totalReceiptSpending,
                totalStatementSpending,
                hasReceiptData: matchingReceipts.length > 0,
                hasStatementData: matchingStatements.length > 0,
                isComplete: matchingReceipts.length > 0 && matchingStatements.length > 0,
                receiptCount: matchingReceipts.length,
                statementCount: matchingStatements.length
              }
            };
          });
          
          const cruisesWithData = crossReference.filter(cr => 
            cr.analytics.hasReceiptData || cr.analytics.hasStatementData
          );
          
          cruisesWithData.sort((a, b) => 
            new Date(b.cruise.departureDate).getTime() - new Date(a.cruise.departureDate).getTime()
          );
          
          const summary = {
            totalCruisesWithData: cruisesWithData.length,
            cruisesWithReceipts: cruisesWithData.filter(cr => cr.analytics.hasReceiptData).length,
            cruisesWithStatements: cruisesWithData.filter(cr => cr.analytics.hasStatementData).length,
            cruisesWithBoth: cruisesWithData.filter(cr => cr.analytics.isComplete).length,
            totalReceiptSpending: cruisesWithData.reduce((sum, cr) => sum + cr.analytics.totalReceiptSpending, 0),
            totalStatementSpending: cruisesWithData.reduce((sum, cr) => sum + cr.analytics.totalStatementSpending, 0),
            pastCruises: cruisesWithData.filter(cr => cr.cruise.isPastCruise).length,
            futureCruises: cruisesWithData.filter(cr => !cr.cruise.isPastCruise).length
          };
          
          console.log('[tRPC] Cross-reference summary:', summary);
          
          return {
            cruises: cruisesWithData,
            summary
          };
        } catch (error) {
          console.error('[tRPC] Error in crossReferenceReceiptsAndStatements:', error);
          return {
            cruises: [],
            summary: {
              totalCruisesWithData: 0,
              cruisesWithReceipts: 0,
              cruisesWithStatements: 0,
              cruisesWithBoth: 0,
              totalReceiptSpending: 0,
              totalStatementSpending: 0,
              pastCruises: 0,
              futureCruises: 0
            }
          };
        }
      })
  }),
  
  'trpc/import': importRouter,

  // Compatibility alias for clients that accidentally prefix procedure with "trpc/"
  trpc: createTRPCRouter({
    // Simple ping inside the trpc namespace (dot-path: "trpc.ping")
    ping: publicProcedure
      .query(() => {
        console.log('[tRPC] trpc.ping called');
        return { message: 'pong', timestamp: new Date().toISOString(), status: 'ok' };
      }),
    cruises: cruisesRouter,
    bookedCruises: bookedCruisesRouter,
    casinoOffers: casinoOffersRouter,
    financials: financialsRouter,
    fve: fveRouter,
    backup: backupRouter,
    directBookedCruises: createTRPCRouter({
      list: publicProcedure
        .query(() => {
          console.log('[tRPC] trpc.directBookedCruises.list called');
          try {
            const bookedCruises = memoryStore.getBookedCruises();
            console.log('[tRPC] Found', bookedCruises.length, 'booked cruises in memory store');
            return bookedCruises;
          } catch (error) {
            console.error('[tRPC] Error in trpc.directBookedCruises.list:', error);
            return [];
          }
        })
    }),
    directCruises: createTRPCRouter({
      list: publicProcedure
        .input(z.object({
          search: z.string().optional(),
          cabinType: z.string().optional(),
          limit: z.number().default(25),
          offset: z.number().default(0)
        }))
        .query(({ input }) => {
          console.log('[tRPC] trpc.directCruises.list called with input:', input);
          try {
            const cruises = memoryStore.getCruises();
            console.log('[tRPC] Found', cruises.length, 'cruises in memory store');
            
            let filteredCruises = [...cruises];
            
            // Apply search filter
            if (input.search) {
              const searchLower = input.search.toLowerCase();
              filteredCruises = filteredCruises.filter(cruise => 
                cruise.ship?.toLowerCase().includes(searchLower) ||
                cruise.itineraryName?.toLowerCase().includes(searchLower) ||
                cruise.departurePort?.toLowerCase().includes(searchLower)
              );
            }
            
            // Apply cabin type filter
            if (input.cabinType) {
              filteredCruises = filteredCruises.filter(cruise => 
                cruise.cabinType === input.cabinType
              );
            }
            
            const total = filteredCruises.length;
            const paginatedCruises = filteredCruises.slice(input.offset, input.offset + input.limit);
            
            console.log('[tRPC] Returning', paginatedCruises.length, 'cruises out of', total, 'total');
            
            return {
              cruises: paginatedCruises,
              total,
              hasMore: input.offset + input.limit < total
            };
          } catch (error) {
            console.error('[tRPC] Error in trpc.directCruises.list:', error);
            return { cruises: [], total: 0, hasMore: false };
          }
        })
    }),
    directAnalytics: createTRPCRouter({
      getUserProfile: publicProcedure
        .query(() => {
          console.log('[tRPC] trpc.directAnalytics.getUserProfile called');
          try {
            const profile = memoryStore.getUserProfile();
            console.log('[tRPC] User profile found:', profile ? 'yes' : 'no');
            if (profile) {
              console.log('[tRPC] User profile data:', { level: profile.level, points: profile.points });
            }
            return profile;
          } catch (error) {
            console.error('[tRPC] Error in trpc.directAnalytics.getUserProfile:', error);
            return null;
          }
        }),
      getOverviewStats: publicProcedure
        .query(() => {
          console.log('[tRPC] trpc.directAnalytics.getOverviewStats called');
          try {
            const cruises = memoryStore.getCruises();
            const bookedCruises = memoryStore.getBookedCruises();
            const casinoOffers = memoryStore.getCasinoOffers();
            const userProfile = memoryStore.getUserProfile();
            const allAnalytics = memoryStore.getAllCasinoAnalytics();
            
            console.log('[tRPC] Data counts:', {
              cruises: cruises.length,
              bookedCruises: bookedCruises.length,
              casinoOffers: casinoOffers.length,
              analytics: allAnalytics.length,
              userProfile: userProfile ? 'exists' : 'null'
            });
            
            // Calculate upcoming departures (next 90 days)
            const now = new Date();
            const next90Days = new Date(now.getTime() + (90 * 24 * 60 * 60 * 1000));
            const upcomingCruises = cruises.filter(cruise => {
              try {
                const departureDate = new Date(cruise.departureDate);
                return !isNaN(departureDate.getTime()) && departureDate >= now && departureDate <= next90Days;
              } catch {
                return false;
              }
            });
            
            // Calculate active offers (not expired)
            const activeOffers = casinoOffers.filter(offer => {
              try {
                const expiryDate = new Date(offer.expires);
                return !isNaN(expiryDate.getTime()) && expiryDate > now;
              } catch {
                return false;
              }
            });
            
            // Calculate casino analytics summary
            const totalPotentialSavings = allAnalytics.reduce((sum, a) => sum + a.savings, 0);
            const averageROI = allAnalytics.length > 0 ? allAnalytics.reduce((sum, a) => sum + a.roi, 0) / allAnalytics.length : 0;
            const bestROI = allAnalytics.length > 0 ? Math.max(...allAnalytics.map(a => a.roi)) : 0;
            
            const result = {
              totalCruises: cruises.length,
              bookedCruises: bookedCruises.length,
              upcomingCruises: upcomingCruises.length,
              activeOffers: activeOffers.length,
              casinoOffers: [],
              userLevel: userProfile?.level || 'PRIME',
              userPoints: userProfile?.points || 0,
              casinoAnalytics: {
                totalAnalyses: allAnalytics.length,
                totalPotentialSavings,
                averageROI,
                bestROI,
                recommendedCruises: allAnalytics.filter(a => a.roi > 25).length
              },
              lastUpdate: new Date().toISOString()
            };
            
            console.log('[tRPC] Calculated overview stats:', result);
            return result;
          } catch (error) {
            console.error('[tRPC] Error in trpc.directAnalytics.getOverviewStats:', error);
            return {
              totalCruises: 0,
              bookedCruises: 0,
              upcomingCruises: 0,
              activeOffers: 0,
              casinoOffers: [],
              userLevel: 'PRIME',
              userPoints: 0,
              casinoAnalytics: {
                totalAnalyses: 0,
                totalPotentialSavings: 0,
                averageROI: 0,
                bestROI: 0,
                recommendedCruises: 0
              },
              lastUpdate: new Date().toISOString()
            };
          }
        })
    }),
    analytics: analyticsRouter,
    calendar: calendarRouter,
    ocr: ocrRouter,
    import: importRouter,
  }),
  
  // Simple test endpoint
  ping: publicProcedure
    .query(() => {
      console.log('[tRPC] Ping endpoint called');
      return {
        message: 'pong',
        timestamp: new Date().toISOString(),
        status: 'Router is working correctly'
      };
    }),

  // Back-compat test used by some screens
  directAnalyticsTest: publicProcedure
    .query(() => {
      console.log('[tRPC] directAnalyticsTest (top-level) called');
      return { message: 'ok', timestamp: new Date().toISOString() };
    }),
  
  // Status check
  status: publicProcedure
    .query(() => {
      console.log('[tRPC] Status check called');
      try {
        return {
          cruises: memoryStore.getCruises().length,
          bookedCruises: memoryStore.getBookedCruises().length,
          casinoOffers: memoryStore.getCasinoOffers().length,
          calendarEvents: memoryStore.getCalendarEvents().length,
          lastImport: memoryStore.lastImport,
          timestamp: new Date().toISOString()
        };
      } catch (error) {
        console.error('[tRPC] Error in status check:', error);
        return {
          cruises: 0,
          bookedCruises: 0,
          casinoOffers: 0,
          calendarEvents: 0,
          lastImport: null,
          timestamp: new Date().toISOString(),
          error: error instanceof Error ? error.message : 'Unknown error'
        };
      }
    }),
  
  // Direct procedures to bypass any router issues
  directCruises: createTRPCRouter({
    list: publicProcedure
      .input(z.object({
        search: z.string().optional(),
        cabinType: z.string().optional(),
        limit: z.number().default(25),
        offset: z.number().default(0)
      }))
      .query(({ input }) => {
        console.log('[tRPC] directCruises.list called with input:', input);
        try {
          const cruises = memoryStore.getCruises();
          console.log('[tRPC] Found', cruises.length, 'cruises in memory store');
          
          let filteredCruises = [...cruises];
          
          // Apply search filter
          if (input.search) {
            const searchLower = input.search.toLowerCase();
            filteredCruises = filteredCruises.filter(cruise => 
              cruise.ship?.toLowerCase().includes(searchLower) ||
              cruise.itineraryName?.toLowerCase().includes(searchLower) ||
              cruise.departurePort?.toLowerCase().includes(searchLower)
            );
          }
          
          // Apply cabin type filter
          if (input.cabinType) {
            filteredCruises = filteredCruises.filter(cruise => 
              cruise.cabinType === input.cabinType
            );
          }
          
          const total = filteredCruises.length;
          const paginatedCruises = filteredCruises.slice(input.offset, input.offset + input.limit);
          
          console.log('[tRPC] Returning', paginatedCruises.length, 'cruises out of', total, 'total');
          
          return {
            cruises: paginatedCruises,
            total,
            hasMore: input.offset + input.limit < total
          };
        } catch (error) {
          console.error('[tRPC] Error in directCruises.list:', error);
          return { cruises: [], total: 0, hasMore: false };
        }
      })
  }),

  directBookedCruises: createTRPCRouter({
    list: publicProcedure
      .query(() => {
        console.log('[tRPC] directBookedCruises.list called');
        try {
          const bookedCruises = memoryStore.getBookedCruises();
          console.log('[tRPC] Found', bookedCruises.length, 'booked cruises in memory store');
          return bookedCruises;
        } catch (error) {
          console.error('[tRPC] Error in directBookedCruises.list:', error);
          return [];
        }
      })
  }),

  directCalendar: createTRPCRouter({
    events: publicProcedure
      .input(z.object({
        source: z.enum(['tripit', 'booked', 'manual']).optional(),
        dateRange: z.object({
          from: z.string(),
          to: z.string()
        }).optional()
      }).optional())
      .query(({ input }) => {
        console.log('[tRPC] directCalendar.events called with input:', input);
        try {
          const allEvents = memoryStore.getCalendarEvents();
          console.log('[tRPC] Total events in store:', allEvents.length);
          
          let filteredEvents = [...allEvents];
          
          if (input?.source) {
            filteredEvents = filteredEvents.filter(e => e.source === input.source);
            console.log('[tRPC] After source filter:', filteredEvents.length);
          }
          
          if (input?.dateRange) {
            const { from, to } = input.dateRange;
            filteredEvents = filteredEvents.filter(e => 
              e.startDate >= from && e.endDate <= to
            );
            console.log('[tRPC] After date filter:', filteredEvents.length);
          }
          
          filteredEvents.sort((a, b) => 
            new Date(a.startDate).getTime() - new Date(b.startDate).getTime()
          );
          
          console.log('[tRPC] Returning', filteredEvents.length, 'filtered events');
          return filteredEvents;
        } catch (error) {
          console.error('[tRPC] Error in directCalendar.events:', error);
          return [];
        }
      })
  }),

  directAnalytics: createTRPCRouter({
    test: publicProcedure
      .query(() => {
        console.log('[tRPC] directAnalytics.test called');
        return {
          message: 'directAnalytics router is working',
          timestamp: new Date().toISOString()
        };
      }),
      
    getCasinoAnalytics: publicProcedure
      .input(z.object({ cruiseId: z.string() }).optional())
      .query(({ input }) => {
        console.log('[tRPC] directAnalytics.getCasinoAnalytics called with input:', input);
        try {
          if (input?.cruiseId) {
            const analytics = memoryStore.getCasinoAnalytics(input.cruiseId);
            console.log('[tRPC] Found analytics for cruise', input.cruiseId, ':', analytics ? 'yes' : 'no');
            return analytics;
          } else {
            const allAnalytics = memoryStore.getAllCasinoAnalytics();
            console.log('[tRPC] Found', allAnalytics.length, 'total analytics');
            return allAnalytics;
          }
        } catch (error) {
          console.error('[tRPC] Error in directAnalytics.getCasinoAnalytics:', error);
          return [];
        }
      }),
    
    getUserProfile: publicProcedure
      .query(() => {
        console.log('[tRPC] directAnalytics.getUserProfile called');
        try {
          const profile = memoryStore.getUserProfile();
          console.log('[tRPC] User profile found:', profile ? 'yes' : 'no');
          if (profile) {
            console.log('[tRPC] User profile data:', { level: profile.level, points: profile.points });
          }
          return profile;
        } catch (error) {
          console.error('[tRPC] Error in directAnalytics.getUserProfile:', error);
          return null;
        }
      }),
    
    getOverviewStats: publicProcedure
      .query(() => {
        console.log('[tRPC] directAnalytics.getOverviewStats called');
        try {
          const cruises = memoryStore.getCruises();
          const bookedCruises = memoryStore.getBookedCruises();
          const casinoOffers = memoryStore.getCasinoOffers();
          const userProfile = memoryStore.getUserProfile();
          const allAnalytics = memoryStore.getAllCasinoAnalytics();
          
          console.log('[tRPC] Data counts:', {
            cruises: cruises.length,
            bookedCruises: bookedCruises.length,
            casinoOffers: casinoOffers.length,
            analytics: allAnalytics.length,
            userProfile: userProfile ? 'exists' : 'null'
          });
          
          // Calculate upcoming departures (next 90 days)
          const now = new Date();
          const next90Days = new Date(now.getTime() + (90 * 24 * 60 * 60 * 1000));
          const upcomingCruises = cruises.filter(cruise => {
            try {
              const departureDate = new Date(cruise.departureDate);
              return !isNaN(departureDate.getTime()) && departureDate >= now && departureDate <= next90Days;
            } catch {
              return false;
            }
          });
          
          // Calculate active offers (not expired)
          const activeOffers = casinoOffers.filter(offer => {
            try {
              const expiryDate = new Date(offer.expires);
              return !isNaN(expiryDate.getTime()) && expiryDate > now;
            } catch {
              return false;
            }
          });
          
          // Calculate casino analytics summary
          const totalPotentialSavings = allAnalytics.reduce((sum, a) => sum + a.savings, 0);
          const averageROI = allAnalytics.length > 0 ? allAnalytics.reduce((sum, a) => sum + a.roi, 0) / allAnalytics.length : 0;
          const bestROI = allAnalytics.length > 0 ? Math.max(...allAnalytics.map(a => a.roi)) : 0;
          
          const result = {
            totalCruises: cruises.length,
            bookedCruises: bookedCruises.length,
            upcomingCruises: upcomingCruises.length,
            activeOffers: activeOffers.length,
            casinoOffers: [],
            userLevel: userProfile?.level || 'PRIME',
            userPoints: userProfile?.points || 0,
            casinoAnalytics: {
              totalAnalyses: allAnalytics.length,
              totalPotentialSavings,
              averageROI,
              bestROI,
              recommendedCruises: allAnalytics.filter(a => a.roi > 25).length
            },
            lastUpdate: new Date().toISOString()
          };
          
          console.log('[tRPC] Calculated overview stats:', result);
          return result;
        } catch (error) {
          console.error('[tRPC] Error in directAnalytics.getOverviewStats:', error);
          return {
            totalCruises: 0,
            bookedCruises: 0,
            upcomingCruises: 0,
            activeOffers: 0,
            casinoOffers: [],
            userLevel: 'PRIME',
            userPoints: 0,
            casinoAnalytics: {
              totalAnalyses: 0,
              totalPotentialSavings: 0,
              averageROI: 0,
              bestROI: 0,
              recommendedCruises: 0
            },
            lastUpdate: new Date().toISOString()
          };
        }
      }),

    topCompValue: publicProcedure
      .query(() => {
        console.log('[tRPC] directAnalytics.topCompValue called');
        try {
          const bookedCruises = memoryStore.getBookedCruises();
          const casinoOffers = memoryStore.getCasinoOffers();
        
          if (bookedCruises.length === 0 && casinoOffers.length === 0) {
            return {
              totalComps: 0,
              totalSavings: 0,
              totalSpent: 0,
              compToSpentRatio: 0,
              savingsToSpentRatio: 0,
              totalValue: 0,
              roi: 0
            };
          }
        
          const totalComps = casinoOffers.reduce((sum, offer) => {
            const value = offer.tradeInValue ? (parseFloat(offer.tradeInValue.replace(/[$,]/g, '')) || 0) : 0;
            return sum + value;
          }, 0);
        
          const totalSavings = bookedCruises.reduce((sum, cruise) => sum + (cruise.actualSavings || 0), 0);
          const totalSpent = memoryStore.getUserProfile()?.totalSpent || 0;
        
          return {
            totalComps,
            totalSavings,
            totalSpent,
            compToSpentRatio: totalSpent > 0 ? totalComps / totalSpent : 0,
            savingsToSpentRatio: totalSpent > 0 ? totalSavings / totalSpent : 0,
            totalValue: totalComps + totalSavings,
            roi: totalSpent > 0 ? ((totalComps + totalSavings) / totalSpent) * 100 : 0
          };
        } catch (error) {
          console.error('[tRPC] Error in directAnalytics.topCompValue:', error);
          return {
            totalComps: 0,
            totalSavings: 0,
            totalSpent: 0,
            compToSpentRatio: 0,
            savingsToSpentRatio: 0,
            totalValue: 0,
            roi: 0
          };
        }
      }),

    getBreakEvenAnalysis: publicProcedure
      .query(() => {
        console.log('[tRPC] directAnalytics.getBreakEvenAnalysis called');
        try {
          const allAnalytics = memoryStore.getAllCasinoAnalytics();
          const cruises = memoryStore.getCruises();
          
          const breakEvenAnalysis = allAnalytics.map(analytics => {
            const cruise = cruises.find(c => c.id === analytics.cruiseId);
            
            const pointsNeeded = analytics.costPerPoint > 0 ? 
              Math.ceil(analytics.retailValue / analytics.costPerPoint) : 0;
            
            const currentPoints = analytics.points;
            const pointsToBreakEven = Math.max(0, pointsNeeded - currentPoints);
            const isBreakEven = currentPoints >= pointsNeeded;
            const additionalCoinInNeeded = pointsToBreakEven * 5;
            
            return {
              cruiseId: analytics.cruiseId,
              ship: cruise?.ship || 'Unknown Ship',
              itinerary: cruise?.itineraryName || 'Unknown Itinerary',
              retailValue: analytics.retailValue,
              costPerPoint: analytics.costPerPoint,
              pointsNeeded,
              currentPoints,
              pointsToBreakEven,
              additionalCoinInNeeded,
              isBreakEven,
              currentROI: analytics.roi,
              projectedROIAtBreakEven: isBreakEven ? analytics.roi : 0
            };
          }).sort((a, b) => a.pointsToBreakEven - b.pointsToBreakEven);
          
          const summary = {
            totalCruises: breakEvenAnalysis.length,
            alreadyBreakEven: breakEvenAnalysis.filter(c => c.isBreakEven).length,
            needingBreakEven: breakEvenAnalysis.filter(c => !c.isBreakEven).length,
            totalAdditionalCoinInNeeded: breakEvenAnalysis
              .filter(c => !c.isBreakEven)
              .reduce((sum, c) => sum + c.additionalCoinInNeeded, 0),
            averagePointsToBreakEven: breakEvenAnalysis.length > 0 ?
              breakEvenAnalysis
                .filter(c => !c.isBreakEven)
                .reduce((sum, c) => sum + c.pointsToBreakEven, 0) / 
              Math.max(1, breakEvenAnalysis.filter(c => !c.isBreakEven).length) : 0
          };
          
          return {
            cruises: breakEvenAnalysis,
            summary
          };
        } catch (error) {
          console.error('[tRPC] Error in directAnalytics.getBreakEvenAnalysis:', error);
          return { cruises: [], summary: { totalCruises: 0, alreadyBreakEven: 0, needingBreakEven: 0, totalAdditionalCoinInNeeded: 0, averagePointsToBreakEven: 0 } };
        }
      }),

    getPortfolioAnalysis: publicProcedure
      .query(() => {
        console.log('[tRPC] directAnalytics.getPortfolioAnalysis called');
        try {
          const allAnalytics = memoryStore.getAllCasinoAnalytics();
          const userProfile = memoryStore.getUserProfile();
          
          if (allAnalytics.length === 0) {
            return {
              totalSavings: 0,
              totalNetSpend: 0,
              portfolioBalance: 0,
              isAhead: false,
              cruiseCount: 0,
              averageSavingsPerCruise: 0,
              totalCoinIn: 0,
              totalSpent: 0
            };
          }
          
          const totalSavings = allAnalytics.reduce((sum, a) => sum + a.savings, 0);
          const totalCoinIn = allAnalytics.reduce((sum, a) => sum + a.coinIn, 0);
          const totalNetSpend = totalCoinIn;
          const portfolioBalance = totalSavings - totalNetSpend;
          
          return {
            totalSavings,
            totalNetSpend,
            portfolioBalance,
            isAhead: portfolioBalance > 0,
            cruiseCount: allAnalytics.length,
            averageSavingsPerCruise: totalSavings / allAnalytics.length,
            totalCoinIn,
            totalSpent: userProfile?.totalSpent || totalNetSpend
          };
        } catch (error) {
          console.error('[tRPC] Error in directAnalytics.getPortfolioAnalysis:', error);
          return {
            totalSavings: 0,
            totalNetSpend: 0,
            portfolioBalance: 0,
            isAhead: false,
            cruiseCount: 0,
            averageSavingsPerCruise: 0,
            totalCoinIn: 0,
            totalSpent: 0
          };
        }
      }),

    getCategoryUpgradeAnalysis: publicProcedure
      .query(() => {
        console.log('[tRPC] directAnalytics.getCategoryUpgradeAnalysis called');
        try {
          const payTable = memoryStore.getCasinoPayTable();
          const userProfile = memoryStore.getUserProfile();
          const currentPoints = userProfile?.points || 0;
          
          const upgradeAnalysis = [];
          
          for (let i = 0; i < payTable.length - 1; i++) {
            const currentTier = payTable[i];
            const nextTier = payTable[i + 1];
            
            const currentValue = memoryStore.calculateOfferValue(currentTier.points, 'Interior');
            const nextValue = memoryStore.calculateOfferValue(nextTier.points, 'Interior');
            
            const extraPointsNeeded = nextTier.points - currentTier.points;
            const extraValue = nextValue - currentValue;
            const upgradeEfficiency = extraPointsNeeded > 0 ? extraValue / extraPointsNeeded : 0;
            const extraCoinInNeeded = extraPointsNeeded * 5;
            
            const canAchieve = currentPoints >= currentTier.points;
            const canUpgrade = currentPoints >= nextTier.points;
            
            upgradeAnalysis.push({
              fromTier: {
                points: currentTier.points,
                reward: currentTier.reward,
                value: currentValue,
                cabinTypes: currentTier.cabinTypes
              },
              toTier: {
                points: nextTier.points,
                reward: nextTier.reward,
                value: nextValue,
                cabinTypes: nextTier.cabinTypes
              },
              upgrade: {
                extraPointsNeeded,
                extraValue,
                upgradeEfficiency,
                extraCoinInNeeded,
                efficiencyPerDollar: extraCoinInNeeded > 0 ? extraValue / extraCoinInNeeded : 0
              },
              userStatus: {
                canAchieve,
                canUpgrade,
                pointsNeeded: Math.max(0, currentTier.points - currentPoints),
                pointsToUpgrade: Math.max(0, nextTier.points - currentPoints)
              },
              recommendation: upgradeEfficiency > 0.25 ? 'Excellent' :
                             upgradeEfficiency > 0.15 ? 'Good' :
                             upgradeEfficiency > 0.10 ? 'Fair' : 'Poor'
            });
          }
          
          upgradeAnalysis.sort((a, b) => b.upgrade.upgradeEfficiency - a.upgrade.upgradeEfficiency);
          
          const summary = {
            currentUserPoints: currentPoints,
            currentTier: payTable.find(tier => currentPoints >= tier.points)?.reward || 'None',
            nextTier: payTable.find(tier => currentPoints < tier.points)?.reward || 'Max Level',
            bestUpgradeEfficiency: upgradeAnalysis.length > 0 ? upgradeAnalysis[0].upgrade.upgradeEfficiency : 0,
            recommendedUpgrades: upgradeAnalysis.filter(u => u.recommendation === 'Excellent' || u.recommendation === 'Good').length,
            totalTiers: payTable.length
          };
          
          return {
            upgrades: upgradeAnalysis,
            summary,
            payTable
          };
        } catch (error) {
          console.error('[tRPC] Error in directAnalytics.getCategoryUpgradeAnalysis:', error);
          return { upgrades: [], summary: { currentUserPoints: 0, currentTier: 'None', nextTier: 'None', bestUpgradeEfficiency: 0, recommendedUpgrades: 0, totalTiers: 0 }, payTable: [] };
        }
      }),

    cruiseValueAnalysis: publicProcedure
      .query(() => {
        console.log('[tRPC] directAnalytics.cruiseValueAnalysis called');
        try {
          const bookedCruises = memoryStore.getBookedCruises();
          
          const analysis = bookedCruises.map(cruise => {
            const actualSavings = cruise.actualSavings || 0;
            const projectedSavings = cruise.projectedSavings || 0;
            const paidFare = cruise.paidFare || 0;
            const currentMarketPrice = cruise.currentMarketPrice || cruise.actualFare || 0;
            
            return {
              id: cruise.id,
              ship: cruise.ship,
              itinerary: cruise.itineraryName,
              departureDate: cruise.departureDate,
              paidFare,
              currentMarketPrice,
              actualSavings,
              projectedSavings,
              savingsPercentage: currentMarketPrice > 0 ? (projectedSavings / currentMarketPrice) * 100 : 0,
              valueScore: projectedSavings / Math.max(paidFare, 1)
            };
          });
          
          analysis.sort((a, b) => b.valueScore - a.valueScore);
          
          return {
            cruises: analysis,
            totalValue: analysis.reduce((sum, c) => sum + c.currentMarketPrice, 0),
            totalPaid: analysis.reduce((sum, c) => sum + c.paidFare, 0),
            totalSavings: analysis.reduce((sum, c) => sum + c.projectedSavings, 0),
            averageSavingsPercentage: analysis.length > 0 
              ? analysis.reduce((sum, c) => sum + c.savingsPercentage, 0) / analysis.length 
              : 0
          };
        } catch (error) {
          console.error('[tRPC] Error in directAnalytics.cruiseValueAnalysis:', error);
          return { cruises: [], totalValue: 0, totalPaid: 0, totalSavings: 0, averageSavingsPercentage: 0 };
        }
      }),

    crossReferenceReceiptsAndStatements: publicProcedure
      .query(() => {
        console.log('[tRPC] directAnalytics.crossReferenceReceiptsAndStatements called');
        try {
          const cruises = memoryStore.getCruises();
          const receipts = memoryStore.getReceipts();
          const statements = memoryStore.getCruiseStatements();
          
          // Cross-reference receipts and statements with cruises
          const crossReference = cruises.map(cruise => {
            // Find matching receipts by ship name and approximate date
            const matchingReceipts = receipts.filter(receipt => {
              if (receipt.cruiseId === cruise.id) return true;
              
              // Try to match by ship name
              const shipMatch = receipt.ship && cruise.ship && 
                receipt.ship.toLowerCase().includes(cruise.ship.toLowerCase().split(' ')[0]);
              
              // Try to match by date (within cruise date range)
              let dateMatch = false;
              if (receipt.departureDate && cruise.departureDate && cruise.returnDate) {
                const receiptDate = new Date(receipt.departureDate);
                const depDate = new Date(cruise.departureDate);
                const retDate = new Date(cruise.returnDate);
                dateMatch = receiptDate >= depDate && receiptDate <= retDate;
              }
              
              return shipMatch || dateMatch;
            });
            
            // Find matching statements by ship name and approximate date
            const matchingStatements = statements.filter(statement => {
              if (statement.cruiseId === cruise.id) return true;
              
              // Try to match by ship name
              const shipMatch = statement.shipName && cruise.ship && 
                statement.shipName.toLowerCase().includes(cruise.ship.toLowerCase().split(' ')[0]);
              
              // Try to match by date
              let dateMatch = false;
              if (statement.cruiseDate && cruise.departureDate && cruise.returnDate) {
                const statementDate = new Date(statement.cruiseDate);
                const depDate = new Date(cruise.departureDate);
                const retDate = new Date(cruise.returnDate);
                dateMatch = statementDate >= depDate && statementDate <= retDate;
              }
              
              return shipMatch || dateMatch;
            });
            
            // Calculate total spending from receipts
            const totalReceiptSpending = matchingReceipts.reduce((sum, receipt) => {
              const amount = receipt.totalPaid || 0;
              return sum + amount;
            }, 0);
            
            // Calculate total spending from statements
            const totalStatementSpending = matchingStatements.reduce((sum, statement) => {
              const amount = parseFloat(statement.totalSpent?.replace(/[$,]/g, '') || '0');
              return sum + (isNaN(amount) ? 0 : amount);
            }, 0);
            
            // Determine if this is a past or future cruise
            const today = new Date();
            const departureDate = new Date(cruise.departureDate);
            const isPastCruise = departureDate < today;
            
            return {
              cruise: {
                id: cruise.id,
                ship: cruise.ship,
                itineraryName: cruise.itineraryName,
                departureDate: cruise.departureDate,
                returnDate: cruise.returnDate,
                nights: cruise.nights,
                isPastCruise
              },
              receipts: matchingReceipts.map(r => ({
                id: r.id,
                ship: r.ship,
                departureDate: r.departureDate,
                totalPaid: r.totalPaid,
                reservationNumber: r.reservationNumber,
                confidence: r.cruiseId === cruise.id ? 'high' : 'medium'
              })),
              statements: matchingStatements.map(s => ({
                id: s.id,
                shipName: s.shipName || 'Unknown',
                cruiseDate: s.cruiseDate || 'Unknown',
                totalSpent: s.totalSpent || 0,
                confidence: s.cruiseId === cruise.id ? 'high' : 'medium'
              })),
              analytics: {
                totalReceiptSpending,
                totalStatementSpending,
                hasReceiptData: matchingReceipts.length > 0,
                hasStatementData: matchingStatements.length > 0,
                isComplete: matchingReceipts.length > 0 && matchingStatements.length > 0,
                receiptCount: matchingReceipts.length,
                statementCount: matchingStatements.length
              }
            };
          });
          
          // Filter to only show cruises with receipt or statement data
          const cruisesWithData = crossReference.filter(cr => 
            cr.analytics.hasReceiptData || cr.analytics.hasStatementData
          );
          
          // Sort by departure date (most recent first)
          cruisesWithData.sort((a, b) => 
            new Date(b.cruise.departureDate).getTime() - new Date(a.cruise.departureDate).getTime()
          );
          
          const summary = {
            totalCruisesWithData: cruisesWithData.length,
            cruisesWithReceipts: cruisesWithData.filter(cr => cr.analytics.hasReceiptData).length,
            cruisesWithStatements: cruisesWithData.filter(cr => cr.analytics.hasStatementData).length,
            cruisesWithBoth: cruisesWithData.filter(cr => cr.analytics.isComplete).length,
            totalReceiptSpending: cruisesWithData.reduce((sum, cr) => sum + cr.analytics.totalReceiptSpending, 0),
            totalStatementSpending: cruisesWithData.reduce((sum, cr) => sum + cr.analytics.totalStatementSpending, 0),
            pastCruises: cruisesWithData.filter(cr => cr.cruise.isPastCruise).length,
            futureCruises: cruisesWithData.filter(cr => !cr.cruise.isPastCruise).length
          };
          
          console.log('[tRPC] Cross-reference summary:', summary);
          
          return {
            cruises: cruisesWithData,
            summary
          };
        } catch (error) {
          console.error('[tRPC] Error in crossReferenceReceiptsAndStatements:', error);
          return {
            cruises: [],
            summary: {
              totalCruisesWithData: 0,
              cruisesWithReceipts: 0,
              cruisesWithStatements: 0,
              cruisesWithBoth: 0,
              totalReceiptSpending: 0,
              totalStatementSpending: 0,
              pastCruises: 0,
              futureCruises: 0
            }
          };
        }
      }),

    calculateAccuratePricingFromData: publicProcedure
      .input(z.object({ cruiseId: z.string() }))
      .query(({ input }) => {
        console.log('[tRPC] directAnalytics.calculateAccuratePricingFromData called for cruise:', input.cruiseId);
        try {
          const cruise = memoryStore.getCruise(input.cruiseId);
          if (!cruise) {
            throw new Error('Cruise not found');
          }
          
          const receipts = memoryStore.getReceiptsByCruiseId(input.cruiseId);
          const statements = memoryStore.getCruiseStatementsByCruiseId(input.cruiseId);
          
          // Calculate accurate pricing from receipt data
          let accuratePricing = {
            totalFare: 0,
            taxesAndFees: 0,
            gratuities: 0,
            totalPaid: 0,
            casinoDiscount: 0,
            freePlay: 0,
            actualSavings: 0,
            hasReceiptData: receipts.length > 0
          };
          
          if (receipts.length > 0) {
            // Use the most recent receipt for pricing data
            const latestReceipt = receipts.sort((a, b) => 
              new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
            )[0];
            
            accuratePricing = {
              totalFare: latestReceipt.totalFare || 0,
              taxesAndFees: latestReceipt.taxesAndFees || 0,
              gratuities: latestReceipt.gratuities || 0,
              totalPaid: latestReceipt.totalPaid || 0,
              casinoDiscount: 0, // Will be calculated from line items if available
              freePlay: 0, // Will be extracted from special offers
              actualSavings: 0,
              hasReceiptData: true
            };
            
            // Calculate actual savings (what would have been paid vs what was actually paid)
            const basePrice = (accuratePricing.totalFare || 0) + (accuratePricing.taxesAndFees || 0) + (accuratePricing.gratuities || 0);
            accuratePricing.actualSavings = Math.max(0, basePrice - (accuratePricing.totalPaid || 0));
          }
          
          // Calculate casino analytics from statement data
          let casinoAnalytics = {
            totalSpent: 0,
            totalWon: 0,
            netLoss: 0,
            pointsEarned: 0,
            averageBet: 0,
            sessionsPlayed: 0,
            hasStatementData: statements.length > 0,
            breakdown: {
              slots: { spent: 0, won: 0, net: 0 },
              tableGames: { spent: 0, won: 0, net: 0 },
              poker: { spent: 0, won: 0, net: 0 },
              other: { spent: 0, won: 0, net: 0 }
            }
          };
          
          if (statements.length > 0) {
            // Aggregate data from all statements for this cruise
            statements.forEach(statement => {
              const spent = parseFloat(statement.totalSpent?.replace(/[$,]/g, '') || '0');
              const won = parseFloat(statement.totalWon?.replace(/[$,]/g, '') || '0');
              
              casinoAnalytics.totalSpent += spent;
              casinoAnalytics.totalWon += won;
              casinoAnalytics.pointsEarned += statement.pointsEarned || 0;
              casinoAnalytics.sessionsPlayed += statement.sessionsPlayed || 1;
              
              // Break down by game type if available
              if (statement.gameBreakdown) {
                Object.entries(statement.gameBreakdown).forEach(([gameType, data]: [string, any]) => {
                  if (casinoAnalytics.breakdown[gameType as keyof typeof casinoAnalytics.breakdown]) {
                    casinoAnalytics.breakdown[gameType as keyof typeof casinoAnalytics.breakdown].spent += data.spent || 0;
                    casinoAnalytics.breakdown[gameType as keyof typeof casinoAnalytics.breakdown].won += data.won || 0;
                  }
                });
              }
            });
            
            casinoAnalytics.netLoss = casinoAnalytics.totalSpent - casinoAnalytics.totalWon;
            casinoAnalytics.averageBet = casinoAnalytics.sessionsPlayed > 0 ? 
              casinoAnalytics.totalSpent / casinoAnalytics.sessionsPlayed : 0;
            
            // Calculate net for each game type
            Object.keys(casinoAnalytics.breakdown).forEach(gameType => {
              const game = casinoAnalytics.breakdown[gameType as keyof typeof casinoAnalytics.breakdown];
              game.net = game.spent - game.won;
            });
          }
          
          // Calculate ROI and value analysis
          const roi = accuratePricing.totalPaid > 0 ? 
            ((accuratePricing.actualSavings + accuratePricing.freePlay) / accuratePricing.totalPaid) * 100 : 0;
          
          const valueAnalysis = {
            effectiveDiscount: accuratePricing.totalFare > 0 ? 
              (accuratePricing.actualSavings / accuratePricing.totalFare) * 100 : 0,
            costPerPoint: casinoAnalytics.pointsEarned > 0 ? 
              casinoAnalytics.totalSpent / casinoAnalytics.pointsEarned : 0,
            valuePerPoint: casinoAnalytics.pointsEarned > 0 ? 
              (accuratePricing.actualSavings + accuratePricing.freePlay) / casinoAnalytics.pointsEarned : 0,
            roi,
            breakEvenPoint: accuratePricing.actualSavings > 0 ? 
              (casinoAnalytics.totalSpent / accuratePricing.actualSavings) * 100 : 0
          };
          
          // Generate recommendations based on actual data
          const recommendations = [];
          
          if (valueAnalysis.roi > 50) {
            recommendations.push('🎯 Excellent ROI - This cruise strategy is highly profitable!');
          } else if (valueAnalysis.roi > 25) {
            recommendations.push('✅ Good ROI - This cruise offers solid value');
          } else if (valueAnalysis.roi > 0) {
            recommendations.push('⚠️ Modest ROI - Consider optimizing your casino strategy');
          } else {
            recommendations.push('❌ Negative ROI - Review your approach for future cruises');
          }
          
          if (valueAnalysis.costPerPoint > 0 && valueAnalysis.costPerPoint < 3) {
            recommendations.push('💎 Excellent cost per point (<$3)');
          } else if (valueAnalysis.costPerPoint < 5) {
            recommendations.push('👍 Good cost per point (<$5)');
          } else if (valueAnalysis.costPerPoint > 7) {
            recommendations.push('📈 High cost per point - consider different games or betting strategy');
          }
          
          if (casinoAnalytics.hasStatementData) {
            const winRate = casinoAnalytics.totalSpent > 0 ? 
              (casinoAnalytics.totalWon / casinoAnalytics.totalSpent) * 100 : 0;
            
            if (winRate > 90) {
              recommendations.push('🍀 Exceptional win rate - great session!');
            } else if (winRate > 70) {
              recommendations.push('🎲 Good win rate - solid performance');
            } else if (winRate < 50) {
              recommendations.push('🎯 Consider adjusting game selection or betting strategy');
            }
          }
          
          const result = {
            cruise: {
              id: cruise.id,
              ship: cruise.ship,
              itineraryName: cruise.itineraryName,
              departureDate: cruise.departureDate,
              nights: cruise.nights
            },
            accuratePricing,
            casinoAnalytics,
            valueAnalysis,
            recommendations,
            dataQuality: {
              hasReceiptData: accuratePricing.hasReceiptData,
              hasStatementData: casinoAnalytics.hasStatementData,
              isComplete: accuratePricing.hasReceiptData && casinoAnalytics.hasStatementData,
              receiptCount: receipts.length,
              statementCount: statements.length
            },
            lastCalculated: new Date().toISOString()
          };
          
          console.log('[tRPC] Calculated accurate pricing and analytics:', {
            cruiseId: input.cruiseId,
            actualSavings: accuratePricing.actualSavings,
            roi: valueAnalysis.roi.toFixed(1) + '%',
            dataQuality: result.dataQuality
          });
          
          return result;
        } catch (error) {
          console.error('[tRPC] Error in calculateAccuratePricingFromData:', error);
          throw new Error(`Failed to calculate accurate pricing: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
      })
  }),
});

console.log('[tRPC] ===== CLEAN APP ROUTER CREATED =====');

// Verify the router structure
console.log('[tRPC] Available routes:', Object.keys(appRouter));

// Test that all expected routers exist
const expectedRouters = ['cruises', 'bookedCruises', 'casinoOffers', 'calendar', 'analytics', 'directCruises', 'directBookedCruises', 'directCalendar', 'directAnalytics'];
expectedRouters.forEach(routerName => {
  const exists = !!(appRouter as any)[routerName];
  console.log(`[tRPC] ${routerName}: ${exists ? '✅' : '❌'}`);
});

// Test direct procedures
try {
  const directAnalyticsProcedures = Object.keys((appRouter as any).directAnalytics._def?.procedures || {});
  console.log('[tRPC] directAnalytics procedures:', directAnalyticsProcedures);
  
  const directCruisesProcedures = Object.keys((appRouter as any).directCruises._def?.procedures || {});
  console.log('[tRPC] directCruises procedures:', directCruisesProcedures);
  
  const directCalendarProcedures = Object.keys((appRouter as any).directCalendar._def?.procedures || {});
  console.log('[tRPC] directCalendar procedures:', directCalendarProcedures);
  
  const analyticsProcedures = Object.keys((appRouter as any).analytics._def?.procedures || {});
  console.log('[tRPC] analytics procedures:', analyticsProcedures);
  
  const calendarProcedures = Object.keys((appRouter as any).calendar._def?.procedures || {});
  console.log('[tRPC] calendar procedures:', calendarProcedures);
  
} catch (error) {
  console.error('[tRPC] Error testing procedures:', error);
}

export type AppRouter = typeof appRouter;

console.log('[tRPC] ===== CLEAN APP ROUTER INITIALIZATION COMPLETE =====');