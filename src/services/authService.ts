import * as AuthSession from 'expo-auth-session';
import * as WebBrowser from 'expo-web-browser';
import type { Session, User } from '@supabase/supabase-js';
import type { NewAccountInput, UserAccount } from '../data/mockUsers';
import {
  AUTH_REDIRECT,
  BACKEND_SETUP_MESSAGE,
  isSupabaseConfigured,
  requireSupabase,
  sessionPersistence,
  supabase,
} from '../lib/supabase';
import { mapProfile, type ProfileRow } from '../types/backend';
import { DATABASE_SETUP_MESSAGE, isDatabaseSetupError } from '../utils/errors';
import { storageService } from './storageService';

// Required for the web build so the OAuth popup can post its result back.
// The result also tells the popup whether it landed on the redirect we asked for.
const webAuthSessionCompletion = WebBrowser.maybeCompleteAuthSession();

export type AuthErrorCode =
  | 'not_configured'
  | 'not_found'
  | 'bad_password'
  | 'unverified'
  | 'duplicate'
  | 'invalid_code'
  | 'expired'
  | 'cancelled'
  | 'redirect_mismatch'
  | 'network'
  | 'weak_password'
  | 'unknown';

export class AuthError extends Error {
  code: AuthErrorCode;
  constructor(code: AuthErrorCode, message: string) {
    super(message);
    this.code = code;
    this.name = 'AuthError';
  }
}

const normalize = (email: string) => email.trim().toLowerCase();
const AUTH_RECOVERY_PATH = AUTH_REDIRECT.recoveryPath;

const redirectTo = (path: string) => AuthSession.makeRedirectUri({ scheme: 'vetlink', path });

type ProfilePatch = Partial<Pick<UserAccount, 'firstName' | 'lastName' | 'mobile' | 'avatarUri' | 'address'>>;

function requireClient() {
  if (!supabase) throw new AuthError('not_configured', BACKEND_SETUP_MESSAGE);
  return requireSupabase();
}

/** Supabase errors are translated into the messages the existing screens show. */
function toAuthError(error: unknown): AuthError {
  if (error instanceof AuthError) return error;
  const source = error as { message?: string; code?: string; status?: number; error_description?: string } | null;
  const message = source?.message ?? source?.error_description ?? '';
  const code = source?.code ?? '';

  // Signing in reads the profile row, so an unmigrated project fails here first.
  if (isDatabaseSetupError(error)) return new AuthError('unknown', DATABASE_SETUP_MESSAGE);

  if (code === 'invalid_credentials' || /invalid login credentials/i.test(message)) {
    return new AuthError('not_found', 'We could not find an account with those details. Check your email and password.');
  }
  if (code === 'email_not_confirmed' || /email not confirmed|email not verified/i.test(message)) {
    return new AuthError('unverified', 'Please verify your email address before signing in.');
  }
  if (code === 'user_already_exists' || /already registered|already exists/i.test(message)) {
    return new AuthError('duplicate', 'An account with that email already exists.');
  }
  if (code === 'weak_password' || /password should be at least/i.test(message)) {
    return new AuthError('weak_password', 'Choose a stronger password: at least 8 characters with one uppercase letter and one number.');
  }
  if (code === 'same_password' || /should be different from the old password/i.test(message)) {
    return new AuthError('weak_password', 'Choose a password you have not used before.');
  }
  if (code === 'otp_expired' || /token has expired|invalid token|expired/i.test(message)) {
    return new AuthError('expired', 'That link or code has expired. Request a new one and try again.');
  }
  if (code === 'over_email_send_rate_limit' || /rate limit|too many requests/i.test(message)) {
    return new AuthError('unknown', 'Too many attempts. Please wait a minute and try again.');
  }
  if (/network request failed|failed to fetch|network error/i.test(message)) {
    return new AuthError('network', 'We could not reach VetLink. Check your internet connection and try again.');
  }
  return new AuthError('unknown', message || 'Something went wrong. Please try again.');
}

function nameFromMetadata(user: User): { firstName: string; lastName: string } {
  const meta = (user.user_metadata ?? {}) as Record<string, string | undefined>;
  const first = meta.first_name ?? meta.given_name ?? '';
  const last = meta.last_name ?? meta.family_name ?? '';
  if (first || last) return { firstName: first, lastName: last };
  const full = (meta.full_name ?? meta.name ?? '').trim();
  if (!full) return { firstName: '', lastName: '' };
  const [head, ...tail] = full.split(/\s+/);
  return { firstName: head, lastName: tail.join(' ') };
}

function accountFromUser(user: User): UserAccount {
  const names = nameFromMetadata(user);
  const meta = (user.user_metadata ?? {}) as Record<string, string | undefined>;
  return {
    id: user.id,
    firstName: names.firstName,
    lastName: names.lastName,
    email: user.email ?? '',
    mobile: meta.mobile_number ?? '',
    verified: Boolean(user.email_confirmed_at || user.confirmed_at),
    avatarUri: (meta.avatar_url as string | null) ?? (meta.picture as string | null) ?? null,
  };
}

/**
 * Loads the profile row for a signed-in user and creates it when the database
 * trigger has not run yet (first Google sign-in, or a project created before
 * the trigger migration). Uses the auth user id, so repeat sign-ins reuse the row.
 */
async function profileFor(user: User): Promise<UserAccount> {
  const client = requireClient();
  const { data, error } = await client.from('profiles').select('*').eq('id', user.id).maybeSingle();
  if (error) throw toAuthError(error);
  if (data) {
    const account = mapProfile(data as ProfileRow);
    return { ...account, verified: Boolean(user.email_confirmed_at || user.confirmed_at) };
  }

  const fallback = accountFromUser(user);
  const { data: created, error: insertError } = await client
    .from('profiles')
    .insert({
      id: user.id,
      first_name: fallback.firstName,
      last_name: fallback.lastName,
      email: fallback.email,
      mobile_number: fallback.mobile,
      profile_picture: fallback.avatarUri,
    })
    .select('*')
    .single();

  if (!insertError && created) {
    const account = mapProfile(created as ProfileRow);
    return { ...account, verified: fallback.verified };
  }
  // Trigger-created row or a transient read: still hand back the auth identity.
  return fallback;
}

function readParams(url: string): Record<string, string> {
  const query = url.split('#').slice(1).join('#');
  const parts = [url.split('?')[1]?.split('#')[0] ?? '', query].filter(Boolean).join('&');
  const params: Record<string, string> = {};
  for (const pair of parts.split('&')) {
    if (!pair) continue;
    const [rawKey, rawValue = ''] = pair.split('=');
    params[decodeURIComponent(rawKey)] = decodeURIComponent(rawValue.replace(/\+/g, ' '));
  }
  return params;
}

const handledUrls = new Set<string>();

/**
 * Exchanges a callback URL once. A Supabase code is single-use, and on a device
 * the same URL can be delivered twice (the browser window and the deep link),
 * so both paths share one result.
 */
const redemptions = new Map<string, Promise<UserAccount>>();

function exchangeCallback(url: string, code: string): Promise<UserAccount> {
  const existing = redemptions.get(url);
  if (existing) return existing;
  const pending = (async () => {
    const client = requireClient();
    const { data, error } = await client.auth.exchangeCodeForSession(code);
    if (error) throw toAuthError(error);
    const user = data.user ?? data.session?.user;
    if (!user) throw new AuthError('unknown', 'Google sign-in did not return an account.');
    return profileFor(user);
  })();
  redemptions.set(url, pending);
  return pending;
}

/**
 * On web the OAuth flow runs in a popup that loads this same bundle at
 * /auth-callback. That window must only hand the URL back to its opener
 * (`maybeCompleteAuthSession`); redeeming the code there would consume it
 * before the window the user is actually looking at can.
 */
function isOAuthPopup(): boolean {
  const scope = globalThis as { window?: { opener?: unknown } };
  return Boolean(scope.window?.opener);
}

/**
 * A device cannot get its OAuth callback back from the browser window: Android's
 * Custom Tab stops at the `exp://` / `vetlink://` hand-off and
 * `openAuthSessionAsync` resolves as dismissed instead of returning the URL.
 * The deep link is the real callback there, so while a Google flow is open the
 * URL listener hands its result to the waiting `signInWithGoogle` through this
 * hook rather than dropping the code.
 */
type GoogleHandoff = { account: UserAccount } | { error: AuthError };

type GoogleOutcome =
  | { kind: 'browser'; result: Awaited<ReturnType<typeof WebBrowser.openAuthSessionAsync>> }
  | { kind: 'link'; handoff: GoogleHandoff }
  | { kind: 'timeout' };

/**
 * Stops a browser call that never settles from leaving the sign-in button
 * waiting forever. A callback that arrives after this still signs in through
 * `handleAuthUrl`; this only bounds the wait.
 */
const GOOGLE_FLOW_TIMEOUT_MS = 3 * 60 * 1000;

let settleGoogleFlow: ((outcome: GoogleHandoff) => void) | null = null;

/** Where the web OAuth popup leaves the URL it actually landed on. */
const REDIRECT_MISMATCH_KEY = 'vetlink.auth.redirect-mismatch.v1';

type WebStorage = {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
};

function webScope(): { storage: WebStorage; href: string } | null {
  const scope = globalThis as {
    window?: { localStorage?: WebStorage; location?: { href?: string } };
  };
  const win = scope.window;
  if (!win?.localStorage || !win.location?.href) return null;
  return { storage: win.localStorage, href: win.location.href };
}

/**
 * expo-web-browser only hands a popup URL back when it lands exactly on the
 * allow-listed redirect. When Supabase rewrites the redirect (normally to the
 * project's Site URL) the popup is left on a page that reports nothing, so it
 * records where it landed and the waiting window turns that into an error.
 */
function recordWebRedirectMismatch(result: ReturnType<typeof WebBrowser.maybeCompleteAuthSession>) {
  const scope = webScope();
  if (result.type !== 'failed' || !scope || !isOAuthPopup()) return;
  try {
    scope.storage.setItem(REDIRECT_MISMATCH_KEY, scope.href);
  } catch {
    // Private browsing can refuse storage; the failure then stays a cancellation.
  }
}

function readWebRedirectMismatch(): string | null {
  const scope = webScope();
  if (!scope) return null;
  try {
    const href = scope.storage.getItem(REDIRECT_MISMATCH_KEY);
    if (href) scope.storage.removeItem(REDIRECT_MISMATCH_KEY);
    return href || null;
  } catch {
    return null;
  }
}

function clearWebRedirectMismatch(): void {
  try {
    webScope()?.storage.removeItem(REDIRECT_MISMATCH_KEY);
  } catch {
    // Nothing to clear.
  }
}

recordWebRedirectMismatch(webAuthSessionCompletion);

/** Same scheme, host and path — the query string carries the code, so it is ignored. */
function isSameRedirect(actual: string, expected: string): boolean {
  try {
    const a = new URL(actual);
    const b = new URL(expected);
    const path = (value: string) => value.replace(/\/+$/, '');
    return a.protocol === b.protocol && a.host === b.host && path(a.pathname) === path(b.pathname);
  } catch {
    return actual.split(/[?#]/)[0] === expected.split(/[?#]/)[0];
  }
}

/** Names the URL the app asked for and the URL the browser actually returned. */
function redirectMismatchMessage(expected: string, actual: string): string {
  // The allow-list entry is the origin the app asked for, not the whole callback.
  let origin = expected;
  try {
    const parsed = new URL(expected);
    origin = `${parsed.protocol}//${parsed.host}`;
  } catch {
    // Fall back to the raw URL; the message still names both ends.
  }
  return (
    `Google sign-in came back to ${actual} instead of ${expected}. ` +
    `Supabase swaps in the project's Site URL whenever the requested redirect is not on its allow-list, ` +
    `so add ${origin}/** under Authentication → URL Configuration → Redirect URLs and try again. ` +
    `Setup notes: supabase/README.md section 4.`
  );
}

export type AuthLinkResult =
  | { type: 'session'; account: UserAccount }
  | { type: 'recovery'; account: UserAccount | null }
  | { type: 'error'; message: string };

export const authService = {
  isConfigured(): boolean {
    return isSupabaseConfigured;
  },

  /**
   * Email + password sign-in. The Remember me choice decides where Supabase
   * stores the session (AsyncStorage vs. memory) — a plain-text password is
   * never stored anywhere.
   */
  async signIn(email: string, password: string, remember: boolean): Promise<UserAccount> {
    const client = requireClient();
    await sessionPersistence.setRemember(remember);
    const { data, error } = await client.auth.signInWithPassword({
      email: normalize(email),
      password,
    });
    if (error) throw toAuthError(error);
    if (!data.user) throw new AuthError('unknown', 'We could not sign you in. Please try again.');
    return profileFor(data.user);
  },

  async register(input: NewAccountInput): Promise<UserAccount> {
    const client = requireClient();
    const { data, error } = await client.auth.signUp({
      email: normalize(input.email),
      password: input.password,
      options: {
        data: {
          first_name: input.firstName.trim(),
          last_name: input.lastName.trim(),
          mobile_number: input.mobile.trim(),
        },
        emailRedirectTo: redirectTo(AUTH_REDIRECT.callbackPath),
      },
    });
    if (error) throw toAuthError(error);
    if (!data.user) throw new AuthError('unknown', 'We could not create your account. Please try again.');

    // With confirmations on, Supabase returns an existing email as an identity-less user.
    if (Array.isArray(data.user.identities) && data.user.identities.length === 0) {
      throw new AuthError('duplicate', 'An account with that email already exists. Try logging in instead.');
    }

    return {
      id: data.user.id,
      firstName: input.firstName.trim(),
      lastName: input.lastName.trim(),
      email: normalize(input.email),
      mobile: input.mobile.trim(),
      verified: Boolean(data.user.email_confirmed_at),
      avatarUri: null,
    };
  },

  /** Six-digit code from the "Confirm signup" email. */
  async verifyEmail(email: string, code: string): Promise<boolean> {
    const client = requireClient();
    const token = code.replace(/\D/g, '');
    const { error } = await client.auth.verifyOtp({
      email: normalize(email),
      token,
      type: 'signup',
    });
    if (error) {
      if (/expired/i.test(error.message)) throw toAuthError(error);
      return false;
    }
    // The screen sends the owner to Login afterwards; keep this launch signed out.
    await client.auth.signOut({ scope: 'local' });
    return true;
  },

  async resendVerification(email: string): Promise<void> {
    const client = requireClient();
    const { error } = await client.auth.resend({
      type: 'signup',
      email: normalize(email),
      options: { emailRedirectTo: redirectTo(AUTH_REDIRECT.callbackPath) },
    });
    if (error) throw toAuthError(error);
  },

  /** Supabase deliberately reports success even when the address is unknown. */
  async requestPasswordReset(email: string): Promise<{ exists: boolean }> {
    const client = requireClient();
    const { error } = await client.auth.resetPasswordForEmail(normalize(email), {
      redirectTo: redirectTo(AUTH_RECOVERY_PATH),
    });
    if (error) throw toAuthError(error);
    return { exists: true };
  },

  /** Requires the recovery session created by the emailed link. */
  async resetPassword(_email: string, newPassword: string): Promise<void> {
    const client = requireClient();
    const { data } = await client.auth.getSession();
    if (!data.session) {
      throw new AuthError('expired', 'This reset link has expired. Request a new password reset email.');
    }
    const { error } = await client.auth.updateUser({ password: newPassword });
    if (error) throw toAuthError(error);
    await client.auth.signOut({ scope: 'local' });
  },

  async changePassword(currentPassword: string, newPassword: string): Promise<void> {
    const client = requireClient();
    const { data } = await client.auth.getUser();
    const email = data.user?.email;
    if (!email) throw new AuthError('not_found', 'You need to be signed in to change your password.');

    const verify = await client.auth.signInWithPassword({ email, password: currentPassword });
    if (verify.error) throw new AuthError('bad_password', 'Your current password is incorrect.');

    const { error } = await client.auth.updateUser({ password: newPassword });
    if (error) throw toAuthError(error);
  },

  async updateProfile(patch: ProfilePatch): Promise<UserAccount> {
    const client = requireClient();
    const { data } = await client.auth.getUser();
    if (!data.user) throw new AuthError('not_found', 'You need to be signed in to update your profile.');

    const row: Record<string, string | null> = {};
    if (patch.firstName !== undefined) row.first_name = patch.firstName.trim();
    if (patch.lastName !== undefined) row.last_name = patch.lastName.trim();
    if (patch.mobile !== undefined) row.mobile_number = patch.mobile.trim();
    if (patch.address !== undefined) row.address = patch.address.trim() || null;
    if (patch.avatarUri !== undefined) {
      const avatar = patch.avatarUri;
      row.profile_picture =
        avatar && !/^https?:\/\//i.test(avatar)
          ? await storageService.uploadProfilePhoto(data.user.id, avatar)
          : avatar;
    }

    if (!Object.keys(row).length) {
      const current = await client.from('profiles').select('*').eq('id', data.user.id).single();
      if (current.error) throw toAuthError(current.error);
      return mapProfile(current.data as ProfileRow);
    }

    const { data: updated, error } = await client
      .from('profiles')
      .update(row)
      .eq('id', data.user.id)
      .select('*')
      .single();
    if (error) throw toAuthError(error);
    return mapProfile(updated as ProfileRow);
  },

  async restoreSession(): Promise<UserAccount | null> {
    if (!supabase) return null;
    await sessionPersistence.load();
    const { data } = await supabase.auth.getSession();
    if (!data.session?.user) return null;
    return profileFor(data.session.user);
  },

  async signOut(): Promise<void> {
    if (!supabase) return;
    await supabase.auth.signOut();
  },

  /**
   * Google OAuth 2.0 through Supabase (PKCE). Opens the provider in the system
   * browser, exchanges the returned code for a Supabase session, and creates the
   * pet_owner profile on first sign-in. Requires the Google provider to be
   * enabled in Supabase and the redirect URL to be allow-listed (supabase/README.md).
   */
  async signInWithGoogle(remember: boolean): Promise<UserAccount> {
    const client = requireClient();
    await sessionPersistence.setRemember(remember);
    clearWebRedirectMismatch();

    const redirect = redirectTo(AUTH_REDIRECT.callbackPath);
    const { data, error } = await client.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: redirect,
        skipBrowserRedirect: true,
        queryParams: { prompt: 'select_account' },
      },
    });
    if (error) throw toAuthError(error);
    if (!data.url) throw new AuthError('unknown', 'Google sign-in is unavailable right now. Please try again.');

    // The browser window and the deep link are two ways to receive the same
    // callback; whichever lands first wins and the other is ignored.
    let timer: ReturnType<typeof setTimeout> | undefined;
    let outcome: GoogleOutcome;
    try {
      outcome = await Promise.race<GoogleOutcome>([
        WebBrowser.openAuthSessionAsync(data.url, redirect).then((result): GoogleOutcome => ({ kind: 'browser', result })),
        new Promise<GoogleOutcome>((resolve) => {
          settleGoogleFlow = (handoff) => resolve({ kind: 'link', handoff });
        }),
        new Promise<GoogleOutcome>((resolve) => {
          timer = setTimeout(() => resolve({ kind: 'timeout' }), GOOGLE_FLOW_TIMEOUT_MS);
        }),
      ]);
    } finally {
      if (timer) clearTimeout(timer);
      settleGoogleFlow = null;
    }

    // A browser that never settles is indistinguishable from a dismissal.
    if (outcome.kind === 'timeout') throw new AuthError('cancelled', 'Google sign-in was cancelled.');
    if (outcome.kind === 'link') {
      if ('error' in outcome.handoff) throw outcome.handoff.error;
      return outcome.handoff.account;
    }

    const result = outcome.result;
    if (result.type !== 'success') {
      // A rewritten redirect never reaches this window, so the popup's note is
      // the only record of where the browser actually ended up.
      const landedOn = readWebRedirectMismatch();
      if (landedOn) throw new AuthError('redirect_mismatch', redirectMismatchMessage(redirect, landedOn));
      if (result.type === 'cancel' || result.type === 'dismiss') {
        throw new AuthError('cancelled', 'Google sign-in was cancelled.');
      }
      throw new AuthError('unknown', 'Google sign-in could not be completed. Please try again.');
    }

    // Supabase reports success for a redirect it quietly replaced with the Site URL.
    if (!isSameRedirect(result.url, redirect)) {
      throw new AuthError('redirect_mismatch', redirectMismatchMessage(redirect, result.url));
    }

    const params = readParams(result.url);
    if (params.error) {
      throw new AuthError('unknown', params.error_description || 'Google sign-in was not approved.');
    }
    if (!params.code) throw new AuthError('unknown', 'Google did not return a sign-in code. Please try again.');

    // The deep link can also reach the Linking listener a moment later; this
    // keeps the code single-use on that side too.
    handledUrls.add(result.url);
    return exchangeCallback(result.url, params.code);
  },

  /**
   * Handles a link that re-opens the app: email confirmation, password recovery
   * or an OAuth callback. Returns what the navigation layer should do next.
   */
  async handleAuthUrl(url: string): Promise<AuthLinkResult | null> {
    if (!supabase) return null;
    // Only the web popup stays out of the way: it must hand its URL back to the
    // opener instead of redeeming it. On a device this listener *is* the way the
    // callback arrives, so it must run even while the browser window is open.
    if (/auth-callback/.test(url) && !/reset-password/.test(url) && isOAuthPopup()) return null;
    if (!/(auth-callback|reset-password)/.test(url) && !/[#?&]code=/.test(url)) return null;
    if (handledUrls.has(url)) return null;
    handledUrls.add(url);

    const params = readParams(url);
    const isRecovery = /reset-password/.test(url) || params.type === 'recovery';

    if (params.error) {
      const message = params.error_description || 'That link is no longer valid.';
      // The Google screen that is still waiting shows this itself.
      if (!isRecovery && settleGoogleFlow) {
        settleGoogleFlow({ error: new AuthError('unknown', message) });
        return null;
      }
      return { type: 'error', message };
    }
    if (!params.code) return isRecovery ? { type: 'error', message: 'That reset link has expired.' } : null;

    let account: UserAccount;
    try {
      account = await exchangeCallback(url, params.code);
    } catch (error) {
      const failure = toAuthError(error);
      if (!isRecovery && settleGoogleFlow) {
        settleGoogleFlow({ error: failure });
        return null;
      }
      return { type: 'error', message: failure.message };
    }

    if (isRecovery) return { type: 'recovery', account: null };
    // The awaiting sign-in, if any, gets the same answer instead of hanging.
    settleGoogleFlow?.({ account });
    return { type: 'session', account };
  },

  /** Keeps AuthContext in sync with token refreshes and sign-outs from Supabase. */
  onAuthStateChange(callback: (event: string, session: Session | null) => void) {
    if (!supabase) return { unsubscribe: () => undefined };
    const { data } = supabase.auth.onAuthStateChange((event, session) => callback(event, session));
    return data.subscription;
  },
};
