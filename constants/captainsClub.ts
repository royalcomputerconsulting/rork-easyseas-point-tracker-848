export interface LoyaltyLevel {
  name: string;
  minPoints: number;
  maxPoints: number;
  color: string;
  gradientStart: string;
  gradientEnd: string;
  description: string;
  benefits: string[];
}

export const CAPTAINS_CLUB_LEVELS: Record<string, LoyaltyLevel> = {
  CLASSIC: {
    name: 'Classic',
    minPoints: 0,
    maxPoints: 4,
    color: '#9CA3AF',
    gradientStart: '#9CA3AF',
    gradientEnd: '#6B7280',
    description: 'Welcome to Celebrity Captain\'s Club! Start your journey with exclusive benefits.',
    benefits: [
      'Priority check-in',
      'Exclusive Captain\'s Club events',
      'Special offers and promotions',
    ],
  },
  SELECT: {
    name: 'Select',
    minPoints: 5,
    maxPoints: 9,
    color: '#3B82F6',
    gradientStart: '#3B82F6',
    gradientEnd: '#2563EB',
    description: 'Select members enjoy enhanced benefits and recognition.',
    benefits: [
      'All Classic benefits',
      'Priority boarding',
      'Complimentary specialty dining for 2',
      'Behind-the-scenes ship tour',
      'Exclusive Captain\'s Club pin',
    ],
  },
  ELITE: {
    name: 'Elite',
    minPoints: 10,
    maxPoints: 13,
    color: '#8B5CF6',
    gradientStart: '#8B5CF6',
    gradientEnd: '#7C3AED',
    description: 'Elite status unlocks premium perks and exclusive access.',
    benefits: [
      'All Select benefits',
      'Priority embarkation and debarkation',
      'Complimentary premium beverage package',
      'Priority dinner reservations',
      'Exclusive Captain\'s Club reception',
    ],
  },
  ELITE_PLUS: {
    name: 'Elite Plus',
    minPoints: 14,
    maxPoints: 17,
    color: '#EC4899',
    gradientStart: '#EC4899',
    gradientEnd: '#DB2777',
    description: 'Elite Plus members receive the finest treatment at sea.',
    benefits: [
      'All Elite benefits',
      'Complimentary gratuities',
      'Priority tender boarding',
      'Complimentary laundry service',
      'Exclusive shore excursion savings',
    ],
  },
  ZENITH: {
    name: 'Zenith',
    minPoints: 18,
    maxPoints: Infinity,
    color: '#000000',
    gradientStart: '#1F2937',
    gradientEnd: '#000000',
    description: 'The ultimate Captain\'s Club status with unparalleled benefits.',
    benefits: [
      'All Elite Plus benefits',
      'Complimentary spa treatment',
      'Exclusive Zenith pin and luggage tags',
      'Priority everything',
      'Personal concierge service',
    ],
  },
};

export function getCaptainsClubLevel(points: number): LoyaltyLevel {
  const p = Math.max(0, Math.floor(points));
  if (p >= 18) return CAPTAINS_CLUB_LEVELS.ZENITH;
  if (p >= 14) return CAPTAINS_CLUB_LEVELS.ELITE_PLUS;
  if (p >= 10) return CAPTAINS_CLUB_LEVELS.ELITE;
  if (p >= 5) return CAPTAINS_CLUB_LEVELS.SELECT;
  return CAPTAINS_CLUB_LEVELS.CLASSIC;
}

export function getNextCaptainsClubTier(currentPoints: number): LoyaltyLevel | null {
  if (currentPoints >= 18) return null;
  if (currentPoints >= 14) return CAPTAINS_CLUB_LEVELS.ZENITH;
  if (currentPoints >= 10) return CAPTAINS_CLUB_LEVELS.ELITE_PLUS;
  if (currentPoints >= 5) return CAPTAINS_CLUB_LEVELS.ELITE;
  return CAPTAINS_CLUB_LEVELS.SELECT;
}

export function getCaptainsClubProgress(currentPoints: number): {
  current: number;
  target: number;
  percentage: number;
  remaining: number;
} {
  const nextTier = getNextCaptainsClubTier(currentPoints);
  if (!nextTier) {
    return {
      current: currentPoints,
      target: 18,
      percentage: 100,
      remaining: 0,
    };
  }

  const currentTier = getCaptainsClubLevel(currentPoints);
  const current = currentPoints - currentTier.minPoints;
  const target = nextTier.minPoints - currentTier.minPoints;
  const percentage = (current / target) * 100;
  const remaining = nextTier.minPoints - currentPoints;

  return {
    current,
    target,
    percentage,
    remaining,
  };
}
