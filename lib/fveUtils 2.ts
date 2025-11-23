export type CertPath = 'A' | 'C';

export interface ParsedCertCode {
  year: number; // 20YY
  month: number; // 1-12
  path: CertPath;
  level: 'VIP2' | string; // allow 01-08 or VIP2 strings
  raw: string;
}

export function parseCertCode(input: string): ParsedCertCode | null {
  if (!input) return null;
  const raw = input.toUpperCase().trim();
  const m = raw.match(/^(\d{2})(\d{2})(A|C)(VIP2|0[1-8]|[1-8])$/);
  if (!m) return null;
  const [, yy, mm, p, lvl] = m;
  const year = 2000 + parseInt(yy, 10);
  const month = parseInt(mm, 10);
  const level = (lvl.length === 1 ? `0${lvl}` : lvl) as ParsedCertCode['level'];
  if (month < 1 || month > 12) return null;
  return { year, month, path: p as CertPath, level, raw };
}

export interface ThresholdTier {
  points: number;
  code: string; // e.g., 2411C08
  path: CertPath;
  level: string; // 01-08 or VIP2
}

export interface ThresholdResolution {
  best: ThresholdTier | null;
  unlocked: ThresholdTier[];
}

export function resolveByPoints(points: number, tiers: ThresholdTier[]): ThresholdResolution {
  const safePoints = Math.max(0, Math.floor(points || 0));
  const sorted = [...tiers].sort((a, b) => a.points - b.points);
  const unlocked = sorted.filter(t => t.points <= safePoints);
  const best = unlocked.length > 0 ? unlocked[unlocked.length - 1] : null;
  return { best, unlocked };
}

export interface TotalsInput {
  pointsEarned: number;
  instantFinalUSD?: number | null;
  nextCruiseUSD?: number | null;
}

export interface TotalsResult {
  coinIn: number;
  total: number;
  roi: number; // ratio 0..n
}

export function computeTotals(input: TotalsInput): TotalsResult {
  const points = Math.max(0, Math.floor(input.pointsEarned || 0));
  const coinIn = points * 5;
  const instant = Math.max(0, Number(input.instantFinalUSD ?? 0));
  const next = Math.max(0, Number(input.nextCruiseUSD ?? 0));
  const total = instant + next;
  const roi = coinIn > 0 ? total / coinIn : 0;
  return { coinIn, total, roi };
}
