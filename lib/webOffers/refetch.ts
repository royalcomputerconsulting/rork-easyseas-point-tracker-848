import { Offer, findEmptyOffers, mergeSailings } from "./pruning";

export interface RefetchByCodeParams {
  token: string;
  accountId: string;
  loyaltyId: string;
  brand: "royal" | "celebrity";
  offerCode: string;
}

export async function refetchOfferByCode(
  params: RefetchByCodeParams
): Promise<Offer | null> {
  const { token, accountId, loyaltyId, brand, offerCode } = params;

  const baseUrl =
    brand === "royal"
      ? "https://www.royalcaribbean.com"
      : "https://www.celebritycruises.com";

  const apiUrl = `${baseUrl}/api/casino/casino-offers/v1/offer/${offerCode}`;

  console.log("[refetch] Fetching offer by code:", offerCode);

  try {
    const response = await fetch(apiUrl, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
        "account-id": accountId,
      },
    });

    if (!response.ok) {
      console.error(
        "[refetch] Failed to fetch offer:",
        response.status,
        response.statusText
      );
      return null;
    }

    const data = await response.json();
    console.log(
      "[refetch] Successfully fetched offer:",
      offerCode,
      "sailings:",
      data?.sailings?.length || 0
    );

    return data;
  } catch (error) {
    console.error("[refetch] Error fetching offer:", error);
    return null;
  }
}

export async function refetchEmptyOffers(
  offers: Offer[],
  params: Omit<RefetchByCodeParams, "offerCode">
): Promise<Offer[]> {
  const emptyOffers = findEmptyOffers(offers);

  if (emptyOffers.length === 0) {
    console.log("[refetch] No empty offers to refetch");
    return offers;
  }

  console.log("[refetch] Found", emptyOffers.length, "empty offers to refetch");

  const refetchedOffers = await Promise.all(
    emptyOffers.map((offer) =>
      refetchOfferByCode({
        ...params,
        offerCode: offer.offerCode,
      })
    )
  );

  const offersMap = new Map<string, Offer>();
  offers.forEach((offer) => {
    offersMap.set(offer.offerCode, offer);
  });

  refetchedOffers.forEach((refetchedOffer) => {
    if (refetchedOffer && refetchedOffer.sailings) {
      const existing = offersMap.get(refetchedOffer.offerCode);
      if (existing) {
        offersMap.set(refetchedOffer.offerCode, {
          ...existing,
          sailings: mergeSailings(
            existing.sailings || [],
            refetchedOffer.sailings
          ),
        });
      }
    }
  });

  const mergedOffers = Array.from(offersMap.values());
  console.log(
    "[refetch] After refetch and merge:",
    mergedOffers.length,
    "offers"
  );

  return mergedOffers;
}
