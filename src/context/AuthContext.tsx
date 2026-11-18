import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { Linking } from 'react-native';
import type { NewAccountInput, UserAccount } from '../data/mockUsers';
import { isSupabaseConfigured } from '../lib/supabase';
import { navigationRef } from '../navigation/navigationRef';
import { OFFLINE_ACCOUNT, offlineMode } from '../offline/offlineBackend';
import { authService } from '../services/authService';

type ProfilePatch = Partial<Pick<UserAccount, 'firstName' | 'lastName' | 'mobile' | 'avatarUri' | 'address'>>;

type AuthContextValue = {
  user: UserAccount | null;
  initializing: boolean;
  /** True while a password-recovery link is being applied (Splash routes to Reset Password). */
  recoveryPending: boolean;
  isConfigured: boolean;
  /** True while the app runs on the built-in sample data (no account, no backend). */
  offline: boolean;
  /** Opens the app in a labelled, session-only offline demo. */
  enterOfflineMode: () => void;
  exitOfflineMode: () => Promise<void>;
  signIn: (email: string, password: string, remember: boolean) => Promise<UserAccount>;
  signInWithGoogle: (remember: boolean) => Promise<UserAccount>;
  register: (input: NewAccountInput) => Promise<UserAccount>;
  verifyEmail: (email: string, code: string) => Promise<boolean>;
  resendVerification: (email: string) => Promise<void>;
  requestPasswordReset: (email: string) => Promise<{ exists: boolean }>;
  resetPassword: (email: string, password: string) => Promise<void>;
  changePassword: (current: string, next: string) => Promise<void>;
  updateProfile: (patch: ProfilePatch) => Promise<void>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<UserAccount | null>(null);
  const [initializing, setInitializing] = useState(true);
  const [recoveryPending, setRecoveryPending] = useState(false);
  const [offline, setOffline] = useState(false);

  useEffect(() => {
    let active = true;
    (async () => {
      const restored = await authService.restoreSession();
      if (!active) return;
      setUser(restored);
      setInitializing(false);
    })();
    return () => {
      active = false;
    };
  }, []);

  // Supabase can end the session on its own (refresh rejected, password change elsewhere).
  useEffect(() => {
    const subscription = authService.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_OUT' || !session) setUser(null);
    });
    return () => subscription.unsubscribe();
  }, []);

  // Password recovery / email confirmation links that re-open the app.
  useEffect(() => {
    let active = true;

    const handle = async (url: string | null | undefined) => {
      if (!url) return;
      const result = await authService.handleAuthUrl(url);
      if (!active || !result) return;

      if (result.type === 'recovery') {
        setRecoveryPending(true);
        if (navigationRef.isReady()) navigationRef.navigate('ResetPassword');
        return;
      }
      if (result.type === 'session') {
        setUser(result.account);
        if (navigationRef.isReady()) navigationRef.reset({ index: 0, routes: [{ name: 'Main' }] });
        return;
      }
      if (result.type === 'error') {
        setRecoveryPending(true);
        if (navigationRef.isReady()) navigationRef.navigate('ResetPassword', { error: result.message });
      }
    };

    void Linking.getInitialURL().then(handle);
    const listener = Linking.addEventListener('url', (event) => void handle(event.url));
    return () => {
      active = false;
      listener.remove();
    };
  }, []);

  const enterOfflineMode = useCallback(() => {
    offlineMode.activate();
    setOffline(true);
    setRecoveryPending(false);
    setUser(OFFLINE_ACCOUNT);
  }, []);

  const exitOfflineMode = useCallback(async () => {
    offlineMode.deactivate();
    setOffline(false);
    setUser(null);
  }, []);

  const signIn = useCallback(async (email: string, password: string, remember: boolean) => {
    const account = await authService.signIn(email, password, remember);
    setUser(account);
    return account;
  }, []);

  const signInWithGoogle = useCallback(async (remember: boolean) => {
    const account = await authService.signInWithGoogle(remember);
    setUser(account);
    return account;
  }, []);

  const register = useCallback(async (input: NewAccountInput) => authService.register(input), []);

  const verifyEmail = useCallback(async (email: string, code: string) => authService.verifyEmail(email, code), []);

  const resendVerification = useCallback(async (email: string) => authService.resendVerification(email), []);

  const requestPasswordReset = useCallback(
    (email: string) => authService.requestPasswordReset(email),
    [],
  );

  const resetPassword = useCallback(async (email: string, password: string) => {
    await authService.resetPassword(email, password);
    setRecoveryPending(false);
    setUser(null);
  }, []);

  const changePassword = useCallback(
    async (current: string, next: string) => {
      if (offlineMode.isActive()) {
        throw new Error('Offline mode has no account. Connect VetLink to change a password.');
      }
      if (!user) throw new Error('You need to be signed in to change your password.');
      await authService.changePassword(current, next);
    },
    [user],
  );

  const updateProfile = useCallback(
    async (patch: ProfilePatch) => {
      if (!user) return;
      if (offlineMode.isActive()) {
        // Changes last for this offline session only; nothing is sent anywhere.
        setUser((current) => (current ? { ...current, ...patch } : current));
        return;
      }
      const updated = await authService.updateProfile(patch);
      setUser((current) => ({ ...(current ?? updated), ...updated }));
    },
    [user],
  );

  const signOut = useCallback(async () => {
    if (offlineMode.isActive()) {
      offlineMode.deactivate();
      setOffline(false);
      setUser(null);
      return;
    }
    await authService.signOut();
    setUser(null);
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      initializing,
      recoveryPending,
      isConfigured: isSupabaseConfigured,
      offline,
      enterOfflineMode,
      exitOfflineMode,
      signIn,
      signInWithGoogle,
      register,
      verifyEmail,
      resendVerification,
      requestPasswordReset,
      resetPassword,
      changePassword,
      updateProfile,
      signOut,
    }),
    [
      user,
      initializing,
      recoveryPending,
      offline,
      enterOfflineMode,
      exitOfflineMode,
      signIn,
      signInWithGoogle,
      register,
      verifyEmail,
      resendVerification,
      requestPasswordReset,
      resetPassword,
      changePassword,
      updateProfile,
      signOut,
    ],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used inside <AuthProvider>.');
  return context;
}
