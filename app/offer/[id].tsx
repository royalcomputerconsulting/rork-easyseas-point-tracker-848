import React from 'react';
import {
  ScrollView,
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  TextInput,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLocalSearchParams, router } from 'expo-router';
import { ArrowLeft, DollarSign, Ship, Upload, FileImage, Receipt, Plus, Star, Award, TrendingUp } from 'lucide-react-native';
import { useAppState } from '@/state/AppStateProvider';
import { useCruiseStore } from '@/state/CruiseStore';

import { normalizeOfferCode } from '@/constants/financials';
import { CruiseCard } from '@/components/CruiseCard';
import { matchCruisesToOffer } from '@/lib/offerMatching';
import { detectAndMapUnified } from '@/lib/unifiedCruise';
import { getTierByPoints, getNextTier, getProgressToNextTier } from '@/constants/clubRoyaleTiers';
import { getCrownAnchorLevel } from '@/constants/crownAnchor';
import { ProgressBar } from '@/components/ui/ProgressBar';
import { trpc } from '@/lib/trpc';

interface OfferData {
  id: string;
  offerName: string;
  offerCode: string;
  description: string;
  expires: Date;
  eligibleCabins: string[];
  combinableWith: string[];
  channel: string;
  markets: string[];
  cruisesLinked: number;
  timesBooked: number;
  estimatedValue: number;
}

export default function OfferDetailScreen() {
  const insets = useSafeAreaInsets();
  const { id, offerCode: offerCodeParam, offerName: offerNameParam } = useLocalSearchParams<{ id: string; offerCode?: string; offerName?: string }>();
  const { localData, hasLocalData, userPoints, updateUserPoints, loyaltyPoints } = useAppState();
  const { cruises: storedCruises } = useCruiseStore();
  const [showAddPoints, setShowAddPoints] = React.useState(false);
  const [pointsInput, setPointsInput] = React.useState('');
  
  console.log('[OfferDetail] Loading offer:', id, offerCodeParam, offerNameParam);

  const resolvedOfferCode = React.useMemo(() => {
    if (typeof offerCodeParam === 'string' && offerCodeParam.trim()) {
      return offerCodeParam.trim();
    }
    return null;
  }, [offerCodeParam]);

  const offerDetailsQuery = trpc.casinoOffers.getOfferDetails.useQuery(
    { offerCode: resolvedOfferCode! },
    { enabled: !!resolvedOfferCode }
  );

  const crownAnchor = React.useMemo(() => getCrownAnchorLevel(loyaltyPoints), [loyaltyPoints]);
  const clubRoyaleTier = React.useMemo(() => getTierByPoints(userPoints), [userPoints]);
  const clubRoyaleNext = React.useMemo(() => getNextTier(userPoints), [userPoints]);
  const clubRoyaleProgress = React.useMemo(() => getProgressToNextTier(userPoints), [userPoints]);

  const resolvedOffer = React.useMemo(() => {
    if (!hasLocalData || !localData.offers) return null as any;

    const codeParam = typeof offerCodeParam === 'string' ? offerCodeParam.trim() : '';
    const nameParam = typeof offerNameParam === 'string' ? offerNameParam.trim() : '';

    let candidate = (localData.offers as any[]).find((o: any) => String(o.id ?? '') === String(id ?? ''));
    if (!candidate && codeParam) {
      const normParam = normalizeOfferCode(codeParam);
      candidate = (localData.offers as any[]).find((o: any) => {
        const raw = o.offerCode || o['OFFER CODE'] || o['Offer Code'] || o['Code'] || '';
        return normalizeOfferCode(raw) === normParam;
      });
    }
    if (!candidate && nameParam) {
      candidate = (localData.offers as any[]).find((o: any) => {
        const name = o.offerName || o['OFFER NAME'] || o['Offer Name'] || o['Name'] || '';
        return String(name).toLowerCase() === nameParam.toLowerCase();
      });
    }

    return candidate ?? null;
  }, [hasLocalData, localData, id, offerCodeParam, offerNameParam]);
  
  const associatedCruises = React.useMemo(() => {
    if (!resolvedOffer) {
      console.log('[OfferDetail] No resolved offer available');
      return [] as any[];
    }

    const allCruises = [
      ...(localData.cruises || []),
      ...(storedCruises || []),
      ...(localData.booked || [])
    ];

    const uniqueCruises = Array.from(
      new Map(allCruises.map(c => [
        `${c.ship}-${c.departureDate || (c as any)['Sailing Date'] || (c as any)['Start Date']}`,
        c
      ])).values()
    );

    console.log('[OfferDetail] ========== DATE/SHIP MATCHING ==========');
    console.log('[OfferDetail] Resolved offer:', resolvedOffer);
    console.log('[OfferDetail] Total unique cruises to match against:', uniqueCruises.length);

    const matchedCruises = matchCruisesToOffer(uniqueCruises, resolvedOffer);

    console.log('[OfferDetail] ========== MATCHING RESULTS ==========');
    console.log('[OfferDetail] Found', matchedCruises.length, 'associated cruises');
    
    if (matchedCruises.length === 0 && uniqueCruises.length > 0) {
      console.log('[OfferDetail] ❌ NO MATCHES FOUND');
      console.log('[OfferDetail] Sample cruises to debug:');
      uniqueCruises.slice(0, 5).forEach((c: any, idx: number) => {
        console.log(`[OfferDetail] Cruise ${idx + 1}:`, {
          ship: c.ship || c['Ship Name'] || 'Unknown',
          date: c.departureDate || c['Sailing Date'] || c['Start Date'] || 'Unknown',
          sailingDates: resolvedOffer.sailingDates || resolvedOffer['Sailing Dates'] || 'None',
          ships: resolvedOffer.ships || resolvedOffer.Ships || 'None'
        });
      });
    } else if (matchedCruises.length > 0) {
      console.log('[OfferDetail] ✅ MATCHED CRUISES:', matchedCruises.map((c: any) => ({
        ship: c.ship || c['Ship Name'],
        date: c.departureDate || c['Sailing Date']
      })));
    }
    console.log('[OfferDetail] ==========================================');
    
    return matchedCruises;
  }, [localData, storedCruises, resolvedOffer]);

  const daysToGo = React.useMemo(() => {
    const now = new Date();
    const end = resolvedOffer?.expires ? new Date(resolvedOffer.expires) : new Date();
    const ms = end.getTime() - now.getTime();
    const d = Math.max(0, Math.ceil(ms / (1000 * 60 * 60 * 24)));
    return d;
  }, [resolvedOffer]);
  
  // Try to find offer in local data first
  let offer: OfferData | null = null;
  if (hasLocalData && localData.offers) {
    const foundOffer = resolvedOffer ?? null;
    if (foundOffer) {
      const offerCode = (foundOffer as any).offerCode || (foundOffer as any)['OFFER CODE'] || (foundOffer as any)['Offer Code'] || (foundOffer as any)['Code'] || String(offerCodeParam ?? 'N/A');
      const offerType = (foundOffer as any).offerType || (foundOffer as any)['OFFER TYPE'] || (foundOffer as any)['Offer Type'] || (foundOffer as any)['Type'] || '';
      
      // Parse combinable offers from the offer type or description
      let combinableWith: string[] = [];
      const offerTypeStr = String(offerType).toLowerCase();
      if (offerTypeStr.includes('free play') || offerTypeStr.includes('freeplay')) {
        combinableWith.push('Free Play');
      }
      if (offerTypeStr.includes('next cruise') || offerTypeStr.includes('ncb')) {
        combinableWith.push('Next Cruise Booking');
      }
      if (offerTypeStr.includes('onboard credit') || offerTypeStr.includes('obc')) {
        combinableWith.push('Onboard Credit');
      }
      if (combinableWith.length === 0) {
        combinableWith = ['Free Play', 'Next Cruise Booking'];
      }
      
      offer = {
        id: String((foundOffer as any).id ?? id ?? 'unknown'),
        offerName: (foundOffer as any).offerName || (foundOffer as any)['OFFER NAME'] || (foundOffer as any)['Offer Name'] || (foundOffer as any)['Name'] || String(offerNameParam ?? 'Unknown Offer'),
        offerCode,
        description: (foundOffer as any).description || (foundOffer as any)['DESCRIPTION'] || (foundOffer as any)['Description'] || 'Exclusive casino offer for Club Royale members',
        expires: new Date((foundOffer as any).expires || (foundOffer as any)['EXPIRES'] || (foundOffer as any)['Expires'] || Date.now() + 30 * 24 * 60 * 60 * 1000),
        eligibleCabins: ['Interior', 'Oceanview', 'Balcony'],
        combinableWith,
        channel: 'Club Royale',
        markets: ['US', 'Canada'],
        cruisesLinked: associatedCruises.length,
        timesBooked: 0,
        estimatedValue: 2850
      };
    }
  }
  
  // Fallback to mock data if not found
  if (!offer) {
    offer = {
      id: id || 'unknown',
      offerName: 'Premium Casino Offer',
      offerCode: '25SEP106',
      description: 'Exclusive casino offer for Club Royale members',
      expires: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      eligibleCabins: ['Interior', 'Oceanview', 'Balcony'],
      combinableWith: ['Free Play', 'Next Cruise Booking'],
      channel: 'Club Royale',
      markets: ['US', 'Canada'],
      cruisesLinked: 54,
      timesBooked: 12,
      estimatedValue: 2850
    };
  }

  return (
    <View style={{ flex: 1, backgroundColor: '#FFFFFF' }}>
      <View style={{ height: insets.top, backgroundColor: '#FFFFFF' }} testID="safe-top-spacer" />
      <SafeAreaView style={{ flex: 1, backgroundColor: '#F8FAFC' }} edges={['bottom']}>
      <ScrollView style={styles.container} testID="offer-detail-screen">
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity 
          style={styles.backButton}
          onPress={() => router.back()}
          testID="back-button"
        >
          <ArrowLeft size={24} color="#6C5CE7" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Offer Details</Text>
        <View style={styles.headerRight}>
          <View style={styles.pointsDisplay}>
            <Star size={16} color="#FFD700" fill="#FFD700" />
            <Text style={styles.pointsText}>{userPoints.toLocaleString()}</Text>
          </View>
          <TouchableOpacity 
            style={styles.addPointsButton}
            onPress={() => setShowAddPoints(!showAddPoints)}
            testID="add-points-button"
          >
            <Plus size={20} color="#FFFFFF" />
          </TouchableOpacity>
        </View>
      </View>
      
      {/* Status + Tier Section */}
      <View style={styles.statusSection}>
        <View style={styles.pill} testID="days-pill">
          <Text style={styles.pillText}>{daysToGo} days to go</Text>
        </View>

        <View style={styles.tiersCard} testID="tiers-card">
          <View style={styles.tierHeaderRow}>
            <Text style={styles.tierTitle}>Club Royale</Text>
            <View style={styles.tierBadge}><Text style={styles.tierBadgeText}>{clubRoyaleTier.name}</Text></View>
          </View>

          {clubRoyaleNext && (
            <View style={styles.progressRow}>
              <Text style={styles.progressLabel}>Progress to {clubRoyaleNext.name}</Text>
              <Text style={styles.progressMeta}>{userPoints.toLocaleString()}/{clubRoyaleNext.minPoints.toLocaleString()} points needed</Text>
            </View>
          )}
          <ProgressBar value={clubRoyaleProgress.percentage} max={100} height={10} />

          <View style={styles.tierHeaderRow}>
            <Text style={styles.tierTitle}>Crown & Anchor</Text>
            <View style={[styles.tierBadge, { backgroundColor: '#111827' }]}><Text style={[styles.tierBadgeText, { color: '#fff' }]}>{crownAnchor.name}</Text></View>
          </View>
          <View style={styles.loyaltyRow}>
            <Award size={16} color="#6C5CE7" />
            <Text style={styles.loyaltyText}>{loyaltyPoints.toLocaleString()} pts</Text>
          </View>
        </View>
      </View>

      {/* Add Points Section */}
      {showAddPoints && (
        <View style={styles.addPointsSection}>
          <Text style={styles.addPointsTitle}>Add Points</Text>
          <View style={styles.addPointsRow}>
            <TextInput
              style={styles.pointsInput}
              placeholder="Enter points to add"
              value={pointsInput}
              onChangeText={setPointsInput}
              keyboardType="numeric"
              testID="points-input"
            />
            <TouchableOpacity 
              style={styles.addPointsConfirm}
              onPress={async () => {
                const points = parseInt(pointsInput, 10);
                if (!isNaN(points) && points > 0) {
                  await updateUserPoints(userPoints + points);
                  setPointsInput('');
                  setShowAddPoints(false);
                  Alert.alert('Success', `Added ${points.toLocaleString()} points!\n\nNew total: ${(userPoints + points).toLocaleString()} points`);
                } else {
                  Alert.alert('Error', 'Please enter a valid number of points');
                }
              }}
              testID="confirm-add-points"
            >
              <Text style={styles.addPointsConfirmText}>Add</Text>
            </TouchableOpacity>
          </View>
          <Text style={styles.addPointsHelper}>
            Current points: {userPoints.toLocaleString()} • Next level: 25,000
          </Text>
        </View>
      )}

      {/* Offer Info */}
      <View style={styles.offerCard}>
        <View style={styles.offerHeader}>
          <Text style={styles.offerName}>{offer.offerName}</Text>
          <View style={styles.offerBadge}>
            <Text style={styles.offerBadgeText}>Active</Text>
          </View>
        </View>
        
        <View style={styles.offerDetails}>
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>🎫 Offer Code:</Text>
            <Text style={styles.detailValue}>{offer.offerCode}</Text>
          </View>
          
          {resolvedOffer && (resolvedOffer as any).tradeInValue && (resolvedOffer as any).tradeInValue !== '$0' && (
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>💰 Trade-In Value:</Text>
              <Text style={[styles.detailValue, { fontWeight: '700', color: '#10B981' }]}>
                {(resolvedOffer as any).tradeInValue}
              </Text>
            </View>
          )}
          
          {resolvedOffer && (resolvedOffer as any).Perks && (
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>🎁 Perks:</Text>
              <Text style={styles.detailValue}>
                {(resolvedOffer as any).Perks}
              </Text>
            </View>
          )}
          
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>📅 Expires:</Text>
            <Text style={styles.detailValue}>
              {offer.expires.toLocaleDateString('en-US', { 
                month: 'short', 
                day: 'numeric', 
                year: 'numeric' 
              })}
            </Text>
          </View>
          
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>🚢 Eligible Cabins:</Text>
            <Text style={styles.detailValue}>{offer.eligibleCabins.join(', ')}</Text>
          </View>
          
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>🎰 Channel:</Text>
            <Text style={styles.detailValue}>{offer.channel}</Text>
          </View>
          
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>🌍 Markets:</Text>
            <Text style={styles.detailValue}>{offer.markets.join(', ')}</Text>
          </View>
        </View>
      </View>
      
      {/* Quick Import (Front-end Only) */}
      <View style={styles.importSection}>
        <Text style={styles.sectionTitle}>Quick Import</Text>
        <View style={styles.importButtonsRow}>
          <TouchableOpacity
            style={styles.importButton}
            onPress={() => {
              console.log('[OfferDetail] Import Offer Flyer pressed');
              router.push({ pathname: '/ocr', params: { type: 'offer-flyer', offerCode: offer?.offerCode ?? '', offerName: offer?.offerName ?? '' } });
            }}
            testID="import-offer-flyer-button"
          >
            <FileImage size={20} color="#FFFFFF" />
            <Text style={styles.importButtonText}>Offer</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.importButton}
            onPress={() => {
              console.log('[OfferDetail] Import Casino Overview pressed');
              router.push({ pathname: '/ocr', params: { type: 'casino-overview' } });
            }}
            testID="import-overview-button"
          >
            <Upload size={20} color="#FFFFFF" />
            <Text style={styles.importButtonText}>Overview</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.importButton}
            onPress={() => {
              console.log('[OfferDetail] Import Receipt pressed');
              router.push({ pathname: '/ocr', params: { type: 'receipt' } });
            }}
            testID="import-receipt-button"
          >
            <Receipt size={20} color="#FFFFFF" />
            <Text style={styles.importButtonText}>Receipt</Text>
          </TouchableOpacity>
        </View>
        <Text style={styles.importHelper}>Choose photos or XLSX, preview rows, then save locally. Sync later from Settings.</Text>
      </View>

      {/* Statistics */}
      <View style={styles.statsSection}>
        <Text style={styles.sectionTitle}>📊 OFFER STATISTICS</Text>
        
        {offerDetailsQuery.isLoading && (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="small" color="#6C5CE7" />
            <Text style={styles.loadingText}>Calculating offer values...</Text>
          </View>
        )}
        
        {offerDetailsQuery.error && (
          <View style={styles.errorContainer}>
            <Text style={styles.errorText}>Unable to load offer value calculations</Text>
          </View>
        )}
        
        <View style={styles.statsGrid}>
          <View style={styles.statCard}>
            <Ship size={24} color="#6C5CE7" />
            <Text style={styles.statNumber}>{associatedCruises.length}</Text>
            <Text style={styles.statLabel}>Cruises Linked</Text>
          </View>
          
          {offerDetailsQuery.data ? (
            <>
              <View style={styles.statCard}>
                <DollarSign size={24} color="#10B981" />
                <Text style={styles.statNumber}>${Math.round(offerDetailsQuery.data.totalCompValue).toLocaleString()}</Text>
                <Text style={styles.statLabel}>Total Value</Text>
              </View>
              
              <View style={styles.statCard}>
                <TrendingUp size={24} color="#F59E0B" />
                <Text style={styles.statNumber}>${Math.round(offerDetailsQuery.data.avgCompValuePerSailing).toLocaleString()}</Text>
                <Text style={styles.statLabel}>Avg Value/Cruise</Text>
              </View>
            </>
          ) : (
            <View style={styles.statCard}>
              <DollarSign size={24} color="#F59E0B" />
              <Text style={styles.statNumber}>${offer.estimatedValue.toLocaleString()}</Text>
              <Text style={styles.statLabel}>Est. Value</Text>
            </View>
          )}
        </View>
        
        {offerDetailsQuery.data && offerDetailsQuery.data.specialNotes && offerDetailsQuery.data.specialNotes.length > 0 && (
          <View style={styles.specialNotesCard}>
            {offerDetailsQuery.data.specialNotes.map((note, idx) => (
              <View key={idx} style={styles.specialNoteRow}>
                <Text style={styles.specialNoteText}>💡 {note}</Text>
              </View>
            ))}
          </View>
        )}
      </View>
      
      {/* Description */}
      <View style={styles.descriptionSection}>
        <Text style={styles.sectionTitle}>📝 DESCRIPTION</Text>
        <Text style={styles.description}>{offer.description}</Text>
      </View>
      
      {/* Associated Cruises */}
      <View style={styles.cruisesSection}>
        <Text style={styles.sectionTitle}>🚢 ASSOCIATED CRUISES ({associatedCruises.length})</Text>
        
        {associatedCruises.length > 0 ? (
          <View style={styles.cruisesList}>
            {associatedCruises.map((cruise: any, index: number) => {
              const unified = detectAndMapUnified(cruise);
              const cruiseId = unified.id || cruise.id || `cruise-${index}`;
              return (
                <View key={`cruise-${cruiseId}-${index}`} style={{ marginBottom: 12 }}>
                  <CruiseCard
                    cruise={cruise}
                    onPress={() => {
                      console.log('[OfferDetail] Tapped cruise unified:', cruiseId);
                      router.push(`/cruise/${cruiseId}`);
                    }}
                  />
                </View>
              );
            })}
          </View>
        ) : (
          <View style={styles.emptyState}>
            <Ship size={48} color="#6B7280" />
            <Text style={styles.emptyText}>No cruises found</Text>
            <Text style={styles.emptySubtext}>This offer is not currently linked to any cruises</Text>
          </View>
        )}
      </View>
      
      {/* Combinable Offers */}
      <View style={styles.combinableSection}>
        <Text style={styles.sectionTitle}>🔗 COMBINABLE WITH</Text>
        <View style={styles.combinableList}>
          {offer.combinableWith.map((item, index) => (
            <View key={index} style={styles.combinableItem}>
              <Text style={styles.combinableText}>{item}</Text>
            </View>
          ))}
        </View>
      </View>
      </ScrollView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  backButton: {
    padding: 8,
    borderRadius: 8,
    backgroundColor: '#F3F4F6',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#111827',
  },
  statusSection: {
    margin: 16,
    paddingTop: 4,
  },
  pill: {
    alignSelf: 'flex-start',
    backgroundColor: '#2563EB',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    marginBottom: 12,
  },
  pillText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
  tiersCard: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 12,
    padding: 16,
    gap: 10,
  },
  tierHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  tierTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#111827',
  },
  tierBadge: {
    backgroundColor: '#F59E0B',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
  },
  tierBadgeText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#111827',
  },
  progressRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  progressLabel: {
    fontSize: 12,
    color: '#374151',
    fontWeight: '600',
  },
  progressMeta: {
    fontSize: 12,
    color: '#6B7280',
  },
  loyaltyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  loyaltyText: {
    fontSize: 12,
    color: '#111827',
    fontWeight: '600',
  },

  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  pointsDisplay: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#F3F4F6',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  pointsText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#1F2937',
  },
  addPointsButton: {
    backgroundColor: '#6C5CE7',
    borderRadius: 12,
    padding: 6,
  },
  addPointsSection: {
    backgroundColor: '#FFFFFF',
    margin: 16,
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  addPointsTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 12,
  },
  addPointsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  pointsInput: {
    flex: 1,
    backgroundColor: '#F9FAFB',
    borderRadius: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 14,
    color: '#111827',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  addPointsConfirm: {
    backgroundColor: '#10B981',
    borderRadius: 6,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  addPointsConfirmText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
  },
  addPointsHelper: {
    fontSize: 12,
    color: '#6B7280',
    textAlign: 'center',
  },
  offerCard: {
    backgroundColor: '#FFFFFF',
    margin: 16,
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  offerHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  offerName: {
    fontSize: 20,
    fontWeight: '700',
    color: '#111827',
    flex: 1,
  },
  offerBadge: {
    backgroundColor: '#22C55E',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  offerBadgeText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
  },
  offerDetails: {
    gap: 12,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  detailLabel: {
    fontSize: 14,
    color: '#6B7280',
    flex: 1,
  },
  detailValue: {
    fontSize: 14,
    color: '#111827',
    fontWeight: '500',
    flex: 1,
    textAlign: 'right',
  },
  importSection: {
    margin: 16,
    marginTop: 0,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  importButtonsRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 8,
  },
  importButton: {
    flex: 1,
    backgroundColor: '#16a34a',
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  importButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
  importHelper: {
    fontSize: 12,
    color: '#6B7280',
    textAlign: 'center',
  },
  statsSection: {
    margin: 16,
    marginTop: 0,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 16,
    textAlign: 'center',
  },
  statsGrid: {
    flexDirection: 'row',
    gap: 12,
  },
  statCard: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    padding: 20,
    borderRadius: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  statNumber: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111827',
    marginTop: 8,
  },
  statLabel: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 4,
    textAlign: 'center',
  },
  loadingContainer: {
    backgroundColor: '#F3F4F6',
    borderRadius: 8,
    padding: 12,
    marginBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    justifyContent: 'center',
  },
  loadingText: {
    fontSize: 12,
    color: '#6B7280',
    fontWeight: '500',
  },
  errorContainer: {
    backgroundColor: '#FEE2E2',
    borderRadius: 8,
    padding: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#FCA5A5',
  },
  errorText: {
    fontSize: 12,
    color: '#991B1B',
    fontWeight: '500',
    textAlign: 'center',
  },
  specialNotesCard: {
    backgroundColor: '#F0F9FF',
    borderRadius: 12,
    padding: 12,
    marginTop: 12,
    borderLeftWidth: 3,
    borderLeftColor: '#3B82F6',
    gap: 8,
  },
  specialNoteRow: {
    flexDirection: 'row',
  },
  specialNoteText: {
    fontSize: 12,
    color: '#1E40AF',
    lineHeight: 18,
    flex: 1,
  },
  descriptionSection: {
    margin: 16,
    marginTop: 0,
  },
  description: {
    fontSize: 14,
    color: '#374151',
    lineHeight: 20,
    backgroundColor: '#FFFFFF',
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  cruisesSection: {
    margin: 16,
    marginTop: 0,
  },
  cruisesList: {
    gap: 12,
  },
  cruiseCard: {
    backgroundColor: '#F8FAFC',
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  cruiseHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  cruiseShip: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
    flex: 1,
  },
  cruiseDate: {
    fontSize: 12,
    color: '#3B82F6',
    fontWeight: '500',
  },
  cruiseItinerary: {
    fontSize: 14,
    color: '#374151',
    fontWeight: '500',
    marginBottom: 8,
  },
  cruiseDetails: {
    gap: 4,
  },
  cruiseDetailItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  cruiseDetailText: {
    fontSize: 12,
    color: '#6B7280',
  },
  emptyState: {
    alignItems: 'center',
    padding: 32,
    gap: 8,
  },
  emptyText: {
    fontSize: 16,
    fontWeight: '500',
    color: '#6B7280',
  },
  emptySubtext: {
    fontSize: 14,
    color: '#9CA3AF',
    textAlign: 'center',
  },
  combinableSection: {
    margin: 16,
    marginTop: 0,
    marginBottom: 32,
  },
  combinableList: {
    gap: 8,
  },
  combinableItem: {
    backgroundColor: '#FFFFFF',
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  combinableText: {
    fontSize: 14,
    color: '#374151',
    fontWeight: '500',
  },
});