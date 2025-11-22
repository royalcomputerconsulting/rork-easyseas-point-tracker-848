import React, { useState } from 'react';
import { View, Text, ScrollView, StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack } from 'expo-router';
import { trpc } from '@/lib/trpc';
import { ThemedCard } from '@/components/ui/ThemedCard';
import { Badge } from '@/components/ui/Badge';
import { Brain, TrendingUp, Shield, Target, Lightbulb, RefreshCw } from 'lucide-react-native';

type TabType = 'portfolio' | 'risk' | 'tier' | 'narrative';

export default function AIInsightsScreen() {
  const [activeTab, setActiveTab] = useState<TabType>('portfolio');
  const [selectedCruiseId, setSelectedCruiseId] = useState<string>('');
  
  // AI Analytics Queries
  const portfolioQuery = trpc.analytics.getPortfolioOptimization.useQuery();
  const riskQuery = trpc.analytics.getRiskManagementInsights.useQuery();
  const tierQuery = trpc.analytics.getTierAdvancementRecommendations.useQuery();
  const narrativeQuery = trpc.analytics.getAICruiseNarrative.useQuery(
    { cruiseId: selectedCruiseId },
    { enabled: !!selectedCruiseId }
  );
  
  // Get available cruises for narrative selection
  const cruisesQuery = trpc.analytics.getAllCasinoAnalytics.useQuery();
  const cruiseDataQuery = trpc.cruises.list.useQuery({ limit: 100 });
  
  const handleRefresh = () => {
    portfolioQuery.refetch();
    riskQuery.refetch();
    tierQuery.refetch();
    if (selectedCruiseId) {
      narrativeQuery.refetch();
    }
  };
  
  const renderTabButton = (tab: TabType, icon: React.ReactNode, label: string) => {
    if (!tab?.trim() || tab.length > 20) return null;
    const sanitizedTab = tab.trim();
    
    return (
      <TouchableOpacity
        key={sanitizedTab}
        style={[styles.tabButton, activeTab === sanitizedTab && styles.activeTabButton]}
        onPress={() => setActiveTab(sanitizedTab as TabType)}
      >
        <View>{icon}</View>
        <Text style={[styles.tabText, activeTab === sanitizedTab && styles.activeTabText]}>
          {label}
        </Text>
      </TouchableOpacity>
    );
  };
  
  const renderPortfolioOptimization = () => {
    if (portfolioQuery.isLoading) {
      return (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#007AFF" />
          <Text style={styles.loadingText}>Generating portfolio insights...</Text>
        </View>
      );
    }
    
    if (portfolioQuery.error || !portfolioQuery.data) {
      return (
        <ThemedCard style={styles.errorCard}>
          <Text style={styles.errorText}>Failed to load portfolio optimization</Text>
        </ThemedCard>
      );
    }
    
    const data = portfolioQuery.data;
    
    return (
      <ScrollView style={styles.contentContainer}>
        <ThemedCard style={styles.summaryCard}>
          <View style={styles.cardHeader}>
            <TrendingUp size={24} color="#007AFF" />
            <Text style={styles.cardTitle}>Portfolio Optimization</Text>
            <Badge label={data.riskLevel} />
          </View>
          
          {data.portfolioMetrics && (
            <View style={styles.metricsGrid}>
              <View style={styles.metricItem}>
                <Text style={styles.metricValue}>{data.portfolioMetrics.totalCruises}</Text>
                <Text style={styles.metricLabel}>Total Cruises</Text>
              </View>
              <View style={styles.metricItem}>
                <Text style={styles.metricValue}>{data.portfolioMetrics.averageROI.toFixed(1)}%</Text>
                <Text style={styles.metricLabel}>Avg ROI</Text>
              </View>
              <View style={styles.metricItem}>
                <Text style={styles.metricValue}>${data.portfolioMetrics.totalSavings.toLocaleString()}</Text>
                <Text style={styles.metricLabel}>Total Savings</Text>
              </View>
            </View>
          )}
        </ThemedCard>
        
        <ThemedCard style={styles.insightsCard}>
          <Text style={styles.sectionTitle}>AI Recommendations</Text>
          {data.suggestions.map((suggestion: string, index: number) => (
            <View key={`suggestion-${index}-${suggestion.slice(0, 20)}`} style={styles.suggestionItem}>
              <Lightbulb size={16} color="#FF9500" />
              <Text style={styles.suggestionText}>{suggestion}</Text>
            </View>
          ))}
        </ThemedCard>
        
        {data.recommendedActions.length > 0 && (
          <ThemedCard style={styles.actionsCard}>
            <Text style={styles.sectionTitle}>Recommended Actions</Text>
            {data.recommendedActions.map((action: string, index: number) => (
              <View key={`action-${index}-${action.slice(0, 20)}`} style={styles.actionItem}>
                <Target size={16} color="#34C759" />
                <Text style={styles.actionText}>{action}</Text>
              </View>
            ))}
          </ThemedCard>
        )}
      </ScrollView>
    );
  };
  
  const renderRiskManagement = () => {
    if (riskQuery.isLoading) {
      return (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#007AFF" />
          <Text style={styles.loadingText}>Analyzing risk profile...</Text>
        </View>
      );
    }
    
    if (riskQuery.error || !riskQuery.data) {
      return (
        <ThemedCard style={styles.errorCard}>
          <Text style={styles.errorText}>Failed to load risk analysis</Text>
        </ThemedCard>
      );
    }
    
    const data = riskQuery.data;
    
    return (
      <ScrollView style={styles.contentContainer}>
        <ThemedCard style={styles.summaryCard}>
          <View style={styles.cardHeader}>
            <Shield size={24} color="#FF3B30" />
            <Text style={styles.cardTitle}>Risk Management</Text>
            <Badge label={`Risk Score: ${data.riskScore}`} />
          </View>
          
          {data.riskMetrics && (
            <View style={styles.metricsGrid}>
              <View style={styles.metricItem}>
                <Text style={styles.metricValue}>${data.riskMetrics.totalOutOfPocket.toLocaleString()}</Text>
                <Text style={styles.metricLabel}>Total Out-of-Pocket</Text>
              </View>
              <View style={styles.metricItem}>
                <Text style={styles.metricValue}>{data.riskMetrics.riskMultiplier.toFixed(2)}x</Text>
                <Text style={styles.metricLabel}>Risk Multiplier</Text>
              </View>
              <View style={styles.metricItem}>
                <Text style={styles.metricValue}>{data.riskMetrics.volatility.toFixed(1)}%</Text>
                <Text style={styles.metricLabel}>Volatility</Text>
              </View>
            </View>
          )}
        </ThemedCard>
        
        <ThemedCard style={styles.insightsCard}>
          <Text style={styles.sectionTitle}>Risk Insights</Text>
          {data.insights.map((insight: string, index: number) => (
            <View key={`insight-${index}-${insight.slice(0, 20)}`} style={styles.suggestionItem}>
              <Shield size={16} color="#FF3B30" />
              <Text style={styles.suggestionText}>{insight}</Text>
            </View>
          ))}
        </ThemedCard>
        
        {data.recommendations.length > 0 && (
          <ThemedCard style={styles.actionsCard}>
            <Text style={styles.sectionTitle}>Risk Recommendations</Text>
            {data.recommendations.map((rec: string, index: number) => (
              <View key={`risk-rec-${index}-${rec.slice(0, 20)}`} style={styles.actionItem}>
                <Target size={16} color="#34C759" />
                <Text style={styles.actionText}>{rec}</Text>
              </View>
            ))}
          </ThemedCard>
        )}
      </ScrollView>
    );
  };
  
  const renderTierAdvancement = () => {
    if (tierQuery.isLoading) {
      return (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#007AFF" />
          <Text style={styles.loadingText}>Analyzing tier advancement...</Text>
        </View>
      );
    }
    
    if (tierQuery.error || !tierQuery.data) {
      return (
        <ThemedCard style={styles.errorCard}>
          <Text style={styles.errorText}>Failed to load tier analysis</Text>
        </ThemedCard>
      );
    }
    
    const data = tierQuery.data;
    
    return (
      <ScrollView style={styles.contentContainer}>
        <ThemedCard style={styles.summaryCard}>
          <View style={styles.cardHeader}>
            <Target size={24} color="#AF52DE" />
            <Text style={styles.cardTitle}>Tier Advancement</Text>
            <Badge label={data.currentTier} />
          </View>
          
          <View style={styles.tierProgress}>
            <View style={styles.tierInfo}>
              <Text style={styles.tierLabel}>Current Tier</Text>
              <Text style={styles.tierValue}>{data.currentTier}</Text>
            </View>
            <View style={styles.tierArrow}>
              <Text style={styles.arrowText}>→</Text>
            </View>
            <View style={styles.tierInfo}>
              <Text style={styles.tierLabel}>Next Tier</Text>
              <Text style={styles.tierValue}>{data.nextTier}</Text>
            </View>
          </View>
          
          {data.pointsNeeded > 0 && (
            <View style={styles.metricsGrid}>
              <View style={styles.metricItem}>
                <Text style={styles.metricValue}>{data.pointsNeeded.toLocaleString()}</Text>
                <Text style={styles.metricLabel}>Points Needed</Text>
              </View>
              <View style={styles.metricItem}>
                <Text style={styles.metricValue}>${data.estimatedSpendNeeded.toLocaleString()}</Text>
                <Text style={styles.metricLabel}>Est. Spend Needed</Text>
              </View>
              <View style={styles.metricItem}>
                <Text style={styles.metricValue}>{data.cruisesNeeded}</Text>
                <Text style={styles.metricLabel}>Cruises Needed</Text>
              </View>
            </View>
          )}
        </ThemedCard>
        
        <ThemedCard style={styles.insightsCard}>
          <Text style={styles.sectionTitle}>Advancement Recommendations</Text>
          {data.recommendations.map((rec: string, index: number) => (
            <View key={`tier-rec-${index}-${rec.slice(0, 20)}`} style={styles.suggestionItem}>
              <Target size={16} color="#AF52DE" />
              <Text style={styles.suggestionText}>{rec}</Text>
            </View>
          ))}
        </ThemedCard>
      </ScrollView>
    );
  };
  
  const renderCruiseNarrative = () => {
    const availableCruises = cruisesQuery.data || [];
    const cruiseData = cruiseDataQuery.data || [];
    
    return (
      <ScrollView style={styles.contentContainer}>
        <ThemedCard style={styles.summaryCard}>
          <View style={styles.cardHeader}>
            <Brain size={24} color="#5856D6" />
            <Text style={styles.cardTitle}>Cruise AI Narratives</Text>
          </View>
          
          <Text style={styles.sectionDescription}>
            Select a cruise to get AI-powered insights and analysis
          </Text>
          
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.cruiseSelector}>
            {availableCruises.map((analytics) => {
              const cruise = Array.isArray(cruiseData) ? cruiseData.find((c: any) => c.id === analytics.cruiseId) : cruiseData?.cruises?.find((c: any) => c.id === analytics.cruiseId);
              if (!cruise) return null;
              
              return (
                <TouchableOpacity
                  key={analytics.cruiseId}
                  style={[
                    styles.cruiseOption,
                    selectedCruiseId === analytics.cruiseId && styles.selectedCruiseOption
                  ]}
                  onPress={() => setSelectedCruiseId(analytics.cruiseId)}
                >
                  <Text style={styles.cruiseOptionShip}>{cruise.ship}</Text>
                  <Text style={styles.cruiseOptionDate}>{cruise.departureDate}</Text>
                  <Badge label={`${analytics.roi.toFixed(0)}% ROI`} />
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </ThemedCard>
        
        {selectedCruiseId && (
          <ThemedCard style={styles.narrativeCard}>
            {narrativeQuery.isLoading ? (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color="#007AFF" />
                <Text style={styles.loadingText}>Generating AI narrative...</Text>
              </View>
            ) : narrativeQuery.error ? (
              <Text style={styles.errorText}>Failed to generate narrative</Text>
            ) : narrativeQuery.data ? (
              <>
                <Text style={styles.sectionTitle}>AI Analysis</Text>
                <Text style={styles.narrativeText}>{narrativeQuery.data.narrative}</Text>
                
                <View style={styles.narrativeMetrics}>
                  <View style={styles.metricItem}>
                    <Text style={styles.metricValue}>{narrativeQuery.data.metrics.roi.toFixed(1)}%</Text>
                    <Text style={styles.metricLabel}>ROI</Text>
                  </View>
                  <View style={styles.metricItem}>
                    <Text style={styles.metricValue}>${narrativeQuery.data.metrics.savings.toLocaleString()}</Text>
                    <Text style={styles.metricLabel}>Savings</Text>
                  </View>
                  <View style={styles.metricItem}>
                    <Text style={styles.metricValue}>${narrativeQuery.data.metrics.casinoSpend.toLocaleString()}</Text>
                    <Text style={styles.metricLabel}>Casino Spend</Text>
                  </View>
                </View>
                
                <Text style={styles.generatedAt}>
                  Generated: {new Date(narrativeQuery.data.generatedAt).toLocaleString()}
                </Text>
              </>
            ) : null}
          </ThemedCard>
        )}
      </ScrollView>
    );
  };
  
  const renderContent = () => {
    switch (activeTab) {
      case 'portfolio':
        return renderPortfolioOptimization();
      case 'risk':
        return renderRiskManagement();
      case 'tier':
        return renderTierAdvancement();
      case 'narrative':
        return renderCruiseNarrative();
      default:
        return null;
    }
  };
  
  return (
    <SafeAreaView style={styles.container}>
      <Stack.Screen 
        options={{
          title: 'AI Insights',
          headerRight: () => (
            <TouchableOpacity onPress={handleRefresh} style={styles.refreshButton}>
              <RefreshCw size={20} color="#007AFF" />
            </TouchableOpacity>
          )
        }} 
      />
      
      <View style={styles.tabContainer}>
        {renderTabButton('portfolio', <TrendingUp size={20} color={activeTab === 'portfolio' ? '#007AFF' : '#8E8E93'} />, 'Portfolio')}
        {renderTabButton('risk', <Shield size={20} color={activeTab === 'risk' ? '#007AFF' : '#8E8E93'} />, 'Risk')}
        {renderTabButton('tier', <Target size={20} color={activeTab === 'tier' ? '#007AFF' : '#8E8E93'} />, 'Tier')}
        {renderTabButton('narrative', <Brain size={20} color={activeTab === 'narrative' ? '#007AFF' : '#8E8E93'} />, 'Narrative')}
      </View>
      
      {renderContent()}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F2F2F7',
  },
  refreshButton: {
    padding: 8,
  },
  tabContainer: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E5EA',
  },
  tabButton: {
    flex: 1,
    flexDirection: 'column',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 4,
  },
  activeTabButton: {
    borderBottomWidth: 2,
    borderBottomColor: '#007AFF',
  },
  tabText: {
    fontSize: 12,
    color: '#8E8E93',
    marginTop: 4,
    textAlign: 'center',
  },
  activeTabText: {
    color: '#007AFF',
    fontWeight: '600',
  },
  contentContainer: {
    flex: 1,
    padding: 16,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  loadingText: {
    fontSize: 16,
    color: '#8E8E93',
    marginTop: 16,
    textAlign: 'center',
  },
  errorCard: {
    padding: 20,
    alignItems: 'center',
  },
  errorText: {
    fontSize: 16,
    color: '#FF3B30',
    textAlign: 'center',
  },
  summaryCard: {
    padding: 20,
    marginBottom: 16,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  cardTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#1C1C1E',
    marginLeft: 12,
    flex: 1,
  },
  metricsGrid: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginTop: 16,
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
  insightsCard: {
    padding: 20,
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1C1C1E',
    marginBottom: 16,
  },
  sectionDescription: {
    fontSize: 14,
    color: '#8E8E93',
    marginBottom: 16,
    lineHeight: 20,
  },
  suggestionItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  suggestionText: {
    fontSize: 14,
    color: '#1C1C1E',
    marginLeft: 12,
    flex: 1,
    lineHeight: 20,
  },
  actionsCard: {
    padding: 20,
    marginBottom: 16,
  },
  actionItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  actionText: {
    fontSize: 14,
    color: '#1C1C1E',
    marginLeft: 12,
    flex: 1,
    lineHeight: 20,
  },
  tierProgress: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  tierInfo: {
    alignItems: 'center',
    flex: 1,
  },
  tierLabel: {
    fontSize: 12,
    color: '#8E8E93',
    marginBottom: 4,
  },
  tierValue: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1C1C1E',
    textAlign: 'center',
  },
  tierArrow: {
    paddingHorizontal: 20,
  },
  arrowText: {
    fontSize: 24,
    color: '#8E8E93',
  },
  cruiseSelector: {
    marginTop: 16,
  },
  cruiseOption: {
    backgroundColor: '#F2F2F7',
    borderRadius: 12,
    padding: 16,
    marginRight: 12,
    minWidth: 160,
    alignItems: 'center',
  },
  selectedCruiseOption: {
    backgroundColor: '#007AFF',
  },
  cruiseOptionShip: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1C1C1E',
    marginBottom: 4,
    textAlign: 'center',
  },
  cruiseOptionDate: {
    fontSize: 12,
    color: '#8E8E93',
    marginBottom: 8,
    textAlign: 'center',
  },
  narrativeCard: {
    padding: 20,
    marginBottom: 16,
  },
  narrativeText: {
    fontSize: 16,
    color: '#1C1C1E',
    lineHeight: 24,
    marginBottom: 20,
  },
  narrativeMetrics: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#E5E5EA',
  },
  generatedAt: {
    fontSize: 12,
    color: '#8E8E93',
    textAlign: 'center',
    fontStyle: 'italic',
  },
  iconContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});