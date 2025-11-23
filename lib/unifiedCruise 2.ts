import { UnifiedCruise, Cruise, BookedCruise, CruisePointsHistory } from '@/types/models';
import { createDateFromString } from '@/lib/date';

function toIsoOrNull(input: unknown): string | null {
  if (input === null || input === undefined) return null;
  if (typeof input === 'number') {
    const excelEpoch = new Date(1900, 0, 1).getTime();
    const ms = excelEpoch + (input - 2) * 24 * 60 * 60 * 1000;
    const d = new Date(ms);
    return Number.isNaN(d.getTime()) ? null : d.toISOString();
  }
  try {
    const d = createDateFromString(String(input));
    return Number.isNaN(d.getTime()) ? null : d.toISOString();
  } catch {
    return null;
  }
}

function getNights(dep: string | null, ret: string | null, fallback?: unknown): number | null {
  if (typeof fallback === 'number' && fallback > 0) return fallback;
  if (typeof fallback === 'string') {
    const n = parseInt(fallback, 10);
    if (!Number.isNaN(n) && n > 0) return n;
  }
  if (!dep || !ret) return null;
  const d1 = new Date(dep).getTime();
  const d2 = new Date(ret).getTime();
  const diff = Math.round((d2 - d1) / (1000 * 60 * 60 * 24));
  return Number.isNaN(diff) || diff <= 0 ? null : diff;
}

export function mapFromCruisesSheet(input: any): UnifiedCruise {
  const id = String(input?.id ?? input?.ID ?? `cruise-${Date.now()}`);
  const ship = String(input?.ship ?? input?.Ship ?? 'Unknown Ship');
  const itineraryName = String(input?.itineraryName ?? input?.['Itinerary Name'] ?? input?.itinerary ?? 'Unknown Itinerary');
  const departurePort = input?.departurePort ?? input?.['Departure Port'] ?? null;
  const dep = toIsoOrNull(
    input?.departureDate ?? input?.['Departure Date'] ?? input?.['Sailing Date'] ?? input?.['Sail Date'] ?? input?.startDate ?? input?.['Start Date']
  );
  const ret = toIsoOrNull(input?.returnDate ?? input?.['Return Date'] ?? input?.endDate ?? input?.['End Date']);
  const nights = getNights(dep, ret, input?.nights ?? input?.Nights ?? input?.['NIGHTS'] ?? input?.length ?? input?.Length);

  // Prefer enhanced itinerary text if provided
  const portsRoute = (input?.['All Ports'] ?? input?.allPorts ?? input?.portsRoute ?? null) as string | null;
  let retailInteriorPrice: number | null = null;
  const interiorRaw = input?.['Interior retail price'] ?? input?.Interior?.retailPrice ?? input?.interiorRetailPrice ?? input?.interiorPrice ?? input?.pricingCurrent?.interior ?? null;
  if (typeof interiorRaw === 'number') {
    retailInteriorPrice = interiorRaw;
  } else if (typeof interiorRaw === 'string') {
    const n = Number(interiorRaw.toString().replace(/[^0-9.]/g, ''));
    retailInteriorPrice = Number.isFinite(n) ? n : null;
  }

  return {
    id,
    ship,
    itineraryName,
    departurePort: departurePort ? String(departurePort) : undefined,
    departureDate: dep,
    returnDate: ret,
    nights: nights ?? null,
    status: (input?.status as UnifiedCruise['status']) ?? 'on_sale',
    cabinType: input?.cabinType ?? null,
    guests: input?.guests ?? null,
    reservationNumber: input?.reservationNumber ?? null,
    offerCode: input?.offerCode ?? input?.offerDetails?.offerCode ?? null,
    offerName: input?.offerName ?? input?.offerDetails?.offerName ?? null,
    offerExpireDate: input?.offerExpirationDate ?? input?.offerExpireDate ?? input?.offerDetails?.expiryDate ?? null,
    value: input?.value ?? null,
    source: 'cruises',
    portsRoute: portsRoute ?? null,
    retailInteriorPrice,
    departureLabel: null,
    imageUrl: null,
  };
}

export function mapFromBooked(input: BookedCruise | any): UnifiedCruise {
  const id = String(input?.id ?? `booked-${Date.now()}`);
  const ship = String(input?.ship ?? 'Unknown Ship');
  const itineraryName = String(input?.itineraryName ?? input?.itinerary ?? 'Unknown Itinerary');
  const dep = toIsoOrNull(input?.startDate ?? input?.['Start Date']);
  const ret = toIsoOrNull(input?.endDate ?? input?.['End Date']);
  const nights = getNights(dep, ret, input?.nights);

  return {
    id,
    ship,
    itineraryName,
    departurePort: String(input?.departurePort ?? '' ) || undefined,
    departureDate: dep,
    returnDate: ret,
    nights: nights ?? null,
    status: input?.lifecycleStatus ?? 'upcoming',
    cabinType: input?.cabinType ?? null,
    guests: input?.guests ?? null,
    reservationNumber: input?.reservationNumber ?? null,
    offerCode: input?.offerCode ?? null,
    offerName: input?.offerName ?? null,
    offerExpireDate: null,
    value: input?.value ?? null,
    source: 'booked',
    portsRoute: (input?.['All Ports'] ?? input?.allPorts ?? input?.portsRoute ?? null) as string | null,
    retailInteriorPrice: null,
    departureLabel: null,
    imageUrl: null,
  };
}

export function mapFromOffer(input: any): UnifiedCruise {
  const id = String(input?.id ?? `offer-${Date.now()}`);
  const ship = String(input?.ship ?? input?.Ship ?? 'Unknown Ship');
  const itineraryName = String(input?.itineraryName ?? input?.['Itinerary Name'] ?? input?.itinerary ?? 'Unknown Itinerary');
  const dep = toIsoOrNull(input?.departureDate ?? input?.['Departure Date'] ?? input?.startDate ?? input?.['Start Date']);
  const ret = toIsoOrNull(input?.returnDate ?? input?.['Return Date'] ?? input?.endDate ?? input?.['End Date']);

  return {
    id,
    ship,
    itineraryName,
    departurePort: input?.departurePort ?? undefined,
    departureDate: dep,
    returnDate: ret,
    nights: getNights(dep, ret, input?.nights) ?? null,
    status: 'on_sale',
    cabinType: input?.cabinType ?? null,
    guests: input?.guests ?? null,
    reservationNumber: null,
    offerCode: input?.offerCode ?? input?.['Offer Code'] ?? null,
    offerName: input?.offerName ?? input?.['Offer Name'] ?? null,
    offerExpireDate: input?.offerExpireDate ?? input?.['Offer Expire Date'] ?? input?.['Offer Expiration Date'] ?? null,
    value: input?.value ?? input?.Value ?? null,
    source: 'offers',
    portsRoute: (input?.['All Ports'] ?? input?.allPorts ?? input?.portsRoute ?? null) as string | null,
    retailInteriorPrice: null,
    departureLabel: null,
    imageUrl: null,
  };
}

export function mapFromAnalyticsHistory(input: CruisePointsHistory): UnifiedCruise {
  const dep = toIsoOrNull(input?.departureDate);
  return {
    id: input.cruiseId || input.id,
    ship: input.ship,
    itineraryName: input.ship ? String(input.ship) : 'Completed Cruise',
    departurePort: undefined,
    departureDate: dep,
    returnDate: null,
    nights: null,
    status: 'completed',
    cabinType: null,
    guests: null,
    reservationNumber: null,
    offerCode: null,
    offerName: null,
    offerExpireDate: null,
    value: null,
    source: 'analytics',
    portsRoute: null,
    departureLabel: null,
    imageUrl: null,
  };
}

export function detectAndMapUnified(input: any): UnifiedCruise {
  if (!input || typeof input !== 'object') {
    return {
      id: `cruise-${Date.now()}`,
      ship: 'Unknown Ship',
      itineraryName: 'Unknown Itinerary',
      departureDate: null,
      returnDate: null,
      nights: null,
      status: 'on_sale',
      cabinType: null,
      guests: null,
      reservationNumber: null,
      offerCode: null,
      offerName: null,
      offerExpireDate: null,
      value: null,
      source: 'cruises',
      imageUrl: null,
    } as UnifiedCruise;
  }

  if ('reservationNumber' in input && ('startDate' in input || 'endDate' in input)) {
    return mapFromBooked(input as BookedCruise);
  }
  if ('offerCode' in input || 'Offer Code' in input) {
    return mapFromOffer(input);
  }
  if ('cruiseId' in input && 'pointsEarned' in input) {
    return mapFromAnalyticsHistory(input as CruisePointsHistory);
  }
  return mapFromCruisesSheet(input as Cruise);
}
