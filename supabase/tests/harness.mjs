/**
 * Throwaway Postgres for the migration check.
 *
 * PGlite is Postgres compiled to WASM, so the tests need no `supabase start`,
 * no Docker and no database URL. It is missing the pieces a hosted Supabase
 * project provides, so the prelude below recreates just enough of them:
 *
 *   - the anon / authenticated / service_role roles the grants name
 *   - auth.users, auth.identities and auth.uid() / auth.role() / auth.jwt()
 *   - storage.buckets, storage.objects and storage.foldername()
 *   - extensions.crypt / extensions.gen_salt (PGlite ships no pgcrypto)
 *
 * The migrations themselves are never edited: only 0001's
 * `create extension if not exists "pgcrypto"` line is dropped, because the
 * stubs above stand in for the extension.
 */
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { PGlite } from '@electric-sql/pglite';

export const MIGRATIONS = [
  '0001_schema.sql',
  '0002_rls.sql',
  '0003_storage.sql',
  '0004_web_console.sql',
  '0005_clinic_documents.sql',
  '0006_platform_administration.sql',
  '0007_platform_list_queries.sql',
  '0008_clinic_staff_permissions.sql',
  '0009_clinic_profile_guard.sql',
  '0010_clinic_membership_role_guard.sql',
  '0011_membership_profile_role_sync.sql',
  '0012_service_role_function_grants.sql',
  '0013_membership_insert_profile_role_sync.sql',
];

const PRELUDE = `
create role anon;
create role authenticated;
create role service_role;

create schema auth;
create schema storage;
create schema extensions;

create table auth.users (
  instance_id uuid,
  id uuid primary key,
  aud text,
  role text,
  email text unique,
  encrypted_password text,
  email_confirmed_at timestamptz,
  confirmation_token text,
  recovery_token text,
  email_change_token_new text,
  email_change text,
  raw_app_meta_data jsonb default '{}'::jsonb,
  raw_user_meta_data jsonb default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table auth.identities (
  id uuid primary key default gen_random_uuid(),
  provider_id text,
  user_id uuid not null references auth.users (id) on delete cascade,
  identity_data jsonb not null default '{}'::jsonb,
  provider text not null,
  last_sign_in_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (provider_id, provider)
);

create or replace function auth.uid() returns uuid
language sql stable as $$
  select coalesce(
    nullif(current_setting('request.jwt.claim.sub', true), ''),
    nullif(current_setting('request.jwt.claims', true)::jsonb ->> 'sub', '')
  )::uuid;
$$;

create or replace function auth.role() returns text
language sql stable as $$
  select coalesce(
    nullif(current_setting('request.jwt.claim.role', true), ''),
    nullif(current_setting('request.jwt.claims', true)::jsonb ->> 'role', ''),
    'anon'
  );
$$;

create or replace function auth.jwt() returns jsonb
language sql stable as $$
  select coalesce(nullif(current_setting('request.jwt.claims', true), '')::jsonb, '{}'::jsonb);
$$;

create table storage.buckets (
  id text primary key,
  name text not null,
  public boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table storage.objects (
  id uuid primary key default gen_random_uuid(),
  bucket_id text references storage.buckets (id),
  name text not null,
  owner uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  last_accessed_at timestamptz,
  metadata jsonb
);

create or replace function storage.foldername(name text) returns text[]
language plpgsql immutable as $$
declare
  parts text[];
begin
  parts := string_to_array(name, '/');
  return parts[1:array_length(parts, 1) - 1];
end;
$$;

create or replace function extensions.crypt(password text, salt text) returns text
language sql immutable as $$
  select 'bcrypt$2a$06$' || md5(coalesce(salt, '') || password);
$$;

create or replace function extensions.gen_salt(kind text) returns text
language sql volatile as $$
  select md5(random()::text || clock_timestamp()::text);
$$;
`;

const migrationsDirectory = new URL('../migrations/', import.meta.url);
const seedFile = new URL('../seed.dev.system-admin.sql', import.meta.url);

/** Applies one migration, stripping the pgcrypto line the prelude replaces. */
export async function applyMigration(db, file) {
  const sql = (await readFile(fileURLToPath(new URL(file, migrationsDirectory)), 'utf8')).replace(
    /create extension[^;]*;/gi,
    '',
  );
  await db.exec(sql);
}

/** Applies the development System Administrator seed (safe to run twice). */
export async function applySeed(db) {
  await db.exec(await readFile(fileURLToPath(seedFile), 'utf8'));
}

async function setClaim(db, { sub = null, role = 'anon' }) {
  await db.query(
    `select set_config('request.jwt.claim.sub', $1, false),
            set_config('request.jwt.claim.role', $2, false),
            set_config('request.jwt.claims', $3, false)`,
    [sub ?? '', role, JSON.stringify(sub ? { sub, role } : { role })],
  );
}

/** Acts as a signed-in user, so `is_system_admin()` and the RLS helpers apply. */
export const asActor = (db, userId, role = 'authenticated') => setClaim(db, { sub: userId, role });
export const asAnon = (db) => setClaim(db, { role: 'anon' });
export const asService = (db) => setClaim(db, { role: 'service_role' });

async function insertUser(db, { email, firstName, lastName, role = 'pet_owner' }) {
  const { rows } = await db.query(
    `insert into auth.users (id, aud, role, email, raw_user_meta_data, email_confirmed_at)
     values (gen_random_uuid(), 'authenticated', 'authenticated', $1, $2::jsonb, now())
     returning id`,
    [email, JSON.stringify({ first_name: firstName, last_name: lastName })],
  );
  const id = rows[0].id;
  if (role !== 'pet_owner') {
    // `protect_profile_role()` only allows this under the service-role claim.
    await db.query('update public.profiles set role = $2 where id = $1', [id, role]);
  }
  return id;
}

async function insertClinic(db, { name, city, province, status, submittedAt = null }) {
  const { rows } = await db.query(
    `insert into public.clinics (clinic_name, city, province, status, submitted_at)
     values ($1, $2, $3, $4, $5)
     returning id`,
    [name, city, province, status, submittedAt],
  );
  return rows[0].id;
}

async function addMembership(db, { clinicId, userId, staffRole, status }) {
  await db.query(
    `insert into public.clinic_memberships (clinic_id, user_id, staff_role, status)
     values ($1, $2, $3, $4)`,
    [clinicId, userId, staffRole, status],
  );
}

/**
 * A small, fixed platform: two approved clinics, one pending application and
 * accounts covering every membership state the SA-08 filter exposes.
 */
async function insertFixtures(db) {
  const { rows } = await db.query(
    "select id from public.profiles where email = 'admin@vetlink.dev'",
  );
  const adminId = rows[0].id;

  const alpha = await insertClinic(db, {
    name: 'Alpha Veterinary Clinic',
    city: 'Quezon City',
    province: 'Metro Manila',
    status: 'approved',
  });
  const beta = await insertClinic(db, {
    name: 'Beta Animal Hospital',
    city: 'Cebu City',
    province: 'Cebu',
    status: 'approved',
  });
  const gamma = await insertClinic(db, {
    name: 'Gamma Pet Care',
    city: 'Davao City',
    province: 'Davao del Sur',
    status: 'pending',
    submittedAt: new Date().toISOString(),
  });

  const owner = await insertUser(db, {
    email: 'owner@vetlink.dev',
    firstName: 'Olivia',
    lastName: 'Owner',
  });
  const loner = await insertUser(db, {
    email: 'loner@vetlink.dev',
    firstName: 'Lorna',
    lastName: 'Loner',
  });
  const drReyes = await insertUser(db, {
    email: 'reyes@vetlink.dev',
    firstName: 'Ramon',
    lastName: 'Reyes',
    role: 'veterinarian',
  });
  const frontDesk = await insertUser(db, {
    email: 'frontdesk@vetlink.dev',
    firstName: 'Fiona',
    lastName: 'Desk',
    role: 'receptionist',
  });
  const alphaAdmin = await insertUser(db, {
    email: 'alpha.admin@vetlink.dev',
    firstName: 'Alice',
    lastName: 'Alvarez',
    role: 'clinic_administrator',
  });
  const betaAdmin = await insertUser(db, {
    email: 'beta.admin@vetlink.dev',
    firstName: 'Bea',
    lastName: 'Bautista',
    role: 'clinic_administrator',
  });
  const suspendedStaff = await insertUser(db, {
    email: 'suspended@vetlink.dev',
    firstName: 'Sam',
    lastName: 'Santos',
    role: 'clinic_staff',
  });

  // An older, revoked membership must never win the "primary membership" pick.
  await addMembership(db, {
    clinicId: beta,
    userId: drReyes,
    staffRole: 'veterinarian',
    status: 'revoked',
  });
  await addMembership(db, {
    clinicId: alpha,
    userId: drReyes,
    staffRole: 'veterinarian',
    status: 'active',
  });
  await addMembership(db, {
    clinicId: alpha,
    userId: frontDesk,
    staffRole: 'receptionist',
    status: 'invited',
  });
  await addMembership(db, {
    clinicId: alpha,
    userId: alphaAdmin,
    staffRole: 'clinic_administrator',
    status: 'active',
  });
  await addMembership(db, {
    clinicId: alpha,
    userId: suspendedStaff,
    staffRole: 'clinic_staff',
    status: 'suspended',
  });
  await addMembership(db, {
    clinicId: beta,
    userId: betaAdmin,
    staffRole: 'clinic_administrator',
    status: 'active',
  });

  return {
    adminId,
    clinics: { alpha, beta, gamma },
    users: { owner, loner, drReyes, frontDesk, alphaAdmin, betaAdmin, suspendedStaff },
  };
}

/** Fresh database with 0001→0007, the seed and the fixtures applied. */
export async function createDatabase() {
  const db = new PGlite();
  await db.exec(PRELUDE);
  for (const file of MIGRATIONS) await applyMigration(db, file);
  await applySeed(db);
  // Fixtures are written the way a server-side admin would: no RLS surprises.
  await asService(db);
  const ids = await insertFixtures(db);
  return { db, ids };
}
