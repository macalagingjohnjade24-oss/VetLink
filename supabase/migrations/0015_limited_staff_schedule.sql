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
