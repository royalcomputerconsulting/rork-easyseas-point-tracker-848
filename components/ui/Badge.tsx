import React, { memo } from 'react';
import { View, Text, StyleSheet, ViewStyle, TextStyle } from 'react-native';
import { COLORS, BORDER_RADIUS, SPACING, TYPOGRAPHY } from '@/constants/theme';
import { LinearGradient } from 'expo-linear-gradient';

export type BadgeVariant = 'default' | 'primary' | 'success' | 'warning' | 'error' | 'gold' | 'silver' | 'bronze';
export type BadgeSize = 'small' | 'medium' | 'large';

export interface BadgeProps {
  label: string;
  variant?: BadgeVariant;
  size?: BadgeSize;
  gradient?: boolean;
  style?: ViewStyle;
  textStyle?: TextStyle;
  testID?: string;
}

function BadgeBase({ 
  label, 
  variant = 'default',
  size = 'medium',
  gradient = false,
  style, 
  textStyle,
  testID 
}: BadgeProps) {
  const { backgroundColor, textColor, gradientColors } = React.useMemo(() => {
    switch (variant) {
      case 'primary':
        return { 
          backgroundColor: COLORS.primaryBlue, 
          textColor: COLORS.white,
          gradientColors: ['#003087', '#0066CC'] as [string, string],
        };
      case 'success':
        return { 
          backgroundColor: COLORS.success, 
          textColor: COLORS.white,
          gradientColors: ['#10B981', '#34D399'] as [string, string],
        };
      case 'warning':
        return { 
          backgroundColor: COLORS.warning, 
          textColor: COLORS.white,
          gradientColors: ['#F59E0B', '#FBBF24'] as [string, string],
        };
      case 'error':
        return { 
          backgroundColor: COLORS.error, 
          textColor: COLORS.white,
          gradientColors: ['#DC2626', '#EF4444'] as [string, string],
        };
      case 'gold':
        return { 
          backgroundColor: COLORS.goldPremium, 
          textColor: COLORS.darkText,
          gradientColors: ['#D4AF37', '#FFD700'] as [string, string],
        };
      case 'silver':
        return { 
          backgroundColor: COLORS.silverPremium, 
          textColor: COLORS.darkText,
          gradientColors: ['#C0C0C0', '#E8E8E8'] as [string, string],
        };
      case 'bronze':
        return { 
          backgroundColor: COLORS.bronzePremium, 
          textColor: COLORS.white,
          gradientColors: ['#CD7F32', '#E89B5A'] as [string, string],
        };
      default:
        return { 
          backgroundColor: COLORS.accent, 
          textColor: COLORS.darkText,
          gradientColors: ['#D4AF37', '#FFD700'] as [string, string],
        };
    }
  }, [variant]);

  const sizeStyles = React.useMemo(() => {
    switch (size) {
      case 'small':
        return { paddingHorizontal: SPACING.sm, paddingVertical: SPACING.xs, fontSize: TYPOGRAPHY.sizes.xs };
      case 'large':
        return { paddingHorizontal: SPACING.lg, paddingVertical: SPACING.sm, fontSize: TYPOGRAPHY.sizes.base };
      default:
        return { paddingHorizontal: SPACING.md, paddingVertical: SPACING.xs, fontSize: TYPOGRAPHY.sizes.sm };
    }
  }, [size]);

  if (gradient) {
    return (
      <LinearGradient
        colors={gradientColors}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={[
          styles.badge,
          { 
            paddingHorizontal: sizeStyles.paddingHorizontal, 
            paddingVertical: sizeStyles.paddingVertical,
          },
          style,
        ]}
      >
        <Text style={[
          styles.text, 
          { color: textColor, fontSize: sizeStyles.fontSize },
          textStyle,
        ]}>
          {label}
        </Text>
      </LinearGradient>
    );
  }

  return (
    <View 
      style={[
        styles.badge, 
        { 
          backgroundColor,
          paddingHorizontal: sizeStyles.paddingHorizontal, 
          paddingVertical: sizeStyles.paddingVertical,
        },
        style,
      ]} 
      testID={testID ?? 'badge'}
    >
      <Text style={[
        styles.text, 
        { color: textColor, fontSize: sizeStyles.fontSize },
        textStyle,
      ]}>
        {label}
      </Text>
    </View>
  );
}

export const Badge = memo(BadgeBase);

const styles = StyleSheet.create({
  badge: {
    borderRadius: BORDER_RADIUS.pill,
    alignSelf: 'flex-start',
  },
  text: {
    fontWeight: TYPOGRAPHY.weights.bold,
  },
});
