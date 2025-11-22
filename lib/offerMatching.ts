import { createDateFromString } from '@/lib/date';

export interface OfferMatchCriteria {
  sailingDates?: string[];
  ships?: string[];
  offerStartDate?: string | Date;
  offerEndDate?: string | Date;
}

export interface CruiseMatchable {
  ship?: string;
  'Ship Name'?: string;
  departureDate?: string | Date;
  'Sailing Date'?: string | Date;
  'Start Date'?: string | Date;
  startDate?: string | Date;
  returnDate?: string | Date;
  'Return Date'?: string | Date;
  'End Date'?: string | Date;
  endDate?: string | Date;
  nights?: number;
  Nights?: number;
  NIGHT?: number;
  Nite?: number;
  // Offer matching fields
  offerCode?: string;
  'Offer Code'?: string;
  'OFFER CODE'?: string;
  offerName?: string;
  'Offer Name'?: string;
  'OFFER NAME'?: string;
}

export interface OfferMatchable {
  sailingDates?: string[];
  'Sailing Dates'?: string[];
  'SAILING DATES'?: string[];
  // Single date fields commonly found in spreadsheets
  'Sail Date'?: string | Date;
  'Sailing Date'?: string | Date;
  'Start Date'?: string | Date;
  startDate?: string | Date;
  ships?: string[];
  Ships?: string[];
  SHIPS?: string[];
  // Single ship fields commonly found in spreadsheets
  Ship?: string;
  'Ship Name'?: string;
  ship?: string;
  offerStartDate?: string | Date;
  'Offer Start Date'?: string | Date;
  'OFFER START DATE'?: string | Date;
  offerEndDate?: string | Date;
  'Offer End Date'?: string | Date;
  'OFFER END DATE'?: string | Date;
  expires?: string | Date;
  EXPIRES?: string | Date;
  Expires?: string | Date;
  'Expiration Date'?: string | Date;
  // Offer code and name matching
  offerCode?: string;
  'Offer Code'?: string;
  'OFFER CODE'?: string;
  offerName?: string;
  'Offer Name'?: string;
  'OFFER NAME'?: string;
}

function normalizeShipName(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/\s+/g, ' ')
    .replace(/^(?:the\s+)?(?:royal\s+caribbean\s+)?(?:rccl\s+)?/i, '')
    .replace(/\s+of\s+the\s+seas$/i, '')
    .replace(/[^\w\s]/g, '');
}

function parseDate(value: string | Date | undefined | null): Date | null {
  if (!value) return null;
  if (value instanceof Date) return value;
  
  try {
    const dateStr = String(value).trim();
    
    if (/^\d{4}-\d{2}-\d{2}/.test(dateStr)) {
      const d = new Date(dateStr);
      if (!isNaN(d.getTime())) return d;
    }
    
    if (/^\d{1,2}[-/]\d{1,2}[-/]\d{4}$/.test(dateStr)) {
      const parts = dateStr.split(/[-/]/);
      const month = parseInt(parts[0], 10) - 1;
      const day = parseInt(parts[1], 10);
      const year = parseInt(parts[2], 10);
      const d = new Date(year, month, day);
      if (!isNaN(d.getTime())) return d;
    }
    
    const d = new Date(dateStr);
    return isNaN(d.getTime()) ? null : d;
  } catch {
    return null;
  }
}

function extractShips(offer: OfferMatchable): string[] {
  const fromArray = (offer as any).ships || (offer as any).Ships || (offer as any).SHIPS || [];
  const singles = [(offer as any).Ship, (offer as any)['Ship Name'], (offer as any).ship].filter(Boolean);
  if (Array.isArray(fromArray) && fromArray.length > 0) {
    return fromArray.filter((s: any) => s && typeof s === 'string');
  }
  if (singles.length > 0) {
    return singles.map((s: any) => String(s)).filter((s: string) => s.length > 0);
  }
  const raw = fromArray;
  if (!Array.isArray(raw)) {
    const str = String(raw);
    if (str && str !== 'undefined' && str !== 'null') {
      return [str];
    }
    return [];
  }
  return raw.filter(s => s && typeof s === 'string');
}

function extractSailingDates(offer: OfferMatchable): Date[] {
  const arrayDates = (offer as any).sailingDates || (offer as any)['Sailing Dates'] || (offer as any)['SAILING DATES'] || [];
  const singleDateCandidates = [
    (offer as any)['Sail Date'],
    (offer as any)['Sailing Date'],
    (offer as any)['Start Date'],
    (offer as any).startDate,
  ].filter(Boolean);
  const dates: Date[] = [];
  const pushParsed = (val: any) => {
    const d = parseDate(val as any);
    if (d) dates.push(d);
  };
  if (Array.isArray(arrayDates) && arrayDates.length > 0) {
    for (const item of arrayDates) pushParsed(item);
  }
  for (const sd of singleDateCandidates) pushParsed(sd);
  return dates;
}

function normalizeOfferCode(code: string): string {
  return String(code || '')
    .toUpperCase()
    .trim()
    .replace(/[^A-Z0-9]/g, '');
}

function normalizeOfferName(name: string): string {
  return String(name || '')
    .toLowerCase()
    .trim()
    .replace(/\s+/g, ' ');
}

export function matchCruisesToOffer(
  cruises: CruiseMatchable[],
  offer: OfferMatchable
): CruiseMatchable[] {
  console.log('[offerMatching] Starting match for offer:', {
    sailingDates: offer.sailingDates,
    ships: offer.ships,
    offerCode: (offer as any).offerCode || (offer as any)['Offer Code'] || (offer as any)['OFFER CODE'],
    offerName: (offer as any).offerName || (offer as any)['Offer Name'] || (offer as any)['OFFER NAME'],
  });
  
  const offerShips = extractShips(offer);
  const offerSailingDates = extractSailingDates(offer);
  
  // Extract offer code and name for matching
  const offerCodeRaw = (offer as any).offerCode || (offer as any)['Offer Code'] || (offer as any)['OFFER CODE'] || '';
  const offerNameRaw = (offer as any).offerName || (offer as any)['Offer Name'] || (offer as any)['OFFER NAME'] || '';
  const normalizedOfferCode = normalizeOfferCode(offerCodeRaw);
  const normalizedOfferName = normalizeOfferName(offerNameRaw);
  
  // Try multiple date fields for offer start/end dates
  const offerReceivedDate = parseDate((offer as any)['Offer Received Date'] || (offer as any)['OFFER RECEIVED DATE'] || (offer as any).offerReceivedDate);
  let offerStartDate = parseDate(offer.offerStartDate || offer['Offer Start Date'] || offer['OFFER START DATE']);
  const offerEndDate = parseDate(offer.offerEndDate || offer['Offer End Date'] || offer['OFFER END DATE'] || offer.expires || offer.EXPIRES || offer.Expires || offer['Expiration Date'] || (offer as any)['OFFER EXPIRE DATE']);
  
  // If no explicit start date but we have a received date, use that as start
  if (!offerStartDate && offerReceivedDate) {
    offerStartDate = offerReceivedDate;
  }
  
  console.log('[offerMatching] Extracted criteria:', {
    offerShips,
    offerSailingDatesCount: offerSailingDates.length,
    offerStartDate: offerStartDate?.toISOString().split('T')[0],
    offerEndDate: offerEndDate?.toISOString().split('T')[0],
  });
  
  // If we have at least an end date, we can match by date range
  // Ships field is optional - if not provided, match all ships
  if (offerShips.length === 0 && offerSailingDates.length === 0 && !offerStartDate && !offerEndDate) {
    console.log('[offerMatching] No matching criteria available');
    return [];
  }
  
  // If we have a date range (even just end date), we can match cruises sailing in that period
  // Ships are optional - if not specified, all ships qualify
  if (offerStartDate || offerEndDate) {
    console.log('[offerMatching] Using date range matching', {
      hasShipFilter: offerShips.length > 0,
      dateRangeMode: true
    });
  }
  
  const normalizedOfferShips = offerShips.map(normalizeShipName);
  
  console.log('[offerMatching] Matching criteria:', {
    hasOfferCode: normalizedOfferCode.length > 0,
    hasOfferName: normalizedOfferName.length > 0,
    hasShips: offerShips.length > 0,
    hasSailingDates: offerSailingDates.length > 0,
    hasDateRange: !!(offerStartDate || offerEndDate),
  });
  
  const matched = cruises.filter((cruise) => {
    const cruiseShipRaw = cruise.ship || cruise['Ship Name'] || '';
    const cruiseShip = normalizeShipName(String(cruiseShipRaw));
    
    const depRaw = cruise.departureDate || cruise['Sailing Date'] || cruise['Start Date'] || cruise.startDate;
    const cruiseDeparture = parseDate(depRaw);
    
    // Extract cruise offer code and name
    const cruiseOfferCodeRaw = (cruise as any).offerCode || (cruise as any)['Offer Code'] || (cruise as any)['OFFER CODE'] || '';
    const cruiseOfferNameRaw = (cruise as any).offerName || (cruise as any)['Offer Name'] || (cruise as any)['OFFER NAME'] || '';
    const normalizedCruiseOfferCode = normalizeOfferCode(cruiseOfferCodeRaw);
    const normalizedCruiseOfferName = normalizeOfferName(cruiseOfferNameRaw);
    
    // Priority 0: Check for exact offer code and name match (most reliable)
    let offerCodeMatches = false;
    let offerNameMatches = false;
    
    if (normalizedOfferCode.length > 0 && normalizedCruiseOfferCode.length > 0) {
      offerCodeMatches = normalizedOfferCode === normalizedCruiseOfferCode;
      if (offerCodeMatches) {
        console.log('[offerMatching] ✅ Offer code match:', {
          offerCode: offerCodeRaw,
          cruiseOfferCode: cruiseOfferCodeRaw,
          ship: cruiseShipRaw,
          date: cruiseDeparture?.toISOString().split('T')[0],
        });
      }
    }
    
    if (normalizedOfferName.length > 0 && normalizedCruiseOfferName.length > 0) {
      offerNameMatches = normalizedOfferName === normalizedCruiseOfferName;
      if (offerNameMatches) {
        console.log('[offerMatching] ✅ Offer name match:', {
          offerName: offerNameRaw,
          cruiseOfferName: cruiseOfferNameRaw,
          ship: cruiseShipRaw,
          date: cruiseDeparture?.toISOString().split('T')[0],
        });
      }
    }
    
    let shipMatches = false;
    if (offerShips.length > 0) {
      shipMatches = normalizedOfferShips.some(offerShip => {
        const matches = cruiseShip.includes(offerShip) || offerShip.includes(cruiseShip);
        if (matches) {
          console.log('[offerMatching] Ship match:', { cruiseShip: cruiseShipRaw, offerShip });
        }
        return matches;
      });
    }
    
    let dateMatches = false;
    if (offerSailingDates.length > 0 && cruiseDeparture) {
      cruiseDeparture.setHours(0, 0, 0, 0);
      dateMatches = offerSailingDates.some(offerDate => {
        const od = new Date(offerDate);
        od.setHours(0, 0, 0, 0);
        const matches = od.getTime() === cruiseDeparture.getTime();
        if (matches) {
          console.log('[offerMatching] Sailing date exact match:', {
            cruise: cruiseDeparture.toISOString().split('T')[0],
            offer: od.toISOString().split('T')[0],
          });
        }
        return matches;
      });
    }
    
    let dateRangeMatches = false;
    if (cruiseDeparture && (offerStartDate || offerEndDate)) {
      cruiseDeparture.setHours(0, 0, 0, 0);
      
      if (offerStartDate && offerEndDate) {
        // Both start and end defined
        offerStartDate.setHours(0, 0, 0, 0);
        offerEndDate.setHours(0, 0, 0, 0);
        dateRangeMatches = cruiseDeparture >= offerStartDate && cruiseDeparture <= offerEndDate;
        if (dateRangeMatches) {
          console.log('[offerMatching] Date range match (start+end):', {
            cruise: cruiseDeparture.toISOString().split('T')[0],
            range: `${offerStartDate.toISOString().split('T')[0]} to ${offerEndDate.toISOString().split('T')[0]}`,
          });
        }
      } else if (offerEndDate) {
        // Only end date defined - match if cruise departs before offer expires
        offerEndDate.setHours(0, 0, 0, 0);
        dateRangeMatches = cruiseDeparture <= offerEndDate;
        if (dateRangeMatches) {
          console.log('[offerMatching] Date range match (end only):', {
            cruise: cruiseDeparture.toISOString().split('T')[0],
            offerExpires: offerEndDate.toISOString().split('T')[0],
          });
        }
      } else if (offerStartDate) {
        // Only start date defined - match if cruise departs after offer starts
        offerStartDate.setHours(0, 0, 0, 0);
        dateRangeMatches = cruiseDeparture >= offerStartDate;
        if (dateRangeMatches) {
          console.log('[offerMatching] Date range match (start only):', {
            cruise: cruiseDeparture.toISOString().split('T')[0],
            offerStarts: offerStartDate.toISOString().split('T')[0],
          });
        }
      }
    }
    
    // Priority 0: Offer code match (HIGHEST PRIORITY - most reliable)
    // If offer codes match, this is a definitive match regardless of other criteria
    if (offerCodeMatches) {
      console.log('[offerMatching] ✅ DEFINITIVE MATCH via offer code:', {
        offerCode: offerCodeRaw,
        cruiseOfferCode: cruiseOfferCodeRaw,
        ship: cruiseShipRaw,
        date: cruiseDeparture?.toISOString().split('T')[0],
      });
      return true;
    }
    
    // Priority 0.5: Offer name match (HIGH PRIORITY - very reliable)
    // If offer names match, this is a strong match regardless of other criteria
    if (offerNameMatches) {
      console.log('[offerMatching] ✅ STRONG MATCH via offer name:', {
        offerName: offerNameRaw,
        cruiseOfferName: cruiseOfferNameRaw,
        ship: cruiseShipRaw,
        date: cruiseDeparture?.toISOString().split('T')[0],
      });
      return true;
    }
    
    // Priority 1: If we have ships AND specific sailing dates, both must match
    if (offerShips.length > 0 && offerSailingDates.length > 0) {
      const result = shipMatches && dateMatches;
      if (result) {
        console.log('[offerMatching] ✅ MATCH (ship AND specific date):', {
          ship: cruiseShipRaw,
          date: cruiseDeparture?.toISOString().split('T')[0],
        });
      }
      return result;
    }
    
    // Priority 2: If we have ships AND date range, both must match
    if (offerShips.length > 0 && (offerStartDate || offerEndDate)) {
      const result = shipMatches && dateRangeMatches;
      if (result) {
        console.log('[offerMatching] ✅ MATCH (ship AND date range):', {
          ship: cruiseShipRaw,
          date: cruiseDeparture?.toISOString().split('T')[0],
        });
      }
      return result;
    }
    
    // Priority 3: If we have specific sailing dates (no ship filter), just match dates
    if (offerSailingDates.length > 0) {
      if (dateMatches) {
        console.log('[offerMatching] ✅ MATCH (specific date only):', {
          ship: cruiseShipRaw,
          date: cruiseDeparture?.toISOString().split('T')[0],
        });
      }
      return dateMatches;
    }
    
    // Priority 4: If we have date range (no ship filter), match by date range
    if (offerStartDate || offerEndDate) {
      if (dateRangeMatches) {
        console.log('[offerMatching] ✅ MATCH (date range only):', {
          ship: cruiseShipRaw,
          date: cruiseDeparture?.toISOString().split('T')[0],
        });
      }
      return dateRangeMatches;
    }
    
    // Priority 5: If we only have ships (no dates), match by ship only
    if (offerShips.length > 0) {
      if (shipMatches) {
        console.log('[offerMatching] ✅ MATCH (ship only):', {
          ship: cruiseShipRaw,
        });
      }
      return shipMatches;
    }
    
    return false;
  });
  
  console.log('[offerMatching] Found', matched.length, 'matches out of', cruises.length, 'cruises');
  
  return matched.map((c: any) => {
    const depRaw = c.departureDate || c['Sailing Date'] || c['Start Date'] || c.startDate;
    const retRaw = c.returnDate || c['Return Date'] || c['End Date'] || c.endDate;
    const dep = createDateFromString(depRaw);
    let ret = createDateFromString(retRaw);
    const nightsVal = c.nights ?? c['Nights'] ?? c['NIGHT'] ?? c['Nite'];
    if (isNaN(ret.getTime()) && dep && !isNaN(dep.getTime()) && typeof nightsVal !== 'undefined') {
      const n = Number(nightsVal);
      if (!isNaN(n)) {
        ret = new Date(dep.getTime() + n * 24 * 60 * 60 * 1000);
      }
    }
    return { ...c, __dep: dep, __ret: ret };
  }).sort((a: any, b: any) => {
    const at = a.__dep && !isNaN(a.__dep.getTime()) ? a.__dep.getTime() : Number.POSITIVE_INFINITY;
    const bt = b.__dep && !isNaN(b.__dep.getTime()) ? b.__dep.getTime() : Number.POSITIVE_INFINITY;
    return at - bt;
  });
}
