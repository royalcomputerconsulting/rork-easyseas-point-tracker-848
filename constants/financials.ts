import { StyleSheet } from 'react-native';

export type OfferCode = string;

export interface RewardTier {
  code: OfferCode;
  pointsRequired: number;
  coinInRequired: number;
  reward: string;
  freePlayMax?: number;
}

export interface ConversionRules {
  pointPerCoinIn: number;
}

export const CONVERSIONS: ConversionRules = {
  pointPerCoinIn: 5,
};

export const OFFER_CODE_ALIASES: Record<string, string> = {
  '2508': '2502',
};

export const MARKETING_CODE_REGEX = /25[A-Z]{3}\d{3}/i;

export function isMarketingCode(code: string | undefined): boolean {
  if (!code) return false;
  return MARKETING_CODE_REGEX.test(code);
}

export function normalizeOfferCode(code: string | undefined): string | undefined {
  if (!code) return undefined;
  const prefix = code.slice(0, 4);
  const mapped = OFFER_CODE_ALIASES[prefix];
  if (mapped) return mapped + code.slice(4);
  return code;
}

export const CASINO_PAY_TABLE: RewardTier[] = [
  { code: '2502AVIP2', pointsRequired: 40000, coinInRequired: 200000, reward: 'Variable Suite + up to $5,000 FP', freePlayMax: 5000 },
  { code: '2502A01', pointsRequired: 25000, coinInRequired: 125000, reward: 'Grand Suite (or Jr Suite select) + $2,500 FP', freePlayMax: 2500 },
  { code: '2502A02', pointsRequired: 15000, coinInRequired: 75000, reward: 'Junior Suite + $1,500 FP', freePlayMax: 1500 },
  { code: '2502A02A', pointsRequired: 9000, coinInRequired: 45000, reward: 'Jr Suite or Balcony + $1,000 FP', freePlayMax: 1000 },
  { code: '2502A03', pointsRequired: 6500, coinInRequired: 32500, reward: 'Balcony (or Jr Suite select) + $750 FP', freePlayMax: 750 },
  { code: '2502A03A', pointsRequired: 4000, coinInRequired: 20000, reward: 'Balcony or Oceanview + $500 FP', freePlayMax: 500 },
  { code: '2502A04', pointsRequired: 3000, coinInRequired: 15000, reward: 'Oceanview (or Balcony select) + $250 FP', freePlayMax: 250 },
  { code: '2502A05', pointsRequired: 2000, coinInRequired: 10000, reward: 'Interior/Balcony 1+1 comp guest + $150 FP', freePlayMax: 150 },
  { code: '2502A06', pointsRequired: 1500, coinInRequired: 7500, reward: 'Interior/Balcony 1+1 comp guest + $100 FP', freePlayMax: 100 },
  { code: '2502A07', pointsRequired: 1200, coinInRequired: 6000, reward: '$300 Off' },
  { code: '2502A08', pointsRequired: 800, coinInRequired: 4000, reward: '$250 Off' },
  { code: '2502A09', pointsRequired: 600, coinInRequired: 3000, reward: '$200 Off' },
  { code: '2502A10', pointsRequired: 400, coinInRequired: 2000, reward: '$100 Off' },
];

export function getRewardForPoints(points: number): RewardTier | undefined {
  const sorted = [...CASINO_PAY_TABLE].sort((a, b) => b.pointsRequired - a.pointsRequired);
  return sorted.find(t => points >= t.pointsRequired);
}

export function pointsFromCoinIn(coinIn: number): number {
  const pts = Math.floor((coinIn ?? 0) / CONVERSIONS.pointPerCoinIn);
  return pts < 0 ? 0 : pts;
}

// Financial Categories
export const FINANCIAL_CATEGORIES = {
  // Receipt Categories
  DINING: 'Dining',
  BEVERAGES: 'Beverages', 
  SPA: 'Spa',
  GAMING: 'Gaming',
  SERVICES: 'Services',
  INTERNET: 'Internet/Communications',
  MISC: 'Misc',
  REFUND_SERVICES: 'Refund - Services',
  REFUND_BEVERAGES: 'Refund - Beverages',
  
  // Statement Categories
  TAXES: 'Taxes',
  GRATUITIES: 'Gratuities',
  CASINO_BAR: 'Casino Bar',
  POOL_BAR: 'Pool Bar',
  CLUB_ROYALE: 'Club Royale Entertainment Games',
  ONBOARD_GRATUITIES: 'Onboard Gratuities',
  MEXICAN_RESIDENT_TAX: 'Mexican-Resident Tax'
} as const;

export const CRUISE_SHIPS = [
  'Wonder of the Seas',
  'Navigator of the Seas', 
  'Radiance of the Seas',
  'Liberty of the Seas',
  'Quantum of the Seas',
  'Star of the Seas',
  'Harmony of the Seas',
  'Ovation of the Seas'
] as const;

// Financial Database Structure Types
export interface CruiseReceipt {
  reservationId: string;
  ship: string;
  sailingDate: string;
  departureDate: string;
  nights: number;
  itinerary: string;
  stateroom: string;
  guests: string;
  crownAnchorNumber?: string;
  offerCode?: string;
  cruiseFare: number;
  casinoComp: number;
  otherDiscounts: number;
  taxesFees: number;
  totalCharge: number;
  amountPaid: number;
  balanceDue: number;
}

export interface StatementSummary {
  bookingNumber: string;
  ship: string;
  sailingDate: string;
  stateroom: string;
  totalCharges: number;
  totalPayments: number;
  balanceDue: number;
}

export interface StatementLineItem {
  bookingNumber: string;
  ship: string;
  sailingDate: string;
  txnDate: string;
  category: string;
  checkNumber?: string;
  description: string;
  amount: number;
  paymentMethod?: string;
}

export interface MergedFinancialView {
  reservationId?: string;
  bookingNumber?: string;
  ship: string;
  sailingDate: string;
  cruiseFare?: number;
  casinoComp?: number;
  taxesFees?: number;
  onboardCharges?: number;
  totalSpend: number;
  freePlayOffers?: number;
  outOfPocketPaid: number;
  roi?: number;
  valuePerPoint?: number;
}

export const FINANCIAL_SAMPLE_DATA = {
  cruises: [
    {
      reservationId: '7871133',
      ship: 'Wonder of the Seas',
      sailingDate: '03/09/2025',
      departureDate: '03/09/2025',
      nights: 7,
      itinerary: '7 NIGHT W 4Y 12553',
      stateroom: 'Interior',
      guests: 'Scott Merl C# TARGETED OFFER(2FILTER3)',
      crownAnchorNumber: '',
      offerCode: 'WELCOME TO CLUB ROYALE(25WCP06)',
      cruiseFare: 3878,
      casinoComp: -2212,
      otherDiscounts: -1666,
      taxesFees: 160.55,
      totalCharge: 321.1,
      amountPaid: 321.1,
      balanceDue: 0
    },
    {
      reservationId: '5207254',
      ship: 'Navigator of the Seas',
      sailingDate: '09/15/2025',
      departureDate: '09/15/2025', 
      nights: 6,
      itinerary: '6 NIGHT C4 4Y 9531',
      stateroom: 'Interior',
      guests: 'Scott Merl C# TARGETED OFFER(2FILTER3)',
      crownAnchorNumber: '',
      offerCode: 'WELCOME TO CLUB ROYALE(25WCP06)',
      cruiseFare: 960,
      casinoComp: -548,
      otherDiscounts: -412,
      taxesFees: 127.17,
      totalCharge: 127.17,
      amountPaid: 127.17,
      balanceDue: 0
    },
    {
      reservationId: '7836829',
      ship: 'Radiance of the Seas',
      sailingDate: '09/26/2025',
      departureDate: '09/26/2025',
      nights: 8,
      itinerary: '8 NIGHT PA 2Y 3583',
      stateroom: 'Interior',
      guests: 'Scott Merl C# TARGETED OFFER(25PA206)',
      crownAnchorNumber: '',
      offerCode: 'WELCOME TO CLUB ROYALE(25WCP06)',
      cruiseFare: 1262,
      casinoComp: -912,
      otherDiscounts: -350,
      taxesFees: 296.42,
      totalCharge: 296.42,
      amountPaid: 296.42,
      balanceDue: 0
    }
  ] as CruiseReceipt[],
  statements: [
    {
      bookingNumber: '6242276',
      ship: 'Navigator of the Seas',
      sailingDate: '08/01/2025',
      stateroom: '9234',
      totalCharges: 415.8,
      totalPayments: 415.8,
      balanceDue: 0
    },
    {
      bookingNumber: '2665774',
      ship: 'Star of the Seas',
      sailingDate: '08/27/2025',
      stateroom: '10187',
      totalCharges: 415.8,
      totalPayments: 415.8,
      balanceDue: 0
    },
    {
      bookingNumber: '236930',
      ship: 'Ovation of the Seas',
      sailingDate: '07/29/2025',
      stateroom: '10556',
      totalCharges: 714.03,
      totalPayments: 714.03,
      balanceDue: 0
    }
  ] as StatementSummary[],
  lineItems: [
    {
      bookingNumber: '6242276',
      ship: 'Navigator of the Seas',
      sailingDate: '08/01/2025',
      txnDate: '8/1',
      category: 'SPA',
      checkNumber: '59917318',
      description: 'SPA/SALON',
      amount: -192.36
    },
    {
      bookingNumber: '6242276', 
      ship: 'Navigator of the Seas',
      sailingDate: '08/01/2025',
      txnDate: '8/1',
      category: 'GAMING',
      checkNumber: '0A422778',
      description: 'CLUB ROYALE ENTERTAINMENT GAMES',
      amount: 100
    },
    {
      bookingNumber: '236930',
      ship: 'Ovation of the Seas',
      sailingDate: '07/29/2025',
      txnDate: '7/29',
      category: 'BEVERAGES',
      checkNumber: '7010632',
      description: 'POOL BAR',
      amount: 7.07
    },
    {
      bookingNumber: '236930',
      ship: 'Ovation of the Seas',
      sailingDate: '07/29/2025',
      txnDate: '7/29',
      category: 'GAMING',
      checkNumber: '0A3818698',
      description: 'CLUB ROYALE ENTERTAINMENT GAMES',
      amount: 60
    }
  ] as StatementLineItem[]
};

export const financialsStyles = StyleSheet.create({
  badge: {
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 12,
    backgroundColor: '#EEF2FF',
  },
});
