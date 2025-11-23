export interface LoyaltyLevel { name: string; minPoints: number; maxPoints: number; color: string }

export const CROWN_ANCHOR_LEVELS: LoyaltyLevel[] = [
  { name: 'Gold', minPoints: 0, maxPoints: 29, color: '#EAB308' },
  { name: 'Platinum', minPoints: 30, maxPoints: 54, color: '#38BDF8' },
  { name: 'Emerald', minPoints: 55, maxPoints: 79, color: '#34D399' },
  { name: 'Diamond', minPoints: 80, maxPoints: 174, color: '#60A5FA' },
  { name: 'Diamond Plus', minPoints: 175, maxPoints: 699, color: '#A78BFA' },
  { name: 'Pinnacle', minPoints: 700, maxPoints: Infinity, color: '#000000' },
];

export function getCrownAnchorLevel(points: number): LoyaltyLevel {
  const p = Math.max(0, Math.floor(points));
  for (let i = CROWN_ANCHOR_LEVELS.length - 1; i >= 0; i -= 1) {
    const lvl = CROWN_ANCHOR_LEVELS[i];
    if (p >= lvl.minPoints) return lvl;
  }
  return CROWN_ANCHOR_LEVELS[0];
}
