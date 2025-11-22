import React from "react";
import {
  ScrollView,
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
  Dimensions,
} from "react-native";
import { Stack } from "expo-router";
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { 
  TrendingUp, 
  TrendingDown,
  DollarSign,
  AlertTriangle,
  CheckCircle,
  Lightbulb,
  BarChart3,
  Calendar,
  Target,
  Zap,
  Award,
  ArrowUp,
  ArrowDown,
  Minus
} from "lucide-react-native";
import { trpc } from '@/lib/trpc';

const { width } = Dimensions.get('window');

interface AnalyticsInsight {
  id: string;
  type: 'trend' | 'opportunity' | 'warning' | 'achievement';
  title: string;
  description: string;
  value?: number;
  change?: number;
  severity: 'low' | 'medium' | 'high';
  actionable: boolean;
  recommendations?: string[];
  createdAt: string;
}



export default function AdvancedAnalyticsScreen() {
  const insets = useSafeAreaInsets();
  const [refreshing, setRefreshing] = React.useState(false);
  const [selectedTimeframe, setSelectedTimeframe] = React.useState<'30d' | '90d' | '6m' | '1y' | 'all'>('1y');
  const [selectedInsightType, setSelectedInsightType] = React.useState<'all' | 'trend' | 'opportunity' | 'warning' | 'achievement'>('all');

  console.log('[AdvancedAnalytics] Component mounted');

  // Get advanced analytics from backend
  const analyticsQuery = trpc.analytics.advancedAnalytics.useQuery({
    timeframe: selectedTimeframe,
    includeProjections: true,
    includeInsights: true
  });

  // Get filtered insights
  const insightsQuery = trpc.analytics.getInsights.useQuery({
    type: selectedInsightType,
    actionableOnly: false,
    limit: 10
  });

  const onRefresh = React.useCallback(async () => {
    console.log('[AdvancedAnalytics] Refreshing analytics');
    setRefreshing(true);
    await Promise.all([
      analyticsQuery.refetch(),
      insightsQuery.refetch()
    ]);
    setRefreshing(false);
  }, [analyticsQuery, insightsQuery]);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const formatPercentage = (value: number) => {
    return `${value >= 0 ? '+' : ''}${value.toFixed(1)}%`;
  };

  const getInsightIcon = (insight: AnalyticsInsight) => {
    const color = getInsightColor(insight);
    
    switch (insight.type) {
      case 'achievement':
        return <Award size={20} color={color} />;
      case 'opportunity':
        return <Lightbulb size={20} color={color} />;
      case 'warning':
        return <AlertTriangle size={20} color={color} />;
      case 'trend':
        return insight.change && insight.change > 0 ? 
          <TrendingUp size={20} color={color} /> : 
          <TrendingDown size={20} color={color} />;
      default:
        return <CheckCircle size={20} color={color} />;
    }
  };

  const getInsightColor = (insight: AnalyticsInsight) => {
    switch (insight.type) {
      case 'achievement':
        return '#22C55E';
      case 'opportunity':
        return '#3B82F6';
      case 'warning':
        return '#EF4444';
      case 'trend':
        return insight.change && insight.change > 0 ? '#22C55E' : '#EF4444';
      default:
        return '#6B7280';
    }
  };

  const getTrendIcon = (change?: number) => {
    if (!change || Math.abs(change) < 0.1) {
      return <Minus size={16} color="#6B7280" />;
    }
    return change > 0 ? 
      <ArrowUp size={16} color="#22C55E" /> : 
      <ArrowDown size={16} color="#EF4444" />;
  };

  if (analyticsQuery.isLoading || insightsQuery.isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#6C5CE7" />
        <Text style={styles.loadingText}>Generating advanced analytics...</Text>
      </View>
    );
  }

  const analytics = analyticsQuery.data?.analytics;
  const insights = insightsQuery.data?.insights || [];

  if (!analytics) {
    return (
      <View style={styles.emptyContainer}>
        <BarChart3 size={64} color="#6B7280" />
        <Text style={styles.emptyTitle}>No Analytics Data</Text>
        <Text style={styles.emptyDescription}>
          Import cruise data to generate advanced analytics and insights.
        </Text>
      </View>
    );
  }

  return (
    <>
      <Stack.Screen 
        options={{
          title: "Advanced Analytics",
          headerBackTitle: "Back"
        }} 
      />
      <ScrollView 
        style={[styles.container, { paddingTop: insets.top }]}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        testID="advanced-analytics-screen"
      >
        {/* Timeframe Selector */}
        <View style={styles.timeframeSection}>
          <Text style={styles.sectionTitle}>📊 Analytics Timeframe</Text>
          <View style={styles.timeframeButtons}>
            {[
              {key: '30d', label: '30 Days'}, 
              {key: '90d', label: '90 Days'}, 
              {key: '6m', label: '6 Months'}, 
              {key: '1y', label: '1 Year'}, 
              {key: 'all', label: 'All Time'}
            ].map((timeframe) => (
              <TouchableOpacity
                key={timeframe.key}
                style={[
                  styles.timeframeButton,
                  selectedTimeframe === timeframe.key && styles.timeframeButtonActive
                ]}
                onPress={() => setSelectedTimeframe(timeframe.key as any)}
                testID={`timeframe-${timeframe.key}`}
              >
                <Text style={[
                  styles.timeframeButtonText,
                  selectedTimeframe === timeframe.key && styles.timeframeButtonTextActive
                ]}>
                  {timeframe.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Key Performance Metrics */}
        <View style={styles.metricsSection}>
          <Text style={styles.sectionTitle}>🎯 Key Performance Metrics</Text>
          <View style={styles.metricsGrid}>
            <View style={styles.metricCard}>
              <DollarSign size={24} color="#22C55E" />
              <Text style={styles.metricValue}>{formatPercentage(analytics.totalROI)}</Text>
              <Text style={styles.metricLabel}>Total ROI</Text>
            </View>
            <View style={styles.metricCard}>
              <TrendingUp size={24} color="#3B82F6" />
              <Text style={styles.metricValue}>{formatCurrency(analytics.totalSavings)}</Text>
              <Text style={styles.metricLabel}>Total Savings</Text>
            </View>
            <View style={styles.metricCard}>
              <Target size={24} color="#F59E0B" />
              <Text style={styles.metricValue}>{analytics.totalCruises}</Text>
              <Text style={styles.metricLabel}>Total Cruises</Text>
            </View>
            <View style={styles.metricCard}>
              <Zap size={24} color="#8B5CF6" />
              <Text style={styles.metricValue}>{formatPercentage(analytics.casinoEfficiency)}</Text>
              <Text style={styles.metricLabel}>Casino Efficiency</Text>
            </View>
          </View>
        </View>

        {/* Trends Section */}
        <View style={styles.trendsSection}>
          <Text style={styles.sectionTitle}>📈 Performance Trends</Text>
          
          {/* ROI Trend */}
          <View style={styles.trendCard}>
            <View style={styles.trendHeader}>
              <Text style={styles.trendTitle}>ROI Trend</Text>
              {getTrendIcon(analytics.roiTrend[analytics.roiTrend.length - 1]?.change)}
            </View>
            <View style={styles.trendData}>
              {analytics.roiTrend.slice(-4).map((trend, index) => (
                <View key={index} style={styles.trendItem}>
                  <Text style={styles.trendPeriod}>{trend.period}</Text>
                  <Text style={styles.trendValue}>{formatPercentage(trend.value)}</Text>
                  {trend.change !== undefined && (
                    <Text style={[
                      styles.trendChange,
                      { color: trend.change >= 0 ? '#22C55E' : '#EF4444' }
                    ]}>
                      {formatPercentage(trend.change)}
                    </Text>
                  )}
                </View>
              ))}
            </View>
          </View>

          {/* Spending Trend */}
          <View style={styles.trendCard}>
            <View style={styles.trendHeader}>
              <Text style={styles.trendTitle}>Spending Trend</Text>
              {getTrendIcon(analytics.spendingTrend[analytics.spendingTrend.length - 1]?.change)}
            </View>
            <View style={styles.trendData}>
              {analytics.spendingTrend.slice(-4).map((trend, index) => (
                <View key={index} style={styles.trendItem}>
                  <Text style={styles.trendPeriod}>{trend.period}</Text>
                  <Text style={styles.trendValue}>{formatCurrency(trend.value)}</Text>
                  {trend.change !== undefined && (
                    <Text style={[
                      styles.trendChange,
                      { color: trend.change >= 0 ? '#EF4444' : '#22C55E' }
                    ]}>
                      {formatPercentage(trend.change)}
                    </Text>
                  )}
                </View>
              ))}
            </View>
          </View>

          {/* Cruise Frequency Trend */}
          <View style={styles.trendCard}>
            <View style={styles.trendHeader}>
              <Text style={styles.trendTitle}>Cruise Frequency</Text>
              {getTrendIcon(analytics.cruiseFrequencyTrend[analytics.cruiseFrequencyTrend.length - 1]?.change)}
            </View>
            <View style={styles.trendData}>
              {analytics.cruiseFrequencyTrend.slice(-4).map((trend, index) => (
                <View key={index} style={styles.trendItem}>
                  <Text style={styles.trendPeriod}>{trend.period}</Text>
                  <Text style={styles.trendValue}>{trend.value}</Text>
                  {trend.change !== undefined && (
                    <Text style={[
                      styles.trendChange,
                      { color: trend.change >= 0 ? '#22C55E' : '#EF4444' }
                    ]}>
                      {formatPercentage(trend.change)}
                    </Text>
                  )}
                </View>
              ))}
            </View>
          </View>
        </View>

        {/* Projections Section */}
        <View style={styles.projectionsSection}>
          <Text style={styles.sectionTitle}>🔮 Projections & Forecasts</Text>
          <View style={styles.projectionsGrid}>
            <View style={styles.projectionCard}>
              <Calendar size={20} color="#3B82F6" />
              <Text style={styles.projectionValue}>{analytics.projectedCruisesPerYear.toFixed(1)}</Text>
              <Text style={styles.projectionLabel}>Projected Cruises/Year</Text>
            </View>
            <View style={styles.projectionCard}>
              <DollarSign size={20} color="#22C55E" />
              <Text style={styles.projectionValue}>{formatCurrency(analytics.projectedAnnualSavings)}</Text>
              <Text style={styles.projectionLabel}>Projected Annual Savings</Text>
            </View>
            <View style={styles.projectionCard}>
              <Target size={20} color="#F59E0B" />
              <Text style={styles.projectionValue}>{formatCurrency(analytics.recommendedBudget)}</Text>
              <Text style={styles.projectionLabel}>Recommended Budget</Text>
            </View>
          </View>
        </View>

        {/* Insights Section */}
        <View style={styles.insightsSection}>
          <View style={styles.insightsHeader}>
            <Text style={styles.sectionTitle}>💡 Smart Insights</Text>
            <View style={styles.insightFilters}>
              {[
                {key: 'all', label: 'All'}, 
                {key: 'warning', label: 'Warnings'}, 
                {key: 'opportunity', label: 'Opportunities'}, 
                {key: 'achievement', label: 'Achievements'}
              ].map((filter) => (
                <TouchableOpacity
                  key={filter.key}
                  style={[
                    styles.insightFilter,
                    selectedInsightType === filter.key && styles.insightFilterActive
                  ]}
                  onPress={() => setSelectedInsightType(filter.key as any)}
                  testID={`insight-filter-${filter.key}`}
                >
                  <Text style={[
                    styles.insightFilterText,
                    selectedInsightType === filter.key && styles.insightFilterTextActive
                  ]}>
                    {filter.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {insights.length > 0 ? (
            insights.map((insight) => (
              <View key={insight.id} style={styles.insightCard}>
                <View style={styles.insightHeader}>
                  {getInsightIcon(insight)}
                  <View style={styles.insightTitleContainer}>
                    <Text style={styles.insightTitle}>{insight.title}</Text>
                    <Text style={[
                      styles.insightSeverity,
                      { 
                        color: insight.severity === 'high' ? '#EF4444' : 
                              insight.severity === 'medium' ? '#F59E0B' : '#6B7280' 
                      }
                    ]}>
                      {insight.severity.toUpperCase()} PRIORITY
                    </Text>
                  </View>
                  {insight.value !== undefined && (
                    <View style={styles.insightValue}>
                      <Text style={styles.insightValueText}>
                        {typeof insight.value === 'number' && insight.value < 100 ? 
                          formatPercentage(insight.value) : 
                          formatCurrency(insight.value || 0)
                        }
                      </Text>
                    </View>
                  )}
                </View>
                
                <Text style={styles.insightDescription}>{insight.description}</Text>
                
                {insight.recommendations && insight.recommendations.length > 0 && (
                  <View style={styles.recommendationsSection}>
                    <Text style={styles.recommendationsTitle}>💡 Recommendations:</Text>
                    {insight.recommendations.map((rec, index) => (
                      <Text key={index} style={styles.recommendationText}>• {rec}</Text>
                    ))}
                  </View>
                )}
                
                {insight.actionable && (
                  <View style={styles.actionableTag}>
                    <Zap size={12} color="#F59E0B" />
                    <Text style={styles.actionableText}>Actionable</Text>
                  </View>
                )}
              </View>
            ))
          ) : (
            <View style={styles.emptyInsights}>
              <Lightbulb size={48} color="#6B7280" />
              <Text style={styles.emptyInsightsTitle}>No Insights Available</Text>
              <Text style={styles.emptyInsightsDescription}>
                {selectedInsightType === 'all' 
                  ? 'No insights generated for the selected timeframe.'
                  : `No ${selectedInsightType} insights found. Try selecting "All" to see other types.`
                }
              </Text>
            </View>
          )}
        </View>

        {/* Cruise Preferences Analysis */}
        <View style={styles.preferencesSection}>
          <Text style={styles.sectionTitle}>🏖️ Cruise Preferences Analysis</Text>
          
          {/* Preferred Cabin Types */}
          <View style={styles.preferenceCard}>
            <Text style={styles.preferenceTitle}>Preferred Cabin Types</Text>
            <View style={styles.preferenceItems}>
              {Object.entries(analytics.preferredCabinTypes)
                .sort(([,a], [,b]) => (b as number) - (a as number))
                .slice(0, 3)
                .map(([cabinType, count]) => (
                  <View key={cabinType} style={styles.preferenceItem}>
                    <Text style={styles.preferenceItemLabel}>{cabinType}</Text>
                    <Text style={styles.preferenceItemValue}>{count} cruises</Text>
                  </View>
                ))}
            </View>
          </View>

          {/* Preferred Ports */}
          <View style={styles.preferenceCard}>
            <Text style={styles.preferenceTitle}>Preferred Departure Ports</Text>
            <View style={styles.preferenceItems}>
              {Object.entries(analytics.preferredPorts)
                .sort(([,a], [,b]) => (b as number) - (a as number))
                .slice(0, 3)
                .map(([port, count]) => (
                  <View key={port} style={styles.preferenceItem}>
                    <Text style={styles.preferenceItemLabel}>{port}</Text>
                    <Text style={styles.preferenceItemValue}>{count} cruises</Text>
                  </View>
                ))}
            </View>
          </View>

          {/* Average Cruise Length */}
          <View style={styles.preferenceCard}>
            <Text style={styles.preferenceTitle}>Average Cruise Length</Text>
            <View style={styles.preferenceHighlight}>
              <Text style={styles.preferenceHighlightValue}>{analytics.averageNights.toFixed(1)} nights</Text>
              <Text style={styles.preferenceHighlightLabel}>per cruise</Text>
            </View>
          </View>
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
  emptyContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 32,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: "600",
    color: "#111827",
    marginTop: 16,
  },
  emptyDescription: {
    fontSize: 14,
    color: "#6B7280",
    textAlign: "center",
    marginTop: 8,
    lineHeight: 20,
  },
  timeframeSection: {
    backgroundColor: "#FFFFFF",
    margin: 16,
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
  timeframeButtons: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  timeframeButton: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: "#F3F4F6",
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  timeframeButtonActive: {
    backgroundColor: "#6C5CE7",
    borderColor: "#6C5CE7",
  },
  timeframeButtonText: {
    fontSize: 12,
    color: "#6B7280",
    fontWeight: "500",
  },
  timeframeButtonTextActive: {
    color: "#FFFFFF",
  },
  metricsSection: {
    backgroundColor: "#FFFFFF",
    margin: 16,
    marginTop: 0,
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  metricsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
  },
  metricCard: {
    flex: 1,
    minWidth: (width - 64) / 2,
    backgroundColor: "#F8FAFC",
    borderRadius: 8,
    padding: 16,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  metricValue: {
    fontSize: 20,
    fontWeight: "700",
    color: "#111827",
    marginTop: 8,
  },
  metricLabel: {
    fontSize: 12,
    color: "#6B7280",
    marginTop: 4,
    textAlign: "center",
  },
  trendsSection: {
    margin: 16,
    marginTop: 0,
  },
  trendCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  trendHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  trendTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "#111827",
  },
  trendData: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  trendItem: {
    flex: 1,
    alignItems: "center",
  },
  trendPeriod: {
    fontSize: 10,
    color: "#6B7280",
    marginBottom: 4,
  },
  trendValue: {
    fontSize: 14,
    fontWeight: "600",
    color: "#111827",
  },
  trendChange: {
    fontSize: 10,
    marginTop: 2,
  },
  projectionsSection: {
    backgroundColor: "#FFFFFF",
    margin: 16,
    marginTop: 0,
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  projectionsGrid: {
    flexDirection: "row",
    gap: 12,
  },
  projectionCard: {
    flex: 1,
    backgroundColor: "#F8FAFC",
    borderRadius: 8,
    padding: 12,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  projectionValue: {
    fontSize: 16,
    fontWeight: "600",
    color: "#111827",
    marginTop: 8,
    textAlign: "center",
  },
  projectionLabel: {
    fontSize: 10,
    color: "#6B7280",
    marginTop: 4,
    textAlign: "center",
  },
  insightsSection: {
    margin: 16,
    marginTop: 0,
  },
  insightsHeader: {
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  insightFilters: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 12,
  },
  insightFilter: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: "#F3F4F6",
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  insightFilterActive: {
    backgroundColor: "#3B82F6",
    borderColor: "#3B82F6",
  },
  insightFilterText: {
    fontSize: 11,
    color: "#6B7280",
    fontWeight: "500",
  },
  insightFilterTextActive: {
    color: "#FFFFFF",
  },
  insightCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  insightHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginBottom: 12,
  },
  insightTitleContainer: {
    flex: 1,
    marginLeft: 12,
  },
  insightTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "#111827",
  },
  insightSeverity: {
    fontSize: 10,
    fontWeight: "600",
    marginTop: 2,
  },
  insightValue: {
    backgroundColor: "#F3F4F6",
    borderRadius: 6,
    padding: 8,
    minWidth: 60,
    alignItems: "center",
  },
  insightValueText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#6C5CE7",
  },
  insightDescription: {
    fontSize: 14,
    color: "#374151",
    lineHeight: 20,
    marginBottom: 12,
  },
  recommendationsSection: {
    backgroundColor: "#FEF3C7",
    borderRadius: 8,
    padding: 12,
    marginBottom: 8,
  },
  recommendationsTitle: {
    fontSize: 12,
    fontWeight: "600",
    color: "#92400E",
    marginBottom: 6,
  },
  recommendationText: {
    fontSize: 12,
    color: "#92400E",
    marginBottom: 2,
  },
  actionableTag: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    backgroundColor: "#FEF3C7",
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 4,
    gap: 4,
  },
  actionableText: {
    fontSize: 10,
    color: "#92400E",
    fontWeight: "600",
  },
  emptyInsights: {
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    padding: 32,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  emptyInsightsTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "#111827",
    marginTop: 12,
  },
  emptyInsightsDescription: {
    fontSize: 14,
    color: "#6B7280",
    textAlign: "center",
    marginTop: 8,
    lineHeight: 20,
  },
  preferencesSection: {
    margin: 16,
    marginTop: 0,
  },
  preferenceCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  preferenceTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "#111827",
    marginBottom: 12,
  },
  preferenceItems: {
    gap: 8,
  },
  preferenceItem: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: "#F3F4F6",
  },
  preferenceItemLabel: {
    fontSize: 14,
    color: "#374151",
  },
  preferenceItemValue: {
    fontSize: 14,
    fontWeight: "600",
    color: "#6C5CE7",
  },
  preferenceHighlight: {
    alignItems: "center",
    backgroundColor: "#F8FAFC",
    borderRadius: 8,
    padding: 16,
  },
  preferenceHighlightValue: {
    fontSize: 24,
    fontWeight: "700",
    color: "#6C5CE7",
  },
  preferenceHighlightLabel: {
    fontSize: 12,
    color: "#6B7280",
    marginTop: 4,
  },
});