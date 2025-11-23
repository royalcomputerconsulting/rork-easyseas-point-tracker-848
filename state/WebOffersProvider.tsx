import { useState, useEffect, useMemo, useCallback } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import createContextHook from "@nkzw/create-context-hook";
import { Offer, applyAllPruningRules, ExcludedSailing } from "@/lib/webOffers/pruning";
import {
  toTitleCase,
  toPortTitleCase,
  normalizeShipName,
} from "@/lib/webOffers/utils";

interface SessionData {
  token: string;
  accountId: string;
  loyaltyId: string;
  username: string;
  expiresAt: string;
}

interface NormalizedOffer extends Offer {
  savedAt: string;
  profileKey: string;
}

interface FlattenedOffer {
  offerCode: string;
  offerName: string;
  category?: string;
  expirationDate?: string;
  shipCode: string;
  shipName: string;
  sailDate: string;
  itineraryDescription: string;
  nights: number;
  roomCategory?: string;
  numberOfGuests?: string;
  tradeInValue?: string | number;
  onboardCredit?: string | number;
  freePlay?: string | number;
  discountedCruise?: string | boolean;
  freeCruise?: string | boolean;
  upgrades?: any;
  sailingId?: string;
}

export const [WebOffersProvider, useWebOffers] = createContextHook(() => {
  const [offers, setOffers] = useState<NormalizedOffer[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [activeProfileKey, setActiveProfileKey] = useState<string | null>(null);

  const loadOffersForProfile = useCallback(async (profileKey: string) => {
    try {
      setIsLoading(true);
      const offersData = await AsyncStorage.getItem(`${profileKey}-offers`);
      if (offersData) {
        const parsed = JSON.parse(offersData);
        setOffers(parsed);
      } else {
        setOffers([]);
      }
    } catch (err) {
      console.error("[WebOffersProvider] Error loading offers:", err);
      setError(err instanceof Error ? err.message : "Failed to load offers");
    } finally {
      setIsLoading(false);
    }
  }, []);

  const loadActiveProfile = useCallback(async () => {
    try {
      const activeProfileData = await AsyncStorage.getItem("gobo-active-profile");
      if (activeProfileData) {
        const parsed = JSON.parse(activeProfileData);
        const key = parsed?.key;
        if (key) {
          setActiveProfileKey(key);
          await loadOffersForProfile(key);
        } else {
          console.log("[WebOffersProvider] No profile key found in active profile data");
        }
      } else {
        console.log("[WebOffersProvider] No active profile set");
      }
    } catch (err) {
      console.error("[WebOffersProvider] Error loading active profile:", err);
      setError(null);
    }
  }, [loadOffersForProfile]);

  useEffect(() => {
    loadActiveProfile();
  }, [loadActiveProfile]);

  const normalizeOffers = useCallback((rawOffers: Offer[]): Offer[] => {
    return rawOffers.map((offer) => ({
      ...offer,
      offerName: toTitleCase(offer.offerName || ""),
      sailings: offer.sailings?.map((sailing) => ({
        ...sailing,
        shipName: normalizeShipName(sailing.shipName || ""),
        itineraryDescription: sailing.itineraryDescription
          ?.split(",")
          .map((port) => toPortTitleCase(port.trim()))
          .join(", ") || "",
      })) || [],
    }));
  }, []);

  const saveOffers = useCallback(async (
    rawOffers: Offer[],
    profileKey: string,
    excludedSailings: ExcludedSailing[] = []
  ) => {
    try {
      setIsLoading(true);
      setError(null);

      console.log("[WebOffersProvider] Normalizing offers...");
      const normalized = normalizeOffers(rawOffers);

      console.log("[WebOffersProvider] Applying pruning rules...");
      const pruned = applyAllPruningRules(normalized, excludedSailings);

      const savedOffers: NormalizedOffer[] = pruned.map((offer) => ({
        ...offer,
        savedAt: new Date().toISOString(),
        profileKey,
      }));

      await AsyncStorage.setItem(
        `${profileKey}-offers`,
        JSON.stringify(savedOffers)
      );

      if (activeProfileKey === profileKey) {
        setOffers(savedOffers);
      }

      console.log("[WebOffersProvider] Saved", savedOffers.length, "offers");
    } catch (err) {
      console.error("[WebOffersProvider] Error saving offers:", err);
      setError(err instanceof Error ? err.message : "Failed to save offers");
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, [activeProfileKey, normalizeOffers]);

  const switchProfile = useCallback(async (profileKey: string) => {
    try {
      setActiveProfileKey(profileKey);
      await AsyncStorage.setItem(
        "gobo-active-profile",
        JSON.stringify({ key: profileKey, brand: "royal" })
      );
      await loadOffersForProfile(profileKey);
    } catch (err) {
      console.error("[WebOffersProvider] Error switching profile:", err);
      setError(err instanceof Error ? err.message : "Failed to switch profile");
    }
  }, [loadOffersForProfile]);

  const getSession = useCallback(async (
    profileKey: string
  ): Promise<SessionData | null> => {
    try {
      const sessionData = await AsyncStorage.getItem(profileKey);
      if (!sessionData) return null;

      const session: SessionData = JSON.parse(sessionData);

      const expiresAt = new Date(session.expiresAt).getTime();
      if (expiresAt < Date.now()) {
        console.warn("[WebOffersProvider] Session expired for:", profileKey);
        return null;
      }

      return session;
    } catch (err) {
      console.error("[WebOffersProvider] Error getting session:", err);
      return null;
    }
  }, []);

  const flattenedOffers = useMemo(() => {
    const flattened: FlattenedOffer[] = [];

    offers.forEach((offer) => {
      offer.sailings?.forEach((sailing) => {
        const nightsMatch = sailing.itineraryDescription?.match(/(\d+)\s*night/i);
        const nights = nightsMatch ? parseInt(nightsMatch[1], 10) : 0;

        flattened.push({
          offerCode: offer.offerCode,
          offerName: offer.offerName,
          category: offer.category,
          expirationDate: offer.expirationDate,
          shipCode: sailing.shipCode,
          shipName: sailing.shipName,
          sailDate: sailing.sailDate,
          itineraryDescription: sailing.itineraryDescription,
          nights,
          roomCategory: sailing.roomCategory,
          numberOfGuests: sailing.numberOfGuests,
          tradeInValue: sailing.tradeInValue,
          onboardCredit: sailing.onboardCredit,
          freePlay: sailing.freePlay,
          discountedCruise: sailing.discountedCruise,
          freeCruise: sailing.freeCruise,
          upgrades: sailing.upgrades,
          sailingId: sailing.id,
        });
      });
    });

    return flattened;
  }, [offers]);

  const returnValue = useMemo(() => ({
    offers,
    flattenedOffers,
    isLoading,
    error,
    activeProfileKey,
    saveOffers,
    switchProfile,
    getSession,
    loadOffersForProfile,
  }), [
    offers,
    flattenedOffers,
    isLoading,
    error,
    activeProfileKey,
    saveOffers,
    switchProfile,
    getSession,
    loadOffersForProfile,
  ]);

  return returnValue;
});
