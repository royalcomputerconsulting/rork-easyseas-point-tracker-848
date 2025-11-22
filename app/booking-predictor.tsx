import React, { useState } from 'react';
import { View, Text, ScrollView, StyleSheet, TouchableOpacity, ActivityIndicator, RefreshControl } from 'react-native';
import { Stack, router } from 'expo-router';
import { trpc } from '@/lib/trpc';
import { TrendingUp, TrendingDown, Clock, AlertCircle, CheckCircle, Eye, DollarSign, Calendar } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const COLORS = {
  background: '#0A0E27',
  card: '#151B3D',
  cardHover: '#1C2349',
  primary: '#3B82F6',
  success: '#10B981',
  warning: '#F59E0B',
  error: '#EF4444',
  textPrimary: '#F9FAFB',
  textSecondary: '#9CA3AF',
  border: '#1F2937',
  accent: '#8B5CF6'
} as const;

type BookingTimingType = 'book-now' | 'wait' | 'monitor' | 'peak-passed';
type ConfidenceType = 'high' | 'medium' | 'low';

export default function BookingPredictorScreen() {
  const insets = useSafeAreaInsets();
  const [selectedFilter, setSelectedFilter] = useState<'all' | 'book-now'>('all');
  const [refreshing, setRefreshing] = useState(false);

  const { data, isLoading, refetch } = trpc.intelligence.bookingPredictor.getAll.useQuery({
    minDaysOut: 0,
    maxDaysOut: 365,
    onlyBookNow: selectedFilter === 'book-now'
  });

  const priceDropsQuery = trpc.intelligence.bookingPredictor.getPriceDropAlerts.useQuery({
    minDropPercentage: 10,
    daysToCheck: 14
  });

  const handleRefresh = async () => {
    setRefreshing(true);
    await Promise.all([refetch(), priceDropsQuery.refetch()]);
    setRefreshing(false);
  };

  const getTimingColor = (timing: BookingTimingType) => {
    switch (timing) {
      case 'book-now': return COLORS.success;
      case 'wait': return COLORS.warning;
      case 'monitor': return COLORS.primary;
      case 'peak-passed': return COLORS.error;
      default: return COLORS.textSecondary;
    }
  };

  const getTimingIcon = (timing: BookingTimingType) => {
    switch (timing) {
      case 'book-now': return CheckCircle;
      case 'wait': return Clock;
      case 'monitor': return Eye;
      case 'peak-passed': return AlertCircle;
      default: return AlertCircle;
    }
  };

  const getConfidenceBadge = (confidence: ConfidenceType) => {
    const colors = {
      high: COLORS.success,
      medium: COLORS.warning,
      low: COLORS.error
    };
    return (
      <View style={[styles.confidenceBadge, { backgroundColor: `${colors[confidence]}20` }]}>
        <Text style={[styles.confidenceText, { color: colors[confidence] }]}>
          {confidence.toUpperCase()}
        </Text>
      </View>
    );
  };

  const renderPriceDropAlerts = () => {
    if (!priceDropsQuery.data?.alerts || priceDropsQuery.data.alerts.length === 0) {
      return null;
    }

    return (
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <TrendingDown size={20} color={COLORS.error} />
          <Text style={styles.sectionTitle}>Recent Price Drops</Text>
        </View>
        
        {priceDropsQuery.data.alerts.slice(0, 3).map((alert) => (
          <TouchableOpacity
            key={alert.cruiseId}
            style={styles.alertCard}
            onPress={() => router.push(`/cruise/${alert.cruiseId}`)}
          >
            <View style={styles.alertHeader}>
              <Text style={styles.alertShip}>{alert.ship}</Text>
              <View style={[styles.dropBadge, { backgroundColor: `${COLORS.error}20` }]}>
                <TrendingDown size={14} color={COLORS.error} />
                <Text style={[styles.dropText, { color: COLORS.error }]}>
                  {alert.biggestDrop.dropPercentage.toFixed(0)}% off
                </Text>
              </View>
            </View>
            <Text style={styles.alertItinerary} numberOfLines={1}>
              {alert.itineraryName}
            </Text>
            <View style={styles.alertFooter}>
              <Text style={styles.alertSavings}>
                Save ${alert.biggestDrop.dropAmount.toFixed(0)}
              </Text>
              <Text style={styles.alertDate}>
                {new Date(alert.departureDate).toLocaleDateString()}
              </Text>
            </View>
          </TouchableOpacity>
        ))}
      </View>
    );
  };

  const renderSummaryCards = () => {
    if (!data?.summary) return null;

    return (
      <View style={styles.summaryGrid}>
        <View style={[styles.summaryCard, { backgroundColor: COLORS.success + '20' }]}>
          <CheckCircle size={24} color={COLORS.success} />
          <Text style={styles.summaryNumber}>{data.summary.bookNow}</Text>
          <Text style={styles.summaryLabel}>Book Now</Text>
        </View>
        
        <View style={[styles.summaryCard, { backgroundColor: COLORS.primary + '20' }]}>
          <Eye size={24} color={COLORS.primary} />
          <Text style={styles.summaryNumber}>{data.summary.monitor}</Text>
          <Text style={styles.summaryLabel}>Monitor</Text>
        </View>
        
        <View style={[styles.summaryCard, { backgroundColor: COLORS.warning + '20' }]}>
          <Clock size={24} color={COLORS.warning} />
          <Text style={styles.summaryNumber}>{data.summary.wait}</Text>
          <Text style={styles.summaryLabel}>Wait</Text>
        </View>
        
        <View style={[styles.summaryCard, { backgroundColor: COLORS.accent + '20' }]}>
          <DollarSign size={24} color={COLORS.accent} />
          <Text style={styles.summaryNumber}>
            ${(data.summary.totalPotentialSavings / 1000).toFixed(1)}k
          </Text>
          <Text style={styles.summaryLabel}>Potential Savings</Text>
        </View>
      </View>
    );
  };

  const renderCruiseCard = (analysis: any) => {
    const TimingIcon = getTimingIcon(analysis.bookingRecommendation.timing);
    const timingColor = getTimingColor(analysis.bookingRecommendation.timing);
    
    return (
      <TouchableOpacity
        key={analysis.cruiseId}
        style={styles.cruiseCard}
        onPress={() => router.push(`/cruise/${analysis.cruiseId}`)}
      >
        <View style={styles.cruiseHeader}>
          <View style={{ flex: 1 }}>
            <Text style={styles.cruiseShip}>{analysis.ship}</Text>
            <Text style={styles.cruiseItinerary} numberOfLines={1}>
              {analysis.itineraryName}
            </Text>
          </View>
          <View style={[styles.timingBadge, { backgroundColor: `${timingColor}20` }]}>
            <TimingIcon size={16} color={timingColor} />
            <Text style={[styles.timingText, { color: timingColor }]}>
              {analysis.bookingRecommendation.timing.toUpperCase().replace('-', ' ')}
            </Text>
          </View>
        </View>

        <View style={styles.pricingRow}>
          <View style={styles.priceInfo}>
            <Text style={styles.priceLabel}>Current Balcony</Text>
            <Text style={styles.priceValue}>
              ${analysis.currentPricing.balcony?.toLocaleString() || 'N/A'}
            </Text>
          </View>
          
          {analysis.lowestPricing.balcony && (
            <View style={styles.priceInfo}>
              <Text style={styles.priceLabel}>Lowest Seen</Text>
              <Text style={[styles.priceValue, { color: COLORS.success }]}>
                ${analysis.lowestPricing.balcony.toLocaleString()}
              </Text>
            </View>
          )}
        </View>

        <View style={styles.metricsRow}>
          <View style={styles.metric}>
            <Calendar size={14} color={COLORS.textSecondary} />
            <Text style={styles.metricText}>
              {analysis.daysUntilDeparture} days
            </Text>
          </View>
          
          {analysis.historicalPattern.isAtHistoricalLow && (
            <View style={styles.metric}>
              <TrendingDown size={14} color={COLORS.success} />
              <Text style={[styles.metricText, { color: COLORS.success }]}>
                Historical Low
              </Text>
            </View>
          )}
          
          {analysis.priceDrops.length > 0 && (
            <View style={styles.metric}>
              <TrendingDown size={14} color={COLORS.warning} />
              <Text style={styles.metricText}>
                {analysis.priceDrops.length} drop{analysis.priceDrops.length > 1 ? 's' : ''}
              </Text>
            </View>
          )}
        </View>

        <View style={styles.recommendationRow}>
          {getConfidenceBadge(analysis.bookingRecommendation.confidence)}
          <Text style={styles.recommendationText} numberOfLines={2}>
            {analysis.bookingRecommendation.reason}
          </Text>
        </View>

        {analysis.bookingRecommendation.estimatedSavings && (
          <View style={styles.savingsRow}>
            <DollarSign size={14} color={COLORS.success} />
            <Text style={[styles.savingsText, { color: COLORS.success }]}>
              Potential savings: ${analysis.bookingRecommendation.estimatedSavings.toFixed(0)}
            </Text>
          </View>
        )}
      </TouchableOpacity>
    );
  };

  if (isLoading) {
    return (
      <View style={[styles.container, { backgroundColor: COLORS.background }]}>
        <Stack.Screen options={{ title: 'Booking Window Predictor', headerShown: true }} />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={COLORS.primary} />
          <Text style={styles.loadingText}>Analyzing booking windows...</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: COLORS.background }]}>
      <Stack.Screen 
        options={{ 
          title: 'Booking Window Predictor',
          headerShown: true,
          headerStyle: { backgroundColor: COLORS.background },
          headerTintColor: COLORS.textPrimary
        }} 
      />
      
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 20 }]}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={COLORS.primary} />
        }
      >
        <View style={styles.filterRow}>
          <TouchableOpacity
            style={[styles.filterButton, selectedFilter === 'all' && styles.filterButtonActive]}
            onPress={() => setSelectedFilter('all')}
          >
            <Text style={[styles.filterText, selectedFilter === 'all' && styles.filterTextActive]}>
              All Cruises
            </Text>
          </TouchableOpacity>
          
          <TouchableOpacity
            style={[styles.filterButton, selectedFilter === 'book-now' && styles.filterButtonActive]}
            onPress={() => setSelectedFilter('book-now')}
          >
            <Text style={[styles.filterText, selectedFilter === 'book-now' && styles.filterTextActive]}>
              Book Now Only
            </Text>
          </TouchableOpacity>
        </View>

        {renderPriceDropAlerts()}
        {renderSummaryCards()}

        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <TrendingUp size={20} color={COLORS.primary} />
            <Text style={styles.sectionTitle}>
              {selectedFilter === 'book-now' ? 'Ready to Book' : 'All Predictions'}
            </Text>
            <Text style={styles.sectionCount}>
              {data?.analyses.length || 0}
            </Text>
          </View>

          {data?.analyses && data.analyses.length > 0 ? (
            data.analyses.map(renderCruiseCard)
          ) : (
            <View style={styles.emptyState}>
              <AlertCircle size={48} color={COLORS.textSecondary} />
              <Text style={styles.emptyText}>No cruises match your criteria</Text>
            </View>
          )}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1
  },
  scrollView: {
    flex: 1
  },
  content: {
    padding: 16
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 16
  },
  loadingText: {
    fontSize: 16,
    color: COLORS.textSecondary
  },
  filterRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 20
  },
  filterButton: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.border,
    alignItems: 'center'
  },
  filterButtonActive: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary
  },
  filterText: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: COLORS.textSecondary
  },
  filterTextActive: {
    color: COLORS.textPrimary
  },
  section: {
    marginBottom: 24
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 16
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700' as const,
    color: COLORS.textPrimary,
    flex: 1
  },
  sectionCount: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: COLORS.textSecondary,
    backgroundColor: COLORS.card,
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12
  },
  summaryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 24
  },
  summaryCard: {
    flex: 1,
    minWidth: '47%',
    padding: 16,
    borderRadius: 16,
    alignItems: 'center',
    gap: 8
  },
  summaryNumber: {
    fontSize: 24,
    fontWeight: '700' as const,
    color: COLORS.textPrimary
  },
  summaryLabel: {
    fontSize: 12,
    fontWeight: '600' as const,
    color: COLORS.textSecondary
  },
  alertCard: {
    backgroundColor: COLORS.card,
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: COLORS.error + '40'
  },
  alertHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8
  },
  alertShip: {
    fontSize: 16,
    fontWeight: '700' as const,
    color: COLORS.textPrimary
  },
  dropBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8
  },
  dropText: {
    fontSize: 12,
    fontWeight: '700' as const
  },
  alertItinerary: {
    fontSize: 14,
    color: COLORS.textSecondary,
    marginBottom: 12
  },
  alertFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center'
  },
  alertSavings: {
    fontSize: 14,
    fontWeight: '700' as const,
    color: COLORS.success
  },
  alertDate: {
    fontSize: 12,
    color: COLORS.textSecondary
  },
  cruiseCard: {
    backgroundColor: COLORS.card,
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: COLORS.border
  },
  cruiseHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
    gap: 12
  },
  cruiseShip: {
    fontSize: 18,
    fontWeight: '700' as const,
    color: COLORS.textPrimary,
    marginBottom: 4
  },
  cruiseItinerary: {
    fontSize: 14,
    color: COLORS.textSecondary
  },
  timingBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12
  },
  timingText: {
    fontSize: 12,
    fontWeight: '700' as const
  },
  pricingRow: {
    flexDirection: 'row',
    gap: 16,
    marginBottom: 12
  },
  priceInfo: {
    flex: 1
  },
  priceLabel: {
    fontSize: 12,
    color: COLORS.textSecondary,
    marginBottom: 4
  },
  priceValue: {
    fontSize: 18,
    fontWeight: '700' as const,
    color: COLORS.textPrimary
  },
  metricsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 12
  },
  metric: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: COLORS.background,
    borderRadius: 8
  },
  metricText: {
    fontSize: 12,
    fontWeight: '600' as const,
    color: COLORS.textSecondary
  },
  recommendationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8
  },
  confidenceBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6
  },
  confidenceText: {
    fontSize: 10,
    fontWeight: '700' as const
  },
  recommendationText: {
    flex: 1,
    fontSize: 13,
    color: COLORS.textSecondary,
    lineHeight: 18
  },
  savingsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: COLORS.border
  },
  savingsText: {
    fontSize: 13,
    fontWeight: '600' as const
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 48,
    gap: 16
  },
  emptyText: {
    fontSize: 16,
    color: COLORS.textSecondary
  }
});
