-- ===========================================================================
-- VetLink — 0006 platform administration
-- The two things the System Administrator console needs beyond 0004:
--
--   * platform_settings (SA-15) — one row of real, editable platform policy
--     instead of a settings screen with decorative switches
--   * send_platform_announcement() (SA-14) — a System Administrator can only
--     insert a notification for themselves under RLS, so a platform-wide
--     announcement has to be a security-definer RPC
--
-- It also re-declares review_clinic_application() so "request additional
-- information" notifies the applicant, not only a rejection.
--
-- Apply after 0005. Every statement is repeatable.
-- ===========================================================================

-- ---------------------------------------------------------------------------
-- Platform settings (SA-15). A single row, keyed by the boolean `id`.
-- ---------------------------------------------------------------------------
create table if not exists public.platform_settings (
  id boolean primary key default true check (id),
  platform_name text not null default 'VetLink',
  support_email text,
  support_phone text,
  timezone text not null default 'Asia/Manila',
  appointment_lead_hours integer not null default 2
    check (appointment_lead_hours between 0 and 168),
  auto_approve_clinics boolean not null default false,
  maintenance_mode boolean not null default false,
  maintenance_message text,
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users (id) on delete set null
);

insert into public.platform_settings (id) values (true)
on conflict (id) do nothing;

drop trigger if exists platform_settings_set_updated_at on public.platform_settings;
create trigger platform_settings_set_updated_at
  before update on public.platform_settings
  for each row execute function public.set_updated_at();

alter table public.platform_settings enable row level security;
revoke all on public.platform_settings from anon, authenticated;
grant select on public.platform_settings to authenticated;
grant update (platform_name, support_email, support_phone, timezone,
              appointment_lead_hours, auto_approve_clinics, maintenance_mode,
              maintenance_message, updated_by)
  on public.platform_settings to authenticated;

drop policy if exists platform_settings_admin_read on public.platform_settings;
create policy platform_settings_admin_read on public.platform_settings
  for select to authenticated using (public.is_system_admin());

drop policy if exists platform_settings_admin_update on public.platform_settings;
create policy platform_settings_admin_update on public.platform_settings
  for update to authenticated
  using (public.is_system_admin())
  with check (public.is_system_admin());

-- ---------------------------------------------------------------------------
-- Platform announcements (SA-14)
-- ---------------------------------------------------------------------------
create or replace function public.send_platform_announcement(
  p_title text,
  p_message text,
  p_audience text default 'all'
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  recipients integer;
begin
  if not public.is_system_admin() then
    raise exception 'Only a System Administrator can send platform announcements.';
  end if;

  if nullif(btrim(coalesce(p_title, '')), '') is null then
    raise exception 'An announcement needs a title.';
  end if;

  if nullif(btrim(coalesce(p_message, '')), '') is null then
    raise exception 'An announcement needs a message.';
  end if;

  if p_audience not in ('all', 'clinic_administrators', 'clinic_staff', 'pet_owners') then
    raise exception 'Unknown announcement audience: %', p_audience;
  end if;

  insert into public.notifications (user_id, title, message, notification_type)
  select p.id, btrim(p_title), btrim(p_message), 'general'
    from public.profiles p
   where p.id <> auth.uid()
     and case p_audience
           when 'clinic_administrators' then p.role = 'clinic_administrator'
           when 'clinic_staff' then p.role in ('veterinarian', 'receptionist', 'clinic_staff')
           when 'pet_owners' then p.role = 'pet_owner'
           else true
         end;

  get diagnostics recipients = row_count;

  perform public.write_audit_log(
    'platform.announcement_sent',
    'platform',
    null,
    null,
    jsonb_build_object(
      'title', btrim(p_title),
      'message', btrim(p_message),
      'audience', p_audience,
      'recipients', recipients
    )
  );

  return jsonb_build_object('recipients', recipients);
end;
$$;

revoke all on function public.send_platform_announcement(text, text, text) from public, anon;
grant execute on function public.send_platform_announcement(text, text, text) to authenticated;

-- ---------------------------------------------------------------------------
-- Review actions: "request additional information" now reaches the applicant
-- as well. Signature and return shape are unchanged from 0004.
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

  if p_decision = 'pending' and nullif(btrim(coalesce(p_notes, '')), '') is null then
    raise exception 'Describe what additional information the clinic should provide.';
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

  select m.user_id into applicant
    from public.clinic_memberships m
   where m.clinic_id = p_clinic
     and m.staff_role = 'clinic_administrator'
   limit 1;

  if applicant is not null then
    insert into public.notifications (user_id, title, message, notification_type, clinic_id)
    values (
      applicant,
      case p_decision
        when 'rejected' then 'Clinic application needs attention'
        else 'More information needed for your clinic application'
      end,
      case p_decision
        when 'rejected' then coalesce(p_notes, 'Your VetLink clinic application was not approved. Review the remarks and contact support.')
        else coalesce(p_notes, 'A System Administrator needs more information before your clinic can be approved.')
      end,
      'account',
      p_clinic
    );
  end if;

  return jsonb_build_object('clinic_id', p_clinic, 'status', p_decision);
end;
$$;

revoke all on function public.review_clinic_application(uuid, text, text) from public, anon;
grant execute on function public.review_clinic_application(uuid, text, text) to authenticated;
