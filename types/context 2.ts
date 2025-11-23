export interface PlayerContext {
  tier: 'Diamond' | 'Diamond Plus' | 'Diamond Elite';
  currentPoints: number;
  pointsToNextTier: number;
  cruisePace: number;
  avgSpendPerCruise: number;
  totalCruises: number;
  completedCruises: number;
  upcomingCruises: number;
  lastCruiseDate?: string;
  nextCruiseDate?: string;
}

export interface ShipContext {
  ship: string;
  totalCruises: number;
  avgROI: number;
  avgFreePlay: number;
  avgWin: number;
  profitability: 'high' | 'medium' | 'low';
  lastSailed?: string;
}

export interface OfferContext {
  offerId: string;
  title: string;
  freePlay: number;
  estimatedValue: number;
  expiryDate: string;
  daysUntilExpiry: number;
  applicableShips: string[];
  roiSignal: 'strong' | 'moderate' | 'weak';
}

export interface ContextIntelligence {
  player: PlayerContext;
  topShips: ShipContext[];
  activeOffers: OfferContext[];
  insights: string[];
  timestamp: string;
}
