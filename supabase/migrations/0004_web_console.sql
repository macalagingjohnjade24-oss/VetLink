-- ===========================================================================
-- VetLink — 0004 web console foundation
-- Adds what the clinic-staff and system-administrator web console needs on top
-- of 0001–0003, without changing anything the pet-owner app already uses:
--
--   * a system_administrator identity the RLS helpers can recognise
--   * `clinic_staff` as a profile role (the membership table already had it)
--   * review / registration columns on clinics, service categories, the
--     assigned veterinarian and vitals the web screens display
--   * clinic_tasks (CS-02) and platform_audit_log (SA-13)
--   * clinic-scoped and platform-wide policies, plus the RPCs the console calls
--
-- Apply after 0003_storage.sql. Every statement is repeatable.
-- ===========================================================================

-- ---------------------------------------------------------------------------
-- Identity helpers
-- ---------------------------------------------------------------------------
create or replace function public.is_system_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles p
     where p.id = auth.uid()
       and p.role = 'system_administrator'
  );
$$;

/** Same-clinic colleague check (used for the staff directory in profiles). */
create or replace function public.is_clinic_colleague(target_user uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
      from public.clinic_memberships mine
      join public.clinic_memberships theirs on theirs.clinic_id = mine.clinic_id
     where mine.user_id = auth.uid()
       and mine.status = 'active'
       and theirs.user_id = target_user
  );
$$;

/** `value::uuid` without raising on a malformed storage path segment. */
create or replace function public.safe_uuid(value text)
returns uuid
language plpgsql
immutable
as $$
begin
  return value::uuid;
exception
  when others then
    return null;
end;
$$;

grant execute on function public.is_system_admin() to authenticated;
grant execute on function public.is_clinic_colleague(uuid) to authenticated;
grant execute on function public.safe_uuid(text) to authenticated;

-- ---------------------------------------------------------------------------
-- Profiles: allow the clinic_staff role the membership table already uses
-- ---------------------------------------------------------------------------
alter table public.profiles drop constraint if exists profiles_role_check;
alter table public.profiles add constraint profiles_role_check
  check (role in (
    'pet_owner',
    'veterinarian',
    'clinic_administrator',
    'receptionist',
    'clinic_staff',
    'system_administrator'
  ));

-- ---------------------------------------------------------------------------
-- Clinics: registration reference and review workflow
-- ---------------------------------------------------------------------------
alter table public.clinics
  add column if not exists reference text,
  add column if not exists website text,
  add column if not exists cover_url text,
  add column if not exists year_established integer
    check (year_established is null or year_established between 1850 and 2100),
  add column if not exists emergency_service boolean not null default false,
  add column if not exists review_notes text,
  add column if not exists reviewed_at timestamptz,
  add column if not exists reviewed_by uuid references auth.users (id) on delete set null,
  add column if not exists submitted_at timestamptz;

create unique index if not exists clinics_reference_key
  on public.clinics (reference) where reference is not null;

create or replace function public.set_clinic_reference()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.reference is null or length(btrim(new.reference)) = 0 then
    new.reference := 'VLC-' || lpad((select count(*) + 1 from public.clinics)::text, 5, '0');
  end if;
  return new;
end;
$$;

drop trigger if exists clinics_set_reference on public.clinics;
create trigger clinics_set_reference
  before insert on public.clinics
  for each row execute function public.set_clinic_reference();

-- Give clinics that predate this migration a reference too (only when none
-- exist yet, so a re-run can never renumber live clinics).
do $$
begin
  if not exists (select 1 from public.clinics where reference is not null) then
    with numbered as (
      select id, row_number() over (order by created_at) as rn from public.clinics
    )
    update public.clinics c
       set reference = 'VLC-' || lpad(numbered.rn::text, 5, '0')
      from numbered
     where c.id = numbered.id;
  end if;
end;
$$;

-- ---------------------------------------------------------------------------
-- Clinic services: the console groups services by category (CA-04 / CA-05)
-- ---------------------------------------------------------------------------
alter table public.clinic_services add column if not exists category text;

-- ---------------------------------------------------------------------------
-- Appointments: assigned veterinarian and front-desk check-in
-- ---------------------------------------------------------------------------
alter table public.appointments
  add column if not exists veterinarian_id uuid references auth.users (id) on delete set null,
  add column if not exists checked_in_at timestamptz;

create index if not exists appointments_vet_idx
  on public.appointments (veterinarian_id, appointment_date);

-- ---------------------------------------------------------------------------
-- Medical records: link the consultation to its appointment (VET-04 / VET-05)
-- ---------------------------------------------------------------------------
alter table public.medical_records
  add column if not exists appointment_id uuid references public.appointments (id) on delete set null,
  add column if not exists observations text,
  add column if not exists vitals jsonb,
  add column if not exists follow_up_date date;

create index if not exists medical_records_appointment_idx on public.medical_records (appointment_id);

-- ---------------------------------------------------------------------------
-- Vaccinations: dose and batch shown on VET-09 / VET-10
-- ---------------------------------------------------------------------------
alter table public.vaccinations
  add column if not exists dosage text,
  add column if not exists batch_number text;

-- ---------------------------------------------------------------------------
-- Clinic tasks (CS-01 / CS-02). Nothing in the mobile app reads this table.
-- ---------------------------------------------------------------------------
create table if not exists public.clinic_tasks (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references public.clinics (id) on delete cascade,
  title text not null,
  description text,
  priority text not null default 'normal'
    check (priority in ('low', 'normal', 'high', 'urgent')),
  status text not null default 'pending'
    check (status in ('pending', 'in_progress', 'completed', 'cancelled')),
  assigned_to uuid references auth.users (id) on delete set null,
  created_by uuid references auth.users (id) on delete set null,
  due_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists clinic_tasks_clinic_idx on public.clinic_tasks (clinic_id, status, due_at);
create index if not exists clinic_tasks_assignee_idx on public.clinic_tasks (assigned_to, status);

drop trigger if exists clinic_tasks_set_updated_at on public.clinic_tasks;
create trigger clinic_tasks_set_updated_at
  before update on public.clinic_tasks
  for each row execute function public.set_updated_at();

alter table public.clinic_tasks enable row level security;
revoke all on public.clinic_tasks from anon, authenticated;
grant select, insert, delete on public.clinic_tasks to authenticated;
grant update (title, description, priority, status, assigned_to, due_at, completed_at)
  on public.clinic_tasks to authenticated;

drop policy if exists clinic_tasks_staff_read on public.clinic_tasks;
create policy clinic_tasks_staff_read on public.clinic_tasks
  for select to authenticated using (public.is_clinic_staff(clinic_id));

drop policy if exists clinic_tasks_admin_all on public.clinic_tasks;
create policy clinic_tasks_admin_all on public.clinic_tasks
  for all to authenticated
  using (public.is_clinic_admin(clinic_id))
  with check (public.is_clinic_admin(clinic_id));

drop policy if exists clinic_tasks_assignee_update on public.clinic_tasks;
create policy clinic_tasks_assignee_update on public.clinic_tasks
  for update to authenticated
  using (assigned_to = auth.uid() and public.is_clinic_staff(clinic_id))
  with check (assigned_to = auth.uid() and public.is_clinic_staff(clinic_id));

-- ---------------------------------------------------------------------------
-- Platform audit log (SA-13). Written only through write_audit_log().
-- ---------------------------------------------------------------------------
create table if not exists public.platform_audit_log (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references auth.users (id) on delete set null,
  actor_name text,
  actor_role text,
  action text not null,
  entity_type text,
  entity_id text,
  clinic_id uuid references public.clinics (id) on delete set null,
  details jsonb,
  created_at timestamptz not null default now()
);

create index if not exists platform_audit_log_created_idx on public.platform_audit_log (created_at desc);
create index if not exists platform_audit_log_clinic_idx on public.platform_audit_log (clinic_id, created_at desc);

alter table public.platform_audit_log enable row level security;
revoke all on public.platform_audit_log from anon, authenticated;
grant select on public.platform_audit_log to authenticated;

drop policy if exists platform_audit_log_admin_read on public.platform_audit_log;
create policy platform_audit_log_admin_read on public.platform_audit_log
  for select to authenticated using (public.is_system_admin());

/**
 * Records one privileged action. The actor is always the caller, never a
 * client-supplied id; details are free-form and never trusted for access.
 */
create or replace function public.write_audit_log(
  p_action text,
  p_entity_type text default null,
  p_entity_id text default null,
  p_clinic_id uuid default null,
  p_details jsonb default '{}'::jsonb
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  actor uuid := auth.uid();
  actor_profile public.profiles;
begin
  if actor is null then
    return;
  end if;

  select * into actor_profile from public.profiles p where p.id = actor;

  insert into public.platform_audit_log
    (actor_id, actor_name, actor_role, action, entity_type, entity_id, clinic_id, details)
  values (
    actor,
    nullif(btrim(coalesce(actor_profile.first_name, '') || ' ' || coalesce(actor_profile.last_name, '')), ''),
    actor_profile.role,
    p_action,
    p_entity_type,
    p_entity_id,
    p_clinic_id,
    coalesce(p_details, '{}'::jsonb)
  );
end;
$$;

revoke all on function public.write_audit_log(text, text, text, uuid, jsonb) from public, anon;
grant execute on function public.write_audit_log(text, text, text, uuid, jsonb) to authenticated;

-- ---------------------------------------------------------------------------
-- Notifications: clinic-scoped notifications for staff and announcements
-- ---------------------------------------------------------------------------
alter table public.notifications
  add column if not exists clinic_id uuid references public.clinics (id) on delete set null;

create index if not exists notifications_clinic_idx on public.notifications (clinic_id, created_at desc);

grant insert on public.notifications to authenticated;

drop policy if exists notifications_clinic_staff_insert on public.notifications;
create policy notifications_clinic_staff_insert on public.notifications
  for insert to authenticated
  with check (
    clinic_id is not null
    and public.is_clinic_staff(clinic_id)
    and exists (
      select 1 from public.clinic_memberships m
       where m.clinic_id = notifications.clinic_id
         and m.user_id = notifications.user_id
         and m.status in ('active', 'invited')
    )
  );

drop policy if exists notifications_system_admin_insert on public.notifications;
create policy notifications_system_admin_insert on public.notifications
  for insert to authenticated
  with check (
    public.is_system_admin()
    and clinic_id is null
    and user_id = auth.uid()
  );

-- ---------------------------------------------------------------------------
-- Profiles: system administrators and same-clinic colleagues can be listed
-- ---------------------------------------------------------------------------
drop policy if exists profiles_select_system_admin on public.profiles;
create policy profiles_select_system_admin on public.profiles
  for select to authenticated using (public.is_system_admin());

drop policy if exists profiles_select_colleagues on public.profiles;
create policy profiles_select_colleagues on public.profiles
  for select to authenticated using (public.is_clinic_colleague(id));

-- Staff may edit their own contact details only (already granted in 0002).
-- System administrators never receive write access to other people's profiles
-- from the browser: role changes go through the Edge Functions.

-- ---------------------------------------------------------------------------
-- Clinics: platform-wide read, review and status management for system admins
-- ---------------------------------------------------------------------------
grant update (status, review_notes, reviewed_at, reviewed_by, website, cover_url,
              year_established, emergency_service)
  on public.clinics to authenticated;

drop policy if exists clinics_system_admin_read on public.clinics;
create policy clinics_system_admin_read on public.clinics
  for select to authenticated using (public.is_system_admin());

drop policy if exists clinics_system_admin_update on public.clinics;
create policy clinics_system_admin_update on public.clinics
  for update to authenticated
  using (public.is_system_admin())
  with check (public.is_system_admin());

-- ---------------------------------------------------------------------------
-- Clinic services: system admins read every clinic's catalogue (SA-04/SA-07)
-- ---------------------------------------------------------------------------
drop policy if exists clinic_services_system_admin_read on public.clinic_services;
create policy clinic_services_system_admin_read on public.clinic_services
  for select to authenticated using (public.is_system_admin());

-- ---------------------------------------------------------------------------
-- Appointments: system admins assign nothing; clinics keep their own records.
-- The column grant lets clinic staff set the veterinarian and check-in time.
-- ---------------------------------------------------------------------------
grant update (veterinarian_id, checked_in_at) on public.appointments to authenticated;

-- ---------------------------------------------------------------------------
-- Clinic memberships: clinic admins manage their own staff list
-- ---------------------------------------------------------------------------
revoke all on public.clinic_memberships from anon, authenticated;
grant select on public.clinic_memberships to authenticated;
grant insert (clinic_id, user_id, staff_role, status) on public.clinic_memberships to authenticated;
grant update (staff_role, status) on public.clinic_memberships to authenticated;
grant delete on public.clinic_memberships to authenticated;

drop policy if exists clinic_memberships_clinic_read on public.clinic_memberships;
create policy clinic_memberships_clinic_read on public.clinic_memberships
  for select to authenticated using (public.is_clinic_staff(clinic_id));

drop policy if exists clinic_memberships_system_admin_read on public.clinic_memberships;
create policy clinic_memberships_system_admin_read on public.clinic_memberships
  for select to authenticated using (public.is_system_admin());

drop policy if exists clinic_memberships_admin_all on public.clinic_memberships;
create policy clinic_memberships_admin_all on public.clinic_memberships
  for all to authenticated
  using (public.is_clinic_admin(clinic_id))
  with check (public.is_clinic_admin(clinic_id));

-- ---------------------------------------------------------------------------
-- Clinic documents (REG-06 / SA-04). Files live in the private
-- `clinic-documents` bucket; see 0005_clinic_documents.sql.
-- ---------------------------------------------------------------------------
create table if not exists public.clinic_documents (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references public.clinics (id) on delete cascade,
  name text not null,
  storage_path text not null,
  kind text,
  uploaded_by uuid references auth.users (id) on delete set null,
  uploaded_at timestamptz not null default now(),
  unique (clinic_id, storage_path)
);

create index if not exists clinic_documents_clinic_idx on public.clinic_documents (clinic_id);

alter table public.clinic_documents enable row level security;
revoke all on public.clinic_documents from anon, authenticated;
grant select, insert, delete on public.clinic_documents to authenticated;

drop policy if exists clinic_documents_staff_read on public.clinic_documents;
create policy clinic_documents_staff_read on public.clinic_documents
  for select to authenticated
  using (public.is_clinic_staff(clinic_id) or public.is_system_admin());

drop policy if exists clinic_documents_admin_write on public.clinic_documents;
create policy clinic_documents_admin_write on public.clinic_documents
  for all to authenticated
  using (public.is_clinic_admin(clinic_id) or public.is_system_admin())
  with check (public.is_clinic_admin(clinic_id) or public.is_system_admin());

-- ---------------------------------------------------------------------------
-- Public clinic registration
-- `clinics` has no INSERT grant, so an application is submitted through this
-- function. It creates a pending clinic, its services and documents, and an
-- *invited* clinic_administrator membership. The applicant keeps the
-- pet_owner role until a System Administrator provisions the account, so
-- registering never grants clinic access by itself.
-- ---------------------------------------------------------------------------
create or replace function public.submit_clinic_application(payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  applicant uuid := auth.uid();
  new_clinic uuid;
  service jsonb;
  document jsonb;
  new_reference text;
begin
  if applicant is null then
    raise exception 'Sign in before submitting a clinic application.';
  end if;

  if exists (
    select 1
      from public.clinic_memberships m
      join public.clinics c on c.id = m.clinic_id
     where m.user_id = applicant
       and c.status in ('pending', 'approved')
  ) then
    raise exception 'This account already has a pending or approved clinic application.';
  end if;

  if nullif(btrim(coalesce(payload ->> 'clinic_name', '')), '') is null then
    raise exception 'A clinic name is required.';
  end if;

  insert into public.clinics (
    clinic_name, description, email, contact_number, address, area, city, province,
    latitude, longitude, operating_hours, website, year_established, emergency_service,
    status, submitted_at
  ) values (
    btrim(payload ->> 'clinic_name'),
    payload ->> 'description',
    payload ->> 'email',
    payload ->> 'contact_number',
    payload ->> 'address',
    payload ->> 'area',
    payload ->> 'city',
    payload ->> 'province',
    (payload ->> 'latitude')::double precision,
    (payload ->> 'longitude')::double precision,
    payload -> 'operating_hours',
    payload ->> 'website',
    (payload ->> 'year_established')::integer,
    coalesce((payload ->> 'emergency_service')::boolean, false),
    'pending',
    now()
  )
  returning id, reference into new_clinic, new_reference;

  for service in select * from jsonb_array_elements(coalesce(payload -> 'services', '[]'::jsonb)) loop
    if nullif(btrim(coalesce(service ->> 'service_name', '')), '') is not null then
      insert into public.clinic_services
        (clinic_id, service_name, description, price, estimated_duration, availability, category)
      values (
        new_clinic,
        btrim(service ->> 'service_name'),
        service ->> 'description',
        coalesce((service ->> 'price')::numeric, 0),
        coalesce((service ->> 'estimated_duration')::integer, 30),
        coalesce(service ->> 'availability', 'available'),
        service ->> 'category'
      )
      on conflict do nothing;
    end if;
  end loop;

  for document in select * from jsonb_array_elements(coalesce(payload -> 'documents', '[]'::jsonb)) loop
    insert into public.clinic_documents (clinic_id, name, storage_path, kind, uploaded_by)
    values (
      new_clinic,
      coalesce(document ->> 'name', 'Document'),
      document ->> 'storage_path',
      document ->> 'kind',
      applicant
    )
    on conflict do nothing;
  end loop;

  insert into public.clinic_memberships (clinic_id, user_id, staff_role, status)
  values (new_clinic, applicant, 'clinic_administrator', 'invited')
  on conflict (clinic_id, user_id) do update set staff_role = 'clinic_administrator';

  perform public.write_audit_log(
    'clinic.application_submitted',
    'clinic',
    new_clinic::text,
    new_clinic,
    jsonb_build_object('reference', new_reference, 'clinic_name', payload ->> 'clinic_name')
  );

  return jsonb_build_object('clinic_id', new_clinic, 'reference', new_reference, 'status', 'pending');
end;
$$;

revoke all on function public.submit_clinic_application(jsonb) from public, anon;
grant execute on function public.submit_clinic_application(jsonb) to authenticated;

-- ---------------------------------------------------------------------------
-- System Administrator review actions
-- ---------------------------------------------------------------------------
create or replace function public.review_clinic_application(
  p_clinic uuid,
  p_decision text,
  p_notes text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  applicant uuid;
begin
  if not public.is_system_admin() then
    raise exception 'Only a System Administrator can review clinic applications.';
  end if;

  if p_decision not in ('pending', 'rejected') then
    raise exception 'Use provision-clinic-admin for approvals; review handles pending and rejected only.';
  end if;

  update public.clinics
     set status = p_decision,
         review_notes = p_notes,
         reviewed_at = now(),
         reviewed_by = auth.uid()
   where id = p_clinic;

  if not found then
    raise exception 'That clinic does not exist.';
  end if;

  perform public.write_audit_log(
    'clinic.' || p_decision,
    'clinic',
    p_clinic::text,
    p_clinic,
    jsonb_build_object('notes', p_notes)
  );

  if p_decision = 'rejected' then
    select m.user_id into applicant
      from public.clinic_memberships m
     where m.clinic_id = p_clinic
       and m.staff_role = 'clinic_administrator'
     limit 1;

    if applicant is not null then
      insert into public.notifications (user_id, title, message, notification_type, clinic_id)
      values (
        applicant,
        'Clinic application needs attention',
        coalesce(p_notes, 'Your VetLink clinic application was not approved. Review the remarks and contact support.'),
        'account',
        p_clinic
      );
    end if;
  end if;

  return jsonb_build_object('clinic_id', p_clinic, 'status', p_decision);
end;
$$;

revoke all on function public.review_clinic_application(uuid, text, text) from public, anon;
grant execute on function public.review_clinic_application(uuid, text, text) to authenticated;

create or replace function public.set_clinic_status(p_clinic uuid, p_action text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  next_status text;
begin
  if not public.is_system_admin() then
    raise exception 'Only a System Administrator can change a clinic account status.';
  end if;

  next_status := case p_action
    when 'suspend' then 'suspended'
    when 'reactivate' then 'approved'
    when 'deactivate' then 'inactive'
    else null
  end;

  if next_status is null then
    raise exception 'Unknown clinic action: %', p_action;
  end if;

  update public.clinics set status = next_status where id = p_clinic;
  if not found then
    raise exception 'That clinic does not exist.';
  end if;

  perform public.write_audit_log(
    'clinic.' || p_action,
    'clinic',
    p_clinic::text,
    p_clinic,
    jsonb_build_object('status', next_status)
  );

  return jsonb_build_object('clinic_id', p_clinic, 'status', next_status);
end;
$$;

revoke all on function public.set_clinic_status(uuid, text) from public, anon;
grant execute on function public.set_clinic_status(uuid, text) to authenticated;

-- ---------------------------------------------------------------------------
-- Accepting a staff invitation (called by AUTH-05 after the password is set)
-- ---------------------------------------------------------------------------
create or replace function public.accept_staff_invitation()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  activated integer;
begin
  if auth.uid() is null then
    raise exception 'Sign in first.';
  end if;

  update public.clinic_memberships
     set status = 'active'
   where user_id = auth.uid()
     and status = 'invited';

  get diagnostics activated = row_count;

  perform public.write_audit_log('staff.invitation_accepted', 'profile', auth.uid()::text, null, '{}'::jsonb);

  return jsonb_build_object('activated', activated);
end;
$$;

revoke all on function public.accept_staff_invitation() from public, anon;
grant execute on function public.accept_staff_invitation() to authenticated;

-- ---------------------------------------------------------------------------
-- Dashboard aggregates
-- Counts only: a System Administrator gets platform statistics without
-- reading any clinic's patients or clinical records.
-- ---------------------------------------------------------------------------
create or replace function public.clinic_dashboard(target_clinic uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  result jsonb;
begin
  if not (public.is_clinic_staff(target_clinic) or public.is_system_admin()) then
    raise exception 'You do not have access to this clinic.';
  end if;

  select jsonb_build_object(
    'clinic_id', target_clinic,
    'appointments_total', (select count(*) from public.appointments a where a.clinic_id = target_clinic),
    'appointments_pending', (select count(*) from public.appointments a where a.clinic_id = target_clinic and a.status = 'pending'),
    'appointments_confirmed', (select count(*) from public.appointments a where a.clinic_id = target_clinic and a.status = 'confirmed'),
    'appointments_completed', (select count(*) from public.appointments a where a.clinic_id = target_clinic and a.status = 'completed'),
    'appointments_cancelled', (select count(*) from public.appointments a where a.clinic_id = target_clinic and a.status in ('cancelled', 'rejected')),
    'appointments_today', (select count(*) from public.appointments a where a.clinic_id = target_clinic and a.appointment_date = current_date),
    'requests_pending', (select count(*) from public.appointments a where a.clinic_id = target_clinic and (a.cancellation_requested or a.reschedule_requested)),
    'owners_registered', (
      select count(distinct a.owner_id) from public.appointments a where a.clinic_id = target_clinic
    ),
    'pets_registered', (
      select count(distinct a.pet_id) from public.appointments a where a.clinic_id = target_clinic
    ),
    'services_active', (
      select count(*) from public.clinic_services s where s.clinic_id = target_clinic and s.availability = 'available'
    ),
    'services_total', (select count(*) from public.clinic_services s where s.clinic_id = target_clinic),
    'staff_active', (
      select count(*) from public.clinic_memberships m where m.clinic_id = target_clinic and m.status = 'active'
    ),
    'appointment_trend', coalesce((
      select jsonb_agg(jsonb_build_object('label', to_char(bucket.month, 'Mon'), 'value', bucket.total) order by bucket.month)
        from (
          select date_trunc('month', now()) - (offset_months || ' months')::interval as month,
                 (
                   select count(*)
                     from public.appointments a
                    where a.clinic_id = target_clinic
                      and date_trunc('month', a.appointment_date) = date_trunc('month', now()) - (offset_months || ' months')::interval
                 ) as total
            from generate_series(5, 0, -1) as offset_months
        ) bucket
    ), '[]'::jsonb)
  ) into result;

  return result;
end;
$$;

revoke all on function public.clinic_dashboard(uuid) from public, anon;
grant execute on function public.clinic_dashboard(uuid) to authenticated;

create or replace function public.platform_dashboard()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  result jsonb;
begin
  if not public.is_system_admin() then
    raise exception 'Only a System Administrator can read platform statistics.';
  end if;

  select jsonb_build_object(
    'clinics_total', (select count(*) from public.clinics),
    'clinics_approved', (select count(*) from public.clinics c where c.status = 'approved'),
    'clinics_pending', (select count(*) from public.clinics c where c.status = 'pending'),
    'clinics_suspended', (select count(*) from public.clinics c where c.status = 'suspended'),
    'clinics_inactive', (select count(*) from public.clinics c where c.status = 'inactive'),
    'clinics_rejected', (select count(*) from public.clinics c where c.status = 'rejected'),
    'users_total', (select count(*) from public.profiles),
    'owners_total', (select count(*) from public.profiles p where p.role = 'pet_owner'),
    'staff_total', (select count(*) from public.profiles p where p.role <> 'pet_owner'),
    'admins_total', (select count(*) from public.profiles p where p.role = 'system_administrator'),
    'appointments_total', (select count(*) from public.appointments),
    'appointments_today', (select count(*) from public.appointments a where a.appointment_date = current_date),
    'applications_pending', (
      select count(*) from public.clinics c
       where c.status = 'pending' and c.submitted_at is not null
    ),
    'registration_trend', coalesce((
      select jsonb_agg(jsonb_build_object('label', to_char(bucket.month, 'Mon'), 'value', bucket.total) order by bucket.month)
        from (
          select date_trunc('month', now()) - (offset_months || ' months')::interval as month,
                 (
                   select count(*)
                     from public.clinics c
                    where c.status = 'approved'
                      and date_trunc('month', c.created_at) = date_trunc('month', now()) - (offset_months || ' months')::interval
                 ) as total
            from generate_series(5, 0, -1) as offset_months
        ) bucket
    ), '[]'::jsonb)
  ) into result;

  return result;
end;
$$;

revoke all on function public.platform_dashboard() from public, anon;
grant execute on function public.platform_dashboard() to authenticated;
