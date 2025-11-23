import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Image, Animated } from 'react-native';
import { Trophy, Crown, Diamond } from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { COLORS, TYPOGRAPHY, SPACING, BORDER_RADIUS } from '@/constants/theme';
import { useFinancials } from '@/state/FinancialsProvider';
import { useAppState } from '@/state/AppStateProvider';
import { TOTALS } from '@/constants/cruiseData';
import { getTierByPoints, getProgressToNextTier } from '@/constants/clubRoyaleTiers';
import { getCrownAnchorLevel } from '@/constants/crownAnchor';
import { trpc } from '@/lib/trpc';

interface HeroHeaderCompactProps {
  totalCruises: number;
  logoUri?: string;
  highlightPrime?: boolean;
  highlightDiamondPlus?: boolean;
  showLogoOnly?: boolean;
  hideStats?: boolean;
}

export function HeroHeaderCompact({
  totalCruises,
  logoUri = 'https://pub-e001eb4506b145aa938b5d3badbff6a5.r2.dev/attachments/x6d5v9j2llorlwc3tfofl',
  highlightPrime = true,
  highlightDiamondPlus = true,
  showLogoOnly = false,
  hideStats = false,
}: HeroHeaderCompactProps) {
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(-6)).current;

  const { getAnalyticsTotals } = useFinancials();
  const { userPoints, loyaltyPoints } = useAppState();

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 300, useNativeDriver: true }),
      Animated.timing(slideAnim, { toValue: 0, duration: 300, useNativeDriver: true }),
    ]).start();
  }, [fadeAnim, slideAnim]);

  const { data: finOverview } = trpc.financials.financialOverview.useQuery();
  const { data: casinoAnalytics } = trpc.financials.casinoAnalytics.useQuery();

  const finTotals = (() => {
    try {
      return getAnalyticsTotals();
    } catch (e) {
      console.log('[HeroHeaderCompact] getAnalyticsTotals failed', e);
      return { totalCoinIn: 0, totalPoints: 0, totalRetailValue: 0, totalOutOfPocket: 0, weightedRoi: 0 };
    }
  })();

  const pointsFromProvider = finTotals.totalPoints || 0;
  const pointsFromBackend = (() => {
    const a = typeof casinoAnalytics?.points === 'number' ? casinoAnalytics.points : 0;
    const b = typeof finOverview?.points === 'number' ? finOverview.points : 0;
    const best = Math.max(a, b);
    return Number.isFinite(best) ? best : 0;
  })();

  const staticCasinoPoints = TOTALS.totalPoints;
  const computedPoints = (typeof userPoints === 'number' && userPoints > 0)
    ? userPoints
    : (staticCasinoPoints > 0 ? staticCasinoPoints : (pointsFromBackend > 0 ? pointsFromBackend : pointsFromProvider));

  const displayPoints = Number.isFinite(computedPoints) ? computedPoints : 0;
  
  const clubRoyaleTier = getTierByPoints(displayPoints);
  const progress = getProgressToNextTier(displayPoints);
  const crownAnchorLevel = getCrownAnchorLevel(loyaltyPoints ?? 0);

  return (
    <Animated.View
      testID="hero-header-compact"
      style={[
        styles.container,
        { opacity: fadeAnim, transform: [{ translateY: slideAnim }] },
      ]}
      accessibilityRole="header"
      accessibilityLabel="Compact hero header"
    >
      {showLogoOnly ? (
        <View style={[styles.logoContainer, { height: 280 }]}>
          <Image
            testID="hero-logo"
            source={{ uri: logoUri }}
            style={styles.backgroundImage}
            resizeMode='contain'
            accessibilityLabel="Easy Seas Logo"
          />
        </View>
      ) : (
        <LinearGradient
          colors={[COLORS.primaryDark, COLORS.primaryGradientStart]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.headerContainer}
        >
          <View style={styles.decorativeCircle1} />
          <View style={styles.decorativeCircle2} />
          
          <View style={styles.headerContent}>
            <Image
              testID="easy-seas-logo"
              source={{ uri: 'https://pub-e001eb4506b145aa938b5d3badbff6a5.r2.dev/attachments/8vi7anqbmnizzk0lehvsf' }}
              style={styles.logo}
              resizeMode="contain"
              accessibilityLabel="Easy Seas Logo"
            />
            
            <View style={styles.textAndBadgesContainer}>
              <View style={styles.headerTextContainer}>
                <Text style={styles.headerTitle}>Easy Seas</Text>
                <Text style={styles.headerSubtitle}>Manage Your Nautical Lifestyle</Text>
              </View>
              {!hideStats && (
                <View style={styles.badgesContainer}>
                  <View style={styles.bluePill} testID="club-royale-tier">
                    <Trophy size={14} color={COLORS.white} />
                    <Text style={styles.bluePillText}>{clubRoyaleTier.name.toUpperCase()}</Text>
                  </View>

                  <View style={styles.bluePill} testID="crown-anchor-tier">
                    {crownAnchorLevel.name.toLowerCase().includes('diamond') ? (
                      <>
                        <Diamond size={12} color={COLORS.white} fill={COLORS.white} />
                        <Diamond size={12} color={COLORS.white} fill={COLORS.white} />
                      </>
                    ) : (
                      <Crown size={12} color={COLORS.white} />
                    )}
                    <Text style={styles.bluePillText}>{crownAnchorLevel.name.toUpperCase()}</Text>
                  </View>
                </View>
              )}
            </View>
          </View>
        </LinearGradient>
      )}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginHorizontal: SPACING.md,
    marginTop: SPACING.sm,
    marginBottom: SPACING.xs,
    borderRadius: BORDER_RADIUS.lg,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 6,
  },
  logoContainer: {
    width: '100%',
    height: 240,
    position: 'relative',
    overflow: 'hidden',
  },
  backgroundImage: {
    width: '100%',
    height: '100%',
    position: 'absolute',
    top: 0,
    left: 0,
    resizeMode: 'contain',
  },
  overlayGradient: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
  },
  corner: {
    position: 'absolute',
    zIndex: 10,
  },
  topLeft: {
    top: SPACING.sm,
    left: SPACING.sm,
  },
  topRight: {
    top: SPACING.sm,
    right: SPACING.sm,
    alignItems: 'flex-end',
  },
  bottomLeft: {
    bottom: SPACING.sm,
    left: SPACING.sm,
  },
  bottomRight: {
    bottom: SPACING.sm,
    right: SPACING.sm,
    alignItems: 'flex-end',
  },
  tierPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: SPACING.sm,
    paddingVertical: 6,
    borderRadius: BORDER_RADIUS.pill,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 4,
  },
  tierText: {
    color: COLORS.white,
    fontSize: TYPOGRAPHY.sizes.xs,
    fontWeight: TYPOGRAPHY.weights.bold,
    letterSpacing: 0.5,
  },
  progressContainer: {
    marginTop: 4,
    minWidth: 100,
  },
  progressBar: {
    height: 3,
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
    borderRadius: 2,
    overflow: 'hidden',
    marginBottom: 3,
  },
  progressFill: {
    height: '100%',
    borderRadius: 2,
  },
  progressText: {
    color: COLORS.white,
    fontSize: 9,
    fontWeight: TYPOGRAPHY.weights.semibold,
    textShadowColor: 'rgba(0, 0, 0, 0.8)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  statOverlay: {
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    paddingHorizontal: SPACING.sm,
    paddingVertical: SPACING.xs,
    borderRadius: BORDER_RADIUS.md,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 4,
  },
  statValue: {
    color: COLORS.white,
    fontSize: TYPOGRAPHY.sizes.lg,
    fontWeight: TYPOGRAPHY.weights.bold,
    textShadowColor: 'rgba(0, 0, 0, 0.8)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  statLabel: {
    color: COLORS.white,
    fontSize: 9,
    fontWeight: TYPOGRAPHY.weights.semibold,
    opacity: 0.9,
    marginTop: 2,
    textShadowColor: 'rgba(0, 0, 0, 0.8)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  pointsToNext: {
    color: COLORS.white,
    fontSize: 8,
    fontWeight: TYPOGRAPHY.weights.semibold,
    opacity: 0.85,
    marginTop: 3,
    textShadowColor: 'rgba(0, 0, 0, 0.8)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  bluePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: BORDER_RADIUS.pill,
    backgroundColor: 'rgba(0, 163, 224, 0.25)',
    borderWidth: 1,
    borderColor: 'rgba(0, 163, 224, 0.4)',
  },
  bluePillText: {
    color: COLORS.iceWhite,
    fontSize: 11,
    fontWeight: TYPOGRAPHY.weights.bold,
    letterSpacing: 0.5,
  },
  headerContainer: {
    width: '100%',
    overflow: 'hidden',
    position: 'relative',
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.md,
    minHeight: 120,
  },
  decorativeCircle1: {
    position: 'absolute',
    top: -20,
    right: -20,
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(46, 140, 255, 0.12)',
    zIndex: 0,
  },
  decorativeCircle2: {
    position: 'absolute',
    bottom: -15,
    left: -15,
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: 'rgba(91, 66, 243, 0.08)',
    zIndex: 0,
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'stretch',
    zIndex: 1,
    gap: SPACING.md,
    minHeight: 100,
  },
  logo: {
    width: 100,
    height: '100%',
    borderRadius: 8,
  },
  textAndBadgesContainer: {
    flex: 1,
  },
  headerTextContainer: {
    alignItems: 'flex-start',
    marginBottom: SPACING.sm,
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: TYPOGRAPHY.weights.bold,
    color: COLORS.iceWhite,
    letterSpacing: 0.8,
    textAlign: 'left',
  },
  headerSubtitle: {
    fontSize: 13,
    fontWeight: TYPOGRAPHY.weights.semibold,
    color: COLORS.iceWhite,
    opacity: 0.85,
    marginTop: 2,
    textAlign: 'left',
    letterSpacing: 0.3,
  },
  badgesContainer: {
    flexDirection: 'row',
    justifyContent: 'flex-start',
    gap: SPACING.sm,
    flexWrap: 'wrap',
  },
});
