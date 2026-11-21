-- Impersonates each QA user and reports visible row counts. Run inside a transaction.
create temp table qa_results (check_name text, actual text) on commit drop;
grant all on qa_results to authenticated;

create or replace function pg_temp.as_user(uid uuid) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', json_build_object('sub', uid, 'role', 'authenticated')::text, true);
  perform set_config('role', 'authenticated', true);
end $$;

create or replace function pg_temp.try_sql(label text, stmt text) returns void language plpgsql as $$
declare n int;
begin
  execute stmt;
  get diagnostics n = row_count;
  insert into qa_results values (label, 'rows=' || n);
exception when others then
  insert into qa_results values (label, 'error=' || sqlstate);
end $$;

create or replace function pg_temp.reset_user() returns void language plpgsql as $$
begin
  perform set_config('role', 'postgres', true);
  perform set_config('request.jwt.claims', '', true);
end $$;

select pg_temp.as_user('a0000000-0000-4000-8000-000000000002');
insert into qa_results select 'vet_sees_own_appointments', count(*)::text from public.appointments where clinic_id = 'c0000000-0000-4000-8000-000000000001';
select pg_temp.reset_user();

select pg_temp.as_user('a0000000-0000-4000-8000-000000000006');
insert into qa_results select 'vet2_sees_own_appointments', count(*)::text from public.appointments where clinic_id = 'c0000000-0000-4000-8000-000000000001';
select pg_temp.reset_user();

select pg_temp.as_user('a0000000-0000-4000-8000-000000000003');
insert into qa_results select 'receptionist_sees_vaccinations', count(*)::text from public.vaccinations where clinic_id = 'c0000000-0000-4000-8000-000000000001';
insert into qa_results select 'receptionist_sees_medical_records', count(*)::text from public.medical_records where clinic_id = 'c0000000-0000-4000-8000-000000000001';
select pg_temp.reset_user();

select pg_temp.as_user('a0000000-0000-4000-8000-000000000004');
insert into qa_results select 'limited_sees_appointments', count(*)::text from public.appointments where clinic_id = 'c0000000-0000-4000-8000-000000000001';
insert into qa_results select 'limited_sees_medical_records', count(*)::text from public.medical_records where clinic_id = 'c0000000-0000-4000-8000-000000000001';
select pg_temp.reset_user();

select pg_temp.as_user('a0000000-0000-4000-8000-000000000005');
insert into qa_results select 'admin_sees_appointments', count(*)::text from public.appointments where clinic_id = 'c0000000-0000-4000-8000-000000000001';
-- CA-01 embeds pets(pet_name); the join only works if pets_staff_read admits
-- this administrator for every patient of the clinic.
insert into qa_results select 'admin_joins_pet_names', count(p.pet_name)::text
  from public.appointments a join public.pets p on p.id = a.pet_id
 where a.clinic_id = 'c0000000-0000-4000-8000-000000000001';
insert into qa_results select 'admin_sees_medical_records', count(*)::text from public.medical_records where clinic_id = 'c0000000-0000-4000-8000-000000000001';
select pg_temp.reset_user();

-- A pending appointment for the administrator to confirm. Seeded after the read
-- counts above so they keep seeing only the two fixture rows.
insert into public.appointments (id, owner_id, clinic_id, pet_id, appointment_date, appointment_time, status)
values ('d0000000-0000-4000-8000-000000000003', 'a0000000-0000-4000-8000-000000000001', 'c0000000-0000-4000-8000-000000000001', 'b0000000-0000-4000-8000-000000000001', current_date, '11:00', 'pending');

select pg_temp.as_user('a0000000-0000-4000-8000-000000000005');
select pg_temp.try_sql('admin_confirms_pending', $q$update public.appointments set status='confirmed' where id='d0000000-0000-4000-8000-000000000003'$q$);
select pg_temp.reset_user();

select pg_temp.as_user('a0000000-0000-4000-8000-000000000002');
select pg_temp.try_sql('vet_completes_own_confirmed', $q$update public.appointments set status='completed' where id='d0000000-0000-4000-8000-000000000001'$q$);
select pg_temp.try_sql('vet_completes_others_appt', $q$update public.appointments set status='completed' where id='d0000000-0000-4000-8000-000000000002'$q$);
select pg_temp.try_sql('vet_confirms_pending', $q$update public.appointments set status='confirmed' where id='d0000000-0000-4000-8000-000000000001'$q$);
select pg_temp.reset_user();

select pg_temp.as_user('a0000000-0000-4000-8000-000000000003');
select pg_temp.try_sql('receptionist_reschedules', $q$update public.appointments set status='rescheduled' where id='d0000000-0000-4000-8000-000000000002'$q$);
select pg_temp.try_sql('receptionist_completes', $q$update public.appointments set status='completed' where id='d0000000-0000-4000-8000-000000000002'$q$);
select pg_temp.reset_user();

select pg_temp.as_user('a0000000-0000-4000-8000-000000000006');
select pg_temp.try_sql('vet2_edits_others_record', $q$update public.medical_records set diagnosis='x' where id='e0000000-0000-4000-8000-000000000001'$q$);
select pg_temp.try_sql('vet2_deletes_others_record', $q$delete from public.medical_records where id='e0000000-0000-4000-8000-000000000001'$q$);
select pg_temp.reset_user();

select pg_temp.as_user('a0000000-0000-4000-8000-000000000002');
select pg_temp.try_sql('author_edits_own_record', $q$update public.medical_records set diagnosis='x' where id='e0000000-0000-4000-8000-000000000001'$q$);
select pg_temp.try_sql('author_deletes_own_record', $q$delete from public.medical_records where id='e0000000-0000-4000-8000-000000000001'$q$);
select pg_temp.try_sql('author_deletes_own_vaccination', $q$delete from public.vaccinations where id='f0000000-0000-4000-8000-000000000001'$q$);
select pg_temp.reset_user();

select pg_temp.as_user('a0000000-0000-4000-8000-000000000004');
select pg_temp.try_sql('limited_updates_appt', $q$update public.appointments set appointment_time='11:30' where id='d0000000-0000-4000-8000-000000000001'$q$);
select pg_temp.try_sql('limited_inserts_vaccination', $q$insert into public.vaccinations (pet_id, owner_id, clinic_id, vaccine_name, vaccination_date) values ('b0000000-0000-4000-8000-000000000001','a0000000-0000-4000-8000-000000000001','c0000000-0000-4000-8000-000000000001','QA x',current_date)$q$);
select pg_temp.reset_user();

select pg_temp.as_user('a0000000-0000-4000-8000-000000000004');
select pg_temp.try_sql('limited_rpc_pets', $q$select * from public.clinic_limited_pets('c0000000-0000-4000-8000-000000000001')$q$);
select pg_temp.try_sql('limited_rpc_due_vax', $q$select * from public.clinic_limited_due_vaccinations('c0000000-0000-4000-8000-000000000001')$q$);
select pg_temp.try_sql('limited_rpc_counts_denied', $q$select * from public.clinic_receptionist_counts('c0000000-0000-4000-8000-000000000001')$q$);
select pg_temp.reset_user();

select pg_temp.as_user('a0000000-0000-4000-8000-000000000003');
select pg_temp.try_sql('receptionist_rpc_counts', $q$select * from public.clinic_receptionist_counts('c0000000-0000-4000-8000-000000000001')$q$);
select pg_temp.reset_user();

select pg_temp.as_user('a0000000-0000-4000-8000-000000000001');
select pg_temp.try_sql('owner_cancels_own_pending', $q$update public.appointments set status='cancelled' where id='d0000000-0000-4000-8000-000000000002'$q$);
select pg_temp.try_sql('owner_confirms_own', $q$update public.appointments set status='confirmed' where id='d0000000-0000-4000-8000-000000000001'$q$);
select pg_temp.reset_user();

select pg_temp.as_user('a0000000-0000-4000-8000-000000000002');
select pg_temp.try_sql('vet_storage_insert_attachment', $q$insert into storage.objects (bucket_id, name) values ('medical-record-attachments', 'c0000000-0000-4000-8000-000000000001/qa-vet.pdf')$q$);
select pg_temp.reset_user();

select pg_temp.as_user('a0000000-0000-4000-8000-000000000005');
select pg_temp.try_sql('admin_storage_insert_attachment', $q$insert into storage.objects (bucket_id, name) values ('medical-record-attachments', 'c0000000-0000-4000-8000-000000000001/qa-admin.pdf')$q$);
select pg_temp.reset_user();

-- Skip only the protect_objects_delete trigger; RLS still applies to the authenticated role.
do $$
begin
  set local session_replication_role = replica;
  if current_setting('session_replication_role') <> 'replica' then
    raise exception 'Trigger bypass not set: session_replication_role is %', current_setting('session_replication_role');
  end if;
end $$;
select pg_temp.as_user('a0000000-0000-4000-8000-000000000002');
insert into qa_results select 'vet_storage_read_attachment', count(*)::text from storage.objects where bucket_id='medical-record-attachments' and name like 'c0000000-0000-4000-8000-000000000001/%';
select pg_temp.try_sql('vet_storage_delete_attachment', $q$delete from storage.objects where bucket_id='medical-record-attachments' and name='c0000000-0000-4000-8000-000000000001/qa-vet.pdf'$q$);
select pg_temp.reset_user();

-- Another clinic's attachment, seeded inside the bypass window (rolled back with the transaction).
insert into storage.objects (bucket_id, name) values ('medical-record-attachments', 'c0000000-0000-4000-8000-000000000099/qa-other.pdf');
select pg_temp.as_user('a0000000-0000-4000-8000-000000000002');
select pg_temp.try_sql('vet_storage_delete_other_clinic', $q$delete from storage.objects where bucket_id='medical-record-attachments' and name='c0000000-0000-4000-8000-000000000099/qa-other.pdf'$q$);
select pg_temp.reset_user();

select pg_temp.as_user('a0000000-0000-4000-8000-000000000003');
select pg_temp.try_sql('receptionist_storage_delete_attachment', $q$delete from storage.objects where bucket_id='medical-record-attachments' and name='c0000000-0000-4000-8000-000000000001/qa-vet.pdf'$q$);
select pg_temp.reset_user();

do $$
begin
  set local session_replication_role = origin;
  if current_setting('session_replication_role') <> 'origin' then
    raise exception 'Trigger bypass not reset: session_replication_role is %', current_setting('session_replication_role');
  end if;
end $$;

select pg_temp.as_user('a0000000-0000-4000-8000-000000000005');
insert into qa_results select 'admin_storage_read_attachment', count(*)::text from storage.objects where bucket_id='medical-record-attachments' and name like 'c0000000-0000-4000-8000-000000000001/%';
select pg_temp.reset_user();

select pg_temp.as_user('a0000000-0000-4000-8000-000000000004');
insert into qa_results select 'rpc_columns_' || p.proname, pg_get_function_result(p.oid) from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname in ('clinic_limited_pets','clinic_limited_due_vaccinations','clinic_receptionist_counts');
select pg_temp.reset_user();

-- A suspended membership must grant nothing: every helper requires status 'active'.
update public.clinic_memberships set status = 'suspended'
 where clinic_id = 'c0000000-0000-4000-8000-000000000001' and user_id = 'a0000000-0000-4000-8000-000000000003';
select pg_temp.as_user('a0000000-0000-4000-8000-000000000003');
insert into qa_results select 'suspended_receptionist_sees_vaccinations', count(*)::text from public.vaccinations where clinic_id = 'c0000000-0000-4000-8000-000000000001';
select pg_temp.try_sql('suspended_receptionist_updates_appt', $q$update public.appointments set appointment_time='12:00' where id='d0000000-0000-4000-8000-000000000001'$q$);
select pg_temp.reset_user();
update public.clinic_memberships set status = 'active'
 where clinic_id = 'c0000000-0000-4000-8000-000000000001' and user_id = 'a0000000-0000-4000-8000-000000000003';

create temp table qa_expected (check_name text primary key, expected text) on commit drop;
insert into qa_expected values
  ('vet_sees_own_appointments','1'),('vet2_sees_own_appointments','1'),
  ('receptionist_sees_vaccinations','1'),('receptionist_sees_medical_records','0'),
  ('admin_sees_medical_records','0'),('limited_sees_appointments','2'),('limited_sees_medical_records','0'),
  ('author_edits_own_record','rows=1'),('vet2_edits_others_record','rows=0'),('vet2_deletes_others_record','rows=0'),
  ('author_deletes_own_record','rows=0'),('author_deletes_own_vaccination','rows=0'),
  ('limited_inserts_vaccination','error=42501'),('limited_updates_appt','rows=0'),
  ('limited_rpc_pets','rows=1'),('limited_rpc_due_vax','rows=1'),('limited_rpc_counts_denied','rows=0'),('receptionist_rpc_counts','rows=1'),
  ('vet_completes_own_confirmed','rows=1'),('vet_completes_others_appt','rows=0'),('vet_confirms_pending','error=42501'),
  ('receptionist_reschedules','rows=1'),('receptionist_completes','error=42501'),
  ('owner_cancels_own_pending','rows=1'),('owner_confirms_own','error=42501'),
  ('vet_storage_insert_attachment','rows=1'),('vet_storage_read_attachment','1'),
  ('vet_storage_delete_attachment','rows=1'),('vet_storage_delete_other_clinic','rows=0'),('receptionist_storage_delete_attachment','rows=0'),('admin_storage_insert_attachment','error=42501'),('admin_storage_read_attachment','0'),
  ('rpc_columns_clinic_limited_pets','TABLE(pet_id uuid, pet_name text, species text)'),
  ('rpc_columns_clinic_limited_due_vaccinations','TABLE(vaccination_id uuid, pet_name text, vaccine_name text, next_due_date date)'),
  ('rpc_columns_clinic_receptionist_counts','TABLE(pending_count bigint, confirmed_today_count bigint)'),
  ('admin_sees_appointments','2'),('admin_joins_pet_names','2'),('admin_confirms_pending','rows=1'),
  ('suspended_receptionist_sees_vaccinations','0'),('suspended_receptionist_updates_appt','rows=0');

do $$
declare mismatches text;
begin
  -- Expected checks that produced no result (missing).
  select string_agg(e.check_name, ', ') into mismatches
    from qa_expected e
   where not exists (select 1 from qa_results r where r.check_name = e.check_name);
  if mismatches is not null then
    raise exception 'RLS QA missing results: %', mismatches;
  end if;

  -- Results with no expected value (unexpected checks).
  select string_agg(r.check_name, ', ') into mismatches
    from qa_results r
   where not exists (select 1 from qa_expected e where e.check_name = r.check_name);
  if mismatches is not null then
    raise exception 'RLS QA unexpected results: %', mismatches;
  end if;

  -- Expected and actual values that differ.
  select string_agg(e.check_name || ' expected ' || e.expected || ' got ' || r.actual, '; ')
    into mismatches
    from qa_expected e join qa_results r using (check_name)
   where r.actual is distinct from e.expected;
  if mismatches is not null then
    raise exception 'RLS QA mismatches: %', mismatches;
  end if;
end $$;

select * from qa_results order by check_name;
