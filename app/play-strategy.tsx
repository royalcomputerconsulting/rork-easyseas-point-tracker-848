import React from 'react';
import { ScrollView, StyleSheet, Text, View, TextInput, TouchableOpacity } from 'react-native';
import { Stack } from 'expo-router';
import { Target, Calculator, Trophy, Ship } from 'lucide-react-native';
import { STATIC_BOOKED_CRUISES } from '@/state/staticBooked';

export default function PlayStrategyScreen() {
  const [targetPoints, setTargetPoints] = React.useState<string>('296');
  const [pointsPerDollar, setPointsPerDollar] = React.useState<number>(1 / 5); // 1 point per $5 coin-in
  const [nights, setNights] = React.useState<string>('4');

  const parsedTarget = Math.max(0, parseInt(targetPoints || '0', 10) || 0);
  const parsedNights = Math.max(1, parseInt(nights || '1', 10) || 1);
  const coinInRequired = Math.round(parsedTarget / pointsPerDollar);
  const nightlyPoints = Math.ceil(parsedTarget / parsedNights);
  const nightlyCoinIn = Math.round(nightlyPoints / pointsPerDollar);

  const upcoming = React.useMemo(() => {
    return STATIC_BOOKED_CRUISES
      .filter(c => !!c.startDate && new Date(c.startDate as string).getTime() > Date.now())
      .sort((a, b) => new Date(a.startDate as string).getTime() - new Date(b.startDate as string).getTime());
  }, []);

  const allocation = React.useMemo(() => {
    if (upcoming.length === 0 || parsedTarget <= 0) return [] as Array<{ id: string; ship: string; startDate: string; nights: number; points: number; coinIn: number }>;
    const per = Math.floor(parsedTarget / upcoming.length);
    const rem = parsedTarget - per * upcoming.length;
    return upcoming.map((c, i) => {
      const pts = per + (i < rem ? 1 : 0);
      const coin = Math.round(pts / pointsPerDollar);
      return { id: c.id, ship: c.ship, startDate: c.startDate as string, nights: c.nights || 1, points: pts, coinIn: coin };
    });
  }, [upcoming, parsedTarget, pointsPerDollar]);

  return (
    <>
      <Stack.Screen options={{ title: 'Play Strategy' }} />
      <ScrollView style={styles.container} testID="play-strategy-screen">
        <View style={styles.header}>
          <Target size={18} color="#111827" />
          <Text style={styles.headerTitle}>Optimizer</Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.label}>Target additional points</Text>
          <TextInput
            style={styles.input}
            keyboardType="numeric"
            value={targetPoints}
            onChangeText={(t: string) => {
              const clean = t.replace(/[^0-9]/g, '').slice(0, 6);
              setTargetPoints(clean);
            }}
            placeholder="e.g. 296"
            testID="target-points-input"
          />

          <Text style={styles.label}>Nights to achieve</Text>
          <TextInput
            style={styles.input}
            keyboardType="numeric"
            value={nights}
            onChangeText={(t: string) => {
              const clean = t.replace(/[^0-9]/g, '').slice(0, 3);
              setNights(clean);
            }}
            placeholder="e.g. 4"
            testID="nights-input"
          />

          <View style={styles.rowBetween}>
            <View style={styles.kvBox}>
              <Text style={styles.kvLabel}>Coin-In Required</Text>
              <Text style={styles.kvValue}>${coinInRequired.toLocaleString()}</Text>
            </View>
            <View style={styles.kvBox}>
              <Text style={styles.kvLabel}>Nightly Target</Text>
              <Text style={styles.kvValue}>{nightlyPoints.toLocaleString()} pts (${nightlyCoinIn.toLocaleString()})</Text>
            </View>
          </View>
        </View>

        <View style={styles.sectionHeader}>
          <Trophy size={16} color="#111827" />
          <Text style={styles.sectionTitle}>Allocation across upcoming cruises</Text>
        </View>
        <View style={styles.card}>
          {allocation.length === 0 ? (
            <Text style={styles.muted}>No upcoming cruises found</Text>
          ) : (
            allocation.map(a => (
              <View key={a.id} style={styles.allocRow}>
                <View style={styles.rowLeft}>
                  <Ship size={14} color="#111827" />
                  <Text style={styles.allocTitle}>{a.ship}</Text>
                </View>
                <View style={styles.rowRight}>
                  <Text style={styles.allocMeta}>{new Date(a.startDate).toLocaleDateString()}</Text>
                  <Text style={styles.allocMeta}>{a.nights} nights</Text>
                  <Text style={styles.allocStrong}>{a.points.toLocaleString()} pts</Text>
                  <Text style={styles.allocCoin}>${a.coinIn.toLocaleString()}</Text>
                </View>
              </View>
            ))
          )}
        </View>

        <TouchableOpacity style={styles.primaryBtn} disabled testID="save-plan-btn">
          <Calculator size={16} color="#FFFFFF" />
          <Text style={styles.primaryBtnText}>Save Plan (coming soon)</Text>
        </TouchableOpacity>
      </ScrollView>
    </>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8FAFC', padding: 16 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 },
  headerTitle: { fontSize: 22, fontWeight: '700', color: '#111827' },
  card: { backgroundColor: '#FFFFFF', borderRadius: 12, padding: 12, borderWidth: 1, borderColor: '#E5E7EB', marginBottom: 16 },
  label: { fontSize: 12, fontWeight: '600', color: '#6B7280', marginTop: 8 },
  input: { borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 8, padding: 10, color: '#111827', marginTop: 6 },
  rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginTop: 12 },
  kvBox: { flex: 1, backgroundColor: '#F9FAFB', borderRadius: 8, padding: 12, borderWidth: 1, borderColor: '#E5E7EB' },
  kvLabel: { fontSize: 12, color: '#6B7280' },
  kvValue: { fontSize: 18, fontWeight: '700', color: '#111827', marginTop: 4 },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: '#111827' },
  muted: { color: '#6B7280', fontSize: 12 },
  allocRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderBottomWidth: 1, borderBottomColor: '#F3F4F6', paddingVertical: 10 },
  rowLeft: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  rowRight: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  allocTitle: { fontSize: 14, fontWeight: '700', color: '#111827' },
  allocMeta: { fontSize: 12, color: '#6B7280' },
  allocStrong: { fontSize: 12, fontWeight: '700', color: '#111827' },
  allocCoin: { fontSize: 12, fontWeight: '700', color: '#0F766E' },
  primaryBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: '#6366F1', borderRadius: 10, padding: 14 },
  primaryBtnText: { color: '#FFFFFF', fontSize: 14, fontWeight: '700' },
});
