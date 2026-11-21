-- ============================================================================
-- VetLink — 0010 clinic membership role guard
--
-- 0004 grants `authenticated` UPDATE (staff_role, status) and DELETE on
-- clinic_memberships, and clinic_memberships_admin_all lets a Clinic
-- Administrator write their own clinic's rows. A grant cannot say "except
-- clinic_administrator", so a direct API call could promote a colleague to
-- clinic_administrator, demote or suspend an administrator, or delete their
-- membership, all without the console offering it.
--
-- Only VetLink provisions administrators: submit_clinic_application() and
-- review_clinic_application() create those memberships as their function
-- owner, and invite-staff refuses clinic_administrator outright. This trigger
-- keeps that boundary at the table.
--
-- It is security invoker on purpose: current_user is `authenticated` for a
-- browser or PostgREST write, and stays the function owner inside a
-- security-definer RPC, so the provisioning flows are untouched.
-- ============================================================================

create or replace function public.guard_clinic_membership_role()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if tg_op = 'DELETE' then
    if current_user = 'authenticated' and old.staff_role = 'clinic_administrator' then
      raise exception 'Clinic administrator memberships can only be removed by VetLink.'
        using errcode = '42501';
    end if;
    return old;
  end if;

  -- Service-role jobs, migrations and security-definer RPCs run as their owner.
  if current_user <> 'authenticated' then
    return new;
  end if;

  if tg_op = 'INSERT' then
    if new.staff_role = 'clinic_administrator' then
      raise exception 'Clinic administrator memberships are provisioned by VetLink, not the clinic console.'
        using errcode = '42501';
    end if;
    return new;
  end if;

  -- An existing administrator keeps their role and account state; deactivating,
  -- demoting or reactivating one is a VetLink decision.
  if old.staff_role = 'clinic_administrator' then
    if new.staff_role is distinct from old.staff_role
       or new.status is distinct from old.status then
      raise exception 'Clinic administrator memberships can only be changed by VetLink.'
        using errcode = '42501';
    end if;
  elsif new.staff_role = 'clinic_administrator' then
    raise exception 'Clinic administrator memberships are provisioned by VetLink, not the clinic console.'
      using errcode = '42501';
  end if;

  return new;
end;
$$;

drop trigger if exists clinic_memberships_guard_role on public.clinic_memberships;
create trigger clinic_memberships_guard_role
  before insert or update or delete on public.clinic_memberships
  for each row execute function public.guard_clinic_membership_role();
