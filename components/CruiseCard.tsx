import React from "react";
import { StyleSheet, Text, View, TouchableWithoutFeedback, Image } from "react-native";
import { Calendar, MapPin, Users, Clock, Star } from "lucide-react-native";
import { LinearGradient } from 'expo-linear-gradient';
import { createDateFromString } from "@/lib/date";
import { useAppState } from "@/state/AppStateProvider";
import { detectAndMapUnified } from "@/lib/unifiedCruise";
import type { UnifiedCruise } from "@/types/models";
import { COLORS, BORDER_RADIUS, SPACING, TYPOGRAPHY, SHADOW } from "@/constants/theme";

const SHIP_IMAGES = [
  'https://pub-e001eb4506b145aa938b5d3badbff6a5.r2.dev/attachments/qq4soztd150diiyws629g',
  'https://pub-e001eb4506b145aa938b5d3badbff6a5.r2.dev/attachments/yj8dv0fzn31zorg1brswr',
  'https://pub-e001eb4506b145aa938b5d3badbff6a5.r2.dev/attachments/htgjkihfjm31xch7i91ie',
  'https://pub-e001eb4506b145aa938b5d3badbff6a5.r2.dev/attachments/v4uayg5xsx94knzmeaxgz',
  'https://pub-e001eb4506b145aa938b5d3badbff6a5.r2.dev/attachments/1i2m8o67rn7we29e4m8ha',
  'https://pub-e001eb4506b145aa938b5d3badbff6a5.r2.dev/attachments/jvg2sugt85002c2b0fqyf',
  'https://pub-e001eb4506b145aa938b5d3badbff6a5.r2.dev/attachments/zsgtvvgdcfnr5ztopgxdb'
] as const;

interface CruiseCardProps {
  cruise: any;
  onPress: () => void;
  recommended?: boolean;
}

function CruiseCardComponent({ cruise, onPress, recommended }: CruiseCardProps) {
  const { localData, hasLocalData } = useAppState();
  
  const unifiedCruise: UnifiedCruise = React.useMemo(() => {
    const mapped = detectAndMapUnified(cruise);
    console.log('[CruiseCard] UnifiedCruise mapped:', mapped);
    return mapped;
  }, [cruise]);
  
  const isBooked = React.useMemo(() => {
    if (cruise.isBooked === true) {
      console.log('[CruiseCard] Cruise is explicitly marked as booked:', unifiedCruise.ship);
      return true;
    }

    console.log('[CruiseCard] Checking if cruise is booked (local only):', {
      cruiseId: unifiedCruise.id,
      ship: unifiedCruise.ship,
      departureDate: unifiedCruise.departureDate,
      localBookedCount: Array.isArray(localData.booked) ? localData.booked.length : 0,
    });

    if (hasLocalData && Array.isArray(localData.booked)) {
      const localBooked = localData.booked.some((bookedCruise: any) => {
        const matches = bookedCruise.cruiseId === unifiedCruise.id ||
          (bookedCruise.ship === unifiedCruise.ship &&
            (bookedCruise.startDate === unifiedCruise.departureDate ||
              bookedCruise.departureDate === unifiedCruise.departureDate));
        return matches;
      });
      if (localBooked) {
        console.log('[CruiseCard] Cruise is booked (local):', unifiedCruise.ship);
        return true;
      }
    }

    console.log('[CruiseCard] Cruise is NOT booked:', unifiedCruise.ship);
    return false;
  }, [cruise.isBooked, unifiedCruise, localData, hasLocalData]);
  
  const formatDate = (dateInput: any) => {
    if (dateInput === null || dateInput === undefined) return 'TBD';
    try {
      let date: Date;
      if (typeof dateInput === 'number') {
        const excelEpoch = new Date(1900, 0, 1);
        date = new Date(excelEpoch.getTime() + (dateInput - 2) * 24 * 60 * 60 * 1000);
      } else {
        date = createDateFromString(dateInput);
      }
      if (isNaN(date.getTime())) return String(dateInput);
      return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    } catch {
      return String(dateInput);
    }
  };

  const getDaysUntilExpiry = (expiryDate?: any) => {
    if (!expiryDate || typeof expiryDate !== 'string') {
      console.log('getDaysUntilExpiry: Invalid expiry date:', expiryDate, typeof expiryDate);
      return null;
    }
    
    try {
      const today = new Date();
      const expiry = createDateFromString(expiryDate);
      const diffTime = expiry.getTime() - today.getTime();
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      return diffDays > 0 ? diffDays : 0;
    } catch (error) {
      console.log('getDaysUntilExpiry: Error calculating days:', error, expiryDate);
      return null;
    }
  };

  const hasSpecialOffer = typeof unifiedCruise.value === 'string' && unifiedCruise.value.trim().length > 0;
  const daysUntilExpiry = getDaysUntilExpiry(unifiedCruise.offerExpireDate);

  const itineraryText = React.useMemo(() => {
    const pr = String(unifiedCruise.portsRoute ?? '').trim();
    const itin = String(unifiedCruise.itineraryName ?? '').trim();
    const depPort = String(unifiedCruise.departurePort ?? '').trim();
    const looksDetailed = pr.includes(',') || pr.includes(' - ');
    const isSameAsPort = depPort.length > 0 && pr.toLowerCase() === depPort.toLowerCase();
    const isValidPr = pr.length > 0 && looksDetailed && !isSameAsPort;
    if (isValidPr) return pr;
    if (itin && itin.toLowerCase() !== String(unifiedCruise.ship || '').toLowerCase()) return itin;
    const combined = [depPort, itin].filter(Boolean).join(' • ');
    return combined || '—';
  }, [unifiedCruise.portsRoute, unifiedCruise.itineraryName, unifiedCruise.departurePort, unifiedCruise.ship]);

  const randomShipImage = React.useMemo(() => {
    const hash = (unifiedCruise.id || unifiedCruise.ship || '').split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
    return SHIP_IMAGES[hash % SHIP_IMAGES.length];
  }, [unifiedCruise.id, unifiedCruise.ship]);

  return (
    <TouchableWithoutFeedback onPress={onPress}>
      <View style={styles.card} testID={`cruise-${unifiedCruise.id}`}>
        <LinearGradient
          colors={[COLORS.primaryDark, COLORS.primaryGradientStart]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.gradientContainer}
        >
          <View style={styles.decorativeCircle1} />
          <View style={styles.decorativeCircle2} />

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
                <Text style={styles.shipName}>{unifiedCruise.ship}</Text>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  {recommended ? (
                    <View style={styles.recommendedPill} testID="badge-recommended" accessibilityLabel="Recommended">
                      <Text style={styles.recommendedText}>Recommended</Text>
                    </View>
                  ) : null}
                  {unifiedCruise.offerCode && (
                    <View style={styles.offerCodeBadge}>
                      <Text style={styles.offerCodeText}>{unifiedCruise.offerCode}</Text>
                    </View>
                  )}
                  {cruise?.isCompleted || unifiedCruise.status === 'completed' ? (
                    <View style={styles.completedBadge}>
                      <Text style={styles.completedBadgeText}>✓ COMPLETED</Text>
                    </View>
                  ) : !isBooked ? (
                    <View style={styles.availableBadge}>
                      <Text style={styles.availableBadgeText}>AVAILABLE</Text>
                    </View>
                  ) : unifiedCruise.reservationNumber ? (
                    <View style={styles.bookedBadge}>
                      <Text style={styles.bookedBadgeText}>AVAILABLE • #{unifiedCruise.reservationNumber}</Text>
                    </View>
                  ) : (
                    <View style={styles.bookedBadge}>
                      <Text style={styles.bookedBadgeText}>✓ BOOKED</Text>
                    </View>
                  )}
                </View>
              </View>
            </LinearGradient>
          </View>
          
          <View style={styles.cardContent}>
            <View style={styles.topRow}>
              <View style={styles.dateContainer}>
                <Calendar size={16} color={COLORS.textLightSecondary} />
                <Text style={styles.dateText}>
                  {formatDate(unifiedCruise.departureDate)}
                  {unifiedCruise.returnDate && unifiedCruise.returnDate !== unifiedCruise.departureDate && 
                    ` - ${formatDate(unifiedCruise.returnDate)}`
                  }
                </Text>
              </View>
            </View>
            
            <Text style={styles.itinerary}>{itineraryText}</Text>
            
            <View style={styles.detailsGrid}>
              <View style={styles.detailItem}>
                <Users size={14} color={COLORS.textLightSecondary} />
                <Text style={styles.detailText}>{(unifiedCruise.guests ?? 2)} Guests</Text>
              </View>
              <View style={styles.detailItem}>
                <MapPin size={14} color={COLORS.textLightSecondary} />
                <Text style={styles.detailText}>{unifiedCruise.departurePort ?? 'Unknown Port'}</Text>
              </View>
              <View style={styles.detailItem}>
                <Clock size={14} color={COLORS.textLightSecondary} />
                <Text style={styles.detailText}>{unifiedCruise.nights ?? 7} Nights</Text>
              </View>
            </View>
            
            <View style={styles.accommodationSection}>
              <Text style={styles.accommodationLabel}>Accommodation</Text>
              <Text style={styles.accommodationValue}>{unifiedCruise.cabinType ?? 'Balcony'} • {(unifiedCruise.guests ?? 2)} Guests</Text>
            </View>
            
            {hasSpecialOffer && (
              <View style={styles.casinoOfferSection}>
                <View style={styles.casinoOfferHeader}>
                  <View style={styles.casinoBrand}>
                    <Star size={16} color={COLORS.goldPremium} fill={COLORS.goldPremium} />
                    <Text style={styles.casinoOfferTitle}>CASINO SPECIAL</Text>
                  </View>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    {unifiedCruise.offerCode && (
                      <View style={styles.offerCodePill}>
                        <Text style={styles.offerCodePillText}>{unifiedCruise.offerCode}</Text>
                      </View>
                    )}
                    {daysUntilExpiry !== null && daysUntilExpiry <= 7 && (
                      <View style={styles.urgencyBadge}>
                        <Text style={styles.urgencyText}>{daysUntilExpiry}d left</Text>
                      </View>
                    )}
                  </View>
                </View>
                
                <View style={styles.specialOfferCard}>
                  <View style={styles.offerContent}>
                    <Text style={styles.specialOfferLabel}>Special Offer</Text>
                    <Text style={styles.specialOfferValue}>{unifiedCruise.value ?? ''}</Text>
                    <Text style={styles.specialOfferGuests}>for {(unifiedCruise.guests ?? 2)} guests</Text>
                  </View>
                  
                  {daysUntilExpiry !== null && (
                    <View style={styles.expiryInfo}>
                      <Text style={styles.expiryText}>
                        Expires {formatDate(unifiedCruise.offerExpireDate!)}
                      </Text>
                    </View>
                  )}
                </View>
              </View>
            )}
            
            <View style={styles.pricingSectionCompact}>
              <View style={styles.rowHeaderCompact}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <Star size={14} color={COLORS.aquaAccent} />
                  <Text style={styles.rowTitleCompact}>Casino Offer</Text>
                </View>
              </View>
              <View style={styles.rowContentCompact}>
                <Text style={styles.rowChipLabel}>Name</Text>
                <Text style={styles.rowChipValue} numberOfLines={1}>
                  {unifiedCruise.offerName ?? unifiedCruise.value ?? '—'}
                </Text>
                {typeof (unifiedCruise as any).retailInteriorPrice === 'number' ? (
                  <Text style={styles.rowChipValue} numberOfLines={1}>
                    • ${Math.round((unifiedCruise as any).retailInteriorPrice).toLocaleString()} Interior
                  </Text>
                ) : null}
              </View>
            </View>

            <View style={styles.analyticsSectionCompact}>
              <View style={styles.rowHeaderCompact}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <MapPin size={14} color={COLORS.goldPremium} />
                  <Text style={styles.rowTitleCompact}>Itinerary</Text>
                </View>
              </View>
              <View style={styles.rowContentCompact}>
                <Text style={styles.rowChipLabel}>Route</Text>
                <Text style={styles.rowChipValue} numberOfLines={1}>{itineraryText}</Text>
              </View>
            </View>
          </View>
        </LinearGradient>
      </View>
    </TouchableWithoutFeedback>
  );
}

export const CruiseCard = React.memo(CruiseCardComponent, (prev, next) => {
  const prevId = prev.cruise?.id ?? `${prev.cruise?.ship ?? ''}-${prev.cruise?.departureDate ?? ''}`;
  const nextId = next.cruise?.id ?? `${next.cruise?.ship ?? ''}-${next.cruise?.departureDate ?? ''}`;
  return prevId === nextId && prev.recommended === next.recommended;
});

const styles = StyleSheet.create({
  card: {
    borderRadius: BORDER_RADIUS.lg,
    marginBottom: SPACING.md,
    overflow: "hidden",
    ...SHADOW.royalCard,
  },
  gradientContainer: {
    borderRadius: BORDER_RADIUS.lg,
    position: 'relative',
    overflow: 'hidden',
  },
  decorativeCircle1: {
    position: 'absolute',
    top: -30,
    right: -30,
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: 'rgba(46, 140, 255, 0.12)',
    zIndex: 0,
  },
  decorativeCircle2: {
    position: 'absolute',
    bottom: -20,
    left: -20,
    width: 70,
    height: 70,
    borderRadius: 35,
    backgroundColor: 'rgba(91, 66, 243, 0.08)',
    zIndex: 0,
  },
  imageContainer: {
    height: 96,
    position: "relative",
  },
  shipImage: {
    width: "100%",
    height: "100%",
  },
  imageOverlay: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
  },
  shipHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
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
    color: COLORS.navyDeep,
    fontSize: TYPOGRAPHY.sizes.xs,
    fontWeight: TYPOGRAPHY.weights.bold,
    letterSpacing: 0.5,
  },
  completedBadge: {
    backgroundColor: COLORS.purpleAccent,
    paddingHorizontal: SPACING.md,
    paddingVertical: 4,
    borderRadius: BORDER_RADIUS.sm,
  },
  completedBadgeText: {
    color: COLORS.white,
    fontSize: TYPOGRAPHY.sizes.xs,
    fontWeight: TYPOGRAPHY.weights.bold,
    letterSpacing: 0.5,
  },
  cardContent: {
    padding: SPACING.md,
    position: 'relative',
    zIndex: 1,
  },
  topRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: SPACING.sm,
  },
  dateContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
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
  detailsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: SPACING.sm,
    marginBottom: SPACING.sm,
  },
  detailItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    minWidth: "30%",
  },
  detailText: {
    fontSize: TYPOGRAPHY.sizes.xs,
    color: COLORS.mutedLavender,
    fontWeight: TYPOGRAPHY.weights.semibold,
  },
  accommodationSection: {
    marginBottom: SPACING.md,
  },
  accommodationLabel: {
    fontSize: TYPOGRAPHY.sizes.xs,
    color: COLORS.mutedLavender,
    marginBottom: 2,
  },
  accommodationValue: {
    fontSize: TYPOGRAPHY.sizes.sm,
    color: COLORS.iceWhite,
    fontWeight: TYPOGRAPHY.weights.semibold,
  },
  casinoOfferSection: {
    backgroundColor: 'rgba(212, 175, 55, 0.15)',
    borderRadius: BORDER_RADIUS.md,
    padding: SPACING.md,
    marginBottom: SPACING.md,
    borderWidth: 1,
    borderColor: COLORS.goldPremium,
  },
  casinoOfferHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: SPACING.sm,
  },
  casinoBrand: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  casinoOfferTitle: {
    fontSize: TYPOGRAPHY.sizes.sm,
    color: COLORS.goldPremium,
    fontWeight: TYPOGRAPHY.weights.bold,
    letterSpacing: 0.5,
  },
  urgencyBadge: {
    backgroundColor: COLORS.sunsetOrange,
    paddingHorizontal: SPACING.sm,
    paddingVertical: 4,
    borderRadius: BORDER_RADIUS.pill,
  },
  urgencyText: {
    color: COLORS.white,
    fontSize: 10,
    fontWeight: TYPOGRAPHY.weights.bold,
  },
  specialOfferCard: {
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: BORDER_RADIUS.sm,
    padding: SPACING.sm,
    borderWidth: 1,
    borderColor: 'rgba(212, 175, 55, 0.3)',
  },
  offerContent: {
    alignItems: "center",
    marginBottom: 6,
  },
  specialOfferLabel: {
    fontSize: TYPOGRAPHY.sizes.xs,
    color: COLORS.textLightSecondary,
    marginBottom: 2,
    fontWeight: TYPOGRAPHY.weights.semibold,
  },
  specialOfferValue: {
    fontSize: TYPOGRAPHY.sizes.xl,
    color: COLORS.goldPremium,
    fontWeight: TYPOGRAPHY.weights.bold,
    marginBottom: 2,
  },
  specialOfferGuests: {
    fontSize: TYPOGRAPHY.sizes.sm,
    color: COLORS.textLightSecondary,
    fontWeight: TYPOGRAPHY.weights.semibold,
  },
  expiryInfo: {
    alignItems: "center",
  },
  expiryText: {
    fontSize: 10,
    color: COLORS.textLightSecondary,
    fontWeight: TYPOGRAPHY.weights.semibold,
  },
  pricingSectionCompact: {
    backgroundColor: 'rgba(0, 163, 224, 0.15)',
    borderRadius: BORDER_RADIUS.sm,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    marginBottom: SPACING.sm,
    borderWidth: 1,
    borderColor: 'rgba(0, 163, 224, 0.3)',
  },
  rowHeaderCompact: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  rowTitleCompact: {
    fontSize: TYPOGRAPHY.sizes.sm,
    color: COLORS.aquaAccent,
    fontWeight: TYPOGRAPHY.weights.bold,
  },
  rowContentCompact: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 6,
  },
  rowChipLabel: {
    fontSize: TYPOGRAPHY.sizes.xs,
    color: COLORS.mutedLavender,
    fontWeight: TYPOGRAPHY.weights.semibold,
  },
  rowChipValue: {
    fontSize: TYPOGRAPHY.sizes.sm,
    color: COLORS.iceWhite,
    fontWeight: TYPOGRAPHY.weights.bold,
  },
  analyticsSectionCompact: {
    backgroundColor: 'rgba(212, 175, 55, 0.15)',
    borderRadius: BORDER_RADIUS.sm,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderWidth: 1,
    borderColor: 'rgba(212, 175, 55, 0.3)',
  },
  offerCodeBadge: {
    backgroundColor: COLORS.navyLight,
    paddingHorizontal: SPACING.sm,
    paddingVertical: 4,
    borderRadius: BORDER_RADIUS.sm,
    borderWidth: 1,
    borderColor: COLORS.navyBorder,
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
    color: COLORS.navyDeep,
    fontSize: 10,
    fontWeight: TYPOGRAPHY.weights.bold,
    letterSpacing: 0.6,
  },
  offerCodeText: {
    color: COLORS.textLight,
    fontSize: TYPOGRAPHY.sizes.xs,
    fontWeight: TYPOGRAPHY.weights.bold,
    letterSpacing: 0.5,
  },
  offerCodePill: {
    backgroundColor: 'rgba(255,255,255,0.15)',
    paddingHorizontal: SPACING.sm,
    paddingVertical: 4,
    borderRadius: BORDER_RADIUS.pill,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.25)',
  },
  offerCodePillText: {
    color: COLORS.textLight,
    fontSize: 10,
    fontWeight: TYPOGRAPHY.weights.bold,
    letterSpacing: 0.6,
  },
});
