import { createClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL?.trim() ?? '';
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY?.trim() ?? '';

/** The console renders a setup notice instead of crashing when .env is missing. */
export const isSupabaseConfigured = Boolean(url && anonKey);

const REMEMBER_KEY = 'vetlink.console.remember';

/**
 * "Remember me" decides where the session lives: checked keeps it in
 * localStorage across restarts, unchecked keeps it in sessionStorage so closing
 * the tab signs the person out. No password is ever stored.
 */
export function setRemember(remember: boolean) {
  try {
    localStorage.setItem(REMEMBER_KEY, remember ? '1' : '0');
  } catch {
    /* storage can be blocked; the session still works for this tab */
  }
}

const sessionStorageAdapter = {
  getItem: (key: string): string | null => {
    try {
      return sessionStorage.getItem(key) ?? localStorage.getItem(key);
    } catch {
      return null;
    }
  },
  setItem: (key: string, value: string): void => {
    try {
      const remember = localStorage.getItem(REMEMBER_KEY);
      if (remember === '0') {
        sessionStorage.setItem(key, value);
        localStorage.removeItem(key);
      } else {
        localStorage.setItem(key, value);
        sessionStorage.removeItem(key);
      }
    } catch {
      /* ignore quota/private-mode failures */
    }
  },
  removeItem: (key: string): void => {
    try {
      sessionStorage.removeItem(key);
      localStorage.removeItem(key);
    } catch {
      /* ignore */
    }
  },
};

export const supabase = createClient(
  isSupabaseConfigured ? url : 'https://placeholder.supabase.co',
  isSupabaseConfigured ? anonKey : 'placeholder-anon-key',
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
      flowType: 'pkce',
      storage: sessionStorageAdapter,
    },
  },
);

export function friendlyAuthError(message: string): string {
  const normalised = message.toLowerCase();
  if (normalised.includes('invalid login credentials')) {
    return 'That email and password do not match a VetLink account.';
  }
  if (normalised.includes('email not confirmed')) {
    return 'Confirm your email address before signing in. Check your inbox for the six-digit code.';
  }
  if (normalised.includes('user already registered')) {
    return 'An account already uses that email address.';
  }
  if (normalised.includes('password should be at least')) {
    return 'Use a password with at least 8 characters.';
  }
  if (normalised.includes('rate limit') || normalised.includes('too many')) {
    return 'Too many attempts. Wait a moment and try again.';
  }
  if (normalised.includes('expired') || normalised.includes('invalid token')) {
    return 'That link has expired or was already used. Request a new one.';
  }
  return message;
}

export function toAbsoluteUrl(path: string): string {
  return `${window.location.origin}${path}`;
}
