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
 * Creates the applicant's account. With "Confirm email" on, Supabase returns no
 * session until the link is followed; the link brings them back to the wizard.
 */
export async function signUpApplicant(
  draft: Pick<ApplicationDraft, 'email' | 'firstName' | 'lastName' | 'mobile'>,
  password: string,
): Promise<{ signedIn: boolean }> {
  const { data, error } = await supabase.auth.signUp({
    email: draft.email.trim(),
    password,
    options: {
      emailRedirectTo: `${window.location.origin}/register/apply`,
      data: {
        first_name: draft.firstName.trim(),
        last_name: draft.lastName.trim(),
        mobile_number: draft.mobile.trim(),
      },
    },
  });
  failure(error);
  // Supabase answers a sign-up for an existing email with a user that has no
  // identities, instead of an error, so the address cannot be probed.
  if (data.user && (data.user.identities ?? []).length === 0) {
    throw new Error('An account already uses this email. Sign in first, then continue your application.');
  }
  return { signedIn: Boolean(data.session) };
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
 * The wizard's draft survives a reload and the email-confirmation round trip.
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
