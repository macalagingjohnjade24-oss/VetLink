# VetLink — Supabase backend setup

VetLink's pet-owner app now runs on Supabase (Postgres + Auth + Storage + RLS).
This folder holds the SQL that has to be applied to **your** Supabase project,
plus the manual dashboard settings that cannot live in source code.

Nothing in this repository invents credentials. Fill in your own.

---

## 1. Create the project and apply the schema

1. Create a project at <https://supabase.com/dashboard>.
2. Open **SQL Editor** and run the migrations **in order**:
   1. `migrations/0001_schema.sql` — tables, constraints, indexes, triggers, profile provisioning.
   2. `migrations/0002_rls.sql` — RLS policies, helper functions, column grants.
   3. `migrations/0003_storage.sql` — buckets and storage policies.
3. Optional, development only: `seed.dev.sql` adds two published sample clinics
   so clinic discovery and booking have data. **Do not run it on production.**

With the Supabase CLI instead of the SQL editor:

```bash
supabase link --project-ref <your-project-ref>
supabase db push
```

## 2. Environment variables

Copy `.env.example` to `.env` in the project root and fill in:

| Variable | Where it comes from |
| --- | --- |
| `EXPO_PUBLIC_SUPABASE_URL` | Project Settings → API → Project URL |
| `EXPO_PUBLIC_SUPABASE_ANON_KEY` | Project Settings → API → `anon` `public` key |

Restart `npx expo start` after editing `.env` (Expo inlines `EXPO_PUBLIC_*` at bundle time).

> The `service_role` key must **never** be added to the app or to an `EXPO_PUBLIC_*`
> variable. It bypasses Row Level Security and is only for trusted server work.

## 3. Email/password authentication

In **Authentication → Providers → Email**:

- Enable **Email** provider.
- Enable **Confirm email** (the app's Email Verification screen expects it).
- Password minimum length 8 to match `src/utils/validation.ts`.

In **Authentication → URL Configuration** add these redirect URLs (keep your
production URL too):

```
vetlink://auth-callback
vetlink://reset-password
exp://127.0.0.1:8081/--/auth-callback
exp://127.0.0.1:8081/--/reset-password
http://localhost:8081/auth-callback
http://localhost:8081/reset-password
http://127.0.0.1:8081/auth-callback
http://127.0.0.1:8081/reset-password
```

The app opens `/auth-callback` for Google sign-in and `/reset-password` for
password recovery. The three families above are the same two paths on the three
ways the app can run:

| Where the app runs | What `makeRedirectUri` returns |
| --- | --- |
| Development build / standalone (native) | `vetlink://auth-callback` — the `scheme` in `app.json` |
| Expo Go (native) | `exp://127.0.0.1:8081/--/auth-callback` |
| **Expo web (`npx expo start --web`)** | `http://localhost:8081/auth-callback` |

On web the scheme argument is ignored: `expo-linking`'s web build of `createURL`
returns `new URL(path, window.location.origin)`, so the redirect is always
**the origin the browser is on plus the path** — port 8081 and the HTTP scheme,
not `vetlink://` and not `https://`. That is why the `http://localhost:8081/…`
entries above are required: without them Supabase rejects the redirect and the
web build never receives the `?code=` back. Open the app on the same host you
allow-listed (`localhost` and `127.0.0.1` are different origins), and add a
matching entry if you serve the web build on another port or origin (for
example `http://localhost:19006/…` for the older web default, or your deployed
web URL).

In Expo Go on a device the scheme is `exp://<host>:<port>/--/…`; add the exact
URL shown by `makeRedirectUri` in your terminal if it differs from the
Laragon/Expo default above (LAN IP instead of `127.0.0.1`, for example).

### Custom SMTP comes first

Since **3 June 2026** a new Free-plan project that sends through Supabase's
default email provider **cannot edit auth email templates at all**, and the
default provider only delivers to addresses on the project's organisation team
(2 emails per hour). The app needs `{{ .Token }}` inside the Confirm signup
email, so on a new project **enable custom SMTP before anything else**.

Brevo works without owning a domain (verify a single sender address instead):

| Supabase field | Value |
| --- | --- |
| Sender email address | the address you verified in Brevo |
| Sender name | `VetLink` |
| Host | `smtp-relay.brevo.com` |
| Port | `587` |
| Username | the **Login** shown on Brevo → Settings → SMTP & API → SMTP tab |
| Password | a Brevo **SMTP key** (not an API key) |

Resend, SendGrid, Postmark and Amazon SES all work too:
`smtp.resend.com:465` (user `resend`, password = API key),
`smtp.sendgrid.net:587` (user `apikey`, password = API key).

### Six-digit confirmation code

Once custom SMTP is on, the Email Templates page becomes editable again. The
Email Verification screen accepts the 6-digit token, so in
**Authentication → Email Templates → Confirm signup** add the token:

```html
<h2>Confirm your VetLink account</h2>
<p>Your VetLink verification code is <strong>{{ .Token }}</strong></p>
<p>Or confirm with this link: <a href="{{ .ConfirmationURL }}">Confirm email</a></p>
```

`{{ .Token }}` is required; the link flow keeps working as well.

### Password reset

The **Reset password** template must contain `{{ .ConfirmationURL }}`. The app
exchanges the recovery link for a session and opens the Reset Password screen;
expired or already-used links show an error instead of hanging.

## 4. Google sign-in

1. **Google Cloud Console → APIs & Services → Credentials → Create credentials
   → OAuth client ID → Web application.**
2. Authorised redirect URI (this is Supabase's callback, not the app's):
   `https://<your-project-ref>.supabase.co/auth/v1/callback`
3. Copy the **Client ID** and **Client secret** into
   **Supabase → Authentication → Providers → Google**, enable the provider and save.
4. Google's consent screen needs the `email`, `profile` and `openid` scopes
   (the defaults).
5. Add the app redirect URLs from section 3 to **Authentication → URL Configuration**
   — including `http://localhost:8081/auth-callback`, which is what the web build
   sends. Nothing goes in the Google console except the Supabase callback from
   step 2: Google only ever redirects to Supabase, and Supabase then redirects to
   the app.

The app uses the PKCE flow (`expo-auth-session` + `WebBrowser.openAuthSessionAsync`)
and exchanges the returned code with `supabase.auth.exchangeCodeForSession`.
No client secret is ever shipped in the app.

**Web build:** the browser popup returns to `http://localhost:8081/auth-callback`
(the page is served by the Expo dev server, and `openAuthSessionAsync` reads the
`?code=` before the page has to render anything). That exact origin must be in
Supabase's redirect allow-list — see section 3.

**Expo Go limitation:** the browser returns to `exp://…/--/auth-callback` inside
Expo Go. That URL must be in Supabase's redirect allow-list. A standalone
development/production build returns to `vetlink://auth-callback`, which behaves
consistently and is the recommended way to demo Google sign-in. Variables and
providers configured in the dashboard apply to both.

## 5. Storage buckets

`0003_storage.sql` creates and locks down:

| Bucket | Visibility | Who writes |
| --- | --- | --- |
| `profile-photos` | public read | the signed-in owner (`{userId}/…`) |
| `pet-photos` | public read | the signed-in owner (`{userId}/…`) |
| `clinic-logos` | public read | clinic admins / service role |
| `medical-record-attachments` | private (signed URLs) | clinic staff (service role) |

## 6. Security model in one screen

- Owners see only their own profile, pets, appointments, notifications and inquiries.
- Owners can read (never write) their pets' medical records and vaccinations.
- Clinic staff reach data only through an active `clinic_memberships` row for that clinic.
- `profiles.role` cannot be updated by clients (column grant + trigger).
- Booking slots are unique per clinic (`appointments_slot_key`) and a trigger
  verifies that the pet belongs to the owner and the service belongs to the clinic.
- Every table has RLS enabled; hiding a button is never the security boundary.

## 7. What still needs your action

- Fill in `.env` (section 2).
- Enable custom SMTP, then add `{{ .Token }}` to the Confirm signup template (section 3).
- Create the Google OAuth client and enable the provider (section 4).
- Optionally run `seed.dev.sql` in development.
