import React from "react";
import { Platform } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import createContextHook from "@nkzw/create-context-hook";
import type { Cruise, BookedCruise, CasinoOffer, CalendarEvent, ClubRoyaleProfile } from "@/types/models";
import { SAMPLE_CLUB_ROYALE_PROFILE } from "@/types/models";
import { createDateFromString } from "@/lib/date";
import { useUser } from "@/state/UserProvider";
import { useCruiseStore } from "@/state/CruiseStore";
import { STATIC_BOOKED_CRUISES } from "@/state/staticBooked";


interface AppSettings {
  showTaxesInList: boolean;
  showPricePerNight: boolean;
  priceDropAlerts: boolean;
  dailySummaryNotifications?: boolean;
  theme?: 'system' | 'light' | 'dark';
  currency: string;
  pointsPerDay?: number;
}

interface LocalData {
  cruises: Cruise[];
  booked: BookedCruise[];
  offers: CasinoOffer[];
  calendar: CalendarEvent[];
  tripit: CalendarEvent[];
  lastImport: string | null;
  clubRoyaleProfile?: ClubRoyaleProfile;
}

interface AppState {
  settings: AppSettings;
  lastImportDate: string | null;
  localData: LocalData;
  hasLocalData: boolean;
  isLoading: boolean;
  userPoints: number;
  loyaltyPoints: number;
  cruises: Cruise[];
  clubRoyaleProfile: ClubRoyaleProfile;
  updateUserPoints: (points: number) => Promise<void>;
  addPoints: (delta: number) => Promise<void>;
  updateLoyaltyPoints: (points: number) => Promise<void>;
  updateClubRoyaleProfile: (updates: Partial<ClubRoyaleProfile>) => Promise<void>;
  updateSettings: (updates: Partial<AppSettings>) => void;
  updateLastImportDate: (date: string) => void;
  refreshLocalData: () => Promise<void>;
  updateCruise: (cruiseId: string, updates: any) => Promise<void>;
  addCruise: (cruise: any) => Promise<void>;
  autoCompletePastCruises: () => Promise<number>;
  cleanExpiredOffers: () => Promise<number>;
  updateOffers: (offers: any[]) => Promise<void>;
  bookCruise: (input: { id?: string; ship?: string; startDate?: string; departureDate?: string }) => Promise<void>;
  unbookCruise: (input: { id?: string; ship?: string; startDate?: string; departureDate?: string }) => Promise<void>;
  markCruiseCompleted: (input: { id?: string; ship?: string; startDate?: string; departureDate?: string }) => Promise<void>;
}

const STORAGE_KEYS = {
  SETTINGS: "@app_settings",
  LAST_IMPORT: "@last_import",
  LOCAL_CRUISES: "@local_cruises",
  LOCAL_BOOKED: "@local_booked",
  LOCAL_OFFERS: "@local_offers",
  LOCAL_CALENDAR: "@local_calendar",
  LOCAL_TRIPIT: "@local_tripit",
  LOCAL_LAST_IMPORT: "@local_last_import",
  USER_POINTS: "@user_points",
  CLUB_ROYALE_PROFILE: "@club_royale_profile",
  LOYALTY_POINTS: "@loyalty_points",
};

export const [AppStateProvider, useAppState] = createContextHook<AppState>(() => {
  const { currentUserId, ensureOwner } = useUser();
  const { upsertCruises } = useCruiseStore();
  const userKey = currentUserId ?? 'owner';
  const k = React.useCallback((base: string) => `${userKey}:${base}` as const, [userKey]);
  const [settings, setSettings] = React.useState<AppSettings>({
    showTaxesInList: true,
    showPricePerNight: true,
    priceDropAlerts: true,
    dailySummaryNotifications: false,
    theme: 'system',
    currency: "USD",
    pointsPerDay: 74,
  });
  
  const [lastImportDate, setLastImportDate] = React.useState<string | null>(null);
  const [localData, setLocalData] = React.useState<LocalData>({
    cruises: STATIC_BOOKED_CRUISES as unknown as any[],
    booked: STATIC_BOOKED_CRUISES as unknown as any[],
    offers: [],
    calendar: [],
    tripit: [],
    lastImport: null,
    clubRoyaleProfile: SAMPLE_CLUB_ROYALE_PROFILE,
  });
  const [clubRoyaleProfile, setClubRoyaleProfile] = React.useState<ClubRoyaleProfile>(SAMPLE_CLUB_ROYALE_PROFILE);
  const [hasLocalData, setHasLocalData] = React.useState<boolean>(false);
  const [isLoading, setIsLoading] = React.useState<boolean>(false);
  const [userPoints, setUserPoints] = React.useState<number>(20720);
  const [loyaltyPoints, setLoyaltyPoints] = React.useState<number>(428);

  // Simplified data loading
  const loadStorageData = React.useCallback(async (baseKey: string): Promise<any[]> => {
    try {
      const primaryKey = k(baseKey);
      const fallbackKey = baseKey;
      const tryKeys = [primaryKey, fallbackKey];
      for (const key of tryKeys) {
        const data = await AsyncStorage.getItem(key);
        if (data) {
          try {
            const parsed = JSON.parse(data);
            if (Array.isArray(parsed)) {
              return parsed;
            }
          } catch {
            continue;
          }
        }
      }
      // Web-only fallback to persisted JSON files served by /api/data
      if (Platform.OS === 'web' && baseKey === STORAGE_KEYS.LOCAL_OFFERS) {
        try {
          const res = await fetch('/api/data/offers.database.json', { headers: { 'Cache-Control': 'no-cache' } });
          if (res.ok) {
            const json = await res.json();
            if (Array.isArray(json)) return json as any[];
            if (json && typeof json === 'object' && 'offers' in (json as any)) {
              const arr = (json as any).offers;
              if (Array.isArray(arr)) return arr as any[];
            }
          }
        } catch (e) {
          console.warn('[AppState] Web offers DB fetch failed (non-fatal)');
        }
      }
      return [];
    } catch (error) {
      console.error(`Failed to load data for ${baseKey}:`, error);
      return [];
    }
  }, [k]);



  // Reservation numbers that must always be unbooked and blanked
  const UNBOOK_RES_NUMBERS = React.useMemo(() => new Set<string>(["234190", "3156139"]), []);

  const normalizeLocalData = React.useCallback(async (data: LocalData) => {
    try {
      const cleanedBooked = (data.booked ?? []).filter((b: any) => {
        const res = String((b?.reservationNumber ?? b?.bookingId ?? "")).trim();
        return !UNBOOK_RES_NUMBERS.has(res);
      });

      const cleanedCruises = (data.cruises ?? []).map((c: any) => {
        const res = String((c?.reservationNumber ?? c?.bookingId ?? "")).trim();
        if (UNBOOK_RES_NUMBERS.has(res)) {
          return { ...c, reservationNumber: "", bookingId: "", status: c?.status === 'booked' ? 'on_sale' : c?.status } as any;
        }
        return c;
      });

      if (cleanedBooked.length !== (data.booked ?? []).length || JSON.stringify(cleanedCruises) !== JSON.stringify(data.cruises ?? [])) {
        const next: LocalData = { ...data, booked: cleanedBooked as any, cruises: cleanedCruises as any };
        setLocalData(next);
        setHasLocalData((next.cruises.length > 0) || (next.booked.length > 0) || (next.offers.length > 0) || (next.calendar.length > 0) || (next.tripit.length > 0));
        await AsyncStorage.setItem(k(STORAGE_KEYS.LOCAL_BOOKED), JSON.stringify(cleanedBooked));
        await AsyncStorage.setItem(k(STORAGE_KEYS.LOCAL_CRUISES), JSON.stringify(cleanedCruises));
        try {
          if (cleanedCruises.length > 0) {
            await upsertCruises(cleanedCruises as any);
          }
        } catch (err) {
          console.warn('[AppState] normalizeLocalData upsertCruises failed', err);
        }
      }
    } catch (e) {
      console.warn('[AppState] normalizeLocalData error', e);
    }
  }, [UNBOOK_RES_NUMBERS, k, upsertCruises]);

  // Sync backend data to frontend on startup
  const syncBackendData = React.useCallback(async (prev: { localData: LocalData; profile: ClubRoyaleProfile }) => {
    try {
      console.log('[AppState] Syncing data from backend...');
      const { trpcClient } = await import('@/lib/trpc');

      let cruisesData: any[] = [];
      let offersData: any[] = [];
      let eventsData: any[] = [];

      try {
        const cruisesResponse = await trpcClient.cruises.list.query({ limit: 1000 });
        if (Array.isArray(cruisesResponse)) {
          cruisesData = cruisesResponse;
        } else if (cruisesResponse && typeof cruisesResponse === 'object' && 'cruises' in cruisesResponse) {
          cruisesData = Array.isArray((cruisesResponse as any).cruises) ? (cruisesResponse as any).cruises : [];
        }
        console.log('[AppState] Loaded cruises from backend:', cruisesData.length);
      } catch (err) {
        console.error('[AppState] Failed to fetch cruises from backend:', err);
      }

      try {
        const offersResponse = await trpcClient.casinoOffers.list.query();
        offersData = Array.isArray(offersResponse) ? offersResponse : [];
        console.log('[AppState] Loaded offers from backend:', offersData.length);
      } catch (err) {
        console.error('[AppState] Failed to fetch offers from backend:', err);
      }

      try {
        const eventsResponse = await trpcClient.calendar.events.query();
        eventsData = Array.isArray(eventsResponse) ? eventsResponse : [];
        console.log('[AppState] Loaded events from backend:', eventsData.length);
      } catch (err) {
        console.warn('[AppState] Failed to fetch events from backend (non-fatal):', err instanceof Error ? err.message : String(err));
        eventsData = [];
      }

      const totals = { cruises: cruisesData.length, offers: offersData.length, events: eventsData.length };
      console.log('[AppState] Backend data fetched:', totals);

      if (totals.cruises === 0 && totals.offers === 0 && totals.events === 0) {
        console.warn('[AppState] Backend returned zero items. Skipping overwrite of local data to preserve user-imported data.');
        return;
      }

      // CRITICAL FIX: NEVER sync from backend if local data exists
      // User-imported data should ALWAYS take precedence over backend
      const localOffersCount = Array.isArray(prev.localData?.offers) ? prev.localData.offers.length : 0;
      const localCruisesCount = Array.isArray(prev.localData?.cruises) ? prev.localData.cruises.length : 0;
      const localBookedCount = Array.isArray(prev.localData?.booked) ? prev.localData.booked.length : 0;
      const backendOffersCount = Array.isArray(offersData) ? offersData.length : 0;
      
      console.log('[AppState] Data persistence check:', {
        localOffers: localOffersCount,
        localCruises: localCruisesCount,
        localBooked: localBookedCount,
        backendOffers: backendOffersCount,
        backendCruises: cruisesData.length,
        decision: 'ALWAYS prefer local data over backend'
      });
      
      const bookedCruisesFromBackend = cruisesData.filter((c: any) => c.bookingId || c.reservationNumber || c.status === 'booked');
      const availableCruisesFromBackend = cruisesData.filter((c: any) => !c.bookingId && !c.reservationNumber && c.status !== 'booked');

      console.log('[AppState] Separated cruises:', { booked: bookedCruisesFromBackend.length, available: availableCruisesFromBackend.length });

      // CRITICAL: Always prefer local data if it exists (user imports)
      const mergedAvailableCruises = localCruisesCount > 0
        ? (prev.localData?.cruises ?? []) 
        : (availableCruisesFromBackend.length > 0 ? availableCruisesFromBackend : (prev.localData?.cruises ?? []));
      const mergedBookedCruises = localBookedCount > 0
        ? (prev.localData?.booked ?? [])
        : (bookedCruisesFromBackend.length > 0 ? bookedCruisesFromBackend : (prev.localData?.booked ?? []));
      const manualEventsFromBackend = eventsData.filter((e: any) => e?.source === 'manual');
      const tripitEventsFromBackend = eventsData.filter((e: any) => e?.source === 'tripit');
      const mergedManualEvents = manualEventsFromBackend.length > 0 ? manualEventsFromBackend : (prev.localData?.calendar ?? []);
      const mergedTripitEvents = tripitEventsFromBackend.length > 0 ? tripitEventsFromBackend : (prev.localData?.tripit ?? []);
      
      // ALWAYS prefer local data - never overwrite with backend
      const mergedOffers = localOffersCount > 0
        ? (Array.isArray(prev.localData?.offers) ? prev.localData.offers : [])
        : (Array.isArray(offersData) && offersData.length > 0 ? offersData : []);

      const newLocalData: LocalData = {
        cruises: mergedAvailableCruises,
        booked: mergedBookedCruises,
        offers: mergedOffers,
        calendar: mergedManualEvents,
        tripit: mergedTripitEvents,
        lastImport: new Date().toISOString(),
        clubRoyaleProfile: prev.profile,
      };

      setLocalData(newLocalData);
      setHasLocalData(newLocalData.cruises.length > 0 || newLocalData.booked.length > 0 || newLocalData.offers.length > 0);

      // CRITICAL: Always persist offers even if empty to maintain user-scoped storage
      // This ensures offers key exists for the current user
      const persistOps: Promise<void>[] = [];
      persistOps.push(AsyncStorage.setItem(k(STORAGE_KEYS.LOCAL_CRUISES), JSON.stringify(newLocalData.cruises)));
      persistOps.push(AsyncStorage.setItem(k(STORAGE_KEYS.LOCAL_BOOKED), JSON.stringify(newLocalData.booked)));
      persistOps.push(AsyncStorage.setItem(k(STORAGE_KEYS.LOCAL_OFFERS), JSON.stringify(newLocalData.offers)));
      if (newLocalData.calendar.length > 0) persistOps.push(AsyncStorage.setItem(k(STORAGE_KEYS.LOCAL_CALENDAR), JSON.stringify(newLocalData.calendar)));
      if (newLocalData.tripit.length > 0) persistOps.push(AsyncStorage.setItem(k(STORAGE_KEYS.LOCAL_TRIPIT), JSON.stringify(newLocalData.tripit)));
      persistOps.push(AsyncStorage.setItem(k(STORAGE_KEYS.LOCAL_LAST_IMPORT), new Date().toISOString()));
      await Promise.all(persistOps);
      
      console.log('[AppState] ✅ Persisted to AsyncStorage:', {
        cruises: newLocalData.cruises.length,
        booked: newLocalData.booked.length,
        offers: newLocalData.offers.length,
        userKey: userKey
      });

      // IMPORTANT: Also sync cruises to CruiseStore for persistence
      if (mergedAvailableCruises.length > 0) {
        console.log('[AppState] Syncing', mergedAvailableCruises.length, 'cruises to CruiseStore...');
        try {
          const result = await upsertCruises(mergedAvailableCruises);
          console.log('[AppState] CruiseStore sync result:', result);
        } catch (err) {
          console.error('[AppState] Failed to sync to CruiseStore:', err);
        }
      }

      console.log('[AppState] Backend data merged and persisted to AsyncStorage + CruiseStore');
    } catch (error) {
      console.error('[AppState] Failed to sync backend data:', error);
      console.log('[AppState] Falling back to local AsyncStorage data');
    }
  }, []);

  const syncFromBackend = React.useCallback(async () => {
    await syncBackendData({ localData, profile: clubRoyaleProfile });
  }, [syncBackendData, localData, clubRoyaleProfile]);

  // Load persisted data with error handling
  React.useEffect(() => {
    let mounted = true;
    const loadPersistedData = async () => {
      console.log('[AppState] Starting to load persisted data...');
      setIsLoading(true);
      
      try {
        // Load user-scoped data first
        const savedPoints = await AsyncStorage.getItem(k(STORAGE_KEYS.USER_POINTS));
        const savedLoyaltyPoints = await AsyncStorage.getItem(k(STORAGE_KEYS.LOYALTY_POINTS));
        const savedClubRoyaleProfile = await AsyncStorage.getItem(k(STORAGE_KEYS.CLUB_ROYALE_PROFILE));
        
        // Load global settings (not user-scoped)
        const savedSettings = await AsyncStorage.getItem(STORAGE_KEYS.SETTINGS);
        const savedImportDate = await AsyncStorage.getItem(STORAGE_KEYS.LAST_IMPORT);
        
        console.log('[AppState] Loading persisted data for user:', userKey, {
          points: savedPoints ? 'found' : 'not found',
          loyaltyPoints: savedLoyaltyPoints ? 'found' : 'not found',
          profile: savedClubRoyaleProfile ? 'found' : 'not found'
        });
        
        if (savedSettings) {
          try {
            const parsed = JSON.parse(savedSettings);
            const merged: AppSettings = {
              showTaxesInList: parsed?.showTaxesInList ?? true,
              showPricePerNight: parsed?.showPricePerNight ?? true,
              priceDropAlerts: parsed?.priceDropAlerts ?? true,
              dailySummaryNotifications: parsed?.dailySummaryNotifications ?? false,
              theme: parsed?.theme ?? 'system',
              currency: parsed?.currency ?? 'USD',
              pointsPerDay: typeof parsed?.pointsPerDay === 'number' ? parsed.pointsPerDay : 74,
            };
            if (mounted) setSettings(merged);
          } catch (e) {
            console.warn('[AppState] Malformed settings JSON in AsyncStorage - resetting to defaults');
            await AsyncStorage.removeItem(STORAGE_KEYS.SETTINGS);
          }
        }
        if (savedImportDate) {
          if (mounted) setLastImportDate(savedImportDate);
        }
        if (savedPoints) {
          const parsedPts = parseInt(savedPoints, 10);
          if (!Number.isNaN(parsedPts) && mounted) setUserPoints(parsedPts);
        }
        if (savedLoyaltyPoints) {
          const parsedLoyaltyPts = parseInt(savedLoyaltyPoints, 10);
          if (!Number.isNaN(parsedLoyaltyPts) && mounted) setLoyaltyPoints(parsedLoyaltyPts);
        }
        if (savedClubRoyaleProfile) {
          try {
            const parsedProfile = JSON.parse(savedClubRoyaleProfile);
            console.log('[AppState] ✅ Loaded Club Royale profile:', parsedProfile);
            if (mounted) setClubRoyaleProfile(parsedProfile);
          } catch (e) {
            console.warn('[AppState] Malformed Club Royale profile JSON - clearing corrupted value');
            await AsyncStorage.removeItem(k(STORAGE_KEYS.CLUB_ROYALE_PROFILE));
          }
        } else {
          console.log('[AppState] No saved Club Royale profile found, using default');
        }

        const [
          localCruises,
          localBooked,
          localOffers,
          localCalendar,
          localTripit,
          localLastImport,
        ] = await Promise.all([
          loadStorageData(STORAGE_KEYS.LOCAL_CRUISES),
          loadStorageData(STORAGE_KEYS.LOCAL_BOOKED),
          loadStorageData(STORAGE_KEYS.LOCAL_OFFERS),
          loadStorageData(STORAGE_KEYS.LOCAL_CALENDAR),
          loadStorageData(STORAGE_KEYS.LOCAL_TRIPIT),
          AsyncStorage.getItem(k(STORAGE_KEYS.LOCAL_LAST_IMPORT)),
        ]);
        
        const fallbackCruises = (Array.isArray(localCruises) && localCruises.length > 0) ? localCruises : (STATIC_BOOKED_CRUISES as unknown as any[]);
        const fallbackBooked = (Array.isArray(localBooked) && localBooked.length > 0) ? localBooked : (STATIC_BOOKED_CRUISES as unknown as any[]);
        const fallbackOffers = (Array.isArray(localOffers) && localOffers.length > 0) ? localOffers : [];

        const newLocalData: LocalData = {
          cruises: fallbackCruises,
          booked: fallbackBooked,
          offers: fallbackOffers,
          calendar: Array.isArray(localCalendar) ? localCalendar : [],
          tripit: Array.isArray(localTripit) ? localTripit : [],
          lastImport: localLastImport,
          clubRoyaleProfile: clubRoyaleProfile,
        };

        if (mounted) setLocalData(newLocalData);
        
        const hasData = newLocalData.cruises.length > 0 || 
                       newLocalData.booked.length > 0 || 
                       newLocalData.offers.length > 0 || 
                       newLocalData.calendar.length > 0 ||
                       newLocalData.tripit.length > 0;
        
        if (mounted) setHasLocalData(hasData);
        
        console.log('[AppState] Successfully loaded local data:', {
          cruises: newLocalData.cruises.length,
          booked: newLocalData.booked.length,
          offers: newLocalData.offers.length,
          calendar: newLocalData.calendar.length,
          tripit: newLocalData.tripit.length,
          hasData,
        });
        
        // IMPORTANT: End loading state BEFORE backend sync
        // This prevents hydration timeout by allowing UI to render
        console.log('[AppState] Setting isLoading to false (before backend sync)');
        if (mounted) setIsLoading(false);
        
        // CRITICAL: DISABLE backend sync to prevent data loss
        // Backend sync was overwriting user-imported data
        // User imports should ALWAYS be preserved
        console.log('[AppState] Backend sync DISABLED to preserve user data');
        console.log('[AppState] All data is loaded from AsyncStorage only');
        
      } catch (error) {
        console.error('[AppState] Failed to load persisted data:', error);
        if (mounted) {
          setLocalData({
            cruises: [],
            booked: [],
            offers: [],
            calendar: [],
            tripit: [],
            lastImport: null,
            clubRoyaleProfile: SAMPLE_CLUB_ROYALE_PROFILE,
          });
          setHasLocalData(false);
          setIsLoading(false);
        }
      }
    };

    loadPersistedData();
    return () => { mounted = false; };
  }, [loadStorageData, clubRoyaleProfile, syncBackendData]);

  const updateSettings = React.useCallback(async (updates: Partial<AppSettings>) => {
    const newSettings = { ...settings, ...updates };
    setSettings(newSettings);
    
    try {
      await AsyncStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(newSettings));
    } catch (error) {
      console.error("Failed to persist settings:", error);
    }
  }, [settings]);

  const updateLastImportDate = React.useCallback(async (date: string) => {
    setLastImportDate(date);
    
    try {
      await AsyncStorage.setItem(STORAGE_KEYS.LAST_IMPORT, date);
    } catch (error) {
      console.error("Failed to persist import date:", error);
    }
  }, []);

  const refreshLocalData = React.useCallback(async () => {
    try {
      console.log('[AppState] Refreshing local data...');
      
      const [
        localCruises,
        localBooked,
        localOffers,
        localCalendar,
        localTripit,
        localLastImport,
      ] = await Promise.all([
        loadStorageData(STORAGE_KEYS.LOCAL_CRUISES),
        loadStorageData(STORAGE_KEYS.LOCAL_BOOKED),
        loadStorageData(STORAGE_KEYS.LOCAL_OFFERS),
        loadStorageData(STORAGE_KEYS.LOCAL_CALENDAR),
        loadStorageData(STORAGE_KEYS.LOCAL_TRIPIT),
        AsyncStorage.getItem(k(STORAGE_KEYS.LOCAL_LAST_IMPORT)),
      ]);
      
      const newLocalData: LocalData = {
        cruises: Array.isArray(localCruises) ? localCruises : [],
        booked: Array.isArray(localBooked) ? localBooked : [],
        offers: Array.isArray(localOffers) ? localOffers : [],
        calendar: Array.isArray(localCalendar) ? localCalendar : [],
        tripit: Array.isArray(localTripit) ? localTripit : [],
        lastImport: localLastImport,
        clubRoyaleProfile: clubRoyaleProfile,
      };

      setLocalData(newLocalData);
      
      const hasData = newLocalData.cruises.length > 0 || 
                     newLocalData.booked.length > 0 || 
                     newLocalData.offers.length > 0 || 
                     newLocalData.calendar.length > 0 ||
                     newLocalData.tripit.length > 0;
      
      setHasLocalData(hasData);
      
      await normalizeLocalData(newLocalData);
      
      console.log('[AppState] Successfully refreshed local data:', {
        cruises: newLocalData.cruises.length,
        booked: newLocalData.booked.length,
        offers: newLocalData.offers.length,
        calendar: newLocalData.calendar.length,
        tripit: newLocalData.tripit.length,
        hasData,
      });
    } catch (error) {
      console.error('[AppState] Failed to refresh local data:', error);
    }
  }, [loadStorageData, clubRoyaleProfile]);

  const bookCruise = React.useCallback(async (input: { id?: string; ship?: string; startDate?: string; departureDate?: string }) => {
    try {
      console.log('[AppState] Booking cruise:', input);
      const current = Array.isArray(localData.booked) ? localData.booked : [];
      const exists = current.some((b: any) => {
        const idMatch = input.id && (b.cruiseId === input.id);
        const shipMatch = input.ship && (b.ship === input.ship);
        const dateInput = input.startDate ?? input.departureDate;
        const dateMatch = dateInput && (b.startDate === dateInput || b.departureDate === dateInput);
        return idMatch || (shipMatch && dateMatch);
      });
      if (exists) {
        console.log('[AppState] Cruise already booked, skipping');
      } else {
        const newEntry = {
          cruiseId: input.id ?? `${input.ship ?? 'unknown'}-${input.startDate ?? input.departureDate ?? ''}`,
          ship: input.ship ?? 'Unknown Ship',
          startDate: input.startDate ?? input.departureDate ?? null,
          departureDate: input.departureDate ?? input.startDate ?? null,
          createdAt: new Date().toISOString(),
        } as any;
        const updated = [...current, newEntry];
        const newLocalData = { ...localData, booked: updated };
        setLocalData(newLocalData);
        await AsyncStorage.setItem(k(STORAGE_KEYS.LOCAL_BOOKED), JSON.stringify(updated));
        console.log('[AppState] Cruise booked and persisted');
      }
    } catch (e) {
      console.error('[AppState] bookCruise failed', e);
      throw e;
    }
  }, [localData]);

  const unbookCruise = React.useCallback(async (input: { id?: string; ship?: string; startDate?: string; departureDate?: string }) => {
    try {
      console.log('[AppState] Unbooking cruise:', input);
      const current = Array.isArray(localData.booked) ? localData.booked : [];
      const dateInput = input.startDate ?? input.departureDate;
      const filtered = current.filter((b: any) => {
        const idMatch = input.id && (b.cruiseId === input.id);
        const shipMatch = input.ship && (b.ship === input.ship);
        const dateMatch = dateInput && (b.startDate === dateInput || b.departureDate === dateInput);
        return !(idMatch || (shipMatch && dateMatch));
      });
      const newLocalData = { ...localData, booked: filtered };
      setLocalData(newLocalData);
      await AsyncStorage.setItem(k(STORAGE_KEYS.LOCAL_BOOKED), JSON.stringify(filtered));
      console.log('[AppState] Cruise unbooked and persisted');
    } catch (e) {
      console.error('[AppState] unbookCruise failed', e);
      throw e;
    }
  }, [localData]);

  const markCruiseCompleted = React.useCallback(async (input: { id?: string; ship?: string; startDate?: string; departureDate?: string }) => {
    try {
      console.log('[AppState] Marking cruise completed:', input);
      const updatedCruises = (localData.cruises || []).map((c: any) => {
        const idMatch = input.id && c.id === input.id;
        const shipMatch = input.ship && (c.ship === input.ship || c['Ship Name'] === input.ship);
        const dateInput = input.startDate ?? input.departureDate;
        const startStr = c.startDate || c['Start Date'] || c.departureDate || c['Sailing Date'];
        const dateMatch = dateInput && (startStr === dateInput);
        if (idMatch || (shipMatch && dateMatch)) {
          return { ...c, status: 'completed', isCompleted: true, updatedAt: new Date().toISOString() } as any;
        }
        return c;
      });
      const newLocalData = { ...localData, cruises: updatedCruises };
      setLocalData(newLocalData);
      await AsyncStorage.setItem(k(STORAGE_KEYS.LOCAL_CRUISES), JSON.stringify(updatedCruises));
      console.log('[AppState] Cruise marked completed in local data');
    } catch (e) {
      console.error('[AppState] markCruiseCompleted failed', e);
      throw e;
    }
  }, [localData]);

  const updateUserPoints = React.useCallback(async (points: number) => {
    try {
      const safePoints = Math.max(0, Math.floor(points));
      setUserPoints(safePoints);
      await AsyncStorage.setItem(k(STORAGE_KEYS.USER_POINTS), String(safePoints));
      console.log('[AppState] Updated user points to:', safePoints);
    } catch (error) {
      console.error('[AppState] Failed to persist user points:', error);
    }
  }, [k]);

  const addPoints = React.useCallback(async (delta: number) => {
    const next = userPoints + Math.floor(delta);
    console.log('[AppState] Adding points. Current:', userPoints, 'Delta:', delta, 'New total:', next);
    await updateUserPoints(next);
  }, [updateUserPoints, userPoints]);

  const updateLoyaltyPoints = React.useCallback(async (points: number) => {
    try {
      const safePoints = Math.max(0, Math.floor(points));
      setLoyaltyPoints(safePoints);
      await AsyncStorage.setItem(k(STORAGE_KEYS.LOYALTY_POINTS), String(safePoints));
      console.log('[AppState] Updated loyalty points to:', safePoints);
    } catch (error) {
      console.error('[AppState] Failed to persist loyalty points:', error);
    }
  }, [k]);

  const updateCruise = React.useCallback(async (cruiseId: string, updates: any) => {
    try {
      console.log('[AppState] Updating cruise:', cruiseId, 'with updates:', updates);
      
      // Update the cruise in local state
      const updatedCruises = localData.cruises.map((cruise: any) => {
        if (cruise.id === cruiseId) {
          const updatedCruise = {
            ...cruise,
            ...updates,
            updatedAt: new Date().toISOString()
          };
          
          // Merge pricing if provided
          if (updates.pricing && cruise.pricing) {
            updatedCruise.pricing = {
              ...cruise.pricing,
              ...updates.pricing
            };
          } else if (updates.pricing) {
            updatedCruise.pricing = updates.pricing;
          }
          
          return updatedCruise;
        }
        return cruise;
      });
      
      // Update local state
      const newLocalData = {
        ...localData,
        cruises: updatedCruises
      };
      setLocalData(newLocalData);
      
      // Persist to AsyncStorage
      await AsyncStorage.setItem(k(STORAGE_KEYS.LOCAL_CRUISES), JSON.stringify(updatedCruises));
      
      console.log('[AppState] Successfully updated cruise in local data');
    } catch (error) {
      console.error('[AppState] Failed to update cruise:', error);
      throw error;
    }
  }, [localData]);

  const autoCompletePastCruises = React.useCallback(async (): Promise<number> => {
    try {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      let changed = 0;
      const updated = (localData.cruises || []).map((cruise: any) => {
        const depStr = cruise.startDate || cruise["Start Date"] || cruise.departureDate || cruise["Sailing Date"] || cruise.date;
        const endStr = cruise.endDate || cruise["End Date"] || cruise.returnDate || cruise["Return Date"];
        let dep = depStr ? createDateFromString(depStr) : null;
        if (dep && Number.isNaN(dep.getTime())) dep = null;
        let end: Date | null = null;
        if (endStr) {
          const e = createDateFromString(endStr);
          end = Number.isNaN(e.getTime()) ? null : e;
        }
        if (!end && dep) {
          const nights = cruise.nights || cruise["Nights"] || cruise.Nights || 7;
          const e = new Date(dep);
          e.setDate(e.getDate() + (typeof nights === 'number' ? nights : 7));
          end = e;
        }
        if (end) end.setHours(0,0,0,0);
        const isPast = end ? end.getTime() < today.getTime() : (dep ? dep.getTime() < today.getTime() : false);
        const alreadyCompleted = cruise.status === 'completed' || cruise.isCompleted === true;
        if (isPast && !alreadyCompleted) {
          changed++;
          return {
            ...cruise,
            status: 'completed',
            isCompleted: true,
            updatedAt: new Date().toISOString(),
          } as any;
        }
        return cruise;
      });
      if (changed > 0) {
        const newLocalData = { ...localData, cruises: updated };
        setLocalData(newLocalData);
        await AsyncStorage.setItem(k(STORAGE_KEYS.LOCAL_CRUISES), JSON.stringify(updated));
        console.log(`[AppState] Auto-completed ${changed} past cruises`);
      } else {
        console.log('[AppState] No past cruises to auto-complete');
      }
      return changed;
    } catch (e) {
      console.error('[AppState] autoCompletePastCruises failed', e);
      return 0;
    }
  }, [localData]);

  const addCruise = React.useCallback(async (cruise: any) => {
    try {
      console.log('[AppState] Adding new cruise:', cruise.id);
      
      const newCruise = {
        ...cruise,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      
      // Update local state (ephemeral)
      const updatedCruises = [...localData.cruises, newCruise];
      const newLocalData = {
        ...localData,
        cruises: updatedCruises
      };
      setLocalData(newLocalData);
      
      // Persist to AsyncStorage (legacy)
      await AsyncStorage.setItem(k(STORAGE_KEYS.LOCAL_CRUISES), JSON.stringify(updatedCruises));
      
      // IMPORTANT: Also persist to CruiseStore (persistent storage)
      console.log('[AppState] Syncing cruise to CruiseStore for persistence...');
      try {
        const result = await upsertCruises([newCruise]);
        console.log('[AppState] CruiseStore sync result:', result);
      } catch (err) {
        console.error('[AppState] Failed to sync to CruiseStore:', err);
      }
      
      console.log('[AppState] Successfully added cruise to local data and CruiseStore');
    } catch (error) {
      console.error('[AppState] Failed to add cruise:', error);
      throw error;
    }
  }, [localData, upsertCruises]);

  const cleanExpiredOffers = React.useCallback(async (): Promise<number> => {
    try {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      console.log(`[AppState] Today's date for expiration check: ${today.toISOString().split('T')[0]}`);
      const offers = Array.isArray(localData.offers) ? localData.offers : [];
      console.log(`[AppState] Checking ${offers.length} offers for expiration`);
      let removed = 0;
      const filtered = offers.filter((offer: any) => {
        const expires = offer?.expires || offer?.['EXPIRES'] || offer?.['Expires'] || offer?.['Expiration Date'] || offer?.['OFFER EXPIRE DATE'];
        if (!expires) {
          console.log(`[AppState] Offer ${offer?.offerCode || offer?.['OFFER CODE'] || 'unknown'} has no expiration date, keeping`);
          return true;
        }
        
        // Handle different date formats: YYYY-MM-DD (ISO), MM-DD-YYYY, or full ISO string
        let d: Date;
        const dateStr = String(expires).trim();
        
        // Try ISO date format first: YYYY-MM-DD or YYYY-MM-DDTHH:MM:SS
        if (/^\d{4}-\d{2}-\d{2}/.test(dateStr)) {
          // ISO format: parse directly (already in correct format)
          d = new Date(dateStr);
          // For YYYY-MM-DD format, ensure we're using UTC to avoid timezone issues
          if (!dateStr.includes('T')) {
            const [year, month, day] = dateStr.split('-').map(s => parseInt(s, 10));
            d = new Date(year, month - 1, day); // month is 0-indexed
          }
        }
        // Try MM-DD-YYYY format (common in Excel exports)
        else if (/^\d{1,2}-\d{1,2}-\d{4}$/.test(dateStr)) {
          const [month, day, year] = dateStr.split('-').map(s => parseInt(s, 10));
          d = new Date(year, month - 1, day); // month is 0-indexed
        }
        // Try MM/DD/YYYY with slashes
        else if (/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(dateStr)) {
          const [month, day, year] = dateStr.split('/').map(s => parseInt(s, 10));
          d = new Date(year, month - 1, day); // month is 0-indexed
        }
        // Fallback to default Date parsing
        else {
          d = new Date(dateStr);
        }
        
        if (Number.isNaN(d.getTime())) {
          console.log(`[AppState] Offer ${offer?.offerCode || offer?.['OFFER CODE'] || 'unknown'} has invalid date '${expires}', keeping`);
          return true;
        }
        d.setHours(0, 0, 0, 0);
        const keep = d.getTime() >= today.getTime();
        console.log(`[AppState] Offer ${offer?.offerCode || offer?.['OFFER CODE'] || 'unknown'}: expires=${expires}, parsed=${d.toISOString().split('T')[0]}, today=${today.toISOString().split('T')[0]}, keep=${keep}`);
        if (!keep) removed += 1;
        return keep;
      });
      if (removed > 0) {
        const newLocalData = { ...localData, offers: filtered };
        setLocalData(newLocalData);
        await AsyncStorage.setItem(k(STORAGE_KEYS.LOCAL_OFFERS), JSON.stringify(filtered));
        console.log(`[AppState] Removed ${removed} expired offers`);
      } else {
        console.log('[AppState] No expired offers to remove');
      }
      return removed;
    } catch (e) {
      console.error('[AppState] cleanExpiredOffers failed', e);
      return 0;
    }
  }, [localData]);

  const updateOffers = React.useCallback(async (offers: any[]) => {
    try {
      console.log('[AppState] Updating offers set. Incoming count:', Array.isArray(offers) ? offers.length : 0);
      const safeOffers = Array.isArray(offers) ? offers : [];
      const newLocalData = { ...localData, offers: safeOffers };
      setLocalData(newLocalData);
      const key = k(STORAGE_KEYS.LOCAL_OFFERS);
      await AsyncStorage.setItem(key, JSON.stringify(safeOffers));
      console.log('[AppState] ✅ Offers updated and persisted to key:', key, 'count:', safeOffers.length);
      
      // Verify persistence
      const verify = await AsyncStorage.getItem(key);
      if (verify) {
        const parsed = JSON.parse(verify);
        console.log('[AppState] ✅ Verified offers persistence:', parsed.length, 'offers');
      } else {
        console.error('[AppState] ❌ Offers verification failed: No data found');
      }
    } catch (error) {
      console.error('[AppState] Failed to update offers:', error);
      throw error;
    }
  }, [localData, k]);

  const updateClubRoyaleProfile = React.useCallback(async (updates: Partial<ClubRoyaleProfile>) => {
    try {
      console.log('[AppState] Updating Club Royale profile:', updates);
      
      const updatedProfile = {
        ...clubRoyaleProfile,
        ...updates,
        updatedAt: new Date().toISOString()
      };
      
      setClubRoyaleProfile(updatedProfile);
      
      // Update local data as well
      const newLocalData = {
        ...localData,
        clubRoyaleProfile: updatedProfile
      };
      setLocalData(newLocalData);
      
      // Persist to AsyncStorage
      await AsyncStorage.setItem(k(STORAGE_KEYS.CLUB_ROYALE_PROFILE), JSON.stringify(updatedProfile));
      
      console.log('[AppState] Successfully updated Club Royale profile');
    } catch (error) {
      console.error('[AppState] Failed to update Club Royale profile:', error);
      throw error;
    }
  }, [clubRoyaleProfile, localData]);

  return {
    settings,
    lastImportDate,
    localData,
    hasLocalData,
    isLoading,
    userPoints,
    loyaltyPoints,
    cruises: localData.cruises,
    clubRoyaleProfile,
    updateUserPoints,
    addPoints,
    updateLoyaltyPoints,
    updateClubRoyaleProfile,
    updateSettings,
    updateLastImportDate,
    refreshLocalData,
    syncFromBackend,
    updateCruise,
    addCruise,
    autoCompletePastCruises,
    cleanExpiredOffers,
    updateOffers,
    bookCruise,
    unbookCruise,
    markCruiseCompleted,
  };
});