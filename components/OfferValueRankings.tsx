import React, { useState, useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable } from 'react-native';
import { TrendingUp, Award, DollarSign, Info } from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';

import { trpc } from '@/lib/trpc';
import { COLORS, SPACING, TYPOGRAPHY, BORDER_RADIUS, SHADOW } from '@/constants/theme';

interface OfferValueRankingsProps {
  testID?: string;
  dateFilter?: 'All' | '3m' | '6m' | '12m';
  cabinFilter?: 'All' | 'Interior' | 'Oceanview' | 'Balcony' | 'Suite';
  shipFilter?: string;
  sortBy?: 'value' | 'sailings' | 'average';
  activeTab?: 'overall' | 'jackpot';
}

type RankingTab = 'overall' | 'jackpot';

const OfferValueRankings: React.FC<OfferValueRankingsProps> = ({ 
  testID,
  dateFilter = 'All',
  cabinFilter = 'All',
  shipFilter = 'All',
  sortBy = 'value',
  activeTab: externalActiveTab,
}) => {
  const [internalActiveTab, setInternalActiveTab] = useState<RankingTab>('overall');
  const activeTab = externalActiveTab ?? internalActiveTab;
  const rankingsQuery = trpc.casinoOffers.getOfferRankings.useQuery();
  const offersQuery = trpc.casinoOffers.list.useQuery();

  const displayedRankings = useMemo(() => {
    const rankingsData = rankingsQuery.data;
    const offersData = offersQuery.data;
    if (!rankingsData || !offersData) return [];

    const now = new Date();
    const filterDate = (() => {
      if (dateFilter === 'All') return null;
      const d = new Date(now);
      if (dateFilter === '3m') d.setMonth(d.getMonth() - 3);
      if (dateFilter === '6m') d.setMonth(d.getMonth() - 6);
      if (dateFilter === '12m') d.setMonth(d.getMonth() - 12);
      return d;
    })();

    const filterOffers = (offerCode: string) => {
      const offers = offersData.filter(o => o.offerCode === offerCode);
      if (offers.length === 0) return true;

      return offers.some(offer => {
        if (dateFilter !== 'All' && filterDate && offer.sailingDate) {
          const sailDate = new Date(offer.sailingDate);
          if (sailDate < filterDate) return false;
        }

        if (cabinFilter !== 'All' && offer.normalizedCabinType !== cabinFilter.toUpperCase()) {
          return false;
        }

        if (shipFilter !== 'All' && offer.shipName !== shipFilter) {
          return false;
        }

        return true;
      });
    };

    const baseList = activeTab === 'overall'
      ? rankingsData.overallStrength
      : rankingsData.singleSailingJackpot;

    const filterList = (list: typeof rankingsData.overallStrength) => {
      if (!list) return [];
      return list.filter(offer => filterOffers(offer.offerCode));
    };

    let filtered = filterList(baseList);

    if (sortBy === 'sailings') {
      filtered = [...filtered].sort((a, b) => b.numSailings - a.numSailings);
    } else if (sortBy === 'average') {
      filtered = [...filtered].sort((a, b) => b.avgCompValue - a.avgCompValue);
    }

    return filtered;
  }, [rankingsQuery.data, offersQuery.data, activeTab, dateFilter, cabinFilter, shipFilter, sortBy]);

  const formatCurrency = (value: number): string => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };



  const getValueTierColor = (value: number): string => {
    if (value >= 3000) return COLORS.success;
    if (value >= 2000) return COLORS.info;
    if (value >= 1000) return COLORS.warning;
    return COLORS.text;
  };

  const getValueTierLabel = (value: number): string => {
    if (value >= 3000) return 'Premium';
    if (value >= 2000) return 'High Value';
    if (value >= 1000) return 'Good Value';
    return 'Standard';
  };

  if (rankingsQuery.isLoading) {
    return (
      <View style={styles.container} testID={testID}>
        <View style={styles.header}>
          <View style={styles.iconContainer}>
            <TrendingUp size={24} color={COLORS.primary} />
          </View>
          <View style={styles.headerText}>
            <Text style={styles.title}>Offer Value Rankings</Text>
            <Text style={styles.subtitle}>Loading rankings...</Text>
          </View>
        </View>
      </View>
    );
  }

  if (rankingsQuery.error) {
    return (
      <View style={styles.container} testID={testID}>
        <View style={styles.header}>
          <View style={styles.iconContainer}>
            <TrendingUp size={24} color={COLORS.primary} />
          </View>
          <View style={styles.headerText}>
            <Text style={styles.title}>Offer Value Rankings</Text>
            <Text style={[styles.subtitle, { color: COLORS.error }]}>
              Error loading rankings
            </Text>
          </View>
        </View>
      </View>
    );
  }



  return (
    <View style={styles.container} testID={testID}>
      <View style={styles.header}>
        <View style={styles.iconContainer}>
          <TrendingUp size={24} color={COLORS.primary} />
        </View>
        <View style={styles.headerText}>
          <Text style={styles.title}>Top 10 Offer Value Rankings</Text>
          <Text style={styles.subtitle}>
            Sorted by {activeTab === 'overall' ? 'Total Value' : 'Max Sailing Value'}
          </Text>
        </View>
      </View>

      {!externalActiveTab && (
        <View style={styles.tabContainer}>
          <Pressable
            style={[styles.tab, activeTab === 'overall' && styles.activeTab]}
            onPress={() => setInternalActiveTab('overall')}
            testID="tab-overall"
          >
            <Award size={18} color={activeTab === 'overall' ? COLORS.white : COLORS.text} />
            <Text style={[styles.tabText, activeTab === 'overall' && styles.activeTabText]}>
              Overall Strength
            </Text>
          </Pressable>

          <Pressable
            style={[styles.tab, activeTab === 'jackpot' && styles.activeTab]}
            onPress={() => setInternalActiveTab('jackpot')}
            testID="tab-jackpot"
          >
            <DollarSign size={18} color={activeTab === 'jackpot' ? COLORS.white : COLORS.text} />
            <Text style={[styles.tabText, activeTab === 'jackpot' && styles.activeTabText]}>
              Single-Sailing Jackpot
            </Text>
          </Pressable>
        </View>
      )}

      <ScrollView 
        style={styles.rankingsList}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.rankingsContent}
      >
        {displayedRankings.slice(0, 10).map((ranking, index) => {
          const isSpecial2511A06 = ranking.offerCode === '2511A06';
          const primaryValue = activeTab === 'overall' 
            ? ranking.totalCompValue 
            : ranking.maxSailingValue;

          return (
            <View key={ranking.offerCode} style={styles.rankingCard}>
              <View style={styles.rankingHeader}>
                <View style={styles.rankingBadge}>
                  <Text style={styles.rankingNumber}>#{index + 1}</Text>
                </View>
                
                <View style={styles.rankingInfo}>
                  <View style={styles.offerCodeRow}>
                    <Text style={styles.offerCode}>{ranking.offerCode}</Text>
                    {isSpecial2511A06 && (
                      <View style={styles.specialBadge}>
                        <Info size={12} color={COLORS.info} />
                        <Text style={styles.specialBadgeText}>75% Coverage</Text>
                      </View>
                    )}
                  </View>
                  <Text style={styles.offerName} numberOfLines={1}>
                    {ranking.offerName}
                  </Text>
                </View>
              </View>

              <View style={styles.valueContainer}>
                <LinearGradient
                  colors={[getValueTierColor(primaryValue) + '20', 'transparent']}
                  style={styles.valueGradient}
                >
                  <Text style={[styles.valueLabel, { color: getValueTierColor(primaryValue) }]}>
                    {getValueTierLabel(primaryValue)}
                  </Text>
                  <Text style={[styles.valuePrimary, { color: getValueTierColor(primaryValue) }]}>
                    {formatCurrency(primaryValue)}
                  </Text>
                  <Text style={styles.valueDescription}>
                    {activeTab === 'overall' ? 'Total Value' : 'Max Sailing Value'}
                  </Text>
                </LinearGradient>
              </View>

              <View style={styles.statsGrid}>
                <View style={styles.statItem}>
                  <DollarSign size={14} color={COLORS.textLight} />
                  <Text style={styles.statValue}>
                    {formatCurrency(ranking.avgCompValue)}
                  </Text>
                  <Text style={styles.statLabel}>Avg Value</Text>
                </View>

                <View style={styles.statItem}>
                  <Award size={14} color={COLORS.textLight} />
                  <Text style={styles.statValue}>
                    {formatCurrency(ranking.totalCompValue)}
                  </Text>
                  <Text style={styles.statLabel}>Total Value</Text>
                </View>
              </View>




            </View>
          );
        })}

        {displayedRankings.length === 0 && (
          <View style={styles.emptyState}>
            <Award size={48} color={COLORS.textLight} />
            <Text style={styles.emptyTitle}>No Rankings Available</Text>
            <Text style={styles.emptySubtitle}>
              Import offers with pricing data to see rankings
            </Text>
          </View>
        )}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#001F3F',
    borderRadius: BORDER_RADIUS.large,
    padding: SPACING.large,
    ...SHADOW.medium,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: SPACING.large,
  },
  iconContainer: {
    width: 48,
    height: 48,
    borderRadius: BORDER_RADIUS.medium,
    backgroundColor: '#4A90E2',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: SPACING.medium,
  },
  headerText: {
    flex: 1,
  },
  title: {
    ...TYPOGRAPHY.h3,
    color: '#FFFFFF',
    marginBottom: 4,
  },
  subtitle: {
    ...TYPOGRAPHY.caption,
    color: '#FFFFFF',
    opacity: 0.9,
  },
  tabContainer: {
    flexDirection: 'row',
    backgroundColor: '#003B6F',
    borderRadius: BORDER_RADIUS.medium,
    padding: 4,
    marginBottom: SPACING.large,
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: SPACING.small,
    paddingHorizontal: SPACING.medium,
    borderRadius: BORDER_RADIUS.small,
    gap: SPACING.small,
  },
  activeTab: {
    backgroundColor: '#4A90E2',
  },
  tabText: {
    ...TYPOGRAPHY.body,
    color: '#FFFFFF',
    fontWeight: '500' as const,
  },
  activeTabText: {
    color: '#FFFFFF',
  },
  rankingsList: {
    maxHeight: 600,
  },
  rankingsContent: {
    gap: SPACING.medium,
    paddingBottom: SPACING.small,
  },
  rankingCard: {
    backgroundColor: '#003B6F',
    borderRadius: BORDER_RADIUS.medium,
    padding: SPACING.medium,
    borderWidth: 1,
    borderColor: '#4A90E2',
  },
  rankingHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: SPACING.medium,
  },
  rankingBadge: {
    width: 40,
    height: 40,
    borderRadius: BORDER_RADIUS.small,
    backgroundColor: '#4A90E2',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: SPACING.medium,
  },
  rankingNumber: {
    ...TYPOGRAPHY.h4,
    color: '#FFFFFF',
    fontWeight: '700' as const,
  },
  rankingInfo: {
    flex: 1,
  },
  offerCodeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.small,
    marginBottom: 4,
  },
  offerCode: {
    ...TYPOGRAPHY.h4,
    color: '#FFFFFF',
    fontWeight: '600' as const,
  },
  specialBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.info + '15',
    paddingHorizontal: SPACING.small,
    paddingVertical: 2,
    borderRadius: BORDER_RADIUS.small,
    gap: 4,
  },
  specialBadgeText: {
    ...TYPOGRAPHY.caption,
    color: COLORS.info,
    fontWeight: '600' as const,
  },
  offerName: {
    ...TYPOGRAPHY.body,
    color: '#FFFFFF',
    opacity: 0.85,
  },
  valueContainer: {
    marginBottom: SPACING.medium,
  },
  valueGradient: {
    padding: SPACING.medium,
    borderRadius: BORDER_RADIUS.medium,
    alignItems: 'center',
  },
  valueLabel: {
    ...TYPOGRAPHY.caption,
    fontWeight: '600' as const,
    textTransform: 'uppercase' as const,
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  valuePrimary: {
    ...TYPOGRAPHY.h2,
    fontWeight: '700' as const,
    marginBottom: 4,
  },
  valueDescription: {
    ...TYPOGRAPHY.caption,
    color: '#FFFFFF',
    opacity: 0.9,
  },
  statsGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingTop: SPACING.medium,
    borderTopWidth: 1,
    borderTopColor: '#4A90E2',
    marginBottom: SPACING.small,
  },
  statItem: {
    alignItems: 'center',
    gap: 4,
  },
  statValue: {
    ...TYPOGRAPHY.body,
    color: '#FFFFFF',
    fontWeight: '600' as const,
  },
  statLabel: {
    ...TYPOGRAPHY.caption,
    color: '#FFFFFF',
    opacity: 0.8,
  },
  detailsContainer: {
    backgroundColor: '#001F3F',
    padding: SPACING.medium,
    borderRadius: BORDER_RADIUS.small,
    marginTop: SPACING.small,
    gap: SPACING.small,
  },
  detailsTitle: {
    ...TYPOGRAPHY.body,
    color: '#FFFFFF',
    fontWeight: '600' as const,
    marginBottom: 4,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.small,
  },
  detailText: {
    ...TYPOGRAPHY.caption,
    color: '#FFFFFF',
    opacity: 0.85,
    flex: 1,
  },
  explanationBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: COLORS.info + '10',
    padding: SPACING.small,
    borderRadius: BORDER_RADIUS.small,
    marginTop: SPACING.small,
    gap: SPACING.small,
    borderLeftWidth: 3,
    borderLeftColor: COLORS.info,
  },
  explanationText: {
    ...TYPOGRAPHY.caption,
    color: COLORS.info,
    flex: 1,
    lineHeight: 18,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: SPACING.xlarge * 2,
    gap: SPACING.medium,
  },
  emptyTitle: {
    ...TYPOGRAPHY.h3,
    color: '#FFFFFF',
  },
  emptySubtitle: {
    ...TYPOGRAPHY.body,
    color: '#FFFFFF',
    opacity: 0.8,
    textAlign: 'center' as const,
  },
});

export default OfferValueRankings;
