import { z } from 'zod';
import { publicProcedure, createTRPCRouter } from '../../create-context';
import { memoryStore } from '../_stores/memory';

export const importRouter = createTRPCRouter({
  clearBackendData: publicProcedure
    .mutation(async () => {
      console.log('[Import] Clearing backend data...');
      try {
        await memoryStore.clearAllData();
        console.log('[Import] ✅ Backend data cleared successfully');
        return {
          success: true,
          message: 'Backend data cleared successfully'
        };
      } catch (error) {
        console.error('[Import] ❌ Failed to clear backend data:', error);
        return {
          success: false,
          message: error instanceof Error ? error.message : 'Failed to clear backend data'
        };
      }
    }),
  
  importIcsFile: publicProcedure
    .input(z.object({
      icsContent: z.string()
    }))
    .mutation(({ input }) => {
      console.log('[Import] Processing ICS file import');
      console.log('[Import] ICS content length:', input.icsContent.length);
      
      // Send to calendar router for processing
      // Import calendar processing directly to avoid require() issues
      const icalData = input.icsContent;
      const events = parseICalData(icalData);
      
      // Clear existing calendar events and add new ones
      memoryStore.calendarEvents = memoryStore.calendarEvents.filter(e => e.source !== 'tripit');
      events.forEach(event => memoryStore.createCalendarEvent(event));
      
      const result = {
        success: true,
        eventsImported: events.length,
        message: `Successfully imported ${events.length} calendar events`
      };
      
      console.log('[Import] ICS import result:', result);
      return result;
    }),
  
  parsePreview: publicProcedure
    .input(z.object({
      csvContent: z.string(),
      sheetType: z.enum(['cruises', 'booked', 'casino_offers', 'calendar'])
    }))
    .mutation(({ input }) => {
      console.log('[tRPC] Parsing CSV preview for sheet type:', input.sheetType);
      
      const lines = input.csvContent.trim().split('\n');
      if (lines.length === 0) {
        throw new Error('Empty CSV content');
      }
      
      const headers = lines[0].split(',').map(h => h.trim().replace(/"/g, ''));
      const rows = lines.slice(1, 51).map(line => // Preview first 50 rows
        line.split(',').map(cell => cell.trim().replace(/"/g, ''))
      );
      
      // Auto-detect mappings based on sheet type
      let detectedMappings: Record<string, string> = {};
      const validationErrors: { row: number; field: string; message: string }[] = [];
      
      switch (input.sheetType) {
        case 'cruises':
          detectedMappings = {
            'Sailing Date': 'departureDate',
            'Ship Name': 'ship',
            'Departure Port': 'departurePort',
            'Itinerary': 'itineraryName',
            'Nights': 'nights',
            'Cabin Type': 'cabinType',
            'CASINO OVERVIEW OFFER TYPE': 'casinoOfferType',
            'Offer Name': 'offerName',
            'Offer Code': 'offerCode',
            'OFFER EXPIRE DATE': 'offerExpirationDate',
            'Type of Offer': 'typeOfOffer',
            'Value': 'value'
          };
          break;
          
        case 'booked':
          detectedMappings = {
            'Ship': 'ship',
            'Start Date': 'startDate',
            'End Date': 'endDate',
            'Nights': 'nights',
            'Itinerary Name': 'itineraryName',
            'Departure Port': 'departurePort',
            'Ports/Route': 'portsRoute',
            'Reservation #': 'reservationNumber',
            'Guests': 'guests',
            'Days to Go': 'daysToGo'
          };
          break;
          
        case 'casino_offers':
          // Support both OLD 7-column format and NEW 20-column format
          // Check if this is the NEW 20-column format by looking for cruise-specific columns
          const has20ColumnFormat = headers.some(h => 
            h === 'Ship Name' || h === 'Sailing Date' || h === 'Itinerary'
          );
          
          detectedMappings = {
            // OLD 7-column format (from offers.xlsx)
            'NAME': 'name',
            'REWARD NUMBER': 'rewardNumber',
            'OFFER NAME': 'offerName',
            'OFFER TYPE': 'offerType',
            'EXPIRES': 'expires',
            'OFFER CODE': 'offerCode',
            'TRADE IN VALUE': 'tradeInValue',
            // Also support lowercase variants
            'Name': 'name',
            'Reward Number': 'rewardNumber',
            'Offer Name': 'offerName',
            'Offer Type': 'offerType',
            'Expires': 'expires',
            'Offer Code': 'offerCode',
            'Trade In Value': 'tradeInValue',
            // NEW 20-column format (from offers.csv) - Cruise fields
            'Ship Name': 'shipName',
            'Sailing Date': 'sailingDate',
            'Itinerary': 'itinerary',
            'Room Type': 'roomType',
            'Guests Info': 'guestsInfo',
            'GuestsInfo': 'guestsInfo',
            'Perks': 'perks',
            'Ship Class': 'shipClass',
            'Trade-In Value': 'tradeInValue',
            'Offer Expiry Date': 'offerExpiryDate',
            'Price Interior': 'priceInterior',
            'Price Ocean View': 'priceOceanView',
            'Price Balcony': 'priceBalcony',
            'Price Suite': 'priceSuite',
            'Taxes & Fees': 'taxesAndFees',
            'Ports & Times': 'portsAndTimes',
            'Offer Type / Category': 'offerCategory',
            'Offer Type': 'offerCategory',
            'Nights': 'nights',
            'Departure Port': 'departurePort'
          };
          
          // If 20-column format, also count cruises
          if (has20ColumnFormat) {
            console.log('[Import] Detected 20-column format - will extract both cruises and offers');
          }
          break;
          
        case 'calendar':
          // ICS content doesn't use CSV mapping
          break;
      }
      
      // Basic validation
      rows.forEach((row, index) => {
        if (input.sheetType === 'cruises') {
          const sailingDateIndex = headers.findIndex(h => detectedMappings[h] === 'departureDate');
          if (sailingDateIndex >= 0 && row[sailingDateIndex]) {
            const dateStr = row[sailingDateIndex];
            const date = new Date(dateStr);
            if (isNaN(date.getTime())) {
              validationErrors.push({
                row: index + 2, // +2 because we skip header and use 1-based indexing
                field: 'departureDate',
                message: `Invalid date format: ${dateStr}`
              });
            }
          }
        }
        
        // Skip offer code validation since they are just text codes
      });
      
      // For 20-column format, also extract unique cruises
      let uniqueCruises = 0;
      if (input.sheetType === 'casino_offers') {
        const has20ColumnFormat = headers.some(h => 
          h === 'Ship Name' || h === 'Sailing Date' || h === 'Itinerary'
        );
        
        if (has20ColumnFormat) {
          // CRITICAL FIX: Need to check ALL data rows, not just preview rows
          // Parse all lines to get accurate count
          const allLines = input.csvContent.trim().split('\n');
          const allDataRows = allLines.slice(1); // Skip header
          
          const shipNameIdx = headers.findIndex(h => h === 'Ship Name');
          const sailingDateIdx = headers.findIndex(h => h === 'Sailing Date');
          const itineraryIdx = headers.findIndex(h => h === 'Itinerary');
          
          const cruiseSet = new Set<string>();
          
          console.log(`[Import] Scanning ${allDataRows.length} rows for unique cruises...`);
          console.log(`[Import] Column indexes - Ship: ${shipNameIdx}, Date: ${sailingDateIdx}, Itinerary: ${itineraryIdx}`);
          
          allDataRows.forEach((line, idx) => {
            if (!line.trim()) return; // Skip empty lines
            
            // Parse CSV properly - handle quoted values
            const row = line.match(/(?:^|,)("(?:[^"]|"")*"|[^,]*)/g)?.map(cell => 
              cell.replace(/^,/, '').replace(/^"|"$/g, '').replace(/""/g, '"').trim()
            ) || [];
            
            const ship = shipNameIdx >= 0 ? row[shipNameIdx] : '';
            const date = sailingDateIdx >= 0 ? row[sailingDateIdx] : '';
            const itinerary = itineraryIdx >= 0 ? row[itineraryIdx] : '';
            
            if (ship && date) {
              const key = `${ship}|${date}|${itinerary}`;
              cruiseSet.add(key);
              
              // Log first few for debugging
              if (idx < 5) {
                console.log(`[Import] Row ${idx + 1}: Ship="${ship}" | Date="${date}" | Itinerary="${itinerary}"`);
              }
            } else if (idx < 5) {
              console.log(`[Import] Row ${idx + 1}: SKIPPED - missing ship or date`);
            }
          });
          
          uniqueCruises = cruiseSet.size;
          console.log('[Import] Found', uniqueCruises, 'unique cruises in 20-column format from', allDataRows.length, 'total rows');
        }
      }
      
      return {
        headers,
        rows,
        detectedMappings,
        validationErrors,
        totalRows: lines.length - 1,
        uniqueCruises // Add cruise count for 20-column format
      };
    }),

  commit: publicProcedure
    .input(z.object({
      csvContent: z.string(),
      sheetType: z.enum(['cruises', 'booked', 'casino_offers', 'calendar']),
      mapping: z.record(z.string(), z.string()),
      replaceExisting: z.boolean().default(false)
    }))
    .mutation(({ input }) => {
      console.log('[tRPC] Committing import for sheet type:', input.sheetType);
      
      if (input.replaceExisting) {
        console.log('[tRPC] Clearing existing data before import');
        memoryStore.clearAllData();
      }
      
      const lines = input.csvContent.trim().split('\n');
      const headers = lines[0].split(',').map(h => h.trim().replace(/"/g, ''));
      const dataRows = lines.slice(1);
      
      let processed = 0;
      let inserted = 0;
      let updated = 0;
      let skipped = 0;
      const errors: { row: number; message: string }[] = [];
      
      for (let i = 0; i < dataRows.length; i++) {
        const row = dataRows[i].split(',').map(cell => cell.trim().replace(/"/g, ''));
        processed++;
        
        try {
          const mappedData: any = {};
          
          // Map CSV columns to object properties
          headers.forEach((header, index) => {
            const targetField = input.mapping[header] as string | undefined;
            if (targetField && row[index]) {
              let value: any = row[index];
              
              // Type conversion based on field
              if (['nights', 'guests', 'daysToGo'].includes(targetField)) {
                value = parseInt(value, 10);
                if (isNaN(value)) {
                  throw new Error(`Invalid number for ${targetField}: ${row[index]}`);
                }
              } else if (['departureDate', 'startDate', 'endDate', 'expires', 'offerExpirationDate', 'offerExpiryDate', 'sailingDate'].includes(targetField)) {
                // Parse date - accept multiple formats
                const dateFormats = [
                  /^\d{4}-\d{2}-\d{2}$/, // YYYY-MM-DD
                  /^\d{2}\/\d{2}\/\d{4}$/, // MM/DD/YYYY
                  /^\d{2}-\d{2}-\d{4}$/ // MM-DD-YYYY
                ];
                
                let parsedDate: Date | null = null;
                
                if (dateFormats[0].test(value)) {
                  parsedDate = new Date(value);
                } else if (dateFormats[1].test(value)) {
                  const parts = value.split('/');
                  if (parts.length === 3) {
                    const [month, day, year] = parts;
                    parsedDate = new Date(`${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`);
                  }
                } else if (dateFormats[2].test(value)) {
                  const parts = value.split('-');
                  if (parts.length === 3) {
                    const [month, day, year] = parts;
                    parsedDate = new Date(`${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`);
                  }
                } else {
                  parsedDate = new Date(value);
                }
                
                if (!parsedDate || isNaN(parsedDate.getTime())) {
                  throw new Error(`Invalid date format for ${targetField}: ${value}`);
                }
                
                value = parsedDate.toISOString().split('T')[0]; // Store as YYYY-MM-DD
              }
              
              mappedData[targetField] = value;
            }
          });
          
          // Create the entity based on sheet type
          switch (input.sheetType) {
            case 'cruises':
              // Set required fields with defaults
              // Calculate return date based on departure date and nights
              const departureDate = mappedData.departureDate || new Date().toISOString().split('T')[0];
              const nights = mappedData.nights || 7;
              let returnDate = mappedData.returnDate as string;
              
              if (!returnDate && departureDate) {
                // Calculate return date by adding nights to departure date
                const departure = new Date(departureDate);
                const returnDateCalc = new Date(departure);
                returnDateCalc.setDate(returnDateCalc.getDate() + nights);
                returnDate = returnDateCalc.toISOString().split('T')[0];
              }
              
              const cruiseData = {
                ship: mappedData.ship || 'Unknown Ship',
                itineraryName: mappedData.itineraryName || 'Unknown Itinerary',
                departurePort: mappedData.departurePort || 'Unknown Port',
                departureDate,
                returnDate: returnDate || departureDate,
                nights,
                line: mappedData.line || 'Unknown Line',
                stateroomTypes: mappedData.cabinType ? [mappedData.cabinType as string] : ['Interior'],
                status: 'on_sale' as const,
                cabinType: mappedData.cabinType,
                casinoOfferType: mappedData.casinoOfferType,
                offerName: mappedData.offerName,
                offerCode: mappedData.offerCode,
                offerExpirationDate: mappedData.offerExpirationDate,
                typeOfOffer: mappedData.typeOfOffer,
                value: mappedData.value,
                region: mappedData.region
              };
              memoryStore.createCruise(cruiseData);
              inserted++;
              break;
              
            case 'booked':
              const bookedData = {
                ship: mappedData.ship || 'Unknown Ship',
                departureDate: mappedData.startDate || new Date().toISOString().split('T')[0],
                returnDate: mappedData.endDate || mappedData.startDate || new Date().toISOString().split('T')[0],
                nights: mappedData.nights || 7,
                itineraryName: mappedData.itineraryName || 'Unknown Itinerary',
                departurePort: mappedData.departurePort || 'Unknown Port',
                portsRoute: mappedData.portsRoute || '',
                reservationNumber: mappedData.reservationNumber || '',
                guests: mappedData.guests || 1,
                daysToGo: mappedData.daysToGo || 0,
                paidFare: mappedData.paidFare,
                actualFare: mappedData.actualFare,
                currentMarketPrice: mappedData.currentMarketPrice,
                actualSavings: mappedData.actualSavings,
                projectedSavings: mappedData.projectedSavings
              };
              memoryStore.createBookedCruise(bookedData);
              inserted++;
              break;
              
            case 'casino_offers':
              // Check if this is the NEW 20-column format with cruise data
              const has20ColumnFormat = mappedData.shipName && mappedData.sailingDate && mappedData.itinerary;
              
              if (has20ColumnFormat) {
                // Extract cruise data first - create/update cruise entry
                const sailingDate = mappedData.sailingDate || new Date().toISOString().split('T')[0];
                const nights = mappedData.nights || 7;
                
                // Calculate return date
                const departure = new Date(sailingDate);
                const returnDateCalc = new Date(departure);
                returnDateCalc.setDate(returnDateCalc.getDate() + nights);
                const returnDate = returnDateCalc.toISOString().split('T')[0];
                
                const cruiseData = {
                  ship: mappedData.shipName || 'Unknown Ship',
                  itineraryName: mappedData.itinerary || 'Unknown Itinerary',
                  departurePort: mappedData.departurePort || 'Unknown Port',
                  departureDate: sailingDate,
                  returnDate,
                  nights,
                  line: 'Royal Caribbean',
                  region: 'Caribbean',
                  stateroomTypes: ['Interior', 'Oceanview', 'Balcony', 'Suite'],
                  status: 'on_sale' as const,
                  // Include pricing if available
                  interiorPrice: mappedData.priceInterior || null,
                  oceanviewPrice: mappedData.priceOceanView || null,
                  balconyPrice: mappedData.priceBalcony || null,
                  suitePrice: mappedData.priceSuite || null,
                  portTaxesFees: mappedData.taxesAndFees || null,
                  portsRoute: mappedData.portsAndTimes || ''
                };
                
                // Create or update cruise
                memoryStore.createCruise(cruiseData);
                console.log(`[Import] Created/updated cruise: ${cruiseData.ship} on ${cruiseData.departureDate}`);
              }
              
              // Now create the offer
              const offerData = {
                shipName: mappedData.shipName || 'Unknown Ship',
                sailingDate: mappedData.sailingDate || new Date().toISOString().split('T')[0],
                itinerary: mappedData.itinerary || 'Unknown Itinerary',
                offerCode: mappedData.offerCode || '',
                offerName: mappedData.offerName || 'Unknown Offer',
                roomType: mappedData.roomType || '',
                guestsInfo: mappedData.guestsInfo || '',
                perks: mappedData.perks || '',
                shipClass: mappedData.shipClass || '',
                tradeInValue: mappedData.tradeInValue || '$0',
                offerExpiryDate: mappedData.offerExpiryDate || new Date().toISOString().split('T')[0],
                priceInterior: mappedData.priceInterior || null,
                priceOceanView: mappedData.priceOceanView || null,
                priceBalcony: mappedData.priceBalcony || null,
                priceSuite: mappedData.priceSuite || null,
                taxesAndFees: mappedData.taxesAndFees || null,
                portsAndTimes: mappedData.portsAndTimes || '',
                offerCategory: mappedData.offerCategory || 'Unknown',
                nights: mappedData.nights || 7,
                departurePort: mappedData.departurePort || 'Unknown Port'
              };
              memoryStore.createCasinoOffer(offerData as any);
              inserted++;
              break;
          }
          
        } catch (error) {
          console.error('[tRPC] Import error on row', i + 2, ':', error);
          errors.push({
            row: i + 2,
            message: error instanceof Error ? error.message : 'Unknown error'
          });
          skipped++;
        }
      }
      
      const report = {
        processed,
        inserted,
        updated,
        skipped,
        errors: errors.slice(0, 10) // Return first 10 errors
      };
      
      console.log('[tRPC] Import completed:', report);
      return report;
    }),

  loadGoogleSheets: publicProcedure
    .input(z.object({
      sheetUrl: z.string().url()
    }))
    .mutation(async ({ input }) => {
      console.log('[Import] Loading Google Sheets data from:', input.sheetUrl);
      
      throw new Error('Google Sheets import is not implemented. Please use local file upload instead.');
    }),
    
  getImportStatus: publicProcedure
    .query(() => {
      return {
        cruisesCount: memoryStore.getCruises().length,
        offersCount: memoryStore.getCasinoOffers().length,
        calendarEventsCount: memoryStore.getCalendarEvents().length,
        bookedCruisesCount: memoryStore.getBookedCruises().length,
        lastImport: memoryStore.lastImport
      };
    }),

  loadDatabase: publicProcedure
    .mutation(async () => {
      console.log('[Import] Loading database - this should be done via local file upload');
      
      throw new Error('Please use the Import screen to upload your Master.xlsx file with the four tabs: CRUISES, BOOKED CRUISES, CASINO OVERVIEW OFFERS, and TRIPIT CALENDAR ICS');
    }),

  importSeparateFiles: publicProcedure
    .input(z.object({
      data: z.object({
        cruises: z.array(z.any()).optional(),
        booked: z.array(z.any()).optional(),
        offers: z.array(z.any()).optional(),
        calendar: z.array(z.any()).optional()
      })
    }))
    .mutation(({ input }) => {
      console.log('[tRPC] Importing separate file data');
      
      // Clear existing data first
      memoryStore.clearAllData();
      
      let cruisesCount = 0;
      let bookedCount = 0;
      let offersCount = 0;
      let eventsCount = 0;
      
      console.log('[Import] Input data summary:', {
        cruises: input.data.cruises?.length || 0,
        booked: input.data.booked?.length || 0,
        offers: input.data.offers?.length || 0,
        calendar: input.data.calendar?.length || 0
      });
      
      // Import cruises
      if (input.data.cruises && input.data.cruises.length > 0) {
        console.log('[Import] Processing', input.data.cruises.length, 'cruises');
        input.data.cruises.forEach((cruise: any, index: number) => {
          try {
            // Parse date properly
            let departureDate = cruise['Sailing Date'] || cruise['Departure Date'] || cruise.departureDate;
            if (departureDate && typeof departureDate === 'number') {
              // Excel date serial number
              const excelEpoch = new Date(1900, 0, 1);
              const date = new Date(excelEpoch.getTime() + (departureDate - 2) * 24 * 60 * 60 * 1000);
              departureDate = date.toISOString().split('T')[0];
            } else if (departureDate) {
              const parsed = new Date(departureDate);
              if (!isNaN(parsed.getTime())) {
                departureDate = parsed.toISOString().split('T')[0];
              } else {
                departureDate = new Date().toISOString().split('T')[0];
              }
            } else {
              departureDate = new Date().toISOString().split('T')[0];
            }
            
            const cruiseData = {
              ship: cruise['Ship Name'] || cruise.ship || 'Unknown Ship',
              itineraryName: cruise['Itinerary'] || cruise.itineraryName || 'Unknown Itinerary',
              departurePort: cruise['Departure Port'] || cruise.departurePort || 'Unknown Port',
              departureDate,
              returnDate: departureDate, // Use same date for now
              nights: parseInt(String(cruise['Nights'] || cruise.nights || '7')),
              line: cruise['Line'] || cruise.line || 'Unknown Line',
              region: cruise['Region'] || cruise.region || 'Unknown',
              stateroomTypes: ['Interior', 'Oceanview', 'Balcony', 'Suite'],
              status: 'on_sale' as const
            };
            
            console.log(`[Import] Creating cruise ${index + 1}:`, cruiseData.ship, cruiseData.departureDate);
            memoryStore.createCruise(cruiseData);
            cruisesCount++;
          } catch (error) {
            console.error(`[Import] Error importing cruise ${index + 1}:`, error);
          }
        });
      }
      
      // Import booked cruises
      if (input.data.booked && input.data.booked.length > 0) {
        console.log('[Import] Processing', input.data.booked.length, 'booked cruises');
        input.data.booked.forEach((booked: any, index: number) => {
          try {
            // Parse dates properly
            let startDate = booked['Start Date'] || booked.startDate;
            let endDate = booked['End Date'] || booked.endDate;
            
            if (startDate && typeof startDate === 'number') {
              const excelEpoch = new Date(1900, 0, 1);
              const date = new Date(excelEpoch.getTime() + (startDate - 2) * 24 * 60 * 60 * 1000);
              startDate = date.toISOString().split('T')[0];
            } else if (startDate) {
              const parsed = new Date(startDate);
              startDate = !isNaN(parsed.getTime()) ? parsed.toISOString().split('T')[0] : new Date().toISOString().split('T')[0];
            } else {
              startDate = new Date().toISOString().split('T')[0];
            }
            
            if (endDate && typeof endDate === 'number') {
              const excelEpoch = new Date(1900, 0, 1);
              const date = new Date(excelEpoch.getTime() + (endDate - 2) * 24 * 60 * 60 * 1000);
              endDate = date.toISOString().split('T')[0];
            } else if (endDate) {
              const parsed = new Date(endDate);
              endDate = !isNaN(parsed.getTime()) ? parsed.toISOString().split('T')[0] : startDate;
            } else {
              endDate = startDate;
            }
            
            const bookedData: Omit<import('@/types/models').BookedCruise, 'id' | 'createdAt' | 'updatedAt'> = {
              ship: booked['Ship'] || booked.ship || 'Unknown Ship',
              departureDate: startDate,
              returnDate: endDate,
              nights: parseInt(String(booked['Nights'] || booked.nights || '7')),
              itineraryName: booked['Itinerary Name'] || booked.itineraryName || 'Unknown Itinerary',
              departurePort: booked['Departure Port'] || booked.departurePort || 'Unknown Port',
              portsRoute: booked['Ports/Route'] || booked.portsRoute || '',
              reservationNumber: String(booked['Reservation #'] || booked.reservationNumber || ''),
              guests: parseInt(String(booked['Guests'] || booked.guests || '1')),
              daysToGo: parseInt(String(booked['Days to Go'] || booked.daysToGo || '0'))
            };
            
            console.log(`[Import] Creating booked cruise ${index + 1}:`, bookedData.ship, bookedData.departureDate);
            memoryStore.createBookedCruise(bookedData);
            bookedCount++;
          } catch (error) {
            console.error(`[Import] Error importing booked cruise ${index + 1}:`, error);
          }
        });
      }
      
      // Import casino offers
      if (input.data.offers && input.data.offers.length > 0) {
        console.log('[Import] Processing', input.data.offers.length, 'casino offers');
        input.data.offers.forEach((offer: any, index: number) => {
          try {
            // Parse expiration date
            let expires = offer['EXPIRES'] || offer.expires;
            if (expires && typeof expires === 'number') {
              const excelEpoch = new Date(1900, 0, 1);
              const date = new Date(excelEpoch.getTime() + (expires - 2) * 24 * 60 * 60 * 1000);
              expires = date.toISOString().split('T')[0];
            } else if (expires) {
              const parsed = new Date(expires);
              expires = !isNaN(parsed.getTime()) ? parsed.toISOString().split('T')[0] : new Date().toISOString().split('T')[0];
            } else {
              expires = new Date().toISOString().split('T')[0];
            }
            
            const offerData = {
              name: offer['NAME'] || offer.name || 'Unknown',
              rewardNumber: String(offer['REWARD NUMBER'] || offer.rewardNumber || ''),
              offerName: offer['OFFER NAME'] || offer.offerName || 'Unknown Offer',
              offerType: offer['OFFER TYPE'] || offer.offerType || 'Unknown',
              expires,
              offerCode: String(offer['OFFER CODE'] || offer.offerCode || ''),
              tradeInValue: String(offer['TRADE IN VALUE'] || offer.tradeInValue || '$0')
            };
            
            console.log(`[Import] Creating casino offer ${index + 1}:`, {
              offerName: offerData.offerName,
              offerCode: offerData.offerCode,
              expires: offerData.expires,
              uniqueKey: `${offerData.offerCode}_${offerData.expires}`
            });
            
            // The createCasinoOffer method always creates new offers (no duplicate detection)
            memoryStore.createCasinoOffer(offerData);
            offersCount++;
          } catch (error) {
            console.error(`[Import] Error importing casino offer ${index + 1}:`, error);
          }
        });
      }
      
      // Import calendar events
      if (input.data.calendar && input.data.calendar.length > 0) {
        console.log('[Import] Processing', input.data.calendar.length, 'calendar events');
        input.data.calendar.forEach((event: any, index: number) => {
          try {
            // Parse dates
            let startDate = event['Start Date'] || event.startDate;
            let endDate = event['End Date'] || event.endDate;
            
            if (startDate && typeof startDate === 'number') {
              const excelEpoch = new Date(1900, 0, 1);
              const date = new Date(excelEpoch.getTime() + (startDate - 2) * 24 * 60 * 60 * 1000);
              startDate = date.toISOString().split('T')[0];
            } else if (startDate) {
              const parsed = new Date(startDate);
              startDate = !isNaN(parsed.getTime()) ? parsed.toISOString().split('T')[0] : new Date().toISOString().split('T')[0];
            } else {
              startDate = new Date().toISOString().split('T')[0];
            }
            
            if (endDate && typeof endDate === 'number') {
              const excelEpoch = new Date(1900, 0, 1);
              const date = new Date(excelEpoch.getTime() + (endDate - 2) * 24 * 60 * 60 * 1000);
              endDate = date.toISOString().split('T')[0];
            } else if (endDate) {
              const parsed = new Date(endDate);
              endDate = !isNaN(parsed.getTime()) ? parsed.toISOString().split('T')[0] : startDate;
            } else {
              endDate = startDate;
            }
            
            const eventData = {
              summary: event['Summary'] || event.summary || 'Event',
              startDate,
              endDate,
              description: String(event['Description'] || event.description || ''),
              location: String(event['Location'] || event.location || ''),
              source: 'manual' as const
            };
            
            console.log(`[Import] Creating calendar event ${index + 1}:`, eventData.summary, eventData.startDate);
            memoryStore.createCalendarEvent(eventData);
            eventsCount++;
          } catch (error) {
            console.error(`[Import] Error importing calendar event ${index + 1}:`, error);
          }
        });
      }
      
      console.log('[Import] Separate files import completed:', {
        cruises: cruisesCount,
        booked: bookedCount,
        offers: offersCount,
        events: eventsCount
      });
      
      return {
        cruises: cruisesCount,
        booked: bookedCount,
        offers: offersCount,
        events: eventsCount
      };
    }),

  importLocalFile: publicProcedure
    .input(z.object({
      data: z.object({
        cruises: z.array(z.any()).optional(),
        booked: z.array(z.any()).optional(),
        offers: z.array(z.any()).optional(),
        calendar: z.array(z.any()).optional()
      }),
      clearExisting: z.boolean().default(true),
      batchSize: z.number().default(100) // Process in batches to avoid timeouts
    }))
    .mutation(async ({ input }) => {
      console.log('[tRPC] ========== IMPORT LOCAL FILE START ==========');
      console.log('[tRPC] Input data received:', {
        cruises: input.data.cruises?.length || 0,
        booked: input.data.booked?.length || 0,
        offers: input.data.offers?.length || 0,
        calendar: input.data.calendar?.length || 0,
        clearExisting: input.clearExisting,
        batchSize: input.batchSize
      });
      
      // Get current state before clearing
      const beforeClear = {
        cruises: memoryStore.getCruises().length,
        booked: memoryStore.getBookedCruises().length,
        offers: memoryStore.getCasinoOffers().length
      };
      console.log('[tRPC] Memory store state BEFORE clear:', beforeClear);
      
      // Clear existing data only on first batch
      if (input.clearExisting) {
        console.log('[tRPC] Clearing existing data IN-MEMORY ONLY (keeping persist.json)...');
        // Clear in-memory only - don't touch persist.json yet
        memoryStore.cruises = [];
        memoryStore.bookedCruises = [];
        memoryStore.casinoOffers = [];
        memoryStore.calendarEvents = [];
        
        // Verify data was cleared
        const afterClear = {
          cruises: memoryStore.getCruises().length,
          booked: memoryStore.getBookedCruises().length,
          offers: memoryStore.getCasinoOffers().length
        };
        console.log('[tRPC] Memory store state AFTER clear:', afterClear);
      } else {
        console.log('[tRPC] Appending to existing data (batch mode)...');
      }
      
      let cruisesCount = 0;
      let bookedCount = 0;
      let offersCount = 0;
      let eventsCount = 0;
      let errors: string[] = [];
      
      // Helper function to process data in batches
      const processBatch = <T>(items: T[], processor: (item: T, index: number) => void, batchName: string) => {
        const totalItems = items.length;
        let processed = 0;
        
        console.log(`[Import] Processing ${totalItems} ${batchName} in batches of ${input.batchSize}`);
        
        for (let i = 0; i < totalItems; i += input.batchSize) {
          const batch = items.slice(i, i + input.batchSize);
          const batchNumber = Math.floor(i / input.batchSize) + 1;
          const totalBatches = Math.ceil(totalItems / input.batchSize);
          
          console.log(`[Import] Processing ${batchName} batch ${batchNumber}/${totalBatches} (${batch.length} items)`);
          
          batch.forEach((item, batchIndex) => {
            const globalIndex = i + batchIndex;
            try {
              processor(item, globalIndex);
              processed++;
            } catch (error) {
              const errorMsg = `Error processing ${batchName} ${globalIndex + 1}: ${error instanceof Error ? error.message : 'Unknown error'}`;
              console.error(`[Import] ${errorMsg}`);
              errors.push(errorMsg);
            }
          });
          
          // Small delay between batches to prevent overwhelming the system
          if (i + input.batchSize < totalItems) {
            // Synchronous delay simulation (not ideal but necessary for this context)
            const start = Date.now();
            while (Date.now() - start < 10) {
              // 10ms delay
            }
          }
        }
        
        console.log(`[Import] Completed processing ${processed}/${totalItems} ${batchName}`);
        return processed;
      };
      
      // Import cruises in batches
      if (input.data.cruises && input.data.cruises.length > 0) {
        cruisesCount = processBatch(input.data.cruises, (cruise: any, index: number) => {
          // Parse date properly
          let departureDate = cruise['Sailing Date'] || cruise['Departure Date'] || cruise.departureDate;
          if (departureDate && typeof departureDate === 'number') {
            // Excel date serial number
            const excelEpoch = new Date(1900, 0, 1);
            const date = new Date(excelEpoch.getTime() + (departureDate - 2) * 24 * 60 * 60 * 1000);
            departureDate = date.toISOString().split('T')[0];
          } else if (departureDate) {
            const parsed = new Date(departureDate);
            if (!isNaN(parsed.getTime())) {
              departureDate = parsed.toISOString().split('T')[0];
            } else {
              departureDate = new Date().toISOString().split('T')[0];
            }
          } else {
            departureDate = new Date().toISOString().split('T')[0];
          }
          
          const nights = parseInt(String(cruise['Nights'] || cruise.nights || '7'));
          
          // Calculate return date by adding nights to departure date
          const departure = new Date(departureDate);
          const returnDateCalc = new Date(departure);
          returnDateCalc.setDate(returnDateCalc.getDate() + nights);
          const returnDate = returnDateCalc.toISOString().split('T')[0];
          
          const cruiseData = {
            ship: cruise['Ship Name'] || cruise.ship || 'Unknown Ship',
            itineraryName: cruise['Itinerary'] || cruise.itineraryName || 'Unknown Itinerary',
            departurePort: cruise['Departure Port'] || cruise.departurePort || 'Unknown Port',
            departureDate,
            returnDate,
            nights,
            line: cruise['Line'] || cruise.line || 'Unknown Line',
            region: cruise['Region'] || cruise.region || 'Unknown',
            stateroomTypes: ['Interior', 'Oceanview', 'Balcony', 'Suite'],
            status: 'on_sale' as const,
            portsRoute: cruise['All Ports'] || cruise['Ports/Route'] || cruise.portsRoute || '',
            // NEW: Enhanced cabin pricing from cruises.xlsx
            interiorPrice: (() => {
              const v = cruise['Interior Cabin Price'] || cruise['Interior retail price'] || cruise['Interior Retail Price'] || cruise['Interior Price'] || cruise.interiorPrice;
              const num = typeof v === 'number' ? v : (typeof v === 'string' ? parseFloat(String(v).replace(/[^0-9.]/g, '')) : NaN);
              return (!isNaN(num) && num > 0) ? num : null;
            })(),
            oceanviewPrice: (() => {
              const v = cruise['Oceanview Cabin Price'] || cruise['Oceanview retail price'] || cruise['Oceanview Retail Price'] || cruise['Oceanview Price'] || cruise.oceanviewPrice;
              const num = typeof v === 'number' ? v : (typeof v === 'string' ? parseFloat(String(v).replace(/[^0-9.]/g, '')) : NaN);
              return (!isNaN(num) && num > 0) ? num : null;
            })(),
            balconyPrice: (() => {
              const v = cruise['Balcony Cabin Price'] || cruise['Balcony retail price'] || cruise['Balcony Retail Price'] || cruise['Balcony Price'] || cruise.balconyPrice;
              const num = typeof v === 'number' ? v : (typeof v === 'string' ? parseFloat(String(v).replace(/[^0-9.]/g, '')) : NaN);
              return (!isNaN(num) && num > 0) ? num : null;
            })(),
            suitePrice: (() => {
              const v = cruise['Suite Cabin Price'] || cruise['Suite retail price'] || cruise['Suite Retail Price'] || cruise['Suite Price'] || cruise.suitePrice;
              const num = typeof v === 'number' ? v : (typeof v === 'string' ? parseFloat(String(v).replace(/[^0-9.]/g, '')) : NaN);
              return (!isNaN(num) && num > 0) ? num : null;
            })(),
            portTaxesFees: (() => {
              const v = cruise['Port Taxes & Fees'] || cruise['Port Taxes and Fees'] || cruise['Taxes & Fees'] || cruise['Taxes and Fees'] || cruise.portTaxesFees;
              const num = typeof v === 'number' ? v : (typeof v === 'string' ? parseFloat(String(v).replace(/[^0-9.]/g, '')) : NaN);
              return (!isNaN(num) && num > 0) ? num : null;
            })(),
            // NEW: Multiple offer codes support
            offerCodes: (() => {
              const v = cruise['Offer Codes'] || cruise['offerCodes'] || cruise['Multiple Offer Codes'];
              if (v) {
                if (Array.isArray(v)) return v.filter(c => c && typeof c === 'string');
                if (typeof v === 'string' && v.trim()) {
                  return v.split(',').map(c => c.trim()).filter(Boolean);
                }
              }
              return cruise['Offer Code'] || cruise.offerCode ? [String(cruise['Offer Code'] || cruise.offerCode)] : undefined;
            })(),
            // NEW: Detailed itinerary with day/time/ports
            itineraryDetails: (() => {
              const v = cruise['Itinerary DAY & TIME Ports'] || cruise['Itinerary Details'] || cruise.itineraryDetails;
              if (v && typeof v === 'string' && v.trim()) {
                try {
                  return JSON.parse(v);
                } catch {
                  return undefined;
                }
              } else if (Array.isArray(v)) {
                return v;
              }
              return undefined;
            })(),
            // Keep legacy pricingCurrent for backward compatibility
            pricingCurrent: (() => {
              const interior = (() => {
                const v = cruise['Interior Cabin Price'] || cruise['Interior retail price'] || cruise['Interior Retail Price'] || cruise['Interior Price'] || cruise.interiorPrice;
                const num = typeof v === 'number' ? v : (typeof v === 'string' ? parseFloat(String(v).replace(/[^0-9.]/g, '')) : NaN);
                return (!isNaN(num) && num > 0) ? num : null;
              })();
              if (interior) {
                return { interior, source: 'xlsx', fetchedAt: new Date().toISOString() };
              }
              return undefined;
            })()
          };
          
          memoryStore.createCruise(cruiseData);
        }, 'cruises');
      }
      
      // Import booked cruises in batches
      if (input.data.booked && input.data.booked.length > 0) {
        bookedCount = processBatch(input.data.booked, (booked: any, index: number) => {
          // Parse dates properly
          let startDate = booked['Start Date'] || booked.startDate;
          let endDate = booked['End Date'] || booked.endDate;
          
          if (startDate && typeof startDate === 'number') {
            const excelEpoch = new Date(1900, 0, 1);
            const date = new Date(excelEpoch.getTime() + (startDate - 2) * 24 * 60 * 60 * 1000);
            startDate = date.toISOString().split('T')[0];
          } else if (startDate) {
            const parsed = new Date(startDate);
            startDate = !isNaN(parsed.getTime()) ? parsed.toISOString().split('T')[0] : new Date().toISOString().split('T')[0];
          } else {
            startDate = new Date().toISOString().split('T')[0];
          }
          
          if (endDate && typeof endDate === 'number') {
            const excelEpoch = new Date(1900, 0, 1);
            const date = new Date(excelEpoch.getTime() + (endDate - 2) * 24 * 60 * 60 * 1000);
            endDate = date.toISOString().split('T')[0];
          } else if (endDate) {
            const parsed = new Date(endDate);
            endDate = !isNaN(parsed.getTime()) ? parsed.toISOString().split('T')[0] : startDate;
          } else {
            endDate = startDate;
          }
          
          const bookedData: Omit<import('@/types/models').BookedCruise, 'id' | 'createdAt' | 'updatedAt'> = {
            ship: booked['Ship'] || booked.ship || 'Unknown Ship',
            departureDate: startDate,
            returnDate: endDate,
            nights: parseInt(String(booked['Nights'] || booked.nights || '7')),
            itineraryName: booked['Itinerary Name'] || booked.itineraryName || 'Unknown Itinerary',
            departurePort: booked['Departure Port'] || booked.departurePort || 'Unknown Port',
            portsRoute: booked['Ports/Route'] || booked.portsRoute || '',
            reservationNumber: String(booked['Reservation #'] || booked.reservationNumber || ''),
            guests: parseInt(String(booked['Guests'] || booked.guests || '1')),
            daysToGo: parseInt(String(booked['Days to Go'] || booked.daysToGo || '0'))
          };
          
          memoryStore.createBookedCruise(bookedData);
        }, 'booked cruises');
      }
      
      // Import casino offers in batches
      if (input.data.offers && input.data.offers.length > 0) {
        console.log('[Import] ===== STARTING CASINO OFFERS IMPORT =====');
        console.log('[Import] Total offers to process:', input.data.offers.length);
        console.log('[Import] Current offers in store BEFORE import:', memoryStore.getCasinoOffers().length);
        
        offersCount = processBatch(input.data.offers, (offer: any, index: number) => {
          // Parse expiration date
          let expires = offer['EXPIRES'] || offer.expires;
          if (expires && typeof expires === 'number') {
            const excelEpoch = new Date(1900, 0, 1);
            const date = new Date(excelEpoch.getTime() + (expires - 2) * 24 * 60 * 60 * 1000);
            expires = date.toISOString().split('T')[0];
          } else if (expires) {
            const parsed = new Date(expires);
            expires = !isNaN(parsed.getTime()) ? parsed.toISOString().split('T')[0] : new Date().toISOString().split('T')[0];
          } else {
            expires = new Date().toISOString().split('T')[0];
          }
          
          const offerData = {
            name: offer['NAME'] || offer.name || 'Unknown',
            rewardNumber: String(offer['REWARD NUMBER'] || offer.rewardNumber || ''),
            offerName: offer['OFFER NAME'] || offer.offerName || 'Unknown Offer',
            offerType: offer['OFFER TYPE'] || offer.offerType || 'Unknown',
            expires,
            offerCode: String(offer['OFFER CODE'] || offer.offerCode || ''),
            tradeInValue: String(offer['TRADE IN VALUE'] || offer.tradeInValue || '$0')
          };
          
          console.log(`[Import] Creating offer ${index + 1}/${input.data.offers?.length || 0}:`, {
            offerName: offerData.offerName,
            offerCode: offerData.offerCode,
            expires: offerData.expires
          });
          
          const createdOffer = memoryStore.createCasinoOffer(offerData);
          console.log(`[Import] Created offer with ID: ${createdOffer.id}`);
        }, 'casino offers');
        
        console.log('[Import] ===== CASINO OFFERS IMPORT COMPLETE =====');
        console.log('[Import] Offers processed:', offersCount);
        console.log('[Import] Current offers in store AFTER import:', memoryStore.getCasinoOffers().length);
      }
      
      // Import calendar events in batches
      if (input.data.calendar && input.data.calendar.length > 0) {
        eventsCount = processBatch(input.data.calendar, (event: any, index: number) => {
          // Parse dates
          let startDate = event['Start Date'] || event.startDate;
          let endDate = event['End Date'] || event.endDate;
          
          if (startDate && typeof startDate === 'number') {
            const excelEpoch = new Date(1900, 0, 1);
            const date = new Date(excelEpoch.getTime() + (startDate - 2) * 24 * 60 * 60 * 1000);
            startDate = date.toISOString().split('T')[0];
          } else if (startDate) {
            const parsed = new Date(startDate);
            startDate = !isNaN(parsed.getTime()) ? parsed.toISOString().split('T')[0] : new Date().toISOString().split('T')[0];
          } else {
            startDate = new Date().toISOString().split('T')[0];
          }
          
          if (endDate && typeof endDate === 'number') {
            const excelEpoch = new Date(1900, 0, 1);
            const date = new Date(excelEpoch.getTime() + (endDate - 2) * 24 * 60 * 60 * 1000);
            endDate = date.toISOString().split('T')[0];
          } else if (endDate) {
            const parsed = new Date(endDate);
            endDate = !isNaN(parsed.getTime()) ? parsed.toISOString().split('T')[0] : startDate;
          } else {
            endDate = startDate;
          }
          
          const eventData = {
            summary: event['Summary'] || event.summary || 'Event',
            startDate,
            endDate,
            description: String(event['Description'] || event.description || ''),
            location: String(event['Location'] || event.location || ''),
            source: 'manual' as const
          };
          
          memoryStore.createCalendarEvent(eventData);
        }, 'calendar events');
      }
      
      const result = {
        cruises: cruisesCount,
        booked: bookedCount,
        offers: offersCount,
        events: eventsCount,
        errors: errors.slice(0, 10) // Return first 10 errors
      };
      
      console.log('[Import] Local file import completed:', result);
      
      // CRITICAL: Verify final counts in memory store
      const finalCounts = {
        cruises: memoryStore.getCruises().length,
        booked: memoryStore.getBookedCruises().length,
        offers: memoryStore.getCasinoOffers().length,
        events: memoryStore.getCalendarEvents().length
      };
      console.log('[Import] FINAL data counts in memory store:', finalCounts);
      
      // CRITICAL: Check for discrepancies
      if (finalCounts.cruises !== cruisesCount) {
        console.error('[Import] CRITICAL ERROR: Cruise count mismatch!', {
          processed: cruisesCount,
          inStore: finalCounts.cruises,
          difference: finalCounts.cruises - cruisesCount
        });
      }
      
      if (finalCounts.offers !== offersCount) {
        console.error('[Import] CRITICAL ERROR: Offer count mismatch!', {
          processed: offersCount,
          inStore: finalCounts.offers,
          difference: finalCounts.offers - offersCount
        });
      }
      
      // Update last import timestamp
      memoryStore.lastImport = new Date().toISOString();
      console.log('[Import] Updated lastImport timestamp:', memoryStore.lastImport);
      
      // Run data cleanup after import
      console.log('[Import] Running data cleanup after import...');
      const cleanedShipNames = memoryStore.cleanShipNames();
      const fixedDates = memoryStore.fixCruiseDatesAndDuration();
      const standardizedDates = memoryStore.standardizeAllDates();
      console.log('[Import] Cleanup complete:', { cleanedShipNames, fixedDates, standardizedDates });
      
      // Final verification after cleanup
      const afterCleanup = {
        cruises: memoryStore.getCruises().length,
        booked: memoryStore.getBookedCruises().length,
        offers: memoryStore.getCasinoOffers().length,
        events: memoryStore.getCalendarEvents().length
      };
      console.log('[Import] Data counts AFTER cleanup:', afterCleanup);
      
      // CRITICAL: Persist data immediately after import
      console.log('[Import] Persisting data to disk...');
      try {
        await memoryStore.persistNow();
        console.log('[Import] ✅ Data persisted successfully to:', memoryStore.persistFilePath || 'persist.json');
        
        // Verify persistence worked
        const verifyState = {
          cruises: memoryStore.getCruises().length,
          booked: memoryStore.getBookedCruises().length,
          offers: memoryStore.getCasinoOffers().length,
          events: memoryStore.getCalendarEvents().length
        };
        console.log('[Import] Verified persisted state:', verifyState);
      } catch (error) {
        console.error('[Import] ❌ Failed to persist data:', error);
        throw new Error('Failed to persist imported data - import rolled back');
      }
      
      console.log('[tRPC] ========== IMPORT LOCAL FILE END ==========');
      
      return {
        ...result,
        finalCounts: afterCleanup // Return actual final counts
      };
    }),

  syncTripItCalendar: publicProcedure
    .mutation(async () => {
      console.log('[Import] Syncing TripIt calendar');
      
      try {
        // Fetch TripIt calendar data directly
        const response = await fetch('https://www.tripit.com/feed/ical/private/6D1ACB7E-DF1422C4611E9FA3C16E5EC4AFD60F7B/tripit.ics', {
          headers: {
            'User-Agent': 'Mozilla/5.0 (compatible; ProjectZ/1.0)',
            'Accept': 'text/calendar, text/plain, */*',
            'Cache-Control': 'no-cache'
          }
        });
        if (!response.ok) {
          throw new Error(`Failed to fetch TripIt calendar: ${response.status} ${response.statusText}`);
        }
        
        const icalData = await response.text();
        console.log('[Import] Fetched TripIt iCal data, length:', icalData.length);
        
        if (!icalData || icalData.length === 0) {
          throw new Error('Empty calendar data received from TripIt');
        }
        
        // Parse iCal data
        const events = parseICalData(icalData);
        console.log('[Import] Parsed TripIt events:', events.length);
        
        // Clear existing TripIt events first
        const existingEvents = memoryStore.getCalendarEvents({ source: 'tripit' });
        console.log('[Import] Clearing', existingEvents.length, 'existing TripIt events');
        
        // Remove existing TripIt events from memory store
        memoryStore.calendarEvents = memoryStore.calendarEvents.filter(e => e.source !== 'tripit');
        
        // Add new TripIt events to memory store
        let importedCount = 0;
        events.forEach(eventData => {
          try {
            memoryStore.createCalendarEvent(eventData);
            importedCount++;
          } catch (eventError) {
            console.warn('[Import] Failed to create event:', eventError);
          }
        });
        
        console.log('[Import] Successfully imported', importedCount, 'TripIt events to memory store');
        
        return {
          success: true,
          message: `Successfully imported ${importedCount} events from TripIt calendar`,
          eventsImported: importedCount,
          events: events.slice(0, 10) // Return first 10 events for preview
        };
      } catch (error) {
        console.error('[Import] Failed to sync TripIt calendar:', error);
        throw new Error(`Failed to sync TripIt calendar: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }),

  importFromUrl: publicProcedure
    .input(z.object({
      csvUrl: z.string().url(),
      sheetType: z.enum(['cruises', 'booked', 'casino_offers']),
      replaceExisting: z.boolean().default(false)
    }))
    .mutation(async ({ input }) => {
      console.log('[tRPC] Importing CSV from URL:', input.csvUrl);
      
      try {
        // Fetch CSV data from URL
        const response = await fetch(input.csvUrl);
        if (!response.ok) {
          throw new Error(`Failed to fetch CSV: ${response.status} ${response.statusText}`);
        }
        
        const csvContent = await response.text();
        console.log('[tRPC] Fetched CSV content, length:', csvContent.length);
        
        if (input.replaceExisting) {
          console.log('[tRPC] Clearing existing data before import');
          memoryStore.clearAllData();
        }
        
        const lines = csvContent.trim().split('\n');
        if (lines.length === 0) {
          throw new Error('Empty CSV content');
        }
        
        const headers = lines[0].split(',').map(h => h.trim().replace(/"/g, ''));
        const dataRows = lines.slice(1);
        
        console.log('[tRPC] CSV headers:', headers);
        console.log('[tRPC] Data rows count:', dataRows.length);
        
        let processed = 0;
        let inserted = 0;
        let skipped = 0;
        const errors: { row: number; message: string }[] = [];
        
        // Define column mappings based on sheet type
        let columnMapping: Record<string, string> = {};
        
        switch (input.sheetType) {
          case 'cruises':
            columnMapping = {
              'Sailing Date': 'departureDate',
              'Ship Name': 'ship',
              'Departure Port': 'departurePort',
              'Itinerary': 'itineraryName',
              'Nights': 'nights',
              'Cabin Type': 'cabinType',
              'CASINO OVERVIEW OFFER TYPE': 'casinoOfferType',
              'Offer Name': 'offerName',
              'Offer Code': 'offerCode',
              'OFFER EXPIRE DATE': 'offerExpirationDate',
              'Type of Offer': 'typeOfOffer',
              'Value': 'value',
              'Line': 'line',
              'Region': 'region'
            };
            break;
            
          case 'booked':
            columnMapping = {
              'Ship': 'ship',
              'Start Date': 'startDate',
              'End Date': 'endDate',
              'Nights': 'nights',
              'Itinerary Name': 'itineraryName',
              'Departure Port': 'departurePort',
              'Ports/Route': 'portsRoute',
              'Reservation #': 'reservationNumber',
              'Guests': 'guests',
              'Days to Go': 'daysToGo'
            };
            break;
            
          case 'casino_offers':
            columnMapping = {
              'NAME': 'name',
              'REWARD NUMBER': 'rewardNumber',
              'OFFER NAME': 'offerName',
              'OFFER TYPE': 'offerType',
              'EXPIRES': 'expires',
              'OFFER CODE': 'offerCode',
              'TRADE IN VALUE': 'tradeInValue'
            };
            break;
        }
        
        for (let i = 0; i < dataRows.length; i++) {
          const row = dataRows[i].split(',').map(cell => cell.trim().replace(/"/g, ''));
          processed++;
          
          try {
            const mappedData: any = {};
            
            // Map CSV columns to object properties
            headers.forEach((header, index) => {
              const targetField = columnMapping[header];
              if (targetField && row[index]) {
                let value: any = row[index];
                
                // Type conversion based on field
                if (['nights', 'guests', 'daysToGo'].includes(targetField)) {
                  value = parseInt(value, 10);
                  if (isNaN(value)) {
                    throw new Error(`Invalid number for ${targetField}: ${row[index]}`);
                  }
                } else if (['departureDate', 'startDate', 'endDate', 'expires', 'offerExpirationDate'].includes(targetField)) {
                  // Parse date - accept multiple formats
                  const dateFormats = [
                    /^\d{4}-\d{2}-\d{2}$/, // YYYY-MM-DD
                    /^\d{2}\/\d{2}\/\d{4}$/, // MM/DD/YYYY
                    /^\d{2}-\d{2}-\d{4}$/ // MM-DD-YYYY
                  ];
                  
                  let parsedDate: Date | null = null;
                  
                  if (dateFormats[0].test(value)) {
                    parsedDate = new Date(value);
                  } else if (dateFormats[1].test(value)) {
                    const parts = value.split('/');
                    if (parts.length === 3) {
                      const [month, day, year] = parts;
                      parsedDate = new Date(`${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`);
                    }
                  } else if (dateFormats[2].test(value)) {
                    const parts = value.split('-');
                    if (parts.length === 3) {
                      const [month, day, year] = parts;
                      parsedDate = new Date(`${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`);
                    }
                  } else {
                    parsedDate = new Date(value);
                  }
                  
                  if (!parsedDate || isNaN(parsedDate.getTime())) {
                    throw new Error(`Invalid date format for ${targetField}: ${value}`);
                  }
                  
                  value = parsedDate.toISOString().split('T')[0]; // Store as YYYY-MM-DD
                }
                
                mappedData[targetField] = value;
              }
            });
            
            // Create the entity based on sheet type
            switch (input.sheetType) {
              case 'cruises':
                const cruiseData = {
                  ship: mappedData.ship || 'Unknown Ship',
                  itineraryName: mappedData.itineraryName || 'Unknown Itinerary',
                  departurePort: mappedData.departurePort || 'Unknown Port',
                  departureDate: mappedData.departureDate || new Date().toISOString().split('T')[0],
                  returnDate: mappedData.returnDate || mappedData.departureDate || new Date().toISOString().split('T')[0],
                  nights: mappedData.nights || 7,
                  line: mappedData.line || 'Unknown Line',
                  region: mappedData.region || 'Unknown',
                  stateroomTypes: mappedData.cabinType ? [mappedData.cabinType] : ['Interior'],
                  status: 'on_sale' as const,
                  cabinType: mappedData.cabinType,
                  casinoOfferType: mappedData.casinoOfferType,
                  offerName: mappedData.offerName,
                  offerCode: mappedData.offerCode,
                  offerExpirationDate: mappedData.offerExpirationDate,
                  typeOfOffer: mappedData.typeOfOffer,
                  value: mappedData.value
                };
                memoryStore.createCruise(cruiseData);
                inserted++;
                break;
                
              case 'booked':
                const bookedData: Omit<import('@/types/models').BookedCruise, 'id' | 'createdAt' | 'updatedAt'> = {
                  ship: mappedData.ship || 'Unknown Ship',
                  departureDate: mappedData.startDate || new Date().toISOString().split('T')[0],
                  returnDate: mappedData.endDate || mappedData.startDate || new Date().toISOString().split('T')[0],
                  nights: mappedData.nights || 7,
                  itineraryName: mappedData.itineraryName || 'Unknown Itinerary',
                  departurePort: mappedData.departurePort || 'Unknown Port',
                  portsRoute: mappedData.portsRoute || '',
                  reservationNumber: mappedData.reservationNumber || '',
                  guests: mappedData.guests || 1,
                  daysToGo: mappedData.daysToGo || 0
                };
                memoryStore.createBookedCruise(bookedData);
                inserted++;
                break;
                
              case 'casino_offers':
                const offerData = {
                  name: mappedData.name || 'Unknown',
                  rewardNumber: mappedData.rewardNumber || '',
                  offerName: mappedData.offerName || 'Unknown Offer',
                  offerType: mappedData.offerType || 'Unknown',
                  expires: mappedData.expires || new Date().toISOString().split('T')[0],
                  offerCode: mappedData.offerCode || '',
                  tradeInValue: mappedData.tradeInValue || '$0'
                };
                memoryStore.createCasinoOffer(offerData);
                inserted++;
                break;
            }
            
          } catch (error) {
            console.error('[tRPC] Import error on row', i + 2, ':', error);
            errors.push({
              row: i + 2,
              message: error instanceof Error ? error.message : 'Unknown error'
            });
            skipped++;
          }
        }
        
        const report = {
          processed,
          inserted,
          updated: 0,
          skipped,
          errors: errors.slice(0, 10)
        };
        
        console.log('[tRPC] URL import completed:', report);
        return report;
        
      } catch (error) {
        console.error('[tRPC] Failed to import from URL:', error);
        throw new Error(`Failed to import from URL: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }),

  // Scan DATA folder and return parsed data for preview
  readDataFolder: publicProcedure
    .query(async () => {
      console.log('[Import] ========== SCANNING DATA FOLDER ==========');
      console.log('[Import] Current working directory:', process.cwd());
      
      // Check if fs module is available
      try {
        const fs = await import('fs');
        const path = await import('path');
        const { fileURLToPath } = await import('url');
        
        let moduleDir: string | null = null;
        try {
          const moduleFilePath = fileURLToPath(import.meta.url as unknown as string);
          moduleDir = path.dirname(moduleFilePath);
          console.log('[Import] moduleDir (from import.meta.url):', moduleDir);
        } catch {
          console.log('[Import] moduleDir not available in this runtime');
        }
        
        // Try multiple possible locations for DATA folder
        const possiblePaths = [
          path.resolve(process.cwd(), 'DATA'),
          path.resolve(process.cwd(), '../DATA'),
          ...(moduleDir ? [
            path.resolve(moduleDir, '../../../../../DATA'),
            path.resolve(moduleDir, '../../../../DATA'),
            path.resolve(moduleDir, '../../../DATA'),
          ] : []),
          '/DATA',
          './DATA',
        ];
        
        console.log('[Import] Checking these paths for DATA folder:');
        for (const p of possiblePaths) {
          const exists = fs.existsSync(p);
          console.log(`[Import]   ${p} - ${exists ? '✅ EXISTS' : '❌ NOT FOUND'}`);
          if (exists) {
            try {
              const files = fs.readdirSync(p);
              console.log(`[Import]      Files: ${files.join(', ')}`);
            } catch (e) {
              console.log(`[Import]      Could not read directory`);
            }
          }
        }
      } catch (e) {
        console.error('[Import] Error checking filesystem:', e);
      }
      
      try {
        const { readDataFiles } = await import('./startup');
        const out = readDataFiles();
        console.log('[Import] DATA folder scan complete:');
        console.log('[Import]   Base directory:', out.baseDir);
        console.log('[Import]   Files found:', JSON.stringify(out.filesFound, null, 2));
        console.log('[Import]   Counts:', JSON.stringify(out.counts, null, 2));
        console.log('[Import]   Data keys:', Object.keys(out.data));
        console.log('[Import]   Cruises array length:', out.data.cruises?.length || 0);
        console.log('[Import]   Booked array length:', out.data.booked?.length || 0);
        console.log('[Import]   Offers array length:', out.data.offers?.length || 0);
        
        if (out.data.cruises && out.data.cruises.length > 0) {
          console.log('[Import]   Cruises sample (first 3):', JSON.stringify(out.data.cruises.slice(0, 3), null, 2));
        } else {
          console.log('[Import]   ⚠️  NO CRUISES DATA FOUND');
        }
        
        if (out.data.booked && out.data.booked.length > 0) {
          console.log('[Import]   Booked sample (first 3):', JSON.stringify(out.data.booked.slice(0, 3), null, 2));
        } else {
          console.log('[Import]   ⚠️  NO BOOKED DATA FOUND');
        }
        
        if (out.data.offers && out.data.offers.length > 0) {
          console.log('[Import]   Offers sample (first 3):', JSON.stringify(out.data.offers.slice(0, 3), null, 2));
        } else {
          console.log('[Import]   ⚠️  NO OFFERS DATA FOUND');
        }
        
        console.log('[Import] ========================================');
        return {
          success: true,
          baseDir: out.baseDir,
          filesFound: out.filesFound,
          counts: out.counts,
          data: out.data,
        };
      } catch (error) {
        console.error('[Import] Failed to read DATA folder:', error);
        console.error('[Import] Error stack:', error instanceof Error ? error.stack : 'No stack trace');
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        };
      }
    }),

  // Load DATA from a GitHub repo (raw URLs) to avoid filesystem in serverless runtimes
  loadFromGithub: publicProcedure
    .input(z.object({
      repoUrlBase: z.string().url().default('https://raw.githubusercontent.com/royalcomputerconsulting/projectC-624/main/DATA'),
      clearExisting: z.boolean().default(true)
    }))
    .mutation( async ({ input }) => {
      console.log('[Import] ======== LOAD FROM GITHUB DATA (server-side) ========');
      const XLSX = await import('xlsx');

      const toUrl = (filename: string) => {
        const base = input.repoUrlBase.replace(/\/$/, '');
        return `${base}/${filename}`;
      };

      async function fetchText(url: string): Promise<string> {
        const res = await fetch(url);
        if (!res.ok) throw new Error(`Failed to fetch ${url}: ${res.status}`);
        return await res.text();
      }

      async function fetchXlsxRows(url: string): Promise<any[]> {
        const res = await fetch(url);
        if (!res.ok) throw new Error(`Failed to fetch ${url}: ${res.status}`);
        const buf = await res.arrayBuffer();
        const wb = XLSX.read(buf, { type: 'array' });
        let bestRows: any[] = [];
        wb.SheetNames.forEach((name) => {
          const ws = wb.Sheets[name];
          if (!ws) return;
          const rows = XLSX.utils.sheet_to_json(ws, { defval: '', raw: false });
          if (rows.length > bestRows.length) bestRows = rows as any[];
        });
        if (bestRows.length === 0 && wb.SheetNames.length) {
          const ws = wb.Sheets[wb.SheetNames[0]];
          const rows = XLSX.utils.sheet_to_json(ws, { defval: '', raw: false });
          bestRows = rows as any[];
        }
        return bestRows;
      }

      try {
        if (input.clearExisting) {
          console.log('[Import] Clearing existing data before GitHub load');
          memoryStore.clearAllData();
        }

        const [cruisesRows, bookedRows, offersRows, calendarIcs, tripitIcs] = await Promise.all([
          fetchXlsxRows(toUrl('cruises.xlsx')).catch(() => []),
          fetchXlsxRows(toUrl('booked.xlsx')).catch(() => []),
          fetchXlsxRows(toUrl('offers.xlsx')).catch(() => []),
          fetchText(toUrl('calendar.ics')).catch(() => ''),
          fetchText(toUrl('tripit.ics')).catch(() => ''),
        ]);

        console.log('[Import] GitHub rows counts:', {
          cruises: cruisesRows.length,
          booked: bookedRows.length,
          offers: offersRows.length,
          calendar: calendarIcs ? calendarIcs.length : 0,
          tripit: tripitIcs ? tripitIcs.length : 0,
        });

        // Minimal normalization reusing existing logic patterns
        const toISO = (v: any): string => {
          if (!v) return new Date().toISOString().split('T')[0];
          const d = new Date(v);
          return isNaN(d.getTime()) ? new Date().toISOString().split('T')[0] : d.toISOString().split('T')[0];
        };

        cruisesRows.forEach((r, idx) => {
          try {
            const depRaw = r['Sailing Date'] ?? r['Departure Date'] ?? r['Start Date'] ?? r['date'] ?? r['Date'];
            const departureDate = toISO(depRaw);
            const nights = parseInt(String(r['Nights'] ?? r['Night'] ?? r['nights'] ?? '7'), 10) || 7;
            const ret = new Date(departureDate);
            ret.setDate(ret.getDate() + nights);
            const returnDate = ret.toISOString().split('T')[0];
            const ship = String(r['Ship Name'] ?? r['Ship'] ?? 'Unknown Ship');
            memoryStore.createCruise({
              ship,
              itineraryName: String(r['Itinerary'] ?? r['Itinerary Name'] ?? ''),
              departurePort: String(r['Departure Port'] ?? ''),
              departureDate,
              returnDate,
              nights,
              line: String(r['Line'] ?? 'Royal Caribbean'),
              region: String(r['Region'] ?? ''),
              stateroomTypes: ['Interior','Oceanview','Balcony','Suite'],
              status: 'on_sale',
              cabinType: r['Cabin Type'] ? String(r['Cabin Type']) : undefined,
              portsRoute: String(r['All Ports'] ?? r['Ports/Route'] ?? r['Route'] ?? ''),
              pricingCurrent: (() => {
                const v = (r['Interior retail price'] ?? r['Interior Retail Price'] ?? r['Interior Price'] ?? r['Interior']);
                const num = typeof v === 'number' ? v : (typeof v === 'string' ? parseFloat(String(v).replace(/[^0-9.]/g, '')) : NaN);
                if (!isNaN(num) && num > 0) {
                  return { interior: num, source: 'xlsx', fetchedAt: new Date().toISOString() };
                }
                return undefined;
              })(),
            });
          } catch (e) {
            console.warn('[Import] Cruise row failed', idx + 1, e);
          }
        });

        bookedRows.forEach((r, idx) => {
          try {
            const startDate = toISO(r['Start Date']);
            let endDate = toISO(r['End Date']);
            const nights = parseInt(String(r['Nights'] ?? '7'), 10) || 7;
            if (!r['End Date']) {
              const ret = new Date(startDate);
              ret.setDate(ret.getDate() + nights);
              endDate = ret.toISOString().split('T')[0];
            }
            memoryStore.createBookedCruise({
              ship: String(r['Ship'] ?? 'Unknown Ship'),
              departureDate: startDate,
              returnDate: endDate,
              nights,
              itineraryName: String(r['Itinerary Name'] ?? ''),
              departurePort: String(r['Departure Port'] ?? ''),
              portsRoute: String(r['Ports/Route'] ?? ''),
              reservationNumber: String(r['Reservation #'] ?? ''),
              guests: parseInt(String(r['Guests'] ?? '2'), 10) || 2,
              daysToGo: parseInt(String(r['Days to Go'] ?? '0'), 10) || 0,
            });
          } catch (e) {
            console.warn('[Import] Booked row failed', idx + 1, e);
          }
        });

        offersRows.forEach((r, idx) => {
          try {
            const d = toISO(r['EXPIRES'] ?? r['Expires']);
            memoryStore.createCasinoOffer({
              name: String(r['NAME'] ?? 'Unknown'),
              rewardNumber: String(r['REWARD NUMBER'] ?? ''),
              offerName: String(r['OFFER NAME'] ?? 'Unknown Offer'),
              offerType: String(r['OFFER TYPE'] ?? 'Unknown'),
              expires: d,
              offerCode: String(r['OFFER CODE'] ?? ''),
              tradeInValue: String(r['TRADE IN VALUE'] ?? '$0'),
            });
          } catch (e) {
            console.warn('[Import] Offer row failed', idx + 1, e);
          }
        });

        if (calendarIcs) {
          try {
            const events = parseICalData(calendarIcs);
            events.forEach(ev => memoryStore.createCalendarEvent({ ...ev, source: 'tripit' } as any));
          } catch (e) {
            console.warn('[Import] calendar.ics parse failed', e);
          }
        }
        if (tripitIcs) {
          try {
            const events = parseICalData(tripitIcs);
            events.forEach(ev => memoryStore.createCalendarEvent({ ...ev, source: 'tripit' } as any));
          } catch (e) {
            console.warn('[Import] tripit.ics parse failed', e);
          }
        }

        await memoryStore.persistNow();

        const counts = {
          cruises: memoryStore.getCruises().length,
          booked: memoryStore.getBookedCruises().length,
          offers: memoryStore.getCasinoOffers().length,
          events: memoryStore.getCalendarEvents().length,
        };
        console.log('[Import] GitHub load complete. Counts:', counts);
        return { success: true, counts };
      } catch (error) {
        console.error('[Import] Failed to LOAD from GitHub DATA:', error);
        return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
      }
    }),

  // Import individual data types (non-destructive)
  importCruises: publicProcedure
    .input(z.object({
      data: z.array(z.any()),
      merge: z.boolean().default(true)
    }))
    .mutation(async ({ input }) => {
      console.log('[Import] Importing cruises independently:', input.data.length, 'merge:', input.merge);
      
      if (!input.merge) {
        // Clear only cruises
        memoryStore.cruises = [];
      }
      
      let processed = 0;
      input.data.forEach((cruise: any, index: number) => {
        try {
          const cruiseData = {
            ship: cruise['Ship Name'] || cruise.ship || 'Unknown Ship',
            itineraryName: cruise['Itinerary'] || cruise.itineraryName || 'Unknown Itinerary',
            departurePort: cruise['Departure Port'] || cruise.departurePort || 'Unknown Port',
            departureDate: cruise.departureDate || new Date().toISOString().split('T')[0],
            returnDate: cruise.returnDate || cruise.departureDate || new Date().toISOString().split('T')[0],
            nights: parseInt(String(cruise['Nights'] || cruise.nights || '7')),
            line: cruise['Line'] || cruise.line || 'Unknown Line',
            region: cruise['Region'] || cruise.region || 'Unknown',
            stateroomTypes: ['Interior', 'Oceanview', 'Balcony', 'Suite'],
            status: 'on_sale' as const,
            portsRoute: cruise['All Ports'] || cruise.portsRoute || '',
            pricingCurrent: cruise.pricingCurrent
          };
          memoryStore.createCruise(cruiseData);
          processed++;
        } catch (error) {
          console.error(`[Import] Error importing cruise ${index}:`, error);
        }
      });
      
      await memoryStore.persistNow();
      return { success: true, processed, total: input.data.length };
    }),

  importBooked: publicProcedure
    .input(z.object({
      data: z.array(z.any()),
      merge: z.boolean().default(true)
    }))
    .mutation(async ({ input }) => {
      console.log('[Import] Importing booked cruises independently:', input.data.length, 'merge:', input.merge);
      
      if (!input.merge) {
        // Clear only booked cruises
        memoryStore.bookedCruises = [];
      }
      
      let processed = 0;
      input.data.forEach((booked: any, index: number) => {
        try {
          const bookedData: Omit<import('@/types/models').BookedCruise, 'id' | 'createdAt' | 'updatedAt'> = {
            ship: booked['Ship'] || booked.ship || 'Unknown Ship',
            departureDate: booked.startDate || booked.departureDate || new Date().toISOString().split('T')[0],
            returnDate: booked.endDate || booked.returnDate || booked.startDate || new Date().toISOString().split('T')[0],
            nights: parseInt(String(booked['Nights'] || booked.nights || '7')),
            itineraryName: booked['Itinerary Name'] || booked.itineraryName || 'Unknown Itinerary',
            departurePort: booked['Departure Port'] || booked.departurePort || 'Unknown Port',
            portsRoute: booked['Ports/Route'] || booked.portsRoute || '',
            reservationNumber: String(booked['Reservation #'] || booked.reservationNumber || ''),
            guests: parseInt(String(booked['Guests'] || booked.guests || '2')),
            daysToGo: parseInt(String(booked['Days to Go'] || booked.daysToGo || '0'))
          };
          memoryStore.createBookedCruise(bookedData);
          processed++;
        } catch (error) {
          console.error(`[Import] Error importing booked cruise ${index}:`, error);
        }
      });
      
      await memoryStore.persistNow();
      return { success: true, processed, total: input.data.length };
    }),

  importOffers: publicProcedure
    .input(z.object({
      data: z.array(z.any()),
      merge: z.boolean().default(true)
    }))
    .mutation(async ({ input }) => {
      console.log('[Import] Importing offers independently:', input.data.length, 'merge:', input.merge);
      
      if (!input.merge) {
        // Clear only offers
        memoryStore.casinoOffers = [];
      }
      
      let processed = 0;
      input.data.forEach((offer: any, index: number) => {
        try {
          const offerData = {
            name: offer['NAME'] || offer.name || 'Unknown',
            rewardNumber: String(offer['REWARD NUMBER'] || offer.rewardNumber || ''),
            offerName: offer['OFFER NAME'] || offer.offerName || 'Unknown Offer',
            offerType: offer['OFFER TYPE'] || offer.offerType || 'Unknown',
            expires: offer.expires || new Date().toISOString().split('T')[0],
            offerCode: String(offer['OFFER CODE'] || offer.offerCode || ''),
            tradeInValue: String(offer['TRADE IN VALUE'] || offer.tradeInValue || '$0')
          };
          memoryStore.createCasinoOffer(offerData);
          processed++;
        } catch (error) {
          console.error(`[Import] Error importing offer ${index}:`, error);
        }
      });
      
      await memoryStore.persistNow();
      return { success: true, processed, total: input.data.length };
    }),

  importCalendar: publicProcedure
    .input(z.object({
      data: z.array(z.any()),
      merge: z.boolean().default(true)
    }))
    .mutation(async ({ input }) => {
      console.log('[Import] Importing calendar events independently:', input.data.length, 'merge:', input.merge);
      
      if (!input.merge) {
        // Clear only manual calendar events
        memoryStore.calendarEvents = memoryStore.calendarEvents.filter(e => e.source !== 'manual');
      }
      
      let processed = 0;
      input.data.forEach((event: any, index: number) => {
        try {
          const eventData = {
            summary: event.summary || event.Summary || 'Event',
            startDate: event.startDate || event['Start Date'] || new Date().toISOString().split('T')[0],
            endDate: event.endDate || event['End Date'] || event.startDate || new Date().toISOString().split('T')[0],
            description: String(event.description || event.Description || ''),
            location: String(event.location || event.Location || ''),
            source: 'manual' as const
          };
          memoryStore.createCalendarEvent(eventData);
          processed++;
        } catch (error) {
          console.error(`[Import] Error importing calendar event ${index}:`, error);
        }
      });
      
      await memoryStore.persistNow();
      return { success: true, processed, total: input.data.length };
    }),

  importTripit: publicProcedure
    .input(z.object({
      data: z.array(z.any()),
      merge: z.boolean().default(true)
    }))
    .mutation(async ({ input }) => {
      console.log('[Import] Importing TripIt events independently:', input.data.length, 'merge:', input.merge);
      
      if (!input.merge) {
        // Clear only tripit calendar events
        memoryStore.calendarEvents = memoryStore.calendarEvents.filter(e => e.source !== 'tripit');
      }
      
      let processed = 0;
      input.data.forEach((event: any, index: number) => {
        try {
          const eventData = {
            summary: event.summary || event.Summary || 'Event',
            startDate: event.startDate || event['Start Date'] || new Date().toISOString().split('T')[0],
            endDate: event.endDate || event['End Date'] || event.startDate || new Date().toISOString().split('T')[0],
            description: String(event.description || event.Description || ''),
            location: String(event.location || event.Location || ''),
            source: 'tripit' as const
          };
          memoryStore.createCalendarEvent(eventData);
          processed++;
        } catch (error) {
          console.error(`[Import] Error importing tripit event ${index}:`, error);
        }
      });
      
      await memoryStore.persistNow();
      return { success: true, processed, total: input.data.length };
    }),

  importFinancials: publicProcedure
    .input(z.object({
      data: z.array(z.any()),
      merge: z.boolean().default(true)
    }))
    .mutation(async ({ input }) => {
      console.log('[Import] Importing financials independently:', input.data.length, 'merge:', input.merge);
      
      if (!input.merge) {
        // Clear only financials
        const current = memoryStore.getFinancials() || [];
        current.forEach((f: any) => {
          if (f.id) {
            try { (memoryStore as any).deleteFinancial?.(f.id); } catch {}
          }
        });
      }
      
      let processed = 0;
      input.data.forEach((item: any, index: number) => {
        try {
          const financialData: Omit<import('@/types/models').FinancialsRecord,'id'|'createdAt'|'updatedAt'> = {
            cruiseId: item.cruiseId || item.CruiseId || '',
            shipName: item.shipName || item.Ship || undefined,
            sailDateStart: item.sailDateStart || item.SailStart || undefined,
            sailDateEnd: item.sailDateEnd || item.SailEnd || undefined,
            itineraryName: item.itineraryName || item.Itinerary || undefined,
            sourceType: (item.sourceType || item.SourceType || 'receipt') as import('@/types/models').FinancialSourceType,
            processedAt: new Date().toISOString(),
            verified: false,
            category: item.category || item.Category,
            description: item.description || item.Description || undefined,
            itemDescription: item.itemDescription || item.ItemDescription || undefined,
            amount: parseFloat(String(item.amount || item.Amount || '0')) || 0,
            lineTotal: parseFloat(String(item.lineTotal || item.LineTotal || item.amount || '0')) || 0,
            tax: parseFloat(String(item.tax || item.Tax || '0')) || 0,
            gratuity: parseFloat(String(item.gratuity || item.Gratuity || '0')) || 0,
            paymentMethod: item.paymentMethod || item.PaymentMethod,
            currency: 'USD'
          };
          memoryStore.addFinancials([financialData]);
          processed++;
        } catch (error) {
          console.error(`[Import] Error importing financial record ${index}:`, error);
        }
      });
      
      await memoryStore.persistNow();
      return { success: true, processed, total: input.data.length };
    }),

  importUserProfile: publicProcedure
    .input(z.object({
      data: z.any()
    }))
    .mutation(async ({ input }) => {
      console.log('[Import] Importing user profile:', input.data);
      
      try {
        // Store user profile data in memory store or handle as needed
        // This is a simple implementation - adjust based on your needs
        console.log('[Import] User profile imported:', {
          name: input.data.name,
          crownAnchorNumber: input.data.crownAnchorNumber,
          loyaltyPoints: input.data.loyaltyPoints,
          clubRoyalePoints: input.data.clubRoyalePoints
        });
        
        return { success: true, data: input.data };
      } catch (error) {
        console.error('[Import] Error importing user profile:', error);
        return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
      }
    }),

  // Load DATA folder into memory store and persist to disk
  loadFromDataFolder: publicProcedure
    .mutation(async () => {
      console.log('[Import] ======== LOAD FROM DATA FOLDER (server-side) ========');
      try {
        const { preloadFromDataFolder } = await import('./startup');
        const summary = await preloadFromDataFolder();
        console.log('[Import] preloadFromDataFolder summary:', summary);
        
        // Always persist immediately after load to ensure durability
        await memoryStore.persistNow();
        
        const finalCounts = {
          cruises: memoryStore.getCruises().length,
          booked: memoryStore.getBookedCruises().length,
          offers: memoryStore.getCasinoOffers().length,
          events: memoryStore.getCalendarEvents().length,
        };
        console.log('[Import] Final counts after load:', finalCounts);
        
        return {
          success: true,
          summary,
          counts: finalCounts,
          lastImport: memoryStore.lastImport,
        };
      } catch (error) {
        console.error('[Import] Failed to LOAD from DATA folder:', error);
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        };
      }
    }),

  // Manual trigger for startup data import
  triggerStartupImport: publicProcedure
    .mutation(async () => {
      console.log('[Import] Manual trigger for startup data import');
      
      try {
        // Import the startup function
        const { preloadFromDataFolder } = await import('./startup');
        
        // Run the startup import
        const result = await preloadFromDataFolder();
        
        console.log('[Import] Startup import result:', result);
        
        return {
          success: result.ok,
          message: result.message || 'Startup import completed',
          imported: result.imported,
          filesFound: result.filesFound,
          baseDir: result.baseDir
        };
      } catch (error) {
        console.error('[Import] Startup import failed:', error);
        throw new Error(`Startup import failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }),





  // Helper function to parse iCal data
  parseICalData: publicProcedure
    .input(z.object({
      icalData: z.string()
    }))
    .mutation(({ input }) => {
      return parseICalData(input.icalData);
    }),

  exportCsv: publicProcedure
    .input(z.object({
      sheetType: z.enum(['cruises', 'booked', 'casino_offers', 'all'])
    }))
    .query(({ input }) => {
      console.log('[tRPC] Exporting CSV for sheet type:', input.sheetType);
      
      let csvContent = '';
      
      switch (input.sheetType) {
        case 'cruises':
          const cruises = memoryStore.getCruises();
          csvContent = 'Ship Name,Itinerary,Departure Port,Departure Date,Return Date,Nights,Line,Region,Cabin Type,Status\n';
          cruises.forEach(cruise => {
            csvContent += `"${cruise.ship}","${cruise.itineraryName}","${cruise.departurePort}","${cruise.departureDate}","${cruise.returnDate}",${cruise.nights},"${cruise.line}","${cruise.region || ''}","${cruise.cabinType || ''}","${cruise.status}"\n`;
          });
          break;
          
        case 'booked':
          const bookedCruises = memoryStore.getBookedCruises();
          csvContent = 'Ship,Start Date,End Date,Nights,Itinerary Name,Departure Port,Ports/Route,Reservation #,Guests,Days to Go,Paid Fare,Actual Savings,Projected Savings\n';
          bookedCruises.forEach(cruise => {
            csvContent += `"${cruise.ship}","${cruise.departureDate}","${cruise.returnDate}",${cruise.nights},"${cruise.itineraryName}","${cruise.departurePort}","${cruise.portsRoute || ''}","${cruise.reservationNumber || ''}",${cruise.guests || 2},${cruise.daysToGo || 0},${(cruise as any).paidFare || 0},${(cruise as any).actualSavings || 0},${(cruise as any).projectedSavings || 0}\n`;
          });
          break;
          
        case 'casino_offers':
          const casinoOffers = memoryStore.getCasinoOffers();
          csvContent = 'NAME,REWARD NUMBER,OFFER NAME,OFFER TYPE,EXPIRES,OFFER CODE,TRADE IN VALUE\n';
          casinoOffers.forEach(offer => {
            csvContent += `"${offer.name}","${offer.rewardNumber}","${offer.offerName}","${offer.offerType}","${offer.expires}","${offer.offerCode}","${offer.tradeInValue}"\n`;
          });
          break;
          
        case 'all':
          // Export all sheets in one file with separators
          csvContent = '=== CRUISES ===\n';
          csvContent += 'Ship Name,Itinerary,Departure Port,Departure Date,Return Date,Nights,Line,Region,Status\n';
          memoryStore.getCruises().forEach(cruise => {
            csvContent += `"${cruise.ship}","${cruise.itineraryName}","${cruise.departurePort}","${cruise.departureDate}","${cruise.returnDate}",${cruise.nights},"${cruise.line}","${cruise.region || ''}","${cruise.status}"\n`;
          });
          
          csvContent += '\n=== BOOKED CRUISES ===\n';
          csvContent += 'Ship,Start Date,End Date,Nights,Itinerary Name,Departure Port,Ports/Route,Reservation #,Guests,Days to Go\n';
          memoryStore.getBookedCruises().forEach(cruise => {
            csvContent += `"${cruise.ship}","${cruise.departureDate}","${cruise.returnDate}",${cruise.nights},"${cruise.itineraryName}","${cruise.departurePort}","${cruise.portsRoute || ''}","${cruise.reservationNumber || ''}",${cruise.guests || 2},${cruise.daysToGo || 0}\n`;
          });
          
          csvContent += '\n=== CASINO OFFERS ===\n';
          csvContent += 'NAME,REWARD NUMBER,OFFER NAME,OFFER TYPE,EXPIRES,OFFER CODE,TRADE IN VALUE\n';
          memoryStore.getCasinoOffers().forEach(offer => {
            csvContent += `"${offer.name}","${offer.rewardNumber}","${offer.offerName}","${offer.offerType}","${offer.expires}","${offer.offerCode}","${offer.tradeInValue}"\n`;
          });
          break;
      }
      
      return {
        csvContent,
        filename: `project-z-${input.sheetType}-${new Date().toISOString().split('T')[0]}.csv`
      };
    }),

  // Generate XLSX workbooks for export
  exportXlsx: publicProcedure
    .input(z.object({
      sheet: z.enum(['cruises', 'booked', 'offers', 'financials'])
    }))
    .query(async ({ input }) => {
      console.log('[tRPC] Exporting XLSX for sheet:', input.sheet);
      const XLSX = await import('xlsx');

      const makeWorkbook = (sheets: Record<string, any[]>): { base64: string; filename: string; mimeType: string } => {
        const wb = XLSX.utils.book_new();
        Object.entries(sheets).forEach(([name, rows]) => {
          const ws = XLSX.utils.json_to_sheet(rows);
          XLSX.utils.book_append_sheet(wb, ws, name.slice(0, 31));
        });
        const filename = `project-z-${Object.keys(sheets).join('-')}-${new Date().toISOString().split('T')[0]}.xlsx`;
        const wbuf: ArrayBuffer = XLSX.write(wb, { type: 'array', bookType: 'xlsx' });
        const base64 = Buffer.from(wbuf as any).toString('base64');
        return { base64, filename, mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' };
      };

      switch (input.sheet) {
        case 'cruises': {
          const rows = memoryStore.getCruises().map(c => ({
            Ship: c.ship,
            Itinerary: c.itineraryName,
            DeparturePort: c.departurePort,
            DepartureDate: c.departureDate,
            ReturnDate: c.returnDate,
            Nights: c.nights,
            Line: c.line,
            Region: c.region ?? '',
            CabinType: c.cabinType ?? '',
            Status: c.status,
            'Interior retail price': c.pricingCurrent?.interior ?? c.pricing?.interior ?? '',
            'All Ports': c.portsRoute || (Array.isArray(c.ports) ? c.ports.map(p => p.name).join(', ') : '')
          }));

          const wb = XLSX.utils.book_new();
          const ws = XLSX.utils.json_to_sheet(rows);
          XLSX.utils.book_append_sheet(wb, ws, 'CRUISES');
          const wbuf: ArrayBuffer = XLSX.write(wb, { type: 'array', bookType: 'xlsx' });
          const base64 = Buffer.from(wbuf as any).toString('base64');
          const filename = `project-z-CRUISES-${new Date().toISOString().split('T')[0]}.xlsx`;

          try {
            const { isDiskWritable, fsSafe } = await import('@/backend/trpc/routes/_utils/fsSupport');
            const pathMod = await import('path');
            if (isDiskWritable() && fsSafe) {
              const outXlsx = pathMod.join(process.cwd(), 'DATA', 'cruises.xlsx');
              const outCsv = pathMod.join(process.cwd(), 'DATA', 'cruises.csv');
              try { await fsSafe.mkdir(pathMod.dirname(outXlsx), { recursive: true }); } catch {}
              try { await fsSafe.writeFile(outXlsx, Buffer.from(base64, 'base64')); } catch {}
              try { const csv = XLSX.utils.sheet_to_csv(ws); await fsSafe.writeFile(outCsv, csv, 'utf8'); } catch {}
            }
          } catch {}

          return { base64, filename, mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' };
        }
        case 'booked': {
          const unify = (items: any[]) => items.filter(Boolean);
          const fromUnified = memoryStore.getBookedCruises();
          const fromCompleted = memoryStore.getCompletedCruises();
          const fromLegacy = memoryStore.bookedCruises || [];

          const mergedMap = new Map<string, any>();
          unify([...fromUnified, ...fromCompleted, ...fromLegacy]).forEach((c: any) => {
            const start = (c.startDate || c.departureDate || '').trim();
            const key = `${(c.ship || '').trim()}__${start}__${(c.reservationNumber || '').trim()}`.toLowerCase();
            if (!mergedMap.has(key)) mergedMap.set(key, c);
          });
          const merged = Array.from(mergedMap.values());

          const rows = merged.map((c: any) => {
            const start = (c.startDate || c.departureDate || '').trim();
            const end = (c.endDate || c.returnDate || '').trim();
            return {
              Ship: c.ship,
              StartDate: start,
              EndDate: end || start,
              Nights: c.nights,
              ItineraryName: c.itineraryName,
              DeparturePort: c.departurePort,
              PortsRoute: c.portsRoute ?? '',
              Reservation: c.reservationNumber ?? '',
              Guests: c.guests ?? 2,
              DaysToGo: c.daysToGo ?? 0,
              PaidFare: (c as any).paidFare ?? 0,
              ActualSavings: (c as any).actualSavings ?? 0,
              ProjectedSavings: (c as any).projectedSavings ?? 0
            };
          });

          const wb = XLSX.utils.book_new();
          const ws = XLSX.utils.json_to_sheet(rows);
          XLSX.utils.book_append_sheet(wb, ws, 'BOOKED');
          const wbuf: ArrayBuffer = XLSX.write(wb, { type: 'array', bookType: 'xlsx' });
          const base64 = Buffer.from(wbuf as any).toString('base64');
          const filename = `project-z-BOOKED-${new Date().toISOString().split('T')[0]}.xlsx`;

          try {
            const { isDiskWritable, fsSafe } = await import('@/backend/trpc/routes/_utils/fsSupport');
            const pathMod = await import('path');
            if (isDiskWritable() && fsSafe) {
              const outXlsx = pathMod.join(process.cwd(), 'DATA', 'booked.xlsx');
              const outCsv = pathMod.join(process.cwd(), 'DATA', 'booked.csv');
              try {
                await fsSafe.mkdir(pathMod.dirname(outXlsx), { recursive: true });
              } catch {}
              try {
                await fsSafe.writeFile(outXlsx, Buffer.from(base64, 'base64'));
              } catch {}
              try {
                const csv = XLSX.utils.sheet_to_csv(ws);
                await fsSafe.writeFile(outCsv, csv, 'utf8');
              } catch {}
            }
          } catch {}

          return { base64, filename, mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' };
        }
        case 'offers': {
          const rows = memoryStore.getCasinoOffers().map(o => ({
            Name: o.name,
            RewardNumber: o.rewardNumber,
            OfferName: o.offerName,
            OfferType: o.offerType,
            Expires: o.expires,
            OfferCode: o.offerCode,
            TradeInValue: o.tradeInValue
          }));

          const wb = XLSX.utils.book_new();
          const ws = XLSX.utils.json_to_sheet(rows);
          XLSX.utils.book_append_sheet(wb, ws, 'OFFERS');
          const wbuf: ArrayBuffer = XLSX.write(wb, { type: 'array', bookType: 'xlsx' });
          const base64 = Buffer.from(wbuf as any).toString('base64');
          const filename = `project-z-OFFERS-${new Date().toISOString().split('T')[0]}.xlsx`;

          try {
            const { isDiskWritable, fsSafe } = await import('@/backend/trpc/routes/_utils/fsSupport');
            const pathMod = await import('path');
            if (isDiskWritable() && fsSafe) {
              const outXlsx = pathMod.join(process.cwd(), 'DATA', 'offers.xlsx');
              const outCsv = pathMod.join(process.cwd(), 'DATA', 'offers.csv');
              try { await fsSafe.mkdir(pathMod.dirname(outXlsx), { recursive: true }); } catch {}
              try { await fsSafe.writeFile(outXlsx, Buffer.from(base64, 'base64')); } catch {}
              try { const csv = XLSX.utils.sheet_to_csv(ws); await fsSafe.writeFile(outCsv, csv, 'utf8'); } catch {}
            }
          } catch {}

          return { base64, filename, mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' };
        }
        case 'financials': {
          let fin = memoryStore.getFinancials();
          if (!fin || fin.length === 0) {
            try {
              const { readFileSync, existsSync } = await import('fs');
              const pathMod = await import('path');
              const primary = pathMod.join(process.cwd(), 'DATA', 'financials.database.csv');
              const alt1 = pathMod.join(process.cwd(), 'DATA', 'FINANCIALS', 'financials.csv');
              const alt2 = pathMod.join(process.cwd(), 'DATA', 'financials.csv');
              const target = [primary, alt1, alt2].find(p => existsSync(p));
              if (target) {
                const csv = readFileSync(target, 'utf8');
                const lines = csv.split(/\r?\n/).filter(l => l.trim().length > 0);
                const headers = lines.shift()?.split(',') || [];
                const idx = (h: string) => headers.findIndex(x => x.trim().toLowerCase() === h.toLowerCase());
                const nowIso = new Date().toISOString();
                const created: Omit<import('@/types/models').FinancialsRecord,'id'|'createdAt'|'updatedAt'>[] = lines.map(line => {
                  const cols = line.split(',');
                  const safe = (i: number) => (i >= 0 && i < cols.length ? cols[i] : '').trim();
                  const amountStr = safe(idx('Amount')) || safe(idx('LineTotal'));
                  const amt = parseFloat(amountStr || '0') || 0;
                  const pm = safe(idx('PaymentMethod'));
                  const category = safe(idx('Category'));
                  const validPm = ['SeaPass','OBC','Credit Card','Promo'].includes(pm) ? (pm as 'SeaPass'|'OBC'|'Credit Card'|'Promo') : undefined;
                  const validCategory = ['Food & Beverage','Retail','Spa','ShoreEx','Casino','Gratuity','Tax/Fees','Other'].includes(category) ? (category as any) : undefined;
                  return {
                    cruiseId: safe(idx('CruiseId')),
                    shipName: safe(idx('Ship')) || undefined,
                    sailDateStart: safe(idx('SailStart')) || undefined,
                    sailDateEnd: safe(idx('SailEnd')) || undefined,
                    itineraryName: safe(idx('Itinerary')) || undefined,
                    sourceType: (safe(idx('SourceType')) as import('@/types/models').FinancialSourceType) || 'receipt',
                    processedAt: nowIso,
                    verified: false,
                    category: validCategory,
                    description: safe(idx('Description')) || undefined,
                    itemDescription: safe(idx('ItemDescription')) || undefined,
                    amount: isNaN(amt) ? 0 : amt,
                    lineTotal: isNaN(amt) ? 0 : amt,
                    tax: parseFloat(safe(idx('Tax')) || '0') || 0,
                    gratuity: parseFloat(safe(idx('Gratuity')) || '0') || 0,
                    paymentMethod: validPm,
                    currency: 'USD'
                  };
                });
                if (created.length > 0) {
                  memoryStore.addFinancials(created);
                  fin = memoryStore.getFinancials();
                }
              }
            } catch (e) {
              console.warn('[Export] Financials CSV preload failed:', e);
            }
          }

          const rows = fin.map(f => ({
            CruiseId: f.cruiseId,
            Ship: f.shipName ?? '',
            SailStart: f.sailDateStart ?? '',
            SailEnd: f.sailDateEnd ?? '',
            Itinerary: f.itineraryName ?? '',
            SourceType: f.sourceType,
            Category: f.category ?? '',
            Description: f.description ?? f.itemDescription ?? '',
            Amount: f.amount ?? f.lineTotal ?? 0,
            Tax: f.tax ?? 0,
            Gratuity: f.gratuity ?? 0,
            PaymentMethod: f.paymentMethod ?? '',
            CreatedAt: f.createdAt
          }));

          const wb = XLSX.utils.book_new();
          const ws = XLSX.utils.json_to_sheet(rows);
          XLSX.utils.book_append_sheet(wb, ws, 'FINANCIALS');
          const wbuf: ArrayBuffer = XLSX.write(wb, { type: 'array', bookType: 'xlsx' });
          const base64 = Buffer.from(wbuf as any).toString('base64');
          const filename = `project-z-FINANCIALS-${new Date().toISOString().split('T')[0]}.xlsx`;

          try {
            const { isDiskWritable, fsSafe } = await import('@/backend/trpc/routes/_utils/fsSupport');
            const pathMod = await import('path');
            if (isDiskWritable() && fsSafe) {
              const dir = pathMod.join(process.cwd(), 'DATA', 'FINANCIALS');
              const outXlsx = pathMod.join(dir, 'financials.xlsx');
              const outCsv = pathMod.join(dir, 'financials.csv');
              try { await fsSafe.mkdir(dir, { recursive: true }); } catch {}
              try { await fsSafe.writeFile(outXlsx, Buffer.from(base64, 'base64')); } catch {}
              try { const csv = XLSX.utils.sheet_to_csv(ws); await fsSafe.writeFile(outCsv, csv, 'utf8'); } catch {}
            }
          } catch {}

          return { base64, filename, mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' };
        }
      }
    }),

  // Export calendar events as ICS text
  exportIcs: publicProcedure
    .query(() => {
      console.log('[tRPC] Exporting ICS from calendar events');
      const events = memoryStore.getCalendarEvents();
      const lines: string[] = [
        'BEGIN:VCALENDAR',
        'VERSION:2.0',
        'PRODID:-//Project Z//Calendar//EN'
      ];
      events.forEach((e) => {
        lines.push('BEGIN:VEVENT');
        lines.push(`SUMMARY:${e.summary}`);
        lines.push(`DTSTART;VALUE=DATE:${e.startDate.replace(/-/g, '')}`);
        lines.push(`DTEND;VALUE=DATE:${(e.endDate || e.startDate).replace(/-/g, '')}`);
        if (e.location) lines.push(`LOCATION:${e.location}`);
        if (e.description) lines.push(`DESCRIPTION:${String(e.description).replace(/\n/g, '\\n').replace(/,/g, '\\,')}`);
        lines.push('END:VEVENT');
      });
      lines.push('END:VCALENDAR');
      const ics = lines.join('\n');
      return { filename: `project-z-events-${new Date().toISOString().split('T')[0]}.ics`, ics };
    }),

  loadDateRange: publicProcedure
    .input(z.object({
      startDate: z.string(),
      endDate: z.string(),
      searchOnly: z.boolean().default(false)
    }))
    .mutation(async ({ input }) => {
      console.log('[tRPC] Loading cruises by date range:', input.startDate, 'to', input.endDate, 'searchOnly:', input.searchOnly);
      
      try {
        // Get cruises from the memory store (which should have your imported data)
        const allCruises = memoryStore.getCruises();
        console.log('[tRPC] Total cruises in memory store:', allCruises.length);
        
        // Filter cruises by date range
        const startDateObj = new Date(input.startDate);
        const endDateObj = new Date(input.endDate);
        
        const filteredCruises = allCruises.filter(cruise => {
          const cruiseDate = new Date(cruise.departureDate);
          return cruiseDate >= startDateObj && cruiseDate <= endDateObj;
        });
        
        console.log('[tRPC] Found', filteredCruises.length, 'cruises in date range');
        
        if (input.searchOnly) {
          // Just return the search results without adding to store
          return {
            cruises: filteredCruises.map(c => ({
              ship: c.ship,
              itineraryName: c.itineraryName,
              departurePort: c.departurePort,
              departureDate: c.departureDate,
              nights: c.nights,
              line: c.line,
              region: c.region,
              status: c.status
            })),
            searchOnly: true
          };
        }
        
        // Since we're loading from existing data, just return the filtered results
        console.log('[tRPC] Returning', filteredCruises.length, 'cruises from imported data');
        
        return {
          cruises: filteredCruises.map(c => ({
            ship: c.ship,
            itineraryName: c.itineraryName,
            departurePort: c.departurePort,
            departureDate: c.departureDate,
            nights: c.nights,
            line: c.line,
            region: c.region,
            status: c.status
          })),
          cruisesAdded: 0, // Not adding new cruises, just filtering existing ones
          searchOnly: false
        };
        
      } catch (error) {
        console.error('[tRPC] Failed to load cruises by date range:', error);
        throw new Error(`Failed to load cruises: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }),
});

// Helper function to parse iCal data
function parseICalData(icalData: string) {
  const events: {
    summary: string;
    location?: string;
    startDate: string;
    endDate: string;
    description?: string;
    source: 'tripit';
  }[] = [];
  
  const lines = icalData.split('\n').map(line => line.trim());
  let currentEvent: any = null;
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    
    if (line === 'BEGIN:VEVENT') {
      currentEvent = {
        summary: '',
        startDate: '',
        endDate: '',
        location: '',
        description: '',
        source: 'tripit' as const
      };
    } else if (line === 'END:VEVENT' && currentEvent) {
      if (currentEvent.summary && currentEvent.startDate) {
        events.push(currentEvent);
      }
      currentEvent = null;
    } else if (currentEvent && line.includes(':')) {
      const [key, ...valueParts] = line.split(':');
      const value = valueParts.join(':');
      
      switch (key) {
        case 'SUMMARY':
          currentEvent.summary = value;
          break;
        case 'DTSTART':
        case 'DTSTART;VALUE=DATE':
          currentEvent.startDate = parseICalDate(value);
          break;
        case 'DTEND':
        case 'DTEND;VALUE=DATE':
          currentEvent.endDate = parseICalDate(value);
          break;
        case 'LOCATION':
          currentEvent.location = value;
          break;
        case 'DESCRIPTION':
          currentEvent.description = value.replace(/\\n/g, '\n').replace(/\\,/g, ',');
          break;
      }
    }
  }
  
  return events;
}

function parseICalDate(dateStr: string): string {
  try {
    if (dateStr.length === 8) {
      const year = dateStr.substring(0, 4);
      const month = dateStr.substring(4, 6);
      const day = dateStr.substring(6, 8);
      return `${year}-${month}-${day}`;
    } else if (dateStr.includes('T')) {
      const datePart = dateStr.split('T')[0];
      const year = datePart.substring(0, 4);
      const month = datePart.substring(4, 6);
      const day = datePart.substring(6, 8);
      return `${year}-${month}-${day}`;
    } else {
      const date = new Date(dateStr);
      if (!isNaN(date.getTime())) {
        return date.toISOString().split('T')[0];
      }
    }
    
    return new Date().toISOString().split('T')[0];
  } catch {
    return new Date().toISOString().split('T')[0];
  }
}

