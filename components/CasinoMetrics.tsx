import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

export interface CasinoMetricsProps {
  coinIn: number;
  points: number;
  valuePerPoint: number;
  netResult: number;
  actualCostPerPoint?: number;
  actualCoinIn?: number;
  testID?: string;
}

export default function CasinoMetrics({ coinIn, points, valuePerPoint, netResult, actualCostPerPoint, actualCoinIn, testID }: CasinoMetricsProps) {
  const netPositive = netResult >= 0;
  const hasActualData = typeof actualCostPerPoint === 'number' && typeof actualCoinIn === 'number';
  
  return (
    <View style={styles.card} testID={testID ?? 'casino-metrics'}>
      <Text style={styles.title}>Casino Metrics</Text>
      <View style={styles.grid}>
        <View style={styles.item}>
          <Text style={styles.label}>Theoretical Coin-In</Text>
          <Text style={styles.value}>${Math.max(0, Math.round(coinIn)).toLocaleString()}</Text>
          <Text style={styles.subtext}>@ $5/point</Text>
        </View>
        {hasActualData && (
          <View style={[styles.item, styles.highlight]}>
            <Text style={[styles.label, styles.highlightLabel]}>Actual Coin-In</Text>
            <Text style={[styles.value, styles.highlightValue]}>${Math.max(0, Math.round(actualCoinIn)).toLocaleString()}</Text>
            <Text style={styles.subtext}>@ ${actualCostPerPoint.toFixed(2)}/point</Text>
          </View>
        )}
        <View style={styles.item}>
          <Text style={styles.label}>Points Earned</Text>
          <Text style={styles.value}>{Math.max(0, Math.round(points)).toLocaleString()}</Text>
        </View>
        <View style={styles.item}>
          <Text style={styles.label}>Value/Point</Text>
          <Text style={styles.value}>${valuePerPoint.toFixed(2)}</Text>
        </View>
        <View style={[styles.item, netPositive ? styles.positive : styles.negative]}>
          <Text style={[styles.label, netPositive ? styles.posLabel : styles.negLabel]}>{netPositive ? 'Net Profit' : 'Net Loss'}</Text>
          <Text style={[styles.value, netPositive ? styles.posValue : styles.negValue]}>
            ${Math.abs(Math.round(netResult)).toLocaleString()}
          </Text>
        </View>
      </View>
      <View style={styles.note}>
        <Text style={styles.noteText}>
          {hasActualData 
            ? `Actual cost per point: ${actualCostPerPoint.toFixed(2)} (based on your real spending). Theoretical: $5/point.`
            : 'Theoretical coin-in estimated at 1 point per $5.'}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    marginBottom: 16,
  },
  title: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 12,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  item: {
    flex: 1,
    minWidth: '45%',
    backgroundColor: '#F8FAFC',
    borderRadius: 8,
    padding: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  label: {
    fontSize: 12,
    color: '#6B7280',
    marginBottom: 6,
  },
  value: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111827',
  },
  positive: {
    backgroundColor: '#ECFDF5',
    borderColor: '#22C55E',
  },
  negative: {
    backgroundColor: '#FEF2F2',
    borderColor: '#EF4444',
  },
  posLabel: {
    color: '#16A34A',
  },
  negLabel: {
    color: '#DC2626',
  },
  posValue: {
    color: '#16A34A',
  },
  negValue: {
    color: '#DC2626',
  },
  note: {
    marginTop: 10,
    backgroundColor: '#F3F4F6',
    borderRadius: 8,
    padding: 10,
  },
  noteText: {
    fontSize: 11,
    color: '#6B7280',
    lineHeight: 16,
  },
  subtext: {
    fontSize: 10,
    color: '#9CA3AF',
    marginTop: 2,
  },
  highlight: {
    backgroundColor: '#EFF6FF',
    borderColor: '#3B82F6',
  },
  highlightLabel: {
    color: '#1E40AF',
  },
  highlightValue: {
    color: '#1E40AF',
  },
});
