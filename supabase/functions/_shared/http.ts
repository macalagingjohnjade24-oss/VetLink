/**
 * Shared helpers for the VetLink console Edge Functions.
 *
 * Both functions verify the caller's JWT with the *anon* key, then use the
 * service role key for the privileged Auth Admin calls. The service role never
 * leaves the function runtime.
 */
import { createClient, type SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.58.0';

export const corsHeaders: Record<string, string> = {
  'Access-Control-Allow-Origin': Deno.env.get('CONSOLE_ORIGIN') ?? 'http://localhost:5173',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

export function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

export function preflight(req: Request): Response | null {
  return req.method === 'OPTIONS' ? new Response('ok', { headers: corsHeaders }) : null;
}

export function adminClient(): SupabaseClient {
  const url = Deno.env.get('SUPABASE_URL');
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!url || !serviceKey) {
    throw new Error('The function is missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.');
  }
  return createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
}

/** Anon client bound to the caller's JWT — RLS applies, so this is the safe one to read with. */
export function callerClient(req: Request): SupabaseClient {
  const url = Deno.env.get('SUPABASE_URL');
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY');
  const token = req.headers.get('Authorization') ?? '';
  if (!url || !anonKey) {
    throw new Error('The function is missing SUPABASE_URL or SUPABASE_ANON_KEY.');
  }
  return createClient(url, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: token } },
  });
}

export function consoleOrigin(req: Request): string {
  return (
    Deno.env.get('CONSOLE_ORIGIN') ??
    req.headers.get('origin') ??
    'http://localhost:5173'
  ).replace(/\/$/, '');
}

export type Caller = { id: string; email: string | null };

export async function requireUser(
  caller: SupabaseClient,
): Promise<{ user: Caller } | { error: Response }> {
  const { data, error } = await caller.auth.getUser();
  if (error || !data.user) {
    return { error: json({ error: 'Sign in to continue.' }, 401) };
  }
  return { user: { id: data.user.id, email: data.user.email ?? null } };
}

export function profileRole(staffRole: string): string {
  switch (staffRole) {
    case 'receptionist':
      return 'receptionist';
    case 'veterinarian':
      return 'veterinarian';
    case 'clinic_staff':
      return 'clinic_staff';
    default:
      throw new Error(`Unsupported staff role: ${staffRole}`);
  }
}

export function splitName(first?: string, last?: string): { first_name: string; last_name: string } {
  return {
    first_name: (first ?? '').trim(),
    last_name: (last ?? '').trim(),
  };
}
