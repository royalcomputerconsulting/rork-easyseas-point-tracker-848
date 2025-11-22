import { publicProcedure } from '../../../create-context';
import { z } from 'zod';
import { memoryStore } from '../../_stores/memory';

export const alertsRoute = publicProcedure
  .input(z.object({
    daysThreshold: z.number().optional().default(30),
  }))
  .query(({ input }) => {
    console.log('[Analytics] Calculating offer expiration alerts');

    const offers = memoryStore.getCasinoOffers();
    const cruises = memoryStore.getCruises();
    const userProfile = memoryStore.getUserProfile();
    const now = new Date();

    const alerts = [];
    
    for (const offer of offers) {
      const expiryDate = new Date(offer.expires);
      const daysUntilExpiry = Math.floor((expiryDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

      if (daysUntilExpiry < 0) {
        continue;
      }

      if (daysUntilExpiry <= input.daysThreshold) {
        const matchingCruises = cruises.filter(cruise => {
          const cruiseDate = new Date(cruise.departureDate);
          return cruiseDate < expiryDate && cruiseDate > now;
        });

        const offerValue = parseFloat(offer.tradeInValue?.replace(/[$,]/g, '') || '0');
        const urgencyLevel = 
          daysUntilExpiry <= 3 ? 'critical' : 
          daysUntilExpiry <= 7 ? 'high' : 
          daysUntilExpiry <= 15 ? 'medium' : 'low';

        const canAfford = userProfile && userProfile.points >= (offerValue / 10);

        alerts.push({
          id: offer.id,
          type: 'offer_expiration',
          urgencyLevel,
          title: `${offer.offerName} expires in ${daysUntilExpiry} day${daysUntilExpiry > 1 ? 's' : ''}`,
          message: `Your ${offer.offerName} (${offer.offerCode}) is expiring on ${expiryDate.toLocaleDateString()}`,
          offerCode: offer.offerCode,
          offerName: offer.offerName,
          offerValue,
          daysUntilExpiry,
          expiryDate: offer.expires,
          matchingCruises: matchingCruises.length,
          matchingCruiseIds: matchingCruises.slice(0, 5).map(c => c.id),
          suggestedAction: canAfford 
            ? `You have ${userProfile?.points || 0} points. Book before ${expiryDate.toLocaleDateString()}!`
            : `Need ${Math.ceil(offerValue / 10) - (userProfile?.points || 0)} more points to use this offer.`,
          canAfford,
          priority: urgencyLevel === 'critical' ? 1 : urgencyLevel === 'high' ? 2 : urgencyLevel === 'medium' ? 3 : 4,
        });
      }
    }

    alerts.sort((a, b) => a.priority - b.priority);

    const summary = {
      total: alerts.length,
      critical: alerts.filter(a => a.urgencyLevel === 'critical').length,
      high: alerts.filter(a => a.urgencyLevel === 'high').length,
      medium: alerts.filter(a => a.urgencyLevel === 'medium').length,
      low: alerts.filter(a => a.urgencyLevel === 'low').length,
      totalOfferValue: alerts.reduce((sum, a) => sum + a.offerValue, 0),
      affordableOffers: alerts.filter(a => a.canAfford).length,
    };

    console.log(`[Analytics] Generated ${alerts.length} expiration alerts`);

    return {
      alerts,
      summary,
      timestamp: new Date().toISOString(),
    };
  });

export const offerMatchingRoute = publicProcedure
  .query(() => {
    console.log('[Analytics] Auto-matching offers to available cruises');

    const offers = memoryStore.getCasinoOffers();
    const cruises = memoryStore.getCruises();
    const bookedCruises = memoryStore.getBookedCruises();
    const userProfile = memoryStore.getUserProfile();
    const now = new Date();

    const matches = [];

    for (const offer of offers) {
      const expiryDate = new Date(offer.expires);
      if (expiryDate < now) continue;

      const offerValue = parseFloat(offer.tradeInValue?.replace(/[$,]/g, '') || '0');
      const pointsRequired = Math.ceil(offerValue / 10);

      const availableCruises = cruises.filter(cruise => {
        const cruiseDate = new Date(cruise.departureDate);
        
        if (cruiseDate < now || cruiseDate > expiryDate) {
          return false;
        }

        const isBooked = bookedCruises.some(bc => bc.cruiseId === cruise.id);
        if (isBooked) return false;

        if (offer.cabinType && cruise.cabinType && offer.cabinType !== cruise.cabinType) {
          return false;
        }

        return true;
      });

      for (const cruise of availableCruises) {
        const potentialSavings = offerValue;
        const cruiseDate = new Date(cruise.departureDate);
        const daysUntilCruise = Math.floor((cruiseDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
        const daysUntilExpiry = Math.floor((expiryDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

        const matchScore = calculateMatchScore({
          potentialSavings,
          daysUntilCruise,
          daysUntilExpiry,
          userPoints: userProfile?.points || 0,
          pointsRequired,
          cruiseNights: cruise.nights || 7,
        });

        matches.push({
          id: `${offer.id}-${cruise.id}`,
          offerId: offer.id,
          offerCode: offer.offerCode,
          offerName: offer.offerName,
          offerValue,
          offerExpiry: offer.expires,
          daysUntilExpiry,
          cruiseId: cruise.id,
          cruiseShip: cruise.ship,
          cruiseItinerary: cruise.itineraryName,
          cruiseDepartureDate: cruise.departureDate,
          cruiseNights: cruise.nights || 0,
          daysUntilCruise,
          cabinType: cruise.cabinType || 'Unknown',
          potentialSavings,
          pointsRequired,
          userPoints: userProfile?.points || 0,
          canAfford: (userProfile?.points || 0) >= pointsRequired,
          pointsShortfall: Math.max(0, pointsRequired - (userProfile?.points || 0)),
          matchScore,
          matchRating: matchScore >= 80 ? 'excellent' : matchScore >= 60 ? 'good' : matchScore >= 40 ? 'fair' : 'poor',
          recommendation: getMatchRecommendation(matchScore, daysUntilExpiry, daysUntilCruise),
        });
      }
    }

    matches.sort((a, b) => b.matchScore - a.matchScore);

    const summary = {
      totalMatches: matches.length,
      excellentMatches: matches.filter(m => m.matchRating === 'excellent').length,
      goodMatches: matches.filter(m => m.matchRating === 'good').length,
      fairMatches: matches.filter(m => m.matchRating === 'fair').length,
      poorMatches: matches.filter(m => m.matchRating === 'poor').length,
      totalPotentialSavings: matches.reduce((sum, m) => sum + m.potentialSavings, 0),
      affordableMatches: matches.filter(m => m.canAfford).length,
      topMatches: matches.slice(0, 10),
    };

    console.log(`[Analytics] Found ${matches.length} offer-cruise matches`);

    return {
      matches,
      summary,
      timestamp: new Date().toISOString(),
    };
  });

export const bookingUrgencyRoute = publicProcedure
  .input(z.object({
    cruiseId: z.string(),
  }))
  .query(({ input }) => {
    console.log('[Analytics] Calculating booking urgency for cruise:', input.cruiseId);

    const cruise = memoryStore.getCruise(input.cruiseId);
    if (!cruise) {
      throw new Error('Cruise not found');
    }

    const offers = memoryStore.getCasinoOffers();
    const userProfile = memoryStore.getUserProfile();
    const now = new Date();
    const cruiseDate = new Date(cruise.departureDate);
    const daysUntilCruise = Math.floor((cruiseDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

    const applicableOffers = offers.filter(offer => {
      const expiryDate = new Date(offer.expires);
      return expiryDate > now && cruiseDate < expiryDate;
    });

    let maxOfferValue = 0;
    let urgentOffer = null;
    let minDaysUntilExpiry = Infinity;

    for (const offer of applicableOffers) {
      const offerValue = parseFloat(offer.tradeInValue?.replace(/[$,]/g, '') || '0');
      const expiryDate = new Date(offer.expires);
      const daysUntilExpiry = Math.floor((expiryDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

      if (offerValue > maxOfferValue) {
        maxOfferValue = offerValue;
        urgentOffer = offer;
      }

      if (daysUntilExpiry < minDaysUntilExpiry) {
        minDaysUntilExpiry = daysUntilExpiry;
      }
    }

    const urgencyScore = calculateUrgencyScore({
      daysUntilCruise,
      minDaysUntilExpiry,
      offerValue: maxOfferValue,
      userPoints: userProfile?.points || 0,
      hasApplicableOffers: applicableOffers.length > 0,
    });

    const urgencyLevel = 
      urgencyScore >= 90 ? 'critical' :
      urgencyScore >= 70 ? 'high' :
      urgencyScore >= 40 ? 'medium' : 'low';

    const recommendation = getUrgencyRecommendation({
      urgencyLevel,
      daysUntilCruise,
      minDaysUntilExpiry,
      maxOfferValue,
      applicableOffersCount: applicableOffers.length,
    });

    return {
      cruiseId: input.cruiseId,
      cruiseShip: cruise.ship,
      cruiseItinerary: cruise.itineraryName,
      cruiseDepartureDate: cruise.departureDate,
      daysUntilCruise,
      urgencyScore,
      urgencyLevel,
      applicableOffersCount: applicableOffers.length,
      maxOfferValue,
      minDaysUntilExpiry: minDaysUntilExpiry === Infinity ? null : minDaysUntilExpiry,
      urgentOffer: urgentOffer ? {
        id: urgentOffer.id,
        code: urgentOffer.offerCode,
        name: urgentOffer.offerName,
        value: maxOfferValue,
        expires: urgentOffer.expires,
      } : null,
      recommendation,
      actions: getRecommendedActions({
        urgencyLevel,
        daysUntilCruise,
        minDaysUntilExpiry,
        hasOffers: applicableOffers.length > 0,
      }),
      timestamp: new Date().toISOString(),
    };
  });

function calculateMatchScore(params: {
  potentialSavings: number;
  daysUntilCruise: number;
  daysUntilExpiry: number;
  userPoints: number;
  pointsRequired: number;
  cruiseNights: number;
}): number {
  let score = 0;

  const affordabilityScore = params.userPoints >= params.pointsRequired ? 30 : 
    (params.userPoints / params.pointsRequired) * 30;
  score += affordabilityScore;

  const valueScore = Math.min(30, (params.potentialSavings / 1000) * 30);
  score += valueScore;

  const timingScore = params.daysUntilExpiry > params.daysUntilCruise + 7 ? 20 :
    params.daysUntilExpiry > params.daysUntilCruise ? 15 :
    10;
  score += timingScore;

  const lengthScore = Math.min(20, (params.cruiseNights / 14) * 20);
  score += lengthScore;

  return Math.round(Math.min(100, score));
}

function getMatchRecommendation(matchScore: number, daysUntilExpiry: number, daysUntilCruise: number): string {
  if (matchScore >= 80) {
    return daysUntilExpiry <= 7 
      ? '🔥 Excellent match! Book urgently - offer expires soon!'
      : '⭐ Excellent match! Highly recommended booking.';
  }
  if (matchScore >= 60) {
    return '✅ Good match - strong value proposition.';
  }
  if (matchScore >= 40) {
    return '👍 Fair match - consider if schedule fits.';
  }
  return '⚠️ Marginal match - explore other options.';
}

function calculateUrgencyScore(params: {
  daysUntilCruise: number;
  minDaysUntilExpiry: number;
  offerValue: number;
  userPoints: number;
  hasApplicableOffers: boolean;
}): number {
  if (!params.hasApplicableOffers) return 0;

  let score = 0;

  const timeUrgency = params.minDaysUntilExpiry <= 3 ? 40 :
    params.minDaysUntilExpiry <= 7 ? 30 :
    params.minDaysUntilExpiry <= 15 ? 20 :
    params.minDaysUntilExpiry <= 30 ? 10 : 5;
  score += timeUrgency;

  const valueUrgency = Math.min(30, (params.offerValue / 2000) * 30);
  score += valueUrgency;

  const bookingWindowUrgency = params.daysUntilCruise <= 30 ? 20 :
    params.daysUntilCruise <= 60 ? 15 :
    params.daysUntilCruise <= 90 ? 10 : 5;
  score += bookingWindowUrgency;

  const conflictPenalty = params.minDaysUntilExpiry < params.daysUntilCruise ? 10 : 0;
  score += conflictPenalty;

  return Math.round(Math.min(100, score));
}

function getUrgencyRecommendation(params: {
  urgencyLevel: string;
  daysUntilCruise: number;
  minDaysUntilExpiry: number;
  maxOfferValue: number;
  applicableOffersCount: number;
}): string {
  if (params.urgencyLevel === 'critical') {
    return `🚨 URGENT: You have ${params.applicableOffersCount} offer${params.applicableOffersCount > 1 ? 's' : ''} worth up to $${params.maxOfferValue.toLocaleString()} expiring in ${params.minDaysUntilExpiry} day${params.minDaysUntilExpiry > 1 ? 's' : ''}. Book immediately!`;
  }
  if (params.urgencyLevel === 'high') {
    return `⚠️ HIGH PRIORITY: ${params.applicableOffersCount} valuable offer${params.applicableOffersCount > 1 ? 's' : ''} available. Book within the next few days to secure best value.`;
  }
  if (params.urgencyLevel === 'medium') {
    return `📋 MODERATE: ${params.applicableOffersCount} offer${params.applicableOffersCount > 1 ? 's' : ''} applicable. Book within 1-2 weeks for optimal timing.`;
  }
  return `✓ LOW URGENCY: You have time to evaluate options. ${params.daysUntilCruise} days until cruise.`;
}

function getRecommendedActions(params: {
  urgencyLevel: string;
  daysUntilCruise: number;
  minDaysUntilExpiry: number;
  hasOffers: boolean;
}): string[] {
  const actions = [];

  if (params.urgencyLevel === 'critical') {
    actions.push('Book this cruise within 24-48 hours');
    actions.push('Review offer details and cabin availability immediately');
    actions.push('Set a calendar reminder for offer expiration');
  } else if (params.urgencyLevel === 'high') {
    actions.push('Book within the next 3-5 days');
    actions.push('Compare cabin options and pricing');
    actions.push('Check for any additional promotions');
  } else if (params.urgencyLevel === 'medium') {
    actions.push('Book within 1-2 weeks');
    actions.push('Monitor pricing for potential drops');
    actions.push('Review other cruise options in same timeframe');
  } else {
    actions.push('Continue monitoring offers');
    actions.push('Wait for optimal booking window');
    actions.push('Compare with other available cruises');
  }

  if (!params.hasOffers) {
    actions.push('No active offers - consider booking closer to departure');
  }

  return actions;
}
