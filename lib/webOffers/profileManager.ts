import AsyncStorage from "@react-native-async-storage/async-storage";

const PROFILE_IDS_KEY = "gobo-profile-ids";

interface ProfileIdMap {
  [profileKey: string]: number;
}

export class ProfileIdManager {
  private profileIds: ProfileIdMap = {};
  private nextId: number = 1;
  private loaded: boolean = false;

  async load(): Promise<void> {
    if (this.loaded) return;

    try {
      const data = await AsyncStorage.getItem(PROFILE_IDS_KEY);
      if (data) {
        const parsed = JSON.parse(data);
        this.profileIds = parsed.profileIds || {};
        this.nextId = parsed.nextId || 1;
      }
      this.loaded = true;
      console.log("[ProfileIdManager] Loaded profile IDs:", this.profileIds);
    } catch (error) {
      console.error("[ProfileIdManager] Error loading profile IDs:", error);
      this.profileIds = {};
      this.nextId = 1;
      this.loaded = true;
    }
  }

  async save(): Promise<void> {
    try {
      const data = {
        profileIds: this.profileIds,
        nextId: this.nextId,
      };
      await AsyncStorage.setItem(PROFILE_IDS_KEY, JSON.stringify(data));
      console.log("[ProfileIdManager] Saved profile IDs");
    } catch (error) {
      console.error("[ProfileIdManager] Error saving profile IDs:", error);
    }
  }

  async getOrCreateId(profileKey: string): Promise<number> {
    await this.load();

    if (this.profileIds[profileKey]) {
      return this.profileIds[profileKey];
    }

    const newId = this.nextId++;
    this.profileIds[profileKey] = newId;
    await this.save();

    console.log("[ProfileIdManager] Assigned ID", newId, "to", profileKey);
    return newId;
  }

  async getId(profileKey: string): Promise<number | null> {
    await this.load();
    return this.profileIds[profileKey] || null;
  }

  async getAllProfiles(): Promise<{ key: string; id: number }[]> {
    await this.load();
    return Object.entries(this.profileIds).map(([key, id]) => ({ key, id }));
  }

  async removeProfile(profileKey: string): Promise<void> {
    await this.load();
    delete this.profileIds[profileKey];
    await this.save();
    console.log("[ProfileIdManager] Removed profile:", profileKey);
  }

  async clear(): Promise<void> {
    this.profileIds = {};
    this.nextId = 1;
    this.loaded = false;
    await AsyncStorage.removeItem(PROFILE_IDS_KEY);
    console.log("[ProfileIdManager] Cleared all profile IDs");
  }
}

export const profileIdManager = new ProfileIdManager();
