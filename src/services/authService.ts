import { DEMO_ACCOUNT, DEMO_VERIFICATION_CODE, type NewAccountInput, type UserAccount } from '../data/mockUsers';
import { STORAGE_KEYS, storage } from './storage';

export type AuthErrorCode = 'not_found' | 'bad_password' | 'unverified' | 'duplicate' | 'invalid_code';

export class AuthError extends Error {
  code: AuthErrorCode;
  constructor(code: AuthErrorCode, message: string) {
    super(message);
    this.code = code;
    this.name = 'AuthError';
  }
}

const wait = (ms = 400) => new Promise((resolve) => setTimeout(resolve, ms));
const normalize = (email: string) => email.trim().toLowerCase();

async function readCustomAccounts(): Promise<UserAccount[]> {
  return (await storage.get<UserAccount[]>(STORAGE_KEYS.accounts)) ?? [];
}

async function writeCustomAccounts(accounts: UserAccount[]) {
  await storage.set(STORAGE_KEYS.accounts, accounts);
}

type ProfilePatch = Partial<Pick<UserAccount, 'firstName' | 'lastName' | 'mobile' | 'avatarUri' | 'address'>>;
type DemoOverrides = ProfilePatch & { password?: string; verified?: boolean };

/**
 * The demo account is baked into the app, so edits to it (and password changes) are
 * kept as an override record instead of being written back to mockUsers.ts.
 */
async function readDemoOverrides(): Promise<DemoOverrides> {
  return (await storage.get<DemoOverrides>(STORAGE_KEYS.demoProfileOverrides)) ?? {};
}

async function writeDemoOverrides(patch: DemoOverrides) {
  const current = await readDemoOverrides();
  await storage.set(STORAGE_KEYS.demoProfileOverrides, { ...current, ...patch });
}

const demoAccount = async (): Promise<UserAccount> => ({ ...DEMO_ACCOUNT, ...(await readDemoOverrides()) });

const allAccounts = async () => [await demoAccount(), ...(await readCustomAccounts())];

export const authService = {
  /**
   * Mock sign-in. Demo account: owner@vetlink.com / VetLink123!
   * The session is only persisted when "Remember me" is checked, so an unchecked box
   * means the next app launch starts signed out.
   */
  async signIn(email: string, password: string, remember: boolean): Promise<UserAccount> {
    await wait();
    const account = (await allAccounts()).find((a) => normalize(a.email) === normalize(email));
    if (!account) {
      throw new AuthError('not_found', 'We could not find an account with that email address.');
    }
    if (account.password !== password) {
      throw new AuthError('bad_password', 'Incorrect password. Please try again.');
    }
    if (!account.verified) {
      throw new AuthError('unverified', 'Please verify your email address before signing in.');
    }
    if (remember) {
      await storage.set(STORAGE_KEYS.session, { email: account.email });
    } else {
      await storage.remove(STORAGE_KEYS.session);
    }
    return account;
  },

  async register(input: NewAccountInput): Promise<UserAccount> {
    await wait();
    const existing = (await allAccounts()).find((a) => normalize(a.email) === normalize(input.email));
    if (existing) {
      throw new AuthError('duplicate', 'An account with that email already exists.');
    }
    const account: UserAccount = {
      id: `usr_${Date.now()}`,
      firstName: input.firstName.trim(),
      lastName: input.lastName.trim(),
      email: normalize(input.email),
      mobile: input.mobile.trim(),
      password: input.password,
      verified: false,
      avatarUri: null,
    };
    const accounts = await readCustomAccounts();
    await writeCustomAccounts([...accounts, account]);
    return account;
  },

  /** Simulated email verification — accepts the documented demo code only. */
  async verifyEmail(email: string, code: string): Promise<boolean> {
    await wait(600);
    if (code.replace(/\D/g, '') !== DEMO_VERIFICATION_CODE) return false;
    const accounts = await readCustomAccounts();
    const index = accounts.findIndex((a) => normalize(a.email) === normalize(email));
    if (index >= 0) {
      accounts[index] = { ...accounts[index], verified: true };
      await writeCustomAccounts(accounts);
    }
    return true;
  },

  async requestPasswordReset(email: string): Promise<{ exists: boolean }> {
    await wait(600);
    const exists = (await allAccounts()).some((a) => normalize(a.email) === normalize(email));
    return { exists };
  },

  async resetPassword(email: string, newPassword: string): Promise<void> {
    await wait();
    const accounts = await readCustomAccounts();
    const index = accounts.findIndex((a) => normalize(a.email) === normalize(email));
    if (index >= 0) {
      accounts[index] = { ...accounts[index], password: newPassword, verified: true };
      await writeCustomAccounts(accounts);
      return;
    }
    if (normalize(email) === normalize(DEMO_ACCOUNT.email)) {
      await writeDemoOverrides({ password: newPassword, verified: true });
    }
  },

  async changePassword(email: string, currentPassword: string, newPassword: string): Promise<void> {
    await wait();
    const accounts = await readCustomAccounts();
    const index = accounts.findIndex((a) => normalize(a.email) === normalize(email));
    const target = index >= 0 ? accounts[index] : await demoAccount();
    if (target.password !== currentPassword) {
      throw new AuthError('bad_password', 'Your current password is incorrect.');
    }
    if (index >= 0) {
      accounts[index] = { ...accounts[index], password: newPassword };
      await writeCustomAccounts(accounts);
      return;
    }
    await writeDemoOverrides({ password: newPassword });
  },

  async updateProfile(email: string, patch: ProfilePatch) {
    await wait(250);
    const accounts = await readCustomAccounts();
    const index = accounts.findIndex((a) => normalize(a.email) === normalize(email));
    if (index >= 0) {
      accounts[index] = { ...accounts[index], ...patch };
      await writeCustomAccounts(accounts);
      return accounts[index];
    }
    await writeDemoOverrides(patch);
    return demoAccount();
  },

  async restoreSession(): Promise<UserAccount | null> {
    const session = await storage.get<{ email: string }>(STORAGE_KEYS.session);
    if (!session?.email) return null;
    return (await allAccounts()).find((a) => normalize(a.email) === normalize(session.email)) ?? null;
  },

  async signOut(): Promise<void> {
    await storage.remove(STORAGE_KEYS.session);
  },

  async hasSeenOnboarding(): Promise<boolean> {
    return (await storage.get<boolean>(STORAGE_KEYS.onboardingSeen)) ?? false;
  },

  async markOnboardingSeen(): Promise<void> {
    await storage.set(STORAGE_KEYS.onboardingSeen, true);
  },
};
