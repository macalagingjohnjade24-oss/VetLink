-- ============================================================================
-- VetLink — full database setup (generated, do not edit)
-- Contains migrations 0001–0025 in order.
-- Paste the whole file into Supabase → SQL Editor on a NEW project and press Run.
-- Regenerate with: node supabase/setup/build.mjs
-- ============================================================================

-- >>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>> 0001_schema.sql

-- ===========================================================================
-- VetLink — 0001 schema
-- Multi-clinic veterinary platform for the VetLink pet-owner mobile app.
--
-- Apply in the Supabase SQL Editor (in order) or with:
--   supabase link --project-ref <ref>
--   supabase db push
-- Every statement is repeatable where practical (create ... if not exists,
-- drop policy if exists, etc.).
-- ===========================================================================

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- A. Profiles (1:1 with auth.users)
-- ---------------------------------------------------------------------------
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  first_name text not null default '',
  last_name text not null default '',
  email text,
  mobile_number text,
  profile_picture text,
  address text,
  role text not null default 'pet_owner'
    check (role in ('pet_owner', 'veterinarian', 'clinic_administrator', 'receptionist', 'system_administrator')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists profiles_email_key on public.profiles (lower(email)) where email is not null;
create index if not exists profiles_role_idx on public.profiles (role);

drop trigger if exists profiles_set_updated_at on public.profiles;
create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

-- New auth users get a pet_owner profile. Google sign-in carries the name and
-- avatar in raw_user_meta_data; a repeat sign-in updates instead of duplicating.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  meta jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
begin
  insert into public.profiles (id, first_name, last_name, email, mobile_number, profile_picture, role)
  values (
    new.id,
    coalesce(
      nullif(meta ->> 'first_name', ''),
      nullif(meta ->> 'given_name', ''),
      split_part(coalesce(meta ->> 'full_name', meta ->> 'name', ''), ' ', 1),
      ''
    ),
    coalesce(
      nullif(meta ->> 'last_name', ''),
      nullif(meta ->> 'family_name', ''),
      ''
    ),
    new.email,
    coalesce(meta ->> 'mobile_number', ''),
    coalesce(nullif(meta ->> 'avatar_url', ''), nullif(meta ->> 'picture', '')),
    'pet_owner'
  )
  on conflict (id) do update
    set email = excluded.email,
        profile_picture = coalesce(public.profiles.profile_picture, excluded.profile_picture),
        first_name = case when public.profiles.first_name = '' then excluded.first_name else public.profiles.first_name end,
        last_name = case when public.profiles.last_name = '' then excluded.last_name else public.profiles.last_name end;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Belt and braces: clients can never promote themselves even if a grant slips.
create or replace function public.protect_profile_role()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.role is distinct from old.role and coalesce(auth.role(), '') <> 'service_role' then
    raise exception 'Account roles are managed by VetLink administration.';
  end if;
  return new;
end;
$$;

drop trigger if exists profiles_protect_role on public.profiles;
create trigger profiles_protect_role
  before update on public.profiles
  for each row execute function public.protect_profile_role();

-- ---------------------------------------------------------------------------
-- B. Clinics
-- ---------------------------------------------------------------------------
create table if not exists public.clinics (
  id uuid primary key default gen_random_uuid(),
  clinic_name text not null,
  description text,
  email text,
  contact_number text,
  address text,
  area text,
  city text,
  province text,
  latitude double precision,
  longitude double precision,
  distance_km numeric(6, 2) not null default 0,
  rating numeric(2, 1) not null default 0 check (rating >= 0 and rating <= 5),
  review_count integer not null default 0 check (review_count >= 0),
  logo_url text,
  operating_hours jsonb,
  featured boolean not null default false,
  has_availability boolean not null default false,
  status text not null default 'pending'
    check (status in ('pending', 'approved', 'rejected', 'suspended', 'inactive')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists clinics_status_idx on public.clinics (status);
create index if not exists clinics_city_idx on public.clinics (lower(city));

drop trigger if exists clinics_set_updated_at on public.clinics;
create trigger clinics_set_updated_at
  before update on public.clinics
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- C. Clinic services
-- ---------------------------------------------------------------------------
create table if not exists public.clinic_services (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references public.clinics (id) on delete cascade,
  service_name text not null,
  description text,
  price numeric(10, 2) not null default 0 check (price >= 0),
  estimated_duration integer not null default 30 check (estimated_duration > 0),
  availability text not null default 'available'
    check (availability in ('available', 'limited', 'unavailable')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists clinic_services_clinic_idx on public.clinic_services (clinic_id);
create unique index if not exists clinic_services_clinic_name_key on public.clinic_services (clinic_id, lower(service_name));

drop trigger if exists clinic_services_set_updated_at on public.clinic_services;
create trigger clinic_services_set_updated_at
  before update on public.clinic_services
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- D. Pets
-- ---------------------------------------------------------------------------
create table if not exists public.pets (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users (id) on delete cascade,
  pet_name text not null,
  species text not null default 'Dog',
  breed text,
  sex text check (sex in ('Male', 'Female', 'Unknown')),
  date_of_birth date,
  weight numeric(6, 2) check (weight >= 0),
  color text,
  microchip text,
  profile_picture text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists pets_owner_idx on public.pets (owner_id);
create unique index if not exists pets_owner_name_key on public.pets (owner_id, lower(pet_name));
alter table public.pets drop constraint if exists pets_id_owner_key;
alter table public.pets add constraint pets_id_owner_key unique (id, owner_id);

drop trigger if exists pets_set_updated_at on public.pets;
create trigger pets_set_updated_at
  before update on public.pets
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- E. Appointments
-- ---------------------------------------------------------------------------
create table if not exists public.appointments (
  id uuid primary key default gen_random_uuid(),
  reference text unique,
  owner_id uuid not null references auth.users (id) on delete cascade,
  clinic_id uuid not null references public.clinics (id) on delete restrict,
  pet_id uuid not null references public.pets (id) on delete cascade,
  service_id uuid references public.clinic_services (id) on delete set null,
  appointment_date date not null,
  appointment_time time not null,
  reason_for_visit text,
  additional_notes text,
  symptoms text,
  attachment_name text,
  owner_name text,
  contact text,
  service_name text,
  price numeric(10, 2) not null default 0,
  status text not null default 'pending'
    check (status in ('pending', 'confirmed', 'completed', 'cancelled', 'rejected', 'rescheduled')),
  cancellation_reason text,
  cancellation_requested boolean not null default false,
  reschedule_requested boolean not null default false,
  requested_date date,
  requested_time time,
  reschedule_reason text,
  clinic_note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- The appointment's pet must belong to the same owner (defence in depth with validate_appointment).
alter table public.appointments drop constraint if exists appointments_pet_owner_fk;
alter table public.appointments add constraint appointments_pet_owner_fk
  foreign key (pet_id, owner_id) references public.pets (id, owner_id);

create index if not exists appointments_owner_idx on public.appointments (owner_id, appointment_date desc);
create index if not exists appointments_clinic_idx on public.appointments (clinic_id, appointment_date);
create index if not exists appointments_pet_idx on public.appointments (pet_id);
create index if not exists appointments_requested_idx on public.appointments (clinic_id)
  where cancellation_requested or reschedule_requested;

-- One live booking per clinic slot.
create unique index if not exists appointments_slot_key
  on public.appointments (clinic_id, appointment_date, appointment_time)
  where status in ('pending', 'confirmed', 'rescheduled');

drop trigger if exists appointments_set_updated_at on public.appointments;
create trigger appointments_set_updated_at
  before update on public.appointments
  for each row execute function public.set_updated_at();

create or replace function public.set_appointment_reference()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  next_number integer;
begin
  if new.reference is null or length(btrim(new.reference)) = 0 then
    select count(*) + 1 into next_number
      from public.appointments
     where appointment_date = new.appointment_date;
    new.reference := 'VL-' || to_char(new.appointment_date, 'YYYY') || '-'
      || to_char(new.appointment_date, 'MMDD') || '-'
      || lpad(next_number::text, 2, '0');
  end if;
  return new;
end;
$$;

drop trigger if exists appointments_set_reference on public.appointments;
create trigger appointments_set_reference
  before insert on public.appointments
  for each row execute function public.set_appointment_reference();

-- Server-side booking validation: pet ownership + service/clinic consistency.
create or replace function public.validate_appointment()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (
    select 1 from public.pets p where p.id = new.pet_id and p.owner_id = new.owner_id
  ) then
    raise exception 'That pet does not belong to this account.';
  end if;

  if not exists (
    select 1 from public.clinics c where c.id = new.clinic_id and c.status = 'approved'
  ) then
    raise exception 'That clinic is not accepting appointments.';
  end if;

  if new.service_id is not null and not exists (
    select 1 from public.clinic_services s
     where s.id = new.service_id and s.clinic_id = new.clinic_id
  ) then
    raise exception 'That service does not belong to the selected clinic.';
  end if;

  return new;
end;
$$;

drop trigger if exists appointments_validate on public.appointments;
create trigger appointments_validate
  before insert or update of pet_id, owner_id, clinic_id, service_id on public.appointments
  for each row execute function public.validate_appointment();

-- ---------------------------------------------------------------------------
-- F. Medical records (clinic-entered)
-- ---------------------------------------------------------------------------
create table if not exists public.medical_records (
  id uuid primary key default gen_random_uuid(),
  pet_id uuid not null references public.pets (id) on delete cascade,
  owner_id uuid not null references auth.users (id) on delete cascade,
  clinic_id uuid references public.clinics (id) on delete set null,
  veterinarian_name text,
  diagnosis text,
  treatment text,
  prescription text,
  notes text,
  record_date date not null default current_date,
  attachment_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists medical_records_pet_idx on public.medical_records (pet_id, record_date desc);
create index if not exists medical_records_owner_idx on public.medical_records (owner_id);
create index if not exists medical_records_clinic_idx on public.medical_records (clinic_id);

drop trigger if exists medical_records_set_updated_at on public.medical_records;
create trigger medical_records_set_updated_at
  before update on public.medical_records
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- G. Vaccinations
-- ---------------------------------------------------------------------------
create table if not exists public.vaccinations (
  id uuid primary key default gen_random_uuid(),
  pet_id uuid not null references public.pets (id) on delete cascade,
  owner_id uuid not null references auth.users (id) on delete cascade,
  clinic_id uuid references public.clinics (id) on delete set null,
  vaccine_name text not null,
  vaccination_date date,
  next_due_date date,
  veterinarian_name text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint vaccinations_due_after_administered check (
    next_due_date is null or vaccination_date is null or next_due_date >= vaccination_date
  )
);

create index if not exists vaccinations_pet_idx on public.vaccinations (pet_id, next_due_date);
create index if not exists vaccinations_owner_idx on public.vaccinations (owner_id);
create index if not exists vaccinations_due_idx on public.vaccinations (next_due_date) where next_due_date is not null;

drop trigger if exists vaccinations_set_updated_at on public.vaccinations;
create trigger vaccinations_set_updated_at
  before update on public.vaccinations
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- H. Notifications
-- ---------------------------------------------------------------------------
create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  title text not null,
  message text not null,
  notification_type text not null default 'general'
    check (notification_type in (
      'appointment_confirmed',
      'appointment_cancelled',
      'appointment_rescheduled',
      'appointment_reminder',
      'appointment_completed',
      'appointment_rejected',
      'appointment_pending',
      'vaccination_reminder',
      'account',
      'general'
    )),
  related_appointment_id uuid references public.appointments (id) on delete set null,
  is_read boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists notifications_user_idx on public.notifications (user_id, created_at desc);
create index if not exists notifications_unread_idx on public.notifications (user_id) where is_read = false;

-- Status changes create the notification rows the app displays.
create or replace function public.notify_appointment_status()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  notification_title text;
begin
  if new.status is not distinct from old.status then
    return new;
  end if;

  notification_title := case new.status
    when 'confirmed' then 'Appointment confirmed'
    when 'cancelled' then 'Appointment cancelled'
    when 'completed' then 'Visit completed'
    when 'rejected' then 'Appointment could not be confirmed'
    when 'rescheduled' then 'Appointment rescheduled'
    else 'Appointment updated'
  end;

  insert into public.notifications (user_id, title, message, notification_type, related_appointment_id)
  values (
    new.owner_id,
    notification_title,
    'Your appointment on ' || to_char(new.appointment_date, 'Mon DD, YYYY') || ' at '
      || to_char(new.appointment_time, 'FMHH12:MI AM') || ' is now ' || new.status || '.',
    'appointment_' || new.status,
    new.id
  );
  return new;
end;
$$;

drop trigger if exists appointments_notify_status on public.appointments;
create trigger appointments_notify_status
  after update of status on public.appointments
  for each row execute function public.notify_appointment_status();

-- ---------------------------------------------------------------------------
-- I. Inquiries
-- ---------------------------------------------------------------------------
create table if not exists public.inquiries (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users (id) on delete cascade,
  clinic_id uuid references public.clinics (id) on delete set null,
  clinic_name text,
  reference text unique,
  subject text,
  inquiry_type text not null default 'General inquiry',
  status text not null default 'submitted'
    check (status in ('submitted', 'in_review', 'forwarded', 'closed')),
  owner_name text,
  contact text,
  pet_name text,
  pet_species text,
  details text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists inquiries_owner_idx on public.inquiries (owner_id, created_at desc);
create index if not exists inquiries_clinic_idx on public.inquiries (clinic_id);

drop trigger if exists inquiries_set_updated_at on public.inquiries;
create trigger inquiries_set_updated_at
  before update on public.inquiries
  for each row execute function public.set_updated_at();

create or replace function public.set_inquiry_reference()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.reference is null or length(btrim(new.reference)) = 0 then
    new.reference := 'INQ-' || to_char(now(), 'YYYY') || '-'
      || lpad((select count(*) + 1 from public.inquiries)::text, 4, '0');
  end if;
  return new;
end;
$$;

drop trigger if exists inquiries_set_reference on public.inquiries;
create trigger inquiries_set_reference
  before insert on public.inquiries
  for each row execute function public.set_inquiry_reference();

-- ---------------------------------------------------------------------------
-- J. Inquiry messages
-- ---------------------------------------------------------------------------
create table if not exists public.inquiry_messages (
  id uuid primary key default gen_random_uuid(),
  inquiry_id uuid not null references public.inquiries (id) on delete cascade,
  sender_id uuid references auth.users (id) on delete set null,
  sender_type text not null default 'pet_owner'
    check (sender_type in ('pet_owner', 'clinic_staff', 'assistant')),
  message text not null,
  created_at timestamptz not null default now()
);

create index if not exists inquiry_messages_inquiry_idx on public.inquiry_messages (inquiry_id, created_at);

-- ---------------------------------------------------------------------------
-- K. Clinic memberships (structure for the future clinic web app)
-- ---------------------------------------------------------------------------
create table if not exists public.clinic_memberships (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references public.clinics (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  staff_role text not null default 'clinic_staff'
    check (staff_role in ('clinic_administrator', 'receptionist', 'veterinarian', 'clinic_staff')),
  status text not null default 'active'
    check (status in ('invited', 'active', 'suspended', 'revoked')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (clinic_id, user_id)
);

create index if not exists clinic_memberships_user_idx on public.clinic_memberships (user_id);
create index if not exists clinic_memberships_clinic_idx on public.clinic_memberships (clinic_id);

drop trigger if exists clinic_memberships_set_updated_at on public.clinic_memberships;
create trigger clinic_memberships_set_updated_at
  before update on public.clinic_memberships
  for each row execute function public.set_updated_at();

-- >>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>> 0002_rls.sql

-- ===========================================================================
-- VetLink — 0002 row level security
-- Owners only ever see their own records; clinic staff only ever see records
-- belonging to clinics where they hold an active membership. Column grants
-- additionally stop owners from editing fields that belong to the clinic
-- (official medical/vaccination records, clinic details, roles).
-- ===========================================================================

-- ---------------------------------------------------------------------------
-- Helper functions (security definer so policy subqueries do not recurse)
-- ---------------------------------------------------------------------------
create or replace function public.is_clinic_staff(target_clinic uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.clinic_memberships m
     where m.clinic_id = target_clinic
       and m.user_id = auth.uid()
       and m.status = 'active'
  );
$$;

create or replace function public.is_clinic_admin(target_clinic uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.clinic_memberships m
     where m.clinic_id = target_clinic
       and m.user_id = auth.uid()
       and m.status = 'active'
       and m.staff_role = 'clinic_administrator'
  );
$$;

create or replace function public.is_staff_of_patient(patient uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
      from public.appointments a
      join public.clinic_memberships m on m.clinic_id = a.clinic_id
     where a.owner_id = patient
       and m.user_id = auth.uid()
       and m.status = 'active'
  );
$$;

create or replace function public.is_inquiry_owner(target_inquiry uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.inquiries i
     where i.id = target_inquiry and i.owner_id = auth.uid()
  );
$$;

create or replace function public.is_inquiry_clinic_staff(target_inquiry uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
      from public.inquiries i
      join public.clinic_memberships m on m.clinic_id = i.clinic_id
     where i.id = target_inquiry
       and m.user_id = auth.uid()
       and m.status = 'active'
  );
$$;

grant execute on function public.is_clinic_staff(uuid) to authenticated;
grant execute on function public.is_clinic_admin(uuid) to authenticated;
grant execute on function public.is_staff_of_patient(uuid) to authenticated;
grant execute on function public.is_inquiry_owner(uuid) to authenticated;
grant execute on function public.is_inquiry_clinic_staff(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Enable RLS everywhere
-- ---------------------------------------------------------------------------
alter table public.profiles enable row level security;
alter table public.clinics enable row level security;
alter table public.clinic_services enable row level security;
alter table public.pets enable row level security;
alter table public.appointments enable row level security;
alter table public.medical_records enable row level security;
alter table public.vaccinations enable row level security;
alter table public.notifications enable row level security;
alter table public.inquiries enable row level security;
alter table public.inquiry_messages enable row level security;
alter table public.clinic_memberships enable row level security;

-- ---------------------------------------------------------------------------
-- Profiles
-- ---------------------------------------------------------------------------
revoke all on public.profiles from anon, authenticated;
grant select on public.profiles to authenticated;
-- Owners may edit contact fields only. `role` is deliberately not grantable.
grant update (first_name, last_name, mobile_number, profile_picture, address) on public.profiles to authenticated;
grant insert (id, first_name, last_name, email, mobile_number, profile_picture, address) on public.profiles to authenticated;

drop policy if exists profiles_select_own on public.profiles;
create policy profiles_select_own on public.profiles
  for select to authenticated using (id = auth.uid());

drop policy if exists profiles_select_patients_staff on public.profiles;
create policy profiles_select_patients_staff on public.profiles
  for select to authenticated using (public.is_staff_of_patient(id));

drop policy if exists profiles_insert_self on public.profiles;
create policy profiles_insert_self on public.profiles
  for insert to authenticated with check (id = auth.uid());

drop policy if exists profiles_update_own on public.profiles;
create policy profiles_update_own on public.profiles
  for update to authenticated using (id = auth.uid()) with check (id = auth.uid());

-- ---------------------------------------------------------------------------
-- Clinics (public discovery reads approved rows only)
-- ---------------------------------------------------------------------------
revoke all on public.clinics from anon, authenticated;
grant select on public.clinics to anon, authenticated;
grant update (clinic_name, description, email, contact_number, address, area, city, province,
              latitude, longitude, logo_url, operating_hours, has_availability)
  on public.clinics to authenticated;

drop policy if exists clinics_public_read on public.clinics;
create policy clinics_public_read on public.clinics
  for select to anon, authenticated using (status = 'approved');

drop policy if exists clinics_staff_read on public.clinics;
create policy clinics_staff_read on public.clinics
  for select to authenticated using (public.is_clinic_staff(id));

drop policy if exists clinics_admin_update on public.clinics;
create policy clinics_admin_update on public.clinics
  for update to authenticated
  using (public.is_clinic_admin(id))
  with check (public.is_clinic_admin(id));

-- ---------------------------------------------------------------------------
-- Clinic services
-- ---------------------------------------------------------------------------
revoke all on public.clinic_services from anon, authenticated;
grant select on public.clinic_services to anon, authenticated;
grant insert, update, delete on public.clinic_services to authenticated;

drop policy if exists clinic_services_public_read on public.clinic_services;
create policy clinic_services_public_read on public.clinic_services
  for select to anon, authenticated
  using (
    exists (select 1 from public.clinics c where c.id = clinic_id and c.status = 'approved')
    or public.is_clinic_staff(clinic_id)
  );

drop policy if exists clinic_services_admin_write on public.clinic_services;
create policy clinic_services_admin_write on public.clinic_services
  for all to authenticated
  using (public.is_clinic_admin(clinic_id))
  with check (public.is_clinic_admin(clinic_id));

-- ---------------------------------------------------------------------------
-- Pets
-- ---------------------------------------------------------------------------
revoke all on public.pets from anon, authenticated;
grant select, insert, update, delete on public.pets to authenticated;

drop policy if exists pets_owner_all on public.pets;
create policy pets_owner_all on public.pets
  for all to authenticated
  using (owner_id = auth.uid())
  with check (owner_id = auth.uid());

drop policy if exists pets_staff_read on public.pets;
create policy pets_staff_read on public.pets
  for select to authenticated using (public.is_staff_of_patient(owner_id));

-- ---------------------------------------------------------------------------
-- Appointments
-- ---------------------------------------------------------------------------
revoke all on public.appointments from anon, authenticated;
grant select, insert on public.appointments to authenticated;
grant update (status, cancellation_reason, cancellation_requested, reschedule_requested,
              requested_date, requested_time, reschedule_reason, clinic_note,
              appointment_date, appointment_time)
  on public.appointments to authenticated;

drop policy if exists appointments_owner_read on public.appointments;
create policy appointments_owner_read on public.appointments
  for select to authenticated using (owner_id = auth.uid());

drop policy if exists appointments_staff_read on public.appointments;
create policy appointments_staff_read on public.appointments
  for select to authenticated using (public.is_clinic_staff(clinic_id));

drop policy if exists appointments_owner_insert on public.appointments;
create policy appointments_owner_insert on public.appointments
  for insert to authenticated
  with check (owner_id = auth.uid() and status = 'pending');

drop policy if exists appointments_owner_update on public.appointments;
create policy appointments_owner_update on public.appointments
  for update to authenticated
  using (owner_id = auth.uid())
  with check (owner_id = auth.uid());

drop policy if exists appointments_staff_update on public.appointments;
create policy appointments_staff_update on public.appointments
  for update to authenticated
  using (public.is_clinic_staff(clinic_id))
  with check (public.is_clinic_staff(clinic_id));

-- ---------------------------------------------------------------------------
-- Medical records — owners read, only clinic staff write
-- ---------------------------------------------------------------------------
revoke all on public.medical_records from anon, authenticated;
grant select, insert, update, delete on public.medical_records to authenticated;

drop policy if exists medical_records_owner_read on public.medical_records;
create policy medical_records_owner_read on public.medical_records
  for select to authenticated using (owner_id = auth.uid());

drop policy if exists medical_records_staff_read on public.medical_records;
create policy medical_records_staff_read on public.medical_records
  for select to authenticated
  using (clinic_id is not null and public.is_clinic_staff(clinic_id));

drop policy if exists medical_records_staff_insert on public.medical_records;
create policy medical_records_staff_insert on public.medical_records
  for insert to authenticated
  with check (clinic_id is not null and public.is_clinic_staff(clinic_id));

drop policy if exists medical_records_staff_update on public.medical_records;
create policy medical_records_staff_update on public.medical_records
  for update to authenticated
  using (clinic_id is not null and public.is_clinic_staff(clinic_id))
  with check (clinic_id is not null and public.is_clinic_staff(clinic_id));

drop policy if exists medical_records_staff_delete on public.medical_records;
create policy medical_records_staff_delete on public.medical_records
  for delete to authenticated
  using (clinic_id is not null and public.is_clinic_staff(clinic_id));

-- ---------------------------------------------------------------------------
-- Vaccinations — owners read, only clinic staff write
-- ---------------------------------------------------------------------------
revoke all on public.vaccinations from anon, authenticated;
grant select, insert, update, delete on public.vaccinations to authenticated;

drop policy if exists vaccinations_owner_read on public.vaccinations;
create policy vaccinations_owner_read on public.vaccinations
  for select to authenticated using (owner_id = auth.uid());

drop policy if exists vaccinations_staff_read on public.vaccinations;
create policy vaccinations_staff_read on public.vaccinations
  for select to authenticated
  using (clinic_id is not null and public.is_clinic_staff(clinic_id));

drop policy if exists vaccinations_staff_insert on public.vaccinations;
create policy vaccinations_staff_insert on public.vaccinations
  for insert to authenticated
  with check (clinic_id is not null and public.is_clinic_staff(clinic_id));

drop policy if exists vaccinations_staff_update on public.vaccinations;
create policy vaccinations_staff_update on public.vaccinations
  for update to authenticated
  using (clinic_id is not null and public.is_clinic_staff(clinic_id))
  with check (clinic_id is not null and public.is_clinic_staff(clinic_id));

drop policy if exists vaccinations_staff_delete on public.vaccinations;
create policy vaccinations_staff_delete on public.vaccinations
  for delete to authenticated
  using (clinic_id is not null and public.is_clinic_staff(clinic_id));

-- ---------------------------------------------------------------------------
-- Notifications — the owner reads and marks them read
-- ---------------------------------------------------------------------------
revoke all on public.notifications from anon, authenticated;
grant select on public.notifications to authenticated;
grant update (is_read) on public.notifications to authenticated;

drop policy if exists notifications_owner_read on public.notifications;
create policy notifications_owner_read on public.notifications
  for select to authenticated using (user_id = auth.uid());

drop policy if exists notifications_owner_update on public.notifications;
create policy notifications_owner_update on public.notifications
  for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- Inquiries and messages
-- ---------------------------------------------------------------------------
revoke all on public.inquiries from anon, authenticated;
grant select, insert on public.inquiries to authenticated;

drop policy if exists inquiries_owner_read on public.inquiries;
create policy inquiries_owner_read on public.inquiries
  for select to authenticated using (owner_id = auth.uid());

drop policy if exists inquiries_owner_insert on public.inquiries;
create policy inquiries_owner_insert on public.inquiries
  for insert to authenticated with check (owner_id = auth.uid());

drop policy if exists inquiries_staff_read on public.inquiries;
create policy inquiries_staff_read on public.inquiries
  for select to authenticated
  using (clinic_id is not null and public.is_clinic_staff(clinic_id));

revoke all on public.inquiry_messages from anon, authenticated;
grant select, insert on public.inquiry_messages to authenticated;

drop policy if exists inquiry_messages_owner_read on public.inquiry_messages;
create policy inquiry_messages_owner_read on public.inquiry_messages
  for select to authenticated using (public.is_inquiry_owner(inquiry_id));

drop policy if exists inquiry_messages_staff_read on public.inquiry_messages;
create policy inquiry_messages_staff_read on public.inquiry_messages
  for select to authenticated using (public.is_inquiry_clinic_staff(inquiry_id));

drop policy if exists inquiry_messages_owner_insert on public.inquiry_messages;
create policy inquiry_messages_owner_insert on public.inquiry_messages
  for insert to authenticated
  with check (
    public.is_inquiry_owner(inquiry_id)
    and sender_type = 'pet_owner'
    and sender_id = auth.uid()
  );

drop policy if exists inquiry_messages_staff_insert on public.inquiry_messages;
create policy inquiry_messages_staff_insert on public.inquiry_messages
  for insert to authenticated
  with check (
    public.is_inquiry_clinic_staff(inquiry_id)
    and sender_type = 'clinic_staff'
    and sender_id = auth.uid()
  );

-- ---------------------------------------------------------------------------
-- Clinic memberships — staff can only read their own memberships.
-- Management happens through the (future) clinic web app / service role.
-- ---------------------------------------------------------------------------
revoke all on public.clinic_memberships from anon, authenticated;
grant select on public.clinic_memberships to authenticated;

drop policy if exists clinic_memberships_read_own on public.clinic_memberships;
create policy clinic_memberships_read_own on public.clinic_memberships
  for select to authenticated using (user_id = auth.uid());

-- >>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>> 0003_storage.sql

-- ===========================================================================
-- VetLink — 0003 storage buckets and policies
--
-- Bucket layout (the first path segment is always the owner's user id):
--   profile-photos/{userId}/avatar-<timestamp>.jpg        (public read)
--   pet-photos/{userId}/{petId}/<file>.jpg                (public read)
--   clinic-logos/{clinicId}/<file>.png                    (public read)
--   medical-record-attachments/{userId}/<file>.pdf        (private, signed URLs)
-- ===========================================================================

insert into storage.buckets (id, name, public)
values
  ('profile-photos', 'profile-photos', true),
  ('pet-photos', 'pet-photos', true),
  ('clinic-logos', 'clinic-logos', true),
  ('medical-record-attachments', 'medical-record-attachments', false)
on conflict (id) do nothing;

-- ---------------------------------------------------------------------------
-- Profile photos: anyone can view an avatar, only the owner can change it.
-- ---------------------------------------------------------------------------
drop policy if exists "Profile photos are readable" on storage.objects;
create policy "Profile photos are readable" on storage.objects
  for select using (bucket_id = 'profile-photos');

drop policy if exists "Owners manage their profile photos" on storage.objects;
create policy "Owners manage their profile photos" on storage.objects
  for all to authenticated
  using (bucket_id = 'profile-photos' and (storage.foldername(name))[1] = auth.uid()::text)
  with check (bucket_id = 'profile-photos' and (storage.foldername(name))[1] = auth.uid()::text);

-- ---------------------------------------------------------------------------
-- Pet photos: public read (they appear on the owner's pet cards), owner writes.
-- ---------------------------------------------------------------------------
drop policy if exists "Pet photos are readable" on storage.objects;
create policy "Pet photos are readable" on storage.objects
  for select using (bucket_id = 'pet-photos');

drop policy if exists "Owners manage their pet photos" on storage.objects;
create policy "Owners manage their pet photos" on storage.objects
  for all to authenticated
  using (bucket_id = 'pet-photos' and (storage.foldername(name))[1] = auth.uid()::text)
  with check (bucket_id = 'pet-photos' and (storage.foldername(name))[1] = auth.uid()::text);

-- ---------------------------------------------------------------------------
-- Clinic logos: public read. Uploads are handled by clinic administrators
-- through the future clinic interface (service role), not the mobile app.
-- ---------------------------------------------------------------------------
drop policy if exists "Clinic logos are readable" on storage.objects;
create policy "Clinic logos are readable" on storage.objects
  for select using (bucket_id = 'clinic-logos');

-- ---------------------------------------------------------------------------
-- Medical record attachments: private bucket. Owners read files under their
-- own folder; the clinic uploads them with the service role.
-- ---------------------------------------------------------------------------
drop policy if exists "Owners read their medical attachments" on storage.objects;
create policy "Owners read their medical attachments" on storage.objects
  for select to authenticated
  using (bucket_id = 'medical-record-attachments' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "Owners manage their medical attachments" on storage.objects;
create policy "Owners manage their medical attachments" on storage.objects
  for all to authenticated
  using (bucket_id = 'medical-record-attachments' and (storage.foldername(name))[1] = auth.uid()::text)
  with check (bucket_id = 'medical-record-attachments' and (storage.foldername(name))[1] = auth.uid()::text);

-- >>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>> 0004_web_console.sql

-- ===========================================================================
-- VetLink — 0004 web console foundation
-- Adds what the clinic-staff and system-administrator web console needs on top
-- of 0001–0003, without changing anything the pet-owner app already uses:
--
--   * a system_administrator identity the RLS helpers can recognise
--   * `clinic_staff` as a profile role (the membership table already had it)
--   * review / registration columns on clinics, service categories, the
--     assigned veterinarian and vitals the web screens display
--   * clinic_tasks (CS-02) and platform_audit_log (SA-13)
--   * clinic-scoped and platform-wide policies, plus the RPCs the console calls
--
-- Apply after 0003_storage.sql. Every statement is repeatable.
-- ===========================================================================

-- ---------------------------------------------------------------------------
-- Identity helpers
-- ---------------------------------------------------------------------------
create or replace function public.is_system_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles p
     where p.id = auth.uid()
       and p.role = 'system_administrator'
  );
$$;

/** Same-clinic colleague check (used for the staff directory in profiles). */
create or replace function public.is_clinic_colleague(target_user uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
      from public.clinic_memberships mine
      join public.clinic_memberships theirs on theirs.clinic_id = mine.clinic_id
     where mine.user_id = auth.uid()
       and mine.status = 'active'
       and theirs.user_id = target_user
  );
$$;

/** `value::uuid` without raising on a malformed storage path segment. */
create or replace function public.safe_uuid(value text)
returns uuid
language plpgsql
immutable
as $$
begin
  return value::uuid;
exception
  when others then
    return null;
end;
$$;

grant execute on function public.is_system_admin() to authenticated;
grant execute on function public.is_clinic_colleague(uuid) to authenticated;
grant execute on function public.safe_uuid(text) to authenticated;

-- ---------------------------------------------------------------------------
-- Profiles: allow the clinic_staff role the membership table already uses
-- ---------------------------------------------------------------------------
alter table public.profiles drop constraint if exists profiles_role_check;
alter table public.profiles add constraint profiles_role_check
  check (role in (
    'pet_owner',
    'veterinarian',
    'clinic_administrator',
    'receptionist',
    'clinic_staff',
    'system_administrator'
  ));

-- ---------------------------------------------------------------------------
-- Clinics: registration reference and review workflow
-- ---------------------------------------------------------------------------
alter table public.clinics
  add column if not exists reference text,
  add column if not exists website text,
  add column if not exists cover_url text,
  add column if not exists year_established integer
    check (year_established is null or year_established between 1850 and 2100),
  add column if not exists emergency_service boolean not null default false,
  add column if not exists review_notes text,
  add column if not exists reviewed_at timestamptz,
  add column if not exists reviewed_by uuid references auth.users (id) on delete set null,
  add column if not exists submitted_at timestamptz;

create unique index if not exists clinics_reference_key
  on public.clinics (reference) where reference is not null;

create or replace function public.set_clinic_reference()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.reference is null or length(btrim(new.reference)) = 0 then
    new.reference := 'VLC-' || lpad((select count(*) + 1 from public.clinics)::text, 5, '0');
  end if;
  return new;
end;
$$;

drop trigger if exists clinics_set_reference on public.clinics;
create trigger clinics_set_reference
  before insert on public.clinics
  for each row execute function public.set_clinic_reference();

-- Give clinics that predate this migration a reference too (only when none
-- exist yet, so a re-run can never renumber live clinics).
do $$
begin
  if not exists (select 1 from public.clinics where reference is not null) then
    with numbered as (
      select id, row_number() over (order by created_at) as rn from public.clinics
    )
    update public.clinics c
       set reference = 'VLC-' || lpad(numbered.rn::text, 5, '0')
      from numbered
     where c.id = numbered.id;
  end if;
end;
$$;

-- ---------------------------------------------------------------------------
-- Clinic services: the console groups services by category (CA-04 / CA-05)
-- ---------------------------------------------------------------------------
alter table public.clinic_services add column if not exists category text;

-- ---------------------------------------------------------------------------
-- Appointments: assigned veterinarian and front-desk check-in
-- ---------------------------------------------------------------------------
alter table public.appointments
  add column if not exists veterinarian_id uuid references auth.users (id) on delete set null,
  add column if not exists checked_in_at timestamptz;

create index if not exists appointments_vet_idx
  on public.appointments (veterinarian_id, appointment_date);

-- ---------------------------------------------------------------------------
-- Medical records: link the consultation to its appointment (VET-04 / VET-05)
-- ---------------------------------------------------------------------------
alter table public.medical_records
  add column if not exists appointment_id uuid references public.appointments (id) on delete set null,
  add column if not exists observations text,
  add column if not exists vitals jsonb,
  add column if not exists follow_up_date date;

create index if not exists medical_records_appointment_idx on public.medical_records (appointment_id);

-- ---------------------------------------------------------------------------
-- Vaccinations: dose and batch shown on VET-09 / VET-10
-- ---------------------------------------------------------------------------
alter table public.vaccinations
  add column if not exists dosage text,
  add column if not exists batch_number text;

-- ---------------------------------------------------------------------------
-- Clinic tasks (CS-01 / CS-02). Nothing in the mobile app reads this table.
-- ---------------------------------------------------------------------------
create table if not exists public.clinic_tasks (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references public.clinics (id) on delete cascade,
  title text not null,
  description text,
  priority text not null default 'normal'
    check (priority in ('low', 'normal', 'high', 'urgent')),
  status text not null default 'pending'
    check (status in ('pending', 'in_progress', 'completed', 'cancelled')),
  assigned_to uuid references auth.users (id) on delete set null,
  created_by uuid references auth.users (id) on delete set null,
  due_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists clinic_tasks_clinic_idx on public.clinic_tasks (clinic_id, status, due_at);
create index if not exists clinic_tasks_assignee_idx on public.clinic_tasks (assigned_to, status);

drop trigger if exists clinic_tasks_set_updated_at on public.clinic_tasks;
create trigger clinic_tasks_set_updated_at
  before update on public.clinic_tasks
  for each row execute function public.set_updated_at();

alter table public.clinic_tasks enable row level security;
revoke all on public.clinic_tasks from anon, authenticated;
grant select, insert, delete on public.clinic_tasks to authenticated;
grant update (title, description, priority, status, assigned_to, due_at, completed_at)
  on public.clinic_tasks to authenticated;

drop policy if exists clinic_tasks_staff_read on public.clinic_tasks;
create policy clinic_tasks_staff_read on public.clinic_tasks
  for select to authenticated using (public.is_clinic_staff(clinic_id));

drop policy if exists clinic_tasks_admin_all on public.clinic_tasks;
create policy clinic_tasks_admin_all on public.clinic_tasks
  for all to authenticated
  using (public.is_clinic_admin(clinic_id))
  with check (public.is_clinic_admin(clinic_id));

drop policy if exists clinic_tasks_assignee_update on public.clinic_tasks;
create policy clinic_tasks_assignee_update on public.clinic_tasks
  for update to authenticated
  using (assigned_to = auth.uid() and public.is_clinic_staff(clinic_id))
  with check (assigned_to = auth.uid() and public.is_clinic_staff(clinic_id));

-- ---------------------------------------------------------------------------
-- Platform audit log (SA-13). Written only through write_audit_log().
-- ---------------------------------------------------------------------------
create table if not exists public.platform_audit_log (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references auth.users (id) on delete set null,
  actor_name text,
  actor_role text,
  action text not null,
  entity_type text,
  entity_id text,
  clinic_id uuid references public.clinics (id) on delete set null,
  details jsonb,
  created_at timestamptz not null default now()
);

create index if not exists platform_audit_log_created_idx on public.platform_audit_log (created_at desc);
create index if not exists platform_audit_log_clinic_idx on public.platform_audit_log (clinic_id, created_at desc);

alter table public.platform_audit_log enable row level security;
revoke all on public.platform_audit_log from anon, authenticated;
grant select on public.platform_audit_log to authenticated;

drop policy if exists platform_audit_log_admin_read on public.platform_audit_log;
create policy platform_audit_log_admin_read on public.platform_audit_log
  for select to authenticated using (public.is_system_admin());

/**
 * Records one privileged action. The actor is always the caller, never a
 * client-supplied id; details are free-form and never trusted for access.
 */
create or replace function public.write_audit_log(
  p_action text,
  p_entity_type text default null,
  p_entity_id text default null,
  p_clinic_id uuid default null,
  p_details jsonb default '{}'::jsonb
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  actor uuid := auth.uid();
  actor_profile public.profiles;
begin
  if actor is null then
    return;
  end if;

  select * into actor_profile from public.profiles p where p.id = actor;

  insert into public.platform_audit_log
    (actor_id, actor_name, actor_role, action, entity_type, entity_id, clinic_id, details)
  values (
    actor,
    nullif(btrim(coalesce(actor_profile.first_name, '') || ' ' || coalesce(actor_profile.last_name, '')), ''),
    actor_profile.role,
    p_action,
    p_entity_type,
    p_entity_id,
    p_clinic_id,
    coalesce(p_details, '{}'::jsonb)
  );
end;
$$;

revoke all on function public.write_audit_log(text, text, text, uuid, jsonb) from public, anon;
grant execute on function public.write_audit_log(text, text, text, uuid, jsonb) to authenticated;

-- ---------------------------------------------------------------------------
-- Notifications: clinic-scoped notifications for staff and announcements
-- ---------------------------------------------------------------------------
alter table public.notifications
  add column if not exists clinic_id uuid references public.clinics (id) on delete set null;

create index if not exists notifications_clinic_idx on public.notifications (clinic_id, created_at desc);

grant insert on public.notifications to authenticated;

drop policy if exists notifications_clinic_staff_insert on public.notifications;
create policy notifications_clinic_staff_insert on public.notifications
  for insert to authenticated
  with check (
    clinic_id is not null
    and public.is_clinic_staff(clinic_id)
    and exists (
      select 1 from public.clinic_memberships m
       where m.clinic_id = notifications.clinic_id
         and m.user_id = notifications.user_id
         and m.status in ('active', 'invited')
    )
  );

drop policy if exists notifications_system_admin_insert on public.notifications;
create policy notifications_system_admin_insert on public.notifications
  for insert to authenticated
  with check (
    public.is_system_admin()
    and clinic_id is null
    and user_id = auth.uid()
  );

-- ---------------------------------------------------------------------------
-- Profiles: system administrators and same-clinic colleagues can be listed
-- ---------------------------------------------------------------------------
drop policy if exists profiles_select_system_admin on public.profiles;
create policy profiles_select_system_admin on public.profiles
  for select to authenticated using (public.is_system_admin());

drop policy if exists profiles_select_colleagues on public.profiles;
create policy profiles_select_colleagues on public.profiles
  for select to authenticated using (public.is_clinic_colleague(id));

-- Staff may edit their own contact details only (already granted in 0002).
-- System administrators never receive write access to other people's profiles
-- from the browser: role changes go through the Edge Functions.

-- ---------------------------------------------------------------------------
-- Clinics: platform-wide read, review and status management for system admins
-- ---------------------------------------------------------------------------
grant update (status, review_notes, reviewed_at, reviewed_by, website, cover_url,
              year_established, emergency_service)
  on public.clinics to authenticated;

drop policy if exists clinics_system_admin_read on public.clinics;
create policy clinics_system_admin_read on public.clinics
  for select to authenticated using (public.is_system_admin());

drop policy if exists clinics_system_admin_update on public.clinics;
create policy clinics_system_admin_update on public.clinics
  for update to authenticated
  using (public.is_system_admin())
  with check (public.is_system_admin());

-- ---------------------------------------------------------------------------
-- Clinic services: system admins read every clinic's catalogue (SA-04/SA-07)
-- ---------------------------------------------------------------------------
drop policy if exists clinic_services_system_admin_read on public.clinic_services;
create policy clinic_services_system_admin_read on public.clinic_services
  for select to authenticated using (public.is_system_admin());

-- ---------------------------------------------------------------------------
-- Appointments: system admins assign nothing; clinics keep their own records.
-- The column grant lets clinic staff set the veterinarian and check-in time.
-- ---------------------------------------------------------------------------
grant update (veterinarian_id, checked_in_at) on public.appointments to authenticated;

-- ---------------------------------------------------------------------------
-- Clinic memberships: clinic admins manage their own staff list
-- ---------------------------------------------------------------------------
revoke all on public.clinic_memberships from anon, authenticated;
grant select on public.clinic_memberships to authenticated;
grant insert (clinic_id, user_id, staff_role, status) on public.clinic_memberships to authenticated;
grant update (staff_role, status) on public.clinic_memberships to authenticated;
grant delete on public.clinic_memberships to authenticated;

drop policy if exists clinic_memberships_clinic_read on public.clinic_memberships;
create policy clinic_memberships_clinic_read on public.clinic_memberships
  for select to authenticated using (public.is_clinic_staff(clinic_id));

drop policy if exists clinic_memberships_system_admin_read on public.clinic_memberships;
create policy clinic_memberships_system_admin_read on public.clinic_memberships
  for select to authenticated using (public.is_system_admin());

drop policy if exists clinic_memberships_admin_all on public.clinic_memberships;
create policy clinic_memberships_admin_all on public.clinic_memberships
  for all to authenticated
  using (public.is_clinic_admin(clinic_id))
  with check (public.is_clinic_admin(clinic_id));

-- ---------------------------------------------------------------------------
-- Clinic documents (REG-06 / SA-04). Files live in the private
-- `clinic-documents` bucket; see 0005_clinic_documents.sql.
-- ---------------------------------------------------------------------------
create table if not exists public.clinic_documents (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references public.clinics (id) on delete cascade,
  name text not null,
  storage_path text not null,
  kind text,
  uploaded_by uuid references auth.users (id) on delete set null,
  uploaded_at timestamptz not null default now(),
  unique (clinic_id, storage_path)
);

create index if not exists clinic_documents_clinic_idx on public.clinic_documents (clinic_id);

alter table public.clinic_documents enable row level security;
revoke all on public.clinic_documents from anon, authenticated;
grant select, insert, delete on public.clinic_documents to authenticated;

drop policy if exists clinic_documents_staff_read on public.clinic_documents;
create policy clinic_documents_staff_read on public.clinic_documents
  for select to authenticated
  using (public.is_clinic_staff(clinic_id) or public.is_system_admin());

drop policy if exists clinic_documents_admin_write on public.clinic_documents;
create policy clinic_documents_admin_write on public.clinic_documents
  for all to authenticated
  using (public.is_clinic_admin(clinic_id) or public.is_system_admin())
  with check (public.is_clinic_admin(clinic_id) or public.is_system_admin());

-- ---------------------------------------------------------------------------
-- Public clinic registration
-- `clinics` has no INSERT grant, so an application is submitted through this
-- function. It creates a pending clinic, its services and documents, and an
-- *invited* clinic_administrator membership. The applicant keeps the
-- pet_owner role until a System Administrator provisions the account, so
-- registering never grants clinic access by itself.
-- ---------------------------------------------------------------------------
create or replace function public.submit_clinic_application(payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  applicant uuid := auth.uid();
  new_clinic uuid;
  service jsonb;
  document jsonb;
  new_reference text;
begin
  if applicant is null then
    raise exception 'Sign in before submitting a clinic application.';
  end if;

  if exists (
    select 1
      from public.clinic_memberships m
      join public.clinics c on c.id = m.clinic_id
     where m.user_id = applicant
       and c.status in ('pending', 'approved')
  ) then
    raise exception 'This account already has a pending or approved clinic application.';
  end if;

  if nullif(btrim(coalesce(payload ->> 'clinic_name', '')), '') is null then
    raise exception 'A clinic name is required.';
  end if;

  insert into public.clinics (
    clinic_name, description, email, contact_number, address, area, city, province,
    latitude, longitude, operating_hours, website, year_established, emergency_service,
    status, submitted_at
  ) values (
    btrim(payload ->> 'clinic_name'),
    payload ->> 'description',
    payload ->> 'email',
    payload ->> 'contact_number',
    payload ->> 'address',
    payload ->> 'area',
    payload ->> 'city',
    payload ->> 'province',
    (payload ->> 'latitude')::double precision,
    (payload ->> 'longitude')::double precision,
    payload -> 'operating_hours',
    payload ->> 'website',
    (payload ->> 'year_established')::integer,
    coalesce((payload ->> 'emergency_service')::boolean, false),
    'pending',
    now()
  )
  returning id, reference into new_clinic, new_reference;

  for service in select * from jsonb_array_elements(coalesce(payload -> 'services', '[]'::jsonb)) loop
    if nullif(btrim(coalesce(service ->> 'service_name', '')), '') is not null then
      insert into public.clinic_services
        (clinic_id, service_name, description, price, estimated_duration, availability, category)
      values (
        new_clinic,
        btrim(service ->> 'service_name'),
        service ->> 'description',
        coalesce((service ->> 'price')::numeric, 0),
        coalesce((service ->> 'estimated_duration')::integer, 30),
        coalesce(service ->> 'availability', 'available'),
        service ->> 'category'
      )
      on conflict do nothing;
    end if;
  end loop;

  for document in select * from jsonb_array_elements(coalesce(payload -> 'documents', '[]'::jsonb)) loop
    insert into public.clinic_documents (clinic_id, name, storage_path, kind, uploaded_by)
    values (
      new_clinic,
      coalesce(document ->> 'name', 'Document'),
      document ->> 'storage_path',
      document ->> 'kind',
      applicant
    )
    on conflict do nothing;
  end loop;

  insert into public.clinic_memberships (clinic_id, user_id, staff_role, status)
  values (new_clinic, applicant, 'clinic_administrator', 'invited')
  on conflict (clinic_id, user_id) do update set staff_role = 'clinic_administrator';

  perform public.write_audit_log(
    'clinic.application_submitted',
    'clinic',
    new_clinic::text,
    new_clinic,
    jsonb_build_object('reference', new_reference, 'clinic_name', payload ->> 'clinic_name')
  );

  return jsonb_build_object('clinic_id', new_clinic, 'reference', new_reference, 'status', 'pending');
end;
$$;

revoke all on function public.submit_clinic_application(jsonb) from public, anon;
grant execute on function public.submit_clinic_application(jsonb) to authenticated;

-- ---------------------------------------------------------------------------
-- System Administrator review actions
-- ---------------------------------------------------------------------------
create or replace function public.review_clinic_application(
  p_clinic uuid,
  p_decision text,
  p_notes text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  applicant uuid;
begin
  if not public.is_system_admin() then
    raise exception 'Only a System Administrator can review clinic applications.';
  end if;

  if p_decision not in ('pending', 'rejected') then
    raise exception 'Use provision-clinic-admin for approvals; review handles pending and rejected only.';
  end if;

  update public.clinics
     set status = p_decision,
         review_notes = p_notes,
         reviewed_at = now(),
         reviewed_by = auth.uid()
   where id = p_clinic;

  if not found then
    raise exception 'That clinic does not exist.';
  end if;

  perform public.write_audit_log(
    'clinic.' || p_decision,
    'clinic',
    p_clinic::text,
    p_clinic,
    jsonb_build_object('notes', p_notes)
  );

  if p_decision = 'rejected' then
    select m.user_id into applicant
      from public.clinic_memberships m
     where m.clinic_id = p_clinic
       and m.staff_role = 'clinic_administrator'
     limit 1;

    if applicant is not null then
      insert into public.notifications (user_id, title, message, notification_type, clinic_id)
      values (
        applicant,
        'Clinic application needs attention',
        coalesce(p_notes, 'Your VetLink clinic application was not approved. Review the remarks and contact support.'),
        'account',
        p_clinic
      );
    end if;
  end if;

  return jsonb_build_object('clinic_id', p_clinic, 'status', p_decision);
end;
$$;

revoke all on function public.review_clinic_application(uuid, text, text) from public, anon;
grant execute on function public.review_clinic_application(uuid, text, text) to authenticated;

create or replace function public.set_clinic_status(p_clinic uuid, p_action text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  next_status text;
begin
  if not public.is_system_admin() then
    raise exception 'Only a System Administrator can change a clinic account status.';
  end if;

  next_status := case p_action
    when 'suspend' then 'suspended'
    when 'reactivate' then 'approved'
    when 'deactivate' then 'inactive'
    else null
  end;

  if next_status is null then
    raise exception 'Unknown clinic action: %', p_action;
  end if;

  update public.clinics set status = next_status where id = p_clinic;
  if not found then
    raise exception 'That clinic does not exist.';
  end if;

  perform public.write_audit_log(
    'clinic.' || p_action,
    'clinic',
    p_clinic::text,
    p_clinic,
    jsonb_build_object('status', next_status)
  );

  return jsonb_build_object('clinic_id', p_clinic, 'status', next_status);
end;
$$;

revoke all on function public.set_clinic_status(uuid, text) from public, anon;
grant execute on function public.set_clinic_status(uuid, text) to authenticated;

-- ---------------------------------------------------------------------------
-- Accepting a staff invitation (called by AUTH-05 after the password is set)
-- ---------------------------------------------------------------------------
create or replace function public.accept_staff_invitation()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  activated integer;
begin
  if auth.uid() is null then
    raise exception 'Sign in first.';
  end if;

  update public.clinic_memberships
     set status = 'active'
   where user_id = auth.uid()
     and status = 'invited';

  get diagnostics activated = row_count;

  perform public.write_audit_log('staff.invitation_accepted', 'profile', auth.uid()::text, null, '{}'::jsonb);

  return jsonb_build_object('activated', activated);
end;
$$;

revoke all on function public.accept_staff_invitation() from public, anon;
grant execute on function public.accept_staff_invitation() to authenticated;

-- ---------------------------------------------------------------------------
-- Dashboard aggregates
-- Counts only: a System Administrator gets platform statistics without
-- reading any clinic's patients or clinical records.
-- ---------------------------------------------------------------------------
create or replace function public.clinic_dashboard(target_clinic uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  result jsonb;
begin
  if not (public.is_clinic_staff(target_clinic) or public.is_system_admin()) then
    raise exception 'You do not have access to this clinic.';
  end if;

  select jsonb_build_object(
    'clinic_id', target_clinic,
    'appointments_total', (select count(*) from public.appointments a where a.clinic_id = target_clinic),
    'appointments_pending', (select count(*) from public.appointments a where a.clinic_id = target_clinic and a.status = 'pending'),
    'appointments_confirmed', (select count(*) from public.appointments a where a.clinic_id = target_clinic and a.status = 'confirmed'),
    'appointments_completed', (select count(*) from public.appointments a where a.clinic_id = target_clinic and a.status = 'completed'),
    'appointments_cancelled', (select count(*) from public.appointments a where a.clinic_id = target_clinic and a.status in ('cancelled', 'rejected')),
    'appointments_today', (select count(*) from public.appointments a where a.clinic_id = target_clinic and a.appointment_date = current_date),
    'requests_pending', (select count(*) from public.appointments a where a.clinic_id = target_clinic and (a.cancellation_requested or a.reschedule_requested)),
    'owners_registered', (
      select count(distinct a.owner_id) from public.appointments a where a.clinic_id = target_clinic
    ),
    'pets_registered', (
      select count(distinct a.pet_id) from public.appointments a where a.clinic_id = target_clinic
    ),
    'services_active', (
      select count(*) from public.clinic_services s where s.clinic_id = target_clinic and s.availability = 'available'
    ),
    'services_total', (select count(*) from public.clinic_services s where s.clinic_id = target_clinic),
    'staff_active', (
      select count(*) from public.clinic_memberships m where m.clinic_id = target_clinic and m.status = 'active'
    ),
    'appointment_trend', coalesce((
      select jsonb_agg(jsonb_build_object('label', to_char(bucket.month, 'Mon'), 'value', bucket.total) order by bucket.month)
        from (
          select date_trunc('month', now()) - (offset_months || ' months')::interval as month,
                 (
                   select count(*)
                     from public.appointments a
                    where a.clinic_id = target_clinic
                      and date_trunc('month', a.appointment_date) = date_trunc('month', now()) - (offset_months || ' months')::interval
                 ) as total
            from generate_series(5, 0, -1) as offset_months
        ) bucket
    ), '[]'::jsonb)
  ) into result;

  return result;
end;
$$;

revoke all on function public.clinic_dashboard(uuid) from public, anon;
grant execute on function public.clinic_dashboard(uuid) to authenticated;

create or replace function public.platform_dashboard()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  result jsonb;
begin
  if not public.is_system_admin() then
    raise exception 'Only a System Administrator can read platform statistics.';
  end if;

  select jsonb_build_object(
    'clinics_total', (select count(*) from public.clinics),
    'clinics_approved', (select count(*) from public.clinics c where c.status = 'approved'),
    'clinics_pending', (select count(*) from public.clinics c where c.status = 'pending'),
    'clinics_suspended', (select count(*) from public.clinics c where c.status = 'suspended'),
    'clinics_inactive', (select count(*) from public.clinics c where c.status = 'inactive'),
    'clinics_rejected', (select count(*) from public.clinics c where c.status = 'rejected'),
    'users_total', (select count(*) from public.profiles),
    'owners_total', (select count(*) from public.profiles p where p.role = 'pet_owner'),
    'staff_total', (select count(*) from public.profiles p where p.role <> 'pet_owner'),
    'admins_total', (select count(*) from public.profiles p where p.role = 'system_administrator'),
    'appointments_total', (select count(*) from public.appointments),
    'appointments_today', (select count(*) from public.appointments a where a.appointment_date = current_date),
    'applications_pending', (
      select count(*) from public.clinics c
       where c.status = 'pending' and c.submitted_at is not null
    ),
    'registration_trend', coalesce((
      select jsonb_agg(jsonb_build_object('label', to_char(bucket.month, 'Mon'), 'value', bucket.total) order by bucket.month)
        from (
          select date_trunc('month', now()) - (offset_months || ' months')::interval as month,
                 (
                   select count(*)
                     from public.clinics c
                    where c.status = 'approved'
                      and date_trunc('month', c.created_at) = date_trunc('month', now()) - (offset_months || ' months')::interval
                 ) as total
            from generate_series(5, 0, -1) as offset_months
        ) bucket
    ), '[]'::jsonb)
  ) into result;

  return result;
end;
$$;

revoke all on function public.platform_dashboard() from public, anon;
grant execute on function public.platform_dashboard() to authenticated;

-- >>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>> 0005_clinic_documents.sql

-- ===========================================================================
-- VetLink — 0005 clinic documents and console uploads
-- Creates the private `clinic-documents` bucket used by REG-06 / SA-04, and
-- gives clinic staff the storage access the web console needs.
--
-- Path conventions (first segment matters to the policies):
--   clinic-documents/{uploaderUserId}/{file}      application documents
--   clinic-logos/{clinicId}/{file}                clinic admin logo
--   medical-record-attachments/{userId}/{file}    owner's own attachments
--   medical-record-attachments/{clinicId}/{file}  clinic uploads (Phase 6)
-- ===========================================================================

insert into storage.buckets (id, name, public)
values ('clinic-documents', 'clinic-documents', false)
on conflict (id) do nothing;

-- ---------------------------------------------------------------------------
-- Application documents: the uploader writes under their own user id, the
-- clinic's staff can read them once the clinic exists, system admins read all.
-- ---------------------------------------------------------------------------
drop policy if exists "Applicants upload their own clinic documents" on storage.objects;
create policy "Applicants upload their own clinic documents" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'clinic-documents'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "Applicants replace their own clinic documents" on storage.objects;
create policy "Applicants replace their own clinic documents" on storage.objects
  for update to authenticated
  using (
    bucket_id = 'clinic-documents'
    and (storage.foldername(name))[1] = auth.uid()::text
  )
  with check (
    bucket_id = 'clinic-documents'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "Applicants delete their own clinic documents" on storage.objects;
create policy "Applicants delete their own clinic documents" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'clinic-documents'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "Clinic documents are readable by their clinic" on storage.objects;
create policy "Clinic documents are readable by their clinic" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'clinic-documents'
    and (
      (storage.foldername(name))[1] = auth.uid()::text
      or public.is_system_admin()
      or exists (
        select 1 from public.clinic_documents d
         where d.storage_path = storage.objects.name
           and public.is_clinic_staff(d.clinic_id)
      )
    )
  );

-- ---------------------------------------------------------------------------
-- Clinic logos: previously read-only for the app. Clinic admins can now
-- upload their own logo (path starts with the clinic id).
-- ---------------------------------------------------------------------------
drop policy if exists "Clinic admins manage their logo" on storage.objects;
create policy "Clinic admins manage their logo" on storage.objects
  for all to authenticated
  using (
    bucket_id = 'clinic-logos'
    and public.is_clinic_admin(public.safe_uuid((storage.foldername(name))[1]))
  )
  with check (
    bucket_id = 'clinic-logos'
    and public.is_clinic_admin(public.safe_uuid((storage.foldername(name))[1]))
  );

-- ---------------------------------------------------------------------------
-- Medical record attachments: clinic staff write into their clinic's folder.
-- The owner policies from 0003 stay untouched (owner folders are user ids, so
-- safe_uuid() + is_clinic_staff() is false for them).
-- ---------------------------------------------------------------------------
drop policy if exists "Clinic staff manage their clinic attachments" on storage.objects;
create policy "Clinic staff manage their clinic attachments" on storage.objects
  for all to authenticated
  using (
    bucket_id = 'medical-record-attachments'
    and public.is_clinic_staff(public.safe_uuid((storage.foldername(name))[1]))
  )
  with check (
    bucket_id = 'medical-record-attachments'
    and public.is_clinic_staff(public.safe_uuid((storage.foldername(name))[1]))
  );

-- >>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>> 0006_platform_administration.sql

-- ===========================================================================
-- VetLink — 0006 platform administration
-- The two things the System Administrator console needs beyond 0004:
--
--   * platform_settings (SA-15) — one row of real, editable platform policy
--     instead of a settings screen with decorative switches
--   * send_platform_announcement() (SA-14) — a System Administrator can only
--     insert a notification for themselves under RLS, so a platform-wide
--     announcement has to be a security-definer RPC
--
-- It also re-declares review_clinic_application() so "request additional
-- information" notifies the applicant, not only a rejection.
--
-- Apply after 0005. Every statement is repeatable.
-- ===========================================================================

-- ---------------------------------------------------------------------------
-- Platform settings (SA-15). A single row, keyed by the boolean `id`.
-- ---------------------------------------------------------------------------
create table if not exists public.platform_settings (
  id boolean primary key default true check (id),
  platform_name text not null default 'VetLink',
  support_email text,
  support_phone text,
  timezone text not null default 'Asia/Manila',
  appointment_lead_hours integer not null default 2
    check (appointment_lead_hours between 0 and 168),
  auto_approve_clinics boolean not null default false,
  maintenance_mode boolean not null default false,
  maintenance_message text,
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users (id) on delete set null
);

insert into public.platform_settings (id) values (true)
on conflict (id) do nothing;

drop trigger if exists platform_settings_set_updated_at on public.platform_settings;
create trigger platform_settings_set_updated_at
  before update on public.platform_settings
  for each row execute function public.set_updated_at();

alter table public.platform_settings enable row level security;
revoke all on public.platform_settings from anon, authenticated;
grant select on public.platform_settings to authenticated;
grant update (platform_name, support_email, support_phone, timezone,
              appointment_lead_hours, auto_approve_clinics, maintenance_mode,
              maintenance_message, updated_by)
  on public.platform_settings to authenticated;

drop policy if exists platform_settings_admin_read on public.platform_settings;
create policy platform_settings_admin_read on public.platform_settings
  for select to authenticated using (public.is_system_admin());

drop policy if exists platform_settings_admin_update on public.platform_settings;
create policy platform_settings_admin_update on public.platform_settings
  for update to authenticated
  using (public.is_system_admin())
  with check (public.is_system_admin());

-- ---------------------------------------------------------------------------
-- Platform announcements (SA-14)
-- ---------------------------------------------------------------------------
create or replace function public.send_platform_announcement(
  p_title text,
  p_message text,
  p_audience text default 'all'
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  recipients integer;
begin
  if not public.is_system_admin() then
    raise exception 'Only a System Administrator can send platform announcements.';
  end if;

  if nullif(btrim(coalesce(p_title, '')), '') is null then
    raise exception 'An announcement needs a title.';
  end if;

  if nullif(btrim(coalesce(p_message, '')), '') is null then
    raise exception 'An announcement needs a message.';
  end if;

  if p_audience not in ('all', 'clinic_administrators', 'clinic_staff', 'pet_owners') then
    raise exception 'Unknown announcement audience: %', p_audience;
  end if;

  insert into public.notifications (user_id, title, message, notification_type)
  select p.id, btrim(p_title), btrim(p_message), 'general'
    from public.profiles p
   where p.id <> auth.uid()
     and case p_audience
           when 'clinic_administrators' then p.role = 'clinic_administrator'
           when 'clinic_staff' then p.role in ('veterinarian', 'receptionist', 'clinic_staff')
           when 'pet_owners' then p.role = 'pet_owner'
           else true
         end;

  get diagnostics recipients = row_count;

  perform public.write_audit_log(
    'platform.announcement_sent',
    'platform',
    null,
    null,
    jsonb_build_object(
      'title', btrim(p_title),
      'message', btrim(p_message),
      'audience', p_audience,
      'recipients', recipients
    )
  );

  return jsonb_build_object('recipients', recipients);
end;
$$;

revoke all on function public.send_platform_announcement(text, text, text) from public, anon;
grant execute on function public.send_platform_announcement(text, text, text) to authenticated;

-- ---------------------------------------------------------------------------
-- Review actions: "request additional information" now reaches the applicant
-- as well. Signature and return shape are unchanged from 0004.
-- ---------------------------------------------------------------------------
create or replace function public.review_clinic_application(
  p_clinic uuid,
  p_decision text,
  p_notes text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  applicant uuid;
begin
  if not public.is_system_admin() then
    raise exception 'Only a System Administrator can review clinic applications.';
  end if;

  if p_decision not in ('pending', 'rejected') then
    raise exception 'Use provision-clinic-admin for approvals; review handles pending and rejected only.';
  end if;

  if p_decision = 'pending' and nullif(btrim(coalesce(p_notes, '')), '') is null then
    raise exception 'Describe what additional information the clinic should provide.';
  end if;

  update public.clinics
     set status = p_decision,
         review_notes = p_notes,
         reviewed_at = now(),
         reviewed_by = auth.uid()
   where id = p_clinic;

  if not found then
    raise exception 'That clinic does not exist.';
  end if;

  perform public.write_audit_log(
    'clinic.' || p_decision,
    'clinic',
    p_clinic::text,
    p_clinic,
    jsonb_build_object('notes', p_notes)
  );

  select m.user_id into applicant
    from public.clinic_memberships m
   where m.clinic_id = p_clinic
     and m.staff_role = 'clinic_administrator'
   limit 1;

  if applicant is not null then
    insert into public.notifications (user_id, title, message, notification_type, clinic_id)
    values (
      applicant,
      case p_decision
        when 'rejected' then 'Clinic application needs attention'
        else 'More information needed for your clinic application'
      end,
      case p_decision
        when 'rejected' then coalesce(p_notes, 'Your VetLink clinic application was not approved. Review the remarks and contact support.')
        else coalesce(p_notes, 'A System Administrator needs more information before your clinic can be approved.')
      end,
      'account',
      p_clinic
    );
  end if;

  return jsonb_build_object('clinic_id', p_clinic, 'status', p_decision);
end;
$$;

revoke all on function public.review_clinic_application(uuid, text, text) from public, anon;
grant execute on function public.review_clinic_application(uuid, text, text) to authenticated;

-- >>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>> 0007_platform_list_queries.sql

-- ===========================================================================
-- VetLink — 0007 platform list queries
-- Two System-Administrator queries that the console cannot express with
-- PostgREST alone, because both need to join or aggregate across tables that
-- have no direct foreign key:
--
--   * platform_users_page() — SA-08's directory, filtered by role, account
--     state and free text (name, email or clinic), paged in Postgres
--   * clinic_team_counts()  — SA-06's active-team column, one row per clinic
--
-- Both are security definer (they are guarded by the same is_system_admin()
-- check the RLS policies use) and return summaries, so the browser never
-- downloads every profile or membership row.
--
-- Apply after 0006. Every statement is repeatable.
-- ===========================================================================

-- ---------------------------------------------------------------------------
-- SA-08: one page of platform accounts
-- ---------------------------------------------------------------------------
create or replace function public.platform_users_page(
  p_search text default null,
  p_role text default null,
  p_account text default 'all',
  p_page integer default 1,
  p_page_size integer default 12
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_term text;
  v_offset integer;
  v_total bigint;
  v_rows jsonb;
begin
  if not public.is_system_admin() then
    raise exception 'Only a System Administrator can list platform users.';
  end if;

  if coalesce(p_account, 'all') not in ('all', 'active', 'invited', 'none') then
    raise exception 'Unknown account filter: %', p_account;
  end if;

  if p_page_size is null or p_page_size < 1 or p_page_size > 100 then
    raise exception 'Page size must be between 1 and 100.';
  end if;

  v_offset := (greatest(coalesce(p_page, 1), 1) - 1) * p_page_size;
  v_term := case
              when p_search is null or btrim(p_search) = '' then null
              else '%' || btrim(p_search) || '%'
            end;

  with primary_membership as (
    -- The membership the console shows: the oldest one that is still live.
    select distinct on (m.user_id)
           m.user_id, m.clinic_id, m.status, m.staff_role
      from public.clinic_memberships m
     where m.status <> 'revoked'
     order by m.user_id, m.created_at
  ),
  joined as (
    select p.id, p.first_name, p.last_name, p.email, p.role, p.created_at,
           pm.status as membership_status,
           pm.staff_role as membership_role,
           c.id as clinic_id,
           c.clinic_name
      from public.profiles p
      left join primary_membership pm on pm.user_id = p.id
      left join public.clinics c on c.id = pm.clinic_id
  ),
  filtered as (
    select j.*
      from joined j
     where (p_role is null or p_role in ('', 'all') or j.role = p_role)
       and (
         coalesce(p_account, 'all') = 'all'
         or (p_account = 'active' and j.membership_status = 'active')
         or (p_account = 'invited' and j.membership_status = 'invited')
         or (p_account = 'none' and j.membership_status is null)
       )
       and (
         v_term is null
         or j.first_name ilike v_term
         or j.last_name ilike v_term
         or coalesce(j.email, '') ilike v_term
         or coalesce(j.clinic_name, '') ilike v_term
       )
  ),
  page as (
    select jsonb_build_object(
             'id', f.id,
             'first_name', f.first_name,
             'last_name', f.last_name,
             'email', f.email,
             'role', f.role,
             'created_at', f.created_at,
             'membership_status', f.membership_status,
             'membership_role', f.membership_role,
             'clinic_id', f.clinic_id,
             'clinic_name', f.clinic_name
           ) as entry,
           f.created_at as sort_key,
           f.id as sort_id
      from filtered f
     order by f.created_at, f.id
     offset v_offset limit p_page_size
  )
  -- The total is counted from `filtered`, so a page past the end still reports
  -- how many accounts match.
  select coalesce((select jsonb_agg(entry order by sort_key, sort_id) from page), '[]'::jsonb),
         (select count(*) from filtered)
    into v_rows, v_total;

  return jsonb_build_object('total', v_total, 'rows', v_rows);
end;
$$;

revoke all on function public.platform_users_page(text, text, text, integer, integer) from public, anon;
grant execute on function public.platform_users_page(text, text, text, integer, integer) to authenticated;

-- ---------------------------------------------------------------------------
-- SA-06: active staff per clinic
-- ---------------------------------------------------------------------------
create or replace function public.clinic_team_counts()
returns table (clinic_id uuid, active_staff integer)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not public.is_system_admin() then
    raise exception 'Only a System Administrator can read clinic team sizes.';
  end if;

  return query
    select m.clinic_id,
           (count(*) filter (where m.status = 'active'))::integer as active_staff
      from public.clinic_memberships m
     group by m.clinic_id;
end;
$$;

revoke all on function public.clinic_team_counts() from public, anon;
grant execute on function public.clinic_team_counts() to authenticated;

-- >>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>> 0008_clinic_staff_permissions.sql

-- ===========================================================================
-- 0008 — Clinic staff permissions (approved matrix)
--
-- Adds role-specific helpers and narrows clinic staff access:
--   * Veterinarians read only their assigned appointments and records.
--   * Only record authors may edit medical records; nobody deletes records
--     or vaccinations.
--   * Receptionists and administrators manage appointment status.
--   * Limited staff are read-only and use RPCs for name/species and due dates.
--   * Clinic administrators no longer read clinical records or attachments.
--   * Walk-in pet creation is deferred (no pet insert policy added).
--
-- Existing helpers is_clinic_staff() and is_clinic_admin() are unchanged.
-- ===========================================================================

-- ---------------------------------------------------------------------------
-- Step 1: role helpers
-- ---------------------------------------------------------------------------
create or replace function public.is_clinic_role(target_clinic uuid, roles text[])
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.clinic_memberships m
     where m.clinic_id = target_clinic
       and m.user_id = auth.uid()
       and m.status = 'active'
       and m.staff_role = any (roles)
  );
$$;

create or replace function public.is_clinic_receptionist(target_clinic uuid)
returns boolean language sql stable security definer set search_path = public
as $$ select public.is_clinic_role(target_clinic, array['receptionist']); $$;

create or replace function public.is_clinic_veterinarian(target_clinic uuid)
returns boolean language sql stable security definer set search_path = public
as $$ select public.is_clinic_role(target_clinic, array['veterinarian']); $$;

create or replace function public.is_clinic_limited_staff(target_clinic uuid)
returns boolean language sql stable security definer set search_path = public
as $$ select public.is_clinic_role(target_clinic, array['clinic_staff']); $$;

grant execute on function public.is_clinic_role(uuid, text[]) to authenticated;
grant execute on function public.is_clinic_receptionist(uuid) to authenticated;
grant execute on function public.is_clinic_veterinarian(uuid) to authenticated;
grant execute on function public.is_clinic_limited_staff(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Step 2: appointments
-- ---------------------------------------------------------------------------
alter table public.appointments
  add column if not exists assigned_vet_user_id uuid references auth.users (id) on delete set null;
create index if not exists appointments_assigned_vet_idx
  on public.appointments (assigned_vet_user_id);

drop policy if exists appointments_staff_read on public.appointments;
create policy appointments_staff_read on public.appointments
  for select to authenticated
  using (
    public.is_clinic_admin(clinic_id)
    or public.is_clinic_receptionist(clinic_id)
    or (public.is_clinic_veterinarian(clinic_id) and assigned_vet_user_id = auth.uid())
    or (public.is_clinic_limited_staff(clinic_id) and appointment_date = current_date)
  );

drop policy if exists appointments_staff_update on public.appointments;
create policy appointments_staff_update on public.appointments
  for update to authenticated
  using (
    public.is_clinic_admin(clinic_id)
    or public.is_clinic_receptionist(clinic_id)
    or (public.is_clinic_veterinarian(clinic_id) and assigned_vet_user_id = auth.uid())
  )
  with check (
    public.is_clinic_admin(clinic_id)
    or public.is_clinic_receptionist(clinic_id)
    or (public.is_clinic_veterinarian(clinic_id) and assigned_vet_user_id = auth.uid())
  );

-- Owners may only move their own appointment to 'cancelled' (enforced by trigger in Step 2b).
drop policy if exists appointments_owner_update on public.appointments;
create policy appointments_owner_update on public.appointments
  for update to authenticated
  using (owner_id = auth.uid())
  with check (owner_id = auth.uid());

-- Status transitions. Service-role and trigger-internal writes (auth.uid() is
-- null) are allowed so system writes are not blocked.
create or replace function public.enforce_appointment_status_transition()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  actor uuid := auth.uid();
  is_owner boolean;
  allowed boolean := false;
begin
  if new.status is not distinct from old.status then
    return new;
  end if;
  if actor is null then
    return new;
  end if;

  is_owner := (old.owner_id = actor);

  if old.status = 'pending' and new.status = 'confirmed' then
    allowed := public.is_clinic_admin(old.clinic_id) or public.is_clinic_receptionist(old.clinic_id);
  elsif old.status = 'pending' and new.status = 'rejected' then
    allowed := public.is_clinic_admin(old.clinic_id) or public.is_clinic_receptionist(old.clinic_id);
  elsif old.status = 'pending' and new.status = 'cancelled' then
    allowed := is_owner or public.is_clinic_admin(old.clinic_id) or public.is_clinic_receptionist(old.clinic_id);
  elsif old.status = 'confirmed' and new.status = 'rescheduled' then
    allowed := public.is_clinic_admin(old.clinic_id) or public.is_clinic_receptionist(old.clinic_id);
  elsif old.status = 'confirmed' and new.status = 'completed' then
    allowed := public.is_clinic_veterinarian(old.clinic_id) and old.assigned_vet_user_id = actor;
  elsif old.status = 'confirmed' and new.status = 'cancelled' then
    allowed := is_owner or public.is_clinic_admin(old.clinic_id) or public.is_clinic_receptionist(old.clinic_id);
  elsif old.status = 'rescheduled' and new.status = 'confirmed' then
    allowed := public.is_clinic_admin(old.clinic_id) or public.is_clinic_receptionist(old.clinic_id);
  elsif old.status = 'rescheduled' and new.status = 'cancelled' then
    allowed := is_owner or public.is_clinic_admin(old.clinic_id) or public.is_clinic_receptionist(old.clinic_id);
  end if;

  if not allowed then
    raise exception 'Status change from % to % is not permitted for this user', old.status, new.status
      using errcode = '42501';
  end if;
  return new;
end;
$$;

drop trigger if exists appointments_enforce_status_transition on public.appointments;
create trigger appointments_enforce_status_transition
  before update of status on public.appointments
  for each row execute function public.enforce_appointment_status_transition();

-- ---------------------------------------------------------------------------
-- Step 3: medical records (veterinarian authors only; no deletes)
-- ---------------------------------------------------------------------------
alter table public.medical_records
  add column if not exists author_user_id uuid references auth.users (id) on delete set null;

drop policy if exists medical_records_staff_read on public.medical_records;
create policy medical_records_staff_read on public.medical_records
  for select to authenticated
  using (clinic_id is not null and public.is_clinic_veterinarian(clinic_id));

drop policy if exists medical_records_staff_insert on public.medical_records;
create policy medical_records_staff_insert on public.medical_records
  for insert to authenticated
  with check (
    clinic_id is not null
    and public.is_clinic_veterinarian(clinic_id)
    and author_user_id = auth.uid()
  );

drop policy if exists medical_records_staff_update on public.medical_records;
create policy medical_records_staff_update on public.medical_records
  for update to authenticated
  using (clinic_id is not null and public.is_clinic_veterinarian(clinic_id) and author_user_id = auth.uid())
  with check (clinic_id is not null and public.is_clinic_veterinarian(clinic_id) and author_user_id = auth.uid());

drop policy if exists medical_records_staff_delete on public.medical_records;

-- ---------------------------------------------------------------------------
-- Step 4: vaccinations (veterinarian write; read for receptionist and vet; no deletes)
-- ---------------------------------------------------------------------------
drop policy if exists vaccinations_staff_read on public.vaccinations;
create policy vaccinations_staff_read on public.vaccinations
  for select to authenticated
  using (
    clinic_id is not null
    and (public.is_clinic_veterinarian(clinic_id) or public.is_clinic_receptionist(clinic_id))
  );

drop policy if exists vaccinations_staff_insert on public.vaccinations;
create policy vaccinations_staff_insert on public.vaccinations
  for insert to authenticated
  with check (clinic_id is not null and public.is_clinic_veterinarian(clinic_id));

drop policy if exists vaccinations_staff_update on public.vaccinations;
create policy vaccinations_staff_update on public.vaccinations
  for update to authenticated
  using (clinic_id is not null and public.is_clinic_veterinarian(clinic_id))
  with check (clinic_id is not null and public.is_clinic_veterinarian(clinic_id));

drop policy if exists vaccinations_staff_delete on public.vaccinations;

-- ---------------------------------------------------------------------------
-- Step 5: clinic attachments (veterinarian only; administrators lose read)
-- ---------------------------------------------------------------------------
drop policy if exists "Clinic staff manage their clinic attachments" on storage.objects;
create policy "Veterinarians manage clinic attachments" on storage.objects
  for all to authenticated
  using (
    bucket_id = 'medical-record-attachments'
    and public.is_clinic_veterinarian(public.safe_uuid((storage.foldername(name))[1]))
  )
  with check (
    bucket_id = 'medical-record-attachments'
    and public.is_clinic_veterinarian(public.safe_uuid((storage.foldername(name))[1]))
  );

-- ---------------------------------------------------------------------------
-- Step 6: limited-staff RPCs (read-only, minimal columns)
-- ---------------------------------------------------------------------------
create or replace function public.clinic_limited_pets(target_clinic uuid)
returns table (pet_id uuid, pet_name text, species text)
language sql
stable
security definer
set search_path = public
as $$
  select distinct p.id, p.pet_name, p.species
    from public.pets p
    join public.appointments a on a.owner_id = p.owner_id
   where a.clinic_id = target_clinic
     and public.is_clinic_limited_staff(target_clinic)
     and a.appointment_date = current_date;
$$;

create or replace function public.clinic_limited_due_vaccinations(target_clinic uuid)
returns table (vaccination_id uuid, pet_name text, vaccine_name text, next_due_date date)
language sql
stable
security definer
set search_path = public
as $$
  select v.id, p.pet_name, v.vaccine_name, v.next_due_date
    from public.vaccinations v
    join public.pets p on p.id = v.pet_id
   where v.clinic_id = target_clinic
     and public.is_clinic_limited_staff(target_clinic)
     and v.next_due_date is not null;
$$;

grant execute on function public.clinic_limited_pets(uuid) to authenticated;
grant execute on function public.clinic_limited_due_vaccinations(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Step 7: receptionist counts only (no clinical data)
-- ---------------------------------------------------------------------------
create or replace function public.clinic_receptionist_counts(target_clinic uuid)
returns table (pending_count bigint, confirmed_today_count bigint)
language sql
stable
security definer
set search_path = public
as $$
  select c.pending_count, c.confirmed_today_count
    from (
      select
        count(*) filter (where a.status = 'pending') as pending_count,
        count(*) filter (where a.status = 'confirmed' and a.appointment_date = current_date) as confirmed_today_count
        from public.appointments a
       where a.clinic_id = target_clinic
    ) c
   where public.is_clinic_receptionist(target_clinic);
$$;

grant execute on function public.clinic_receptionist_counts(uuid) to authenticated;

-- >>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>> 0009_clinic_profile_guard.sql

-- ===========================================================================
-- VetLink — 0009 clinic profile write guard
--
-- 0004 granted `authenticated` UPDATE on the System-Administrator columns
-- (status, review_notes, reviewed_at, reviewed_by). Grants are role-wide and
-- clinics_admin_update lets a Clinic Administrator update their own clinic, so
-- the same grant also let an administrator approve, suspend or unsuspend their
-- own clinic straight through the REST API, bypassing platform review.
--
-- Those changes belong to the security-definer RPCs set_clinic_status() and
-- review_clinic_application(), which re-check the caller and write an audit
-- entry. Revoking the column privileges does not affect them: they run as the
-- function owner, not as `authenticated`.
--
-- CA-03 keeps the profile columns it actually edits. Adding a column here is a
-- deliberate decision, not a side effect of a console screen.
-- ===========================================================================

revoke update (status, review_notes, reviewed_at, reviewed_by)
  on public.clinics from authenticated;

-- Set by triggers and the registration RPC, never by a browser edit form.
revoke update (reference, submitted_at, featured, rating, review_count, distance_km)
  on public.clinics from authenticated;

grant update (
  clinic_name, description, email, contact_number,
  address, area, city, province, latitude, longitude,
  logo_url, cover_url, operating_hours, has_availability,
  website, year_established, emergency_service
) on public.clinics to authenticated;

-- >>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>> 0010_clinic_membership_role_guard.sql

-- ============================================================================
-- VetLink — 0010 clinic membership role guard
--
-- 0004 grants `authenticated` UPDATE (staff_role, status) and DELETE on
-- clinic_memberships, and clinic_memberships_admin_all lets a Clinic
-- Administrator write their own clinic's rows. A grant cannot say "except
-- clinic_administrator", so a direct API call could promote a colleague to
-- clinic_administrator, demote or suspend an administrator, or delete their
-- membership, all without the console offering it.
--
-- Only VetLink provisions administrators: submit_clinic_application() and
-- review_clinic_application() create those memberships as their function
-- owner, and invite-staff refuses clinic_administrator outright. This trigger
-- keeps that boundary at the table.
--
-- It is security invoker on purpose: current_user is `authenticated` for a
-- browser or PostgREST write, and stays the function owner inside a
-- security-definer RPC, so the provisioning flows are untouched.
-- ============================================================================

create or replace function public.guard_clinic_membership_role()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if tg_op = 'DELETE' then
    if current_user = 'authenticated' and old.staff_role = 'clinic_administrator' then
      raise exception 'Clinic administrator memberships can only be removed by VetLink.'
        using errcode = '42501';
    end if;
    return old;
  end if;

  -- Service-role jobs, migrations and security-definer RPCs run as their owner.
  if current_user <> 'authenticated' then
    return new;
  end if;

  if tg_op = 'INSERT' then
    if new.staff_role = 'clinic_administrator' then
      raise exception 'Clinic administrator memberships are provisioned by VetLink, not the clinic console.'
        using errcode = '42501';
    end if;
    return new;
  end if;

  -- An existing administrator keeps their role and account state; deactivating,
  -- demoting or reactivating one is a VetLink decision.
  if old.staff_role = 'clinic_administrator' then
    if new.staff_role is distinct from old.staff_role
       or new.status is distinct from old.status then
      raise exception 'Clinic administrator memberships can only be changed by VetLink.'
        using errcode = '42501';
    end if;
  elsif new.staff_role = 'clinic_administrator' then
    raise exception 'Clinic administrator memberships are provisioned by VetLink, not the clinic console.'
      using errcode = '42501';
  end if;

  return new;
end;
$$;

drop trigger if exists clinic_memberships_guard_role on public.clinic_memberships;
create trigger clinic_memberships_guard_role
  before insert or update or delete on public.clinic_memberships
  for each row execute function public.guard_clinic_membership_role();

-- >>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>> 0011_membership_profile_role_sync.sql

-- ============================================================================
-- VetLink — 0011 membership/profile role sync
--
-- CA-06 changes a membership's staff_role, but the web console routes on
-- profiles.role. The table update alone left the two disagreeing: a
-- receptionist promoted to veterinarian kept seeing the appointment workspace,
-- while the database granted veterinarian access.
--
-- The sync trigger writes profiles.role from the edited membership. It skips
-- system administrators, whose platform role must never be demoted by a clinic
-- edit. For a multi-clinic account it only syncs when the profile role already
-- matched the edited membership (or there is no other live membership), so an
-- administrator at another clinic is not silently demoted by this edit. The
-- single global profile role remains the limitation of routing on
-- profiles.role; this closes the drift for the membership that was edited.
--
-- protect_profile_role() becomes security invoker so it can distinguish a
-- browser write (authenticated) from the sync trigger running as its owner.
-- Browser requests still cannot change a role; the service role and definer
-- code can.
-- ============================================================================

create or replace function public.protect_profile_role()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.role is distinct from old.role
     and current_user = 'authenticated'
     and coalesce(auth.role(), '') <> 'service_role' then
    raise exception 'Account roles are managed by VetLink administration.'
      using errcode = '42501';
  end if;
  return new;
end;
$$;

create or replace function public.sync_membership_profile_role()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.profiles p
     set role = new.staff_role
   where p.id = new.user_id
     and p.role <> 'system_administrator'
     and (
       -- The global role represented this membership before the edit.
       p.role = old.staff_role
       -- Or this is the person's only live clinic membership, so there is no
       -- other role for the profile to preserve.
       or not exists (
         select 1
           from public.clinic_memberships m
          where m.user_id = new.user_id
            and m.id <> new.id
            and m.status in ('active', 'invited')
       )
     );

  return new;
end;
$$;

drop trigger if exists clinic_memberships_sync_profile_role on public.clinic_memberships;
create trigger clinic_memberships_sync_profile_role
  after update of staff_role on public.clinic_memberships
  for each row
  when (new.staff_role is distinct from old.staff_role)
  execute function public.sync_membership_profile_role();

-- >>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>> 0012_service_role_function_grants.sql

-- ============================================================================
-- VetLink — 0012 service-role grants for the Edge Functions
--
-- The public tables were created by the migration role (`postgres`), and in
-- this project that did not carry the usual service_role table grants. The
-- Auth Admin API still worked, but the PostgREST calls inside invite-staff and
-- provision-clinic-admin failed with 42501 on `profiles` before they could
-- read the existing account. Invitations and provisioning could not complete,
-- and the system-administrator guard could not be reached.
--
-- service_role is server-only (its key never ships in a client), already has
-- BYPASSRLS, and these are exactly the tables the two functions touch:
--   profiles, clinic_memberships, clinics, notifications, platform_audit_log.
-- No browser role gains anything here.
-- ============================================================================

grant select, update on public.profiles to service_role;
grant select, insert, update on public.clinic_memberships to service_role;
grant select, update on public.clinics to service_role;
grant insert on public.notifications to service_role;
grant insert on public.platform_audit_log to service_role;

-- >>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>> 0013_membership_insert_profile_role_sync.sql

-- ============================================================================
-- VetLink — 0013 membership-insert profile role sync
--
-- 0011 synced profiles.role when CA-06 edited a membership's staff_role.
-- Invitations and clinic provisioning insert a membership instead, so a new
-- staff account could still keep its old profile role until someone edited the
-- row. This migration makes INSERT follow the same rule.
--
-- An INSERT has no previous membership role. The equivalent guard is:
--   * never touch a system administrator's platform role;
--   * sync when the profile already carries the inserted role (a no-op), or
--     when this is the user's only active/invited membership;
--   * otherwise leave the global profile role alone, so adding a second clinic
--     cannot overwrite an administrator role held at another clinic.
--
-- The existing UPDATE trigger keeps its 0011 behaviour; this adds a separate
-- INSERT trigger rather than changing when UPDATE fires.
-- ============================================================================

create or replace function public.sync_membership_profile_role()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    update public.profiles p
       set role = new.staff_role
     where p.id = new.user_id
       and p.role <> 'system_administrator'
       and (
         -- The global role already says this; or there is no other live
         -- membership whose role the insert could overwrite.
         p.role = new.staff_role
         or not exists (
           select 1
             from public.clinic_memberships m
            where m.user_id = new.user_id
              and m.id <> new.id
              and m.status in ('active', 'invited')
         )
       );
  else
    update public.profiles p
       set role = new.staff_role
     where p.id = new.user_id
       and p.role <> 'system_administrator'
       and (
         -- The global role represented this membership before the edit.
         p.role = old.staff_role
         -- Or this is the person's only live clinic membership, so there is
         -- no other role for the profile to preserve.
         or not exists (
           select 1
             from public.clinic_memberships m
            where m.user_id = new.user_id
              and m.id <> new.id
              and m.status in ('active', 'invited')
         )
       );
  end if;

  return new;
end;
$$;

drop trigger if exists clinic_memberships_sync_profile_role_insert on public.clinic_memberships;
create trigger clinic_memberships_sync_profile_role_insert
  after insert on public.clinic_memberships
  for each row
  execute function public.sync_membership_profile_role();

-- >>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>> 0014_limited_staff_patient_reads.sql

-- ============================================================================
-- VetLink — 0014 limited staff patient reads
--
-- 0008 gave limited staff (clinic_staff) two read-only RPCs — pet name/species
-- for today's schedule, and due vaccination dates — and said they are "read-only
-- everywhere else". The base policies never followed: profiles_select_patients_staff
-- and pets_staff_read both used is_staff_of_patient(), which accepts ANY active
-- membership of the clinic, whatever its staff_role. A limited staff member could
-- therefore still select full owner profiles and pet rows directly.
--
-- This migration narrows exactly those two reads:
--   * a new is_patient_clinician() check keeps administrators, receptionists and
--     veterinarians, and excludes clinic_staff;
--   * both policies are repointed at it.
--
-- is_staff_of_patient() itself is left as the broad "any active member" check, so
-- a future policy that really means that can still use it. Appointment reads are
-- untouched: 0008 deliberately scopes limited staff to today's rows, and those
-- rows keep their denormalised owner_name/contact columns.
--
-- Repeatable: every statement can run again without changing the result.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- Step 1: the clinician check
-- ---------------------------------------------------------------------------
create or replace function public.is_patient_clinician(patient uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
      from public.appointments a
      join public.clinic_memberships m on m.clinic_id = a.clinic_id
     where a.owner_id = patient
       and m.user_id = auth.uid()
       and m.status = 'active'
       and m.staff_role <> 'clinic_staff'
  );
$$;

revoke all on function public.is_patient_clinician(uuid) from public, anon;
grant execute on function public.is_patient_clinician(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Step 2: owner profiles
--
-- profiles_select_patients_staff is replaced rather than edited: the policy name
-- said "staff", and the whole point of this migration is that limited staff no
-- longer pass it.
-- ---------------------------------------------------------------------------
drop policy if exists profiles_select_patients_staff on public.profiles;

drop policy if exists profiles_select_patient_clinicians on public.profiles;
create policy profiles_select_patient_clinicians on public.profiles
  for select to authenticated using (public.is_patient_clinician(id));

-- ---------------------------------------------------------------------------
-- Step 3: pet records
-- ---------------------------------------------------------------------------
drop policy if exists pets_staff_read on public.pets;

drop policy if exists pets_clinician_read on public.pets;
create policy pets_clinician_read on public.pets
  for select to authenticated using (public.is_patient_clinician(owner_id));

-- ---------------------------------------------------------------------------
-- Step 4: keep the RPCs as the limited-staff path, and correct their scope
--
-- clinic_limited_pets() joined appointments to pets on the owner, not the pet:
-- one appointment today therefore exposed every pet that owner had, including
-- pets booked on another day. The intended scope is the pet on today's
-- appointment, so the join goes through a.pet_id. The function stays security
-- definer, which is what lets it read past the policies above on purpose.
-- ---------------------------------------------------------------------------
create or replace function public.clinic_limited_pets(target_clinic uuid)
returns table (pet_id uuid, pet_name text, species text)
language sql
stable
security definer
set search_path = public
as $$
  select distinct p.id, p.pet_name, p.species
    from public.pets p
    join public.appointments a on a.pet_id = p.id
   where a.clinic_id = target_clinic
     and public.is_clinic_limited_staff(target_clinic)
     and a.appointment_date = current_date;
$$;

grant execute on function public.clinic_limited_pets(uuid) to authenticated;
grant execute on function public.clinic_limited_due_vaccinations(uuid) to authenticated;

-- >>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>> 0015_limited_staff_schedule.sql

-- ============================================================================
-- VetLink — 0015 limited staff schedule RPC
--
-- 0014 closed owner profile and pet row reads for clinic_staff (limited staff)
-- but left the appointment rows themselves, because those rows carry a copy of
-- the owner's name and contact number (owner_name, contact) written at booking
-- time. 0008 admitted limited staff to today's appointment rows for the
-- schedule, so a limited staff member could still read the owner's name and
-- phone number straight off appointments — even though 0008's model says they
-- read only name/species and due dates through RPCs.
--
-- Column privileges cannot express this. Supabase signs every member in as the
-- `authenticated` role, so `grant select (owner_name)` is all-or-nothing across
-- administrators, receptionists, veterinarians, limited staff and owners. The
-- only per-membership boundary available is the row: which rows a policy admits.
--
-- So this migration:
--   * removes the limited-staff branch from appointments_staff_read, which stops
--     clinic_staff reading any appointment row and therefore any owner_name or
--     contact value;
--   * adds clinic_limited_schedule() for the schedule limited staff still need —
--     today's times, status, reference, service and booked pet's name/species,
--     with no owner contact, no visit reason, no symptoms or notes, and no
--     clinical columns;
--   * leaves every other appointment reader untouched: owners still read their
--     own bookings (owner_name included, it is their own data), and
--     administrators, receptionists and assigned veterinarians keep exactly the
--     rows 0008 gave them.
--
-- The owner_name/contact columns stay on the table: they are the booking-time
-- copy owners and clinicians read, and dropping them would break every existing
-- query for data that only limited staff must not see.
--
-- Repeatable: every statement can run again without changing the result.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- Step 1: appointments — limited staff no longer pass any SELECT policy
--
-- This is 0008's policy with its last branch removed; the other three are
-- restated unchanged.
-- ---------------------------------------------------------------------------
drop policy if exists appointments_staff_read on public.appointments;
create policy appointments_staff_read on public.appointments
  for select to authenticated
  using (
    public.is_clinic_admin(clinic_id)
    or public.is_clinic_receptionist(clinic_id)
    or (public.is_clinic_veterinarian(clinic_id) and assigned_vet_user_id = auth.uid())
  );

-- ---------------------------------------------------------------------------
-- Step 2: the schedule limited staff still need, without the owner columns
--
-- security definer is what lets this read appointments past the policy above;
-- is_clinic_limited_staff() is what makes it refuse everybody else.
-- ---------------------------------------------------------------------------
create or replace function public.clinic_limited_schedule(target_clinic uuid)
returns table (
  appointment_id uuid,
  reference text,
  appointment_time time,
  status text,
  service_name text,
  pet_id uuid,
  pet_name text,
  species text
)
language sql
stable
security definer
set search_path = public
as $$
  select a.id, a.reference, a.appointment_time, a.status, a.service_name,
         p.id, p.pet_name, p.species
    from public.appointments a
    join public.pets p on p.id = a.pet_id
   where a.clinic_id = target_clinic
     and public.is_clinic_limited_staff(target_clinic)
     and a.appointment_date = current_date
   order by a.appointment_time, p.pet_name;
$$;

revoke all on function public.clinic_limited_schedule(uuid) from public, anon;
grant execute on function public.clinic_limited_schedule(uuid) to authenticated;

-- >>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>> 0016_staff_appointment_insert.sql

-- ============================================================================
-- VetLink — 0016 staff appointment insert
--
-- AM-06 lets the front desk book an appointment for an owner who is already
-- registered. `authenticated` has had INSERT on public.appointments since 0002,
-- but the only INSERT policy was appointments_owner_insert, which requires
-- owner_id = auth.uid() AND status = 'pending'. A receptionist therefore could
-- not create a booking at all: every attempt failed the policy.
--
-- This migration adds the staff path and nothing else:
--   * receptionists and clinic administrators may insert at their own clinic;
--   * the row they create is 'confirmed', because the front desk is booking it
--     (owner-submitted requests arrive as 'pending' through the owner policy);
--   * a named veterinarian must be an active veterinarian of that clinic, so a
--     booking cannot hand a patient to another clinic's vet.
--
-- Owners keep their existing policy: their own rows, pending only. The check
-- lives in the policy rather than a trigger so existing rows and service-side
-- writes keep their current behaviour; it applies to what the console inserts.
-- ============================================================================

drop policy if exists appointments_staff_insert on public.appointments;
create policy appointments_staff_insert on public.appointments
  for insert to authenticated
  with check (
    status = 'confirmed'
    and (public.is_clinic_admin(clinic_id) or public.is_clinic_receptionist(clinic_id))
    and (
      coalesce(assigned_vet_user_id, veterinarian_id) is null
      or exists (
        select 1
          from public.clinic_memberships m
         where m.clinic_id = appointments.clinic_id
           and m.user_id = coalesce(appointments.assigned_vet_user_id, appointments.veterinarian_id)
           and m.staff_role = 'veterinarian'
           and m.status = 'active'
      )
    )
  );

-- >>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>> 0017_clinic_owner_registration.sql

-- ============================================================================
-- VetLink — 0017 clinic owner registration
--
-- AM-10 registers a pet owner at the front desk. Creating the account itself
-- needs the Auth Admin API, so the register-pet-owner Edge Function holds the
-- service role and this migration adds only what the console reads back:
--
--   * clinic_owner_registrations — which owners this clinic enrolled. AM-09
--     reads it together with the clinic's bookings, so an owner registered here
--     is listed, bookable and counted before their first appointment.
--   * is_registered_patient() — the read check used by the profile and pet
--     policies below. It mirrors is_patient_clinician(): administrators,
--     receptionists and veterinarians only, so limited staff keep the minimal
--     RPC-only view 0014 established.
--
-- Writes stay server-side: browsers get SELECT on the register and nothing
-- else, and the Edge Function writes with the service role.
--
-- Repeatable: every statement can run again without changing the result.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- Step 1: the clinic's own owner register
-- ---------------------------------------------------------------------------
create table if not exists public.clinic_owner_registrations (
  clinic_id uuid not null references public.clinics (id) on delete cascade,
  owner_id uuid not null references auth.users (id) on delete cascade,
  registered_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  primary key (clinic_id, owner_id)
);

create index if not exists clinic_owner_registrations_owner_idx
  on public.clinic_owner_registrations (owner_id);

alter table public.clinic_owner_registrations enable row level security;
revoke all on public.clinic_owner_registrations from anon, authenticated;
grant select on public.clinic_owner_registrations to authenticated;

drop policy if exists clinic_owner_registrations_staff_read
  on public.clinic_owner_registrations;
create policy clinic_owner_registrations_staff_read
  on public.clinic_owner_registrations
  for select to authenticated using (public.is_clinic_staff(clinic_id));

-- ---------------------------------------------------------------------------
-- Step 2: the clinician check for owners a clinic registered
-- ---------------------------------------------------------------------------
create or replace function public.is_registered_patient(patient uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
      from public.clinic_owner_registrations r
      join public.clinic_memberships m on m.clinic_id = r.clinic_id
     where r.owner_id = patient
       and m.user_id = auth.uid()
       and m.status = 'active'
       and m.staff_role <> 'clinic_staff'
  );
$$;

revoke all on function public.is_registered_patient(uuid) from public, anon;
grant execute on function public.is_registered_patient(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Step 3: profiles and pets of those owners
-- ---------------------------------------------------------------------------
drop policy if exists profiles_select_registered_patients on public.profiles;
create policy profiles_select_registered_patients on public.profiles
  for select to authenticated using (public.is_registered_patient(id));

drop policy if exists pets_registered_clinician_read on public.pets;
create policy pets_registered_clinician_read on public.pets
  for select to authenticated using (public.is_registered_patient(owner_id));

-- >>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>> 0018_service_role_owner_registration.sql

-- ============================================================================
-- VetLink — 0018 service-role grants for owner registration
--
-- 0012 gave the service role exactly the privileges the two existing Edge
-- Functions needed. register-pet-owner (AM-10) also files the owner's pet and
-- the clinic's register row, so without these grants every registration ends
-- in "permission denied for table pets" after the account has been created.
--
-- service_role is server-only, already has BYPASSRLS, and is the only role
-- that writes another person's pets or the clinic owner register. Nothing here
-- reaches anon or authenticated.
-- ============================================================================

-- SELECT as well as INSERT: the function asks PostgREST to return the new
-- pet id, and a representation read needs the table privilege too.
grant select, insert on public.pets to service_role;
grant select, insert, update on public.clinic_owner_registrations to service_role;

-- >>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>> 0019_dashboard_owner_counts.sql

-- ============================================================================
-- VetLink — 0019 dashboard owner counts
--
-- 0004 built clinic_dashboard() from the appointment rows alone, so an owner
-- the front desk registered (0017) and the pets filed with them were invisible
-- on the dashboard until the owner happened to book. AM-10 exists precisely so
-- the desk can enrol an owner before their first visit, which made the counts
-- disagree with the clinic's own owner list.
--
-- Owners and pets are now the union of the two sources the clinic owns:
--
--   * owners  — the accounts behind its bookings, plus its register rows;
--   * pets    — the pets on its bookings, plus the pets of its registrants.
--
-- A UNION of ids, not a sum: an owner who was registered and later booked is
-- one owner, and a pet that visited after being filed at the desk is one pet.
-- Everything else in the payload is unchanged, and the function is still
-- counts-only, so limited staff keep the aggregate view 0015 allows them.
--
-- Repeatable: create or replace, and the grants below are the same ones 0004
-- set.
-- ============================================================================

create or replace function public.clinic_dashboard(target_clinic uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  result jsonb;
begin
  if not (public.is_clinic_staff(target_clinic) or public.is_system_admin()) then
    raise exception 'You do not have access to this clinic.';
  end if;

  select jsonb_build_object(
    'clinic_id', target_clinic,
    'appointments_total', (select count(*) from public.appointments a where a.clinic_id = target_clinic),
    'appointments_pending', (select count(*) from public.appointments a where a.clinic_id = target_clinic and a.status = 'pending'),
    'appointments_confirmed', (select count(*) from public.appointments a where a.clinic_id = target_clinic and a.status = 'confirmed'),
    'appointments_completed', (select count(*) from public.appointments a where a.clinic_id = target_clinic and a.status = 'completed'),
    'appointments_cancelled', (select count(*) from public.appointments a where a.clinic_id = target_clinic and a.status in ('cancelled', 'rejected')),
    'appointments_today', (select count(*) from public.appointments a where a.clinic_id = target_clinic and a.appointment_date = current_date),
    'requests_pending', (select count(*) from public.appointments a where a.clinic_id = target_clinic and (a.cancellation_requested or a.reschedule_requested)),
    'owners_registered', (
      select count(*)
        from (
          select a.owner_id from public.appointments a where a.clinic_id = target_clinic
          union
          select r.owner_id from public.clinic_owner_registrations r where r.clinic_id = target_clinic
        ) owner_ids
    ),
    'pets_registered', (
      select count(*)
        from (
          select a.pet_id from public.appointments a where a.clinic_id = target_clinic
          union
          select p.id
            from public.pets p
            join public.clinic_owner_registrations r on r.owner_id = p.owner_id
           where r.clinic_id = target_clinic
        ) pet_ids
    ),
    'services_active', (
      select count(*) from public.clinic_services s where s.clinic_id = target_clinic and s.availability = 'available'
    ),
    'services_total', (select count(*) from public.clinic_services s where s.clinic_id = target_clinic),
    'staff_active', (
      select count(*) from public.clinic_memberships m where m.clinic_id = target_clinic and m.status = 'active'
    ),
    'appointment_trend', coalesce((
      select jsonb_agg(jsonb_build_object('label', to_char(bucket.month, 'Mon'), 'value', bucket.total) order by bucket.month)
        from (
          select date_trunc('month', now()) - (offset_months || ' months')::interval as month,
                 (
                   select count(*)
                     from public.appointments a
                    where a.clinic_id = target_clinic
                      and date_trunc('month', a.appointment_date) = date_trunc('month', now()) - (offset_months || ' months')::interval
                 ) as total
            from generate_series(5, 0, -1) as offset_months
        ) bucket
    ), '[]'::jsonb)
  ) into result;

  return result;
end;
$$;

revoke all on function public.clinic_dashboard(uuid) from public, anon;
grant execute on function public.clinic_dashboard(uuid) to authenticated;

-- >>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>> 0020_dashboard_total_owner_pets.sql

-- ============================================================================
-- VetLink — 0020 dashboard total owner pets
--
-- 0019 counted a pet only when it had visited the clinic or belonged to a
-- front-desk registrant. AM-09 lists owners with the number of pets on their
-- account, so an owner who booked here and keeps a second pet at home showed
-- two pets in the owner list and one on the dashboard.
--
-- The owner set does not change: the accounts behind the clinic's bookings plus
-- its register rows. The pet count now covers every pet those owners have,
-- which is exactly the total AM-09 reports, and still counts each pet once
-- however many bookings it has.
--
-- Repeatable: create or replace. The rest of the payload, the access check and
-- the grants are unchanged from 0004 and 0019.
-- ============================================================================

create or replace function public.clinic_dashboard(target_clinic uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  result jsonb;
begin
  if not (public.is_clinic_staff(target_clinic) or public.is_system_admin()) then
    raise exception 'You do not have access to this clinic.';
  end if;

  select jsonb_build_object(
    'clinic_id', target_clinic,
    'appointments_total', (select count(*) from public.appointments a where a.clinic_id = target_clinic),
    'appointments_pending', (select count(*) from public.appointments a where a.clinic_id = target_clinic and a.status = 'pending'),
    'appointments_confirmed', (select count(*) from public.appointments a where a.clinic_id = target_clinic and a.status = 'confirmed'),
    'appointments_completed', (select count(*) from public.appointments a where a.clinic_id = target_clinic and a.status = 'completed'),
    'appointments_cancelled', (select count(*) from public.appointments a where a.clinic_id = target_clinic and a.status in ('cancelled', 'rejected')),
    'appointments_today', (select count(*) from public.appointments a where a.clinic_id = target_clinic and a.appointment_date = current_date),
    'requests_pending', (select count(*) from public.appointments a where a.clinic_id = target_clinic and (a.cancellation_requested or a.reschedule_requested)),
    'owners_registered', (
      select count(*)
        from (
          select a.owner_id from public.appointments a where a.clinic_id = target_clinic
          union
          select r.owner_id from public.clinic_owner_registrations r where r.clinic_id = target_clinic
        ) owner_ids
    ),
    'pets_registered', (
      select count(*)
        from public.pets p
       where p.owner_id in (
         select a.owner_id from public.appointments a where a.clinic_id = target_clinic
         union
         select r.owner_id from public.clinic_owner_registrations r where r.clinic_id = target_clinic
       )
    ),
    'services_active', (
      select count(*) from public.clinic_services s where s.clinic_id = target_clinic and s.availability = 'available'
    ),
    'services_total', (select count(*) from public.clinic_services s where s.clinic_id = target_clinic),
    'staff_active', (
      select count(*) from public.clinic_memberships m where m.clinic_id = target_clinic and m.status = 'active'
    ),
    'appointment_trend', coalesce((
      select jsonb_agg(jsonb_build_object('label', to_char(bucket.month, 'Mon'), 'value', bucket.total) order by bucket.month)
        from (
          select date_trunc('month', now()) - (offset_months || ' months')::interval as month,
                 (
                   select count(*)
                     from public.appointments a
                    where a.clinic_id = target_clinic
                      and date_trunc('month', a.appointment_date) = date_trunc('month', now()) - (offset_months || ' months')::interval
                 ) as total
            from generate_series(5, 0, -1) as offset_months
        ) bucket
    ), '[]'::jsonb)
  ) into result;

  return result;
end;
$$;

revoke all on function public.clinic_dashboard(uuid) from public, anon;
grant execute on function public.clinic_dashboard(uuid) to authenticated;

-- >>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>> 0021_clinic_owner_unregister.sql

-- ============================================================================
-- VetLink — 0021 clinic owner unregister
--
-- A registration filed by mistake (wrong clinic, wrong person) was permanent:
-- clinic_owner_registrations had no state, so the row kept the owner on the
-- clinic's list and inside its dashboard counts forever.
--
-- The row is now soft-deleted rather than removed:
--
--   * removed_at / removed_by record who took it off and when, so the history
--     survives and the register stays an audit trail;
--   * is_registered_patient() ignores removed rows, so the profile and pet
--     policies close again for that owner;
--   * unregister_clinic_owner() is the only write path, a security-definer RPC
--     that re-checks the caller's active front-desk membership — browsers still
--     hold SELECT alone on the table.
--
-- Owners with bookings stay listed and counted, because a booking is the clinic's
-- own record of treating them; only the registration is undone. Re-registering
-- the same owner clears the removal again (the Edge Function is updated with
-- this migration).
--
-- Repeatable: add column if not exists, create or replace, and the grants below
-- are the ones 0017 set.
-- ============================================================================

alter table public.clinic_owner_registrations
  add column if not exists removed_at timestamptz,
  add column if not exists removed_by uuid references auth.users (id) on delete set null;

-- The owner list and the dashboard only ever read live registrations.
create index if not exists clinic_owner_registrations_live_idx
  on public.clinic_owner_registrations (clinic_id, owner_id)
  where removed_at is null;

-- ---------------------------------------------------------------------------
-- Step 1: a removed registration no longer grants read access
-- ---------------------------------------------------------------------------
create or replace function public.is_registered_patient(patient uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
      from public.clinic_owner_registrations r
      join public.clinic_memberships m on m.clinic_id = r.clinic_id
     where r.owner_id = patient
       and r.removed_at is null
       and m.user_id = auth.uid()
       and m.status = 'active'
       and m.staff_role <> 'clinic_staff'
  );
$$;

revoke all on function public.is_registered_patient(uuid) from public, anon;
grant execute on function public.is_registered_patient(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Step 2: the one way to unregister
-- ---------------------------------------------------------------------------
create or replace function public.unregister_clinic_owner(target_clinic uuid, target_owner uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  caller uuid := auth.uid();
  cleared integer;
begin
  if caller is null then
    raise exception 'Sign in to continue.';
  end if;

  if not exists (
    select 1
      from public.clinic_memberships m
     where m.clinic_id = target_clinic
       and m.user_id = caller
       and m.status = 'active'
       and m.staff_role in ('receptionist', 'clinic_administrator')
  ) then
    raise exception 'Only an active front desk or Clinic Administrator of this clinic can unregister an owner.';
  end if;

  update public.clinic_owner_registrations r
     set removed_at = now(),
         removed_by = caller
   where r.clinic_id = target_clinic
     and r.owner_id = target_owner
     and r.removed_at is null;

  get diagnostics cleared = row_count;

  if cleared = 0 then
    raise exception 'That owner is not on this clinic''s register.';
  end if;

  perform public.write_audit_log(
    'owner.unregistered',
    'profile',
    target_owner::text,
    target_clinic,
    jsonb_build_object('owner_id', target_owner)
  );

  return jsonb_build_object('owner_id', target_owner, 'removed', true);
end;
$$;

revoke all on function public.unregister_clinic_owner(uuid, uuid) from public, anon;
grant execute on function public.unregister_clinic_owner(uuid, uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Step 3: the dashboard counts only live registrations (0020's body)
-- ---------------------------------------------------------------------------
create or replace function public.clinic_dashboard(target_clinic uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  result jsonb;
begin
  if not (public.is_clinic_staff(target_clinic) or public.is_system_admin()) then
    raise exception 'You do not have access to this clinic.';
  end if;

  select jsonb_build_object(
    'clinic_id', target_clinic,
    'appointments_total', (select count(*) from public.appointments a where a.clinic_id = target_clinic),
    'appointments_pending', (select count(*) from public.appointments a where a.clinic_id = target_clinic and a.status = 'pending'),
    'appointments_confirmed', (select count(*) from public.appointments a where a.clinic_id = target_clinic and a.status = 'confirmed'),
    'appointments_completed', (select count(*) from public.appointments a where a.clinic_id = target_clinic and a.status = 'completed'),
    'appointments_cancelled', (select count(*) from public.appointments a where a.clinic_id = target_clinic and a.status in ('cancelled', 'rejected')),
    'appointments_today', (select count(*) from public.appointments a where a.clinic_id = target_clinic and a.appointment_date = current_date),
    'requests_pending', (select count(*) from public.appointments a where a.clinic_id = target_clinic and (a.cancellation_requested or a.reschedule_requested)),
    'owners_registered', (
      select count(*)
        from (
          select a.owner_id from public.appointments a where a.clinic_id = target_clinic
          union
          select r.owner_id from public.clinic_owner_registrations r
           where r.clinic_id = target_clinic and r.removed_at is null
        ) owner_ids
    ),
    'pets_registered', (
      select count(*)
        from public.pets p
       where p.owner_id in (
         select a.owner_id from public.appointments a where a.clinic_id = target_clinic
         union
         select r.owner_id from public.clinic_owner_registrations r
          where r.clinic_id = target_clinic and r.removed_at is null
       )
    ),
    'services_active', (
      select count(*) from public.clinic_services s where s.clinic_id = target_clinic and s.availability = 'available'
    ),
    'services_total', (select count(*) from public.clinic_services s where s.clinic_id = target_clinic),
    'staff_active', (
      select count(*) from public.clinic_memberships m where m.clinic_id = target_clinic and m.status = 'active'
    ),
    'appointment_trend', coalesce((
      select jsonb_agg(jsonb_build_object('label', to_char(bucket.month, 'Mon'), 'value', bucket.total) order by bucket.month)
        from (
          select date_trunc('month', now()) - (offset_months || ' months')::interval as month,
                 (
                   select count(*)
                     from public.appointments a
                    where a.clinic_id = target_clinic
                      and date_trunc('month', a.appointment_date) = date_trunc('month', now()) - (offset_months || ' months')::interval
                 ) as total
            from generate_series(5, 0, -1) as offset_months
        ) bucket
    ), '[]'::jsonb)
  ) into result;

  return result;
end;
$$;

revoke all on function public.clinic_dashboard(uuid) from public, anon;
grant execute on function public.clinic_dashboard(uuid) to authenticated;

-- >>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>> 0022_clinic_vet_patients.sql

-- ============================================================================
-- VetLink — 0022 clinic-scoped veterinarian patient list
--
-- 0014 and 0017 admit a veterinarian to the pets of owners who booked at, or
-- were registered by, a clinic where they hold an active membership. Those
-- predicates are stated per caller, not per clinic id, so a veterinarian with
-- two active memberships reads both clinics' patients from one query and VET-03
-- had no way to narrow that to the clinic the screen names.
--
-- clinic_vet_patients(target_clinic) evaluates the same two predicates for one
-- clinic and returns the pet with its owner's name, so the screen needs a single
-- round trip and cannot widen its own scope. security definer is what lets it
-- read past the pet and profile policies; is_clinic_veterinarian() is what
-- refuses every other caller, including the limited-staff role.
--
-- Repeatable: the function is replaced, not altered.
-- ============================================================================

create or replace function public.clinic_vet_patients(target_clinic uuid)
returns table (
  pet_id uuid,
  pet_name text,
  species text,
  breed text,
  sex text,
  owner_id uuid,
  owner_first_name text,
  owner_last_name text,
  created_at timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  select p.id,
         p.pet_name,
         p.species,
         p.breed,
         p.sex,
         p.owner_id,
         pr.first_name,
         pr.last_name,
         p.created_at
    from public.pets p
    left join public.profiles pr on pr.id = p.owner_id
   where public.is_clinic_veterinarian(target_clinic)
     and p.owner_id in (
       select a.owner_id from public.appointments a where a.clinic_id = target_clinic
       union
       select r.owner_id from public.clinic_owner_registrations r
        where r.clinic_id = target_clinic and r.removed_at is null
     )
   order by p.pet_name, p.id;
$$;

revoke all on function public.clinic_vet_patients(uuid) from public, anon;
grant execute on function public.clinic_vet_patients(uuid) to authenticated;

-- >>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>> 0023_clinic_vet_vaccinations.sql

-- ============================================================================
-- VetLink — 0023 clinic-scoped veterinarian vaccination list
--
-- VET-08 reads `vaccinations` directly (vaccinations_staff_read, 0008), but the
-- pet's name came from an embedded `pets` row, which is subject to the pet
-- policies. A vaccination recorded at the clinic for a pet the veterinarian
-- cannot otherwise read — no booking, no desk registration — therefore rendered
-- with no patient name, which is useless on the screen that exists to show it.
--
-- clinic_vet_vaccinations(target_clinic) returns the same records with the pet's
-- name, joined inside a security definer function, exactly as
-- clinic_limited_due_vaccinations() already does for limited staff (0008/0014).
-- It exposes a name only; species, breed, owner and every clinical column stay
-- behind the pet policies. is_clinic_veterinarian() is what refuses every other
-- caller, and every row is still filtered to one clinic.
--
-- Repeatable: the function is replaced, not altered.
-- ============================================================================

create or replace function public.clinic_vet_vaccinations(target_clinic uuid)
returns table (
  vaccination_id uuid,
  pet_id uuid,
  pet_name text,
  vaccine_name text,
  vaccination_date date,
  next_due_date date,
  dosage text,
  batch_number text,
  veterinarian_name text
)
language sql
stable
security definer
set search_path = public
as $$
  select v.id,
         v.pet_id,
         p.pet_name,
         v.vaccine_name,
         v.vaccination_date,
         v.next_due_date,
         v.dosage,
         v.batch_number,
         v.veterinarian_name
    from public.vaccinations v
    join public.pets p on p.id = v.pet_id
   where v.clinic_id = target_clinic
     and public.is_clinic_veterinarian(target_clinic)
   order by v.next_due_date nulls last, v.vaccine_name;
$$;

revoke all on function public.clinic_vet_vaccinations(uuid) from public, anon;
grant execute on function public.clinic_vet_vaccinations(uuid) to authenticated;

-- >>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>> 0024_clinic_vet_vaccinations_notes.sql

-- ============================================================================
-- VetLink — 0024 clinic-scoped veterinarian vaccination read carries notes
--
-- `vaccinations.notes` has existed since 0001, and VET-09's spec lists it, but
-- the read VET-08 and VET-10 share (clinic_vet_vaccinations, 0023) never
-- selected the column. A note could therefore be written and then never shown
-- on the record it belongs to.
--
-- The function is dropped and recreated rather than replaced, because a
-- RETURNS TABLE column list cannot be changed in place. Nothing else moves:
-- still stable, still security definer, still gated on
-- is_clinic_veterinarian(target_clinic), and still only one clinic's rows.
-- ============================================================================

drop function if exists public.clinic_vet_vaccinations(uuid);

create function public.clinic_vet_vaccinations(target_clinic uuid)
returns table (
  vaccination_id uuid,
  pet_id uuid,
  pet_name text,
  vaccine_name text,
  vaccination_date date,
  next_due_date date,
  dosage text,
  batch_number text,
  veterinarian_name text,
  notes text
)
language sql
stable
security definer
set search_path = public
as $$
  select v.id,
         v.pet_id,
         p.pet_name,
         v.vaccine_name,
         v.vaccination_date,
         v.next_due_date,
         v.dosage,
         v.batch_number,
         v.veterinarian_name,
         v.notes
    from public.vaccinations v
    join public.pets p on p.id = v.pet_id
   where v.clinic_id = target_clinic
     and public.is_clinic_veterinarian(target_clinic)
   order by v.next_due_date nulls last, v.vaccine_name;
$$;

revoke all on function public.clinic_vet_vaccinations(uuid) from public, anon;
grant execute on function public.clinic_vet_vaccinations(uuid) to authenticated;

-- >>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>> 0025_my_clinic_application.sql

-- ============================================================================
-- VetLink — 0025 an applicant can read the status of their own application
--
-- submit_clinic_application() (0004) leaves the applicant with an *invited*
-- clinic_administrator membership, and every clinics read policy needs an
-- active one (or an approved clinic). So until approval the applicant could not
-- see their own pending — or rejected — application, and REG-08/09/10 had
-- nothing to show.
--
-- my_clinic_application() returns the caller's most recent application only:
-- name, reference, status, dates, the reviewer's remarks and the document
-- count. Nothing about any other clinic, and no write. auth.uid() is the whole
-- scope, so an anonymous call returns no row.
-- ============================================================================

create or replace function public.my_clinic_application()
returns table (
  clinic_id uuid,
  clinic_name text,
  reference text,
  status text,
  submitted_at timestamptz,
  reviewed_at timestamptz,
  review_notes text,
  document_count integer
)
language sql
stable
security definer
set search_path = public
as $$
  select c.id,
         c.clinic_name,
         c.reference,
         c.status,
         c.submitted_at,
         c.reviewed_at,
         c.review_notes,
         (select count(*)::integer from public.clinic_documents d where d.clinic_id = c.id)
    from public.clinic_memberships m
    join public.clinics c on c.id = m.clinic_id
   where m.user_id = auth.uid()
     and m.staff_role = 'clinic_administrator'
   order by coalesce(c.submitted_at, c.created_at) desc
   limit 1;
$$;

revoke all on function public.my_clinic_application() from public, anon;
grant execute on function public.my_clinic_application() to authenticated;
