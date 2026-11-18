/**
 * Parsing and sanity checks for the two `EXPO_PUBLIC_SUPABASE_*` values.
 *
 * Both come from a hand-edited `.env`, so a paste can carry quotes, stray
 * whitespace, a copied REST/Auth path, a missing scheme, or the wrong kind of
 * key. Normalising here keeps a mis-paste from turning into a silent 401 or a
 * crash inside `createClient`.
 *
 * Pure functions, no React Native or Supabase imports, so they stay testable.
 */

const LOOPBACK = /^(localhost|127\.0\.0\.1|\[::1\])(?::\d+)?$/i;
const PLACEHOLDER_REF = 'your-project-ref';
const PUBLISHABLE_PREFIX = 'sb_publishable_';
/**
 * Supabase's documented key format is
 * `sb_publishable_<22-char-random>_<8-char-checksum>` — 31 characters after
 * the prefix (https://supabase.com/docs/guides/self-hosting/self-hosted-auth-keys).
 * Keys from other generations or self-hosted setups can differ, so only a
 * value that cannot be a single key is rejected.
 */
const PUBLISHABLE_SUFFIX_SHAPE = /^[A-Za-z0-9_-]{22}_[A-Za-z0-9_-]{8}$/;
const MIN_PUBLISHABLE_SUFFIX = 20;
const MAX_PUBLISHABLE_SUFFIX = 64;

/**
 * Accepts `https://ref.supabase.co/rest/v1`, `" https://ref.supabase.co "` or a
 * bare `ref.supabase.co`, and always returns the origin. A scheme-less value
 * defaults to https (loopback stays http so local Supabase keeps working).
 */
export function normalizeSupabaseUrl(value: string): string {
  const unquoted = value.trim().replace(/^['"]+|['"]+$/g, '');
  const origin = unquoted.match(/^https?:\/\/[^/?#\s]+/i);
  if (origin) return origin[0];
  if (!unquoted || /\s/.test(unquoted)) return unquoted;
  const host = unquoted.replace(/[/?#].*$/, '');
  if (!host) return unquoted;
  return `${LOOPBACK.test(host) ? 'http' : 'https'}://${host}`;
}

/** API keys are opaque strings: drop quotes and any whitespace from the paste. */
export function normalizeSupabaseKey(value: string): string {
  return value.replace(/['"]/g, '').replace(/\s+/g, '');
}

export function supabaseUrlProblem(url: string): string | null {
  if (!url || url.includes(PLACEHOLDER_REF)) return null;
  const host = url.replace(/^https?:\/\//i, '').split(/[/?#]/)[0];
  if (LOOPBACK.test(host)) return null;
  if (/^[^.\s/]+(\.[^.\s/]+)+$/.test(host)) return null;
  return `EXPO_PUBLIC_SUPABASE_URL doesn’t look like a project URL (${url}). Expected https://<project-ref>.supabase.co.`;
}

/**
 * Rejects a secret key, an unrecognised value, or a truncated/doubled key —
 * the paste that produced `sb_publishable_` + 72 characters and 401'd on
 * every request.
 */
export function supabaseKeyProblem(key: string): string | null {
  if (!key || key.startsWith('your-')) return null;
  if (key.startsWith('sb_secret_')) {
    return 'EXPO_PUBLIC_SUPABASE_ANON_KEY holds a secret key, which bypasses Row Level Security. Replace it with the publishable (or legacy anon) key, then restart Expo.';
  }
  if (key.startsWith(PUBLISHABLE_PREFIX)) {
    const suffix = key.slice(PUBLISHABLE_PREFIX.length);
    const base64url = /^[A-Za-z0-9_-]+$/.test(suffix);
    const plausible =
      PUBLISHABLE_SUFFIX_SHAPE.test(suffix) ||
      (base64url && suffix.length >= MIN_PUBLISHABLE_SUFFIX && suffix.length <= MAX_PUBLISHABLE_SUFFIX);
    if (plausible) return null;
    return `EXPO_PUBLIC_SUPABASE_ANON_KEY looks malformed: ${suffix.length} characters after ${PUBLISHABLE_PREFIX}, but a publishable key is 31 (22 characters, then _ and an 8-character checksum). Re-copy it from Project Settings → API Keys, then restart Expo.`;
  }
  if (key.startsWith('eyJ')) {
    return key.length < 100
      ? `EXPO_PUBLIC_SUPABASE_ANON_KEY looks truncated (${key.length} characters). Re-copy the anon key from Project Settings → API, then restart Expo.`
      : null;
  }
  return 'EXPO_PUBLIC_SUPABASE_ANON_KEY is not a Supabase key. Expected a publishable key (sb_publishable_…) or the legacy anon JWT key.';
}

/** The first configuration fault to explain to the user, if any. */
export function backendConfigProblem(url: string, key: string): string | null {
  return supabaseUrlProblem(url) ?? supabaseKeyProblem(key);
}
