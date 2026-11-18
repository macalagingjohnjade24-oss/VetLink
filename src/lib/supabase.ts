import 'react-native-url-polyfill/auto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { normalizeSupabaseKey, normalizeSupabaseUrl, supabaseKeyProblem, supabaseUrlProblem } from './supabaseConfig';

const url = normalizeSupabaseUrl(process.env.EXPO_PUBLIC_SUPABASE_URL ?? '');
const anonKey = normalizeSupabaseKey(process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? '');

/** A present-but-malformed value would 401 or crash, so it is reported instead. */
const configProblem = supabaseUrlProblem(url) ?? supabaseKeyProblem(anonKey);

/** True once both EXPO_PUBLIC_SUPABASE_* variables are present and plausible. */
export const isSupabaseConfigured =
  Boolean(url && anonKey) && !url.includes('your-project-ref') && !anonKey.startsWith('your-') && !configProblem;

export const BACKEND_SETUP_MESSAGE = configProblem
  ? `${configProblem} VetLink stays in offline mode until this is fixed. Setup steps: supabase/README.md.`
  : 'VetLink is not connected to Supabase yet. Add EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY to the project .env file, then restart Expo. Setup steps: supabase/README.md.';

/** Paths the Supabase auth redirects land on (app scheme is `vetlink` in app.json). */
export const AUTH_REDIRECT = {
  callbackPath: 'auth-callback',
  recoveryPath: 'reset-password',
} as const;

/** "Remember me" is a session-persistence switch, never a stored password. */
const REMEMBER_KEY = 'vetlink.auth.remember.v1';
const memorySession = new Map<string, string>();
let keepSession = true;

/**
 * Supabase auth storage adapter:
 * - Remember me checked  → the session is written to AsyncStorage and survives restarts.
 * - Remember me unchecked → the session only lives in memory, so a restart signs the user out.
 * The preference itself is persisted (a boolean, not a credential).
 */
const authStorage = {
  getItem: async (key: string): Promise<string | null> => {
    const memo = memorySession.get(key);
    if (memo !== undefined) return memo;
    try {
      return await AsyncStorage.getItem(key);
    } catch {
      return null;
    }
  },
  setItem: async (key: string, value: string): Promise<void> => {
    try {
      if (keepSession) {
        memorySession.delete(key);
        await AsyncStorage.setItem(key, value);
      } else {
        memorySession.set(key, value);
        await AsyncStorage.removeItem(key);
      }
    } catch {
      memorySession.set(key, value);
    }
  },
  removeItem: async (key: string): Promise<void> => {
    memorySession.delete(key);
    try {
      await AsyncStorage.removeItem(key);
    } catch {
      // Best effort: the in-memory copy is already gone.
    }
  },
};

export const sessionPersistence = {
  /** Read the saved Remember me choice before the first session restore. */
  async load(): Promise<boolean> {
    try {
      keepSession = (await AsyncStorage.getItem(REMEMBER_KEY)) !== 'false';
    } catch {
      keepSession = true;
    }
    return keepSession;
  },
  async setRemember(remember: boolean): Promise<void> {
    keepSession = remember;
    if (!remember) {
      // Switching Remember me off must not leave an older persisted session behind.
      try {
        const keys = await AsyncStorage.getAllKeys();
        const sessionKeys = keys.filter((key) => key.startsWith('sb-') && key.includes('auth-token'));
        if (sessionKeys.length) await AsyncStorage.multiRemove(sessionKeys);
      } catch {
        // Non-fatal.
      }
    }
    try {
      await AsyncStorage.setItem(REMEMBER_KEY, remember ? 'true' : 'false');
    } catch {
      // Non-fatal: the current process still honours the choice.
    }
  },
  isRemembering(): boolean {
    return keepSession;
  },
};

export const supabase: SupabaseClient | null = isSupabaseConfigured
  ? createClient(url, anonKey, {
      auth: {
        storage: authStorage,
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: false,
        flowType: 'pkce',
      },
      global: { headers: { 'X-Client-Info': 'vetlink-expo' } },
    })
  : null;

/** Every data/auth service funnels through this so a missing config fails loudly. */
export function requireSupabase(): SupabaseClient {
  if (!supabase) throw new Error(BACKEND_SETUP_MESSAGE);
  return supabase;
}

export const TABLES = {
  profiles: 'profiles',
  clinics: 'clinics',
  clinicServices: 'clinic_services',
  pets: 'pets',
  appointments: 'appointments',
  medicalRecords: 'medical_records',
  vaccinations: 'vaccinations',
  notifications: 'notifications',
  inquiries: 'inquiries',
  inquiryMessages: 'inquiry_messages',
  clinicMemberships: 'clinic_memberships',
} as const;

export const BUCKETS = {
  profilePhotos: 'profile-photos',
  petPhotos: 'pet-photos',
  medicalAttachments: 'medical-record-attachments',
  clinicLogos: 'clinic-logos',
} as const;
