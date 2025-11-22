import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Dimensions } from 'react-native';
import { useRouter } from 'expo-router';
import { COLORS } from '@/constants/theme';
import { TrendingUp, ArrowLeft } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useSimpleAnalytics, calculateCruiseROI } from '@/state/SimpleAnalyticsProvider';

const CHART_HEIGHT = 140 as const;
const CHART_PADDING = 12 as const;

export default function AnalyticsChartsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const analytics = useSimpleAnalytics();

  const roiSeries = React.useMemo(() => {
    const months = 12;
    const now = new Date();
    const monthlyData: Record<string, { totalSavings: number; totalSpent: number; count: number }> = {};
    
    for (let i = months - 1; i >= 0; i--) {
      const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const monthKey = date.toISOString().slice(0, 7);
      monthlyData[monthKey] = { totalSavings: 0, totalSpent: 0, count: 0 };
    }
    
    analytics.cruises.forEach(cruise => {
      const sailDate = new Date(cruise.sailDate);
      const monthKey = sailDate.toISOString().slice(0, 7);
      
      if (monthlyData[monthKey]) {
        const roi = calculateCruiseROI(cruise);
        const retailValue = (cruise.retailCabin ?? 0) + (cruise.retailExtras ?? 0);
        const totalLaidOut = (cruise.amountPaid || 0) + (cruise.taxesFees || 0) - (cruise.usedCruiseCertificate || 0);
        const netCost = totalLaidOut - (cruise.winnings || 0);
        const savings = retailValue - netCost;
        
        monthlyData[monthKey].totalSavings += savings;
        monthlyData[monthKey].totalSpent += totalLaidOut;
        monthlyData[monthKey].count++;
      }
    });
    
    return Object.entries(monthlyData).map(([month, data]) => {
      const roi = data.totalSpent > 0 ? (data.totalSavings / data.totalSpent) * 100 : 0;
      const date = new Date(month + '-01');
      return {
        month,
        monthName: date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' }),
        roi,
        count: data.count
      };
    }).filter(m => m.count > 0);
  }, [analytics.cruises]);

  const maxRoi = Math.max(100, ...roiSeries.map(p => p.roi));
  const width = Dimensions.get('window').width - 24; // padding margins
  const pointCount = roiSeries.length;
  const gap = 10;
  const barWidth = Math.max(8, Math.floor((width - CHART_PADDING * 2 - (pointCount - 1) * gap) / pointCount));

  return (
    <View style={styles.container}>
      <ScrollView style={styles.container} contentContainerStyle={[styles.content, { paddingTop: insets.top + 12 }]}>        <View style={styles.header}>
          <TouchableOpacity style={styles.backBtn} onPress={() => router.back()} accessibilityRole="button" testID="charts-back">
            <ArrowLeft size={16} color={COLORS.white} />
          </TouchableOpacity>
          <View style={styles.headerTitleWrap}>
            <TrendingUp size={18} color={COLORS.white} />
            <Text style={styles.headerTitle}>Charts & Trends</Text>
          </View>
          <Text style={styles.headerSub}>Step 17 • ROI Trend (12 months)</Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>ROI Trend</Text>
          <Text style={styles.cardSub}>Savings vs Spend by month</Text>

          <View style={styles.chart}>
            <View style={styles.yAxis}>
              <Text style={styles.yTick}>{Math.round(maxRoi)}%</Text>
              <Text style={styles.yTick}>{Math.round(maxRoi / 2)}%</Text>
              <Text style={styles.yTick}>0%</Text>
            </View>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.chartScroll}
              testID="roi-chart"
            >
              {roiSeries.map((pt, idx) => {
                const h = Math.max(2, Math.round((pt.roi / maxRoi) * (CHART_HEIGHT - CHART_PADDING * 2)));
                return (
                  <View key={`${pt.month}-${idx}`} style={[styles.barWrap, { marginRight: idx === roiSeries.length - 1 ? 0 : gap }]}
                    accessibilityLabel={`${pt.monthName} ROI ${pt.roi.toFixed(0)}%`}>
                    <View style={[styles.bar, { height: h, width: barWidth }]} />
                    <Text style={styles.xLabel} numberOfLines={1}>{new Date(pt.month + '-01').toLocaleDateString('en-US', { month: 'short' })}</Text>
                  </View>
                );
              })}
            </ScrollView>
          </View>

          <View style={styles.legendRow}>
            <View style={[styles.legendDot, { backgroundColor: COLORS.primary }]} />
            <Text style={styles.legendText}>ROI % per month</Text>
          </View>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Details</Text>
          <View style={styles.detailList}>
            {roiSeries.map((pt) => (
              <View key={`row-${pt.month}`} style={styles.detailRow} testID={`roi-row-${pt.month}`}>
                <Text style={styles.detailMonth}>{pt.monthName}</Text>
                <Text style={styles.detailValue}>{pt.roi.toFixed(1)}%</Text>
              </View>
            ))}
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  content: {
    padding: 12,
    paddingBottom: 28,
  },
  header: {
    backgroundColor: COLORS.primary,
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  backBtn: {
    backgroundColor: 'rgba(255,255,255,0.15)',
    width: 32,
    height: 32,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  headerTitleWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  headerTitle: {
    color: COLORS.white,
    fontSize: 20,
    fontWeight: '700',
  },
  headerSub: {
    color: 'rgba(255,255,255,0.85)',
    fontSize: 12,
  },
  card: {
    backgroundColor: COLORS.white,
    borderRadius: 12,
    padding: 12,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.text,
  },
  cardSub: {
    fontSize: 12,
    color: COLORS.textSecondary,
    marginBottom: 8,
  },
  chart: {
    height: CHART_HEIGHT,
    flexDirection: 'row',
    paddingHorizontal: CHART_PADDING,
    paddingVertical: CHART_PADDING,
  },
  yAxis: {
    width: 44,
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingVertical: 4,
  },
  yTick: {
    fontSize: 10,
    color: COLORS.textSecondary,
  },
  chartScroll: {
    alignItems: 'flex-end',
    paddingBottom: 4,
  },
  barWrap: {
    alignItems: 'center',
    justifyContent: 'flex-end',
  },
  bar: {
    backgroundColor: COLORS.primary,
    borderTopLeftRadius: 6,
    borderTopRightRadius: 6,
  },
  xLabel: {
    fontSize: 10,
    color: COLORS.textSecondary,
    marginTop: 6,
    width: 28,
    textAlign: 'center',
  },
  legendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 8,
  },
  legendDot: {
    width: 10,
    height: 10,
    borderRadius: 6,
  },
  legendText: {
    fontSize: 12,
    color: COLORS.textSecondary,
  },
  detailList: {
    marginTop: 8,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  detailMonth: {
    fontSize: 12,
    color: COLORS.text,
    fontWeight: '600',
  },
  detailValue: {
    fontSize: 12,
    color: COLORS.text,
    fontWeight: '700',
  },
  loadingText: {
    color: COLORS.text,
  },
  errorTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.text,
    marginBottom: 6,
  },
  errorText: {
    fontSize: 12,
    color: COLORS.textSecondary,
    marginBottom: 10,
  },
  retryBtn: {
    backgroundColor: COLORS.primary,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    alignSelf: 'flex-start',
  },
  retryText: {
    color: 'white',
    fontSize: 12,
    fontWeight: '700',
  },
});
