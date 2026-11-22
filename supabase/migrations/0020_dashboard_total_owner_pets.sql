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
