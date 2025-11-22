import React from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import createContextHook from "@nkzw/create-context-hook";

export interface UserProfile {
  id: string;
  name: string;
  isOwner?: boolean;
  avatarUrl?: string;
  createdAt: string;
  updatedAt: string;
}

interface UserState {
  users: UserProfile[];
  currentUserId: string | null;
  currentUser: UserProfile | null;
  isLoading: boolean;
  addUser: (user: { id?: string; name: string; avatarUrl?: string }) => Promise<UserProfile>;
  switchUser: (userId: string) => Promise<void>;
  removeUser: (userId: string) => Promise<void>;
  ensureOwner: () => Promise<UserProfile>;
}

const KEYS = {
  USERS: "@users:list",
  CURRENT: "@users:current",
  OWNER: "@users:owner",
};

export const [UserProvider, useUser] = createContextHook<UserState>(() => {
  const [users, setUsers] = React.useState<UserProfile[]>([]);
  const [currentUserId, setCurrentUserId] = React.useState<string | null>(null);
  const [isLoading, setIsLoading] = React.useState<boolean>(true);

  const currentUser = React.useMemo(() => users.find(u => u.id === currentUserId) ?? null, [users, currentUserId]);

  const persist = React.useCallback(async (nextUsers: UserProfile[], nextId: string | null) => {
    await AsyncStorage.setItem(KEYS.USERS, JSON.stringify(nextUsers));
    if (nextId) {
      await AsyncStorage.setItem(KEYS.CURRENT, nextId);
    }
  }, []);

  const ensureOwner = React.useCallback(async (): Promise<UserProfile> => {
    try {
      const savedOwnerId = await AsyncStorage.getItem(KEYS.OWNER);
      const existingOwner = savedOwnerId ? users.find(u => u.id === savedOwnerId) : undefined;
      if (existingOwner) return existingOwner;

      const owner: UserProfile = {
        id: savedOwnerId || "owner",
        name: "Me",
        isOwner: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      const nextUsers = users.length ? users : [owner];
      if (!users.length) {
        await AsyncStorage.setItem(KEYS.USERS, JSON.stringify(nextUsers));
      }
      await AsyncStorage.setItem(KEYS.OWNER, owner.id);
      if (!currentUserId) {
        await AsyncStorage.setItem(KEYS.CURRENT, owner.id);
        setCurrentUserId(owner.id);
      }
      if (!existingOwner && !users.find(u => u.id === owner.id)) {
        setUsers(prev => [...prev, owner]);
      }
      return owner;
    } catch (e) {
      console.error("[UserProvider] ensureOwner failed", e);
      const fallback: UserProfile = {
        id: "owner",
        name: "Me",
        isOwner: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      if (!users.find(u => u.id === fallback.id)) setUsers(prev => [...prev, fallback]);
      if (!currentUserId) setCurrentUserId(fallback.id);
      return fallback;
    }
  }, [users, currentUserId]);

  React.useEffect(() => {
    const load = async () => {
      try {
        const [rawUsers, rawCurrent, rawOwner] = await Promise.all([
          AsyncStorage.getItem(KEYS.USERS),
          AsyncStorage.getItem(KEYS.CURRENT),
          AsyncStorage.getItem(KEYS.OWNER),
        ]);
        let list: UserProfile[] = [];
        if (rawUsers) {
          try {
            const parsed = JSON.parse(rawUsers);
            if (Array.isArray(parsed)) list = parsed as UserProfile[];
          } catch (e) {
            console.warn("[UserProvider] Malformed users list, resetting");
            await AsyncStorage.removeItem(KEYS.USERS);
          }
        }
        if (!list.length) {
          const owner: UserProfile = {
            id: rawOwner || "owner",
            name: "Me",
            isOwner: true,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          };
          list = [owner];
          await AsyncStorage.setItem(KEYS.USERS, JSON.stringify(list));
          if (!rawOwner) await AsyncStorage.setItem(KEYS.OWNER, owner.id);
        }
        setUsers(list);
        const id = rawCurrent || list[0]?.id || null;
        setCurrentUserId(id);
        if (!rawCurrent && id) await AsyncStorage.setItem(KEYS.CURRENT, id);
      } catch (e) {
        console.error("[UserProvider] Failed to load", e);
      } finally {
        setIsLoading(false);
      }
    };
    load();
  }, []);

  const addUser = React.useCallback(async (user: { id?: string; name: string; avatarUrl?: string }) => {
    const id = user.id ?? `user_${Date.now()}`;
    const profile: UserProfile = {
      id,
      name: user.name,
      avatarUrl: user.avatarUrl,
      isOwner: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    const next = [...users, profile];
    setUsers(next);
    await persist(next, currentUserId);
    
    // Reset Club Royale and Crown & Anchor points for the new user
    const newUserPrefix = `${id}:`;
    try {
      await AsyncStorage.setItem(`${newUserPrefix}@user_points`, '0');
      await AsyncStorage.setItem(`${newUserPrefix}@loyalty_points`, '0');
      await AsyncStorage.removeItem(`${newUserPrefix}@club_royale_profile`);
      console.log(`[UserProvider] Reset Club Royale and Crown & Anchor points for user ${id}`);
    } catch (error) {
      console.error(`[UserProvider] Failed to reset points for user ${id}:`, error);
    }
    
    return profile;
  }, [users, currentUserId, persist]);

  const switchUser = React.useCallback(async (userId: string) => {
    if (userId === currentUserId) return;
    setCurrentUserId(userId);
    await AsyncStorage.setItem(KEYS.CURRENT, userId);
  }, [currentUserId]);

  const removeUser = React.useCallback(async (userId: string) => {
    const next = users.filter(u => u.id !== userId);
    setUsers(next);
    let nextId = currentUserId;
    if (currentUserId === userId) {
      nextId = next[0]?.id ?? null;
      setCurrentUserId(nextId);
      if (nextId) await AsyncStorage.setItem(KEYS.CURRENT, nextId);
    }
    await persist(next, nextId);
  }, [users, currentUserId, persist]);

  return {
    users,
    currentUserId,
    currentUser,
    isLoading,
    addUser,
    switchUser,
    removeUser,
    ensureOwner,
  };
});
