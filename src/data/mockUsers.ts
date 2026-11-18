/**
 * Mock user accounts.
 * NOTE: this is demonstration data only — there is no backend and no database yet.
 * Passwords live in plain text in memory/AsyncStorage purely so the mock auth flow can
 * be demonstrated. Replace `services/authService` with real API calls before shipping.
 */
export type UserAccount = {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  mobile: string;
  password: string;
  verified: boolean;
  avatarUri?: string | null;
  address?: string;
};

export const DEMO_EMAIL = 'owner@vetlink.com';
export const DEMO_PASSWORD = 'VetLink123!';

/** The six-digit code the mock email-verification screen accepts. */
export const DEMO_VERIFICATION_CODE = '482619';

export const DEMO_ACCOUNT: UserAccount = {
  id: 'usr_demo_owner',
  firstName: 'Alex',
  lastName: 'Santos',
  email: DEMO_EMAIL,
  mobile: '+63 917 555 0142',
  password: DEMO_PASSWORD,
  verified: true,
  avatarUri: null,
  address: 'Makati City, Metro Manila',
};

export type NewAccountInput = {
  firstName: string;
  lastName: string;
  email: string;
  mobile: string;
  password: string;
};

export const slugify = (value: string) =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
