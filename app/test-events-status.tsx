import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { trpc } from '@/lib/trpc';
import { useRouter } from 'expo-router';
import { Calendar, RefreshCw, Database, CheckCircle, XCircle } from 'lucide-react-native';

export default function TestEventsStatus() {
  const router = useRouter();
  const [isRefreshing, setIsRefreshing] = React.useState(false);

  // Query all event-related endpoints
  const eventsQuery = trpc.calendar.events.useQuery();
  const debugQuery = trpc.calendar.debugStore.useQuery();
  const rawEventsQuery = trpc.calendar.getRawEvents.useQuery();
  
  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      await Promise.all([
        eventsQuery.refetch(),
        debugQuery.refetch(),
        rawEventsQuery.refetch(),
      ]);
      Alert.alert('Success', 'All queries refreshed');
    } catch (error) {
      Alert.alert('Error', 'Failed to refresh queries');
    } finally {
      setIsRefreshing(false);
    }
  };

  const handleImportTripIt = async () => {
    try {
      const result = await trpc.calendar.importTripItDirect.useMutation().mutateAsync();
      Alert.alert('Success', `Imported ${result.eventsImported} events from TripIt`);
      await handleRefresh();
    } catch (error) {
      Alert.alert('Error', 'Failed to import TripIt events');
    }
  };

  const handleClearEvents = async () => {
    try {
      await trpc.calendar.clearAllEvents.useMutation().mutateAsync();
      Alert.alert('Success', 'All events cleared');
      await handleRefresh();
    } catch (error) {
      Alert.alert('Error', 'Failed to clear events');
    }
  };

  const renderQueryStatus = (name: string, query: any) => {
    const isSuccess = query.status === 'success';
    const isError = query.status === 'error';
    const isLoading = query.isLoading;
    
    return (
      <View style={styles.queryCard}>
        <View style={styles.queryHeader}>
          <Text style={styles.queryName}>{name}</Text>
          {isLoading && <ActivityIndicator size="small" color="#6C5CE7" />}
          {isSuccess && <CheckCircle size={20} color="#10B981" />}
          {isError && <XCircle size={20} color="#EF4444" />}
        </View>
        
        <View style={styles.queryDetails}>
          <Text style={styles.queryLabel}>Status:</Text>
          <Text style={[
            styles.queryValue,
            isSuccess && styles.successText,
            isError && styles.errorText,
          ]}>
            {query.status}
          </Text>
        </View>
        
        {query.data && (
          <View style={styles.queryDetails}>
            <Text style={styles.queryLabel}>Data:</Text>
            <Text style={styles.queryValue}>
              {typeof query.data === 'object' && 'length' in query.data
                ? `${query.data.length} events`
                : JSON.stringify(query.data).substring(0, 50) + '...'}
            </Text>
          </View>
        )}
        
        {query.error && (
          <View style={styles.queryDetails}>
            <Text style={styles.queryLabel}>Error:</Text>
            <Text style={styles.errorText} numberOfLines={2}>
              {query.error.message}
            </Text>
          </View>
        )}
      </View>
    );
  };

  // Calculate totals
  const totalEvents = eventsQuery.data?.length || 0;
  const tripitEvents = debugQuery.data?.tripitEventsInStore || 0;
  const manualEvents = debugQuery.data?.manualEventsInStore || 0;
  const rawTotal = rawEventsQuery.data?.totalEvents || 0;

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Events System Status</Text>
        <Text style={styles.subtitle}>Debug and monitoring dashboard</Text>
      </View>

      {/* Summary Stats */}
      <View style={styles.statsContainer}>
        <View style={styles.statCard}>
          <Database size={24} color="#6C5CE7" />
          <Text style={styles.statNumber}>{totalEvents}</Text>
          <Text style={styles.statLabel}>Total Events</Text>
        </View>
        
        <View style={styles.statCard}>
          <Calendar size={24} color="#3B82F6" />
          <Text style={styles.statNumber}>{tripitEvents}</Text>
          <Text style={styles.statLabel}>TripIt</Text>
        </View>
        
        <View style={styles.statCard}>
          <Calendar size={24} color="#10B981" />
          <Text style={styles.statNumber}>{manualEvents}</Text>
          <Text style={styles.statLabel}>Manual/iCal</Text>
        </View>
      </View>

      {/* Query Status */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Query Status</Text>
        {renderQueryStatus('Main Events Query', eventsQuery)}
        {renderQueryStatus('Debug Store Query', debugQuery)}
        {renderQueryStatus('Raw Events Query', rawEventsQuery)}
      </View>

      {/* Debug Info */}
      {debugQuery.data && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Store Debug Info</Text>
          <View style={styles.debugCard}>
            <Text style={styles.debugText}>
              Total in Store: {debugQuery.data.totalEventsInStore}
            </Text>
            <Text style={styles.debugText}>
              TripIt Events: {debugQuery.data.tripitEventsInStore}
            </Text>
            <Text style={styles.debugText}>
              Manual Events: {debugQuery.data.manualEventsInStore}
            </Text>
            {debugQuery.data.eventsBySource && (
              <Text style={styles.debugText}>
                By Source: {JSON.stringify(debugQuery.data.eventsBySource)}
              </Text>
            )}
          </View>
        </View>
      )}

      {/* Sample Events */}
      {eventsQuery.data && eventsQuery.data.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Sample Events (First 5)</Text>
          {eventsQuery.data.slice(0, 5).map((event: any, index: number) => (
            <View key={event.id || index} style={styles.eventCard}>
              <Text style={styles.eventTitle}>{event.summary}</Text>
              <Text style={styles.eventDetail}>
                {event.startDate} - {event.endDate}
              </Text>
              <Text style={styles.eventDetail}>
                Source: {event.source} | Location: {event.location || 'N/A'}
              </Text>
            </View>
          ))}
        </View>
      )}

      {/* Actions */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Actions</Text>
        
        <TouchableOpacity
          style={styles.actionButton}
          onPress={handleRefresh}
          disabled={isRefreshing}
        >
          <RefreshCw size={18} color="#FFFFFF" />
          <Text style={styles.actionButtonText}>
            {isRefreshing ? 'Refreshing...' : 'Refresh All Queries'}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.actionButton, styles.primaryButton]}
          onPress={handleImportTripIt}
        >
          <Calendar size={18} color="#FFFFFF" />
          <Text style={styles.actionButtonText}>Import TripIt Events</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.actionButton, styles.dangerButton]}
          onPress={handleClearEvents}
        >
          <XCircle size={18} color="#FFFFFF" />
          <Text style={styles.actionButtonText}>Clear All Events</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.actionButton, styles.secondaryButton]}
          onPress={() => router.push('/(tabs)/(events)')}
        >
          <Calendar size={18} color="#6C5CE7" />
          <Text style={[styles.actionButtonText, styles.secondaryButtonText]}>
            Go to Events Page
          </Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  header: {
    backgroundColor: '#FFFFFF',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  title: {
    fontSize: 24,
    fontWeight: '700' as const,
    color: '#111827',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 14,
    color: '#6B7280',
  },
  statsContainer: {
    flexDirection: 'row',
    padding: 16,
    gap: 12,
  },
  statCard: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  statNumber: {
    fontSize: 24,
    fontWeight: '700' as const,
    color: '#111827',
    marginVertical: 8,
  },
  statLabel: {
    fontSize: 12,
    color: '#6B7280',
    textAlign: 'center',
  },
  section: {
    padding: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600' as const,
    color: '#111827',
    marginBottom: 12,
  },
  queryCard: {
    backgroundColor: '#FFFFFF',
    padding: 16,
    borderRadius: 8,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  queryHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  queryName: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: '#374151',
  },
  queryDetails: {
    flexDirection: 'row',
    marginTop: 4,
  },
  queryLabel: {
    fontSize: 12,
    color: '#6B7280',
    marginRight: 8,
    minWidth: 50,
  },
  queryValue: {
    fontSize: 12,
    color: '#111827',
    flex: 1,
  },
  successText: {
    color: '#10B981',
  },
  errorText: {
    color: '#EF4444',
  },
  debugCard: {
    backgroundColor: '#FFFFFF',
    padding: 16,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  debugText: {
    fontSize: 13,
    color: '#374151',
    marginBottom: 4,
    fontFamily: 'monospace',
  },
  eventCard: {
    backgroundColor: '#FFFFFF',
    padding: 12,
    borderRadius: 8,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  eventTitle: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: '#111827',
    marginBottom: 4,
  },
  eventDetail: {
    fontSize: 12,
    color: '#6B7280',
    marginBottom: 2,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#6C5CE7',
    padding: 12,
    borderRadius: 8,
    marginBottom: 12,
    gap: 8,
  },
  primaryButton: {
    backgroundColor: '#3B82F6',
  },
  dangerButton: {
    backgroundColor: '#EF4444',
  },
  secondaryButton: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#6C5CE7',
  },
  actionButtonText: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: '#FFFFFF',
  },
  secondaryButtonText: {
    color: '#6C5CE7',
  },
});