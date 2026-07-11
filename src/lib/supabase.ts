import 'react-native-url-polyfill/auto';

import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { Platform } from 'react-native';

const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
const anonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

/**
 * True only when both env vars are present. When false the whole app runs
 * local-only (no auth, no cloud sync) so it never hard-crashes on a missing
 * config — see `auth.tsx` and `use-habits.tsx` for the fallbacks.
 */
export const isSupabaseConfigured = Boolean(url && anonKey);

/**
 * During static web rendering the code runs in Node, where `window` (and thus
 * AsyncStorage's web build) is unavailable — touching it crashes the render.
 * Fall back to an in-memory store there; native and the browser keep using
 * AsyncStorage so sessions persist normally.
 */
const isServer = Platform.OS === 'web' && typeof window === 'undefined';

function memoryStorage() {
  const m = new Map<string, string>();
  return {
    getItem: (k: string) => Promise.resolve(m.get(k) ?? null),
    setItem: (k: string, v: string) => {
      m.set(k, v);
      return Promise.resolve();
    },
    removeItem: (k: string) => {
      m.delete(k);
      return Promise.resolve();
    },
  };
}

export const supabase: SupabaseClient | null = isSupabaseConfigured
  ? createClient(url as string, anonKey as string, {
      auth: {
        storage: isServer ? memoryStorage() : AsyncStorage,
        autoRefreshToken: !isServer,
        persistSession: !isServer,
        // No URL-based session detection on native.
        detectSessionInUrl: false,
      },
    })
  : null;
