import React from 'react';
import { Stack, useLocalSearchParams, router } from 'expo-router';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, TextInput, Platform, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ArrowLeft, DollarSign, LayoutGrid, FileText, Save, RefreshCw, Settings, AlertTriangle } from 'lucide-react-native';
import { trpc } from '@/lib/trpc';
import { emitFveUpdated } from '@/lib/fveEvents';
import { Badge } from '@/components/ui/Badge';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import * as Clipboard from 'expo-clipboard';

type LinkData = ReturnType<typeof useLinkData>;

function useLinkData() {
  const params = useLocalSearchParams<{
    cruiseId: string;
    ship?: string;
    itinerary?: string;
    nights?: string;
    seasonality?: string;
    shipClass?: string;
    pointsEarned?: string;
  }>();
  return params;
}

export default function FVEPage() {
  const { cruiseId, ship, itinerary, nights, seasonality, shipClass, pointsEarned } = useLinkData();

  const seedMutation = trpc.fve.seed.useMutation();
  const linkMutation = trpc.fve.linkCruise.useMutation();
  const saveMutation = trpc.fve.saveEvaluation.useMutation();
  const linkQuery = trpc.fve.getLink.useQuery({ cruiseId: String(cruiseId) }, { enabled: Boolean(cruiseId) });
  const exportQuery = trpc.fve.exportCsv.useQuery({ cruiseId: String(cruiseId) }, { enabled: false });
  const pointsInt = React.useMemo(() => {
    const n = Number(pointsEarned ?? '0');
    return Number.isFinite(n) ? Math.max(0, Math.floor(n)) : 0;
  }, [pointsEarned]);
  const resolveQuery = trpc.fve.resolveByPoints.useQuery({ pointsEarned: pointsInt }, { enabled: pointsInt > 0 });

  const [certCode, setCertCode] = React.useState<string>('');
  const [path, setPath] = React.useState<'A' | 'C' | ''>('');
  const [level, setLevel] = React.useState<string>('');
  const [minVal, setMinVal] = React.useState<string>('');
  const [maxVal, setMaxVal] = React.useState<string>('');
  const [finalVal, setFinalVal] = React.useState<string>('');
  const [ncId, setNcId] = React.useState<string>('');
  const [ncVal, setNcVal] = React.useState<string>('');
  const [overrideReason, setOverrideReason] = React.useState<string>('');

  React.useEffect(() => {
    try {
      seedMutation.mutate();
    } catch (e) {
      if (Platform.OS === 'web') console.error('[FVE] Seed error', e);
    }
  }, []);

  React.useEffect(() => {
    if (!cruiseId) return;
    const pts = Number(pointsEarned ?? '0');
    if (!Number.isFinite(pts)) return;
    linkMutation.mutate({
      cruiseId: String(cruiseId),
      ship: ship ? String(ship) : undefined,
      itinerary: itinerary ? String(itinerary) : undefined,
      nights: nights ? parseInt(String(nights), 10) : undefined,
      seasonality: seasonality ? String(seasonality) : undefined,
      shipClass: shipClass ? String(shipClass) : undefined,
      pointsEarned: Math.max(0, Math.floor(pts)),
    });
  }, [cruiseId, ship, itinerary, nights, seasonality, shipClass, pointsEarned]);

  const data = linkQuery.data;
  const needsMapping = React.useMemo(() => {
    if (!data) return true;
    const hasCert = Boolean(data.selected_cert_code ?? resolveQuery.data?.suggested?.codeSuggestion);
    const hasInstant = typeof data.instant_value_final_usd === 'number' || (resolveQuery.data?.suggested?.instantMin != null || resolveQuery.data?.suggested?.instantMax != null);
    const hasNext = typeof data.nextcruise_value_usd === 'number' || !!resolveQuery.data?.bonus;
    return !(hasCert && hasInstant && hasNext);
  }, [data, resolveQuery.data?.suggested, resolveQuery.data?.bonus]);

  React.useEffect(() => {
    if (!data) return;
    setCertCode(String(data.selected_cert_code ?? ''));
    setPath((data.selected_path as 'A' | 'C' | undefined) ?? '');
    setLevel(String(data.level ?? ''));
    setMinVal(data.instant_value_min_usd != null ? String(data.instant_value_min_usd) : '');
    setMaxVal(data.instant_value_max_usd != null ? String(data.instant_value_max_usd) : '');
    setFinalVal(data.instant_value_final_usd != null ? String(data.instant_value_final_usd) : '');
    setNcId(String(data.nextcruise_bonus_id ?? ''));
    setNcVal(data.nextcruise_value_usd != null ? String(data.nextcruise_value_usd) : '');
    setOverrideReason(String(data.override_reason ?? ''));
  }, [data?.selected_cert_code, data?.selected_path, data?.level, data?.instant_value_min_usd, data?.instant_value_max_usd, data?.instant_value_final_usd, data?.nextcruise_bonus_id, data?.nextcruise_value_usd, data?.override_reason]);

  return (
    <>
      <Stack.Screen
        options={{
          title: 'Future Value Earned',
          headerLeft: () => (
            <TouchableOpacity onPress={() => router.back()} style={styles.headerIconPad}>
              <ArrowLeft size={22} color="#111827" />
            </TouchableOpacity>
          ),
        }}
      />
      <SafeAreaView style={styles.container} testID="fve-screen">
        <ErrorBoundary>
          <ScrollView contentContainerStyle={styles.scroll}>
            <View style={styles.headerCard}>
              <Text style={styles.ship}>{ship ?? '—'}</Text>
              <Text style={styles.meta}>{itinerary ?? '—'}</Text>
              {needsMapping && (
                <View style={styles.needsMapRow}>
                  <AlertTriangle size={16} color="#F59E0B" />
                  <Badge label="Needs mapping" testID="fve-needs-mapping" />
                </View>
              )}
              <View style={styles.row}>
                <Text style={styles.kvLabel}>Nights</Text>
                <Text style={styles.kvValue}>{nights ?? '—'}</Text>
              </View>
              <View style={styles.row}>
                <Text style={styles.kvLabel}>Points</Text>
                <Text style={styles.kvValue}>{pointsEarned ?? '0'}</Text>
              </View>
              <View style={styles.row}>
                <Text style={styles.kvLabel}>Coin-in</Text>
                <Text style={styles.kvValue}>${((Number(pointsEarned ?? '0') || 0) * 5).toLocaleString()}</Text>
              </View>
            </View>

            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <LayoutGrid size={18} color="#3B82F6" />
                <Text style={styles.sectionTitle}>Certificate</Text>
              </View>
              <View style={styles.card}>
                {resolveQuery.isSuccess && (
                  <View style={styles.suggestionBox}>
                    <Text style={styles.dimText}>Suggested: {resolveQuery.data?.suggested ? `${resolveQuery.data.suggested.path} · ${resolveQuery.data.suggested.level} · ${resolveQuery.data.suggested.codeSuggestion}` : '—'}</Text>
                    {resolveQuery.data?.bonus && (
                      <Text style={styles.dimText}>Matched NextCruise: ≈ ${resolveQuery.data.bonus.value.toLocaleString()} {resolveQuery.data.bonus.note ? `• ${resolveQuery.data.bonus.note}` : ''}</Text>
                    )}
                    <View style={styles.inlineActions}>
                      <TouchableOpacity
                        style={[styles.smallBtn, styles.secondaryBtn]}
                        onPress={() => resolveQuery.refetch()}
                        testID="fve-resolve-refresh"
                      >
                        <RefreshCw size={16} color="#3B82F6" />
                        <Text style={styles.smallBtnTextAlt}>Recalc</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[styles.smallBtn, styles.primaryBtn]}
                        onPress={() => {
                          const s = resolveQuery.data?.suggested;
                          const b = resolveQuery.data?.bonus;
                          if (s) {
                            setPath(s.path);
                            setLevel(s.level);
                            setCertCode(s.codeSuggestion);
                            if (s.instantMin != null) setMinVal(String(s.instantMin));
                            if (s.instantMax != null) setMaxVal(String(s.instantMax));
                          }
                          if (b) {
                            setNcId(b.id);
                            setNcVal(String(b.value));
                          }
                        }}
                        testID="fve-apply-suggestion"
                      >
                        <Save size={16} color="#FFFFFF" />
                        <Text style={styles.smallBtnText}>Use Suggestion</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                )}
                <View style={styles.formRow}>
                  <View style={styles.formItem}>
                    <Text style={styles.inputLabel}>Code</Text>
                    <TextInput
                      value={certCode}
                      onChangeText={(t: string) => setCertCode(t.toUpperCase().slice(0, 12))}
                      placeholder="YYMM(A|C)(VIP2|01-08)"
                      style={styles.input}
                      testID="fve-cert-code"
                    />
                  </View>
                  <View style={styles.formItemSmall}>
                    <Text style={styles.inputLabel}>Path</Text>
                    <View style={styles.rowGap}>
                      <TouchableOpacity
                        onPress={() => setPath('A')}
                        style={[styles.toggleBtn, path === 'A' && styles.toggleBtnActive]}
                        testID="fve-path-a"
                      >
                        <Text style={[styles.toggleText, path === 'A' && styles.toggleTextActive]}>A</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        onPress={() => setPath('C')}
                        style={[styles.toggleBtn, path === 'C' && styles.toggleBtnActive]}
                        testID="fve-path-c"
                      >
                        <Text style={[styles.toggleText, path === 'C' && styles.toggleTextActive]}>C</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                  <View style={styles.formItem}>
                    <Text style={styles.inputLabel}>Level</Text>
                    <TextInput
                      value={level}
                      onChangeText={(t: string) => setLevel(t.toUpperCase().slice(0, 6))}
                      placeholder="VIP2 or 01-08"
                      style={styles.input}
                      testID="fve-level"
                    />
                  </View>
                </View>

                <View style={styles.formRow}>
                  <View style={styles.formItem}>
                    <Text style={styles.inputLabel}>Instant Min</Text>
                    <TextInput
                      value={minVal}
                      onChangeText={(t: string) => setMinVal(t.replace(/[^0-9]/g, ''))}
                      placeholder="0"
                      keyboardType={Platform.OS === 'web' ? 'default' : 'numeric'}
                      style={styles.input}
                      testID="fve-instant-min"
                    />
                  </View>
                  <View style={styles.formItem}>
                    <Text style={styles.inputLabel}>Instant Max</Text>
                    <TextInput
                      value={maxVal}
                      onChangeText={(t: string) => setMaxVal(t.replace(/[^0-9]/g, ''))}
                      placeholder="0"
                      keyboardType={Platform.OS === 'web' ? 'default' : 'numeric'}
                      style={styles.input}
                      testID="fve-instant-max"
                    />
                  </View>
                </View>

                <View style={styles.formRow}>
                  <View style={styles.formItem}>
                    <Text style={styles.inputLabel}>Instant Final</Text>
                    <TextInput
                      value={finalVal}
                      onChangeText={(t: string) => setFinalVal(t.replace(/[^0-9]/g, ''))}
                      placeholder="0"
                      keyboardType={Platform.OS === 'web' ? 'default' : 'numeric'}
                      style={styles.input}
                      testID="fve-instant-final"
                    />
                  </View>
                  <View style={styles.formItem}>
                    <Text style={styles.inputLabel}>NextCruise ID</Text>
                    <TextInput
                      value={ncId}
                      onChangeText={(t: string) => setNcId(t)}
                      placeholder="bonus id"
                      style={styles.input}
                      testID="fve-nc-id"
                    />
                  </View>
                </View>

                <View style={styles.formRow}>
                  <View style={styles.formItem}>
                    <Text style={styles.inputLabel}>NextCruise Value</Text>
                    <TextInput
                      value={ncVal}
                      onChangeText={(t: string) => setNcVal(t.replace(/[^0-9]/g, ''))}
                      placeholder="0"
                      keyboardType={Platform.OS === 'web' ? 'default' : 'numeric'}
                      style={styles.input}
                      testID="fve-nc-value"
                    />
                  </View>
                  <View style={styles.formItem}>
                    <Text style={styles.inputLabel}>Override Reason</Text>
                    <TextInput
                      value={overrideReason}
                      onChangeText={(t: string) => setOverrideReason(t)}
                      placeholder="why overriding"
                      style={styles.input}
                      testID="fve-override-reason"
                    />
                  </View>
                </View>

                <View style={styles.inlineActions}>
                  <TouchableOpacity
                    style={[styles.smallBtn, styles.secondaryBtn]}
                    onPress={() => {
                      if (!cruiseId) return;
                      setCertCode(data?.selected_cert_code ?? '');
                      setPath((data?.selected_path as 'A' | 'C' | undefined) ?? '');
                      setLevel(data?.level ?? '');
                      setMinVal(data?.instant_value_min_usd != null ? String(data.instant_value_min_usd) : '');
                      setMaxVal(data?.instant_value_max_usd != null ? String(data.instant_value_max_usd) : '');
                      setFinalVal(data?.instant_value_final_usd != null ? String(data.instant_value_final_usd) : '');
                      setNcId(data?.nextcruise_bonus_id ?? '');
                      setNcVal(data?.nextcruise_value_usd != null ? String(data.nextcruise_value_usd) : '');
                      setOverrideReason(data?.override_reason ?? '');
                    }}
                    testID="fve-reset"
                  >
                    <RefreshCw size={16} color="#3B82F6" />
                    <Text style={styles.smallBtnTextAlt}>Reset</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.smallBtn, styles.primaryBtn]}
                    onPress={() => {
                      if (!cruiseId) return;
                      const payload = {
                        selected_cert_code: certCode || undefined,
                        selected_path: path === '' ? undefined : path,
                        level: level || undefined,
                        instant_value_min_usd: minVal ? Number(minVal) : undefined,
                        instant_value_max_usd: maxVal ? Number(maxVal) : undefined,
                        instant_value_final_usd: finalVal ? Number(finalVal) : undefined,
                        nextcruise_bonus_id: ncId || undefined,
                        nextcruise_value_usd: ncVal ? Number(ncVal) : undefined,
                        override_reason: overrideReason || undefined,
                      } as const;
                      saveMutation.mutate({ cruiseId: String(cruiseId), data: payload }, {
                        onSuccess: async () => {
                          try {
                            const res = await linkQuery.refetch();
                            const latest = res.data ?? data;
                            const fveTotal = Number(latest?.fve_total_usd ?? 0);
                            const roi = Number(latest?.roi_vs_coinin ?? 0);
                            if (cruiseId) emitFveUpdated({ cruiseId: String(cruiseId), fveTotalUsd: fveTotal, roi });
                          } catch (e) {
                            if (Platform.OS === 'web') console.error('[FVE] Refetch after save failed', e);
                          }
                          if (Platform.OS === 'web') console.log('[FVE] Saved evaluation');
                        },
                        onError: (e) => {
                          if (Platform.OS !== 'web') {
                            Alert.alert('Save failed', e.message);
                          } else {
                            console.error('[FVE] Save failed', e);
                          }
                        }
                      });
                    }}
                    testID="fve-apply"
                  >
                    <Save size={16} color="#FFFFFF" />
                    <Text style={styles.smallBtnText}>Apply</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>

            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <DollarSign size={18} color="#22C55E" />
                <Text style={styles.sectionTitle}>Totals & ROI</Text>
              </View>
              <View style={styles.card}>
                <View style={styles.statsRow}>
                  <View style={styles.statBox}>
                    <Text style={styles.dimText}>Instant Value</Text>
                    <Text style={styles.valueText}>${(data?.instant_value_final_usd ?? 0).toLocaleString()}</Text>
                  </View>
                  <View style={styles.statBox}>
                    <Text style={styles.dimText}>NextCruise</Text>
                    <Text style={styles.valueText}>${(data?.nextcruise_value_usd ?? 0).toLocaleString()}</Text>
                  </View>
                </View>
                <View style={[styles.statsRow, { marginTop: 8 }]}>
                  <View style={[styles.statBox, styles.totalBox]}>
                    <Text style={styles.totalLabel}>FVE Total</Text>
                    <Text style={styles.totalValue}>${(data?.fve_total_usd ?? 0).toLocaleString()}</Text>
                  </View>
                  <View style={styles.statBox}>
                    <Text style={styles.dimText}>ROI vs Coin-in</Text>
                    <Text style={styles.valueText}>{Math.round((data?.roi_vs_coinin ?? 0) * 100)}%</Text>
                  </View>
                </View>
              </View>
            </View>

            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <FileText size={18} color="#111827" />
                <Text style={styles.sectionTitle}>Notes</Text>
              </View>
              <View style={styles.card}>
                <Text style={styles.dimText}>Override Reason</Text>
                <Text style={styles.valueText}>{data?.override_reason ?? '—'}</Text>
              </View>
            </View>
          </ScrollView>

          <View style={styles.footerActions}>
            <View style={styles.footerRow}>
              <TouchableOpacity
                style={[styles.saveBtn, { backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#3B82F6' }]}
                onPress={async () => {
                if (!cruiseId) return;
                try {
                  const res = await exportQuery.refetch();
                  const file = res.data;
                  if (!file) return;
                  if (Platform.OS === 'web') {
                    try {
                      const blob = new Blob([file.csv], { type: 'text/csv;charset=utf-8;' });
                      const url = URL.createObjectURL(blob);
                      const a = document.createElement('a');
                      a.href = url;
                      a.download = file.filename;
                      document.body.appendChild(a);
                      a.click();
                      document.body.removeChild(a);
                      URL.revokeObjectURL(url);
                    } catch (e) {
                      console.error('[FVE] Web export failed', e);
                    }
                  } else {
                    await Clipboard.setStringAsync(file.csv);
                    Alert.alert('Export Ready', 'CSV copied to clipboard');
                  }
                } catch (e: any) {
                  if (Platform.OS === 'web') {
                    console.error('[FVE] Export error', e);
                  } else {
                    Alert.alert('Export failed', e?.message ?? 'Unknown error');
                  }
                }
              }}
              testID="fve-export"
            >
              <FileText size={18} color="#3B82F6" />
              <Text style={[styles.saveText, { color: '#3B82F6' }]}>Export CSV</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.saveBtn, { backgroundColor: '#111827' }]}
              onPress={() => {
                if (!cruiseId) return;
                router.push('/fve/admin/catalog');
              }}
              testID="fve-open-admin"
            >
              <Settings size={18} color="#FFFFFF" />
              <Text style={styles.saveText}>Admin</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.saveBtn}
              onPress={() => {
                if (!cruiseId) return;
                const payload = {
                  selected_cert_code: certCode || undefined,
                  selected_path: path === '' ? undefined : path,
                  level: level || undefined,
                  instant_value_min_usd: minVal ? Number(minVal) : undefined,
                  instant_value_max_usd: maxVal ? Number(maxVal) : undefined,
                  instant_value_final_usd: finalVal ? Number(finalVal) : undefined,
                  nextcruise_bonus_id: ncId || undefined,
                  nextcruise_value_usd: ncVal ? Number(ncVal) : undefined,
                  override_reason: overrideReason || undefined,
                } as const;
                saveMutation.mutate({ cruiseId: String(cruiseId), data: payload }, {
                  onSuccess: async () => {
                    const res = await linkQuery.refetch();
                    const latest = res.data ?? data;
                    const fveTotal = Number(latest?.fve_total_usd ?? 0);
                    const roi = Number(latest?.roi_vs_coinin ?? 0);
                    emitFveUpdated({ cruiseId: String(cruiseId), fveTotalUsd: fveTotal, roi });
                  }
                });
              }}
              testID="fve-save"
            >
              <Save size={18} color="#FFFFFF" />
              <Text style={styles.saveText}>Save</Text>
            </TouchableOpacity>
            </View>
          </View>
        </ErrorBoundary>
      </SafeAreaView>
    </>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8FAFC' },
  scroll: { padding: 16 },
  headerCard: { backgroundColor: '#FFFFFF', borderRadius: 12, padding: 16, borderWidth: 1, borderColor: '#E5E7EB', marginBottom: 16 },
  ship: { fontSize: 20, fontWeight: '800', color: '#3B82F6', marginBottom: 4 },
  meta: { fontSize: 12, color: '#6B7280', marginBottom: 8 },
  row: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
  kvLabel: { fontSize: 12, color: '#6B7280' },
  kvValue: { fontSize: 14, color: '#111827', fontWeight: '700' },
  section: { marginBottom: 16 },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: '#111827' },
  card: { backgroundColor: '#FFFFFF', borderRadius: 12, padding: 16, borderWidth: 1, borderColor: '#E5E7EB' },
  dimText: { fontSize: 12, color: '#6B7280' },
  valueText: { fontSize: 16, fontWeight: '700', color: '#111827' },
  statsRow: { flexDirection: 'row', gap: 12 },
  statBox: { flex: 1, backgroundColor: '#F8FAFC', borderRadius: 8, padding: 12, borderWidth: 1, borderColor: '#E5E7EB' },
  totalBox: { backgroundColor: '#ECFDF5', borderColor: '#22C55E' },
  totalLabel: { fontSize: 12, color: '#16A34A' },
  totalValue: { fontSize: 20, fontWeight: '800', color: '#15803D' },
  formRow: { flexDirection: 'row', gap: 12, marginBottom: 12 },
  formItem: { flex: 1 },
  formItemSmall: { width: 88 },
  inputLabel: { fontSize: 12, color: '#6B7280', marginBottom: 6 },
  input: { backgroundColor: '#F9FAFB', borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 10, fontSize: 14, color: '#111827' },
  rowGap: { flexDirection: 'row', gap: 8 },
  toggleBtn: { flex: 1, backgroundColor: '#F3F4F6', borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 8, paddingVertical: 10, alignItems: 'center' },
  toggleBtnActive: { backgroundColor: '#DBEAFE', borderColor: '#3B82F6' },
  toggleText: { fontSize: 14, color: '#6B7280', fontWeight: '700' },
  toggleTextActive: { color: '#1D4ED8' },
  inlineActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 12, marginTop: 8 },
  smallBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 10, borderRadius: 8 },
  primaryBtn: { backgroundColor: '#3B82F6' },
  secondaryBtn: { backgroundColor: '#EFF6FF', borderWidth: 1, borderColor: '#BFDBFE' },
  smallBtnText: { color: '#FFFFFF', fontWeight: '700' },
  smallBtnTextAlt: { color: '#1D4ED8', fontWeight: '700' },
  footerActions: { padding: 16, borderTopWidth: 1, borderTopColor: '#E5E7EB', backgroundColor: '#FFFFFF' },
  footerRow: { flexDirection: 'row', gap: 12 },
  saveBtn: { backgroundColor: '#3B82F6', borderRadius: 10, paddingVertical: 12, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 8 },
  saveText: { color: '#FFFFFF', fontWeight: '700' },
  headerIconPad: { padding: 8 },
  needsMapRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 6 },
  suggestionBox: { marginBottom: 10 },
});
