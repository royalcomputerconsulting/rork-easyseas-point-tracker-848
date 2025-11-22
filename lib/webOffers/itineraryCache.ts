import AsyncStorage from "@react-native-async-storage/async-storage";

export interface ItineraryData {
  id: string;
  itineraryCode?: string;
  sailDate?: string;
  ship?: {
    name: string;
    shipCode: string;
  };
  itinerary?: {
    nights: number;
    days: Array<{
      arrivalDate: string;
      dayOfWeek: string;
      departureDate: string;
      duration: number;
      order: number;
      ports: Array<{
        arrivalTime?: string;
        departureTime?: string;
        isOvernight: boolean;
        name: string;
        portCode: string;
      }>;
    }>;
  };
  taxesAndFees?: {
    base?: { amount: number; currencyCode: string };
    total?: { amount: number; currencyCode: string };
  };
  price?: {
    interior?: { total?: { amount: number; currencyCode: string } };
    oceanview?: { total?: { amount: number; currencyCode: string } };
    balcony?: { total?: { amount: number; currencyCode: string } };
    suite?: { total?: { amount: number; currencyCode: string } };
  };
  bookingUrl?: string;
  enrichedAt?: string;
}

const CACHE_KEY_PREFIX = "itinerary-cache-";
const CACHE_EXPIRY_DAYS = 7;

export class ItineraryCache {
  async get(sailingId: string): Promise<ItineraryData | null> {
    try {
      const cacheKey = `${CACHE_KEY_PREFIX}${sailingId}`;
      const cached = await AsyncStorage.getItem(cacheKey);
      if (!cached) return null;

      const data: ItineraryData = JSON.parse(cached);

      if (data.enrichedAt) {
        const enrichedTime = new Date(data.enrichedAt).getTime();
        const now = new Date().getTime();
        const daysSinceEnrich =
          (now - enrichedTime) / (1000 * 60 * 60 * 24);

        if (daysSinceEnrich > CACHE_EXPIRY_DAYS) {
          console.log(
            "[ItineraryCache] Cache expired for:",
            sailingId,
            "days:",
            daysSinceEnrich.toFixed(1)
          );
          await AsyncStorage.removeItem(cacheKey);
          return null;
        }
      }

      return data;
    } catch (error) {
      console.error("[ItineraryCache] Error reading cache:", error);
      return null;
    }
  }

  async set(sailingId: string, data: ItineraryData): Promise<void> {
    try {
      const cacheKey = `${CACHE_KEY_PREFIX}${sailingId}`;
      const enrichedData = {
        ...data,
        enrichedAt: new Date().toISOString(),
      };
      await AsyncStorage.setItem(cacheKey, JSON.stringify(enrichedData));
      console.log("[ItineraryCache] Cached itinerary for:", sailingId);
    } catch (error) {
      console.error("[ItineraryCache] Error writing cache:", error);
    }
  }

  async getMany(sailingIds: string[]): Promise<Map<string, ItineraryData>> {
    const result = new Map<string, ItineraryData>();

    await Promise.all(
      sailingIds.map(async (id) => {
        const data = await this.get(id);
        if (data) {
          result.set(id, data);
        }
      })
    );

    return result;
  }

  async setMany(entries: Array<{ id: string; data: ItineraryData }>): Promise<void> {
    await Promise.all(
      entries.map((entry) => this.set(entry.id, entry.data))
    );
  }

  async clear(): Promise<void> {
    try {
      const keys = await AsyncStorage.getAllKeys();
      const cacheKeys = keys.filter((key) =>
        key.startsWith(CACHE_KEY_PREFIX)
      );
      await AsyncStorage.multiRemove(cacheKeys);
      console.log("[ItineraryCache] Cleared", cacheKeys.length, "entries");
    } catch (error) {
      console.error("[ItineraryCache] Error clearing cache:", error);
    }
  }

  createFallbackKey(itineraryCode: string, sailDate: string): string {
    return `${itineraryCode}_${sailDate}`;
  }

  async findStaleIds(sailingIds: string[]): Promise<string[]> {
    const stale: string[] = [];

    await Promise.all(
      sailingIds.map(async (id) => {
        const data = await this.get(id);
        if (!data) {
          stale.push(id);
        }
      })
    );

    return stale;
  }
}

export const itineraryCache = new ItineraryCache();
