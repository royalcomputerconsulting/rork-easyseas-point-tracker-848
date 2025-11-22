import React from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ScrollView, StyleSheet, Text, View, TouchableOpacity } from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { ArrowLeft, Ship, Star } from 'lucide-react-native';
import { useCelebrity } from '@/state/CelebrityProvider';
import { ProgressBar } from '@/components/ui/ProgressBar';
import { CruiseCard } from '@/components/CruiseCard';

function toDate(input?: string | Date): Date | null {
  if (!input) return null;
  try {
    const d = typeof input === 'string' ? new Date(input) : input;
    return isNaN(d.getTime()) ? null : d;
  } catch {
    return null;
  }
}

export default function CelebrityOfferDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const celeb = useCelebrity() as any;
  const offer = React.useMemo(() => {
    const arr = Array.isArray(celeb?.offers) ? celeb.offers : [];
    return arr.find((o: any) => String(o.id) === String(id)) ?? null;
  }, [celeb?.offers, id]);

  const expiresDate = toDate(offer?.expires);
  const daysToGo = React.useMemo(() => {
    if (!expiresDate) return 0;
    const now = new Date();
    const ms = expiresDate.getTime() - now.getTime();
    return Math.max(0, Math.ceil(ms / (1000 * 60 * 60 * 24)));
  }, [expiresDate?.getTime?.()]);

  const associatedCruises = React.useMemo(() => {
    const ships: string[] = Array.isArray(offer?.ships) ? offer.ships : [];
    const cruises = Array.isArray(celeb?.cruises) ? celeb.cruises : [];
    if (ships.length === 0) return cruises.filter((c: any) => c?.line === 'Celebrity');
    const set = new Set(ships.map((s) => String(s).trim().toLowerCase()));
    return cruises.filter((c: any) => set.has(String(c?.ship ?? '').trim().toLowerCase()));
  }, [offer?.ships, celeb?.cruises]);

  return (
    <SafeAreaView style={{ flex: 1 }} edges={['top', 'bottom']}>
      <ScrollView style={styles.container} testID="celebrity-offer-detail-screen">
        <View style={styles.header}>
          <TouchableOpacity style={styles.backButton} onPress={() => router.back()} testID="back-button">
            <ArrowLeft size={24} color="#0B3A6E" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Celebrity Offer</Text>
          <View style={{ width: 40 }} />
        </View>

        <View style={styles.offerCard}>
          <View style={styles.offerHeader}>
            <Text style={styles.offerName}>{offer?.offerName || offer?.name || 'Offer'}</Text>
            <View style={styles.offerBadge}><Text style={styles.offerBadgeText}>Active</Text></View>
          </View>

          <View style={styles.codeDisplay}>
            <Text style={styles.codeLabel}>Offer Code</Text>
            <View style={styles.codePill}>
              <Text style={styles.codeText}>{offer?.offerCode || '—'}</Text>
            </View>
          </View>

          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Expires</Text>
            <Text style={styles.detailValue}>
              {expiresDate ? expiresDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—'}
            </Text>
          </View>

          <View style={styles.progressWrap}>
            <Text style={styles.progressLabel}>Captain's Club Progress to Zenith</Text>
            <ProgressBar value={Number(celeb?.captainsClubPoints ?? 0)} max={3000} height={10} />
            <Text style={styles.progressMeta}>
              {(Math.max(0, 3000 - Number(celeb?.captainsClubPoints ?? 0))).toLocaleString()} points to Zenith
            </Text>
          </View>

          <View style={styles.pointsRow}>
            <Star size={16} color="#F59E0B" />
            <Text style={styles.pointsText}>{(celeb?.blueChipPoints ?? 0).toLocaleString()} Blue Chip Points</Text>
          </View>

          {typeof daysToGo === 'number' && (
            <View style={styles.daysPill}><Text style={styles.daysPillText}>{daysToGo} days to go</Text></View>
          )}
        </View>

        <View style={styles.cruisesSection}>
          <Text style={styles.sectionTitle}>Cruises For This Offer ({associatedCruises.length})</Text>
          {associatedCruises.length > 0 ? (
            <View style={{ gap: 12 }}>
              {associatedCruises.map((c: any) => (
                <CruiseCard
                  key={String(c.id)}
                  cruise={c}
                  onPress={() => router.push(`/cruise/${encodeURIComponent(String(c.id))}`)}
                />
              ))}
            </View>
          ) : (
            <View style={styles.emptyState}>
              <Ship size={48} color="#6B7280" />
              <Text style={styles.emptyText}>No matching cruises</Text>
              <Text style={styles.emptySub}>Import Celebrity cruises to see matches</Text>
            </View>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8FAFC', paddingTop: 18 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 16, backgroundColor: '#FFFFFF', borderBottomWidth: 1, borderBottomColor: '#E5E7EB' },
  backButton: { padding: 8, borderRadius: 8, backgroundColor: '#E6F0FB' },
  headerTitle: { fontSize: 18, fontWeight: '700', color: '#0B3A6E' },
  offerCard: { backgroundColor: '#FFFFFF', margin: 16, borderRadius: 12, padding: 16, borderWidth: 1, borderColor: '#E5E7EB' },
  offerHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  offerName: { fontSize: 20, fontWeight: '800', color: '#111827', flex: 1 },
  offerBadge: { backgroundColor: '#10B981', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999 },
  offerBadgeText: { color: '#FFFFFF', fontWeight: '700', fontSize: 12 },
  codeDisplay: { marginBottom: 12 },
  codeLabel: { fontSize: 12, color: '#6B7280', fontWeight: '600', marginBottom: 6 },
  codePill: { alignSelf: 'flex-start', backgroundColor: '#E6F0FB', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999, borderWidth: 1, borderColor: '#0B3A6E' },
  codeText: { fontSize: 14, fontWeight: '700', color: '#0B3A6E', letterSpacing: 0.5 },
  detailRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  detailLabel: { color: '#6B7280', fontSize: 14 },
  detailValue: { color: '#111827', fontSize: 14, fontWeight: '600' },
  progressWrap: { marginTop: 12, gap: 6 },
  progressLabel: { fontSize: 12, color: '#374151', fontWeight: '600' },
  progressMeta: { fontSize: 12, color: '#6B7280' },
  pointsRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 8 },
  pointsText: { fontSize: 12, color: '#111827', fontWeight: '600' },
  daysPill: { alignSelf: 'flex-start', backgroundColor: '#0EA5E9', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999, marginTop: 10 },
  daysPillText: { color: '#FFFFFF', fontSize: 12, fontWeight: '700' },
  cruisesSection: { margin: 16, marginTop: 4 },
  sectionTitle: { fontSize: 16, fontWeight: '800', color: '#111827', marginBottom: 12, textAlign: 'left' },
  emptyState: { alignItems: 'center', padding: 24, gap: 6 },
  emptyText: { fontSize: 14, color: '#6B7280', fontWeight: '600' },
  emptySub: { fontSize: 12, color: '#9CA3AF' },
});
