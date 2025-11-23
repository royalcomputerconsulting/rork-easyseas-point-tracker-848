import { useState, useEffect, useCallback, useMemo } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import createContextHook from '@nkzw/create-context-hook';
import type { UnifiedCruise, CasinoOffer } from '@/types/models';
import { useUser } from './UserProvider';

export interface CelebrityState {
  captainsClubLevel: string;
  captainsClubPoints: number;
  blueChipLevel: string;
  blueChipPoints: number;
  cruises: UnifiedCruise[];
  bookedCruises: UnifiedCruise[];
  offers: CasinoOffer[];
}

const DEFAULT_STATE: CelebrityState = {
  captainsClubLevel: 'Elite Plus',
  captainsClubPoints: 1024,
  blueChipLevel: 'Onyx',
  blueChipPoints: 0,
  cruises: [],
  bookedCruises: [],
  offers: [],
};

export const [CelebrityProvider, useCelebrity] = createContextHook(() => {
  const { currentUserId } = useUser();
  const [state, setState] = useState<CelebrityState>(DEFAULT_STATE);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  const getStorageKey = useCallback((userId: string | null) => {
    return `@celebrity_data:${userId || 'owner'}`;
  }, []);

  const loadData = useCallback(async (userId: string | null) => {
    if (!userId) {
      console.log('[CelebrityProvider] No user ID, skipping load');
      setIsLoading(false);
      return;
    }

    console.log('[CelebrityProvider] Loading data for user:', userId);
    try {
      const stored = await AsyncStorage.getItem(getStorageKey(userId));
      if (stored) {
        const parsed = JSON.parse(stored) as CelebrityState;
        console.log('[CelebrityProvider] Loaded data:', {
          captainsClubLevel: parsed.captainsClubLevel,
          captainsClubPoints: parsed.captainsClubPoints,
          blueChipLevel: parsed.blueChipLevel,
          blueChipPoints: parsed.blueChipPoints,
          cruises: parsed.cruises?.length || 0,
          offers: parsed.offers?.length || 0,
        });
        setState(parsed);
      } else {
        console.log('[CelebrityProvider] No data found for user, using defaults');
        setState(DEFAULT_STATE);
      }
    } catch (error) {
      console.error('[CelebrityProvider] Failed to load data:', error);
      setState(DEFAULT_STATE);
    } finally {
      setIsLoading(false);
    }
  }, [getStorageKey]);

  useEffect(() => {
    loadData(currentUserId);
  }, [currentUserId, loadData]);

  const saveData = useCallback(async (newState: CelebrityState) => {
    if (!currentUserId) {
      console.warn('[CelebrityProvider] No user ID, cannot save data');
      return;
    }

    try {
      const key = getStorageKey(currentUserId);
      await AsyncStorage.setItem(key, JSON.stringify(newState));
      setState(newState);
      console.log('[CelebrityProvider] Saved data for user:', currentUserId);
    } catch (error) {
      console.error('[CelebrityProvider] Failed to save data:', error);
    }
  }, [currentUserId, getStorageKey]);

  const updateCaptainsClubPoints = useCallback((points: number) => {
    const newState = { ...state, captainsClubPoints: points };
    saveData(newState);
  }, [state, saveData]);

  const updateBlueChipPoints = useCallback((points: number) => {
    const newState = { ...state, blueChipPoints: points };
    saveData(newState);
  }, [state, saveData]);

  const setCruises = useCallback(async (cruises: UnifiedCruise[]) => {
    if (!currentUserId) {
      console.warn('[CelebrityProvider] No user ID, cannot save cruises');
      return;
    }

    console.log('[CelebrityProvider] setCruises called with', cruises.length, 'cruises');
    
    try {
      setState((prevState) => {
        const newState = { ...prevState, cruises };
        console.log('[CelebrityProvider] New state will be:', { cruisesCount: newState.cruises.length });
        
        const key = getStorageKey(currentUserId);
        AsyncStorage.setItem(key, JSON.stringify(newState))
          .then(() => {
            console.log('[CelebrityProvider] ✅ AsyncStorage write successful for user:', currentUserId);
            return AsyncStorage.getItem(key);
          })
          .then((verified) => {
            if (verified) {
              const parsed = JSON.parse(verified);
              console.log('[CelebrityProvider] ✅ Verified stored data has', parsed.cruises?.length || 0, 'cruises');
            }
          })
          .catch((error) => {
            console.error('[CelebrityProvider] ❌ Failed to save cruises:', error);
          });
        
        return newState;
      });
    } catch (error) {
      console.error('[CelebrityProvider] ❌ Failed to update cruises:', error);
      throw error;
    }
  }, [currentUserId, getStorageKey]);

  const setBookedCruises = useCallback(async (bookedCruises: UnifiedCruise[]) => {
    if (!currentUserId) {
      console.warn('[CelebrityProvider] No user ID, cannot save booked cruises');
      return;
    }

    setState((prevState) => {
      const newState = { ...prevState, bookedCruises };
      const key = getStorageKey(currentUserId);
      AsyncStorage.setItem(key, JSON.stringify(newState)).catch(error => {
        console.error('[CelebrityProvider] Failed to save booked cruises:', error);
      });
      return newState;
    });
  }, [currentUserId, getStorageKey]);

  const setOffers = useCallback(async (offers: CasinoOffer[]) => {
    if (!currentUserId) {
      console.warn('[CelebrityProvider] No user ID, cannot save offers');
      return;
    }

    console.log('[CelebrityProvider] setOffers called with', offers.length, 'offers');
    
    try {
      setState((prevState) => {
        const newState = { ...prevState, offers };
        console.log('[CelebrityProvider] New state will be:', { offersCount: newState.offers.length });
        
        const key = getStorageKey(currentUserId);
        AsyncStorage.setItem(key, JSON.stringify(newState))
          .then(() => {
            console.log('[CelebrityProvider] ✅ AsyncStorage write successful for user:', currentUserId);
            return AsyncStorage.getItem(key);
          })
          .then((verified) => {
            if (verified) {
              const parsed = JSON.parse(verified);
              console.log('[CelebrityProvider] ✅ Verified stored data has', parsed.offers?.length || 0, 'offers');
            }
          })
          .catch((error) => {
            console.error('[CelebrityProvider] ❌ Failed to save offers:', error);
          });
        
        return newState;
      });
    } catch (error) {
      console.error('[CelebrityProvider] ❌ Failed to update offers:', error);
      throw error;
    }
  }, [currentUserId, getStorageKey]);

  const addCruise = useCallback((cruise: UnifiedCruise) => {
    const newState = { ...state, cruises: [...state.cruises, cruise] };
    saveData(newState);
  }, [state, saveData]);

  const addBookedCruise = useCallback((cruise: UnifiedCruise) => {
    const newState = { ...state, bookedCruises: [...state.bookedCruises, cruise] };
    saveData(newState);
  }, [state, saveData]);

  const addOffer = useCallback((offer: CasinoOffer) => {
    const newState = { ...state, offers: [...state.offers, offer] };
    saveData(newState);
  }, [state, saveData]);

  const reset = useCallback(async () => {
    await saveData(DEFAULT_STATE);
  }, [saveData]);

  return useMemo(() => ({
    ...state,
    isLoading,
    updateCaptainsClubPoints,
    updateBlueChipPoints,
    setCruises,
    setBookedCruises,
    setOffers,
    addCruise,
    addBookedCruise,
    addOffer,
    reset,
  }), [state, isLoading, updateCaptainsClubPoints, updateBlueChipPoints, setCruises, setBookedCruises, setOffers, addCruise, addBookedCruise, addOffer, reset]);
});
