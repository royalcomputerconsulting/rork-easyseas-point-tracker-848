export interface BlueChipTier {
  name: string;
  minPoints: number;
  maxPoints: number;
  color: string;
  gradientStart: string;
  gradientEnd: string;
  description: string;
  benefits: string[];
}

export const BLUE_CHIP_TIERS: Record<string, BlueChipTier> = {
  PEARL: {
    name: 'Pearl',
    minPoints: 0,
    maxPoints: 2499,
    color: '#E5E7EB',
    gradientStart: '#F3F4F6',
    gradientEnd: '#D1D5DB',
    description: 'Welcome to Blue Chip Club! Start earning points for exclusive casino benefits.',
    benefits: [
      'Point redemption for onboard credits',
      'Instant cruise reward certificates',
      'Complimentary drinks in casino',
    ],
  },
  ONYX: {
    name: 'Onyx',
    minPoints: 2500,
    maxPoints: 24999,
    color: '#374151',
    gradientStart: '#4B5563',
    gradientEnd: '#1F2937',
    description: 'Onyx members enjoy enhanced casino privileges and rewards.',
    benefits: [
      'All Pearl benefits',
      'Priority casino reservations',
      'Complimentary specialty dining for 2',
      '$250 spa credit',
      'Waived casino cashless wagering fee',
      'Annual interior stateroom courtesy of Blue Chip',
    ],
  },
  SAPPHIRE: {
    name: 'Sapphire',
    minPoints: 25000,
    maxPoints: 99999,
    color: '#2563EB',
    gradientStart: '#3B82F6',
    gradientEnd: '#1E40AF',
    description: 'Sapphire status unlocks premium casino benefits and accommodations.',
    benefits: [
      'All Onyx benefits',
      '$350 spa and boutique credit',
      'Premium beverage package discount',
      'WiFi for 1 device',
      'Annual balcony stateroom courtesy of Blue Chip',
    ],
  },
  RUBY: {
    name: 'Ruby',
    minPoints: 100000,
    maxPoints: 174999,
    color: '#DC2626',
    gradientStart: '#EF4444',
    gradientEnd: '#991B1B',
    description: 'Ruby tier provides elite casino benefits and suite accommodations.',
    benefits: [
      'All Sapphire benefits',
      '$500 spa and boutique credit',
      'Complimentary premium beverage package',
      'WiFi for 2 devices',
      'Annual junior suite courtesy of Blue Chip',
    ],
  },
  DIAMOND: {
    name: 'Diamond',
    minPoints: 175000,
    maxPoints: Infinity,
    color: '#6366F1',
    gradientStart: '#818CF8',
    gradientEnd: '#4338CA',
    description: 'The ultimate Blue Chip status with the most exclusive benefits.',
    benefits: [
      'All Ruby benefits',
      '$750 spa and boutique credit',
      'Complimentary gratuities',
      'WiFi for 4 devices',
      'Personal casino host',
      'Annual grand suite courtesy of Blue Chip',
    ],
  },
};

export function getBlueChipTier(points: number): BlueChipTier {
  const p = Math.max(0, Math.floor(points));
  if (p >= 175000) return BLUE_CHIP_TIERS.DIAMOND;
  if (p >= 100000) return BLUE_CHIP_TIERS.RUBY;
  if (p >= 25000) return BLUE_CHIP_TIERS.SAPPHIRE;
  if (p >= 2500) return BLUE_CHIP_TIERS.ONYX;
  return BLUE_CHIP_TIERS.PEARL;
}

export function getNextBlueChipTier(currentPoints: number): BlueChipTier | null {
  if (currentPoints >= 175000) return null;
  if (currentPoints >= 100000) return BLUE_CHIP_TIERS.DIAMOND;
  if (currentPoints >= 25000) return BLUE_CHIP_TIERS.RUBY;
  if (currentPoints >= 2500) return BLUE_CHIP_TIERS.SAPPHIRE;
  return BLUE_CHIP_TIERS.ONYX;
}

export function getBlueChipProgress(currentPoints: number): {
  current: number;
  target: number;
  percentage: number;
  remaining: number;
} {
  const nextTier = getNextBlueChipTier(currentPoints);
  if (!nextTier) {
    return {
      current: currentPoints,
      target: 175000,
      percentage: 100,
      remaining: 0,
    };
  }

  const currentTier = getBlueChipTier(currentPoints);
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
