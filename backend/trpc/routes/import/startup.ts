import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import * as XLSX from 'xlsx';
import { memoryStore } from '../_stores/memory';
import { storageConfig, ensureDataDirectory } from '../../../../lib/storage';

// Get __dirname equivalent in ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

ensureDataDirectory();
const DATA_DIR_ENV = storageConfig.dataDir;

type PreloadSummary = {
  ok: boolean;
  baseDir: string;
  filesFound: {
    cruises: boolean;
    booked: boolean;
    offers: boolean;
    calendar: boolean;
    tripit: boolean;
  };
  imported: {
    cruises: number;
    booked: number;
    offers: number;
    events: number;
  };
  message?: string;
};

function safeExists(filePath: string): boolean {
  try {
    return fs.existsSync(filePath);
  } catch {
    return false;
  }
}

function readXlsx(filePath: string): any[] {
  console.log(`[Startup] ========== READING XLSX FILE ==========`);
  console.log(`[Startup] File path: ${filePath}`);
  console.log(`[Startup] File exists: ${fs.existsSync(filePath)}`);
  
  if (!fs.existsSync(filePath)) {
    console.error(`[Startup] ❌ File not found: ${filePath}`);
    return [];
  }
  
  try {
    const buf = fs.readFileSync(filePath);
    console.log(`[Startup] ✅ File read successfully, size: ${buf.length} bytes`);
    
    if (buf.length === 0) {
      console.error(`[Startup] ❌ File is empty: ${filePath}`);
      return [];
    }
    
    const wb = XLSX.read(buf, { type: 'buffer' });
    console.log(`[Startup] 📊 Workbook loaded, sheet names: ${wb.SheetNames.join(', ')}`);
    
    if (wb.SheetNames.length === 0) {
      console.error(`[Startup] ❌ No sheets found in workbook: ${filePath}`);
      return [];
    }

    let bestRows: any[] = [];
    let bestSheet = '';

    wb.SheetNames.forEach((sheetName) => {
      const ws = wb.Sheets[sheetName];
      if (!ws) {
        console.log(`[Startup] ⚠️  Sheet "${sheetName}" is empty or invalid`);
        return;
      }
      
      // Try different parsing options
      const rows = XLSX.utils.sheet_to_json(ws, { defval: '', raw: false });
      console.log(`[Startup] 📄 Sheet "${sheetName}" has ${rows.length} rows`);
      
      if (rows.length > 0 && rows[0] && typeof rows[0] === 'object') {
        console.log(`[Startup] 🔍 First row keys in "${sheetName}":`, Object.keys(rows[0] as Record<string, unknown>).join(', '));
        console.log(`[Startup] 🔍 First row sample:`, JSON.stringify(rows[0]).substring(0, 300));
      }
      
      if (rows && rows.length > bestRows.length) {
        bestRows = rows as any[];
        bestSheet = sheetName;
      }
    });

    if (bestRows.length === 0 && wb.SheetNames.length > 0) {
      console.log(`[Startup] ⚠️  No rows found in any sheet, trying first sheet with different options: ${wb.SheetNames[0]}`);
      const ws = wb.Sheets[wb.SheetNames[0]];
      
      // Try with header row detection
      bestRows = XLSX.utils.sheet_to_json(ws, { defval: '', raw: false, header: 1 }) as any[];
      console.log(`[Startup] 📄 First sheet with header:1 has ${bestRows.length} rows`);
      
      if (bestRows.length > 0) {
        console.log(`[Startup] 🔍 Raw first row:`, JSON.stringify(bestRows[0]));
        console.log(`[Startup] 🔍 Raw second row:`, JSON.stringify(bestRows[1]));
      }
      
      // Convert back to object format if we got data
      if (bestRows.length > 1) {
        const headers = bestRows[0] as any[];
        const dataRows = bestRows.slice(1);
        bestRows = dataRows.map(row => {
          const obj: any = {};
          (row as any[]).forEach((val, idx) => {
            if (headers[idx]) {
              obj[headers[idx]] = val;
            }
          });
          return obj;
        });
        console.log(`[Startup] ✅ Converted ${bestRows.length} rows to object format`);
      }
      
      bestSheet = wb.SheetNames[0];
    }

    console.log(`[Startup] ✅ Selected sheet "${bestSheet}" with ${bestRows.length} rows from ${path.basename(filePath)}`);
    
    if (bestRows.length > 0) {
      console.log(`[Startup] 📋 Sample row keys:`, Object.keys(bestRows[0]).join(', '));
      console.log(`[Startup] 📋 Sample row data:`, JSON.stringify(bestRows[0]).substring(0, 300));
    } else {
      console.error(`[Startup] ❌ No data rows found in ${path.basename(filePath)}`);
    }
    
    console.log(`[Startup] ==========================================`);
    return bestRows;
  } catch (error) {
    console.error(`[Startup] ❌ Error reading XLSX file ${filePath}:`, error);
    return [];
  }
}

function parseICalDate(value: string): string {
  try {
    if (!value) return '';
    if (/^\d{8}$/.test(value)) {
      const year = value.slice(0, 4);
      const month = value.slice(4, 6);
      const day = value.slice(6, 8);
      return `${year}-${month}-${day}`;
    }
    if (value.includes('T')) {
      const datePart = value.split('T')[0];
      if (/^\d{8}$/.test(datePart)) {
        const year = datePart.slice(0, 4);
        const month = datePart.slice(4, 6);
        const day = datePart.slice(6, 8);
        return `${year}-${month}-${day}`;
      }
    }
    const d = new Date(value);
    if (!isNaN(d.getTime())) return d.toISOString().split('T')[0];
    return '';
  } catch {
    return '';
  }
}

function parseICS(content: string) {
  const events: Array<{ summary: string; startDate: string; endDate: string; location?: string; description?: string; source: 'manual' | 'tripit'; }> = [];
  const lines = content.split('\n').map((l) => l.trim());
  let current: any = null;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line === 'BEGIN:VEVENT') {
      current = { summary: '', startDate: '', endDate: '', location: '', description: '', source: 'manual' as const };
    } else if (line === 'END:VEVENT' && current) {
      if (current.summary && current.startDate) events.push(current);
      current = null;
    } else if (current && line.includes(':')) {
      const [keyRaw, ...vp] = line.split(':');
      const value = vp.join(':');
      const key = keyRaw.split(';')[0];
      switch (key) {
        case 'SUMMARY':
          current.summary = value;
          break;
        case 'DTSTART':
        case 'DTSTART;VALUE=DATE':
          current.startDate = parseICalDate(value);
          break;
        case 'DTEND':
        case 'DTEND;VALUE=DATE':
          current.endDate = parseICalDate(value);
          break;
        case 'LOCATION':
          current.location = value;
          break;
        case 'DESCRIPTION':
          current.description = value.replace(/\\n/g, '\n').replace(/\\,/g, ',');
          break;
      }
    }
  }
  return events;
}

export function readDataFiles() {
  const baseDirCandidates = [
    DATA_DIR_ENV,
    path.resolve(process.cwd(), 'DATA'),
    path.resolve(__dirname, '../../../../../DATA'),
    path.resolve(__dirname, '../../../../DATA'),
    path.resolve(__dirname, '../../../DATA'),
    path.resolve(__dirname, '../../DATA'),
    path.resolve(__dirname, '../DATA'),
    path.resolve('/', 'DATA'),
    '/DATA',
    './DATA',
    path.join(process.cwd(), '..', 'DATA'),
    path.join(process.cwd(), '../..', 'DATA'),
  ].filter(Boolean) as string[];
  
  console.log('[Startup] ========== SEARCHING FOR DATA FOLDER ==========');
  console.log('[Startup] Current working directory:', process.cwd());
  console.log('[Startup] __dirname:', __dirname);
  console.log('[Startup] Checking these paths:');
  baseDirCandidates.forEach((p, i) => {
    const exists = safeExists(p);
    console.log(`[Startup]   ${i + 1}. ${p} - ${exists ? '✅ EXISTS' : '❌ NOT FOUND'}`);
    if (exists) {
      try {
        const files = fs.readdirSync(p);
        console.log(`[Startup]      Files in directory: ${files.join(', ')}`);
      } catch (e) {
        console.log(`[Startup]      Could not read directory contents`);
      }
    }
  });
  
  const baseDir = baseDirCandidates.find((p) => safeExists(p)) || baseDirCandidates[0];
  console.log(`[Startup] ========================================`);
  console.log(`[Startup] 📁 Selected DATA folder: ${baseDir}`);
  console.log(`[Startup] ========================================`);
  // Try both lowercase and uppercase filenames
  const findFile = (dir: string, ...names: string[]): string | null => {
    for (const name of names) {
      const fullPath = path.join(dir, name);
      if (safeExists(fullPath)) {
        console.log(`[Startup] ✅ Found file: ${fullPath}`);
        return fullPath;
      }
    }
    console.log(`[Startup] ❌ File not found, tried: ${names.join(', ')}`);
    return null;
  };
  
  const files = {
    cruises: findFile(baseDir, 'cruises.xlsx', 'Cruises.xlsx', 'CRUISES.xlsx') || path.join(baseDir, 'cruises.xlsx'),
    booked: findFile(baseDir, 'booked.xlsx', 'Booked.xlsx', 'BOOKED.xlsx') || path.join(baseDir, 'booked.xlsx'),
    offers: findFile(baseDir, 'offers.xlsx', 'Offers.xlsx', 'OFFERS.xlsx') || path.join(baseDir, 'offers.xlsx'),
    calendar: findFile(baseDir, 'calendar.ics', 'Calendar.ics', 'CALENDAR.ics') || path.join(baseDir, 'calendar.ics'),
    tripit: findFile(baseDir, 'tripit.ics', 'Tripit.ics', 'TRIPIT.ics', 'TripIt.ics') || path.join(baseDir, 'tripit.ics'),
  } as const;

  const exists = {
    cruises: safeExists(files.cruises),
    booked: safeExists(files.booked),
    offers: safeExists(files.offers),
    calendar: safeExists(files.calendar),
    tripit: safeExists(files.tripit),
  } as const;

  const cruises = exists.cruises ? readXlsx(files.cruises) : [];
  const booked = exists.booked ? readXlsx(files.booked) : [];
  const offers = exists.offers ? readXlsx(files.offers) : [];
  const calendar = exists.calendar ? parseICS(fs.readFileSync(files.calendar, 'utf-8')).map((e) => ({ ...e, source: 'manual' as const })) : [];
  const tripit = exists.tripit ? parseICS(fs.readFileSync(files.tripit, 'utf-8')).map((e) => ({ ...e, source: 'tripit' as const })) : [];

  return {
    baseDir,
    filesFound: exists,
    counts: {
      cruises: cruises.length,
      booked: booked.length,
      offers: offers.length,
      calendar: calendar.length,
      tripit: tripit.length,
    },
    data: {
      cruises,
      booked,
      offers,
      calendar,
      tripit,
    },
  };
}

export async function preloadFromDataFolder(): Promise<PreloadSummary> {
  const baseDirCandidates = [
    DATA_DIR_ENV,
    path.resolve(process.cwd(), 'DATA'),
    path.resolve(__dirname, '../../../..', 'DATA'),
    path.resolve('/', 'DATA'),
    '/DATA',
    './DATA',
  ].filter(Boolean) as string[];

  let baseDir = baseDirCandidates.find((p) => safeExists(p)) || baseDirCandidates[0];

  // Try both lowercase and uppercase filenames
  const findFile = (dir: string, ...names: string[]): string | null => {
    for (const name of names) {
      const fullPath = path.join(dir, name);
      if (safeExists(fullPath)) {
        console.log(`[Startup] ✅ Found file: ${fullPath}`);
        return fullPath;
      }
    }
    console.log(`[Startup] ❌ File not found, tried: ${names.join(', ')}`);
    return null;
  };
  
  const files = {
    cruises: findFile(baseDir, 'cruises.xlsx', 'Cruises.xlsx', 'CRUISES.xlsx') || path.join(baseDir, 'cruises.xlsx'),
    booked: findFile(baseDir, 'booked.xlsx', 'Booked.xlsx', 'BOOKED.xlsx') || path.join(baseDir, 'booked.xlsx'),
    offers: findFile(baseDir, 'offers.xlsx', 'Offers.xlsx', 'OFFERS.xlsx') || path.join(baseDir, 'offers.xlsx'),
    calendar: findFile(baseDir, 'calendar.ics', 'Calendar.ics', 'CALENDAR.ics') || path.join(baseDir, 'calendar.ics'),
    tripit: findFile(baseDir, 'tripit.ics', 'Tripit.ics', 'TRIPIT.ics', 'TripIt.ics') || path.join(baseDir, 'tripit.ics'),
  };

  const exists = {
    cruises: safeExists(files.cruises),
    booked: safeExists(files.booked),
    offers: safeExists(files.offers),
    calendar: safeExists(files.calendar),
    tripit: safeExists(files.tripit),
  };

  const summary: PreloadSummary = {
    ok: true, // Mark as OK even if no files found - this is not an error
    baseDir,
    filesFound: exists,
    imported: { cruises: 0, booked: 0, offers: 0, events: 0 },
  };

  try {
    // Only proceed if any file exists
    if (!exists.cruises && !exists.booked && !exists.offers && !exists.calendar && !exists.tripit) {
      summary.message = 'No DATA files found to preload - using static/imported data instead';
      console.log('[Startup] No DATA folder files found - this is normal, using static/imported data');
      return summary;
    }

    // Clear only if store is empty to avoid overwriting user runtime changes
    const alreadyHasData = memoryStore.getCruises().length + memoryStore.getBookedCruises().length + memoryStore.getCasinoOffers().length + memoryStore.getCalendarEvents().length > 0;
    if (!alreadyHasData) {
      memoryStore.clearAllData();
    }

    console.log('[Startup] 🚀 UNIFIED CRUISE SYSTEM: Loading all cruises into single collection');

    // STEP 1: Load all cruises from cruises.xlsx
    const cruiseMap = new Map<string, any>(); // Key: ship+date, Value: cruise data
    
    if (exists.cruises) {
      const rows = readXlsx(files.cruises);
      console.log(`[Startup] Loading ${rows.length} cruises from cruises.xlsx`);
      
      rows.forEach((r, idx) => {
        try {
          // Basic field normalization
          // Enhanced date parsing with multiple field names
          const dep = r['Sailing Date'] || r['Departure Date'] || r['SAILING DATE'] || r['DEPARTURE DATE'] || r['depart'] || r['Date'] || r['date'] || r['Start Date'] || r['START DATE'];
          const nights = parseInt(String(r['Nights'] ?? r['NIGHTS'] ?? r['nights'] ?? r['Night'] ?? r['NIGHT'] ?? '7'), 10) || 7;
          
          // Parse departure date more carefully
          let departureDate = '';
          if (dep) {
            try {
              const parsed = new Date(dep);
              if (!isNaN(parsed.getTime())) {
                departureDate = parsed.toISOString().split('T')[0];
              }
            } catch (e) {
              console.warn(`Failed to parse departure date: ${dep}`);
            }
          }
          
          if (!departureDate) {
            departureDate = new Date().toISOString().split('T')[0];
          }
          
          // Calculate return date based on departure + nights
          const ret = new Date(departureDate);
          ret.setDate(ret.getDate() + nights);
          const returnDate = ret.toISOString().split('T')[0];
          
          // Enhanced ship name parsing
          const ship = String(r['Ship Name'] ?? r['SHIP NAME'] ?? r['ship'] ?? r['Ship'] ?? r['SHIP'] ?? 'Unknown Ship').trim();
          const cruiseKey = `${ship.toLowerCase().trim()}_${departureDate}`;
          
          const cruiseData = {
            ship,
            itineraryName: String(r['Itinerary'] ?? r['ITINERARY'] ?? r['itineraryName'] ?? r['Itinerary Name'] ?? r['ITINERARY NAME'] ?? ''),
            departurePort: String(r['Departure Port'] ?? r['DEPARTURE PORT'] ?? r['departurePort'] ?? r['Port'] ?? r['PORT'] ?? ''),
            portsRoute: String(r['All Ports'] ?? r['Ports/Route'] ?? r['Route'] ?? r['ROUTE'] ?? r['Ports Route'] ?? r['portsRoute'] ?? ''),
            departureDate,
            returnDate,
            nights,
            line: String(r['Line'] ?? r['line'] ?? 'Royal Caribbean'),
            region: String(r['Region'] ?? r['region'] ?? ''),
            stateroomTypes: ['Interior', 'Oceanview', 'Balcony', 'Suite'],
            status: 'on_sale',
            // Additional fields that might be in cruises.xlsx
            cabinType: r['Cabin Type'] ? String(r['Cabin Type']) : undefined,
            casinoOfferType: r['Casino Offer Type'] ? String(r['Casino Offer Type']) : undefined,
            offerName: r['Offer Name'] ? String(r['Offer Name']) : undefined,
            offerCode: r['Offer Code'] ? String(r['Offer Code']) : undefined,
            offerExpirationDate: r['Offer Expiration Date'] ? new Date(r['Offer Expiration Date']).toISOString().split('T')[0] : undefined,
            typeOfOffer: r['Type of Offer'] ? String(r['Type of Offer']) : undefined,
            value: r['Value'] ? String(r['Value']) : undefined,
            // NEW: Enhanced cabin pricing from cruises.xlsx
            interiorPrice: (() => {
              const v = r['Interior Cabin Price'] ?? r['Interior retail price'] ?? r['Interior Retail Price'] ?? r['Interior Price'] ?? r['Interior'];
              const num = typeof v === 'number' ? v : (typeof v === 'string' ? parseFloat(String(v).replace(/[^0-9.]/g, '')) : NaN);
              return (!isNaN(num) && num > 0) ? num : null;
            })(),
            oceanviewPrice: (() => {
              const v = r['Oceanview Cabin Price'] ?? r['Oceanview retail price'] ?? r['Oceanview Retail Price'] ?? r['Oceanview Price'] ?? r['Oceanview'];
              const num = typeof v === 'number' ? v : (typeof v === 'string' ? parseFloat(String(v).replace(/[^0-9.]/g, '')) : NaN);
              return (!isNaN(num) && num > 0) ? num : null;
            })(),
            balconyPrice: (() => {
              const v = r['Balcony Cabin Price'] ?? r['Balcony retail price'] ?? r['Balcony Retail Price'] ?? r['Balcony Price'] ?? r['Balcony'];
              const num = typeof v === 'number' ? v : (typeof v === 'string' ? parseFloat(String(v).replace(/[^0-9.]/g, '')) : NaN);
              return (!isNaN(num) && num > 0) ? num : null;
            })(),
            suitePrice: (() => {
              const v = r['Suite Cabin Price'] ?? r['Suite retail price'] ?? r['Suite Retail Price'] ?? r['Suite Price'] ?? r['Suite'];
              const num = typeof v === 'number' ? v : (typeof v === 'string' ? parseFloat(String(v).replace(/[^0-9.]/g, '')) : NaN);
              return (!isNaN(num) && num > 0) ? num : null;
            })(),
            portTaxesFees: (() => {
              const v = r['Port Taxes & Fees'] ?? r['Port Taxes and Fees'] ?? r['Taxes & Fees'] ?? r['Taxes and Fees'] ?? r['portTaxesFees'];
              const num = typeof v === 'number' ? v : (typeof v === 'string' ? parseFloat(String(v).replace(/[^0-9.]/g, '')) : NaN);
              return (!isNaN(num) && num > 0) ? num : null;
            })(),
            // NEW: Multiple offer codes support
            offerCodes: (() => {
              const v = r['Offer Codes'] ?? r['offerCodes'] ?? r['Multiple Offer Codes'];
              if (v) {
                if (Array.isArray(v)) return v.filter(c => c && typeof c === 'string');
                if (typeof v === 'string' && v.trim()) {
                  return v.split(',').map(c => c.trim()).filter(Boolean);
                }
              }
              return r['Offer Code'] ?? r.offerCode ? [String(r['Offer Code'] ?? r.offerCode)] : undefined;
            })(),
            // NEW: Detailed itinerary with day/time/ports
            itineraryDetails: (() => {
              const v = r['Itinerary DAY & TIME Ports'] ?? r['Itinerary Details'] ?? r.itineraryDetails;
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
                const v = r['Interior Cabin Price'] ?? r['Interior retail price'] ?? r['Interior Retail Price'] ?? r['Interior Price'] ?? r['Interior'];
                const num = typeof v === 'number' ? v : (typeof v === 'string' ? parseFloat(String(v).replace(/[^0-9.]/g, '')) : NaN);
                return (!isNaN(num) && num > 0) ? num : null;
              })();
              if (interior) {
                return { interior, source: 'xlsx', fetchedAt: new Date().toISOString() };
              }
              return undefined;
            })(),
          };
          
          cruiseMap.set(cruiseKey, cruiseData);
          summary.imported.cruises += 1;
        } catch (err) {
          console.warn('[Startup] Failed to import cruise row', idx + 1, err);
        }
      });
    }

    // STEP 2: Process booked cruises and merge with main cruise data
    if (exists.booked) {
      const rows = readXlsx(files.booked);
      console.log(`[Startup] Processing ${rows.length} booked cruises from booked.xlsx`);
      
      rows.forEach((r, idx) => {
        try {
          // Enhanced booked cruise date parsing
          const start = r['Start Date'] ?? r['START DATE'] ?? r['startDate'] ?? r['Sailing Date'] ?? r['Departure Date'] ?? r['SAILING DATE'] ?? r['DEPARTURE DATE'];
          const end = r['End Date'] ?? r['END DATE'] ?? r['endDate'] ?? r['Return Date'] ?? r['RETURN DATE'];
          
          let startDate = '';
          if (start) {
            try {
              const parsed = new Date(start);
              if (!isNaN(parsed.getTime())) {
                startDate = parsed.toISOString().split('T')[0];
              }
            } catch (e) {
              console.warn(`Failed to parse start date: ${start}`);
            }
          }
          
          if (!startDate) {
            startDate = new Date().toISOString().split('T')[0];
          }
          
          const nights = parseInt(String(r['Nights'] ?? r['NIGHTS'] ?? r['nights'] ?? r['Night'] ?? r['NIGHT'] ?? '7'), 10) || 7;
          
          // Enhanced ship name parsing for booked cruises - moved before endDate calculation
          const ship = String(r['Ship'] ?? r['SHIP'] ?? r['ship'] ?? r['Ship Name'] ?? r['SHIP NAME'] ?? 'Unknown Ship').trim();
          
          let endDate = '';
          if (end) {
            try {
              const parsed = new Date(end);
              if (!isNaN(parsed.getTime())) {
                endDate = parsed.toISOString().split('T')[0];
              }
            } catch (e) {
              console.warn(`Failed to parse end date: ${end}`);
            }
          }
          
          // CRITICAL FIX: Always calculate endDate properly using the memory store method
          if (!endDate) {
            const calculatedEndDate = memoryStore.calculateReturnDate(startDate, nights);
            endDate = calculatedEndDate || (() => {
              // Fallback calculation if memory store method fails
              const ret = new Date(startDate);
              ret.setDate(ret.getDate() + nights);
              return ret.toISOString().split('T')[0];
            })();
            console.log(`[Startup] Calculated endDate for ${ship}: ${startDate} + ${nights} nights = ${endDate}`);
          }
          const cruiseKey = `${ship.toLowerCase().trim()}_${startDate}`;
          
          // Check if this cruise exists in the main cruise list
          let existingCruise = cruiseMap.get(cruiseKey);
          
          if (existingCruise) {
            // Merge booking data into existing cruise
            console.log(`[Startup] ✅ Found matching cruise for booking: ${ship} on ${startDate}`);
            
            // CRITICAL FIX: Set bookingId to the cruise's own ID to mark it as booked
            const bookingNumber = String(
              r['Reservation Number'] ??
              r['Reservation #'] ??
              r['Reservation'] ??
              r['reservationNumber'] ??
              r['Booking ID#'] ?? r['BOOKING ID#'] ??
              r['Booking ID'] ?? r['BOOKING ID'] ??
              ''
            );
            // The bookingId should reference the cruise itself to mark it as booked
            // We'll set it after the cruise is created in the memory store
            existingCruise.reservationNumber = bookingNumber;
            existingCruise._needsBookingId = true; // Flag to set bookingId after creation
            
            // Enhanced field mapping
            existingCruise.guests = parseInt(String(r['Guests'] ?? r['GUESTS'] ?? r['guests'] ?? r['Guest Count'] ?? '2'), 10) || 2;
            existingCruise.daysToGo = parseInt(String(r['Days to Go'] ?? r['daysToGo'] ?? r['DAYS TO GO'] ?? '0'), 10) || 0;
            
            // Update ports route if not already set
            if (!existingCruise.portsRoute) {
              existingCruise.portsRoute = String(r['Ports/Route'] ?? r['portsRoute'] ?? r['Route'] ?? r['ROUTE'] ?? '');
            }
            
            // Financial data
            existingCruise.paidFare = r['Paid Fare'] ?? r['PAID FARE'] ? Number(r['Paid Fare'] ?? r['PAID FARE']) : undefined;
            existingCruise.actualFare = r['Actual Fare'] ?? r['ACTUAL FARE'] ? Number(r['Actual Fare'] ?? r['ACTUAL FARE']) : undefined;
            existingCruise.currentMarketPrice = r['Current Market Price'] ?? r['CURRENT MARKET PRICE'] ? Number(r['Current Market Price'] ?? r['CURRENT MARKET PRICE']) : undefined;
            existingCruise.actualSavings = r['Actual Savings'] ?? r['ACTUAL SAVINGS'] ? Number(r['Actual Savings'] ?? r['ACTUAL SAVINGS']) : undefined;
            existingCruise.projectedSavings = r['Projected Savings'] ?? r['PROJECTED SAVINGS'] ? Number(r['Projected Savings'] ?? r['PROJECTED SAVINGS']) : undefined;
            
            // Update the map
            cruiseMap.set(cruiseKey, existingCruise);
          } else {
            // Create new cruise from booking data (cruise not in main list)
            console.log(`[Startup] ➕ Adding new cruise from booking: ${ship} on ${startDate}`);
            
            // Generate proper booking ID
            const bookingNumber = String(
              r['Reservation Number'] ??
              r['Reservation #'] ??
              r['Reservation'] ??
              r['reservationNumber'] ??
              r['Booking ID#'] ?? r['BOOKING ID#'] ??
              r['Booking ID'] ?? r['BOOKING ID'] ??
              ''
            );
            
            const newCruise = {
              ship,
              itineraryName: String(r['Itinerary Name'] ?? r['ITINERARY NAME'] ?? r['itineraryName'] ?? r['Itinerary'] ?? r['ITINERARY'] ?? ''),
              departurePort: String(r['Departure Port'] ?? r['DEPARTURE PORT'] ?? r['departurePort'] ?? r['Port'] ?? r['PORT'] ?? ''),
              departureDate: startDate,
              returnDate: endDate,
              nights,
              line: String(r['Line'] ?? r['LINE'] ?? r['Cruise Line'] ?? 'Royal Caribbean'),
              region: String(r['Region'] ?? r['REGION'] ?? ''),
              stateroomTypes: ['Interior', 'Oceanview', 'Balcony', 'Suite'],
              status: 'on_sale',
              portsRoute: String(r['Ports/Route'] ?? r['portsRoute'] ?? r['Route'] ?? r['ROUTE'] ?? ''),
              
              // Booking information - bookingId will be set after creation
              reservationNumber: bookingNumber,
              _needsBookingId: true, // Flag to set bookingId after creation
              guests: parseInt(String(r['Guests'] ?? r['GUESTS'] ?? r['guests'] ?? r['Guest Count'] ?? '2'), 10) || 2,
              daysToGo: parseInt(String(r['Days to Go'] ?? r['daysToGo'] ?? r['DAYS TO GO'] ?? '0'), 10) || 0,
              
              // Financial data
              paidFare: r['Paid Fare'] ?? r['PAID FARE'] ? Number(r['Paid Fare'] ?? r['PAID FARE']) : undefined,
              actualFare: r['Actual Fare'] ?? r['ACTUAL FARE'] ? Number(r['Actual Fare'] ?? r['ACTUAL FARE']) : undefined,
              currentMarketPrice: r['Current Market Price'] ?? r['CURRENT MARKET PRICE'] ? Number(r['Current Market Price'] ?? r['CURRENT MARKET PRICE']) : undefined,
              actualSavings: r['Actual Savings'] ?? r['ACTUAL SAVINGS'] ? Number(r['Actual Savings'] ?? r['ACTUAL SAVINGS']) : undefined,
              projectedSavings: r['Projected Savings'] ?? r['PROJECTED SAVINGS'] ? Number(r['Projected Savings'] ?? r['PROJECTED SAVINGS']) : undefined,
            };
            
            cruiseMap.set(cruiseKey, newCruise);
            summary.imported.cruises += 1; // Count as new cruise
          }
          
          summary.imported.booked += 1;
        } catch (err) {
          console.warn('[Startup] Failed to import booked row', idx + 1, err);
        }
      });
    }
    
    // STEP 3: Create all cruises in the memory store
    console.log(`[Startup] Creating ${cruiseMap.size} unified cruises in memory store`);
    cruiseMap.forEach((cruiseData) => {
      const createdCruise = memoryStore.createCruise(cruiseData);
      
      // CRITICAL FIX: Set bookingId to the cruise's own ID if it's a booked cruise
      if ((cruiseData as any)._needsBookingId && createdCruise.reservationNumber) {
        createdCruise.bookingId = createdCruise.id;
        console.log(`[Startup] Set bookingId for booked cruise: ${createdCruise.ship} (${createdCruise.departureDate}) - ID: ${createdCruise.id}`);
      }
    });

    if (exists.offers) {
      const rows = readXlsx(files.offers);
      rows.forEach((r, idx) => {
        try {
          let expiresRaw = r['EXPIRES'] ?? r['Expires'] ?? r['expires'];
          let expires = '';
          if (expiresRaw) {
            const d = new Date(expiresRaw);
            expires = !isNaN(d.getTime()) ? d.toISOString().split('T')[0] : new Date().toISOString().split('T')[0];
          } else {
            expires = new Date().toISOString().split('T')[0];
          }
          // Parse ships (can be comma-separated string or array)
          let ships: string[] | undefined;
          const shipsRaw = r['SHIPS'] ?? r['Ships'] ?? r['ships'] ?? r['SHIP'] ?? r['Ship'] ?? r['ship'];
          if (shipsRaw) {
            if (Array.isArray(shipsRaw)) {
              ships = shipsRaw.filter(s => s && typeof s === 'string');
            } else if (typeof shipsRaw === 'string' && shipsRaw.trim()) {
              ships = shipsRaw.split(',').map(s => s.trim()).filter(Boolean);
            }
          }
          
          // Parse sailing dates (can be comma-separated string or array)
          let sailingDates: string[] | undefined;
          const sailingDatesRaw = r['SAILING DATES'] ?? r['Sailing Dates'] ?? r['sailingDates'] ?? r['SAIL DATES'] ?? r['Sail Dates'];
          if (sailingDatesRaw) {
            if (Array.isArray(sailingDatesRaw)) {
              sailingDates = sailingDatesRaw.filter(s => s && typeof s === 'string');
            } else if (typeof sailingDatesRaw === 'string' && sailingDatesRaw.trim()) {
              sailingDates = sailingDatesRaw.split(',').map(s => s.trim()).filter(Boolean);
            }
          }
          
          // Parse offer start/end dates for date range matching
          const offerStartDateRaw = r['OFFER START DATE'] ?? r['Offer Start Date'] ?? r['offerStartDate'] ?? r['Offer Received Date'] ?? r['OFFER RECEIVED DATE'];
          const offerStartDate = offerStartDateRaw ? (() => {
            const d = new Date(offerStartDateRaw);
            return !isNaN(d.getTime()) ? d.toISOString().split('T')[0] : undefined;
          })() : undefined;
          
          const offerEndDateRaw = r['OFFER END DATE'] ?? r['Offer End Date'] ?? r['offerEndDate'] ?? expiresRaw;
          const offerEndDate = offerEndDateRaw ? (() => {
            const d = new Date(offerEndDateRaw);
            return !isNaN(d.getTime()) ? d.toISOString().split('T')[0] : undefined;
          })() : expires;
          
          const perks = r['PERKS'] ?? r['Perks'] ?? r['perks'];
          
          memoryStore.createCasinoOffer({
            name: String(r['NAME'] ?? r['Name'] ?? r['name'] ?? 'Unknown'),
            rewardNumber: String(r['REWARD NUMBER'] ?? r['rewardNumber'] ?? ''),
            offerName: String(r['OFFER NAME'] ?? r['Offer Name'] ?? r['offerName'] ?? 'Unknown Offer'),
            offerType: String(r['OFFER TYPE'] ?? r['Offer Type'] ?? r['offerType'] ?? 'Unknown'),
            expires,
            offerCode: String(r['OFFER CODE'] ?? r['Offer Code'] ?? r['offerCode'] ?? ''),
            tradeInValue: String(r['TRADE IN VALUE'] ?? r['Trade In Value'] ?? r['tradeInValue'] ?? '$0'),
            ships,
            sailingDates,
            offerStartDate,
            offerEndDate,
            perks,
          });
          summary.imported.offers += 1;
        } catch (err) {
          console.warn('[Startup] Failed to import offer row', idx + 1, err);
        }
      });
    }

    // Override with canonical "Gospel truth" offers provided by user
    try {
      console.log('[Startup] Replacing casino offers with canonical list from instruction');
      memoryStore.clearCasinoOffers();
      const canonicalOffers = [
        {
          name: 'West Coast Favorites',
          rewardNumber: '',
          offerName: 'Balcony or Oceanview Room for Two',
          offerType: 'No extras listed',
          expires: '2025-10-21',
          offerCode: '25WST204',
          tradeInValue: '$0',
        },
        {
          name: 'Power Perks',
          rewardNumber: '',
          offerName: 'Ocean View or Interior Room for Two',
          offerType: 'Bonus FP $75 • Deluxe Beverage Package • Hideaway Beach Park Pass',
          expires: '2025-10-23',
          offerCode: '25PRK206',
          tradeInValue: '$450 trade-in value',
        },
        {
          name: 'Tropical Thrills',
          rewardNumber: '',
          offerName: 'Balcony or Ocean View Room for Two',
          offerType: 'Trade-in value',
          expires: '2025-10-08',
          offerCode: '25EMV503',
          tradeInValue: '$475 trade-in value',
        },
        {
          name: "Dealer's Pick",
          rewardNumber: '',
          offerName: 'Balcony or Ocean View Room for Two',
          offerType: 'Trade-in value',
          expires: '2025-10-15',
          offerCode: '25NEW304',
          tradeInValue: '$500 trade-in value',
        },
        {
          name: 'Winter Winners',
          rewardNumber: '',
          offerName: 'Balcony or Interior Room for Two',
          offerType: 'Trade-in value',
          expires: '2025-10-18',
          offerCode: '25VAR903',
          tradeInValue: '$475 trade-in value',
        },
        {
          name: 'Oasis Class Bash',
          rewardNumber: '',
          offerName: 'Balcony Room for Two',
          offerType: 'Trade-in value',
          expires: '2025-09-27',
          offerCode: '25WNP102',
          tradeInValue: '$275 trade-in value',
        },
        {
          name: 'September Monthly Mix',
          rewardNumber: '',
          offerName: 'Ocean View or Interior Room for Two',
          offerType: 'Bonus FP $50',
          expires: '2025-10-01',
          offerCode: '25RCL906',
          tradeInValue: '$250 trade-in value',
        },
        {
          name: 'Last Chance Plays',
          rewardNumber: '',
          offerName: 'Balcony or Interior Room for Two',
          offerType: 'Trade-in value',
          expires: '2025-10-02',
          offerCode: '25CLS405',
          tradeInValue: '$225 trade-in value',
        },
        {
          name: '2025 August Instant Rewards',
          rewardNumber: '',
          offerName: 'Exclusive Stateroom Offer',
          offerType: 'Trade-in value',
          expires: '2025-10-03',
          offerCode: '2508A05',
          tradeInValue: '$500 trade-in value',
        },
        {
          name: '2025 September Instant Rewards',
          rewardNumber: '',
          offerName: '$300 Off Your Choice of Room',
          offerType: 'Discount',
          expires: '2025-10-12',
          offerCode: '2509A07',
          tradeInValue: '$300 discount',
        },
        {
          name: '2025 September Instant Rewards',
          rewardNumber: '',
          offerName: '$300 Off Your Choice of Room',
          offerType: 'Discount',
          expires: '2025-10-19',
          offerCode: '2509A07',
          tradeInValue: '$300 discount',
        },
        {
          name: 'Queen of Hearts',
          rewardNumber: '',
          offerName: 'Ocean View or Interior Room for Two',
          offerType: 'Trade-in value',
          expires: '2025-09-24',
          offerCode: '25MIX105',
          tradeInValue: '$250 trade-in value',
        },
      ];

      memoryStore.bulkCreateCasinoOffers(canonicalOffers);
      console.log('[Startup] Canonical offers loaded:', canonicalOffers.length);
    } catch (e) {
      console.warn('[Startup] Failed to apply canonical offers override', e);
    }

    if (exists.calendar) {
      try {
        const ics = fs.readFileSync(files.calendar, 'utf-8');
        const events = parseICS(ics).map((e) => ({ ...e, source: 'manual' as const }));
        events.forEach((e) => memoryStore.createCalendarEvent(e));
        summary.imported.events += events.length;
      } catch (err) {
        console.warn('[Startup] Failed to parse calendar.ics', err);
      }
    }

    if (exists.tripit) {
      try {
        const ics = fs.readFileSync(files.tripit, 'utf-8');
        const events = parseICS(ics).map((e) => ({ ...e, source: 'tripit' as const }));
        events.forEach((e) => memoryStore.createCalendarEvent(e));
        summary.imported.events += events.length;
      } catch (err) {
        console.warn('[Startup] Failed to parse tripit.ics', err);
      }
    }

    // Final cleanup pass skipped (no performDataCleanup in store)
    
    // Log the unified system results
    const totalCruises = memoryStore.getCruises().length;
    const bookedCruises = memoryStore.getCruises().filter(c => c.bookingId).length;
    const availableCruises = totalCruises - bookedCruises;
    
    console.log(`[Startup] 🎯 UNIFIED SYSTEM COMPLETE:`);
    console.log(`[Startup]   📊 Total Cruises: ${totalCruises}`);
    console.log(`[Startup]   ✅ Booked Cruises: ${bookedCruises}`);
    console.log(`[Startup]   🚢 Available Cruises: ${availableCruises}`);
    console.log(`[Startup]   🎰 Casino Offers: ${memoryStore.getCasinoOffers().length}`);
    console.log(`[Startup]   📅 Calendar Events: ${memoryStore.getCalendarEvents().length}`);

    summary.ok = true;
    summary.message = `Unified system: ${totalCruises} total cruises (${bookedCruises} booked, ${availableCruises} available)`;
    return summary;
  } catch (error) {
    console.warn('[Startup] Preload failed but continuing with static data:', error instanceof Error ? error.message : 'Unknown error');
    summary.ok = true; // Don't fail startup - just log the warning
    summary.message = `Preload failed but continuing: ${error instanceof Error ? error.message : 'Unknown error'}`;
    return summary;
  }
}

export default preloadFromDataFolder;
