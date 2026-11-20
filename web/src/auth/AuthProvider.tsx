import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { friendlyAuthError, isSupabaseConfigured, setRemember, supabase } from '@/lib/supabase';
import type { AnyRole, ConsoleRole } from './roles';

export type ConsoleUser = {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  mobile: string;
  avatarUrl: string | null;
  role: ConsoleRole;
  /** Active or invited membership; null for system administrators. */
  clinicId: string | null;
  clinicName: string | null;
  clinicReference: string | null;
  membershipStatus: string | null;
  profileComplete: boolean;
  /** True when the signed-in user has at least one verified TOTP factor. Only loaded for system administrators; false otherwise. */
  mfaEnrolled: boolean;
};

type ProfileRow = {
  id: string;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  role: AnyRole;
  mobile_number: string | null;
  profile_picture: string | null;
};

type MembershipRow = {
  clinic_id: string;
  staff_role: string;
  status: string;
  clinics: { clinic_name: string; reference: string | null } | null;
};

type AuthValue = {
  /** loading while the session is restored after a reload. */
  status: 'loading' | 'ready' | 'unconfigured';
  user: ConsoleUser | null;
  /** Signed in, but the role has no console access (pet owner). */
  roleBlocked: boolean;
  /** Resolves null when the account signed in but has no console role. */
  signIn: (email: string, password: string, remember: boolean) => Promise<ConsoleUser | null>;
  signOut: () => Promise<void>;
  refresh: () => Promise<ConsoleUser | null>;
};

const AuthContext = createContext<AuthValue | null>(null);

async function loadConsoleUser(): Promise<{ user: ConsoleUser | null; blocked: boolean }> {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session) return { user: null, blocked: false };

  const { data: profileData, error } = await supabase
    .from('profiles')
    .select('id, first_name, last_name, email, role, mobile_number, profile_picture')
    .eq('id', session.user.id)
    .maybeSingle();

  if (error) throw new Error(error.message);

  const profile = (profileData ?? null) as ProfileRow | null;

  if (!profile) {
    // The auth user exists but provisioning never created a profile row.
    return { user: null, blocked: false };
  }

  if (!isConsoleRoleValue(profile.role)) {
    return { user: null, blocked: profile.role === 'pet_owner' };
  }

  let mfaEnrolled = false;
  let membership: MembershipRow | null = null;
  if (profile.role === 'system_administrator') {
    const { data: factorData, error: factorError } = await supabase.auth.mfa.listFactors();
    if (factorError) throw new Error(factorError.message);
    mfaEnrolled = (factorData?.totp ?? []).some((factor) => factor.status === 'verified');
  } else {
    const { data } = await supabase
      .from('clinic_memberships')
      .select('clinic_id, staff_role, status, clinics(clinic_name, reference)')
      .eq('user_id', session.user.id)
      .in('status', ['active', 'invited'])
      .order('created_at', { ascending: true })
      .limit(1)
      .maybeSingle();
    membership = (data ?? null) as MembershipRow | null;
  }

  return {
    blocked: false,
    user: {
      id: profile.id,
      email: profile.email ?? session.user.email ?? '',
      firstName: profile.first_name ?? '',
      lastName: profile.last_name ?? '',
      mobile: profile.mobile_number ?? '',
      avatarUrl: profile.profile_picture,
      role: profile.role,
      clinicId: membership?.clinic_id ?? null,
      clinicName: membership?.clinics?.clinic_name ?? null,
      clinicReference: membership?.clinics?.reference ?? null,
      membershipStatus: membership?.status ?? null,
      profileComplete: Boolean(profile.first_name && profile.last_name),
      mfaEnrolled,
    },
  };
}

function isConsoleRoleValue(role: string): role is ConsoleRole {
  return role !== 'pet_owner';
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<AuthValue['status']>(
    isSupabaseConfigured ? 'loading' : 'unconfigured',
  );
  const [user, setUser] = useState<ConsoleUser | null>(null);
  const [roleBlocked, setRoleBlocked] = useState(false);

  const refresh = useCallback(async () => {
    if (!isSupabaseConfigured) return null;
    const result = await loadConsoleUser();
    setUser(result.user);
    setRoleBlocked(result.blocked);
    return result.user;
  }, []);

  useEffect(() => {
    if (!isSupabaseConfigured) return;

    let active = true;
    (async () => {
      try {
        const result = await loadConsoleUser();
        if (!active) return;
        setUser(result.user);
        setRoleBlocked(result.blocked);
      } catch {
        if (active) setUser(null);
      } finally {
        if (active) setStatus('ready');
      }
    })();

    const { data: subscription } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_OUT') {
        setUser(null);
        setRoleBlocked(false);
        return;
      }
      if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED' || event === 'USER_UPDATED') {
        void refresh().catch(() => undefined);
      }
    });

    return () => {
      active = false;
      subscription.subscription.unsubscribe();
    };
  }, [refresh]);

  const signIn = useCallback(async (email: string, password: string, remember: boolean) => {
    setRemember(remember);
    const { error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });
    if (error) throw new Error(friendlyAuthError(error.message));

    const result = await loadConsoleUser();
    setUser(result.user);
    setRoleBlocked(result.blocked);

    if (result.blocked) return null;
    if (!result.user) {
      throw new Error('Signed in, but no clinic profile is attached to this account yet.');
    }
    return result.user;
  }, []);

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
    setUser(null);
    setRoleBlocked(false);
  }, []);

  const value = useMemo<AuthValue>(
    () => ({ status, user, roleBlocked, signIn, signOut, refresh }),
    [status, user, roleBlocked, signIn, signOut, refresh],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used inside <AuthProvider>.');
  return context;
}
