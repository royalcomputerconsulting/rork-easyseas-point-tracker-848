import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Trophy, Gem } from 'lucide-react-native';

interface LoyaltyCardProps {
  clubRoyaleLevel: string;
  crownAnchorLevel: string;
  totalPoints: number;
  totalCruises: number;
}

export function LoyaltyCard({
  clubRoyaleLevel,
  crownAnchorLevel,
  totalPoints,
  totalCruises,
}: LoyaltyCardProps) {
  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.titleRow}>
          <Trophy size={20} color="#003B6F" />
          <Text style={styles.title}>Loyalty Status</Text>
        </View>
      </View>

      <View style={styles.content}>
        {/* Tier Pills */}
        <View style={styles.tierRow}>
          <View style={styles.pillPrime}>
            <Text style={styles.pillText}>{clubRoyaleLevel}</Text>
          </View>
          <View style={styles.pillDiamond}>
            <Gem size={14} color="#FFFFFF" />
            <Text style={styles.pillText}>{crownAnchorLevel}</Text>
          </View>
        </View>

        {/* Points Display */}
        <View style={styles.statsSection}>
          <View style={styles.statRow}>
            <Text style={styles.statLabel}>Current Total:</Text>
            <Text style={styles.statValue}>{totalPoints.toLocaleString()} points</Text>
          </View>
          <View style={styles.statRow}>
            <Text style={styles.statLabel}>Available Cruises:</Text>
            <Text style={styles.statValue}>{totalCruises} cruises</Text>
          </View>
        </View>

        {/* Progress Indicators */}
        <View style={styles.progressSection}>
          <View style={styles.progressItem}>
            <View style={styles.progressHeader}>
              <Text style={styles.progressLabel}>Pinnacle Tier Progress</Text>
              <Text style={styles.progressPoints}>20,720/25,000</Text>
            </View>
            <View style={styles.progressBarBg}>
              <View style={[styles.progressBarFill, { width: '82.9%' }]} />
            </View>
          </View>

          <View style={styles.progressItem}>
            <View style={styles.progressHeader}>
              <Text style={styles.progressLabel}>Signature Tier Progress</Text>
              <Text style={styles.progressPoints}>446/700</Text>
            </View>
            <View style={styles.progressBarBg}>
              <View style={[styles.progressBarFill, styles.progressBarFillSecondary, { width: '63.7%' }]} />
            </View>
          </View>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    marginHorizontal: 16,
    marginVertical: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
    overflow: 'hidden',
  },
  header: {
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: '#003B6F',
  },
  content: {
    padding: 16,
  },
  tierRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 16,
  },
  pillPrime: {
    backgroundColor: '#6C5CE7',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  pillDiamond: {
    backgroundColor: '#3B82F6',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  pillText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
  statsSection: {
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    padding: 12,
    marginBottom: 16,
  },
  statRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  statLabel: {
    fontSize: 13,
    color: '#6B7280',
    fontWeight: '600',
  },
  statValue: {
    fontSize: 14,
    color: '#003B6F',
    fontWeight: '700',
  },
  progressSection: {
    gap: 16,
  },
  progressItem: {
    gap: 6,
  },
  progressHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  progressLabel: {
    fontSize: 12,
    color: '#374151',
    fontWeight: '600',
  },
  progressPoints: {
    fontSize: 12,
    color: '#6B7280',
    fontWeight: '600',
  },
  progressBarBg: {
    height: 8,
    backgroundColor: '#E5E7EB',
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: '#6C5CE7',
    borderRadius: 4,
  },
  progressBarFillSecondary: {
    backgroundColor: '#3B82F6',
  },
});
