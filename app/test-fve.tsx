import React from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { Stack } from 'expo-router';
import { parseCertCode, resolveByPoints, computeTotals, type ThresholdTier } from '@/lib/fveUtils';

interface CaseResult {
  name: string;
  pass: boolean;
  details?: string;
}

export default function TestFVE() {
  const results = React.useMemo<CaseResult[]>(() => {
    const out: CaseResult[] = [];

    try {
      const a = parseCertCode('2411C08');
      out.push({ name: 'parse 2411C08', pass: !!a && a.path === 'C' && a.level === '08' && a.month === 11 && a.year === 2024 });

      const b = parseCertCode('2411A03');
      out.push({ name: 'parse 2411A03', pass: !!b && b.path === 'A' && b.level === '03' });

      const c = parseCertCode('2411AVIP2');
      out.push({ name: 'parse 2411AVIP2', pass: !!c && c.path === 'A' && c.level === 'VIP2' });

      const bad = parseCertCode('bad');
      out.push({ name: 'parse bad returns null', pass: bad === null });
    } catch (e) {
      out.push({ name: 'parser threw error', pass: false, details: String(e) });
    }

    try {
      const tiers: ThresholdTier[] = [
        { points: 400, code: '2411C01', path: 'C', level: '01' },
        { points: 800, code: '2411C08', path: 'C', level: '08' },
        { points: 6500, code: '2411A03', path: 'A', level: '03' },
      ];
      const r1 = resolveByPoints(799, tiers);
      out.push({ name: 'thresholds 799 -> 2411C01', pass: r1.best?.code === '2411C01' });
      const r2 = resolveByPoints(800, tiers);
      out.push({ name: 'thresholds 800 -> 2411C08', pass: r2.best?.code === '2411C08' });
      const r3 = resolveByPoints(8000, tiers);
      out.push({ name: 'thresholds 8000 -> 2411A03', pass: r3.best?.code === '2411A03' });
    } catch (e) {
      out.push({ name: 'thresholds threw error', pass: false, details: String(e) });
    }

    try {
      const r1 = computeTotals({ pointsEarned: 800, instantFinalUSD: 5000, nextCruiseUSD: 200 });
      const p1 = r1.coinIn === 4000 && r1.total === 5200 && Math.abs(r1.roi - (5200 / 4000)) < 1e-6;
      out.push({ name: 'totals for 800 pts', pass: p1 });

      const r2 = computeTotals({ pointsEarned: 0, instantFinalUSD: 0, nextCruiseUSD: 0 });
      out.push({ name: 'totals zero', pass: r2.coinIn === 0 && r2.total === 0 && r2.roi === 0 });
    } catch (e) {
      out.push({ name: 'totals threw error', pass: false, details: String(e) });
    }

    return out;
  }, []);

  const passed = results.filter(r => r.pass).length;

  return (
    <>
      <Stack.Screen options={{ title: 'FVE Unit Tests' }} />
      <ScrollView contentContainerStyle={styles.container} testID="fve-tests">
        <Text style={styles.title}>FVE Tests</Text>
        <View style={styles.summary}>
          <Text style={styles.summaryText}>Passed {passed} / {results.length}</Text>
        </View>
        {results.map((r) => (
          <View key={r.name} style={[styles.case, r.pass ? styles.pass : styles.fail]}>
            <Text style={styles.caseName}>{r.pass ? '✓' : '✗'} {r.name}</Text>
            {!!r.details && <Text style={styles.details}>{r.details}</Text>}
          </View>
        ))}
      </ScrollView>
    </>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16 },
  title: { fontSize: 20, fontWeight: '800', color: '#111827', marginBottom: 12 },
  summary: { backgroundColor: '#F3F4F6', borderRadius: 8, padding: 12, marginBottom: 12 },
  summaryText: { fontSize: 14, fontWeight: '700', color: '#111827' },
  case: { padding: 12, borderRadius: 8, marginBottom: 8, borderWidth: 1 },
  pass: { backgroundColor: '#ECFDF5', borderColor: '#22C55E' },
  fail: { backgroundColor: '#FEF2F2', borderColor: '#FCA5A5' },
  caseName: { fontSize: 14, fontWeight: '600', color: '#111827' },
  details: { fontSize: 12, color: '#6B7280', marginTop: 4 },
});
