import React, { memo, useMemo } from 'react';
import { View, StyleSheet, LayoutChangeEvent } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { COLORS } from '@/constants/theme';

export interface ProgressBarProps {
  value: number;
  max?: number;
  height?: number;
}

function ProgressBarBase({ value, max = 100, height = 10 }: ProgressBarProps) {
  const [containerWidth, setContainerWidth] = React.useState<number>(0);
  const roundedValue = useMemo(() => Math.round(value), [value]);
  const roundedMax = useMemo(() => Math.round(max), [max]);
  const percentage = useMemo(() => {
    if (roundedMax <= 0) return 0;
    return Math.max(0, Math.min(1, roundedValue / roundedMax));
  }, [roundedValue, roundedMax]);

  const roundedHeight = Math.round(height);
  const fillWidth = Math.round(containerWidth * percentage);

  const handleLayout = (event: LayoutChangeEvent) => {
    setContainerWidth(event.nativeEvent.layout.width);
  };

  return (
    <View 
      style={[styles.container, { height: roundedHeight }]}
      onLayout={handleLayout}
      accessibilityRole="progressbar"
      accessibilityValue={{ now: roundedValue, min: 0, max: roundedMax }}
      testID="progress-bar"
    >
      {containerWidth > 0 && (
        <LinearGradient
          colors={[COLORS.primary, COLORS.secondary] as [string, string]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[styles.fill, { width: fillWidth, height: roundedHeight }]}
        />
      )}
    </View>
  );
}

export const ProgressBar = memo(ProgressBarBase);

const styles = StyleSheet.create({
  container: {
    width: '100%',
    backgroundColor: '#E6EEF8',
    borderRadius: 999,
    overflow: 'hidden',
  },
  fill: {
    borderRadius: 999,
  },
});
