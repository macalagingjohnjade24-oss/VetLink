import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { NewAccountInput, UserAccount } from '../data/mockUsers';
import { authService } from '../services/authService';

type AuthContextValue = {
  user: UserAccount | null;
  initializing: boolean;
  onboardingSeen: boolean;
  signIn: (email: string, password: string, remember: boolean) => Promise<UserAccount>;
  register: (input: NewAccountInput) => Promise<UserAccount>;
  verifyEmail: (email: string, code: string) => Promise<boolean>;
  requestPasswordReset: (email: string) => Promise<{ exists: boolean }>;
  resetPassword: (email: string, password: string) => Promise<void>;
  changePassword: (current: string, next: string) => Promise<void>;
  updateProfile: (
    patch: Partial<Pick<UserAccount, 'firstName' | 'lastName' | 'mobile' | 'avatarUri' | 'address'>>,
  ) => Promise<void>;
  signOut: () => Promise<void>;
  finishOnboarding: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<UserAccount | null>(null);
  const [initializing, setInitializing] = useState(true);
  const [onboardingSeen, setOnboardingSeen] = useState(false);

  useEffect(() => {
    let active = true;
    (async () => {
      const [restored, seen] = await Promise.all([authService.restoreSession(), authService.hasSeenOnboarding()]);
      if (!active) return;
      setUser(restored);
      setOnboardingSeen(seen);
      setInitializing(false);
    })();
    return () => {
      active = false;
    };
  }, []);

  const signIn = useCallback(async (email: string, password: string, remember: boolean) => {
    const account = await authService.signIn(email, password, remember);
    setUser(account);
    return account;
  }, []);

  const register = useCallback(async (input: NewAccountInput) => authService.register(input), []);

  const verifyEmail = useCallback(async (email: string, code: string) => {
    const ok = await authService.verifyEmail(email, code);
    if (ok) {
      setUser((current) => (current && current.email === email ? { ...current, verified: true } : current));
    }
    return ok;
  }, []);

  const requestPasswordReset = useCallback((email: string) => authService.requestPasswordReset(email), []);
  const resetPassword = useCallback((email: string, password: string) => authService.resetPassword(email, password), []);

  const changePassword = useCallback(
    async (current: string, next: string) => {
      if (!user) throw new Error('You need to be signed in to change your password.');
      await authService.changePassword(user.email, current, next);
    },
    [user],
  );

  const updateProfile = useCallback(
    async (patch: Partial<Pick<UserAccount, 'firstName' | 'lastName' | 'mobile' | 'avatarUri' | 'address'>>) => {
      if (!user) return;
      const updated = await authService.updateProfile(user.email, patch);
      setUser({ ...user, ...updated });
    },
    [user],
  );

  const signOut = useCallback(async () => {
    await authService.signOut();
    setUser(null);
  }, []);

  const finishOnboarding = useCallback(async () => {
    await authService.markOnboardingSeen();
    setOnboardingSeen(true);
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      initializing,
      onboardingSeen,
      signIn,
      register,
      verifyEmail,
      requestPasswordReset,
      resetPassword,
      changePassword,
      updateProfile,
      signOut,
      finishOnboarding,
    }),
    [
      user,
      initializing,
      onboardingSeen,
      signIn,
      register,
      verifyEmail,
      requestPasswordReset,
      resetPassword,
      changePassword,
      updateProfile,
      signOut,
      finishOnboarding,
    ],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used inside <AuthProvider>.');
  return context;
}
