import { z } from 'zod';
import { publicProcedure } from '../../../create-context';
import { memoryStore } from '../../_stores/memory';
import type { CasinoOffer, Cruise } from '@/types/models';

const getDaysUntilExpiration = (expiresDate: string): number => {
  const now = new Date();
  const expiry = new Date(expiresDate);
  const diffTime = expiry.getTime() - now.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  return diffDays;
};

const matchOfferToCruises = (offer: CasinoOffer, cruises: Cruise[]): Cruise[] => {
  const matchedCruises: Cruise[] = [];
  
  cruises.forEach(cruise => {
    let isMatch = false;
    
    if (offer.ships && offer.ships.length > 0) {
      isMatch = offer.ships.some(ship => 
        cruise.ship.toLowerCase().includes(ship.toLowerCase()) ||
        ship.toLowerCase().includes(cruise.ship.toLowerCase())
      );
    }
    
    if (!isMatch && offer.sailingDates && offer.sailingDates.length > 0) {
      isMatch = offer.sailingDates.some(sailDate => {
        const offerDate = new Date(sailDate);
        const cruiseDate = new Date(cruise.departureDate);
        return offerDate.toDateString() === cruiseDate.toDateString();
      });
    }
    
    if (!isMatch && offer.offerStartDate && offer.offerEndDate) {
      const cruiseDate = new Date(cruise.departureDate);
      const startDate = new Date(offer.offerStartDate);
      const endDate = new Date(offer.offerEndDate);
      isMatch = cruiseDate >= startDate && cruiseDate <= endDate;
    }
    
    if (isMatch) {
      matchedCruises.push(cruise);
    }
  });
  
  return matchedCruises;
};

const calculateOfferValue = (offer: CasinoOffer): number => {
  const tradeInStr = offer.tradeInValue || '$0';
  const value = parseFloat(tradeInStr.replace(/[$,]/g, ''));
  return isNaN(value) ? 0 : value;
};

const assessBookingUrgency = (
  offer: CasinoOffer,
  matchedCruises: Cruise[],
  userPoints: number
): { level: 'critical' | 'high' | 'medium' | 'low'; reason: string } => {
  const daysLeft = getDaysUntilExpiration(offer.expires);
  const offerValue = calculateOfferValue(offer);
  const hasMatchingCruises = matchedCruises.length > 0;
  
  if (daysLeft <= 3 && offerValue >= 300 && hasMatchingCruises) {
    return { level: 'critical', reason: 'High-value offer expires in 3 days with matching cruises!' };
  }
  
  if (daysLeft <= 7 && offerValue >= 250 && hasMatchingCruises) {
    return { level: 'high', reason: 'Valuable offer expires within a week' };
  }
  
  if (daysLeft <= 15 && offerValue >= 200 && hasMatchingCruises) {
    return { level: 'medium', reason: 'Good offer expires soon' };
  }
  
  if (daysLeft <= 30 && hasMatchingCruises) {
    return { level: 'low', reason: 'Offer expires within 30 days' };
  }
  
  return { level: 'low', reason: 'Standard expiration timeline' };
};

export const getExpiringOffersProcedure = publicProcedure
  .input(z.object({
    daysThreshold: z.number().default(30),
    includeMatching: z.boolean().default(true)
  }))
  .query(({ input }) => {
    console.log('[Intelligence] Getting expiring offers with threshold:', input.daysThreshold);
    
    const offers = memoryStore.getCasinoOffers();
    const cruises = memoryStore.getCruises();
    const userProfile = memoryStore.getUserProfile();
    const userPoints = userProfile?.points || 0;
    
    const now = new Date();
    
    const expiringOffers = offers
      .filter(offer => {
        const expiryDate = new Date(offer.expires);
        return expiryDate > now;
      })
      .map(offer => {
        const daysLeft = getDaysUntilExpiration(offer.expires);
        const isExpiringSoon = daysLeft <= input.daysThreshold;
        const matchedCruises = input.includeMatching ? matchOfferToCruises(offer, cruises) : [];
        const offerValue = calculateOfferValue(offer);
        const urgency = assessBookingUrgency(offer, matchedCruises, userPoints);
        
        return {
          offer,
          daysLeft,
          isExpiringSoon,
          matchedCruises: matchedCruises.map(cruise => ({
            id: cruise.id,
            ship: cruise.ship,
            itineraryName: cruise.itineraryName,
            departureDate: cruise.departureDate,
            nights: cruise.nights,
            cabinType: cruise.cabinType
          })),
          matchCount: matchedCruises.length,
          offerValue,
          urgency,
          hasPointBalance: userPoints > 0,
          worthBooking: urgency.level === 'critical' || urgency.level === 'high'
        };
      })
      .filter(item => item.isExpiringSoon)
      .sort((a, b) => a.daysLeft - b.daysLeft);
    
    const summary = {
      total: expiringOffers.length,
      critical: expiringOffers.filter(o => o.urgency.level === 'critical').length,
      high: expiringOffers.filter(o => o.urgency.level === 'high').length,
      medium: expiringOffers.filter(o => o.urgency.level === 'medium').length,
      low: expiringOffers.filter(o => o.urgency.level === 'low').length,
      totalValue: expiringOffers.reduce((sum, o) => sum + o.offerValue, 0),
      totalMatches: expiringOffers.reduce((sum, o) => sum + o.matchCount, 0)
    };
    
    console.log('[Intelligence] Found expiring offers:', summary);
    
    return {
      offers: expiringOffers,
      summary,
      timestamp: new Date().toISOString()
    };
  });

export const autoMatchOffersProcedure = publicProcedure
  .input(z.object({
    offerId: z.string().optional(),
    minValue: z.number().default(0)
  }))
  .query(({ input }) => {
    console.log('[Intelligence] Auto-matching offers:', input);
    
    const offers = input.offerId 
      ? [memoryStore.getCasinoOffers().find(o => o.id === input.offerId)].filter(Boolean) as CasinoOffer[]
      : memoryStore.getCasinoOffers();
    const cruises = memoryStore.getCruises();
    const bookedCruises = memoryStore.getBookedCruises();
    const userProfile = memoryStore.getUserProfile();
    const userPoints = userProfile?.points || 0;
    
    const bookedCruiseIds = new Set(bookedCruises.map(bc => bc.cruiseId || bc.id));
    
    const availableCruises = cruises.filter(cruise => !bookedCruiseIds.has(cruise.id));
    
    const matches = offers
      .map(offer => {
        const offerValue = calculateOfferValue(offer);
        if (offerValue < input.minValue) return null;
        
        const matchedCruises = matchOfferToCruises(offer, availableCruises);
        const daysLeft = getDaysUntilExpiration(offer.expires);
        const urgency = assessBookingUrgency(offer, matchedCruises, userPoints);
        
        const bestMatch = matchedCruises.length > 0 
          ? matchedCruises.sort((a, b) => {
              const aPrice = a.balconyPrice || a.oceanviewPrice || a.interiorPrice || 0;
              const bPrice = b.balconyPrice || b.oceanviewPrice || b.interiorPrice || 0;
              const aValue = offerValue / Math.max(aPrice, 1);
              const bValue = offerValue / Math.max(bPrice, 1);
              return bValue - aValue;
            })[0]
          : null;
        
        return {
          offer: {
            id: offer.id,
            name: offer.offerName,
            code: offer.offerCode,
            type: offer.offerType,
            expires: offer.expires,
            value: offerValue
          },
          matches: matchedCruises.map(cruise => ({
            id: cruise.id,
            ship: cruise.ship,
            itineraryName: cruise.itineraryName,
            departureDate: cruise.departureDate,
            nights: cruise.nights,
            estimatedPrice: cruise.balconyPrice || cruise.oceanviewPrice || cruise.interiorPrice || 0,
            savingsPercentage: cruise.balconyPrice 
              ? (offerValue / cruise.balconyPrice) * 100 
              : 0
          })),
          bestMatch: bestMatch ? {
            id: bestMatch.id,
            ship: bestMatch.ship,
            itineraryName: bestMatch.itineraryName,
            departureDate: bestMatch.departureDate,
            estimatedPrice: bestMatch.balconyPrice || bestMatch.oceanviewPrice || bestMatch.interiorPrice || 0,
            savingsWithOffer: offerValue
          } : null,
          daysLeft,
          urgency,
          recommendation: matchedCruises.length > 0 
            ? `Found ${matchedCruises.length} matching cruise${matchedCruises.length > 1 ? 's' : ''}. ${urgency.reason}`
            : 'No matching cruises found for this offer window.'
        };
      })
      .filter((m): m is NonNullable<typeof m> => m !== null)
      .sort((a, b) => {
        const urgencyOrder = { critical: 4, high: 3, medium: 2, low: 1 };
        return urgencyOrder[b.urgency.level] - urgencyOrder[a.urgency.level];
      });
    
    const summary = {
      totalOffers: matches.length,
      offersWithMatches: matches.filter(m => m.matches.length > 0).length,
      totalMatches: matches.reduce((sum, m) => sum + m.matches.length, 0),
      criticalAlerts: matches.filter(m => m.urgency.level === 'critical').length,
      totalValue: matches.reduce((sum, m) => sum + m.offer.value, 0)
    };
    
    console.log('[Intelligence] Auto-match summary:', summary);
    
    return {
      matches,
      summary,
      timestamp: new Date().toISOString()
    };
  });
