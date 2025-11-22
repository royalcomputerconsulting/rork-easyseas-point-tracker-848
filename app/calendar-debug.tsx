import React, { useEffect } from 'react';
import {
  ScrollView,
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { Stack, router } from 'expo-router';
import { RefreshCw, Calendar, Database, CheckCircle, XCircle } from 'lucide-react-native';
import { trpc, isBackendEnabled } from '@/lib/trpc';

export default function CalendarDebugScreen() {
  // Test backend connection
  const testQuery = trpc.calendar.test.useQuery(undefined, {
    enabled: isBackendEnabled,
    refetchOnMount: true,
  });

  // Get all events
  const eventsQuery = trpc.calendar.events.useQuery({}, {
    enabled: isBackendEnabled,
    refetchOnMount: true,
  });

  // Test TripIt URL - using useQuery with manual refetch
  const [testUrlTrigger, setTestUrlTrigger] = React.useState(0);
  const testUrlQuery = trpc.calendar.testTripItUrl.useQuery(undefined, {
    enabled: testUrlTrigger > 0 && isBackendEnabled,
  });

  // Handle test URL query results
  useEffect(() => {
    if (testUrlQuery.data && testUrlTrigger > 0) {
      console.log('[Debug] TripIt URL test result:', testUrlQuery.data);
      if (testUrlQuery.data.success) {
        Alert.alert(
          'TripIt URL Test Successful',
          `Found ${testUrlQuery.data.eventCount} events in the calendar feed`,
          [{ text: 'OK' }]
        );
      } else {
        Alert.alert(
          'TripIt URL Test Failed',
          testUrlQuery.data.error || 'Unknown error',
          [{ text: 'OK' }]
        );
      }
    }
  }, [testUrlQuery.data, testUrlTrigger]);

  useEffect(() => {
    if (testUrlQuery.error && testUrlTrigger > 0) {
      Alert.alert('Test Failed', testUrlQuery.error.message, [{ text: 'OK' }]);
    }
  }, [testUrlQuery.error, testUrlTrigger]);

  // Import TripIt calendar
  const importMutation = trpc.calendar.importTripItDirect.useMutation();

  // Handle import mutation results
  useEffect(() => {
    if (importMutation.isSuccess && importMutation.data) {
      console.log('[Debug] Import result:', importMutation.data);
      Alert.alert(
        'Import Complete',
        `Imported ${importMutation.data?.eventsImported || 0} events. Total in store: ${importMutation.data?.totalInStore || 0}`,
        [{ text: 'OK' }]
      );
      // Refetch events
      eventsQuery.refetch();
      testQuery.refetch();
    }
  }, [importMutation.isSuccess, importMutation.data]);

  useEffect(() => {
    if (importMutation.isError && importMutation.error) {
      Alert.alert('Import Failed', importMutation.error.message, [{ text: 'OK' }]);
    }
  }, [importMutation.isError, importMutation.error]);

  const handleRefresh = async () => {
    console.log('[Debug] Refreshing all data...');
    await Promise.all([
      testQuery.refetch(),
      eventsQuery.refetch(),
    ]);
  };

  const handleTestUrl = () => {
    console.log('[Debug] Testing TripIt URL...');
    setTestUrlTrigger(prev => prev + 1);
  };

  const handleImport = async () => {
    console.log('[Debug] Starting TripIt import...');
    await importMutation.mutateAsync();
  };

  const tripitEvents = eventsQuery.data?.filter(e => e.source === 'tripit') || [];
  const bookedEvents = eventsQuery.data?.filter(e => e.source === 'booked') || [];
  const manualEvents = eventsQuery.data?.filter(e => e.source === 'manual') || [];

  return (
    <>
      <Stack.Screen
        options={{
          title: 'Calendar Debug',
          headerStyle: { backgroundColor: '#1E3A8A' },
          headerTintColor: '#FFFFFF',
        }}
      />
      <ScrollView style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.title}>Calendar Debug Panel</Text>
          <Text style={styles.subtitle}>Test and debug calendar functionality</Text>
        </View>

        {/* Backend Status */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Database size={20} color="#3B82F6" />
            <Text style={styles.cardTitle}>Backend Status</Text>
          </View>
          <View style={styles.statusRow}>
            <Text style={styles.label}>Backend Enabled:</Text>
            <View style={[styles.badge, isBackendEnabled ? styles.badgeSuccess : styles.badgeError]}>
              {isBackendEnabled ? <CheckCircle size={14} color="#FFFFFF" /> : <XCircle size={14} color="#FFFFFF" />}
              <Text style={styles.badgeText}>{isBackendEnabled ? 'YES' : 'NO'}</Text>
            </View>
          </View>
          {testQuery.data && (
            <>
              <View style={styles.statusRow}>
                <Text style={styles.label}>Total Events:</Text>
                <Text style={styles.value}>{testQuery.data.totalEvents}</Text>
              </View>
              <View style={styles.statusRow}>
                <Text style={styles.label}>TripIt Events:</Text>
                <Text style={styles.value}>{testQuery.data.tripItEvents}</Text>
              </View>
              <View style={styles.statusRow}>
                <Text style={styles.label}>Last Update:</Text>
                <Text style={styles.value}>{new Date(testQuery.data.timestamp).toLocaleTimeString()}</Text>
              </View>
            </>
          )}
        </View>

        {/* Event Summary */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Calendar size={20} color="#10B981" />
            <Text style={styles.cardTitle}>Event Summary</Text>
          </View>
          <View style={styles.statsGrid}>
            <View style={styles.statBox}>
              <Text style={styles.statValue}>{eventsQuery.data?.length || 0}</Text>
              <Text style={styles.statLabel}>Total Events</Text>
            </View>
            <View style={styles.statBox}>
              <Text style={styles.statValue}>{tripitEvents.length}</Text>
              <Text style={styles.statLabel}>TripIt</Text>
            </View>
            <View style={styles.statBox}>
              <Text style={styles.statValue}>{bookedEvents.length}</Text>
              <Text style={styles.statLabel}>Booked</Text>
            </View>
            <View style={styles.statBox}>
              <Text style={styles.statValue}>{manualEvents.length}</Text>
              <Text style={styles.statLabel}>Manual</Text>
            </View>
          </View>
        </View>

        {/* Actions */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <RefreshCw size={20} color="#F59E0B" />
            <Text style={styles.cardTitle}>Actions</Text>
          </View>
          
          <TouchableOpacity
            style={[styles.button, styles.buttonPrimary]}
            onPress={handleImport}
            disabled={importMutation.isPending || !isBackendEnabled}
          >
            {importMutation.isPending ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <>
                <Calendar size={16} color="#FFFFFF" />
                <Text style={styles.buttonText}>Import TripIt Calendar (78 Events)</Text>
              </>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.button, styles.buttonSecondary]}
            onPress={handleTestUrl}
            disabled={testUrlQuery.isFetching || !isBackendEnabled}
          >
            {testUrlQuery.isFetching ? (
              <ActivityIndicator color="#3B82F6" />
            ) : (
              <Text style={styles.buttonTextSecondary}>Test TripIt URL</Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.button, styles.buttonSecondary]}
            onPress={handleRefresh}
            disabled={!isBackendEnabled}
          >
            <RefreshCw size={16} color="#3B82F6" />
            <Text style={styles.buttonTextSecondary}>Refresh Data</Text>
          </TouchableOpacity>
        </View>

        {/* TripIt Events List */}
        {tripitEvents.length > 0 && (
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <Text style={styles.cardTitle}>TripIt Events ({tripitEvents.length})</Text>
            </View>
            <View style={styles.eventsList}>
              {tripitEvents.slice(0, 10).map((event, index) => (
                <View key={event.id} style={styles.eventItem}>
                  <Text style={styles.eventNumber}>{index + 1}.</Text>
                  <View style={styles.eventDetails}>
                    <Text style={styles.eventSummary} numberOfLines={1}>{event.summary}</Text>
                    <Text style={styles.eventDates}>
                      {event.startDate} to {event.endDate}
                    </Text>
                    {event.location && (
                      <Text style={styles.eventLocation} numberOfLines={1}>📍 {event.location}</Text>
                    )}
                  </View>
                </View>
              ))}
              {tripitEvents.length > 10 && (
                <Text style={styles.moreText}>... and {tripitEvents.length - 10} more events</Text>
              )}
            </View>
          </View>
        )}

        {/* Debug Info */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Text style={styles.cardTitle}>Debug Information</Text>
          </View>
          <Text style={styles.debugText}>
            Backend URL: {isBackendEnabled ? 'Connected' : 'Not Connected'}
          </Text>
          <Text style={styles.debugText}>
            Events Loading: {eventsQuery.isLoading ? 'Yes' : 'No'}
          </Text>
          <Text style={styles.debugText}>
            Events Error: {eventsQuery.error?.message || 'None'}
          </Text>
          <Text style={styles.debugText}>
            Last Fetch: {eventsQuery.dataUpdatedAt ? new Date(eventsQuery.dataUpdatedAt).toLocaleTimeString() : 'Never'}
          </Text>
        </View>

        <View style={styles.footer}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => router.back()}
          >
            <Text style={styles.backButtonText}>Back to Calendar</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F3F4F6',
  },
  header: {
    backgroundColor: '#FFFFFF',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 14,
    color: '#6B7280',
  },
  card: {
    backgroundColor: '#FFFFFF',
    margin: 16,
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    gap: 8,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#111827',
  },
  statusRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  label: {
    fontSize: 14,
    color: '#6B7280',
  },
  value: {
    fontSize: 14,
    fontWeight: '600',
    color: '#111827',
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    gap: 4,
  },
  badgeSuccess: {
    backgroundColor: '#10B981',
  },
  badgeError: {
    backgroundColor: '#EF4444',
  },
  badgeText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  statBox: {
    flex: 1,
    minWidth: 70,
    backgroundColor: '#F9FAFB',
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  statValue: {
    fontSize: 24,
    fontWeight: '700',
    color: '#111827',
  },
  statLabel: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 4,
  },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 12,
    borderRadius: 8,
    marginBottom: 8,
    gap: 8,
  },
  buttonPrimary: {
    backgroundColor: '#3B82F6',
  },
  buttonSecondary: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#3B82F6',
  },
  buttonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  buttonTextSecondary: {
    fontSize: 14,
    fontWeight: '600',
    color: '#3B82F6',
  },
  eventsList: {
    gap: 8,
  },
  eventItem: {
    flexDirection: 'row',
    gap: 8,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  eventNumber: {
    fontSize: 12,
    color: '#6B7280',
    width: 20,
  },
  eventDetails: {
    flex: 1,
  },
  eventSummary: {
    fontSize: 14,
    fontWeight: '500',
    color: '#111827',
    marginBottom: 2,
  },
  eventDates: {
    fontSize: 12,
    color: '#6B7280',
  },
  eventLocation: {
    fontSize: 12,
    color: '#9CA3AF',
    marginTop: 2,
  },
  moreText: {
    fontSize: 12,
    color: '#6B7280',
    fontStyle: 'italic',
    marginTop: 8,
    textAlign: 'center',
  },
  debugText: {
    fontSize: 12,
    color: '#6B7280',
    marginBottom: 4,
    fontFamily: 'monospace',
  },
  footer: {
    padding: 16,
    paddingBottom: 32,
  },
  backButton: {
    backgroundColor: '#6B7280',
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  backButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
  },
});