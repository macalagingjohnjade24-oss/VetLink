-- ===========================================================================
-- 0008 — Clinic staff permissions (approved matrix)
--
-- Adds role-specific helpers and narrows clinic staff access:
--   * Veterinarians read only their assigned appointments and records.
--   * Only record authors may edit medical records; nobody deletes records
--     or vaccinations.
--   * Receptionists and administrators manage appointment status.
--   * Limited staff are read-only and use RPCs for name/species and due dates.
--   * Clinic administrators no longer read clinical records or attachments.
--   * Walk-in pet creation is deferred (no pet insert policy added).
--
-- Existing helpers is_clinic_staff() and is_clinic_admin() are unchanged.
-- ===========================================================================

-- ---------------------------------------------------------------------------
-- Step 1: role helpers
-- ---------------------------------------------------------------------------
create or replace function public.is_clinic_role(target_clinic uuid, roles text[])
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.clinic_memberships m
     where m.clinic_id = target_clinic
       and m.user_id = auth.uid()
       and m.status = 'active'
       and m.staff_role = any (roles)
  );
$$;

create or replace function public.is_clinic_receptionist(target_clinic uuid)
returns boolean language sql stable security definer set search_path = public
as $$ select public.is_clinic_role(target_clinic, array['receptionist']); $$;

create or replace function public.is_clinic_veterinarian(target_clinic uuid)
returns boolean language sql stable security definer set search_path = public
as $$ select public.is_clinic_role(target_clinic, array['veterinarian']); $$;

create or replace function public.is_clinic_limited_staff(target_clinic uuid)
returns boolean language sql stable security definer set search_path = public
as $$ select public.is_clinic_role(target_clinic, array['clinic_staff']); $$;

grant execute on function public.is_clinic_role(uuid, text[]) to authenticated;
grant execute on function public.is_clinic_receptionist(uuid) to authenticated;
grant execute on function public.is_clinic_veterinarian(uuid) to authenticated;
grant execute on function public.is_clinic_limited_staff(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Step 2: appointments
-- ---------------------------------------------------------------------------
alter table public.appointments
  add column if not exists assigned_vet_user_id uuid references auth.users (id) on delete set null;
create index if not exists appointments_assigned_vet_idx
  on public.appointments (assigned_vet_user_id);

drop policy if exists appointments_staff_read on public.appointments;
create policy appointments_staff_read on public.appointments
  for select to authenticated
  using (
    public.is_clinic_admin(clinic_id)
    or public.is_clinic_receptionist(clinic_id)
    or (public.is_clinic_veterinarian(clinic_id) and assigned_vet_user_id = auth.uid())
    or (public.is_clinic_limited_staff(clinic_id) and appointment_date = current_date)
  );

drop policy if exists appointments_staff_update on public.appointments;
create policy appointments_staff_update on public.appointments
  for update to authenticated
  using (
    public.is_clinic_admin(clinic_id)
    or public.is_clinic_receptionist(clinic_id)
    or (public.is_clinic_veterinarian(clinic_id) and assigned_vet_user_id = auth.uid())
  )
  with check (
    public.is_clinic_admin(clinic_id)
    or public.is_clinic_receptionist(clinic_id)
    or (public.is_clinic_veterinarian(clinic_id) and assigned_vet_user_id = auth.uid())
  );

-- Owners may only move their own appointment to 'cancelled' (enforced by trigger in Step 2b).
drop policy if exists appointments_owner_update on public.appointments;
create policy appointments_owner_update on public.appointments
  for update to authenticated
  using (owner_id = auth.uid())
  with check (owner_id = auth.uid());

-- Status transitions. Service-role and trigger-internal writes (auth.uid() is
-- null) are allowed so system writes are not blocked.
create or replace function public.enforce_appointment_status_transition()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  actor uuid := auth.uid();
  is_owner boolean;
  allowed boolean := false;
begin
  if new.status is not distinct from old.status then
    return new;
  end if;
  if actor is null then
    return new;
  end if;

  is_owner := (old.owner_id = actor);

  if old.status = 'pending' and new.status = 'confirmed' then
    allowed := public.is_clinic_admin(old.clinic_id) or public.is_clinic_receptionist(old.clinic_id);
  elsif old.status = 'pending' and new.status = 'rejected' then
    allowed := public.is_clinic_admin(old.clinic_id) or public.is_clinic_receptionist(old.clinic_id);
  elsif old.status = 'pending' and new.status = 'cancelled' then
    allowed := is_owner or public.is_clinic_admin(old.clinic_id) or public.is_clinic_receptionist(old.clinic_id);
  elsif old.status = 'confirmed' and new.status = 'rescheduled' then
    allowed := public.is_clinic_admin(old.clinic_id) or public.is_clinic_receptionist(old.clinic_id);
  elsif old.status = 'confirmed' and new.status = 'completed' then
    allowed := public.is_clinic_veterinarian(old.clinic_id) and old.assigned_vet_user_id = actor;
  elsif old.status = 'confirmed' and new.status = 'cancelled' then
    allowed := is_owner or public.is_clinic_admin(old.clinic_id) or public.is_clinic_receptionist(old.clinic_id);
  elsif old.status = 'rescheduled' and new.status = 'confirmed' then
    allowed := public.is_clinic_admin(old.clinic_id) or public.is_clinic_receptionist(old.clinic_id);
  elsif old.status = 'rescheduled' and new.status = 'cancelled' then
    allowed := is_owner or public.is_clinic_admin(old.clinic_id) or public.is_clinic_receptionist(old.clinic_id);
  end if;

  if not allowed then
    raise exception 'Status change from % to % is not permitted for this user', old.status, new.status
      using errcode = '42501';
  end if;
  return new;
end;
$$;

drop trigger if exists appointments_enforce_status_transition on public.appointments;
create trigger appointments_enforce_status_transition
  before update of status on public.appointments
  for each row execute function public.enforce_appointment_status_transition();

-- ---------------------------------------------------------------------------
-- Step 3: medical records (veterinarian authors only; no deletes)
-- ---------------------------------------------------------------------------
alter table public.medical_records
  add column if not exists author_user_id uuid references auth.users (id) on delete set null;

drop policy if exists medical_records_staff_read on public.medical_records;
create policy medical_records_staff_read on public.medical_records
  for select to authenticated
  using (clinic_id is not null and public.is_clinic_veterinarian(clinic_id));

drop policy if exists medical_records_staff_insert on public.medical_records;
create policy medical_records_staff_insert on public.medical_records
  for insert to authenticated
  with check (
    clinic_id is not null
    and public.is_clinic_veterinarian(clinic_id)
    and author_user_id = auth.uid()
  );

drop policy if exists medical_records_staff_update on public.medical_records;
create policy medical_records_staff_update on public.medical_records
  for update to authenticated
  using (clinic_id is not null and public.is_clinic_veterinarian(clinic_id) and author_user_id = auth.uid())
  with check (clinic_id is not null and public.is_clinic_veterinarian(clinic_id) and author_user_id = auth.uid());

drop policy if exists medical_records_staff_delete on public.medical_records;

-- ---------------------------------------------------------------------------
-- Step 4: vaccinations (veterinarian write; read for receptionist and vet; no deletes)
-- ---------------------------------------------------------------------------
drop policy if exists vaccinations_staff_read on public.vaccinations;
create policy vaccinations_staff_read on public.vaccinations
  for select to authenticated
  using (
    clinic_id is not null
    and (public.is_clinic_veterinarian(clinic_id) or public.is_clinic_receptionist(clinic_id))
  );

drop policy if exists vaccinations_staff_insert on public.vaccinations;
create policy vaccinations_staff_insert on public.vaccinations
  for insert to authenticated
  with check (clinic_id is not null and public.is_clinic_veterinarian(clinic_id));

drop policy if exists vaccinations_staff_update on public.vaccinations;
create policy vaccinations_staff_update on public.vaccinations
  for update to authenticated
  using (clinic_id is not null and public.is_clinic_veterinarian(clinic_id))
  with check (clinic_id is not null and public.is_clinic_veterinarian(clinic_id));

drop policy if exists vaccinations_staff_delete on public.vaccinations;

-- ---------------------------------------------------------------------------
-- Step 5: clinic attachments (veterinarian only; administrators lose read)
-- ---------------------------------------------------------------------------
drop policy if exists "Clinic staff manage their clinic attachments" on storage.objects;
create policy "Veterinarians manage clinic attachments" on storage.objects
  for all to authenticated
  using (
    bucket_id = 'medical-record-attachments'
    and public.is_clinic_veterinarian(public.safe_uuid((storage.foldername(name))[1]))
  )
  with check (
    bucket_id = 'medical-record-attachments'
    and public.is_clinic_veterinarian(public.safe_uuid((storage.foldername(name))[1]))
  );

-- ---------------------------------------------------------------------------
-- Step 6: limited-staff RPCs (read-only, minimal columns)
-- ---------------------------------------------------------------------------
create or replace function public.clinic_limited_pets(target_clinic uuid)
returns table (pet_id uuid, pet_name text, species text)
language sql
stable
security definer
set search_path = public
as $$
  select distinct p.id, p.pet_name, p.species
    from public.pets p
    join public.appointments a on a.owner_id = p.owner_id
   where a.clinic_id = target_clinic
     and public.is_clinic_limited_staff(target_clinic)
     and a.appointment_date = current_date;
$$;

create or replace function public.clinic_limited_due_vaccinations(target_clinic uuid)
returns table (vaccination_id uuid, pet_name text, vaccine_name text, next_due_date date)
language sql
stable
security definer
set search_path = public
as $$
  select v.id, p.pet_name, v.vaccine_name, v.next_due_date
    from public.vaccinations v
    join public.pets p on p.id = v.pet_id
   where v.clinic_id = target_clinic
     and public.is_clinic_limited_staff(target_clinic)
     and v.next_due_date is not null;
$$;

grant execute on function public.clinic_limited_pets(uuid) to authenticated;
grant execute on function public.clinic_limited_due_vaccinations(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Step 7: receptionist counts only (no clinical data)
-- ---------------------------------------------------------------------------
create or replace function public.clinic_receptionist_counts(target_clinic uuid)
returns table (pending_count bigint, confirmed_today_count bigint)
language sql
stable
security definer
set search_path = public
as $$
  select c.pending_count, c.confirmed_today_count
    from (
      select
        count(*) filter (where a.status = 'pending') as pending_count,
        count(*) filter (where a.status = 'confirmed' and a.appointment_date = current_date) as confirmed_today_count
        from public.appointments a
       where a.clinic_id = target_clinic
    ) c
   where public.is_clinic_receptionist(target_clinic);
$$;

grant execute on function public.clinic_receptionist_counts(uuid) to authenticated;
