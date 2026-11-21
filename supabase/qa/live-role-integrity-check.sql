-- Live role-integrity check. Everything runs in one transaction and rolls back,
-- so no clinic, profile, membership or auth user is left behind.
--
-- Run with:
--   npx supabase db query --remote=<ref> --yes -f supabase/qa/live-role-integrity-check.sql
--
-- It impersonates users with JWT claims + SET ROLE, the same approach as
-- live-rls-checks.sql. Requires 0010, 0011 and 0013.

begin;

create temp table qa_role_results (check_name text primary key, actual text) on commit drop;
grant all on qa_role_results to authenticated;

insert into auth.users (
  id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
  confirmation_token, is_sso_user, is_anonymous
) values
  ('a1111111-1111-4111-8111-111111111111', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'qa-role-admin@qa-vetlink.invalid', '', now(), '{}', '{"first_name":"QA","last_name":"Role Admin"}', now(), now(), '', false, false),
  ('a1111111-1111-4111-8111-111111111112', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'qa-role-staff@qa-vetlink.invalid', '', now(), '{}', '{"first_name":"QA","last_name":"Role Staff"}', now(), now(), '', false, false),
  ('a1111111-1111-4111-8111-111111111113', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'qa-role-sys@qa-vetlink.invalid', '', now(), '{}', '{"first_name":"QA","last_name":"Role Sys"}', now(), now(), '', false, false),
  ('a1111111-1111-4111-8111-111111111114', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'qa-role-insert@qa-vetlink.invalid', '', now(), '{}', '{"first_name":"QA","last_name":"Role Insert"}', now(), now(), '', false, false);

update public.profiles set role = 'clinic_administrator'
 where id = 'a1111111-1111-4111-8111-111111111111';
update public.profiles set role = 'veterinarian'
 where id = 'a1111111-1111-4111-8111-111111111112';
update public.profiles set role = 'system_administrator'
 where id = 'a1111111-1111-4111-8111-111111111113';

insert into public.clinics (id, clinic_name, status)
values
  ('c1111111-1111-4111-8111-111111111111', '[QA] Role integrity (rolled back)', 'approved'),
  ('c1111111-1111-4111-8111-111111111112', '[QA] Role integrity second clinic (rolled back)', 'approved');

insert into public.clinic_memberships (clinic_id, user_id, staff_role, status) values
  ('c1111111-1111-4111-8111-111111111111', 'a1111111-1111-4111-8111-111111111111', 'clinic_administrator', 'active'),
  ('c1111111-1111-4111-8111-111111111111', 'a1111111-1111-4111-8111-111111111112', 'veterinarian', 'active'),
  ('c1111111-1111-4111-8111-111111111111', 'a1111111-1111-4111-8111-111111111113', 'clinic_staff', 'active');

-- Inserting a membership must not demote a system administrator either.
insert into qa_role_results
select 'system_admin_insert_preserved', role
  from public.profiles where id = 'a1111111-1111-4111-8111-111111111113';

-- A first live membership insertion syncs the global profile role.
insert into public.clinic_memberships (clinic_id, user_id, staff_role, status)
values ('c1111111-1111-4111-8111-111111111111', 'a1111111-1111-4111-8111-111111111114', 'clinic_staff', 'invited');
insert into qa_role_results
select 'membership_insert_updates_profile', role
  from public.profiles where id = 'a1111111-1111-4111-8111-111111111114';

-- Make that person an administrator, then add a second clinic. The insert
-- must leave the administrator role alone.
update public.clinic_memberships set staff_role = 'clinic_administrator'
 where clinic_id = 'c1111111-1111-4111-8111-111111111111'
   and user_id = 'a1111111-1111-4111-8111-111111111114';
insert into public.clinic_memberships (clinic_id, user_id, staff_role, status)
values ('c1111111-1111-4111-8111-111111111112', 'a1111111-1111-4111-8111-111111111114', 'veterinarian', 'active');
insert into qa_role_results
select 'second_clinic_insert_preserves_admin', role
  from public.profiles where id = 'a1111111-1111-4111-8111-111111111114';

-- The clinic administrator edits the staff member's role.
select set_config('request.jwt.claims', '{"sub":"a1111111-1111-4111-8111-111111111111","role":"authenticated"}', true);
select set_config('role', 'authenticated', true);
update public.clinic_memberships set staff_role = 'clinic_staff'
 where clinic_id = 'c1111111-1111-4111-8111-111111111111'
   and user_id = 'a1111111-1111-4111-8111-111111111112';
select set_config('role', 'postgres', true);

insert into qa_role_results
select 'membership_edit_updates_profile', role
  from public.profiles where id = 'a1111111-1111-4111-8111-111111111112';

-- Restore the staff role; the profile should follow again.
update public.clinic_memberships set staff_role = 'veterinarian'
 where clinic_id = 'c1111111-1111-4111-8111-111111111111'
   and user_id = 'a1111111-1111-4111-8111-111111111112';
insert into qa_role_results
select 'membership_restore_updates_profile', role
  from public.profiles where id = 'a1111111-1111-4111-8111-111111111112';

-- A membership edit must not demote a system administrator.
select set_config('request.jwt.claims', '{"sub":"a1111111-1111-4111-8111-111111111111","role":"authenticated"}', true);
select set_config('role', 'authenticated', true);
update public.clinic_memberships set staff_role = 'receptionist'
 where clinic_id = 'c1111111-1111-4111-8111-111111111111'
   and user_id = 'a1111111-1111-4111-8111-111111111113';
select set_config('role', 'postgres', true);

insert into qa_role_results
select 'system_admin_role_preserved', role
  from public.profiles where id = 'a1111111-1111-4111-8111-111111111113';

-- A browser session still cannot write profiles.role.
select set_config('request.jwt.claims', '{"sub":"a1111111-1111-4111-8111-111111111112","role":"authenticated"}', true);
select set_config('role', 'authenticated', true);
do $$
begin
  update public.profiles set role = 'clinic_administrator'
   where id = 'a1111111-1111-4111-8111-111111111112';
  insert into qa_role_results values ('browser_profile_role_write', 'allowed');
exception when others then
  insert into qa_role_results values ('browser_profile_role_write', 'error=' || sqlstate);
end $$;
select set_config('role', 'postgres', true);

-- 0010 still refuses a clinic administrator deactivating themselves.
select set_config('request.jwt.claims', '{"sub":"a1111111-1111-4111-8111-111111111111","role":"authenticated"}', true);
select set_config('role', 'authenticated', true);
do $$
begin
  update public.clinic_memberships set status = 'suspended'
   where clinic_id = 'c1111111-1111-4111-8111-111111111111'
     and user_id = 'a1111111-1111-4111-8111-111111111111';
  insert into qa_role_results values ('admin_self_deactivate', 'allowed');
exception when others then
  insert into qa_role_results values ('admin_self_deactivate', 'error=' || sqlstate);
end $$;
select set_config('role', 'postgres', true);

select check_name, actual from qa_role_results order by check_name;

rollback;
