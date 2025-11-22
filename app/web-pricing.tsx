import React, { useState } from 'react';
import { ScrollView, StyleSheet, Text, View, TouchableOpacity, ActivityIndicator, RefreshControl } from 'react-native';
import { useRouter } from 'expo-router';
import { Stack } from 'expo-router';
import { ArrowLeft, Globe, TrendingDown, AlertCircle, DollarSign, Ship, Calendar, RefreshCw } from 'lucide-react-native';
import { trpc } from '@/lib/trpc';
import { COLORS } from '@/constants/theme';
import LoadingState from '@/components/LoadingState';
import ErrorState from '@/components/ErrorState';

export default function WebPricingPage() {
  const router = useRouter();
  const [refreshing, setRefreshing] = useState(false);
  
  // Query for web pricing data
  const pricingQuery = trpc.cruises.webPricing.useQuery({
    forceRefresh: false,
    sources: ['iCruise', 'RoyalPriceTracker', 'CruiseMapper'],
    useRealData: true
  });
  
  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await pricingQuery.refetch();
    } catch (error) {
      console.error('Failed to refresh pricing:', error);
    } finally {
      setRefreshing(false);
    }
  };
  
  if (pricingQuery.isLoading && !pricingQuery.data) {
    return <LoadingState message="Loading web pricing data..." />;
  }
  
  if (pricingQuery.error) {
    return <ErrorState 
      title="Failed to load pricing" 
      message={pricingQuery.error.message} 
      onRetry={() => pricingQuery.refetch()} 
    />;
  }
  
  const data = pricingQuery.data;
  const hasAlerts = (data?.summary?.totalAlerts ?? 0) > 0;
  
  return (
    <>
      <Stack.Screen
        options={{
          title: 'Web Pricing',
          headerLeft: () => (
            <TouchableOpacity onPress={() => router.back()} style={{ marginLeft: 10 }}>
              <ArrowLeft size={24} color={COLORS.text} />
            </TouchableOpacity>
          ),
          headerRight: () => (
            <TouchableOpacity onPress={handleRefresh} style={{ marginRight: 10 }}>
              <RefreshCw size={20} color={COLORS.primary} />
            </TouchableOpacity>
          ),
        }}
      />
      
      <ScrollView 
        style={styles.container}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
        }
      >
        {/* Summary Card */}
        <View style={styles.summaryCard}>
          <View style={styles.summaryHeader}>
            <Globe size={24} color={COLORS.primary} />
            <Text style={styles.summaryTitle}>Pricing Summary</Text>
          </View>
          
          <View style={styles.summaryStats}>
            <View style={styles.statItem}>
              <Text style={styles.statValue}>{data?.summary?.totalCruisesChecked || 0}</Text>
              <Text style={styles.statLabel}>Cruises Checked</Text>
            </View>
            <View style={styles.statItem}>
              <Text style={[styles.statValue, hasAlerts && styles.alertText]}>
                {data?.summary?.totalAlerts || 0}
              </Text>
              <Text style={styles.statLabel}>Price Alerts</Text>
            </View>
            <View style={styles.statItem}>
              <Text style={[styles.statValue, styles.successText]}>
                {data?.summary?.priceDropAlerts || 0}
              </Text>
              <Text style={styles.statLabel}>Price Drops</Text>
            </View>
          </View>
          
          {data?.summary?.lastUpdated && (
            <Text style={styles.lastUpdated}>
              Last updated: {new Date(data.summary.lastUpdated).toLocaleString()}
            </Text>
          )}
        </View>
        
        {/* Price Alerts */}
        {hasAlerts && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <AlertCircle size={20} color="#DC2626" />
              <Text style={styles.sectionTitle}>Price Alerts</Text>
            </View>
            
            {data?.results?.map((cruise: any) => 
              cruise.alerts?.map((alert: any, idx: number) => (
                <View key={`${cruise.cruiseId}-alert-${idx}`} style={styles.alertCard}>
                  <View style={styles.alertHeader}>
                    <View style={[styles.alertBadge, 
                      alert.severity === 'high' ? styles.highSeverity : styles.mediumSeverity
                    ]}>
                      <Text style={styles.alertBadgeText}>
                        {alert.severity === 'high' ? 'HIGH' : 'MEDIUM'}
                      </Text>
                    </View>
                    <Text style={styles.alertSource}>{alert.source}</Text>
                  </View>
                  
                  <Text style={styles.alertMessage}>{alert.message}</Text>
                  
                  <View style={styles.alertDetails}>
                    <Ship size={14} color={COLORS.textSecondary} />
                    <Text style={styles.alertShip}>{cruise.ship}</Text>
                    <Calendar size={14} color={COLORS.textSecondary} />
                    <Text style={styles.alertDate}>{cruise.departureDate}</Text>
                  </View>
                </View>
              ))
            )}
          </View>
        )}
        
        {/* Cruise Pricing Details */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Cruise Pricing Details</Text>
          
          {data?.results?.map((cruise: any) => (
            <TouchableOpacity 
              key={cruise.cruiseId}
              style={styles.cruiseCard}
              onPress={() => router.push(`/cruise/${cruise.cruiseId}`)}
            >
              <View style={styles.cruiseHeader}>
                <View>
                  <Text style={styles.cruiseShip}>{cruise.ship}</Text>
                  <Text style={styles.cruiseItinerary}>{cruise.itineraryName}</Text>
                  <Text style={styles.cruiseDate}>{cruise.departureDate}</Text>
                </View>
                {cruise.isHistorical && (
                  <View style={styles.historicalBadge}>
                    <Text style={styles.historicalText}>Historical</Text>
                  </View>
                )}
              </View>
              
              {/* Pricing Sources */}
              <View style={styles.pricingSources}>
                {Object.entries(cruise.webPricing || {}).map(([source, prices]: [string, any]) => (
                  <View key={source} style={styles.sourceRow}>
                    <Text style={styles.sourceName}>{source}</Text>
                    
                    {prices.error ? (
                      <Text style={styles.errorText}>Error loading prices</Text>
                    ) : (
                      <View style={styles.priceGrid}>
                        <View style={styles.priceItem}>
                          <Text style={styles.priceLabel}>Interior</Text>
                          <Text style={styles.priceValue}>${prices.interior || '—'}</Text>
                        </View>
                        <View style={styles.priceItem}>
                          <Text style={styles.priceLabel}>Oceanview</Text>
                          <Text style={styles.priceValue}>${prices.oceanview || '—'}</Text>
                        </View>
                        <View style={styles.priceItem}>
                          <Text style={styles.priceLabel}>Balcony</Text>
                          <Text style={styles.priceValue}>${prices.balcony || '—'}</Text>
                        </View>
                        <View style={styles.priceItem}>
                          <Text style={styles.priceLabel}>Suite</Text>
                          <Text style={styles.priceValue}>${prices.suite || '—'}</Text>
                        </View>
                      </View>
                    )}
                    
                    {prices.estimated && (
                      <Text style={styles.estimatedText}>* Estimated pricing</Text>
                    )}
                    {prices.realData && (
                      <Text style={styles.realDataText}>✓ Live data</Text>
                    )}
                  </View>
                ))}
              </View>
              
              {/* Price Changes */}
              {cruise.priceChanges && Object.keys(cruise.priceChanges).length > 0 && (
                <View style={styles.priceChanges}>
                  <Text style={styles.priceChangesTitle}>Price Changes</Text>
                  {Object.entries(cruise.priceChanges).map(([source, changes]: [string, any]) => (
                    <View key={source} style={styles.changeRow}>
                      <Text style={styles.changeSource}>{source}:</Text>
                      {Object.entries(changes).map(([cabin, change]) => {
                        const changeValue = typeof change === 'number' ? change : 0;
                        return changeValue !== 0 && (
                          <View key={cabin} style={styles.changeItem}>
                            <Text style={styles.changeCabin}>{cabin}:</Text>
                            <Text style={[
                              styles.changeValue,
                              changeValue < 0 ? styles.priceDropText : styles.priceIncreaseText
                            ]}>
                              {changeValue < 0 ? '↓' : '↑'} ${Math.abs(changeValue)}
                            </Text>
                          </View>
                        );
                      })}
                    </View>
                  ))}
                </View>
              )}
            </TouchableOpacity>
          ))}
        </View>
        
        {/* Sources Used */}
        <View style={styles.sourcesCard}>
          <Text style={styles.sourcesTitle}>Data Sources</Text>
          <View style={styles.sourcesList}>
            {data?.summary?.sourcesUsed?.map((source: string) => (
              <View key={source} style={styles.sourceChip}>
                <Globe size={12} color={COLORS.primary} />
                <Text style={styles.sourceChipText}>{source}</Text>
              </View>
            ))}
          </View>
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
  summaryCard: {
    backgroundColor: COLORS.white,
    margin: 16,
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.divider,
  },
  summaryHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  summaryTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: COLORS.text,
    marginLeft: 8,
  },
  summaryStats: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 12,
  },
  statItem: {
    alignItems: 'center',
  },
  statValue: {
    fontSize: 24,
    fontWeight: '700',
    color: COLORS.text,
  },
  statLabel: {
    fontSize: 12,
    color: COLORS.textSecondary,
    marginTop: 4,
  },
  alertText: {
    color: '#DC2626',
  },
  successText: {
    color: '#10B981',
  },
  lastUpdated: {
    fontSize: 11,
    color: COLORS.textSecondary,
    textAlign: 'center',
    marginTop: 8,
  },
  section: {
    marginHorizontal: 16,
    marginBottom: 16,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.text,
    marginLeft: 8,
  },
  alertCard: {
    backgroundColor: '#FEF2F2',
    padding: 12,
    borderRadius: 8,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#FCA5A5',
  },
  alertHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  alertBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
  },
  highSeverity: {
    backgroundColor: COLORS.error,
  },
  mediumSeverity: {
    backgroundColor: COLORS.warning,
  },
  alertBadgeText: {
    color: COLORS.white,
    fontSize: 10,
    fontWeight: '700',
  },
  alertSource: {
    fontSize: 12,
    color: COLORS.textSecondary,
  },
  alertMessage: {
    fontSize: 14,
    color: COLORS.text,
    marginBottom: 8,
  },
  alertDetails: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  alertShip: {
    fontSize: 12,
    color: COLORS.textSecondary,
    marginRight: 8,
  },
  alertDate: {
    fontSize: 12,
    color: COLORS.textSecondary,
  },
  cruiseCard: {
    backgroundColor: COLORS.white,
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: COLORS.divider,
  },
  cruiseHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  cruiseShip: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.text,
  },
  cruiseItinerary: {
    fontSize: 13,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  cruiseDate: {
    fontSize: 12,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  historicalBadge: {
    backgroundColor: '#E5E7EB',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  historicalText: {
    fontSize: 11,
    color: '#6B7280',
  },
  pricingSources: {
    marginTop: 8,
  },
  sourceRow: {
    marginBottom: 12,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.divider,
  },
  sourceName: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.primary,
    marginBottom: 8,
  },
  priceGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
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
  errorText: {
    fontSize: 12,
    color: '#DC2626',
    fontStyle: 'italic',
  },
  estimatedText: {
    fontSize: 10,
    color: COLORS.textSecondary,
    fontStyle: 'italic',
    marginTop: 4,
  },
  realDataText: {
    fontSize: 10,
    color: '#10B981',
    marginTop: 4,
  },
  priceChanges: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: COLORS.divider,
  },
  priceChangesTitle: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.text,
    marginBottom: 8,
  },
  changeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    marginBottom: 4,
  },
  changeSource: {
    fontSize: 11,
    color: COLORS.textSecondary,
    marginRight: 8,
  },
  changeItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 12,
  },
  changeCabin: {
    fontSize: 11,
    color: COLORS.textSecondary,
    marginRight: 4,
  },
  changeValue: {
    fontSize: 11,
    fontWeight: '600',
  },
  priceDropText: {
    color: '#10B981',
  },
  priceIncreaseText: {
    color: '#DC2626',
  },
  sourcesCard: {
    backgroundColor: COLORS.white,
    margin: 16,
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.divider,
  },
  sourcesTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.text,
    marginBottom: 12,
  },
  sourcesList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  sourceChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#EFF6FF',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#DBEAFE',
  },
  sourceChipText: {
    fontSize: 12,
    color: COLORS.primary,
    marginLeft: 4,
  },
});