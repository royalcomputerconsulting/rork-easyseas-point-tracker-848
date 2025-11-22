import React, { PropsWithChildren, memo } from 'react';
import { View, StyleSheet, ViewStyle, Text } from 'react-native';
import { COLORS, SHADOW, BORDER_RADIUS, SPACING, TYPOGRAPHY } from '@/constants/theme';
import { LinearGradient } from 'expo-linear-gradient';
import { Image } from 'expo-image';

export type CardVariant = 'default' | 'elevated' | 'floating' | 'gradient' | 'oceanic' | 'oceanicElevated';

export interface ThemedCardProps {
  variant?: CardVariant;
  noPadding?: boolean;
  style?: ViewStyle;
  testID?: string;
  headerImageUri?: string;
  headerOverlayTitle?: string;
  headerOverlaySubtitle?: string;
}

function ThemedCardBase({ 
  children, 
  variant = 'default',
  noPadding = false,
  style, 
  testID,
  headerImageUri,
  headerOverlayTitle,
  headerOverlaySubtitle,
}: PropsWithChildren<ThemedCardProps>) {
  const shadowStyle = React.useMemo(() => {
    switch (variant) {
      case 'elevated':
        return SHADOW.elevated;
      case 'floating':
        return SHADOW.floating;
      case 'oceanic':
        return SHADOW.oceanicCard;
      case 'oceanicElevated':
        return SHADOW.oceanicElevated;
      default:
        return SHADOW.card;
    }
  }, [variant]);

  const Content = (
    <View style={[styles.card, shadowStyle, noPadding && styles.noPadding, style]} testID={testID ?? 'themed-card'}>
      {headerImageUri ? (
        <View style={styles.headerContainer} testID={(testID ?? 'themed-card') + '-header'}>
          <View style={styles.headerImageWrapper}>
            <Image
              source={{ uri: headerImageUri }}
              style={styles.headerImage}
              contentFit="cover"
            />
            <LinearGradient
              colors={[ 'rgba(0,0,0,0.0)', 'rgba(0,0,0,0.55)' ]}
              start={{ x: 0, y: 0 }}
              end={{ x: 0, y: 1 }}
              style={styles.headerScrim}
            />
            {(headerOverlayTitle || headerOverlaySubtitle) && (
              <View style={styles.headerOverlay}>
                {headerOverlayTitle ? (
                  <Text style={styles.headerTitle} numberOfLines={2}>
                    {headerOverlayTitle}
                  </Text>
                ) : null}
                {headerOverlaySubtitle ? (
                  <Text style={styles.headerSubtitle} numberOfLines={1}>
                    {headerOverlaySubtitle}
                  </Text>
                ) : null}
              </View>
            )}
          </View>
        </View>
      ) : null}
      <View style={styles.body}>
        {children}
      </View>
    </View>
  );

  if (variant === 'gradient') {
    return (
      <View style={[styles.card, shadowStyle, noPadding && styles.noPadding, style]} testID={testID ?? 'themed-card'}>
        <LinearGradient
          colors={['rgba(0, 48, 135, 0.03)', 'rgba(0, 163, 224, 0.03)']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.gradientInner}
        >
          {headerImageUri ? (
            <View style={styles.headerContainer} testID={(testID ?? 'themed-card') + '-header'}>
              <View style={styles.headerImageWrapper}>
                <Image
                  source={{ uri: headerImageUri }}
                  style={styles.headerImage}
                  contentFit="cover"
                />
                <LinearGradient
                  colors={[ 'rgba(0,0,0,0.0)', 'rgba(0,0,0,0.55)' ]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 0, y: 1 }}
                  style={styles.headerScrim}
                />
                {(headerOverlayTitle || headerOverlaySubtitle) && (
                  <View style={styles.headerOverlay}>
                    {headerOverlayTitle ? (
                      <Text style={styles.headerTitle} numberOfLines={2}>
                        {headerOverlayTitle}
                      </Text>
                    ) : null}
                    {headerOverlaySubtitle ? (
                      <Text style={styles.headerSubtitle} numberOfLines={1}>
                        {headerOverlaySubtitle}
                      </Text>
                    ) : null}
                  </View>
                )}
              </View>
            </View>
          ) : null}
          <View style={styles.body}>
            {children}
          </View>
        </LinearGradient>
      </View>
    );
  }

  if (variant === 'oceanic' || variant === 'oceanicElevated') {
    return (
      <View style={[styles.oceanicCard, shadowStyle, noPadding && styles.noPadding, style]} testID={testID ?? 'themed-card'}>
        <LinearGradient
          colors={['#2B2D6B', '#3A3DA0']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.oceanicGradient}
        >
          <View style={styles.decorativeCircle1} />
          <View style={styles.decorativeCircle2} />
          
          {headerImageUri ? (
            <View style={styles.headerContainer} testID={(testID ?? 'themed-card') + '-header'}>
              <View style={styles.headerImageWrapper}>
                <Image
                  source={{ uri: headerImageUri }}
                  style={styles.headerImage}
                  contentFit="cover"
                />
                <LinearGradient
                  colors={[ 'rgba(0,0,0,0.0)', 'rgba(0,0,0,0.55)' ]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 0, y: 1 }}
                  style={styles.headerScrim}
                />
                {(headerOverlayTitle || headerOverlaySubtitle) && (
                  <View style={styles.headerOverlay}>
                    {headerOverlayTitle ? (
                      <Text style={styles.headerTitle} numberOfLines={2}>
                        {headerOverlayTitle}
                      </Text>
                    ) : null}
                    {headerOverlaySubtitle ? (
                      <Text style={styles.headerSubtitle} numberOfLines={1}>
                        {headerOverlaySubtitle}
                      </Text>
                    ) : null}
                  </View>
                )}
              </View>
            </View>
          ) : null}
          
          <View style={styles.oceanicBody}>
            {children}
          </View>
        </LinearGradient>
      </View>
    );
  }

  return Content;
}

export const ThemedCard = memo(ThemedCardBase);

const styles = StyleSheet.create({
  card: {
    backgroundColor: COLORS.white,
    borderRadius: BORDER_RADIUS.lg,
    borderWidth: 1,
    borderColor: COLORS.divider,
    overflow: 'hidden',
  },
  body: {
    padding: SPACING.xxl,
  },
  noPadding: {
    padding: 0,
  },
  gradientInner: {
    borderRadius: BORDER_RADIUS.lg,
    paddingBottom: SPACING.xl,
  },
  oceanicCard: {
    borderRadius: BORDER_RADIUS.lg,
    borderWidth: 1,
    borderColor: COLORS.borderDark,
    overflow: 'hidden',
  },
  oceanicGradient: {
    borderRadius: BORDER_RADIUS.lg,
    position: 'relative',
    overflow: 'hidden',
  },
  oceanicBody: {
    padding: SPACING.lg,
    position: 'relative',
    zIndex: 1,
  },
  decorativeCircle1: {
    position: 'absolute',
    top: -30,
    right: -30,
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    zIndex: 0,
  },
  decorativeCircle2: {
    position: 'absolute',
    bottom: -20,
    left: -20,
    width: 70,
    height: 70,
    borderRadius: 35,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    zIndex: 0,
  },
  headerContainer: {
    width: '100%',
  },
  headerImageWrapper: {
    width: '100%',
    aspectRatio: 16 / 9,
    position: 'relative',
  },
  headerImage: {
    width: '100%',
    height: '100%',
  },
  headerScrim: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    top: 0,
  },
  headerOverlay: {
    position: 'absolute',
    left: SPACING.xl,
    right: SPACING.xl,
    bottom: SPACING.lg,
  },
  headerTitle: {
    color: COLORS.white,
    fontSize: TYPOGRAPHY.sizes.xxl,
    fontWeight: TYPOGRAPHY.weights.bold,
    lineHeight: 32,
  },
  headerSubtitle: {
    color: 'rgba(255,255,255,0.9)',
    marginTop: SPACING.xs,
    fontSize: TYPOGRAPHY.sizes.base,
  },
});
