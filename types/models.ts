// Core cruise data models

/**
 * CRUISE CATEGORIZATION SYSTEM:
 * 
 * 1. CRUISE: Any cruise that appears on a casino offer
 *    - Shows on main cruises page (ALL CRUISES)
 *    - May or may not be booked
 * 
 * 2. BOOKED CRUISE: Has a deposit and booking number (booking ID#) or is completed
 *    - Shows on booked cruises page
 *    - Has reservationNumber or bookingId field populated
 *    - Status can be upcoming, in-progress, or completed
 * 
 * 3. AVAILABLE CRUISE: Fits into current schedule based on booked cruises
 *    - Shows on scheduling/available cruises page
 *    - Filtered to only show cruises that don't conflict with booked cruises
 *    - Based on date availability analysis
 * 
 * CRITICAL BOOKING ID SYSTEM NOTES:
 * 
 * - CRUISE ID: Unique identifier from cruises.xlsx (UUID format)
 * - BOOKING ID: Only for ACTUAL booked/completed cruises with real reservation numbers
 * - RESERVATION NUMBER: Real booking confirmation numbers (e.g., "1869130", "6548636")
 * 
 * ONLY the following cruises should have booking IDs and reservation numbers:
 * - 10 booked future cruises (from booked.xlsx)
 * - 6+ completed cruises (past cruises with receipts/statements)
 * 
 * Regular cruises from cruises.xlsx should NOT have booking IDs unless actually booked.
 * The fixBookingIds() method ensures this separation is maintained.
 */
export interface Cruise {
  id: string;
  ship: string;
  itineraryName: string;
  departurePort: string;
  arrivalPort?: string;
  departureDate: string; // ISO date
  returnDate: string; // ISO date
  nights: number;
  line: string;
  region?: string;
  shipClass?: string;
  stateroomTypes: string[];
  status: "on_sale" | "sold_out" | "canceled";
  lifecycleStatus?: 'upcoming' | 'in-progress' | 'completed';
  createdAt: string;
  updatedAt: string;
  // Identification (separate from booking)
  uniqueCruiseId?: string; // Unique identifier from source sheets to avoid confusion with booking IDs
  // Additional fields from master sheet
  cabinType?: string;
  cabinNumber?: string;
  categoryBooked?: string;
  casinoOfferType?: string;
  offerName?: string;
  offerCode?: string;
  offerExpirationDate?: string; // Standardized field name
  typeOfOffer?: string;
  value?: string;
  // Booking information - ONLY for actually booked cruises with real reservation numbers
  // These fields should ONLY be populated for cruises that are actually booked/completed
  bookingId?: string; // Links to BookedCruise.id - only for actual bookings
  reservationNumber?: string; // Real booking confirmation number - only for actual bookings
  guests?: number; // Number of guests - only for actual bookings
  daysToGo?: number; // Days until departure - only for actual bookings
  // Pricing info for booked cruises
  paidFare?: number;
  actualFare?: number;
  currentMarketPrice?: number;
  actualSavings?: number;
  projectedSavings?: number;
  // Enhanced financial tracking with data source tracking
  winningsBroughtHome?: number;
  usedNextCruiseCertificate?: boolean;
  netOutOfPocket?: number; // Calculated field
  casinoCompedExtras?: number; // From statement line items
  totalValueBack?: number; // Calculated: (Retail price + spa/internet/dining) - net winnings
  roiPercentage?: number; // Calculated based on points
  cruisePointsEarned?: number; // Points earned on this specific cruise
  
  // User financial inputs
  userFinancialData?: {
    totalWinningsEarned?: number;
    pointsEarnedOnCruise?: number;
    actualAmountPaid?: number;
    additionalFreeplayReceived?: number;
    lastUpdated: string;
  };
  
  // Data source tracking
  dataSource?: {
    pricing: 'receipt' | 'statement' | 'estimated' | 'user-input';
    financial: 'receipt' | 'statement' | 'estimated' | 'user-input';
    points: 'calculated' | 'user-input';
    lastUpdated: string;
  };
  // Royal Caribbean scraper fields
  source?: string; // Source of the cruise data (e.g., 'royal-caribbean-scraper')
  offerDetails?: {
    offerName: string;
    offerCode: string;
    expiryDate: string;
    cabinType: string;
    guests: string;
  };
  
  // Verification status - CRITICAL for data accuracy
  verified?: boolean; // Whether pricing and itinerary have been verified from web sources
  verifiedAt?: string; // ISO timestamp of last verification
  verifiedSource?: string; // Source of verification (cruisecritic.com, cruises.com, cruiseaway.com, expedia.com)
  ports?: Array<{ name: string; arrivalTime?: string; departureTime?: string; activities?: string[] }>; // Detailed port information
  portsRoute?: string; // Comma-separated list of port names
  
  // NEW: Enhanced cabin pricing from cruises.xlsx
  interiorPrice?: number | null;
  oceanviewPrice?: number | null;
  balconyPrice?: number | null;
  suitePrice?: number | null;
  portTaxesFees?: number | null;
  
  // NEW: Detailed itinerary with day/time/ports from cruises.xlsx
  itineraryDetails?: Array<{
    day: number;
    date?: string;
    port: string;
    arrivalTime?: string;
    departureTime?: string;
  }>;
  
  // NEW: Multiple offer codes support
  offerCodes?: string[]; // Array of applicable offer codes
  
  // Web-fetched pricing details (legacy)
  pricing?: {
    interior?: number | null;
    oceanview?: number | null;
    balcony?: number | null;
    suite?: number | null;
    source?: string;
    fetchedAt?: string;
    verified?: boolean;
  };

  // New explicit pricing tracking for all cruises
  pricingCurrent?: {
    interior?: number | null;
    oceanview?: number | null;
    balcony?: number | null;
    suite?: number | null;
    source?: string | null;
    fetchedAt?: string | null;
  };
  pricingLowest?: {
    interior?: number | null;
    oceanview?: number | null;
    balcony?: number | null;
    suite?: number | null;
    source?: string | null;
    fetchedAt?: string | null;
  };
}

export interface BookedCruise {
  id: string;
  cruiseId?: string; // Link to main cruise data
  uniqueCruiseId?: string; // Source sheet's unique cruise identifier
  ship: string;
  departureDate: string; // ISO date - STANDARDIZED field name
  returnDate: string; // ISO date - STANDARDIZED field name
  nights: number;
  itineraryName: string;
  departurePort: string;
  portsRoute?: string;
  reservationNumber: string;
  guests: number;
  cabinNumber?: string;
  categoryBooked?: string;
  daysToGo: number;
  lifecycleStatus?: 'upcoming' | 'in-progress' | 'completed';
  // Verification status
  verified?: boolean;
  verifiedAt?: string;
  verifiedSource?: string;
  // Pricing info
  paidFare?: number;
  actualFare?: number;
  currentMarketPrice?: number;
  actualSavings?: number;
  projectedSavings?: number;
  // Enhanced financial tracking with data source tracking
  winningsBroughtHome?: number;
  usedNextCruiseCertificate?: boolean;
  netOutOfPocket?: number; // Calculated field
  casinoCompedExtras?: number; // From statement line items
  totalValueBack?: number; // Calculated: (Retail price + spa/internet/dining) - net winnings
  roiPercentage?: number; // Calculated based on points
  cruisePointsEarned?: number; // Points earned on this specific cruise
  
  // User financial inputs
  userFinancialData?: {
    totalWinningsEarned?: number;
    pointsEarnedOnCruise?: number;
    actualAmountPaid?: number;
    additionalFreeplayReceived?: number;
    lastUpdated: string;
  };
  
  // Data source tracking
  dataSource?: {
    pricing: 'receipt' | 'statement' | 'estimated' | 'user-input';
    financial: 'receipt' | 'statement' | 'estimated' | 'user-input';
    points: 'calculated' | 'user-input';
    lastUpdated: string;
  };
  createdAt: string;
  updatedAt: string;
}

export interface CasinoOffer {
  id: string;
  name: string;
  rewardNumber: string;
  offerName: string;
  offerType: string;
  expires: string; // Expiration date
  offerCode: string;
  tradeInValue: string;
  createdAt: string;
  updatedAt: string;
  // Date/ship matching fields for associating cruises with offers
  sailingDates?: string[]; // Array of sailing dates this offer applies to
  ships?: string[]; // Array of ship names this offer applies to
  offerStartDate?: string; // When the offer becomes valid
  offerEndDate?: string; // When the offer expires (can be different from expires)
  // Additional fields from imported offer data (offers.xlsx)
  'Offer Received Date'?: string; // When the offer was received
  'OFFER EXPIRE DATE'?: string; // Alternative field name for expiration
  'Offer Code'?: string; // Alternative field name
  'OFFER CODE'?: string; // Alternative field name
  'Offer Name'?: string; // Alternative field name
  'OFFER NAME'?: string; // Alternative field name
  perks?: string[]; // List of perks included in the offer
  description?: string; // Offer description
  profile?: string; // User profile this offer is for
  Profile?: string; // Alternative field name
  
  // NEW: Fields from 20-column offers.csv format
  shipName?: string; // Ship Name
  sailingDate?: string; // Sailing Date
  itinerary?: string; // Itinerary
  roomType?: string; // Room Type
  guestsInfo?: string; // GuestsInfo
  shipClass?: string; // Ship Class
  offerExpiryDate?: string; // Offer Expiry Date
  priceInterior?: number | null; // Price Interior
  priceOceanView?: number | null; // Price Ocean View
  priceBalcony?: number | null; // Price Balcony
  priceSuite?: number | null; // Price Suite
  taxesAndFees?: number | null; // Taxes & Fees
  portsAndTimes?: string; // Ports & Times
  offerTypeCategory?: string; // Offer Type / Category
  nights?: number | null; // Nights
  departurePort?: string; // Departure Port
  
  // NEW: Comp Value Calculation Fields (Plan Q - Phase 2)
  normalizedCabinType?: 'INTERIOR' | 'OCEANVIEW' | 'BALCONY' | 'SUITE' | null;
  perPersonPrice?: number | null; // Selected based on normalizedCabinType
  baseCabinPrice?: number | null; // 2-person cabin retail price (2 × perPersonPrice)
  compedShares?: number | null; // How many guest shares are comped (0-2, e.g., 2511A06 = 1.5)
  coverageFraction?: number | null; // Percentage of cabin cost covered (compedShares / 2)
  compValue?: number | null; // Calculated comp value (baseCabinPrice × coverageFraction)
  compValueCalculatedAt?: string; // ISO timestamp when calculation was performed
}

export interface CalendarEvent {
  id: string;
  summary: string;
  location?: string;
  startDate: string;
  endDate: string;
  description?: string;
  source: "tripit" | "booked" | "manual";
  cruiseId?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Offer {
  id: string;
  offerCode: string; // Strict format: 25SEP106
  title: string;
  description: string;
  startDate: string;
  endDate: string;
  eligibleCabins: string[];
  eligibleDates: string[];
  combinableWith: string[];
  exclusions: string[];
  channel: "public" | "TA" | "resident";
  markets: string[];
  createdAt: string;
  updatedAt: string;
}

export interface Price {
  id: string;
  cruiseId: string;
  cabinType: string;
  fare: number;
  taxesFees: number;
  gratuitiesPolicy: "included" | "excluded" | "N/A";
  currency: string;
  pricingDate: string;
  priceSource: string;
  promosApplied: string[];
  createdAt: string;
  updatedAt: string;
}

export interface Threshold {
  id: string;
  type: "price_drop" | "occupancy" | "days_out";
  value: number;
  cabinScope?: string;
  cruiseScope?: string;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Alert {
  id: string;
  type: "import_error" | "price_drop" | "threshold_hit";
  message: string;
  cruiseId?: string;
  offerId?: string;
  severity: "info" | "warning" | "error";
  createdAt: string;
  resolved: boolean;
}

export interface ImportReport {
  processed: number;
  inserted: number;
  updated: number;
  skipped: number;
  errors: { row: number; message: string }[];
}

export type CabinType = "Interior" | "Oceanview" | "Balcony" | "Suite" | "Solo" | "Family";

// User profile and points system
export interface UserProfile {
  id: string;
  level: string; // e.g., "PRIME"
  points: number; // Casino points (1 point = $5 in slot machine)
  nextLevelPoints: number;
  totalSpent: number; // Total money in slot machines
  createdAt: string;
  updatedAt: string;
}

// Club Royale Points and Rewards System
export interface ClubRoyaleProfile {
  id: string;
  totalPoints: number; // Current total points (e.g., 12,551)
  currentTier: 'Prime' | 'Signature' | 'Masters';
  nextTier?: 'Signature' | 'Masters';
  pointsToNextTier?: number;
  lifetimePoints: number; // All-time points earned
  pointsResetDate: string; // April 1st each year
  certificates: ClubRoyaleCertificate[];
  cruiseHistory: CruisePointsHistory[];
  valuePerPoint: number; // Calculated from actual savings
  projectedTierDate?: string; // When they'll hit next tier
  createdAt: string;
  updatedAt: string;
}

export interface ClubRoyaleCertificate {
  id: string;
  code: string; // e.g., "2508A03A", "2508A05"
  offerType: string; // e.g., "Balcony or Oceanview Stateroom"
  freePlayAmount: number; // e.g., 500 for $500 FreePlay
  pointsRequired: number; // Points needed to earn this certificate
  earnedDate: string;
  expirationDate: string;
  isUsed: boolean;
  usedOnCruiseId?: string;
  cruiseEarnedOn?: string; // Which cruise earned this certificate
}

// P4-11: Simple certificate record for CRUD via backend
export interface CertificateItem {
  id: string;
  type: 'FCC' | 'NextCruise' | 'Other';
  value: number;
  earnedDate: string;
  expiresOn: string;
  linkedCruiseId?: string;
  usedOnCruiseId?: string;
  isUsed: boolean;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface EstimatorParams {
  id: string;
  targetPoints?: number;
  targetTier?: 'Prime' | 'Signature' | 'Masters';
  nightlyTargetPoints?: number;
  preferredCabin?: CabinType;
  updatedAt: string;
}

export interface CasinoPerformance {
  id: string;
  cruiseId: string;
  pointsEarned: number;
  coinIn: number;
  totalWon?: number;
  totalLost?: number;
  netResult?: number;
  sessions?: number;
  notes?: string;
  updatedAt: string;
  createdAt: string;
}

export interface CruisePointsHistory {
  id: string;
  cruiseId: string;
  ship: string;
  departureDate: string;
  pointsEarned: number;
  coinIn: number; // Total amount played
  actualSavings: number; // Real savings achieved
  valuePerPoint: number; // Savings / points for this cruise
  certificatesEarned: string[]; // Certificate codes earned
  tier: 'Prime' | 'Signature' | 'Masters';
  notes?: string;
}

// Tier progression system
export interface TierRequirements {
  tier: 'Prime' | 'Signature' | 'Masters';
  minPoints: number;
  maxPoints?: number;
  benefits: string[];
  nextCruiseBonuses: string[];
}

export const CLUB_ROYALE_TIERS: TierRequirements[] = [
  {
    tier: 'Prime',
    minPoints: 0,
    maxPoints: 24999,
    benefits: [
      'Priority check-in',
      'Complimentary room service',
      'Exclusive casino tournaments'
    ],
    nextCruiseBonuses: [
      'Up to $500 FreePlay',
      'Discounted cruise fares',
      'Cabin upgrades based on availability'
    ]
  },
  {
    tier: 'Signature',
    minPoints: 25000,
    maxPoints: 74999,
    benefits: [
      'All Prime benefits',
      'Priority tender service',
      'Complimentary specialty dining',
      'Priority spa reservations'
    ],
    nextCruiseBonuses: [
      'Up to $2,500 FreePlay',
      'Suite upgrades',
      'Complimentary gratuities'
    ]
  },
  {
    tier: 'Masters',
    minPoints: 75000,
    benefits: [
      'All Signature benefits',
      'Exclusive Masters events',
      'Personal casino host',
      'Priority everything'
    ],
    nextCruiseBonuses: [
      'Up to $5,000 FreePlay',
      'Complimentary suite upgrades',
      'Exclusive shore excursions'
    ]
  }
];

// Analytics and summary types
export interface PriceTrend {
  date: string;
  price: number;
  cabinType: string;
  cruiseId: string;
}

export interface SavingsSummary {
  totalActualSavings: number;
  totalProjectedSavings: number;
  averageSavingsPerCruise: number;
  totalCruiseValue: number;
  totalPaid: number;
}

// Import/Export types
export interface CsvMapping {
  [csvColumn: string]: string; // Maps CSV column to model field
}

export interface ImportPreview {
  headers: string[];
  rows: any[][];
  detectedMappings: CsvMapping;
  validationErrors: { row: number; field: string; message: string }[];
}

// Filter types
export interface CruiseFilters {
  dateRange?: { from: string; to: string };
  line?: string;
  ship?: string;
  region?: string;
  cabinType?: string;
  status?: string;
  hasOffer?: boolean;
  priceSource?: string;
}

export interface CalendarFilters {
  showBooked: boolean;
  showTripit: boolean;
  showOpen: boolean;
  dateRange?: { from: string; to: string };
}

// Casino Analytics Types
export interface CasinoAnalytics {
  id: string;
  cruiseId: string;
  cabinPrice: number;
  taxes: number;
  offerType: string;
  perks: string[];
  points: number;
  // Calculated values
  retailValue: number;
  savings: number;
  outOfPocket: number;
  totalValue: number;
  coinIn: number;
  costPerPoint: number;
  valuePerPoint: number;
  roi: number;
  rewardTier: string;
  nextCruiseBonus: string;
  createdAt: string;
  updatedAt: string;
}

export interface CasinoPayTableEntry {
  offerCode: string;
  points: number;
  reward: string;
  nextCruiseBonus: string;
  cabinTypes: string[];
}

export interface CasinoOfferAnalysis {
  offerId: string;
  cruiseId: string;
  analytics: CasinoAnalytics;
  recommendations: string[];
  comparisonData: {
    marketPrice: number;
    offerValue: number;
    totalSavings: number;
    effectiveDiscount: number;
  };
}

export interface CruiseCasinoSummary {
  cruiseId: string;
  ship: string;
  itinerary: string;
  departureDate: string;
  availableOffers: CasinoOfferAnalysis[];
  bestOffer: CasinoOfferAnalysis | null;
  totalPotentialSavings: number;
  recommendedAction: string;
}

// Retail pricing table (generic) kept separate from cruises/booked/etc
export interface RetailPricingTable {
  id: string;
  sourceUrl: string;
  headers: string[];
  rows: string[][];
  updatedAt: string;
}

// Receipt and Statement data types for enhanced analytics
export interface ReceiptData {
  id: string;
  cruiseId: string;
  reservationNumber?: string;
  guestNames?: string[];
  cabinNumber?: string;
  cabinType?: string;
  totalFare?: number;
  taxesAndFees?: number;
  gratuities?: number;
  totalPaid?: number;
  paymentMethod?: string;
  bookingDate?: string;
  departureDate?: string;
  returnDate?: string;
  ship?: string;
  itinerary?: string;
  ports?: string[];
  specialOffers?: string[];
  balanceDue?: number;
  finalPaymentDate?: string;
  casinoDiscount?: number;
  freePlay?: number;
  retailPrice?: number;
  amountPaid?: number;
  lineItems?: {
    description: string;
    amount: number;
  }[];
  createdAt: string;
  updatedAt: string;
}

export interface CruiseStatementData {
  id: string;
  cruiseId: string;
  reservationNumber?: string;
  statementDate?: string;
  guestNames?: string[];
  cabinNumber?: string;
  cabinType?: string;
  ship?: string;
  itinerary?: string;
  departureDate?: string;
  returnDate?: string;
  ports?: string[];
  
  // Financial breakdown
  cruiseFare?: number;
  taxesAndFees?: number;
  gratuities?: number;
  onboardCharges?: number;
  excursions?: number;
  beveragePackages?: number;
  internetPackages?: number;
  specialtyDining?: number;
  photos?: number;
  spa?: number;
  casino?: number;
  shopping?: number;
  otherCharges?: number;
  totalCharges?: number;
  
  // Enhanced Club Royale Entertainment charges - sum of all casino line items
  clubRoyaleEntertainmentCharges?: number;
  
  // Payments
  deposits?: number;
  finalPayment?: number;
  onboardPayments?: number;
  totalPayments?: number;
  balanceDue?: number;
  
  // Account summary
  accountNumber?: string;
  folio?: string;
  
  // Line items for detailed analysis
  lineItems?: {
    date: string;
    category: string;
    description: string;
    amount: number;
  }[];
  
  createdAt: string;
  updatedAt: string;
}

// Unified Financials dataset
export type FinancialSourceType = 'receipt' | 'statement';

export interface FinancialsRecord {
  id: string;
  // Cruise linkage
  cruiseId: string;
  shipName?: string;
  sailDateStart?: string;
  sailDateEnd?: string;
  itineraryName?: string;
  guestName?: string;
  cabinNumber?: string;
  bookingId?: string;
  reservationNumber?: string;
  // Source metadata
  sourceType: FinancialSourceType;
  sourceFileBaseName?: string;
  sourcePageNumber?: number;
  sourceTotalPages?: number;
  processedAt: string;
  ocrVersion?: string;
  verified: boolean;
  // Currency normalization
  currency?: string;
  // Receipt fields
  receiptId?: string;
  receiptDateTime?: string;
  venue?: string;
  category?: 'Food & Beverage' | 'Retail' | 'Spa' | 'ShoreEx' | 'Casino' | 'Gratuity' | 'Tax/Fees' | 'Other';
  itemDescription?: string;
  quantity?: number;
  unitPrice?: number;
  lineTotal?: number;
  tax?: number;
  gratuity?: number;
  discount?: number;
  paymentMethod?: 'SeaPass' | 'OBC' | 'Credit Card' | 'Promo';
  employeeIdOrServerName?: string;
  folioNumber?: string;
  // Statement fields
  statementId?: string;
  postDate?: string;
  txnType?: 'Charge' | 'Credit' | 'Adjustment';
  description?: string;
  department?: 'Casino' | 'Beverage' | 'Dining' | 'Photo' | 'Spa' | 'Retail' | 'ShoreEx' | 'ServiceFees' | 'Taxes' | 'Gratuities' | 'Other';
  amount?: number;
  balanceAfter?: number;
  onboardCreditApplied?: number;
  statementPaymentMethod?: 'SeaPass' | 'OBC' | 'Credit Card';
  refNumber?: string;
  // Timestamps
  createdAt: string;
  updatedAt: string;
}

// Casino pay table and rewards constants
export interface CasinoRewardsSystem {
  coinInRate: number; // Points per dollar (1 point per $5)
  payTable: CasinoPayTableEntry[];
}

// Hardcoded casino rewards data
export const CASINO_REWARDS: CasinoRewardsSystem = {
  coinInRate: 0.2, // 1 point for every $5 of coin-in
  payTable: [
    {
      offerCode: '2502AVIP2',
      points: 40000,
      reward: 'Variable Category Suite (on select sailings)',
      nextCruiseBonus: 'Variable FreePlay up to $5,000',
      cabinTypes: ['Suite']
    },
    {
      offerCode: '2502A01',
      points: 25000,
      reward: 'Grand Suite (Junior Suite on select sailings)',
      nextCruiseBonus: '$2,500 FreePlay',
      cabinTypes: ['Suite', 'Junior Suite']
    },
    {
      offerCode: '2502A02',
      points: 15000,
      reward: 'Junior Suite',
      nextCruiseBonus: '$1,500 FreePlay',
      cabinTypes: ['Junior Suite']
    },
    {
      offerCode: '2502A02A',
      points: 9000,
      reward: 'Junior Suite or Balcony Stateroom (on select sailings)',
      nextCruiseBonus: '$1,000 FreePlay',
      cabinTypes: ['Junior Suite', 'Balcony']
    },
    {
      offerCode: '2502A03',
      points: 6500,
      reward: 'Balcony Stateroom (Junior Suite on select sailings)',
      nextCruiseBonus: '$750 FreePlay',
      cabinTypes: ['Balcony', 'Junior Suite']
    },
    {
      offerCode: '2502A03A',
      points: 4000,
      reward: 'Balcony or Oceanview Stateroom (on select sailings)',
      nextCruiseBonus: '$500 FreePlay',
      cabinTypes: ['Balcony', 'Oceanview']
    },
    {
      offerCode: '2502A04',
      points: 3000,
      reward: 'Oceanview Stateroom (Balcony on select sailings)',
      nextCruiseBonus: '$250 FreePlay',
      cabinTypes: ['Oceanview', 'Balcony']
    },
    {
      offerCode: '2502A05',
      points: 2000,
      reward: 'Interior or up to Balcony Stateroom (Cruise Fare for One + Discounted Fare for Guest)',
      nextCruiseBonus: '$150 FreePlay',
      cabinTypes: ['Interior', 'Oceanview', 'Balcony']
    },
    {
      offerCode: '2502A06',
      points: 1500,
      reward: 'Interior or up to Balcony Stateroom (Cruise Fare for One + Discounted Fare for Guest)',
      nextCruiseBonus: '$100 FreePlay',
      cabinTypes: ['Interior', 'Oceanview', 'Balcony']
    },
    {
      offerCode: '2502A07',
      points: 1200,
      reward: '$300 Off',
      nextCruiseBonus: 'Same cruise fare discount',
      cabinTypes: ['Interior', 'Oceanview', 'Balcony', 'Suite']
    },
    {
      offerCode: '2502A08',
      points: 800,
      reward: '$250 Off',
      nextCruiseBonus: 'Same cruise fare discount',
      cabinTypes: ['Interior', 'Oceanview', 'Balcony', 'Suite']
    },
    {
      offerCode: '2502A09',
      points: 600,
      reward: '$200 Off',
      nextCruiseBonus: 'Same cruise fare discount',
      cabinTypes: ['Interior', 'Oceanview', 'Balcony', 'Suite']
    },
    {
      offerCode: '2502A10',
      points: 400,
      reward: '$100 Off (Interior Stateroom or Cruise Fare for One + Discounted Fare for Guest)',
      nextCruiseBonus: 'Same cruise fare discount',
      cabinTypes: ['Interior']
    }
  ]
};

// Helper functions for casino calculations
export const calculateCoinInFromPoints = (points: number): number => {
  return points / CASINO_REWARDS.coinInRate;
};

export const calculatePointsFromCoinIn = (coinIn: number): number => {
  return coinIn * CASINO_REWARDS.coinInRate;
};

export const getRewardTierByPoints = (points: number): CasinoPayTableEntry | null => {
  // Find the highest tier the user qualifies for
  const qualifyingTiers = CASINO_REWARDS.payTable.filter(tier => points >= tier.points);
  return qualifyingTiers.length > 0 ? qualifyingTiers[0] : null;
};

export const calculateROI = (totalValueBack: number, netOutOfPocket: number): number => {
  if (netOutOfPocket === 0) return 0;
  return ((totalValueBack - netOutOfPocket) / netOutOfPocket) * 100;
};

export const calculateTotalValueBack = (
  retailPrice: number,
  spaCharges: number,
  internetCharges: number,
  specialtyDiningCharges: number,
  netWinnings: number
): number => {
  return (retailPrice + spaCharges + internetCharges + specialtyDiningCharges) - netWinnings;
};

export const calculateNetOutOfPocket = (
  amountPaid: number,
  winningsBroughtHome: number
): number => {
  return amountPaid - (winningsBroughtHome || 0);
};

// Club Royale helper functions
export const getCurrentTier = (points: number): 'Prime' | 'Signature' | 'Masters' => {
  if (points >= 75000) return 'Masters';
  if (points >= 25000) return 'Signature';
  return 'Prime';
};

export const getNextTier = (currentTier: 'Prime' | 'Signature' | 'Masters'): 'Signature' | 'Masters' | null => {
  if (currentTier === 'Prime') return 'Signature';
  if (currentTier === 'Signature') return 'Masters';
  return null;
};

export const getPointsToNextTier = (points: number): number => {
  const currentTier = getCurrentTier(points);
  if (currentTier === 'Prime') return 25000 - points;
  if (currentTier === 'Signature') return 75000 - points;
  return 0; // Already at Masters
};

export const getTierRequirements = (tier: 'Prime' | 'Signature' | 'Masters'): TierRequirements => {
  return CLUB_ROYALE_TIERS.find(t => t.tier === tier)!;
};

export const calculateValuePerPoint = (totalSavings: number, totalPoints: number): number => {
  if (totalPoints === 0) return 0;
  return totalSavings / totalPoints;
};

export const estimateTierProgressionDate = (
  currentPoints: number,
  averagePointsPerCruise: number,
  cruisesPerYear: number
): string | null => {
  const pointsToNext = getPointsToNextTier(currentPoints);
  if (pointsToNext <= 0) return null;
  
  const cruisesNeeded = Math.ceil(pointsToNext / averagePointsPerCruise);
  const monthsNeeded = Math.ceil(cruisesNeeded / (cruisesPerYear / 12));
  
  const targetDate = new Date();
  targetDate.setMonth(targetDate.getMonth() + monthsNeeded);
  
  return targetDate.toISOString();
};

export const getCertificateByCode = (code: string): CasinoPayTableEntry | null => {
  return CASINO_REWARDS.payTable.find(entry => entry.offerCode === code) || null;
};

export const getAvailableCertificates = (points: number): CasinoPayTableEntry[] => {
  return CASINO_REWARDS.payTable.filter(entry => points >= entry.points);
};

export const calculatePointsResetDate = (): string => {
  const now = new Date();
  const currentYear = now.getFullYear();
  const nextReset = new Date(currentYear + 1, 3, 1); // April 1st next year
  return nextReset.toISOString();
};

/**
 * USER PREFERENCES FOR CRUISE EVALUATION
 * 
 * CABIN PREFERENCES (in order of preference):
 * 1. Suite (highest value)
 * 2. Junior Suite
 * 3. Balcony
 * 4. Oceanview
 * 5. Interior (lowest value)
 * 
 * Note: GTY (Guarantee) cabins are same category but room assignment is made closer to sailing
 * 
 * CRUISE LENGTH PREFERENCES:
 * - Prefer 10-14 night sailings (longer = more gambling time = higher points)
 * - Longer cruises provide better value for time investment
 * 
 * DEPARTURE PORT PREFERENCES (from Phoenix, AZ):
 * 1. Los Angeles (closest)
 * 2. Galveston (second closest)
 * 3. Florida ports (require airfare calculation)
 * 4. Other ports (require airfare + ground transport calculation)
 * 
 * AIRFARE CONSIDERATIONS:
 * - For non-driving ports, calculate estimated airfare from Phoenix (PHX)
 * - Include ground transport from airport to cruise port
 * - Factor into total cruise cost for accurate ROI calculation
 * 
 * VALUE CALCULATION PRIORITIES:
 * - Suite sailing at $5000 > 3-night interior at $500 (time value consideration)
 * - Longer cruises = more casino time = higher point earning potential
 * - Cabin category affects offer value and next cruise bonus potential
 */
export interface UserPreferences {
  homeLocation: {
    city: string; // "Phoenix"
    state: string; // "Arizona"
    airport: string; // "PHX"
  };
  cabinPreferences: {
    preferred: CabinType[]; // ["Suite", "Balcony", "Oceanview", "Interior"]
    acceptGTY: boolean; // true - willing to accept guarantee cabins
  };
  cruiseLengthPreferences: {
    preferred: { min: number; max: number }; // { min: 10, max: 14 }
    acceptable: { min: number; max: number }; // { min: 7, max: 21 }
  };
  departurePortPreferences: {
    drivingDistance: string[]; // ["Los Angeles", "Long Beach", "San Pedro"]
    acceptableFlying: string[]; // ["Galveston", "Fort Lauderdale", "Miami", "Port Canaveral"]
    estimatedAirfare: { [port: string]: number }; // Estimated costs from PHX
  };
  valueCalculation: {
    timeValueWeight: number; // Factor for time investment vs monetary return
    pointsEarningWeight: number; // Importance of casino points earning potential
    cabinUpgradeValue: number; // Value placed on higher cabin categories
  };
}

// Distribute remaining points across other completed cruises
// Total points since April 1st: 12,551
// Known: Harmony (1,200) + Wonder (800) = 2,000
// Remaining: 12,551 - 4,581 (Star) - 2,030 (Navigator) - 2,000 = 3,940 points
// Distributed across other completed cruises

export const DEFAULT_USER_PREFERENCES: UserPreferences = {
  homeLocation: {
    city: "Phoenix",
    state: "Arizona",
    airport: "PHX"
  },
  cabinPreferences: {
    preferred: ["Suite", "Balcony", "Oceanview", "Interior"],
    acceptGTY: true
  },
  cruiseLengthPreferences: {
    preferred: { min: 10, max: 14 },
    acceptable: { min: 7, max: 21 }
  },
  departurePortPreferences: {
    drivingDistance: ["Los Angeles", "Long Beach", "San Pedro", "San Diego"],
    acceptableFlying: ["Galveston", "Fort Lauderdale", "Miami", "Port Canaveral", "Seattle", "Vancouver"],
    estimatedAirfare: {
      "Galveston": 400,
      "Fort Lauderdale": 350,
      "Miami": 350,
      "Port Canaveral": 350,
      "Seattle": 300,
      "Vancouver": 400,
      "New York": 450,
      "Boston": 500,
      "Baltimore": 400
    }
  },
  valueCalculation: {
    timeValueWeight: 0.3,
    pointsEarningWeight: 0.4,
    cabinUpgradeValue: 0.3
  }
};

// Sample data for development - based on user's actual cruise history
export const SAMPLE_CLUB_ROYALE_PROFILE: ClubRoyaleProfile = {
  id: 'user-club-royale-profile',
  totalPoints: 12149,
  currentTier: 'Prime',
  nextTier: 'Signature',
  pointsToNextTier: 12449,
  lifetimePoints: 45000,
  pointsResetDate: '2025-04-01T00:00:00.000Z',
  certificates: [
    {
      id: 'cert-1',
      code: '2508A03A',
      offerType: 'Balcony or Oceanview Stateroom',
      freePlayAmount: 500,
      pointsRequired: 4000,
      earnedDate: '2024-04-15T00:00:00.000Z',
      expirationDate: '2025-04-01T00:00:00.000Z',
      isUsed: false,
      cruiseEarnedOn: 'Star of the Seas'
    },
    {
      id: 'cert-2',
      code: '2508A05',
      offerType: 'Interior or up to Balcony Stateroom',
      freePlayAmount: 150,
      pointsRequired: 2000,
      earnedDate: '2024-06-20T00:00:00.000Z',
      expirationDate: '2025-04-01T00:00:00.000Z',
      isUsed: false,
      cruiseEarnedOn: 'Navigator of the Seas'
    }
  ],
  cruiseHistory: [
    {
      id: 'history-1',
      cruiseId: 'star-of-seas-cruise',
      ship: 'Star of the Seas',
      departureDate: '2024-04-15T00:00:00.000Z',
      pointsEarned: 4581,
      coinIn: 22905,
      actualSavings: 3200,
      valuePerPoint: 0.7,
      certificatesEarned: ['2508A03A'],
      tier: 'Prime'
    },
    {
      id: 'history-2',
      cruiseId: 'navigator-of-seas-cruise',
      ship: 'Navigator of the Seas',
      departureDate: '2025-09-15T00:00:00.000Z',
      pointsEarned: 976,
      coinIn: 4880,
      actualSavings: 589,
      valuePerPoint: 0.60,
      certificatesEarned: [],
      tier: 'Prime',
      notes: 'Completed cruise - Won $589, earned 976 points'
    },
    {
      id: 'history-3',
      cruiseId: 'harmony-of-seas-cruise',
      ship: 'Harmony of the Seas',
      departureDate: '2024-04-10T00:00:00.000Z',
      pointsEarned: 1200,
      coinIn: 6000,
      actualSavings: 950,
      valuePerPoint: 0.79,
      certificatesEarned: [],
      tier: 'Prime'
    },
    {
      id: 'history-4',
      cruiseId: 'wonder-of-seas-cruise',
      ship: 'Wonder of the Seas',
      departureDate: '2024-05-15T00:00:00.000Z',
      pointsEarned: 800,
      coinIn: 4000,
      actualSavings: 600,
      valuePerPoint: 0.75,
      certificatesEarned: [],
      tier: 'Prime'
    }
  ],
  valuePerPoint: 0.76,
  projectedTierDate: '2025-08-15T00:00:00.000Z',
  createdAt: '2024-01-01T00:00:00.000Z',
  updatedAt: new Date().toISOString()
};

// Unified cruise view model to be used across cards (offers, booked, scheduling, analytics)
export interface UnifiedCruise {
  id: string;
  ship: string;
  itineraryName: string;
  departurePort?: string;
  departureDate?: string | null;
  returnDate?: string | null;
  nights?: number | null;
  status?: 'upcoming' | 'in-progress' | 'completed' | 'available' | 'on_sale' | 'sold_out' | 'canceled';
  cabinType?: string | null;
  guests?: number | null;
  reservationNumber?: string | null;
  offerCode?: string | null;
  offerName?: string | null;
  offerExpireDate?: string | null;
  value?: string | null;
  source: 'cruises' | 'booked' | 'offers' | 'calendar' | 'analytics';
  portsRoute?: string | null;
  retailInteriorPrice?: number | null;
  departureLabel?: string | null;
  imageUrl?: string | null;
}

// ============================================================================
// PHASE 1: CONTEXT AWARENESS FOUNDATIONS
// ============================================================================

/**
 * Player Context: Represents the current state and behavior patterns of the player
 */
export interface PlayerContext {
  id: string;
  userId: string;
  
  // Tier & Pace
  currentTier: 'Prime' | 'Signature' | 'Masters';
  currentPoints: number;
  pointsToNextTier: number;
  averagePointsPerCruise: number;
  cruisesPerYear: number;
  projectedTierDate: string | null;
  
  // Play Patterns
  preferredCabinTypes: CabinType[];
  averageCoinInPerNight: number;
  averageROI: number;
  totalCruisesCompleted: number;
  
  // Financial Profile
  totalSpent: number;
  totalSavings: number;
  netPosition: number; // totalSavings - totalSpent
  
  // Confidence Scores (0-1)
  dataQuality: number; // How complete is the data
  predictionConfidence: number; // How reliable are predictions
  
  lastUpdated: string;
}

/**
 * Ship Context: Profitability and performance metrics for a specific ship
 */
export interface ShipContext {
  id: string;
  shipName: string;
  
  // Historical Performance
  averagePointsEarned: number;
  averageROI: number;
  totalCruisesTracked: number;
  
  // Profitability Signals
  profitabilityScore: number; // 0-100, higher = better for player
  averageSavings: number;
  averageCostPerPoint: number;
  
  // Patterns
  bestCabinType: CabinType | null;
  bestSeasonMonths: number[]; // [1-12]
  
  // Confidence
  dataQuality: number;
  
  lastUpdated: string;
}

/**
 * Offer Context: ROI signals and value analysis for casino offers
 */
export interface OfferContext {
  id: string;
  offerId: string;
  offerCode: string;
  
  // Value Signals
  estimatedValue: number;
  pointsRequired: number;
  freePlayAmount: number;
  cabinUpgradeValue: number;
  
  // ROI Metrics
  estimatedROI: number;
  costPerPoint: number;
  valuePerPoint: number;
  breakEvenCoinIn: number;
  
  // Comparison
  rankAmongOffers: number; // 1 = best
  totalOffersCompared: number;
  
  // Match Score
  playerMatchScore: number; // 0-100, how well this matches player profile
  
  // Confidence
  dataQuality: number;
  
  lastUpdated: string;
}

/**
 * Cruise Context: Combined context for a specific cruise opportunity
 */
export interface CruiseContext {
  id: string;
  cruiseId: string;
  
  // Related Contexts
  shipContext: ShipContext | null;
  applicableOffers: OfferContext[];
  
  // Opportunity Signals
  opportunityScore: number; // 0-100, overall attractiveness
  estimatedPointsEarnable: number;
  estimatedROI: number;
  estimatedSavings: number;
  
  // Timing
  daysUntilDeparture: number;
  isOptimalTiming: boolean;
  
  // Conflicts
  hasScheduleConflict: boolean;
  conflictingCruiseIds: string[];
  
  // Recommendations
  recommendationLevel: 'high' | 'medium' | 'low' | 'avoid';
  recommendationReasons: string[];
  
  lastUpdated: string;
}

/**
 * Context Intelligence Card: UI-ready context summary
 */
export interface ContextCard {
  id: string;
  type: 'player' | 'ship' | 'offer' | 'cruise' | 'alert';
  title: string;
  subtitle: string;
  
  // Primary Metric
  primaryValue: string;
  primaryLabel: string;
  primaryTrend?: 'up' | 'down' | 'stable';
  
  // Secondary Metrics
  metrics: Array<{
    label: string;
    value: string;
    trend?: 'up' | 'down' | 'stable';
  }>;
  
  // Visual
  color: 'success' | 'warning' | 'error' | 'info' | 'neutral';
  icon?: string;
  
  // Actions
  actions?: Array<{
    label: string;
    action: string;
    params?: Record<string, any>;
  }>;
  
  // Metadata
  priority: number; // Higher = more important
  expiresAt?: string;
  createdAt: string;
}