-- ============================================================================
-- VetLink — OPTIONAL development seed (generated, do not edit)
-- Run AFTER 01_schema.sql, and only on a development / demo project.
-- Adds two sample clinics, a System Administrator login, and a demo clinic with
-- one test login per clinic role plus sample data (credentials in each section).
-- ============================================================================

-- >>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>> seed.dev.sql

-- ===========================================================================
-- VetLink — OPTIONAL development seed data
-- ---------------------------------------------------------------------------
-- This file is for LOCAL / DEVELOPMENT testing only. It inserts two published
-- clinics and their services so clinic discovery, clinic services and the
-- booking flow have something to show before real clinics are onboarded.
--
--   * No users, pets, appointments, medical or vaccination records are seeded.
--   * Do NOT run this against a production database.
-- ===========================================================================

insert into public.clinics (
  id, clinic_name, description, email, contact_number, address, area, city, province,
  latitude, longitude, distance_km, rating, review_count, operating_hours,
  featured, has_availability, status
)
values
  (
    '11111111-1111-4111-8111-111111111111',
    'Paws & Care Veterinary Clinic',
    'A welcoming neighbourhood clinic offering preventive care and consultations for dogs and cats.',
    'hello@pawsandcare.example',
    '+63 2 8555 0128',
    '123 Amorsolo Street, Legazpi Village',
    'Amorsolo Street',
    'Makati City',
    'Metro Manila',
    14.5547, 121.0144, 1.2, 4.8, 214,
    '{"days": [1,2,3,4,5,6], "opens": "08:00", "closes": "18:00", "note": "Monday–Saturday · Closed Sunday"}',
    false, true, 'approved'
  ),
  (
    '22222222-2222-4222-8222-222222222222',
    'Companion Animal Center',
    'A calm, modern practice with wellness plans, grooming and preventive care for companion animals.',
    'team@companionanimal.example',
    '+63 2 8555 0163',
    '24 Legazpi Street, Legazpi Village',
    'Legazpi Village',
    'Makati City',
    'Metro Manila',
    14.5592, 121.0181, 2.4, 4.7, 186,
    '{"days": [1,2,3,4,5,6], "opens": "09:00", "closes": "19:00", "note": "Monday–Saturday · Sunday by appointment"}',
    true, true, 'approved'
  )
on conflict (id) do nothing;

insert into public.clinic_services (clinic_id, service_name, description, price, estimated_duration, availability)
values
  ('11111111-1111-4111-8111-111111111111', 'General consultation', 'Routine wellness checks and health concerns.', 750, 30, 'available'),
  ('11111111-1111-4111-8111-111111111111', 'Vaccination', 'Discuss appropriate vaccinations with the clinic.', 950, 20, 'available'),
  ('11111111-1111-4111-8111-111111111111', 'Dental consultation', 'An assessment of oral health and care needs.', 1400, 45, 'limited'),
  ('22222222-2222-4222-8222-222222222222', 'General consultation', 'Wellness checks and health concerns.', 800, 30, 'available'),
  ('22222222-2222-4222-8222-222222222222', 'Vaccination', 'Core and booster vaccines.', 1000, 20, 'available'),
  ('22222222-2222-4222-8222-222222222222', 'Grooming', 'Routine grooming and coat care.', 900, 60, 'available')
on conflict (clinic_id, (lower(service_name))) do nothing;

-- >>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>> seed.dev.system-admin.sql

-- ===========================================================================
-- VetLink — DEVELOPMENT SEED: one System Administrator test account
-- ---------------------------------------------------------------------------
--  ⚠  DEV / STAGING ONLY. Never run this against production.
--
--  Creates (or repairs) a single confirmed email/password login whose
--  profiles.role is 'system_administrator', so the web console at
--  http://localhost:5173/login can be opened as the System Administrator
--  while the real provisioning flow does not exist yet.
--
--  Login it creates
--    email    : admin@vetlink.dev
--    password : VetLinkDev!2026
--  Change the two constants below before running if you want different ones.
--
--  What it does
--    1. inserts the auth.users row (email already confirmed, bcrypt password)
--    2. inserts the matching auth.identities row so the password grant works
--    3. upserts public.profiles with role = 'system_administrator'
--
--  It does NOT create clinics, staff, patients or clinical records, and it is
--  safe to run twice: an existing account with the same email is reused and
--  its password/role repaired instead of duplicated.
--
--  How to run (Supabase, project vjlmzbjavrysnhpqjiqj)
--    Dashboard → SQL Editor → New query → paste this whole file → Run.
--  Requires migrations 0001–0005 to be applied first. Afterwards sign in at
--  the console with the credentials above; the account lands on
--  /system-admin.
-- ===========================================================================

do $$
declare
  -- ↓ the one place to edit ---------------------------------------------------
  dev_email constant text := 'admin@vetlink.dev';
  dev_password constant text := 'VetLinkDev!2026';
  dev_first_name constant text := 'System';
  dev_last_name constant text := 'Administrator';
  -- ↑ -------------------------------------------------------------------------

  dev_user uuid;
  crypto_schema text;
  has_provider_id boolean;
begin
  -- pgcrypto hashes the password. On Supabase it lives in the `extensions`
  -- schema, which is not always on this session's search_path, so resolve it.
  select n.nspname
    into crypto_schema
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
   where p.proname = 'crypt'
     and p.pronargs = 2
   order by (n.nspname = 'extensions') desc, n.nspname
   limit 1;

  if crypto_schema is null then
    raise exception 'pgcrypto is not installed; run: create extension if not exists pgcrypto;';
  end if;

  select id into dev_user from auth.users where lower(email) = lower(dev_email);

  if dev_user is null then
    dev_user := gen_random_uuid();

    insert into auth.users (
      instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
      created_at, updated_at, raw_app_meta_data, raw_user_meta_data,
      confirmation_token, recovery_token, email_change_token_new, email_change
    ) values (
      '00000000-0000-0000-0000-000000000000',
      dev_user,
      'authenticated',
      'authenticated',
      lower(dev_email),
      null,                       -- filled in below, once the schema is known
      now(), now(), now(),
      jsonb_build_object('provider', 'email', 'providers', jsonb_build_array('email')),
      jsonb_build_object('first_name', dev_first_name, 'last_name', dev_last_name),
      '', '', '', ''
    );
  else
    update auth.users
       set email_confirmed_at = coalesce(email_confirmed_at, now()),
           updated_at = now()
     where id = dev_user;
  end if;

  -- Set/refresh the password (bcrypt via pgcrypto, exactly what GoTrue stores).
  execute format(
    'update auth.users set encrypted_password = %I.crypt($1, %I.gen_salt(''bf'')), updated_at = now() where id = $2',
    crypto_schema, crypto_schema
  ) using dev_password, dev_user;

  -- GoTrue's password grant looks the account up through auth.identities.
  select exists (
    select 1 from information_schema.columns
     where table_schema = 'auth' and table_name = 'identities' and column_name = 'provider_id'
  ) into has_provider_id;

  if has_provider_id then
    insert into auth.identities (provider_id, user_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
    values (
      dev_user::text, dev_user,
      jsonb_build_object('sub', dev_user::text, 'email', lower(dev_email), 'email_verified', true),
      'email', now(), now(), now()
    )
    on conflict do nothing;
  else
    insert into auth.identities (user_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
    values (
      dev_user,
      jsonb_build_object('sub', dev_user::text, 'email', lower(dev_email), 'email_verified', true),
      'email', now(), now(), now()
    )
    on conflict do nothing;
  end if;

  -- profiles.role is guarded by protect_profile_role(), which only lets a
  -- service_role caller change a role. Claim that identity for this
  -- transaction so the escalation trigger stays meaningful for everyone else.
  perform set_config('request.jwt.claims', '{"role":"service_role"}', true);

  insert into public.profiles (id, first_name, last_name, email, role)
  values (dev_user, dev_first_name, dev_last_name, lower(dev_email), 'system_administrator')
  on conflict (id) do update
    set role = 'system_administrator',
        email = excluded.email,
        first_name = case when public.profiles.first_name = '' then excluded.first_name
                          else public.profiles.first_name end,
        last_name = case when public.profiles.last_name = '' then excluded.last_name
                         else public.profiles.last_name end;

  raise notice 'Dev System Administrator ready: % (user id %)', lower(dev_email), dev_user;
end
$$;

-- Confirmation for whoever runs it: should return exactly one row with role
-- system_administrator.
select p.id, p.email, p.role, u.email_confirmed_at is not null as email_confirmed
  from public.profiles p
  join auth.users u on u.id = p.id
 where p.role = 'system_administrator'
 order by p.email;

-- >>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>> seed.dev.test-accounts.sql

-- ===========================================================================
-- VetLink — DEVELOPMENT test accounts, one per role, plus sample data
-- ---------------------------------------------------------------------------
-- Creates an approved demo clinic, "VetLink Demo Animal Clinic", and these
-- confirmed email/password logins (all share one password):
--
--   password for every account below : VetLinkTest!2026
--
--   clinicadmin@vetlink.dev  Clinic Administrator  → /clinic-admin
--   frontdesk@vetlink.dev    Appointment Manager   → /appointments
--   vet@vetlink.dev          Veterinarian          → /veterinarian
--   staff@vetlink.dev        Clinic Staff          → /staff
--   petowner@vetlink.dev     Pet owner (mobile app; the web console refuses it)
--
-- The System Administrator comes from seed.dev.system-admin.sql.
--
-- Sample data so every dashboard has something on it: two pets, appointments
-- today / tomorrow / last week (assigned to the veterinarian), a signed medical
-- record, vaccinations (one due soon, one overdue), staff tasks and
-- notifications. Dates are relative to the database's current date; task
-- due times are set in Manila time (UTC+8).
--
-- How to run: Supabase → SQL Editor → New query → paste this file → Run.
-- Requires the schema (setup/01_schema.sql). Safe to run again: fixed ids,
-- nothing is duplicated, passwords are reset, and the demo visits, record,
-- vaccinations and tasks move back around the current date.
-- DEVELOPMENT / DEMO ONLY — never on a project with real users.
-- ===========================================================================

-- A session-only helper: creates or repairs one confirmed email/password login.
create or replace function pg_temp.vl_test_user(
  p_email text, p_password text, p_first text, p_last text
) returns uuid
language plpgsql
as $$
declare
  uid uuid;
  crypto_schema text;
  has_provider_id boolean;
begin
  select n.nspname into crypto_schema
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where p.proname = 'crypt' and p.pronargs = 2
   order by (n.nspname = 'extensions') desc, n.nspname
   limit 1;
  if crypto_schema is null then
    raise exception 'pgcrypto is not installed; run: create extension if not exists pgcrypto;';
  end if;

  select id into uid from auth.users where lower(email) = lower(p_email);
  if uid is null then
    uid := gen_random_uuid();
    insert into auth.users (
      instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
      created_at, updated_at, raw_app_meta_data, raw_user_meta_data,
      confirmation_token, recovery_token, email_change_token_new, email_change
    ) values (
      '00000000-0000-0000-0000-000000000000', uid, 'authenticated', 'authenticated',
      lower(p_email), null, now(), now(), now(),
      jsonb_build_object('provider', 'email', 'providers', jsonb_build_array('email')),
      jsonb_build_object('first_name', p_first, 'last_name', p_last),
      '', '', '', ''
    );
  else
    update auth.users set email_confirmed_at = coalesce(email_confirmed_at, now()), updated_at = now()
     where id = uid;
  end if;

  execute format(
    'update auth.users set encrypted_password = %I.crypt($1, %I.gen_salt(''bf'')), updated_at = now() where id = $2',
    crypto_schema, crypto_schema
  ) using p_password, uid;

  select exists (
    select 1 from information_schema.columns
     where table_schema = 'auth' and table_name = 'identities' and column_name = 'provider_id'
  ) into has_provider_id;

  if not exists (select 1 from auth.identities where user_id = uid) then
    if has_provider_id then
      insert into auth.identities (provider_id, user_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
      values (uid::text, uid,
              jsonb_build_object('sub', uid::text, 'email', lower(p_email), 'email_verified', true),
              'email', now(), now(), now());
    else
      insert into auth.identities (user_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
      values (uid,
              jsonb_build_object('sub', uid::text, 'email', lower(p_email), 'email_verified', true),
              'email', now(), now(), now());
    end if;
  end if;

  update public.profiles
     set first_name = p_first, last_name = p_last, email = lower(p_email)
   where id = uid;
  return uid;
end;
$$;

do $$
declare
  test_password constant text := 'VetLinkTest!2026';
  clinic constant uuid := '33333333-3333-4333-8333-333333333333';
  svc_consult uuid := '33333333-3333-4333-8333-2222222222a1';
  svc_vaccine uuid := '33333333-3333-4333-8333-2222222222a2';
  pet_milo constant uuid := '33333333-3333-4333-8333-2222222222b1';
  pet_nala constant uuid := '33333333-3333-4333-8333-2222222222b2';
  admin_id uuid;
  desk_id uuid;
  vet_id uuid;
  staff_id uuid;
  owner_id uuid;
  -- The database's own "today": clinic_limited_schedule() and the other
  -- day-scoped reads use current_date, so the demo visits must too.
  local_today constant date := current_date;
begin
  -- profiles.role is guarded by protect_profile_role(); act as the service role
  -- for this transaction only, exactly as the provisioning Edge Functions do.
  perform set_config('request.jwt.claims', '{"role":"service_role"}', true);

  admin_id := pg_temp.vl_test_user('clinicadmin@vetlink.dev', test_password, 'Andrea', 'Reyes');
  desk_id := pg_temp.vl_test_user('frontdesk@vetlink.dev', test_password, 'Maria', 'Santos');
  vet_id := pg_temp.vl_test_user('vet@vetlink.dev', test_password, 'Carlo', 'Mendoza');
  staff_id := pg_temp.vl_test_user('staff@vetlink.dev', test_password, 'Janelle', 'Cruz');
  owner_id := pg_temp.vl_test_user('petowner@vetlink.dev', test_password, 'Ana', 'Cruz');

  update public.profiles set mobile_number = '+63 917 548 2316' where id = owner_id;

  -- The clinic, approved and published.
  insert into public.clinics (
    id, clinic_name, description, email, contact_number, address, area, city, province,
    latitude, longitude, rating, review_count, operating_hours, has_availability, status,
    submitted_at, reviewed_at
  ) values (
    clinic, 'VetLink Demo Animal Clinic',
    'A demo clinic for testing every VetLink workspace.',
    'demo@vetlink.dev', '+63 2 8555 0199', '26 Acacia Street', 'Bagumbayan', 'Quezon City',
    'Metro Manila', 14.6091, 121.0223, 4.7, 12,
    '{"days":[1,2,3,4,5,6],"opens":"08:00","closes":"18:00","note":"Mon–Sat · 08:00–18:00"}',
    true, 'approved', now() - interval '30 days', now() - interval '29 days'
  ) on conflict (id) do update set status = 'approved';

  insert into public.clinic_services (id, clinic_id, service_name, description, price, estimated_duration, category)
  values
    (svc_consult, clinic, 'General consultation', 'Routine examinations and health advice.', 600, 30, 'Consultation'),
    (svc_vaccine, clinic, 'Vaccination', 'Core and recommended pet vaccines.', 900, 20, 'Preventive care')
  on conflict do nothing;

  -- A service with the same name may already exist under another id; use the
  -- row that is actually there so the appointments below reference it.
  select id into svc_consult from public.clinic_services
   where clinic_id = clinic and lower(service_name) = 'general consultation';
  select id into svc_vaccine from public.clinic_services
   where clinic_id = clinic and lower(service_name) = 'vaccination';

  -- Memberships: one active member per clinic role. The membership triggers
  -- (0011/0013) keep profiles.role in step; it is also set explicitly here.
  insert into public.clinic_memberships (clinic_id, user_id, staff_role, status) values
    (clinic, admin_id, 'clinic_administrator', 'active'),
    (clinic, desk_id, 'receptionist', 'active'),
    (clinic, vet_id, 'veterinarian', 'active'),
    (clinic, staff_id, 'clinic_staff', 'active')
  on conflict (clinic_id, user_id) do update set staff_role = excluded.staff_role, status = 'active';

  update public.profiles set role = 'clinic_administrator' where id = admin_id;
  update public.profiles set role = 'receptionist' where id = desk_id;
  update public.profiles set role = 'veterinarian' where id = vet_id;
  update public.profiles set role = 'clinic_staff' where id = staff_id;
  update public.profiles set role = 'pet_owner' where id = owner_id;

  -- The pet owner's pets.
  insert into public.pets (id, owner_id, pet_name, species, breed, sex, date_of_birth, weight)
  values
    (pet_milo, owner_id, 'Milo', 'Dog', 'Golden Retriever', 'Male', local_today - interval '3 years', 28.4),
    (pet_nala, owner_id, 'Nala', 'Cat', 'Domestic Shorthair', 'Female', local_today - interval '2 years', 4.1)
  on conflict do nothing;

  -- Appointments around today. Fixed ids keep a re-run from duplicating them.
  insert into public.appointments (
    id, owner_id, clinic_id, pet_id, service_id, service_name, appointment_date, appointment_time,
    reason_for_visit, owner_name, contact, price, status, assigned_vet_user_id
  ) values
    ('33333333-3333-4333-8333-2222222222c1', owner_id, clinic, pet_milo, svc_consult, 'General consultation',
      local_today - 7, '10:00', 'Annual wellness check', 'Ana Cruz', '+63 917 548 2316', 600, 'completed', vet_id),
    ('33333333-3333-4333-8333-2222222222c2', owner_id, clinic, pet_milo, svc_consult, 'General consultation',
      local_today, '09:00', 'Intermittent itching for 3 days', 'Ana Cruz', '+63 917 548 2316', 600, 'confirmed', vet_id),
    ('33333333-3333-4333-8333-2222222222c3', owner_id, clinic, pet_nala, svc_vaccine, 'Vaccination',
      local_today, '11:00', 'Booster shot', 'Ana Cruz', '+63 917 548 2316', 900, 'confirmed', vet_id),
    ('33333333-3333-4333-8333-2222222222c4', owner_id, clinic, pet_nala, svc_consult, 'General consultation',
      local_today + 1, '14:00', 'Not eating well', 'Ana Cruz', '+63 917 548 2316', 600, 'pending', null),
    ('33333333-3333-4333-8333-2222222222c5', owner_id, clinic, pet_milo, svc_consult, 'General consultation',
      local_today + 3, '09:30', 'Skin follow-up', 'Ana Cruz', '+63 917 548 2316', 600, 'confirmed', vet_id)
  -- A re-run moves the demo visits back around today and resets their status.
  on conflict (id) do update
    set appointment_date = excluded.appointment_date,
        appointment_time = excluded.appointment_time,
        status = excluded.status,
        assigned_vet_user_id = excluded.assigned_vet_user_id;

  -- A signed record for last week's completed visit.
  insert into public.medical_records (
    id, pet_id, owner_id, clinic_id, appointment_id, veterinarian_name, author_user_id, record_date,
    diagnosis, treatment, prescription, notes, observations, vitals, follow_up_date
  ) values (
    '33333333-3333-4333-8333-2222222222d1', pet_milo, owner_id, clinic,
    '33333333-3333-4333-8333-2222222222c1', 'Carlo Mendoza', vet_id, local_today - 7,
    'Routine wellness examination — healthy', 'No treatment indicated', null,
    'Maintain diet and exercise.', 'Alert, hydrated; normal heart and lungs.',
    '{"weight_kg":28.4,"temperature_c":38.5,"heart_rate_bpm":84,"respiratory_rate_bpm":22}',
    local_today + 358
  ) on conflict (id) do update
    set record_date = excluded.record_date,
        follow_up_date = excluded.follow_up_date;

  -- Vaccinations: Milo due within the month, Nala overdue.
  insert into public.vaccinations (
    id, pet_id, owner_id, clinic_id, vaccine_name, vaccination_date, next_due_date,
    dosage, batch_number, veterinarian_name, notes
  ) values
    ('33333333-3333-4333-8333-2222222222e1', pet_milo, owner_id, clinic, 'Rabies', local_today - 345,
      local_today + 20, '1 mL SC', 'RB-2291', 'Carlo Mendoza', 'No reaction observed.'),
    ('33333333-3333-4333-8333-2222222222e2', pet_nala, owner_id, clinic, 'FVRCP', local_today - 380,
      local_today - 15, '1 mL SC', 'FV-1180', 'Carlo Mendoza', null)
  on conflict (id) do update
    set vaccination_date = excluded.vaccination_date,
        next_due_date = excluded.next_due_date;

  -- Tasks for the clinic staff member, assigned by the administrator.
  insert into public.clinic_tasks (id, clinic_id, title, description, priority, status, assigned_to, created_by, due_at)
  values
    ('33333333-3333-4333-8333-2222222222f1', clinic, 'Prepare consultation room 2',
      'Set up clean supplies before the first visit.', 'high', 'pending', staff_id, admin_id,
      (date_trunc('day', now() at time zone 'Asia/Manila') + interval '8 hours 30 minutes') at time zone 'Asia/Manila'),
    ('33333333-3333-4333-8333-2222222222f2', clinic, 'Assist Milo''s check-in',
      'Guide the owner to the waiting area and notify the front desk.', 'normal', 'in_progress', staff_id, admin_id,
      (date_trunc('day', now() at time zone 'Asia/Manila') + interval '9 hours') at time zone 'Asia/Manila'),
    ('33333333-3333-4333-8333-2222222222f3', clinic, 'Restock reception supplies',
      'Forms, pet tags and sanitizer.', 'low', 'pending', staff_id, admin_id,
      (date_trunc('day', now() at time zone 'Asia/Manila') + interval '1 day 10 hours') at time zone 'Asia/Manila')
  on conflict (id) do update
    set status = excluded.status,
        due_at = excluded.due_at,
        completed_at = null;

  -- One welcome notification per staff account (only on the first run).
  if not exists (select 1 from public.notifications where user_id = staff_id and clinic_id = clinic) then
    insert into public.notifications (user_id, clinic_id, title, message, notification_type)
    values
      (admin_id, clinic, 'Welcome to VetLink', 'Your demo clinic is approved and ready.', 'general'),
      (desk_id, clinic, 'New booking request', 'Nala has a pending consultation request for tomorrow.', 'appointment_pending'),
      (vet_id, clinic, 'Visits assigned to you', 'Milo and Nala are on your schedule today.', 'general'),
      (staff_id, clinic, 'New task assigned', 'Prepare consultation room 2', 'general');
  end if;

  raise notice 'Demo clinic and test accounts are ready.';
end
$$;

-- Confirmation: one row per test account with its role and clinic membership.
select p.email, p.role, m.staff_role, m.status as membership, c.clinic_name
  from public.profiles p
  left join public.clinic_memberships m on m.user_id = p.id
  left join public.clinics c on c.id = m.clinic_id
 where p.email in (
   'clinicadmin@vetlink.dev', 'frontdesk@vetlink.dev', 'vet@vetlink.dev',
   'staff@vetlink.dev', 'petowner@vetlink.dev'
 )
 order by p.email;
