import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator } from 'react-native';
import { TrendingUp, Award, Clock, Scale, Sparkles, ChevronRight } from 'lucide-react-native';
import { trpc } from '@/lib/trpc';
import { router } from 'expo-router';

interface OfferValueInsightsProps {
  preferredCabinType?: 'INTERIOR' | 'OCEANVIEW' | 'BALCONY' | 'SUITE';
}

export function OfferValueInsights({ preferredCabinType }: OfferValueInsightsProps) {
  const rankingsQuery = trpc.casinoOffers.getOfferRankings.useQuery();
  
  if (rankingsQuery.isLoading) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <Sparkles size={18} color="#8B5CF6" />
          <Text style={styles.headerTitle}>Offer Intelligence</Text>
        </View>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#8B5CF6" />
          <Text style={styles.loadingText}>Analyzing offer values...</Text>
        </View>
      </View>
    );
  }
  
  if (rankingsQuery.error || !rankingsQuery.data) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <Sparkles size={18} color="#8B5CF6" />
          <Text style={styles.headerTitle}>Offer Intelligence</Text>
        </View>
        <View style={styles.errorCard}>
          <Text style={styles.errorText}>Unable to load offer insights</Text>
        </View>
      </View>
    );
  }
  
  const { overallStrength, singleSailingJackpot } = rankingsQuery.data;
  
  const top5OverallOffers = overallStrength.slice(0, 5);
  
  const bestOfferForCabin = preferredCabinType 
    ? overallStrength.find(o => 
        o.sampleCruises[0]?.normalizedCabinType === preferredCabinType
      )
    : null;
  
  const expiringOffers = overallStrength.filter(offer => {
    const expiryDate = new Date(offer.earliestExpiry);
    const daysUntilExpiry = Math.ceil((expiryDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
    return daysUntilExpiry <= 30 && daysUntilExpiry > 0;
  }).sort((a, b) => {
    const daysA = Math.ceil((new Date(a.earliestExpiry).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
    const daysB = Math.ceil((new Date(b.earliestExpiry).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
    return daysA - daysB;
  }).slice(0, 3);
  
  const offer2511A06 = overallStrength.find(o => o.offerCode === '2511A06');
  const fullRoomForTwoOffers = overallStrength.filter(o => 
    o.offerCode !== '2511A06' && o.avgCompValue > 0
  ).slice(0, 3);
  
  const formatCurrency = (value: number) => `$${Math.round(value).toLocaleString()}`;
  const formatDate = (dateStr: string) => new Date(dateStr).toLocaleDateString('en-US', { 
    month: 'short', 
    day: 'numeric',
    year: 'numeric'
  });
  
  const getDaysUntilExpiry = (dateStr: string) => {
    const days = Math.ceil((new Date(dateStr).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
    return days;
  };
  
  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Sparkles size={18} color="#8B5CF6" />
        <Text style={styles.headerTitle}>Offer Intelligence</Text>
      </View>
      
      <ScrollView 
        horizontal 
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.cardsContainer}
      >
        {/* Top 5 Most Valuable Offers This Month */}
        <View style={styles.insightCard}>
          <View style={styles.insightHeader}>
            <TrendingUp size={16} color="#16A34A" />
            <Text style={styles.insightTitle}>Top 5 Most Valuable Offers</Text>
          </View>
          <Text style={styles.insightSubtitle}>Highest total comp value</Text>
          
          <View style={styles.offersList}>
            {top5OverallOffers.map((offer, idx) => (
              <TouchableOpacity 
                key={offer.offerCode}
                style={styles.offerRow}
                onPress={() => {
                  // Navigate to offer details or cruises filtered by this offer
                  console.log('Navigate to offer:', offer.offerCode);
                }}
              >
                <View style={styles.offerRank}>
                  <Text style={styles.rankNumber}>{idx + 1}</Text>
                </View>
                <View style={styles.offerInfo}>
                  <Text style={styles.offerCode}>{offer.offerCode}</Text>
                  <Text style={styles.offerStats}>
                    {offer.numSailings} sailing{offer.numSailings > 1 ? 's' : ''} · {formatCurrency(offer.totalCompValue)} total
                  </Text>
                  <Text style={styles.offerAvg}>
                    Avg: {formatCurrency(offer.avgCompValue)} per sailing
                  </Text>
                </View>
                <ChevronRight size={16} color="#9CA3AF" />
              </TouchableOpacity>
            ))}
          </View>
        </View>
        
        {/* Best Offer for Preferred Cabin Type */}
        {preferredCabinType && bestOfferForCabin && (
          <View style={styles.insightCard}>
            <View style={styles.insightHeader}>
              <Award size={16} color="#F59E0B" />
              <Text style={styles.insightTitle}>Best for {preferredCabinType}</Text>
            </View>
            <Text style={styles.insightSubtitle}>Your preferred cabin type</Text>
            
            <View style={styles.featuredOffer}>
              <Text style={styles.featuredOfferCode}>{bestOfferForCabin.offerCode}</Text>
              <View style={styles.featuredMetrics}>
                <View style={styles.metricItem}>
                  <Text style={styles.metricLabel}>Total Value</Text>
                  <Text style={styles.metricValue}>{formatCurrency(bestOfferForCabin.totalCompValue)}</Text>
                </View>
                <View style={styles.metricItem}>
                  <Text style={styles.metricLabel}>Avg Per Sailing</Text>
                  <Text style={styles.metricValue}>{formatCurrency(bestOfferForCabin.avgCompValue)}</Text>
                </View>
                <View style={styles.metricItem}>
                  <Text style={styles.metricLabel}>Sailings</Text>
                  <Text style={styles.metricValue}>{bestOfferForCabin.numSailings}</Text>
                </View>
              </View>
              
              {bestOfferForCabin.sampleCruises[0] && (
                <View style={styles.sampleCruise}>
                  <Text style={styles.sampleLabel}>Sample cruise:</Text>
                  <Text style={styles.sampleShip}>{bestOfferForCabin.sampleCruises[0].shipName}</Text>
                  <Text style={styles.sampleDate}>
                    {formatDate(bestOfferForCabin.sampleCruises[0].sailingDate)}
                  </Text>
                </View>
              )}
            </View>
          </View>
        )}
        
        {/* Offers Expiring Soon with High Values */}
        {expiringOffers.length > 0 && (
          <View style={styles.insightCard}>
            <View style={styles.insightHeader}>
              <Clock size={16} color="#EF4444" />
              <Text style={styles.insightTitle}>Expiring Soon</Text>
            </View>
            <Text style={styles.insightSubtitle}>High-value offers ending within 30 days</Text>
            
            <View style={styles.offersList}>
              {expiringOffers.map((offer) => {
                const daysLeft = getDaysUntilExpiry(offer.earliestExpiry);
                const isUrgent = daysLeft <= 7;
                
                return (
                  <View key={offer.offerCode} style={styles.expiringOfferRow}>
                    <View style={[styles.urgencyBadge, isUrgent && styles.urgentBadge]}>
                      <Text style={[styles.urgencyText, isUrgent && styles.urgentText]}>
                        {daysLeft} day{daysLeft > 1 ? 's' : ''}
                      </Text>
                    </View>
                    <View style={styles.expiringOfferInfo}>
                      <Text style={styles.offerCode}>{offer.offerCode}</Text>
                      <Text style={styles.offerStats}>
                        Value: {formatCurrency(offer.totalCompValue)} · {offer.numSailings} sailing{offer.numSailings > 1 ? 's' : ''}
                      </Text>
                      <Text style={styles.expiryDate}>Expires {formatDate(offer.earliestExpiry)}</Text>
                    </View>
                  </View>
                );
              })}
            </View>
            
            {expiringOffers.length === 0 && (
              <View style={styles.emptyState}>
                <Text style={styles.emptyText}>No high-value offers expiring soon</Text>
              </View>
            )}
          </View>
        )}
        
        {/* 2511A06 vs Full Room for Two Comparison */}
        {offer2511A06 && fullRoomForTwoOffers.length > 0 && (
          <View style={styles.insightCard}>
            <View style={styles.insightHeader}>
              <Scale size={16} color="#8B5CF6" />
              <Text style={styles.insightTitle}>2511A06 vs Room for Two</Text>
            </View>
            <Text style={styles.insightSubtitle}>75% coverage special offer comparison</Text>
            
            <View style={styles.comparisonContainer}>
              <View style={styles.specialOfferSection}>
                <View style={styles.specialBadge}>
                  <Text style={styles.specialBadgeText}>SPECIAL</Text>
                </View>
                <Text style={styles.comparisonOfferCode}>{offer2511A06.offerCode}</Text>
                <Text style={styles.comparisonLabel}>1.5 shares (75% coverage)</Text>
                <View style={styles.comparisonMetrics}>
                  <Text style={styles.comparisonValue}>{formatCurrency(offer2511A06.totalCompValue)}</Text>
                  <Text style={styles.comparisonDetail}>total value</Text>
                  <Text style={styles.comparisonAvg}>{formatCurrency(offer2511A06.avgCompValue)} avg</Text>
                  <Text style={styles.comparisonSailings}>{offer2511A06.numSailings} sailings</Text>
                </View>
              </View>
              
              <View style={styles.divider} />
              
              <View style={styles.fullRoomSection}>
                <Text style={styles.comparisonSectionTitle}>Top Full Room Offers</Text>
                {fullRoomForTwoOffers.map((offer) => (
                  <View key={offer.offerCode} style={styles.comparisonOfferRow}>
                    <Text style={styles.comparisonOfferCode}>{offer.offerCode}</Text>
                    <Text style={styles.comparisonOfferValue}>{formatCurrency(offer.totalCompValue)}</Text>
                    <Text style={styles.comparisonOfferAvg}>
                      {formatCurrency(offer.avgCompValue)} avg · {offer.numSailings} sailings
                    </Text>
                  </View>
                ))}
              </View>
            </View>
            
            <View style={styles.insightNote}>
              <Text style={styles.insightNoteText}>
                💡 Offer {offer2511A06.offerCode} provides unique 75% cabin coverage (1.5 guest shares), 
                offering substantial value while splitting costs with a companion.
              </Text>
            </View>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: 16,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 16,
    marginBottom: 12,
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111827',
  },
  loadingContainer: {
    backgroundColor: '#F0F8FF',
    borderRadius: 12,
    padding: 24,
    borderWidth: 1,
    borderColor: '#B3D9FF',
    marginHorizontal: 16,
    alignItems: 'center',
    gap: 12,
  },
  loadingText: {
    fontSize: 14,
    color: '#6B7280',
    fontWeight: '600',
  },
  errorCard: {
    backgroundColor: '#FEE2E2',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#FCA5A5',
    marginHorizontal: 16,
  },
  errorText: {
    fontSize: 14,
    color: '#991B1B',
    fontWeight: '600',
  },
  cardsContainer: {
    paddingHorizontal: 16,
    gap: 12,
  },
  insightCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    minWidth: 320,
    maxWidth: 320,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  insightHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  insightTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#111827',
  },
  insightSubtitle: {
    fontSize: 12,
    color: '#6B7280',
    marginBottom: 16,
  },
  offersList: {
    gap: 12,
  },
  offerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F9FAFB',
    borderRadius: 10,
    padding: 12,
    gap: 12,
  },
  offerRank: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#EEF2FF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  rankNumber: {
    fontSize: 13,
    fontWeight: '700',
    color: '#4F46E5',
  },
  offerInfo: {
    flex: 1,
  },
  offerCode: {
    fontSize: 13,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 2,
  },
  offerStats: {
    fontSize: 11,
    color: '#6B7280',
    marginBottom: 2,
  },
  offerAvg: {
    fontSize: 10,
    color: '#9CA3AF',
  },
  featuredOffer: {
    backgroundColor: '#FEF3C7',
    borderRadius: 12,
    padding: 16,
    borderWidth: 2,
    borderColor: '#FCD34D',
  },
  featuredOfferCode: {
    fontSize: 18,
    fontWeight: '700',
    color: '#92400E',
    marginBottom: 16,
    textAlign: 'center',
  },
  featuredMetrics: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 16,
    gap: 8,
  },
  metricItem: {
    flex: 1,
    alignItems: 'center',
  },
  metricLabel: {
    fontSize: 10,
    color: '#92400E',
    marginBottom: 4,
    fontWeight: '600',
  },
  metricValue: {
    fontSize: 14,
    fontWeight: '700',
    color: '#92400E',
  },
  sampleCruise: {
    borderTopWidth: 1,
    borderTopColor: '#FCD34D',
    paddingTop: 12,
  },
  sampleLabel: {
    fontSize: 10,
    color: '#92400E',
    marginBottom: 4,
    fontWeight: '600',
  },
  sampleShip: {
    fontSize: 13,
    fontWeight: '700',
    color: '#92400E',
    marginBottom: 2,
  },
  sampleDate: {
    fontSize: 11,
    color: '#B45309',
  },
  expiringOfferRow: {
    flexDirection: 'row',
    backgroundColor: '#FEE2E2',
    borderRadius: 10,
    padding: 12,
    gap: 12,
    borderWidth: 1,
    borderColor: '#FCA5A5',
  },
  urgencyBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: '#FED7AA',
    justifyContent: 'center',
    alignItems: 'center',
    minWidth: 60,
  },
  urgentBadge: {
    backgroundColor: '#FCA5A5',
  },
  urgencyText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#9A3412',
  },
  urgentText: {
    color: '#991B1B',
  },
  expiringOfferInfo: {
    flex: 1,
  },
  expiryDate: {
    fontSize: 10,
    color: '#DC2626',
    fontWeight: '600',
  },
  emptyState: {
    padding: 24,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 13,
    color: '#9CA3AF',
    fontStyle: 'italic',
  },
  comparisonContainer: {
    gap: 16,
  },
  specialOfferSection: {
    backgroundColor: '#F5F3FF',
    borderRadius: 12,
    padding: 16,
    borderWidth: 2,
    borderColor: '#C4B5FD',
    alignItems: 'center',
  },
  specialBadge: {
    backgroundColor: '#8B5CF6',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 999,
    marginBottom: 8,
  },
  specialBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  comparisonOfferCode: {
    fontSize: 16,
    fontWeight: '700',
    color: '#5B21B6',
    marginBottom: 4,
  },
  comparisonLabel: {
    fontSize: 11,
    color: '#7C3AED',
    marginBottom: 12,
    fontWeight: '600',
  },
  comparisonMetrics: {
    alignItems: 'center',
  },
  comparisonValue: {
    fontSize: 20,
    fontWeight: '700',
    color: '#5B21B6',
    marginBottom: 2,
  },
  comparisonDetail: {
    fontSize: 10,
    color: '#7C3AED',
    marginBottom: 8,
  },
  comparisonAvg: {
    fontSize: 12,
    fontWeight: '600',
    color: '#6D28D9',
    marginBottom: 2,
  },
  comparisonSailings: {
    fontSize: 10,
    color: '#7C3AED',
  },
  divider: {
    height: 1,
    backgroundColor: '#E5E7EB',
  },
  fullRoomSection: {
    gap: 8,
  },
  comparisonSectionTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#374151',
    marginBottom: 8,
  },
  comparisonOfferRow: {
    backgroundColor: '#F9FAFB',
    borderRadius: 8,
    padding: 10,
  },
  comparisonOfferValue: {
    fontSize: 14,
    fontWeight: '700',
    color: '#111827',
    marginTop: 2,
  },
  comparisonOfferAvg: {
    fontSize: 10,
    color: '#6B7280',
    marginTop: 2,
  },
  insightNote: {
    backgroundColor: '#F0F9FF',
    borderRadius: 8,
    padding: 12,
    marginTop: 16,
    borderLeftWidth: 3,
    borderLeftColor: '#3B82F6',
  },
  insightNoteText: {
    fontSize: 11,
    color: '#1E40AF',
    lineHeight: 16,
  },
});
