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
-- edit. Editing a role for a multi-clinic account still updates the single
-- global profile role, which is the existing limitation of routing on
-- profiles.role; it no longer silently disagrees with the membership that was
-- just edited.
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
  update public.profiles
     set role = new.staff_role
   where id = new.user_id
     and role <> 'system_administrator';

  return new;
end;
$$;

drop trigger if exists clinic_memberships_sync_profile_role on public.clinic_memberships;
create trigger clinic_memberships_sync_profile_role
  after update of staff_role on public.clinic_memberships
  for each row
  when (new.staff_role is distinct from old.staff_role)
  execute function public.sync_membership_profile_role();
