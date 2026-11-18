-- ===========================================================================
-- VetLink — 0002 row level security
-- Owners only ever see their own records; clinic staff only ever see records
-- belonging to clinics where they hold an active membership. Column grants
-- additionally stop owners from editing fields that belong to the clinic
-- (official medical/vaccination records, clinic details, roles).
-- ===========================================================================

-- ---------------------------------------------------------------------------
-- Helper functions (security definer so policy subqueries do not recurse)
-- ---------------------------------------------------------------------------
create or replace function public.is_clinic_staff(target_clinic uuid)
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
  );
$$;

create or replace function public.is_clinic_admin(target_clinic uuid)
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
       and m.staff_role = 'clinic_administrator'
  );
$$;

create or replace function public.is_staff_of_patient(patient uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
      from public.appointments a
      join public.clinic_memberships m on m.clinic_id = a.clinic_id
     where a.owner_id = patient
       and m.user_id = auth.uid()
       and m.status = 'active'
  );
$$;

create or replace function public.is_inquiry_owner(target_inquiry uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.inquiries i
     where i.id = target_inquiry and i.owner_id = auth.uid()
  );
$$;

create or replace function public.is_inquiry_clinic_staff(target_inquiry uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
      from public.inquiries i
      join public.clinic_memberships m on m.clinic_id = i.clinic_id
     where i.id = target_inquiry
       and m.user_id = auth.uid()
       and m.status = 'active'
  );
$$;

grant execute on function public.is_clinic_staff(uuid) to authenticated;
grant execute on function public.is_clinic_admin(uuid) to authenticated;
grant execute on function public.is_staff_of_patient(uuid) to authenticated;
grant execute on function public.is_inquiry_owner(uuid) to authenticated;
grant execute on function public.is_inquiry_clinic_staff(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Enable RLS everywhere
-- ---------------------------------------------------------------------------
alter table public.profiles enable row level security;
alter table public.clinics enable row level security;
alter table public.clinic_services enable row level security;
alter table public.pets enable row level security;
alter table public.appointments enable row level security;
alter table public.medical_records enable row level security;
alter table public.vaccinations enable row level security;
alter table public.notifications enable row level security;
alter table public.inquiries enable row level security;
alter table public.inquiry_messages enable row level security;
alter table public.clinic_memberships enable row level security;

-- ---------------------------------------------------------------------------
-- Profiles
-- ---------------------------------------------------------------------------
revoke all on public.profiles from anon, authenticated;
grant select on public.profiles to authenticated;
-- Owners may edit contact fields only. `role` is deliberately not grantable.
grant update (first_name, last_name, mobile_number, profile_picture, address) on public.profiles to authenticated;
grant insert (id, first_name, last_name, email, mobile_number, profile_picture, address) on public.profiles to authenticated;

drop policy if exists profiles_select_own on public.profiles;
create policy profiles_select_own on public.profiles
  for select to authenticated using (id = auth.uid());

drop policy if exists profiles_select_patients_staff on public.profiles;
create policy profiles_select_patients_staff on public.profiles
  for select to authenticated using (public.is_staff_of_patient(id));

drop policy if exists profiles_insert_self on public.profiles;
create policy profiles_insert_self on public.profiles
  for insert to authenticated with check (id = auth.uid());

drop policy if exists profiles_update_own on public.profiles;
create policy profiles_update_own on public.profiles
  for update to authenticated using (id = auth.uid()) with check (id = auth.uid());

-- ---------------------------------------------------------------------------
-- Clinics (public discovery reads approved rows only)
-- ---------------------------------------------------------------------------
revoke all on public.clinics from anon, authenticated;
grant select on public.clinics to anon, authenticated;
grant update (clinic_name, description, email, contact_number, address, area, city, province,
              latitude, longitude, logo_url, operating_hours, has_availability)
  on public.clinics to authenticated;

drop policy if exists clinics_public_read on public.clinics;
create policy clinics_public_read on public.clinics
  for select to anon, authenticated using (status = 'approved');

drop policy if exists clinics_staff_read on public.clinics;
create policy clinics_staff_read on public.clinics
  for select to authenticated using (public.is_clinic_staff(id));

drop policy if exists clinics_admin_update on public.clinics;
create policy clinics_admin_update on public.clinics
  for update to authenticated
  using (public.is_clinic_admin(id))
  with check (public.is_clinic_admin(id));

-- ---------------------------------------------------------------------------
-- Clinic services
-- ---------------------------------------------------------------------------
revoke all on public.clinic_services from anon, authenticated;
grant select on public.clinic_services to anon, authenticated;
grant insert, update, delete on public.clinic_services to authenticated;

drop policy if exists clinic_services_public_read on public.clinic_services;
create policy clinic_services_public_read on public.clinic_services
  for select to anon, authenticated
  using (
    exists (select 1 from public.clinics c where c.id = clinic_id and c.status = 'approved')
    or public.is_clinic_staff(clinic_id)
  );

drop policy if exists clinic_services_admin_write on public.clinic_services;
create policy clinic_services_admin_write on public.clinic_services
  for all to authenticated
  using (public.is_clinic_admin(clinic_id))
  with check (public.is_clinic_admin(clinic_id));

-- ---------------------------------------------------------------------------
-- Pets
-- ---------------------------------------------------------------------------
revoke all on public.pets from anon, authenticated;
grant select, insert, update, delete on public.pets to authenticated;

drop policy if exists pets_owner_all on public.pets;
create policy pets_owner_all on public.pets
  for all to authenticated
  using (owner_id = auth.uid())
  with check (owner_id = auth.uid());

drop policy if exists pets_staff_read on public.pets;
create policy pets_staff_read on public.pets
  for select to authenticated using (public.is_staff_of_patient(owner_id));

-- ---------------------------------------------------------------------------
-- Appointments
-- ---------------------------------------------------------------------------
revoke all on public.appointments from anon, authenticated;
grant select, insert on public.appointments to authenticated;
grant update (status, cancellation_reason, cancellation_requested, reschedule_requested,
              requested_date, requested_time, reschedule_reason, clinic_note,
              appointment_date, appointment_time)
  on public.appointments to authenticated;

drop policy if exists appointments_owner_read on public.appointments;
create policy appointments_owner_read on public.appointments
  for select to authenticated using (owner_id = auth.uid());

drop policy if exists appointments_staff_read on public.appointments;
create policy appointments_staff_read on public.appointments
  for select to authenticated using (public.is_clinic_staff(clinic_id));

drop policy if exists appointments_owner_insert on public.appointments;
create policy appointments_owner_insert on public.appointments
  for insert to authenticated
  with check (owner_id = auth.uid() and status = 'pending');

drop policy if exists appointments_owner_update on public.appointments;
create policy appointments_owner_update on public.appointments
  for update to authenticated
  using (owner_id = auth.uid())
  with check (owner_id = auth.uid());

drop policy if exists appointments_staff_update on public.appointments;
create policy appointments_staff_update on public.appointments
  for update to authenticated
  using (public.is_clinic_staff(clinic_id))
  with check (public.is_clinic_staff(clinic_id));

-- ---------------------------------------------------------------------------
-- Medical records — owners read, only clinic staff write
-- ---------------------------------------------------------------------------
revoke all on public.medical_records from anon, authenticated;
grant select, insert, update, delete on public.medical_records to authenticated;

drop policy if exists medical_records_owner_read on public.medical_records;
create policy medical_records_owner_read on public.medical_records
  for select to authenticated using (owner_id = auth.uid());

drop policy if exists medical_records_staff_read on public.medical_records;
create policy medical_records_staff_read on public.medical_records
  for select to authenticated
  using (clinic_id is not null and public.is_clinic_staff(clinic_id));

drop policy if exists medical_records_staff_insert on public.medical_records;
create policy medical_records_staff_insert on public.medical_records
  for insert to authenticated
  with check (clinic_id is not null and public.is_clinic_staff(clinic_id));

drop policy if exists medical_records_staff_update on public.medical_records;
create policy medical_records_staff_update on public.medical_records
  for update to authenticated
  using (clinic_id is not null and public.is_clinic_staff(clinic_id))
  with check (clinic_id is not null and public.is_clinic_staff(clinic_id));

drop policy if exists medical_records_staff_delete on public.medical_records;
create policy medical_records_staff_delete on public.medical_records
  for delete to authenticated
  using (clinic_id is not null and public.is_clinic_staff(clinic_id));

-- ---------------------------------------------------------------------------
-- Vaccinations — owners read, only clinic staff write
-- ---------------------------------------------------------------------------
revoke all on public.vaccinations from anon, authenticated;
grant select, insert, update, delete on public.vaccinations to authenticated;

drop policy if exists vaccinations_owner_read on public.vaccinations;
create policy vaccinations_owner_read on public.vaccinations
  for select to authenticated using (owner_id = auth.uid());

drop policy if exists vaccinations_staff_read on public.vaccinations;
create policy vaccinations_staff_read on public.vaccinations
  for select to authenticated
  using (clinic_id is not null and public.is_clinic_staff(clinic_id));

drop policy if exists vaccinations_staff_insert on public.vaccinations;
create policy vaccinations_staff_insert on public.vaccinations
  for insert to authenticated
  with check (clinic_id is not null and public.is_clinic_staff(clinic_id));

drop policy if exists vaccinations_staff_update on public.vaccinations;
create policy vaccinations_staff_update on public.vaccinations
  for update to authenticated
  using (clinic_id is not null and public.is_clinic_staff(clinic_id))
  with check (clinic_id is not null and public.is_clinic_staff(clinic_id));

drop policy if exists vaccinations_staff_delete on public.vaccinations;
create policy vaccinations_staff_delete on public.vaccinations
  for delete to authenticated
  using (clinic_id is not null and public.is_clinic_staff(clinic_id));

-- ---------------------------------------------------------------------------
-- Notifications — the owner reads and marks them read
-- ---------------------------------------------------------------------------
revoke all on public.notifications from anon, authenticated;
grant select on public.notifications to authenticated;
grant update (is_read) on public.notifications to authenticated;

drop policy if exists notifications_owner_read on public.notifications;
create policy notifications_owner_read on public.notifications
  for select to authenticated using (user_id = auth.uid());

drop policy if exists notifications_owner_update on public.notifications;
create policy notifications_owner_update on public.notifications
  for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- Inquiries and messages
-- ---------------------------------------------------------------------------
revoke all on public.inquiries from anon, authenticated;
grant select, insert on public.inquiries to authenticated;

drop policy if exists inquiries_owner_read on public.inquiries;
create policy inquiries_owner_read on public.inquiries
  for select to authenticated using (owner_id = auth.uid());

drop policy if exists inquiries_owner_insert on public.inquiries;
create policy inquiries_owner_insert on public.inquiries
  for insert to authenticated with check (owner_id = auth.uid());

drop policy if exists inquiries_staff_read on public.inquiries;
create policy inquiries_staff_read on public.inquiries
  for select to authenticated
  using (clinic_id is not null and public.is_clinic_staff(clinic_id));

revoke all on public.inquiry_messages from anon, authenticated;
grant select, insert on public.inquiry_messages to authenticated;

drop policy if exists inquiry_messages_owner_read on public.inquiry_messages;
create policy inquiry_messages_owner_read on public.inquiry_messages
  for select to authenticated using (public.is_inquiry_owner(inquiry_id));

drop policy if exists inquiry_messages_staff_read on public.inquiry_messages;
create policy inquiry_messages_staff_read on public.inquiry_messages
  for select to authenticated using (public.is_inquiry_clinic_staff(inquiry_id));

drop policy if exists inquiry_messages_owner_insert on public.inquiry_messages;
create policy inquiry_messages_owner_insert on public.inquiry_messages
  for insert to authenticated
  with check (
    public.is_inquiry_owner(inquiry_id)
    and sender_type = 'pet_owner'
    and sender_id = auth.uid()
  );

drop policy if exists inquiry_messages_staff_insert on public.inquiry_messages;
create policy inquiry_messages_staff_insert on public.inquiry_messages
  for insert to authenticated
  with check (
    public.is_inquiry_clinic_staff(inquiry_id)
    and sender_type = 'clinic_staff'
    and sender_id = auth.uid()
  );

-- ---------------------------------------------------------------------------
-- Clinic memberships — staff can only read their own memberships.
-- Management happens through the (future) clinic web app / service role.
-- ---------------------------------------------------------------------------
revoke all on public.clinic_memberships from anon, authenticated;
grant select on public.clinic_memberships to authenticated;

drop policy if exists clinic_memberships_read_own on public.clinic_memberships;
create policy clinic_memberships_read_own on public.clinic_memberships
  for select to authenticated using (user_id = auth.uid());
