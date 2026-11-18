/**
 * Account domain types used by the app.
 *
 * Accounts themselves live in Supabase (`auth.users` + `public.profiles`);
 * there is no seeded or hardcoded login in the app any more.
 */
export type UserAccount = {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  mobile: string;
  /** True once Supabase has confirmed the email address. */
  verified: boolean;
  avatarUri?: string | null;
  address?: string;
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
