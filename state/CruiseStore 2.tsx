import React from "react";
import { Platform } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import createContextHook from "@nkzw/create-context-hook";
import { Cruise } from "@/types/models";
import { useUser } from "@/state/UserProvider";
// Note: Do not seed from static files. Persistence relies on AsyncStorage and optional web DB.

interface CruiseStoreState {
  cruises: Cruise[];
  isLoading: boolean;
  error: string | null;
  // Fast lookups
  byShip: Record<string, Cruise[]>;
  getByShip: (ship: string) => Cruise[];
  getByShipAndDate: (ship: string, departureDate: string) => Cruise | undefined;
  // Mutations
  upsertCruises: (items: Cruise[]) => Promise<{ inserted: number; updated: number }>;
  deleteCruisesByOffer: (input: { offerCode?: string; offerName?: string }) => Promise<{ deleted: number }>;
  pruneExpired: () => Promise<{ deleted: number; remaining: number }>;
  reload: () => Promise<void>;
}

type WebDatabase = {
  version: number;
  users: Record<string, Cruise[]>;
};

const WEB_DB_FILE = "cruises.database.json";
const STORAGE_PREFIX = "@cruises:";

const todayIso = () => new Date().toISOString().slice(0, 10);

function loadLegacyLocalCruisesKeys(): Promise<Cruise[]> {
  return (async () => {
    try {
      const candidates = [
        '@local_cruises',
        'owner:@local_cruises',
      ];
      for (const key of candidates) {
        const raw = await AsyncStorage.getItem(key);
        if (!raw) continue;
        try {
          const parsed = JSON.parse(raw);
          if (Array.isArray(parsed)) {
            console.log('[CruiseStore] Loaded legacy cruises from', key, parsed.length);
            return parsed as Cruise[];
          }
        } catch {
          continue;
        }
      }
    } catch (e) {
      console.warn('[CruiseStore] loadLegacyLocalCruisesKeys error', e);
    }
    return [] as Cruise[];
  })();
}

const SHIPS_CANONICAL = [
  // Royal Caribbean (28)
  'ADVENTURE', 'ALLURE', 'ANTHEM', 'BRILLIANCE', 'ENCHANTMENT', 'EXPLORER', 'FREEDOM', 'GRANDEUR',
  'HARMONY', 'ICON', 'INDEPENDENCE', 'JEWEL', 'LEGEND', 'LIBERTY', 'MARINER', 'NAVIGATOR',
  'OASIS', 'ODYSSEY', 'OVATION', 'QUANTUM', 'RADIANCE', 'RHAPSODY', 'SERENADE', 'SHORESIDE',
  'SPECTRUM', 'STAR', 'SYMPHONY', 'UTOPIA', 'VISION', 'VOYAGER', 'WONDER',
  // Non-RC
  'CELEBRITY ECLIPSE', 'NIEUW AMSTERDAM'
] as const;

const normalizeShip = (name: string | undefined | null): string => {
  if (!name) return '';
  let clean = name.trim().toUpperCase();
  clean = clean.replace(/\s+OF\s+THE\s+SEAS/g, '').replace(/\s+/g, ' ').trim();
  // Map common prefixes like "ROYAL CARIBBEAN - LIBERTY OF THE SEAS"
  clean = clean.replace(/^ROYAL\s+CARIBBEAN\s+[-–]\s+/g, '');
  // Accept if exact match; otherwise try to extract last token that matches a ship
  if ((SHIPS_CANONICAL as readonly string[]).includes(clean)) return clean;
  // Try to find any canonical ship contained in string
  const hit = (SHIPS_CANONICAL as readonly string[]).find(s => clean.includes(s));
  return hit ?? clean;
};

const getCompositeKey = (c: Cruise): string => {
  const ship = (c.ship || "").trim().toLowerCase();
  const dep = (c.departureDate || "").slice(0, 10);
  const itin = (c.itineraryName || "").trim().toLowerCase();
  const code = (c.offerCode || "").trim().toLowerCase();
  const name = (c.offerName || "").trim().toLowerCase();
  return [ship, dep, itin, code, name].join("|");
};

async function loadFromWeb(userId: string): Promise<Cruise[]> {
  try {
    console.log(`[CruiseStore] Loading web DB for user ${userId}`);
    const res = await fetch(`/api/data/${WEB_DB_FILE}`, { 
      method: "GET", 
      headers: { "Cache-Control": "no-cache" } 
    });
    
    if (!res.ok) {
      if (res.status === 404) {
        console.log(`[CruiseStore] Web DB not found (404). Will create on first save.`);
        return [];
      }
      console.warn(`[CruiseStore] Web DB fetch failed (${res.status}). Using empty.`);
      return [];
    }
    
    const contentType = res.headers.get('content-type');
    if (!contentType || !contentType.includes('application/json')) {
      console.warn(`[CruiseStore] Unexpected content-type: ${contentType}. Using empty.`);
      return [];
    }
    
    const json = (await res.json()) as WebDatabase | Cruise[];
    if (Array.isArray(json)) {
      console.log("[CruiseStore] Legacy array format detected.");
      return json as Cruise[];
    }
    if (json && typeof json === "object" && "users" in json) {
      const db = json as WebDatabase;
      const userCruises = db.users[userId] ?? [];
      console.log(`[CruiseStore] Loaded ${userCruises.length} cruises for user ${userId}`);
      return userCruises;
    }
    return [];
  } catch (e) {
    console.error("[CruiseStore] Failed to load from web", e);
    return [];
  }
}

async function saveToWeb(userId: string, cruises: Cruise[]): Promise<void> {
  try {
    console.log(`[CruiseStore] Saving web DB for user ${userId} with ${cruises.length} cruises`);
    
    let existing: WebDatabase = { version: 1, users: {} };
    try {
      const res = await fetch(`/api/data/${WEB_DB_FILE}`, {
        headers: { "Cache-Control": "no-cache" }
      });
      if (res.ok) {
        const contentType = res.headers.get('content-type');
        if (contentType && contentType.includes('application/json')) {
          const json = await res.json();
          if (Array.isArray(json)) {
            existing = { version: 1, users: { [userId]: json as Cruise[] } };
          } else if (json && typeof json === "object" && "users" in json) {
            existing = json as WebDatabase;
          }
        }
      }
    } catch (err) {
      console.log("[CruiseStore] No existing web DB, will create new.");
    }
    
    existing.users[userId] = cruises;
    const body = JSON.stringify(existing, null, 2);
    
    const put = await fetch(`/api/data/${WEB_DB_FILE}`, { 
      method: "PUT", 
      body, 
      headers: { "Content-Type": "application/json" } 
    });
    
    if (!put.ok) {
      const errorText = await put.text().catch(() => 'Unable to read error');
      console.error(`[CruiseStore] Failed to write web DB (${put.status}):`, errorText);
    } else {
      console.log(`[CruiseStore] ✅ Successfully saved ${cruises.length} cruises for user ${userId}`);
    }
  } catch (e) {
    console.error("[CruiseStore] saveToWeb error", e);
  }
}

async function loadFromAsyncStorage(userId: string): Promise<Cruise[]> {
  try {
    const key = `${STORAGE_PREFIX}${userId}`;
    console.log(`[CruiseStore] Loading from AsyncStorage with key: ${key}`);
    const raw = await AsyncStorage.getItem(key);
    if (!raw) {
      console.log(`[CruiseStore] No data found in AsyncStorage for key: ${key}`);
      return [];
    }
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      console.log(`[CruiseStore] Loaded ${parsed.length} cruises from AsyncStorage`);
      return parsed as Cruise[];
    }
    console.warn(`[CruiseStore] Data in AsyncStorage is not an array`);
    return [];
  } catch (e) {
    console.error("[CruiseStore] loadFromAsyncStorage error", e);
    return [];
  }
}

async function saveToAsyncStorage(userId: string, cruises: Cruise[]): Promise<void> {
  try {
    const key = `${STORAGE_PREFIX}${userId}`;
    const data = JSON.stringify(cruises);
    console.log(`[CruiseStore] Saving ${cruises.length} cruises to AsyncStorage with key: ${key}`);
    await AsyncStorage.setItem(key, data);
    console.log(`[CruiseStore] ✅ AsyncStorage save complete for ${cruises.length} cruises`);
    
    // Verify the save
    const verify = await AsyncStorage.getItem(key);
    if (verify) {
      const parsed = JSON.parse(verify);
      console.log(`[CruiseStore] ✅ Verified: ${parsed.length} cruises saved successfully`);
    } else {
      console.error(`[CruiseStore] ❌ Verification failed: No data found after save`);
    }
  } catch (e) {
    console.error("[CruiseStore] saveToAsyncStorage error", e);
    throw e;
  }
}

export const [CruiseStoreProvider, useCruiseStore] = createContextHook<CruiseStoreState>(() => {
  const { currentUserId } = useUser();
  const [cruises, setCruises] = React.useState<Cruise[]>([]);
  const [isLoading, setIsLoading] = React.useState<boolean>(true);
  const [error, setError] = React.useState<string | null>(null);
  const [byShip, setByShip] = React.useState<Record<string, Cruise[]>>({});

  const persist = React.useCallback(async (next: Cruise[]) => {
    const userId = currentUserId ?? "owner";
    // Always use AsyncStorage for reliability
    await saveToAsyncStorage(userId, next);
    // Also save to web DB as backup (don't wait for it)
    if (Platform.OS === "web") {
      saveToWeb(userId, next).catch(e => console.warn('[CruiseStore] Web DB save failed (non-critical):', e));
    }
  }, [currentUserId]);

  const reload = React.useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const userId = currentUserId ?? "owner";
      let loaded = await loadFromAsyncStorage(userId);
      console.log(`[CruiseStore] Reloaded ${loaded.length} cruises from AsyncStorage`);
      if (!Array.isArray(loaded) || loaded.length === 0) {
        if (Platform.OS === 'web') {
          const web = await loadFromWeb(userId);
          if (web.length > 0) {
            await saveToAsyncStorage(userId, web);
            loaded = web;
          }
        }
      }
      if (!Array.isArray(loaded) || loaded.length === 0) {
        const legacy = await loadLegacyLocalCruisesKeys();
        if (legacy.length > 0) {
          await saveToAsyncStorage(userId, legacy);
          loaded = legacy;
        }
      }
      const applyMigrations = (list: Cruise[]): Cruise[] => {
        try {
          const patched = list.map((c) => {
            const ship = (c.ship ?? '').toLowerCase();
            const dep = (c.departureDate ?? '').slice(0,10);
            const isQuantumJan2026 = ship.includes('quantum') && (dep === '2026-01-07' || dep === '2026-01-16');
            if (isQuantumJan2026) {
              return {
                ...c,
                bookingId: undefined,
                reservationNumber: undefined,
                isBooked: false,
                updatedAt: new Date().toISOString(),
              } as Cruise;
            }
            return c;
          });
          return patched;
        } catch (e) {
          console.warn('[CruiseStore] applyMigrations failed', e);
          return list;
        }
      };

      const finalList = Array.isArray(loaded) ? loaded : [];
      const migrated = applyMigrations(finalList);
      if (migrated !== finalList) {
        await saveToAsyncStorage(userId, migrated);
      }
      setCruises(migrated);
    } catch (e) {
      console.error("[CruiseStore] reload error", e);
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setIsLoading(false);
    }
  }, [currentUserId]);

  React.useEffect(() => {
    const index: Record<string, Cruise[]> = {};
    for (const c of cruises) {
      const key = normalizeShip(c.ship);
      if (!key) continue;
      if (!index[key]) index[key] = [];
      index[key].push(c);
    }
    // Ensure keys exist for all canonical ships for O(1) empty reads
    for (const s of SHIPS_CANONICAL as readonly string[]) {
      if (!index[s]) index[s] = [];
    }
    setByShip(index);
    console.log('[CruiseStore] Built ship index for', Object.keys(index).length, 'ships');
  }, [cruises]);

  const hasInitialized = React.useRef(false);
  
  React.useEffect(() => {
    if (!hasInitialized.current) {
      hasInitialized.current = true;
      reload();
    }
  }, [reload]);

  const upsertCruises = React.useCallback(async (items: Cruise[]) => {
    console.log(`[CruiseStore] upsert ${items.length} cruises`);
    const byId = new Map<string, number>();
    const bySig = new Map<string, number>();
    const seenUnique: Set<string> = new Set<string>();
    const next = [...cruises];

    next.forEach((c, idx) => {
      if (c.id) byId.set(c.id, idx);
      bySig.set(getCompositeKey(c), idx);
    });

    let inserted = 0;
    let updated = 0;
    for (const item of items) {
      const sig = getCompositeKey(item);
      const idxById = item.id ? byId.get(item.id) : undefined;
      const idxBySig = bySig.get(sig);
      const idx = idxById ?? idxBySig;
      const now = new Date().toISOString();
      if (idx === undefined) {
        const fresh: Cruise = { ...item, createdAt: item.createdAt ?? now, updatedAt: now } as Cruise;
        next.push(fresh);
        const newIndex = next.length - 1;
        if (fresh.id) byId.set(fresh.id, newIndex);
        bySig.set(sig, newIndex);
        inserted += 1;
      } else {
        const merged: Cruise = { ...next[idx], ...item, updatedAt: now } as Cruise;
        next[idx] = merged;
        updated += 1;
      }
    }

    setCruises(next);
    await persist(next);
    return { inserted, updated };
  }, [cruises, persist]);

  const deleteCruisesByOffer = React.useCallback(async (input: { offerCode?: string; offerName?: string }) => {
    const code = input.offerCode?.trim().toLowerCase();
    const name = input.offerName?.trim().toLowerCase();
    const before = cruises.length;
    const next = cruises.filter(c => {
      const cCode = (c.offerCode ?? "").trim().toLowerCase();
      const cName = (c.offerName ?? "").trim().toLowerCase();
      let keep = true;
      if (code) keep = keep && cCode !== code;
      if (name) keep = keep && cName !== name;
      return keep;
    });
    const deleted = before - next.length;
    if (deleted > 0) {
      setCruises(next);
      await persist(next);
    }
    console.log(`[CruiseStore] deleteCruisesByOffer deleted=${deleted}`);
    return { deleted };
  }, [cruises, persist]);

  const pruneExpired = React.useCallback(async () => {
    const today = todayIso();
    const before = cruises.length;
    const next = cruises.filter((c) => {
      const exp = (c.offerExpirationDate ?? c.offerDetails?.expiryDate ?? null);
      let isExpired = false;
      if (exp) {
        const expDate = new Date(exp).toISOString().slice(0, 10);
        isExpired = expDate < today;
      }
      const anyOfferStatus = (c as unknown as { offerStatus?: string })?.offerStatus;
      const statusExpired = (typeof anyOfferStatus === "string" && anyOfferStatus.toLowerCase() === "expired");
      const shouldRemove = isExpired || statusExpired;
      if (shouldRemove) {
        return false; // drop
      }
      return true; // keep
    });
    const deleted = before - next.length;
    if (deleted > 0) {
      setCruises(next);
      await persist(next);
    }
    console.log(`[CruiseStore] pruneExpired deleted=${deleted}, remaining=${next.length}`);
    return { deleted, remaining: next.length };
  }, [cruises, persist]);

  const getByShip = React.useCallback((ship: string) => {
    const key = normalizeShip(ship);
    return byShip[key] ?? [];
  }, [byShip]);

  const getByShipAndDate = React.useCallback((ship: string, departureDate: string) => {
    const key = normalizeShip(ship);
    const dep = (departureDate || '').slice(0,10);
    const list = byShip[key] ?? [];
    return list.find(c => (c.departureDate || '').slice(0,10) === dep);
  }, [byShip]);

  return {
    cruises,
    isLoading,
    error,
    byShip,
    getByShip,
    getByShipAndDate,
    upsertCruises,
    deleteCruisesByOffer,
    pruneExpired,
    reload,
  };
});
