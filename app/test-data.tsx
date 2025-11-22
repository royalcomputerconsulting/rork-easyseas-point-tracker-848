import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { trpc } from '@/lib/trpc';
import { RefreshCw, Database, Calendar, Ship } from 'lucide-react-native';

export default function TestDataScreen() {
  const [refreshing, setRefreshing] = useState(false);

  // Test queries
  const statusQuery = trpc.status.useQuery();
  const calendarEventsQuery = trpc.calendar.events.useQuery({});
  const cruisesQuery = trpc.cruises.list.useQuery({ limit: 10, offset: 0 });
  const debugStoreQuery = trpc.calendar.debugStore.useQuery();

  // Sync TripIt mutation
  const syncTripItMutation = trpc.calendar.importTripItDirect.useMutation({
    onSuccess: (data) => {
      Alert.alert('Success', `Imported ${data.eventsImported} TripIt events`);
      refetchAll();
    },
    onError: (error) => {
      Alert.alert('Error', error.message);
    },
  });

  const refetchAll = async () => {
    setRefreshing(true);
    await Promise.all([
      statusQuery.refetch(),
      calendarEventsQuery.refetch(),
      cruisesQuery.refetch(),
      debugStoreQuery.refetch(),
    ]);
    setRefreshing(false);
  };

  useEffect(() => {
    console.log('[TestData] Status:', statusQuery.data);
    console.log('[TestData] Calendar Events:', calendarEventsQuery.data?.length);
    console.log('[TestData] Cruises:', cruisesQuery.data?.cruises?.length);
    console.log('[TestData] Debug Store:', debugStoreQuery.data);
  }, [statusQuery.data, calendarEventsQuery.data, cruisesQuery.data, debugStoreQuery.data]);

  if (statusQuery.isLoading || calendarEventsQuery.isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#6C5CE7" />
        <Text style={styles.loadingText}>Loading backend data...</Text>
      </View>
    );
  }

  const tripitEvents = calendarEventsQuery.data?.filter(e => e.source === 'tripit') || [];
  const manualEvents = calendarEventsQuery.data?.filter(e => e.source === 'manual') || [];
  const bookedEvents = calendarEventsQuery.data?.filter(e => e.source === 'booked') || [];

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Backend Data Test</Text>
        <TouchableOpacity
          style={styles.refreshButton}
          onPress={refetchAll}
          disabled={refreshing}
        >
          <RefreshCw size={20} color="#FFFFFF" />
          <Text style={styles.refreshText}>Refresh</Text>
        </TouchableOpacity>
      </View>

      {/* Status Overview */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Database size={20} color="#6C5CE7" />
          <Text style={styles.sectionTitle}>Memory Store Status</Text>
        </View>
        {statusQuery.data && (
          <View style={styles.statsGrid}>
            <View style={styles.statCard}>
              <Text style={styles.statValue}>{statusQuery.data.cruises}</Text>
              <Text style={styles.statLabel}>Cruises</Text>
            </View>
            <View style={styles.statCard}>
              <Text style={styles.statValue}>{statusQuery.data.bookedCruises}</Text>
              <Text style={styles.statLabel}>Booked</Text>
            </View>
            <View style={styles.statCard}>
              <Text style={styles.statValue}>{statusQuery.data.casinoOffers}</Text>
              <Text style={styles.statLabel}>Offers</Text>
            </View>
            <View style={styles.statCard}>
              <Text style={styles.statValue}>{statusQuery.data.calendarEvents}</Text>
              <Text style={styles.statLabel}>Events</Text>
            </View>
          </View>
        )}
      </View>

      {/* Calendar Events */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Calendar size={20} color="#6C5CE7" />
          <Text style={styles.sectionTitle}>Calendar Events</Text>
        </View>
        <View style={styles.statsGrid}>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>{tripitEvents.length}</Text>
            <Text style={styles.statLabel}>TripIt</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>{manualEvents.length}</Text>
            <Text style={styles.statLabel}>Manual</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>{bookedEvents.length}</Text>
            <Text style={styles.statLabel}>Booked</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>{calendarEventsQuery.data?.length || 0}</Text>
            <Text style={styles.statLabel}>Total</Text>
          </View>
        </View>

        {tripitEvents.length === 0 && (
          <TouchableOpacity
            style={styles.syncButton}
            onPress={() => syncTripItMutation.mutate()}
            disabled={syncTripItMutation.isPending}
          >
            <Calendar size={18} color="#FFFFFF" />
            <Text style={styles.syncButtonText}>
              {syncTripItMutation.isPending ? 'Syncing...' : 'Sync TripIt (78 events)'}
            </Text>
          </TouchableOpacity>
        )}

        {tripitEvents.length > 0 && (
          <View style={styles.eventsList}>
            <Text style={styles.eventsTitle}>Sample TripIt Events:</Text>
            {tripitEvents.slice(0, 3).map((event, index) => (
              <View key={event.id} style={styles.eventItem}>
                <Text style={styles.eventSummary}>{event.summary}</Text>
                <Text style={styles.eventDate}>
                  {new Date(event.startDate).toLocaleDateString()} - {new Date(event.endDate).toLocaleDateString()}
                </Text>
                {event.location && (
                  <Text style={styles.eventLocation}>{event.location}</Text>
                )}
              </View>
            ))}
          </View>
        )}
      </View>

      {/* Cruises */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Ship size={20} color="#6C5CE7" />
          <Text style={styles.sectionTitle}>Cruises</Text>
        </View>
        {cruisesQuery.data?.cruises && cruisesQuery.data.cruises.length > 0 ? (
          <View style={styles.eventsList}>
            <Text style={styles.eventsTitle}>
              Sample Cruises (showing {Math.min(3, cruisesQuery.data.cruises.length)} of {cruisesQuery.data.total}):
            </Text>
            {cruisesQuery.data.cruises.slice(0, 3).map((cruise) => (
              <View key={cruise.id} style={styles.eventItem}>
                <Text style={styles.eventSummary}>{cruise.ship} - {cruise.nights}N</Text>
                <Text style={styles.eventDate}>
                  Departs: {new Date(cruise.departureDate).toLocaleDateString()}
                </Text>
                <Text style={styles.eventLocation}>{cruise.itineraryName}</Text>
              </View>
            ))}
          </View>
        ) : (
          <Text style={styles.noDataText}>No cruises found</Text>
        )}
      </View>

      {/* Debug Info */}
      {debugStoreQuery.data && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Debug Store Info</Text>
          <View style={styles.debugInfo}>
            <Text style={styles.debugText}>
              Total Events in Store: {debugStoreQuery.data.totalEventsInStore}
            </Text>
            <Text style={styles.debugText}>
              TripIt Events in Store: {debugStoreQuery.data.tripitEventsInStore}
            </Text>
            {debugStoreQuery.data.eventsBySource && (
              <View>
                <Text style={styles.debugText}>Events by Source:</Text>
                {Object.entries(debugStoreQuery.data.eventsBySource).map(([source, count]) => (
                  <Text key={source} style={styles.debugText}>
                    - {source}: {count}
                  </Text>
                ))}
              </View>
            )}
          </View>
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F9FAFB',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: '#6B7280',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: '#1F2937',
  },
  refreshButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#6C5CE7',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
  },
  refreshText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  section: {
    backgroundColor: '#FFFFFF',
    margin: 16,
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1F2937',
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  statCard: {
    flex: 1,
    minWidth: 70,
    backgroundColor: '#F9FAFB',
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  statValue: {
    fontSize: 24,
    fontWeight: '700',
    color: '#6C5CE7',
  },
  statLabel: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 4,
  },
  syncButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#6C5CE7',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 8,
    marginTop: 16,
  },
  syncButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  eventsList: {
    marginTop: 16,
  },
  eventsTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#6B7280',
    marginBottom: 8,
  },
  eventItem: {
    backgroundColor: '#F9FAFB',
    padding: 12,
    borderRadius: 8,
    marginBottom: 8,
    borderLeftWidth: 3,
    borderLeftColor: '#6C5CE7',
  },
  eventSummary: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1F2937',
    marginBottom: 4,
  },
  eventDate: {
    fontSize: 12,
    color: '#6B7280',
  },
  eventLocation: {
    fontSize: 12,
    color: '#9CA3AF',
    marginTop: 2,
  },
  noDataText: {
    fontSize: 14,
    color: '#9CA3AF',
    textAlign: 'center',
    paddingVertical: 20,
  },
  debugInfo: {
    backgroundColor: '#F3F4F6',
    padding: 12,
    borderRadius: 8,
    marginTop: 12,
  },
  debugText: {
    fontSize: 12,
    color: '#4B5563',
    marginBottom: 4,
    fontFamily: 'monospace',
  },
});