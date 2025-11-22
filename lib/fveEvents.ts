import { Platform } from 'react-native';

export type FveUpdatedPayload = {
  cruiseId: string;
  fveTotalUsd: number;
  roi: number; // 0..n, not percent
};

type Listener = (payload: FveUpdatedPayload) => void;

const listeners = new Set<Listener>();

export function onFveUpdated(listener: Listener) {
  listeners.add(listener);
  return () => {
    try {
      listeners.delete(listener);
    } catch (e) {
      if (Platform.OS === 'web') console.error('[FVE Events] unsubscribe error', e);
    }
  };
}

export function emitFveUpdated(payload: FveUpdatedPayload) {
  if (Platform.OS === 'web') console.log('[FVE Events] emitFveUpdated', payload);
  listeners.forEach((l) => {
    try {
      l(payload);
    } catch (e) {
      if (Platform.OS === 'web') console.error('[FVE Events] listener error', e);
    }
  });
}
