/**
 * Parsing and sanity checks for the two `EXPO_PUBLIC_SUPABASE_*` values.
 *
 * Both come from a hand-edited `.env`, so a paste can carry quotes, whitespace,
 * a copied REST/Auth path, a missing scheme, or the wrong kind of key.
 * Normalising here keeps a mis-paste from becoming a silent 401 or a crash
 * inside `createClient`.
 *
 * Pure functions with no React Native or Supabase imports, so they stay testable.
 */

const LOOPBACK = /^(localhost|127\.0\.0\.1|\[::1\])(?::\d+)?$/i;
const HOST = /^[^.\s/]+(\.[^.\s/]+)+$/;

/**
 * Accepts `https://ref.supabase.co/rest/v1`, `" https://ref.supabase.co "` or a
 * bare `ref.supabase.co`, and always returns the origin. A scheme-less value
 * defaults to https; loopback stays http so a local Supabase keeps working.
 */
export function normalizeSupabaseUrl(value: string): string {
  const unquoted = value.trim().replace(/^['"]+|['"]+$/g, '');
  const origin = unquoted.match(/^https?:\/\/[^/?#\s]+/i);
  if (origin) return origin[0];
  if (!unquoted || /\s/.test(unquoted)) return unquoted;
  const host = unquoted.replace(/[/?#].*$/, '');
  return host ? `${LOOPBACK.test(host) ? 'http' : 'https'}://${host}` : unquoted;
}

/** API keys are opaque strings: drop quotes and any whitespace from the paste. */
export function normalizeSupabaseKey(value: string): string {
  return value.replace(/['"]/g, '').replace(/\s+/g, '');
}

/** A value that cannot be a host would make `createClient` throw while importing. */
export function supabaseUrlProblem(url: string): string | null {
  if (!url || url.includes('your-project-ref')) return null;
  const host = url.replace(/^https?:\/\//i, '').split(/[/?#]/)[0];
  if (LOOPBACK.test(host) || HOST.test(host)) return null;
  return `EXPO_PUBLIC_SUPABASE_URL doesn’t look like a project URL (${url}). Expected https://<project-ref>.supabase.co.`;
}

/**
 * Rejects a secret key, an unrecognised value, and a truncated or doubled paste
 * (the 72-character publishable key that 401'd on every request).
 *
 * Supabase documents publishable keys as
 * `sb_publishable_<22-char-random>_<8-char-checksum>` — 31 characters after the
 * prefix. Other generations and self-hosted setups can differ, so any single
 * base64url run of 20–64 characters is accepted rather than pinning the length.
 */
export function supabaseKeyProblem(key: string): string | null {
  if (!key || key.startsWith('your-')) return null;
  if (key.startsWith('sb_secret_')) {
    return 'EXPO_PUBLIC_SUPABASE_ANON_KEY holds a secret key, which bypasses Row Level Security. Replace it with the publishable (or legacy anon) key, then restart Expo.';
  }
  if (key.startsWith('sb_publishable_')) {
    const suffix = key.slice('sb_publishable_'.length);
    if (/^[A-Za-z0-9_-]{20,64}$/.test(suffix)) return null;
    return `EXPO_PUBLIC_SUPABASE_ANON_KEY looks malformed: ${suffix.length} characters after sb_publishable_, but a publishable key is 31 (22 characters, then _ and an 8-character checksum). Re-copy it from Project Settings → API Keys, then restart Expo.`;
  }
  if (key.startsWith('eyJ')) {
    return key.length < 100
      ? `EXPO_PUBLIC_SUPABASE_ANON_KEY looks truncated (${key.length} characters). Re-copy the anon key from Project Settings → API, then restart Expo.`
      : null;
  }
  return 'EXPO_PUBLIC_SUPABASE_ANON_KEY is not a Supabase key. Expected a publishable key (sb_publishable_…) or the legacy anon JWT key.';
}
