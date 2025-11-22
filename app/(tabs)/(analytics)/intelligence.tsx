import React from 'react';
import { ScrollView, StyleSheet, Text, View, ActivityIndicator, TextInput, TouchableOpacity } from 'react-native';
import { Stack } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Brain, AlertTriangle, Sparkles, TrendingUp, Calendar, Ship, Rows3, Zap } from 'lucide-react-native';
import { useCruiseEstimator } from '@/lib/cruise-estimator';
import { useSimpleAnalytics, calculateCruiseROI, calculateValuePerPoint, calculateCoinIn, calculateRetailValue } from '@/state/SimpleAnalyticsProvider';
import { trpc } from '@/lib/trpc';
import { OfferValueInsights } from '@/components/OfferValueInsights';

function Stat({ label, value, accent }: { label: string; value: string; accent?: string }) {
  return (
    <View style={styles.stat}>
      <Text style={styles.statLabel}>{label}</Text>
      <Text style={[styles.statValue, accent ? { color: accent } : undefined]}>{value}</Text>
    </View>
  );
}

export default function IntelligenceScreen() {
  const insets = useSafeAreaInsets();
  const { estimateCruise } = useCruiseEstimator();
  const analytics = useSimpleAnalytics();
  
  const [scenarioFutureCruises, setScenarioFutureCruises] = React.useState('5');
  const [scenarioAvgCoinIn, setScenarioAvgCoinIn] = React.useState('');
  const [scenarioTargetTier, setScenarioTargetTier] = React.useState('');
  const [showWhatIf, setShowWhatIf] = React.useState(false);
  const [selectedTemplate, setSelectedTemplate] = React.useState<string | null>(null);
  const [showShipComparison, setShowShipComparison] = React.useState(false);
  
  const predictiveAnalyticsQuery = trpc.analytics.predictiveAnalytics.useQuery();
  const simulateScenarioQuery = trpc.analytics.simulateScenario.useQuery(
    {
      futureCruises: parseInt(scenarioFutureCruises) || 5,
      avgCoinIn: scenarioAvgCoinIn ? parseFloat(scenarioAvgCoinIn) : undefined,
      targetTier: scenarioTargetTier || undefined,
    },
    {
      enabled: showWhatIf && !!scenarioFutureCruises,
    }
  );
  
  const isLoading = false;
  
  console.log('[Intelligence] Analytics Data:', {
    cruises: analytics.cruises.length,
    totals: analytics.totals
  });

  const portfolio = React.useMemo(() => {
    return {
      total: analytics.totals.totalCruises,
      roi: analytics.totals.averageROI,
      pts: analytics.totals.totalPoints,
      coin: analytics.totals.totalCoinIn
    };
  }, [analytics.totals]);

  const avgConfidencePct = React.useMemo(() => {
    return 100;
  }, []);

  const historicalAvgCoinIn = React.useMemo(() => {
    const cruisesWithCoinIn = analytics.cruises.filter(c => calculateCoinIn(c) > 0);
    if (cruisesWithCoinIn.length === 0) return 5000;
    return cruisesWithCoinIn.reduce((sum, c) => sum + calculateCoinIn(c), 0) / cruisesWithCoinIn.length;
  }, [analytics.cruises]);

  const applyTemplate = (template: string) => {
    setSelectedTemplate(template);
    setShowShipComparison(false);
    switch (template) {
      case 'increase50':
        setScenarioFutureCruises('5');
        setScenarioAvgCoinIn(String(Math.round(historicalAvgCoinIn * 1.5)));
        setScenarioTargetTier('');
        break;
      case 'platinum':
        setScenarioFutureCruises('5');
        setScenarioAvgCoinIn('');
        setScenarioTargetTier('PLATINUM');
        break;
      case 'diamond':
        setScenarioFutureCruises('10');
        setScenarioAvgCoinIn('');
        setScenarioTargetTier('DIAMOND');
        break;
      case 'conservative':
        setScenarioFutureCruises('3');
        setScenarioAvgCoinIn(String(Math.round(historicalAvgCoinIn * 0.75)));
        setScenarioTargetTier('');
        break;
      case 'shipComparison':
        setShowShipComparison(true);
        setScenarioFutureCruises('5');
        setScenarioAvgCoinIn('');
        setScenarioTargetTier('');
        break;
    }
  };

  const anomalies = React.useMemo(() => {
    const cruises = analytics.cruises;
    const roiValues = cruises.map(c => calculateCruiseROI(c)).filter(v => Number.isFinite(v));
    if (roiValues.length === 0) return [];
    const mean = roiValues.reduce((a, b) => a + b, 0) / roiValues.length;
    const std = Math.sqrt(roiValues.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / roiValues.length);
    return cruises.filter(c => {
      const roi = calculateCruiseROI(c);
      const z = std > 0 ? (roi - mean) / std : 0;
      return Math.abs(z) >= 1.5;
    }).map(c => ({ id: c.id, ship: c.ship, roi: calculateCruiseROI(c) }));
  }, [analytics.cruises]);

  const avgPointsPerNight = React.useMemo(() => {
    const totalNights = analytics.cruises.reduce((sum, c) => sum + (c.nights || 0), 0);
    if (totalNights === 0) return 0;
    return analytics.totals.totalPoints / totalNights;
  }, [analytics]);

  const forecasts = React.useMemo(() => {
    const upcoming = analytics.cruises.filter(c => new Date(c.sailDate).getTime() > Date.now());
    return upcoming.map(c => {
      const nights = c.nights || 1;
      const est = estimateCruise({ nights, ship: c.ship });
      const projected = Math.round((avgPointsPerNight || 0) * nights);
      const low = Math.round(projected * 0.9);
      const high = Math.round(projected * 1.1);
      return { id: c.id, ship: c.ship, startDate: c.sailDate, nights, projected, range: [low, high] as [number, number], confidence: est.confidence };
    });
  }, [analytics.cruises, avgPointsPerNight, estimateCruise]);
  
  const hasData = analytics.totals.totalCruises > 0;
  
  if (!hasData) {
    return (
      <>
        <Stack.Screen options={{ title: 'Intelligence' }} />
        <ScrollView style={styles.container} contentContainerStyle={{ padding: 16 }}>
          <Text style={{ color: '#F59E0B', fontSize: 16, fontWeight: '600', marginBottom: 8 }}>No Analytics Data</Text>
          <Text style={{ color: '#6B7280', fontSize: 14, marginBottom: 16 }}>The analytics system could not find any cruise data to analyze.</Text>
        </ScrollView>
      </>
    );
  }

  return (
    <>
      <Stack.Screen options={{ title: 'Intelligence' }} />
      <ScrollView style={styles.container} contentContainerStyle={{ paddingTop: insets.top + 16 }}>
        <View style={styles.header}>
          <Brain size={18} color="#111827" />
          <Text style={styles.headerTitle}>Intelligence</Text>
        </View>
        <Text style={styles.confidenceNoteText} testID="intelligence-avg-confidence">Data confidence: {avgConfidencePct}%</Text>

        <View style={styles.statsRow}>
          <Stat label="Cruises" value={String(portfolio.total)} />
          <Stat label="Avg ROI" value={`${portfolio.roi.toFixed(0)}%`} accent="#22C55E" />
          <Stat label="Points" value={portfolio.pts.toLocaleString()} />
          <Stat label="Coin-In" value={`$${portfolio.coin.toLocaleString()}`} />
        </View>

        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <TrendingUp size={16} color="#111827" />
            <Text style={styles.sectionTitle}>Estimated vs Actual</Text>
          </View>
          {analytics.cruises.filter(c => (c.pointsEarned || 0) > 0).slice(-5).map(c => {
            const nights = c.nights || 1;
            const actualPoints = c.pointsEarned || 0;
            const pointsPerNight = actualPoints > 0 ? Math.round(actualPoints / nights) : 0;
            const est = estimateCruise({ nights, ship: c.ship });
            const diff = actualPoints - est.expectedPoints;
            const diffPct = est.expectedPoints > 0 ? (diff / est.expectedPoints) * 100 : 0;
            const color = diff >= 0 ? '#22C55E' : '#EF4444';
            return (
              <View key={c.id} style={styles.card}>
                <View style={styles.rowBetween}>
                  <Text style={styles.cardTitle}>{c.ship}</Text>
                  <View style={styles.inlineRow}>
                    <Text style={styles.badgePurple}>{est.confidence}</Text>
                    <Text style={styles.badgeGreen} testID="row-confidence">100%</Text>
                  </View>
                </View>
                <Text style={styles.kv}>Points Actually Earned: {actualPoints.toLocaleString()}</Text>
                <Text style={styles.kv}>{nights} {nights === 1 ? 'Night' : 'Nights'} at {pointsPerNight.toLocaleString()} points per night</Text>
                <Text style={[styles.deltaText, { color }]}>{diff >= 0 ? '+' : ''}{diff.toLocaleString()} ({diffPct.toFixed(0)}%)</Text>
              </View>
            );
          })}
        </View>

        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <AlertTriangle size={16} color="#111827" />
            <Text style={styles.sectionTitle}>Anomalies</Text>
          </View>
          {anomalies.length === 0 ? (
            <View style={styles.card}><Text style={styles.kv}>No anomalies detected</Text></View>
          ) : (
            anomalies.map(a => (
              <View key={a.id} style={styles.card}>
                <Text style={styles.cardTitle}>{a.ship}</Text>
                <Text style={styles.kv}>ROI: {a.roi.toFixed(0)}%</Text>
              </View>
            ))
          )}
        </View>

        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Sparkles size={16} color="#111827" />
            <Text style={styles.sectionTitle}>Insights</Text>
          </View>
          <View style={styles.card}>
            <Text style={styles.kv}>Play concentrates on {analytics.cruises.slice(-5).map(c => c.ship).join(', ')}. Consider diversifying ship class to validate estimator factors.</Text>
          </View>
        </View>

        <OfferValueInsights preferredCabinType="BALCONY" />

        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Rows3 size={16} color="#111827" />
            <Text style={styles.sectionTitle}>Comparisons</Text>
          </View>
          <View style={styles.card}>
            {(() => {
              const byShip = analytics.cruises.reduce<Record<string, { roi: number; n: number }>>((acc, c) => {
                const key = c.ship || 'Unknown';
                if (!acc[key]) acc[key] = { roi: 0, n: 0 };
                acc[key].roi += calculateCruiseROI(c);
                acc[key].n += 1;
                return acc;
              }, {});
              const rows = Object.entries(byShip).map(([ship, v]) => ({ ship, avg: v.n ? v.roi / v.n : 0, n: v.n }))
                .sort((a, b) => b.avg - a.avg)
                .slice(0, 5);
              return rows.length === 0 ? (
                <Text style={styles.kv}>No data</Text>
              ) : (
                rows.map(r => (
                  <View key={r.ship} style={styles.rowBetween}>
                    <Text style={styles.kv}>{r.ship}</Text>
                    <Text style={styles.kv}>{r.avg.toFixed(0)}% · {r.n}x</Text>
                  </View>
                ))
              );
            })()}
          </View>
        </View>

        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Calendar size={16} color="#111827" />
            <Text style={styles.sectionTitle}>Forecasts (Upcoming)</Text>
          </View>
          {forecasts.length === 0 ? (
            <View style={styles.card}><Text style={styles.kv}>No upcoming cruises found</Text></View>
          ) : (
            forecasts.map(f => (
              <View key={f.id} style={styles.card}>
                <View style={styles.rowBetween}>
                  <View style={styles.rowShip}>
                    <Ship size={14} color="#111827" />
                    <Text style={styles.cardTitle}>{f.ship}</Text>
                  </View>
                  <Text style={styles.badgeGreen}>{new Date(f.startDate).toLocaleDateString()}</Text>
                </View>
                <Text style={styles.kv} testID="forecast-nights">Nights: {f.nights}</Text>
                <Text style={styles.kv} testID="forecast-projected">Projected Points: {f.projected.toLocaleString()} ({f.range[0].toLocaleString()}–{f.range[1].toLocaleString()}) • {f.confidence}</Text>
              </View>
            ))
          )}
        </View>

        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Zap size={16} color="#111827" />
            <Text style={styles.sectionTitle}>What-If Scenarios</Text>
          </View>
          
          {!showWhatIf ? (
            <>
              <View style={styles.templatesContainer}>
                <Text style={styles.templateSectionTitle}>Quick Scenarios</Text>
                <View style={styles.templatesGrid}>
                  <TouchableOpacity 
                    style={styles.templateCard}
                    onPress={() => {
                      setShowWhatIf(true);
                      applyTemplate('increase50');
                    }}
                  >
                    <TrendingUp size={20} color="#16A34A" />
                    <Text style={styles.templateTitle}>Increase Spend 50%</Text>
                    <Text style={styles.templateDesc}>See impact of higher casino play</Text>
                  </TouchableOpacity>
                  
                  <TouchableOpacity 
                    style={styles.templateCard}
                    onPress={() => {
                      setShowWhatIf(true);
                      applyTemplate('platinum');
                    }}
                  >
                    <Sparkles size={20} color="#8B5CF6" />
                    <Text style={styles.templateTitle}>Reach Platinum</Text>
                    <Text style={styles.templateDesc}>Path to next tier level</Text>
                  </TouchableOpacity>
                </View>
                
                <View style={styles.templatesGrid}>
                  <TouchableOpacity 
                    style={styles.templateCard}
                    onPress={() => {
                      setShowWhatIf(true);
                      applyTemplate('diamond');
                    }}
                  >
                    <Zap size={20} color="#F59E0B" />
                    <Text style={styles.templateTitle}>Target Diamond</Text>
                    <Text style={styles.templateDesc}>Long-term tier strategy</Text>
                  </TouchableOpacity>
                  
                  <TouchableOpacity 
                    style={styles.templateCard}
                    onPress={() => {
                      setShowWhatIf(true);
                      applyTemplate('conservative');
                    }}
                  >
                    <AlertTriangle size={20} color="#3B82F6" />
                    <Text style={styles.templateTitle}>Conservative Play</Text>
                    <Text style={styles.templateDesc}>Reduce spend, maintain perks</Text>
                  </TouchableOpacity>
                </View>
                
                <View style={styles.templatesGrid}>
                  <TouchableOpacity 
                    style={[styles.templateCard, { flex: 'none', minWidth: '100%' }]}
                    onPress={() => {
                      setShowWhatIf(true);
                      applyTemplate('shipComparison');
                    }}
                  >
                    <Ship size={20} color="#EC4899" />
                    <Text style={styles.templateTitle}>Ship Comparison</Text>
                    <Text style={styles.templateDesc}>Compare ROI by ship class</Text>
                  </TouchableOpacity>
                </View>
              </View>
              
              <TouchableOpacity 
                style={styles.whatIfButton}
                onPress={() => setShowWhatIf(true)}
              >
                <Text style={styles.whatIfButtonText}>Custom Simulation</Text>
              </TouchableOpacity>
            </>
          ) : (
            <>
              <View style={styles.card}>
                <View style={styles.rowBetween}>
                  <Text style={styles.cardTitle}>Scenario Parameters</Text>
                  {selectedTemplate && (
                    <View style={styles.templateBadge}>
                      <Text style={styles.templateBadgeText}>
                        {selectedTemplate === 'increase50' && 'Increase 50%'}
                        {selectedTemplate === 'platinum' && 'Platinum'}
                        {selectedTemplate === 'diamond' && 'Diamond'}
                        {selectedTemplate === 'conservative' && 'Conservative'}
                        {selectedTemplate === 'shipComparison' && 'Ship Comparison'}
                      </Text>
                    </View>
                  )}
                </View>
                <View style={styles.inputRow}>
                  <Text style={styles.inputLabel}>Future Cruises:</Text>
                  <TextInput
                    style={styles.input}
                    value={scenarioFutureCruises}
                    onChangeText={setScenarioFutureCruises}
                    keyboardType="numeric"
                    placeholder="5"
                  />
                </View>
                <View style={styles.inputRow}>
                  <Text style={styles.inputLabel}>Avg Coin-In (optional):</Text>
                  <TextInput
                    style={styles.input}
                    value={scenarioAvgCoinIn}
                    onChangeText={setScenarioAvgCoinIn}
                    keyboardType="numeric"
                    placeholder="Auto"
                  />
                </View>
                <View style={styles.inputRow}>
                  <Text style={styles.inputLabel}>Target Tier (optional):</Text>
                  <TextInput
                    style={styles.input}
                    value={scenarioTargetTier}
                    onChangeText={setScenarioTargetTier}
                    placeholder="e.g. PLATINUM"
                  />
                </View>
              </View>
              
              {showShipComparison ? (
                <>
                  <View style={styles.card}>
                    <Text style={styles.cardTitle}>Ship-by-Ship ROI Comparison</Text>
                    <Text style={[styles.kv, { marginBottom: 12, color: '#6B7280' }]}>Based on your historical performance</Text>
                    {(() => {
                      const byShip = analytics.cruises.reduce<Record<string, { roi: number; coinIn: number; points: number; n: number }>>((acc, c) => {
                        const key = c.ship || 'Unknown';
                        if (!acc[key]) acc[key] = { roi: 0, coinIn: 0, points: 0, n: 0 };
                        acc[key].roi += calculateCruiseROI(c);
                        acc[key].coinIn += calculateCoinIn(c);
                        acc[key].points += c.pointsEarned || 0;
                        acc[key].n += 1;
                        return acc;
                      }, {});
                      const rows = Object.entries(byShip)
                        .map(([ship, v]) => ({ 
                          ship, 
                          avgROI: v.n ? v.roi / v.n : 0, 
                          avgCoinIn: v.n ? v.coinIn / v.n : 0,
                          avgPoints: v.n ? v.points / v.n : 0,
                          cruises: v.n 
                        }))
                        .sort((a, b) => b.avgROI - a.avgROI);
                      
                      const bestShip = rows[0];
                      const worstShip = rows[rows.length - 1];
                      
                      return (
                        <>
                          {rows.map((r, idx) => {
                            const isBest = idx === 0;
                            const isWorst = idx === rows.length - 1;
                            const color = isBest ? '#16A34A' : isWorst ? '#EF4444' : '#111827';
                            
                            return (
                              <View key={r.ship} style={[styles.shipComparisonRow, isBest && styles.bestShipRow]}>
                                <View style={styles.rowBetween}>
                                  <View style={styles.rowShip}>
                                    <Ship size={14} color={color} />
                                    <Text style={[styles.cardTitle, { color }]}>{r.ship}</Text>
                                    {isBest && <Text style={styles.bestBadge}>🏆 Best</Text>}
                                  </View>
                                  <Text style={[styles.kv, { fontWeight: '700', color }]}>{r.avgROI.toFixed(1)}% ROI</Text>
                                </View>
                                <View style={styles.shipStatsRow}>
                                  <Text style={styles.shipStat}>Avg Coin-In: ${r.avgCoinIn.toLocaleString()}</Text>
                                  <Text style={styles.shipStat}>Avg Points: {r.avgPoints.toLocaleString()}</Text>
                                </View>
                                <Text style={styles.shipStat}>{r.cruises} cruise{r.cruises > 1 ? 's' : ''}</Text>
                              </View>
                            );
                          })}
                          
                          {rows.length >= 2 && (
                            <View style={styles.comparisonInsight}>
                              <Sparkles size={14} color="#8B5CF6" />
                              <Text style={styles.comparisonInsightText}>
                                {bestShip.ship} delivers {((bestShip.avgROI - worstShip.avgROI) / worstShip.avgROI * 100).toFixed(0)}% better ROI than {worstShip.ship}. 
                                Consider booking more {bestShip.ship} cruises for maximum value.
                              </Text>
                            </View>
                          )}
                        </>
                      );
                    })()}
                  </View>
                  
                  <View style={styles.card}>
                    <Text style={styles.cardTitle}>Optimization Recommendation</Text>
                    {(() => {
                      const byShip = analytics.cruises.reduce<Record<string, { roi: number; n: number }>>((acc, c) => {
                        const key = c.ship || 'Unknown';
                        if (!acc[key]) acc[key] = { roi: 0, n: 0 };
                        acc[key].roi += calculateCruiseROI(c);
                        acc[key].n += 1;
                        return acc;
                      }, {});
                      const rows = Object.entries(byShip)
                        .map(([ship, v]) => ({ ship, avgROI: v.n ? v.roi / v.n : 0, n: v.n }))
                        .sort((a, b) => b.avgROI - a.avgROI);
                      
                      if (rows.length < 2) {
                        return <Text style={styles.kv}>Not enough ship diversity to provide recommendations.</Text>;
                      }
                      
                      const topShips = rows.slice(0, 3);
                      
                      return (
                        <View>
                          <Text style={styles.kv}>Based on your historical data, prioritize:</Text>
                          {topShips.map((ship, idx) => (
                            <View key={ship.ship} style={styles.recommendationRow}>
                              <Text style={styles.recommendationNumber}>{idx + 1}.</Text>
                              <View style={{ flex: 1 }}>
                                <Text style={styles.recommendationShip}>{ship.ship}</Text>
                                <Text style={styles.recommendationStats}>{ship.avgROI.toFixed(1)}% avg ROI ({ship.n} cruise{ship.n > 1 ? 's' : ''})</Text>
                              </View>
                            </View>
                          ))}
                        </View>
                      );
                    })()}
                  </View>
                </>
              ) : simulateScenarioQuery.isLoading ? (
                <View style={styles.card}>
                  <ActivityIndicator size="small" color="#111827" />
                </View>
              ) : simulateScenarioQuery.data ? (
                <>
                  <View style={styles.card}>
                    <Text style={styles.cardTitle}>Scenario Projection</Text>
                    <Text style={styles.kv}>Future Cruises: {simulateScenarioQuery.data.scenario.futureCruises}</Text>
                    <Text style={styles.kv}>Avg Coin-In: ${simulateScenarioQuery.data.scenario.avgCoinInPerCruise.toLocaleString()}</Text>
                    <Text style={styles.kv}>Points Per Cruise: {simulateScenarioQuery.data.scenario.pointsPerCruise.toLocaleString()}</Text>
                  </View>
                  
                  <View style={styles.card}>
                    <Text style={styles.cardTitle}>Current vs Projected</Text>
                    
                    <View style={styles.comparisonSection}>
                      <View style={styles.comparisonRow}>
                        <View style={styles.comparisonColumn}>
                          <Text style={styles.comparisonLabel}>Current</Text>
                          <Text style={styles.comparisonValue}>{simulateScenarioQuery.data.projection.currentPoints.toLocaleString()}</Text>
                          <Text style={styles.comparisonMetric}>Points</Text>
                        </View>
                        <View style={styles.comparisonArrow}>
                          <Text style={styles.comparisonArrowText}>→</Text>
                        </View>
                        <View style={styles.comparisonColumn}>
                          <Text style={styles.comparisonLabel}>Projected</Text>
                          <Text style={[styles.comparisonValue, { color: '#16A34A' }]}>{simulateScenarioQuery.data.projection.projectedPoints.toLocaleString()}</Text>
                          <Text style={styles.comparisonMetric}>Points</Text>
                          <View style={styles.comparisonGain}>
                            <Text style={styles.comparisonGainText}>+{(simulateScenarioQuery.data.projection.projectedPoints - simulateScenarioQuery.data.projection.currentPoints).toLocaleString()}</Text>
                          </View>
                        </View>
                      </View>
                    </View>
                    
                    <View style={styles.comparisonSection}>
                      <View style={styles.comparisonRow}>
                        <View style={styles.comparisonColumn}>
                          <Text style={styles.comparisonLabel}>Current Tier</Text>
                          <Text style={styles.badgePurple}>{predictiveAnalyticsQuery.data?.tierForecasting?.currentTier || 'PRIME'}</Text>
                        </View>
                        <View style={styles.comparisonArrow}>
                          <Text style={styles.comparisonArrowText}>→</Text>
                        </View>
                        <View style={styles.comparisonColumn}>
                          <Text style={styles.comparisonLabel}>Projected Tier</Text>
                          <Text style={styles.badgeGreen}>{simulateScenarioQuery.data.projection.projectedTier}</Text>
                        </View>
                      </View>
                    </View>
                    
                    <View style={styles.comparisonDivider} />
                    
                    <View style={styles.rowBetween}>
                      <Text style={styles.kv}>Projected ROI:</Text>
                      <Text style={[styles.kv, { fontWeight: '700' }]}>{simulateScenarioQuery.data.projection.projectedROI.toFixed(1)}%</Text>
                    </View>
                    <View style={styles.rowBetween}>
                      <Text style={styles.kv}>Total Spend:</Text>
                      <Text style={styles.kv}>${simulateScenarioQuery.data.projection.projectedTotalSpend.toLocaleString()}</Text>
                    </View>
                    <View style={styles.rowBetween}>
                      <Text style={styles.kv}>Total Value:</Text>
                      <Text style={[styles.kv, { fontWeight: '700', color: '#16A34A' }]}>${simulateScenarioQuery.data.projection.projectedTotalValue.toLocaleString()}</Text>
                    </View>
                  </View>
                  
                  {simulateScenarioQuery.data.targetAnalysis && (
                    <View style={styles.card}>
                      <Text style={styles.cardTitle}>Target Analysis: {simulateScenarioQuery.data.targetAnalysis.targetTier}</Text>
                      <Text style={styles.kv}>Points Needed: {simulateScenarioQuery.data.targetAnalysis.pointsNeeded.toLocaleString()}</Text>
                      <Text style={styles.kv}>Cruises Needed: {simulateScenarioQuery.data.targetAnalysis.cruisesNeeded}</Text>
                      <Text style={styles.kv}>Spend Needed: ${simulateScenarioQuery.data.targetAnalysis.spendNeeded.toLocaleString()}</Text>
                      <Text style={[styles.kv, { marginTop: 8, fontWeight: '700', color: simulateScenarioQuery.data.targetAnalysis.achievable ? '#16A34A' : '#EF4444' }]}>
                        {simulateScenarioQuery.data.targetAnalysis.achievable ? '✓ Achievable with this scenario' : '✗ Not achievable with this scenario'}
                      </Text>
                    </View>
                  )}
                </>
              ) : null}
              
              <TouchableOpacity 
                style={[styles.whatIfButton, { backgroundColor: '#EF4444' }]}
                onPress={() => setShowWhatIf(false)}
              >
                <Text style={styles.whatIfButtonText}>Close Simulation</Text>
              </TouchableOpacity>
            </>
          )}
        </View>

        {predictiveAnalyticsQuery.data && (
          <>
            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <TrendingUp size={16} color="#111827" />
                <Text style={styles.sectionTitle}>Tier Forecasting</Text>
              </View>
              {predictiveAnalyticsQuery.data.tierForecasting && (
                <View style={styles.card}>
                  <View style={styles.rowBetween}>
                    <Text style={styles.cardTitle}>Current Tier:</Text>
                    <Text style={styles.badgePurple}>{predictiveAnalyticsQuery.data.tierForecasting.currentTier}</Text>
                  </View>
                  
                  <View style={styles.tierProgressContainer}>
                    <Text style={styles.tierProgressLabel}>Progress to {predictiveAnalyticsQuery.data.tierForecasting.nextTier}</Text>
                    <View style={styles.tierProgressBar}>
                      <View style={[styles.tierProgressFill, { 
                        width: `${predictiveAnalyticsQuery.data.tierForecasting.nextTier === 'Max Tier Reached' ? 100 : Math.min(100, (predictiveAnalyticsQuery.data.tierForecasting.currentPoints / predictiveAnalyticsQuery.data.tierForecasting.nextTierPoints) * 100)}%`,
                        backgroundColor: '#8B5CF6'
                      }]} />
                    </View>
                    <View style={styles.tierProgressInfo}>
                      <Text style={styles.tierProgressText}>{predictiveAnalyticsQuery.data.tierForecasting.currentPoints.toLocaleString()} pts</Text>
                      {predictiveAnalyticsQuery.data.tierForecasting.nextTier !== 'Max Tier Reached' && (
                        <Text style={styles.tierProgressText}>{predictiveAnalyticsQuery.data.tierForecasting.nextTierPoints.toLocaleString()} pts</Text>
                      )}
                    </View>
                  </View>

                  {predictiveAnalyticsQuery.data.tierForecasting.nextTier !== 'Max Tier Reached' && (
                    <>
                      <View style={styles.rowBetween}>
                        <Text style={styles.kv}>Next Tier:</Text>
                        <Text style={styles.badgeGreen}>{predictiveAnalyticsQuery.data.tierForecasting.nextTier}</Text>
                      </View>
                      <Text style={styles.kv}>Points Needed: {predictiveAnalyticsQuery.data.tierForecasting.pointsNeeded.toLocaleString()}</Text>
                      <Text style={styles.kv}>Cruises Needed: {predictiveAnalyticsQuery.data.tierForecasting.cruisesNeeded}</Text>
                      <Text style={styles.kv}>Days Needed: {predictiveAnalyticsQuery.data.tierForecasting.daysNeeded}</Text>
                    </>
                  )}
                  <Text style={[styles.kv, { marginTop: 8, fontStyle: 'italic', color: '#6B7280' }]}>{predictiveAnalyticsQuery.data.tierForecasting.projection}</Text>
                </View>
              )}
            </View>
            
            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <AlertTriangle size={16} color="#111827" />
                <Text style={styles.sectionTitle}>Risk Analysis</Text>
              </View>
              <View style={styles.card}>
                <Text style={styles.cardTitle}>Monte Carlo Simulation ({predictiveAnalyticsQuery.data.riskCurve.simulationCount.toLocaleString()} runs)</Text>
                
                <Text style={[styles.kv, { marginTop: 12, fontWeight: '600' }]}>ROI Probability Distribution:</Text>
                <View style={styles.probabilityContainer}>
                  <View style={styles.probabilityBar}>
                    <View style={[styles.probabilitySegment, { flex: 1, backgroundColor: '#FEE2E2' }]}>
                      <Text style={styles.probabilityLabel}>10%</Text>
                    </View>
                    <View style={[styles.probabilitySegment, { flex: 8, backgroundColor: '#FEF3C7' }]}>
                      <Text style={styles.probabilityLabel}>80% Range</Text>
                    </View>
                    <View style={[styles.probabilitySegment, { flex: 1, backgroundColor: '#D1FAE5' }]}>
                      <Text style={styles.probabilityLabel}>10%</Text>
                    </View>
                  </View>
                  <View style={styles.probabilityValues}>
                    <Text style={[styles.probabilityValue, { color: '#EF4444' }]}>{predictiveAnalyticsQuery.data.riskCurve.roi.worst10.toFixed(1)}%</Text>
                    <Text style={[styles.probabilityValue, { color: '#111827', fontWeight: '700' }]}>{predictiveAnalyticsQuery.data.riskCurve.roi.median.toFixed(1)}%</Text>
                    <Text style={[styles.probabilityValue, { color: '#16A34A' }]}>{predictiveAnalyticsQuery.data.riskCurve.roi.best10.toFixed(1)}%</Text>
                  </View>
                </View>

                <Text style={[styles.kv, { marginTop: 16, fontWeight: '600' }]}>Outcome Ranges:</Text>
                <View style={styles.riskRow}>
                  <Text style={styles.riskLabel}>Worst Case (10%):</Text>
                  <Text style={[styles.riskValue, { color: '#EF4444' }]}>{predictiveAnalyticsQuery.data.riskCurve.roi.worst10.toFixed(1)}%</Text>
                </View>
                <View style={styles.riskRow}>
                  <Text style={styles.riskLabel}>Expected (Median):</Text>
                  <Text style={[styles.riskValue, { color: '#111827', fontWeight: '700' }]}>{predictiveAnalyticsQuery.data.riskCurve.roi.median.toFixed(1)}%</Text>
                </View>
                <View style={styles.riskRow}>
                  <Text style={styles.riskLabel}>Best Case (90%):</Text>
                  <Text style={[styles.riskValue, { color: '#16A34A' }]}>{predictiveAnalyticsQuery.data.riskCurve.roi.best10.toFixed(1)}%</Text>
                </View>
                
                <View style={styles.riskInsight}>
                  <Text style={styles.riskInsightText}>80% of outcomes fall between {predictiveAnalyticsQuery.data.riskCurve.roi.worst10.toFixed(1)}% and {predictiveAnalyticsQuery.data.riskCurve.roi.best10.toFixed(1)}%</Text>
                </View>
                
                <Text style={[styles.kv, { marginTop: 12, fontSize: 11, color: '#6B7280', fontStyle: 'italic' }]}>{predictiveAnalyticsQuery.data.riskCurve.note}</Text>
              </View>
            </View>
            
            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <Calendar size={16} color="#111827" />
                <Text style={styles.sectionTitle}>ROI Projections</Text>
              </View>
              <View style={styles.card}>
                <Text style={[styles.cardTitle, { marginBottom: 12 }]}>Multi-Cruise Trajectory</Text>
                {predictiveAnalyticsQuery.data.roiProjections.map((proj, idx) => {
                  const maxROI = Math.max(...predictiveAnalyticsQuery.data.roiProjections.map(p => p.projectedROI));
                  const progressWidth = (proj.projectedROI / maxROI) * 100;
                  const roiColor = proj.projectedROI >= 40 ? '#16A34A' : proj.projectedROI >= 30 ? '#F59E0B' : '#EF4444';
                  
                  return (
                    <View key={idx} style={styles.trajectoryRow}>
                      <View style={styles.trajectoryInfo}>
                        <View style={styles.rowBetween}>
                          <Text style={styles.trajectoryLabel}>{proj.cruisesFromNow} Cruise{proj.cruisesFromNow > 1 ? 's' : ''}</Text>
                          <Text style={styles.badgeGreen}>{proj.projectedTier}</Text>
                        </View>
                        <View style={styles.trajectoryProgress}>
                          <View style={[styles.trajectoryBar, { width: `${progressWidth}%`, backgroundColor: roiColor }]} />
                        </View>
                        <View style={styles.trajectoryStats}>
                          <Text style={styles.trajectoryStat}>ROI: <Text style={[styles.statHighlight, { color: roiColor }]}>{proj.projectedROI.toFixed(1)}%</Text></Text>
                          <Text style={styles.trajectoryStat}>Points: <Text style={styles.statHighlight}>{proj.projectedPoints.toLocaleString()}</Text></Text>
                        </View>
                        <View style={styles.trajectoryStats}>
                          <Text style={styles.trajectoryStat}>Value: <Text style={styles.statHighlight}>${proj.projectedTotalValue.toLocaleString()}</Text></Text>
                          <Text style={styles.trajectoryStat}>Spend: <Text style={styles.statHighlight}>${proj.projectedTotalSpend.toLocaleString()}</Text></Text>
                        </View>
                      </View>
                    </View>
                  );
                })}
              </View>
            </View>
          </>
        )}

      </ScrollView>
    </>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#E6F2FF' },
  header: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 16, marginBottom: 4 },
  headerTitle: { fontSize: 22, fontWeight: '700', color: '#111827' },
  confidenceNoteText: { paddingHorizontal: 16, marginBottom: 12, fontSize: 12, color: '#6B7280' },
  statsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, paddingHorizontal: 16, marginBottom: 16 },
  stat: { backgroundColor: '#F0F8FF', borderRadius: 10, padding: 12, borderWidth: 1, borderColor: '#B3D9FF', minWidth: '45%', flex: 1 },
  statLabel: { fontSize: 12, color: '#6B7280', marginBottom: 6 },
  statValue: { fontSize: 18, fontWeight: '700', color: '#111827' },
  section: { marginBottom: 16, paddingHorizontal: 16 },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: '#111827' },
  card: { backgroundColor: '#F0F8FF', borderRadius: 12, padding: 12, borderWidth: 1, borderColor: '#B3D9FF', marginBottom: 8 },
  cardTitle: { fontSize: 14, fontWeight: '700', color: '#111827' },
  rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  kv: { fontSize: 12, color: '#374151' },
  deltaText: { marginTop: 6, fontSize: 12, fontWeight: '700' },
  badge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 999, overflow: 'hidden', fontSize: 10, fontWeight: '700' },
  rowShip: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  inlineRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  badgePurple: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 999, overflow: 'hidden', fontSize: 10, fontWeight: '700', backgroundColor: '#EEF2FF', color: '#3730A3' },
  badgeGreen: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 999, overflow: 'hidden', fontSize: 10, fontWeight: '700', backgroundColor: '#ECFDF5', color: '#065F46' },
  comparisonHeader: { fontSize: 12, fontWeight: '700', color: '#111827', marginBottom: 8 },
  winnerBadge: { marginTop: 12, backgroundColor: '#FEF3C7', borderRadius: 8, padding: 8 },
  winnerText: { fontSize: 12, fontWeight: '600', color: '#92400E', textAlign: 'center' },
  // Casino Strategy Insights styles
  strategyMetrics: { marginTop: 12, gap: 8 },
  metricRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  recommendationsContainer: { marginTop: 12 },
  recommendationRow: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 6 },
  formulaContainer: { marginTop: 8, gap: 8 },
  formulaText: { fontSize: 11, color: '#6B7280', lineHeight: 16 },
  formulaLabel: { fontWeight: '600', color: '#374151' },
  whatIfButton: {
    backgroundColor: '#3B82F6',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    marginBottom: 8,
  },
  whatIfButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 12,
  },
  inputLabel: {
    fontSize: 12,
    color: '#374151',
    fontWeight: '600',
  },
  input: {
    backgroundColor: '#F9FAFB',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    padding: 8,
    fontSize: 12,
    color: '#111827',
    minWidth: 100,
    textAlign: 'right',
  },
  riskRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 6,
  },
  riskLabel: {
    fontSize: 12,
    color: '#6B7280',
  },
  riskValue: {
    fontSize: 14,
    fontWeight: '600',
  },
  trajectoryRow: {
    marginBottom: 16,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  trajectoryInfo: {
    gap: 8,
  },
  trajectoryLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: '#111827',
  },
  trajectoryProgress: {
    height: 8,
    backgroundColor: '#E5E7EB',
    borderRadius: 4,
    overflow: 'hidden',
  },
  trajectoryBar: {
    height: '100%',
    borderRadius: 4,
  },
  trajectoryStats: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 8,
  },
  trajectoryStat: {
    fontSize: 11,
    color: '#6B7280',
  },
  statHighlight: {
    fontWeight: '700',
    color: '#111827',
  },
  probabilityContainer: {
    marginTop: 8,
  },
  probabilityBar: {
    flexDirection: 'row',
    height: 40,
    borderRadius: 8,
    overflow: 'hidden',
    marginBottom: 8,
  },
  probabilitySegment: {
    justifyContent: 'center',
    alignItems: 'center',
    borderRightWidth: 1,
    borderRightColor: '#FFFFFF',
  },
  probabilityLabel: {
    fontSize: 10,
    fontWeight: '600',
    color: '#374151',
  },
  probabilityValues: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 4,
  },
  probabilityValue: {
    fontSize: 12,
    fontWeight: '600',
  },
  riskInsight: {
    marginTop: 12,
    padding: 12,
    backgroundColor: '#F0F9FF',
    borderRadius: 8,
    borderLeftWidth: 3,
    borderLeftColor: '#3B82F6',
  },
  riskInsightText: {
    fontSize: 12,
    color: '#1E40AF',
    fontWeight: '600',
  },
  tierProgressContainer: {
    marginTop: 12,
    marginBottom: 12,
  },
  tierProgressLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#6B7280',
    marginBottom: 6,
  },
  tierProgressBar: {
    height: 12,
    backgroundColor: '#E5E7EB',
    borderRadius: 6,
    overflow: 'hidden',
    marginBottom: 4,
  },
  tierProgressFill: {
    height: '100%',
    borderRadius: 6,
  },
  tierProgressInfo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  tierProgressText: {
    fontSize: 10,
    color: '#6B7280',
    fontWeight: '600',
  },
  templatesContainer: {
    marginBottom: 12,
  },
  templateSectionTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 12,
  },
  templatesGrid: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 8,
  },
  templateCard: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    alignItems: 'center',
    gap: 8,
  },
  templateTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#111827',
    textAlign: 'center',
  },
  templateDesc: {
    fontSize: 10,
    color: '#6B7280',
    textAlign: 'center',
  },
  templateBadge: {
    backgroundColor: '#EEF2FF',
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  templateBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#3730A3',
  },
  comparisonSection: {
    marginBottom: 16,
  },
  comparisonRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
  },
  comparisonColumn: {
    flex: 1,
    alignItems: 'center',
    gap: 4,
  },
  comparisonLabel: {
    fontSize: 11,
    color: '#6B7280',
    fontWeight: '600',
  },
  comparisonValue: {
    fontSize: 24,
    fontWeight: '700',
    color: '#111827',
  },
  comparisonMetric: {
    fontSize: 10,
    color: '#6B7280',
  },
  comparisonArrow: {
    paddingHorizontal: 8,
  },
  comparisonArrowText: {
    fontSize: 24,
    color: '#3B82F6',
    fontWeight: '700',
  },
  comparisonGain: {
    backgroundColor: '#ECFDF5',
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 2,
    marginTop: 4,
  },
  comparisonGainText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#16A34A',
  },
  comparisonDivider: {
    height: 1,
    backgroundColor: '#E5E7EB',
    marginVertical: 12,
  },
  shipComparisonRow: {
    marginBottom: 12,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  bestShipRow: {
    backgroundColor: '#F0FDF4',
    borderRadius: 8,
    padding: 12,
    borderWidth: 2,
    borderColor: '#86EFAC',
    marginBottom: 12,
  },
  bestBadge: {
    fontSize: 10,
    fontWeight: '700',
    color: '#16A34A',
    backgroundColor: '#DCFCE7',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 999,
    overflow: 'hidden',
  },
  shipStatsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 6,
    gap: 8,
  },
  shipStat: {
    fontSize: 11,
    color: '#6B7280',
  },
  comparisonInsight: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'flex-start',
    backgroundColor: '#F5F3FF',
    padding: 12,
    borderRadius: 8,
    marginTop: 12,
    borderLeftWidth: 3,
    borderLeftColor: '#8B5CF6',
  },
  comparisonInsightText: {
    flex: 1,
    fontSize: 12,
    color: '#5B21B6',
    fontWeight: '600',
    lineHeight: 18,
  },
  recommendationNumber: {
    fontSize: 14,
    fontWeight: '700',
    color: '#6B7280',
    marginRight: 8,
  },
  recommendationShip: {
    fontSize: 13,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 2,
  },
  recommendationStats: {
    fontSize: 11,
    color: '#6B7280',
  },
});
