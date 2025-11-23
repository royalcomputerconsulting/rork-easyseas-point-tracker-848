import type { CasinoOffer } from '@/types/models';

export interface StaticCasinoOffer extends CasinoOffer {
  perks?: string[];
  dateWindow?: string;
  featured?: boolean;
}

const nowIso = new Date().toISOString();

export const STATIC_OFFERS: StaticCasinoOffer[] = [
  {
    id: 'offer-2510C08',
    name: 'Featured Offer',
    rewardNumber: '2510C08',
    offerName: '2025 October Instant Rewards',
    offerType: '$250 Off Your Choice of Room',
    expires: '2025-11-03T23:59:59.000Z',
    offerCode: '2510C08',
    tradeInValue: '$250',
    createdAt: nowIso,
    updatedAt: nowIso,
    featured: true,
    dateWindow: 'Oct 01, 2025 - Oct 01, 2026',
    perks: ['$250 off any room'],
    ships: ['Quantum of the Seas', 'Oasis of the Seas', 'Symphony of the Seas', 'Harmony of the Seas', 'Wonder of the Seas', 'Navigator of the Seas', 'Radiance of the Seas', 'Ovation of the Seas', 'Liberty of the Seas', 'Star of the Seas'],
    offerStartDate: '2025-10-01',
    offerEndDate: '2026-10-01'
  },
  {
    id: 'offer-2509A07',
    name: 'Instant Rewards',
    rewardNumber: '2509A07',
    offerName: '2025 September Instant Rewards',
    offerType: '$300 Off Your Choice of Room',
    expires: '2025-10-19T23:59:59.000Z',
    offerCode: '2509A07',
    tradeInValue: '$300',
    createdAt: nowIso,
    updatedAt: nowIso,
    dateWindow: 'Sep 01, 2025 - Sep 01, 2026',
    perks: ['$300 off any room'],
    ships: ['Quantum of the Seas', 'Oasis of the Seas', 'Symphony of the Seas', 'Harmony of the Seas', 'Wonder of the Seas', 'Navigator of the Seas', 'Radiance of the Seas', 'Ovation of the Seas', 'Liberty of the Seas', 'Star of the Seas'],
    offerStartDate: '2025-09-01',
    offerEndDate: '2026-09-01'
  },
  {
    id: 'offer-25VAR903',
    name: 'Winter Winners',
    rewardNumber: '25VAR903',
    offerName: 'Winter Winners',
    offerType: 'Balcony or Interior Room for Two',
    expires: '2025-10-18T23:59:59.000Z',
    offerCode: '25VAR903',
    tradeInValue: '$475',
    createdAt: nowIso,
    updatedAt: nowIso,
    perks: ['Balcony for two', 'Interior option for two'],
    ships: ['Quantum of the Seas', 'Oasis of the Seas', 'Symphony of the Seas', 'Harmony of the Seas', 'Wonder of the Seas', 'Navigator of the Seas', 'Radiance of the Seas', 'Ovation of the Seas', 'Liberty of the Seas', 'Star of the Seas'],
    offerStartDate: '2025-10-01',
    offerEndDate: '2025-12-31'
  },
  {
    id: 'offer-25PER402',
    name: 'Bold Buy-Ins',
    rewardNumber: '25PER402',
    offerName: 'Bold Buy-Ins',
    offerType: 'Balcony, Ocean View, or Interior Room for Two',
    expires: '2025-10-18T23:59:59.000Z',
    offerCode: '25PER402',
    tradeInValue: '$0',
    createdAt: nowIso,
    updatedAt: nowIso,
    perks: ['Balcony for two', 'Ocean View for two', 'Interior for two'],
    ships: ['Quantum of the Seas', 'Oasis of the Seas', 'Symphony of the Seas', 'Harmony of the Seas', 'Wonder of the Seas', 'Navigator of the Seas', 'Radiance of the Seas', 'Ovation of the Seas', 'Liberty of the Seas', 'Star of the Seas'],
    offerStartDate: '2025-10-01',
    offerEndDate: '2026-03-31'
  },
  {
    id: 'offer-25LVA303',
    name: 'Hot Streak Holiday',
    rewardNumber: '25LVA303',
    offerName: 'Hot Streak Holiday',
    offerType: 'Balcony or Oceanview Room for Two',
    expires: '2025-10-29T23:59:59.000Z',
    offerCode: '25LVA303',
    tradeInValue: '$375',
    createdAt: nowIso,
    updatedAt: nowIso,
    perks: ['Balcony for two', 'Oceanview for two'],
    ships: ['Quantum of the Seas', 'Oasis of the Seas', 'Symphony of the Seas', 'Harmony of the Seas', 'Wonder of the Seas', 'Navigator of the Seas', 'Radiance of the Seas', 'Ovation of the Seas', 'Liberty of the Seas', 'Star of the Seas'],
    offerStartDate: '2025-10-01',
    offerEndDate: '2026-02-28'
  },
  {
    id: 'offer-25EMV604',
    name: 'Variety Spread',
    rewardNumber: '25EMV604',
    offerName: 'Variety Spread',
    offerType: 'Balcony or Ocean View Room for Two',
    expires: '2025-11-06T23:59:59.000Z',
    offerCode: '25EMV604',
    tradeInValue: '$350',
    createdAt: nowIso,
    updatedAt: nowIso,
    perks: ['Balcony for two', 'Ocean View for two'],
    ships: ['Quantum of the Seas', 'Oasis of the Seas', 'Symphony of the Seas', 'Harmony of the Seas', 'Wonder of the Seas', 'Navigator of the Seas', 'Radiance of the Seas', 'Ovation of the Seas', 'Liberty of the Seas', 'Star of the Seas'],
    offerStartDate: '2025-11-01',
    offerEndDate: '2026-05-31'
  },
  {
    id: 'offer-25DEC105',
    name: 'December Deal In',
    rewardNumber: '25DEC105',
    offerName: 'December Deal In',
    offerType: 'Balcony or Interior Room for Two',
    expires: '2025-11-08T23:59:59.000Z',
    offerCode: '25DEC105',
    tradeInValue: '$0',
    createdAt: nowIso,
    updatedAt: nowIso,
    perks: ['Balcony for two', 'Interior for two'],
    ships: ['Quantum of the Seas', 'Oasis of the Seas', 'Symphony of the Seas', 'Harmony of the Seas', 'Wonder of the Seas', 'Navigator of the Seas', 'Radiance of the Seas', 'Ovation of the Seas', 'Liberty of the Seas', 'Star of the Seas'],
    offerStartDate: '2025-12-01',
    offerEndDate: '2026-06-30'
  }
];
