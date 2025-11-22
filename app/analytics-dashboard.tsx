import React, { useState, useCallback, useMemo } from 'react';
import { View, Text, ScrollView, StyleSheet, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack } from 'expo-router';
import { trpc } from '@/lib/trpc';
import { ThemedCard } from '@/components/ui/ThemedCard';
import { Badge } from '@/components/ui/Badge';
import { PerformanceMetrics } from '@/components/PerformanceMetrics';
import { 
  TrendingUp, 
  Shield, 
  Trophy, 
  BarChart3, 
  Brain,
  Zap,
  Star
} from 'lucide-react-native';

type AnalyticsSection = 'overview' | 'rankings' | 'insights' | 'ai';

export default function AnalyticsDashboard() {
  const [activeSection, setActiveSection] = useState<AnalyticsSection>('overview');
  const [refreshing, setRefreshing] = useState(false);

  // Optimized queries with proper error handling
  const topROIQuery = trpc.analytics.topRoiCruises.useQuery({ limit: 5 });
  const pointsQuery = trpc.analytics.pointsLeaderboards.useQuery({ limit: 5 });
  const riskQuery = trpc.analytics.riskRankings.useQuery({ limit: 5 });
  const casinoQuery = trpc.analytics.casinoPerformanceLists.useQuery({ limit: 5 });
  const portfolioQuery = trpc.analytics.getPortfolioOptimization.useQuery();
  const overviewQuery = trpc.analytics.getOverviewStats.useQuery();

  // Memoized data processing
  const performanceData = useMemo(() => {
    if (!topROIQuery.data?.items || topROIQuery.data.items.length === 0) {
      return {
        totalCruises: 0,
        averageROI: 0,
        totalSavings: 0,
        bestROI: 0,
        worstROI: 0,
      };
    }

    const items = topROIQuery.data.items;
    const totalSavings = items.reduce((sum, item) => sum + item.savings, 0);
    const averageROI = items.reduce((sum, item) => sum + item.roi, 0) / items.length;
    const bestROI = Math.max(...items.map(item => item.roi));
    const worstROI = Math.min(...items.map(item => item.roi));

    return {
      totalCruises: items.length,
      averageROI,
      totalSavings,
      bestROI,
      worstROI,
    };
  }, [topROIQuery.data]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await Promise.all([
        topROIQuery.refetch(),
        pointsQuery.refetch(),
        riskQuery.refetch(),
        casinoQuery.refetch(),
        portfolioQuery.refetch(),
        overviewQuery.refetch(),
      ]);
    } finally {
      setRefreshing(false);
    }
  }, [topROIQuery, pointsQuery, riskQuery, casinoQuery, portfolioQuery, overviewQuery]);

  const renderSectionButton = useCallback((
    section: AnalyticsSection,
    icon: React.ReactNode,
    label: string,
    count?: number
  ) => {
    if (!section?.trim() || section.length > 20) return null;
    const sanitizedSection = section.trim();
    
    return (
      <TouchableOpacity
        key={sanitizedSection}
        style={[styles.sectionButton, activeSection === sanitizedSection && styles.activeSectionButton]}
        onPress={() => setActiveSection(sanitizedSection as AnalyticsSection)}
      >
        <View style={styles.sectionButtonContent}>
          <View style={styles.iconWrapper}>{icon}</View>
          <Text style={[styles.sectionButtonText, activeSection === sanitizedSection && styles.activeSectionButtonText]}>
            {label}
          </Text>
          {count !== undefined && (
            <Badge label={count.toString()} />
          )}
        </View>
      </TouchableOpacity>
    );
  }, [activeSection]);

  const renderOverview = useCallback(() => (
    <ScrollView style={styles.contentContainer}>
      <PerformanceMetrics 
        data={performanceData}
        isLoading={topROIQuery.isLoading}
      />
      
      {overviewQuery.data && (
        <ThemedCard style={styles.summaryCard}>
          <Text style={styles.cardTitle}>Portfolio Summary</Text>
          <View style={styles.summaryGrid}>
            <View style={styles.summaryItem}>
              <Text style={styles.summaryValue}>{overviewQuery.data.totalCruises}</Text>
              <Text style={styles.summaryLabel}>Total Cruises</Text>
            </View>
            <View style={styles.summaryItem}>
              <Text style={styles.summaryValue}>{overviewQuery.data.bookedCruises}</Text>
              <Text style={styles.summaryLabel}>Booked</Text>
            </View>
            <View style={styles.summaryItem}>
              <Text style={styles.summaryValue}>{overviewQuery.data.upcomingCruises}</Text>
              <Text style={styles.summaryLabel}>Upcoming</Text>
            </View>
            <View style={styles.summaryItem}>
              <Text style={styles.summaryValue}>{overviewQuery.data.userPoints.toLocaleString()}</Text>
              <Text style={styles.summaryLabel}>Points</Text>
            </View>
          </View>
        </ThemedCard>
      )}
    </ScrollView>
  ), [performanceData, topROIQuery.isLoading, overviewQuery.data]);

  const renderRankings = useCallback(() => (
    <ScrollView style={styles.contentContainer}>
      {/* Top ROI Cruises */}
      <ThemedCard style={styles.rankingCard}>
        <View style={styles.rankingHeader}>
          <Trophy size={20} color="#FFD700" />
          <Text style={styles.rankingTitle}>Top ROI Cruises</Text>
        </View>
        {topROIQuery.data?.items.slice(0, 3).map((cruise, index) => (
          <View key={cruise.cruiseId} style={styles.rankingItem}>
            <View style={styles.rankingPosition}>
              <Text style={styles.positionText}>{index + 1}</Text>
            </View>
            <View style={styles.rankingDetails}>
              <Text style={styles.rankingShip}>{cruise.ship}</Text>
              <Text style={styles.rankingDate}>{cruise.departureDate}</Text>
            </View>
            <View style={styles.rankingMetric}>
              <Text style={styles.rankingValue}>{cruise.roi.toFixed(1)}%</Text>
              <Text style={styles.rankingLabel}>ROI</Text>
            </View>
          </View>
        ))}
      </ThemedCard>

      {/* Points Leaders */}
      <ThemedCard style={styles.rankingCard}>
        <View style={styles.rankingHeader}>
          <Star size={20} color="#007AFF" />
          <Text style={styles.rankingTitle}>Points Leaders</Text>
        </View>
        {pointsQuery.data?.mostPoints.slice(0, 3).map((cruise, index) => (
          <View key={cruise.cruiseId} style={styles.rankingItem}>
            <View style={styles.rankingPosition}>
              <Text style={styles.positionText}>{index + 1}</Text>
            </View>
            <View style={styles.rankingDetails}>
              <Text style={styles.rankingShip}>{cruise.ship}</Text>
              <Text style={styles.rankingDate}>{cruise.departureDate}</Text>
            </View>
            <View style={styles.rankingMetric}>
              <Text style={styles.rankingValue}>{cruise.points.toLocaleString()}</Text>
              <Text style={styles.rankingLabel}>Points</Text>
            </View>
          </View>
        ))}
      </ThemedCard>

      {/* Risk Rankings */}
      <ThemedCard style={styles.rankingCard}>
        <View style={styles.rankingHeader}>
          <Shield size={20} color="#34C759" />
          <Text style={styles.rankingTitle}>Lowest Risk</Text>
        </View>
        {riskQuery.data?.lowestOutOfPocket.slice(0, 3).map((cruise, index) => (
          <View key={cruise.cruiseId} style={styles.rankingItem}>
            <View style={styles.rankingPosition}>
              <Text style={styles.positionText}>{index + 1}</Text>
            </View>
            <View style={styles.rankingDetails}>
              <Text style={styles.rankingShip}>{cruise.ship}</Text>
              <Text style={styles.rankingDate}>{cruise.departureDate}</Text>
            </View>
            <View style={styles.rankingMetric}>
              <Text style={styles.rankingValue}>${cruise.outOfPocket.toLocaleString()}</Text>
              <Text style={styles.rankingLabel}>Out-of-Pocket</Text>
            </View>
          </View>
        ))}
      </ThemedCard>
    </ScrollView>
  ), [topROIQuery.data, pointsQuery.data, riskQuery.data]);

  const renderInsights = useCallback(() => (
    <ScrollView style={styles.contentContainer}>
      <ThemedCard style={styles.insightCard}>
        <View style={styles.insightHeader}>
          <BarChart3 size={24} color="#FF9500" />
          <Text style={styles.insightTitle}>Performance Insights</Text>
        </View>
        
        {pointsQuery.data?.invariant && (
          <View style={styles.insightItem}>
            <View style={[styles.insightIndicator, { 
              backgroundColor: pointsQuery.data.invariant.ok ? '#34C759' : '#FF3B30' 
            }]} />
            <Text style={styles.insightText}>{pointsQuery.data.invariant.message}</Text>
          </View>
        )}
        
        {portfolioQuery.data?.suggestions.slice(0, 3).map((suggestion: string, index: number) => (
          <View key={`insight-${index}`} style={styles.insightItem}>
            <View style={[styles.insightIndicator, { backgroundColor: '#007AFF' }]} />
            <Text style={styles.insightText}>{suggestion}</Text>
          </View>
        ))}
      </ThemedCard>
    </ScrollView>
  ), [pointsQuery.data, portfolioQuery.data]);

  const renderAI = useCallback(() => (
    <ScrollView style={styles.contentContainer}>
      <ThemedCard style={styles.aiCard}>
        <View style={styles.aiHeader}>
          <Brain size={24} color="#5856D6" />
          <Text style={styles.aiTitle}>AI-Powered Analytics</Text>
          <Badge label="Beta" />
        </View>
        
        <Text style={styles.aiDescription}>
          Get personalized insights and recommendations powered by artificial intelligence.
        </Text>
        
        <TouchableOpacity 
          style={styles.aiButton}
          onPress={() => {
            // Navigate to AI insights screen
          }}
        >
          <Zap size={20} color="#FFFFFF" />
          <Text style={styles.aiButtonText}>View AI Insights</Text>
        </TouchableOpacity>
      </ThemedCard>
    </ScrollView>
  ), []);

  const renderContent = useCallback(() => {
    switch (activeSection) {
      case 'overview':
        return renderOverview();
      case 'rankings':
        return renderRankings();
      case 'insights':
        return renderInsights();
      case 'ai':
        return renderAI();
      default:
        return renderOverview();
    }
  }, [activeSection, renderOverview, renderRankings, renderInsights, renderAI]);

  return (
    <SafeAreaView style={styles.container}>
      <Stack.Screen 
        options={{
          title: 'Analytics Dashboard',
          headerStyle: { backgroundColor: '#FFFFFF' },
          headerTitleStyle: { color: '#1C1C1E', fontWeight: '600' },
        }} 
      />
      
      <View style={styles.sectionContainer}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.sectionScroll}>
          {renderSectionButton('overview', <TrendingUp size={20} color={activeSection === 'overview' ? '#007AFF' : '#8E8E93'} />, 'Overview')}
          {renderSectionButton('rankings', <Trophy size={20} color={activeSection === 'rankings' ? '#007AFF' : '#8E8E93'} />, 'Rankings', topROIQuery.data?.count)}
          {renderSectionButton('insights', <BarChart3 size={20} color={activeSection === 'insights' ? '#007AFF' : '#8E8E93'} />, 'Insights')}
          {renderSectionButton('ai', <Brain size={20} color={activeSection === 'ai' ? '#007AFF' : '#8E8E93'} />, 'AI')}
        </ScrollView>
      </View>
      
      <ScrollView style={styles.scrollContainer}>
        <TouchableOpacity style={styles.refreshButton} onPress={onRefresh}>
          <Text style={styles.refreshText}>
            {refreshing ? 'Refreshing...' : 'Pull to refresh'}
          </Text>
        </TouchableOpacity>
        {renderContent()}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F2F2F7',
  },
  sectionContainer: {
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E5EA',
  },
  sectionScroll: {
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  sectionButton: {
    marginRight: 16,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#F2F2F7',
  },
  activeSectionButton: {
    backgroundColor: '#007AFF',
  },
  sectionButtonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  sectionButtonText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#8E8E93',
  },
  activeSectionButtonText: {
    color: '#FFFFFF',
  },
  scrollContainer: {
    flex: 1,
  },
  contentContainer: {
    padding: 16,
  },
  summaryCard: {
    padding: 20,
    marginBottom: 16,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1C1C1E',
    marginBottom: 16,
  },
  summaryGrid: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  summaryItem: {
    alignItems: 'center',
  },
  summaryValue: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1C1C1E',
  },
  summaryLabel: {
    fontSize: 12,
    color: '#8E8E93',
    marginTop: 4,
  },
  rankingCard: {
    padding: 20,
    marginBottom: 16,
  },
  rankingHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  rankingTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1C1C1E',
    marginLeft: 8,
  },
  rankingItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F2F2F7',
  },
  rankingPosition: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#007AFF',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  positionText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  rankingDetails: {
    flex: 1,
  },
  rankingShip: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1C1C1E',
  },
  rankingDate: {
    fontSize: 12,
    color: '#8E8E93',
    marginTop: 2,
  },
  rankingMetric: {
    alignItems: 'flex-end',
  },
  rankingValue: {
    fontSize: 16,
    fontWeight: '700',
    color: '#007AFF',
  },
  rankingLabel: {
    fontSize: 10,
    color: '#8E8E93',
    marginTop: 2,
  },
  insightCard: {
    padding: 20,
    marginBottom: 16,
  },
  insightHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  insightTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1C1C1E',
    marginLeft: 8,
  },
  insightItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  insightIndicator: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginTop: 6,
    marginRight: 12,
  },
  insightText: {
    fontSize: 14,
    color: '#1C1C1E',
    flex: 1,
    lineHeight: 20,
  },
  aiCard: {
    padding: 20,
    marginBottom: 16,
    alignItems: 'center',
  },
  aiHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  aiTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1C1C1E',
    marginLeft: 8,
    marginRight: 8,
  },
  aiDescription: {
    fontSize: 14,
    color: '#8E8E93',
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 20,
  },
  aiButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#5856D6',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 25,
  },
  aiButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
    marginLeft: 8,
  },
  iconWrapper: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  refreshButton: {
    padding: 16,
    alignItems: 'center',
    backgroundColor: '#F2F2F7',
    marginHorizontal: 16,
    marginTop: 8,
    borderRadius: 8,
  },
  refreshText: {
    fontSize: 14,
    color: '#007AFF',
    fontWeight: '500',
  },
});