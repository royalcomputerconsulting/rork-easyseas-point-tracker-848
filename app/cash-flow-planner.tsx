import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  TouchableOpacity,
  TextInput,
} from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { trpc } from '@/lib/trpc';
import { DollarSign, TrendingUp, TrendingDown, AlertCircle, CheckCircle, Info } from 'lucide-react-native';

export default function CashFlowPlannerScreen() {
  const router = useRouter();
  const [monthsAhead, setMonthsAhead] = useState<string>('12');
  const [monthlyBudget, setMonthlyBudget] = useState<string>('');
  const [yearlyBudget, setYearlyBudget] = useState<string>('');

  const cashFlowQuery = trpc.analytics.cashFlowPlanner.useQuery({
    monthsAhead: parseInt(monthsAhead) || 12,
    monthlyBudget: monthlyBudget ? parseFloat(monthlyBudget) : undefined,
    yearlyBudget: yearlyBudget ? parseFloat(yearlyBudget) : undefined,
  });

  if (cashFlowQuery.isLoading) {
    return (
      <View style={styles.container}>
        <Stack.Screen
          options={{
            title: 'Cash Flow Planner',
            headerStyle: { backgroundColor: '#1a1a2e' },
            headerTintColor: '#fff',
          }}
        />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#4a90e2" />
          <Text style={styles.loadingText}>Analyzing cash flow...</Text>
        </View>
      </View>
    );
  }

  if (cashFlowQuery.error) {
    return (
      <View style={styles.container}>
        <Stack.Screen
          options={{
            title: 'Cash Flow Planner',
            headerStyle: { backgroundColor: '#1a1a2e' },
            headerTintColor: '#fff',
          }}
        />
        <View style={styles.errorContainer}>
          <AlertCircle size={48} color="#ef4444" />
          <Text style={styles.errorText}>Failed to load cash flow data</Text>
          <Text style={styles.errorDetail}>{cashFlowQuery.error.message}</Text>
        </View>
      </View>
    );
  }

  const data = cashFlowQuery.data;
  if (!data) return null;

  const getAlertColor = (type: string) => {
    switch (type) {
      case 'danger':
        return '#ef4444';
      case 'warning':
        return '#f59e0b';
      case 'info':
      default:
        return '#4a90e2';
    }
  };

  const getAlertIcon = (type: string) => {
    switch (type) {
      case 'danger':
        return AlertCircle;
      case 'warning':
        return AlertCircle;
      case 'info':
      default:
        return Info;
    }
  };

  return (
    <View style={styles.container}>
      <Stack.Screen
        options={{
          title: 'Cash Flow Planner',
          headerStyle: { backgroundColor: '#1a1a2e' },
          headerTintColor: '#fff',
        }}
      />
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        {/* Budget Settings */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Budget Settings</Text>
          <View style={styles.inputRow}>
            <View style={styles.inputContainer}>
              <Text style={styles.inputLabel}>Projection Period (months)</Text>
              <TextInput
                style={styles.input}
                value={monthsAhead}
                onChangeText={setMonthsAhead}
                keyboardType="number-pad"
                placeholder="12"
                placeholderTextColor="#666"
              />
            </View>
          </View>
          <View style={styles.inputRow}>
            <View style={styles.inputContainer}>
              <Text style={styles.inputLabel}>Monthly Budget ($)</Text>
              <TextInput
                style={styles.input}
                value={monthlyBudget}
                onChangeText={setMonthlyBudget}
                keyboardType="decimal-pad"
                placeholder="Optional"
                placeholderTextColor="#666"
              />
            </View>
            <View style={styles.inputContainer}>
              <Text style={styles.inputLabel}>Yearly Budget ($)</Text>
              <TextInput
                style={styles.input}
                value={yearlyBudget}
                onChangeText={setYearlyBudget}
                keyboardType="decimal-pad"
                placeholder="Optional"
                placeholderTextColor="#666"
              />
            </View>
          </View>
        </View>

        {/* Summary Cards */}
        <View style={styles.summaryGrid}>
          <View style={[styles.summaryCard, { backgroundColor: '#1e3a5f' }]}>
            <DollarSign size={24} color="#4a90e2" />
            <Text style={styles.summaryValue}>
              ${data.summary.totalProjectedSpend.toLocaleString()}
            </Text>
            <Text style={styles.summaryLabel}>Total Projected Spend</Text>
          </View>
          <View style={[styles.summaryCard, { backgroundColor: '#2d5a3f' }]}>
            <TrendingUp size={24} color="#10b981" />
            <Text style={styles.summaryValue}>
              ${data.summary.totalCertificateValue.toLocaleString()}
            </Text>
            <Text style={styles.summaryLabel}>Certificate Value</Text>
          </View>
          <View style={[styles.summaryCard, { backgroundColor: '#5a3f2d' }]}>
            <DollarSign size={24} color="#f59e0b" />
            <Text style={styles.summaryValue}>
              ${data.summary.netProjectedCash.toLocaleString()}
            </Text>
            <Text style={styles.summaryLabel}>Net Cash Position</Text>
          </View>
          <View style={[styles.summaryCard, { backgroundColor: '#3a2d5a' }]}>
            <TrendingUp size={24} color="#8b5cf6" />
            <Text style={styles.summaryValue}>
              {data.summary.totalProjectedPoints.toLocaleString()}
            </Text>
            <Text style={styles.summaryLabel}>Projected Points</Text>
          </View>
        </View>

        {/* Spending Alerts */}
        {data.spendingAlerts.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Spending Alerts</Text>
            {data.spendingAlerts.map((alert, index) => {
              const Icon = getAlertIcon(alert.type);
              return (
                <View
                  key={index}
                  style={[
                    styles.alertCard,
                    { borderLeftColor: getAlertColor(alert.type) },
                  ]}
                >
                  <Icon size={20} color={getAlertColor(alert.type)} />
                  <View style={styles.alertContent}>
                    <Text style={styles.alertMessage}>{alert.message}</Text>
                    <Text style={styles.alertDetail}>
                      Current: ${alert.currentPace.toLocaleString()} | Target: $
                      {alert.targetPace.toLocaleString()}
                    </Text>
                  </View>
                </View>
              );
            })}
          </View>
        )}

        {/* Monthly Projections */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Monthly Projections</Text>
          {data.monthlyProjections.map((month, index) => (
            <View key={index} style={styles.monthCard}>
              <View style={styles.monthHeader}>
                <Text style={styles.monthName}>{month.month}</Text>
                {month.cruisesBooked > 0 && (
                  <View style={styles.badge}>
                    <Text style={styles.badgeText}>
                      {month.cruisesBooked} cruise{month.cruisesBooked > 1 ? 's' : ''}
                    </Text>
                  </View>
                )}
              </View>
              <View style={styles.monthMetrics}>
                <View style={styles.metric}>
                  <Text style={styles.metricLabel}>Cruise Spend</Text>
                  <Text style={styles.metricValue}>
                    ${month.cruiseSpend.toLocaleString()}
                  </Text>
                </View>
                <View style={styles.metric}>
                  <Text style={styles.metricLabel}>Certificates</Text>
                  <Text style={[styles.metricValue, { color: '#10b981' }]}>
                    -${month.certificatesUsed.toLocaleString()}
                  </Text>
                </View>
                <View style={styles.metric}>
                  <Text style={styles.metricLabel}>Net Cash</Text>
                  <Text
                    style={[
                      styles.metricValue,
                      { color: month.netCash > 0 ? '#ef4444' : '#10b981' },
                    ]}
                  >
                    ${month.netCash.toLocaleString()}
                  </Text>
                </View>
                <View style={styles.metric}>
                  <Text style={styles.metricLabel}>Points</Text>
                  <Text style={[styles.metricValue, { color: '#8b5cf6' }]}>
                    {month.projectedPoints.toLocaleString()}
                  </Text>
                </View>
              </View>
            </View>
          ))}
        </View>

        {/* Certificate Balances */}
        {data.certificateBalances.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Certificate Inventory</Text>
            {data.certificateBalances.map((cert, index) => (
              <View key={index} style={styles.certCard}>
                <View style={styles.certHeader}>
                  <Text style={styles.certType}>{cert.type}</Text>
                  <Text style={styles.certCount}>
                    {cert.count} certificate{cert.count > 1 ? 's' : ''}
                  </Text>
                </View>
                <Text style={styles.certValue}>
                  Total Value: ${cert.totalValue.toLocaleString()}
                </Text>
                <View style={styles.certExpiry}>
                  <View style={styles.expiryItem}>
                    <Text style={[styles.expiryLabel, { color: '#ef4444' }]}>
                      30 days
                    </Text>
                    <Text style={styles.expiryValue}>{cert.expiringIn30Days}</Text>
                  </View>
                  <View style={styles.expiryItem}>
                    <Text style={[styles.expiryLabel, { color: '#f59e0b' }]}>
                      60 days
                    </Text>
                    <Text style={styles.expiryValue}>{cert.expiringIn60Days}</Text>
                  </View>
                  <View style={styles.expiryItem}>
                    <Text style={[styles.expiryLabel, { color: '#4a90e2' }]}>
                      90 days
                    </Text>
                    <Text style={styles.expiryValue}>{cert.expiringIn90Days}</Text>
                  </View>
                </View>
              </View>
            ))}
          </View>
        )}

        {/* Redemption Strategy */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Redemption Strategy</Text>
          
          {data.redemptionStrategy.immediateAction.length > 0 && (
            <View style={styles.strategySection}>
              <Text style={[styles.strategyTitle, { color: '#ef4444' }]}>
                Immediate Action Required
              </Text>
              {data.redemptionStrategy.immediateAction.map((item, index) => (
                <View key={index} style={styles.strategyItem}>
                  <AlertCircle size={16} color="#ef4444" />
                  <Text style={styles.strategyText}>{item}</Text>
                </View>
              ))}
            </View>
          )}

          {data.redemptionStrategy.upcomingOpportunities.length > 0 && (
            <View style={styles.strategySection}>
              <Text style={[styles.strategyTitle, { color: '#f59e0b' }]}>
                Upcoming Opportunities
              </Text>
              {data.redemptionStrategy.upcomingOpportunities.map((item, index) => (
                <View key={index} style={styles.strategyItem}>
                  <Info size={16} color="#f59e0b" />
                  <Text style={styles.strategyText}>{item}</Text>
                </View>
              ))}
            </View>
          )}

          {data.redemptionStrategy.longTermPlan.length > 0 && (
            <View style={styles.strategySection}>
              <Text style={[styles.strategyTitle, { color: '#10b981' }]}>
                Long-Term Plan
              </Text>
              {data.redemptionStrategy.longTermPlan.map((item, index) => (
                <View key={index} style={styles.strategyItem}>
                  <CheckCircle size={16} color="#10b981" />
                  <Text style={styles.strategyText}>{item}</Text>
                </View>
              ))}
            </View>
          )}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f0f1e',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#fff',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  errorText: {
    marginTop: 16,
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
  },
  errorDetail: {
    marginTop: 8,
    fontSize: 14,
    color: '#999',
    textAlign: 'center',
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#fff',
    marginBottom: 16,
  },
  inputRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 12,
  },
  inputContainer: {
    flex: 1,
  },
  inputLabel: {
    fontSize: 14,
    color: '#999',
    marginBottom: 8,
  },
  input: {
    backgroundColor: '#1a1a2e',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    color: '#fff',
    borderWidth: 1,
    borderColor: '#2a2a3e',
  },
  summaryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 24,
  },
  summaryCard: {
    flex: 1,
    minWidth: '45%',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  summaryValue: {
    fontSize: 24,
    fontWeight: '700',
    color: '#fff',
    marginTop: 8,
  },
  summaryLabel: {
    fontSize: 12,
    color: '#999',
    marginTop: 4,
    textAlign: 'center',
  },
  alertCard: {
    flexDirection: 'row',
    backgroundColor: '#1a1a2e',
    borderRadius: 8,
    padding: 16,
    marginBottom: 12,
    borderLeftWidth: 4,
    alignItems: 'flex-start',
    gap: 12,
  },
  alertContent: {
    flex: 1,
  },
  alertMessage: {
    fontSize: 14,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 4,
  },
  alertDetail: {
    fontSize: 12,
    color: '#999',
  },
  monthCard: {
    backgroundColor: '#1a1a2e',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  monthHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  monthName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
  badge: {
    backgroundColor: '#4a90e2',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
  },
  badgeText: {
    fontSize: 12,
    color: '#fff',
    fontWeight: '600',
  },
  monthMetrics: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 16,
  },
  metric: {
    flex: 1,
    minWidth: '40%',
  },
  metricLabel: {
    fontSize: 12,
    color: '#999',
    marginBottom: 4,
  },
  metricValue: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
  certCard: {
    backgroundColor: '#1a1a2e',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  certHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  certType: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
  certCount: {
    fontSize: 14,
    color: '#999',
  },
  certValue: {
    fontSize: 14,
    color: '#4a90e2',
    marginBottom: 12,
  },
  certExpiry: {
    flexDirection: 'row',
    gap: 16,
  },
  expiryItem: {
    flex: 1,
  },
  expiryLabel: {
    fontSize: 11,
    fontWeight: '600',
    marginBottom: 4,
  },
  expiryValue: {
    fontSize: 16,
    fontWeight: '700',
    color: '#fff',
  },
  strategySection: {
    marginBottom: 20,
  },
  strategyTitle: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 12,
  },
  strategyItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    marginBottom: 8,
    backgroundColor: '#1a1a2e',
    padding: 12,
    borderRadius: 8,
  },
  strategyText: {
    flex: 1,
    fontSize: 14,
    color: '#fff',
    lineHeight: 20,
  },
});
