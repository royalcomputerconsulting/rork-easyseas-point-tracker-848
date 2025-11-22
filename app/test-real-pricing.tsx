import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator } from 'react-native';
import { router } from 'expo-router';
import { ArrowLeft } from 'lucide-react-native';
import { trpc } from '@/lib/trpc';
import { STATIC_BOOKED_CRUISES } from '@/state/staticBooked';

interface MinimalCruiseCard {
  id?: string;
  ship?: string;
  startDate?: string;
  departureDate?: string;
  itineraryName?: string;
}

export default function TestRealPricingScreen() {
  const [selectedCruiseId, setSelectedCruiseId] = React.useState<string | null>(null);
  const [fetchResult, setFetchResult] = React.useState<any>(null);

  const fetchPricingMutation = trpc.cruises.fetchWebPricing.useMutation();
  const batchFetchMutation = trpc.cruises.batchFetchWebPricing.useMutation();

  const rawBooked: MinimalCruiseCard[] = Array.isArray(STATIC_BOOKED_CRUISES)
    ? (STATIC_BOOKED_CRUISES as unknown as MinimalCruiseCard[])
    : [];

  const bookedCruises: MinimalCruiseCard[] = rawBooked
    .filter((c: MinimalCruiseCard) => {
      const dateStr = c.startDate ?? c.departureDate;
      if (!dateStr) return false;
      try {
        const depDate = new Date(dateStr);
        if (Number.isNaN(depDate.getTime())) return false;
        return depDate.getTime() > Date.now();
      } catch {
        return false;
      }
    })
    .slice(0, 5);

  const handleFetchSingle = async (cruiseId: string) => {
    setSelectedCruiseId(cruiseId);
    setFetchResult(null);
    
    try {
      const result = await fetchPricingMutation.mutateAsync({
        cruiseId,
        fetchItinerary: true
      });
      setFetchResult(result);
    } catch (error) {
      console.error('[TestRealPricing] Error:', error);
      setFetchResult({ error: error instanceof Error ? error.message : 'Unknown error' });
    }
  };

  const handleBatchFetch = async () => {
    setSelectedCruiseId('batch');
    setFetchResult(null);
    
    try {
      const cruiseIds = bookedCruises
        .map(c => c.id)
        .filter((id): id is string => typeof id === 'string' && id.length > 0);
      const result = await batchFetchMutation.mutateAsync({
        cruiseIds,
        fetchItinerary: true,
        limit: 3
      });
      setFetchResult(result);
    } catch (error) {
      console.error('[TestRealPricing] Batch error:', error);
      setFetchResult({ error: error instanceof Error ? error.message : 'Unknown error' });
    }
  };

  const insets = require('react-native-safe-area-context').useSafeAreaInsets();

  return (
    <View style={[styles.container, { paddingBottom: insets.bottom }]}> 
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <ArrowLeft size={24} color="#111827" />
        </TouchableOpacity>
        <Text style={styles.title}>Test Real Web Pricing</Text>
      </View>

      <ScrollView style={styles.content}>
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Test Individual Cruise Fetch</Text>
          <Text style={styles.sectionDescription}>
            Click on a cruise to fetch real pricing and itinerary data from the web
          </Text>

          {bookedCruises.map((cruise, idx) => (
            <TouchableOpacity
              key={cruise.id ?? `bk-${idx}`}
              testID={`real-pricing-cruise-${cruise.id ?? idx}`}
              style={[
                styles.cruiseCard,
                selectedCruiseId === cruise.id && styles.cruiseCardSelected
              ]}
              onPress={() => cruise.id ? handleFetchSingle(cruise.id) : undefined}
              disabled={fetchPricingMutation.isPending || !cruise.id}
            >
              <Text style={styles.cruiseShip}>{cruise.ship ?? 'Unknown Ship'}</Text>
              <Text style={styles.cruiseDate}>
                {(() => {
                  const dateStr = cruise.startDate ?? cruise.departureDate;
                  if (!dateStr) return 'Date TBD';
                  try {
                    const date = new Date(dateStr);
                    if (isNaN(date.getTime())) return 'Invalid Date';
                    return date.toLocaleDateString();
                  } catch {
                    return 'Invalid Date';
                  }
                })()}
              </Text>
              <Text style={styles.cruiseItinerary}>{cruise.itineraryName ?? 'Itinerary TBD'}</Text>
              {selectedCruiseId === cruise.id && fetchPricingMutation.isPending && (
                <ActivityIndicator size="small" color="#3B82F6" style={styles.loader} />
              )}
            </TouchableOpacity>
          ))}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Test Batch Fetch</Text>
          <Text style={styles.sectionDescription}>
            Fetch pricing for multiple cruises at once (limited to 3 for testing)
          </Text>

          <TouchableOpacity
            style={[styles.batchButton, batchFetchMutation.isPending && styles.batchButtonDisabled]}
            onPress={handleBatchFetch}
            disabled={batchFetchMutation.isPending}
          >
            {batchFetchMutation.isPending ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <Text style={styles.batchButtonText}>Fetch First 3 Cruises</Text>
            )}
          </TouchableOpacity>
        </View>

        {fetchResult && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Fetch Result</Text>
            
            {fetchResult.error ? (
              <View style={styles.errorBox}>
                <Text style={styles.errorText}>{fetchResult.error}</Text>
              </View>
            ) : fetchResult.results ? (
              <View style={styles.resultBox}>
                <Text style={styles.resultLabel}>Batch Results:</Text>
                <Text style={styles.resultText}>Total Processed: {fetchResult.totalProcessed}</Text>
                <Text style={styles.resultText}>Success: {fetchResult.successCount}</Text>
                <Text style={styles.resultText}>Errors: {fetchResult.errorCount}</Text>
                
                {fetchResult.results.map((result: any, index: number) => (
                  <View key={index} style={styles.resultItem}>
                    <Text style={styles.resultItemTitle}>Cruise {index + 1}</Text>
                    {result.success ? (
                      <>
                        {result.pricing && (
                          <View style={styles.pricingBox}>
                            <Text style={styles.pricingLabel}>Pricing:</Text>
                            {result.pricing.interior && (
                              <Text style={styles.pricingText}>Interior: ${result.pricing.interior}</Text>
                            )}
                            {result.pricing.oceanview && (
                              <Text style={styles.pricingText}>Oceanview: ${result.pricing.oceanview}</Text>
                            )}
                            {result.pricing.balcony && (
                              <Text style={styles.pricingText}>Balcony: ${result.pricing.balcony}</Text>
                            )}
                            {result.pricing.suite && (
                              <Text style={styles.pricingText}>Suite: ${result.pricing.suite}</Text>
                            )}
                          </View>
                        )}
                        {result.itinerary && (
                          <View style={styles.itineraryBox}>
                            <Text style={styles.itineraryLabel}>Ports:</Text>
                            <Text style={styles.itineraryText}>{result.itinerary.portsRoute}</Text>
                          </View>
                        )}
                      </>
                    ) : (
                      <Text style={styles.errorText}>{result.error}</Text>
                    )}
                  </View>
                ))}
              </View>
            ) : (
              <View style={styles.resultBox}>
                <Text style={styles.resultLabel}>Single Cruise Result:</Text>
                
                {fetchResult.pricing && (
                  <View style={styles.pricingBox}>
                    <Text style={styles.pricingLabel}>Pricing:</Text>
                    {fetchResult.pricing.interior && (
                      <Text style={styles.pricingText}>Interior: ${fetchResult.pricing.interior}</Text>
                    )}
                    {fetchResult.pricing.oceanview && (
                      <Text style={styles.pricingText}>Oceanview: ${fetchResult.pricing.oceanview}</Text>
                    )}
                    {fetchResult.pricing.balcony && (
                      <Text style={styles.pricingText}>Balcony: ${fetchResult.pricing.balcony}</Text>
                    )}
                    {fetchResult.pricing.suite && (
                      <Text style={styles.pricingText}>Suite: ${fetchResult.pricing.suite}</Text>
                    )}
                    <Text style={styles.pricingSource}>Source: {fetchResult.pricing.source}</Text>
                  </View>
                )}
                
                {fetchResult.itinerary && (
                  <View style={styles.itineraryBox}>
                    <Text style={styles.itineraryLabel}>Itinerary:</Text>
                    <Text style={styles.itineraryText}>{fetchResult.itinerary.portsRoute}</Text>
                    <Text style={styles.itinerarySource}>Source: {fetchResult.itinerary.source}</Text>
                    
                    {fetchResult.itinerary.ports && fetchResult.itinerary.ports.length > 0 && (
                      <View style={styles.portsBox}>
                        <Text style={styles.portsLabel}>Port Details:</Text>
                        {fetchResult.itinerary.ports.map((port: any, index: number) => (
                          <View key={index} style={styles.portItem}>
                            <Text style={styles.portName}>{port.name}</Text>
                            {port.arrivalTime && (
                              <Text style={styles.portTime}>Arrival: {port.arrivalTime}</Text>
                            )}
                            {port.departureTime && (
                              <Text style={styles.portTime}>Departure: {port.departureTime}</Text>
                            )}
                          </View>
                        ))}
                      </View>
                    )}
                  </View>
                )}
                
                {typeof fetchResult.verified === 'boolean' && (
                  <Text style={styles.verifiedText}>
                    Verified: {fetchResult.verified ? 'Yes' : 'No'}
                  </Text>
                )}
                {fetchResult.verifiedAt && (
                  <Text style={styles.verifiedText}>
                    Verified At: {new Date(fetchResult.verifiedAt).toLocaleString()}
                  </Text>
                )}
              </View>
            )}
          </View>
        )}
      </ScrollView>
    </View>
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
    paddingHorizontal: 16,
    paddingVertical: 16,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  backButton: {
    marginRight: 12,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: '#111827',
  },
  content: {
    flex: 1,
  },
  section: {
    padding: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 8,
  },
  sectionDescription: {
    fontSize: 14,
    color: '#6B7280',
    marginBottom: 16,
  },
  cruiseCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  cruiseCardSelected: {
    borderColor: '#3B82F6',
    borderWidth: 2,
  },
  cruiseShip: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 4,
  },
  cruiseDate: {
    fontSize: 14,
    color: '#6B7280',
    marginBottom: 4,
  },
  cruiseItinerary: {
    fontSize: 14,
    color: '#374151',
  },
  loader: {
    marginTop: 8,
  },
  batchButton: {
    backgroundColor: '#3B82F6',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
  },
  batchButtonDisabled: {
    opacity: 0.6,
  },
  batchButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  resultBox: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  errorBox: {
    backgroundColor: '#FEE2E2',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#FCA5A5',
  },
  errorText: {
    fontSize: 14,
    color: '#DC2626',
  },
  resultLabel: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 12,
  },
  resultText: {
    fontSize: 14,
    color: '#374151',
    marginBottom: 4,
  },
  resultItem: {
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
  },
  resultItemTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 8,
  },
  pricingBox: {
    marginTop: 8,
    padding: 12,
    backgroundColor: '#F9FAFB',
    borderRadius: 8,
  },
  pricingLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 8,
  },
  pricingText: {
    fontSize: 14,
    color: '#374151',
    marginBottom: 4,
  },
  pricingSource: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 8,
    fontStyle: 'italic',
  },
  itineraryBox: {
    marginTop: 8,
    padding: 12,
    backgroundColor: '#F0F9FF',
    borderRadius: 8,
  },
  itineraryLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 8,
  },
  itineraryText: {
    fontSize: 14,
    color: '#374151',
    marginBottom: 4,
  },
  itinerarySource: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 8,
    fontStyle: 'italic',
  },
  portsBox: {
    marginTop: 12,
  },
  portsLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 8,
  },
  portItem: {
    marginBottom: 8,
    paddingLeft: 8,
  },
  portName: {
    fontSize: 13,
    fontWeight: '500',
    color: '#374151',
  },
  portTime: {
    fontSize: 12,
    color: '#6B7280',
  },
  verifiedText: {
    fontSize: 12,
    color: '#10B981',
    marginTop: 8,
  },
});
