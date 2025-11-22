import React from 'react';
import {
  ScrollView,
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  RefreshControl,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { router, Stack } from 'expo-router';
import { ArrowLeft, CheckCircle, XCircle, Wrench, RefreshCw } from 'lucide-react-native';
import { trpc } from '@/lib/trpc';
import { useAppState } from '@/state/AppStateProvider';

export default function VerifyDataScreen() {
  const { hasLocalData, localData } = useAppState();
  const [refreshing, setRefreshing] = React.useState(false);
  const [isFixing, setIsFixing] = React.useState(false);
  const [hasInitialized, setHasInitialized] = React.useState(false);

  console.log('[VerifyData] Component mounted');

  // Use separate queries/mutations for verification and cleanup
  const verifyDataQuery = trpc.cruises.verifyData.useQuery(undefined, {
    enabled: false,
  });
  const cleanupDataMutation = trpc.cruises.cleanupData.useMutation();
  const batchVerifyMutation = trpc.cruises.batchVerify.useMutation();
  const getCurrentDataMutation = trpc.cruises.getCurrentData.useMutation();

  const [verificationResults, setVerificationResults] = React.useState<any>(null);
  const [batchResult, setBatchResult] = React.useState<any>(null);
  const [webDataResult, setWebDataResult] = React.useState<any>(null);

  // Run comprehensive data verification
  const runVerification = React.useCallback(async (fixIssues: boolean = false) => {
    try {
      if (fixIssues) {
        setIsFixing(true);
        console.log('[VerifyData] Running cleanup/fixes');
        const cleanupResult = await cleanupDataMutation.mutateAsync();
        const verificationResult = await verifyDataQuery.refetch();
        const result = verificationResult.data;
        if (result) {
          const transformedResult = {
            totalIssues: result.validationIssues.length,
            totalFixes: cleanupResult.cleanedShips + cleanupResult.standardizedDates + cleanupResult.fixedBookings,
            issuesFound: result.validationIssues.map(issue => `${issue.ship}: ${issue.issues.join(', ')}`),
            fixesApplied: [
              '✅ Comprehensive data cleanup completed',
              '🔧 Applied fixes:',
              cleanupResult.cleanedShips > 0 ? `  • Cleaned ${cleanupResult.cleanedShips} ship names` : null,
              cleanupResult.standardizedDates > 0 ? `  • Standardized ${cleanupResult.standardizedDates} dates` : null,
              cleanupResult.fixedBookings > 0 ? `  • Fixed ${cleanupResult.fixedBookings} booking IDs` : null,
              cleanupResult.deletedOffers > 0 ? `  • Removed ${cleanupResult.deletedOffers} expired offers` : null,
              cleanupResult.deletedCruises > 0 ? `  • Removed ${cleanupResult.deletedCruises} expired cruises` : null,
            ].filter(Boolean),
            dataStats: {
              totalCruises: result.totalCruises,
              totalBookedCruises: 0,
              cruisesWithValidDates: result.validCruises,
              cruisesWithNights: result.validCruises,
              cruisesWithPricing: result.linkedCruises,
            },
          };
          setVerificationResults(transformedResult);
          const totalFixes = cleanupResult.cleanedShips + cleanupResult.standardizedDates + cleanupResult.fixedBookings;
          if (totalFixes > 0) {
            Alert.alert('Data Fixed Successfully! ✅', `Applied ${totalFixes} fixes to your cruise data. All cruise information should now be accurate and complete.`, [{ text: 'Great!', style: 'default' }]);
          }
        }
      } else {
        setRefreshing(true);
        console.log('[VerifyData] Running verification only');
        const verificationResult = await verifyDataQuery.refetch();
        const result = verificationResult.data;
        if (result) {
          const transformedResult = {
            totalIssues: result.validationIssues.length,
            totalFixes: 0,
            issuesFound: result.validationIssues.map(issue => `${issue.ship}: ${issue.issues.join(', ')}`),
            fixesApplied: [],
            dataStats: {
              totalCruises: result.totalCruises,
              totalBookedCruises: 0,
              cruisesWithValidDates: result.validCruises,
              cruisesWithNights: result.validCruises,
              cruisesWithPricing: result.linkedCruises,
            },
          };
          setVerificationResults(transformedResult);
        }
      }
    } catch (error) {
      console.error('[VerifyData] Error during verification:', error);
      Alert.alert('Verification Error', 'Failed to verify data. Please try again.', [{ text: 'OK', style: 'default' }]);
    } finally {
      setRefreshing(false);
      setIsFixing(false);
    }
  }, [cleanupDataMutation, verifyDataQuery]);

  const runBatchVerify = React.useCallback(async () => {
    try {
      setIsFixing(true);
      console.log('[VerifyData] Starting batch verify');
      const res = await batchVerifyMutation.mutateAsync({ batchSize: 100, maxBatches: 2, forceRefresh: true });
      setBatchResult(res);
      Alert.alert('Batch Verification Complete', res?.message || 'Done');
      await runVerification(false);
    } catch (e: any) {
      Alert.alert('Batch Verify Failed', e?.message || 'Unknown error');
    } finally {
      setIsFixing(false);
    }
  }, [batchVerifyMutation, runVerification]);

  const runGetCurrentData = React.useCallback(async () => {
    try {
      setIsFixing(true);
      console.log('[VerifyData] Getting current data');
      const res = await getCurrentDataMutation.mutateAsync({ forceRefresh: true });
      setWebDataResult(res);
      Alert.alert('Web Data Update', res?.message || 'Done');
      await runVerification(false);
    } catch (e: any) {
      Alert.alert('Web Data Update Failed', e?.message || 'Unknown error');
    } finally {
      setIsFixing(false);
    }
  }, [getCurrentDataMutation, runVerification]);

  const onRefresh = React.useCallback(async () => {
    await runVerification(false);
  }, [runVerification]);
  
  // Auto-run verification on mount (only once)
  React.useEffect(() => {
    if (!hasInitialized) {
      setHasInitialized(true);
      runVerification(false);
    }
  }, [hasInitialized, runVerification]);

  // Calculate stats from verification results
  const stats = React.useMemo(() => {
    if (verificationResults?.dataStats) {
      return {
        totalCruises: verificationResults.dataStats.totalCruises,
        validCruises: verificationResults.dataStats.cruisesWithValidDates,
        linkedCruises: verificationResults.dataStats.cruisesWithPricing,
        totalOffers: 0, // Will be updated when we have offer data
        totalBooked: verificationResults.dataStats.totalBookedCruises
      };
    }
    
    // Fallback to local data calculation
    if (hasLocalData && localData) {
      const cruises = localData.cruises || [];
      const offers = localData.offers || [];
      const booked = localData.booked || [];
      
      const validCruises = cruises.filter((cruise: any) => {
        return cruise.ship && cruise.departureDate && cruise.itineraryName;
      }).length;
      
      const linkedCruises = cruises.filter((cruise: any) => {
        const offerCode = cruise.offerCode || cruise['Offer Code'] || cruise['OFFER CODE'];
        return offerCode && offerCode.toString().trim() !== '';
      }).length;
      
      return {
        totalCruises: cruises.length,
        validCruises,
        linkedCruises,
        totalOffers: offers.length,
        totalBooked: booked.length
      };
    }
    
    return {
      totalCruises: 0,
      validCruises: 0,
      linkedCruises: 0,
      totalOffers: 0,
      totalBooked: 0
    };
  }, [verificationResults, hasLocalData, localData]);

  // Get validation issues from verification results
  const validationIssues = React.useMemo(() => {
    if (verificationResults?.issuesFound) {
      return verificationResults.issuesFound;
    }
    return [];
  }, [verificationResults]);
  
  // Show loading state
  if (cleanupDataMutation.isPending || verifyDataQuery.isFetching || refreshing) {
    return (
      <>
        <Stack.Screen 
          options={{
            headerShown: true,
            title: 'Verify Data',
            headerStyle: { backgroundColor: '#6C5CE7' },
            headerTintColor: '#FFFFFF',
            headerLeft: () => (
              <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
                <ArrowLeft size={24} color="#FFFFFF" />
              </TouchableOpacity>
            ),
          }} 
        />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#6C5CE7" />
          <Text style={styles.loadingText}>
            {isFixing ? 'Fixing cruise data...' : 'Analyzing cruise data...'}
          </Text>
        </View>
      </>
    );
  }

  return (
    <>
      <Stack.Screen 
        options={{
          headerShown: true,
          title: 'Verify Data',
          headerStyle: {
            backgroundColor: '#6C5CE7',
          },
          headerTintColor: '#FFFFFF',
          headerLeft: () => (
            <TouchableOpacity 
              onPress={() => router.back()}
              style={styles.backButton}
            >
              <ArrowLeft size={24} color="#FFFFFF" />
            </TouchableOpacity>
          ),
        }} 
      />
      <ScrollView 
        style={styles.container}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        testID="verify-data-screen"
      >
        {/* Header Stats */}
        <View style={styles.statsSection}>
          <Text style={styles.sectionTitle}>Data Verification Summary</Text>
          
          <View style={styles.statsGrid}>
            <View style={styles.statCard}>
              <Text style={styles.statNumber}>{stats.totalCruises}</Text>
              <Text style={styles.statLabel}>Total Cruises</Text>
            </View>
            <View style={[styles.statCard, styles.validCard]}>
              <Text style={[styles.statNumber, styles.validNumber]}>{stats.validCruises}</Text>
              <Text style={styles.statLabel}>Valid</Text>
            </View>
            <View style={[styles.statCard, styles.invalidCard]}>
              <Text style={[styles.statNumber, styles.invalidNumber]}>{validationIssues.length}</Text>
              <Text style={styles.statLabel}>Issues</Text>
            </View>
          </View>
          
          <View style={styles.statsGrid}>
            <View style={styles.statCard}>
              <Text style={styles.statNumber}>{stats.totalOffers}</Text>
              <Text style={styles.statLabel}>Total Offers</Text>
            </View>
            <View style={[styles.statCard, styles.linkedCard]}>
              <Text style={[styles.statNumber, styles.linkedNumber]}>{stats.linkedCruises}</Text>
              <Text style={styles.statLabel}>Linked Cruises</Text>
            </View>
            <View style={styles.statCard}>
              <Text style={styles.statNumber}>{stats.totalBooked}</Text>
              <Text style={styles.statLabel}>Booked Cruises</Text>
            </View>
          </View>
        </View>

        {/* Summary Message */}
        {verificationResults && (
          <View style={verificationResults.issuesFound.length > 0 ? styles.warningSection : styles.successSection}>
            {verificationResults.issuesFound.length > 0 ? (
              <>
                <XCircle size={48} color="#EF4444" />
                <Text style={styles.warningTitle}>Data Issues Detected</Text>
                <Text style={styles.warningMessage}>
                  Found {verificationResults.totalIssues} issues that can be automatically fixed.
                  Click &ldquo;Fix All Issues&rdquo; to make your cruise data 100% accurate.
                </Text>
              </>
            ) : (
              <>
                <CheckCircle size={48} color="#22C55E" />
                <Text style={styles.successTitle}>All Data Verified! ✅</Text>
                <Text style={styles.successMessage}>
                  All {stats.totalCruises} cruise records have accurate dates, durations, and information.
                </Text>
              </>
            )}
          </View>
        )}

        {/* Verification Results */}
        {verificationResults && (
          <View style={styles.resultsSection}>
            <Text style={styles.sectionTitle}>Verification Results</Text>
            
            {verificationResults.issuesFound.length > 0 ? (
              <View style={styles.issuesContainer}>
                <Text style={styles.issuesTitle}>Issues Found:</Text>
                {verificationResults.issuesFound.map((issue: string, index: number) => (
                  <Text key={index} style={styles.issueItem}>• {issue}</Text>
                ))}
              </View>
            ) : (
              <View style={styles.successContainer}>
                <CheckCircle size={24} color="#22C55E" />
                <Text style={styles.successText}>All cruise data is accurate! ✅</Text>
              </View>
            )}
            
            {verificationResults.fixesApplied.length > 0 && (
              <View style={styles.fixesContainer}>
                <Text style={styles.fixesTitle}>Fixes Applied:</Text>
                {verificationResults.fixesApplied.map((fix: string, index: number) => (
                  <Text key={index} style={styles.fixItem}>{fix}</Text>
                ))}
              </View>
            )}
          </View>
        )}

        {/* Action Buttons */}
        <View style={styles.actionSection}>
          <TouchableOpacity
            testID="btn-cleanup"
            style={[styles.actionButton, styles.fixButton]}
            onPress={() => {
              Alert.alert(
                'Fix All Cruise Data',
                'This will automatically fix detected issues (dates, nights, itinerary, booking IDs). Continue?',
                [
                  { text: 'Cancel', style: 'cancel' },
                  { text: 'Fix All Data', style: 'default', onPress: () => runVerification(true) }
                ]
              );
            }}
            disabled={isFixing}
          >
            {isFixing ? <ActivityIndicator size="small" color="#FFFFFF" /> : <Wrench size={20} color="#FFFFFF" />}
            <Text style={styles.actionButtonText}>{isFixing ? 'Working...' : 'Fix All Issues'}</Text>
          </TouchableOpacity>

          <TouchableOpacity
            testID="btn-batch-verify"
            style={[styles.actionButton, styles.refreshButton]}
            onPress={runBatchVerify}
            disabled={isFixing}
          >
            <RefreshCw size={20} color="#FFFFFF" />
            <Text style={styles.actionButtonText}>Batch Verify (Phase 2)</Text>
          </TouchableOpacity>

          <TouchableOpacity
            testID="btn-current-data"
            style={[styles.actionButton, { backgroundColor: '#0EA5E9' }]}
            onPress={runGetCurrentData}
            disabled={isFixing}
          >
            <RefreshCw size={20} color="#FFFFFF" />
            <Text style={styles.actionButtonText}>Get Current Data</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.actionButton}
            onPress={() => router.push('/import')}
          >
            <Text style={styles.actionButtonText}>Import More Data</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.actionButton, { backgroundColor: '#3B82F6' }]}
            onPress={() => router.push('/data-scraping')}
          >
            <Text style={styles.actionButtonText}>Real-World Data Scraping</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.actionButton, styles.secondaryButton]}
            onPress={() => router.back()}
          >
            <Text style={[styles.actionButtonText, styles.secondaryButtonText]}>Back to Cruises</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  backButton: {
    padding: 8,
  },
  statsSection: {
    backgroundColor: '#FFFFFF',
    margin: 16,
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 16,
  },
  statsGrid: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 12,
  },
  statCard: {
    flex: 1,
    backgroundColor: '#F9FAFB',
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  validCard: {
    backgroundColor: '#F0FDF4',
    borderColor: '#22C55E',
  },
  invalidCard: {
    backgroundColor: '#FEF2F2',
    borderColor: '#EF4444',
  },
  linkedCard: {
    backgroundColor: '#EFF6FF',
    borderColor: '#3B82F6',
  },
  unlinkedCard: {
    backgroundColor: '#FDF4FF',
    borderColor: '#8B5CF6',
  },
  statNumber: {
    fontSize: 24,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 4,
  },
  validNumber: {
    color: '#22C55E',
  },
  invalidNumber: {
    color: '#EF4444',
  },
  linkedNumber: {
    color: '#3B82F6',
  },
  unlinkedNumber: {
    color: '#8B5CF6',
  },
  statLabel: {
    fontSize: 12,
    color: '#6B7280',
    fontWeight: '500',
    textAlign: 'center',
  },
  issueSection: {
    backgroundColor: '#FFFFFF',
    margin: 16,
    marginTop: 0,
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  issueSectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  issueSectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
  },
  issueCard: {
    backgroundColor: '#F9FAFB',
    padding: 12,
    borderRadius: 8,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  issueHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  issueShip: {
    fontSize: 14,
    fontWeight: '600',
    color: '#111827',
  },
  issueCount: {
    fontSize: 12,
    color: '#EF4444',
    fontWeight: '500',
  },
  issuesList: {
    marginTop: 8,
    gap: 4,
  },
  issueText: {
    fontSize: 12,
    color: '#6B7280',
    lineHeight: 16,
  },
  successSection: {
    backgroundColor: '#FFFFFF',
    margin: 16,
    marginTop: 0,
    padding: 32,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    alignItems: 'center',
  },
  successTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#22C55E',
    marginTop: 12,
    marginBottom: 8,
  },
  successMessage: {
    fontSize: 14,
    color: '#6B7280',
    textAlign: 'center',
    lineHeight: 20,
  },
  actionSection: {
    padding: 16,
    gap: 12,
  },
  actionButton: {
    backgroundColor: '#6C5CE7',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
    alignItems: 'center',
  },
  secondaryButton: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  actionButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  secondaryButtonText: {
    color: '#6B7280',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    gap: 16,
  },
  loadingText: {
    fontSize: 16,
    color: '#6B7280',
    fontWeight: '500',
  },
  resultsSection: {
    backgroundColor: '#FFFFFF',
    margin: 16,
    marginTop: 0,
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  issuesContainer: {
    backgroundColor: '#FEF2F2',
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#FECACA',
    marginBottom: 12,
  },
  issuesTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#DC2626',
    marginBottom: 8,
  },
  issueItem: {
    fontSize: 13,
    color: '#7F1D1D',
    lineHeight: 18,
    marginBottom: 2,
  },
  successContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F0FDF4',
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#BBF7D0',
    gap: 8,
  },
  successText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#15803D',
  },
  fixesContainer: {
    backgroundColor: '#EFF6FF',
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#BFDBFE',
    marginTop: 12,
  },
  fixesTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1D4ED8',
    marginBottom: 8,
  },
  fixItem: {
    fontSize: 13,
    color: '#1E40AF',
    lineHeight: 18,
    marginBottom: 2,
  },
  fixButton: {
    backgroundColor: '#EF4444',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  refreshButton: {
    backgroundColor: '#3B82F6',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  warningSection: {
    backgroundColor: '#FFFFFF',
    margin: 16,
    marginTop: 0,
    padding: 32,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    alignItems: 'center',
  },
  warningTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#EF4444',
    marginTop: 12,
    marginBottom: 8,
  },
  warningMessage: {
    fontSize: 14,
    color: '#6B7280',
    textAlign: 'center',
    lineHeight: 20,
  },
});