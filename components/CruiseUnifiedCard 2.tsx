import React from 'react';
import { StyleSheet, Text, View, TouchableWithoutFeedback, Image } from 'react-native';
import { Calendar, MapPin, Users, Star } from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { createDateFromString } from '@/lib/date';
import { useAppState } from '@/state/AppStateProvider';
import { detectAndMapUnified } from '@/lib/unifiedCruise';
import type { UnifiedCruise } from '@/types/models';
import { COLORS, BORDER_RADIUS, SPACING, TYPOGRAPHY, SHADOW } from '@/constants/theme';

const SHIP_IMAGES = [
  'https://pub-e001eb4506b145aa938b5d3badbff6a5.r2.dev/attachments/qq4soztd150diiyws629g',
  'https://pub-e001eb4506b145aa938b5d3badbff6a5.r2.dev/attachments/yj8dv0fzn31zorg1brswr',
  'https://pub-e001eb4506b145aa938b5d3badbff6a5.r2.dev/attachments/htgjkihfjm31xch7i91ie',
  'https://pub-e001eb4506b145aa938b5d3badbff6a5.r2.dev/attachments/v4uayg5xsx94knzmeaxgz',
  'https://pub-e001eb4506b145aa938b5d3badbff6a5.r2.dev/attachments/1i2m8o67rn7we29e4m8ha',
  'https://pub-e001eb4506b145aa938b5d3badbff6a5.r2.dev/attachments/jvg2sugt85002c2b0fqyf',
  'https://pub-e001eb4506b145aa938b5d3badbff6a5.r2.dev/attachments/zsgtvvgdcfnr5ztopgxdb'
] as const;

export type CruiseUnifiedMode = 'outer' | 'detail';

interface CruiseUnifiedCardProps {
  cruise: unknown;
  mode?: CruiseUnifiedMode;
  onPress?: () => void;
  headerRight?: React.ReactNode;
  footer?: React.ReactNode;
  recommended?: boolean;
}

function formatDateShort(dateInput: unknown): string {
  if (dateInput === null || dateInput === undefined) return 'TBD';
  try {
    let date: Date;
    if (typeof dateInput === 'number') {
      const excelEpoch = new Date(1900, 0, 1);
      date = new Date(excelEpoch.getTime() + (dateInput - 2) * 24 * 60 * 60 * 1000);
    } else {
      date = createDateFromString(String(dateInput));
    }
    if (isNaN(date.getTime())) return String(dateInput);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  } catch {
    return String(dateInput);
  }
}

function formatDateMmDdYyyy(dateInput: unknown): string {
  if (dateInput === null || dateInput === undefined) return 'TBD';
  try {
    let date: Date;
    if (typeof dateInput === 'number') {
      const excelEpoch = new Date(1900, 0, 1);
      date = new Date(excelEpoch.getTime() + (dateInput - 2) * 24 * 60 * 60 * 1000);
    } else {
      date = createDateFromString(String(dateInput));
    }
    if (isNaN(date.getTime())) return String(dateInput);
    const mm = String(date.getMonth() + 1).padStart(2, '0');
    const dd = String(date.getDate()).padStart(2, '0');
    const yyyy = date.getFullYear();
    return `${mm}-${dd}-${yyyy}`;
  } catch {
    return String(dateInput);
  }
}

function CruiseUnifiedCardComponent({ cruise, mode = 'outer', onPress, headerRight, footer, recommended }: CruiseUnifiedCardProps) {
  const { localData, hasLocalData, settings } = useAppState();

  const unified: UnifiedCruise = React.useMemo(() => {
    const mapped = detectAndMapUnified(cruise as any);
    console.log('[CruiseUnifiedCard] mapped', mapped);
    return mapped;
  }, [cruise]);

  const itineraryText = React.useMemo(() => {
    const pr = String(unified.portsRoute ?? '').trim();
    const itin = String(unified.itineraryName ?? '').trim();
    const depPort = String(unified.departurePort ?? '').trim();
    const looksDetailed = pr.includes(',') || pr.includes(' - ');
    const isSameAsPort = depPort.length > 0 && pr.toLowerCase() === depPort.toLowerCase();
    const isValidPr = pr.length > 0 && looksDetailed && !isSameAsPort;
    if (isValidPr) return pr;
    if (itin && itin.toLowerCase() !== String(unified.ship || '').toLowerCase()) return itin;
    const combined = [depPort, itin].filter(Boolean).join(' • ');
    return combined || '—';
  }, [unified.portsRoute, unified.itineraryName, unified.departurePort, unified.ship]);

  const isBooked = React.useMemo(() => {
    if (hasLocalData && Array.isArray(localData.booked)) {
      return localData.booked.some((b: any) => {
        const idMatch = String(b.cruiseId ?? '') === String(unified.id ?? '');
        const shipMatch = b.ship === unified.ship;
        const dateMatch = b.startDate === unified.departureDate || b.departureDate === unified.departureDate;
        return idMatch || (shipMatch && dateMatch);
      });
    }
    return false;
  }, [hasLocalData, localData.booked, unified.id, unified.ship, unified.departureDate]);

  const pointsPerDay = React.useMemo(() => {
    const v = settings?.pointsPerDay ?? 74;
    return typeof v === 'number' && !Number.isNaN(v) ? v : 74;
  }, [settings?.pointsPerDay]);

  const approxPoints = React.useMemo(() => {
    const n = typeof unified.nights === 'number' ? unified.nights : (unified.nights ? Number(unified.nights) : 0);
    if (!n || Number.isNaN(n)) return null;
    return Math.round(pointsPerDay * n);
  }, [pointsPerDay, unified.nights]);

  const daysToGo = React.useMemo(() => {
    try {
      if (!unified.departureDate) return null;
      const today = new Date();
      const dep = createDateFromString(unified.departureDate as any);
      const diff = Math.ceil((dep.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
      if (diff > 0) return diff;
      return null;
    } catch {
      return null;
    }
  }, [unified.departureDate]);

  const randomShipImage = React.useMemo(() => {
    const hash = (unified.id || unified.ship || '').split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
    return SHIP_IMAGES[hash % SHIP_IMAGES.length];
  }, [unified.id, unified.ship]);

  return (
    <TouchableWithoutFeedback onPress={onPress}>
      <View style={[styles.card, mode === 'detail' && styles.cardDetail]} testID={`unified-cruise-${unified.id}`}>
        <View style={styles.imageContainer}>
          <Image 
            source={{ uri: randomShipImage }}
            style={styles.shipImage}
            resizeMode="cover"
          />
          <LinearGradient
            colors={['rgba(0,0,0,0.3)', 'rgba(11,23,59,0.9)']}
            start={{ x: 0, y: 0 }}
            end={{ x: 0, y: 1 }}
            style={styles.imageOverlay}
          >
            <View style={styles.shipHeader}>
              <Text style={styles.shipName} numberOfLines={1}>{unified.ship}</Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                {recommended ? (
                  <View style={styles.recommendedPill} testID="unified-badge-recommended" accessibilityLabel="Recommended">
                    <Text style={styles.recommendedText}>Recommended</Text>
                  </View>
                ) : null}
                {unified.offerCode ? (
                  <View style={styles.offerCodeBadge}>
                    <Text style={styles.offerCodeText}>{unified.offerCode}</Text>
                  </View>
                ) : null}
                {unified.offerName ? (
                  <View style={styles.offerNameBadge}>
                    <Text style={styles.offerNameText} numberOfLines={1}>{unified.offerName}</Text>
                  </View>
                ) : null}
                {isBooked ? (
                  unified.reservationNumber ? (
                    <View style={styles.bookedBadge}>
                      <Text style={styles.bookedBadgeText}>AVAILABLE • #{unified.reservationNumber}</Text>
                    </View>
                  ) : (
                    <View style={styles.bookedBadge}>
                      <Text style={styles.bookedBadgeText}>BOOKED</Text>
                    </View>
                  )
                ) : (
                  <View style={styles.availableBadge}>
                    <Text style={styles.availableBadgeText}>AVAILABLE</Text>
                  </View>
                )}
                {headerRight ? <View>{headerRight}</View> : null}
              </View>
            </View>
          </LinearGradient>
        </View>

        <View style={styles.body}>
          <View style={styles.topRow}>
            <View style={styles.rowLeft}>
              <Calendar size={14} color={COLORS.mutedLavender} />
              <Text style={styles.dateText} numberOfLines={2}>
                {mode === 'detail'
                  ? `${formatDateMmDdYyyy(unified.departureDate)}${unified.returnDate && unified.returnDate !== unified.departureDate ? ` - ${formatDateMmDdYyyy(unified.returnDate)}` : ''}`
                  : `${formatDateShort(unified.departureDate)}${unified.returnDate && unified.returnDate !== unified.departureDate ? ` - ${formatDateShort(unified.returnDate)}` : ''}`
                }
              </Text>
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              {mode === 'outer' && unified.value ? (
                <View style={styles.offerInline}>
                  <Star size={12} color={COLORS.goldPremium} />
                  <Text style={styles.offerInlineText} numberOfLines={1}>{unified.offerName ?? unified.value}</Text>
                </View>
              ) : null}
              {typeof unified.retailInteriorPrice === 'number' ? (
                <View style={styles.pricePill} testID={`retail-interior-${unified.id}`}>
                  <Text style={styles.pricePillText}>${Math.round(unified.retailInteriorPrice).toLocaleString()} Interior</Text>
                </View>
              ) : null}
            </View>
          </View>

          <Text style={styles.itinerary} numberOfLines={2}>{itineraryText}</Text>

          <View style={styles.detailsMini}>
            <View style={styles.detailItem}>
              <Users size={12} color={COLORS.mutedLavender} />
              <Text style={styles.detailText}>{(unified.guests ?? 2)} Guests</Text>
            </View>
            <View style={styles.detailItem}>
              <MapPin size={12} color={COLORS.mutedLavender} />
              <Text style={styles.detailText} numberOfLines={1}>{unified.departurePort ?? 'Unknown Port'}</Text>
            </View>
            <View style={styles.detailItem}>
              <Text style={styles.detailText}>{unified.nights ?? 7} Nights</Text>
            </View>
            {approxPoints ? (
              <View style={styles.pointsPill} testID={`approx-points-${unified.id}`} accessibilityLabel="Approximate casino points and days to go">
                <Star size={10} color={COLORS.highlightAqua} />
                <Text style={styles.pointsPillText}>
                  ~ {approxPoints} pts{mode === 'detail' && daysToGo ? ` • ${daysToGo}d` : ''}
                </Text>
              </View>
            ) : null}
          </View>

          {footer ? <View>{footer}</View> : null}
        </View>
      </View>
    </TouchableWithoutFeedback>
  );
}

export const CruiseUnifiedCard = React.memo(CruiseUnifiedCardComponent);

const styles = StyleSheet.create({
  card: {
    backgroundColor: COLORS.primaryDark,
    borderRadius: BORDER_RADIUS.card,
    marginBottom: SPACING.md,
    borderWidth: 1,
    borderColor: COLORS.primaryGradientStart,
    ...SHADOW.royalCard,
    overflow: 'hidden',
  },
  cardDetail: {
    borderColor: COLORS.highlightAqua,
  },
  imageContainer: {
    height: 92,
    position: 'relative',
  },
  shipImage: {
    width: '100%',
    height: '100%',
  },
  imageOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
  },
  shipHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  shipName: {
    fontSize: TYPOGRAPHY.sizes.lg,
    fontWeight: TYPOGRAPHY.weights.bold,
    color: COLORS.iceWhite,
    flex: 1,
    textShadowColor: 'rgba(0,0,0,0.5)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  availableBadge: {
    backgroundColor: COLORS.emeraldGreen,
    paddingHorizontal: SPACING.md,
    paddingVertical: 4,
    borderRadius: BORDER_RADIUS.sm,
  },
  availableBadgeText: {
    color: COLORS.white,
    fontSize: TYPOGRAPHY.sizes.xs,
    fontWeight: TYPOGRAPHY.weights.bold,
    letterSpacing: 0.5,
  },
  bookedBadge: {
    backgroundColor: COLORS.goldPremium,
    paddingHorizontal: SPACING.md,
    paddingVertical: 4,
    borderRadius: BORDER_RADIUS.sm,
  },
  bookedBadgeText: {
    color: COLORS.primaryDark,
    fontSize: TYPOGRAPHY.sizes.xs,
    fontWeight: TYPOGRAPHY.weights.bold,
    letterSpacing: 0.5,
  },
  offerCodeBadge: {
    backgroundColor: COLORS.primaryGradientEnd,
    paddingHorizontal: SPACING.sm,
    paddingVertical: 4,
    borderRadius: BORDER_RADIUS.sm,
    borderWidth: 1,
    borderColor: COLORS.accentMagenta,
  },
  offerCodeText: {
    color: COLORS.iceWhite,
    fontSize: TYPOGRAPHY.sizes.xs,
    fontWeight: TYPOGRAPHY.weights.bold,
    letterSpacing: 0.5,
  },
  offerNameBadge: {
    backgroundColor: 'rgba(212, 175, 55, 0.2)',
    paddingHorizontal: SPACING.sm,
    paddingVertical: 4,
    borderRadius: BORDER_RADIUS.sm,
    borderWidth: 1,
    borderColor: COLORS.goldPremium,
    maxWidth: 120,
  },
  offerNameText: {
    color: COLORS.goldPremium,
    fontSize: TYPOGRAPHY.sizes.xs,
    fontWeight: TYPOGRAPHY.weights.bold,
    letterSpacing: 0.3,
  },
  recommendedPill: {
    backgroundColor: COLORS.goldPremium,
    paddingHorizontal: SPACING.sm,
    paddingVertical: 4,
    borderRadius: BORDER_RADIUS.pill,
    borderWidth: 1,
    borderColor: COLORS.goldLight,
  },
  recommendedText: {
    color: COLORS.primaryDark,
    fontSize: 10,
    fontWeight: TYPOGRAPHY.weights.bold,
    letterSpacing: 0.6,
  },
  body: {
    padding: SPACING.md,
  },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  rowLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    maxWidth: '65%',
  },
  dateText: {
    fontSize: TYPOGRAPHY.sizes.sm,
    color: COLORS.mutedLavender,
    fontWeight: TYPOGRAPHY.weights.semibold,
  },
  itinerary: {
    fontSize: TYPOGRAPHY.sizes.base,
    color: COLORS.iceWhite,
    fontWeight: TYPOGRAPHY.weights.bold,
    marginBottom: SPACING.sm,
    lineHeight: 20,
  },
  detailsMini: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  detailItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    minWidth: '30%',
  },
  detailText: {
    fontSize: 11,
    color: COLORS.mutedLavender,
    fontWeight: TYPOGRAPHY.weights.semibold,
  },
  offerInline: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(212, 175, 55, 0.2)',
    paddingHorizontal: SPACING.sm,
    paddingVertical: 4,
    borderRadius: BORDER_RADIUS.pill,
    borderWidth: 1,
    borderColor: COLORS.goldPremium,
    maxWidth: '35%',
  },
  pointsPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(46, 140, 255, 0.2)',
    paddingHorizontal: SPACING.sm,
    paddingVertical: 4,
    borderRadius: BORDER_RADIUS.pill,
    borderWidth: 1,
    borderColor: COLORS.highlightAqua,
  },
  pointsPillText: {
    fontSize: 11,
    color: COLORS.iceWhite,
    fontWeight: TYPOGRAPHY.weights.bold,
  },

  offerInlineText: {
    fontSize: 11,
    color: COLORS.goldPremium,
    fontWeight: TYPOGRAPHY.weights.bold,
  },
  pricePill: {
    backgroundColor: 'rgba(0, 163, 224, 0.2)',
    paddingHorizontal: SPACING.sm,
    paddingVertical: 4,
    borderRadius: BORDER_RADIUS.pill,
    borderWidth: 1,
    borderColor: COLORS.highlightAqua,
  },
  pricePillText: {
    fontSize: 11,
    color: COLORS.iceWhite,
    fontWeight: TYPOGRAPHY.weights.bold,
  },
});
