import React from 'react';
import { View, Text, StyleSheet, ScrollView, ActivityIndicator } from 'react-native';
import { Stack } from 'expo-router';
import { trpc, isBackendEnabled } from '@/lib/trpc';

export default function PointsStatusScreen() {
  const statusPointsQuery = trpc.analytics.getStatusAndPoints.useQuery(undefined, {
    enabled: isBackendEnabled,
    refetchOnMount: true,
    refetchOnWindowFocus: false,
  });
  const userProfileQuery = trpc.analytics.userProfile.useQuery(undefined, {
    enabled: isBackendEnabled,
  });

  const loading = isBackendEnabled && (statusPointsQuery.isLoading || userProfileQuery.isLoading);
  const error = statusPointsQuery.error?.message || userProfileQuery.error?.message;
  const status = statusPointsQuery.data;
  const profile = userProfileQuery.data;

  return (
    <>
      <Stack.Screen options={{ title: 'Points & Status' }} />
      <ScrollView style={styles.container} testID="points-status-screen">
        {loading ? (
          <View style={styles.center}>
            <ActivityIndicator size="large" color="#6C5CE7" />
            <Text style={styles.loadingText}>Loading...</Text>
          </View>
        ) : error ? (
          <View style={styles.center}>
            <Text style={styles.errorText}>Failed to load. Please try again.</Text>
            <Text style={styles.errorDetails}>{error}</Text>
          </View>
        ) : (
          <View style={styles.card}>
            <Text style={styles.h1}>Your Status</Text>
            <View style={styles.row}>
              <Text style={styles.label}>Tier</Text>
              <Text style={styles.value}>{profile?.level || 'PRIME'}</Text>
            </View>
            <View style={styles.row}>
              <Text style={styles.label}>Current Points</Text>
              <Text style={styles.value}>{(profile?.points ?? 0).toLocaleString()}</Text>
            </View>
            <View style={styles.row}>
              <Text style={styles.label}>Points to Next Tier</Text>
              <Text style={styles.value}>{Math.max(0, (profile?.nextLevelPoints ?? 0) - (profile?.points ?? 0)).toLocaleString()}</Text>
            </View>
            <View style={[styles.divider]} />
            <Text style={styles.h2}>Casino-Recognized Totals</Text>
            <View style={styles.row}>
              <Text style={styles.label}>"What Casino Thinks I Spent"</Text>
              <Text style={styles.value}>${Number(status?.casinoRecognizedTotal ?? 0).toLocaleString()}</Text>
            </View>
            <View style={styles.row}>
              <Text style={styles.label}>Free Play Earned</Text>
              <Text style={styles.value}>${Number(status?.freePlay?.earned ?? 0).toLocaleString()}</Text>
            </View>
            <View style={styles.row}>
              <Text style={styles.label}>Free Play Redeemed</Text>
              <Text style={styles.value}>${Number(status?.freePlay?.redeemed ?? 0).toLocaleString()}</Text>
            </View>
            <View style={styles.meta}>
              <Text style={styles.metaText}>Statements processed: {status?.statementsCount ?? 0}</Text>
            </View>
          </View>
        )}
      </ScrollView>
    </>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8FAFC', padding: 16 },
  center: { alignItems: 'center', justifyContent: 'center', paddingVertical: 24 },
  loadingText: { marginTop: 8, color: '#6B7280' },
  errorText: { color: '#EF4444', fontWeight: '700', marginBottom: 4 },
  errorDetails: { color: '#6B7280', fontSize: 12, textAlign: 'center' },
  card: { backgroundColor: '#FFFFFF', padding: 16, borderRadius: 12, borderWidth: 1, borderColor: '#E5E7EB' },
  h1: { fontSize: 18, fontWeight: '700', color: '#111827', marginBottom: 8 },
  h2: { fontSize: 14, fontWeight: '600', color: '#111827', marginTop: 8, marginBottom: 8 },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  label: { fontSize: 12, color: '#6B7280' },
  value: { fontSize: 16, fontWeight: '700', color: '#111827' },
  divider: { height: 1, backgroundColor: '#E5E7EB', marginVertical: 8 },
  meta: { marginTop: 8 },
  metaText: { fontSize: 11, color: '#6B7280' },
});
