import { z } from 'zod';
import { publicProcedure } from '../../../create-context';
import { memoryStore } from '../../_stores/memory';
import { 
  CASINO_REWARDS, 
  getRewardTierByPoints,
  ClubRoyaleProfile, 
  ClubRoyaleCertificate,
  CruisePointsHistory,
  SAMPLE_CLUB_ROYALE_PROFILE,
  getCurrentTier,
  getPointsToNextTier,
  calculateValuePerPoint,
  estimateTierProgressionDate,
  getAvailableCertificates,
  CLUB_ROYALE_TIERS
} from '../../../../../types/models';

// Enhanced points system with actual cruise data mapping
interface CruisePointsMapping {
  [cruiseId: string]: {
    pointsEarned: number;
    amountWonOrLost: number;
    ship: string;
    sailDate: string;
    verified: boolean;
  };
}

// Actual points data from financial records - VERIFIED AMOUNTS
// This will be updated dynamically as users add/modify points
let VERIFIED_CRUISE_POINTS: CruisePointsMapping = {
  '5207254': { // Navigator 9/15
    pointsEarned: 976,
    amountWonOrLost: 589, // Won $589
    ship: 'Navigator of the Seas',
    sailDate: '2025-09-15',
    verified: true
  },
  '2665774': { // Star
    pointsEarned: 4581,
    amountWonOrLost: 0, // Estimate
    ship: 'Star of the Seas',
    sailDate: '2024-04-15',
    verified: true
  },
  '236930': { // Ovation
    pointsEarned: 2030,
    amountWonOrLost: 0, // Estimate
    ship: 'Ovation of the Seas',
    sailDate: '2024-02-15',
    verified: true
  },
  '6242276': { // Ovation alternate ID
    pointsEarned: 2030,
    amountWonOrLost: 0,
    ship: 'Ovation of the Seas',
    sailDate: '2024-02-15',
    verified: true
  },
  '2501764': { // Harmony
    pointsEarned: 1000,
    amountWonOrLost: 0,
    ship: 'Harmony of the Seas',
    sailDate: '2024-04-10',
    verified: true
  },
  '7871133': { // Wonder - calculated remaining
    pointsEarned: 3562, // 12149 - 976 - 4581 - 2030 - 1000 = 3562
    amountWonOrLost: 0,
    ship: 'Wonder of the Seas',
    sailDate: '2024-05-15',
    verified: false // Calculated
  }
};

// Initialize with actual verified data
let clubRoyaleProfile: ClubRoyaleProfile = {
  ...SAMPLE_CLUB_ROYALE_PROFILE,
  totalPoints: 12149, // VERIFIED TOTAL
  cruiseHistory: Object.entries(VERIFIED_CRUISE_POINTS).map(([cruiseId, data]) => ({
    id: `history-${cruiseId}`,
    cruiseId,
    ship: data.ship,
    departureDate: `${data.sailDate}T00:00:00.000Z`,
    pointsEarned: data.pointsEarned,
    coinIn: data.pointsEarned * 5, // $5 per point
    actualSavings: Math.abs(data.amountWonOrLost), // Use absolute value for savings calculation
    valuePerPoint: data.pointsEarned > 0 ? Math.abs(data.amountWonOrLost) / data.pointsEarned : 0,
    certificatesEarned: [],
    tier: 'Prime' as const,
    notes: data.verified ? 'Verified from financial records' : 'Calculated remaining balance'
  }))
};

// Get Club Royale profile with comprehensive points data
export const getClubRoyaleProfile = publicProcedure
  .query(() => {
    console.log('[Club Royale] Getting profile:', clubRoyaleProfile.totalPoints, 'points');
    
    // Recalculate dynamic fields
    const totalSavings = clubRoyaleProfile.cruiseHistory.reduce((sum, cruise) => sum + cruise.actualSavings, 0);
    const totalPoints = clubRoyaleProfile.cruiseHistory.reduce((sum, cruise) => sum + cruise.pointsEarned, 0);
    
    const updatedProfile: ClubRoyaleProfile = {
      ...clubRoyaleProfile,
      totalPoints,
      currentTier: getCurrentTier(totalPoints),
      pointsToNextTier: getPointsToNextTier(totalPoints),
      valuePerPoint: calculateValuePerPoint(totalSavings, totalPoints),
      updatedAt: new Date().toISOString()
    };
    
    return updatedProfile;
  });

// Update user points and calculate progress
export const updateUserPointsProcedure = publicProcedure
  .input(z.object({
    totalPoints: z.number(),
    pointsHistory: z.array(z.object({
      cruiseId: z.string(),
      pointsEarned: z.number(),
      cruiseDate: z.string(),
      ship: z.string(),
    })).optional(),
  }))
  .mutation(async ({ input }) => {
    console.log('Updating user points:', input);
    
    const userProfile = memoryStore.getUserProfile();
    if (!userProfile) {
      throw new Error('User profile not found');
    }
    
    // Update user profile with new points total
    const updatedProfile = memoryStore.updateUserProfile({
      points: input.totalPoints,
      totalSpent: input.totalPoints * 5, // 1 point = $5 coin-in
    });
    
    // Update individual cruise points if provided
    if (input.pointsHistory) {
      for (const historyEntry of input.pointsHistory) {
        const cruise = memoryStore.getCruise(historyEntry.cruiseId);
        if (cruise) {
          memoryStore.updateCruise(historyEntry.cruiseId, {
            cruisePointsEarned: historyEntry.pointsEarned,
            dataSource: {
              pricing: cruise.dataSource?.pricing || 'estimated',
              financial: cruise.dataSource?.financial || 'estimated',
              points: 'user-input',
              lastUpdated: new Date().toISOString(),
            },
          });
        }
      }
    }
    
    console.log('Updated user points successfully');
    return updatedProfile;
  });

// Get user points progress and tier information
export const getUserPointsProgressProcedure = publicProcedure
  .query(async () => {
    console.log('Getting user points progress');
    
    const userProfile = memoryStore.getUserProfile();
    if (!userProfile) {
      throw new Error('User profile not found');
    }
    
    const currentTier = getRewardTierByPoints(userProfile.points);
    const nextTier = CASINO_REWARDS.payTable.find(tier => tier.points > userProfile.points);
    
    // Calculate points earned per cruise
    const completedCruises = memoryStore.getCompletedCruises();
    const cruisePointsHistory = completedCruises
      .filter(cruise => cruise.cruisePointsEarned && cruise.cruisePointsEarned > 0)
      .map(cruise => ({
        cruiseId: cruise.id,
        ship: cruise.ship,
        departureDate: cruise.departureDate,
        pointsEarned: cruise.cruisePointsEarned || 0,
        coinIn: (cruise.cruisePointsEarned || 0) * 5,
      }))
      .sort((a, b) => new Date(b.departureDate).getTime() - new Date(a.departureDate).getTime());
    
    // Calculate total points from cruise history
    const totalPointsFromHistory = cruisePointsHistory.reduce((sum, cruise) => sum + cruise.pointsEarned, 0);
    
    // Calculate point earning rate
    const averagePointsPerCruise = cruisePointsHistory.length > 0 
      ? totalPointsFromHistory / cruisePointsHistory.length 
      : 0;
    
    return {
      currentPoints: userProfile.points,
      totalSpent: userProfile.totalSpent,
      currentTier: currentTier ? {
        offerCode: currentTier.offerCode,
        reward: currentTier.reward,
        nextCruiseBonus: currentTier.nextCruiseBonus,
        pointsRequired: currentTier.points,
      } : null,
      nextTier: nextTier ? {
        offerCode: nextTier.offerCode,
        reward: nextTier.reward,
        nextCruiseBonus: nextTier.nextCruiseBonus,
        pointsRequired: nextTier.points,
        pointsNeeded: nextTier.points - userProfile.points,
      } : null,
      cruisePointsHistory,
      totalPointsFromHistory,
      averagePointsPerCruise,
      pointsResetDate: '2025-04-01', // Points reset every April 1st
    };
  });

// Calculate the value of points based on actual savings achieved
export const calculatePointsValueProcedure = publicProcedure
  .query(async () => {
    console.log('Calculating points value based on actual savings');
    
    const userProfile = memoryStore.getUserProfile();
    if (!userProfile) {
      throw new Error('User profile not found');
    }
    
    const completedCruises = memoryStore.getCompletedCruises();
    
    // Calculate total actual savings from completed cruises
    const totalActualSavings = completedCruises.reduce((sum, cruise) => {
      return sum + (cruise.actualSavings || 0);
    }, 0);
    
    // Calculate total points earned from completed cruises
    const totalPointsEarned = completedCruises.reduce((sum, cruise) => {
      return sum + (cruise.cruisePointsEarned || 0);
    }, 0);
    
    // Calculate value per point based on actual results
    const actualValuePerPoint = totalPointsEarned > 0 ? totalActualSavings / totalPointsEarned : 0;
    
    // Calculate theoretical value per point (based on $5 coin-in per point)
    const theoreticalValuePerPoint = 5;
    
    // Calculate ROI on casino spending
    const totalCoinIn = totalPointsEarned * 5;
    const casinoROI = totalCoinIn > 0 ? ((totalActualSavings - totalCoinIn) / totalCoinIn) * 100 : 0;
    
    // Calculate lifetime value metrics
    const lifetimeValue = {
      totalPointsEarned,
      totalCoinIn,
      totalActualSavings,
      netProfit: totalActualSavings - totalCoinIn,
      actualValuePerPoint,
      theoreticalValuePerPoint,
      casinoROI,
      efficiency: theoreticalValuePerPoint > 0 ? (actualValuePerPoint / theoreticalValuePerPoint) * 100 : 0,
    };
    
    return lifetimeValue;
  });

// Get detailed points history with cruise breakdown
export const getPointsHistoryProcedure = publicProcedure
  .input(z.object({
    startDate: z.string().optional(),
    endDate: z.string().optional(),
  }))
  .query(async ({ input }) => {
    console.log('Getting points history:', input);
    
    const completedCruises = memoryStore.getCompletedCruises();
    
    let filteredCruises = completedCruises;
    
    // Apply date filters if provided
    if (input.startDate) {
      filteredCruises = filteredCruises.filter(cruise => 
        cruise.departureDate >= input.startDate!
      );
    }
    
    if (input.endDate) {
      filteredCruises = filteredCruises.filter(cruise => 
        cruise.departureDate <= input.endDate!
      );
    }
    
    // Build detailed history with financial data
    const pointsHistory = filteredCruises
      .filter(cruise => cruise.cruisePointsEarned && cruise.cruisePointsEarned > 0)
      .map(cruise => {
        const coinIn = (cruise.cruisePointsEarned || 0) * 5;
        const actualSavings = cruise.actualSavings || 0;
        const netOutOfPocket = cruise.netOutOfPocket || 0;
        const roi = cruise.roiPercentage || 0;
        
        return {
          cruiseId: cruise.id,
          ship: cruise.ship,
          itinerary: cruise.itineraryName,
          departureDate: cruise.departureDate,
          returnDate: cruise.returnDate,
          nights: cruise.nights,
          pointsEarned: cruise.cruisePointsEarned || 0,
          coinIn,
          actualSavings,
          netOutOfPocket,
          roi,
          valuePerPoint: cruise.cruisePointsEarned ? actualSavings / cruise.cruisePointsEarned : 0,
          dataSource: cruise.dataSource,
          // Enhanced financial breakdown
          winningsBroughtHome: cruise.winningsBroughtHome || 0,
          totalValueBack: cruise.totalValueBack || 0,
          casinoCompedExtras: cruise.casinoCompedExtras || 0,
        };
      })
      .sort((a, b) => new Date(b.departureDate).getTime() - new Date(a.departureDate).getTime());
    
    // Calculate summary statistics
    const summary = {
      totalCruises: pointsHistory.length,
      totalPointsEarned: pointsHistory.reduce((sum, cruise) => sum + cruise.pointsEarned, 0),
      totalCoinIn: pointsHistory.reduce((sum, cruise) => sum + cruise.coinIn, 0),
      totalActualSavings: pointsHistory.reduce((sum, cruise) => sum + cruise.actualSavings, 0),
      totalNetOutOfPocket: pointsHistory.reduce((sum, cruise) => sum + cruise.netOutOfPocket, 0),
      averageROI: pointsHistory.length > 0 
        ? pointsHistory.reduce((sum, cruise) => sum + cruise.roi, 0) / pointsHistory.length 
        : 0,
      averageValuePerPoint: pointsHistory.length > 0 
        ? pointsHistory.reduce((sum, cruise) => sum + cruise.valuePerPoint, 0) / pointsHistory.length 
        : 0,
    };
    
    return {
      pointsHistory,
      summary,
      dateRange: {
        startDate: input.startDate || (pointsHistory.length > 0 ? pointsHistory[pointsHistory.length - 1].departureDate : null),
        endDate: input.endDate || (pointsHistory.length > 0 ? pointsHistory[0].departureDate : null),
      },
    };
  });

// Get Club Royale profile with points and rewards
export const getClubRoyaleProfileProcedure = publicProcedure
  .query(async () => {
    console.log('[Points] Getting Club Royale profile...');
    
    try {
      // For now, return sample data - in production this would come from database
      const profile = SAMPLE_CLUB_ROYALE_PROFILE;
      
      // Recalculate dynamic fields
      const updatedProfile: ClubRoyaleProfile = {
        ...profile,
        currentTier: getCurrentTier(profile.totalPoints),
        pointsToNextTier: getPointsToNextTier(profile.totalPoints),
        valuePerPoint: calculateValuePerPoint(
          profile.cruiseHistory.reduce((sum, cruise) => sum + cruise.actualSavings, 0),
          profile.totalPoints
        ),
        projectedTierDate: estimateTierProgressionDate(
          profile.totalPoints,
          profile.cruiseHistory.reduce((sum, cruise) => sum + cruise.pointsEarned, 0) / profile.cruiseHistory.length,
          6 // Estimated cruises per year
        ) || undefined,
        updatedAt: new Date().toISOString()
      };
      
      console.log('[Points] Successfully retrieved Club Royale profile:', {
        totalPoints: updatedProfile.totalPoints,
        currentTier: updatedProfile.currentTier,
        pointsToNextTier: updatedProfile.pointsToNextTier,
        certificatesCount: updatedProfile.certificates.length
      });
      
      return updatedProfile;
    } catch (error) {
      console.error('[Points] Error getting Club Royale profile:', error);
      throw new Error('Failed to get Club Royale profile');
    }
  });

// Update points for a specific cruise
export const updateCruisePointsProcedure = publicProcedure
  .input(z.object({
    cruiseId: z.string(),
    pointsEarned: z.number().min(0),
    actualSavings: z.number().optional(),
    coinIn: z.number().optional(),
    notes: z.string().optional()
  }))
  .mutation(async ({ input }) => {
    console.log('[Points] Updating cruise points:', input);
    
    try {
      // In production, this would update the database
      // For now, we'll simulate the update
      
      const { cruiseId, pointsEarned, actualSavings, coinIn, notes } = input;
      
      // Calculate value per point if savings provided
      const valuePerPoint = actualSavings && pointsEarned > 0 
        ? actualSavings / pointsEarned 
        : 0;
      
      // Determine certificates earned based on points
      const availableCertificates = getAvailableCertificates(pointsEarned);
      const certificatesEarned = availableCertificates.map(cert => cert.offerCode);
      
      const updatedCruiseHistory = {
        id: `history-${Date.now()}`,
        cruiseId,
        ship: 'Updated Ship', // Would come from cruise data
        departureDate: new Date().toISOString(),
        pointsEarned,
        coinIn: coinIn || pointsEarned * 5, // Default calculation
        actualSavings: actualSavings || 0,
        valuePerPoint,
        certificatesEarned,
        tier: getCurrentTier(pointsEarned) as 'Prime' | 'Signature' | 'Masters',
        notes
      };
      
      console.log('[Points] Successfully updated cruise points:', {
        cruiseId,
        pointsEarned,
        valuePerPoint,
        certificatesEarned: certificatesEarned.length
      });
      
      return {
        success: true,
        updatedHistory: updatedCruiseHistory,
        message: `Updated ${pointsEarned} points for cruise`
      };
    } catch (error) {
      console.error('[Points] Error updating cruise points:', error);
      throw new Error('Failed to update cruise points');
    }
  });

// Get tier progression analysis
export const getTierProgressionProcedure = publicProcedure
  .query(async () => {
    console.log('[Points] Getting tier progression analysis...');
    
    try {
      const profile = SAMPLE_CLUB_ROYALE_PROFILE;
      const currentTier = getCurrentTier(profile.totalPoints);
      const pointsToNext = getPointsToNextTier(profile.totalPoints);
      
      // Calculate average points per cruise
      const avgPointsPerCruise = profile.cruiseHistory.length > 0
        ? profile.cruiseHistory.reduce((sum, cruise) => sum + cruise.pointsEarned, 0) / profile.cruiseHistory.length
        : 0;
      
      // Estimate cruises needed to reach next tier
      const cruisesNeeded = avgPointsPerCruise > 0 ? Math.ceil(pointsToNext / avgPointsPerCruise) : 0;
      
      // Get tier requirements
      const currentTierReqs = CLUB_ROYALE_TIERS.find(t => t.tier === currentTier);
      const nextTierReqs = currentTier === 'Prime' 
        ? CLUB_ROYALE_TIERS.find(t => t.tier === 'Signature')
        : currentTier === 'Signature'
        ? CLUB_ROYALE_TIERS.find(t => t.tier === 'Masters')
        : null;
      
      const analysis = {
        currentTier,
        currentPoints: profile.totalPoints,
        pointsToNextTier: pointsToNext,
        nextTier: nextTierReqs?.tier || null,
        avgPointsPerCruise: Math.round(avgPointsPerCruise),
        cruisesNeeded,
        estimatedMonthsToNextTier: Math.ceil(cruisesNeeded / 0.5), // Assuming 6 cruises per year
        currentTierBenefits: currentTierReqs?.benefits || [],
        nextTierBenefits: nextTierReqs?.benefits || [],
        progressPercentage: currentTier === 'Prime' 
          ? (profile.totalPoints / 25000) * 100
          : currentTier === 'Signature'
          ? ((profile.totalPoints - 25000) / 50000) * 100
          : 100
      };
      
      console.log('[Points] Successfully calculated tier progression:', {
        currentTier: analysis.currentTier,
        pointsToNext: analysis.pointsToNextTier,
        cruisesNeeded: analysis.cruisesNeeded
      });
      
      return analysis;
    } catch (error) {
      console.error('[Points] Error getting tier progression:', error);
      throw new Error('Failed to get tier progression analysis');
    }
  });

// Get available certificates
export const getAvailableCertificatesProcedure = publicProcedure
  .query(async () => {
    console.log('[Points] Getting available certificates...');
    
    try {
      const profile = SAMPLE_CLUB_ROYALE_PROFILE;
      const availableCerts = getAvailableCertificates(profile.totalPoints);
      
      // Add status information
      const certificatesWithStatus = availableCerts.map(cert => {
        const userCert = profile.certificates.find(c => c.code === cert.offerCode);
        return {
          ...cert,
          isEarned: !!userCert,
          isUsed: userCert?.isUsed || false,
          earnedDate: userCert?.earnedDate,
          expirationDate: userCert?.expirationDate,
          cruiseEarnedOn: userCert?.cruiseEarnedOn
        };
      });
      
      console.log('[Points] Successfully retrieved certificates:', {
        totalAvailable: certificatesWithStatus.length,
        earned: certificatesWithStatus.filter(c => c.isEarned).length,
        unused: certificatesWithStatus.filter(c => c.isEarned && !c.isUsed).length
      });
      
      return certificatesWithStatus;
    } catch (error) {
      console.error('[Points] Error getting certificates:', error);
      throw new Error('Failed to get available certificates');
    }
  });

// Mark certificate as used
export const useCertificateProcedure = publicProcedure
  .input(z.object({
    certificateCode: z.string(),
    cruiseId: z.string()
  }))
  .mutation(async ({ input }) => {
    console.log('[Points] Marking certificate as used:', input);
    
    try {
      // In production, this would update the database
      const { certificateCode, cruiseId } = input;
      
      console.log('[Points] Successfully marked certificate as used:', {
        certificateCode,
        cruiseId
      });
      
      return {
        success: true,
        message: `Certificate ${certificateCode} marked as used on cruise ${cruiseId}`
      };
    } catch (error) {
      console.error('[Points] Error marking certificate as used:', error);
      throw new Error('Failed to mark certificate as used');
    }
  });

// Add or update points for a specific cruise with winnings/losses
export const addCruisePointsProcedure = publicProcedure
  .input(z.object({
    cruiseId: z.string(),
    pointsEarned: z.number().min(0),
    amountWonOrLost: z.number().optional(), // Positive for winnings, negative for losses
    ship: z.string().optional(),
    sailDate: z.string().optional(),
    notes: z.string().optional()
  }))
  .mutation(async ({ input }) => {
    console.log('[Points] Adding/updating cruise points:', input);
    
    try {
      const { cruiseId, pointsEarned, amountWonOrLost = 0, ship, sailDate, notes } = input;
      
      // Update the verified points mapping
      if (!VERIFIED_CRUISE_POINTS[cruiseId]) {
        VERIFIED_CRUISE_POINTS[cruiseId] = {
          pointsEarned,
          amountWonOrLost,
          ship: ship || 'Unknown Ship',
          sailDate: sailDate || new Date().toISOString().split('T')[0],
          verified: true
        };
      } else {
        VERIFIED_CRUISE_POINTS[cruiseId].pointsEarned = pointsEarned;
        VERIFIED_CRUISE_POINTS[cruiseId].amountWonOrLost = amountWonOrLost;
        if (ship) VERIFIED_CRUISE_POINTS[cruiseId].ship = ship;
        if (sailDate) VERIFIED_CRUISE_POINTS[cruiseId].sailDate = sailDate;
      }
      
      // Update the club royale profile
      const existingHistoryIndex = clubRoyaleProfile.cruiseHistory.findIndex(h => h.cruiseId === cruiseId);
      
      const historyEntry = {
        id: `history-${cruiseId}`,
        cruiseId,
        ship: ship || VERIFIED_CRUISE_POINTS[cruiseId].ship,
        departureDate: `${sailDate || VERIFIED_CRUISE_POINTS[cruiseId].sailDate}T00:00:00.000Z`,
        pointsEarned,
        coinIn: pointsEarned * 5,
        actualSavings: Math.abs(amountWonOrLost),
        valuePerPoint: pointsEarned > 0 ? Math.abs(amountWonOrLost) / pointsEarned : 0,
        certificatesEarned: [],
        tier: 'Prime' as const,
        notes: notes || 'Updated via points system'
      };
      
      if (existingHistoryIndex >= 0) {
        clubRoyaleProfile.cruiseHistory[existingHistoryIndex] = historyEntry;
      } else {
        clubRoyaleProfile.cruiseHistory.push(historyEntry);
      }
      
      // Recalculate total points
      clubRoyaleProfile.totalPoints = clubRoyaleProfile.cruiseHistory.reduce((sum, cruise) => sum + cruise.pointsEarned, 0);
      
      console.log('[Points] Successfully added/updated cruise points:', {
        cruiseId,
        pointsEarned,
        amountWonOrLost,
        totalPoints: clubRoyaleProfile.totalPoints
      });
      
      return {
        success: true,
        cruiseId,
        pointsEarned,
        amountWonOrLost,
        totalPoints: clubRoyaleProfile.totalPoints,
        message: `Updated ${pointsEarned} points for cruise ${cruiseId}`
      };
    } catch (error) {
      console.error('[Points] Error adding/updating cruise points:', error);
      throw new Error('Failed to add/update cruise points');
    }
  });

// Get comprehensive points summary
export const getPointsSummaryProcedure = publicProcedure
  .query(async () => {
    console.log('[Points] Getting comprehensive points summary...');
    
    try {
      const totalPoints = Object.values(VERIFIED_CRUISE_POINTS).reduce((sum, cruise) => sum + cruise.pointsEarned, 0);
      const totalWinnings = Object.values(VERIFIED_CRUISE_POINTS).reduce((sum, cruise) => sum + cruise.amountWonOrLost, 0);
      const totalCoinIn = totalPoints * 5;
      const cruiseCount = Object.keys(VERIFIED_CRUISE_POINTS).length;
      
      const currentTier = getCurrentTier(totalPoints);
      const pointsToNext = getPointsToNextTier(totalPoints);
      
      // Calculate value per point based on actual winnings
      const valuePerPoint = totalPoints > 0 ? totalWinnings / totalPoints : 0;
      
      // Get cruise breakdown
      const cruiseBreakdown = Object.entries(VERIFIED_CRUISE_POINTS).map(([cruiseId, data]) => ({
        cruiseId,
        ship: data.ship,
        sailDate: data.sailDate,
        pointsEarned: data.pointsEarned,
        amountWonOrLost: data.amountWonOrLost,
        coinIn: data.pointsEarned * 5,
        valuePerPoint: data.pointsEarned > 0 ? data.amountWonOrLost / data.pointsEarned : 0,
        verified: data.verified
      })).sort((a, b) => new Date(b.sailDate).getTime() - new Date(a.sailDate).getTime());
      
      const summary = {
        totalPoints,
        totalWinnings,
        totalCoinIn,
        cruiseCount,
        currentTier,
        pointsToNextTier: pointsToNext,
        valuePerPoint,
        averagePointsPerCruise: cruiseCount > 0 ? totalPoints / cruiseCount : 0,
        cruiseBreakdown,
        lastUpdated: new Date().toISOString()
      };
      
      console.log('[Points] Successfully retrieved points summary:', {
        totalPoints: summary.totalPoints,
        totalWinnings: summary.totalWinnings,
        cruiseCount: summary.cruiseCount,
        currentTier: summary.currentTier
      });
      
      return summary;
    } catch (error) {
      console.error('[Points] Error getting points summary:', error);
      throw new Error('Failed to get points summary');
    }
  });