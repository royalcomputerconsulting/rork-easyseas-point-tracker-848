import type { UnifiedCruise } from '@/types/models';

export interface CelebrityCruise extends UnifiedCruise {
  cruiseLine: 'Celebrity';
}

export const CELEBRITY_CRUISES: Partial<CelebrityCruise>[] = [
  {
    id: 'celeb-cruise-001',
    ship: 'Celebrity Edge',
    departureDate: '2026-01-15',
    returnDate: '2026-01-22',
    nights: 7,
    itineraryName: 'Eastern Caribbean',
    departurePort: 'Fort Lauderdale, FL',
    cruiseLine: 'Celebrity',
  },
  {
    id: 'celeb-cruise-002',
    ship: 'Celebrity Apex',
    departureDate: '2026-02-10',
    returnDate: '2026-02-20',
    nights: 10,
    itineraryName: 'Mediterranean',
    departurePort: 'Barcelona, Spain',
    cruiseLine: 'Celebrity',
  },
  {
    id: 'celeb-cruise-003',
    ship: 'Celebrity Beyond',
    departureDate: '2026-03-05',
    returnDate: '2026-03-15',
    nights: 10,
    itineraryName: 'Greek Isles',
    departurePort: 'Rome (Civitavecchia), Italy',
    cruiseLine: 'Celebrity',
  },
  {
    id: 'celeb-cruise-004',
    ship: 'Celebrity Millennium',
    departureDate: '2026-04-20',
    returnDate: '2026-04-27',
    nights: 7,
    itineraryName: 'Alaska Inside Passage',
    departurePort: 'Seattle, WA',
    cruiseLine: 'Celebrity',
  },
  {
    id: 'celeb-cruise-005',
    ship: 'Celebrity Solstice',
    departureDate: '2026-05-15',
    returnDate: '2026-05-29',
    nights: 14,
    itineraryName: 'Hawaii & French Polynesia',
    departurePort: 'Honolulu, HI',
    cruiseLine: 'Celebrity',
  },
  {
    id: 'celeb-cruise-006',
    ship: 'Celebrity Equinox',
    departureDate: '2026-06-10',
    returnDate: '2026-06-17',
    nights: 7,
    itineraryName: 'Bermuda',
    departurePort: 'Cape Liberty, NJ',
    cruiseLine: 'Celebrity',
  },
];
