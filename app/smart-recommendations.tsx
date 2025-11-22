import React from "react";
import {
  ScrollView,
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
} from "react-native";
import { Stack } from "expo-router";
import { 
  TrendingUp, 
  DollarSign,
  AlertTriangle,
  Sparkles
} from "lucide-react-native";
import { trpc } from '@/lib/trpc';
import { CruiseCard } from '@/components/CruiseCard';

interface SmartAnalysis {
  cruiseId: string;
  ship: string;
  itinerary: string;
  departureDate: string;
  nights: number;
  departurePort: string;
  
  // Preference Scoring
  preferenceScore: number;
  cabinTypeScore: number;
  lengthScore: number;
  portScore: number;
  
  // Financial Analysis
  estimatedROI: number;
  outOfPocketCost: number;
  totalValue: number;
  coinInRequired: number;
  
  // Offer Analysis
  bestOffer?: {
    offerCode: string;
    offerType: string;
    cabinType: string;
    pointsRequired: number;
    freePlayValue: number;
  };
  
  // Scheduling
  hasConflicts: boolean;
  conflictDetails?: string[];
  
  // Distance & Travel
  estimatedTravelCost: number;
  travelDistance: number;
  
  // Overall Recommendation
  recommendationScore: number;
  recommendation: 'highly_recommended' | 'recommended' | 'consider' | 'not_recommended';
  reasons: string[];
}

export default function SmartRecommendationsScreen() {
  const [refreshing, setRefreshing] = React.useState(false);
  const [selectedFilter, setSelectedFilter] = React.useState<'all' | 'highly_recommended' | 'recommended'>('all');
  const [minScore] = React.useState(60);

  console.log('[SmartRecommendations] Component mounted');

  // Get smart recommendations from backend
  const recommendationsQuery = trpc.cruises.getRecommendations.useQuery({
    limit: 20,
    minScore: selectedFilter === 'highly_recommended' ? 80 : selectedFilter === 'recommended' ? 60 : minScore
  });

  // Get full smart analysis for detailed view
  const smartAnalysisQuery = trpc.cruises.smartAnalysis.useQuery({
    limit: 50
  });

  const onRefresh = React.useCallback(async () => {
    console.log('[SmartRecommendations] Refreshing recommendations');
    setRefreshing(true);
    await Promise.all([
      recommendationsQuery.refetch(),
      smartAnalysisQuery.refetch()
    ]);
    setRefreshing(false);
  }, [recommendationsQuery, smartAnalysisQuery]);

  const getRecommendationColor = (recommendation: SmartAnalysis['recommendation']) => {
    switch (recommendation) {
      case 'highly_recommended':
        return '#22C55E';
      case 'recommended':
        return '#3B82F6';
      case 'consider':
        return '#F59E0B';
      case 'not_recommended':
        return '#EF4444';
      default:
        return '#6B7280';
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  if (recommendationsQuery.isLoading || smartAnalysisQuery.isLoading) {
    return (
      <>
        <Stack.Screen 
          options={{
            title: "Smart Recommendations",
            headerBackTitle: "Back"
          }} 
        />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#6C5CE7" />
          <Text style={styles.loadingText}>Analyzing cruise recommendations...</Text>
        </View>
      </>
    );
  }

  if (recommendationsQuery.error || smartAnalysisQuery.error) {
    return (
      <>
        <Stack.Screen 
          options={{
            title: "Smart Recommendations",
            headerBackTitle: "Back"
          }} 
        />
        <View style={styles.loadingContainer}>
          <Text style={styles.emptyTitle}>Error Loading Recommendations</Text>
          <Text style={styles.emptyDescription}>
            {recommendationsQuery.error?.message || smartAnalysisQuery.error?.message || 'Unknown error occurred'}
          </Text>
          <TouchableOpacity 
            style={styles.retryButton}
            onPress={() => {
              recommendationsQuery.refetch();
              smartAnalysisQuery.refetch();
            }}
          >
            <Text style={styles.retryButtonText}>Retry</Text>
          </TouchableOpacity>
        </View>
      </>
    );
  }

  const recommendations = recommendationsQuery.data?.recommendations || [];
  const summary = recommendationsQuery.data?.summary;
  const analysisData = smartAnalysisQuery.data;

  return (
    <>
      <Stack.Screen 
        options={{
          title: "Smart Recommendations",
          headerBackTitle: "Back"
        }} 
      />
      <ScrollView 
        style={styles.container}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        testID="smart-recommendations-screen"
      >
        {/* Header Stats */}
        <View style={styles.headerStats}>
          <View style={styles.statCard}>
            <Sparkles size={24} color="#6C5CE7" />
            <Text style={styles.statNumber}>{summary?.qualifyingRecommendations || 0}</Text>
            <Text style={styles.statLabel}>Qualified Cruises</Text>
          </View>
          <View style={styles.statCard}>
            <TrendingUp size={24} color="#22C55E" />
            <Text style={styles.statNumber}>{summary?.averageScore?.toFixed(0) || 0}</Text>
            <Text style={styles.statLabel}>Avg Score</Text>
          </View>
          <View style={styles.statCard}>
            <DollarSign size={24} color="#F59E0B" />
            <Text style={styles.statNumber}>
              {analysisData?.summary?.averageROI?.toFixed(0) || 0}%
            </Text>
            <Text style={styles.statLabel}>Avg ROI</Text>
          </View>
        </View>

        {/* Filters */}
        <View style={styles.filtersSection}>
          <View style={styles.filterRow}>
            <Text style={styles.filterLabel}>🎯 Recommendation Level</Text>
            <View style={styles.filterButtons}>
              {[
                {key: 'all', label: 'All', color: '#6B7280'}, 
                {key: 'highly_recommended', label: 'Highly Recommended', color: '#22C55E'}, 
                {key: 'recommended', label: 'Recommended', color: '#3B82F6'}
              ].map((filter) => (
                <TouchableOpacity
                  key={filter.key}
                  style={[
                    styles.filterButton,
                    selectedFilter === filter.key && { backgroundColor: filter.color, borderColor: filter.color }
                  ]}
                  onPress={() => setSelectedFilter(filter.key as 'all' | 'highly_recommended' | 'recommended')}
                  testID={`filter-${filter.key}`}
                >
                  <Text style={[
                    styles.filterButtonText,
                    selectedFilter === filter.key && styles.filterButtonTextActive
                  ]}>
                    {filter.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </View>

        {/* Analysis Summary */}
        {analysisData && (
          <View style={styles.summarySection}>
            <Text style={styles.sectionTitle}>Analysis Summary</Text>
            <View style={styles.summaryGrid}>
              <View style={styles.summaryItem}>
                <Text style={styles.summaryNumber}>{analysisData.summary.totalAnalyzed}</Text>
                <Text style={styles.summaryLabel}>Cruises Analyzed</Text>
              </View>
              <View style={styles.summaryItem}>
                <Text style={styles.summaryNumber}>{analysisData.summary.highlyRecommended}</Text>
                <Text style={styles.summaryLabel}>Highly Recommended</Text>
              </View>
              <View style={styles.summaryItem}>
                <Text style={styles.summaryNumber}>{analysisData.summary.conflictsDetected}</Text>
                <Text style={styles.summaryLabel}>Schedule Conflicts</Text>
              </View>
              <View style={styles.summaryItem}>
                <Text style={styles.summaryNumber}>{formatCurrency(analysisData.summary.averageOutOfPocket)}</Text>
                <Text style={styles.summaryLabel}>Avg Out of Pocket</Text>
              </View>
            </View>
          </View>
        )}

        {/* Recommendations List */}
        <View style={styles.recommendationsSection}>
          <Text style={styles.sectionTitle}>Smart Recommendations</Text>
          
          {recommendations.length > 0 ? (
            <View style={styles.recommendationsList}>
              {recommendations.map((recommendation: SmartAnalysis) => {
                const mappedCruise: any = {
                  id: recommendation.cruiseId,
                  ship: recommendation.ship,
                  itineraryName: recommendation.itinerary,
                  departureDate: recommendation.departureDate,
                  nights: recommendation.nights,
                  departurePort: recommendation.departurePort,
                  cabinType: recommendation.bestOffer?.cabinType ?? undefined,
                  offerCode: recommendation.bestOffer?.offerCode ?? undefined,
                  value: recommendation.bestOffer?.freePlayValue ? `${recommendation.bestOffer.freePlayValue.toLocaleString()} Free Play` : undefined,
                };
                return (
                  <View key={recommendation.cruiseId}>
                    <CruiseCard
                      cruise={mappedCruise}
                      onPress={() => {
                        console.log(`[SmartRecommendations] Open cruise ${recommendation.cruiseId}`);
                      }}
                    />
                    {recommendation.hasConflicts && (
                      <View style={styles.conflictWarning}>
                        <AlertTriangle size={14} color="#EF4444" />
                        <Text style={styles.conflictText}>
                          {recommendation.conflictDetails?.length || 0} conflicts
                        </Text>
                      </View>
                    )}
                  </View>
                );
              })}
            </View>
          ) : (
            <View style={styles.emptyState}>
              <Sparkles size={48} color="#6B7280" />
              <Text style={styles.emptyTitle}>No recommendations found</Text>
              <Text style={styles.emptyDescription}>
                {selectedFilter === 'highly_recommended' 
                  ? 'No cruises meet the highly recommended criteria. Try lowering the filter level.'
                  : selectedFilter === 'recommended'
                  ? 'No cruises meet the recommended criteria. Try viewing all recommendations.'
                  : 'No cruise recommendations available at this time. Check back after importing cruise data.'
                }
              </Text>
            </View>
          )}
        </View>
      </ScrollView>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F8FAFC",
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: "#6B7280",
    textAlign: "center",
  },
  headerStats: {
    flexDirection: "row",
    padding: 16,
    gap: 12,
  },
  statCard: {
    flex: 1,
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    padding: 16,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  statNumber: {
    fontSize: 24,
    fontWeight: "700",
    color: "#111827",
    marginTop: 8,
  },
  statLabel: {
    fontSize: 12,
    color: "#6B7280",
    marginTop: 4,
    textAlign: "center",
  },
  filtersSection: {
    backgroundColor: "#FFFFFF",
    margin: 16,
    marginTop: 0,
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  filterRow: {
    marginBottom: 8,
  },
  filterLabel: {
    fontSize: 14,
    fontWeight: "600",
    color: "#374151",
    marginBottom: 8,
  },
  filterButtons: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  filterButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: "#F3F4F6",
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  filterButtonText: {
    fontSize: 12,
    color: "#6B7280",
    fontWeight: "500",
  },
  filterButtonTextActive: {
    color: "#FFFFFF",
  },
  summarySection: {
    backgroundColor: "#FFFFFF",
    margin: 16,
    marginTop: 0,
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: "#111827",
    marginBottom: 16,
  },
  summaryGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 16,
  },
  summaryItem: {
    flex: 1,
    minWidth: "45%",
    alignItems: "center",
  },
  summaryNumber: {
    fontSize: 20,
    fontWeight: "700",
    color: "#6C5CE7",
  },
  summaryLabel: {
    fontSize: 12,
    color: "#6B7280",
    marginTop: 4,
    textAlign: "center",
  },
  recommendationsSection: {
    padding: 16,
    paddingTop: 0,
  },
  recommendationsList: {
    gap: 12,
  },
  recommendationCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
  },
  recommendationBadge: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: "700",
    color: "#FFFFFF",
    letterSpacing: 0.5,
  },
  scoreContainer: {
    flexDirection: "row",
    alignItems: "center",
  },
  scoreLabel: {
    fontSize: 12,
    color: "#6B7280",
    fontWeight: "500",
  },
  scoreNumber: {
    fontSize: 16,
    fontWeight: "700",
    color: "#6C5CE7",
  },
  shipIconContainer: {
    alignItems: "center",
    marginBottom: 12,
  },
  shipIcon: {
    fontSize: 48,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#111827",
    textAlign: "center",
    marginBottom: 4,
  },
  cardSubtitle: {
    fontSize: 13,
    color: "#6B7280",
    textAlign: "center",
    marginBottom: 16,
  },
  cardDetails: {
    gap: 8,
    marginBottom: 12,
  },
  detailRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
  },
  detailText: {
    fontSize: 13,
    color: "#374151",
  },
  metricsRow: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 12,
  },
  metricPill: {
    flex: 1,
    backgroundColor: "#F3F4F6",
    borderRadius: 8,
    padding: 8,
    alignItems: "center",
  },
  metricPillLabel: {
    fontSize: 10,
    color: "#6B7280",
    marginBottom: 2,
    textAlign: "center",
  },
  metricPillValue: {
    fontSize: 12,
    fontWeight: "700",
    color: "#6C5CE7",
  },
  offerSection: {
    backgroundColor: "#FEF3C7",
    borderRadius: 8,
    padding: 10,
    marginBottom: 8,
    alignItems: "center",
  },
  offerTitle: {
    fontSize: 13,
    fontWeight: "600",
    color: "#92400E",
    marginBottom: 2,
  },
  offerDetails: {
    fontSize: 12,
    color: "#92400E",
  },
  conflictWarning: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    backgroundColor: "#FEF2F2",
    borderRadius: 8,
    padding: 8,
  },
  conflictText: {
    fontSize: 11,
    color: "#DC2626",
    fontWeight: "600",
  },
  emptyState: {
    alignItems: "center",
    padding: 32,
    gap: 12,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: "#111827",
  },
  emptyDescription: {
    fontSize: 14,
    color: "#6B7280",
    textAlign: "center",
    lineHeight: 20,
  },
  retryButton: {
    backgroundColor: "#6366F1",
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
    marginTop: 16,
  },
  retryButtonText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "600",
  },
});