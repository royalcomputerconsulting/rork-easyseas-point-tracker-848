import { z } from 'zod';
import { publicProcedure } from '../../../create-context';
import { memoryStore } from '../../_stores/memory';

interface Alert {
  id: string;
  type: 'expiration' | 'match' | 'urgency' | 'high-value';
  severity: 'low' | 'medium' | 'high' | 'critical';
  offerId: string;
  offerName: string;
  message: string;
  actionable: boolean;
  actionText?: string;
  daysUntilExpiration?: number;
  matchedCruises?: {
    cruiseId: string;
    ship: string;
    sailDate: string;
    matchScore: number;
  }[];
  offerValue?: number;
  pointBalance?: number;
  createdAt: string;
}

export const offerAlertsProcedure = publicProcedure.query(() => {
  console.log('[tRPC] Offer Alerts - Analyzing offer expirations and matches');
  
  const offers = memoryStore.getCasinoOffers();
  const cruises = memoryStore.getCruises();
  const userProfile = memoryStore.getUserProfile();

  
  const now = new Date();
  const alerts: Alert[] = [];
  const currentPoints = userProfile?.points || 0;

  offers.forEach(offer => {
    if (!offer.expires) return;
    
    const expirationDate = new Date(offer.expires);
    const daysUntilExpiration = Math.ceil((expirationDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    
    if (daysUntilExpiration < 0) return;
    
    const offerValue = parseFloat(offer.tradeInValue?.replace(/[^0-9.]/g, '') || '0');
    
    // Expiration alerts at key thresholds
    if (daysUntilExpiration <= 3) {
      alerts.push({
        id: `exp-critical-${offer.id}`,
        type: 'expiration',
        severity: 'critical',
        offerId: offer.id,
        offerName: offer.offerName || offer.name || 'Unknown Offer',
        message: `URGENT: ${offer.offerName || offer.name} expires in ${daysUntilExpiration} day${daysUntilExpiration !== 1 ? 's' : ''}! Book now or lose $${offerValue}.`,
        actionable: true,
        actionText: 'View Matching Cruises',
        daysUntilExpiration,
        offerValue,
        createdAt: now.toISOString(),
      });
    } else if (daysUntilExpiration <= 7) {
      alerts.push({
        id: `exp-high-${offer.id}`,
        type: 'expiration',
        severity: 'high',
        offerId: offer.id,
        offerName: offer.offerName || offer.name || 'Unknown Offer',
        message: `${offer.offerName || offer.name} expires in ${daysUntilExpiration} days. Consider booking soon.`,
        actionable: true,
        actionText: 'Find Cruises',
        daysUntilExpiration,
        offerValue,
        createdAt: now.toISOString(),
      });
    } else if (daysUntilExpiration <= 15) {
      alerts.push({
        id: `exp-medium-${offer.id}`,
        type: 'expiration',
        severity: 'medium',
        offerId: offer.id,
        offerName: offer.offerName || offer.name || 'Unknown Offer',
        message: `${offer.offerName || offer.name} expires in ${daysUntilExpiration} days.`,
        actionable: true,
        actionText: 'Browse Cruises',
        daysUntilExpiration,
        offerValue,
        createdAt: now.toISOString(),
      });
    } else if (daysUntilExpiration <= 30) {
      alerts.push({
        id: `exp-low-${offer.id}`,
        type: 'expiration',
        severity: 'low',
        offerId: offer.id,
        offerName: offer.offerName || offer.name || 'Unknown Offer',
        message: `${offer.offerName || offer.name} expires in ${daysUntilExpiration} days.`,
        actionable: false,
        daysUntilExpiration,
        offerValue,
        createdAt: now.toISOString(),
      });
    }
    
    // Auto-match offers to available cruises
    const matchedCruises = cruises
      .filter(cruise => {
        // Only match future cruises
        const sailDate = new Date(cruise.departureDate);
        if (sailDate < now) return false;
        
        // Don't match already booked cruises
        if (cruise.bookingId || cruise.reservationNumber) return false;
        
        // Check if cruise is within offer date range
        if (offer.offerStartDate && offer.offerEndDate) {
          const offerStart = new Date(offer.offerStartDate);
          const offerEnd = new Date(offer.offerEndDate);
          if (sailDate < offerStart || sailDate > offerEnd) return false;
        }
        
        // Check if ship matches
        if (offer.ships && offer.ships.length > 0) {
          if (!offer.ships.some(s => cruise.ship.toLowerCase().includes(s.toLowerCase()))) {
            return false;
          }
        }
        
        return true;
      })
      .map(cruise => {
        const sailDate = new Date(cruise.departureDate);
        let matchScore = 100;
        
        // Reduce score based on booking urgency
        const daysUntilSail = Math.ceil((sailDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
        if (daysUntilSail < 30) matchScore -= 20; // Last minute booking
        if (daysUntilSail > 365) matchScore -= 10; // Far future
        
        // Increase score if ship is in offer list
        if (offer.ships && offer.ships.some(s => cruise.ship.toLowerCase().includes(s.toLowerCase()))) {
          matchScore += 10;
        }
        
        return {
          cruiseId: cruise.id,
          ship: cruise.ship,
          sailDate: cruise.departureDate,
          matchScore,
        };
      })
      .sort((a, b) => b.matchScore - a.matchScore)
      .slice(0, 5);
    
    // Create match alert if we found good matches
    if (matchedCruises.length > 0 && daysUntilExpiration <= 30) {
      const bestMatch = matchedCruises[0];
      alerts.push({
        id: `match-${offer.id}`,
        type: 'match',
        severity: daysUntilExpiration <= 7 ? 'high' : 'medium',
        offerId: offer.id,
        offerName: offer.offerName || offer.name || 'Unknown Offer',
        message: `Found ${matchedCruises.length} cruise${matchedCruises.length > 1 ? 's' : ''} matching ${offer.offerName || offer.name}. Best match: ${bestMatch.ship} on ${new Date(bestMatch.sailDate).toLocaleDateString()}.`,
        actionable: true,
        actionText: 'View Matches',
        daysUntilExpiration,
        matchedCruises,
        offerValue,
        createdAt: now.toISOString(),
      });
    }
    
    // High-value offer alert
    if (offerValue >= 500 && daysUntilExpiration <= 30) {
      alerts.push({
        id: `high-value-${offer.id}`,
        type: 'high-value',
        severity: 'high',
        offerId: offer.id,
        offerName: offer.offerName || offer.name || 'Unknown Offer',
        message: `High-value offer: $${offerValue} - Don't let this expire unused!`,
        actionable: true,
        actionText: 'Book Now',
        daysUntilExpiration,
        offerValue,
        createdAt: now.toISOString(),
      });
    }
  });
  
  // Point balance + offer value alerts
  const totalOfferValue = offers.reduce((sum, offer) => {
    const value = parseFloat(offer.tradeInValue?.replace(/[^0-9.]/g, '') || '0');
    return sum + value;
  }, 0);
  
  if (currentPoints > 0 && totalOfferValue > 0) {
    const urgencyScore = Math.min(100, (totalOfferValue / 100));
    
    if (urgencyScore >= 50) {
      alerts.push({
        id: 'urgency-portfolio',
        type: 'urgency',
        severity: urgencyScore >= 80 ? 'critical' : 'high',
        offerId: 'portfolio',
        offerName: 'Offer Portfolio',
        message: `You have $${totalOfferValue.toLocaleString()} in offers and ${currentPoints.toLocaleString()} points. Optimize your bookings to maximize value!`,
        actionable: true,
        actionText: 'View Strategy',
        offerValue: totalOfferValue,
        pointBalance: currentPoints,
        createdAt: now.toISOString(),
      });
    }
  }
  
  // Sort alerts by severity and expiration
  const severityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
  alerts.sort((a, b) => {
    const severityDiff = severityOrder[a.severity] - severityOrder[b.severity];
    if (severityDiff !== 0) return severityDiff;
    
    if (a.daysUntilExpiration !== undefined && b.daysUntilExpiration !== undefined) {
      return a.daysUntilExpiration - b.daysUntilExpiration;
    }
    
    return 0;
  });
  
  return {
    alerts,
    summary: {
      total: alerts.length,
      critical: alerts.filter(a => a.severity === 'critical').length,
      high: alerts.filter(a => a.severity === 'high').length,
      medium: alerts.filter(a => a.severity === 'medium').length,
      low: alerts.filter(a => a.severity === 'low').length,
      expiringWithin7Days: alerts.filter(a => a.daysUntilExpiration !== undefined && a.daysUntilExpiration <= 7).length,
      matchableOffers: alerts.filter(a => a.type === 'match').length,
    },
    timestamp: now.toISOString(),
  };
});

export const offerMatchesProcedure = publicProcedure
  .input(z.object({
    offerId: z.string(),
  }))
  .query(({ input }) => {
    console.log('[tRPC] Finding matches for offer:', input.offerId);
    
    const offers = memoryStore.getCasinoOffers();
    const cruises = memoryStore.getCruises();
    const now = new Date();
    
    const offer = offers.find(o => o.id === input.offerId);
    if (!offer) {
      return { matches: [], offerDetails: null };
    }
    
    const matches = cruises
      .filter(cruise => {
        const sailDate = new Date(cruise.departureDate);
        if (sailDate < now) return false;
        if (cruise.bookingId || cruise.reservationNumber) return false;
        
        if (offer.offerStartDate && offer.offerEndDate) {
          const offerStart = new Date(offer.offerStartDate);
          const offerEnd = new Date(offer.offerEndDate);
          if (sailDate < offerStart || sailDate > offerEnd) return false;
        }
        
        if (offer.ships && offer.ships.length > 0) {
          if (!offer.ships.some(s => cruise.ship.toLowerCase().includes(s.toLowerCase()))) {
            return false;
          }
        }
        
        return true;
      })
      .map(cruise => {
        const sailDate = new Date(cruise.departureDate);
        let matchScore = 100;
        
        const daysUntilSail = Math.ceil((sailDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
        if (daysUntilSail < 30) matchScore -= 20;
        if (daysUntilSail > 365) matchScore -= 10;
        
        if (offer.ships && offer.ships.some(s => cruise.ship.toLowerCase().includes(s.toLowerCase()))) {
          matchScore += 10;
        }
        
        return {
          cruise,
          matchScore,
          daysUntilSail,
          reason: matchScore >= 100 ? 'Perfect match' : matchScore >= 90 ? 'Great match' : 'Good match',
        };
      })
      .sort((a, b) => b.matchScore - a.matchScore);
    
    return {
      matches,
      offerDetails: {
        id: offer.id,
        name: offer.offerName || offer.name,
        value: offer.tradeInValue,
        expires: offer.expires,
        ships: offer.ships,
      },
      timestamp: now.toISOString(),
    };
  });
