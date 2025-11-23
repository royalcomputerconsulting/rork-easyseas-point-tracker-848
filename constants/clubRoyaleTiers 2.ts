export interface TierBenefit {
  text: string;
  icon?: string;
}

export interface TierInfo {
  name: string;
  minPoints: number;
  maxPoints: number;
  color: string;
  gradientStart: string;
  gradientEnd: string;
  benefits: TierBenefit[];
  description: string;
}

export const CLUB_ROYALE_TIERS: Record<string, TierInfo> = {
  CHOICE: {
    name: "CHOICE",
    minPoints: 0,
    maxPoints: 2499,
    color: "#8B5CF6",
    gradientStart: "#8B5CF6",
    gradientEnd: "#6D28D9",
    description: "Welcome to Club Royale! Start earning points and unlock exclusive benefits.",
    benefits: [
      { text: "Point Redemption towards onboard expense account credit or as FreePlay in the Casino" },
      { text: "Instant Cruise Rewards Certificates" },
    ],
  },
  PRIME: {
    name: "PRIME",
    minPoints: 2500,
    maxPoints: 24999,
    color: "#7C3AED",
    gradientStart: "#7C3AED",
    gradientEnd: "#5B21B6",
    description: "Once you hit 2,500 points, you've reached Prime status which unlocks new perks like, discounts on VOOM® high speed internet packages, exclusive rates for family and friends, and an interior stateroom courtesy of Club Royale on one cruise each year.",
    benefits: [
      { text: "Point Redemption towards onboard expense account credit or as FreePlay in the Casino" },
      { text: "Instant Cruise Rewards Certificates" },
      { text: "Regalia Fine Jewelry and Effy Boutique Credit of $250" },
      { text: "Vitality Spa Discount of 10%" },
      { text: "Waived Convenience Fee for Cashless Wagering on SeaPass® card" },
      { text: "Complimentary Drinks in Club Royale" },
      { text: "VOOM® Surf & Stream Internet Wi-Fi Packages discount" },
      { text: "Annual Cruise: INTERIOR courtesy of Club Royale" },
    ],
  },
  SIGNATURE: {
    name: "SIGNATURE",
    minPoints: 25000,
    maxPoints: 99999,
    color: "#1E40AF",
    gradientStart: "#1E40AF",
    gradientEnd: "#1E3A8A",
    description: "At 25,000 points, you're considered a Signature member. At this level, you can add free WiFi for one device, a $350 EFFY boutique credit and a balcony stateroom courtesy of Club Royale on one cruise each year to your list of Club Royale® benefits, in addition to all the other perks you've stacked up.",
    benefits: [
      { text: "Point Redemption towards onboard expense account credit or as FreePlay in the Casino" },
      { text: "Instant Cruise Rewards Certificates" },
      { text: "Regalia Fine Jewelry and Effy Boutique Credit of $350" },
      { text: "Vitality Spa Discount of 15%" },
      { text: "Waived Convenience Fee for Cashless Wagering on SeaPass® card" },
      { text: "Complimentary Drinks in Club Royale" },
      { text: "VOOM® Surf & Stream Internet Wi-Fi Packages for 1 device" },
      { text: "Annual Cruise: BALCONY courtesy of Club Royale" },
    ],
  },
  MASTERS: {
    name: "MASTERS",
    minPoints: 100000,
    maxPoints: Infinity,
    color: "#DC2626",
    gradientStart: "#DC2626",
    gradientEnd: "#991B1B",
    description: "Masters tier unlocks premium benefits including enhanced jewelry credits, spa discounts, and suite accommodations.",
    benefits: [
      { text: "Point Redemption towards onboard expense account credit or as FreePlay in the Casino" },
      { text: "Instant Cruise Rewards Certificates" },
      { text: "Regalia Fine Jewelry and Effy Boutique Credit of $500" },
      { text: "Vitality Spa Discount of 20%" },
      { text: "Waived Convenience Fee for Cashless Wagering on SeaPass® card" },
      { text: "Complimentary Drinks in Club Royale" },
      { text: "VOOM® Surf & Stream Internet Wi-Fi Packages for 2 devices" },
      { text: "Annual Cruise: JUNIOR SUITE courtesy of Club Royale" },
    ],
  },
};

export function getTierByPoints(points: number): TierInfo {
  if (points >= 100000) return CLUB_ROYALE_TIERS.MASTERS;
  if (points >= 25000) return CLUB_ROYALE_TIERS.SIGNATURE;
  if (points >= 2500) return CLUB_ROYALE_TIERS.PRIME;
  return CLUB_ROYALE_TIERS.CHOICE;
}

export function getNextTier(currentPoints: number): TierInfo | null {
  if (currentPoints >= 100000) return null;
  if (currentPoints >= 25000) return CLUB_ROYALE_TIERS.MASTERS;
  if (currentPoints >= 2500) return CLUB_ROYALE_TIERS.SIGNATURE;
  return CLUB_ROYALE_TIERS.PRIME;
}

export function getProgressToNextTier(currentPoints: number): {
  current: number;
  target: number;
  percentage: number;
  remaining: number;
} {
  const nextTier = getNextTier(currentPoints);
  if (!nextTier) {
    return {
      current: currentPoints,
      target: 100000,
      percentage: 100,
      remaining: 0,
    };
  }

  const currentTier = getTierByPoints(currentPoints);
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
