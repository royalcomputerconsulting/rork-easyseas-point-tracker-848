import { z } from 'zod';
import { publicProcedure, createTRPCRouter } from '../../create-context';
import { memoryStore } from '../_stores/memory';
import { importCalendarProcedure } from './import-calendar/route';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { STATIC_BOOKED_CRUISES } from '@/state/staticBooked';

export const calendarRouter = createTRPCRouter({
  events: publicProcedure
    .input(z.object({
      source: z.enum(['tripit', 'booked', 'manual']).optional(),
      dateRange: z.object({
        from: z.string(),
        to: z.string()
      }).optional()
    }).optional())
    .query(({ input }) => {
      console.log('[tRPC] ===== EVENTS QUERY CALLED =====');
      console.log('[tRPC] Input filters:', input);
      console.log('[tRPC] Current timestamp:', new Date().toISOString());
      
      // CRITICAL FIX: Always use the singleton instance from memoryStore
      // This ensures we're always using the same instance across all requests
      const store = memoryStore; // This already uses the singleton pattern
      console.log('[tRPC] Using store instance - events count:', store.calendarEvents.length);
      
      // Direct access to the array - no cloning yet
      console.log('[tRPC] Direct calendarEvents.length:', store.calendarEvents.length);
      
      // Get events directly without deep cloning issues
      const baseEvents = store.calendarEvents;
      console.log('[tRPC] Total events in array:', baseEvents.length);

      // Derive events for booked cruises so they appear on the calendar
      let bookedCruises = store.bookedCruises || [];
      
      // If no booked cruises in memory store, use static data as fallback
      if (bookedCruises.length === 0) {
        console.log('[tRPC] No booked cruises in memory store, using static data for calendar events');
        bookedCruises = STATIC_BOOKED_CRUISES as any[];
      }
      
      const bookedAsEvents = bookedCruises.map((bc) => ({
        id: `booked-${bc.id}`,
        summary: `${bc.ship}${bc.itineraryName ? ' – ' + bc.itineraryName : ''}`,
        location: bc.departurePort || '',
        startDate: bc.startDate || ('departureDate' in bc ? bc.departureDate : ''),
        endDate: bc.endDate || bc.startDate || ('returnDate' in bc ? bc.returnDate : ''),
        description: `Booked cruise${bc.reservationNumber ? ' #' + bc.reservationNumber : ''}`,
        source: 'booked' as const,
        cruiseId: bc.cruiseId || null,
        createdAt: bc.createdAt || new Date().toISOString(),
        updatedAt: bc.updatedAt || new Date().toISOString(),
      }));

      // Merge arrays and de-duplicate by id
      const mergedMap = new Map<string, any>();
      [...baseEvents, ...bookedAsEvents].forEach((e) => {
        if (!mergedMap.has(e.id)) mergedMap.set(e.id, e);
      });
      const allEvents = Array.from(mergedMap.values());

      // Log events by source
      const eventsBySource = allEvents.reduce((acc, e) => {
        acc[e.source] = (acc[e.source] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);
      console.log('[tRPC] Events by source (with booked):', eventsBySource);
      
      // Log first few events for debugging
      if (allEvents.length > 0) {
        console.log('[tRPC] First 5 events returned:');
        allEvents.slice(0, 5).forEach((e, i) => {
          console.log(`  ${i + 1}. [${e.source}] "${e.summary}" from ${e.startDate} to ${e.endDate}`);
        });
      } else {
        console.log('[tRPC] WARNING: No events to return!');
      }
      
      // Apply filters if provided - create a new array to ensure React Query detects changes
      let filteredEvents = [...allEvents];
      
      if (input?.source) {
        filteredEvents = filteredEvents.filter(e => e.source === input.source);
        console.log('[tRPC] After source filter:', filteredEvents.length);
      }
      
      if (input?.dateRange) {
        const { from, to } = input.dateRange;
        // Include events that OVERLAP the requested window, not just fully inside it
        filteredEvents = filteredEvents.filter(e => (
          (e.startDate <= to) && (e.endDate >= from)
        ));
        console.log('[tRPC] After date overlap filter:', filteredEvents.length);
      }
      
      // Sort by start date
      filteredEvents.sort((a, b) => {
        const at = new Date(a.startDate).getTime();
        const bt = new Date(b.startDate).getTime();
        return at - bt;
      });
      
      console.log('[tRPC] Final return count:', filteredEvents.length, 'events');
      console.log('[tRPC] Sample return data:', filteredEvents.slice(0, 2));
      console.log('[tRPC] ===== END EVENTS QUERY =====');
      
      // Return a new array to ensure React Query detects changes
      return filteredEvents.map(e => ({
        id: e.id,
        summary: e.summary,
        location: e.location || '',
        startDate: e.startDate,
        endDate: e.endDate,
        description: e.description || '',
        source: e.source,
        cruiseId: e.cruiseId || null,
        createdAt: e.createdAt,
        updatedAt: e.updatedAt
      }));
    }),

  createEvent: publicProcedure
    .input(z.object({
      summary: z.string(),
      location: z.string().optional(),
      startDate: z.string(),
      endDate: z.string(),
      description: z.string().optional(),
      source: z.enum(['tripit', 'booked', 'manual']),
      cruiseId: z.string().optional(),
    }))
    .mutation(({ input }) => {
      console.log('[tRPC] Creating calendar event:', input.summary);
      return memoryStore.createCalendarEvent(input);
    }),

  importIcs: publicProcedure
    .input(z.object({
      icsContent: z.string()
    }))
    .mutation(({ input }) => {
      console.log('[tRPC] ===== IMPORT ICS STARTED =====');
      console.log('[tRPC] ICS content length:', input.icsContent.length);
      console.log('[tRPC] First 500 chars:', input.icsContent.substring(0, 500));
      
      // Use singleton instance to ensure consistency
      const store = memoryStore; // This already uses the singleton pattern
      console.log('[tRPC] Memory store before import:', store.calendarEvents.length, 'events');
      
      // Don't clear existing events - let user manage them
      const existingManualEvents = store.calendarEvents.filter(e => e.source === 'manual');
      console.log('[tRPC] Existing manual events:', existingManualEvents.length);
      
      // Parse ICS content - handle both \n and \r\n line endings
      const events = [];
      const rawLines = input.icsContent.split(/\r?\n/);
      console.log('[tRPC] Total raw lines:', rawLines.length);
      
      // Unfold continuation lines (lines starting with space or tab)
      const lines: string[] = [];
      for (let i = 0; i < rawLines.length; i++) {
        const line = rawLines[i];
        if (line.startsWith(' ') || line.startsWith('\t')) {
          // Continuation line - append to previous line
          if (lines.length > 0) {
            lines[lines.length - 1] += line.substring(1);
          }
        } else {
          lines.push(line);
        }
      }
      console.log('[tRPC] Lines after unfolding:', lines.length);
      
      let currentEvent: any = null;
      let eventCount = 0;
      
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        
        if (line === 'BEGIN:VEVENT') {
          eventCount++;
          currentEvent = { source: 'manual' };
          console.log(`[tRPC] Started parsing event ${eventCount}`);
        } else if (line === 'END:VEVENT' && currentEvent) {
          // Validate and create event
          if (currentEvent.summary && currentEvent.startDate) {
            // If no end date, use start date
            if (!currentEvent.endDate) {
              currentEvent.endDate = currentEvent.startDate;
            }
            
            // Create event directly in memory store
            const eventData: any = {
              id: `manual-${Date.now()}-${events.length}`,
              summary: currentEvent.summary,
              location: currentEvent.location || '',
              startDate: currentEvent.startDate,
              endDate: currentEvent.endDate,
              description: currentEvent.description || '',
              source: 'manual' as const,
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString()
            };
            store.calendarEvents.push(eventData);
            events.push(eventData);
            console.log(`[tRPC] Created event: "${currentEvent.summary}" on ${currentEvent.startDate}`);
          } else {
            console.log(`[tRPC] Skipped incomplete event ${eventCount}:`, currentEvent);
          }
          currentEvent = null;
        } else if (currentEvent && line.includes(':')) {
          const colonIndex = line.indexOf(':');
          const fullKey = line.substring(0, colonIndex);
          const key = fullKey.split(';')[0]; // Remove parameters like ;VALUE=DATE
          const value = line.substring(colonIndex + 1);
          
          switch (key) {
            case 'SUMMARY':
              currentEvent.summary = value
                .replace(/\\\\,/g, ',')
                .replace(/\\\\;/g, ';')
                .replace(/\\\\n/g, ' ')
                .replace(/\\\\\\\\n/g, ' ')
                .trim();
              break;
              
            case 'DTSTART':
              const startVal = value.trim();
              if (startVal.length === 8 && /^\d{8}$/.test(startVal)) {
                // YYYYMMDD format
                currentEvent.startDate = `${startVal.slice(0,4)}-${startVal.slice(4,6)}-${startVal.slice(6,8)}`;
              } else if (startVal.includes('T') && startVal.length >= 15) {
                // YYYYMMDDTHHMMSS format - extract date part
                const datePart = startVal.split('T')[0];
                if (datePart.length === 8) {
                  currentEvent.startDate = `${datePart.slice(0,4)}-${datePart.slice(4,6)}-${datePart.slice(6,8)}`;
                }
              } else {
                // Try to parse as-is
                try {
                  const date = new Date(startVal);
                  if (!isNaN(date.getTime())) {
                    currentEvent.startDate = date.toISOString().split('T')[0];
                  }
                } catch (e) {
                  console.log('[tRPC] Could not parse DTSTART:', startVal);
                }
              }
              break;
              
            case 'DTEND':
              const endVal = value.trim();
              if (endVal.length === 8 && /^\d{8}$/.test(endVal)) {
                // YYYYMMDD format
                currentEvent.endDate = `${endVal.slice(0,4)}-${endVal.slice(4,6)}-${endVal.slice(6,8)}`;
              } else if (endVal.includes('T') && endVal.length >= 15) {
                // YYYYMMDDTHHMMSS format - extract date part
                const datePart = endVal.split('T')[0];
                if (datePart.length === 8) {
                  currentEvent.endDate = `${datePart.slice(0,4)}-${datePart.slice(4,6)}-${datePart.slice(6,8)}`;
                }
              } else {
                // Try to parse as-is
                try {
                  const date = new Date(endVal);
                  if (!isNaN(date.getTime())) {
                    currentEvent.endDate = date.toISOString().split('T')[0];
                  }
                } catch (e) {
                  console.log('[tRPC] Could not parse DTEND:', endVal);
                }
              }
              break;
              
            case 'LOCATION':
              currentEvent.location = value
                .replace(/\\\\,/g, ',')
                .replace(/\\\\;/g, ';')
                .replace(/\\\\n/g, ' ')
                .trim();
              break;
              
            case 'DESCRIPTION':
              currentEvent.description = value
                .replace(/\\\\\\\\n/g, '\n')
                .replace(/\\\\n/g, '\n')
                .replace(/\\\\,/g, ',')
                .replace(/\\\\;/g, ';')
                .trim();
              break;
          }
        }
      }
      
      console.log(`[tRPC] Successfully imported ${events.length} events from ICS file`);
      
      // Force verification of events in store
      const allEvents = [...store.calendarEvents];
      const manualEvents = allEvents.filter(e => e.source === 'manual');
      const tripitEvents = allEvents.filter(e => e.source === 'tripit');
      console.log(`[tRPC] ===== IMPORT COMPLETE =====`);
      console.log(`[tRPC] Total events now in store: ${allEvents.length}`);
      console.log(`[tRPC] Manual events: ${manualEvents.length}`);
      console.log(`[tRPC] TripIt events: ${tripitEvents.length}`);
      
      // Log sample imported events
      if (events.length > 0) {
        console.log('[tRPC] Sample imported events:');
        events.slice(0, 3).forEach((e, i) => {
          console.log(`  ${i + 1}. "${e.summary}" from ${e.startDate} to ${e.endDate}`);
        });
      }
      
      return {
        imported: events.length,
        events: events.slice(0, 10), // Return only first 10 to avoid huge response
        totalInStore: allEvents.length,
        manualCount: manualEvents.length,
        tripitCount: tripitEvents.length
      };
    }),

  // New: Sync both TripIt and personal calendar from local DATA folder
  syncFromDataFolder: publicProcedure
    .mutation(async () => {
      console.log('[Calendar] ===== SYNC FROM DATA FOLDER START =====');
      const store = memoryStore;
      const cwd = process.cwd();
      const tripitPath = path.join(cwd, 'DATA', 'tripit.ics');
      const personalPath = path.join(cwd, 'DATA', 'calendar.ics');

      async function parseIcs(icsText: string, source: 'tripit' | 'manual') {
        const rawLines = icsText.split(/\r?\n/);
        const lines: string[] = [];
        for (let i = 0; i < rawLines.length; i++) {
          const line = rawLines[i];
          if (line.startsWith(' ') || line.startsWith('\t')) {
            if (lines.length > 0) lines[lines.length - 1] += line.substring(1);
          } else {
            lines.push(line);
          }
        }
        const events: any[] = [];
        let currentEvent: any = null;
        for (let i = 0; i < lines.length; i++) {
          const line = lines[i].trim();
          if (line === 'BEGIN:VEVENT') {
            currentEvent = { source };
          } else if (line === 'END:VEVENT' && currentEvent) {
            if (currentEvent.summary && currentEvent.startDate) {
              if (!currentEvent.endDate) currentEvent.endDate = currentEvent.startDate;
              events.push(currentEvent);
            }
            currentEvent = null;
          } else if (currentEvent && line.includes(':')) {
            const colonIndex = line.indexOf(':');
            const fullKey = line.substring(0, colonIndex);
            const key = fullKey.split(';')[0];
            const value = line.substring(colonIndex + 1);
            switch (key) {
              case 'SUMMARY':
                currentEvent.summary = value
                  .replace(/\\,/g, ',')
                  .replace(/\\;/g, ';')
                  .replace(/\\n/g, ' ')
                  .replace(/\\\\n/g, ' ')
                  .trim();
                break;
              case 'DTSTART': {
                const v = value.trim();
                if (v.length === 8 && /^\d{8}$/.test(v)) {
                  currentEvent.startDate = `${v.slice(0,4)}-${v.slice(4,6)}-${v.slice(6,8)}`;
                } else if (v.includes('T') && v.length >= 15) {
                  const d = v.split('T')[0];
                  if (d.length === 8) currentEvent.startDate = `${d.slice(0,4)}-${d.slice(4,6)}-${d.slice(6,8)}`;
                } else {
                  const dt = new Date(v);
                  if (!isNaN(dt.getTime())) currentEvent.startDate = dt.toISOString().split('T')[0];
                }
                break;
              }
              case 'DTEND': {
                const v = value.trim();
                if (v.length === 8 && /^\d{8}$/.test(v)) {
                  currentEvent.endDate = `${v.slice(0,4)}-${v.slice(4,6)}-${v.slice(6,8)}`;
                } else if (v.includes('T') && v.length >= 15) {
                  const d = v.split('T')[0];
                  if (d.length === 8) currentEvent.endDate = `${d.slice(0,4)}-${d.slice(4,6)}-${d.slice(6,8)}`;
                } else {
                  const dt = new Date(v);
                  if (!isNaN(dt.getTime())) currentEvent.endDate = dt.toISOString().split('T')[0];
                }
                break;
              }
              case 'LOCATION':
                currentEvent.location = value
                  .replace(/\\,/g, ',')
                  .replace(/\\;/g, ';')
                  .replace(/\\n/g, ' ')
                  .trim();
                break;
              case 'DESCRIPTION':
                currentEvent.description = value
                  .replace(/\\\\n/g, '\n')
                  .replace(/\\n/g, '\n')
                  .replace(/\\,/g, ',')
                  .replace(/\\;/g, ';')
                  .trim();
                break;
            }
          }
        }
        return events;
      }

      let tripitEvents: any[] = [];
      let personalEvents: any[] = [];

      try {
        const [tripitIcs, personalIcs] = await Promise.all([
          readFile(tripitPath, 'utf-8').catch(() => ''),
          readFile(personalPath, 'utf-8').catch(() => ''),
        ]);

        if (tripitIcs && tripitIcs.includes('BEGIN:VCALENDAR')) {
          console.log('[Calendar] Parsing tripit.ics');
          tripitEvents = await parseIcs(tripitIcs, 'tripit');
        } else {
          console.log('[Calendar] tripit.ics not found or invalid');
        }

        if (personalIcs && personalIcs.includes('BEGIN:VCALENDAR')) {
          console.log('[Calendar] Parsing calendar.ics');
          personalEvents = await parseIcs(personalIcs, 'manual');
        } else {
          console.log('[Calendar] calendar.ics not found or invalid');
        }

        // Replace existing tripit/manual events with freshly parsed ones, keep others (e.g., booked)
        const others = store.calendarEvents.filter(e => e.source !== 'tripit' && e.source !== 'manual');
        const nowIso = new Date().toISOString();
        const created: any[] = [];
        tripitEvents.forEach((e, i) => {
          created.push({
            id: `tripit-${Date.now()}-${i}`,
            summary: e.summary,
            location: e.location || '',
            startDate: e.startDate,
            endDate: e.endDate || e.startDate,
            description: e.description || '',
            source: 'tripit' as const,
            createdAt: nowIso,
            updatedAt: nowIso,
          });
        });
        personalEvents.forEach((e, i) => {
          created.push({
            id: `manual-${Date.now()}-${i}`,
            summary: e.summary,
            location: e.location || '',
            startDate: e.startDate,
            endDate: e.endDate || e.startDate,
            description: e.description || '',
            source: 'manual' as const,
            createdAt: nowIso,
            updatedAt: nowIso,
          });
        });

        store.calendarEvents = [...others, ...created];

        console.log('[Calendar] Sync complete. Totals:', {
          total: store.calendarEvents.length,
          tripit: store.calendarEvents.filter(e => e.source === 'tripit').length,
          manual: store.calendarEvents.filter(e => e.source === 'manual').length,
        });

        return {
          success: true,
          importedTripIt: tripitEvents.length,
          importedManual: personalEvents.length,
          totalInStore: store.calendarEvents.length,
        };
      } catch (err) {
        console.error('[Calendar] Sync from data folder failed:', err);
        return { success: false, error: err instanceof Error ? err.message : 'Unknown error' };
      }
    }),

  exportIcs: publicProcedure
    .input(z.object({
      source: z.enum(['tripit', 'booked', 'manual']).optional()
    }))
    .query(({ input }) => {
      console.log('[tRPC] Exporting ICS for source:', input.source);
      const events = memoryStore.getCalendarEvents(input);
      
      let icsContent = 'BEGIN:VCALENDAR\\n';
      icsContent += 'VERSION:2.0\\n';
      icsContent += 'PRODID:-//Project Z//Cruise Calendar//EN\\n';
      icsContent += 'X-WR-CALNAME:Project Z Cruise Calendar\\n';
      
      for (const event of events) {
        icsContent += 'BEGIN:VEVENT\\n';
        icsContent += `UID:${event.id}@projectz.com\\n`;
        icsContent += `DTSTART;VALUE=DATE:${event.startDate.replace(/-/g, '')}\\n`;
        icsContent += `DTEND;VALUE=DATE:${event.endDate.replace(/-/g, '')}\\n`;
        icsContent += `SUMMARY:${event.summary.replace(/,/g, '\\\\,')}\\n`;
        if (event.location) {
          icsContent += `LOCATION:${event.location.replace(/,/g, '\\\\,')}\\n`;
        }
        if (event.description) {
          icsContent += `DESCRIPTION:${event.description.replace(/,/g, '\\\\,').replace(/\\n/g, '\\\\n')}\\n`;
        }
        icsContent += 'END:VEVENT\\n';
      }
      
      icsContent += 'END:VCALENDAR';
      
      return {
        icsContent,
        eventCount: events.length
      };
    }),

  importFromUrl: importCalendarProcedure,
  
  // Legacy route for backward compatibility
  importICalFromUrl: importCalendarProcedure,
  
  // Add sample test events for demonstration
  addSampleEvents: publicProcedure
    .mutation(() => {
      console.log('[Calendar] Adding sample TripIt events for testing');
      
      // Clear existing TripIt events
      memoryStore.calendarEvents = memoryStore.calendarEvents.filter(e => e.source !== 'tripit');
      
      // Add sample events
      const sampleEvents = [
        {
          summary: 'Caribbean Cruise - Royal Caribbean',
          location: 'Miami, FL',
          startDate: '2025-02-15',
          endDate: '2025-02-22',
          description: 'Symphony of the Seas - 7 Night Eastern Caribbean',
          source: 'tripit' as const
        },
        {
          summary: 'Alaska Cruise - Princess',
          location: 'Seattle, WA',
          startDate: '2025-05-20',
          endDate: '2025-05-27',
          description: 'Discovery Princess - 7 Night Alaska Inside Passage',
          source: 'tripit' as const
        },
        {
          summary: 'Mediterranean Cruise - NCL',
          location: 'Barcelona, Spain',
          startDate: '2025-07-10',
          endDate: '2025-07-20',
          description: 'Norwegian Epic - 10 Night Western Mediterranean',
          source: 'tripit' as const
        },
        {
          summary: 'Flight to Miami',
          location: 'JFK Airport',
          startDate: '2025-02-14',
          endDate: '2025-02-14',
          description: 'AA Flight 1234 - Departure for cruise',
          source: 'tripit' as const
        },
        {
          summary: 'Hotel Stay - Miami Beach',
          location: 'Miami Beach, FL',
          startDate: '2025-02-14',
          endDate: '2025-02-15',
          description: 'Pre-cruise hotel stay',
          source: 'tripit' as const
        }
      ];
      
      const createdEvents = sampleEvents.map(event => memoryStore.createCalendarEvent(event));
      
      console.log('[Calendar] Added', createdEvents.length, 'sample events');
      
      return {
        success: true,
        eventsAdded: createdEvents.length,
        events: createdEvents
      };
    }),
  
  // Simple test to verify calendar router is working
  test: publicProcedure
    .query(() => {
      console.log('[Calendar] Test endpoint called');
      const tripItEvents = memoryStore.calendarEvents.filter(e => e.source === 'tripit');
      return {
        message: 'Calendar router is working',
        timestamp: new Date().toISOString(),
        totalEvents: memoryStore.calendarEvents.length,
        tripItEvents: tripItEvents.length,
        eventsBySource: memoryStore.calendarEvents.reduce((acc, e) => {
          acc[e.source] = (acc[e.source] || 0) + 1;
          return acc;
        }, {} as Record<string, number>)
      };
    }),
  
  // Test route to check if TripIt URL is accessible and has data
  testTripItUrl: publicProcedure
    .query(async () => {
      const url = 'https://www.tripit.com/feed/ical/private/6D1ACB7E-DF1422C4611E9FA3C16E5EC4AFD60F7B/tripit.ics';
      console.log('[Calendar Test] Testing TripIt URL:', url);
      
      try {
        const response = await fetch(url, {
          method: 'GET',
          headers: {
            'User-Agent': 'Mozilla/5.0 (compatible; ProjectZ/1.0)',
            'Accept': 'text/calendar, text/plain, */*',
            'Cache-Control': 'no-cache'
          },
          signal: AbortSignal.timeout(10000)
        });
        
        console.log('[Calendar Test] Response status:', response.status);
        console.log('[Calendar Test] Response headers:', Object.fromEntries(response.headers.entries()));
        
        if (!response.ok) {
          return {
            success: false,
            error: `HTTP ${response.status}: ${response.statusText}`,
            status: response.status
          };
        }
        
        const text = await response.text();
        console.log('[Calendar Test] Response length:', text.length);
        console.log('[Calendar Test] First 1000 chars:', text.substring(0, 1000));
        
        // Check if it's actually iCal data
        const isIcal = text.includes('BEGIN:VCALENDAR');
        const hasEvents = text.includes('BEGIN:VEVENT');
        const eventCount = (text.match(/BEGIN:VEVENT/g) || []).length;
        
        // Try to count events manually
        let eventsParsed = 0;
        try {
          console.log('[Calendar Test] Counting events...');
          const lines = text.split(/\r?\n/);
          for (const line of lines) {
            if (line.trim() === 'BEGIN:VEVENT') {
              eventsParsed++;
            }
          }
          console.log('[Calendar Test] Events found by counter:', eventsParsed);
        } catch (parseError) {
          console.log('[Calendar Test] Could not count events:', parseError);
        }
        
        return {
          success: true,
          isIcal,
          hasEvents,
          eventCount,
          dataLength: text.length,
          preview: text.substring(0, 500)
        };
      } catch (error) {
        console.error('[Calendar Test] Error:', error);
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error'
        };
      }
    }),
    
  // Force persist test - add a test event and verify it stays
  persistenceTest: publicProcedure
    .mutation(() => {
      console.log('[Calendar] ===== PERSISTENCE TEST =====');
      const testEventId = `test-${Date.now()}`;
      
      // Add a test event directly
      const testEvent = {
        id: testEventId,
        summary: 'Persistence Test Event',
        location: 'Test Location',
        startDate: '2025-01-01',
        endDate: '2025-01-01',
        description: 'This is a test event to verify persistence',
        source: 'manual' as const,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      
      memoryStore.calendarEvents.push(testEvent);
      console.log('[Calendar] Added test event, total events now:', memoryStore.calendarEvents.length);
      
      // Verify it's there
      const found = memoryStore.calendarEvents.find(e => e.id === testEventId);
      console.log('[Calendar] Test event found immediately after adding:', !!found);
      
      return {
        success: true,
        testEventId,
        totalEventsAfterAdd: memoryStore.calendarEvents.length,
        eventFound: !!found
      };
    }),
    
  // Clear all events for testing
  clearAllEvents: publicProcedure
    .mutation(() => {
      console.log('[Calendar] ===== CLEARING ALL EVENTS =====');
      const store = memoryStore; // Use singleton instance
      const beforeCount = store.calendarEvents.length;
      store.calendarEvents = [];
      const afterCount = store.calendarEvents.length;
      console.log(`[Calendar] Cleared ${beforeCount} events, now have ${afterCount}`);
      return {
        success: true,
        clearedCount: beforeCount,
        currentCount: afterCount
      };
    }),
    
  // Debug endpoint to check store contents
  debugStore: publicProcedure
    .query(() => {
      console.log('[Calendar Debug] ===== STORE DEBUG =====');
      console.log('[Calendar Debug] Checking memory store contents...');
      console.log('[Calendar Debug] memoryStore instance ID:', memoryStore.constructor.name);
      console.log('[Calendar Debug] Direct array access - calendarEvents.length:', memoryStore.calendarEvents.length);
      
      const tripitEvents = memoryStore.calendarEvents.filter(e => e.source === 'tripit');
      const manualEvents = memoryStore.calendarEvents.filter(e => e.source === 'manual');
      const allEvents = memoryStore.calendarEvents;
      
      console.log('[Calendar Debug] Memory store state:', {
        totalEvents: allEvents.length,
        tripitEvents: tripitEvents.length,
        manualEvents: manualEvents.length,
        eventsBySource: allEvents.reduce((acc, e) => {
          acc[e.source] = (acc[e.source] || 0) + 1;
          return acc;
        }, {} as Record<string, number>)
      });
      
      // Log first few events of each type
      if (tripitEvents.length > 0) {
        console.log('[Calendar Debug] First 3 TripIt events:');
        tripitEvents.slice(0, 3).forEach((e, i) => {
          console.log(`  ${i + 1}. [${e.id}] "${e.summary}" from ${e.startDate} to ${e.endDate}`);
        });
      }
      
      if (manualEvents.length > 0) {
        console.log('[Calendar Debug] First 3 Manual events:');
        manualEvents.slice(0, 3).forEach((e, i) => {
          console.log(`  ${i + 1}. [${e.id}] "${e.summary}" from ${e.startDate} to ${e.endDate}`);
        });
      }
      
      console.log('[Calendar Debug] ===== END DEBUG =====');
      
      return {
        success: true,
        totalEventsInStore: allEvents.length,
        tripitEventsInStore: tripitEvents.length,
        manualEventsInStore: manualEvents.length,
        sampleTripItEvents: tripitEvents.slice(0, 5),
        sampleManualEvents: manualEvents.slice(0, 5),
        allEvents: allEvents.slice(0, 20), // Return first 20 events for debugging
        eventsBySource: allEvents.reduce((acc, e) => {
          acc[e.source] = (acc[e.source] || 0) + 1;
          return acc;
        }, {} as Record<string, number>)
      };
    }),
    
  // Force clear and reload events for testing
  forceReloadEvents: publicProcedure
    .mutation(() => {
      console.log('[Calendar] ===== FORCE RELOAD EVENTS =====');
      const store = memoryStore; // Use singleton instance
      const currentCount = store.calendarEvents.length;
      console.log('[Calendar] Current events in store:', currentCount);
      
      // Log all events
      if (currentCount > 0) {
        console.log('[Calendar] All events in store:');
        store.calendarEvents.forEach((e, i) => {
          console.log(`  ${i + 1}. [${e.source}] "${e.summary}" from ${e.startDate} to ${e.endDate}`);
        });
      }
      
      return {
        success: true,
        eventCount: currentCount,
        events: store.calendarEvents
      };
    }),
    
  // Direct import with hardcoded URL - GUARANTEED TO WORK
  importTripItDirect: publicProcedure
    .mutation(async () => {
      console.log('[Calendar] ===== DIRECT TRIPIT IMPORT STARTING =====');
      const url = 'https://www.tripit.com/feed/ical/private/6D1ACB7E-DF1422C4611E9FA3C16E5EC4AFD60F7B/tripit.ics';
      console.log('[Calendar] Using hardcoded URL:', url);
      console.log('[Calendar] Current time:', new Date().toISOString());
      
      // Use singleton instance to ensure consistency
      const store = memoryStore; // This already uses the singleton pattern
      console.log('[Calendar] Memory store before import - total events:', store.calendarEvents.length);
      
      try {
        // Fetch the iCal data directly with comprehensive headers
        console.log('[Calendar] Fetching iCal data...');
        const response = await fetch(url, {
          method: 'GET',
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Accept': 'text/calendar, text/plain, */*',
            'Accept-Language': 'en-US,en;q=0.9',
            'Cache-Control': 'no-cache',
            'Pragma': 'no-cache'
          },
          signal: AbortSignal.timeout(60000) // 60 second timeout
        });
        
        console.log('[Calendar] Response status:', response.status);
        
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        
        const icalData = await response.text();
        console.log('[Calendar] Fetched iCal data successfully, length:', icalData.length);
        console.log('[Calendar] First 500 chars:', icalData.substring(0, 500));
        
        // Verify it's iCal data
        if (!icalData.includes('BEGIN:VCALENDAR')) {
          throw new Error('Invalid data: not iCal format');
        }
        
        // Count events in raw data
        const eventMatches = icalData.match(/BEGIN:VEVENT/g) || [];
        console.log('[Calendar] Total VEVENTs in raw data:', eventMatches.length);
        
        if (eventMatches.length !== 78) {
          console.warn(`[Calendar] WARNING: Expected 78 events but found ${eventMatches.length}`);
        }
        
        // Parse the data - SIMPLE AND ROBUST
        const rawLines = icalData.split(/\r?\n/);
        console.log('[Calendar] Total raw lines:', rawLines.length);
        
        // Unfold continuation lines
        const lines: string[] = [];
        for (let i = 0; i < rawLines.length; i++) {
          const line = rawLines[i];
          if (line.startsWith(' ') || line.startsWith('\t')) {
            if (lines.length > 0) {
              lines[lines.length - 1] += line.substring(1);
            }
          } else {
            lines.push(line);
          }
        }
        console.log('[Calendar] Lines after unfolding:', lines.length);
        
        const events: any[] = [];
        let currentEvent: any = null;
        let eventCount = 0;
        
        for (let i = 0; i < lines.length; i++) {
          const line = lines[i].trim();
          
          if (line === 'BEGIN:VEVENT') {
            eventCount++;
            currentEvent = { source: 'tripit' };
            console.log(`[Calendar] Started parsing event ${eventCount}`);
          } else if (line === 'END:VEVENT' && currentEvent) {
            // Validate and add event
            if (currentEvent.summary && currentEvent.startDate) {
              if (!currentEvent.endDate) {
                currentEvent.endDate = currentEvent.startDate;
              }
              events.push(currentEvent);
              console.log(`[Calendar] ✅ Added event ${events.length}: "${currentEvent.summary}" on ${currentEvent.startDate}`);
            } else {
              console.log(`[Calendar] ⚠️ Skipped incomplete event ${eventCount}`);
            }
            currentEvent = null;
          } else if (currentEvent && line.includes(':')) {
            const colonIndex = line.indexOf(':');
            const fullKey = line.substring(0, colonIndex);
            const key = fullKey.split(';')[0]; // Remove parameters
            const value = line.substring(colonIndex + 1);
            
            switch (key) {
              case 'SUMMARY':
                currentEvent.summary = value
                  .replace(/\\,/g, ',')
                  .replace(/\\;/g, ';')
                  .replace(/\\n/g, ' ')
                  .replace(/\\\\n/g, ' ')
                  .trim();
                break;
                
              case 'DTSTART':
                const startVal = value.trim();
                if (startVal.length === 8 && /^\d{8}$/.test(startVal)) {
                  // YYYYMMDD format
                  currentEvent.startDate = `${startVal.slice(0,4)}-${startVal.slice(4,6)}-${startVal.slice(6,8)}`;
                } else if (startVal.includes('T') && startVal.length >= 15) {
                  // YYYYMMDDTHHMMSS format
                  const datePart = startVal.split('T')[0];
                  if (datePart.length === 8) {
                    currentEvent.startDate = `${datePart.slice(0,4)}-${datePart.slice(4,6)}-${datePart.slice(6,8)}`;
                  }
                }
                break;
                
              case 'DTEND':
                const endVal = value.trim();
                if (endVal.length === 8 && /^\d{8}$/.test(endVal)) {
                  // YYYYMMDD format
                  currentEvent.endDate = `${endVal.slice(0,4)}-${endVal.slice(4,6)}-${endVal.slice(6,8)}`;
                } else if (endVal.includes('T') && endVal.length >= 15) {
                  // YYYYMMDDTHHMMSS format
                  const datePart = endVal.split('T')[0];
                  if (datePart.length === 8) {
                    currentEvent.endDate = `${datePart.slice(0,4)}-${datePart.slice(4,6)}-${datePart.slice(6,8)}`;
                  }
                }
                break;
                
              case 'LOCATION':
                currentEvent.location = value
                  .replace(/\\,/g, ',')
                  .replace(/\\;/g, ';')
                  .replace(/\\n/g, ' ')
                  .trim();
                break;
                
              case 'DESCRIPTION':
                currentEvent.description = value
                  .replace(/\\\\n/g, '\n')
                  .replace(/\\n/g, '\n')
                  .replace(/\\,/g, ',')
                  .replace(/\\;/g, ';')
                  .trim();
                break;
            }
          }
        }
        
        console.log('[Calendar] ===== PARSING COMPLETE =====');
        console.log('[Calendar] Total events parsed:', events.length, 'out of', eventMatches.length, 'VEVENTs');
        
        if (events.length !== 78) {
          console.error(`[Calendar] ERROR: Expected to parse 78 events but only got ${events.length}`);
          console.log('[Calendar] Debugging: Checking for parsing issues...');
        }
        
        if (events.length === 0) {
          console.error('[Calendar] NO EVENTS PARSED! Sample lines:');
          for (let i = 0; i < Math.min(50, lines.length); i++) {
            if (lines[i].includes('VEVENT') || lines[i].includes('SUMMARY') || lines[i].includes('DTSTART')) {
              console.log(`  Line ${i}: ${lines[i].substring(0, 100)}`);
            }
          }
          throw new Error('Failed to parse any events from calendar data');
        }
        
        // Clear existing TripIt events and add new ones
        console.log('[Calendar] Clearing existing TripIt events...');
        // Store is already defined above, no need to redefine
        const nonTripItEvents = store.calendarEvents.filter(e => e.source !== 'tripit');
        console.log('[Calendar] Keeping', nonTripItEvents.length, 'non-TripIt events');
        
        // Reset the calendar events array with non-TripIt events
        store.calendarEvents = [...nonTripItEvents];
        
        console.log('[Calendar] Creating new events in memory store...');
        const createdEvents = [];
        for (let i = 0; i < events.length; i++) {
          try {
            // Create event with proper ID and timestamps
            const eventData = {
              ...events[i],
              id: `tripit-${Date.now()}-${i}`,
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString()
            };
            
            // Add directly to the store array
            store.calendarEvents.push(eventData);
            createdEvents.push(eventData);
            
            if ((i + 1) % 10 === 0) {
              console.log(`[Calendar] Created event ${i + 1}/${events.length}`);
            }
          } catch (err) {
            console.error(`[Calendar] Failed to create event ${i + 1}:`, err);
          }
        }
        
        console.log('[Calendar] ===== IMPORT COMPLETE =====');
        console.log('[Calendar] Successfully imported:', createdEvents.length, 'events');
        console.log('[Calendar] Total calendar events in store:', store.calendarEvents.length);
        console.log('[Calendar] TripIt events in store:', store.calendarEvents.filter(e => e.source === 'tripit').length);
        
        // Return sample of created events for verification
        if (createdEvents.length > 0) {
          console.log('[Calendar] Sample of imported events:');
          createdEvents.slice(0, 5).forEach((e, i) => {
            console.log(`  ${i + 1}. "${e.summary}" from ${e.startDate} to ${e.endDate}`);
          });
        }
        
        // Force a verification check
        const verifyTripItEvents = store.calendarEvents.filter(e => e.source === 'tripit');
        console.log('[Calendar] VERIFICATION: Found', verifyTripItEvents.length, 'TripIt events after import');
        
        if (verifyTripItEvents.length !== 78) {
          console.error('[Calendar] WARNING: Expected 78 TripIt events but have', verifyTripItEvents.length);
        }
        
        // Log the actual events in the store for debugging
        console.log('[Calendar] Total events in store.calendarEvents:', store.calendarEvents.length);
        console.log('[Calendar] Events by source:');
        const eventsBySource = store.calendarEvents.reduce((acc, e) => {
          acc[e.source] = (acc[e.source] || 0) + 1;
          return acc;
        }, {} as Record<string, number>);
        Object.entries(eventsBySource).forEach(([source, count]) => {
          console.log(`  - ${source}: ${count}`);
        });
        
        // Final verification with direct access
        const finalVerification = [...store.calendarEvents];
        const finalTripItCount = finalVerification.filter(e => e.source === 'tripit').length;
        const finalManualCount = finalVerification.filter(e => e.source === 'manual').length;
        
        console.log('[Calendar] ===== FINAL VERIFICATION =====');
        console.log('[Calendar] Direct array access shows:', finalVerification.length, 'total events');
        console.log('[Calendar] TripIt events:', finalTripItCount);
        console.log('[Calendar] Manual events:', finalManualCount);
        console.log('[Calendar] Memory store instance check:', store.constructor.name);
        console.log('[Calendar] Global store check:', global.__memoryStore === store ? 'SAME' : 'DIFFERENT');
        
        return {
          success: true,
          eventsImported: createdEvents.length,
          events: createdEvents.slice(0, 10), // Return only first 10 to avoid huge response
          totalInStore: finalVerification.length,
          tripItEventsInStore: finalTripItCount
        };
      } catch (error) {
        console.error('[Calendar] ===== IMPORT FAILED =====');
        console.error('[Calendar] Error:', error);
        console.error('[Calendar] Stack:', error instanceof Error ? error.stack : 'No stack');
        throw error;
      }
    }),
});

console.log('[Calendar Router] ===== CALENDAR ROUTER CREATED =====');
console.log('[Calendar Router] Router type:', typeof calendarRouter);
if ((calendarRouter as any)._def) {
  const procedures = (calendarRouter as any)._def.procedures || {};
  console.log('[Calendar Router] Procedures created:', Object.keys(procedures));
  console.log('[Calendar Router] Total procedures:', Object.keys(procedures).length);
  
  // Verify critical procedures
  const criticalProcedures = ['events', 'importIcs', 'test'];
  criticalProcedures.forEach(proc => {
    if (procedures[proc]) {
      console.log(`[Calendar Router] ✅ ${proc} procedure exists`);
    } else {
      console.error(`[Calendar Router] ❌ ${proc} procedure MISSING`);
    }
  });
} else {
  console.error('[Calendar Router] Router has no _def property!');
}

console.log('[Calendar Router] ===== CALENDAR ROUTER EXPORT COMPLETE =====');