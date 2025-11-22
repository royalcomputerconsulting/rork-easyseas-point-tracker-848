import React, { useRef, useEffect } from 'react';
import { View, Text, StyleSheet, Animated, Image } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { COLORS, TYPOGRAPHY, SPACING, BORDER_RADIUS } from '@/constants/theme';
import { Anchor, Trophy, Crown, Diamond } from 'lucide-react-native';
import { useFinancials } from '@/state/FinancialsProvider';
import { trpc } from '@/lib/trpc';
import { useAppState } from '@/state/AppStateProvider';
import { TOTALS } from '@/constants/cruiseData';
import { getTierByPoints, getProgressToNextTier } from '@/constants/clubRoyaleTiers';
import { getCrownAnchorLevel } from '@/constants/crownAnchor';

interface HeroSectionProps {
  totalPoints?: number;
  totalCruises: number;
  tier?: string;
  logoUri?: string;
  highlightPrime?: boolean;
  highlightDiamondPlus?: boolean;
  valuePerPointOverride?: number;
  scale?: number;
  imageHeight?: number;
}

export function HeroSection({ totalPoints, totalCruises, tier = 'Diamond', logoUri = 'https://pub-e001eb4506b145aa938b5d3badbff6a5.r2.dev/attachments/x6d5v9j2llorlwc3tfofl', highlightPrime = true, highlightDiamondPlus = true, valuePerPointOverride, scale = 1, imageHeight = 320 }: HeroSectionProps) {
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(-20)).current;
  const scaleAnim = useRef(new Animated.Value(0.95)).current;
  const insets = useSafeAreaInsets();

  const { getAnalyticsTotals } = useFinancials();
  const { userPoints, loyaltyPoints } = useAppState();
  const { data: finOverview } = trpc.financials.financialOverview.useQuery();
  const { data: casinoAnalytics } = trpc.financials.casinoAnalytics.useQuery();

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 600,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 600,
        useNativeDriver: true,
      }),
      Animated.spring(scaleAnim, {
        toValue: 1,
        tension: 50,
        friction: 7,
        useNativeDriver: true,
      }),
    ]).start();
  }, [fadeAnim, slideAnim, scaleAnim]);

  const finTotals = (() => {
    try {
      return getAnalyticsTotals();
    } catch (e) {
      console.log('[HeroSection] getAnalyticsTotals failed', e);
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

  const scaledMargins = {
    marginHorizontal: SPACING.lg * scale,
    marginTop: SPACING.md * scale,
    marginBottom: SPACING.lg * scale,
  } as const;

  return (
    <Animated.View
      testID="hero-section"
      style={[
        styles.container,
        scaledMargins,
        {
          opacity: fadeAnim,
          transform: [{ translateY: slideAnim }, { scale: scaleAnim }, { scale }],
        },
      ]}
      accessibilityRole="header"
      accessibilityLabel="Hero section"
    >
      <LinearGradient
        colors={[COLORS.primaryDark, COLORS.primaryGradientStart]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.gradientContainer}
      >
        <View style={styles.decorativeCircle1} />
        <View style={styles.decorativeCircle2} />
        
        <View style={styles.headerContent}>
          <Image
            testID="easy-seas-logo"
            source={{ uri: 'https://pub-e001eb4506b145aa938b5d3badbff6a5.r2.dev/attachments/qqzyxeueobsxz53acot0g' }}
            style={styles.logo}
            resizeMode="contain"
            accessibilityLabel="Easy Seas Logo"
          />
          
          <View style={styles.textAndBadgesContainer}>
            <View style={styles.headerTextContainer}>
              <Text style={styles.headerTitle}>Easy Seas</Text>
              <Text style={styles.headerSubtitle}>Manage Your Nautical Lifestyle</Text>
            </View>
            
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
          </View>
        </View>
      </LinearGradient>
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
  gradientContainer: {
    position: 'relative',
    overflow: 'hidden',
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
    alignItems: 'center',
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.md,
    zIndex: 1,
    gap: SPACING.md,
  },
  logo: {
    width: 60,
    height: 60,
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
});
