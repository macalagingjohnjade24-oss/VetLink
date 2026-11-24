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
# Expo web on this machine
http://localhost:8081/auth-callback
http://localhost:8081/reset-password
http://127.0.0.1:8081/auth-callback
http://127.0.0.1:8081/reset-password

# Expo Go on a phone — use the host `npx expo start` prints
# (for example exp://192.168.254.158:8081/--/auth-callback)
exp://<dev-server-host>:8081/--/auth-callback
exp://<dev-server-host>:8081/--/reset-password

# Development build / APK
vetlink://auth-callback
vetlink://reset-password
```

Keep **Site URL** pointing at a real page as well: any redirect that is not on
this list is silently replaced by the Site URL, and the app then reports the
mismatch instead of signing in.

The app opens `/auth-callback` for Google sign-in and `/reset-password` for
password recovery. The three families above are the same two paths on the three
ways the app can run:

| Where the app runs | What `makeRedirectUri` returns |
| --- | --- |
| Development build / standalone (native) | `vetlink://auth-callback` — the `scheme` in `app.json` |
| Expo Go (native) | `exp://<dev-server-host>:8081/--/auth-callback`
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

**Expo Go:** the redirect is `exp://<dev-server-host>:8081/--/auth-callback`.
`scheme: 'vetlink'` is ignored there — Expo Go only registers `exp` — so that
exact host must be in the allow-list. Android's Custom Tab cannot hand an
`exp://` URL back to `WebBrowser.openAuthSessionAsync`: it stops at the hand-off
and the call resolves as dismissed. The app therefore treats the incoming deep
link as the callback — `Linking` delivers it to `handleAuthUrl`, which exchanges
the code and hands the signed-in account back to the screen that started the
flow. A genuine dismissal still cancels silently.

**Development build / APK:** the redirect becomes `vetlink://auth-callback` (the
`scheme` in `app.json`), which is stable and is the recommended way to demo or
ship Google sign-in — Expo's own docs advise a build for auth callbacks. Add
`vetlink://auth-callback` and `vetlink://reset-password` to the allow-list, then:

```
npx expo install expo-dev-client
npx expo start --dev-client        # launch the dev client, then open the project
# or a shareable APK:
eas build --profile development --platform android
```

A development build launched from the dev server can report
`vetlink://<dev-server-host>/auth-callback`; add `vetlink://**` if you want one
entry to cover both that form and the standalone `vetlink://auth-callback`.

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
- To open the web console before provisioning exists, run
  `seed.dev.system-admin.sql` in development (section 8).

## 8. Clinic staff and system administrator web console (`web/`)

The web console is a separate Vite + React application in `web/`. It uses the
same Supabase project as the mobile app; nothing under `src/` is shared or
modified, so Expo Go builds are unaffected.

### Apply the console migrations

Run these **after** `0001`–`0003`:

1. `migrations/0004_web_console.sql` — `system_administrator` policies, the
   `clinic_staff` profile role, clinic review columns, service categories,
   assigned veterinarian, `clinic_tasks`, `platform_audit_log`,
   `clinic_documents`, clinic registration/review RPCs and the dashboard
   statistics functions.
2. `migrations/0005_clinic_documents.sql` — the private `clinic-documents`
   bucket plus the clinic logo and attachment policies.
3. `migrations/0006_platform_administration.sql` — the single
   `platform_settings` row (SA-15), `send_platform_announcement()` (SA-14) and
   the applicant notification for "request additional information".
4. `migrations/0007_platform_list_queries.sql` — `platform_users_page()`, the
   paged account directory with role, account-state and clinic filters, and
   `clinic_team_counts()`, the per-clinic active staff count.

`0004` is additive: it never drops a table, a column or a policy the mobile app
depends on. The only constraint it replaces is `profiles_role_check`, to add
`clinic_staff`. `0002`–`0005` can be pasted again on an already-migrated
database (`0001` cannot — `appointments_pet_owner_fk` depends on the
`pets_id_owner_key` constraint it drops), so re-running `0004` after fixing an
error is safe.

### Re-running the migration check

`supabase/tests/` replays `0001`–`0007` and `seed.dev.system-admin.sql` on a
disposable in-memory Postgres (PGlite), then asserts the platform functions:
dashboard counts, `clinic_team_counts()`, and `platform_users_page()`'s role,
account-state and search filters, paging and page-size validation, plus the
grants and the non-administrator refusals. It needs no Supabase project, Docker
or database URL:

```bash
cd supabase/tests
npm install
npm test
```

Every run starts from an empty database, so it fails as soon as a migration no
longer applies from scratch. Fixtures and the replicated `auth`/`storage`
schemas live in `harness.mjs`; add a migration to its `MIGRATIONS` array when you
add a file under `supabase/migrations/`.

### Development seed: a System Administrator login

`seed.dev.system-admin.sql` creates **one development-only** System
Administrator, so the console can be opened before the real provisioning flow
and the Phase 3 screens exist.

| | |
| --- | --- |
| email | `admin@vetlink.dev` |
| password | `VetLinkDev!2026` |
| lands on | `/system-admin` |

- **Development and staging only — never run it against production.**
- Run it after `0004`/`0005`, either in the SQL editor or with
  `psql "$DATABASE_URL" -f supabase/seed.dev.system-admin.sql`.
- It is safe to re-run: an existing `admin@vetlink.dev` account is reused and its
  password, confirmation and role are repaired instead of duplicated, so it also
  fixes an account that was demoted or whose password is unknown.
- It creates the `auth.users` row, its `auth.identities` row (needed by the
  password grant) and the `profiles` row with `role = 'system_administrator'`.
  It creates no clinics, staff, patients or clinical records.
- Change the constants at the top of the `do $$` block for different credentials.

The role is written under a transaction-local `service_role` claim, because
`protect_profile_role()` refuses role changes from every other caller — browser
clients still cannot promote themselves.

### System Administrator screens (Phase 3)

All sixteen SA frames are implemented under `/system-admin`:

| Screen | Route |
| --- | --- |
| SA-01 dashboard | `/system-admin` |
| SA-02 clinic directory | `/system-admin/clinics` |
| SA-03 registration requests | `/system-admin/applications` |
| SA-04 review + SA-05 confirmation states | `/system-admin/applications/:id` |
| SA-06 clinic accounts | `/system-admin/accounts` |
| SA-07 clinic details | `/system-admin/clinics/:id` |
| SA-08 platform users | `/system-admin/users` |
| SA-09 user details | `/system-admin/users/:id` |
| SA-10 roles & access | `/system-admin/roles` |
| SA-11 monitoring | `/system-admin/monitoring` |
| SA-12 reports | `/system-admin/reports` |
| SA-13 audit logs | `/system-admin/audit` |
| SA-14 notifications | `/system-admin/notifications` |
| SA-15 system settings | `/system-admin/settings` |
| SA-16 profile | `/system-admin/profile` |

Every screen reads live Supabase rows through the policies in `0004`–`0006`;
nothing is sample data. Where a design element would need infrastructure the
project does not have — uptime history, error tracking, email/push delivery,
editable role grants — the screen says so instead of simulating it.

### Environment

The console reads its own file, `web/.env` (gitignored):

```
VITE_SUPABASE_URL=https://<project-ref>.supabase.co
VITE_SUPABASE_ANON_KEY=<anon public key>
```

These are the same two public values as section 2. `service_role` must never
appear here — Vite inlines `VITE_*` into the browser bundle.

```bash
cd web
npm install
npm run dev      # http://localhost:5173
tsc --noEmit     # type check
npm run build    # production bundle in web/dist
```

### Auth redirects for the console

Add these to **Authentication → URL Configuration** as well (they are extra
entries — keep the ones from section 3):

```
http://localhost:5173/reset-password
http://localhost:5173/activate
```

`/activate` is where staff and clinic-administrator invitations return; without
it Supabase rewrites the invitation to the Site URL and activation fails.

### Edge Functions

Two functions carry the only operations that need `service_role`:

| Function | Caller | What it does |
| --- | --- | --- |
| `invite-staff` | an active Clinic Administrator of the clinic | invites (or links) a receptionist, veterinarian or clinic staff member and writes the membership row |
| `provision-clinic-admin` | a System Administrator | approves a clinic and invites (or links) its Clinic Administrator |
| `register-clinic-applicant` | anyone (step 1 of clinic registration) | creates the applicant's pet-owner sign-in with the email already confirmed, so the wizard skips the confirmation email |

Both verify the caller's JWT with the anon key first, then use the service role
only inside the function. Set the console origin and deploy:

```bash
supabase link --project-ref <project-ref>
supabase secrets set CONSOLE_ORIGIN=http://localhost:5173
supabase functions deploy invite-staff
supabase functions deploy provision-clinic-admin
supabase functions deploy register-clinic-applicant
```

`CONSOLE_ORIGIN` is both the CORS allow-list origin and the base of the
invitation `redirectTo`. After deploying, set it to the hosted console URL.

### Roles

The console signs in with the existing Supabase email/password provider. Role
comes from `profiles.role`; clinic scope comes from an active or invited
`clinic_memberships` row:

| Role | Lands on |
| --- | --- |
| `clinic_administrator` | `/clinic-admin` |
| `receptionist` | `/appointments` |
| `veterinarian` | `/veterinarian` |
| `clinic_staff` | `/staff` |
| `system_administrator` | `/system-admin` |

A `pet_owner` account is sent to the access-restricted screen, and `profiles.role`
is still not writable by any browser client.
