import React, { useState } from 'react';
import { View, Text, ScrollView, StyleSheet, TouchableOpacity, ActivityIndicator, SafeAreaView } from 'react-native';
import { Stack } from 'expo-router';
import { trpc } from '@/lib/trpc';
import { TrendingUp, TrendingDown, Minus, AlertCircle, CheckCircle } from 'lucide-react-native';

export default function BookingWindowPredictorScreen() {
  const [selectedFilter, setSelectedFilter] = useState<'all' | 'book_now' | 'wait' | 'monitor'>('all');
  
  const bookingWindowQuery = trpc.analytics.bookingWindowPrediction.useQuery({});
  
  const { data, isLoading, error } = bookingWindowQuery;
  
  const filteredPredictions = data?.predictions?.filter(p => {
    if (selectedFilter === 'all') return true;
    return p.bookingWindowAnalysis.recommendedAction === selectedFilter;
  }) || [];
  
  if (isLoading) {
    return (
      <View style={styles.container}>
        <Stack.Screen
          options={{
            title: 'Smart Booking Window Predictor',
            headerStyle: { backgroundColor: '#1a1a2e' },
            headerTintColor: '#fff',
          }}
        />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#6366f1" />
          <Text style={styles.loadingText}>Analyzing pricing patterns...</Text>
        </View>
      </View>
    );
  }
  
  if (error) {
    return (
      <View style={styles.container}>
        <Stack.Screen
          options={{
            title: 'Smart Booking Window Predictor',
            headerStyle: { backgroundColor: '#1a1a2e' },
            headerTintColor: '#fff',
          }}
        />
        <View style={styles.errorContainer}>
          <AlertCircle size={48} color="#ef4444" />
          <Text style={styles.errorText}>Failed to load predictions</Text>
          <Text style={styles.errorSubtext}>{error.message}</Text>
        </View>
      </View>
    );
  }
  
  const summary = data?.summary;
  
  const getTrendIcon = (trend: 'rising' | 'falling' | 'stable') => {
    switch (trend) {
      case 'rising':
        return <TrendingUp size={16} color="#ef4444" />;
      case 'falling':
        return <TrendingDown size={16} color="#10b981" />;
      case 'stable':
        return <Minus size={16} color="#6b7280" />;
    }
  };
  
  const getPriceLevelColor = (level: 'low' | 'medium' | 'high') => {
    switch (level) {
      case 'low':
        return '#10b981';
      case 'medium':
        return '#f59e0b';
      case 'high':
        return '#ef4444';
    }
  };
  
  const getActionColor = (action: 'book_now' | 'wait' | 'monitor') => {
    switch (action) {
      case 'book_now':
        return '#10b981';
      case 'wait':
        return '#ef4444';
      case 'monitor':
        return '#6366f1';
    }
  };
  
  return (
    <SafeAreaView style={styles.container}>
      <Stack.Screen
        options={{
          title: 'Smart Booking Window Predictor',
          headerStyle: { backgroundColor: '#1a1a2e' },
          headerTintColor: '#fff',
        }}
      />
      
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        {summary && (
          <View style={styles.summaryCard}>
            <Text style={styles.summaryTitle}>Booking Analysis Summary</Text>
            <View style={styles.summaryRow}>
              <View style={styles.summaryItem}>
                <Text style={styles.summaryValue}>{summary.totalCruisesAnalyzed}</Text>
                <Text style={styles.summaryLabel}>Cruises Analyzed</Text>
              </View>
              <View style={styles.summaryItem}>
                <Text style={[styles.summaryValue, { color: '#10b981' }]}>{summary.bookNowCount}</Text>
                <Text style={styles.summaryLabel}>Book Now</Text>
              </View>
              <View style={styles.summaryItem}>
                <Text style={[styles.summaryValue, { color: '#6366f1' }]}>{summary.monitorCount}</Text>
                <Text style={styles.summaryLabel}>Monitor</Text>
              </View>
              <View style={styles.summaryItem}>
                <Text style={[styles.summaryValue, { color: '#ef4444' }]}>{summary.waitCount}</Text>
                <Text style={styles.summaryLabel}>Wait</Text>
              </View>
            </View>
          </View>
        )}
        
        <View style={styles.filterContainer}>
          <TouchableOpacity
            style={[styles.filterButton, selectedFilter === 'all' && styles.filterButtonActive]}
            onPress={() => setSelectedFilter('all')}
          >
            <Text style={[styles.filterText, selectedFilter === 'all' && styles.filterTextActive]}>All</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.filterButton, selectedFilter === 'book_now' && styles.filterButtonActive]}
            onPress={() => setSelectedFilter('book_now')}
          >
            <Text style={[styles.filterText, selectedFilter === 'book_now' && styles.filterTextActive]}>Book Now</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.filterButton, selectedFilter === 'monitor' && styles.filterButtonActive]}
            onPress={() => setSelectedFilter('monitor')}
          >
            <Text style={[styles.filterText, selectedFilter === 'monitor' && styles.filterTextActive]}>Monitor</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.filterButton, selectedFilter === 'wait' && styles.filterButtonActive]}
            onPress={() => setSelectedFilter('wait')}
          >
            <Text style={[styles.filterText, selectedFilter === 'wait' && styles.filterTextActive]}>Wait</Text>
          </TouchableOpacity>
        </View>
        
        {filteredPredictions.length === 0 ? (
          <View style={styles.emptyState}>
            <AlertCircle size={48} color="#6b7280" />
            <Text style={styles.emptyStateText}>No cruises match your filter</Text>
          </View>
        ) : (
          filteredPredictions.map((prediction) => (
            <View key={prediction.cruiseId} style={styles.predictionCard}>
              <View style={styles.predictionHeader}>
                <View style={styles.predictionTitleContainer}>
                  <Text style={styles.predictionShip}>{prediction.ship}</Text>
                  <Text style={styles.predictionItinerary}>{prediction.itineraryName}</Text>
                </View>
                <View style={[
                  styles.actionBadge,
                  { backgroundColor: getActionColor(prediction.bookingWindowAnalysis.recommendedAction) + '20' }
                ]}>
                  <Text style={[
                    styles.actionText,
                    { color: getActionColor(prediction.bookingWindowAnalysis.recommendedAction) }
                  ]}>
                    {prediction.bookingWindowAnalysis.recommendedAction.replace('_', ' ').toUpperCase()}
                  </Text>
                </View>
              </View>
              
              <View style={styles.metricsRow}>
                <View style={styles.metric}>
                  <Text style={styles.metricLabel}>Days Until</Text>
                  <Text style={styles.metricValue}>{prediction.bookingWindowAnalysis.daysUntilDeparture}</Text>
                </View>
                <View style={styles.metric}>
                  <Text style={styles.metricLabel}>Price Level</Text>
                  <View style={styles.metricValueRow}>
                    <View style={[
                      styles.priceLevelDot,
                      { backgroundColor: getPriceLevelColor(prediction.bookingWindowAnalysis.currentPriceLevel) }
                    ]} />
                    <Text style={[
                      styles.metricValue,
                      { color: getPriceLevelColor(prediction.bookingWindowAnalysis.currentPriceLevel) }
                    ]}>
                      {prediction.bookingWindowAnalysis.currentPriceLevel.toUpperCase()}
                    </Text>
                  </View>
                </View>
                <View style={styles.metric}>
                  <Text style={styles.metricLabel}>Trend</Text>
                  <View style={styles.metricValueRow}>
                    {getTrendIcon(prediction.pricingTrends.trend)}
                    <Text style={styles.metricValue}>
                      {prediction.pricingTrends.trend.charAt(0).toUpperCase() + prediction.pricingTrends.trend.slice(1)}
                    </Text>
                  </View>
                </View>
                <View style={styles.metric}>
                  <Text style={styles.metricLabel}>Drop Likelihood</Text>
                  <Text style={styles.metricValue}>
                    {(prediction.bookingWindowAnalysis.priceDropLikelihood * 100).toFixed(0)}%
                  </Text>
                </View>
              </View>
              
              <View style={styles.windowContainer}>
                <Text style={styles.windowTitle}>Optimal Booking Window</Text>
                <Text style={styles.windowRange}>
                  {prediction.bookingWindowAnalysis.optimalBookingWindow.start}-{prediction.bookingWindowAnalysis.optimalBookingWindow.end} days before departure
                </Text>
                <Text style={styles.windowReason}>
                  {prediction.bookingWindowAnalysis.optimalBookingWindow.reason}
                </Text>
              </View>
              
              {prediction.alerts.length > 0 && (
                <View style={styles.alertsContainer}>
                  {prediction.alerts.map((alert, idx) => (
                    <View key={idx} style={[
                      styles.alert,
                      alert.severity === 'success' && styles.alertSuccess,
                      alert.severity === 'warning' && styles.alertWarning,
                      alert.severity === 'info' && styles.alertInfo,
                    ]}>
                      <CheckCircle
                        size={16}
                        color={
                          alert.severity === 'success' ? '#10b981' :
                          alert.severity === 'warning' ? '#f59e0b' :
                          '#6366f1'
                        }
                      />
                      <Text style={[
                        styles.alertText,
                        alert.severity === 'success' && styles.alertTextSuccess,
                        alert.severity === 'warning' && styles.alertTextWarning,
                        alert.severity === 'info' && styles.alertTextInfo,
                      ]}>
                        {alert.message}
                      </Text>
                    </View>
                  ))}
                </View>
              )}
              
              {prediction.pricingTrends.predictedPriceIn30Days !== null && (
                <View style={styles.forecastContainer}>
                  <Text style={styles.forecastTitle}>Price Forecast</Text>
                  <View style={styles.forecastRow}>
                    <Text style={styles.forecastLabel}>30 days:</Text>
                    <Text style={styles.forecastValue}>
                      ${prediction.pricingTrends.predictedPriceIn30Days?.toFixed(0) || 'N/A'}
                    </Text>
                  </View>
                  {prediction.pricingTrends.predictedPriceIn60Days !== null && (
                    <View style={styles.forecastRow}>
                      <Text style={styles.forecastLabel}>60 days:</Text>
                      <Text style={styles.forecastValue}>
                        ${prediction.pricingTrends.predictedPriceIn60Days?.toFixed(0) || 'N/A'}
                      </Text>
                    </View>
                  )}
                </View>
              )}
            </View>
          ))
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f0f1e',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#9ca3af',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  errorText: {
    marginTop: 16,
    fontSize: 18,
    fontWeight: '600' as const,
    color: '#ef4444',
  },
  errorSubtext: {
    marginTop: 8,
    fontSize: 14,
    color: '#9ca3af',
    textAlign: 'center' as const,
  },
  summaryCard: {
    backgroundColor: '#1a1a2e',
    borderRadius: 12,
    padding: 20,
    marginBottom: 16,
  },
  summaryTitle: {
    fontSize: 18,
    fontWeight: '700' as const,
    color: '#fff',
    marginBottom: 16,
  },
  summaryRow: {
    flexDirection: 'row' as const,
    justifyContent: 'space-between' as const,
  },
  summaryItem: {
    alignItems: 'center' as const,
  },
  summaryValue: {
    fontSize: 24,
    fontWeight: '700' as const,
    color: '#fff',
  },
  summaryLabel: {
    fontSize: 12,
    color: '#9ca3af',
    marginTop: 4,
  },
  filterContainer: {
    flexDirection: 'row' as const,
    gap: 8,
    marginBottom: 16,
  },
  filterButton: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
    backgroundColor: '#1a1a2e',
    alignItems: 'center' as const,
  },
  filterButtonActive: {
    backgroundColor: '#6366f1',
  },
  filterText: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: '#9ca3af',
  },
  filterTextActive: {
    color: '#fff',
  },
  emptyState: {
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    paddingVertical: 48,
  },
  emptyStateText: {
    marginTop: 16,
    fontSize: 16,
    color: '#6b7280',
  },
  predictionCard: {
    backgroundColor: '#1a1a2e',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  predictionHeader: {
    flexDirection: 'row' as const,
    justifyContent: 'space-between' as const,
    alignItems: 'flex-start' as const,
    marginBottom: 16,
  },
  predictionTitleContainer: {
    flex: 1,
  },
  predictionShip: {
    fontSize: 18,
    fontWeight: '700' as const,
    color: '#fff',
  },
  predictionItinerary: {
    fontSize: 14,
    color: '#9ca3af',
    marginTop: 4,
  },
  actionBadge: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 6,
  },
  actionText: {
    fontSize: 12,
    fontWeight: '700' as const,
  },
  metricsRow: {
    flexDirection: 'row' as const,
    justifyContent: 'space-between' as const,
    marginBottom: 16,
  },
  metric: {
    alignItems: 'center' as const,
  },
  metricLabel: {
    fontSize: 11,
    color: '#6b7280',
    marginBottom: 4,
  },
  metricValue: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: '#fff',
  },
  metricValueRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 4,
  },
  priceLevelDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  windowContainer: {
    backgroundColor: '#0f0f1e',
    borderRadius: 8,
    padding: 12,
    marginBottom: 12,
  },
  windowTitle: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: '#fff',
    marginBottom: 4,
  },
  windowRange: {
    fontSize: 16,
    fontWeight: '700' as const,
    color: '#6366f1',
    marginBottom: 4,
  },
  windowReason: {
    fontSize: 12,
    color: '#9ca3af',
  },
  alertsContainer: {
    gap: 8,
    marginBottom: 12,
  },
  alert: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 8,
    padding: 10,
    borderRadius: 6,
  },
  alertSuccess: {
    backgroundColor: '#10b98120',
  },
  alertWarning: {
    backgroundColor: '#f59e0b20',
  },
  alertInfo: {
    backgroundColor: '#6366f120',
  },
  alertText: {
    flex: 1,
    fontSize: 12,
  },
  alertTextSuccess: {
    color: '#10b981',
  },
  alertTextWarning: {
    color: '#f59e0b',
  },
  alertTextInfo: {
    color: '#6366f1',
  },
  forecastContainer: {
    backgroundColor: '#0f0f1e',
    borderRadius: 8,
    padding: 12,
  },
  forecastTitle: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: '#fff',
    marginBottom: 8,
  },
  forecastRow: {
    flexDirection: 'row' as const,
    justifyContent: 'space-between' as const,
    marginBottom: 4,
  },
  forecastLabel: {
    fontSize: 12,
    color: '#9ca3af',
  },
  forecastValue: {
    fontSize: 12,
    fontWeight: '600' as const,
    color: '#fff',
  },
});
