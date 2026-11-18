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
