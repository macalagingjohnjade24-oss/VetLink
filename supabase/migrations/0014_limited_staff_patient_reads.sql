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
