import { v4 as uuid } from 'uuid';
import path from 'path';
import { isDiskWritable, fsSafe } from '@/backend/trpc/routes/_utils/fsSupport';
import type {
  Cruise,
  BookedCruise,
  CasinoOffer,
  CalendarEvent,
  Offer,
  Price,
  Threshold,
  Alert,
  UserProfile,
  PriceTrend,
  SavingsSummary,
  CasinoAnalytics,
  CasinoPayTableEntry,
  CasinoOfferAnalysis,
  CruiseCasinoSummary
} from '@/types/models';
import type { ReceiptData, FinancialsRecord } from '@/types/models';
import { normalizeCategory, normalizeDepartment, normalizePaymentMethod, extractOnboardCredit, extractRefOrFolio } from '@/backend/trpc/routes/financials/normalizers';

const CASINO_PAY_TABLE: CasinoPayTableEntry[] = [
  { offerCode: '2502AVIP2', points: 40000, reward: 'Variable Category Suite (on select sailings)', nextCruiseBonus: 'Variable FreePlay up to $5,000', cabinTypes: ['Suite'] },
  { offerCode: '2502A01', points: 25000, reward: 'Grand Suite (Junior Suite on select sailings)', nextCruiseBonus: '$2,500 FreePlay', cabinTypes: ['Suite', 'Junior Suite'] },
  { offerCode: '2502A02', points: 15000, reward: 'Junior Suite', nextCruiseBonus: '$1,500 FreePlay', cabinTypes: ['Junior Suite'] },
  { offerCode: '2502A02A', points: 9000, reward: 'Junior Suite or Balcony Stateroom (on select sailings)', nextCruiseBonus: '$1,000 FreePlay', cabinTypes: ['Junior Suite', 'Balcony'] },
  { offerCode: '2502A03', points: 6500, reward: 'Balcony Stateroom (Junior Suite on select sailings)', nextCruiseBonus: '$750 FreePlay', cabinTypes: ['Balcony', 'Junior Suite'] },
  { offerCode: '2502A03A', points: 4000, reward: 'Balcony or Oceanview Stateroom (on select sailings)', nextCruiseBonus: '$500 FreePlay', cabinTypes: ['Balcony', 'Oceanview'] },
  { offerCode: '2502A04', points: 3000, reward: 'Oceanview Stateroom (Balcony on select sailings)', nextCruiseBonus: '$250 FreePlay', cabinTypes: ['Oceanview', 'Balcony'] },
  { offerCode: '2502A05', points: 2000, reward: 'Interior or up to Balcony Stateroom (Cruise Fare for One + Discounted Fare for Guest)', nextCruiseBonus: '$150 FreePlay', cabinTypes: ['Interior', 'Oceanview', 'Balcony'] },
  { offerCode: '2502A06', points: 1500, reward: 'Interior or up to Balcony Stateroom (Cruise Fare for One + Discounted Fare for Guest)', nextCruiseBonus: '$100 FreePlay', cabinTypes: ['Interior', 'Oceanview', 'Balcony'] },
  { offerCode: '2502A07', points: 1200, reward: '$300 Off', nextCruiseBonus: 'Same cruise fare discount', cabinTypes: ['Interior', 'Oceanview', 'Balcony', 'Suite'] },
  { offerCode: '2502A08', points: 800, reward: '$250 Off', nextCruiseBonus: 'Same cruise fare discount', cabinTypes: ['Interior', 'Oceanview', 'Balcony', 'Suite'] },
  { offerCode: '2502A09', points: 600, reward: '$200 Off', nextCruiseBonus: 'Same cruise fare discount', cabinTypes: ['Interior', 'Oceanview', 'Balcony', 'Suite'] },
  { offerCode: '2502A10', points: 400, reward: '$100 Off (Interior Stateroom or Cruise Fare for One + Discounted Fare for Guest)', nextCruiseBonus: 'Same cruise fare discount', cabinTypes: ['Interior'] }
];

// Use global to ensure singleton persists across module reloads in development
declare global {
  // eslint-disable-next-line no-var
  var __memoryStore: MemoryStore | undefined;
  var __memoryStoreDebug: { lastAccess: string; eventCount: number } | undefined;
}

// In-memory data store
class MemoryStore {
  public cruises: Cruise[] = [];
  public bookedCruises: BookedCruise[] = [];
  public casinoOffers: CasinoOffer[] = [];
  public calendarEvents: CalendarEvent[] = [];
  public offers: Offer[] = [];
  public prices: Price[] = [];
  public thresholds: Threshold[] = [];
  public alerts: Alert[] = [];
  public priceAlerts: any[] = []; // Web pricing alerts
  public receipts: ReceiptData[] = [];
  public cruiseStatements: any[] = [];
  public financials: FinancialsRecord[] = [];
  // P4-11 persistence buckets
  public certificates: import('@/types/models').CertificateItem[] = [];
  public estimatorParams: import('@/types/models').EstimatorParams | null = null;
  public casinoPerformance: import('@/types/models').CasinoPerformance[] = [];

  private userProfile: UserProfile | null = null;
  private priceTrends: PriceTrend[] = [];
  public casinoAnalytics: CasinoAnalytics[] = [];
  public lastImport: string | null = null;
  public webPricingSnapshot: { results: any[]; summary: any } | null = null;

  // Persistence
  public persistFilePath: string = path.join(process.cwd(), 'DATA', 'persist.json');
  private persistDebounce: ReturnType<typeof setTimeout> | null = null;
  private isLoadingFromDisk: boolean = false;
  private lastPersistAt: string | null = null;
  
  // Rollback system for data updates
  private dataSnapshots: Map<string, {
    timestamp: string;
    cruises: Cruise[];
    bookedCruises: BookedCruise[];
    casinoOffers: CasinoOffer[];
    description: string;
    operationType: 'web-update' | 'import' | 'manual-fix' | 'batch-verify';
  }> = new Map();
  private maxSnapshots = 10; // Keep last 10 snapshots

  constructor() {
    console.log('[MemoryStore] Constructor called');

    this.userProfile = {
      id: uuid(),
      level: 'PRIME',
      points: 20720,
      nextLevelPoints: 25000,
      totalSpent: 103410,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    console.log('[MemoryStore] Instance created - initializing persistence and data load');
    this.initPersistence().catch((e) => {
      console.warn('[MemoryStore] Persistence init failed (will continue in-memory):', e instanceof Error ? e.message : String(e));
    });
    
    // Load data from DATA folder if persist.json is empty
    this.loadInitialData().catch((e) => {
      console.warn('[MemoryStore] Initial data load failed:', e instanceof Error ? e.message : String(e));
    });
  }

  public async initPersistence(): Promise<void> {
    if (this.isLoadingFromDisk) return;
    this.isLoadingFromDisk = true;
    try {
      if (isDiskWritable() && fsSafe) {
        await fsSafe.mkdir(path.dirname(this.persistFilePath), { recursive: true });
      }
      const exists = isDiskWritable() && fsSafe ? await fsSafe
        .stat(this.persistFilePath)
        .then(() => true)
        .catch(() => false) : false;
      if (!exists) {
        console.log('[MemoryStore] No persist file found, will load from DATA folder:', this.persistFilePath);
        this.isLoadingFromDisk = false;
        return;
      }
      const raw = isDiskWritable() && fsSafe ? await fsSafe.readFile(this.persistFilePath, 'utf8') : '';
      if (raw && raw.trim().length > 0) {
        const data = JSON.parse(raw);
        this.cruises = Array.isArray(data.cruises) ? data.cruises : [];
        this.bookedCruises = Array.isArray(data.bookedCruises) ? data.bookedCruises : [];
        this.casinoOffers = Array.isArray(data.casinoOffers) ? data.casinoOffers : [];
        this.calendarEvents = Array.isArray(data.calendarEvents) ? data.calendarEvents : [];
        this.offers = Array.isArray(data.offers) ? data.offers : [];
        this.prices = Array.isArray(data.prices) ? data.prices : [];
        this.thresholds = Array.isArray(data.thresholds) ? data.thresholds : [];
        this.alerts = Array.isArray(data.alerts) ? data.alerts : [];
        this.priceAlerts = Array.isArray(data.priceAlerts) ? data.priceAlerts : [];
        this.receipts = Array.isArray(data.receipts) ? data.receipts : [];
        this.cruiseStatements = Array.isArray(data.cruiseStatements) ? data.cruiseStatements : [];
        this.financials = Array.isArray(data.financials) ? data.financials : [];
        this.casinoAnalytics = Array.isArray(data.casinoAnalytics) ? data.casinoAnalytics : [];
        this.certificates = Array.isArray(data.certificates) ? data.certificates : [];
        this.estimatorParams = data.estimatorParams ?? null;
        this.casinoPerformance = Array.isArray(data.casinoPerformance) ? data.casinoPerformance : [];
        this.userProfile = data.userProfile ?? this.userProfile;
        this.lastImport = data.lastImport ?? this.lastImport;
        this.webPricingSnapshot = data.webPricingSnapshot ?? this.webPricingSnapshot;
        console.log('[MemoryStore] Loaded persisted state from disk:', this.persistFilePath, {
          cruises: this.cruises.length,
          bookedCruises: this.bookedCruises.length,
          offers: this.casinoOffers.length,
          receipts: this.receipts.length,
          statements: this.cruiseStatements.length,
          analytics: this.casinoAnalytics.length,
          calendar: this.calendarEvents.length,
          financials: this.financials.length
        });
        this.standardizeAllDates();
        this.fixCruiseDatesAndDuration();
        this.fixBookingIds();
        this.updateLifecycleStatuses();
      }
    } catch (error) {
      console.error('[MemoryStore] Error loading persisted state:', error);
    } finally {
      this.isLoadingFromDisk = false;
    }
  }

  private async loadInitialData(): Promise<void> {
    // Wait for persistence to finish loading first
    while (this.isLoadingFromDisk) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    // Only load from DATA folder if we have no data
    if (this.cruises.length > 0 || this.bookedCruises.length > 0 || this.casinoOffers.length > 0) {
      console.log('[MemoryStore] Data already loaded from persist.json, skipping DATA folder load');
      console.log('[MemoryStore] Current data counts:', {
        cruises: this.cruises.length,
        bookedCruises: this.bookedCruises.length,
        casinoOffers: this.casinoOffers.length,
        calendarEvents: this.calendarEvents.length
      });
      return;
    }

    console.log('[MemoryStore] No persisted data found, loading from DATA folder...');
    
    try {
      const { readDataFiles } = await import('../import/startup');
      const { data } = readDataFiles();
      
      console.log('[MemoryStore] Loaded data from DATA folder:', {
        cruises: data.cruises.length,
        booked: data.booked.length,
        offers: data.offers.length,
        calendar: data.calendar.length,
        tripit: data.tripit.length
      });

      // Import cruises
      if (data.cruises.length > 0) {
        const cruisesToImport = data.cruises.map((row: any) => {
          const departureDate = row['Sailing Date'] || row.departureDate || '';
          const nights = Number(row['Nights'] || row.nights || 7);
          const returnDate = row['Return Date'] || row.returnDate || this.calculateReturnDate(departureDate, nights) || '';
          
          return {
            ship: row['Ship Name'] || row.ship || '',
            line: row['Cruise Line'] || row.line || 'Royal Caribbean',
            itineraryName: row['Itinerary Name'] || row['Itinerary'] || row.itinerary || '',
            uniqueCruiseId: row['Unique Cruise ID'] || row['UNIQUECRUISEID'] || row.uniqueCruiseId || undefined,
            departureDate,
            returnDate,
            nights,
            departurePort: row['Departure Port'] || row.port || '',
            region: row['Region'] || row.region || '',
            cabinType: row['Cabin Type'] || row.cabinType || 'Interior',
            stateroomTypes: [row['Cabin Type'] || row.cabinType || 'Interior'],
            status: 'on_sale' as const,
            value: String(row['Value'] || row.value || '0'),
            offerCode: row['Offer Code'] || row.offerCode || '',
            offerName: row['Offer Name'] || row.offerName || '',
            offerExpirationDate: row['OFFER EXPIRE DATE'] || row['Offer Expiration'] || row.offerExpiration || ''
          } as Omit<Cruise, 'id' | 'createdAt' | 'updatedAt'>;
        });
        
        this.bulkCreateCruises(cruisesToImport);
      }

      // Import booked cruises
      if (data.booked.length > 0) {
        const bookedToImport = data.booked.map((row: any) => {
          const startDate = row['Start Date'] || row.startDate || row.departureDate || '';
          const nights = Number(row['Nights'] || row.nights || 7);
          const endDate = row['End Date'] || row.endDate || row.returnDate || this.calculateReturnDate(startDate, nights) || '';
          const today = new Date();
          const start = new Date(startDate);
          const diffTime = start.getTime() - today.getTime();
          const daysToGo = Math.max(0, Math.ceil(diffTime / (1000 * 60 * 60 * 24)));
          
          return {
            ship: row['Ship Name'] || row.ship || '',
            line: row['Cruise Line'] || row.line || 'Royal Caribbean',
            itineraryName: row['Itinerary Name'] || row.itinerary || '',
            uniqueCruiseId: row['Unique Cruise ID'] || row['UNIQUECRUISEID'] || row.uniqueCruiseId || undefined,
            departureDate: startDate,
            returnDate: endDate,
            nights,
            departurePort: row['Departure Port'] || row.port || '',
            reservationNumber: row['Reservation Number'] || row.reservationNumber || '',
            guests: Number(row['Guests'] || row.guests || 2),
            daysToGo,
            cabinNumber: row['Cabin Number'] || row.cabinNumber || '',
            actualFare: Number(row['Actual Fare'] || row.actualFare || 0),
            currentMarketPrice: Number(row['Current Market Price'] || row.currentMarketPrice || 0),
            actualSavings: Number(row['Actual Savings'] || row.actualSavings || 0)
          } as Omit<BookedCruise, 'id' | 'createdAt' | 'updatedAt'>;
        });
        
        this.bulkCreateBookedCruises(bookedToImport);
      }

      // Import casino offers
      if (data.offers.length > 0) {
        const offersToImport = data.offers.map((row: any) => {
          const offerName = row['Offer Name'] || row.offerName || row.name || '';
          return {
            name: row['Name'] || row.name || offerName,
            rewardNumber: row['Reward Number'] || row.rewardNumber || '',
            offerName,
            offerCode: row['Offer Code'] || row.offerCode || '',
            offerType: row['Offer Type'] || row.offerType || 'Casino',
            expires: row['OFFER EXPIRE DATE'] || row['Expires'] || row.expires || row['Expiration Date'] || row['Offer Expire Date'] || '',
            pointsRequired: Number(row['Points Required'] || row.pointsRequired || 0),
            tradeInValue: String(row['Trade In Value'] || row.tradeInValue || row['Points Required'] || row.pointsRequired || '0'),
            description: row['Description'] || row.description || ''
          } as Omit<CasinoOffer, 'id' | 'createdAt' | 'updatedAt'>;
        });
        
        this.bulkCreateCasinoOffers(offersToImport);
      }

      // Import calendar events
      if (data.calendar.length > 0) {
        this.bulkCreateCalendarEvents(data.calendar);
      }

      // Import tripit events
      if (data.tripit.length > 0) {
        this.bulkCreateCalendarEvents(data.tripit);
      }

      // Normalize and fix booking IDs before first persist
      this.fixBookingIds();

      // CRITICAL: Immediately persist the loaded data to disk
      console.log('[MemoryStore] Persisting loaded data to disk...');
      await this.persistNow();
      
      // Verify persistence worked
      const verifyExists = isDiskWritable() && fsSafe ? await fsSafe
        .stat(this.persistFilePath)
        .then(() => true)
        .catch(() => false) : false;
      
      if (verifyExists) {
        console.log('[MemoryStore] ✅ Successfully loaded and persisted data from DATA folder to:', this.persistFilePath);
      } else {
        console.warn('[MemoryStore] ⚠️  Data loaded but persist.json was not created - data will be lost on reload!');
      }
    } catch (error) {
      console.error('[MemoryStore] Error loading initial data from DATA folder:', error);
    }
  }

  private serializeState() {
    return {
      cruises: this.cruises,
      bookedCruises: this.bookedCruises,
      casinoOffers: this.casinoOffers,
      calendarEvents: this.calendarEvents,
      offers: this.offers,
      prices: this.prices,
      thresholds: this.thresholds,
      alerts: this.alerts,
      priceAlerts: this.priceAlerts,
      receipts: this.receipts,
      cruiseStatements: this.cruiseStatements,
      casinoAnalytics: this.casinoAnalytics,
      financials: this.financials,
      certificates: this.certificates,
      estimatorParams: this.estimatorParams,
      casinoPerformance: this.casinoPerformance,
      userProfile: this.userProfile,
      lastImport: this.lastImport,
      webPricingSnapshot: this.webPricingSnapshot,
      version: 1,
      savedAt: new Date().toISOString()
    };
  }

  private schedulePersist(): void {
    if (this.isLoadingFromDisk) return;
    if (this.persistDebounce) {
      clearTimeout(this.persistDebounce);
    }
    this.persistDebounce = setTimeout(() => {
      this.persistNow().catch((e) => {
        console.error('[MemoryStore] Persist failed:', e);
      });
    }, 500);
  }

  public async persistNow(): Promise<void> {
    try {
      if (isDiskWritable() && fsSafe) {
        try {
          await fsSafe.mkdir(path.dirname(this.persistFilePath), { recursive: true });
        } catch (e) {
          console.warn('[MemoryStore] mkdir failed (continuing without disk persistence):', e instanceof Error ? e.message : String(e));
        }
      }
      const state = this.serializeState();
      const json = JSON.stringify(state, null, 2);
      if (isDiskWritable() && fsSafe) {
        try {
          await fsSafe.writeFile(this.persistFilePath, json, 'utf8');
          this.lastPersistAt = new Date().toISOString();
          console.log('[MemoryStore] ✅ State persisted to disk:', this.persistFilePath, {
            cruises: this.cruises.length,
            bookedCruises: this.bookedCruises.length,
            casinoOffers: this.casinoOffers.length,
            financials: this.financials.length,
            statements: this.cruiseStatements.length,
            receipts: this.receipts.length,
            fileSize: `${(json.length / 1024).toFixed(2)} KB`
          });
          return;
        } catch (e) {
          console.error('[MemoryStore] ❌ writeFile failed (keeping in-memory only):', e instanceof Error ? e.message : String(e));
        }
      } else {
        console.warn('[MemoryStore] ⚠️  Disk write skipped (no permission), keeping in-memory only');
      }
      this.lastPersistAt = new Date().toISOString();
    } catch (error) {
      console.error('[MemoryStore] ❌ Error during persistNow (non-fatal):', error);
      // Swallow to avoid crashing API routes in restricted runtimes
    }
  }

  // Unified cruise operations
  getCruises(filters?: any): Cruise[] {
    console.log('[MemoryStore] Getting cruises with filters:', filters);
    this.updateLifecycleStatuses();
    let result = [...this.cruises];
    
    if (filters?.booked === true) {
      result = result.filter(c => c.bookingId);
    } else if (filters?.booked === false) {
      result = result.filter(c => !c.bookingId);
    }
    
    if (filters?.line) {
      result = result.filter(c => c.line.toLowerCase().includes(filters.line.toLowerCase()));
    }
    if (filters?.ship) {
      result = result.filter(c => c.ship.toLowerCase().includes(filters.ship.toLowerCase()));
    }
    if (filters?.region) {
      result = result.filter(c => c.region?.toLowerCase().includes(filters.region.toLowerCase()));
    }
    if (filters?.dateRange) {
      const { from, to } = filters.dateRange;
      result = result.filter(c => c.departureDate >= from && c.departureDate <= to);
    }
    
    return result.sort((a, b) => new Date(a.departureDate).getTime() - new Date(b.departureDate).getTime());
  }
  
  // Get only available (non-booked) cruises
  getAvailableCruises(filters?: any): Cruise[] {
    console.log('[MemoryStore] Getting available cruises');
    return this.getCruises({ ...filters, booked: false });
  }

  getCruise(id: string): Cruise | undefined {
    let cruise = this.cruises.find(c => c.id === id);
    if (!cruise && (id.startsWith('booked-') || id.startsWith('completed-'))) {
      console.log('[MemoryStore] Looking for static booked cruise with ID:', id);
      console.log('[MemoryStore] Static cruise lookup - will be handled by tRPC pattern matching');
    }
    return cruise;
  }

  createCruise(data: Omit<Cruise, 'id' | 'createdAt' | 'updatedAt'>): Cruise {
    try {
      if (!data.ship) {
        throw new Error('Ship name is required');
      }
      if (!data.departureDate) {
        throw new Error('Departure date is required');
      }
      if (!data.stateroomTypes || !Array.isArray(data.stateroomTypes) || data.stateroomTypes.length === 0) {
        console.warn('[MemoryStore] Missing or invalid stateroomTypes, using default ["Interior"]');
        data.stateroomTypes = ['Interior'];
      }
      
      let returnDate = data.returnDate;
      if (!returnDate && data.departureDate && data.nights) {
        const calculatedReturnDate = this.calculateReturnDate(data.departureDate, data.nights);
        if (calculatedReturnDate) {
          returnDate = calculatedReturnDate;
          console.log(`[MemoryStore] Calculated missing returnDate for ${data.ship}: ${data.departureDate} + ${data.nights} nights = ${returnDate}`);
        }
      }
      
      const cruise: Cruise = {
        ...data,
        ship: data.ship ? data.ship.replace(/[®™]/g, '').trim() : data.ship,
        returnDate: returnDate || data.returnDate,
        id: uuid(),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      
      this.cruises.push(cruise);
      this.updateLifecycleStatuses();
      this.schedulePersist();
      console.log('[MemoryStore] Created cruise:', {
        id: cruise.id,
        ship: cruise.ship,
        departureDate: cruise.departureDate,
        returnDate: cruise.returnDate,
        nights: cruise.nights,
        stateroomTypes: cruise.stateroomTypes,
        totalCruisesNow: this.cruises.length
      });
      return cruise;
    } catch (error) {
      console.error('[MemoryStore] Error creating cruise:', error, 'Data:', data);
      throw error;
    }
  }

  updateCruise(id: string, data: Partial<Cruise>): Cruise | null {
    const index = this.cruises.findIndex(c => c.id === id);
    if (index === -1) return null;
    
    this.cruises[index] = {
      ...this.cruises[index],
      ...data,
      updatedAt: new Date().toISOString()
    };
    this.updateLifecycleStatuses();
    console.log('[MemoryStore] Updated cruise:', id);
    this.schedulePersist();
    return this.cruises[index];
  }

  deleteCruise(id: string): boolean {
    const index = this.cruises.findIndex(c => c.id === id);
    if (index === -1) return false;
    
    this.cruises.splice(index, 1);
    this.schedulePersist();
    console.log('[MemoryStore] Deleted cruise:', id);
    return true;
  }

  // Get cruises with receipts and/or statements (both future and past)
  getBookedCruises(): Cruise[] {
    console.log('[MemoryStore] Getting cruises with receipts/statements from unified system');
    this.updateLifecycleStatuses();
    
    let bookedCruises = this.cruises
      .filter(cruise => {
        const hasReceiptData = this.receipts.some(r => r.cruiseId === cruise.id) ||
                              cruise.reservationNumber ||
                              cruise.bookingId;
        const hasStatementData = this.cruiseStatements.some(s => s.cruiseId === cruise.id);
        const hasData = hasReceiptData || hasStatementData;
        console.log(`[MemoryStore] Cruise ${cruise.ship} (${cruise.departureDate}): hasReceiptData=${hasReceiptData}, hasStatementData=${hasStatementData}, hasData=${hasData}`);
        return hasData;
      })
      .map(cruise => {
        if (!cruise.returnDate && cruise.departureDate && cruise.nights) {
          const returnDate = this.calculateReturnDate(cruise.departureDate, cruise.nights);
          if (returnDate) {
            cruise.returnDate = returnDate;
            console.log(`[MemoryStore] Fixed missing returnDate for ${cruise.ship}: ${cruise.departureDate} + ${cruise.nights} nights = ${returnDate}`);
          }
        }
        return cruise;
      });
    this.schedulePersist();
    
    if (bookedCruises.length === 0) {
      console.log('[MemoryStore] No booked cruises found in imported data, using static fallback');
      try {
        console.log('[MemoryStore] Static data fallback not implemented in backend - frontend will handle');
      } catch (error) {
        console.error('[MemoryStore] Error loading static booked cruises:', error);
      }
    }
    
    return bookedCruises.sort((a, b) => new Date(a.departureDate).getTime() - new Date(b.departureDate).getTime());
  }
  
  getCompletedCruises(): Cruise[] {
    console.log('[MemoryStore] Getting completed cruises (past cruises with receipts/statements)');
    this.updateLifecycleStatuses();
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const cruisesWithData = this.getBookedCruises();
    
    return cruisesWithData
      .filter(cruise => {
        try {
          const departureDate = new Date(cruise.departureDate);
          departureDate.setHours(0, 0, 0, 0);
          const isPast = departureDate < today;
          console.log(`[MemoryStore] Cruise ${cruise.ship} (${cruise.departureDate}): isPast=${isPast}`);
          return isPast;
        } catch (error) {
          console.warn(`[MemoryStore] Invalid date for cruise ${cruise.ship}: ${cruise.departureDate}`);
          return false;
        }
      })
      .map(cruise => {
        if (!cruise.returnDate && cruise.departureDate && cruise.nights) {
          const returnDate = this.calculateReturnDate(cruise.departureDate, cruise.nights);
          if (returnDate) {
            cruise.returnDate = returnDate;
            console.log(`[MemoryStore] Fixed missing returnDate for completed cruise ${cruise.ship}: ${cruise.departureDate} + ${cruise.nights} nights = ${returnDate}`);
          }
        }
        return cruise;
      })
      .sort((a, b) => new Date(b.departureDate).getTime() - new Date(a.departureDate).getTime());
  }
  
  getLegacyBookedCruises(): BookedCruise[] {
    console.log('[MemoryStore] Legacy booked cruises method called - returning empty array (using unified system)');
    return [];
  }

  getBookedCruise(id: string): BookedCruise | undefined {
    let cruise = this.bookedCruises.find(c => c.id === id);
    if (!cruise && (id.startsWith('booked-') || id.startsWith('completed-'))) {
      console.log('[MemoryStore] Static booked cruise lookup for ID:', id, '- will be handled by tRPC pattern matching');
    }
    return cruise;
  }

  createBookedCruise(data: Omit<BookedCruise, 'id' | 'createdAt' | 'updatedAt'>): BookedCruise {
    const bookedCruise: BookedCruise = {
      ...data,
      ship: data.ship ? data.ship.replace(/[®™]/g, '').trim() : data.ship,
      id: uuid(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    this.bookedCruises.push(bookedCruise);
    this.updateLifecycleStatuses();
    console.log('[MemoryStore] Created booked cruise:', bookedCruise.id);
    this.schedulePersist();
    return bookedCruise;
  }

  updateBookedCruise(id: string, data: Partial<BookedCruise>): BookedCruise | null {
    const index = this.bookedCruises.findIndex(c => c.id === id);
    if (index === -1) return null;
    
    this.bookedCruises[index] = {
      ...this.bookedCruises[index],
      ...data,
      updatedAt: new Date().toISOString()
    };
    this.updateLifecycleStatuses();
    console.log('[MemoryStore] Updated booked cruise:', id);
    this.schedulePersist();
    return this.bookedCruises[index];
  }

  deleteBookedCruise(id: string): boolean {
    const index = this.bookedCruises.findIndex(c => c.id === id);
    if (index === -1) return false;
    
    this.bookedCruises.splice(index, 1);
    this.schedulePersist();
    console.log('[MemoryStore] Deleted booked cruise:', id);
    return true;
  }

  private updateLifecycleStatuses(): void {
    try {
      const now = new Date();
      now.setHours(0, 0, 0, 0);

      this.cruises.forEach(cruise => {
        try {
          const start = cruise.departureDate ? new Date(cruise.departureDate) : null;
          const end = cruise.returnDate ? new Date(cruise.returnDate) : null;
          if (start) start.setHours(0,0,0,0);
          if (end) end.setHours(0,0,0,0);

          let status: 'upcoming' | 'in-progress' | 'completed' | undefined = cruise.lifecycleStatus;
          if (start && end) {
            if (now > end) status = 'completed';
            else if (now >= start && now <= end) status = 'in-progress';
            else if (now < start) status = 'upcoming';
          } else if (start) {
            if (now > start) status = 'completed';
            else status = 'upcoming';
          }
          if (status && status !== cruise.lifecycleStatus) {
            cruise.lifecycleStatus = status;
            cruise.updatedAt = new Date().toISOString();
          }
        } catch {}
      });

      this.bookedCruises.forEach(bc => {
        try {
          const start = bc.departureDate ? new Date(bc.departureDate) : null;
          const end = bc.returnDate ? new Date(bc.returnDate) : null;
          if (start) start.setHours(0,0,0,0);
          if (end) end.setHours(0,0,0,0);

          let status: 'upcoming' | 'in-progress' | 'completed' | undefined = bc.lifecycleStatus;
          if (start && end) {
            if (now > end) status = 'completed';
            else if (now >= start && now <= end) status = 'in-progress';
            else if (now < start) status = 'upcoming';
          } else if (start) {
            if (now > start) status = 'completed';
            else status = 'upcoming';
          }
          if (status && status !== bc.lifecycleStatus) {
            bc.lifecycleStatus = status;
            bc.updatedAt = new Date().toISOString();
          }
        } catch {}
      });
    } catch (e) {
      console.warn('[MemoryStore] Failed to update lifecycle statuses:', e);
    }
  }

  // Casino offer operations
  getCasinoOffers(): CasinoOffer[] {
    console.log('[MemoryStore] Getting casino offers');
    return [...this.casinoOffers].sort((a, b) => new Date(a.expires).getTime() - new Date(b.expires).getTime());
  }

  getCasinoOffer(id: string): CasinoOffer | undefined {
    return this.casinoOffers.find(o => o.id === id);
  }

  createCasinoOffer(data: Omit<CasinoOffer, 'id' | 'createdAt' | 'updatedAt'>): CasinoOffer {
    const offer: CasinoOffer = {
      ...data,
      id: uuid(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    
    this.casinoOffers.push(offer);
    this.schedulePersist();
    console.log('[MemoryStore] Created NEW casino offer:', {
      id: offer.id,
      offerName: offer.offerName,
      offerCode: offer.offerCode,
      expires: offer.expires,
      totalOffersNow: this.casinoOffers.length
    });
    return offer;
  }

  // Calendar event operations
  getCalendarEvents(filters?: any): CalendarEvent[] {
    console.log('[MemoryStore] Getting calendar events with filters:', filters);
    console.log('[MemoryStore] Current calendarEvents array length:', this.calendarEvents.length);
    console.log('[MemoryStore] Memory store instance check:', this === global.__memoryStore ? 'SAME' : 'DIFFERENT');
    console.log('[MemoryStore] Global debug info:', global.__memoryStoreDebug);
    
    const eventsBySource = this.calendarEvents.reduce((acc, e) => {
      acc[e.source] = (acc[e.source] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
    console.log('[MemoryStore] Events by source before filtering:', eventsBySource);
    
    if (global.__memoryStore && this !== global.__memoryStore) {
      console.log('[MemoryStore] WARNING: Different instance detected!');
      console.log('[MemoryStore] Global instance has', global.__memoryStore.calendarEvents.length, 'events');
      const globalEvents = [...global.__memoryStore.calendarEvents];
      console.log('[MemoryStore] Using global instance events:', globalEvents.length);
      return globalEvents;
    }
    
    let result = [...this.calendarEvents];
    
    if (filters?.source) {
      console.log('[MemoryStore] Filtering by source:', filters.source);
      result = result.filter(e => e.source === filters.source);
      console.log('[MemoryStore] After source filter:', result.length, 'events');
    }
    if (filters?.dateRange) {
      const { from, to } = filters.dateRange;
      console.log('[MemoryStore] Filtering by date range:', from, 'to', to);
      result = result.filter(e => e.startDate >= from && e.endDate <= to);
      console.log('[MemoryStore] After date filter:', result.length, 'events');
    }
    
    const sorted = result.sort((a, b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime());
    console.log('[MemoryStore] Returning', sorted.length, 'sorted calendar events');
    return sorted;
  }

  createCalendarEvent(data: Omit<CalendarEvent, 'id' | 'createdAt' | 'updatedAt'>): CalendarEvent {
    const event: CalendarEvent = {
      ...data,
      id: uuid(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    this.calendarEvents.push(event);
    this.schedulePersist();
    
    if (global.__memoryStoreDebug) {
      global.__memoryStoreDebug.eventCount = this.calendarEvents.length;
      global.__memoryStoreDebug.lastAccess = new Date().toISOString();
    }
    
    console.log('[MemoryStore] Created calendar event:', {
      id: event.id,
      source: event.source,
      summary: event.summary,
      startDate: event.startDate,
      totalEventsNow: this.calendarEvents.length,
      instanceCheck: this === global.__memoryStore ? 'SAME' : 'DIFFERENT'
    });
    return event;
  }

  // User profile operations
  getUserProfile(): UserProfile | null {
    return this.userProfile;
  }

  updateUserProfile(data: Partial<UserProfile>): UserProfile | null {
    if (!this.userProfile) return null;
    
    this.userProfile = {
      ...this.userProfile,
      ...data,
      updatedAt: new Date().toISOString()
    };
    console.log('[MemoryStore] Updated user profile');
    this.schedulePersist();
    return this.userProfile;
  }

  // Analytics operations - updated for unified system
  getSavingsSummary(): SavingsSummary {
    const bookedCruises = this.getBookedCruises();
    
    const totalActualSavings = bookedCruises.reduce((sum, cruise) => sum + (cruise.actualSavings || 0), 0);
    const totalProjectedSavings = bookedCruises.reduce((sum, cruise) => sum + (cruise.projectedSavings || 0), 0);
    const totalCruiseValue = bookedCruises.reduce((sum, cruise) => sum + (cruise.currentMarketPrice || cruise.actualFare || 0), 0);
    const totalPaid = bookedCruises.reduce((sum, cruise) => sum + (cruise.paidFare || 0), 0);
    
    return {
      totalActualSavings,
      totalProjectedSavings,
      averageSavingsPerCruise: bookedCruises.length > 0 ? totalActualSavings / bookedCruises.length : 0,
      totalCruiseValue,
      totalPaid
    };
  }
  
  // Get unified system statistics
  getUnifiedSystemStats() {
    const totalCruises = this.cruises.length;
    const bookedCruises = this.cruises.filter(c => c.bookingId).length;
    const availableCruises = totalCruises - bookedCruises;
    
    return {
      totalCruises,
      bookedCruises,
      availableCruises,
      casinoOffers: this.casinoOffers.length,
      calendarEvents: this.calendarEvents.length
    };
  }

  // Bulk operations for import
  bulkCreateCruises(cruises: Omit<Cruise, 'id' | 'createdAt' | 'updatedAt'>[]): Cruise[] {
    console.log(`[MemoryStore] Starting bulk create of ${cruises.length} cruises`);
    const created: Cruise[] = [];
    const errors: string[] = [];
    
    cruises.forEach((data, index) => {
      try {
        if (!data.ship) {
          console.warn(`[MemoryStore] Cruise ${index + 1}: Missing ship name, using default`);
          data.ship = 'Unknown Ship';
        }
        if (!data.departureDate) {
          console.warn(`[MemoryStore] Cruise ${index + 1}: Missing departure date, skipping`);
          errors.push(`Cruise ${index + 1}: Missing departure date`);
          return;
        }
        if (!data.stateroomTypes || !Array.isArray(data.stateroomTypes) || data.stateroomTypes.length === 0) {
          console.warn(`[MemoryStore] Cruise ${index + 1}: Missing stateroomTypes, using default ["Interior"]`);
          data.stateroomTypes = ['Interior'];
        }
        
        const cruise = this.createCruise(data);
        created.push(cruise);
        
        if ((index + 1) % 100 === 0) {
          console.log(`[MemoryStore] Bulk create progress: ${index + 1}/${cruises.length} cruises processed`);
        }
        
      } catch (error) {
        const errorMsg = `Cruise ${index + 1} (${data.ship || 'Unknown'}): ${error instanceof Error ? error.message : 'Unknown error'}`;
        console.error(`[MemoryStore] ${errorMsg}`);
        errors.push(errorMsg);
      }
    });
    
    console.log(`[MemoryStore] Bulk create completed: ${created.length} successful, ${errors.length} failed`);
    if (errors.length > 0) {
      console.error('[MemoryStore] Bulk create errors:', errors.slice(0, 10));
    }
    
    const finalCount = this.cruises.length;
    console.log(`[MemoryStore] Final cruise count in store: ${finalCount}`);
    
    return created;
  }

  bulkCreateBookedCruises(bookedCruises: Omit<BookedCruise, 'id' | 'createdAt' | 'updatedAt'>[]): BookedCruise[] {
    const created = bookedCruises.map(data => this.createBookedCruise(data));
    console.log('[MemoryStore] Bulk created booked cruises:', created.length);
    this.schedulePersist();
    return created;
  }

  bulkCreateCasinoOffers(offers: Omit<CasinoOffer, 'id' | 'createdAt' | 'updatedAt'>[]): CasinoOffer[] {
    const created = offers.map(data => this.createCasinoOffer(data));
    console.log('[MemoryStore] Bulk created casino offers:', created.length);
    this.schedulePersist();
    return created;
  }

  bulkCreateCalendarEvents(events: Omit<CalendarEvent, 'id' | 'createdAt' | 'updatedAt'>[]): CalendarEvent[] {
    const created = events.map(data => this.createCalendarEvent(data));
    console.log('[MemoryStore] Bulk created calendar events:', created.length);
    this.schedulePersist();
    return created;
  }

  // Receipt operations
  getReceipts(): ReceiptData[] {
    console.log('[MemoryStore] Getting receipts');
    return [...this.receipts].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  getReceiptsByCruiseId(cruiseId: string): ReceiptData[] {
    return this.receipts.filter(r => r.cruiseId === cruiseId);
  }

  createReceipt(data: Omit<ReceiptData, 'id' | 'createdAt' | 'updatedAt'>): ReceiptData {
    const receipt: ReceiptData = {
      ...data,
      id: uuid(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    this.receipts.push(receipt);

    try {
      const nowIso = new Date().toISOString();
      if (Array.isArray(receipt.lineItems) && receipt.lineItems.length > 0) {
        receipt.lineItems.forEach((li) => {
          const rec: FinancialsRecord = {
            id: uuid(),
            cruiseId: receipt.cruiseId,
            shipName: receipt.ship ?? undefined,
            sailDateStart: this.standardizeDate(receipt.departureDate || '' ) || undefined,
            sailDateEnd: this.standardizeDate(receipt.returnDate || '' ) || undefined,
            itineraryName: receipt.itinerary ?? undefined,
            guestName: undefined,
            cabinNumber: receipt.cabinNumber,
            bookingId: undefined,
            reservationNumber: receipt.reservationNumber,
            sourceType: 'receipt',
            sourceFileBaseName: 'ocr-receipt',
            sourcePageNumber: 1,
            sourceTotalPages: 1,
            processedAt: nowIso,
            ocrVersion: 'v1',
            verified: false,
            currency: 'USD',
            receiptId: receipt.id,
            receiptDateTime: receipt.bookingDate,
            venue: undefined,
            category: normalizeCategory(li.description) ?? undefined,
            itemDescription: li.description,
            quantity: 1,
            unitPrice: li.amount,
            lineTotal: li.amount,
            tax: undefined,
            gratuity: undefined,
            discount: undefined,
            paymentMethod: normalizePaymentMethod(receipt.paymentMethod) ?? undefined,
            employeeIdOrServerName: undefined,
            folioNumber: undefined,
            statementId: undefined,
            postDate: undefined,
            txnType: undefined,
            description: li.description,
            department: undefined,
            amount: li.amount,
            balanceAfter: undefined,
            onboardCreditApplied: extractOnboardCredit(li.description, li.amount),
            statementPaymentMethod: undefined,
            refNumber: undefined,
            createdAt: nowIso,
            updatedAt: nowIso
          };
          this.financials.push(rec);
        });
      } else {
        const rec: FinancialsRecord = {
          id: uuid(),
          cruiseId: receipt.cruiseId,
          shipName: receipt.ship ?? undefined,
          sailDateStart: this.standardizeDate(receipt.departureDate || '' ) || undefined,
          sailDateEnd: this.standardizeDate(receipt.returnDate || '' ) || undefined,
          itineraryName: receipt.itinerary ?? undefined,
          guestName: undefined,
          cabinNumber: receipt.cabinNumber,
          bookingId: undefined,
          reservationNumber: receipt.reservationNumber,
          sourceType: 'receipt',
          sourceFileBaseName: 'ocr-receipt',
          sourcePageNumber: 1,
          sourceTotalPages: 1,
          processedAt: nowIso,
          ocrVersion: 'v1',
          verified: false,
          currency: 'USD',
          receiptId: receipt.id,
          receiptDateTime: receipt.bookingDate,
          venue: undefined,
          category: undefined,
          itemDescription: undefined,
          quantity: undefined,
          unitPrice: undefined,
          lineTotal: receipt.totalPaid ?? undefined,
          tax: receipt.taxesAndFees ?? undefined,
          gratuity: receipt.gratuities ?? undefined,
          discount: receipt.casinoDiscount ?? undefined,
          paymentMethod: normalizePaymentMethod(receipt.paymentMethod) ?? undefined,
          employeeIdOrServerName: undefined,
          folioNumber: undefined,
          statementId: undefined,
          postDate: undefined,
          txnType: undefined,
          description: undefined,
          department: undefined,
          amount: receipt.totalPaid ?? undefined,
          balanceAfter: undefined,
          onboardCreditApplied: undefined,
          statementPaymentMethod: undefined,
          refNumber: undefined,
          createdAt: nowIso,
          updatedAt: nowIso
        };
        this.financials.push(rec);
      }
    } catch (e) {
      console.warn('[MemoryStore] Failed to mirror receipt into financials:', e);
    }

    this.schedulePersist();
    console.log('[MemoryStore] Created receipt:', receipt.id);
    return receipt;
  }

  // Cruise statement operations
  getCruiseStatements(): any[] {
    console.log('[MemoryStore] Getting cruise statements');
    return [...this.cruiseStatements].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  getCruiseStatementsByCruiseId(cruiseId: string): any[] {
    return this.cruiseStatements.filter(s => s.cruiseId === cruiseId);
  }

  createCruiseStatement(data: any): any {
    const statement = {
      ...data,
      id: uuid(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    this.cruiseStatements.push(statement);

    try {
      const nowIso = new Date().toISOString();
      if (Array.isArray(statement.lineItems) && statement.lineItems.length > 0) {
        statement.lineItems.forEach((li: any) => {
          const refFolio = extractRefOrFolio(li.description);
          const rec: FinancialsRecord = {
            id: uuid(),
            cruiseId: statement.cruiseId,
            shipName: statement.ship || undefined,
            sailDateStart: this.standardizeDate(statement.departureDate || '' ) || undefined,
            sailDateEnd: this.standardizeDate(statement.returnDate || '' ) || undefined,
            itineraryName: statement.itinerary || undefined,
            guestName: undefined,
            cabinNumber: statement.cabinNumber,
            bookingId: undefined,
            reservationNumber: statement.reservationNumber,
            sourceType: 'statement',
            sourceFileBaseName: statement.sourceFileBaseName || 'ocr-statement',
            sourcePageNumber: statement.sourcePageNumber || undefined,
            sourceTotalPages: statement.sourceTotalPages || undefined,
            processedAt: nowIso,
            ocrVersion: 'v1',
            verified: false,
            currency: 'USD',
            receiptId: undefined,
            receiptDateTime: undefined,
            venue: undefined,
            category: normalizeCategory(li.description) ?? undefined,
            itemDescription: li.description,
            quantity: undefined,
            unitPrice: undefined,
            lineTotal: li.amount,
            tax: undefined,
            gratuity: undefined,
            discount: undefined,
            paymentMethod: undefined,
            employeeIdOrServerName: undefined,
            folioNumber: refFolio.folioNumber || statement.folio,
            statementId: statement.id,
            postDate: this.standardizeDate(li.date) || undefined,
            txnType: (li.amount ?? 0) >= 0 ? 'Charge' : 'Credit',
            description: li.description,
            department: normalizeDepartment(li.category || li.description) ?? undefined,
            amount: li.amount,
            balanceAfter: undefined,
            onboardCreditApplied: extractOnboardCredit(li.description, li.amount),
            statementPaymentMethod: undefined,
            refNumber: refFolio.refNumber,
            createdAt: nowIso,
            updatedAt: nowIso
          };
          this.financials.push(rec);
        });
      }
    } catch (e) {
      console.warn('[MemoryStore] Failed to mirror statement into financials:', e);
    }

    this.schedulePersist();
    console.log('[MemoryStore] Created cruise statement:', statement.id);
    return statement;
  }

  setWebPricingSnapshot(snapshot: { results: any[]; summary: any }): void {
    this.webPricingSnapshot = snapshot;
    this.schedulePersist();
    console.log('[MemoryStore] Stored web pricing snapshot', {
      results: snapshot.results?.length || 0,
      lastUpdated: snapshot.summary?.lastUpdated
    });
  }

  getWebPricingSnapshot(): { results: any[]; summary: any } | null {
    return this.webPricingSnapshot;
  }

  // Price alerts operations
  addPriceAlerts(alerts: any[]): void {
    alerts.forEach(alert => {
      const priceAlert = {
        ...alert,
        id: uuid(),
        resolved: false,
        cruiseId: alert.cruiseId || alert.offerId,
        createdAt: alert.createdAt || new Date().toISOString()
      };
      this.priceAlerts.push(priceAlert);
    });
    console.log('[MemoryStore] Added', alerts.length, 'price alerts');
    this.schedulePersist();
  }

  getPriceAlerts(): any[] {
    return [...this.priceAlerts].sort((a, b) => 
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  }

  markPriceAlertResolved(alertId: string): boolean {
    const alert = this.priceAlerts.find(a => a.id === alertId);
    if (alert) {
      alert.resolved = true;
      alert.updatedAt = new Date().toISOString();
      this.schedulePersist();
      return true;
    }
    return false;
  }

  clearPriceAlerts(): void {
    const count = this.priceAlerts.length;
    this.priceAlerts = [];
    this.schedulePersist();
    console.log('[MemoryStore] Cleared', count, 'price alerts');
  }

  // Financials operations
  getFinancials(): FinancialsRecord[] {
    return [...this.financials].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  getFinancialsByCruiseId(cruiseId: string): FinancialsRecord[] {
    return this.financials.filter(f => f.cruiseId === cruiseId);
  }

  addFinancials(records: Omit<FinancialsRecord, 'id' | 'createdAt' | 'updatedAt'>[]): FinancialsRecord[] {
    const now = new Date().toISOString();
    const created = records.map(r => ({ ...r, id: uuid(), createdAt: now, updatedAt: now }));
    this.financials.push(...created);
    this.schedulePersist();
    console.log('[MemoryStore] Added financials records:', created.length);
    return created;
  }

  // Clear all data
  async clearAllData(): Promise<void> {
    console.log('[MemoryStore] Starting clearAllData...');
    
    this.cruises = [];
    this.bookedCruises = [];
    this.casinoOffers = [];
    this.calendarEvents = [];
    this.offers = [];
    this.prices = [];
    this.thresholds = [];
    this.alerts = [];
    this.priceAlerts = [];
    this.receipts = [];
    this.cruiseStatements = [];
    this.priceTrends = [];
    this.casinoAnalytics = [];
    this.financials = [];
    this.certificates = [];
    this.estimatorParams = null;
    this.casinoPerformance = [];
    this.webPricingSnapshot = null;
    this.lastImport = null;
    // Don't clear user profile as it should persist
    
    // CRITICAL: Clear the persist.json file to prevent auto-reload
    try {
      if (isDiskWritable() && fsSafe) {
        const emptyState = this.serializeState();
        const json = JSON.stringify(emptyState, null, 2);
        await fsSafe.writeFile(this.persistFilePath, json, 'utf8');
        console.log('[MemoryStore] ✅ Cleared persist.json file');
      }
    } catch (error) {
      console.error('[MemoryStore] ❌ Failed to clear persist.json:', error);
    }
    
    console.log('[MemoryStore] ✅ Cleared all data from memory');
  }

  clearCasinoOffers(): void {
    const count = this.casinoOffers.length;
    this.casinoOffers = [];
    console.log(`[MemoryStore] Cleared ${count} casino offers`);
  }

  cleanShipNames(): number {
    let cleaned = 0;
    this.cruises.forEach(cruise => {
      if (cruise.ship) {
        const originalShip = cruise.ship;
        cruise.ship = cruise.ship
          .replace(/[®™]/g, '')
          .replace(/\[R\]/g, '')
          .replace(/[^a-zA-Z0-9\s-]/g, ' ')
          .replace(/\s+/g, ' ')
          .trim();
        if (originalShip !== cruise.ship) {
          cleaned++;
        }
      }
    });
    
    this.bookedCruises.forEach(cruise => {
      if (cruise.ship) {
        const originalShip = cruise.ship;
        cruise.ship = cruise.ship
          .replace(/[®™]/g, '')
          .replace(/\[R\]/g, '')
          .replace(/[^a-zA-Z0-9\s-]/g, ' ')
          .replace(/\s+/g, ' ')
          .trim();
        if (originalShip !== cruise.ship) {
          cleaned++;
        }
      }
    });
    
    this.calendarEvents.forEach(event => {
      if (event.summary) {
        const originalSummary = event.summary;
        event.summary = event.summary
          .replace(/[®™]/g, '')
          .replace(/\[R\]/g, '')
          .replace(/[^a-zA-Z0-9\s-:.,]/g, ' ')
          .replace(/\s+/g, ' ')
          .trim();
        if (originalSummary !== event.summary) {
          cleaned++;
        }
      }
    });
    
    console.log(`[MemoryStore] Cleaned ${cleaned} ship names and event titles`);
    return cleaned;
  }

  getLinkedCruiseCounts(): { [offerKey: string]: number } {
    const counts: { [offerKey: string]: number } = {};
    
    this.cruises.forEach(cruise => {
      if (cruise.offerCode && cruise.offerExpirationDate) {
        const offerKey = `${cruise.offerCode}_${cruise.offerExpirationDate}`;
        counts[offerKey] = (counts[offerKey] || 0) + 1;
      } else if (cruise.offerCode) {
        counts[cruise.offerCode] = (counts[cruise.offerCode] || 0) + 1;
      }
    });
    
    return counts;
  }

  // P4-11: Certificates CRUD
  getCertificates(): import('@/types/models').CertificateItem[] {
    return [...this.certificates].sort((a, b) => new Date(a.expiresOn).getTime() - new Date(b.expiresOn).getTime());
  }

  createCertificate(data: Omit<import('@/types/models').CertificateItem, 'id' | 'createdAt' | 'updatedAt'>): import('@/types/models').CertificateItem {
    const cert: import('@/types/models').CertificateItem = {
      ...data,
      id: uuid(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    this.certificates.push(cert);
    this.schedulePersist();
    console.log('[MemoryStore] Created certificate', cert.id);
    return cert;
  }

  updateCertificate(id: string, data: Partial<import('@/types/models').CertificateItem>): import('@/types/models').CertificateItem | null {
    const idx = this.certificates.findIndex(c => c.id === id);
    if (idx === -1) return null;
    this.certificates[idx] = { ...this.certificates[idx], ...data, updatedAt: new Date().toISOString() };
    this.schedulePersist();
    return this.certificates[idx];
  }

  deleteCertificate(id: string): boolean {
    const idx = this.certificates.findIndex(c => c.id === id);
    if (idx === -1) return false;
    this.certificates.splice(idx, 1);
    this.schedulePersist();
    return true;
  }

  // P4-11: Estimator params save/load
  getEstimatorParams(): import('@/types/models').EstimatorParams | null {
    return this.estimatorParams;
  }

  setEstimatorParams(params: Omit<import('@/types/models').EstimatorParams, 'id' | 'updatedAt'> & { id?: string }): import('@/types/models').EstimatorParams {
    const id = params.id || 'default-estimator-params';
    this.estimatorParams = { ...params, id, updatedAt: new Date().toISOString() } as import('@/types/models').EstimatorParams;
    this.schedulePersist();
    return this.estimatorParams;
  }

  // P4-11: Casino performance per cruise
  listCasinoPerformance(): import('@/types/models').CasinoPerformance[] {
    return [...this.casinoPerformance].sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
  }

  getCasinoPerformanceByCruise(cruiseId: string): import('@/types/models').CasinoPerformance | null {
    return this.casinoPerformance.find(p => p.cruiseId === cruiseId) || null;
  }

  upsertCasinoPerformance(data: Omit<import('@/types/models').CasinoPerformance, 'id' | 'createdAt' | 'updatedAt'> & { id?: string }): import('@/types/models').CasinoPerformance {
    const existingIdx = data.id ? this.casinoPerformance.findIndex(p => p.id === data.id) : this.casinoPerformance.findIndex(p => p.cruiseId === data.cruiseId);
    if (existingIdx !== -1) {
      const updated = { ...this.casinoPerformance[existingIdx], ...data, updatedAt: new Date().toISOString() };
      this.casinoPerformance[existingIdx] = updated;
      this.schedulePersist();
      return updated;
    }
    const perf: import('@/types/models').CasinoPerformance = {
      id: uuid(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      ...data
    } as import('@/types/models').CasinoPerformance;
    this.casinoPerformance.push(perf);
    this.schedulePersist();
    return perf;
  }
  
  getOfferAnalysis(): Array<{
    offer: CasinoOffer;
    linkedCruises: number;
    associatedCruises: number;
    upcomingCruises: number;
    status: 'active' | 'expired' | 'expiring-soon';
  }> {
    const today = new Date();
    const oneWeekFromNow = new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000);
    
    console.log('[MemoryStore] getOfferAnalysis - Total offers:', this.casinoOffers.length, 'Total cruises:', this.cruises.length);
    
    return this.casinoOffers.map(offer => {
      const normalizeCode = (code: string | undefined): string => {
        if (!code) return '';
        return code.trim().toLowerCase();
      };
      
      const offerCodeNorm = normalizeCode(offer.offerCode);
      const offerNameNorm = normalizeCode(offer.offerName);
      
      const associatedCruises = this.cruises.filter(cruise => {
        const cruiseCodeNorm = normalizeCode(cruise.offerCode);
        const cruiseNameNorm = normalizeCode(cruise.offerName);
        
        if (!cruiseCodeNorm && !cruiseNameNorm) return false;
        
        if (offerCodeNorm && cruiseCodeNorm === offerCodeNorm) return true;
        if (offerNameNorm && cruiseNameNorm === offerNameNorm) return true;
        
        return false;
      }).length;
      
      const linkedCruises = associatedCruises;
      
      const ninetyDaysFromNow = new Date(today.getTime() + 90 * 24 * 60 * 60 * 1000);
      const upcomingCruises = this.cruises.filter(cruise => {
        const cruiseCodeNorm = normalizeCode(cruise.offerCode);
        const cruiseNameNorm = normalizeCode(cruise.offerName);
        
        const matches = (offerCodeNorm && cruiseCodeNorm === offerCodeNorm) || 
                       (offerNameNorm && cruiseNameNorm === offerNameNorm);
        
        if (!matches) return false;
        
        const departureDate = new Date(cruise.departureDate);
        return departureDate >= today && departureDate <= ninetyDaysFromNow;
      }).length;
      
      const expiryDate = new Date(offer.expires);
      let status: 'active' | 'expired' | 'expiring-soon';
      if (expiryDate < today) {
        status = 'expired';
      } else if (expiryDate <= oneWeekFromNow) {
        status = 'expiring-soon';
      } else {
        status = 'active';
      }
      
      console.log(`[MemoryStore] Offer "${offer.offerName}" (${offer.offerCode}): ${associatedCruises} cruises`);
      
      return {
        offer,
        linkedCruises,
        associatedCruises,
        upcomingCruises,
        status
      };
    }).sort((a, b) => {
      const dateCompare = new Date(b.offer.expires).getTime() - new Date(a.offer.expires).getTime();
      if (dateCompare !== 0) return dateCompare;
      return b.linkedCruises - a.linkedCruises;
    });
  }

  getCasinoPayTable(): CasinoPayTableEntry[] {
    return CASINO_PAY_TABLE;
  }

  calculateCasinoAnalytics(cruiseId: string, cabinPrice: number, taxes: number, offerType: string, perks: string[], points: number): CasinoAnalytics {
    console.log('[MemoryStore] Calculating casino analytics for cruise:', cruiseId);
    
    const payTableEntry = CASINO_PAY_TABLE.find(entry => points >= entry.points) || CASINO_PAY_TABLE[CASINO_PAY_TABLE.length - 1];
    
    const retailValue = cabinPrice + taxes;
    
    const offerValue = this.calculateOfferValue(points, 'Interior');
    
    const savings = Math.max(0, retailValue - offerValue);
    
    const outOfPocket = Math.max(0, retailValue - savings);
    
    const perksValue = this.calculatePerksValue(perks);
    const totalValue = savings + perksValue;
    
    const coinIn = points * 5;
    
    const costPerPoint = coinIn > 0 ? outOfPocket / points : 0;
    
    const valuePerPoint = points > 0 ? totalValue / points : 0;
    
    const roi = coinIn > 0 ? ((totalValue - coinIn) / coinIn) * 100 : 0;
    
    const analytics: CasinoAnalytics = {
      id: uuid(),
      cruiseId,
      cabinPrice,
      taxes,
      offerType,
      perks,
      points,
      retailValue,
      savings,
      outOfPocket,
      totalValue,
      coinIn,
      costPerPoint,
      valuePerPoint,
      roi,
      rewardTier: payTableEntry.reward,
      nextCruiseBonus: payTableEntry.nextCruiseBonus,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    
    this.casinoAnalytics.push(analytics);
    
    console.log('[MemoryStore] Casino analytics calculated:', {
      cruiseId,
      savings,
      roi: `${roi.toFixed(1)}%`,
      valuePerPoint: `${valuePerPoint.toFixed(2)}`
    });
    this.schedulePersist();
    
    return analytics;
  }

  private calculatePerksValue(perks: string[]): number {
    let totalValue = 0;
    
    perks.forEach(perk => {
      const perkLower = perk.toLowerCase();
      
      if (perkLower.includes('specialty dining') || perkLower.includes("chef's table")) {
        totalValue += 150;
      } else if (perkLower.includes('dining package')) {
        totalValue += 300;
      }
      
      if (perkLower.includes('beverage package') || perkLower.includes('drink package')) {
        totalValue += 200;
      } else if (perkLower.includes('wine tasting')) {
        totalValue += 75;
      }
      
      if (perkLower.includes('spa credit') || perkLower.includes('spa treatment')) {
        totalValue += 100;
      }
      
      if (perkLower.includes('shore excursion') || perkLower.includes('excursion credit')) {
        totalValue += 200;
      }
      
      if (perkLower.includes('internet') || perkLower.includes('wifi')) {
        totalValue += 100;
      }
      
      if (perkLower.includes('gratuities') || perkLower.includes('tips')) {
        totalValue += 150;
      }
      
      const freePlayMatch = perk.match(/\$(\d+)\s*free\s*play/i);
      if (freePlayMatch) {
        totalValue += parseInt(freePlayMatch[1]);
      }
    });
    
    return totalValue;
  }

  getCasinoAnalytics(cruiseId: string): CasinoAnalytics[] {
    return this.casinoAnalytics.filter(analytics => analytics.cruiseId === cruiseId);
  }

  getAllCasinoAnalytics(): CasinoAnalytics[] {
    return [...this.casinoAnalytics].sort((a, b) => b.roi - a.roi);
  }

  generateCasinoOfferAnalysis(cruiseId: string): CasinoOfferAnalysis[] {
    const cruise = this.getCruise(cruiseId);
    if (!cruise) return [];
    
    const casinoOffers = this.getCasinoOffers();
    const userProfile = this.getUserProfile();
    
    if (!userProfile) return [];
    
    const analyses: CasinoOfferAnalysis[] = [];
    
    const baseCabinPrice = this.calculateCruisePricing(cruise.ship, cruise.nights, 'Interior');
    const taxes = Math.round(baseCabinPrice * 0.15);
    
    casinoOffers.forEach(offer => {
      const expiryDate = new Date(offer.expires);
      if (expiryDate < new Date()) return;
      
      const analytics = this.calculateCasinoAnalytics(
        cruiseId,
        baseCabinPrice,
        taxes,
        offer.offerType,
        [offer.offerName],
        userProfile.points
      );
      
      const recommendations = this.generateRecommendations(analytics, cruise, offer);
      
      const marketPrice = baseCabinPrice + taxes;
      const offerValue = this.calculateOfferValue(userProfile.points, 'Interior');
      const totalSavings = marketPrice - offerValue;
      const effectiveDiscount = marketPrice > 0 ? (totalSavings / marketPrice) * 100 : 0;
      
      const analysis: CasinoOfferAnalysis = {
        offerId: offer.id,
        cruiseId,
        analytics,
        recommendations,
        comparisonData: {
          marketPrice,
          offerValue,
          totalSavings,
          effectiveDiscount
        }
      };
      
      analyses.push(analysis);
    });
    
    const sorted = analyses.sort((a, b) => b.analytics.roi - a.analytics.roi);
    this.schedulePersist();
    return sorted;
  }

  private generateRecommendations(analytics: CasinoAnalytics, cruise: Cruise, offer: CasinoOffer): string[] {
    const recommendations: string[] = [];
    
    if (analytics.roi > 50) {
      recommendations.push('🎯 Excellent ROI - Highly recommended!');
    } else if (analytics.roi > 25) {
      recommendations.push('✅ Good ROI - Worth considering');
    } else if (analytics.roi > 0) {
      recommendations.push('⚠️ Modest ROI - Consider other options');
    } else {
      recommendations.push('❌ Negative ROI - Not recommended');
    }
    
    if (analytics.valuePerPoint > 2) {
      recommendations.push('💎 Excellent value per point (>$2)');
    } else if (analytics.valuePerPoint > 1) {
      recommendations.push('👍 Good value per point (>$1)');
    } else {
      recommendations.push('📉 Low value per point (<$1)');
    }
    
    if (analytics.savings > 1000) {
      recommendations.push('💰 Significant savings (>$1,000)');
    } else if (analytics.savings > 500) {
      recommendations.push('💵 Good savings (>$500)');
    }
    
    const expiryDate = new Date(offer.expires);
    const daysUntilExpiry = Math.ceil((expiryDate.getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24));
    
    if (daysUntilExpiry <= 7) {
      recommendations.push('⏰ Offer expires soon - Act quickly!');
    } else if (daysUntilExpiry <= 30) {
      recommendations.push('📅 Offer expires within 30 days');
    }
    
    const cruiseDate = new Date(cruise.departureDate);
    const daysToCruise = Math.ceil((cruiseDate.getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24));
    
    if (daysToCruise <= 60) {
      recommendations.push('🚢 Cruise departing soon - Book now for best availability');
    }
    
    return recommendations;
  }

  generateCruiseCasinoSummary(cruiseId: string): CruiseCasinoSummary | null {
    const cruise = this.getCruise(cruiseId);
    if (!cruise) return null;
    
    const availableOffers = this.generateCasinoOfferAnalysis(cruiseId);
    const bestOffer = availableOffers.length > 0 ? availableOffers[0] : null;
    const totalPotentialSavings = availableOffers.reduce((sum, offer) => sum + offer.analytics.savings, 0);
    
    let recommendedAction = 'No casino offers available';
    if (bestOffer) {
      if (bestOffer.analytics.roi > 25) {
        recommendedAction = `Book with ${bestOffer.analytics.rewardTier} offer - ${bestOffer.analytics.roi.toFixed(1)}% ROI`;
      } else if (bestOffer.analytics.roi > 0) {
        recommendedAction = `Consider ${bestOffer.analytics.rewardTier} offer - ${bestOffer.analytics.roi.toFixed(1)}% ROI`;
      } else {
        recommendedAction = 'Casino offers not favorable - consider regular booking';
      }
    }
    
    const summary = {
      cruiseId,
      ship: cruise.ship,
      itinerary: cruise.itineraryName,
      departureDate: cruise.departureDate,
      availableOffers,
      bestOffer,
      totalPotentialSavings,
      recommendedAction
    };
    this.schedulePersist();
    return summary;
  }

  calculateOfferValue(points: number, cabinType: string): number {
    const entry = CASINO_PAY_TABLE.find(e => points >= e.points);
    if (!entry) return 0;
    
    const freePlayMatch = entry.nextCruiseBonus.match(/\$(\d+(?:,\d+)?)/);  
    if (freePlayMatch) {
      return parseInt(freePlayMatch[1].replace(',', ''));
    }
    
    const offMatch = entry.nextCruiseBonus.match(/\$(\d+)\s+Off/);
    if (offMatch) {
      return parseInt(offMatch[1]);
    }
    
    return 0;
  }

  calculateCruisePricing(ship: string, nights: number, cabinType: string = 'Interior'): number {
    const shipName = ship.toLowerCase();
    let basePrice = 0;
    
    if (shipName.includes('star of the seas')) {
      basePrice = 180;
    } else if (shipName.includes('wonder of the seas') || shipName.includes('symphony of the seas')) {
      basePrice = 160;
    } else if (shipName.includes('harmony') || shipName.includes('allure') || shipName.includes('oasis')) {
      basePrice = 140;
    } else if (shipName.includes('voyager') || shipName.includes('mariner') || shipName.includes('navigator')) {
      basePrice = 120;
    } else {
      basePrice = 100;
    }
    
    const cabinMultipliers: { [key: string]: number } = {
      'interior': 1.0,
      'oceanview': 1.3,
      'balcony': 1.8,
      'suite': 3.2,
      'junior suite': 2.8,
      'grand suite': 4.5
    };
    
    const multiplier = cabinMultipliers[cabinType.toLowerCase()] || 1.0;
    
    const totalPrice = Math.round(basePrice * nights * multiplier * 2);
    
    return Math.round(totalPrice * 1.15);
  }

  fixCruiseDatesAndDuration(): number {
    let fixed = 0;
    
    console.log('[MemoryStore] Starting comprehensive cruise data validation and correction...');
    
    this.cruises.forEach(cruise => {
      let needsUpdate = false;
      const originalData = {
        departureDate: cruise.departureDate,
        returnDate: cruise.returnDate,
        nights: cruise.nights,
        itineraryName: cruise.itineraryName
      };
      
      const nightsFromItinerary = this.extractNightsFromItinerary(cruise.itineraryName || '');
      if (nightsFromItinerary && (!cruise.nights || cruise.nights <= 0 || isNaN(cruise.nights))) {
        cruise.nights = nightsFromItinerary;
        needsUpdate = true;
        console.log(`[MemoryStore] Fixed nights for ${cruise.ship}: ${originalData.nights} -> ${cruise.nights}`);
      }
      
      if (cruise.departureDate) {
        const standardizedDeparture = this.validateAndStandardizeDate(cruise.departureDate);
        if (standardizedDeparture && standardizedDeparture !== cruise.departureDate) {
          cruise.departureDate = standardizedDeparture;
          needsUpdate = true;
          console.log(`[MemoryStore] Standardized departure date for ${cruise.ship}: ${originalData.departureDate} -> ${cruise.departureDate}`);
        }
      }
      
      if (cruise.departureDate && cruise.nights && cruise.nights > 0) {
        const correctReturnDate = this.calculateReturnDate(cruise.departureDate, cruise.nights);
        
        const currentReturnDate = new Date(cruise.returnDate || '');
        const departureDate = new Date(cruise.departureDate);
        const expectedReturnDate = new Date(correctReturnDate || '');
        
        const needsReturnDateFix = !cruise.returnDate || 
                                  cruise.returnDate === cruise.departureDate ||
                                  isNaN(currentReturnDate.getTime()) ||
                                  currentReturnDate.getTime() <= departureDate.getTime() ||
                                  Math.abs(currentReturnDate.getTime() - expectedReturnDate.getTime()) > 24 * 60 * 60 * 1000;
        
        if (correctReturnDate && needsReturnDateFix) {
          cruise.returnDate = correctReturnDate;
          needsUpdate = true;
          console.log(`[MemoryStore] FIXED CRITICAL DATE ISSUE for ${cruise.ship}: ${originalData.departureDate} (${cruise.nights} nights) -> ${cruise.departureDate} to ${cruise.returnDate}`);
        }
      }
      
      const cleanedItinerary = this.cleanItineraryName(cruise.itineraryName || '', cruise.nights || 0);
      if (cleanedItinerary && cleanedItinerary !== cruise.itineraryName) {
        cruise.itineraryName = cleanedItinerary;
        needsUpdate = true;
        console.log(`[MemoryStore] Cleaned itinerary for ${cruise.ship}: "${originalData.itineraryName}" -> "${cleanedItinerary}"`);
      }
      
      const cleanedPort = this.cleanDeparturePort(cruise.departurePort || '');
      if (cleanedPort && cleanedPort !== cruise.departurePort) {
        cruise.departurePort = cleanedPort;
        needsUpdate = true;
      }
      
      if (!cruise.value || cruise.value === '0' || cruise.value === '') {
        const estimatedPrice = this.calculateCruisePricing(cruise.ship, cruise.nights || 7, cruise.cabinType || 'Interior');
        cruise.value = estimatedPrice.toString();
        needsUpdate = true;
      }
      
      if (needsUpdate) {
        cruise.updatedAt = new Date().toISOString();
        fixed++;
        console.log(`[MemoryStore] ✅ Updated cruise ${cruise.ship} - Departure: ${cruise.departureDate}, Return: ${cruise.returnDate}, Nights: ${cruise.nights}`);
      }
    });
    
    this.bookedCruises.forEach(cruise => {
      let needsUpdate = false;
      const originalData = {
        departureDate: cruise.departureDate,
        returnDate: cruise.returnDate,
        nights: cruise.nights
      };
      
      const nightsFromItinerary = this.extractNightsFromItinerary(cruise.itineraryName || '');
      if (nightsFromItinerary && (!cruise.nights || cruise.nights <= 0 || isNaN(cruise.nights))) {
        cruise.nights = nightsFromItinerary;
        needsUpdate = true;
        console.log(`[MemoryStore] Fixed booked cruise nights for ${cruise.ship}: ${originalData.nights} -> ${cruise.nights}`);
      }
      
      if (cruise.departureDate) {
        const standardizedStart = this.validateAndStandardizeDate(cruise.departureDate);
        if (standardizedStart && standardizedStart !== cruise.departureDate) {
          cruise.departureDate = standardizedStart;
          needsUpdate = true;
        }
      }
      
      if (cruise.departureDate && cruise.nights && cruise.nights > 0) {
        const correctEndDate = this.calculateReturnDate(cruise.departureDate, cruise.nights);
        
        const currentEndDate = new Date(cruise.returnDate || '');
        const startDate = new Date(cruise.departureDate);
        const expectedEndDate = new Date(correctEndDate || '');
        
        const needsEndDateFix = !cruise.returnDate || 
                               cruise.returnDate === cruise.departureDate ||
                               isNaN(currentEndDate.getTime()) ||
                               currentEndDate.getTime() <= startDate.getTime() ||
                               Math.abs(currentEndDate.getTime() - expectedEndDate.getTime()) > 24 * 60 * 60 * 1000;
        
        if (correctEndDate && needsEndDateFix) {
          cruise.returnDate = correctEndDate;
          needsUpdate = true;
          console.log(`[MemoryStore] FIXED CRITICAL BOOKED DATE ISSUE for ${cruise.ship}: ${cruise.departureDate} (${cruise.nights} nights) -> ${cruise.departureDate} to ${cruise.returnDate}`);
        }
      }
      
      const cleanedItinerary = this.cleanItineraryName(cruise.itineraryName || '', cruise.nights || 0);
      if (cleanedItinerary && cleanedItinerary !== cruise.itineraryName) {
        cruise.itineraryName = cleanedItinerary;
        needsUpdate = true;
      }
      
      const cleanedPort = this.cleanDeparturePort(cruise.departurePort || '');
      if (cleanedPort && cleanedPort !== cruise.departurePort) {
        cruise.departurePort = cleanedPort;
        needsUpdate = true;
      }
      
      if (cruise.departureDate) {
        const today = new Date();
        const departureDate = new Date(cruise.departureDate);
        const diffTime = departureDate.getTime() - today.getTime();
        const daysToGo = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        if (daysToGo !== cruise.daysToGo) {
          cruise.daysToGo = Math.max(0, daysToGo);
          needsUpdate = true;
        }
      }
      
      if (!cruise.currentMarketPrice || cruise.currentMarketPrice === 0) {
        cruise.currentMarketPrice = this.calculateCruisePricing(cruise.ship, cruise.nights || 7, 'Interior');
        needsUpdate = true;
      }
      
      if (needsUpdate) {
        cruise.updatedAt = new Date().toISOString();
        fixed++;
        console.log(`[MemoryStore] ✅ Updated booked cruise ${cruise.ship} - Departure: ${cruise.departureDate}, Return: ${cruise.returnDate}, Nights: ${cruise.nights}`);
      }
    });
    
    console.log(`[MemoryStore] 🎯 Comprehensive cruise data validation complete: ${fixed} cruises updated with accurate dates and durations`);
    return fixed;
  }
  
  private extractNightsFromItinerary(itinerary: string): number | null {
    if (!itinerary) return null;
    
    const patterns = [
      /(\d+)\s*[Nn]ight/,
      /(\d+)\s*-\s*[Nn]ight/,
      /(\d+)\s*[Nn]t/
    ];
    
    for (const pattern of patterns) {
      const match = itinerary.match(pattern);
      if (match) {
        const nights = parseInt(match[1], 10);
        if (nights > 0 && nights <= 21) {
          return nights;
        }
      }
    }
    
    return null;
  }
  
  private validateAndStandardizeDate(dateStr: string): string | null {
    if (!dateStr) return null;
    
    try {
      let date: Date;
      
      if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
        const [year, month, day] = dateStr.split('-');
        date = new Date(parseInt(year), parseInt(month) - 1, parseInt(day), 12, 0, 0, 0);
      }
      else if (/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(dateStr)) {
        const [month, day, year] = dateStr.split('/');
        date = new Date(parseInt(year), parseInt(month) - 1, parseInt(day), 12, 0, 0, 0);
      }
      else if (/^\d{1,2}-\d{1,2}-\d{4}$/.test(dateStr)) {
        const [month, day, year] = dateStr.split('-');
        date = new Date(parseInt(year), parseInt(month) - 1, parseInt(day), 12, 0, 0, 0);
      }
      else if (/^\d{4}\/\d{1,2}\/\d{1,2}$/.test(dateStr)) {
        const [year, month, day] = dateStr.split('/');
        date = new Date(parseInt(year), parseInt(month) - 1, parseInt(day), 12, 0, 0, 0);
      }
      else {
        date = new Date(dateStr);
        if (!isNaN(date.getTime())) {
          date.setHours(12, 0, 0, 0);
        }
      }
      
      if (isNaN(date.getTime())) return null;
      
      if (date.getFullYear() < 2020 || date.getFullYear() > 2030) {
        return null;
      }
      
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      
      return `${year}-${month}-${day}`;
    } catch {
      return null;
    }
  }
  
  public calculateReturnDate(departureDate: string, nights: number): string | null {
    try {
      const parts = departureDate.split('-');
      if (parts.length === 3) {
        const year = parseInt(parts[0]);
        const month = parseInt(parts[1]) - 1;
        const day = parseInt(parts[2]);
        const depDate = new Date(year, month, day, 12, 0, 0, 0);
        
        if (isNaN(depDate.getTime())) return null;
        
        const returnDate = new Date(depDate);
        returnDate.setDate(returnDate.getDate() + nights);
        
        const retYear = returnDate.getFullYear();
        const retMonth = String(returnDate.getMonth() + 1).padStart(2, '0');
        const retDay = String(returnDate.getDate()).padStart(2, '0');
        
        return `${retYear}-${retMonth}-${retDay}`;
      }
      
      return null;
    } catch {
      return null;
    }
  }
  
  private cleanItineraryName(itinerary: string, nights: number): string {
    if (!itinerary) return '';
    
    let cleaned = itinerary
      .replace(/NaN\s*night?/gi, '')
      .replace(/\s+/g, ' ')
      .trim();
    
    if (nights > 0 && !/(\d+)\s*[Nn]ight/.test(cleaned)) {
      if (cleaned) {
        cleaned = `${nights} Night ${cleaned}`;
      }
    }
    
    return cleaned;
  }
  
  private cleanDeparturePort(port: string): string {
    if (!port) return '';
    
    let cleaned = port
      .replace(/["']/g, '')
      .replace(/\s+/g, ' ')
      .trim();
    
    if (cleaned.toLowerCase().includes('orlando') && cleaned.toLowerCase().includes('navigator')) {
      cleaned = 'Los Angeles (San Pedro), California';
    }
    
    return cleaned;
  }

  standardizeDate(dateStr: string | undefined): string {
    if (!dateStr) return '';
    try {
      if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
        const [y, m, d] = dateStr.split('-').map(n => parseInt(n, 10));
        const dt = new Date(y, m - 1, d, 12, 0, 0, 0);
        if (isNaN(dt.getTime())) return '';
        const yyyy = dt.getFullYear();
        const mm = String(dt.getMonth() + 1).padStart(2, '0');
        const dd = String(dt.getDate()).padStart(2, '0');
        return `${yyyy}-${mm}-${dd}`;
      }
      if (/^\d{1,2}[\/\-]\d{1,2}[\/\-]\d{4}$/.test(dateStr)) {
        const parts = dateStr.includes('/') ? dateStr.split('/') : dateStr.split('-');
        const month = parseInt(parts[0], 10);
        const day = parseInt(parts[1], 10);
        const year = parseInt(parts[2], 10);
        const dt = new Date(year, month - 1, day, 12, 0, 0, 0);
        if (isNaN(dt.getTime())) return '';
        const yyyy = dt.getFullYear();
        const mm = String(dt.getMonth() + 1).padStart(2, '0');
        const dd = String(dt.getDate()).padStart(2, '0');
        return `${yyyy}-${mm}-${dd}`;
      }
      const parsed = new Date(dateStr);
      if (isNaN(parsed.getTime())) return '';
      parsed.setHours(12, 0, 0, 0);
      const yyyy = parsed.getFullYear();
      const mm = String(parsed.getMonth() + 1).padStart(2, '0');
      const dd = String(parsed.getDate()).padStart(2, '0');
      return `${yyyy}-${mm}-${dd}`;
    } catch {
      return '';
    }
  }

  standardizeAllDates(): number {
    let standardized = 0;
    
    this.cruises.forEach(cruise => {
      if (cruise.departureDate) {
        const iso = this.standardizeDate(cruise.departureDate);
        if (iso && iso !== cruise.departureDate) {
          cruise.departureDate = iso;
          standardized++;
        }
      }
      if (cruise.returnDate) {
        const iso = this.standardizeDate(cruise.returnDate);
        if (iso && iso !== cruise.returnDate) {
          cruise.returnDate = iso;
          standardized++;
        }
      }
      if (cruise.offerExpirationDate) {
        const iso = this.standardizeDate(cruise.offerExpirationDate);
        if (iso && iso !== cruise.offerExpirationDate) {
          cruise.offerExpirationDate = iso;
          standardized++;
        }
      }
    });
    
    this.bookedCruises.forEach(cruise => {
      if (cruise.departureDate) {
        const iso = this.standardizeDate(cruise.departureDate);
        if (iso && iso !== cruise.departureDate) {
          cruise.departureDate = iso;
          standardized++;
        }
      }
      if (cruise.returnDate) {
        const iso = this.standardizeDate(cruise.returnDate);
        if (iso && iso !== cruise.returnDate) {
          cruise.returnDate = iso;
          standardized++;
        }
      }
    });
    
    this.casinoOffers.forEach(offer => {
      if (offer.expires) {
        const iso = this.standardizeDate(offer.expires);
        if (iso && iso !== offer.expires) {
          offer.expires = iso;
          standardized++;
        }
      }
    });
    
    console.log(`[MemoryStore] Standardized ${standardized} dates`);
    return standardized;
  }

  fixBookingIds(): number {
    let fixed = 0;

    // Treat any cruise in the unified list with a non-empty reservationNumber as a booked cruise.
    const unifiedBooked = this.cruises.filter(c => (c.reservationNumber ?? '').trim() !== '');

    // Also include legacy bookedCruises if present
    const legacyBooked = this.bookedCruises.filter(bc => (bc.reservationNumber ?? '').trim() !== '');

    const allReservationNumbers = new Set<string>([
      ...unifiedBooked.map(c => c.reservationNumber!).filter(Boolean),
      ...legacyBooked.map(bc => bc.reservationNumber!).filter(Boolean),
    ]);

    console.log('[MemoryStore] fixBookingIds()', {
      unifiedBooked: unifiedBooked.length,
      legacyBooked: legacyBooked.length,
      uniqueReservationNumbers: allReservationNumbers.size,
    });

    this.cruises.forEach(cruise => {
      const hasRes = (cruise.reservationNumber ?? '').trim() !== '';

      if (hasRes) {
        // In the unified system, the bookingId should be the cruise's own id to mark it booked
        if (!cruise.bookingId) {
          cruise.bookingId = cruise.id;
          fixed++;
          console.log(`[MemoryStore] Set missing bookingId = cruise.id for ${cruise.ship} (${cruise.departureDate})`);
        }
      } else {
        // If the cruise has no reservation number but still has a bookingId, clear invalid booking artifacts
        if (cruise.bookingId) {
          delete cruise.bookingId;
          delete cruise.guests;
          delete cruise.daysToGo;
          fixed++;
          console.log(`[MemoryStore] Cleared stale booking fields for ${cruise.ship} (${cruise.departureDate})`);
        }
      }
    });

    // For legacy booked records, try to link to matching unified cruise by reservationNumber + date + ship
    legacyBooked.forEach(bc => {
      const match = this.cruises.find(c =>
        (c.reservationNumber ?? '') === bc.reservationNumber &&
        c.ship.toLowerCase() === bc.ship.toLowerCase() &&
        (c.departureDate?.slice(0,10) === bc.departureDate?.slice(0,10))
      );
      if (match) {
        if (!match.bookingId) {
          match.bookingId = match.id;
          fixed++;
          console.log(`[MemoryStore] Linked legacy booked to unified cruise ${match.ship} (${match.departureDate})`);
        }
      } else {
        // If no unified cruise exists, create one from the legacy booked record
        try {
          const created = this.createCruise({
            ship: bc.ship,
            itineraryName: bc.itineraryName || '',
            departurePort: bc.departurePort || '',
            departureDate: this.standardizeDate(bc.departureDate) || bc.departureDate,
            returnDate: this.standardizeDate(bc.returnDate) || bc.returnDate,
            nights: bc.nights || this.extractNightsFromItinerary(bc.itineraryName || '') || 7,
            line: 'Royal Caribbean',
            region: undefined,
            stateroomTypes: ['Interior'],
            status: 'on_sale',
            reservationNumber: bc.reservationNumber,
          } as any);
          created.bookingId = created.id;
          fixed++;
          console.log(`[MemoryStore] Created unified cruise from legacy booked: ${created.ship} ${created.departureDate} (res ${bc.reservationNumber})`);
        } catch (e) {
          console.warn('[MemoryStore] Failed to create unified cruise from booked record:', e);
        }
      }
    });

    console.log(`[MemoryStore] BookingId normalization complete. Updated ${fixed} cruises.`);
    return fixed;
  }

  deleteExpiredOffers(): { deletedOffers: number; deletedCruises: number } {
    console.log('[MemoryStore] Skipping expired offer deletion - keeping all offers for historical analysis');
    return { deletedOffers: 0, deletedCruises: 0 };
  }

  createDataSnapshot(description: string, operationType: 'web-update' | 'import' | 'manual-fix' | 'batch-verify' = 'manual-fix'): string {
    const snapshotId = `snapshot_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    const snapshot = {
      timestamp: new Date().toISOString(),
      cruises: JSON.parse(JSON.stringify(this.cruises)),
      bookedCruises: JSON.parse(JSON.stringify(this.bookedCruises)),
      casinoOffers: JSON.parse(JSON.stringify(this.casinoOffers)),
      description,
      operationType
    };
    
    this.dataSnapshots.set(snapshotId, snapshot);
    
    if (this.dataSnapshots.size > this.maxSnapshots) {
      const oldestKey = Array.from(this.dataSnapshots.keys())[0];
      this.dataSnapshots.delete(oldestKey);
    }
    
    console.log(`[MemoryStore] Created data snapshot: ${snapshotId} - ${description}`);
    return snapshotId;
  }
  
  getAvailableSnapshots(): Array<{
    id: string;
    timestamp: string;
    description: string;
    operationType: string;
    cruiseCount: number;
    bookedCount: number;
    offerCount: number;
  }> {
    return Array.from(this.dataSnapshots.entries())
      .map(([id, snapshot]) => ({
        id,
        timestamp: snapshot.timestamp,
        description: snapshot.description,
        operationType: snapshot.operationType,
        cruiseCount: snapshot.cruises.length,
        bookedCount: snapshot.bookedCruises.length,
        offerCount: snapshot.casinoOffers.length
      }))
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  }
  
  rollbackToSnapshot(snapshotId: string): {
    success: boolean;
    message: string;
    changes: {
      cruisesRestored: number;
      bookedCruisesRestored: number;
      offersRestored: number;
    };
  } {
    const snapshot = this.dataSnapshots.get(snapshotId);
    
    if (!snapshot) {
      return {
        success: false,
        message: `Snapshot ${snapshotId} not found`,
        changes: { cruisesRestored: 0, bookedCruisesRestored: 0, offersRestored: 0 }
      };
    }
    
    const rollbackSnapshotId = this.createDataSnapshot(
      `Pre-rollback state (rolling back to: ${snapshot.description})`,
      'manual-fix'
    );
    
    const currentCounts = {
      cruises: this.cruises.length,
      bookedCruises: this.bookedCruises.length,
      casinoOffers: this.casinoOffers.length
    };
    
    this.cruises = JSON.parse(JSON.stringify(snapshot.cruises));
    this.bookedCruises = JSON.parse(JSON.stringify(snapshot.bookedCruises));
    this.casinoOffers = JSON.parse(JSON.stringify(snapshot.casinoOffers));
    
    const changes = {
      cruisesRestored: snapshot.cruises.length,
      bookedCruisesRestored: snapshot.bookedCruises.length,
      offersRestored: snapshot.casinoOffers.length
    };
    
    console.log(`[MemoryStore] Rolled back to snapshot: ${snapshotId}`);
    console.log(`[MemoryStore] Rollback changes:`, {
      cruises: `${currentCounts.cruises} -> ${changes.cruisesRestored}`,
      bookedCruises: `${currentCounts.bookedCruises} -> ${changes.bookedCruisesRestored}`,
      casinoOffers: `${currentCounts.casinoOffers} -> ${changes.offersRestored}`
    });
    
    return {
      success: true,
      message: `Successfully rolled back to: ${snapshot.description} (${snapshot.timestamp})`,
      changes
    };
  }
  
  deleteSnapshot(snapshotId: string): boolean {
    const deleted = this.dataSnapshots.delete(snapshotId);
    if (deleted) {
      console.log(`[MemoryStore] Deleted snapshot: ${snapshotId}`);
    }
    return deleted;
  }
  
  clearAllSnapshots(): number {
    const count = this.dataSnapshots.size;
    this.dataSnapshots.clear();
    console.log(`[MemoryStore] Cleared ${count} snapshots`);
    return count;
  }
  
  performWebDataUpdate(updateFunction: () => Promise<any>, description: string): Promise<{
    success: boolean;
    result?: any;
    error?: string;
    snapshotId?: string;
    rollbackAvailable: boolean;
  }> {
    return new Promise(async (resolve) => {
      const snapshotId = this.createDataSnapshot(
        `Before: ${description}`,
        'web-update'
      );
      
      try {
        console.log(`[MemoryStore] Starting web data update: ${description}`);
        
        const result = await updateFunction();
        
        console.log(`[MemoryStore] Web data update completed successfully: ${description}`);
        this.schedulePersist();
        
        resolve({
          success: true,
          result,
          snapshotId,
          rollbackAvailable: true
        });
        
      } catch (error) {
        console.error(`[MemoryStore] Web data update failed: ${description}`, error);
        
        const rollbackResult = this.rollbackToSnapshot(snapshotId);
        
        if (rollbackResult.success) {
          console.log(`[MemoryStore] Automatic rollback completed for failed update: ${description}`);
        } else {
          console.error(`[MemoryStore] Automatic rollback failed: ${rollbackResult.message}`);
        }
        
        resolve({
          success: false,
          error: error instanceof Error ? error.message : String(error),
          snapshotId,
          rollbackAvailable: rollbackResult.success
        });
      }
    });
  }
  
  async performBatchWebUpdate(
    cruiseIds: string[],
    updateFunction: (cruiseId: string) => Promise<any>,
    description: string,
    continueOnError: boolean = true
  ): Promise<{
    success: boolean;
    processed: number;
    successful: number;
    failed: number;
    errors: string[];
    snapshotId: string;
    rollbackAvailable: boolean;
  }> {
    const snapshotId = this.createDataSnapshot(
      `Before batch: ${description}`,
      'batch-verify'
    );
    
    let processed = 0;
    let successful = 0;
    let failed = 0;
    const errors: string[] = [];
    
    console.log(`[MemoryStore] Starting batch web update: ${description} (${cruiseIds.length} items)`);
    
    try {
      for (const cruiseId of cruiseIds) {
        try {
          await updateFunction(cruiseId);
          successful++;
        } catch (error) {
          failed++;
          const errorMsg = `Failed to update ${cruiseId}: ${error}`;
          errors.push(errorMsg);
          console.error(`[MemoryStore] ${errorMsg}`);
          
          if (!continueOnError) {
            throw new Error(`Batch update stopped due to error: ${errorMsg}`);
          }
        }
        processed++;
        
        if (processed < cruiseIds.length) {
          await new Promise(resolve => setTimeout(resolve, 500));
        }
      }
      
      const overallSuccess = successful > 0 && (continueOnError || failed === 0);
      
      console.log(`[MemoryStore] Batch web update completed: ${successful}/${processed} successful`);
      this.schedulePersist();
      
      return {
        success: overallSuccess,
        processed,
        successful,
        failed,
        errors,
        snapshotId,
        rollbackAvailable: true
      };
      
    } catch (error) {
      console.error(`[MemoryStore] Batch web update failed: ${description}`, error);
      
      const rollbackResult = this.rollbackToSnapshot(snapshotId);
      
      return {
        success: false,
        processed,
        successful,
        failed,
        errors: [...errors, error instanceof Error ? error.message : String(error)],
        snapshotId,
        rollbackAvailable: rollbackResult.success
      };
    }
  }
  
  async importTripItCalendar(): Promise<number> {
    console.log('[MemoryStore] Importing TripIt calendar');
    
    try {
      const response = await fetch('https://www.tripit.com/feed/ical/private/6D1ACB7E-DF1422C4611E9FA3C16E5EC4AFD60F7B/tripit.ics');
      if (response.ok) {
        const icalData = await response.text();
        const tripitEvents = this.parseICalData(icalData);
        
        this.calendarEvents = this.calendarEvents.filter(e => e.source !== 'tripit');
        
        tripitEvents.forEach(event => this.createCalendarEvent(event));
        this.schedulePersist();
        
        console.log('[MemoryStore] Imported TripIt events:', tripitEvents.length);
        return tripitEvents.length;
      } else {
        throw new Error(`Failed to fetch TripIt calendar: ${response.status}`);
      }
    } catch (error) {
      console.error('[MemoryStore] Failed to import TripIt calendar:', error);
      throw error;
    }
  }
  
  private parseICalData(icalData: string) {
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
            currentEvent.startDate = this.parseICalDate(value);
            break;
          case 'DTEND':
          case 'DTEND;VALUE=DATE':
            currentEvent.endDate = this.parseICalDate(value);
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
  
  private parseICalDate(dateStr: string): string {
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
    } catch (error) {
      return new Date().toISOString().split('T')[0];
    }
  }
}

class MemoryStoreSingleton {
  private static instance: MemoryStore;
  
  static getInstance(): MemoryStore {
    if (!global.__memoryStore) {
      console.log('[MemoryStoreSingleton] Creating new global instance');
      global.__memoryStore = new MemoryStore();
      global.__memoryStoreDebug = {
        lastAccess: new Date().toISOString(),
        eventCount: 0
      };

      // Persist periodically as safety
      const instance = global.__memoryStore;
      setInterval(() => {
        instance.persistNow().catch(() => {});
      }, 10000);
    } else {
      console.log('[MemoryStoreSingleton] Using existing global instance');
      console.log('[MemoryStoreSingleton] Current events:', global.__memoryStore.calendarEvents.length);
      console.log('[MemoryStoreSingleton] Current cruises:', global.__memoryStore.cruises.length);
      global.__memoryStoreDebug = {
        lastAccess: new Date().toISOString(),
        eventCount: global.__memoryStore.calendarEvents.length
      };
    }
    return global.__memoryStore;
  }
}

export const memoryStore = MemoryStoreSingleton.getInstance();
