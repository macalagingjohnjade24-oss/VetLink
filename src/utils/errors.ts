/**
 * Turns a thrown service/network error into a sentence an owner can act on.
 * Raw Supabase messages ("permission denied for table pets") are not shown as-is.
 */
export function errorMessage(error: unknown, fallback = 'Something went wrong. Please try again.'): string {
  const raw = error instanceof Error ? error.message.trim() : typeof error === 'string' ? error.trim() : '';
  if (!raw) return fallback;

  if (/network request failed|failed to fetch|network error|fetch failed/i.test(raw)) {
    return 'We couldn’t reach VetLink. Check your internet connection and try again.';
  }
  if (/permission denied|row-level security|jwt|not authorized|42501/i.test(raw)) {
    return 'This account doesn’t have access to that data. Sign in again, then retry.';
  }
  if (/relation .* does not exist|schema cache|column .* does not exist|undefined table/i.test(raw)) {
    return 'The VetLink database is not set up yet. Run the SQL migrations in supabase/migrations, then retry.';
  }
  if (/invalid api key|project ref|no api key/i.test(raw)) {
    return 'The Supabase keys in the project .env are not valid. Update them and restart Expo, then retry.';
  }
  if (/exceeded|timeout|timed out/i.test(raw)) {
    return 'That took too long. Check your connection and try again.';
  }
  return raw;
}
