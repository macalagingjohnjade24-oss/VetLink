-- QA fixtures for live RLS checks (approved by user). Remove with live-rls-teardown.sql.
-- Passwords are empty: these accounts cannot sign in; checks impersonate via JWT claims.
insert into auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at, confirmation_token, is_sso_user, is_anonymous)
values
  ('a0000000-0000-4000-8000-000000000001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'qa-owner@qa-vetlink.invalid', '', now(), '{}', '{"first_name":"QA","last_name":"Owner"}', now(), now(), '', false, false),
  ('a0000000-0000-4000-8000-000000000002', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'qa-vet@qa-vetlink.invalid', '', now(), '{}', '{"first_name":"QA","last_name":"Vet"}', now(), now(), '', false, false),
  ('a0000000-0000-4000-8000-000000000003', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'qa-reception@qa-vetlink.invalid', '', now(), '{}', '{"first_name":"QA","last_name":"Reception"}', now(), now(), '', false, false),
  ('a0000000-0000-4000-8000-000000000004', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'qa-staff@qa-vetlink.invalid', '', now(), '{}', '{"first_name":"QA","last_name":"Staff"}', now(), now(), '', false, false),
  ('a0000000-0000-4000-8000-000000000005', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'qa-admin@qa-vetlink.invalid', '', now(), '{}', '{"first_name":"QA","last_name":"Admin"}', now(), now(), '', false, false),
  ('a0000000-0000-4000-8000-000000000006', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'qa-vet2@qa-vetlink.invalid', '', now(), '{}', '{"first_name":"QA","last_name":"Vet2"}', now(), now(), '', false, false)
on conflict (id) do nothing;

-- GoTrue scans the token columns into plain strings, so a NULL makes the row
-- unloadable by the admin API ("Database error loading user") and the QA users
-- could not be given passwords. The update also repairs rows from earlier runs.
update auth.users
   set email_change = coalesce(email_change, ''),
       email_change_token_new = coalesce(email_change_token_new, ''),
       recovery_token = coalesce(recovery_token, ''),
       phone_change = coalesce(phone_change, ''),
       confirmation_token = coalesce(confirmation_token, '')
 where id::text like 'a0000000-0000-4000-8000-00000000000%';

insert into public.clinics (id, clinic_name, status) values ('c0000000-0000-4000-8000-000000000001', 'QA Test Clinic (delete me)', 'approved')
on conflict (id) do nothing;

insert into public.clinic_memberships (clinic_id, user_id, staff_role, status) values
  ('c0000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000002', 'veterinarian', 'active'),
  ('c0000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000003', 'receptionist', 'active'),
  ('c0000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000004', 'clinic_staff', 'active'),
  ('c0000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000005', 'clinic_administrator', 'active'),
  ('c0000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000006', 'veterinarian', 'active')
on conflict (clinic_id, user_id) do nothing;

insert into public.pets (id, owner_id, pet_name, species) values
  ('b0000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000001', 'QA Pet', 'Dog')
on conflict (id) do nothing;

insert into public.appointments (id, owner_id, clinic_id, pet_id, appointment_date, appointment_time, status, assigned_vet_user_id) values
  ('d0000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000001', 'c0000000-0000-4000-8000-000000000001', 'b0000000-0000-4000-8000-000000000001', current_date, '09:00', 'confirmed', 'a0000000-0000-4000-8000-000000000002'),
  ('d0000000-0000-4000-8000-000000000002', 'a0000000-0000-4000-8000-000000000001', 'c0000000-0000-4000-8000-000000000001', 'b0000000-0000-4000-8000-000000000001', current_date, '10:00', 'confirmed', 'a0000000-0000-4000-8000-000000000006')
on conflict (id) do nothing;

insert into public.medical_records (id, pet_id, owner_id, clinic_id, author_user_id, record_date) values
  ('e0000000-0000-4000-8000-000000000001', 'b0000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000001', 'c0000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000002', current_date)
on conflict (id) do nothing;

insert into public.vaccinations (id, pet_id, owner_id, clinic_id, vaccine_name, vaccination_date, next_due_date) values
  ('f0000000-0000-4000-8000-000000000001', 'b0000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000001', 'c0000000-0000-4000-8000-000000000001', 'QA Rabies', current_date, current_date)
on conflict (id) do nothing;
