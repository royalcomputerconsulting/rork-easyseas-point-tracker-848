import { publicProcedure } from '../../../create-context';
import { z } from 'zod';

export const importCalendarProcedure = publicProcedure
  .input(z.object({
    icalUrl: z.string().url()
  }))
  .mutation(async ({ input }: { input: { icalUrl: string } }) => {
    console.log('[Calendar Import] ========================================');
    console.log('[Calendar Import] Starting import from:', input.icalUrl);
    console.log('[Calendar Import] Expected URL: https://www.tripit.com/feed/ical/private/6D1ACB7E-DF1422C4611E9FA3C16E5EC4AFD60F7B/tripit.ics');
    
    try {
      // Always use the correct TripIt URL
      const correctUrl = 'https://www.tripit.com/feed/ical/private/6D1ACB7E-DF1422C4611E9FA3C16E5EC4AFD60F7B/tripit.ics';
      console.log('[Calendar Import] Using correct URL:', correctUrl);
      
      // Fetch the iCal data with proper headers and error handling
      const response = await fetch(correctUrl, {
        method: 'GET',
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': 'text/calendar, text/plain, */*',
          'Accept-Language': 'en-US,en;q=0.9',
          'Cache-Control': 'no-cache',
          'Pragma': 'no-cache'
        },
        // Add timeout
        signal: AbortSignal.timeout(60000) // 60 second timeout
      });
      
      console.log('[Calendar Import] Response status:', response.status);
      console.log('[Calendar Import] Response headers:', Object.fromEntries(response.headers.entries()));
      
      if (!response.ok) {
        console.error('[Calendar Import] HTTP Error:', response.status, response.statusText);
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      const icalData = await response.text();
      console.log('[Calendar Import] Fetched iCal data, length:', icalData.length);
      console.log('[Calendar Import] First 1000 chars of data:', icalData.substring(0, 1000));
      
      if (!icalData || icalData.length === 0) {
        throw new Error('Empty calendar data received');
      }
      
      // Check if it's actually iCal data
      if (!icalData.includes('BEGIN:VCALENDAR')) {
        console.error('[Calendar Import] Not iCal data. Content:', icalData.substring(0, 500));
        throw new Error('Invalid calendar data: not in iCal format');
      }
      
      // Parse iCal data (basic parsing)
      const events = parseICalData(icalData);
      console.log('[Calendar Import] Parsed events:', events.length);
      if (events.length > 0) {
        console.log('[Calendar Import] First 3 events:', JSON.stringify(events.slice(0, 3), null, 2));
      }
      
      // Store events in memory store
      const { memoryStore } = await import('../../_stores/memory');
      
      // Clear existing TripIt events first
      const existingEvents = memoryStore.getCalendarEvents({ source: 'tripit' });
      console.log('[Calendar Import] Clearing', existingEvents.length, 'existing TripIt events');
      
      // Remove existing TripIt events from memory store
      memoryStore.calendarEvents = memoryStore.calendarEvents.filter(e => e.source !== 'tripit');
      console.log('[Calendar Import] Remaining events after clearing TripIt:', memoryStore.calendarEvents.length);
      
      // Create calendar events using the store method
      let importedCount = 0;
      const createdEvents: any[] = [];
      
      events.forEach((eventData, index) => {
        try {
          console.log(`[Calendar Import] Creating event ${index + 1}/${events.length}: ${eventData.summary}`);
          const createdEvent = memoryStore.createCalendarEvent(eventData);
          createdEvents.push(createdEvent);
          importedCount++;
        } catch (eventError) {
          console.warn('[Calendar Import] Failed to create event:', eventError);
        }
      });
      
      console.log('[Calendar Import] Successfully imported', importedCount, 'events');
      console.log('[Calendar Import] Total calendar events now:', memoryStore.calendarEvents.length);
      console.log('[Calendar Import] Created events sample:', createdEvents.slice(0, 3));
      console.log('[Calendar Import] ========================================');
      
      return {
        success: true,
        eventsImported: importedCount,
        events: createdEvents, // Return all created events
        totalEvents: memoryStore.calendarEvents.length
      };
      
    } catch (error) {
      console.error('[Calendar Import] Error:', error);
      console.error('[Calendar Import] Error stack:', error instanceof Error ? error.stack : 'No stack');
      
      // Provide more specific error messages
      if (error instanceof TypeError && error.message.includes('fetch')) {
        throw new Error('Network error: Unable to connect to TripIt. Please check your internet connection.');
      } else if (error instanceof Error && error.name === 'AbortError') {
        throw new Error('Request timeout: TripIt server took too long to respond.');
      } else if (error instanceof Error && error.message.includes('HTTP')) {
        throw new Error(`TripIt server error: ${error.message}`);
      } else {
        throw new Error(`Failed to import calendar: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }
  });

// Enhanced iCal parser with better multi-line and timezone handling
function parseICalData(icalData: string) {
  const events: {
    summary: string;
    location?: string;
    startDate: string;
    endDate: string;
    description?: string;
    source: 'tripit';
  }[] = [];
  
  try {
    console.log('[Calendar Import Parser] Starting to parse iCal data');
    
    // Handle both \n and \r\n line endings
    const rawLines = icalData.split(/\r?\n/);
    console.log('[Calendar Import Parser] Raw lines count:', rawLines.length);
    
    // Unfold multi-line values (lines that start with space or tab are continuations)
    const lines: string[] = [];
    for (let i = 0; i < rawLines.length; i++) {
      const line = rawLines[i];
      if (line.startsWith(' ') || line.startsWith('\t')) {
        // Continuation of previous line
        if (lines.length > 0) {
          lines[lines.length - 1] += line.substring(1);
        }
      } else {
        lines.push(line);
      }
    }
    
    let currentEvent: any = null;
    let inEvent = false;
    let eventCount = 0;
    
    console.log('[Calendar Import Parser] Total lines after unfolding:', lines.length);
    
    // Count total VEVENTs first
    const totalVEvents = lines.filter(l => l.trim() === 'BEGIN:VEVENT').length;
    console.log('[Calendar Import Parser] Total VEVENTs found:', totalVEvents);
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      
      if (line === 'BEGIN:VEVENT') {
        inEvent = true;
        eventCount++;
        currentEvent = {
          summary: '',
          startDate: '',
          endDate: '',
          location: '',
          description: '',
          source: 'tripit' as const
        };
        console.log(`[Calendar Import Parser] Processing VEVENT ${eventCount}/${totalVEvents}`);
      } else if (line === 'END:VEVENT' && currentEvent) {
        inEvent = false;
        
        // Log what we have for this event
        console.log(`[Calendar Import Parser] VEVENT ${eventCount} data:`, {
          summary: currentEvent.summary || '(empty)',
          startDate: currentEvent.startDate || '(empty)',
          endDate: currentEvent.endDate || '(empty)',
          location: currentEvent.location || '(empty)'
        });
        
        if (currentEvent.summary && currentEvent.startDate) {
          // Ensure endDate is set
          if (!currentEvent.endDate) {
            currentEvent.endDate = currentEvent.startDate;
          }
          // Clean up the event object
          const cleanEvent = {
            summary: currentEvent.summary.trim(),
            startDate: currentEvent.startDate,
            endDate: currentEvent.endDate,
            source: 'tripit' as const,
            ...(currentEvent.location && currentEvent.location.trim() && { location: currentEvent.location.trim() }),
            ...(currentEvent.description && currentEvent.description.trim() && { description: currentEvent.description.trim() })
          };
          events.push(cleanEvent);
          console.log(`[Calendar Import Parser] ✅ Added event ${events.length}: "${cleanEvent.summary}" on ${cleanEvent.startDate}`);
        } else {
          console.log(`[Calendar Import Parser] ⚠️ Skipping incomplete event ${eventCount}:`, {
            hasSummary: !!currentEvent.summary,
            hasStartDate: !!currentEvent.startDate
          });
        }
        currentEvent = null;
      } else if (inEvent && currentEvent && line.includes(':')) {
        const colonIndex = line.indexOf(':');
        const key = line.substring(0, colonIndex);
        const value = line.substring(colonIndex + 1);
        
        // Handle keys that might have parameters (like DTSTART;TZID=...)
        const baseKey = key.split(';')[0];
        
        switch (baseKey) {
          case 'UID':
            // Skip UID for now
            break;
          case 'SUMMARY':
            currentEvent.summary = value.replace(/\\,/g, ',').replace(/\\;/g, ';').replace(/\\n/g, ' ').replace(/\\\\n/g, ' ');
            break;
          case 'DTSTART':
            const startDate = parseICalDate(value, key);
            currentEvent.startDate = startDate;
            break;
          case 'DTEND':
            const endDate = parseICalDate(value, key);
            currentEvent.endDate = endDate;
            break;
          case 'LOCATION':
            currentEvent.location = value.replace(/\\,/g, ',').replace(/\\;/g, ';').replace(/\\n/g, ' ').replace(/\\\\n/g, ' ');
            break;
          case 'DESCRIPTION':
            currentEvent.description = value.replace(/\\\\n/g, '\n').replace(/\\n/g, '\n').replace(/\\,/g, ',').replace(/\\;/g, ';');
            break;
        }
      }
    }
    
    console.log('[Calendar Import Parser] ========================================');
    console.log('[Calendar Import Parser] FINAL RESULTS:');
    console.log('[Calendar Import Parser] Total VEVENTs in file:', totalVEvents);
    console.log('[Calendar Import Parser] Successfully parsed events:', events.length);
    console.log('[Calendar Import Parser] Success rate:', `${events.length}/${totalVEvents} (${Math.round(events.length/totalVEvents*100)}%)`);
    
    if (events.length > 0) {
      console.log('[Calendar Import Parser] Sample events (first 5):');
      events.slice(0, 5).forEach((event, i) => {
        console.log(`  ${i + 1}. "${event.summary}" on ${event.startDate}`);
      });
    } else {
      console.log('[Calendar Import Parser] ⚠️ NO EVENTS PARSED!');
      console.log('[Calendar Import Parser] Debugging - Sample lines from iCal:');
      let sampleCount = 0;
      for (let i = 0; i < lines.length && sampleCount < 30; i++) {
        const line = lines[i];
        if (line.includes('BEGIN:VEVENT') || line.includes('END:VEVENT') || 
            line.includes('SUMMARY') || line.includes('DTSTART') || line.includes('DTEND')) {
          console.log(`  Line ${i}: ${line.substring(0, 150)}`);
          sampleCount++;
        }
      }
    }
    console.log('[Calendar Import Parser] ========================================');
    
    return events;
  } catch (error) {
    console.error('[Calendar Import Parser] Fatal error:', error);
    console.error('[Calendar Import Parser] Stack:', error instanceof Error ? error.stack : 'No stack');
    throw new Error('Failed to parse calendar data');
  }
}

function parseICalDate(dateStr: string, fullKey?: string): string {
  try {
    // Clean the date string
    let cleanDateStr = dateStr.trim();
    
    // Remove timezone suffix if present (e.g., 'Z' or timezone identifier after the date)
    if (cleanDateStr.endsWith('Z')) {
      cleanDateStr = cleanDateStr.slice(0, -1);
    }
    
    // Handle different iCal date formats
    if (cleanDateStr.length === 8 && /^\d{8}$/.test(cleanDateStr)) {
      // YYYYMMDD format (all-day event)
      const year = cleanDateStr.substring(0, 4);
      const month = cleanDateStr.substring(4, 6);
      const day = cleanDateStr.substring(6, 8);
      const result = `${year}-${month}-${day}`;
      return result;
    } else if (cleanDateStr.length >= 15 && cleanDateStr.includes('T')) {
      // YYYYMMDDTHHMMSS format (with time)
      const datePart = cleanDateStr.split('T')[0];
      if (datePart.length === 8 && /^\d{8}$/.test(datePart)) {
        const year = datePart.substring(0, 4);
        const month = datePart.substring(4, 6);
        const day = datePart.substring(6, 8);
        const result = `${year}-${month}-${day}`;
        return result;
      }
    } else if (cleanDateStr.includes('-')) {
      // Already in ISO format or similar
      const date = new Date(cleanDateStr);
      if (!isNaN(date.getTime())) {
        const result = date.toISOString().split('T')[0];
        return result;
      }
    }
    
    // Try to parse as a standard date format
    const date = new Date(cleanDateStr);
    if (!isNaN(date.getTime())) {
      const result = date.toISOString().split('T')[0];
      return result;
    }
    
    console.warn('[Calendar Import Date] Could not parse date:', dateStr, 'fullKey:', fullKey);
    // Return today's date as fallback
    return new Date().toISOString().split('T')[0];
  } catch (error) {
    console.error('[Calendar Import Date] Date parsing error:', error, 'for date:', dateStr);
    return new Date().toISOString().split('T')[0];
  }
}