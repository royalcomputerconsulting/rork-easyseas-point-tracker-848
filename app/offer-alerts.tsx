import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { Stack } from 'expo-router';
import { useState, useEffect } from 'react';
import { trpc } from '@/lib/trpc';
import { Bell, Clock, TrendingUp, AlertCircle, CheckCircle, Calendar } from 'lucide-react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

const getUrgencyColor = (level: string) => {
  switch (level) {
    case 'critical': return '#EF4444';
    case 'high': return '#F97316';
    case 'medium': return '#EAB308';
    case 'low': return '#6B7280';
    default: return '#6B7280';
  }
};

const formatTimeRemaining = (daysLeft: number): string => {
  if (daysLeft === 0) return 'Expires Today';
  if (daysLeft === 1) return '1 Day Left';
  if (daysLeft <= 7) return `${daysLeft} Days Left`;
  if (daysLeft <= 30) return `${daysLeft} Days Left`;
  return `${Math.floor(daysLeft / 30)} Month${Math.floor(daysLeft / 30) > 1 ? 's' : ''} Left`;
};

export default function OfferAlertsScreen() {
  const [threshold] = useState<number>(30);
  
  const expiringQuery = trpc.intelligence.offerAlerts.getExpiring.useQuery({
    daysThreshold: threshold,
    includeMatching: true
  });
  
  const autoMatchQuery = trpc.intelligence.offerAlerts.autoMatch.useQuery({
    minValue: 200
  });

  useEffect(() => {
    const interval = setInterval(() => {
      expiringQuery.refetch();
      autoMatchQuery.refetch();
    }, 60000);
    
    return () => clearInterval(interval);
  }, [expiringQuery, autoMatchQuery]);

  if (expiringQuery.isLoading || autoMatchQuery.isLoading) {
    return (
      <View style={styles.container}>
        <Stack.Screen options={{ 
          title: 'Offer Alerts',
          headerStyle: { backgroundColor: '#0F172A' },
          headerTintColor: '#fff'
        }} />
        <SafeAreaView style={styles.safeArea} edges={['bottom']}>
          <View style={styles.loadingContainer}>
            <Text style={styles.loadingText}>Loading alerts...</Text>
          </View>
        </SafeAreaView>
      </View>
    );
  }

  const { offers: expiringOffers, summary } = expiringQuery.data || { offers: [], summary: null };
  const { matches: autoMatches, summary: matchSummary } = autoMatchQuery.data || { matches: [], summary: null };

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ 
        title: 'Offer Alerts',
        headerStyle: { backgroundColor: '#0F172A' },
        headerTintColor: '#fff'
      }} />
      <SafeAreaView style={styles.safeArea} edges={['bottom']}>
        <ScrollView 
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {summary && (
            <View style={styles.summaryCard}>
              <View style={styles.summaryHeader}>
                <Bell color="#F97316" size={24} />
                <Text style={styles.summaryTitle}>Alert Summary</Text>
              </View>
              <View style={styles.summaryGrid}>
                <View style={styles.summaryItem}>
                  <Text style={[styles.summaryValue, { color: '#EF4444' }]}>{summary.critical}</Text>
                  <Text style={styles.summaryLabel}>Critical</Text>
                </View>
                <View style={styles.summaryItem}>
                  <Text style={[styles.summaryValue, { color: '#F97316' }]}>{summary.high}</Text>
                  <Text style={styles.summaryLabel}>High</Text>
                </View>
                <View style={styles.summaryItem}>
                  <Text style={[styles.summaryValue, { color: '#EAB308' }]}>{summary.medium}</Text>
                  <Text style={styles.summaryLabel}>Medium</Text>
                </View>
                <View style={styles.summaryItem}>
                  <Text style={[styles.summaryValue, { color: '#10B981' }]}>${summary.totalValue.toLocaleString()}</Text>
                  <Text style={styles.summaryLabel}>Total Value</Text>
                </View>
              </View>
            </View>
          )}

          {matchSummary && matchSummary.criticalAlerts > 0 && (
            <View style={[styles.alertBanner, { backgroundColor: '#FEE2E2' }]}>
              <AlertCircle color="#DC2626" size={20} />
              <Text style={[styles.alertText, { color: '#DC2626' }]}>
                {matchSummary.criticalAlerts} critical alert{matchSummary.criticalAlerts > 1 ? 's' : ''} requiring immediate action!
              </Text>
            </View>
          )}

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Expiring Soon ({expiringOffers.length})</Text>
            {expiringOffers.length === 0 ? (
              <View style={styles.emptyState}>
                <CheckCircle color="#10B981" size={48} />
                <Text style={styles.emptyText}>No offers expiring in the next {threshold} days</Text>
              </View>
            ) : (
              expiringOffers.map((item) => (
                <TouchableOpacity
                  key={item.offer.id}
                  style={[styles.offerCard, { borderLeftColor: getUrgencyColor(item.urgency.level) }]}
                  activeOpacity={0.7}
                >
                  <View style={styles.offerHeader}>
                    <View style={styles.offerTitleRow}>
                      <Text style={styles.offerName}>{item.offer.offerName}</Text>
                      <View style={[styles.urgencyBadge, { backgroundColor: getUrgencyColor(item.urgency.level) }]}>
                        <Text style={styles.urgencyText}>{item.urgency.level.toUpperCase()}</Text>
                      </View>
                    </View>
                    <Text style={styles.offerCode}>{item.offer.offerCode}</Text>
                  </View>

                  <View style={styles.timeContainer}>
                    <Clock color="#F97316" size={16} />
                    <Text style={styles.timeText}>{formatTimeRemaining(item.daysLeft)}</Text>
                    <Text style={styles.timeSubtext}>• Expires {new Date(item.offer.expires).toLocaleDateString()}</Text>
                  </View>

                  <View style={styles.valueRow}>
                    <TrendingUp color="#10B981" size={16} />
                    <Text style={styles.valueText}>Offer Value: ${item.offerValue.toLocaleString()}</Text>
                  </View>

                  {item.matchCount > 0 && (
                    <View style={styles.matchesContainer}>
                      <Text style={styles.matchesTitle}>
                        {item.matchCount} Matching Cruise{item.matchCount > 1 ? 's' : ''}
                      </Text>
                      {item.matchedCruises.slice(0, 2).map((cruise) => (
                        <View key={cruise.id} style={styles.cruiseMatch}>
                          <Calendar color="#94A3B8" size={14} />
                          <Text style={styles.cruiseText} numberOfLines={1}>
                            {cruise.ship} • {cruise.nights}N • {new Date(cruise.departureDate).toLocaleDateString()}
                          </Text>
                        </View>
                      ))}
                      {item.matchCount > 2 && (
                        <Text style={styles.moreText}>+{item.matchCount - 2} more</Text>
                      )}
                    </View>
                  )}

                  <Text style={styles.recommendationText}>{item.urgency.reason}</Text>
                </TouchableOpacity>
              ))
            )}
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Auto-Matched Offers ({autoMatches.length})</Text>
            {autoMatches.slice(0, 5).map((match) => (
              <View key={match.offer.id} style={styles.matchCard}>
                <View style={styles.matchHeader}>
                  <Text style={styles.matchOfferName}>{match.offer.name}</Text>
                  <Text style={styles.matchValue}>${match.offer.value.toLocaleString()}</Text>
                </View>
                <Text style={styles.matchCode}>{match.offer.code}</Text>
                
                {match.bestMatch && (
                  <View style={styles.bestMatchContainer}>
                    <Text style={styles.bestMatchLabel}>Best Match:</Text>
                    <Text style={styles.bestMatchShip}>{match.bestMatch.ship}</Text>
                    <View style={styles.bestMatchDetails}>
                      <Text style={styles.bestMatchText}>{match.bestMatch.itineraryName}</Text>
                      <Text style={styles.bestMatchSavings}>
                        Save ${match.bestMatch.savingsWithOffer.toLocaleString()}
                      </Text>
                    </View>
                  </View>
                )}

                <Text style={styles.matchRecommendation}>{match.recommendation}</Text>
              </View>
            ))}
          </View>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0F172A',
  },
  safeArea: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    color: '#94A3B8',
    fontSize: 16,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
  },
  summaryCard: {
    backgroundColor: '#1E293B',
    borderRadius: 16,
    padding: 20,
    marginBottom: 20,
  },
  summaryHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 20,
  },
  summaryTitle: {
    fontSize: 20,
    fontWeight: '700' as const,
    color: '#F1F5F9',
  },
  summaryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 16,
  },
  summaryItem: {
    flex: 1,
    minWidth: '45%',
    alignItems: 'center',
    padding: 12,
    backgroundColor: '#0F172A',
    borderRadius: 12,
  },
  summaryValue: {
    fontSize: 24,
    fontWeight: '700' as const,
    marginBottom: 4,
  },
  summaryLabel: {
    fontSize: 12,
    color: '#94A3B8',
    fontWeight: '500' as const,
  },
  alertBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 16,
    borderRadius: 12,
    marginBottom: 20,
  },
  alertText: {
    flex: 1,
    fontSize: 14,
    fontWeight: '600' as const,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700' as const,
    color: '#F1F5F9',
    marginBottom: 12,
  },
  emptyState: {
    alignItems: 'center',
    padding: 40,
    backgroundColor: '#1E293B',
    borderRadius: 16,
  },
  emptyText: {
    color: '#94A3B8',
    fontSize: 16,
    marginTop: 16,
    textAlign: 'center',
  },
  offerCard: {
    backgroundColor: '#1E293B',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    borderLeftWidth: 4,
  },
  offerHeader: {
    marginBottom: 12,
  },
  offerTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  offerName: {
    fontSize: 16,
    fontWeight: '700' as const,
    color: '#F1F5F9',
    flex: 1,
    marginRight: 8,
  },
  urgencyBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  urgencyText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '700' as const,
  },
  offerCode: {
    fontSize: 14,
    color: '#94A3B8',
    fontWeight: '500' as const,
  },
  timeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: '#0F172A',
    borderRadius: 8,
  },
  timeText: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: '#F97316',
  },
  timeSubtext: {
    fontSize: 12,
    color: '#64748B',
  },
  valueRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  valueText: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: '#10B981',
  },
  matchesContainer: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#334155',
  },
  matchesTitle: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: '#F1F5F9',
    marginBottom: 8,
  },
  cruiseMatch: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  cruiseText: {
    fontSize: 12,
    color: '#94A3B8',
    flex: 1,
  },
  moreText: {
    fontSize: 12,
    color: '#64748B',
    fontStyle: 'italic' as const,
    marginTop: 4,
  },
  recommendationText: {
    fontSize: 13,
    color: '#CBD5E1',
    marginTop: 8,
    fontStyle: 'italic' as const,
  },
  matchCard: {
    backgroundColor: '#1E293B',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#334155',
  },
  matchHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  matchOfferName: {
    fontSize: 16,
    fontWeight: '700' as const,
    color: '#F1F5F9',
    flex: 1,
  },
  matchValue: {
    fontSize: 18,
    fontWeight: '700' as const,
    color: '#10B981',
  },
  matchCode: {
    fontSize: 12,
    color: '#64748B',
    marginBottom: 12,
  },
  bestMatchContainer: {
    backgroundColor: '#0F172A',
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
  },
  bestMatchLabel: {
    fontSize: 12,
    color: '#94A3B8',
    marginBottom: 4,
  },
  bestMatchShip: {
    fontSize: 16,
    fontWeight: '700' as const,
    color: '#F1F5F9',
    marginBottom: 4,
  },
  bestMatchDetails: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  bestMatchText: {
    fontSize: 14,
    color: '#CBD5E1',
    flex: 1,
  },
  bestMatchSavings: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: '#10B981',
  },
  matchRecommendation: {
    fontSize: 13,
    color: '#CBD5E1',
    fontStyle: 'italic' as const,
  },
});
