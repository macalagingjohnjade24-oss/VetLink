/**
 * register-clinic-applicant — step 1 of the public clinic application.
 *
 * Creates the applicant's sign-in with the email already confirmed, so the
 * wizard can sign them in and go straight to step 2 without a confirmation
 * email. "Confirm email" stays on for every other sign-up (the mobile app's
 * pet-owner registration relies on it).
 *
 * The account is an ordinary one: handle_new_user (0001) files it as a
 * pet_owner profile, so this never grants clinic access. A System
 * Administrator's approval (provision-clinic-admin) does that later.
 */
import { serve, adminClient, json } from '../_shared/http.ts';

type Body = {
  email?: string;
  password?: string;
  first_name?: string;
  last_name?: string;
  mobile_number?: string;
};

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const text = (value?: string | null) => (value ?? '').trim();

/** Mirrors passwordProblem() in web/src/register/application.ts. */
function weakPassword(password: string): boolean {
  return (
    password.length < 8 ||
    !/[a-z]/.test(password) ||
    !/[A-Z]/.test(password) ||
    !/\d/.test(password) ||
    !/[^A-Za-z0-9]/.test(password)
  );
}

serve(async (req) => {
  if (req.method !== 'POST') return json({ error: 'Use POST.' }, 405);

  let body: Body;
  try {
    body = await req.json();
  } catch {
    return json({ error: 'Expected a JSON body.' }, 400);
  }

  const email = text(body.email).toLowerCase();
  const password = body.password ?? '';
  const firstName = text(body.first_name);
  const lastName = text(body.last_name);
  const mobileNumber = text(body.mobile_number);

  if (!firstName) return json({ error: 'Enter your first name.' }, 400);
  if (!lastName) return json({ error: 'Enter your last name.' }, 400);
  if (!EMAIL.test(email)) return json({ error: 'Enter a valid email address.' }, 400);
  if (weakPassword(password)) {
    return json(
      { error: 'Use at least 8 characters with uppercase, lowercase, a number and a symbol.' },
      400,
    );
  }

  const { error } = await adminClient().auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { first_name: firstName, last_name: lastName, mobile_number: mobileNumber },
  });

  if (error) {
    const taken =
      (error as { status?: number }).status === 422 ||
      /already been registered|email_exists|already registered/i.test(error.message);
    if (taken) {
      return json(
        { error: 'An account already uses this email. Sign in first, then continue your application.' },
        409,
      );
    }
    return json({ error: error.message }, 400);
  }

  return json({ status: 'created' });
});
