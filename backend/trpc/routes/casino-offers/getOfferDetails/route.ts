import { z } from 'zod';
import { publicProcedure } from '../../../create-context';
import { memoryStore } from '../../_stores/memory';
import { calculateOfferValue } from '../calculateOfferValue';

export interface SailingDetails {
  ship: string;
  sailingDate: string;
  itinerary: string;
  roomType: string;
  compValue: number;
  perPersonPrice: number | null;
  compedShares: number | null;
  coverageFraction: number | null;
}

export interface OfferDetailsResult {
  offerCode: string;
  offerName: string;
  offerType: string;
  expires: string;
  
  numSailings: number;
  totalCompValue: number;
  avgCompValuePerSailing: number;
  minSailingValue: number;
  maxSailingValue: number;
  
  sailings: SailingDetails[];
  
  ranking: {
    overallRank: number;
    jackpotRank: number;
    totalOffersCompared: number;
  };
  
  specialNotes?: string[];
  
  generatedAt: string;
}

export const getOfferDetailsProcedure = publicProcedure
  .input(z.object({
    offerCode: z.string(),
  }))
  .query(({ input }): OfferDetailsResult | null => {
    console.log('[tRPC] Getting offer details for:', input.offerCode);
    
    const allOffers = memoryStore.getCasinoOffers();
    const allCruises = memoryStore.getCruises();
    
    const matchingOffers = allOffers.filter(o => o.offerCode === input.offerCode);
    if (matchingOffers.length === 0) {
      console.error('[tRPC] Offer not found:', input.offerCode);
      return null;
    }
    
    const firstOffer = matchingOffers[0];
    
    const sailings: SailingDetails[] = [];
    
    for (const offer of matchingOffers) {
      const linkedCruise = allCruises.find(c => 
        c.offerCode === offer.offerCode || 
        c.offerCodes?.includes(offer.offerCode) ||
        (c.ship === offer.shipName && c.departureDate === offer.sailingDate)
      );
      
      const valueResult = calculateOfferValue({ offer, cruise: linkedCruise });
      
      if (!valueResult.compValue || valueResult.compValue <= 0) {
        continue;
      }
      
      sailings.push({
        ship: offer.shipName || linkedCruise?.ship || 'Unknown',
        sailingDate: offer.sailingDate || linkedCruise?.departureDate || 'Unknown',
        itinerary: offer.itinerary || linkedCruise?.itineraryName || 'Unknown',
        roomType: offer.roomType || linkedCruise?.cabinType || 'Unknown',
        compValue: Math.round(valueResult.compValue * 100) / 100,
        perPersonPrice: valueResult.perPersonPrice,
        compedShares: valueResult.compedShares,
        coverageFraction: valueResult.coverageFraction,
      });
    }
    
    if (sailings.length === 0) {
      console.warn('[tRPC] No valid sailings found for offer:', input.offerCode);
      return null;
    }
    
    const totalCompValue = sailings.reduce((sum, s) => sum + s.compValue, 0);
    const avgCompValuePerSailing = totalCompValue / sailings.length;
    const minSailingValue = Math.min(...sailings.map(s => s.compValue));
    const maxSailingValue = Math.max(...sailings.map(s => s.compValue));
    
    const offerGroups = new Map<string, number>();
    for (const offer of allOffers) {
      const linkedCruise = allCruises.find(c => 
        c.offerCode === offer.offerCode || 
        c.offerCodes?.includes(offer.offerCode) ||
        (c.ship === offer.shipName && c.departureDate === offer.sailingDate)
      );
      const valueResult = calculateOfferValue({ offer, cruise: linkedCruise });
      if (valueResult.compValue && valueResult.compValue > 0) {
        const code = offer.offerCode;
        if (!offerGroups.has(code)) {
          offerGroups.set(code, 0);
        }
        offerGroups.set(code, offerGroups.get(code)! + valueResult.compValue);
      }
    }
    
    const sortedByTotal = Array.from(offerGroups.entries())
      .sort((a, b) => b[1] - a[1]);
    const overallRank = sortedByTotal.findIndex(([code]) => code === input.offerCode) + 1;
    
    const offerMaxValues = new Map<string, number>();
    for (const offer of allOffers) {
      const linkedCruise = allCruises.find(c => 
        c.offerCode === offer.offerCode || 
        c.offerCodes?.includes(offer.offerCode) ||
        (c.ship === offer.shipName && c.departureDate === offer.sailingDate)
      );
      const valueResult = calculateOfferValue({ offer, cruise: linkedCruise });
      if (valueResult.compValue && valueResult.compValue > 0) {
        const code = offer.offerCode;
        const currentMax = offerMaxValues.get(code) || 0;
        if (valueResult.compValue > currentMax) {
          offerMaxValues.set(code, valueResult.compValue);
        }
      }
    }
    
    const sortedByMax = Array.from(offerMaxValues.entries())
      .sort((a, b) => b[1] - a[1]);
    const jackpotRank = sortedByMax.findIndex(([code]) => code === input.offerCode) + 1;
    
    const specialNotes: string[] = [];
    if (input.offerCode === '2511A06' || input.offerCode === '25NOV106') {
      specialNotes.push('Special offer: Guest 1 fully comped + Guest 2 at 50% discount (75% total coverage)');
    }
    
    const avgCoveragePercent = sailings.length > 0 
      ? Math.round((sailings.reduce((sum, s) => sum + (s.coverageFraction || 0), 0) / sailings.length) * 100)
      : 0;
    
    if (avgCoveragePercent === 100) {
      specialNotes.push('Full room for two coverage (100%)');
    } else if (avgCoveragePercent < 100) {
      specialNotes.push(`Partial coverage: ${avgCoveragePercent}% of two-guest fare`);
    }
    
    console.log('[tRPC] Offer details calculated:', {
      offerCode: input.offerCode,
      numSailings: sailings.length,
      totalCompValue: Math.round(totalCompValue * 100) / 100,
      overallRank,
      jackpotRank,
    });
    
    return {
      offerCode: firstOffer.offerCode,
      offerName: firstOffer.offerName,
      offerType: firstOffer.offerType,
      expires: firstOffer.expires,
      numSailings: sailings.length,
      totalCompValue: Math.round(totalCompValue * 100) / 100,
      avgCompValuePerSailing: Math.round(avgCompValuePerSailing * 100) / 100,
      minSailingValue: Math.round(minSailingValue * 100) / 100,
      maxSailingValue: Math.round(maxSailingValue * 100) / 100,
      sailings: sailings.sort((a, b) => b.compValue - a.compValue),
      ranking: {
        overallRank: overallRank || 0,
        jackpotRank: jackpotRank || 0,
        totalOffersCompared: offerGroups.size,
      },
      specialNotes: specialNotes.length > 0 ? specialNotes : undefined,
      generatedAt: new Date().toISOString(),
    };
  });
