import React from "react";
import {
  ScrollView,
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  RefreshControl,
  Alert,
  Image,
} from "react-native";
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect, router } from "expo-router";
import { 
  Tag
} from "lucide-react-native";
import { HeroHeaderCompact } from "@/components/HeroHeaderCompact";
import { COLORS, SHADOW } from "@/constants/theme";
import { ThemedCard } from "@/components/ui/ThemedCard";
import { ClubRoyalePoints } from "@/components/ClubRoyalePoints";
import CertificatesBar from "@/components/CertificatesBar";
import { useAppState } from "@/state/AppStateProvider";
import { useFinancials } from "@/state/FinancialsProvider";
import { useCruiseStore } from "@/state/CruiseStore";
import { OfferCard } from "@/components/OfferCard";
import { matchCruisesToOffer } from "@/lib/offerMatching";

export default function OverviewScreen() {
  const insets = useSafeAreaInsets();
  const { lastImportDate, localData, hasLocalData, updateUserPoints, userPoints, cleanExpiredOffers } = useAppState();
  const { getAllSummaries, certificates } = useFinancials();
  const { cruises: storedCruises } = useCruiseStore();
  const [refreshing, setRefreshing] = React.useState(false);
  const [isLoadingData, setIsLoadingData] = React.useState(false);

  console.log('[Overview] Component mounted');

  // Use local data only on this screen to avoid backend timeouts/fetch errors
  const displayOffers: any[] = localData.offers ?? [];
  // Use CruiseStore for cruise count (same as scheduling page)
  const displayCruises: any[] = storedCruises ?? localData.cruises ?? [];
  const nonExpiredOffers: any[] = React.useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    console.log('[Overview] Total offers before filtering:', displayOffers.length);
    console.log('[Overview] All offers:', displayOffers.map((o: any) => ({
      code: o.offerCode || o['OFFER CODE'] || o['Offer Code'],
      name: o.offerName || o['OFFER NAME'] || o['Offer Name'],
      expires: o?.expires || o?.['EXPIRES'] || o?.['Expires'] || o?.['Expiration Date']
    })));
    const filtered = (displayOffers || []).filter((offer: any) => {
      const expires = offer?.expires || offer?.['EXPIRES'] || offer?.['Expires'] || offer?.['Expiration Date'];
      if (!expires) {
        console.log('[Overview] Offer has no expiration:', offer.offerCode || offer['OFFER CODE']);
        return true;
      }
      const d = new Date(expires);
      if (Number.isNaN(d.getTime())) {
        console.log('[Overview] Invalid expiration date for offer:', offer.offerCode || offer['OFFER CODE'], expires);
        return true;
      }
      d.setHours(0, 0, 0, 0);
      const isValid = d.getTime() >= today.getTime();
      if (!isValid) {
        console.log('[Overview] Filtering out expired offer:', offer.offerCode || offer['OFFER CODE'], 'expired on:', expires);
      }
      return isValid;
    });
    console.log('[Overview] Non-expired offers:', filtered.length);
    return filtered;
  }, [displayOffers]);

  const duplicateOffersInfo = React.useMemo(() => {
    if (!nonExpiredOffers || nonExpiredOffers.length === 0) {
      return null;
    }

    const offerGroups: { [key: string]: any[] } = {};
    nonExpiredOffers.forEach((offer: any) => {
      const name = offer.offerName || offer['OFFER NAME'] || offer['Offer Name'] || offer['Name'] || 'Unknown';
      if (!offerGroups[name]) {
        offerGroups[name] = [];
      }
      offerGroups[name].push(offer);
    });
    
    const duplicateGroups = Object.entries(offerGroups).filter(([_, offers]) => offers.length > 1);
    
    if (duplicateGroups.length === 0) {
      return null;
    }

    return duplicateGroups;
  }, [nonExpiredOffers]);

  useFocusEffect(
    React.useCallback(() => {
      (async () => {
        try {
          const removed = await cleanExpiredOffers();
          if (removed > 0) {
            console.log(`[Overview] Cleaned ${removed} expired offers on focus`);
          }
        } catch (e) {
          console.error('[Overview] cleanExpiredOffers failed', e);
        }
      })();
      return undefined;
    }, [cleanExpiredOffers])
  );


  const onRefresh = React.useCallback(async () => {
    console.log('[Overview] Refreshing data');
    setRefreshing(true);
    try {
      const removed = await cleanExpiredOffers();
      if (removed > 0) console.log('[Overview] Removed expired offers on pull-to-refresh:', removed);
    } finally {
      setRefreshing(false);
    }
  }, [cleanExpiredOffers]);


  const cabinTypes: string[] = [];

  return (
    <View style={styles.container}>
      <View style={{ height: insets.top, backgroundColor: '#F5F7FA' }} testID="safe-top-spacer" />
      <ScrollView 
        style={styles.scrollContainer}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        testID="overview-screen"
      >
        <HeroHeaderCompact totalCruises={Array.isArray(displayCruises) ? displayCruises.length : 0} />

      {/* Club Royale Points Section */}
      <View style={styles.clubRoyaleSection}>
        <ClubRoyalePoints onPointsUpdate={updateUserPoints} />
      </View>

      {/* Current Points Display */}
      <View style={styles.pointsDisplaySection}>
        <Text style={styles.pointsDisplayText}>
          Current total: {userPoints.toLocaleString()} Club Royale Points
        </Text>
        <Text style={styles.pointsDisplaySub}>🛳 {Array.isArray(displayCruises) ? displayCruises.length : 0} Available Cruises</Text>
      </View>



      {/* Certificate Management Section */}
      <View style={styles.certificatesSection}>
        <ThemedCard variant="oceanic">
          <View style={styles.certificatesHeader}>
            <Text style={styles.certificatesCount}>
              Total Certificates: {certificates.length}
            </Text>
          </View>
          <CertificatesBar testID="overview-certificates" />
        </ThemedCard>
      </View>

      {/* Casino Offers List */}
      <View style={styles.offersSection}>
        <ThemedCard variant="oceanic" noPadding>
          <Text style={styles.sectionTitle}>🎰 CASINO OFFERS ({nonExpiredOffers.length})</Text>
        {nonExpiredOffers && nonExpiredOffers.length > 0 ? (
          nonExpiredOffers.map((offer: any, index: number) => {
            const offerId = offer.id || `offer-${index}-${Date.now()}`;
            const offerName = offer.offerName || offer['OFFER NAME'] || offer['Offer Name'] || offer['Name'] || `Offer ${index + 1}`;
            const offerCode = offer.offerCode || offer['OFFER CODE'] || offer['Offer Code'] || offer['Code'] || 'N/A';
            const expires = offer.expires || offer['EXPIRES'] || offer['Expires'] || offer['Expiration Date'] || new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
            
            // Calculate linked cruises - use date/ship matching instead of offer code
            const matchedCruises = matchCruisesToOffer(displayCruises, offer);
            const linkedCruises = matchedCruises.length;
            
            // Calculate days left until expiration
            const daysLeft = (() => {
              try {
                const expiryDate = new Date(expires);
                const today = new Date();
                const diffTime = expiryDate.getTime() - today.getTime();
                const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
                return Math.max(0, diffDays);
              } catch {
                return 30; // Default fallback
              }
            })();
            
            // Create unique key that includes expiration date to handle duplicates
            const uniqueKey = `offer-${offerCode}-${expires}-${index}`;
            
            const tradeInRaw = (offer as any).tradeInValue || (offer as any)['Trade In Value'] || (offer as any)['Trade-in Value'] || (offer as any)['TradeInValue'] || (offer as any)['Trade In'] || (offer as any)['Value'] || '';
            const perks: string[] = (() => {
              const list: string[] = [];
              const o: any = offer;
              if (o?.perks && Array.isArray(o.perks)) list.push(...o.perks);
              const maybe = [
                ['Drinks Package', o?.['Drinks Package']],
                ['Free-Play', o?.['Free-Play'] || o?.['Free Play'] || o?.freePlay],
                ['Hideaway Beach Passes', o?.['Hideaway Beach'] || o?.['Hideaway Beach Passes']],
                ['Internet', o?.['Internet'] || o?.internet],
              ];
              maybe.forEach(([label, val]) => { if (val) list.push(String(label)); });
              return list;
            })();

            return (
              <View key={uniqueKey} style={{ marginBottom: 12 }}>
                <OfferCard
                  id={offerId}
                  offerName={offerName}
                  offerCode={offerCode}
                  expires={expires}
                  cruisesCount={linkedCruises}
                  associatedCruises={matchedCruises as any}
                  tradeInValue={tradeInRaw}
                  perks={perks}
                  onPress={() => {
                    try {
                      const idParam = (offer as any)?.id ? String((offer as any).id) : undefined;
                      const codeParam = typeof offerCode === 'string' ? offerCode : '';
                      const nameParam = typeof offerName === 'string' ? offerName : '';
                      router.push({ pathname: '/offer/[id]', params: { id: idParam ?? uniqueKey, offerCode: codeParam, offerName: nameParam } });
                    } catch (e) {
                      console.error('[Overview] Failed to open offer details', e);
                    }
                  }}
                />
              </View>
            );
          })
        ) : (
          <View style={styles.emptyState}>
            <Tag size={48} color="#6B7280" />
            <Text style={styles.emptyTitle}>No offers found</Text>
            <Text style={styles.emptyDescription}>Import casino offers data to see available offers</Text>
          </View>
        )}
        </ThemedCard>
      </View>
      
      {/* Show duplicate offers info if applicable */}
      {duplicateOffersInfo && (
        <View style={styles.duplicateOffersSection}>
          <Text style={styles.duplicateTitle}>📋 DUPLICATE OFFERS WITH DIFFERENT DATES</Text>
          {duplicateOffersInfo.map(([offerName, offers]) => (
            <View key={`duplicate-${offerName}`} style={styles.duplicateGroup}>
              <Text style={styles.duplicateOfferName}>{offerName}</Text>
              <Text style={styles.duplicateCount}>{offers.length} versions with different expiration dates</Text>
              <View style={styles.duplicateDates}>
                {offers.map((offer: any, idx: number) => {
                  const expires = offer.expires || offer['EXPIRES'] || offer['Expires'] || offer['Expiration Date'];
                  return (
                    <Text key={idx} style={styles.duplicateDate}>
                      • Expires {new Date(expires).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                    </Text>
                  );
                })}
              </View>
            </View>
          ))}
        </View>
      )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#E6F2FF',
  },
  scrollContainer: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  mainHeader: {
    backgroundColor: "#FFFFFF",
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#E5E7EB",
  },
  headerTitleSection: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 16,
    gap: 12,
  },
  mainTitle: {
    fontSize: 24,
    fontWeight: "700",
    color: "#1E3A8A",
  },
  logoImage: {
    width: 50,
    height: 50,
  },
  pointsSection: {
    gap: 8,
  },
  pointsDisplay: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  currentPointsLabel: {
    fontSize: 16,
    color: "#374151",
    fontWeight: "500",
  },
  currentPointsValue: {
    fontSize: 24,
    fontWeight: "700",
    color: "#3B82F6",
  },
  targetProgress: {
    fontSize: 14,
    color: "#6B7280",
    textAlign: "center",
  },
  clubRoyaleSection: {
    paddingHorizontal: 16,
    marginBottom: 16,
  },
  pointsDisplaySection: {
    paddingHorizontal: 16,
    marginBottom: 16,
  },
  pointsDisplayText: {
    fontSize: 12,
    color: '#6B7280',
    textAlign: 'center',
  },
  pointsDisplaySub: {
    fontSize: 12,
    color: '#003B6F',
    textAlign: 'center',
    marginTop: 4,
    fontWeight: '700',
  },
  headerActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  headerButton: {
    padding: 8,
    borderRadius: 8,
    backgroundColor: "transparent",
  },

  pointsRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 4,
  },



  statusTotalsSection: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    gap: 12,
    marginBottom: 16,
  },
  statusCard: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  statusNumber: {
    fontSize: 24,
    fontWeight: '700',
    color: '#3B82F6',
    marginBottom: 4,
  },
  statusLabel: {
    fontSize: 11,
    color: '#6B7280',
    textAlign: 'center',
    fontWeight: '600',
  },
  totalSection: {
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
  totalText: {
    fontSize: 14,
    color: "#374151",
    textAlign: "center",
  },
  actionRow: {
    flexDirection: "row",
    paddingHorizontal: 16,
    gap: 8,
    marginBottom: 16,
  },
  actionBtn: {
    flex: 1,
    backgroundColor: "#3B82F6",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    padding: 12,
    borderRadius: 8,
    gap: 6,
  },
  actionBtnText: {
    color: "#FFFFFF",
    fontSize: 12,
    fontWeight: "600",
  },



  offersSection: {
    paddingHorizontal: 16,
    paddingTop: 40,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: COLORS.textLight,
    marginBottom: 16,
    paddingHorizontal: 16,
    paddingTop: 16,
  },
  offerCard: {
    backgroundColor: 'transparent',
    borderRadius: 12,
    padding: 0,
    marginBottom: 12,
  },
  offerHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  offerName: {
    fontSize: 16,
    fontWeight: "600",
    color: COLORS.text,
    flex: 1,
  },
  offerBadge: {
    backgroundColor: COLORS.success,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  offerBadgeText: {
    color: "#FFFFFF",
    fontSize: 10,
    fontWeight: "600",
  },
  offerDetails: {
    gap: 8,
  },
  offerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  offerLabel: {
    fontSize: 12,
    color: COLORS.textSecondary,
  },
  offerValue: {
    fontSize: 12,
    color: COLORS.text,
    fontWeight: "500",
  },
  offerExpiry: {
    fontSize: 12,
    color: COLORS.textSecondary,
  },
  offerCode: {
    fontSize: 12,
    color: COLORS.primary,
    fontWeight: "600",
  },
  offerStats: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 4,
  },
  offerStat: {
    fontSize: 11,
    color: "#9CA3AF",
  },
  emptyState: {
    alignItems: "center",
    padding: 32,
    gap: 12,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: "#111827",
  },
  emptyDescription: {
    fontSize: 14,
    color: "#6B7280",
    textAlign: "center",
  },
  importButton: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#6C5CE7",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 8,
    gap: 8,
    marginTop: 8,
  },
  importButtonText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "600",
  },
  pagination: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 16,
    gap: 16,
  },
  paginationButton: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: "#FFFFFF",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  paginationText: {
    fontSize: 12,
    color: "#6C5CE7",
    fontWeight: "500",
  },
  pageInfo: {
    fontSize: 12,
    color: "#6B7280",
  },
  localDataIndicator: {
    fontSize: 12,
    color: "#10B981",
    textAlign: "center",
    marginTop: 4,
    fontWeight: "500",
  },
  offlineModeIndicator: {
    fontSize: 12,
    color: "#6B7280",
    textAlign: "center",
    marginTop: 4,
    fontWeight: "500",
  },
  loadDatabaseSection: {
    paddingHorizontal: 16,
    marginBottom: 16,
  },
  loadDatabaseBtn: {
    backgroundColor: COLORS.primary,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    padding: 16,
    borderRadius: 12,
    gap: 8,
    ...SHADOW.card,
  },
  loadDatabaseText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "700",
  },
  loadDatabaseBtnDisabled: {
    opacity: 0.6,
  },
  loadDatabaseDescription: {
    fontSize: 12,
    color: '#6B7280',
    textAlign: 'center',
    marginTop: 8,
    lineHeight: 16,
  },
  ocrSection: {
    paddingHorizontal: 16,
    marginBottom: 16,
  },
  ocrTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#1F2937",
    textAlign: "center",
    marginBottom: 8,
  },
  ocrDescription: {
    fontSize: 12,
    color: "#6B7280",
    textAlign: "center",
    marginBottom: 16,
  },
  ocrButtons: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 8,
  },
  ocrBtn: {
    flex: 1,
    backgroundColor: "#10B981",
    alignItems: "center",
    justifyContent: "center",
    padding: 12,
    borderRadius: 8,
    minHeight: 80,
  },
  ocrBtnText: {
    color: "#FFFFFF",
    fontSize: 12,
    fontWeight: "600",
    marginTop: 4,
    textAlign: "center",
  },
  ocrBtnSubtext: {
    color: "#FFFFFF",
    fontSize: 10,
    opacity: 0.8,
    marginTop: 2,
    textAlign: "center",
  },
  importStatementsBtn: {
    backgroundColor: "#22C55E",
    flex: 1,
  },
  financialsSection: {
    paddingHorizontal: 16,
    marginBottom: 16,
  },
  financialsTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#1F2937",
    textAlign: "center",
    marginBottom: 8,
  },
  financialsDescription: {
    fontSize: 12,
    color: "#6B7280",
    textAlign: "center",
    marginBottom: 16,
  },
  financialsBtn: {
    backgroundColor: "#8B5CF6",
    alignItems: "center",
    justifyContent: "center",
    padding: 16,
    borderRadius: 8,
    minHeight: 80,
  },
  financialsBtnText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "600",
    marginTop: 8,
    textAlign: "center",
  },
  financialsBtnSubtext: {
    color: "#FFFFFF",
    fontSize: 11,
    opacity: 0.9,
    marginTop: 4,
    textAlign: "center",
  },
  // Cruise section styles
  cruisesSection: {
    paddingHorizontal: 16,
    marginBottom: 16,
  },
  sectionSubtitle: {
    fontSize: 12,
    color: "#6B7280",
    textAlign: "center",
    marginBottom: 16,
  },
  cruiseCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    overflow: "hidden",
  },
  cruiseImageContainer: {
    height: 120,
    backgroundColor: "#3B82F6",
    justifyContent: "flex-end",
    padding: 16,
    backgroundImage: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
  },
  cruiseShipName: {
    color: "#FFFFFF",
    fontSize: 18,
    fontWeight: "700",
  },
  cruiseInfo: {
    padding: 16,
  },
  cruiseDate: {
    fontSize: 16,
    fontWeight: "600",
    color: "#111827",
    marginBottom: 4,
  },
  cruiseNights: {
    fontSize: 12,
    color: "#3B82F6",
    fontWeight: "600",
    marginBottom: 8,
  },
  cruiseLocation: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginBottom: 8,
  },
  cruisePort: {
    fontSize: 12,
    color: "#6B7280",
  },
  cruiseItinerary: {
    fontSize: 14,
    color: "#374151",
    fontWeight: "500",
    marginBottom: 12,
  },
  cruiseMeta: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  cruiseCabin: {
    fontSize: 12,
    color: "#6B7280",
  },
  cruiseGuests: {
    fontSize: 12,
    color: "#3B82F6",
    fontWeight: "500",
  },
  cruisePricing: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  priceRange: {
    fontSize: 12,
    color: "#6B7280",
  },
  priceValue: {
    fontSize: 14,
    color: "#374151",
    fontWeight: "600",
  },
  viewAllButton: {
    backgroundColor: "#3B82F6",
    padding: 12,
    borderRadius: 8,
    alignItems: "center",
    marginTop: 8,
  },
  viewAllText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "600",
  },
  duplicateOffersSection: {
    paddingHorizontal: 16,
    marginBottom: 16,
  },
  duplicateTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#1F2937",
    marginBottom: 16,
    textAlign: "center",
  },
  duplicateGroup: {
    backgroundColor: "#FEF3C7",
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#F59E0B",
  },
  duplicateOfferName: {
    fontSize: 16,
    fontWeight: "600",
    color: "#92400E",
    marginBottom: 4,
  },
  duplicateCount: {
    fontSize: 12,
    color: "#D97706",
    marginBottom: 8,
  },
  duplicateDates: {
    gap: 2,
  },
  duplicateDate: {
    fontSize: 12,
    color: "#92400E",
  },
  addPointsSection: {
    paddingHorizontal: 16,
    marginBottom: 16,
  },
  addPointsBtn: {
    backgroundColor: COLORS.success,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    padding: 16,
    borderRadius: 12,
    gap: 8,
    ...SHADOW.card,
  },
  addPointsBtnText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "700",
  },
  addPointsDescription: {
    fontSize: 12,
    color: '#6B7280',
    textAlign: 'center',
    marginTop: 8,
    lineHeight: 16,
  },

  certificatesSection: {
    paddingHorizontal: 16,
    marginBottom: 16,
  },
  certificatesHeader: {
    marginBottom: 12,
  },
  certificatesCount: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.textLight,
    textAlign: 'center',
  },

});