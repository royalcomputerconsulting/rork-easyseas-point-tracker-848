import React from 'react';
import {
  ScrollView,
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { router, Stack } from 'expo-router';
import { ArrowLeft, Calendar, RefreshCw } from 'lucide-react-native';
import { trpc } from '@/lib/trpc';
import { useAppState } from '@/state/AppStateProvider';

export default function TestCalendarDebugScreen() {
  const { localData, hasLocalData } = useAppState();
  
  // Get all events from backend
  const eventsQuery = trpc.calendar.events.useQuery();
  
  // Test sync from data folder
  const syncMutation = trpc.calendar.syncFromDataFolder.useMutation();
  
  // Import TripIt directly
  const importTripItMutation = trpc.calendar.importTripItDirect.useMutation();
  
  // Debug store
  const debugQuery = trpc.calendar.debugStore.useQuery();
  
  const handleSyncFromDataFolder = async () => {
    try {
      const result = await syncMutation.mutateAsync();
      console.log('[TestCalendarDebug] Sync result:', result);
      // Refetch events after sync
      eventsQuery.refetch();
      debugQuery.refetch();
    } catch (error) {
      console.error('[TestCalendarDebug] Sync failed:', error);
    }
  };
  
  const handleImportTripIt = async () => {
    try {
      const result = await importTripItMutation.mutateAsync();
      console.log('[TestCalendarDebug] TripIt import result:', result);
      // Refetch events after import
      eventsQuery.refetch();
      debugQuery.refetch();
    } catch (error) {
      console.error('[TestCalendarDebug] TripIt import failed:', error);
    }
  };
  
  const backendEvents = eventsQuery.data || [];
  const localCalendarEvents = localData.calendar || [];
  const localTripitEvents = localData.tripit || [];
  
  return (
    <>
      <Stack.Screen 
        options={{
          title: 'Calendar Debug',
          headerLeft: () => (
            <TouchableOpacity onPress={() => router.back()}>
              <ArrowLeft size={24} color="#111827" />
            </TouchableOpacity>
          ),
        }} 
      />
      <ScrollView style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>Calendar Data Debug</Text>
          <Text style={styles.subtitle}>Debug calendar data sources and imports</Text>
        </View>
        
        {/* Actions */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Actions</Text>
          
          <TouchableOpacity 
            style={styles.actionButton}
            onPress={handleSyncFromDataFolder}
            disabled={syncMutation.isPending}
          >
            {syncMutation.isPending ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <RefreshCw size={16} color="#FFFFFF" />
            )}
            <Text style={styles.actionButtonText}>
              {syncMutation.isPending ? 'Syncing...' : 'Sync from DATA folder'}
            </Text>
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={[styles.actionButton, { backgroundColor: '#DC2626' }]}
            onPress={handleImportTripIt}
            disabled={importTripItMutation.isPending}
          >
            {importTripItMutation.isPending ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <Calendar size={16} color="#FFFFFF" />
            )}
            <Text style={styles.actionButtonText}>
              {importTripItMutation.isPending ? 'Importing...' : 'Import TripIt Direct'}
            </Text>
          </TouchableOpacity>
        </View>
        
        {/* Data Sources Summary */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Data Sources Summary</Text>
          
          <View style={styles.dataSource}>
            <Text style={styles.dataSourceTitle}>Backend Events</Text>
            <Text style={styles.dataSourceCount}>{backendEvents.length} events</Text>
            <Text style={styles.dataSourceStatus}>
              Status: {eventsQuery.isLoading ? 'Loading...' : eventsQuery.isError ? 'Error' : 'Loaded'}
            </Text>
          </View>
          
          <View style={styles.dataSource}>
            <Text style={styles.dataSourceTitle}>Local Calendar Events</Text>
            <Text style={styles.dataSourceCount}>{localCalendarEvents.length} events</Text>
            <Text style={styles.dataSourceStatus}>Source: AsyncStorage</Text>
          </View>
          
          <View style={styles.dataSource}>
            <Text style={styles.dataSourceTitle}>Local TripIt Events</Text>
            <Text style={styles.dataSourceCount}>{localTripitEvents.length} events</Text>
            <Text style={styles.dataSourceStatus}>Source: AsyncStorage</Text>
          </View>
        </View>
        
        {/* Backend Debug Info */}
        {debugQuery.data && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Backend Store Debug</Text>
            <View style={styles.debugInfo}>
              <Text style={styles.debugText}>Total Events in Store: {debugQuery.data.totalEventsInStore}</Text>
              <Text style={styles.debugText}>TripIt Events: {debugQuery.data.tripitEventsInStore}</Text>
              <Text style={styles.debugText}>Manual Events: {debugQuery.data.manualEventsInStore}</Text>
              
              {debugQuery.data.eventsBySource && (
                <View style={styles.debugSubsection}>
                  <Text style={styles.debugSubtitle}>Events by Source:</Text>
                  {Object.entries(debugQuery.data.eventsBySource).map(([source, count]) => (
                    <Text key={source} style={styles.debugText}>  {source}: {count}</Text>
                  ))}
                </View>
              )}
            </View>
          </View>
        )}
        
        {/* Sample Events */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Sample Backend Events</Text>
          {backendEvents.length > 0 ? (
            backendEvents.slice(0, 5).map((event: any, index: number) => (
              <View key={event.id || index} style={styles.eventItem}>
                <Text style={styles.eventTitle}>{event.summary}</Text>
                <Text style={styles.eventDetails}>
                  {event.startDate} to {event.endDate} • {event.source}
                </Text>
                {event.location && (
                  <Text style={styles.eventLocation}>{event.location}</Text>
                )}
              </View>
            ))
          ) : (
            <Text style={styles.noEvents}>No backend events found</Text>
          )}
        </View>
        
        {/* Sample Local Events */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Sample Local Calendar Events</Text>
          {localCalendarEvents.length > 0 ? (
            localCalendarEvents.slice(0, 3).map((event: any, index: number) => (
              <View key={event.id || index} style={styles.eventItem}>
                <Text style={styles.eventTitle}>{event.summary}</Text>
                <Text style={styles.eventDetails}>
                  {event.startDate} to {event.endDate} • {event.source}
                </Text>
                {event.location && (
                  <Text style={styles.eventLocation}>{event.location}</Text>
                )}
              </View>
            ))
          ) : (
            <Text style={styles.noEvents}>No local calendar events found</Text>
          )}
        </View>
        
        {/* Sample Local TripIt Events */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Sample Local TripIt Events</Text>
          {localTripitEvents.length > 0 ? (
            localTripitEvents.slice(0, 3).map((event: any, index: number) => (
              <View key={event.id || index} style={styles.eventItem}>
                <Text style={styles.eventTitle}>{event.summary}</Text>
                <Text style={styles.eventDetails}>
                  {event.startDate} to {event.endDate} • {event.source}
                </Text>
                {event.location && (
                  <Text style={styles.eventLocation}>{event.location}</Text>
                )}
              </View>
            ))
          ) : (
            <Text style={styles.noEvents}>No local TripIt events found</Text>
          )}
        </View>
        
        {/* Mutation Results */}
        {syncMutation.data && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Last Sync Result</Text>
            <View style={styles.resultInfo}>
              <Text style={styles.resultText}>Success: {syncMutation.data.success ? 'Yes' : 'No'}</Text>
              <Text style={styles.resultText}>TripIt Imported: {syncMutation.data.importedTripIt || 0}</Text>
              <Text style={styles.resultText}>Manual Imported: {syncMutation.data.importedManual || 0}</Text>
              <Text style={styles.resultText}>Total in Store: {syncMutation.data.totalInStore || 0}</Text>
            </View>
          </View>
        )}
        
        {importTripItMutation.data && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Last TripIt Import Result</Text>
            <View style={styles.resultInfo}>
              <Text style={styles.resultText}>Success: {importTripItMutation.data.success ? 'Yes' : 'No'}</Text>
              <Text style={styles.resultText}>Events Imported: {importTripItMutation.data.eventsImported || 0}</Text>
              <Text style={styles.resultText}>Total in Store: {importTripItMutation.data.totalInStore || 0}</Text>
              <Text style={styles.resultText}>TripIt Events: {importTripItMutation.data.tripItEventsInStore || 0}</Text>
            </View>
          </View>
        )}
      </ScrollView>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  header: {
    padding: 16,
    backgroundColor: '#FFFFFF',
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
  section: {
    backgroundColor: '#FFFFFF',
    margin: 16,
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 12,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#3B82F6',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 8,
    marginBottom: 8,
  },
  actionButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  dataSource: {
    backgroundColor: '#F9FAFB',
    padding: 12,
    borderRadius: 8,
    marginBottom: 8,
  },
  dataSourceTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 4,
  },
  dataSourceCount: {
    fontSize: 14,
    color: '#059669',
    fontWeight: '600',
    marginBottom: 2,
  },
  dataSourceStatus: {
    fontSize: 12,
    color: '#6B7280',
  },
  debugInfo: {
    backgroundColor: '#FEF2F2',
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#FECACA',
  },
  debugText: {
    fontSize: 12,
    color: '#7F1D1D',
    marginBottom: 2,
  },
  debugSubsection: {
    marginTop: 8,
  },
  debugSubtitle: {
    fontSize: 12,
    fontWeight: '600',
    color: '#7F1D1D',
    marginBottom: 4,
  },
  eventItem: {
    backgroundColor: '#F9FAFB',
    padding: 12,
    borderRadius: 8,
    marginBottom: 8,
    borderLeftWidth: 3,
    borderLeftColor: '#3B82F6',
  },
  eventTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 4,
  },
  eventDetails: {
    fontSize: 12,
    color: '#6B7280',
    marginBottom: 2,
  },
  eventLocation: {
    fontSize: 12,
    color: '#059669',
  },
  noEvents: {
    fontSize: 14,
    color: '#6B7280',
    fontStyle: 'italic',
    textAlign: 'center',
    padding: 16,
  },
  resultInfo: {
    backgroundColor: '#F0FDF4',
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#BBF7D0',
  },
  resultText: {
    fontSize: 12,
    color: '#166534',
    marginBottom: 2,
  },
});