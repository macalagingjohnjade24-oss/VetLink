-- Removes every QA fixture created by live-rls-fixtures.sql. Safe to run twice.
delete from public.vaccinations where id = 'f0000000-0000-4000-8000-000000000001';
delete from public.medical_records where id = 'e0000000-0000-4000-8000-000000000001';
delete from public.appointments where clinic_id = 'c0000000-0000-4000-8000-000000000001';
delete from public.pets where id = 'b0000000-0000-4000-8000-000000000001';
delete from public.clinic_memberships where clinic_id = 'c0000000-0000-4000-8000-000000000001';
delete from public.clinics where id = 'c0000000-0000-4000-8000-000000000001';
delete from public.profiles where id::text like 'a0000000-0000-4000-8000-00000000000%';
delete from auth.identities where user_id::text like 'a0000000-0000-4000-8000-00000000000%';
delete from auth.users where id::text like 'a0000000-0000-4000-8000-00000000000%';
