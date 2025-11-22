import React, { useState } from 'react';
import { ScrollView, StyleSheet, Text, View, TouchableOpacity, TextInput, ActivityIndicator } from 'react-native';
import { useRouter, Stack } from 'expo-router';
import { ArrowLeft, Search, CheckCircle, XCircle, AlertCircle } from 'lucide-react-native';
import { trpc } from '@/lib/trpc';
import { COLORS } from '@/constants/theme';

export default function TestMultiSourceScraperPage() {
  const router = useRouter();
  const [ship, setShip] = useState('Harmony of the Seas');
  const [departureDate, setDepartureDate] = useState('2025-03-15');
  const [nights, setNights] = useState('7');
  const [testResults, setTestResults] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(false);

  const webPricingMutation = trpc.cruises.webPricing.useQuery(
    {
      forceRefresh: true,
      useRealData: true,
    },
    {
      enabled: false,
    }
  );

  const handleTest = async () => {
    setIsLoading(true);
    setTestResults(null);

    try {
      console.log('[Test] Starting multi-source scraper test...');
      console.log('[Test] Ship:', ship);
      console.log('[Test] Departure:', departureDate);
      console.log('[Test] Nights:', nights);

      const result = await webPricingMutation.refetch();

      console.log('[Test] Result:', result.data);
      setTestResults(result.data);
    } catch (error) {
      console.error('[Test] Error:', error);
      setTestResults({
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      <Stack.Screen
        options={{
          title: 'Test Multi-Source Scraper',
          headerLeft: () => (
            <TouchableOpacity onPress={() => router.back()} style={{ marginLeft: 10 }}>
              <ArrowLeft size={24} color={COLORS.text} />
            </TouchableOpacity>
          ),
        }}
      />

      <ScrollView style={styles.container}>
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Test Configuration</Text>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Ship Name</Text>
            <TextInput
              style={styles.input}
              value={ship}
              onChangeText={setShip}
              placeholder="e.g., Harmony of the Seas"
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Departure Date</Text>
            <TextInput
              style={styles.input}
              value={departureDate}
              onChangeText={setDepartureDate}
              placeholder="YYYY-MM-DD"
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Nights</Text>
            <TextInput
              style={styles.input}
              value={nights}
              onChangeText={setNights}
              placeholder="7"
              keyboardType="numeric"
            />
          </View>

          <TouchableOpacity
            style={[styles.testButton, isLoading && styles.testButtonDisabled]}
            onPress={handleTest}
            disabled={isLoading}
          >
            {isLoading ? (
              <ActivityIndicator color={COLORS.white} />
            ) : (
              <>
                <Search size={20} color={COLORS.white} />
                <Text style={styles.testButtonText}>Run Test</Text>
              </>
            )}
          </TouchableOpacity>
        </View>

        {testResults && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Test Results</Text>

            {testResults.error ? (
              <View style={styles.errorCard}>
                <XCircle size={24} color="#DC2626" />
                <Text style={styles.errorText}>{testResults.error}</Text>
              </View>
            ) : (
              <>
                <View style={styles.summaryCard}>
                  <Text style={styles.summaryTitle}>Summary</Text>
                  <View style={styles.summaryRow}>
                    <Text style={styles.summaryLabel}>Total Checked:</Text>
                    <Text style={styles.summaryValue}>
                      {testResults.summary?.totalCruisesChecked || 0}
                    </Text>
                  </View>
                  <View style={styles.summaryRow}>
                    <Text style={styles.summaryLabel}>Verified:</Text>
                    <Text style={[styles.summaryValue, styles.successText]}>
                      {testResults.summary?.totalVerified || 0}
                    </Text>
                  </View>
                  <View style={styles.summaryRow}>
                    <Text style={styles.summaryLabel}>Alerts:</Text>
                    <Text style={[styles.summaryValue, styles.warningText]}>
                      {testResults.summary?.totalAlerts || 0}
                    </Text>
                  </View>
                  <View style={styles.summaryRow}>
                    <Text style={styles.summaryLabel}>Sources Used:</Text>
                    <Text style={styles.summaryValue}>
                      {testResults.summary?.sourcesUsed?.join(', ') || 'None'}
                    </Text>
                  </View>
                </View>

                {testResults.results?.map((result: any, index: number) => (
                  <View key={index} style={styles.resultCard}>
                    <View style={styles.resultHeader}>
                      <View>
                        <Text style={styles.resultShip}>{result.ship}</Text>
                        <Text style={styles.resultItinerary}>{result.itineraryName}</Text>
                        <Text style={styles.resultDate}>
                          {result.departureDate} • {result.nights}N
                        </Text>
                      </View>
                      {result.verified ? (
                        <View style={styles.verifiedBadge}>
                          <CheckCircle size={16} color="#10B981" />
                          <Text style={styles.verifiedText}>VERIFIED</Text>
                        </View>
                      ) : (
                        <View style={styles.unverifiedBadge}>
                          <AlertCircle size={16} color="#F59E0B" />
                          <Text style={styles.unverifiedText}>ESTIMATED</Text>
                        </View>
                      )}
                    </View>

                    {result.verified && (
                      <View style={styles.sourceInfo}>
                        <Text style={styles.sourceLabel}>Source:</Text>
                        <Text style={styles.sourceValue}>{result.verifiedSource}</Text>
                      </View>
                    )}

                    <View style={styles.pricingGrid}>
                      <View style={styles.priceItem}>
                        <Text style={styles.priceLabel}>Interior</Text>
                        <Text style={styles.priceValue}>
                          ${result.currentPricing?.interior || '—'}
                        </Text>
                      </View>
                      <View style={styles.priceItem}>
                        <Text style={styles.priceLabel}>Oceanview</Text>
                        <Text style={styles.priceValue}>
                          ${result.currentPricing?.oceanview || '—'}
                        </Text>
                      </View>
                      <View style={styles.priceItem}>
                        <Text style={styles.priceLabel}>Balcony</Text>
                        <Text style={styles.priceValue}>
                          ${result.currentPricing?.balcony || '—'}
                        </Text>
                      </View>
                      <View style={styles.priceItem}>
                        <Text style={styles.priceLabel}>Suite</Text>
                        <Text style={styles.priceValue}>
                          ${result.currentPricing?.suite || '—'}
                        </Text>
                      </View>
                    </View>

                    {result.itinerary && (
                      <View style={styles.itineraryInfo}>
                        <Text style={styles.itineraryTitle}>Itinerary</Text>
                        <Text style={styles.itineraryDescription}>
                          {result.itinerary.description}
                        </Text>
                        {result.itinerary.ports && result.itinerary.ports.length > 0 && (
                          <View style={styles.portsContainer}>
                            <Text style={styles.portsLabel}>Ports:</Text>
                            <Text style={styles.portsValue}>
                              {result.itinerary.ports.join(' • ')}
                            </Text>
                          </View>
                        )}
                      </View>
                    )}

                    {result.error && (
                      <View style={styles.errorInfo}>
                        <XCircle size={16} color="#DC2626" />
                        <Text style={styles.errorInfoText}>{result.error}</Text>
                      </View>
                    )}
                  </View>
                ))}
              </>
            )}
          </View>
        )}

        <View style={styles.infoSection}>
          <Text style={styles.infoTitle}>How It Works</Text>
          <Text style={styles.infoText}>
            This test page demonstrates the multi-source web scraping system with fallback logic:
          </Text>
          <Text style={styles.infoStep}>1. Tries CruiseCritic.com first</Text>
          <Text style={styles.infoStep}>2. If fails, tries Cruises.com</Text>
          <Text style={styles.infoStep}>3. If fails, tries Cruiseaway.com</Text>
          <Text style={styles.infoStep}>4. If fails, tries Expedia.com</Text>
          <Text style={styles.infoStep}>
            5. If all fail, returns &quot;Cannot find cruise data&quot;
          </Text>
          <Text style={[styles.infoText, { marginTop: 12 }]}>
            When data is successfully scraped, the cruise itinerary is marked as VERIFIED with the
            source and timestamp.
          </Text>
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
  section: {
    margin: 16,
    backgroundColor: COLORS.white,
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: COLORS.divider,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: COLORS.text,
    marginBottom: 16,
  },
  inputGroup: {
    marginBottom: 16,
  },
  label: {
    fontSize: 14,
    fontWeight: '500',
    color: COLORS.text,
    marginBottom: 8,
  },
  input: {
    borderWidth: 1,
    borderColor: COLORS.divider,
    borderRadius: 8,
    padding: 12,
    fontSize: 14,
    color: COLORS.text,
  },
  testButton: {
    backgroundColor: COLORS.primary,
    borderRadius: 8,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  testButtonDisabled: {
    opacity: 0.6,
  },
  testButtonText: {
    color: COLORS.white,
    fontSize: 16,
    fontWeight: '600',
  },
  errorCard: {
    backgroundColor: '#FEF2F2',
    padding: 16,
    borderRadius: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderWidth: 1,
    borderColor: '#FCA5A5',
  },
  errorText: {
    flex: 1,
    fontSize: 14,
    color: '#DC2626',
  },
  summaryCard: {
    backgroundColor: '#F9FAFB',
    padding: 16,
    borderRadius: 8,
    marginBottom: 16,
  },
  summaryTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.text,
    marginBottom: 12,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  summaryLabel: {
    fontSize: 14,
    color: COLORS.textSecondary,
  },
  summaryValue: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.text,
  },
  successText: {
    color: '#10B981',
  },
  warningText: {
    color: '#F59E0B',
  },
  resultCard: {
    backgroundColor: COLORS.white,
    borderWidth: 1,
    borderColor: COLORS.divider,
    borderRadius: 8,
    padding: 16,
    marginBottom: 12,
  },
  resultHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  resultShip: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.text,
  },
  resultItinerary: {
    fontSize: 13,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  resultDate: {
    fontSize: 12,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  verifiedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#D1FAE5',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  verifiedText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#10B981',
  },
  unverifiedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  unverifiedText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#F59E0B',
  },
  sourceInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  sourceLabel: {
    fontSize: 12,
    color: COLORS.textSecondary,
  },
  sourceValue: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.primary,
  },
  pricingGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 12,
  },
  priceItem: {
    flex: 1,
    minWidth: 80,
  },
  priceLabel: {
    fontSize: 11,
    color: COLORS.textSecondary,
  },
  priceValue: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.text,
    marginTop: 2,
  },
  itineraryInfo: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: COLORS.divider,
  },
  itineraryTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.text,
    marginBottom: 6,
  },
  itineraryDescription: {
    fontSize: 12,
    color: COLORS.textSecondary,
    marginBottom: 8,
  },
  portsContainer: {
    flexDirection: 'row',
    gap: 6,
  },
  portsLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: COLORS.textSecondary,
  },
  portsValue: {
    flex: 1,
    fontSize: 11,
    color: COLORS.textSecondary,
  },
  errorInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 12,
    padding: 12,
    backgroundColor: '#FEF2F2',
    borderRadius: 6,
  },
  errorInfoText: {
    flex: 1,
    fontSize: 12,
    color: '#DC2626',
  },
  infoSection: {
    margin: 16,
    backgroundColor: '#EFF6FF',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#DBEAFE',
  },
  infoTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.primary,
    marginBottom: 12,
  },
  infoText: {
    fontSize: 13,
    color: COLORS.textSecondary,
    lineHeight: 20,
    marginBottom: 8,
  },
  infoStep: {
    fontSize: 12,
    color: COLORS.textSecondary,
    marginLeft: 8,
    marginBottom: 4,
  },
});
