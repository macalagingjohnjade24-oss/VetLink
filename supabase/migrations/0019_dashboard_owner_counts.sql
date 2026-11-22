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
