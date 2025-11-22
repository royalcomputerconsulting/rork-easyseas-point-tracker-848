import React from 'react';
import { Stack } from 'expo-router';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, FlatList, ActivityIndicator, Platform, Alert } from 'react-native';
import { Plus, Save, RefreshCw } from 'lucide-react-native';
import { trpc } from '@/lib/trpc';

interface BonusForm {
  id?: string;
  min_points: string;
  free_play_usd?: string;
  credits_usd?: string;
  note?: string;
}

export default function BonusesAdminScreen() {
  const listQuery = trpc.fve.listBonuses.useQuery();
  const upsert = trpc.fve.upsertBonus.useMutation();

  const [form, setForm] = React.useState<BonusForm>({ min_points: '', free_play_usd: '', credits_usd: '', note: '' });

  const resetForm = React.useCallback(() => setForm({ min_points: '', free_play_usd: '', credits_usd: '', note: '' }), []);

  const handleSave = React.useCallback(() => {
    try {
      const payload = {
        id: form.id || undefined,
        min_points: parseInt(form.min_points || '0', 10) || 0,
        free_play_usd: form.free_play_usd ? parseInt(form.free_play_usd, 10) || 0 : undefined,
        credits_usd: form.credits_usd ? parseInt(form.credits_usd, 10) || 0 : undefined,
        note: form.note?.trim() || undefined,
      } as const;
      upsert.mutate(payload, {
        onSuccess: () => {
          listQuery.refetch();
          resetForm();
          if (Platform.OS !== 'web') Alert.alert('Saved', 'Bonus saved');
        },
        onError: (e) => {
          if (Platform.OS !== 'web') Alert.alert('Error', e.message);
          else console.error(e);
        }
      });
    } catch (e) {
      console.error('[FVE Admin Bonuses] Save error', e);
    }
  }, [form, upsert, listQuery, resetForm]);

  return (
    <View style={styles.container} testID="fve-admin-bonuses">
      <Stack.Screen options={{ title: 'FVE Bonuses' }} />
      <View style={styles.toolbar}>
        <TouchableOpacity onPress={() => listQuery.refetch()} style={[styles.toolBtn, styles.secondary]} testID="fve-admin-bonuses-refresh">
          {listQuery.isFetching ? <ActivityIndicator size="small" color="#3B82F6" /> : <RefreshCw size={16} color="#1D4ED8" />}
          <Text style={styles.toolBtnTextAlt}>Refresh</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.form}>
        <Text style={styles.formTitle}>New / Edit</Text>
        <View style={styles.row}>
          <View style={styles.col}>
            <Text style={styles.label}>Min Points</Text>
            <TextInput value={form.min_points} onChangeText={(t: string) => setForm(s => ({ ...s, min_points: t.replace(/[^0-9]/g, '') }))} placeholder="0" keyboardType={Platform.OS === 'web' ? 'default' : 'numeric'} style={styles.input} testID="fve-admin-bonus-minpoints" />
          </View>
          <View style={styles.col}>
            <Text style={styles.label}>Free Play ($)</Text>
            <TextInput value={form.free_play_usd} onChangeText={(t: string) => setForm(s => ({ ...s, free_play_usd: t.replace(/[^0-9]/g, '') }))} placeholder="0" keyboardType={Platform.OS === 'web' ? 'default' : 'numeric'} style={styles.input} />
          </View>
        </View>
        <View style={styles.row}>
          <View style={styles.col}>
            <Text style={styles.label}>Credits ($)</Text>
            <TextInput value={form.credits_usd} onChangeText={(t: string) => setForm(s => ({ ...s, credits_usd: t.replace(/[^0-9]/g, '') }))} placeholder="0" keyboardType={Platform.OS === 'web' ? 'default' : 'numeric'} style={styles.input} />
          </View>
          <View style={styles.col}>
            <Text style={styles.label}>Note</Text>
            <TextInput value={form.note} onChangeText={(t: string) => setForm(s => ({ ...s, note: t }))} placeholder="upgrade note" style={styles.input} />
          </View>
        </View>
        <View style={styles.actions}>
          <TouchableOpacity onPress={resetForm} style={[styles.btn, styles.secondary]} testID="fve-admin-bonuses-reset">
            <RefreshCw size={16} color="#1D4ED8" />
            <Text style={styles.btnTextAlt}>Reset</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={handleSave} style={[styles.btn, styles.primary]} testID="fve-admin-bonuses-save">
            <Save size={16} color="#FFFFFF" />
            <Text style={styles.btnText}>Save</Text>
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.listHeader}>
        <Plus size={16} color="#1F2937" />
        <Text style={styles.listTitle}>NextCruise Bonus Chart</Text>
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
                min_points: String(item.min_points ?? ''),
                free_play_usd: item.free_play_usd != null ? String(item.free_play_usd) : '',
                credits_usd: item.credits_usd != null ? String(item.credits_usd) : '',
                note: String(item.note ?? ''),
              })}
              testID={`fve-admin-bonus-row-${String(item.id)}`}
            >
              <Text style={styles.itemTitle}>{String(item.min_points)} pts</Text>
              <Text style={styles.itemSub}>FP ${String(item.free_play_usd ?? 0)} · Credits ${String(item.credits_usd ?? 0)} {item.note ? `• ${String(item.note)}` : ''}</Text>
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
