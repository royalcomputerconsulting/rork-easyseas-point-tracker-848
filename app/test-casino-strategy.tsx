import React from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useCasinoStrategy, useCasinoInsights } from '@/state/CasinoStrategyProvider';
import { COLORS } from '@/constants/theme';

export default function TestCasinoStrategy() {
  const strategy = useCasinoStrategy();
  const insights = useCasinoInsights();
  const insets = useSafeAreaInsets();

  return (
    <ScrollView 
      style={styles.container}
      contentContainerStyle={[styles.content, { paddingTop: insets.top + 16 }]}
    >
      <Text style={styles.title}>🎰 Casino Strategy Test</Text>
      
      {strategy ? (
        <View>
          <Text style={styles.sectionTitle}>Portfolio Summary</Text>
          <Text style={styles.text}>Total Cruises: {strategy.totals.totalCruises}</Text>
          <Text style={styles.text}>Total Coin-In: ${strategy.totals.totalCoinIn.toLocaleString()}</Text>
          <Text style={styles.text}>Total Risk: ${strategy.totals.totalActualRisk.toLocaleString()}</Text>
          <Text style={styles.text}>Portfolio Multiplier: {strategy.totals.portfolioMultiplier.toFixed(1)}x</Text>
          <Text style={styles.text}>Average ROI: {strategy.totals.averageROI.toFixed(0)}%</Text>
          
          <Text style={styles.sectionTitle}>Strategic Insights</Text>
          <Text style={styles.insight}>{strategy.insights.casinosPerspective}</Text>
          <Text style={styles.insight}>{strategy.insights.yourReality}</Text>
          <Text style={styles.insight}>{strategy.insights.strategicAdvantage}</Text>
          
          <Text style={styles.sectionTitle}>Risk Analysis</Text>
          <Text style={styles.text}>Inflation Ratio: {insights.coinInVsRisk.inflationRatio.toFixed(1)}x</Text>
          <Text style={styles.text}>Consistent Returns: {insights.roiAnalysis.consistentReturns}/{strategy.totals.totalCruises}</Text>
          <Text style={styles.text}>Jackpot Protection: {insights.strategy.riskManagement.jackpotProtection} cruises</Text>
          
          <Text style={styles.sectionTitle}>Top 3 Cruises by ROI</Text>
          {strategy.cruises
            .sort((a, b) => b.roi - a.roi)
            .slice(0, 3)
            .map((cruise, index) => (
              <View key={cruise.id} style={styles.cruiseItem}>
                <Text style={styles.cruiseTitle}>#{index + 1} {cruise.ship}</Text>
                <Text style={styles.text}>ROI: {cruise.roi.toFixed(0)}%</Text>
                <Text style={styles.text}>Points: {cruise.pointsEarned.toLocaleString()}</Text>
                <Text style={styles.text}>Risk: ${cruise.actualCashRisk}</Text>
                <Text style={styles.text}>Multiplier: {cruise.riskMultiplier.toFixed(1)}x</Text>
              </View>
            ))}
        </View>
      ) : (
        <Text style={styles.loading}>Loading casino strategy data...</Text>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  content: {
    padding: 16,
    paddingBottom: 100,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: COLORS.text,
    marginBottom: 24,
    textAlign: 'center',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: COLORS.text,
    marginTop: 20,
    marginBottom: 12,
  },
  text: {
    fontSize: 14,
    color: COLORS.text,
    marginBottom: 8,
  },
  insight: {
    fontSize: 14,
    color: COLORS.textSecondary,
    marginBottom: 12,
    lineHeight: 20,
    fontStyle: 'italic',
  },
  loading: {
    fontSize: 16,
    color: COLORS.textSecondary,
    textAlign: 'center',
    marginTop: 50,
  },
  cruiseItem: {
    backgroundColor: COLORS.white,
    padding: 12,
    borderRadius: 8,
    marginBottom: 8,
  },
  cruiseTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.text,
    marginBottom: 4,
  },
});