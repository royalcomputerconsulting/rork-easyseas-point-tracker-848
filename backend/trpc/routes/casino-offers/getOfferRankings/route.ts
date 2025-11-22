import { publicProcedure } from '../../../create-context';
import { memoryStore } from '../../_stores/memory';
import { calculateOfferValue } from '../calculateOfferValue';
import type { CasinoOffer, Cruise } from '@/types/models';

export interface SampleCruise {
  shipName: string;
  sailingDate: string;
  normalizedCabinType: string;
  compValue: number;
}

export interface OfferRanking {
  offerCode: string;
  offerName: string;
  numSailings: number;
  totalCompValue: number;
  avgCompValue: number;
  maxSailingValue: number;
  earliestExpiry: string;
  sampleCruises: SampleCruise[];
  maxSailingDetails?: {
    ship: string;
    sailingDate: string;
    roomType: string;
    itinerary: string;
  };
}

export interface OfferRankingsResult {
  overallStrength: OfferRanking[];
  singleSailingJackpot: OfferRanking[];
  totalOffers: number;
  totalSailings: number;
  generatedAt: string;
}

type NormalizedCabinType = 'INTERIOR' | 'OCEANVIEW' | 'BALCONY' | 'SUITE';

type CabinPriceRecord = Partial<Record<'interior' | 'oceanview' | 'balcony' | 'suite', number | null | undefined>>;

const normalizeCabinTypeLoose = (value?: string | null): NormalizedCabinType | null => {
  if (!value) return null;
  const upper = value.toUpperCase();
  if (upper.includes('SUITE')) return 'SUITE';
  if (upper.includes('BALCONY')) return 'BALCONY';
  if (upper.includes('OCEANVIEW') || upper.includes('OCEAN VIEW')) return 'OCEANVIEW';
  if (upper.includes('INTERIOR') || upper.includes('INSIDE')) return 'INTERIOR';
  return null;
};

const extractCurrencyValue = (input: unknown, allowPlain: boolean = false): number | null => {
  if (typeof input === 'number') {
    return Number.isFinite(input) && input > 0 ? input : null;
  }
  if (typeof input !== 'string') return null;
  const trimmed = input.trim();
  const hasHint = /\$|usd|trade|off|discount|value|credit|comp|save/i.test(trimmed);
  if (!hasHint && !allowPlain) {
    return null;
  }
  const match = trimmed.match(/-?\d[\d,]*(?:\.\d+)?/);
  if (!match) return null;
  const parsed = Number.parseFloat(match[0].replace(/,/g, ''));
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
};

const getPriceFromRecord = (
  record: CabinPriceRecord | undefined,
  cabinType: NormalizedCabinType | null,
): number | null => {
  if (!record || !cabinType) return null;
  const key = cabinType.toLowerCase() as keyof CabinPriceRecord;
  const value = record[key];
  return typeof value === 'number' && value > 0 ? value : null;
};

const derivePerPersonPriceFromCruise = (cruise: Cruise | undefined, cabinType: NormalizedCabinType | null): number | null => {
  if (!cruise) return null;
  const targetCabin = cabinType ?? normalizeCabinTypeLoose(cruise.cabinType);
  const candidates: Array<number | null> = [];

  if (targetCabin) {
    switch (targetCabin) {
      case 'INTERIOR':
        candidates.push(typeof cruise.interiorPrice === 'number' ? cruise.interiorPrice : null);
        break;
      case 'OCEANVIEW':
        candidates.push(typeof cruise.oceanviewPrice === 'number' ? cruise.oceanviewPrice : null);
        break;
      case 'BALCONY':
        candidates.push(typeof cruise.balconyPrice === 'number' ? cruise.balconyPrice : null);
        break;
      case 'SUITE':
        candidates.push(typeof cruise.suitePrice === 'number' ? cruise.suitePrice : null);
        break;
    }
  }

  candidates.push(getPriceFromRecord(cruise.pricing as CabinPriceRecord | undefined, targetCabin));
  candidates.push(getPriceFromRecord(cruise.pricingCurrent as CabinPriceRecord | undefined, targetCabin));
  candidates.push(getPriceFromRecord(cruise.pricingLowest as CabinPriceRecord | undefined, targetCabin));

  const valid = candidates.find((value): value is number => typeof value === 'number' && value > 0);
  return valid ?? null;
};

const estimateCompedSharesFromOffer = (offer: CasinoOffer): number => {
  const offerTypeCat = (offer.offerTypeCategory || offer.offerType || '').toLowerCase();
  const offerCode = (offer.offerCode || '').trim();
  if (offerCode === '2511A06' || offerCode === '25NOV106') {
    return 1.5;
  }
  if (
    offerTypeCat.includes('room for two') ||
    offerTypeCat.includes('stateroom for 2') ||
    offerTypeCat.includes('cabin for two') ||
    offerTypeCat.includes('balcony room for two') ||
    offerTypeCat.includes('ocean view or interior room for two')
  ) {
    return 2.0;
  }
  if (offerTypeCat.includes('guest pays full') || offerTypeCat.includes('full fare for guest')) {
    return 1.0;
  }
  if (offerTypeCat.includes('75% off') || offerTypeCat.includes('75% discount')) {
    return 1.75;
  }
  if (
    offerTypeCat.includes('50% off') ||
    offerTypeCat.includes('half off') ||
    offerTypeCat.includes('50% discount')
  ) {
    return 1.5;
  }
  if (offerTypeCat.includes('25% off') || offerTypeCat.includes('25% discount')) {
    return 1.25;
  }
  return 2.0;
};

interface ResolvedOfferValue {
  compValue: number;
  perPersonPrice: number | null;
  baseCabinPrice: number | null;
  coverageFraction: number | null;
  compedShares: number | null;
  normalizedCabinType: NormalizedCabinType | null;
  valueSource: 'offer' | 'cruise-pricing' | 'trade-in' | 'offer-name' | 'fallback';
}

const resolveOfferValue = ({ offer, cruise }: { offer: CasinoOffer; cruise?: Cruise }): ResolvedOfferValue => {
  const normalizedCabinType = normalizeCabinTypeLoose(
    offer.normalizedCabinType || offer.roomType || cruise?.cabinType || null,
  );
  const explicitPerPerson = typeof offer.perPersonPrice === 'number' && offer.perPersonPrice > 0 ? offer.perPersonPrice : null;
  const derivedPerPersonFromBase = typeof offer.baseCabinPrice === 'number' && offer.baseCabinPrice > 0
    ? offer.baseCabinPrice / 2
    : null;
  const cruisePerPerson = explicitPerPerson ? null : derivePerPersonPriceFromCruise(cruise, normalizedCabinType);
  const perPersonPrice = explicitPerPerson ?? derivedPerPersonFromBase ?? cruisePerPerson ?? null;

  const baseCabinPrice = typeof offer.baseCabinPrice === 'number' && offer.baseCabinPrice > 0
    ? offer.baseCabinPrice
    : perPersonPrice
      ? perPersonPrice * 2
      : cruisePerPerson
        ? cruisePerPerson * 2
        : extractCurrencyValue(cruise?.value, true);

  let compedShares = typeof offer.compedShares === 'number' && offer.compedShares > 0
    ? offer.compedShares
    : estimateCompedSharesFromOffer(offer);

  let coverageFraction = typeof offer.coverageFraction === 'number' && offer.coverageFraction > 0
    ? offer.coverageFraction
    : compedShares
      ? compedShares / 2
      : null;

  let compValue = typeof offer.compValue === 'number' && offer.compValue > 0
    ? offer.compValue
    : baseCabinPrice && coverageFraction
      ? baseCabinPrice * coverageFraction
      : null;

  let valueSource: ResolvedOfferValue['valueSource'] = compValue ? 'offer' : 'fallback';

  if ((!compValue || compValue <= 0) && cruise) {
    const cruiseRetail = extractCurrencyValue(cruise.value, true)
      ?? (typeof cruise.currentMarketPrice === 'number' && cruise.currentMarketPrice > 0 ? cruise.currentMarketPrice : null)
      ?? (typeof cruise.actualFare === 'number' && cruise.actualFare > 0 ? cruise.actualFare : null);
    if (cruiseRetail && coverageFraction) {
      compValue = cruiseRetail * coverageFraction;
      valueSource = 'cruise-pricing';
    }
  }

  if ((!compValue || compValue <= 0)) {
    const tradeInValue = extractCurrencyValue(offer.tradeInValue);
    if (tradeInValue) {
      compValue = tradeInValue;
      valueSource = 'trade-in';
      if (!coverageFraction && compedShares) {
        coverageFraction = compedShares / 2;
      }
    }
  }

  if ((!compValue || compValue <= 0)) {
    const offerNameValue = extractCurrencyValue(offer.offerName);
    if (offerNameValue) {
      compValue = offerNameValue;
      valueSource = 'offer-name';
      if (!coverageFraction && compedShares) {
        coverageFraction = compedShares / 2;
      }
    }
  }

  if (!compValue || compValue <= 0) {
    compValue = 0;
    valueSource = 'fallback';
  }

  return {
    compValue,
    perPersonPrice,
    baseCabinPrice: baseCabinPrice ?? null,
    coverageFraction,
    compedShares,
    normalizedCabinType,
    valueSource,
  };
};

export const getOfferRankingsProcedure = publicProcedure.query((): OfferRankingsResult => {
  console.log('[tRPC] Calculating offer rankings');

  const allOffers = memoryStore.getCasinoOffers();
  const allCruises = memoryStore.getCruises();

  const offerMap = new Map<string, {
    offerCode: string;
    offerName: string;
    expiryDate: string | null;
    sailings: Array<{
      compValue: number;
      ship: string;
      sailingDate: string;
      roomType: string;
      normalizedCabinType: string;
      itinerary: string;
    }>;
  }>();

  let offersWithValue = 0;
  let sailingsConsidered = 0;

  const ensureOfferEntry = (offer: CasinoOffer) => {
    const offerCode = offer.offerCode;
    if (!offerMap.has(offerCode)) {
      const expiryCandidate = offer.expires || offer.offerExpiryDate || offer.offerEndDate || null;
      offerMap.set(offerCode, {
        offerCode,
        offerName: offer.offerName || offer.name || offerCode,
        expiryDate: expiryCandidate,
        sailings: [],
      });
    }
    return offerMap.get(offerCode)!;
  };

  allOffers.forEach((offer) => {
    if (!offer.offerCode) {
      return;
    }

    const normalizedOfferCode = offer.offerCode.trim();
    const matchingCruises = allCruises.filter((cruise) => (
      cruise.offerCode === normalizedOfferCode ||
      cruise.offerCodes?.includes(normalizedOfferCode) ||
      (!!offer.shipName && !!offer.sailingDate && cruise.ship === offer.shipName && cruise.departureDate === offer.sailingDate)
    ));

    if (matchingCruises.length === 0) {
      const resolved = resolveOfferValue({ offer });
      if (resolved.compValue <= 0) {
        console.log('[OfferRankings] Skipping offer (no data to calculate value)', offer.offerCode);
        return;
      }
      const entry = ensureOfferEntry(offer);
      const normalizedCabin = resolved.normalizedCabinType ?? 'INTERIOR';
      const sailingDate = offer.sailingDate || offer.expires || new Date().toISOString().split('T')[0];
      entry.sailings.push({
        compValue: resolved.compValue,
        ship: offer.shipName || 'Multiple Ships',
        sailingDate,
        roomType: offer.roomType || normalizedCabin,
        normalizedCabinType: normalizedCabin,
        itinerary: offer.itinerary || 'Multiple Itineraries',
      });
      if (offer.expires && (!entry.expiryDate || offer.expires < entry.expiryDate)) {
        entry.expiryDate = offer.expires;
      }
      offersWithValue += 1;
      sailingsConsidered += 1;
      console.log('[OfferRankings] Added fallback-only offer', {
        offerCode: offer.offerCode,
        compValue: resolved.compValue,
        source: resolved.valueSource,
      });
      return;
    }

    let addedForOffer = false;

    matchingCruises.forEach((cruise) => {
      const valueResult = calculateOfferValue({ offer, cruise });
      let compValue = valueResult.compValue ?? 0;
      let normalizedCabin = valueResult.normalizedCabinType ?? null;

      if (compValue <= 0) {
        const resolved = resolveOfferValue({ offer, cruise });
        compValue = resolved.compValue;
        normalizedCabin = resolved.normalizedCabinType ?? normalizedCabin;
        if (compValue > 0) {
          console.log('[OfferRankings] Applied fallback value', {
            offerCode: offer.offerCode,
            ship: cruise.ship,
            compValue,
            source: resolved.valueSource,
          });
        }
      }

      if (compValue <= 0) {
        return;
      }

      const entry = ensureOfferEntry(offer);
      const roomType = offer.roomType || cruise.cabinType || normalizedCabin || 'Unknown';
      const normalizedCabinFinal = normalizedCabin ?? normalizeCabinTypeLoose(roomType) ?? 'INTERIOR';

      entry.sailings.push({
        compValue,
        ship: cruise.ship || offer.shipName || 'Unknown',
        sailingDate: cruise.departureDate || offer.sailingDate || 'Unknown',
        roomType,
        normalizedCabinType: normalizedCabinFinal,
        itinerary: cruise.itineraryName || offer.itinerary || cruise.portsRoute || 'Unknown',
      });

      const expiryCandidate = offer.expires || offer.offerExpiryDate || offer.offerEndDate || cruise.offerExpirationDate || null;
      if (expiryCandidate && (!entry.expiryDate || expiryCandidate < entry.expiryDate)) {
        entry.expiryDate = expiryCandidate;
      }

      sailingsConsidered += 1;
      addedForOffer = true;
    });

    if (addedForOffer) {
      offersWithValue += 1;
    } else {
      console.log('[OfferRankings] Offer had matching cruises but no calculable value', offer.offerCode);
    }
  });

  const rankings: OfferRanking[] = [];

  for (const [, offerData] of offerMap) {
    if (offerData.sailings.length === 0) continue;

    const totalCompValue = offerData.sailings.reduce((sum, s) => sum + s.compValue, 0);
    const avgCompValue = totalCompValue / offerData.sailings.length;

    const maxSailing = offerData.sailings.reduce((max, s) => (
      s.compValue > max.compValue ? s : max
    ), offerData.sailings[0]);

    const sampleCruises: SampleCruise[] = [...offerData.sailings]
      .sort((a, b) => b.compValue - a.compValue)
      .slice(0, 3)
      .map((s) => ({
        shipName: s.ship,
        sailingDate: s.sailingDate,
        normalizedCabinType: s.normalizedCabinType,
        compValue: Math.round(s.compValue * 100) / 100,
      }));

    const earliestExpiry = offerData.expiryDate || new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString();

    rankings.push({
      offerCode: offerData.offerCode,
      offerName: offerData.offerName,
      numSailings: offerData.sailings.length,
      totalCompValue: Math.round(totalCompValue * 100) / 100,
      avgCompValue: Math.round(avgCompValue * 100) / 100,
      maxSailingValue: Math.round(maxSailing.compValue * 100) / 100,
      earliestExpiry,
      sampleCruises,
      maxSailingDetails: {
        ship: maxSailing.ship,
        sailingDate: maxSailing.sailingDate,
        roomType: maxSailing.roomType,
        itinerary: maxSailing.itinerary,
      },
    });
  }

  const overallStrength = [...rankings]
    .sort((a, b) => b.totalCompValue - a.totalCompValue)
    .slice(0, 10);
  const singleSailingJackpot = [...rankings]
    .sort((a, b) => b.maxSailingValue - a.maxSailingValue)
    .slice(0, 10);

  const totalSailings = rankings.reduce((sum, r) => sum + r.numSailings, 0);

  console.log('[tRPC] Rankings calculated summary', {
    offersFetched: allOffers.length,
    cruisesFetched: allCruises.length,
    offersWithValue,
    sailingsConsidered,
    totalOffers: rankings.length,
    totalSailings,
  });

  return {
    overallStrength,
    singleSailingJackpot,
    totalOffers: rankings.length,
    totalSailings,
    generatedAt: new Date().toISOString(),
  };
});
