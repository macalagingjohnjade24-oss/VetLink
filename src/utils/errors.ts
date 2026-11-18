/**
 * Turns a thrown service/network error into a sentence an owner can act on.
 * Raw Supabase/PostgREST text ("permission denied for table pets", "Could not
 * find the table 'public.clinics' in the schema cache") is never shown as-is.
 */

export const DATABASE_SETUP_MESSAGE =
  'VetLink’s database isn’t set up yet. Run the SQL files in supabase/migrations (0001, then 0002, then 0003) in your Supabase project, then retry.';

type ErrorLike = { message?: string; code?: string; error_description?: string };

/** PostgREST failures arrive either as an Error or as the plain object supabase-js returns. */
function asErrorLike(error: unknown): ErrorLike {
  return typeof error === 'object' && error !== null ? (error as ErrorLike) : {};
}

function messageOf(error: unknown): string {
  if (error instanceof Error) return error.message.trim();
  if (typeof error === 'string') return error.trim();
  const { message, error_description } = asErrorLike(error);
  return (message ?? error_description ?? '').trim();
}

/**
 * A missing table/column or bucket means the migrations have not been applied
 * to this project — a setup problem, not something retrying can fix.
 * PostgREST: PGRST205 table not in schema cache, 42P01 relation missing,
 * PGRST204 column not in schema cache, 42703 undefined column.
 */
export function isDatabaseSetupError(error: unknown): boolean {
  const { code } = asErrorLike(error);
  if (code === 'PGRST205' || code === '42P01' || code === 'PGRST204' || code === '42703') return true;
  return /could not find the table|relation .+ does not exist|column .+ does not exist|schema cache|bucket not found/i.test(
    messageOf(error),
  );
}

export function errorMessage(error: unknown, fallback = 'Something went wrong. Please try again.'): string {
  const raw = messageOf(error);
  if (!raw) return fallback;

  if (/network request failed|failed to fetch|network error|fetch failed/i.test(raw)) {
    return 'We couldn’t reach VetLink. Check your internet connection and try again.';
  }
  if (isDatabaseSetupError(error)) {
    return DATABASE_SETUP_MESSAGE;
  }
  if (/permission denied|row-level security|jwt|not authorized|42501/i.test(raw)) {
    return 'This account doesn’t have access to that data. Sign in again, then retry.';
  }
  if (/invalid api key|project ref|no api key/i.test(raw)) {
    return 'The Supabase keys in the project .env are not valid. Update them and restart Expo, then retry.';
  }
  if (/exceeded|timeout|timed out/i.test(raw)) {
    return 'That took too long. Check your connection and try again.';
  }
  return raw;
}
