import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  TextInput,
  Modal,
} from 'react-native';
import { Stack, router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ArrowLeft, TrendingUp, Target, Zap, Calculator, X } from 'lucide-react-native';
import { trpc } from '@/lib/trpc';

export default function CasinoAnalyticsScreen() {
  const insets = useSafeAreaInsets();
  const casinoAnalyticsQuery = trpc.analytics.casinoAnalytics.useQuery();
  const predictiveAnalyticsQuery = trpc.analytics.predictiveAnalytics.useQuery();

  const [showSimulator, setShowSimulator] = useState(false);
  const [futureCruises, setFutureCruises] = useState('5');
  const [avgCoinIn, setAvgCoinIn] = useState('');
  const [targetTier, setTargetTier] = useState('');

  const simulateScenarioQuery = trpc.analytics.simulateScenario.useQuery(
    {
      futureCruises: parseInt(futureCruises) || 5,
      avgCoinIn: avgCoinIn ? parseFloat(avgCoinIn) : undefined,
      targetTier: targetTier || undefined,
    },
    {
      enabled: showSimulator && !!futureCruises,
    }
  );

  const isLoading = casinoAnalyticsQuery.isLoading || predictiveAnalyticsQuery.isLoading;
  const data = casinoAnalyticsQuery.data;
  const predictiveData = predictiveAnalyticsQuery.data;
  const simulationData = simulateScenarioQuery.data;

  return (
    <View style={styles.container}>
      <Stack.Screen
        options={{
          headerShown: false,
        }}
      />

      <View style={{ backgroundColor: '#003B6F', paddingTop: insets.top }}>
        <View style={styles.header}>
          <TouchableOpacity
            onPress={() => router.back()}
            style={styles.backButton}
          >
            <ArrowLeft size={24} color="#FFFFFF" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>🎰 Casino Analytics</Text>
          <View style={{ width: 40 }} />
        </View>
      </View>

      <ScrollView style={styles.scrollView}>
        {isLoading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#003B6F" />
            <Text style={styles.loadingText}>Loading analytics...</Text>
          </View>
        ) : data ? (
          <>
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>🎯 Player Context</Text>
              <View style={styles.card}>
                <View style={styles.statRow}>
                  <View style={styles.statItem}>
                    <Text style={styles.statLabel}>Tier</Text>
                    <Text style={styles.statValue}>{data.playerContext.tier}</Text>
                  </View>
                  <View style={styles.statItem}>
                    <Text style={styles.statLabel}>Points</Text>
                    <Text style={styles.statValue}>
                      {data.playerContext.currentPoints.toLocaleString()}
                    </Text>
                  </View>
                </View>

                <View style={styles.statRow}>
                  <View style={styles.statItem}>
                    <Text style={styles.statLabel}>Booked Cruises</Text>
                    <Text style={styles.statValue}>{data.playerContext.bookedCruises}</Text>
                  </View>
                  <View style={styles.statItem}>
                    <Text style={styles.statLabel}>Completed</Text>
                    <Text style={styles.statValue}>{data.playerContext.cruisesCompleted}</Text>
                  </View>
                </View>

                <View style={styles.divider} />

                <View style={styles.statRow}>
                  <View style={styles.statItem}>
                    <Text style={styles.statLabel}>💰 Total Coin-In</Text>
                    <Text style={styles.statValueLarge}>
                      ${data.playerContext.totalCoinIn.toLocaleString()}
                    </Text>
                  </View>
                </View>

                <View style={styles.statRow}>
                  <View style={styles.statItem}>
                    <Text style={styles.statLabel}>📊 Avg Coin-In/Cruise</Text>
                    <Text style={styles.statValue}>
                      ${data.playerContext.avgCoinInPerCruise.toLocaleString(undefined, {
                        maximumFractionDigits: 0,
                      })}
                    </Text>
                  </View>
                </View>
              </View>
            </View>

            <View style={styles.section}>
              <Text style={styles.sectionTitle}>⚡ Points Pace</Text>
              <View style={styles.card}>
                <View style={styles.paceItem}>
                  <Zap size={20} color="#10B981" />
                  <View style={styles.paceInfo}>
                    <Text style={styles.paceLabel}>Points Per Day</Text>
                    <Text style={styles.paceValue}>
                      {data.playerContext.pointsPerDay.toFixed(1)} pts/day
                    </Text>
                  </View>
                </View>

                <View style={styles.paceItem}>
                  <TrendingUp size={20} color="#3B82F6" />
                  <View style={styles.paceInfo}>
                    <Text style={styles.paceLabel}>Points Per Sea Day</Text>
                    <Text style={styles.paceValue}>
                      {data.playerContext.pointsPerSeaDay.toFixed(1)} pts/day
                    </Text>
                  </View>
                </View>

                <View style={styles.paceItem}>
                  <Target size={20} color="#8B5CF6" />
                  <View style={styles.paceInfo}>
                    <Text style={styles.paceLabel}>Points Per Port Day</Text>
                    <Text style={styles.paceValue}>
                      {data.playerContext.pointsPerPortDay.toFixed(1)} pts/day
                    </Text>
                  </View>
                </View>
              </View>
            </View>

            <View style={styles.section}>
              <Text style={styles.sectionTitle}>📈 Performance Metrics</Text>
              <View style={styles.card}>
                <View style={styles.metricRow}>
                  <Text style={styles.metricLabel}>Average ROI</Text>
                  <Text
                    style={[
                      styles.metricValue,
                      data.playerContext.avgROI > 0
                        ? styles.metricPositive
                        : styles.metricNegative,
                    ]}
                  >
                    {data.playerContext.avgROI.toFixed(1)}%
                  </Text>
                </View>

                <View style={styles.metricRow}>
                  <Text style={styles.metricLabel}>Total Points Earned</Text>
                  <Text style={styles.metricValue}>
                    {data.spendingMetrics.totalPoints.toLocaleString()} pts
                  </Text>
                </View>

                <View style={styles.metricRow}>
                  <Text style={styles.metricLabel}>Total Retail Value</Text>
                  <Text style={styles.metricValue}>
                    ${data.spendingMetrics.totalRetailCosts.toLocaleString()}
                  </Text>
                </View>

                <View style={styles.metricRow}>
                  <Text style={styles.metricLabel}>Avg Retail/Cruise</Text>
                  <Text style={styles.metricValue}>
                    ${data.spendingMetrics.avgRetailCostPerCruise.toLocaleString(undefined, {
                      maximumFractionDigits: 0,
                    })}
                  </Text>
                </View>
              </View>
            </View>

            <View style={styles.section}>
              <Text style={styles.sectionTitle}>🎮 Game Type Analysis</Text>
              <View style={styles.card}>
                <View style={styles.gameTypeItem}>
                  <Text style={styles.gameTypeLabel}>🎰 Slots</Text>
                  <Text style={styles.gameTypeValue}>
                    ${data.gameTypeAnalysis.slots.toLocaleString()}
                  </Text>
                  <Text style={styles.gameTypePercent}>70%</Text>
                </View>

                <View style={styles.gameTypeItem}>
                  <Text style={styles.gameTypeLabel}>🃏 Table Games</Text>
                  <Text style={styles.gameTypeValue}>
                    ${data.gameTypeAnalysis.tableGames.toLocaleString()}
                  </Text>
                  <Text style={styles.gameTypePercent}>20%</Text>
                </View>

                <View style={styles.gameTypeItem}>
                  <Text style={styles.gameTypeLabel}>🎲 Video Poker</Text>
                  <Text style={styles.gameTypeValue}>
                    ${data.gameTypeAnalysis.videoPoker.toLocaleString()}
                  </Text>
                  <Text style={styles.gameTypePercent}>10%</Text>
                </View>
              </View>
            </View>

            {data.cruiseMetrics && data.cruiseMetrics.length > 0 && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>⛴ Recent Cruises</Text>
                {data.cruiseMetrics.map((cruise, index) => (
                  <View key={cruise.cruiseId || index} style={styles.cruiseCard}>
                    <Text style={styles.cruiseShip}>{cruise.ship}</Text>
                    <Text style={styles.cruiseDate}>{cruise.departureDate}</Text>

                    <View style={styles.cruiseStats}>
                      <View style={styles.cruiseStat}>
                        <Text style={styles.cruiseStatLabel}>Casino Spend</Text>
                        <Text style={styles.cruiseStatValue}>
                          ${cruise.casinoSpend.toLocaleString()}
                        </Text>
                      </View>

                      <View style={styles.cruiseStat}>
                        <Text style={styles.cruiseStatLabel}>Points</Text>
                        <Text style={styles.cruiseStatValue}>
                          {cruise.points.toLocaleString()}
                        </Text>
                      </View>

                      <View style={styles.cruiseStat}>
                        <Text style={styles.cruiseStatLabel}>ROI</Text>
                        <Text
                          style={[
                            styles.cruiseStatValue,
                            cruise.roi > 0 ? styles.metricPositive : styles.metricNegative,
                          ]}
                        >
                          {cruise.roi.toFixed(1)}%
                        </Text>
                      </View>
                    </View>
                  </View>
                ))}
              </View>
            )}

            {predictiveData && predictiveData.tierForecasting && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>🔮 Tier Forecasting</Text>
                <View style={styles.card}>
                  <View style={styles.forecastRow}>
                    <Text style={styles.forecastLabel}>Current Tier</Text>
                    <Text style={styles.forecastValue}>{predictiveData.tierForecasting.currentTier}</Text>
                  </View>
                  
                  <View style={styles.forecastRow}>
                    <Text style={styles.forecastLabel}>Next Tier</Text>
                    <Text style={[styles.forecastValue, styles.tierHighlight]}>
                      {predictiveData.tierForecasting.nextTier}
                    </Text>
                  </View>

                  <View style={styles.divider} />

                  <View style={styles.forecastRow}>
                    <Text style={styles.forecastLabel}>Points Needed</Text>
                    <Text style={styles.forecastValue}>
                      {predictiveData.tierForecasting.pointsNeeded.toLocaleString()}
                    </Text>
                  </View>

                  <View style={styles.forecastRow}>
                    <Text style={styles.forecastLabel}>Cruises Needed</Text>
                    <Text style={styles.forecastValue}>
                      {predictiveData.tierForecasting.cruisesNeeded}
                    </Text>
                  </View>

                  <View style={styles.forecastRow}>
                    <Text style={styles.forecastLabel}>Days Needed</Text>
                    <Text style={styles.forecastValue}>
                      {predictiveData.tierForecasting.daysNeeded}
                    </Text>
                  </View>

                  <View style={styles.divider} />

                  <Text style={styles.projectionText}>
                    {predictiveData.tierForecasting.projection}
                  </Text>
                </View>
              </View>
            )}

            {predictiveData && predictiveData.roiProjections && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>📊 Future ROI Projections</Text>
                {predictiveData.roiProjections.map((projection, index) => (
                  <View key={index} style={styles.projectionCard}>
                    <View style={styles.projectionHeader}>
                      <Text style={styles.projectionTitle}>
                        +{projection.cruisesFromNow} Cruise{projection.cruisesFromNow > 1 ? 's' : ''}
                      </Text>
                      <Text style={styles.projectionTier}>{projection.projectedTier}</Text>
                    </View>

                    <View style={styles.projectionStats}>
                      <View style={styles.projectionStat}>
                        <Text style={styles.projectionStatLabel}>Projected Points</Text>
                        <Text style={styles.projectionStatValue}>
                          {projection.projectedPoints.toLocaleString()}
                        </Text>
                      </View>

                      <View style={styles.projectionStat}>
                        <Text style={styles.projectionStatLabel}>Projected ROI</Text>
                        <Text
                          style={[
                            styles.projectionStatValue,
                            projection.projectedROI > 0
                              ? styles.metricPositive
                              : styles.metricNegative,
                          ]}
                        >
                          {projection.projectedROI.toFixed(1)}%
                        </Text>
                      </View>

                      <View style={styles.projectionStat}>
                        <Text style={styles.projectionStatLabel}>Total Value</Text>
                        <Text style={styles.projectionStatValue}>
                          ${projection.projectedTotalValue.toLocaleString(undefined, {
                            maximumFractionDigits: 0,
                          })}
                        </Text>
                      </View>
                    </View>
                  </View>
                ))}
              </View>
            )}

            <View style={styles.section}>
              <TouchableOpacity
                style={styles.simulatorButton}
                onPress={() => setShowSimulator(true)}
              >
                <Calculator size={20} color="#FFFFFF" />
                <Text style={styles.simulatorButtonText}>Open What-If Simulator</Text>
              </TouchableOpacity>
            </View>

            {predictiveData && predictiveData.riskCurve && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>📈 Risk Analysis (Monte Carlo)</Text>
                <View style={styles.card}>
                  <Text style={styles.riskNote}>{predictiveData.riskCurve.note}</Text>
                  
                  <View style={styles.divider} />

                  <Text style={styles.riskCategoryTitle}>ROI Range</Text>
                  <View style={styles.riskRow}>
                    <Text style={styles.riskLabel}>Worst 10%</Text>
                    <Text style={[styles.riskValue, styles.metricNegative]}>
                      {predictiveData.riskCurve.roi.worst10.toFixed(1)}%
                    </Text>
                  </View>
                  <View style={styles.riskRow}>
                    <Text style={styles.riskLabel}>Median</Text>
                    <Text style={styles.riskValue}>
                      {predictiveData.riskCurve.roi.median.toFixed(1)}%
                    </Text>
                  </View>
                  <View style={styles.riskRow}>
                    <Text style={styles.riskLabel}>Best 10%</Text>
                    <Text style={[styles.riskValue, styles.metricPositive]}>
                      {predictiveData.riskCurve.roi.best10.toFixed(1)}%
                    </Text>
                  </View>

                  <View style={styles.divider} />

                  <Text style={styles.riskCategoryTitle}>FreePlay Range</Text>
                  <View style={styles.riskRow}>
                    <Text style={styles.riskLabel}>Worst 10%</Text>
                    <Text style={styles.riskValue}>
                      ${predictiveData.riskCurve.freePlay.worst10.toLocaleString(undefined, {
                        maximumFractionDigits: 0,
                      })}
                    </Text>
                  </View>
                  <View style={styles.riskRow}>
                    <Text style={styles.riskLabel}>Median</Text>
                    <Text style={styles.riskValue}>
                      ${predictiveData.riskCurve.freePlay.median.toLocaleString(undefined, {
                        maximumFractionDigits: 0,
                      })}
                    </Text>
                  </View>
                  <View style={styles.riskRow}>
                    <Text style={styles.riskLabel}>Best 10%</Text>
                    <Text style={styles.riskValue}>
                      ${predictiveData.riskCurve.freePlay.best10.toLocaleString(undefined, {
                        maximumFractionDigits: 0,
                      })}
                    </Text>
                  </View>

                  <View style={styles.divider} />

                  <Text style={styles.riskCategoryTitle}>Out-of-Pocket Range</Text>
                  <View style={styles.riskRow}>
                    <Text style={styles.riskLabel}>Worst 10%</Text>
                    <Text style={styles.riskValue}>
                      ${predictiveData.riskCurve.outOfPocket.worst10.toLocaleString(undefined, {
                        maximumFractionDigits: 0,
                      })}
                    </Text>
                  </View>
                  <View style={styles.riskRow}>
                    <Text style={styles.riskLabel}>Median</Text>
                    <Text style={styles.riskValue}>
                      ${predictiveData.riskCurve.outOfPocket.median.toLocaleString(undefined, {
                        maximumFractionDigits: 0,
                      })}
                    </Text>
                  </View>
                  <View style={styles.riskRow}>
                    <Text style={styles.riskLabel}>Best 10%</Text>
                    <Text style={styles.riskValue}>
                      ${predictiveData.riskCurve.outOfPocket.best10.toLocaleString(undefined, {
                        maximumFractionDigits: 0,
                      })}
                    </Text>
                  </View>

                  <Text style={styles.simulationCount}>
                    Based on {predictiveData.riskCurve.simulationCount.toLocaleString()} simulations
                  </Text>
                </View>
              </View>
            )}

            <View style={styles.footer}>
              <Text style={styles.footerText}>
                Last updated: {data.summary.timestamp}
              </Text>
            </View>
          </>
        ) : (
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>No casino analytics data available</Text>
          </View>
        )}
      </ScrollView>

      <Modal
        visible={showSimulator}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowSimulator(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>🎲 What-If Simulator</Text>
              <TouchableOpacity
                onPress={() => setShowSimulator(false)}
                style={styles.modalCloseButton}
              >
                <X size={24} color="#6B7280" />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalBody}>
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Number of Future Cruises</Text>
                <TextInput
                  style={styles.input}
                  value={futureCruises}
                  onChangeText={setFutureCruises}
                  keyboardType="numeric"
                  placeholder="e.g., 5"
                  placeholderTextColor="#9CA3AF"
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Average Coin-In Per Cruise (Optional)</Text>
                <TextInput
                  style={styles.input}
                  value={avgCoinIn}
                  onChangeText={setAvgCoinIn}
                  keyboardType="numeric"
                  placeholder="Leave blank for historical average"
                  placeholderTextColor="#9CA3AF"
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Target Tier (Optional)</Text>
                <TextInput
                  style={styles.input}
                  value={targetTier}
                  onChangeText={setTargetTier}
                  placeholder="e.g., DIAMOND PLUS"
                  placeholderTextColor="#9CA3AF"
                />
              </View>

              {simulateScenarioQuery.isLoading && (
                <View style={styles.simulatorLoading}>
                  <ActivityIndicator size="large" color="#003B6F" />
                  <Text style={styles.simulatorLoadingText}>Running simulation...</Text>
                </View>
              )}

              {simulationData && (
                <View style={styles.simulationResults}>
                  <Text style={styles.resultsTitle}>📊 Simulation Results</Text>

                  <View style={styles.resultCard}>
                    <Text style={styles.resultSectionTitle}>Scenario</Text>
                    <View style={styles.resultRow}>
                      <Text style={styles.resultLabel}>Future Cruises</Text>
                      <Text style={styles.resultValue}>{simulationData.scenario.futureCruises}</Text>
                    </View>
                    <View style={styles.resultRow}>
                      <Text style={styles.resultLabel}>Avg Coin-In/Cruise</Text>
                      <Text style={styles.resultValue}>
                        ${simulationData.scenario.avgCoinInPerCruise.toLocaleString(undefined, {
                          maximumFractionDigits: 0,
                        })}
                      </Text>
                    </View>
                    <View style={styles.resultRow}>
                      <Text style={styles.resultLabel}>Points/Cruise</Text>
                      <Text style={styles.resultValue}>
                        {simulationData.scenario.pointsPerCruise.toLocaleString()}
                      </Text>
                    </View>
                  </View>

                  <View style={styles.resultCard}>
                    <Text style={styles.resultSectionTitle}>Projection</Text>
                    <View style={styles.resultRow}>
                      <Text style={styles.resultLabel}>Current Points</Text>
                      <Text style={styles.resultValue}>
                        {simulationData.projection.currentPoints.toLocaleString()}
                      </Text>
                    </View>
                    <View style={styles.resultRow}>
                      <Text style={styles.resultLabel}>Projected Points</Text>
                      <Text style={[styles.resultValue, styles.highlightValue]}>
                        {simulationData.projection.projectedPoints.toLocaleString()}
                      </Text>
                    </View>
                    <View style={styles.resultRow}>
                      <Text style={styles.resultLabel}>Projected Tier</Text>
                      <Text style={[styles.resultValue, styles.tierValue]}>
                        {simulationData.projection.projectedTier}
                      </Text>
                    </View>
                    <View style={styles.resultRow}>
                      <Text style={styles.resultLabel}>Projected ROI</Text>
                      <Text
                        style={[
                          styles.resultValue,
                          simulationData.projection.projectedROI > 0
                            ? styles.positiveValue
                            : styles.negativeValue,
                        ]}
                      >
                        {simulationData.projection.projectedROI.toFixed(1)}%
                      </Text>
                    </View>
                    <View style={styles.divider} />
                    <View style={styles.resultRow}>
                      <Text style={styles.resultLabel}>Total Spend</Text>
                      <Text style={styles.resultValue}>
                        ${simulationData.projection.projectedTotalSpend.toLocaleString(undefined, {
                          maximumFractionDigits: 0,
                        })}
                      </Text>
                    </View>
                    <View style={styles.resultRow}>
                      <Text style={styles.resultLabel}>Total Value</Text>
                      <Text style={[styles.resultValue, styles.highlightValue]}>
                        ${simulationData.projection.projectedTotalValue.toLocaleString(undefined, {
                          maximumFractionDigits: 0,
                        })}
                      </Text>
                    </View>
                  </View>

                  {simulationData.targetAnalysis && (
                    <View style={styles.resultCard}>
                      <Text style={styles.resultSectionTitle}>🎯 Target Analysis</Text>
                      <View style={styles.resultRow}>
                        <Text style={styles.resultLabel}>Target Tier</Text>
                        <Text style={styles.resultValue}>
                          {simulationData.targetAnalysis.targetTier}
                        </Text>
                      </View>
                      <View style={styles.resultRow}>
                        <Text style={styles.resultLabel}>Points Needed</Text>
                        <Text style={styles.resultValue}>
                          {simulationData.targetAnalysis.pointsNeeded.toLocaleString()}
                        </Text>
                      </View>
                      <View style={styles.resultRow}>
                        <Text style={styles.resultLabel}>Cruises Needed</Text>
                        <Text style={styles.resultValue}>
                          {simulationData.targetAnalysis.cruisesNeeded}
                        </Text>
                      </View>
                      <View style={styles.resultRow}>
                        <Text style={styles.resultLabel}>Spend Needed</Text>
                        <Text style={styles.resultValue}>
                          ${simulationData.targetAnalysis.spendNeeded.toLocaleString()}
                        </Text>
                      </View>
                      <View style={styles.divider} />
                      <View style={styles.achievableRow}>
                        <Text style={styles.resultLabel}>Achievable?</Text>
                        <Text
                          style={[
                            styles.achievableValue,
                            simulationData.targetAnalysis.achievable
                              ? styles.positiveValue
                              : styles.negativeValue,
                          ]}
                        >
                          {simulationData.targetAnalysis.achievable ? 'YES ✓' : 'NO ✗'}
                        </Text>
                      </View>
                    </View>
                  )}
                </View>
              )}
            </ScrollView>

            <View style={styles.modalFooter}>
              <TouchableOpacity
                style={styles.closeButton}
                onPress={() => setShowSimulator(false)}
              >
                <Text style={styles.closeButtonText}>Close</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 16,
    backgroundColor: '#003B6F',
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  scrollView: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: 100,
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#6B7280',
  },
  section: {
    padding: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 12,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  statRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  statItem: {
    flex: 1,
  },
  statLabel: {
    fontSize: 14,
    color: '#6B7280',
    marginBottom: 4,
  },
  statValue: {
    fontSize: 20,
    fontWeight: '700',
    color: '#111827',
  },
  statValueLarge: {
    fontSize: 28,
    fontWeight: '700',
    color: '#003B6F',
  },
  divider: {
    height: 1,
    backgroundColor: '#E5E7EB',
    marginVertical: 16,
  },
  paceItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  paceInfo: {
    marginLeft: 12,
    flex: 1,
  },
  paceLabel: {
    fontSize: 14,
    color: '#6B7280',
    marginBottom: 4,
  },
  paceValue: {
    fontSize: 18,
    fontWeight: '600',
    color: '#111827',
  },
  metricRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  metricLabel: {
    fontSize: 15,
    color: '#374151',
  },
  metricValue: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
  },
  metricPositive: {
    color: '#10B981',
  },
  metricNegative: {
    color: '#EF4444',
  },
  gameTypeItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  gameTypeLabel: {
    fontSize: 15,
    color: '#374151',
    flex: 1,
  },
  gameTypeValue: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
    marginRight: 16,
  },
  gameTypePercent: {
    fontSize: 14,
    color: '#6B7280',
    width: 40,
    textAlign: 'right',
  },
  cruiseCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  cruiseShip: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 4,
  },
  cruiseDate: {
    fontSize: 13,
    color: '#6B7280',
    marginBottom: 12,
  },
  cruiseStats: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  cruiseStat: {
    flex: 1,
  },
  cruiseStatLabel: {
    fontSize: 12,
    color: '#6B7280',
    marginBottom: 4,
  },
  cruiseStatValue: {
    fontSize: 15,
    fontWeight: '600',
    color: '#111827',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: 100,
  },
  emptyText: {
    fontSize: 16,
    color: '#6B7280',
  },
  footer: {
    padding: 16,
    alignItems: 'center',
  },
  footerText: {
    fontSize: 12,
    color: '#9CA3AF',
  },
  forecastRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  forecastLabel: {
    fontSize: 15,
    color: '#374151',
  },
  forecastValue: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
  },
  tierHighlight: {
    color: '#003B6F',
    fontSize: 18,
    fontWeight: '700',
  },
  projectionText: {
    fontSize: 14,
    color: '#6B7280',
    fontStyle: 'italic',
    marginTop: 8,
    lineHeight: 20,
  },
  projectionCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  projectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  projectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111827',
  },
  projectionTier: {
    fontSize: 14,
    fontWeight: '600',
    color: '#003B6F',
    backgroundColor: '#EBF4FF',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
  },
  projectionStats: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  projectionStat: {
    flex: 1,
  },
  projectionStatLabel: {
    fontSize: 12,
    color: '#6B7280',
    marginBottom: 4,
  },
  projectionStatValue: {
    fontSize: 15,
    fontWeight: '600',
    color: '#111827',
  },
  riskNote: {
    fontSize: 13,
    color: '#6B7280',
    fontStyle: 'italic',
    marginBottom: 8,
  },
  riskCategoryTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#111827',
    marginTop: 12,
    marginBottom: 8,
  },
  riskRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
  },
  riskLabel: {
    fontSize: 14,
    color: '#6B7280',
  },
  riskValue: {
    fontSize: 15,
    fontWeight: '600',
    color: '#111827',
  },
  simulationCount: {
    fontSize: 12,
    color: '#9CA3AF',
    textAlign: 'center',
    marginTop: 16,
    fontStyle: 'italic',
  },
  simulatorButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#003B6F',
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderRadius: 12,
    gap: 8,
  },
  simulatorButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '90%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#111827',
  },
  modalCloseButton: {
    padding: 4,
  },
  modalBody: {
    padding: 20,
  },
  inputGroup: {
    marginBottom: 20,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 8,
  },
  input: {
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    color: '#111827',
    backgroundColor: '#F9FAFB',
  },
  simulatorLoading: {
    alignItems: 'center',
    paddingVertical: 32,
  },
  simulatorLoadingText: {
    marginTop: 12,
    fontSize: 14,
    color: '#6B7280',
  },
  simulationResults: {
    marginTop: 20,
  },
  resultsTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 16,
  },
  resultCard: {
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  resultSectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#003B6F',
    marginBottom: 12,
  },
  resultRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
  },
  resultLabel: {
    fontSize: 14,
    color: '#6B7280',
  },
  resultValue: {
    fontSize: 15,
    fontWeight: '600',
    color: '#111827',
  },
  highlightValue: {
    color: '#003B6F',
    fontSize: 16,
    fontWeight: '700',
  },
  tierValue: {
    color: '#003B6F',
    fontSize: 15,
    fontWeight: '700',
    backgroundColor: '#EBF4FF',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 8,
  },
  positiveValue: {
    color: '#10B981',
  },
  negativeValue: {
    color: '#EF4444',
  },
  achievableRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
  },
  achievableValue: {
    fontSize: 16,
    fontWeight: '700',
  },
  modalFooter: {
    padding: 20,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
  },
  closeButton: {
    backgroundColor: '#6B7280',
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: 'center',
  },
  closeButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
});
