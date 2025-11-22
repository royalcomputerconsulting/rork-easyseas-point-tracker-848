import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  TextInput,
} from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { trpc } from '@/lib/trpc';
import { SafeAreaView } from 'react-native-safe-area-context';
import { TrendingUp, Target, DollarSign, Calendar, Award, AlertTriangle } from 'lucide-react-native';

export default function PortfolioOptimizerScreen() {
  const router = useRouter();
  const [targetTier, setTargetTier] = useState<'PRIME' | 'SIGNATURE' | 'MASTERS'>('SIGNATURE');
  const [maxCruises, setMaxCruises] = useState<string>('5');
  const [budget, setBudget] = useState<string>('');
  
  const { data, isLoading, refetch } = trpc.analytics.portfolioOptimizer.useQuery({
    targetTier,
    maxCruises: parseInt(maxCruises) || 5,
    budgetConstraint: budget ? parseFloat(budget) : undefined,
    includeExpiringOffers: true,
  });

  const renderTierButton = (tier: 'PRIME' | 'SIGNATURE' | 'MASTERS', label: string) => (
    <TouchableOpacity
      style={[
        styles.tierButton,
        targetTier === tier && styles.tierButtonActive,
      ]}
      onPress={() => setTargetTier(tier)}
    >
      <Text
        style={[
          styles.tierButtonText,
          targetTier === tier && styles.tierButtonTextActive,
        ]}
      >
        {label}
      </Text>
    </TouchableOpacity>
  );

  const renderRecommendation = (rec: any) => {
    const getStrategyColor = (strategy: string) => {
      switch (strategy) {
        case 'Tier Advancement': return '#10B981';
        case 'Maximize Expiring Offers': return '#F59E0B';
        case 'Balanced Approach': return '#3B82F6';
        case 'Quick Point Boost': return '#8B5CF6';
        default: return '#6B7280';
      }
    };

    const strategyColor = getStrategyColor(rec.strategy);

    return (
      <View key={rec.id} style={styles.recommendationCard}>
        <View style={[styles.strategyBadge, { backgroundColor: strategyColor }]}>
          <Text style={styles.strategyBadgeText}>{rec.strategy}</Text>
        </View>

        <Text style={styles.recTitle}>{rec.title}</Text>
        <Text style={styles.recDescription}>{rec.description}</Text>

        <View style={styles.recMetrics}>
          <View style={styles.metricItem}>
            <TrendingUp size={16} color="#10B981" />
            <Text style={styles.metricLabel}>Total Points</Text>
            <Text style={styles.metricValue}>{rec.totalPoints.toLocaleString()}</Text>
          </View>
          
          <View style={styles.metricItem}>
            <DollarSign size={16} color="#3B82F6" />
            <Text style={styles.metricLabel}>Total Cost</Text>
            <Text style={styles.metricValue}>${rec.totalCost.toLocaleString()}</Text>
          </View>
          
          <View style={styles.metricItem}>
            <Target size={16} color="#8B5CF6" />
            <Text style={styles.metricLabel}>Avg ROI</Text>
            <Text style={styles.metricValue}>{rec.averageROI.toFixed(1)}%</Text>
          </View>
          
          <View style={styles.metricItem}>
            <Calendar size={16} color="#F59E0B" />
            <Text style={styles.metricLabel}>Timeline</Text>
            <Text style={styles.metricValue}>{rec.timeToComplete}</Text>
          </View>
        </View>

        {rec.benefits && rec.benefits.length > 0 && (
          <View style={styles.benefitsSection}>
            <Text style={styles.sectionTitle}>Benefits</Text>
            {rec.benefits.map((benefit: string, idx: number) => (
              <View key={idx} style={styles.benefitItem}>
                <Award size={14} color="#10B981" />
                <Text style={styles.benefitText}>{benefit}</Text>
              </View>
            ))}
          </View>
        )}

        {rec.warnings && rec.warnings.length > 0 && (
          <View style={styles.warningsSection}>
            <Text style={styles.sectionTitleWarning}>Warnings</Text>
            {rec.warnings.map((warning: string, idx: number) => (
              <View key={idx} style={styles.warningItem}>
                <AlertTriangle size={14} color="#EF4444" />
                <Text style={styles.warningText}>{warning}</Text>
              </View>
            ))}
          </View>
        )}

        <Text style={styles.cruisesHeader}>Recommended Cruises ({rec.cruises.length})</Text>
        {rec.cruises.map((cruise: any, idx: number) => (
          <TouchableOpacity
            key={idx}
            style={styles.cruiseItem}
            onPress={() => router.push(`/cruise/${cruise.cruiseId}`)}
          >
            <View style={styles.cruiseLeft}>
              <Text style={styles.cruiseShip}>{cruise.ship}</Text>
              <Text style={styles.cruiseItinerary}>{cruise.itineraryName}</Text>
              <Text style={styles.cruiseDate}>
                {new Date(cruise.departureDate).toLocaleDateString()}
              </Text>
            </View>
            <View style={styles.cruiseRight}>
              <Text style={styles.cruisePoints}>+{cruise.estimatedPoints} pts</Text>
              <Text style={styles.cruiseROI}>{cruise.estimatedROI.toFixed(1)}% ROI</Text>
              <Text style={styles.cruiseCost}>${cruise.estimatedCost.toLocaleString()}</Text>
            </View>
          </TouchableOpacity>
        ))}
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <Stack.Screen
        options={{
          title: 'Portfolio Optimizer',
          headerStyle: { backgroundColor: '#1F2937' },
          headerTintColor: '#fff',
        }}
      />

      <ScrollView style={styles.content} contentContainerStyle={styles.scrollContent}>
        {data?.currentState && (
          <View style={styles.currentStateCard}>
            <Text style={styles.currentStateTitle}>Current Status</Text>
            <View style={styles.currentStateGrid}>
              <View style={styles.currentStateItem}>
                <Text style={styles.currentStateLabel}>Tier</Text>
                <Text style={styles.currentStateValue}>{data.currentState.currentTier}</Text>
              </View>
              <View style={styles.currentStateItem}>
                <Text style={styles.currentStateLabel}>Points</Text>
                <Text style={styles.currentStateValue}>{data.currentState.currentPoints.toLocaleString()}</Text>
              </View>
              <View style={styles.currentStateItem}>
                <Text style={styles.currentStateLabel}>To Next Tier</Text>
                <Text style={styles.currentStateValue}>{data.currentState.pointsToNextTier.toLocaleString()}</Text>
              </View>
              <View style={styles.currentStateItem}>
                <Text style={styles.currentStateLabel}>Avg Points/Cruise</Text>
                <Text style={styles.currentStateValue}>{data.currentState.averagePointsPerCruise}</Text>
              </View>
            </View>
          </View>
        )}

        <View style={styles.filtersCard}>
          <Text style={styles.filterTitle}>Optimization Filters</Text>
          
          <Text style={styles.filterLabel}>Target Tier</Text>
          <View style={styles.tierButtons}>
            {renderTierButton('PRIME', 'Prime')}
            {renderTierButton('SIGNATURE', 'Signature')}
            {renderTierButton('MASTERS', 'Masters')}
          </View>

          <Text style={styles.filterLabel}>Max Cruises</Text>
          <TextInput
            style={styles.input}
            value={maxCruises}
            onChangeText={setMaxCruises}
            keyboardType="number-pad"
            placeholder="5"
            placeholderTextColor="#9CA3AF"
          />

          <Text style={styles.filterLabel}>Budget Limit (Optional)</Text>
          <TextInput
            style={styles.input}
            value={budget}
            onChangeText={setBudget}
            keyboardType="number-pad"
            placeholder="No limit"
            placeholderTextColor="#9CA3AF"
          />

          <TouchableOpacity
            style={styles.optimizeButton}
            onPress={() => refetch()}
            disabled={isLoading}
          >
            <Text style={styles.optimizeButtonText}>
              {isLoading ? 'Optimizing...' : 'Optimize Portfolio'}
            </Text>
          </TouchableOpacity>
        </View>

        {isLoading && (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#3B82F6" />
            <Text style={styles.loadingText}>Analyzing cruise combinations...</Text>
          </View>
        )}

        {!isLoading && data?.recommendations && data.recommendations.length > 0 && (
          <View style={styles.recommendationsSection}>
            <Text style={styles.sectionHeaderText}>
              {data.recommendations.length} Optimization Strategies
            </Text>
            {data.recommendations.map((rec) => renderRecommendation(rec))}
          </View>
        )}

        {!isLoading && data?.recommendations && data.recommendations.length === 0 && (
          <View style={styles.emptyState}>
            <Text style={styles.emptyStateText}>
              No optimization strategies available with current filters.
            </Text>
            <Text style={styles.emptyStateSubtext}>
              Try adjusting your target tier or budget constraints.
            </Text>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#111827',
  },
  content: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
  },
  currentStateCard: {
    backgroundColor: '#1F2937',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  currentStateTitle: {
    fontSize: 18,
    fontWeight: '700' as const,
    color: '#F9FAFB',
    marginBottom: 12,
  },
  currentStateGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  currentStateItem: {
    flex: 1,
    minWidth: '45%',
  },
  currentStateLabel: {
    fontSize: 12,
    color: '#9CA3AF',
    marginBottom: 4,
  },
  currentStateValue: {
    fontSize: 20,
    fontWeight: '700' as const,
    color: '#3B82F6',
  },
  filtersCard: {
    backgroundColor: '#1F2937',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  filterTitle: {
    fontSize: 18,
    fontWeight: '700' as const,
    color: '#F9FAFB',
    marginBottom: 16,
  },
  filterLabel: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: '#D1D5DB',
    marginBottom: 8,
    marginTop: 12,
  },
  tierButtons: {
    flexDirection: 'row',
    gap: 8,
  },
  tierButton: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    backgroundColor: '#374151',
    alignItems: 'center',
  },
  tierButtonActive: {
    backgroundColor: '#3B82F6',
  },
  tierButtonText: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: '#D1D5DB',
  },
  tierButtonTextActive: {
    color: '#FFFFFF',
  },
  input: {
    backgroundColor: '#374151',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    color: '#F9FAFB',
    borderWidth: 1,
    borderColor: '#4B5563',
  },
  optimizeButton: {
    backgroundColor: '#3B82F6',
    borderRadius: 8,
    padding: 16,
    alignItems: 'center',
    marginTop: 16,
  },
  optimizeButtonText: {
    fontSize: 16,
    fontWeight: '700' as const,
    color: '#FFFFFF',
  },
  loadingContainer: {
    padding: 40,
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#9CA3AF',
  },
  recommendationsSection: {
    marginBottom: 16,
  },
  sectionHeaderText: {
    fontSize: 20,
    fontWeight: '700' as const,
    color: '#F9FAFB',
    marginBottom: 16,
  },
  recommendationCard: {
    backgroundColor: '#1F2937',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  strategyBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    marginBottom: 12,
  },
  strategyBadgeText: {
    fontSize: 12,
    fontWeight: '700' as const,
    color: '#FFFFFF',
  },
  recTitle: {
    fontSize: 18,
    fontWeight: '700' as const,
    color: '#F9FAFB',
    marginBottom: 8,
  },
  recDescription: {
    fontSize: 14,
    color: '#D1D5DB',
    marginBottom: 16,
    lineHeight: 20,
  },
  recMetrics: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 16,
  },
  metricItem: {
    flex: 1,
    minWidth: '45%',
    backgroundColor: '#374151',
    borderRadius: 8,
    padding: 12,
    gap: 4,
  },
  metricLabel: {
    fontSize: 12,
    color: '#9CA3AF',
  },
  metricValue: {
    fontSize: 16,
    fontWeight: '700' as const,
    color: '#F9FAFB',
  },
  benefitsSection: {
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '700' as const,
    color: '#10B981',
    marginBottom: 8,
  },
  benefitItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 6,
  },
  benefitText: {
    fontSize: 13,
    color: '#D1D5DB',
    flex: 1,
  },
  warningsSection: {
    marginBottom: 16,
  },
  sectionTitleWarning: {
    fontSize: 14,
    fontWeight: '700' as const,
    color: '#EF4444',
    marginBottom: 8,
  },
  warningItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 6,
  },
  warningText: {
    fontSize: 13,
    color: '#FCA5A5',
    flex: 1,
  },
  cruisesHeader: {
    fontSize: 16,
    fontWeight: '700' as const,
    color: '#F9FAFB',
    marginBottom: 12,
    marginTop: 8,
  },
  cruiseItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    backgroundColor: '#374151',
    borderRadius: 8,
    padding: 12,
    marginBottom: 8,
  },
  cruiseLeft: {
    flex: 1,
    marginRight: 12,
  },
  cruiseShip: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: '#F9FAFB',
    marginBottom: 2,
  },
  cruiseItinerary: {
    fontSize: 12,
    color: '#9CA3AF',
    marginBottom: 2,
  },
  cruiseDate: {
    fontSize: 11,
    color: '#6B7280',
  },
  cruiseRight: {
    alignItems: 'flex-end',
  },
  cruisePoints: {
    fontSize: 13,
    fontWeight: '600' as const,
    color: '#10B981',
    marginBottom: 2,
  },
  cruiseROI: {
    fontSize: 12,
    color: '#3B82F6',
    marginBottom: 2,
  },
  cruiseCost: {
    fontSize: 12,
    color: '#9CA3AF',
  },
  emptyState: {
    padding: 40,
    alignItems: 'center',
  },
  emptyStateText: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: '#9CA3AF',
    textAlign: 'center',
    marginBottom: 8,
  },
  emptyStateSubtext: {
    fontSize: 14,
    color: '#6B7280',
    textAlign: 'center',
  },
});
