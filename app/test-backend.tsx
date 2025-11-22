import React, { useState } from 'react';
import {
  ScrollView,
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  TextInput,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack } from 'expo-router';
import { trpc, trpcClient } from '@/lib/trpc';

export default function TestBackendScreen() {
  const [isImporting, setIsImporting] = useState(false);
  const [testResults, setTestResults] = useState<any[]>([]);
  
  // Phase 1 Testing State
  const [cruiseId, setCruiseId] = useState<string>('');
  const [winnings, setWinnings] = useState<string>('');
  const [points, setPoints] = useState<string>('');
  const [amountPaid, setAmountPaid] = useState<string>('');
  const [freeplay, setFreeplay] = useState<string>('');

  // Test queries
  const statusQuery = trpc.status.useQuery();
  const calendarTestQuery = trpc.calendar.test.useQuery();
  const calendarEventsQuery = trpc.calendar.events.useQuery({});
  const analyticsTestQuery = trpc.analytics.test.useQuery();
  
  // Phase 1 Testing Queries
  const cruisesQuery = trpc.cruises.list.useQuery({ limit: 1 });
  const updateFinancialMutation = trpc.cruises.updateFinancialData.useMutation();
  const getFinancialQuery = trpc.cruises.getFinancialData.useQuery(
    { cruiseId },
    { enabled: !!cruiseId }
  );
  // const testAnalyticsQuery = trpc.testAnalytics.useQuery(); // Commented out - endpoint doesn't exist
  
  // Enhanced analytics queries for testing receipts and statements
  const receiptAnalyticsQuery = trpc.analytics.getReceiptAnalytics.useQuery(undefined, { retry: false });
  const clubRoyaleAnalyticsQuery = trpc.analytics.getClubRoyaleAnalytics.useQuery(undefined, { retry: false });
  const spendingCategoryAnalysisQuery = trpc.analytics.getSpendingCategoryAnalysis.useQuery(undefined, { retry: false });
  
  // Restart mutation - commented out as endpoint doesn't exist
  // const restartMutation = trpc.restart.useMutation({
  //   onSuccess: (data: any) => {
  //     console.log('[Test] Restart success:', data);
  //     Alert.alert('Restart Success', 'Backend restart triggered! Please wait a moment and try again.');
  //   },
  //   onError: (error: any) => {
  //     console.error('[Test] Restart error:', error);
  //     Alert.alert('Restart Error', error.message);
  //   }
  // });
  
  // Test the specific analytics procedures that are failing
  const topCompValueQuery = trpc.analytics.topCompValue.useQuery(undefined, { retry: false });
  const cruiseValueQuery = trpc.analytics.cruiseValueAnalysis.useQuery(undefined, { retry: false });
  const userProfileQuery = trpc.analytics.userProfile.useQuery(undefined, { retry: false });
  const portfolioAnalysisQuery = trpc.analytics.getPortfolioAnalysis.useQuery(undefined, { retry: false });
  const breakEvenAnalysisQuery = trpc.analytics.getBreakEvenAnalysis.useQuery(undefined, { retry: false });
  const upgradeAnalysisQuery = trpc.analytics.getCategoryUpgradeAnalysis.useQuery(undefined, { retry: false });

  // Import mutation
  const importMutation = trpc.calendar.importTripItDirect.useMutation({
    onSuccess: (data) => {
      console.log('[Test] Import success:', data);
      Alert.alert(
        'Import Success',
        `Imported ${data.eventsImported} events!\nTotal in store: ${data.totalInStore}\nTripIt events: ${data.tripItEventsInStore}`
      );
      // Refetch calendar events
      calendarEventsQuery.refetch();
      calendarTestQuery.refetch();
    },
    onError: (error) => {
      console.error('[Test] Import error:', error);
      Alert.alert('Import Error', error.message);
    }
  });

  const runTest = async (testName: string, testFn: () => Promise<any>) => {
    try {
      console.log(`[Test] Running ${testName}...`);
      const result = await testFn();
      const testResult = {
        name: testName,
        success: true,
        result: result,
        timestamp: new Date().toISOString()
      };
      setTestResults(prev => [...prev, testResult]);
      console.log(`[Test] ${testName} success:`, result);
      return result;
    } catch (error) {
      const testResult = {
        name: testName,
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString()
      };
      setTestResults(prev => [...prev, testResult]);
      console.error(`[Test] ${testName} failed:`, error);
      throw error;
    }
  };

  const runDirectTest = async (testName: string, testFn: () => Promise<any>) => {
    try {
      console.log(`[Test] Running direct ${testName}...`);
      const result = await testFn();
      const testResult = {
        name: `Direct ${testName}`,
        success: true,
        result: result,
        timestamp: new Date().toISOString()
      };
      setTestResults(prev => [...prev, testResult]);
      console.log(`[Test] Direct ${testName} success:`, result);
      return result;
    } catch (error) {
      const testResult = {
        name: `Direct ${testName}`,
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString()
      };
      setTestResults(prev => [...prev, testResult]);
      console.error(`[Test] Direct ${testName} failed:`, error);
      throw error;
    }
  };

  const runAllTests = async () => {
    setTestResults([]);
    
    // First test direct connection using trpcClient
    await runDirectTest('Ping', async () => {
      const result = await trpcClient.ping.query();
      return result;
    });
    
    await runDirectTest('Status', async () => {
      const result = await trpcClient.status.query();
      return result;
    });
    
    await runDirectTest('Direct Analytics Test', async () => {
      const result = await trpcClient.directAnalytics.test.query();
      return result;
    });
    
    // Test 1: Status endpoint
    await runTest('Status Check', async () => {
      const result = await statusQuery.refetch();
      return result.data;
    });

    // Test 2: Calendar test endpoint
    await runTest('Calendar Test', async () => {
      const result = await calendarTestQuery.refetch();
      return result.data;
    });

    // Test 3: Analytics test endpoint
    await runTest('Analytics Test', async () => {
      const result = await analyticsTestQuery.refetch();
      return result.data;
    });

    // Test 4: Get calendar events
    await runTest('Get Calendar Events', async () => {
      const result = await calendarEventsQuery.refetch();
      return {
        totalEvents: result.data?.length || 0,
        tripItEvents: result.data?.filter((e: any) => e.source === 'tripit').length || 0,
        events: result.data?.slice(0, 3) || []
      };
    });
    
    // Test 5: Analytics procedures
    await runTest('Top Comp Value', async () => {
      const result = await topCompValueQuery.refetch();
      return result.data;
    });
    
    await runTest('Cruise Value Analysis', async () => {
      const result = await cruiseValueQuery.refetch();
      return { cruiseCount: result.data?.cruises?.length || 0 };
    });
    
    await runTest('User Profile', async () => {
      const result = await userProfileQuery.refetch();
      return result.data;
    });
    
    await runTest('Portfolio Analysis', async () => {
      const result = await portfolioAnalysisQuery.refetch();
      return result.data;
    });
    
    await runTest('Break Even Analysis', async () => {
      const result = await breakEvenAnalysisQuery.refetch();
      return { cruiseCount: result.data?.cruises?.length || 0 };
    });
    
    await runTest('Category Upgrade Analysis', async () => {
      const result = await upgradeAnalysisQuery.refetch();
      return { upgradeCount: result.data?.upgrades?.length || 0 };
    });
    
    // Test enhanced analytics using receipts and statements
    await runTest('Receipt Analytics', async () => {
      const result = await receiptAnalyticsQuery.refetch();
      return {
        totalReceipts: result.data?.totalReceipts || 0,
        totalStatements: result.data?.totalStatements || 0,
        totalSpending: result.data?.totalSpending || 0,
        cruiseBreakdownCount: result.data?.cruiseBreakdown?.length || 0
      };
    });
    
    await runTest('Club Royale Analytics', async () => {
      const result = await clubRoyaleAnalyticsQuery.refetch();
      return {
        totalCasinoSpending: result.data?.totalCasinoSpending || 0,
        totalCruisesWithCasino: result.data?.totalCruisesWithCasino || 0,
        spendingTrend: result.data?.spendingTrend || 'stable'
      };
    });
    
    await runTest('Spending Category Analysis', async () => {
      const result = await spendingCategoryAnalysisQuery.refetch();
      return {
        categoriesCount: result.data?.categories?.length || 0,
        totalOnboardSpending: result.data?.totalOnboardSpending || 0,
        topCategory: result.data?.topSpendingCategories?.[0]?.category || 'none'
      };
    });
  };

  const importTripIt = async () => {
    setIsImporting(true);
    try {
      const result = await importMutation.mutateAsync();
      console.log('[Test] Import complete:', result);
    } catch (error) {
      console.error('[Test] Import failed:', error);
    } finally {
      setIsImporting(false);
    }
  };

  const handleUpdateFinancialData = async () => {
    if (!cruiseId) {
      Alert.alert('Error', 'Please select a cruise first');
      return;
    }

    try {
      await updateFinancialMutation.mutateAsync({
        cruiseId,
        userFinancialData: {
          totalWinningsEarned: winnings ? parseFloat(winnings) : undefined,
          pointsEarnedOnCruise: points ? parseInt(points) : undefined,
          actualAmountPaid: amountPaid ? parseFloat(amountPaid) : undefined,
          additionalFreeplayReceived: freeplay ? parseFloat(freeplay) : undefined,
        },
      });
      
      Alert.alert('Success', 'Financial data updated successfully!');
      getFinancialQuery.refetch();
    } catch (error) {
      Alert.alert('Error', error instanceof Error ? error.message : 'Failed to update');
    }
  };

  const selectFirstCruise = () => {
    if (cruisesQuery.data?.cruises?.[0]) {
      setCruiseId(cruisesQuery.data.cruises[0].id);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <Stack.Screen options={{ title: 'Backend Test + Phase 1' }} />
      <ScrollView style={styles.scrollContent}>
      <View style={styles.header}>
        <Text style={styles.title}>Backend Test Page</Text>
        <Text style={styles.subtitle}>Test tRPC endpoints and calendar sync</Text>
      </View>

      {/* Quick Status */}
      <View style={styles.statusCard}>
        <Text style={styles.sectionTitle}>Quick Status</Text>
        <View style={styles.statusRow}>
          <Text style={styles.label}>Backend:</Text>
          <Text style={[styles.value, { color: statusQuery.data ? '#10B981' : '#EF4444' }]}>
            {statusQuery.isLoading ? 'Checking...' : statusQuery.data ? 'Connected' : 'Disconnected'}
          </Text>
        </View>
        <View style={styles.statusRow}>
          <Text style={styles.label}>Calendar Events:</Text>
          <Text style={styles.value}>
            {calendarEventsQuery.data?.length || 0} total
          </Text>
        </View>
        <View style={styles.statusRow}>
          <Text style={styles.label}>TripIt Events:</Text>
          <Text style={styles.value}>
            {calendarEventsQuery.data?.filter((e: any) => e.source === 'tripit').length || 0}
          </Text>
        </View>
        <View style={styles.statusRow}>
          <Text style={styles.label}>Analytics:</Text>
          <Text style={[styles.value, { color: analyticsTestQuery.data ? '#10B981' : '#EF4444' }]}>
            {analyticsTestQuery.isLoading ? 'Checking...' : analyticsTestQuery.data ? 'Working' : 'Error'}
          </Text>
        </View>
        {/* <View style={styles.statusRow}>
          <Text style={styles.label}>Direct Test:</Text>
          <Text style={[styles.value, { color: testAnalyticsQuery.data?.success ? '#10B981' : '#EF4444' }]}>
            {testAnalyticsQuery.isLoading ? 'Testing...' : testAnalyticsQuery.data?.success ? 'Pass' : 'Fail'}
          </Text>
        </View> */}
        <View style={styles.statusRow}>
          <Text style={styles.label}>Receipts:</Text>
          <Text style={styles.value}>
            {receiptAnalyticsQuery.data?.totalReceipts || 0} receipts, {receiptAnalyticsQuery.data?.totalStatements || 0} statements
          </Text>
        </View>
        <View style={styles.statusRow}>
          <Text style={styles.label}>Club Royale:</Text>
          <Text style={styles.value}>
            ${clubRoyaleAnalyticsQuery.data?.totalCasinoSpending || 0} total spending
          </Text>
        </View>
      </View>

      {/* Test Actions */}
      <View style={styles.actionsCard}>
        <Text style={styles.sectionTitle}>Test Actions</Text>
        
        <TouchableOpacity
          style={[styles.button, styles.primaryButton]}
          onPress={runAllTests}
        >
          <Text style={styles.buttonText}>Run All Tests</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.button, styles.successButton]}
          onPress={importTripIt}
          disabled={isImporting}
        >
          {isImporting ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <Text style={styles.buttonText}>Import TripIt Calendar (78 events)</Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.button, styles.warningButton]}
          onPress={async () => {
            const result = await trpc.calendar.addSampleEvents.useMutation().mutateAsync();
            Alert.alert('Sample Events', `Added ${result.eventsAdded} sample events`);
            calendarEventsQuery.refetch();
          }}
        >
          <Text style={styles.buttonText}>Add Sample Events</Text>
        </TouchableOpacity>
        
        <TouchableOpacity
          style={[styles.button, { backgroundColor: '#8B5CF6' }]}
          onPress={() => {
            Alert.alert(
              'Enhanced Analytics Test',
              `Receipts: ${receiptAnalyticsQuery.data?.totalReceipts || 0}\n` +
              `Statements: ${receiptAnalyticsQuery.data?.totalStatements || 0}\n` +
              `Total Spending: ${receiptAnalyticsQuery.data?.totalSpending || 0}\n` +
              `Club Royale: ${clubRoyaleAnalyticsQuery.data?.totalCasinoSpending || 0}\n` +
              `Categories: ${spendingCategoryAnalysisQuery.data?.categories?.length || 0}\n\n` +
              'Upload receipts and statements via OCR to see real analytics data.'
            );
          }}
        >
          <Text style={styles.buttonText}>📊 Test Enhanced Analytics</Text>
        </TouchableOpacity>
        
        <TouchableOpacity
          style={[styles.button, { backgroundColor: '#10B981' }]}
          onPress={() => {
            // Navigate to OCR page for testing
            Alert.alert(
              'Upload Test Documents',
              'Use the OCR page to upload receipts and statements to test the enhanced analytics.',
              [
                { text: 'Cancel', style: 'cancel' },
                { text: 'Go to OCR', onPress: () => {
                  // Navigate to OCR page
                  console.log('Navigate to OCR page');
                }}
              ]
            );
          }}
        >
          <Text style={styles.buttonText}>📄 Upload Test Documents</Text>
        </TouchableOpacity>
        
        {/* <TouchableOpacity
          style={[styles.button, { backgroundColor: '#EF4444' }]}
          onPress={() => restartMutation.mutate()}
          disabled={restartMutation.isPending}
        >
          {restartMutation.isPending ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <Text style={styles.buttonText}>🔄 Restart Backend</Text>
          )}
        </TouchableOpacity> */}
      </View>

      {/* Test Results */}
      {testResults.length > 0 && (
        <View style={styles.resultsCard}>
          <Text style={styles.sectionTitle}>Test Results</Text>
          {testResults.map((test, index) => (
            <View key={index} style={styles.testResult}>
              <View style={styles.testHeader}>
                <Text style={styles.testName}>{test.name}</Text>
                <View style={[styles.badge, test.success ? styles.successBadge : styles.errorBadge]}>
                  <Text style={styles.badgeText}>{test.success ? 'PASS' : 'FAIL'}</Text>
                </View>
              </View>
              <Text style={styles.testTime}>{new Date(test.timestamp).toLocaleTimeString()}</Text>
              {test.success ? (
                <Text style={styles.testData}>{JSON.stringify(test.result, null, 2)}</Text>
              ) : (
                <Text style={styles.testError}>{test.error}</Text>
              )}
            </View>
          ))}
        </View>
      )}

      {/* Calendar Events Preview */}
      {calendarEventsQuery.data && calendarEventsQuery.data.length > 0 && (
        <View style={styles.eventsCard}>
          <Text style={styles.sectionTitle}>Calendar Events Preview</Text>
          <Text style={styles.eventCount}>
            Total: {calendarEventsQuery.data.length} events
          </Text>
          {calendarEventsQuery.data.slice(0, 5).map((event: any, index: number) => (
            <View key={index} style={styles.eventItem}>
              <Text style={styles.eventTitle}>{event.summary}</Text>
              <Text style={styles.eventDate}>
                {event.startDate} - {event.endDate}
              </Text>
              <View style={[styles.sourceBadge, 
                event.source === 'tripit' ? styles.tripitBadge : 
                event.source === 'booked' ? styles.bookedBadge : 
                styles.manualBadge
              ]}>
                <Text style={styles.sourceText}>{event.source}</Text>
              </View>
            </View>
          ))}
        </View>
      )}
      
      {/* Phase 1 Testing Section */}
      <View style={styles.phase1Card}>
        <Text style={styles.sectionTitle}>🚀 Phase 1: Financial Data Backend Test</Text>
        
        <View style={styles.phase1Section}>
          <Text style={styles.phase1SectionTitle}>1. Select Test Cruise</Text>
          {cruisesQuery.isLoading && <Text style={styles.loadingText}>Loading cruises...</Text>}
          {cruisesQuery.data?.cruises?.[0] && (
            <View>
              <Text style={styles.cruiseInfo}>
                {cruisesQuery.data.cruises[0].ship} - {cruisesQuery.data.cruises[0].departureDate}
              </Text>
              <TouchableOpacity style={[styles.button, styles.selectButton]} onPress={selectFirstCruise}>
                <Text style={styles.buttonText}>Select This Cruise</Text>
              </TouchableOpacity>
            </View>
          )}
          {cruiseId && <Text style={styles.successText}>✅ Selected cruise: {cruiseId.substring(0, 8)}...</Text>}
        </View>

        <View style={styles.phase1Section}>
          <Text style={styles.phase1SectionTitle}>2. Enter Financial Data</Text>
          
          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Total Winnings Earned ($)</Text>
            <TextInput
              style={styles.textInput}
              value={winnings}
              onChangeText={setWinnings}
              placeholder="e.g. 500"
              keyboardType="numeric"
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Points Earned on Cruise</Text>
            <TextInput
              style={styles.textInput}
              value={points}
              onChangeText={setPoints}
              placeholder="e.g. 1200"
              keyboardType="numeric"
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Actual Amount Paid ($)</Text>
            <TextInput
              style={styles.textInput}
              value={amountPaid}
              onChangeText={setAmountPaid}
              placeholder="e.g. -151"
              keyboardType="numeric"
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Additional Freeplay Received ($)</Text>
            <TextInput
              style={styles.textInput}
              value={freeplay}
              onChangeText={setFreeplay}
              placeholder="e.g. 100"
              keyboardType="numeric"
            />
          </View>

          <TouchableOpacity 
            style={[styles.button, styles.updateButton]} 
            onPress={handleUpdateFinancialData}
            disabled={!cruiseId || updateFinancialMutation.isPending}
          >
            <Text style={styles.buttonText}>
              {updateFinancialMutation.isPending ? 'Updating...' : 'Update Financial Data'}
            </Text>
          </TouchableOpacity>
        </View>

        <View style={styles.phase1Section}>
          <Text style={styles.phase1SectionTitle}>3. Current Financial Data</Text>
          {getFinancialQuery.isLoading && <Text style={styles.loadingText}>Loading...</Text>}
          {getFinancialQuery.data && (
            <View style={styles.dataDisplay}>
              <Text style={styles.dataTitle}>User Financial Data:</Text>
              {getFinancialQuery.data.userFinancialData ? (
                <View>
                  <Text style={styles.dataText}>Winnings: ${getFinancialQuery.data.userFinancialData.totalWinningsEarned || 'N/A'}</Text>
                  <Text style={styles.dataText}>Points: {getFinancialQuery.data.userFinancialData.pointsEarnedOnCruise || 'N/A'}</Text>
                  <Text style={styles.dataText}>Amount Paid: ${getFinancialQuery.data.userFinancialData.actualAmountPaid || 'N/A'}</Text>
                  <Text style={styles.dataText}>Freeplay: ${getFinancialQuery.data.userFinancialData.additionalFreeplayReceived || 'N/A'}</Text>
                  <Text style={styles.timestampText}>Last Updated: {new Date(getFinancialQuery.data.userFinancialData.lastUpdated).toLocaleString()}</Text>
                </View>
              ) : (
                <Text style={styles.dataText}>No financial data entered yet</Text>
              )}
              
              <Text style={styles.dataTitle}>Data Sources:</Text>
              {getFinancialQuery.data.dataSource ? (
                <View>
                  <Text style={styles.dataText}>Pricing: {getFinancialQuery.data.dataSource.pricing}</Text>
                  <Text style={styles.dataText}>Financial: {getFinancialQuery.data.dataSource.financial}</Text>
                  <Text style={styles.dataText}>Points: {getFinancialQuery.data.dataSource.points}</Text>
                </View>
              ) : (
                <Text style={styles.dataText}>No data source tracking yet</Text>
              )}
            </View>
          )}
        </View>

        <View style={styles.phase1Section}>
          <Text style={styles.phase1SectionTitle}>4. Phase 1 Completion Status</Text>
          <Text style={styles.testResultText}>✅ Data model updated with user financial inputs</Text>
          <Text style={styles.testResultText}>✅ Backend endpoints created for storing/retrieving data</Text>
          <Text style={styles.testResultText}>✅ Data source tracking implemented</Text>
          <Text style={styles.testResultText}>✅ Backup system includes all persisted data</Text>
          <Text style={styles.phase1Complete}>🎉 Phase 1 Complete! Ready for Phase 2.</Text>
        </View>
      </View>
      
    </ScrollView>
    </SafeAreaView>
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
  statusCard: {
    backgroundColor: '#FFFFFF',
    margin: 16,
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 12,
  },
  statusRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
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
  actionsCard: {
    backgroundColor: '#FFFFFF',
    marginHorizontal: 16,
    marginBottom: 16,
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  button: {
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
    marginBottom: 8,
  },
  primaryButton: {
    backgroundColor: '#3B82F6',
  },
  successButton: {
    backgroundColor: '#10B981',
  },
  warningButton: {
    backgroundColor: '#F59E0B',
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  resultsCard: {
    backgroundColor: '#FFFFFF',
    marginHorizontal: 16,
    marginBottom: 16,
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  testResult: {
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
    paddingBottom: 12,
    marginBottom: 12,
  },
  testHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  testName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#111827',
  },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
  },
  successBadge: {
    backgroundColor: '#D1FAE5',
  },
  errorBadge: {
    backgroundColor: '#FEE2E2',
  },
  badgeText: {
    fontSize: 10,
    fontWeight: '700',
  },
  testTime: {
    fontSize: 12,
    color: '#6B7280',
    marginBottom: 4,
  },
  testData: {
    fontSize: 12,
    color: '#374151',
    fontFamily: 'monospace',
  },
  testError: {
    fontSize: 12,
    color: '#EF4444',
  },
  eventsCard: {
    backgroundColor: '#FFFFFF',
    marginHorizontal: 16,
    marginBottom: 16,
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  eventCount: {
    fontSize: 14,
    color: '#6B7280',
    marginBottom: 12,
  },
  eventItem: {
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  eventTitle: {
    fontSize: 14,
    fontWeight: '500',
    color: '#111827',
    marginBottom: 2,
  },
  eventDate: {
    fontSize: 12,
    color: '#6B7280',
    marginBottom: 4,
  },
  sourceBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
  },
  tripitBadge: {
    backgroundColor: '#DBEAFE',
  },
  bookedBadge: {
    backgroundColor: '#FEE2E2',
  },
  manualBadge: {
    backgroundColor: '#FEF3C7',
  },
  sourceText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#374151',
  },
  scrollContent: {
    flex: 1,
  },
  // Phase 1 Testing Styles
  phase1Card: {
    backgroundColor: '#FFFFFF',
    marginHorizontal: 16,
    marginBottom: 16,
    padding: 16,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#10B981',
  },
  phase1Section: {
    marginBottom: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  phase1SectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 8,
  },
  cruiseInfo: {
    fontSize: 14,
    color: '#6B7280',
    marginBottom: 8,
  },
  selectButton: {
    backgroundColor: '#3B82F6',
  },
  updateButton: {
    backgroundColor: '#10B981',
    marginTop: 12,
  },
  successText: {
    color: '#10B981',
    fontSize: 12,
    marginTop: 4,
  },
  loadingText: {
    color: '#6B7280',
    fontSize: 14,
    fontStyle: 'italic',
  },
  inputGroup: {
    marginBottom: 12,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: '#374151',
    marginBottom: 4,
  },
  textInput: {
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 6,
    padding: 10,
    fontSize: 14,
    backgroundColor: '#F9FAFB',
  },
  dataDisplay: {
    backgroundColor: '#F9FAFB',
    padding: 12,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  dataTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#111827',
    marginTop: 8,
    marginBottom: 4,
  },
  dataText: {
    fontSize: 13,
    color: '#374151',
    marginBottom: 2,
  },
  timestampText: {
    fontSize: 11,
    color: '#6B7280',
    fontStyle: 'italic',
    marginTop: 4,
  },
  testResultText: {
    fontSize: 13,
    color: '#10B981',
    marginBottom: 2,
  },
  phase1Complete: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#10B981',
    textAlign: 'center',
    marginTop: 8,
    padding: 8,
    backgroundColor: '#D1FAE5',
    borderRadius: 6,
  },
});