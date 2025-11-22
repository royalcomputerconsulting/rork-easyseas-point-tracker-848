import React, { useEffect, useMemo } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import createContextHook from '@nkzw/create-context-hook';

export type Cohort = 'all' | 'last12m' | 'custom';

export interface FiltersState {
  cohort: Cohort;
  dateFrom: string | null;
  dateTo: string | null;
  ships: string[];
  ports: string[];
  cabinTypes: string[];
  tags: string[];
  hasReceipts: boolean | null;
  hasStatements: boolean | null;
  maxBudget: number | null;
}

interface FiltersContextValue {
  filters: FiltersState;
  setFilters: (next: FiltersState) => void;
  update: (patch: Partial<FiltersState>) => void;
  clearAll: () => void;
}

const STORAGE_KEY = '@session_filters_v1';

const defaultState: FiltersState = {
  cohort: 'all',
  dateFrom: null,
  dateTo: null,
  ships: [],
  ports: [],
  cabinTypes: [],
  tags: [],
  hasReceipts: null,
  hasStatements: null,
  maxBudget: null,
};

export const [FiltersProvider, useFilters] = createContextHook<FiltersContextValue>(() => {
  const [filters, setFiltersState] = React.useState<FiltersState>(defaultState);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(STORAGE_KEY);
        if (!mounted) return;
        if (raw) {
          const parsed = JSON.parse(raw);
          const merged: FiltersState = {
            cohort: (parsed?.cohort as Cohort) ?? 'all',
            dateFrom: parsed?.dateFrom ?? null,
            dateTo: parsed?.dateTo ?? null,
            ships: Array.isArray(parsed?.ships) ? parsed.ships : [],
            ports: Array.isArray(parsed?.ports) ? parsed.ports : [],
            cabinTypes: Array.isArray(parsed?.cabinTypes) ? parsed.cabinTypes : [],
            tags: Array.isArray(parsed?.tags) ? parsed.tags : [],
            hasReceipts: typeof parsed?.hasReceipts === 'boolean' ? parsed.hasReceipts : null,
            hasStatements: typeof parsed?.hasStatements === 'boolean' ? parsed.hasStatements : null,
            maxBudget: typeof parsed?.maxBudget === 'number' ? parsed.maxBudget : null,
          };
          setFiltersState(merged);
        }
      } catch (e) {
        console.error('[Filters] Failed to load filters', e);
      }
    })();
    return () => { mounted = false; };
  }, []);

  useEffect(() => {
    (async () => {
      try {
        await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(filters));
      } catch (e) {
        console.error('[Filters] Failed to persist filters', e);
      }
    })();
  }, [filters]);

  const setFilters = React.useCallback((next: FiltersState) => {
    console.log('[Filters] setFilters', next);
    setFiltersState(next);
  }, []);

  const update = React.useCallback((patch: Partial<FiltersState>) => {
    setFiltersState((prev) => ({ ...prev, ...patch }));
  }, []);

  const clearAll = React.useCallback(() => {
    setFiltersState(defaultState);
  }, []);

  return { filters, setFilters, update, clearAll };
});

export function useFiltersHash(): string {
  const { filters } = useFilters();
  const str = useMemo(() => JSON.stringify({ ...filters, ships: [...filters.ships].sort(), ports: [...filters.ports].sort(), cabinTypes: [...filters.cabinTypes].sort(), tags: [...filters.tags].sort() }), [filters]);
  let h = 5381 >>> 0;
  for (let i = 0; i < str.length; i++) h = ((h << 5) + h + str.charCodeAt(i)) >>> 0;
  return ('00000000' + h.toString(16)).slice(-8);
}
