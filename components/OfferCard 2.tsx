import React, { memo, useMemo, useState } from 'react';
import { View, Text, StyleSheet, Image, Modal, Pressable } from 'react-native';
import { Calendar, Ship, BadgeCheck, Star, Award, Eye, X } from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';

import type { UnifiedCruise, CasinoOffer } from '@/types/models';
import { detectAndMapUnified } from '@/lib/unifiedCruise';
import { useAppState } from '@/state/AppStateProvider';

import { COLORS, BORDER_RADIUS, SPACING, TYPOGRAPHY, SHADOW } from '@/constants/theme';

const OFFER_IMAGES = [
  'https://pub-e001eb4506b145aa938b5d3badbff6a5.r2.dev/attachments/qq4soztd150diiyws629g',
  'https://pub-e001eb4506b145aa938b5d3badbff6a5.r2.dev/attachments/yj8dv0fzn31zorg1brswr',
  'https://pub-e001eb4506b145aa938b5d3badbff6a5.r2.dev/attachments/htgjkihfjm31xch7i91ie',
] as const;

export interface OfferCardProps {
  id: string;
  offerName: string;
  offerCode: string;
  expires?: Date | string;
  receivedDate?: Date | string;
  cruisesCount: number;
  associatedCruises?: UnifiedCruise[];
  onPress?: () => void;
  testID?: string;
  tradeInValue?: number | string;
  perks?: string[];
  freePlay?: number | string;
  compValue?: number | null;
  coverageFraction?: number | null;
  compedShares?: number | null;
}

function formatDate(input?: Date | string): string {
  if (!input) return 'No expiry';
  try {
    const d = typeof input === 'string' ? new Date(input) : input;
    if (isNaN(d.getTime())) return 'No expiry';
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  } catch {
    return 'No expiry';
  }
}


const OfferCardBase: React.FC<OfferCardProps> = ({ id, offerName, offerCode, expires, receivedDate, cruisesCount, associatedCruises, onPress, testID, tradeInValue, perks, freePlay, compValue, coverageFraction, compedShares }) => {
  const { localData, hasLocalData } = useAppState();
  const [showOfferModal, setShowOfferModal] = useState(false);

  const preview = useMemo<UnifiedCruise[]>(() => {
    const arr = Array.isArray(associatedCruises) ? associatedCruises : [];
    const unified = arr.map((c: any) => detectAndMapUnified(c));
    console.log('[OfferCard] preview unified', unified.map(u => ({ id: u.id, ship: u.ship, departureDate: u.departureDate })));
    return unified.slice(0, 3);
  }, [associatedCruises]);

  const isCruiseBooked = (u: UnifiedCruise): boolean => {
    if (!hasLocalData || !Array.isArray(localData.booked)) return false;
    try {
      const booked = localData.booked.some((b: any) => b.cruiseId === u.id || (b.ship === u.ship && (b.startDate === u.departureDate || b.departureDate === u.departureDate)));
      return booked;
    } catch {
      return false;
    }
  };

  const randomOfferImage = useMemo(() => {
    const hash = (id || offerCode || '').split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
    return OFFER_IMAGES[hash % OFFER_IMAGES.length];
  }, [id, offerCode]);

  const royalCaribbeanOfferImageUrl = useMemo(() => {
    if (!offerCode) return null;
    return `https://image.royalcaribbeanmarketing.com/lib/fe9415737666017570/m/1/${offerCode}.jpg`;
  }, [offerCode]);

  return (
    <Pressable
      style={styles.card}
      onPress={onPress}
      testID={testID ?? `offer-item-${id}`}
      accessibilityRole="button"
      accessibilityLabel={`Open offer ${offerName}`}
    >
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
            source={{ uri: randomOfferImage }}
            style={styles.offerImage}
            resizeMode="cover"
          />
          <LinearGradient
            colors={['rgba(0,0,0,0.3)', 'rgba(11,23,59,0.9)']}
            start={{ x: 0, y: 0 }}
            end={{ x: 0, y: 1 }}
            style={styles.imageOverlay}
          >
            <View style={styles.offerHeader}>
              <Text style={styles.offerNameProminent} numberOfLines={2}>
                {offerName}
              </Text>
              <View style={styles.activeBadge}>
                <Star size={12} color={COLORS.goldPremium} fill={COLORS.goldPremium} />
                <Text style={styles.activeBadgeText}>ACTIVE</Text>
              </View>
            </View>
          </LinearGradient>
        </View>

        <View style={styles.content}>
          <View style={styles.navyPill}>
            <Text style={styles.navyPillText}>{offerCode || '—'}</Text>
          </View>

          <View style={styles.datesRow}>
            <View style={styles.dateItem}>
              <Calendar size={14} color={COLORS.mutedLavender} />
              <Text style={styles.dateLabel}>Expiration:</Text>
              <Text style={styles.dateValue}>{formatDate(expires)}</Text>
            </View>
            {receivedDate && (
              <View style={styles.dateItem}>
                <Calendar size={14} color={COLORS.mutedLavender} />
                <Text style={styles.dateLabel}>Received:</Text>
                <Text style={styles.dateValue}>{formatDate(receivedDate)}</Text>
              </View>
            )}
          </View>

          {(perks && perks.length > 0) || freePlay ? (
            <View style={styles.perksSection}>
              <View style={styles.perksSectionHeader}>
                <Award size={14} color={COLORS.aquaAccent} />
                <Text style={styles.perksSectionTitle}>Benefits</Text>
              </View>
              <View style={styles.badgesRow}>
                {perks && perks.length > 0 && perks.map((perk, index) => (
                  <View key={index} style={styles.perkBadge}>
                    <Text style={styles.perkBadgeText}>{perk}</Text>
                  </View>
                ))}
                {freePlay && (
                  <View style={styles.freePlayBadge}>
                    <Text style={styles.freePlayBadgeText}>FreePlay: ${typeof freePlay === 'number' ? freePlay.toFixed(2) : freePlay}</Text>
                  </View>
                )}
              </View>
            </View>
          ) : null}

          {compValue && compValue > 0 && (
            <View style={styles.compValueSection}>
              <View style={styles.compValueHeader}>
                <Star size={14} color={COLORS.goldPremium} fill={COLORS.goldPremium} />
                <Text style={styles.compValueLabel}>Comp Value</Text>
              </View>
              <Text style={styles.compValueAmount}>${Math.round(compValue).toLocaleString()}</Text>
              <View style={styles.coverageInfoRow}>
                {typeof compedShares === 'number' && compedShares > 0 && (
                  <View style={styles.coverageBadge}>
                    <Text style={styles.coverageBadgeText}>
                      {compedShares === 2 ? 'Room for Two' : compedShares === 1.5 ? '1 Guest + 50% off' : compedShares === 1 ? '1 Guest' : `${compedShares.toFixed(1)} shares`}
                    </Text>
                  </View>
                )}
                {typeof coverageFraction === 'number' && coverageFraction > 0 && (
                  <View style={styles.coveragePercentBadge}>
                    <Text style={styles.coveragePercentText}>{Math.round(coverageFraction * 100)}% coverage</Text>
                  </View>
                )}
              </View>
            </View>
          )}

          {tradeInValue && (
            <View style={styles.tradeInSection}>
              <View style={styles.tradeInHeader}>
                <Star size={14} color={COLORS.goldPremium} fill={COLORS.goldPremium} />
                <Text style={styles.tradeInLabel}>Trade-In Value</Text>
              </View>
              <Text style={styles.tradeInValue}>${typeof tradeInValue === 'number' ? tradeInValue.toFixed(2) : tradeInValue}</Text>
            </View>
          )}

          <View style={styles.cruisesSection}>
            <View style={styles.cruisesSectionHeader}>
              <Ship size={14} color={cruisesCount > 0 ? COLORS.aquaAccent : COLORS.mutedLavender} />
              <Text style={[styles.cruisesSectionTitle, cruisesCount > 0 ? styles.cruisesSectionTitleActive : null]}>
                {cruisesCount} Eligible Cruise{cruisesCount !== 1 ? 's' : ''}
              </Text>
            </View>

            {preview.length > 0 && (
              <View style={styles.previewContainer} testID={`offer-cruises-${id}`}>
                {preview.slice(0, 2).map((c) => {
                  const booked = isCruiseBooked(c);
                  return (
                    <View key={`${id}-${c.id}`} style={[styles.previewPill, booked ? styles.previewPillBooked : null]} accessibilityLabel={`Cruise ${c.ship} ${booked ? 'booked' : 'available'}`}>
                      <View style={styles.previewHeader}>
                        <Text style={styles.previewShip} numberOfLines={1}>{c.ship}</Text>
                        {booked && (
                          <View style={styles.bookedMini}>
                            <BadgeCheck size={10} color={COLORS.goldPremium} />
                            <Text style={styles.bookedMiniText}>Booked</Text>
                          </View>
                        )}
                      </View>
                      <Text style={styles.previewMeta} numberOfLines={1}>
                        {formatPreviewDateRange(c.departureDate ?? null, c.returnDate ?? null)}
                        {typeof c.nights === 'number' ? ` • ${c.nights}N` : ''}
                      </Text>
                    </View>
                  );
                })}
              </View>
            )}
          </View>

          {royalCaribbeanOfferImageUrl && (
            <Pressable 
              style={styles.showOfferButton}
              onPress={(e: any) => {
                if (e) {
                  e.stopPropagation?.();
                  e.preventDefault?.();
                }
                setShowOfferModal(true);
              }}
              accessibilityRole="button"
              accessibilityLabel="Show actual offer image"
            >
              <Eye size={16} color={COLORS.iceWhite} />
              <Text style={styles.showOfferButtonText}>Show Actual Offer</Text>
            </Pressable>
          )}
        </View>
      </LinearGradient>

      <Modal
        visible={showOfferModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowOfferModal(false)}
      >
        <View style={styles.modalOverlay}>
          <Pressable 
            style={styles.modalBackdrop} 
            onPress={() => setShowOfferModal(false)}
          />
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <View>
                <Text style={styles.modalTitle}>{offerName}</Text>
                <Text style={styles.modalSubtitle}>{offerCode}</Text>
              </View>
              <Pressable
                onPress={() => setShowOfferModal(false)}
                style={styles.closeButton}
                accessibilityRole="button"
                accessibilityLabel="Close modal"
              >
                <X size={24} color={COLORS.iceWhite} />
              </Pressable>
            </View>
            <View style={styles.modalImageContainer}>
              {royalCaribbeanOfferImageUrl && (
                <Image 
                  source={{ uri: royalCaribbeanOfferImageUrl }}
                  style={styles.modalImage}
                  resizeMode="contain"
                />
              )}
            </View>
          </View>
        </View>
      </Modal>
    </Pressable>
  );
};

export const OfferCard = memo(OfferCardBase);

function formatPreviewDateRange(dep: Date | string | null, ret: Date | string | null): string {
  try {
    const toStr = (d: Date | string | null) => {
      if (!d) return null;
      const date = typeof d === 'string' ? new Date(d) : d;
      if (isNaN(date.getTime())) return null;
      return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    };
    const a = toStr(dep);
    const b = toStr(ret);
    if (a && b && a !== b) return `${a} - ${b}`;
    return a ?? 'TBD';
  } catch {
    return 'TBD';
  }
}

const styles = StyleSheet.create({
  card: {
    borderRadius: BORDER_RADIUS.lg,
    marginBottom: SPACING.md,
    overflow: 'hidden',
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
    position: 'relative',
  },
  offerImage: {
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
  offerHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: SPACING.sm,
  },
  offerNameProminent: {
    fontSize: TYPOGRAPHY.sizes.lg,
    fontWeight: TYPOGRAPHY.weights.bold,
    color: COLORS.iceWhite,
    flex: 1,
    textShadowColor: 'rgba(0,0,0,0.5)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
    lineHeight: 22,
  },
  activeBadge: {
    backgroundColor: COLORS.goldPremium,
    paddingHorizontal: SPACING.sm,
    paddingVertical: 4,
    borderRadius: BORDER_RADIUS.sm,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  activeBadgeText: {
    color: COLORS.navyDeep,
    fontSize: TYPOGRAPHY.sizes.xs,
    fontWeight: TYPOGRAPHY.weights.bold,
    letterSpacing: 0.5,
  },
  content: {
    padding: SPACING.md,
    position: 'relative',
    zIndex: 1,
  },
  navyPill: {
    backgroundColor: 'rgba(0, 163, 224, 0.2)',
    borderRadius: BORDER_RADIUS.pill,
    paddingHorizontal: 12,
    paddingVertical: 6,
    alignSelf: 'flex-start',
    marginBottom: SPACING.sm,
    borderWidth: 1,
    borderColor: 'rgba(0, 163, 224, 0.4)',
  },
  navyPillText: {
    fontSize: 11,
    fontWeight: TYPOGRAPHY.weights.bold,
    color: COLORS.aquaAccent,
    letterSpacing: 1,
  },
  datesRow: {
    flexDirection: 'column',
    gap: 6,
    marginBottom: SPACING.md,
  },
  dateItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  dateLabel: {
    fontSize: TYPOGRAPHY.sizes.xs,
    color: COLORS.mutedLavender,
    fontWeight: TYPOGRAPHY.weights.semibold,
  },
  dateValue: {
    fontSize: TYPOGRAPHY.sizes.sm,
    color: COLORS.iceWhite,
    fontWeight: TYPOGRAPHY.weights.bold,
  },
  perksSection: {
    backgroundColor: 'rgba(0, 163, 224, 0.15)',
    borderRadius: BORDER_RADIUS.sm,
    padding: SPACING.sm,
    marginBottom: SPACING.md,
    borderWidth: 1,
    borderColor: 'rgba(0, 163, 224, 0.3)',
  },
  perksSectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: SPACING.xs,
  },
  perksSectionTitle: {
    fontSize: TYPOGRAPHY.sizes.sm,
    color: COLORS.aquaAccent,
    fontWeight: TYPOGRAPHY.weights.bold,
  },
  badgesRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.xs,
  },
  perkBadge: {
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: BORDER_RADIUS.pill,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  perkBadgeText: {
    fontSize: 10,
    fontWeight: TYPOGRAPHY.weights.semibold,
    color: COLORS.iceWhite,
  },
  freePlayBadge: {
    backgroundColor: 'rgba(16, 185, 129, 0.2)',
    borderRadius: BORDER_RADIUS.pill,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.4)',
  },
  freePlayBadgeText: {
    fontSize: 10,
    fontWeight: TYPOGRAPHY.weights.bold,
    color: COLORS.emeraldGreen,
  },
  tradeInSection: {
    backgroundColor: 'rgba(212, 175, 55, 0.15)',
    borderRadius: BORDER_RADIUS.sm,
    padding: SPACING.sm,
    marginBottom: SPACING.md,
    borderWidth: 1,
    borderColor: 'rgba(212, 175, 55, 0.3)',
  },
  tradeInHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 4,
  },
  tradeInLabel: {
    fontSize: TYPOGRAPHY.sizes.sm,
    fontWeight: TYPOGRAPHY.weights.bold,
    color: COLORS.goldPremium,
  },
  tradeInValue: {
    fontSize: TYPOGRAPHY.sizes.xl,
    fontWeight: TYPOGRAPHY.weights.bold,
    color: COLORS.goldPremium,
  },
  compValueSection: {
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
    borderRadius: BORDER_RADIUS.sm,
    padding: SPACING.sm,
    marginBottom: SPACING.md,
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.3)',
  },
  compValueHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 4,
  },
  compValueLabel: {
    fontSize: TYPOGRAPHY.sizes.sm,
    fontWeight: TYPOGRAPHY.weights.bold,
    color: COLORS.emeraldGreen,
  },
  compValueAmount: {
    fontSize: TYPOGRAPHY.sizes.xxl,
    fontWeight: TYPOGRAPHY.weights.bold,
    color: COLORS.emeraldGreen,
    marginBottom: 8,
  },
  coverageInfoRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.xs,
  },
  coverageBadge: {
    backgroundColor: 'rgba(16, 185, 129, 0.2)',
    borderRadius: BORDER_RADIUS.pill,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.4)',
  },
  coverageBadgeText: {
    fontSize: 11,
    fontWeight: TYPOGRAPHY.weights.bold,
    color: COLORS.emeraldGreen,
    letterSpacing: 0.3,
  },
  coveragePercentBadge: {
    backgroundColor: 'rgba(59, 130, 246, 0.15)',
    borderRadius: BORDER_RADIUS.pill,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderWidth: 1,
    borderColor: 'rgba(59, 130, 246, 0.3)',
  },
  coveragePercentText: {
    fontSize: 11,
    fontWeight: TYPOGRAPHY.weights.semibold,
    color: COLORS.aquaAccent,
  },
  cruisesSection: {
    backgroundColor: 'rgba(0, 163, 224, 0.15)',
    borderRadius: BORDER_RADIUS.sm,
    padding: SPACING.sm,
    borderWidth: 1,
    borderColor: 'rgba(0, 163, 224, 0.3)',
  },
  cruisesSectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: SPACING.xs,
  },
  cruisesSectionTitle: {
    fontSize: TYPOGRAPHY.sizes.sm,
    fontWeight: TYPOGRAPHY.weights.bold,
    color: COLORS.mutedLavender,
  },
  cruisesSectionTitleActive: {
    color: COLORS.aquaAccent,
  },
  previewContainer: {
    flexDirection: 'row',
    gap: SPACING.xs,
    flexWrap: 'wrap',
    marginTop: SPACING.xs,
  },
  previewPill: {
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: BORDER_RADIUS.sm,
    paddingHorizontal: SPACING.sm,
    paddingVertical: 6,
    flex: 1,
    minWidth: '45%',
  },
  previewPillBooked: {
    borderColor: COLORS.goldPremium,
    backgroundColor: 'rgba(212, 175, 55, 0.15)',
  },
  previewHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 2,
  },
  bookedMini: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 4,
    paddingVertical: 2,
    borderRadius: BORDER_RADIUS.pill,
    backgroundColor: 'rgba(212, 175, 55, 0.25)',
  },
  bookedMiniText: {
    fontSize: 8,
    color: COLORS.goldPremium,
    fontWeight: TYPOGRAPHY.weights.bold,
  },
  previewShip: {
    fontSize: TYPOGRAPHY.sizes.xs,
    fontWeight: TYPOGRAPHY.weights.bold,
    color: COLORS.iceWhite,
  },
  previewMeta: {
    fontSize: 10,
    color: COLORS.mutedLavender,
    marginTop: 2,
  },
  showOfferButton: {
    backgroundColor: 'rgba(0, 163, 224, 0.9)',
    borderRadius: BORDER_RADIUS.sm,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: SPACING.sm,
    borderWidth: 1,
    borderColor: 'rgba(0, 163, 224, 1)',
  },
  showOfferButtonText: {
    fontSize: TYPOGRAPHY.sizes.sm,
    fontWeight: TYPOGRAPHY.weights.bold,
    color: COLORS.iceWhite,
    letterSpacing: 0.5,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.9)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalBackdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  modalContent: {
    width: '90%',
    maxHeight: '85%',
    backgroundColor: COLORS.primaryDark,
    borderRadius: BORDER_RADIUS.lg,
    overflow: 'hidden',
    ...SHADOW.royalCard,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: SPACING.md,
    backgroundColor: COLORS.primaryGradientStart,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0, 163, 224, 0.3)',
  },
  modalTitle: {
    fontSize: TYPOGRAPHY.sizes.lg,
    fontWeight: TYPOGRAPHY.weights.bold,
    color: COLORS.iceWhite,
    marginBottom: 4,
  },
  modalSubtitle: {
    fontSize: TYPOGRAPHY.sizes.sm,
    color: COLORS.aquaAccent,
    fontWeight: TYPOGRAPHY.weights.bold,
  },
  closeButton: {
    padding: 8,
    borderRadius: BORDER_RADIUS.sm,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
  },
  modalImageContainer: {
    padding: SPACING.md,
    minHeight: 400,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalImage: {
    width: '100%',
    height: '100%',
    maxHeight: 600,
  },
});
