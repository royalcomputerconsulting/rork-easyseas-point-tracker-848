// Static cruise data from screenshot - this will be the source of truth
export interface CruiseData {
  id: string;
  ship: string;
  sailDate: string;
  bookingNumber: string;
  stateroom: string;
  gaming: number;
  casino: number;
  dining: number;
  beverages: number;
  spa: number;
  shopping: number;
  internet: number;
  services: number;
  entertainment: number;
  taxes: number;
  credits: number;
  totalCharges: number;
  payment: number;
  balance: number;
}

export interface PointsData {
  ship: string;
  sailDate: string;
  points: number;
  winnings: number;
}

// Data from your screenshot
export const CRUISE_DATA: CruiseData[] = [
  {
    id: '7871133',
    ship: 'Wonder of the Seas',
    sailDate: '03/09/2025',
    bookingNumber: '7871133',
    stateroom: '5711',
    gaming: 2210,
    casino: 200.59,
    dining: 57.21,
    beverages: 202.8,
    spa: 110,
    shopping: 0,
    internet: 129.5,
    services: 0,
    entertainment: 0,
    taxes: -150,
    credits: 2952.1,
    totalCharges: 2952.1,
    payment: -2952.1,
    balance: 0
  },
  {
    id: '2501764',
    ship: 'Harmony of the Seas',
    sailDate: '04/20/2025',
    bookingNumber: '2501764',
    stateroom: '12729',
    gaming: 2192,
    casino: 108.49,
    dining: 84.7,
    beverages: 0,
    spa: 0,
    shopping: 149.95,
    internet: 157,
    services: 0,
    entertainment: 0,
    taxes: 0,
    credits: 2884.9,
    totalCharges: 2884.9,
    payment: -2884.9,
    balance: 0
  },
  {
    id: '236930',
    ship: 'Ovation of the Seas',
    sailDate: '07/29/2025',
    bookingNumber: '236930',
    stateroom: '16556',
    gaming: 600,
    casino: 0,
    dining: 24.88,
    beverages: 0,
    spa: 0,
    shopping: 26.99,
    internet: 55.5,
    services: 0,
    entertainment: 5,
    taxes: 0,
    credits: 714.03,
    totalCharges: 714.03,
    payment: -714.03,
    balance: 0
  },
  {
    id: '6242276',
    ship: 'Navigator of the Seas',
    sailDate: '08/01/2025',
    bookingNumber: '6242276',
    stateroom: '9234',
    gaming: 140,
    casino: 0,
    dining: 53.12,
    beverages: 212.36,
    spa: 0,
    shopping: 25.99,
    internet: -0.5,
    services: 0,
    entertainment: 5,
    taxes: 0,
    credits: 415.8,
    totalCharges: 415.8,
    payment: -415.8,
    balance: 0
  },
  {
    id: '2665774',
    ship: 'Star of the Seas',
    sailDate: '08/27/2025',
    bookingNumber: '2665774',
    stateroom: '10187',
    gaming: 2951,
    casino: 76.7,
    dining: 52.25,
    beverages: 0,
    spa: 33.99,
    shopping: 59.48,
    internet: 14.99,
    services: 39.99,
    entertainment: 0,
    taxes: -25,
    credits: 3242.96,
    totalCharges: 3242.96,
    payment: -3242.96,
    balance: 0
  },
  {
    id: '5156149',
    ship: 'Navigator of the Seas',
    sailDate: '09/08/2025',
    bookingNumber: '5156149',
    stateroom: '5639',
    gaming: 1443,
    casino: 0,
    dining: 25.97,
    beverages: 71.64,
    spa: 0,
    shopping: 39.19,
    internet: 0,
    services: 0,
    entertainment: 5,
    taxes: 0,
    credits: 1685.79,
    totalCharges: 1685.79,
    payment: -1685.79,
    balance: 0
  },
  {
    id: '5207254',
    ship: 'Navigator of the Seas',
    sailDate: '09/15/2025',
    bookingNumber: '5207254',
    stateroom: '8511',
    gaming: 878,
    casino: 0,
    dining: 0,
    beverages: 0,
    spa: 65,
    shopping: 39.19,
    internet: 0,
    services: 0,
    entertainment: 5,
    taxes: 0,
    credits: 1187.19,
    totalCharges: 1187.19,
    payment: -1187.19,
    balance: 0
  },
  {
    id: '7936829',
    ship: 'Radiance of the Seas',
    sailDate: '09/26/2025',
    bookingNumber: '7936829',
    stateroom: 'TBD',
    gaming: 1009,
    casino: 0,
    dining: 0,
    beverages: 0,
    spa: 0,
    shopping: 0,
    internet: 0,
    services: 0,
    entertainment: 0,
    taxes: 0,
    credits: 1800,
    totalCharges: 1800,
    payment: -1800,
    balance: 0
  }
];

// Points & Winnings data from your screenshot
export const POINTS_DATA: PointsData[] = [
  { ship: 'Navigator', sailDate: 'Sep 15, 2025', points: 817, winnings: 100 },
  { ship: 'Navigator', sailDate: 'Sep 8, 2025', points: 976, winnings: 189 },
  { ship: 'Star', sailDate: 'Aug 27, 2025', points: 4581, winnings: 700 },
  { ship: 'Harmony', sailDate: 'Apr 20, 2025', points: 2030, winnings: 2100 },
  { ship: 'Ovation', sailDate: 'Jul 29, 2025', points: 317, winnings: 0 },
  { ship: 'Quantum', sailDate: 'Oct 22, 2025', points: 1430, winnings: 500 },
  { ship: 'Wonder', sailDate: 'Mar 9, 2025', points: 2030, winnings: 1300 },
  { ship: 'Radiance', sailDate: 'Sep 26, 2025', points: 1009, winnings: 780 }
];

// Calculate totals
export const TOTALS = {
  totalPoints: POINTS_DATA.reduce((sum, p) => sum + p.points, 0), // Should be 13190 (includes Radiance 1009)
  totalWinnings: POINTS_DATA.reduce((sum, p) => sum + p.winnings, 0),
  totalCruises: CRUISE_DATA.length, // 8 cruises with data
  totalGaming: CRUISE_DATA.reduce((sum, c) => sum + c.gaming, 0),
  totalCredits: CRUISE_DATA.reduce((sum, c) => sum + c.credits, 0)
};