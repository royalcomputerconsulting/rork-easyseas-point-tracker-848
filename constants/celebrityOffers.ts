import type { CasinoOffer } from '@/types/models';

export interface CelebrityOffer extends CasinoOffer {
  perks?: string[];
  dateWindow?: string;
  featured?: boolean;
  cruiseLine: 'Celebrity';
}

const nowIso = new Date().toISOString();

export const CELEBRITY_OFFERS: CelebrityOffer[] = [
  {
    id: 'celeb-offer-CEL001',
    name: 'Blue Chip Welcome',
    rewardNumber: 'CEL001',
    offerName: 'Blue Chip Welcome Reward',
    offerType: '$200 Off Your Choice of Room',
    expires: '2025-12-31T23:59:59.000Z',
    offerCode: 'CEL001',
    tradeInValue: '$200',
    createdAt: nowIso,
    updatedAt: nowIso,
    cruiseLine: 'Celebrity',
    featured: true,
    dateWindow: 'Nov 01, 2025 - Nov 01, 2026',
    perks: ['$200 off any room', 'Priority boarding'],
    ships: ['Celebrity Edge', 'Celebrity Apex', 'Celebrity Beyond', 'Celebrity Millennium'],
    offerStartDate: '2025-11-01',
    offerEndDate: '2026-11-01'
  },
  {
    id: 'celeb-offer-CEL002',
    name: 'Onyx Exclusive',
    rewardNumber: 'CEL002',
    offerName: 'Onyx Member Exclusive',
    offerType: 'Balcony or Interior Room for Two',
    expires: '2026-01-15T23:59:59.000Z',
    offerCode: 'CEL002',
    tradeInValue: '$350',
    createdAt: nowIso,
    updatedAt: nowIso,
    cruiseLine: 'Celebrity',
    dateWindow: 'Dec 01, 2025 - Jun 01, 2026',
    perks: ['Balcony for two', 'Interior for two', '$100 onboard credit'],
    ships: ['Celebrity Edge', 'Celebrity Apex', 'Celebrity Beyond', 'Celebrity Millennium', 'Celebrity Solstice'],
    offerStartDate: '2025-12-01',
    offerEndDate: '2026-06-01'
  },
  {
    id: 'celeb-offer-CEL003',
    name: 'Sapphire Getaway',
    rewardNumber: 'CEL003',
    offerName: 'Sapphire Level Getaway',
    offerType: '$400 Off Balcony Room',
    expires: '2026-02-28T23:59:59.000Z',
    offerCode: 'CEL003',
    tradeInValue: '$400',
    createdAt: nowIso,
    updatedAt: nowIso,
    cruiseLine: 'Celebrity',
    dateWindow: 'Jan 01, 2026 - Jul 01, 2026',
    perks: ['$400 off balcony', 'Free WiFi for 1 device', '$150 spa credit'],
    ships: ['Celebrity Edge', 'Celebrity Apex', 'Celebrity Beyond', 'Celebrity Equinox'],
    offerStartDate: '2026-01-01',
    offerEndDate: '2026-07-01'
  },
  {
    id: 'celeb-offer-CEL004',
    name: 'Ruby Rewards',
    rewardNumber: 'CEL004',
    offerName: 'Ruby Elite Rewards',
    offerType: 'Junior Suite for Two',
    expires: '2026-03-31T23:59:59.000Z',
    offerCode: 'CEL004',
    tradeInValue: '$600',
    createdAt: nowIso,
    updatedAt: nowIso,
    cruiseLine: 'Celebrity',
    dateWindow: 'Feb 01, 2026 - Aug 01, 2026',
    perks: ['Junior suite for two', 'Premium beverage package', '$200 onboard credit'],
    ships: ['Celebrity Edge', 'Celebrity Apex', 'Celebrity Beyond'],
    offerStartDate: '2026-02-01',
    offerEndDate: '2026-08-01'
  },
  {
    id: 'celeb-offer-CEL005',
    name: 'Diamond Experience',
    rewardNumber: 'CEL005',
    offerName: 'Diamond VIP Experience',
    offerType: 'Grand Suite for Two',
    expires: '2026-06-30T23:59:59.000Z',
    offerCode: 'CEL005',
    tradeInValue: '$1000',
    createdAt: nowIso,
    updatedAt: nowIso,
    cruiseLine: 'Celebrity',
    dateWindow: 'Mar 01, 2026 - Dec 01, 2026',
    perks: ['Grand suite for two', 'All-inclusive beverage package', 'Complimentary gratuities', '$500 onboard credit'],
    ships: ['Celebrity Edge', 'Celebrity Apex', 'Celebrity Beyond', 'Celebrity Millennium', 'Celebrity Solstice', 'Celebrity Equinox'],
    offerStartDate: '2026-03-01',
    offerEndDate: '2026-12-01'
  },
];
