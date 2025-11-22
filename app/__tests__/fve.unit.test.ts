import { parseCertCode, resolveByPoints, computeTotals, type ThresholdTier } from '@/lib/fveUtils';

type Matcher = {
  toEqual: (expected: unknown) => void;
  toBe: (expected: unknown) => void;
};

function expectFn(received: unknown): Matcher {
  return {
    toEqual: (expected: unknown) => {
      const r = JSON.stringify(received);
      const e = JSON.stringify(expected);
      if (r !== e) {
        throw new Error(`Assertion failed: ${r} !== ${e}`);
      }
    },
    toBe: (expected: unknown) => {
      if (received !== expected) {
        throw new Error(`Assertion failed: ${String(received)} !== ${String(expected)}`);
      }
    },
  };
}

export function runFveUnitTests() {
  let passed = 0;
  let failed = 0;
  try {
    expectFn(parseCertCode('2411C08')).toEqual({ year: 2024, month: 11, path: 'C', level: '08', raw: '2411C08' });
    expectFn(parseCertCode('2411A03')).toEqual({ year: 2024, month: 11, path: 'A', level: '03', raw: '2411A03' });
    expectFn(parseCertCode('2411AVIP2')).toEqual({ year: 2024, month: 11, path: 'A', level: 'VIP2', raw: '2411AVIP2' });
    expectFn(parseCertCode('bad')).toBe(null);
    passed++;
  } catch (e) {
    console.error('parseCertCode test failed', e);
    failed++;
  }

  try {
    const tiers: ThresholdTier[] = [
      { points: 400, code: '2411C01', path: 'C', level: '01' },
      { points: 800, code: '2411C08', path: 'C', level: '08' },
      { points: 6500, code: '2411A03', path: 'A', level: '03' },
    ];
    const res1 = resolveByPoints(799, tiers);
    expectFn(res1.best?.code).toBe('2411C01');
    const res2 = resolveByPoints(800, tiers);
    expectFn(res2.best?.code).toBe('2411C08');
    const res3 = resolveByPoints(8000, tiers);
    expectFn(res3.best?.code).toBe('2411A03');
    passed++;
  } catch (e) {
    console.error('resolveByPoints test failed', e);
    failed++;
  }

  try {
    const r1 = computeTotals({ pointsEarned: 800, instantFinalUSD: 5000, nextCruiseUSD: 200 });
    expectFn(r1.coinIn).toBe(4000);
    expectFn(r1.total).toBe(5200);
    expectFn(Number(r1.roi.toFixed(2))).toBe(Number((5200 / 4000).toFixed(2)));

    const r2 = computeTotals({ pointsEarned: 0, instantFinalUSD: 0, nextCruiseUSD: 0 });
    expectFn(r2.coinIn).toBe(0);
    expectFn(r2.total).toBe(0);
    expectFn(r2.roi).toBe(0);
    passed++;
  } catch (e) {
    console.error('computeTotals test failed', e);
    failed++;
  }

  const summary = { passed, failed };
  console.log('FVE unit tests result', summary);
  return summary;
}
