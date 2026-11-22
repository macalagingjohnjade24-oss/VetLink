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
