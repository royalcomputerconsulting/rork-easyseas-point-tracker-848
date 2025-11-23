import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  TextInput,
  Alert,

} from 'react-native';

import {
  TrendingUp,
  Calendar,
  Award,
  Target,
  Flag,
  ChevronRight,
  Edit2,
  X,
} from 'lucide-react-native';
import { useFinancials } from '@/state/FinancialsProvider';
import { computeLoyaltyProgress, LOYALTY_TARGET } from '@/lib/loyalty';
import { trpc } from '@/lib/trpc';
import { TOTALS } from '@/constants/cruiseData';
import { useAppState } from '@/state/AppStateProvider';
import { getTierByPoints, CLUB_ROYALE_TIERS } from '@/constants/clubRoyaleTiers';
import { getCrownAnchorLevel } from '@/constants/crownAnchor';

interface ClubRoyalePointsProps {
  onPointsUpdate?: (points: number) => void;
}

export function ClubRoyalePoints({ onPointsUpdate }: ClubRoyalePointsProps) {
  const { getAnalyticsTotals, certificates } = useFinancials();
  const { userPoints, loyaltyPoints, updateLoyaltyPoints } = useAppState();
  const [showEditLoyaltyModal, setShowEditLoyaltyModal] = React.useState(false);
  const [loyaltyInput, setLoyaltyInput] = React.useState('');

  const { data: finOverview } = trpc.financials.financialOverview.useQuery();
  const { data: casinoAnalytics } = trpc.financials.casinoAnalytics.useQuery();

  const finTotals = React.useMemo(() => {
    try {
      return getAnalyticsTotals();
    } catch {
      return { totalCoinIn: 0, totalPoints: 0, totalRetailValue: 0, totalOutOfPocket: 0, weightedRoi: 0 };
    }
  }, [getAnalyticsTotals]);

  const pointsFromProvider = finTotals.totalPoints || 0;
  const pointsFromBackend = React.useMemo(() => {
    const a = typeof casinoAnalytics?.points === 'number' ? casinoAnalytics.points : 0;
    const b = typeof finOverview?.points === 'number' ? finOverview.points : 0;
    const best = Math.max(a, b);
    return Number.isFinite(best) ? best : 0;
  }, [casinoAnalytics?.points, finOverview?.points]);
  
  // Casino points (from gambling)
  // Prefer user-adjusted total from AppState, fallback to static and backend/provider totals
  const staticCasinoPoints = TOTALS.totalPoints;
  const displayedCasinoPoints = (typeof userPoints === 'number' && userPoints > 0)
    ? userPoints
    : (staticCasinoPoints > 0 ? staticCasinoPoints : (pointsFromBackend > 0 ? pointsFromBackend : pointsFromProvider));
  
  const currentLoyaltyPoints = loyaltyPoints;

  const nowIso = new Date().toISOString().slice(0, 10);
  
  // Use actual booked cruises for loyalty calculations
  const { localData } = useAppState();
  const allInputs = React.useMemo(() => {
    // Get booked cruises from static data
    const bookedCruises = localData?.booked || [];
    
    return bookedCruises.map((cruise: any) => {
      const nights = cruise.nights || 7; // Use actual nights from booked cruise
      const endDate = cruise.endDate || cruise.returnDate || new Date().toISOString().slice(0, 10);
      return { nights, endDate, cabinType: cruise.cabinType || cruise.roomType };
    });
  }, [localData?.booked]);
  
  const completed = React.useMemo(() => allInputs.filter(c => (c.endDate ?? '') < nowIso), [allInputs, nowIso]);
  const upcoming = React.useMemo(() => allInputs.filter(c => (c.endDate ?? '') >= nowIso), [allInputs, nowIso]);
  
  // Calculate total nights from upcoming booked cruises
  const upcomingNights = upcoming.reduce((sum, cruise) => sum + cruise.nights, 0);
  
  const loyalty = React.useMemo(() => {
    const lp = computeLoyaltyProgress(completed, upcoming, LOYALTY_TARGET, currentLoyaltyPoints);

    const cruisesLeft7N = lp.sevenNightCruisesLeft;

    // Calculate accurate extrapolation based on current earning rate
    const today = new Date();
    const targetDate = new Date('2026-04-01');
    const daysUntilTarget = Math.max(0, Math.ceil((targetDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)));
    
    // Points earning rate: points from upcoming / days until target
    const pointsPerDay = daysUntilTarget > 0 ? lp.pointsFromUpcoming / daysUntilTarget : 0;
    
    // Days needed to earn remaining points after upcoming cruises
    const daysNeededForRemaining = pointsPerDay > 0 ? Math.ceil(lp.pointsLeftAfterUpcoming / pointsPerDay) : 0;
    
    // Convert to nights (assuming 1 point per night at 1x multiplier, or 0.5 nights per point at 2x)
    // Since user is solo (2x multiplier), 1 night = 2 points, so nights = points / 2
    const nightsLeftAtCurrentRate = Math.ceil(lp.pointsLeftAfterUpcoming / 2);

    // Calculate the target date (today + days needed)
    const targetDateObj = new Date();
    targetDateObj.setDate(targetDateObj.getDate() + daysNeededForRemaining);
    const targetMonthYear = targetDateObj.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

    const loyaltyAdjusted = {
      ...lp,
      avgNightsPerCruise: 7,
      cruisesLeftAtAvg: cruisesLeft7N,
      estimatedMonthsToTarget: cruisesLeft7N * 2,
      nightsLeftAtCurrentRate,
      daysNeededForRemaining,
      pointsPerDay: Number(pointsPerDay.toFixed(2)),
      targetMonthYear,
    };

    console.log('[ClubRoyalePoints] Loyalty calculation v3:', {
      currentLoyaltyPoints,
      upcomingNights,
      pointsLeft: lp.pointsLeft,
      pointsFromUpcoming: lp.pointsFromUpcoming,
      pointsLeftAfterUpcoming: lp.pointsLeftAfterUpcoming,
      sevenNightCruisesLeft: lp.sevenNightCruisesLeft,
      daysUntilTarget,
      pointsPerDay: loyaltyAdjusted.pointsPerDay,
      nightsLeftAtCurrentRate,
      daysNeededForRemaining,
    });

    return loyaltyAdjusted;
  }, [completed, upcoming, currentLoyaltyPoints, upcomingNights]);

  // Use 45% confidence as shown in the screenshot for static data
  const avgConfidencePct = 45;

  const handleEditLoyalty = React.useCallback(async () => {
    const points = parseInt(loyaltyInput, 10);
    if (isNaN(points) || points < 0) {
      Alert.alert('Invalid Input', 'Please enter a valid positive number');
      return;
    }
    
    try {
      await updateLoyaltyPoints(points);
      setLoyaltyInput('');
      setShowEditLoyaltyModal(false);
      Alert.alert('Success', `Updated loyalty points to ${points.toLocaleString()}`);
    } catch (error) {
      console.error('[ClubRoyalePoints] Failed to update loyalty points:', error);
      Alert.alert('Error', 'Failed to update loyalty points. Please try again.');
    }
  }, [loyaltyInput, updateLoyaltyPoints]);

  const unusedCertificates = Array.isArray(certificates) ? certificates.filter((c: any) => !c.isUsed) : [];
  const nextTierPoints = loyalty.pointsLeft;
  const progressPercentage = loyalty.currentPoints > 0 ? Math.min(100, (loyalty.currentPoints / loyalty.targetPoints) * 100) : 0;

  React.useEffect(() => {
    console.log('[ClubRoyalePoints] points debug', {
      providerTotalPoints: finTotals.totalPoints,
      backendOverviewPoints: finOverview?.points,
      backendCasinoPoints: casinoAnalytics?.points,
      userPoints,
      displayedCasinoPoints,
      currentLoyaltyPoints,
      loyaltyTarget: LOYALTY_TARGET,
    });
  }, [finTotals.totalPoints, finOverview?.points, casinoAnalytics?.points, displayedCasinoPoints, currentLoyaltyPoints]);

  return (
    <View style={styles.container}>
      <View style={styles.progressCard} testID="tier-progress-card">
        <Text style={styles.cardTitle}>Player and Loyalty Status</Text>

        <View style={styles.pillsRowTop}>
          {(() => {
            const crTier = getTierByPoints(displayedCasinoPoints);
            const caTier = getCrownAnchorLevel(currentLoyaltyPoints);
            return (
              <>
                <View style={styles.levelPill} testID="pill-prime">
                  <Text style={styles.levelPillText}>{crTier.name.toUpperCase()}</Text>
                </View>
                <View style={styles.levelPill} testID="pill-diamondplus">
                  <Text style={styles.levelPillText}>{caTier.name.toUpperCase()}</Text>
                </View>
              </>
            );
          })()}
        </View>

        <View style={styles.statsRowTop}>
          <View style={styles.statPill} testID="pill-pinnacle-nights">
            <Text style={styles.statNumber}>{(() => {
              const pointsRemaining = Math.max(0, (LOYALTY_TARGET - loyalty.currentPoints));
              const nights = Math.ceil(pointsRemaining / 2);
              return nights;
            })()}</Text>
            <Text style={styles.statLabel}>Nights to Pinnacle</Text>
          </View>
          <View style={styles.statPill} testID="pill-signature-nights">
            <Text style={styles.statNumber}>{(() => {
              const pointsNeeded = Math.max(0, 25000 - displayedCasinoPoints);
              const completedNights = completed.reduce((sum, c) => sum + (c.nights ?? 0), 0);
              const avgPerNight = completedNights > 0 ? displayedCasinoPoints / completedNights : 0;
              if (avgPerNight <= 0 || !Number.isFinite(avgPerNight)) return 0;
              return Math.ceil(pointsNeeded / avgPerNight);
            })()}</Text>
            <Text style={styles.statLabel}>Nights to Signature</Text>
          </View>
        </View>

        {nextTierPoints > 0 && (
          <View style={styles.block}>
            <View style={styles.blockHeader}>
              <Text style={styles.blockTitle}>Progress to Pinnacle</Text>
              <View style={styles.blockRight}>
                <Text style={styles.pointsNeeded}>{loyalty.currentPoints.toLocaleString()}/{loyalty.targetPoints.toLocaleString()} points needed</Text>
                <TouchableOpacity
                  accessibilityRole="button"
                  testID="edit-loyalty-btn"
                  onPress={() => {
                    setLoyaltyInput(String(currentLoyaltyPoints));
                    setShowEditLoyaltyModal(true);
                  }}
                  style={styles.editPill}
                >
                  <Edit2 size={14} color="#003B6F" />
                </TouchableOpacity>
              </View>
            </View>
            <View style={styles.progressBarDark}>
              <View style={[styles.progressFillDark, styles.pinnacleFillDark, { width: `${Math.min(100, progressPercentage)}%` }]} />
            </View>
            <View style={styles.blockFooter}>
              <Text style={styles.footerLeft}>{progressPercentage.toFixed(1)}% complete</Text>
              <Text style={styles.footerRight}>ETA: {(() => {
                const pointsRemaining = Math.max(0, (LOYALTY_TARGET - loyalty.currentPoints));
                if (pointsRemaining === 0) return 'Achieved!';
                const today = new Date();
                const lastUpcomingEnd = upcoming.reduce((max, c) => {
                  const d = new Date(c.endDate ?? today);
                  return d > max ? d : max;
                }, new Date(today));
                const daysWindow = Math.max(1, Math.ceil((lastUpcomingEnd.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)));
                const scheduleRate = daysWindow > 0 ? (loyalty.pointsFromUpcoming / daysWindow) : 0;
                const sinceStart = Math.max(1, Math.ceil((today.getTime() - new Date('2025-04-01').getTime()) / (1000 * 60 * 60 * 24)));
                const trendRate = loyalty.currentPoints / sinceStart;
                const pointsPerDay = Math.max(scheduleRate, trendRate);
                if (pointsPerDay <= 0 || !Number.isFinite(pointsPerDay)) return 'N/A';
                const daysNeeded = Math.ceil(pointsRemaining / pointsPerDay);
                const eta = new Date();
                eta.setDate(eta.getDate() + daysNeeded);
                return eta.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
              })()}</Text>
            </View>
          </View>
        )}

        <View style={styles.block}>
          <View style={styles.blockHeader}>
            <Text style={styles.blockTitle}>Progress to Signature Tier</Text>
            <Text style={styles.pointsNeeded}>{displayedCasinoPoints.toLocaleString()}/25000 points needed</Text>
          </View>
          <View style={styles.progressBarDark}>
            <View style={[styles.progressFillDark, styles.signatureFillDark, { width: `${Math.min(100, (displayedCasinoPoints / 25000) * 100)}%` }]} />
          </View>
          <View style={styles.blockFooter}>
            <Text style={styles.footerLeft}>{((displayedCasinoPoints / 25000) * 100).toFixed(1)}% complete</Text>
            <Text style={styles.footerRight}>ETA: {(() => {
              const pointsNeeded = Math.max(0, 25000 - displayedCasinoPoints);
              if (pointsNeeded === 0) return 'Achieved!';
              const startDate = new Date('2025-04-01');
              const today = new Date();
              const daysSinceStart = Math.max(1, Math.ceil((today.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)));
              const pointsPerDay = displayedCasinoPoints / daysSinceStart;
              if (pointsPerDay <= 0 || !Number.isFinite(pointsPerDay)) return 'N/A';
              const daysNeeded = Math.ceil(pointsNeeded / pointsPerDay);
              const etaDate = new Date();
              etaDate.setDate(etaDate.getDate() + daysNeeded);
              return etaDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
            })()}</Text>
          </View>
        </View>
      </View>

      {/* Edit Loyalty Points Modal */}
      <Modal
        visible={showEditLoyaltyModal}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowEditLoyaltyModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Edit Loyalty Points</Text>
              <TouchableOpacity 
                onPress={() => setShowEditLoyaltyModal(false)}
                style={styles.modalCloseButton}
              >
                <X size={24} color="#6B7280" />
              </TouchableOpacity>
            </View>
            
            <Text style={styles.modalDescription}>
              Current: {currentLoyaltyPoints.toLocaleString()} points
            </Text>
            
            <TextInput
              style={styles.pointsInput}
              value={loyaltyInput}
              onChangeText={setLoyaltyInput}
              placeholder="Enter loyalty points"
              keyboardType="numeric"
              autoFocus={true}
            />
            
            <View style={styles.modalButtons}>
              <TouchableOpacity 
                style={styles.modalCancelButton}
                onPress={() => {
                  setLoyaltyInput('');
                  setShowEditLoyaltyModal(false);
                }}
              >
                <Text style={styles.modalCancelText}>Cancel</Text>
              </TouchableOpacity>
              
              <TouchableOpacity 
                style={styles.modalSaveButton}
                onPress={handleEditLoyalty}
              >
                <Text style={styles.modalSaveText}>Save</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {Array.isArray(unusedCertificates) && unusedCertificates.length > 0 && (
        <TouchableOpacity 
          style={styles.certificatesCard}
          onPress={() => console.log('Club Royale certificates - coming soon')}
        >
          <View style={styles.certificatesHeader}>
            <View style={styles.certificatesIcon}>
              <Award size={20} color="#10B981" />
            </View>
            <View style={styles.certificatesInfo}>
              <Text style={styles.certificatesTitle}>
                {unusedCertificates.length} Certificate{unusedCertificates.length !== 1 ? 's' : ''} Available
              </Text>
              <Text style={styles.certificatesSubtitle}>
                Tap to view and use certificates
              </Text>
            </View>
            <ChevronRight size={20} color="#6B7280" />
          </View>
        </TouchableOpacity>
      )}


    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 16,
  },
  loadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
    gap: 8,
  },
  loadingText: {
    fontSize: 14,
    color: '#6B7280',
  },
  errorContainer: {
    padding: 20,
    alignItems: 'center',
  },
  errorText: {
    fontSize: 14,
    color: '#EF4444',
  },
  progressCard: {
    backgroundColor: '#E6F2FF',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#B3D9FF',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: '700' as const,
    color: '#003B6F',
    textAlign: 'center' as const,
    marginBottom: 16,
  },
  pillsRowTop: {
    flexDirection: 'row' as const,
    justifyContent: 'space-between' as const,
    gap: 8,
    marginBottom: 16,
  },
  statsRowTop: {
    flexDirection: 'row' as const,
    gap: 12,
    marginBottom: 16,
  },
  statPill: {
    flex: 1,
    backgroundColor: '#F1F5F9',
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 12,
    alignItems: 'center' as const,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  levelPill: {
    flex: 1,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    backgroundColor: '#FFFFFF',
    alignItems: 'center' as const,
  },
  levelPillText: {
    color: '#003B6F',
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  statNumber: {
    fontSize: 22,
    fontWeight: '800' as const,
    color: '#003B6F',
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 11,
    color: '#6B7280',
    textAlign: 'center' as const,
  },
  block: {
    marginTop: 12,
  },
  blockHeader: {
    flexDirection: 'row' as const,
    justifyContent: 'space-between' as const,
    alignItems: 'center' as const,
    marginBottom: 8,
  },
  blockTitle: {
    fontSize: 14,
    fontWeight: '700' as const,
    color: '#003B6F',
  },
  blockRight: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 8,
  },
  pointsNeeded: {
    fontSize: 11,
    color: '#6B7280',
    fontWeight: '600',
  },
  progressBarDark: {
    height: 12,
    backgroundColor: '#F3F4F6',
    borderRadius: 999,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  progressFillDark: {
    height: '100%',
    borderRadius: 999,
  },
  pinnacleFillDark: {
    backgroundColor: '#6C5CE7',
  },
  signatureFillDark: {
    backgroundColor: '#003B6F',
  },
  blockFooter: {
    flexDirection: 'row' as const,
    justifyContent: 'space-between' as const,
    alignItems: 'center' as const,
    marginTop: 8,
  },
  footerLeft: {
    fontSize: 11,
    color: '#6B7280',
  },
  footerRight: {
    fontSize: 11,
    color: '#003B6F',
    fontWeight: '700' as const,
  },

  detailsButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  detailsButtonText: {
    fontSize: 14,
    color: '#6C5CE7',
    fontWeight: '600',
  },





  
  statsRow: {
    flexDirection: 'row',
    gap: 12,
  },
  statCard: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  statValue: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111827',
  },
  statLabelSecondary: {
    fontSize: 12,
    color: '#6B7280',
    textAlign: 'center',
  },
  recentCruisesCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  secondaryCardTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 12,
  },
  cruisePointsRow: {
    flexDirection: 'row',
    gap: 12,
  },
  cruisePointCard: {
    backgroundColor: '#F9FAFB',
    borderRadius: 8,
    padding: 12,
    minWidth: 120,
    alignItems: 'center',
    gap: 4,
  },
  cruiseShip: {
    fontSize: 12,
    fontWeight: '600',
    color: '#111827',
    textAlign: 'center',
  },
  cruisePointsValue: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  cruisePoints: {
    fontSize: 14,
    fontWeight: '700',
    color: '#6C5CE7',
  },
  cruiseDate: {
    fontSize: 10,
    color: '#6B7280',
  },
  cruiseValue: {
    fontSize: 10,
    color: '#10B981',
    fontWeight: '600',
  },
  certificatesCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  certificatesHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  certificatesIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#ECFDF5',
    alignItems: 'center',
    justifyContent: 'center',
  },
  certificatesInfo: {
    flex: 1,
  },
  certificatesTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 2,
  },
  certificatesSubtitle: {
    fontSize: 12,
    color: '#6B7280',
  },
  actionButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  actionButton: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    padding: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  primaryButton: {
    backgroundColor: '#6C5CE7',
    borderColor: '#6C5CE7',
  },
  actionButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
  },
  primaryButtonText: {
    color: '#FFFFFF',
  },
  confidenceContainer: {
    marginTop: 8,
    alignItems: 'center',
  },
  confidenceText: {
    fontSize: 12,
    color: '#6B7280',
  },
  loyaltyItemHeader: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 4,
  },
  editIcon: {
    marginLeft: 4,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center' as const,
    alignItems: 'center' as const,
    padding: 20,
  },
  modalContent: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 24,
    width: '100%',
    maxWidth: 400,
  },
  modalHeader: {
    flexDirection: 'row' as const,
    justifyContent: 'space-between' as const,
    alignItems: 'center' as const,
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700' as const,
    color: '#111827',
  },
  modalCloseButton: {
    padding: 4,
  },
  modalDescription: {
    fontSize: 14,
    color: '#6B7280',
    marginBottom: 20,
    textAlign: 'center' as const,
  },
  pointsInput: {
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    marginBottom: 24,
    textAlign: 'center' as const,
  },
  modalButtons: {
    flexDirection: 'row' as const,
    gap: 12,
  },
  modalCancelButton: {
    flex: 1,
    backgroundColor: '#F3F4F6',
    padding: 12,
    borderRadius: 8,
    alignItems: 'center' as const,
  },
  modalCancelText: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: '#6B7280',
  },
  modalSaveButton: {
    flex: 1,
    backgroundColor: '#6C5CE7',
    padding: 12,
    borderRadius: 8,
    alignItems: 'center' as const,
  },
  modalSaveText: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: '#FFFFFF',
  },
  editPill: {
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    backgroundColor: '#F1F5F9',
  },
});