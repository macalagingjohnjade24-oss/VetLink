-- ===========================================================================
-- VetLink — 0005 clinic documents and console uploads
-- Creates the private `clinic-documents` bucket used by REG-06 / SA-04, and
-- gives clinic staff the storage access the web console needs.
--
-- Path conventions (first segment matters to the policies):
--   clinic-documents/{uploaderUserId}/{file}      application documents
--   clinic-logos/{clinicId}/{file}                clinic admin logo
--   medical-record-attachments/{userId}/{file}    owner's own attachments
--   medical-record-attachments/{clinicId}/{file}  clinic uploads (Phase 6)
-- ===========================================================================

insert into storage.buckets (id, name, public)
values ('clinic-documents', 'clinic-documents', false)
on conflict (id) do nothing;

-- ---------------------------------------------------------------------------
-- Application documents: the uploader writes under their own user id, the
-- clinic's staff can read them once the clinic exists, system admins read all.
-- ---------------------------------------------------------------------------
drop policy if exists "Applicants upload their own clinic documents" on storage.objects;
create policy "Applicants upload their own clinic documents" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'clinic-documents'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "Applicants replace their own clinic documents" on storage.objects;
create policy "Applicants replace their own clinic documents" on storage.objects
  for update to authenticated
  using (
    bucket_id = 'clinic-documents'
    and (storage.foldername(name))[1] = auth.uid()::text
  )
  with check (
    bucket_id = 'clinic-documents'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "Applicants delete their own clinic documents" on storage.objects;
create policy "Applicants delete their own clinic documents" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'clinic-documents'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "Clinic documents are readable by their clinic" on storage.objects;
create policy "Clinic documents are readable by their clinic" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'clinic-documents'
    and (
      (storage.foldername(name))[1] = auth.uid()::text
      or public.is_system_admin()
      or exists (
        select 1 from public.clinic_documents d
         where d.storage_path = storage.objects.name
           and public.is_clinic_staff(d.clinic_id)
      )
    )
  );

-- ---------------------------------------------------------------------------
-- Clinic logos: previously read-only for the app. Clinic admins can now
-- upload their own logo (path starts with the clinic id).
-- ---------------------------------------------------------------------------
drop policy if exists "Clinic admins manage their logo" on storage.objects;
create policy "Clinic admins manage their logo" on storage.objects
  for all to authenticated
  using (
    bucket_id = 'clinic-logos'
    and public.is_clinic_admin(public.safe_uuid((storage.foldername(name))[1]))
  )
  with check (
    bucket_id = 'clinic-logos'
    and public.is_clinic_admin(public.safe_uuid((storage.foldername(name))[1]))
  );

-- ---------------------------------------------------------------------------
-- Medical record attachments: clinic staff write into their clinic's folder.
-- The owner policies from 0003 stay untouched (owner folders are user ids, so
-- safe_uuid() + is_clinic_staff() is false for them).
-- ---------------------------------------------------------------------------
drop policy if exists "Clinic staff manage their clinic attachments" on storage.objects;
create policy "Clinic staff manage their clinic attachments" on storage.objects
  for all to authenticated
  using (
    bucket_id = 'medical-record-attachments'
    and public.is_clinic_staff(public.safe_uuid((storage.foldername(name))[1]))
  )
  with check (
    bucket_id = 'medical-record-attachments'
    and public.is_clinic_staff(public.safe_uuid((storage.foldername(name))[1]))
  );
