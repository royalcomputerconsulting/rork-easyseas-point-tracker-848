import type { Cruise, BookedCruise, Offer, CasinoOffer } from "@/types/models";
import { parseDateStrict } from "./date";

export function parseCsvData(rows: any[][], type: string, filterNext90Days: boolean = true): any[] {
  if (!rows || rows.length < 2) return [];
  
  const headers = rows[0];
  const data = rows.slice(1);
  
  console.log(`Parsing ${type} with ${data.length} rows`);
  
  switch (type) {
    case "cruises":
      return parseCruises(headers, data, filterNext90Days);
    case "booked":
      return parseBookedCruises(headers, data, filterNext90Days);
    case "offers":
      return parseOffers(headers, data);
    default:
      return [];
  }
}

export function parseExcelData(data: any[], type: string, filterNext90Days: boolean = true): any[] {
  if (!data || data.length === 0) return [];
  
  console.log(`Parsing Excel ${type} with ${data.length} rows`);
  
  switch (type) {
    case "cruises":
      return parseExcelCruises(data, filterNext90Days);
    case "booked":
      return parseExcelBookedCruises(data, filterNext90Days);
    case "offers":
      return parseExcelOffers(data);
    default:
      return [];
  }
}

function parseExcelCruises(data: any[], filterNext90Days: boolean = true): Partial<Cruise>[] {
  const cruises: Partial<Cruise>[] = [];
  const today = new Date();
  const next90Days = new Date(today.getTime() + (90 * 24 * 60 * 60 * 1000));
  
  console.log(`[Import] Filtering cruises for next 90 days: ${filterNext90Days}`);
  console.log(`[Import] Date range: ${today.toISOString().split('T')[0]} to ${next90Days.toISOString().split('T')[0]}`);
  
  for (const row of data) {
    if (!row || typeof row !== 'object') continue;
    
    try {
      const sailingRaw = row['Sailing Date'] || row['SAILING DATE'] || row['SALING DATE'] || row['Saling Date'] || row.departureDate || row['Departure Date'];
      const departureDate = parseDateStrict(sailingRaw) || '';
      
      // Apply 90-day filter if enabled
      if (filterNext90Days && departureDate) {
        const cruiseDate = new Date(departureDate);
        if (cruiseDate < today || cruiseDate > next90Days) {
          continue; // Skip cruises outside the 90-day window
        }
      }
      
      const nightsVal = parseInt(String(row['Nights'] || row['NIGHTS'] || row.nights || '7'));
      let returnDate: string | undefined = undefined;
      if (departureDate && nightsVal && nightsVal > 0) {
        const d = new Date(departureDate);
        const ret = new Date(d.getTime() + nightsVal * 24 * 60 * 60 * 1000);
        returnDate = `${ret.getFullYear()}-${String(ret.getMonth() + 1).padStart(2, '0')}-${String(ret.getDate()).padStart(2, '0')}`;
      }
      
      const cruise: Partial<Cruise> = {
        ship: (row['Ship Name'] || row['SHIP NAME'] || row.ship || '').toString().replace(/\s*\[R\]\s*/g, '').replace(/\s*®\s*/g, '').replace(/\s*™\s*/g, '').trim(),
        itineraryName: (row['Itinerary'] || row['ITINERARY'] || row.itineraryName || '').toString(),
        departurePort: (row['Departure Port'] || row['DEPARTURE PORT'] || row.departurePort || '').toString(),
        nights: nightsVal,
        departureDate,
        returnDate,
        line: 'Royal Caribbean',
        region: 'Caribbean',
        status: 'on_sale' as const,
        cabinType: (row['Cabin Type'] || row['CABIN TYPE'] || row.cabinType || 'Interior').toString(),
      };
      
      if (cruise.ship && cruise.departureDate) {
        cruises.push(cruise);
      }
    } catch (error) {
      console.error('Error parsing cruise row:', error);
    }
  }
  
  console.log(`[Import] Parsed ${cruises.length} cruises after filtering`);
  return cruises;
}

function parseExcelBookedCruises(data: any[], filterNext90Days: boolean = true): Partial<BookedCruise>[] {
  const booked: Partial<BookedCruise>[] = [];
  const today = new Date();
  const next90Days = new Date(today.getTime() + (90 * 24 * 60 * 60 * 1000));
  
  console.log(`[Import] Filtering booked cruises for next 90 days: ${filterNext90Days}`);
  
  for (const row of data) {
    if (!row || typeof row !== 'object') continue;
    
    try {
      const startDate = parseDateStrict(row['Start Date'] || row['START DATE'] || row.startDate) || '';
      
      // Apply 90-day filter if enabled
      if (filterNext90Days && startDate) {
        const cruiseDate = new Date(startDate);
        if (cruiseDate < today || cruiseDate > next90Days) {
          continue; // Skip booked cruises outside the 90-day window
        }
      }
      
      const booking: Partial<BookedCruise> = {
        ship: (row['Ship'] || row['SHIP'] || row.ship || '').toString().replace(/\s*\[R\]\s*/g, '').replace(/\s*®\s*/g, '').replace(/\s*™\s*/g, '').trim(),
        departureDate: startDate,
        returnDate: parseDateStrict(row['End Date'] || row['END DATE'] || row.endDate) || '',
        nights: parseInt(String(row['Nights'] || row['NIGHTS'] || row.nights || '7')),
        itineraryName: (row['Itinerary Name'] || row['ITINERARY NAME'] || row.itineraryName || '').toString(),
        reservationNumber: String(row['Reservation'] || row['RESERVATION'] || row.reservationNumber || ''),
        guests: parseInt(String(row['Guests'] || row['GUESTS'] || row.guests || '2')),
        paidFare: parseFloat(String(row['Paid Fare'] || row['PAID FARE'] || row.paidFare || '0')) || 0,
        actualFare: parseFloat(String(row['Actual Fare'] || row['ACTUAL FARE'] || row.actualFare || '0')) || 0,
      };
      
      if (booking.ship && booking.departureDate) {
        booked.push(booking);
      }
    } catch (error) {
      console.error('Error parsing booked row:', error);
    }
  }
  
  console.log(`[Import] Parsed ${booked.length} booked cruises after filtering`);
  return booked;
}

function parseExcelOffers(data: any[]): Partial<CasinoOffer>[] {
  const offers: Partial<CasinoOffer>[] = [];
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  console.log(`[Import] Filtering offers - removing expired offers`);
  
  for (const row of data) {
    if (!row || typeof row !== 'object') continue;
    
    try {
      // Support both old and new column formats
      const expires = parseDateStrict(
        row['Offer Expiry Date'] || 
        row['Expires'] || 
        row['EXPIRES'] || 
        row.expires || 
        row.offerExpiryDate
      ) || '';
      
      // Filter out expired offers
      if (expires) {
        const expiryDate = new Date(expires);
        expiryDate.setHours(0, 0, 0, 0);
        if (expiryDate < today) {
          continue; // Skip expired offers
        }
      }
      
      // Parse sailing dates (support both formats)
      const sailingDateRaw = row['Sailing Date'] || row['SAILING DATE'] || row['sailingDate'] || '';
      const sailingDatesRaw = row['Sailing Dates'] || row['SAILING DATES'] || row['sailingDates'] || row['Sailing dates'] || '';
      
      let sailingDates: string[] | undefined = undefined;
      if (sailingDateRaw) {
        const parsed = parseDateStrict(sailingDateRaw);
        sailingDates = parsed ? [parsed] : undefined;
      } else if (sailingDatesRaw) {
        const datesStr = String(sailingDatesRaw);
        if (datesStr.includes(',')) {
          sailingDates = datesStr.split(',').map(d => {
            const parsed = parseDateStrict(d.trim());
            return parsed || d.trim();
          }).filter(Boolean);
        } else if (datesStr.trim()) {
          const parsed = parseDateStrict(datesStr.trim());
          sailingDates = parsed ? [parsed] : [datesStr.trim()];
        }
      }
      
      // Parse ships (support both formats)
      const shipNameRaw = row['Ship Name'] || row['SHIP NAME'] || row['shipName'] || '';
      const shipsRaw = row['Ships'] || row['SHIPS'] || row['ships'] || row['Ship'] || row['SHIP'] || row['ship'] || '';
      
      let ships: string[] | undefined = undefined;
      if (shipNameRaw) {
        ships = [String(shipNameRaw).trim()];
      } else if (shipsRaw) {
        const shipsStr = String(shipsRaw);
        if (shipsStr.includes(',')) {
          ships = shipsStr.split(',').map(s => s.trim()).filter(Boolean);
        } else if (shipsStr.trim()) {
          ships = [shipsStr.trim()];
        }
      }
      
      // Parse pricing fields
      const parsePrice = (value: any): number | null => {
        if (!value) return null;
        const num = typeof value === 'number' ? value : parseFloat(String(value).replace(/[^0-9.]/g, ''));
        return (!isNaN(num) && num > 0) ? num : null;
      };
      
      // Parse perks
      const perksRaw = row['Perks'] || row['perks'] || '';
      let perks: string[] | undefined = undefined;
      if (perksRaw) {
        const perksStr = String(perksRaw);
        if (perksStr.includes(',')) {
          perks = perksStr.split(',').map(p => p.trim()).filter(Boolean);
        } else if (perksStr.trim()) {
          perks = [perksStr.trim()];
        }
      }
      
      // NEW: Cabin category normalization and comp value calculation
      const roomTypeRaw = (row['Room Type'] || row['roomType'] || '').toString().toUpperCase();
      let normalizedCabinType: 'INTERIOR' | 'OCEANVIEW' | 'BALCONY' | 'SUITE' | null = null;
      
      if (roomTypeRaw.includes('INTERIOR') || roomTypeRaw.includes('INSIDE')) {
        normalizedCabinType = 'INTERIOR';
      } else if (roomTypeRaw.includes('OCEAN VIEW') || roomTypeRaw.includes('OCEANVIEW')) {
        normalizedCabinType = 'OCEANVIEW';
      } else if (roomTypeRaw.includes('BALCONY')) {
        normalizedCabinType = 'BALCONY';
      } else if (roomTypeRaw.includes('SUITE')) {
        normalizedCabinType = 'SUITE';
      }
      
      // Select per-person price based on normalized cabin type
      let perPersonPrice: number | null = null;
      if (normalizedCabinType === 'INTERIOR') {
        perPersonPrice = parsePrice(row['Price Interior'] || row['priceInterior']);
      } else if (normalizedCabinType === 'OCEANVIEW') {
        perPersonPrice = parsePrice(row['Price Ocean View'] || row['Price Oceanview'] || row['priceOceanView']);
      } else if (normalizedCabinType === 'BALCONY') {
        perPersonPrice = parsePrice(row['Price Balcony'] || row['priceBalcony']);
      } else if (normalizedCabinType === 'SUITE') {
        perPersonPrice = parsePrice(row['Price Suite'] || row['priceSuite']);
      }
      
      // Calculate comp value only if we have valid pricing
      let baseCabinPrice: number | null = null;
      let compedShares: number | null = null;
      let coverageFraction: number | null = null;
      let compValue: number | null = null;
      
      if (perPersonPrice && perPersonPrice > 0) {
        baseCabinPrice = perPersonPrice * 2;
        
        // Determine comped shares based on offer type/category
        const offerTypeCat = (row['Offer Type / Category'] || row['Offer Type'] || row['offerTypeCategory'] || '').toString().toLowerCase();
        const offerCodeStr = String(row['Offer Code'] || row['OFFER CODE'] || row.offerCode || '').trim();
        
        // Default: assume full room for two (2.0 shares)
        compedShares = 2.0;
        
        // Special case: Offer Code 2511A06 (Interior, Guest 1 full + Guest 2 at 50%)
        if (offerCodeStr === '2511A06' || offerCodeStr === '25NOV106') {
          compedShares = 1.5; // 1 full share + 0.5 half-off share = 75% coverage
        }
        // Check offer type text for coverage patterns
        else if (offerTypeCat.includes('room for two') || 
                 offerTypeCat.includes('stateroom for 2') ||
                 offerTypeCat.includes('cabin for two')) {
          compedShares = 2.0; // Full room comped
        }
        else if (offerTypeCat.includes('guest pays full') || offerTypeCat.includes('full fare for guest')) {
          compedShares = 1.0; // Only one guest comped
        }
        else if (offerTypeCat.includes('25% off') || offerTypeCat.includes('25% discount')) {
          compedShares = 1.25; // 1 full + 0.25
        }
        else if (offerTypeCat.includes('50% off') || offerTypeCat.includes('half off') || offerTypeCat.includes('50% discount')) {
          compedShares = 1.5; // 1 full + 0.5
        }
        else if (offerTypeCat.includes('75% off') || offerTypeCat.includes('75% discount')) {
          compedShares = 1.75; // 1 full + 0.75
        }
        
        coverageFraction = compedShares / 2.0;
        compValue = baseCabinPrice * coverageFraction;
      }
      
      // NEW: 20-column format - primary parsing with comp value calculation
      const offer: Partial<CasinoOffer> = {
        // Primary identifiers (required)
        offerCode: String(row['Offer Code'] || row['OFFER CODE'] || row.offerCode || row['Offer Code '] || '').trim(),
        offerName: (row['Offer Name'] || row['OFFER NAME'] || row.offerName || '').toString().trim(),
        
        // Core fields with legacy support
        name: (row['Name'] || row['NAME'] || row.name || row['Offer Name'] || '').toString().trim(),
        offerType: (row['Offer Type / Category'] || row['Offer Type'] || row['OFFER TYPE'] || row.offerType || '').toString().trim(),
        rewardNumber: String(row['Reward Number'] || row['REWARD NUMBER'] || row.rewardNumber || '').trim(),
        expires,
        tradeInValue: String(row['Trade-In Value'] || row['Trade In Value'] || row['TRADE IN VALUE'] || row.tradeInValue || '$0').trim(),
        
        // Multi-sailing support (legacy)
        sailingDates,
        ships,
        offerStartDate: parseDateStrict(row['Offer Start Date'] || row['OFFER START DATE'] || row['offerStartDate']) || undefined,
        offerEndDate: parseDateStrict(row['Offer End Date'] || row['OFFER END DATE'] || row['offerEndDate']) || expires || undefined,
        perks,
        
        // NEW: 20-column format fields
        shipName: shipNameRaw ? String(shipNameRaw).trim() : undefined,
        sailingDate: sailingDateRaw ? parseDateStrict(sailingDateRaw) || undefined : undefined,
        itinerary: (row['Itinerary'] || row['itinerary'] || '').toString().trim() || undefined,
        roomType: (row['Room Type'] || row['roomType'] || '').toString().trim() || undefined,
        guestsInfo: (row['GuestsInfo'] || row['guestsInfo'] || '').toString().trim() || undefined,
        shipClass: (row['Ship Class'] || row['shipClass'] || '').toString().trim() || undefined,
        offerExpiryDate: expires || undefined,
        priceInterior: parsePrice(row['Price Interior'] || row['priceInterior']),
        priceOceanView: parsePrice(row['Price Ocean View'] || row['Price Oceanview'] || row['priceOceanView']),
        priceBalcony: parsePrice(row['Price Balcony'] || row['priceBalcony']),
        priceSuite: parsePrice(row['Price Suite'] || row['priceSuite']),
        taxesAndFees: parsePrice(row['Taxes & Fees'] || row['Taxes and Fees'] || row['taxesAndFees']),
        portsAndTimes: (row['Ports & Times'] || row['Ports and Times'] || row['portsAndTimes'] || '').toString().trim() || undefined,
        offerTypeCategory: (row['Offer Type / Category'] || row['Offer Type'] || row['offerTypeCategory'] || '').toString().trim() || undefined,
        nights: row['Nights'] || row['nights'] ? parseInt(String(row['Nights'] || row['nights'])) : undefined,
        departurePort: (row['Departure Port'] || row['departurePort'] || '').toString().trim() || undefined,
        
        // NEW: Comp Value Calculation Fields
        normalizedCabinType,
        perPersonPrice,
        baseCabinPrice,
        compedShares,
        coverageFraction,
        compValue,
        compValueCalculatedAt: compValue ? new Date().toISOString() : undefined,
      };
      
      if (offer.offerCode) {
        offers.push(offer);
      }
    } catch (error) {
      console.error('Error parsing offer row:', error);
    }
  }
  
  console.log(`[Import] Parsed ${offers.length} valid offers after filtering expired`);
  return offers;
}

function parseCruises(headers: string[], data: any[][], filterNext90Days: boolean = true): Partial<Cruise>[] {
  const cruises: Partial<Cruise>[] = [];
  const today = new Date();
  const next90Days = new Date(today.getTime() + (90 * 24 * 60 * 60 * 1000));
  
  console.log(`[Import] CSV: Filtering cruises for next 90 days: ${filterNext90Days}`);
  
  // Map headers to indices (support common misspelling "saling")
  const lowerHeaders = headers.map(h => (typeof h === 'string' ? h.toLowerCase() : ''));
  const sailingIdx = (() => {
    let idx = lowerHeaders.findIndex(h => h.includes('sailing'));
    if (idx === -1) idx = lowerHeaders.findIndex(h => h.includes('saling'));
    if (idx === -1) idx = lowerHeaders.findIndex(h => h.includes('depart'));
    return idx;
  })();
  const indices = {
    sailingDate: sailingIdx,
    ship: lowerHeaders.findIndex(h => h.includes('ship')),
    departurePort: lowerHeaders.findIndex(h => h.includes('depart')),
    itinerary: lowerHeaders.findIndex(h => h.includes('itinerary')),
    nights: lowerHeaders.findIndex(h => h.includes('night')),
    cabinType: lowerHeaders.findIndex(h => h.includes('cabin')),
  };
  
  for (const row of data) {
    if (!row || row.length === 0) continue;
    
    try {
      const rawDate = indices.sailingDate >= 0 ? row[indices.sailingDate] : undefined;
      const departureDate = parseDateStrict(rawDate) || "";
      
      // Apply 90-day filter if enabled
      if (filterNext90Days && departureDate) {
        const cruiseDate = new Date(departureDate);
        if (cruiseDate < today || cruiseDate > next90Days) {
          continue; // Skip cruises outside the 90-day window
        }
      }
      
      const nightsVal = indices.nights >= 0 ? parseInt(row[indices.nights]) || 0 : 0;
      let returnDate: string | undefined = undefined;
      if (departureDate && nightsVal > 0) {
        const d = new Date(departureDate);
        const ret = new Date(d.getTime() + nightsVal * 24 * 60 * 60 * 1000);
        returnDate = `${ret.getFullYear()}-${String(ret.getMonth() + 1).padStart(2, '0')}-${String(ret.getDate()).padStart(2, '0')}`;
      }
      
      const cruise: Partial<Cruise> = {
        ship: indices.ship >= 0 ? (row[indices.ship] || "") : "",
        itineraryName: indices.itinerary >= 0 ? (row[indices.itinerary] || "") : "",
        departurePort: indices.departurePort >= 0 ? (row[indices.departurePort] || "") : "",
        nights: nightsVal,
        departureDate,
        returnDate,
      };
      
      if (cruise.ship && cruise.departureDate) {
        cruises.push(cruise);
      }
    } catch (error) {
      console.error("Error parsing cruise row:", error);
    }
  }
  
  console.log(`[Import] CSV: Parsed ${cruises.length} cruises after filtering`);
  return cruises;
}

function parseBookedCruises(headers: string[], data: any[][], filterNext90Days: boolean = true): Partial<BookedCruise>[] {
  const booked: Partial<BookedCruise>[] = [];
  const today = new Date();
  const next90Days = new Date(today.getTime() + (90 * 24 * 60 * 60 * 1000));
  
  console.log(`[Import] CSV: Filtering booked cruises for next 90 days: ${filterNext90Days}`);
  
  const indices = {
    ship: headers.findIndex(h => h?.toLowerCase().includes("ship")),
    startDate: headers.findIndex(h => h?.toLowerCase().includes("start")),
    endDate: headers.findIndex(h => h?.toLowerCase().includes("end")),
    nights: headers.findIndex(h => h?.toLowerCase().includes("night")),
    itinerary: headers.findIndex(h => h?.toLowerCase().includes("itinerary")),
    reservation: headers.findIndex(h => h?.toLowerCase().includes("reservation")),
  };
  
  for (const row of data) {
    if (!row || row.length === 0) continue;
    
    try {
      const startDate = parseDateStrict(row[indices.startDate]) || "";
      
      // Apply 90-day filter if enabled
      if (filterNext90Days && startDate) {
        const cruiseDate = new Date(startDate);
        if (cruiseDate < today || cruiseDate > next90Days) {
          continue; // Skip booked cruises outside the 90-day window
        }
      }
      
      const booking: Partial<BookedCruise> = {
        ship: row[indices.ship] || "",
        departureDate: startDate,
        returnDate: parseDateStrict(row[indices.endDate]) || "",
        nights: parseInt(row[indices.nights]) || 0,
        itineraryName: row[indices.itinerary] || "",
        reservationNumber: row[indices.reservation] || "",
      };
      
      if (booking.ship && booking.departureDate) {
        booked.push(booking);
      }
    } catch (error) {
      console.error("Error parsing booked row:", error);
    }
  }
  
  console.log(`[Import] CSV: Parsed ${booked.length} booked cruises after filtering`);
  return booked;
}

function parseOffers(headers: string[], data: any[][]): Partial<CasinoOffer>[] {
  const offers: Partial<CasinoOffer>[] = [];
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  console.log(`[Import] CSV: Filtering offers - removing expired offers`);
  
  const indices = {
    name: headers.findIndex(h => h?.toLowerCase() === "name"),
    rewardNumber: headers.findIndex(h => h?.toLowerCase().includes("reward")),
    offerName: headers.findIndex(h => h?.toLowerCase().includes("offer") && h?.toLowerCase().includes("name")),
    offerType: headers.findIndex(h => h?.toLowerCase().includes("offer") && h?.toLowerCase().includes("type")),
    expires: headers.findIndex(h => h?.toLowerCase().includes("expire")),
    offerCode: headers.findIndex(h => h?.toLowerCase().includes("offer") && h?.toLowerCase().includes("code")),
  };
  
  for (const row of data) {
    if (!row || row.length === 0) continue;
    
    try {
      const expires = parseDateStrict(row[indices.expires]) || "";
      
      // Filter out expired offers
      if (expires) {
        const expiryDate = new Date(expires);
        expiryDate.setHours(0, 0, 0, 0);
        if (expiryDate < today) {
          continue; // Skip expired offers
        }
      }
      
      const offer: Partial<CasinoOffer> = {
        name: row[indices.name] || "",
        offerName: row[indices.offerName] || "",
        offerType: row[indices.offerType] || "",
        expires,
        offerCode: String(row[indices.offerCode] || ""),
      };
      
      // Validate offer code format
      if (offer.offerCode && !validateOfferCode(offer.offerCode)) {
        console.warn(`Invalid offer code format: ${offer.offerCode}`);
      }
      
      if (offer.offerCode) {
        offers.push(offer);
      }
    } catch (error) {
      console.error("Error parsing offer row:", error);
    }
  }
  
  console.log(`[Import] CSV: Parsed ${offers.length} valid offers after filtering expired`);
  return offers;
}

export function validateOfferCode(code: string): boolean {
  // Format: 25SEP106
  const regex = /^\d{2}(JAN|FEB|MAR|APR|MAY|JUN|JUL|AUG|SEP|OCT|NOV|DEC)\d{3}$/;
  return regex.test(code);
}

export function validateImportData(data: any): string[] {
  const errors: string[] = [];
  
  if (data.cruises) {
    const invalidDates = data.cruises.filter((c: any) => !c.departureDate);
    if (invalidDates.length > 0) {
      errors.push(`${invalidDates.length} cruises have invalid departure dates`);
    }
  }
  
  if (data.offers) {
    const invalidCodes = data.offers.filter((o: any) => o.offerCode && !validateOfferCode(o.offerCode));
    if (invalidCodes.length > 0) {
      errors.push(`${invalidCodes.length} offers have invalid offer codes`);
    }
  }
  
  return errors;
}