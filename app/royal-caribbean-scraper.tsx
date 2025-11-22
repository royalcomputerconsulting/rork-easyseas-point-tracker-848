import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack } from 'expo-router';
import { trpc } from '@/lib/trpc';
import { Clock, Download, Play, Square, RefreshCw, FileText, Ship } from 'lucide-react-native';

interface ScrapingSession {
  id: string;
  status: 'running' | 'completed' | 'failed' | 'cancelled';
  startTime: string;
  endTime?: string;
  progress: {
    currentOffer: number;
    totalOffers: number;
    currentOfferName?: string;
  };
  results: {
    offersProcessed: number;
    cruisesFound: number;
    cruisesAdded: number;
    errors: string[];
  };
  duration: number;
}

export default function RoyalCaribbeanScraperScreen() {
  const [currentSession, setCurrentSession] = useState<ScrapingSession | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  // tRPC queries and mutations
  const sessionsQuery = trpc.cruises.listScrapingSessions.useQuery();
  const offersQuery = trpc.cruises.getRoyalCaribbeanOffers.useQuery();
  const startScrapingMutation = trpc.cruises.startRoyalCaribbeanScraping.useMutation();
  const webScraperMutation = trpc.cruises.webScraper.useMutation();
  const cancelSessionMutation = trpc.cruises.cancelScrapingSession.useMutation();
  const processFilesMutation = trpc.cruises.processScrapedFiles.useMutation();

  // Poll for session status if there's an active session
  const statusQuery = trpc.cruises.getScrapingStatus.useQuery(
    { sessionId: currentSession?.id || '' },
    {
      enabled: !!currentSession && currentSession.status === 'running',
      refetchInterval: 2000, // Poll every 2 seconds
    }
  );

  // Update current session when status changes
  useEffect(() => {
    if (statusQuery.data?.found && statusQuery.data.session) {
      setCurrentSession(statusQuery.data.session);
      
      // Stop polling if session is complete
      if (statusQuery.data.session.status !== 'running') {
        sessionsQuery.refetch();
        offersQuery.refetch();
      }
    }
  }, [statusQuery.data, sessionsQuery, offersQuery]);

  const handleWebScraper = async () => {
    try {
      const result = await webScraperMutation.mutateAsync({
        maxCruises: 432,
        loginWaitSeconds: 180,
        useHeadless: false,
        scrollDelay: 2000
      });

      if (result.success) {
        // Handle the rollback-enabled response
        const scraperResult = (result as any).result || result;
        const message = (scraperResult as any).message || 'Web scraper completed successfully';
        const method = (scraperResult as any).method || 'WEB_SCRAPING';
        const cruisesFound = (scraperResult as any).cruisesFound || 0;
        const cruisesAdded = (scraperResult as any).cruisesAdded || 0;
        
        Alert.alert(
          'Web Scraper Complete! ✅',
          `${message}\n\nMethod: ${method}\nCruises Found: ${cruisesFound}\nCruises Added: ${cruisesAdded}`,
          [{ text: 'Awesome!' }]
        );
        
        // Refresh data
        offersQuery.refetch();
      } else {
        Alert.alert('Error', (result as any).error || 'Web scraper failed');
      }
    } catch (error) {
      Alert.alert('Error', `Failed to run web scraper: ${error}`);
    }
  };

  const handleStartScraping = async () => {
    try {
      const result = await startScrapingMutation.mutateAsync({
        maxOffers: 9,
        loginWaitSeconds: 180,
        headless: false
      });

      if (result.success) {
        Alert.alert(
          'Scraper Started! 🚀',
          `${result.message}\n\nEstimated time: ${result.estimatedDuration}\n\nA browser window should open shortly for you to log in.`,
          [{ text: 'Got it!' }]
        );
        
        // Set up polling for this session
        setCurrentSession({
          id: result.sessionId,
          status: 'running',
          startTime: new Date().toISOString(),
          progress: { currentOffer: 0, totalOffers: result.maxOffers || 9 },
          results: { offersProcessed: 0, cruisesFound: 0, cruisesAdded: 0, errors: [] },
          duration: 0
        });
      } else {
        Alert.alert('Error', result.error || 'Failed to start scraping');
      }
    } catch (error) {
      Alert.alert('Error', `Failed to start scraping: ${error}`);
    }
  };

  const handleCancelSession = async () => {
    if (!currentSession) return;

    try {
      const result = await cancelSessionMutation.mutateAsync({
        sessionId: currentSession.id
      });

      if (result.success) {
        Alert.alert('Session Cancelled', result.message);
        setCurrentSession(null);
        sessionsQuery.refetch();
      } else {
        Alert.alert('Error', result.error || 'Failed to cancel session');
      }
    } catch (error) {
      Alert.alert('Error', `Failed to cancel session: ${error}`);
    }
  };

  const handleProcessFiles = async () => {
    try {
      const result = await processFilesMutation.mutateAsync({});

      Alert.alert(
        'Files Processed',
        result.message,
        [{ text: 'OK' }]
      );

      if (result.success) {
        offersQuery.refetch();
      }
    } catch (error) {
      Alert.alert('Error', `Failed to process files: ${error}`);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await Promise.all([
      sessionsQuery.refetch(),
      offersQuery.refetch()
    ]);
    setRefreshing(false);
  };

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'running': return '#007AFF';
      case 'completed': return '#34C759';
      case 'failed': return '#FF3B30';
      case 'cancelled': return '#FF9500';
      default: return '#8E8E93';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'running': return <ActivityIndicator size="small" color="#007AFF" />;
      case 'completed': return <Download size={16} color="#34C759" />;
      case 'failed': return <Square size={16} color="#FF3B30" />;
      case 'cancelled': return <Square size={16} color="#FF9500" />;
      default: return <Clock size={16} color="#8E8E93" />;
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <Stack.Screen 
        options={{ 
          title: 'Royal Caribbean Scraper',
          headerStyle: { backgroundColor: '#f8f9fa' },
          headerTitleStyle: { color: '#1a1a1a' }
        }} 
      />
      
      <ScrollView 
        style={styles.scrollView}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        {/* Current Session Status */}
        {currentSession && (
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <Text style={styles.cardTitle}>Current Session</Text>
              {getStatusIcon(currentSession.status)}
            </View>
            
            <View style={styles.sessionInfo}>
              <Text style={styles.sessionId}>ID: {currentSession.id}</Text>
              <Text style={[styles.status, { color: getStatusColor(currentSession.status) }]}>
                Status: {currentSession.status.toUpperCase()}
              </Text>
              <Text style={styles.duration}>
                Duration: {formatDuration(currentSession.duration || 0)}
              </Text>
            </View>

            {currentSession.status === 'running' && (
              <View style={styles.progressSection}>
                <Text style={styles.progressText}>
                  Processing offer {currentSession.progress.currentOffer} of {currentSession.progress.totalOffers}
                </Text>
                {currentSession.progress.currentOfferName && (
                  <Text style={styles.currentOffer}>
                    {currentSession.progress.currentOfferName}
                  </Text>
                )}
                <View style={styles.progressBar}>
                  <View 
                    style={[
                      styles.progressFill, 
                      { width: `${(currentSession.progress.currentOffer / currentSession.progress.totalOffers) * 100}%` }
                    ]} 
                  />
                </View>
              </View>
            )}

            <View style={styles.resultsSection}>
              <Text style={styles.resultsTitle}>Results:</Text>
              <Text style={styles.resultItem}>
                • Offers Processed: {currentSession.results.offersProcessed}
              </Text>
              <Text style={styles.resultItem}>
                • Cruises Found: {currentSession.results.cruisesFound}
              </Text>
              <Text style={styles.resultItem}>
                • Cruises Added: {currentSession.results.cruisesAdded}
              </Text>
              {currentSession.results.errors.length > 0 && (
                <Text style={[styles.resultItem, { color: '#FF3B30' }]}>
                  • Errors: {currentSession.results.errors.length}
                </Text>
              )}
            </View>

            {currentSession.status === 'running' && (
              <TouchableOpacity 
                style={[styles.button, styles.cancelButton]} 
                onPress={handleCancelSession}
              >
                <Square size={20} color="#fff" />
                <Text style={styles.buttonText}>Cancel Session</Text>
              </TouchableOpacity>
            )}
          </View>
        )}

        {/* Action Buttons */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Actions</Text>
          
          <TouchableOpacity 
            style={[styles.button, styles.primaryButton]} 
            onPress={handleWebScraper}
            disabled={webScraperMutation.isPending}
          >
            <Play size={20} color="#fff" />
            <Text style={styles.buttonText}>
              {webScraperMutation.isPending ? '🔄 Scraping...' : '🚀 Launch Web Scraper (432 Cruises)'}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity 
            style={[styles.button, styles.secondaryButton]} 
            onPress={handleStartScraping}
            disabled={!!currentSession && currentSession.status === 'running'}
          >
            <Play size={20} color="#007AFF" />
            <Text style={[styles.buttonText, { color: '#007AFF' }]}>🐍 Launch Python Scraper (9 Offers)</Text>
          </TouchableOpacity>

          <TouchableOpacity 
            style={[styles.button, { backgroundColor: '#f0f0f0', borderWidth: 1, borderColor: '#ccc' }]} 
            onPress={handleProcessFiles}
          >
            <FileText size={20} color="#666" />
            <Text style={[styles.buttonText, { color: '#666' }]}>Process Downloaded Files</Text>
          </TouchableOpacity>
        </View>

        {/* Royal Caribbean Offers Summary */}
        {offersQuery.data && (
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <Text style={styles.cardTitle}>Royal Caribbean Offers</Text>
              <Ship size={20} color="#007AFF" />
            </View>
            
            <View style={styles.summaryGrid}>
              <View style={styles.summaryItem}>
                <Text style={styles.summaryNumber}>{offersQuery.data.summary.totalRcCruises}</Text>
                <Text style={styles.summaryLabel}>Total RC Cruises</Text>
              </View>
              <View style={styles.summaryItem}>
                <Text style={styles.summaryNumber}>{offersQuery.data.summary.upcomingCruises}</Text>
                <Text style={styles.summaryLabel}>Upcoming</Text>
              </View>
              <View style={styles.summaryItem}>
                <Text style={styles.summaryNumber}>{offersQuery.data.summary.activeOffers}</Text>
                <Text style={styles.summaryLabel}>Active Offers</Text>
              </View>
              <View style={styles.summaryItem}>
                <Text style={styles.summaryNumber}>{offersQuery.data.summary.ships}</Text>
                <Text style={styles.summaryLabel}>Ships</Text>
              </View>
            </View>

            {offersQuery.data.activeOffers.length > 0 && (
              <View style={styles.offersSection}>
                <Text style={styles.sectionTitle}>Active Offers</Text>
                {offersQuery.data.activeOffers.slice(0, 3).map((offer, index) => (
                  <View key={index} style={styles.offerItem}>
                    <Text style={styles.offerCode}>{offer.offerCode}</Text>
                    <Text style={styles.offerName}>{offer.offerName}</Text>
                    <Text style={styles.offerDetails}>
                      {offer.cabinType} • {offer.cruiseCount} cruises • Expires {new Date(offer.expiryDate).toLocaleDateString()}
                    </Text>
                  </View>
                ))}
              </View>
            )}
          </View>
        )}

        {/* Recent Sessions */}
        {sessionsQuery.data && sessionsQuery.data.sessions.length > 0 && (
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <Text style={styles.cardTitle}>Recent Sessions</Text>
              <RefreshCw size={20} color="#007AFF" />
            </View>
            
            {sessionsQuery.data.sessions.slice(0, 5).map((session) => (
              <View key={session.id} style={styles.sessionItem}>
                <View style={styles.sessionHeader}>
                  <Text style={styles.sessionTime}>
                    {new Date(session.startTime).toLocaleString()}
                  </Text>
                  {getStatusIcon(session.status)}
                </View>
                <Text style={[styles.sessionStatus, { color: getStatusColor(session.status) }]}>
                  {session.status.toUpperCase()}
                </Text>
                <Text style={styles.sessionResults}>
                  {session.results.cruisesAdded} cruises added • {formatDuration(session.duration)}
                </Text>
              </View>
            ))}
          </View>
        )}

        {/* Instructions */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>How to Use</Text>
          <Text style={styles.instructionText}>
            🚀 <Text style={{ fontWeight: '600' }}>Web Scraper (Recommended)</Text>: Extracts all 432 cruises from the scrollable widget directly
          </Text>
          <Text style={styles.instructionText}>
            • No login required - works with public cruise listings
          </Text>
          <Text style={styles.instructionText}>
            • Processes all available cruises in batches
          </Text>
          <Text style={styles.instructionText}>
            • Includes pricing, itineraries, and ship details
          </Text>
          <Text style={styles.instructionText}>
            • Completes in under 2 minutes
          </Text>
          <Text style={styles.instructionText}>
            
          </Text>
          <Text style={styles.instructionText}>
            🐍 <Text style={{ fontWeight: '600' }}>Python Scraper</Text>: Uses your existing scraper for Club Royale offers
          </Text>
          <Text style={styles.instructionText}>
            • Requires login to Royal Caribbean account
          </Text>
          <Text style={styles.instructionText}>
            • Processes up to 9 Club Royale offers
          </Text>
          <Text style={styles.instructionText}>
            • Takes 5-15 minutes depending on login time
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  scrollView: {
    flex: 1,
    padding: 16,
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1a1a1a',
  },
  sessionInfo: {
    marginBottom: 16,
  },
  sessionId: {
    fontSize: 12,
    color: '#8E8E93',
    marginBottom: 4,
  },
  status: {
    fontSize: 14,
    fontWeight: '500',
    marginBottom: 4,
  },
  duration: {
    fontSize: 14,
    color: '#666',
  },
  progressSection: {
    marginBottom: 16,
  },
  progressText: {
    fontSize: 14,
    color: '#666',
    marginBottom: 4,
  },
  currentOffer: {
    fontSize: 12,
    color: '#8E8E93',
    marginBottom: 8,
  },
  progressBar: {
    height: 4,
    backgroundColor: '#E5E5EA',
    borderRadius: 2,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#007AFF',
  },
  resultsSection: {
    marginBottom: 16,
  },
  resultsTitle: {
    fontSize: 14,
    fontWeight: '500',
    color: '#1a1a1a',
    marginBottom: 8,
  },
  resultItem: {
    fontSize: 14,
    color: '#666',
    marginBottom: 2,
  },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 12,
    borderRadius: 8,
    marginBottom: 8,
  },
  primaryButton: {
    backgroundColor: '#007AFF',
  },
  secondaryButton: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#007AFF',
  },
  cancelButton: {
    backgroundColor: '#FF3B30',
  },
  buttonText: {
    fontSize: 16,
    fontWeight: '500',
    color: '#fff',
    marginLeft: 8,
  },
  summaryGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  summaryItem: {
    alignItems: 'center',
    flex: 1,
  },
  summaryNumber: {
    fontSize: 24,
    fontWeight: '700',
    color: '#007AFF',
  },
  summaryLabel: {
    fontSize: 12,
    color: '#8E8E93',
    textAlign: 'center',
    marginTop: 4,
  },
  offersSection: {
    borderTopWidth: 1,
    borderTopColor: '#E5E5EA',
    paddingTop: 16,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1a1a1a',
    marginBottom: 12,
  },
  offerItem: {
    marginBottom: 12,
  },
  offerCode: {
    fontSize: 14,
    fontWeight: '600',
    color: '#007AFF',
  },
  offerName: {
    fontSize: 14,
    color: '#1a1a1a',
    marginTop: 2,
  },
  offerDetails: {
    fontSize: 12,
    color: '#8E8E93',
    marginTop: 2,
  },
  sessionItem: {
    borderBottomWidth: 1,
    borderBottomColor: '#E5E5EA',
    paddingBottom: 12,
    marginBottom: 12,
  },
  sessionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  sessionTime: {
    fontSize: 12,
    color: '#8E8E93',
  },
  sessionStatus: {
    fontSize: 14,
    fontWeight: '500',
    marginBottom: 2,
  },
  sessionResults: {
    fontSize: 12,
    color: '#666',
  },
  instructionText: {
    fontSize: 14,
    color: '#666',
    marginBottom: 8,
    lineHeight: 20,
  },
});