import React from 'react';
import {
  ScrollView,
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { ArrowLeft, CheckCircle, XCircle, AlertCircle } from 'lucide-react-native';
import { trpc, isBackendEnabled } from '@/lib/trpc';

export default function BackendTestScreen() {
  const [testResults, setTestResults] = React.useState<any[]>([]);
  const [isRunning, setIsRunning] = React.useState(false);

  // Test queries
  const calendarEventsQuery = trpc.calendar.events.useQuery({}, { enabled: false });
  const cruisesQuery = trpc.cruises.list.useQuery({ limit: 10, offset: 0 }, { enabled: false });
  const calendarTestQuery = trpc.calendar.test.useQuery(undefined, { enabled: false });
  const calendarDebugQuery = trpc.calendar.debugStore.useQuery(undefined, { enabled: false });
  const analyticsTestQuery = trpc.analytics.test.useQuery(undefined, { enabled: false });
  
  // Test mutations
  const importTripItMutation = trpc.calendar.importTripItDirect.useMutation();
  const testTripItUrlQuery = trpc.calendar.testTripItUrl.useQuery(undefined, { enabled: false });

  const runTests = async () => {
    setIsRunning(true);
    setTestResults([]);
    const results: any[] = [];

    // Test 1: Backend connectivity
    results.push({
      name: 'Backend Connectivity',
      status: isBackendEnabled ? 'success' : 'error',
      message: isBackendEnabled ? 'Backend is enabled' : 'Backend is not enabled',
    });

    // Test 2: Calendar test endpoint
    try {
      const calendarTest = await calendarTestQuery.refetch();
      results.push({
        name: 'Calendar Router',
        status: calendarTest.data ? 'success' : 'error',
        message: calendarTest.data?.message || 'Failed to connect',
        details: calendarTest.data,
      });
    } catch (error: any) {
      results.push({
        name: 'Calendar Router',
        status: 'error',
        message: error.message || 'Failed to connect',
      });
    }

    // Test 3: Check memory store
    try {
      const debugStore = await calendarDebugQuery.refetch();
      results.push({
        name: 'Memory Store',
        status: 'success',
        message: `Total events: ${debugStore.data?.totalEventsInStore || 0}, TripIt: ${debugStore.data?.tripitEventsInStore || 0}`,
        details: debugStore.data,
      });
    } catch (error: any) {
      results.push({
        name: 'Memory Store',
        status: 'error',
        message: error.message || 'Failed to check store',
      });
    }

    // Test 4: Test TripIt URL
    try {
      const urlTest = await testTripItUrlQuery.refetch();
      const data = urlTest.data;
      results.push({
        name: 'TripIt URL Access',
        status: data?.success ? 'success' : 'error',
        message: data?.success 
          ? `Found ${data?.eventCount || 0} events in iCal data`
          : data?.error || 'Failed to access URL',
        details: data,
      });
    } catch (error: any) {
      results.push({
        name: 'TripIt URL Access',
        status: 'error',
        message: error.message || 'Failed to test URL',
      });
    }

    // Test 5: Get calendar events
    try {
      const events = await calendarEventsQuery.refetch();
      const tripitEvents = events.data?.filter((e: any) => e.source === 'tripit') || [];
      results.push({
        name: 'Calendar Events Query',
        status: 'success',
        message: `Total: ${events.data?.length || 0} events, TripIt: ${tripitEvents.length}`,
        details: { total: events.data?.length, tripit: tripitEvents.length },
      });
    } catch (error: any) {
      results.push({
        name: 'Calendar Events Query',
        status: 'error',
        message: error.message || 'Failed to fetch events',
      });
    }

    // Test 6: Get cruises
    try {
      const cruises = await cruisesQuery.refetch();
      results.push({
        name: 'Cruises Query',
        status: 'success',
        message: `Found ${cruises.data?.total || 0} cruises in system`,
        details: cruises.data,
      });
    } catch (error: any) {
      results.push({
        name: 'Cruises Query',
        status: 'error',
        message: error.message || 'Failed to fetch cruises',
      });
    }

    // Test 7: Analytics test
    try {
      const analytics = await analyticsTestQuery.refetch();
      results.push({
        name: 'Analytics Router',
        status: analytics.data ? 'success' : 'error',
        message: analytics.data?.message || 'Failed to connect',
        details: analytics.data,
      });
    } catch (error: any) {
      results.push({
        name: 'Analytics Router',
        status: 'error',
        message: error.message || 'Failed to connect',
      });
    }

    setTestResults(results);
    setIsRunning(false);
  };

  const importTripIt = async () => {
    try {
      Alert.alert(
        'Import TripIt',
        'This will import 78 events from TripIt. Continue?',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Import',
            onPress: async () => {
              setIsRunning(true);
              try {
                const result = await importTripItMutation.mutateAsync();
                Alert.alert(
                  'Success',
                  `Imported ${result.eventsImported} events from TripIt!`,
                  [{ text: 'OK', onPress: () => runTests() }]
                );
              } catch (error: any) {
                Alert.alert('Error', error.message || 'Failed to import');
              } finally {
                setIsRunning(false);
              }
            },
          },
        ]
      );
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to import');
    }
  };

  React.useEffect(() => {
    runTests();
  }, []);

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <ArrowLeft size={24} color="#111827" />
        </TouchableOpacity>
        <Text style={styles.title}>Backend Diagnostics</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView style={styles.content}>
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Connection Status</Text>
          <View style={styles.statusCard}>
            <View style={[styles.statusDot, { backgroundColor: isBackendEnabled ? '#10B981' : '#EF4444' }]} />
            <Text style={styles.statusText}>
              Backend: {isBackendEnabled ? 'Connected' : 'Disconnected'}
            </Text>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Test Results</Text>
          {isRunning && (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color="#3B82F6" />
              <Text style={styles.loadingText}>Running tests...</Text>
            </View>
          )}
          
          {testResults.map((result, index) => (
            <View key={index} style={styles.testResult}>
              <View style={styles.testHeader}>
                {result.status === 'success' ? (
                  <CheckCircle size={20} color="#10B981" />
                ) : result.status === 'warning' ? (
                  <AlertCircle size={20} color="#F59E0B" />
                ) : (
                  <XCircle size={20} color="#EF4444" />
                )}
                <Text style={styles.testName}>{result.name}</Text>
              </View>
              <Text style={styles.testMessage}>{result.message}</Text>
              {result.details && (
                <View style={styles.detailsContainer}>
                  <Text style={styles.detailsText}>
                    {JSON.stringify(result.details, null, 2)}
                  </Text>
                </View>
              )}
            </View>
          ))}
        </View>

        <View style={styles.actions}>
          <TouchableOpacity
            style={[styles.button, styles.primaryButton]}
            onPress={runTests}
            disabled={isRunning}
          >
            <Text style={styles.buttonText}>Run Tests Again</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.button, styles.successButton]}
            onPress={importTripIt}
            disabled={isRunning || importTripItMutation.isPending}
          >
            {importTripItMutation.isPending ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Text style={styles.buttonText}>Import TripIt (78 Events)</Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.button, styles.secondaryButton]}
            onPress={() => router.push('/(tabs)/(calendar)')}
          >
            <Text style={[styles.buttonText, { color: '#3B82F6' }]}>
              Go to Calendar
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  backButton: {
    padding: 8,
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
    color: '#111827',
  },
  content: {
    flex: 1,
    padding: 16,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 12,
  },
  statusCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  statusDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginRight: 12,
  },
  statusText: {
    fontSize: 14,
    color: '#374151',
  },
  loadingContainer: {
    alignItems: 'center',
    padding: 24,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: '#6B7280',
  },
  testResult: {
    backgroundColor: '#FFFFFF',
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    marginBottom: 12,
  },
  testHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  testName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#111827',
    marginLeft: 8,
  },
  testMessage: {
    fontSize: 13,
    color: '#6B7280',
    marginLeft: 28,
  },
  detailsContainer: {
    marginTop: 8,
    marginLeft: 28,
    padding: 8,
    backgroundColor: '#F3F4F6',
    borderRadius: 6,
  },
  detailsText: {
    fontSize: 11,
    color: '#374151',
    fontFamily: 'monospace',
  },
  actions: {
    marginTop: 24,
    gap: 12,
  },
  button: {
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryButton: {
    backgroundColor: '#3B82F6',
  },
  successButton: {
    backgroundColor: '#10B981',
  },
  secondaryButton: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#3B82F6',
  },
  buttonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
  },
});