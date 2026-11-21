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
