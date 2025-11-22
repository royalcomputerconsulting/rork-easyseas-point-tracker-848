import React from 'react';
import { Stack } from 'expo-router';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, FlatList, ActivityIndicator, Platform, Alert } from 'react-native';
import { Plus, Save, RefreshCw } from 'lucide-react-native';
import { trpc } from '@/lib/trpc';

interface PricingForm {
  id?: string;
  shipClass: string;
  itineraryBucket: string;
  seasonality: string;
  nights: string;
  cabin: string;
  totalCabinPriceUsd: string;
}

export default function PricingAdminScreen() {
  const listQuery = trpc.fve.listPricing.useQuery();
  const upsert = trpc.fve.upsertPricing.useMutation();

  const [form, setForm] = React.useState<PricingForm>({ shipClass: '', itineraryBucket: '', seasonality: '', nights: '', cabin: '', totalCabinPriceUsd: '' });

  const resetForm = React.useCallback(() => setForm({ shipClass: '', itineraryBucket: '', seasonality: '', nights: '', cabin: '', totalCabinPriceUsd: '' }), []);

  const handleSave = React.useCallback(() => {
    try {
      const payload = {
        id: form.id || undefined,
        shipClass: form.shipClass.trim(),
        itineraryBucket: form.itineraryBucket.trim(),
        seasonality: form.seasonality.trim(),
        nights: parseInt(form.nights || '0', 10) || 0,
        cabin: form.cabin.trim(),
        totalCabinPriceUsd: parseInt(form.totalCabinPriceUsd || '0', 10) || 0,
      } as const;
      upsert.mutate(payload, {
        onSuccess: () => {
          listQuery.refetch();
          resetForm();
          if (Platform.OS !== 'web') Alert.alert('Saved', 'Pricing saved');
        },
        onError: (e) => {
          if (Platform.OS !== 'web') Alert.alert('Error', e.message);
          else console.error(e);
        }
      });
    } catch (e) {
      console.error('[FVE Admin Pricing] Save error', e);
    }
  }, [form, upsert, listQuery, resetForm]);

  return (
    <View style={styles.container} testID="fve-admin-pricing">
      <Stack.Screen options={{ title: 'FVE Pricing' }} />
      <View style={styles.toolbar}>
        <TouchableOpacity onPress={() => listQuery.refetch()} style={[styles.toolBtn, styles.secondary]} testID="fve-admin-pricing-refresh">
          {listQuery.isFetching ? <ActivityIndicator size="small" color="#3B82F6" /> : <RefreshCw size={16} color="#1D4ED8" />}
          <Text style={styles.toolBtnTextAlt}>Refresh</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.form}>
        <Text style={styles.formTitle}>New / Edit</Text>
        <View style={styles.row}>
          <View style={styles.col}>
            <Text style={styles.label}>Ship Class</Text>
            <TextInput value={form.shipClass} onChangeText={(t: string) => setForm(s => ({ ...s, shipClass: t }))} placeholder="Oasis" style={styles.input} testID="fve-admin-pricing-shipclass" />
          </View>
          <View style={styles.col}>
            <Text style={styles.label}>Itinerary Bucket</Text>
            <TextInput value={form.itineraryBucket} onChangeText={(t: string) => setForm(s => ({ ...s, itineraryBucket: t }))} placeholder="Caribbean" style={styles.input} />
          </View>
        </View>
        <View style={styles.row}>
          <View style={styles.col}>
            <Text style={styles.label}>Seasonality</Text>
            <TextInput value={form.seasonality} onChangeText={(t: string) => setForm(s => ({ ...s, seasonality: t }))} placeholder="Peak" style={styles.input} />
          </View>
          <View style={styles.col}>
            <Text style={styles.label}>Nights</Text>
            <TextInput value={form.nights} onChangeText={(t: string) => setForm(s => ({ ...s, nights: t.replace(/[^0-9]/g, '') }))} placeholder="7" keyboardType={Platform.OS === 'web' ? 'default' : 'numeric'} style={styles.input} />
          </View>
        </View>
        <View style={styles.row}>
          <View style={styles.col}>
            <Text style={styles.label}>Cabin</Text>
            <TextInput value={form.cabin} onChangeText={(t: string) => setForm(s => ({ ...s, cabin: t }))} placeholder="Balcony" style={styles.input} />
          </View>
          <View style={styles.col}>
            <Text style={styles.label}>Total Cabin Price ($)</Text>
            <TextInput value={form.totalCabinPriceUsd} onChangeText={(t: string) => setForm(s => ({ ...s, totalCabinPriceUsd: t.replace(/[^0-9]/g, '') }))} placeholder="0" keyboardType={Platform.OS === 'web' ? 'default' : 'numeric'} style={styles.input} />
          </View>
        </View>
        <View style={styles.actions}>
          <TouchableOpacity onPress={resetForm} style={[styles.btn, styles.secondary]} testID="fve-admin-pricing-reset">
            <RefreshCw size={16} color="#1D4ED8" />
            <Text style={styles.btnTextAlt}>Reset</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={handleSave} style={[styles.btn, styles.primary]} testID="fve-admin-pricing-save">
            <Save size={16} color="#FFFFFF" />
            <Text style={styles.btnText}>Save</Text>
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.listHeader}>
        <Plus size={16} color="#1F2937" />
        <Text style={styles.listTitle}>Pricing Models</Text>
      </View>

      {listQuery.isLoading ? (
        <View style={styles.center}><ActivityIndicator size="small" color="#3B82F6" /></View>
      ) : (
        <FlatList
          data={listQuery.data ?? []}
          keyExtractor={(item: any) => String(item.id)}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={styles.item}
              onPress={() => setForm({
                id: String(item.id),
                shipClass: String(item.shipClass ?? ''),
                itineraryBucket: String(item.itineraryBucket ?? ''),
                seasonality: String(item.seasonality ?? ''),
                nights: String(item.nights ?? ''),
                cabin: String(item.cabin ?? ''),
                totalCabinPriceUsd: String(item.totalCabinPriceUsd ?? ''),
              })}
              testID={`fve-admin-pricing-row-${String(item.id)}`}
            >
              <Text style={styles.itemTitle}>{String(item.shipClass)} · {String(item.itineraryBucket)} · {String(item.seasonality)} · {String(item.nights)}N · {String(item.cabin)}</Text>
              <Text style={styles.itemSub}>${String(item.totalCabinPriceUsd ?? 0)}</Text>
            </TouchableOpacity>
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8FAFC', padding: 16 },
  toolbar: { flexDirection: 'row', justifyContent: 'flex-end', marginBottom: 8, gap: 8 },
  toolBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 10, borderRadius: 8 },
  toolBtnTextAlt: { color: '#1D4ED8', fontWeight: '700' },
  primary: { backgroundColor: '#3B82F6' },
  secondary: { backgroundColor: '#EFF6FF', borderWidth: 1, borderColor: '#BFDBFE' },
  form: { backgroundColor: '#FFFFFF', borderRadius: 12, borderWidth: 1, borderColor: '#E5E7EB', padding: 12, marginBottom: 12 },
  formTitle: { fontSize: 14, fontWeight: '700', color: '#111827', marginBottom: 8 },
  row: { flexDirection: 'row', gap: 12, marginBottom: 8 },
  col: { flex: 1 },
  label: { fontSize: 12, color: '#6B7280', marginBottom: 6 },
  input: { backgroundColor: '#F9FAFB', borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 10, fontSize: 14, color: '#111827' },
  actions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 12, marginTop: 4 },
  btn: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 10, borderRadius: 8 },
  btnText: { color: '#FFFFFF', fontWeight: '700' },
  btnTextAlt: { color: '#1D4ED8', fontWeight: '700' },
  listHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  listTitle: { fontSize: 16, fontWeight: '700', color: '#111827' },
  center: { alignItems: 'center', justifyContent: 'center', paddingVertical: 16 },
  item: { backgroundColor: '#FFFFFF', borderRadius: 10, borderWidth: 1, borderColor: '#E5E7EB', padding: 12, marginBottom: 8 },
  itemTitle: { fontSize: 14, fontWeight: '700', color: '#111827' },
  itemSub: { fontSize: 12, color: '#6B7280' },
});
