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
