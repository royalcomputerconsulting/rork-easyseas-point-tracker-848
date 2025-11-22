import React, { useState } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, TextInput, ActivityIndicator, Alert } from 'react-native';
import { Stack } from 'expo-router';
import { trpc, isBackendEnabled } from '@/lib/trpc';
import { Link2, CheckCircle, RefreshCw } from 'lucide-react-native';

interface LinkDraft { [id: string]: string; }

export default function UnlinkedFinancialsScreen() {
  const unlinkedQuery = trpc.financials.unlinked.useQuery(undefined, { enabled: isBackendEnabled, refetchOnWindowFocus: false });
  const linkMutation = trpc.financials.linkRecord.useMutation();
  const [drafts, setDrafts] = useState<LinkDraft>({});

  const data = unlinkedQuery.data ?? [];
  const isLoading = unlinkedQuery.isLoading || !isBackendEnabled;

  const onLink = async (id: string) => {
    try {
      const cruiseId = (drafts[id] ?? '').trim();
      if (!cruiseId) {
        Alert.alert('Missing Cruise ID', 'Enter a cruiseId to link');
        return;
      }
      await linkMutation.mutateAsync({ id, cruiseId, verify: true });
      setDrafts((d) => ({ ...d, [id]: '' }));
      await unlinkedQuery.refetch();
      Alert.alert('Linked', 'Record linked and verified');
    } catch (e: any) {
      Alert.alert('Failed', e?.message ?? 'Link failed');
    }
  };

  const renderItem = ({ item }: { item: any }) => {
    const subtitle = [item.sourceType, item.shipName, item.sailDateStart].filter(Boolean).join(' • ');
    const amt = typeof item.amount === 'number' ? item.amount : (typeof item.lineTotal === 'number' ? item.lineTotal : 0);
    return (
      <View style={styles.card} testID={`fin-${item.id}`}>
        <View style={styles.rowBetween}>
          <View style={{ flex: 1 }}>
            <Text style={styles.title}>{item.description || item.itemDescription || 'Unlabeled'}</Text>
            <Text style={styles.subtitle}>{subtitle}</Text>
            <Text style={styles.meta}>${Number(amt).toLocaleString()} • {item.category || item.department || 'Uncategorized'}</Text>
          </View>
        </View>
        <View style={styles.linkRow}>
          <TextInput
            style={styles.input}
            placeholder="Enter cruiseId"
            placeholderTextColor="#9CA3AF"
            value={drafts[item.id] ?? ''}
            onChangeText={(t) => setDrafts((d) => ({ ...d, [item.id]: t }))}
            autoCapitalize="none"
            autoCorrect={false}
            testID={`input-${item.id}`}
          />
          <TouchableOpacity style={styles.linkBtn} onPress={() => onLink(item.id)} disabled={linkMutation.isPending} testID={`link-${item.id}`}>
            {linkMutation.isPending ? <ActivityIndicator color="#FFFFFF" /> : <Link2 size={16} color="#FFFFFF" />}
            <Text style={styles.linkBtnText}>Link</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ title: 'Resolve Unlinked Items' }} />
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Unlinked Financial Records</Text>
        <TouchableOpacity onPress={() => unlinkedQuery.refetch()} style={styles.refreshBtn} testID="refresh-unlinked">
          <RefreshCw size={14} color="#FFFFFF" />
          <Text style={styles.refreshText}>Refresh</Text>
        </TouchableOpacity>
      </View>
      {isLoading ? (
        <View style={styles.center}> 
          <ActivityIndicator size="large" color="#6C5CE7" />
          <Text style={styles.loading}>Loading…</Text>
        </View>
      ) : data.length === 0 ? (
        <View style={styles.center}>
          <CheckCircle size={32} color="#10B981" />
          <Text style={styles.empty}>All records are linked and verified</Text>
        </View>
      ) : (
        <FlatList
          data={data}
          keyExtractor={(item) => String(item.id)}
          renderItem={renderItem}
          contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
          ItemSeparatorComponent={() => <View style={{ height: 12 }} />}
          testID="unlinked-list"
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8FAFC' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 16 },
  headerTitle: { fontSize: 18, fontWeight: '700', color: '#111827' },
  refreshBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#6C5CE7', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8 },
  refreshText: { color: '#FFFFFF', fontSize: 12, fontWeight: '600' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 8 },
  loading: { color: '#6B7280', fontSize: 14 },
  empty: { color: '#6B7280', fontSize: 14, marginTop: 4 },
  card: { backgroundColor: '#FFFFFF', borderRadius: 12, borderWidth: 1, borderColor: '#E5E7EB', padding: 12 },
  rowBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  title: { fontSize: 14, fontWeight: '700', color: '#111827' },
  subtitle: { fontSize: 12, color: '#6B7280', marginTop: 2 },
  meta: { fontSize: 12, color: '#111827', marginTop: 2, fontWeight: '600' },
  linkRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 10 },
  input: { flex: 1, backgroundColor: '#F3F4F6', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 8, fontSize: 14, color: '#111827', borderWidth: 1, borderColor: '#E5E7EB' },
  linkBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#10B981', paddingHorizontal: 12, paddingVertical: 10, borderRadius: 8 },
  linkBtnText: { color: '#FFFFFF', fontSize: 14, fontWeight: '700' },
});
