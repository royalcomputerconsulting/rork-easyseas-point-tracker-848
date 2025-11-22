import React from 'react';
import { Stack } from 'expo-router';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, FlatList, ActivityIndicator, Platform, Alert } from 'react-native';
import { Plus, Save, RefreshCw } from 'lucide-react-native';
import { trpc } from '@/lib/trpc';

interface CatalogForm {
  id?: string;
  codePattern: string;
  path: 'A' | 'C';
  level: string;
  minPoints: string;
  notes?: string;
  overrides_nights?: string;
  overrides_cabin?: string;
  overrides_min?: string;
  overrides_max?: string;
}

export default function CatalogAdminScreen() {
  const listQuery = trpc.fve.listCatalog.useQuery();
  const upsert = trpc.fve.upsertCatalog.useMutation();

  const [form, setForm] = React.useState<CatalogForm>({
    codePattern: '',
    path: 'A',
    level: '',
    minPoints: '',
    notes: '',
    overrides_nights: '',
    overrides_cabin: '',
    overrides_min: '',
    overrides_max: '',
  });

  const resetForm = React.useCallback(() => {
    setForm({ codePattern: '', path: 'A', level: '', minPoints: '', notes: '', overrides_nights: '', overrides_cabin: '', overrides_min: '', overrides_max: '' });
  }, []);

  const handleSave = React.useCallback(() => {
    try {
      const payload = {
        id: form.id || undefined,
        codePattern: form.codePattern.trim(),
        path: form.path,
        level: form.level.trim(),
        minPoints: parseInt(form.minPoints || '0', 10) || 0,
        notes: form.notes?.trim() || undefined,
        overrides: ((): { nights?: number; cabin?: string; min?: number; max?: number } | undefined => {
          const nights = parseInt(form.overrides_nights || '', 10);
          const min = parseInt(form.overrides_min || '', 10);
          const max = parseInt(form.overrides_max || '', 10);
          const cabin = form.overrides_cabin?.trim();
          const hasAny = (!Number.isNaN(nights) && nights > 0) || !!cabin || (!Number.isNaN(min) && min >= 0) || (!Number.isNaN(max) && max >= 0);
          if (!hasAny) return undefined;
          return {
            nights: !Number.isNaN(nights) && nights > 0 ? nights : undefined,
            cabin: cabin || undefined,
            min: !Number.isNaN(min) && min >= 0 ? min : undefined,
            max: !Number.isNaN(max) && max >= 0 ? max : undefined,
          };
        })()
      } as const;
      upsert.mutate(payload, {
        onSuccess: () => {
          listQuery.refetch();
          resetForm();
          if (Platform.OS !== 'web') Alert.alert('Saved', 'Catalog entry saved');
        },
        onError: (e) => {
          if (Platform.OS !== 'web') Alert.alert('Error', e.message);
          else console.error(e);
        }
      });
    } catch (e) {
      console.error('[FVE Admin Catalog] Save error', e);
    }
  }, [form, upsert, listQuery, resetForm]);

  return (
    <View style={styles.container} testID="fve-admin-catalog">
      <Stack.Screen options={{ title: 'FVE Catalog' }} />
      <View style={styles.toolbar}>
        <TouchableOpacity onPress={() => listQuery.refetch()} style={[styles.toolBtn, styles.secondary]} testID="fve-admin-catalog-refresh">
          {listQuery.isFetching ? <ActivityIndicator size="small" color="#3B82F6" /> : <RefreshCw size={16} color="#1D4ED8" />}
          <Text style={styles.toolBtnTextAlt}>Refresh</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.form}>
        <Text style={styles.formTitle}>New / Edit</Text>
        <View style={styles.row}>
          <View style={styles.col}>
            <Text style={styles.label}>Code Pattern</Text>
            <TextInput value={form.codePattern} onChangeText={(t: string) => setForm(s => ({ ...s, codePattern: t }))} placeholder="2411(A|C)(VIP2|01-08)" style={styles.input} testID="fve-admin-catalog-code" />
          </View>
          <View style={[styles.col, styles.colSmall]}>
            <Text style={styles.label}>Path</Text>
            <View style={styles.toggleRow}>
              <TouchableOpacity style={[styles.toggle, form.path === 'A' && styles.toggleActive]} onPress={() => setForm(s => ({ ...s, path: 'A' }))} testID="fve-admin-catalog-path-a">
                <Text style={[styles.toggleText, form.path === 'A' && styles.toggleTextActive]}>A</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.toggle, form.path === 'C' && styles.toggleActive]} onPress={() => setForm(s => ({ ...s, path: 'C' }))} testID="fve-admin-catalog-path-c">
                <Text style={[styles.toggleText, form.path === 'C' && styles.toggleTextActive]}>C</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
        <View style={styles.row}>
          <View style={styles.col}>
            <Text style={styles.label}>Level</Text>
            <TextInput value={form.level} onChangeText={(t: string) => setForm(s => ({ ...s, level: t }))} placeholder="VIP2 or 01-08" style={styles.input} testID="fve-admin-catalog-level" />
          </View>
          <View style={styles.col}>
            <Text style={styles.label}>Min Points</Text>
            <TextInput value={form.minPoints} onChangeText={(t: string) => setForm(s => ({ ...s, minPoints: t.replace(/[^0-9]/g, '') }))} placeholder="0" keyboardType={Platform.OS === 'web' ? 'default' : 'numeric'} style={styles.input} testID="fve-admin-catalog-minpoints" />
          </View>
        </View>
        <View style={styles.row}>
          <View style={styles.col}>
            <Text style={styles.label}>Notes</Text>
            <TextInput value={form.notes} onChangeText={(t: string) => setForm(s => ({ ...s, notes: t }))} placeholder="notes" style={styles.input} />
          </View>
        </View>
        <Text style={styles.subtle}>Overrides</Text>
        <View style={styles.row}>
          <View style={styles.col}>
            <Text style={styles.label}>Nights</Text>
            <TextInput value={form.overrides_nights} onChangeText={(t: string) => setForm(s => ({ ...s, overrides_nights: t.replace(/[^0-9]/g, '') }))} placeholder="7" keyboardType={Platform.OS === 'web' ? 'default' : 'numeric'} style={styles.input} />
          </View>
          <View style={styles.col}>
            <Text style={styles.label}>Cabin</Text>
            <TextInput value={form.overrides_cabin} onChangeText={(t: string) => setForm(s => ({ ...s, overrides_cabin: t }))} placeholder="Balcony" style={styles.input} />
          </View>
        </View>
        <View style={styles.row}>
          <View style={styles.col}>
            <Text style={styles.label}>Min $</Text>
            <TextInput value={form.overrides_min} onChangeText={(t: string) => setForm(s => ({ ...s, overrides_min: t.replace(/[^0-9]/g, '') }))} placeholder="0" keyboardType={Platform.OS === 'web' ? 'default' : 'numeric'} style={styles.input} />
          </View>
          <View style={styles.col}>
            <Text style={styles.label}>Max $</Text>
            <TextInput value={form.overrides_max} onChangeText={(t: string) => setForm(s => ({ ...s, overrides_max: t.replace(/[^0-9]/g, '') }))} placeholder="0" keyboardType={Platform.OS === 'web' ? 'default' : 'numeric'} style={styles.input} />
          </View>
        </View>
        <View style={styles.actions}>
          <TouchableOpacity onPress={resetForm} style={[styles.btn, styles.secondary]} testID="fve-admin-catalog-reset">
            <RefreshCw size={16} color="#1D4ED8" />
            <Text style={styles.btnTextAlt}>Reset</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={handleSave} style={[styles.btn, styles.primary]} testID="fve-admin-catalog-save">
            <Save size={16} color="#FFFFFF" />
            <Text style={styles.btnText}>Save</Text>
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.listHeader}>
        <Plus size={16} color="#1F2937" />
        <Text style={styles.listTitle}>Catalog</Text>
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
                codePattern: String(item.codePattern ?? ''),
                path: (item.path as 'A' | 'C') ?? 'A',
                level: String(item.level ?? ''),
                minPoints: String(item.minPoints ?? ''),
                notes: String(item.notes ?? ''),
                overrides_nights: item.overrides?.nights != null ? String(item.overrides.nights) : '',
                overrides_cabin: String(item.overrides?.cabin ?? ''),
                overrides_min: item.overrides?.min != null ? String(item.overrides.min) : '',
                overrides_max: item.overrides?.max != null ? String(item.overrides.max) : '',
              })}
              testID={`fve-admin-catalog-row-${String(item.id)}`}
            >
              <Text style={styles.itemTitle}>{String(item.codePattern)} · {String(item.level)} ({String(item.path)})</Text>
              <Text style={styles.itemSub}>minPts {String(item.minPoints)} {item.notes ? `• ${String(item.notes)}` : ''}</Text>
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
  colSmall: { width: 92 },
  label: { fontSize: 12, color: '#6B7280', marginBottom: 6 },
  input: { backgroundColor: '#F9FAFB', borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 10, fontSize: 14, color: '#111827' },
  subtle: { fontSize: 12, color: '#6B7280', marginTop: 4, marginBottom: 4 },
  toggleRow: { flexDirection: 'row', gap: 8 },
  toggle: { flex: 1, backgroundColor: '#F3F4F6', borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 8, paddingVertical: 10, alignItems: 'center' },
  toggleActive: { backgroundColor: '#DBEAFE', borderColor: '#3B82F6' },
  toggleText: { fontSize: 14, color: '#6B7280', fontWeight: '700' },
  toggleTextActive: { color: '#1D4ED8' },
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
