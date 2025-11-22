import React, { useCallback, useMemo, useState } from 'react';
import { Stack } from 'expo-router';
import { Alert, Platform, RefreshControl, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Download, FileSpreadsheet, RefreshCw, Save, ShieldCheck, XCircle } from 'lucide-react-native';
import { trpc } from '@/lib/trpc';
import LoadingState from '@/components/LoadingState';
import ErrorState from '@/components/ErrorState';
import { COLORS } from '@/constants/theme';

export default function ProcessRetailPricingPage() {
  const [refreshing, setRefreshing] = useState<boolean>(false);

  const statusQuery = trpc.retailPricing.status.useQuery(undefined, {
    refetchOnMount: true,
    refetchOnReconnect: true,
  });

  const readQuery = trpc.retailPricing.read.useQuery(undefined, {
    enabled: !!statusQuery.data?.exists,
  });

  const fetchMutation = trpc.retailPricing.fetchAndSaveFromWeb.useMutation();

  const handleImport = useCallback(async () => {
    try {
      console.log('[ProcessRetailPricing] Starting import from published web CSV');
      const res = await fetchMutation.mutateAsync({});
      if (res.success) {
        console.log('[ProcessRetailPricing] Import complete', res);
        await statusQuery.refetch();
        await readQuery.refetch();
        Alert.alert('Retail pricing imported', `Saved ${res.rows} rows • ${res.cols} columns`);
      } else {
        console.error('[ProcessRetailPricing] Import failed', res.error);
        Alert.alert('Import failed', res.error || 'Unknown error');
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Unknown error';
      console.error('[ProcessRetailPricing] Import exception', msg);
      Alert.alert('Import error', msg);
    }
  }, [fetchMutation, statusQuery, readQuery]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await Promise.all([statusQuery.refetch(), readQuery.refetch()]);
    } finally {
      setRefreshing(false);
    }
  }, [statusQuery, readQuery]);

  const preview = useMemo(() => {
    const headers = readQuery.data?.headers ?? [];
    const rows = readQuery.data?.rows ?? [];
    const slice = rows.slice(0, 10);
    return { headers, rows: slice };
  }, [readQuery.data]);

  if (statusQuery.isLoading && !statusQuery.data) {
    return <LoadingState message="Checking retail pricing data..." testId="retail-status-loading" />;
  }

  if (statusQuery.error) {
    return (
      <ErrorState
        title="Status Error"
        message={statusQuery.error.message}
        onRetry={() => statusQuery.refetch()}
      />
    );
  }

  return (
    <>
      <Stack.Screen
        options={{
          title: 'Process Retail Pricing',
          headerRight: () => (
            <TouchableOpacity onPress={onRefresh} style={{ marginRight: 12 }} testID="refresh-retail-pricing">
              <RefreshCw size={18} color={COLORS.primary} />
            </TouchableOpacity>
          ),
        }}
      />
      <ScrollView
        style={styles.container}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        <View style={styles.card} testID="retail-status-card">
          <View style={styles.rowBetween}>
            <View style={styles.rowCenter}>
              {statusQuery.data?.exists ? (
                <ShieldCheck size={22} color={COLORS.success} />
              ) : (
                <XCircle size={22} color={COLORS.error} />
              )}
              <Text style={styles.title}>Retail Pricing Store</Text>
            </View>
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{statusQuery.data?.exists ? 'READY' : 'MISSING'}</Text>
            </View>
          </View>

          <View style={styles.meta}>
            <Text style={styles.metaText}>Path: {statusQuery.data?.file || '—'}</Text>
            <Text style={styles.metaText}>Size: {statusQuery.data?.size || 0} bytes</Text>
            <Text style={styles.metaText}>Updated: {statusQuery.data?.updatedAt ?? '—'}</Text>
          </View>

          <TouchableOpacity
            onPress={handleImport}
            disabled={fetchMutation.isPending}
            style={[styles.button, fetchMutation.isPending && styles.buttonDisabled]}
            testID="import-retail-pricing"
          >
            {fetchMutation.isPending ? (
              <RefreshCw size={16} color={COLORS.white} />
            ) : (
              <Download size={16} color={COLORS.white} />
            )}
            <Text style={styles.buttonText}>
              {fetchMutation.isPending ? 'Importing…' : 'Fetch & Save from Web (One-time)'}
            </Text>
          </TouchableOpacity>

          {statusQuery.data?.exists && (
            <View style={styles.preview} testID="retail-preview">
              <View style={styles.previewHeader}>
                <FileSpreadsheet size={18} color={COLORS.primary} />
                <Text style={styles.previewTitle}>Preview (first 10 rows)</Text>
              </View>
              <View style={styles.tableHeader}>
                {preview.headers.slice(0, 6).map((h, idx) => (
                  <Text key={`h-${idx}`} style={styles.th} numberOfLines={1}>
                    {h}
                  </Text>
                ))}
              </View>
              {preview.rows.map((r, i) => (
                <View key={`r-${i}`} style={styles.tr}>
                  {r.slice(0, 6).map((c, j) => (
                    <Text key={`c-${i}-${j}`} style={styles.td} numberOfLines={1}>
                      {String(c)}
                    </Text>
                  ))}
                </View>
              ))}
            </View>
          )}

          <View style={styles.help}>
            <Text style={styles.helpText}>
              After this import, all retail pricing reads come from DATA/RETAIL/retail-pricing.csv. No live web calls are used at runtime.
            </Text>
          </View>
        </View>
      </ScrollView>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  card: {
    backgroundColor: COLORS.white,
    margin: 16,
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.divider,
  },
  rowBetween: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  rowCenter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  title: {
    marginLeft: 8,
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.text,
  },
  badge: {
    backgroundColor: '#EEF2FF',
    borderWidth: 1,
    borderColor: '#C7D2FE',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
  },
  badgeText: {
    color: COLORS.primary,
    fontSize: 11,
    fontWeight: '700',
  },
  meta: {
    marginTop: 12,
    gap: 4,
  },
  metaText: {
    fontSize: 12,
    color: COLORS.textSecondary,
  },
  button: {
    marginTop: 16,
    backgroundColor: COLORS.primary,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  buttonDisabled: {
    opacity: 0.7,
  },
  buttonText: {
    color: COLORS.white,
    fontSize: 14,
    fontWeight: '600',
  },
  preview: {
    marginTop: 16,
  },
  previewHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  previewTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.text,
  },
  tableHeader: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 6,
  },
  th: {
    flex: 1,
    fontSize: 11,
    fontWeight: '700',
    color: COLORS.text,
  },
  tr: {
    flexDirection: 'row',
    gap: 8,
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.divider,
  },
  td: {
    flex: 1,
    fontSize: 11,
    color: COLORS.textSecondary,
  },
  help: {
    marginTop: 12,
    backgroundColor: '#F9FAFB',
    borderRadius: 8,
    padding: 10,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  helpText: {
    fontSize: 12,
    color: COLORS.textSecondary,
  },
});
