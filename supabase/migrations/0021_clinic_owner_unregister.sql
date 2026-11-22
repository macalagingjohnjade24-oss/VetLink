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
