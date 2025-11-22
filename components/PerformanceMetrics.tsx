import React, { memo, useMemo } from 'react';
import { View, Text, StyleSheet, ActivityIndicator } from 'react-native';
import { ThemedCard } from '@/components/ui/ThemedCard';
import { Badge } from '@/components/ui/Badge';

interface PerformanceMetricsProps {
  data: {
    totalCruises: number;
    averageROI: number;
    totalSavings: number;
    bestROI: number;
    worstROI: number;
  };
  isLoading?: boolean;
}

function PerformanceMetricsBase({ data, isLoading }: PerformanceMetricsProps) {
  const performanceLevel = useMemo(() => {
    if (data.averageROI > 50) return { level: 'Excellent', color: '#34C759' };
    if (data.averageROI > 25) return { level: 'Good', color: '#007AFF' };
    if (data.averageROI > 0) return { level: 'Fair', color: '#FF9500' };
    return { level: 'Poor', color: '#FF3B30' };
  }, [data.averageROI]);

  const formattedMetrics = useMemo(() => ({
    totalCruises: data.totalCruises.toLocaleString(),
    averageROI: data.averageROI.toFixed(1),
    totalSavings: data.totalSavings.toLocaleString(),
    bestROI: data.bestROI.toFixed(1),
    worstROI: data.worstROI.toFixed(1),
  }), [data]);

  if (isLoading) {
    return (
      <ThemedCard style={styles.loadingCard}>
        <ActivityIndicator size="large" color="#007AFF" />
        <Text style={styles.loadingText}>Analyzing performance...</Text>
      </ThemedCard>
    );
  }

  return (
    <ThemedCard style={styles.card}>
      <View style={styles.header}>
        <Text style={styles.title}>Portfolio Performance</Text>
        <Badge label={performanceLevel.level} />
      </View>
      
      <View style={styles.metricsGrid}>
        <View style={styles.metricItem}>
          <Text style={styles.metricValue}>{formattedMetrics.totalCruises}</Text>
          <Text style={styles.metricLabel}>Total Cruises</Text>
        </View>
        <View style={styles.metricItem}>
          <Text style={[styles.metricValue, { color: performanceLevel.color }]}>
            {formattedMetrics.averageROI}%
          </Text>
          <Text style={styles.metricLabel}>Avg ROI</Text>
        </View>
        <View style={styles.metricItem}>
          <Text style={styles.metricValue}>${formattedMetrics.totalSavings}</Text>
          <Text style={styles.metricLabel}>Total Savings</Text>
        </View>
      </View>
      
      <View style={styles.rangeContainer}>
        <View style={styles.rangeItem}>
          <Text style={styles.rangeLabel}>Best ROI</Text>
          <Text style={[styles.rangeValue, { color: '#34C759' }]}>
            {formattedMetrics.bestROI}%
          </Text>
        </View>
        <View style={styles.rangeItem}>
          <Text style={styles.rangeLabel}>Worst ROI</Text>
          <Text style={[styles.rangeValue, { color: '#FF3B30' }]}>
            {formattedMetrics.worstROI}%
          </Text>
        </View>
      </View>
    </ThemedCard>
  );
}

export const PerformanceMetrics = memo(PerformanceMetricsBase);

const styles = StyleSheet.create({
  card: {
    padding: 20,
    marginBottom: 16,
  },
  loadingCard: {
    padding: 40,
    alignItems: 'center',
    marginBottom: 16,
  },
  loadingText: {
    fontSize: 16,
    color: '#8E8E93',
    marginTop: 16,
    textAlign: 'center',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  title: {
    fontSize: 20,
    fontWeight: '600',
    color: '#1C1C1E',
  },
  metricsGrid: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 20,
  },
  metricItem: {
    alignItems: 'center',
  },
  metricValue: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1C1C1E',
  },
  metricLabel: {
    fontSize: 12,
    color: '#8E8E93',
    marginTop: 4,
    textAlign: 'center',
  },
  rangeContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#E5E5EA',
  },
  rangeItem: {
    alignItems: 'center',
  },
  rangeLabel: {
    fontSize: 12,
    color: '#8E8E93',
    marginBottom: 4,
  },
  rangeValue: {
    fontSize: 16,
    fontWeight: '600',
  },
});