import type { CasinoOffer, Cruise } from '@/types/models';

export interface OfferValueCalculationInput {
  offer: CasinoOffer;
  cruise?: Cruise;
}

export interface OfferValueCalculationResult {
  offerId: string;
  offerCode: string;
  offerName: string;
  cruiseId?: string;
  
  normalizedCabinType: 'INTERIOR' | 'OCEANVIEW' | 'BALCONY' | 'SUITE' | null;
  perPersonPrice: number | null;
  baseCabinPriceForTwo: number | null;
  compedShares: number | null;
  coverageFraction: number | null;
  compValue: number | null;
  
  calculationMethod: 'offer_embedded' | 'cruise_pricing' | 'unavailable';
  calculatedAt: string;
}

export function calculateOfferValue(input: OfferValueCalculationInput): OfferValueCalculationResult {
  const { offer, cruise } = input;
  
  const result: OfferValueCalculationResult = {
    offerId: offer.id,
    offerCode: offer.offerCode,
    offerName: offer.offerName,
    cruiseId: cruise?.id,
    normalizedCabinType: null,
    perPersonPrice: null,
    baseCabinPriceForTwo: null,
    compedShares: null,
    coverageFraction: null,
    compValue: null,
    calculationMethod: 'unavailable',
    calculatedAt: new Date().toISOString(),
  };
  
  if (offer.compValue !== null && offer.compValue !== undefined && offer.compValue > 0) {
    result.normalizedCabinType = offer.normalizedCabinType || null;
    result.perPersonPrice = offer.perPersonPrice || null;
    result.baseCabinPriceForTwo = offer.baseCabinPriceForTwo || null;
    result.compedShares = offer.compedShares || null;
    result.coverageFraction = offer.coverageFraction || null;
    result.compValue = offer.compValue;
    result.calculationMethod = 'offer_embedded';
    return result;
  }
  
  if (!cruise) {
    return result;
  }
  
  const normalizedCabinType = normalizeCabinType(offer.roomType || cruise.cabinType || '');
  if (!normalizedCabinType) {
    return result;
  }
  
  result.normalizedCabinType = normalizedCabinType;
  
  let perPersonPrice: number | null = null;
  
  if (normalizedCabinType === 'INTERIOR') {
    perPersonPrice = offer.priceInterior || cruise.interiorPrice || cruise.pricing?.interior || null;
  } else if (normalizedCabinType === 'OCEANVIEW') {
    perPersonPrice = offer.priceOceanView || cruise.oceanviewPrice || cruise.pricing?.oceanview || null;
  } else if (normalizedCabinType === 'BALCONY') {
    perPersonPrice = offer.priceBalcony || cruise.balconyPrice || cruise.pricing?.balcony || null;
  } else if (normalizedCabinType === 'SUITE') {
    perPersonPrice = offer.priceSuite || cruise.suitePrice || cruise.pricing?.suite || null;
  }
  
  if (!perPersonPrice || perPersonPrice <= 0) {
    return result;
  }
  
  result.perPersonPrice = perPersonPrice;
  result.baseCabinPriceForTwo = perPersonPrice * 2;
  
  const compedShares = calculateCompedShares(offer);
  result.compedShares = compedShares;
  result.coverageFraction = compedShares / 2.0;
  result.compValue = result.baseCabinPriceForTwo * result.coverageFraction;
  result.calculationMethod = 'cruise_pricing';
  
  return result;
}

function normalizeCabinType(cabinType: string): 'INTERIOR' | 'OCEANVIEW' | 'BALCONY' | 'SUITE' | null {
  const upper = cabinType.toUpperCase();
  
  if (upper.includes('INTERIOR') || upper.includes('INSIDE')) {
    return 'INTERIOR';
  } else if (upper.includes('OCEAN VIEW') || upper.includes('OCEANVIEW')) {
    return 'OCEANVIEW';
  } else if (upper.includes('BALCONY')) {
    return 'BALCONY';
  } else if (upper.includes('SUITE')) {
    return 'SUITE';
  }
  
  return null;
}

function calculateCompedShares(offer: CasinoOffer): number {
  const offerTypeCat = (offer.offerTypeCategory || offer.offerType || '').toLowerCase();
  const offerCodeStr = offer.offerCode.trim();
  
  if (offerCodeStr === '2511A06' || offerCodeStr === '25NOV106') {
    return 1.5;
  }
  
  if (offerTypeCat.includes('room for two') || 
      offerTypeCat.includes('stateroom for 2') ||
      offerTypeCat.includes('cabin for two')) {
    return 2.0;
  }
  
  if (offerTypeCat.includes('guest pays full') || offerTypeCat.includes('full fare for guest')) {
    return 1.0;
  }
  
  if (offerTypeCat.includes('25% off') || offerTypeCat.includes('25% discount')) {
    return 1.25;
  }
  
  if (offerTypeCat.includes('50% off') || offerTypeCat.includes('half off') || offerTypeCat.includes('50% discount')) {
    return 1.5;
  }
  
  if (offerTypeCat.includes('75% off') || offerTypeCat.includes('75% discount')) {
    return 1.75;
  }
  
  return 2.0;
}
