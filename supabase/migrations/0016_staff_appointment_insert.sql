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
