import React, { memo } from 'react';
import { TouchableOpacity, Text, StyleSheet, ViewStyle, TextStyle, Animated } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { COLORS, GRADIENTS, SPACING, TYPOGRAPHY, SHADOW } from '@/constants/theme';

export type ButtonVariant = 'primary' | 'secondary' | 'danger' | 'success' | 'gold' | 'pink' | 'royalOutline';
export type ButtonSize = 'small' | 'medium' | 'large';

export interface GradientButtonProps {
  title: string;
  onPress: () => void;
  variant?: ButtonVariant;
  size?: ButtonSize;
  disabled?: boolean;
  style?: ViewStyle;
  textStyle?: TextStyle;
  testID?: string;
}

function GradientButtonBase({ 
  title, 
  onPress, 
  variant = 'primary',
  size = 'medium',
  disabled = false,
  style, 
  textStyle,
  testID 
}: GradientButtonProps) {
  const scaleAnim = React.useRef(new Animated.Value(1)).current;

  const handlePressIn = () => {
    Animated.spring(scaleAnim, {
      toValue: 0.96,
      useNativeDriver: true,
    }).start();
  };

  const handlePressOut = () => {
    Animated.spring(scaleAnim, {
      toValue: 1,
      useNativeDriver: true,
    }).start();
  };

  const gradientColors = React.useMemo(() => {
    switch (variant) {
      case 'pink':
        return GRADIENTS.pinkSolid;
      case 'primary':
        return GRADIENTS.oceanPrimary;
      case 'secondary':
        return [COLORS.white, COLORS.lightGray];
      case 'royalOutline':
        return [COLORS.white, COLORS.white];
      case 'danger':
        return GRADIENTS.sunset;
      case 'success':
        return GRADIENTS.emerald;
      case 'gold':
        return GRADIENTS.gold;
      default:
        return GRADIENTS.oceanPrimary;
    }
  }, [variant]);

  const sizeStyles = React.useMemo(() => {
    switch (size) {
      case 'small':
        return { paddingVertical: Math.max(SPACING.sm, 12), paddingHorizontal: SPACING.md, fontSize: TYPOGRAPHY.sizes.sm };
      case 'large':
        return { paddingVertical: Math.max(SPACING.xl, 16), paddingHorizontal: SPACING.xxl, fontSize: TYPOGRAPHY.sizes.lg };
      default:
        return { paddingVertical: Math.max(SPACING.lg, 14), paddingHorizontal: SPACING.xl, fontSize: TYPOGRAPHY.sizes.base };
    }
  }, [size]);

  const isOutline = variant === 'royalOutline';
  const textColor = isOutline ? COLORS.royalBlue : COLORS.white;

  return (
    <Animated.View style={[{ transform: [{ scale: scaleAnim }] }, style]}>
      <TouchableOpacity 
        onPress={onPress} 
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        activeOpacity={0.9} 
        disabled={disabled}
        testID={testID ?? 'gradient-button'}
      >
        <LinearGradient
          colors={gradientColors as [string, string]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[
            styles.gradient,
            { 
              paddingVertical: sizeStyles.paddingVertical, 
              paddingHorizontal: sizeStyles.paddingHorizontal,
              opacity: disabled ? 0.5 : 1,
              minHeight: 48,
            },
            isOutline && styles.royalOutline,
          ]}
        >
          <Text style={[
            styles.title, 
            { color: textColor, fontSize: sizeStyles.fontSize, letterSpacing: TYPOGRAPHY.tracking.wide },
            textStyle,
          ]} numberOfLines={1} adjustsFontSizeToFit>
            {title}
          </Text>
        </LinearGradient>
      </TouchableOpacity>
    </Animated.View>
  );
}

export const GradientButton = memo(GradientButtonBase);

const styles = StyleSheet.create({
  gradient: {
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    ...SHADOW.subtle,
  },
  royalOutline: {
    borderWidth: 2,
    borderColor: COLORS.royalBlue,
    backgroundColor: COLORS.white,
  },
  title: {
    fontWeight: TYPOGRAPHY.weights.bold,
  },
});
