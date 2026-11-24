import { supabase } from '@/lib/supabase';
import type { ApplicationDraft, UploadedDocument } from './application';
import { buildPayload } from './application';

/**
 * Public clinic registration against the existing backend:
 *
 *   - the account is an ordinary Supabase sign-up, so it starts as a pet_owner
 *     profile (handle_new_user, 0001) — registering never grants clinic access;
 *   - documents go to the private clinic-documents bucket under the
 *     applicant's own folder, the only place 0005 lets them write;
 *   - submit_clinic_application() (0004) creates the pending clinic and the
 *     applicant's *invited* administrator membership;
 *   - my_clinic_application() (0025) is how the applicant reads it back.
 *
 * A System Administrator's approval (provision-clinic-admin) is what turns the
 * account into a Clinic Administrator.
 */

function failure(error: { message: string } | null) {
  if (error) throw new Error(error.message);
}

export async function currentUserId(): Promise<string | null> {
  const { data } = await supabase.auth.getSession();
  return data.session?.user.id ?? null;
}

/**
 * Creates the applicant's account and signs them in. The
 * register-clinic-applicant Edge Function creates it with the email already
 * confirmed, so the applicant goes straight to step 2 with no confirmation
 * email ("Confirm email" stays on for the mobile app's sign-ups).
 */
export async function signUpApplicant(
  draft: Pick<ApplicationDraft, 'email' | 'firstName' | 'lastName' | 'mobile'>,
  password: string,
): Promise<void> {
  const email = draft.email.trim();
  const { error } = await supabase.functions.invoke('register-clinic-applicant', {
    body: {
      email,
      password,
      first_name: draft.firstName.trim(),
      last_name: draft.lastName.trim(),
      mobile_number: draft.mobile.trim(),
    },
  });
  if (error) {
    let text = error.message;
    const context = (error as { context?: Response }).context;
    if (context && typeof context.json === 'function') {
      try {
        const payload = (await context.json()) as { error?: string };
        if (payload?.error) text = payload.error;
      } catch {
        /* keep the SDK message when the body is not JSON */
      }
    }
    throw new Error(text);
  }
  const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
  failure(signInError);
}

/** The signed-in applicant's own name and contact, kept in step with step 1. */
export async function updateApplicantProfile(
  userId: string,
  draft: Pick<ApplicationDraft, 'firstName' | 'lastName' | 'mobile'>,
): Promise<void> {
  const { error } = await supabase
    .from('profiles')
    .update({
      first_name: draft.firstName.trim(),
      last_name: draft.lastName.trim(),
      mobile_number: draft.mobile.trim() || null,
    })
    .eq('id', userId);
  failure(error);
}

export async function fetchApplicantProfile(userId: string) {
  const { data, error } = await supabase
    .from('profiles')
    .select('first_name,last_name,email,mobile_number,role')
    .eq('id', userId)
    .maybeSingle();
  failure(error);
  return data as {
    first_name: string | null;
    last_name: string | null;
    email: string | null;
    mobile_number: string | null;
    role: string;
  } | null;
}

const safeName = (name: string) => name.replace(/[^A-Za-z0-9._-]+/g, '-').slice(-80);

export async function uploadDocument(userId: string, file: File, kind: string): Promise<UploadedDocument> {
  const path = `${userId}/${Date.now()}-${safeName(file.name)}`;
  const { error } = await supabase.storage
    .from('clinic-documents')
    .upload(path, file, { contentType: file.type, upsert: false });
  failure(error);
  return { name: file.name, storage_path: path, kind, size: file.size };
}

export async function removeDocument(path: string): Promise<void> {
  const { error } = await supabase.storage.from('clinic-documents').remove([path]);
  failure(error);
}

export async function submitApplication(
  draft: ApplicationDraft,
): Promise<{ clinic_id: string; reference: string | null; status: string }> {
  const { data, error } = await supabase.rpc('submit_clinic_application', {
    payload: buildPayload(draft),
  });
  failure(error);
  return data as { clinic_id: string; reference: string | null; status: string };
}

export type MyApplication = {
  clinic_id: string;
  clinic_name: string;
  reference: string | null;
  status: string;
  submitted_at: string | null;
  reviewed_at: string | null;
  review_notes: string | null;
  document_count: number;
};

export async function fetchMyApplication(): Promise<MyApplication | null> {
  const { data, error } = await supabase.rpc('my_clinic_application');
  failure(error);
  const rows = (data ?? []) as MyApplication[];
  return rows[0] ?? null;
}

/**
 * The wizard's draft survives a reload.
 * It lives in this browser only and never holds the password.
 */
const DRAFT_KEY = 'vetlink.clinic-application';

export function loadDraft(): { draft: ApplicationDraft; step: number } | null {
  try {
    const raw = window.localStorage.getItem(DRAFT_KEY);
    return raw ? (JSON.parse(raw) as { draft: ApplicationDraft; step: number }) : null;
  } catch {
    return null;
  }
}

export function saveDraft(draft: ApplicationDraft, step: number) {
  try {
    window.localStorage.setItem(DRAFT_KEY, JSON.stringify({ draft, step }));
  } catch {
    // Storage blocked: the wizard still works, it just cannot resume.
  }
}

export function clearDraft() {
  try {
    window.localStorage.removeItem(DRAFT_KEY);
  } catch {
    // Nothing to clear.
  }
}
