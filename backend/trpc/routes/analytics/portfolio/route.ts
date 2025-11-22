import { z } from 'zod';
import { protectedProcedure } from '../../../create-context';
import { memoryStore } from '../../_stores/memory';
import { getTierByPoints, getNextTier } from '../../../../../constants/clubRoyaleTiers';

interface CruiseRecommendation {
  cruiseId: string;
  ship: string;
  itineraryName: string;
  departureDate: string;
  returnDate: string;
  nights: number;
  departurePort: string;
  estimatedPoints: number;
  estimatedROI: number;
  estimatedValue: number;
  estimatedCost: number;
  cabinType: string;
  score: number;
  reasons: string[];
  offerCode?: string;
  offerExpiration?: string;
}

interface PortfolioRecommendation {
  id: string;
  strategy: string;
  title: string;
  description: string;
  cruises: CruiseRecommendation[];
  totalPoints: number;
  totalCost: number;
  totalValue: number;
  averageROI: number;
  targetTierAchieved: string | null;
  timeToComplete: string;
  certificatesUsed: number;
  score: number;
  benefits: string[];
  warnings: string[];
}

export const portfolioProcedure = protectedProcedure
  .input(
    z.object({
      targetTier: z.enum(['PRIME', 'SIGNATURE', 'MASTERS']).optional(),
      maxCruises: z.number().min(1).max(10).default(5),
      budgetConstraint: z.number().optional(),
      dateRange: z.object({
        from: z.string(),
        to: z.string(),
      }).optional(),
      preferredCabinTypes: z.array(z.string()).optional(),
      includeExpiringOffers: z.boolean().default(true),
    })
  )
  .query(async ({ input }) => {
    console.log('[Portfolio Optimizer] Input:', input);

    const cruises = memoryStore.cruises || [];
    const bookedCruises = memoryStore.bookedCruises || [];
    const offers = memoryStore.casinoOffers || [];
    const financials = memoryStore.financials || [];

    const completedCruises = bookedCruises.filter(
      (cruise) => cruise.lifecycleStatus === 'completed'
    );

    const currentPoints = completedCruises.reduce(
      (sum, cruise) => sum + (cruise.cruisePointsEarned || 0),
      0
    );

    const averagePointsPerCruise =
      completedCruises.length > 0
        ? completedCruises.reduce(
            (sum, cruise) => sum + (cruise.cruisePointsEarned || 0),
            0
          ) / completedCruises.length
        : 1000;

    const averageROI =
      completedCruises.filter((c) => c.roiPercentage).length > 0
        ? completedCruises.reduce((sum, c) => sum + (c.roiPercentage || 0), 0) /
          completedCruises.filter((c) => c.roiPercentage).length
        : 40;

    const currentTier = getTierByPoints(currentPoints);
    const nextTier = getNextTier(currentPoints);

    const targetTierName = input.targetTier || nextTier?.name || 'SIGNATURE';
    const targetTierInfo =
      targetTierName === 'PRIME'
        ? { minPoints: 2500 }
        : targetTierName === 'SIGNATURE'
        ? { minPoints: 25000 }
        : { minPoints: 100000 };

    const pointsNeeded = Math.max(0, targetTierInfo.minPoints - currentPoints);

    const availableCruises = cruises.filter((cruise) => {
      if (cruise.status === 'sold_out' || cruise.status === 'canceled') return false;

      const isBooked = bookedCruises.some(
        (bc) => bc.cruiseId === cruise.id || bc.reservationNumber === cruise.reservationNumber
      );
      if (isBooked) return false;

      if (input.dateRange) {
        const cruiseDate = new Date(cruise.departureDate);
        const fromDate = new Date(input.dateRange.from);
        const toDate = new Date(input.dateRange.to);
        if (cruiseDate < fromDate || cruiseDate > toDate) return false;
      }

      if (input.preferredCabinTypes && input.preferredCabinTypes.length > 0) {
        const hasCabinMatch = input.preferredCabinTypes.some((cabinType) =>
          cruise.stateroomTypes?.includes(cabinType)
        );
        if (!hasCabinMatch) return false;
      }

      return true;
    });

    const scoredCruises: CruiseRecommendation[] = availableCruises
      .map((cruise) => {
        const estimatedPoints = averagePointsPerCruise * (cruise.nights / 7);
        const estimatedCost =
          cruise.pricingCurrent?.balcony ||
          cruise.balconyPrice ||
          cruise.oceanviewPrice ||
          cruise.interiorPrice ||
          1500;

        const estimatedValue = estimatedCost * (1 + averageROI / 100);
        const estimatedROI = averageROI;

        const hasOffer = offers.some(
          (offer) =>
            offer.offerCode === cruise.offerCode ||
            offer.ships?.includes(cruise.ship)
        );

        const offerExpiring = hasOffer
          ? offers.find(
              (offer) =>
                offer.offerCode === cruise.offerCode ||
                offer.ships?.includes(cruise.ship)
            )
          : null;

        const daysToExpiration = offerExpiring
          ? Math.ceil(
              (new Date(offerExpiring.expires).getTime() - Date.now()) /
                (1000 * 60 * 60 * 24)
            )
          : 999;

        let score = 0;
        const reasons: string[] = [];

        score += estimatedPoints / 100;
        if (estimatedPoints >= 1000) {
          reasons.push(`High point potential: ${Math.round(estimatedPoints)} pts`);
        }

        score += estimatedROI / 10;
        if (estimatedROI >= 40) {
          reasons.push(`Excellent ROI: ${estimatedROI.toFixed(1)}%`);
        }

        if (cruise.nights >= 10) {
          score += 20;
          reasons.push('Optimal cruise length (10+ nights)');
        }

        if (hasOffer) {
          score += 15;
          reasons.push('Has casino offer');
        }

        if (offerExpiring && daysToExpiration <= 30) {
          score += 25;
          reasons.push(`Offer expires in ${daysToExpiration} days - book soon!`);
        }

        const preferredPorts = ['Los Angeles', 'Long Beach', 'San Pedro'];
        if (preferredPorts.some((port) => cruise.departurePort?.includes(port))) {
          score += 10;
          reasons.push('Preferred departure port (driving distance)');
        }

        const cabinType =
          cruise.cabinType ||
          cruise.stateroomTypes?.[0] ||
          'Balcony';

        return {
          cruiseId: cruise.id,
          ship: cruise.ship,
          itineraryName: cruise.itineraryName,
          departureDate: cruise.departureDate,
          returnDate: cruise.returnDate,
          nights: cruise.nights,
          departurePort: cruise.departurePort || '',
          estimatedPoints: Math.round(estimatedPoints),
          estimatedROI: Math.round(estimatedROI * 10) / 10,
          estimatedValue: Math.round(estimatedValue),
          estimatedCost: Math.round(estimatedCost),
          cabinType,
          score,
          reasons,
          offerCode: cruise.offerCode,
          offerExpiration: offerExpiring?.expires,
        };
      })
      .sort((a, b) => b.score - a.score)
      .slice(0, 20);

    const recommendations: PortfolioRecommendation[] = [];

    if (pointsNeeded > 0) {
      const cruisesNeeded = Math.ceil(pointsNeeded / averagePointsPerCruise);
      const selectedCruises = scoredCruises
        .slice(0, Math.min(cruisesNeeded, input.maxCruises))
        .sort((a, b) => new Date(a.departureDate).getTime() - new Date(b.departureDate).getTime());

      const totalPoints = selectedCruises.reduce((sum, c) => sum + c.estimatedPoints, 0);
      const totalCost = selectedCruises.reduce((sum, c) => sum + c.estimatedCost, 0);
      const totalValue = selectedCruises.reduce((sum, c) => sum + c.estimatedValue, 0);

      const monthsToComplete =
        selectedCruises.length > 0
          ? Math.ceil(
              (new Date(selectedCruises[selectedCruises.length - 1].departureDate).getTime() -
                Date.now()) /
                (1000 * 60 * 60 * 24 * 30)
            )
          : 0;

      const benefits = [
        `Reach ${targetTierName} tier (+${totalPoints.toLocaleString()} points)`,
        `Estimated ${Math.round(totalValue - totalCost).toLocaleString()} in total value`,
        `Average ${Math.round((totalValue / totalCost - 1) * 100)}% ROI`,
      ];

      if (targetTierName === 'SIGNATURE') {
        benefits.push('Unlock annual balcony stateroom courtesy of Club Royale');
        benefits.push('Up to $2,500 FreePlay on future cruises');
      } else if (targetTierName === 'MASTERS') {
        benefits.push('Unlock annual suite courtesy of Club Royale');
        benefits.push('Up to $5,000 FreePlay on future cruises');
      }

      recommendations.push({
        id: 'tier-progression',
        strategy: 'Tier Advancement',
        title: `Fast Track to ${targetTierName}`,
        description: `Book ${selectedCruises.length} cruises to reach ${targetTierName} tier in ~${monthsToComplete} months`,
        cruises: selectedCruises,
        totalPoints,
        totalCost,
        totalValue,
        averageROI: totalCost > 0 ? ((totalValue / totalCost - 1) * 100) : 0,
        targetTierAchieved: currentPoints + totalPoints >= targetTierInfo.minPoints ? targetTierName : null,
        timeToComplete: `${monthsToComplete} months`,
        certificatesUsed: 0,
        score: 100,
        benefits,
        warnings:
          input.budgetConstraint && totalCost > input.budgetConstraint
            ? [`Total cost $${totalCost.toLocaleString()} exceeds budget of $${input.budgetConstraint.toLocaleString()}`]
            : [],
      });
    }

    const expiringOffers = scoredCruises
      .filter((c) => c.offerExpiration)
      .sort((a, b) => {
        const daysA = Math.ceil(
          (new Date(a.offerExpiration!).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
        );
        const daysB = Math.ceil(
          (new Date(b.offerExpiration!).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
        );
        return daysA - daysB;
      })
      .slice(0, 3);

    if (expiringOffers.length > 0) {
      const totalPoints = expiringOffers.reduce((sum, c) => sum + c.estimatedPoints, 0);
      const totalCost = expiringOffers.reduce((sum, c) => sum + c.estimatedCost, 0);
      const totalValue = expiringOffers.reduce((sum, c) => sum + c.estimatedValue, 0);

      recommendations.push({
        id: 'expiring-offers',
        strategy: 'Maximize Expiring Offers',
        title: 'Capture Expiring High-Value Offers',
        description: `${expiringOffers.length} high-value offers expiring soon - book before you lose them`,
        cruises: expiringOffers,
        totalPoints,
        totalCost,
        totalValue,
        averageROI: totalCost > 0 ? ((totalValue / totalCost - 1) * 100) : 0,
        targetTierAchieved: null,
        timeToComplete: 'Urgent - offers expiring',
        certificatesUsed: expiringOffers.length,
        score: 90,
        benefits: [
          `Save ${expiringOffers.length} casino offers from expiration`,
          `Earn ${totalPoints.toLocaleString()} points`,
          `$${Math.round(totalValue - totalCost).toLocaleString()} estimated value`,
        ],
        warnings: [],
      });
    }

    const balancedPortfolio = scoredCruises
      .slice(0, Math.min(3, input.maxCruises))
      .sort((a, b) => new Date(a.departureDate).getTime() - new Date(b.departureDate).getTime());

    if (balancedPortfolio.length > 0) {
      const totalPoints = balancedPortfolio.reduce((sum, c) => sum + c.estimatedPoints, 0);
      const totalCost = balancedPortfolio.reduce((sum, c) => sum + c.estimatedCost, 0);
      const totalValue = balancedPortfolio.reduce((sum, c) => sum + c.estimatedValue, 0);

      recommendations.push({
        id: 'balanced',
        strategy: 'Balanced Approach',
        title: 'Optimal Value & Point Balance',
        description: 'Best overall ROI while steadily earning points',
        cruises: balancedPortfolio,
        totalPoints,
        totalCost,
        totalValue,
        averageROI: totalCost > 0 ? ((totalValue / totalCost - 1) * 100) : 0,
        targetTierAchieved: null,
        timeToComplete: 'Flexible schedule',
        certificatesUsed: 0,
        score: 85,
        benefits: [
          'Balanced mix of value and points',
          `${totalPoints.toLocaleString()} points over ${balancedPortfolio.length} cruises`,
          'Diversified across ships and itineraries',
        ],
        warnings: [],
      });
    }

    const quickPointEarners = scoredCruises
      .sort((a, b) => b.estimatedPoints - a.estimatedPoints)
      .slice(0, 2);

    if (quickPointEarners.length > 0) {
      const totalPoints = quickPointEarners.reduce((sum, c) => sum + c.estimatedPoints, 0);
      const totalCost = quickPointEarners.reduce((sum, c) => sum + c.estimatedCost, 0);
      const totalValue = quickPointEarners.reduce((sum, c) => sum + c.estimatedValue, 0);

      recommendations.push({
        id: 'quick-points',
        strategy: 'Quick Point Boost',
        title: 'Maximize Point Earning Speed',
        description: 'Fastest path to earning maximum points',
        cruises: quickPointEarners,
        totalPoints,
        totalCost,
        totalValue,
        averageROI: totalCost > 0 ? ((totalValue / totalCost - 1) * 100) : 0,
        targetTierAchieved: null,
        timeToComplete: 'Fast track',
        certificatesUsed: 0,
        score: 80,
        benefits: [
          `${totalPoints.toLocaleString()} points in just ${quickPointEarners.length} cruises`,
          'Longest cruises = most casino time',
          'Accelerated tier progression',
        ],
        warnings: ['Higher upfront cost for longer cruises'],
      });
    }

    return {
      currentState: {
        currentPoints,
        currentTier: currentTier.name,
        nextTier: nextTier?.name || null,
        pointsToNextTier: pointsNeeded,
        cruisesNeeded: Math.ceil(pointsNeeded / averagePointsPerCruise),
        averagePointsPerCruise: Math.round(averagePointsPerCruise),
        averageROI: Math.round(averageROI * 10) / 10,
        completedCruises: completedCruises.length,
      },
      recommendations: recommendations.sort((a, b) => b.score - a.score),
      availableCruises: scoredCruises.slice(0, 10),
      summary: {
        totalRecommendations: recommendations.length,
        bestStrategy: recommendations[0]?.strategy || 'None',
        estimatedPointsInPipeline: recommendations[0]?.totalPoints || 0,
        estimatedValueInPipeline: recommendations[0]?.totalValue || 0,
      },
    };
  });
