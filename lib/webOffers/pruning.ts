import { parseItinerary } from "./utils";

export interface Sailing {
  id?: string;
  shipCode: string;
  shipName: string;
  sailDate: string;
  itineraryDescription: string;
  roomCategory?: string;
  numberOfGuests?: string;
  tradeInValue?: string | number;
  onboardCredit?: string | number;
  freePlay?: string | number;
  discountedCruise?: string | boolean;
  freeCruise?: string | boolean;
  upgrades?: any;
  expirationDate?: string;
  [key: string]: any;
}

export interface Offer {
  offerCode: string;
  offerName: string;
  category?: string;
  sailings: Sailing[];
  [key: string]: any;
}

export interface ExcludedSailing {
  shipCode: string;
  sailDate: string;
}

export function pruneExcludedSailings(
  offers: Offer[],
  excludedSailings: ExcludedSailing[]
): Offer[] {
  console.log(
    "[pruning] Pruning excluded sailings, count:",
    excludedSailings.length
  );

  return offers.map((offer) => {
    const filteredSailings = offer.sailings.filter((sailing) => {
      const isExcluded = excludedSailings.some(
        (excluded) =>
          excluded.shipCode === sailing.shipCode &&
          excluded.sailDate === sailing.sailDate
      );
      return !isExcluded;
    });

    return {
      ...offer,
      sailings: filteredSailings,
    };
  });
}

export function pruneTierOffers(offers: Offer[]): Offer[] {
  console.log("[pruning] Pruning TIER offers (>7 nights)");

  return offers.map((offer) => {
    if (offer.category?.toUpperCase() !== "TIER") {
      return offer;
    }

    const filteredSailings = offer.sailings.filter((sailing) => {
      const { nights } = parseItinerary(sailing.itineraryDescription);
      return nights <= 7;
    });

    console.log(
      `[pruning] TIER offer ${offer.offerCode}: ${offer.sailings.length} -> ${filteredSailings.length} sailings`
    );

    return {
      ...offer,
      sailings: filteredSailings,
    };
  });
}

export function applyAllPruningRules(
  offers: Offer[],
  excludedSailings: ExcludedSailing[]
): Offer[] {
  let prunedOffers = pruneExcludedSailings(offers, excludedSailings);
  prunedOffers = pruneTierOffers(prunedOffers);

  const finalOffers = prunedOffers.filter(
    (offer) => offer.sailings.length > 0
  );

  console.log(
    `[pruning] After pruning: ${offers.length} -> ${finalOffers.length} offers with sailings`
  );

  return finalOffers;
}

export function findEmptyOffers(offers: Offer[]): Offer[] {
  return offers.filter(
    (offer) => !offer.sailings || offer.sailings.length === 0
  );
}

export function createSailingKey(sailing: Sailing): string {
  return `${sailing.shipCode}|${sailing.sailDate}`;
}

export function mergeSailings(
  existingSailings: Sailing[],
  newSailings: Sailing[]
): Sailing[] {
  const sailingMap = new Map<string, Sailing>();

  existingSailings.forEach((sailing) => {
    const key = createSailingKey(sailing);
    sailingMap.set(key, sailing);
  });

  newSailings.forEach((sailing) => {
    const key = createSailingKey(sailing);
    if (!sailingMap.has(key)) {
      sailingMap.set(key, sailing);
    }
  });

  return Array.from(sailingMap.values());
}
