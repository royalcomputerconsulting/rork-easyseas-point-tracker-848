import React, { useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { trpc } from '@/lib/trpc';
import { TrendingUp, Award, Ship, Calendar, MapPin, Home } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

interface ValueScoreFactors {
  roiScore: number;
  offerValueScore: number;
  shipProfitabilityScore: number;
  scheduleScore: number;
  portDistanceScore: number;
  cabinMatchScore: number;
  pricingScore: number;
}

interface CruiseValueScore {
  cruiseId: string;
  ship: string;
  itinerary: string;
  departureDate: string;
  totalScore: number;
  factors: ValueScoreFactors;
  recommendation: 'excellent' | 'good' | 'fair' | 'poor';
  insights: string[];
}

export default function CruiseValueScoresScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [selectedFilter, setSelectedFilter] = useState<'all' | 'excellent' | 'good' | 'fair' | 'poor'>('all');
  
  const { data, isLoading, error, refetch } = trpc.analytics.cruiseValueScore.useQuery({});

  const filteredScores = useMemo(() => {
    if (!data?.scores) return [];
    if (selectedFilter === 'all') return data.scores;
    return data.scores.filter((s: CruiseValueScore) => s.recommendation === selectedFilter);
  }, [data?.scores, selectedFilter]);

  const getScoreColor = (score: number) => {
    if (score >= 80) return '#10b981';
    if (score >= 60) return '#3b82f6';
    if (score >= 40) return '#f59e0b';
    return '#ef4444';
  };

  const getRecommendationColor = (rec: string) => {
    switch (rec) {
      case 'excellent': return '#10b981';
      case 'good': return '#3b82f6';
      case 'fair': return '#f59e0b';
      case 'poor': return '#ef4444';
      default: return '#6b7280';
    }
  };

  const renderFactorBar = (label: string, value: number, IconComponent: React.ComponentType<{ size: number; color: string }>) => {
    const percentage = Math.min(100, Math.max(0, value));
    const color = getScoreColor(value);
    
    return (
      <View style={styles.factorContainer}>
        <View style={styles.factorHeader}>
          <View style={styles.factorLabelContainer}>
            <IconComponent size={14} color="#6b7280" />
            <Text style={styles.factorLabel}>{label}</Text>
          </View>
          <Text style={[styles.factorValue, { color }]}>{Math.round(value)}</Text>
        </View>
        <View style={styles.factorBarBackground}>
          <View style={[styles.factorBarFill, { width: `${percentage}%`, backgroundColor: color }]} />
        </View>
      </View>
    );
  };

  const renderScoreCard = (score: CruiseValueScore) => {
    const scoreColor = getScoreColor(score.totalScore);
    const recColor = getRecommendationColor(score.recommendation);
    
    return (
      <TouchableOpacity
        key={score.cruiseId}
        style={styles.scoreCard}
        onPress={() => router.push(`/cruise/${score.cruiseId}`)}
        activeOpacity={0.7}
      >
        <View style={styles.scoreHeader}>
          <View style={styles.scoreHeaderLeft}>
            <Text style={styles.shipName}>{score.ship}</Text>
            <Text style={styles.itinerary} numberOfLines={1}>{score.itinerary}</Text>
            <Text style={styles.departureDate}>
              {new Date(score.departureDate).toLocaleDateString('en-US', { 
                month: 'short', 
                day: 'numeric', 
                year: 'numeric' 
              })}
            </Text>
          </View>
          <View style={styles.scoreHeaderRight}>
            <View style={[styles.scoreBadge, { backgroundColor: scoreColor }]}>
              <Text style={styles.scoreValue}>{score.totalScore}</Text>
            </View>
            <View style={[styles.recommendationBadge, { backgroundColor: recColor }]}>
              <Text style={styles.recommendationText}>{score.recommendation.toUpperCase()}</Text>
            </View>
          </View>
        </View>

        <View style={styles.factorsSection}>
          {renderFactorBar('ROI Potential', score.factors.roiScore, TrendingUp)}
          {renderFactorBar('Offer Value', score.factors.offerValueScore, Award)}
          {renderFactorBar('Ship History', score.factors.shipProfitabilityScore, Ship)}
          {renderFactorBar('Schedule Fit', score.factors.scheduleScore, Calendar)}
          {renderFactorBar('Port Distance', score.factors.portDistanceScore, MapPin)}
          {renderFactorBar('Cabin Match', score.factors.cabinMatchScore, Home)}
        </View>

        {score.insights.length > 0 && (
          <View style={styles.insightsSection}>
            {score.insights.slice(0, 3).map((insight, idx) => (
              <Text key={idx} style={styles.insightText}>• {insight}</Text>
            ))}
          </View>
        )}
      </TouchableOpacity>
    );
  };

  if (isLoading) {
    return (
      <View style={styles.container}>
        <Stack.Screen options={{ title: 'Cruise Value Scores', headerShown: true }} />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#3b82f6" />
          <Text style={styles.loadingText}>Calculating value scores...</Text>
        </View>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.container}>
        <Stack.Screen options={{ title: 'Cruise Value Scores', headerShown: true }} />
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>Error loading value scores</Text>
          <TouchableOpacity style={styles.retryButton} onPress={() => refetch()}>
            <Text style={styles.retryText}>Retry</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { paddingBottom: insets.bottom }]}>
      <Stack.Screen 
        options={{ 
          title: 'Cruise Value Scores', 
          headerShown: true,
        }} 
      />
      
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        {data?.summary && (
          <View style={styles.summaryCard}>
            <Text style={styles.summaryTitle}>Portfolio Summary</Text>
            <View style={styles.summaryGrid}>
              <View style={styles.summaryItem}>
                <Text style={styles.summaryValue}>{data.summary.totalCruisesScored}</Text>
                <Text style={styles.summaryLabel}>Total Cruises</Text>
              </View>
              <View style={styles.summaryItem}>
                <Text style={[styles.summaryValue, { color: '#10b981' }]}>
                  {data.summary.excellentCount}
                </Text>
                <Text style={styles.summaryLabel}>Excellent</Text>
              </View>
              <View style={styles.summaryItem}>
                <Text style={[styles.summaryValue, { color: '#3b82f6' }]}>
                  {data.summary.goodCount}
                </Text>
                <Text style={styles.summaryLabel}>Good</Text>
              </View>
              <View style={styles.summaryItem}>
                <Text style={styles.summaryValue}>{data.summary.averageScore}</Text>
                <Text style={styles.summaryLabel}>Avg Score</Text>
              </View>
            </View>
          </View>
        )}

        <View style={styles.filtersContainer}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            {['all', 'excellent', 'good', 'fair', 'poor'].map((filter) => (
              <TouchableOpacity
                key={filter}
                style={[
                  styles.filterButton,
                  selectedFilter === filter && styles.filterButtonActive,
                ]}
                onPress={() => setSelectedFilter(filter as any)}
              >
                <Text
                  style={[
                    styles.filterText,
                    selectedFilter === filter && styles.filterTextActive,
                  ]}
                >
                  {filter.charAt(0).toUpperCase() + filter.slice(1)}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>

        <View style={styles.scoresContainer}>
          {filteredScores.length === 0 ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyText}>No cruises found for this filter</Text>
            </View>
          ) : (
            filteredScores.map(renderScoreCard)
          )}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f9fafb',
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
    marginTop: 12,
    fontSize: 16,
    color: '#6b7280',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  errorText: {
    fontSize: 16,
    color: '#ef4444',
    marginBottom: 16,
  },
  retryButton: {
    backgroundColor: '#3b82f6',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  retryText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
  summaryCard: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  summaryTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 12,
  },
  summaryGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  summaryItem: {
    alignItems: 'center',
  },
  summaryValue: {
    fontSize: 24,
    fontWeight: '700',
    color: '#111827',
  },
  summaryLabel: {
    fontSize: 12,
    color: '#6b7280',
    marginTop: 4,
  },
  filtersContainer: {
    marginBottom: 16,
  },
  filterButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#e5e7eb',
    marginRight: 8,
  },
  filterButtonActive: {
    backgroundColor: '#3b82f6',
  },
  filterText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#6b7280',
  },
  filterTextActive: {
    color: '#ffffff',
  },
  scoresContainer: {
    gap: 12,
  },
  scoreCard: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 3,
  },
  scoreHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  scoreHeaderLeft: {
    flex: 1,
    marginRight: 12,
  },
  shipName: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 4,
  },
  itinerary: {
    fontSize: 14,
    color: '#6b7280',
    marginBottom: 4,
  },
  departureDate: {
    fontSize: 12,
    color: '#9ca3af',
  },
  scoreHeaderRight: {
    alignItems: 'flex-end',
    gap: 8,
  },
  scoreBadge: {
    width: 60,
    height: 60,
    borderRadius: 30,
    justifyContent: 'center',
    alignItems: 'center',
  },
  scoreValue: {
    fontSize: 24,
    fontWeight: '800',
    color: '#ffffff',
  },
  recommendationBadge: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
  },
  recommendationText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#ffffff',
  },
  factorsSection: {
    gap: 12,
    marginBottom: 16,
  },
  factorContainer: {
    gap: 4,
  },
  factorHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  factorLabelContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  factorLabel: {
    fontSize: 12,
    color: '#6b7280',
    fontWeight: '500',
  },
  factorValue: {
    fontSize: 14,
    fontWeight: '700',
  },
  factorBarBackground: {
    height: 6,
    backgroundColor: '#e5e7eb',
    borderRadius: 3,
    overflow: 'hidden',
  },
  factorBarFill: {
    height: '100%',
    borderRadius: 3,
  },
  insightsSection: {
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
    paddingTop: 12,
    gap: 6,
  },
  insightText: {
    fontSize: 12,
    color: '#4b5563',
    lineHeight: 18,
  },
  emptyState: {
    padding: 40,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 16,
    color: '#6b7280',
  },
});
