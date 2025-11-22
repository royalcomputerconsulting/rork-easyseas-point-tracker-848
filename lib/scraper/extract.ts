interface PacketData {
  src: 'fetch' | 'xhr' | 'GLOBAL';
  url: string;
  data: any;
}

interface OfferRow {
  'Offer Name': string;
  'Offer Code': string;
  'OFFER EXPIRE DATE': string;
  'Type of Offer': string;
  'VALUE': string;
  'HTML URL Link': string;
  '# of Cruises': number;
}

interface CruiseRow {
  'Offer Name': string;
  'Offer Code': string;
  'OFFER EXPIRE DATE': string;
  'Type of Offer': string;
  'VALUE': string;
  'Sailing Date': string;
  'Ship Name': string;
  'Ship Code': string;
  'Nights': number;
  'Departure Port': string;
  'Itinerary': string;
  'Cabin Type': string;
  '# of Guests': number;
}

export function extractAll(packets: PacketData[]): {
  offers: OfferRow[];
  cruises: CruiseRow[];
} {
  console.log(`[Extract] Processing ${packets.length} packets`);

  const offersMap = new Map<string, OfferRow>();
  const cruisesArr: CruiseRow[] = [];

  for (const packet of packets) {
    try {
      extractFromData(packet.data, offersMap, cruisesArr);
    } catch (e) {
      console.error('[Extract] Error processing packet:', e);
    }
  }

  const offers = Array.from(offersMap.values());
  console.log(`[Extract] Extracted ${offers.length} offers, ${cruisesArr.length} cruises`);

  return { offers, cruises: cruisesArr };
}

function extractFromData(
  data: any,
  offersMap: Map<string, OfferRow>,
  cruisesArr: CruiseRow[]
): void {
  if (!data || typeof data !== 'object') return;

  if (Array.isArray(data)) {
    for (const item of data) {
      extractFromData(item, offersMap, cruisesArr);
    }
    return;
  }

  if (isOfferNode(data)) {
    processOffer(data, offersMap, cruisesArr);
  }

  if (data.offers && Array.isArray(data.offers)) {
    for (const offer of data.offers) {
      extractFromData(offer, offersMap, cruisesArr);
    }
  }

  if (data.campaignOffers && Array.isArray(data.campaignOffers)) {
    for (const offer of data.campaignOffers) {
      extractFromData(offer, offersMap, cruisesArr);
    }
  }

  if (data.campaignOffer) {
    extractFromData(data.campaignOffer, offersMap, cruisesArr);
  }

  for (const key in data) {
    if (typeof data[key] === 'object') {
      extractFromData(data[key], offersMap, cruisesArr);
    }
  }
}

function isOfferNode(obj: any): boolean {
  return (
    obj &&
    typeof obj === 'object' &&
    (obj.offerName ||
      obj.offerCode ||
      obj.campaignOffer ||
      (obj.name && (obj.code || obj.expirationDate)))
  );
}

function processOffer(
  offer: any,
  offersMap: Map<string, OfferRow>,
  cruisesArr: CruiseRow[]
): void {
  const offerName = offer.offerName || offer.name || '';
  const offerCode = offer.offerCode || offer.code || '';

  if (!offerCode) return;

  const expireDate =
    offer.expirationDate || offer.expireDate || offer.endDate || '';
  const offerType = offer.offerType || offer.type || '';
  const value = extractValue(offer);
  const htmlUrl = offer.url || offer.link || 'https://www.royalcaribbean.com/club-royale/';

  const sailings = offer.sailings || offer.cruises || [];
  const numCruises = Array.isArray(sailings) ? sailings.length : 0;

  if (!offersMap.has(offerCode)) {
    offersMap.set(offerCode, {
      'Offer Name': offerName,
      'Offer Code': offerCode,
      'OFFER EXPIRE DATE': expireDate,
      'Type of Offer': offerType,
      'VALUE': value,
      'HTML URL Link': htmlUrl,
      '# of Cruises': numCruises,
    });
  }

  if (Array.isArray(sailings)) {
    for (const sailing of sailings) {
      const cruise: CruiseRow = {
        'Offer Name': offerName,
        'Offer Code': offerCode,
        'OFFER EXPIRE DATE': expireDate,
        'Type of Offer': offerType,
        'VALUE': value,
        'Sailing Date': sailing.sailDate || sailing.sailingDate || sailing.date || '',
        'Ship Name': sailing.ship?.shipName || sailing.ship?.name || sailing.shipName || '',
        'Ship Code': sailing.ship?.shipCode || sailing.ship?.code || sailing.shipCode || '',
        'Nights': sailing.nights || sailing.length || sailing.duration || 0,
        'Departure Port':
          sailing.departurePort?.name ||
          sailing.departurePortName ||
          sailing.departurePort ||
          '',
        'Itinerary':
          sailing.itineraryName ||
          sailing.itinerary?.name ||
          sailing.itineraryCode ||
          sailing.itinerary ||
          '',
        'Cabin Type': sailing.cabinType || sailing.cabin || sailing.eligibleCabin || '',
        '# of Guests': sailing.guests || sailing.numGuests || 0,
      };
      cruisesArr.push(cruise);
    }
  }
}

function extractValue(offer: any): string {
  if (offer.value) return String(offer.value);
  if (offer.perks) return String(offer.perks);
  if (offer.description) return String(offer.description);
  if (offer.benefit) return String(offer.benefit);
  return '';
}
