-- ===========================================================================
-- VetLink — 0003 storage buckets and policies
--
-- Bucket layout (the first path segment is always the owner's user id):
--   profile-photos/{userId}/avatar-<timestamp>.jpg        (public read)
--   pet-photos/{userId}/{petId}/<file>.jpg                (public read)
--   clinic-logos/{clinicId}/<file>.png                    (public read)
--   medical-record-attachments/{userId}/<file>.pdf        (private, signed URLs)
-- ===========================================================================

insert into storage.buckets (id, name, public)
values
  ('profile-photos', 'profile-photos', true),
  ('pet-photos', 'pet-photos', true),
  ('clinic-logos', 'clinic-logos', true),
  ('medical-record-attachments', 'medical-record-attachments', false)
on conflict (id) do nothing;

-- ---------------------------------------------------------------------------
-- Profile photos: anyone can view an avatar, only the owner can change it.
-- ---------------------------------------------------------------------------
drop policy if exists "Profile photos are readable" on storage.objects;
create policy "Profile photos are readable" on storage.objects
  for select using (bucket_id = 'profile-photos');

drop policy if exists "Owners manage their profile photos" on storage.objects;
create policy "Owners manage their profile photos" on storage.objects
  for all to authenticated
  using (bucket_id = 'profile-photos' and (storage.foldername(name))[1] = auth.uid()::text)
  with check (bucket_id = 'profile-photos' and (storage.foldername(name))[1] = auth.uid()::text);

-- ---------------------------------------------------------------------------
-- Pet photos: public read (they appear on the owner's pet cards), owner writes.
-- ---------------------------------------------------------------------------
drop policy if exists "Pet photos are readable" on storage.objects;
create policy "Pet photos are readable" on storage.objects
  for select using (bucket_id = 'pet-photos');

drop policy if exists "Owners manage their pet photos" on storage.objects;
create policy "Owners manage their pet photos" on storage.objects
  for all to authenticated
  using (bucket_id = 'pet-photos' and (storage.foldername(name))[1] = auth.uid()::text)
  with check (bucket_id = 'pet-photos' and (storage.foldername(name))[1] = auth.uid()::text);

-- ---------------------------------------------------------------------------
-- Clinic logos: public read. Uploads are handled by clinic administrators
-- through the future clinic interface (service role), not the mobile app.
-- ---------------------------------------------------------------------------
drop policy if exists "Clinic logos are readable" on storage.objects;
create policy "Clinic logos are readable" on storage.objects
  for select using (bucket_id = 'clinic-logos');

-- ---------------------------------------------------------------------------
-- Medical record attachments: private bucket. Owners read files under their
-- own folder; the clinic uploads them with the service role.
-- ---------------------------------------------------------------------------
drop policy if exists "Owners read their medical attachments" on storage.objects;
create policy "Owners read their medical attachments" on storage.objects
  for select to authenticated
  using (bucket_id = 'medical-record-attachments' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "Owners manage their medical attachments" on storage.objects;
create policy "Owners manage their medical attachments" on storage.objects
  for all to authenticated
  using (bucket_id = 'medical-record-attachments' and (storage.foldername(name))[1] = auth.uid()::text)
  with check (bucket_id = 'medical-record-attachments' and (storage.foldername(name))[1] = auth.uid()::text);
