-- ============================================================================
-- VetLink — 0013 membership-insert profile role sync
--
-- 0011 synced profiles.role when CA-06 edited a membership's staff_role.
-- Invitations and clinic provisioning insert a membership instead, so a new
-- staff account could still keep its old profile role until someone edited the
-- row. This migration makes INSERT follow the same rule.
--
-- An INSERT has no previous membership role. The equivalent guard is:
--   * never touch a system administrator's platform role;
--   * sync when the profile already carries the inserted role (a no-op), or
--     when this is the user's only active/invited membership;
--   * otherwise leave the global profile role alone, so adding a second clinic
--     cannot overwrite an administrator role held at another clinic.
--
-- The existing UPDATE trigger keeps its 0011 behaviour; this adds a separate
-- INSERT trigger rather than changing when UPDATE fires.
-- ============================================================================

create or replace function public.sync_membership_profile_role()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    update public.profiles p
       set role = new.staff_role
     where p.id = new.user_id
       and p.role <> 'system_administrator'
       and (
         -- The global role already says this; or there is no other live
         -- membership whose role the insert could overwrite.
         p.role = new.staff_role
         or not exists (
           select 1
             from public.clinic_memberships m
            where m.user_id = new.user_id
              and m.id <> new.id
              and m.status in ('active', 'invited')
         )
       );
  else
    update public.profiles p
       set role = new.staff_role
     where p.id = new.user_id
       and p.role <> 'system_administrator'
       and (
         -- The global role represented this membership before the edit.
         p.role = old.staff_role
         -- Or this is the person's only live clinic membership, so there is
         -- no other role for the profile to preserve.
         or not exists (
           select 1
             from public.clinic_memberships m
            where m.user_id = new.user_id
              and m.id <> new.id
              and m.status in ('active', 'invited')
         )
       );
  end if;

  return new;
end;
$$;

drop trigger if exists clinic_memberships_sync_profile_role_insert on public.clinic_memberships;
create trigger clinic_memberships_sync_profile_role_insert
  after insert on public.clinic_memberships
  for each row
  execute function public.sync_membership_profile_role();
