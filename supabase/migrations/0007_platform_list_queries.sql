-- ===========================================================================
-- VetLink — 0007 platform list queries
-- Two System-Administrator queries that the console cannot express with
-- PostgREST alone, because both need to join or aggregate across tables that
-- have no direct foreign key:
--
--   * platform_users_page() — SA-08's directory, filtered by role, account
--     state and free text (name, email or clinic), paged in Postgres
--   * clinic_team_counts()  — SA-06's active-team column, one row per clinic
--
-- Both are security definer (they are guarded by the same is_system_admin()
-- check the RLS policies use) and return summaries, so the browser never
-- downloads every profile or membership row.
--
-- Apply after 0006. Every statement is repeatable.
-- ===========================================================================

-- ---------------------------------------------------------------------------
-- SA-08: one page of platform accounts
-- ---------------------------------------------------------------------------
create or replace function public.platform_users_page(
  p_search text default null,
  p_role text default null,
  p_account text default 'all',
  p_page integer default 1,
  p_page_size integer default 12
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_term text;
  v_offset integer;
  v_total bigint;
  v_rows jsonb;
begin
  if not public.is_system_admin() then
    raise exception 'Only a System Administrator can list platform users.';
  end if;

  if coalesce(p_account, 'all') not in ('all', 'active', 'invited', 'none') then
    raise exception 'Unknown account filter: %', p_account;
  end if;

  if p_page_size is null or p_page_size < 1 or p_page_size > 100 then
    raise exception 'Page size must be between 1 and 100.';
  end if;

  v_offset := (greatest(coalesce(p_page, 1), 1) - 1) * p_page_size;
  v_term := case
              when p_search is null or btrim(p_search) = '' then null
              else '%' || btrim(p_search) || '%'
            end;

  with primary_membership as (
    -- The membership the console shows: the oldest one that is still live.
    select distinct on (m.user_id)
           m.user_id, m.clinic_id, m.status, m.staff_role
      from public.clinic_memberships m
     where m.status <> 'revoked'
     order by m.user_id, m.created_at
  ),
  joined as (
    select p.id, p.first_name, p.last_name, p.email, p.role, p.created_at,
           pm.status as membership_status,
           pm.staff_role as membership_role,
           c.id as clinic_id,
           c.clinic_name
      from public.profiles p
      left join primary_membership pm on pm.user_id = p.id
      left join public.clinics c on c.id = pm.clinic_id
  ),
  filtered as (
    select j.*
      from joined j
     where (p_role is null or p_role in ('', 'all') or j.role = p_role)
       and (
         coalesce(p_account, 'all') = 'all'
         or (p_account = 'active' and j.membership_status = 'active')
         or (p_account = 'invited' and j.membership_status = 'invited')
         or (p_account = 'none' and j.membership_status is null)
       )
       and (
         v_term is null
         or j.first_name ilike v_term
         or j.last_name ilike v_term
         or coalesce(j.email, '') ilike v_term
         or coalesce(j.clinic_name, '') ilike v_term
       )
  ),
  page as (
    select jsonb_build_object(
             'id', f.id,
             'first_name', f.first_name,
             'last_name', f.last_name,
             'email', f.email,
             'role', f.role,
             'created_at', f.created_at,
             'membership_status', f.membership_status,
             'membership_role', f.membership_role,
             'clinic_id', f.clinic_id,
             'clinic_name', f.clinic_name
           ) as entry,
           f.created_at as sort_key,
           f.id as sort_id
      from filtered f
     order by f.created_at, f.id
     offset v_offset limit p_page_size
  )
  -- The total is counted from `filtered`, so a page past the end still reports
  -- how many accounts match.
  select coalesce((select jsonb_agg(entry order by sort_key, sort_id) from page), '[]'::jsonb),
         (select count(*) from filtered)
    into v_rows, v_total;

  return jsonb_build_object('total', v_total, 'rows', v_rows);
end;
$$;

revoke all on function public.platform_users_page(text, text, text, integer, integer) from public, anon;
grant execute on function public.platform_users_page(text, text, text, integer, integer) to authenticated;

-- ---------------------------------------------------------------------------
-- SA-06: active staff per clinic
-- ---------------------------------------------------------------------------
create or replace function public.clinic_team_counts()
returns table (clinic_id uuid, active_staff integer)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not public.is_system_admin() then
    raise exception 'Only a System Administrator can read clinic team sizes.';
  end if;

  return query
    select m.clinic_id,
           (count(*) filter (where m.status = 'active'))::integer as active_staff
      from public.clinic_memberships m
     group by m.clinic_id;
end;
$$;

revoke all on function public.clinic_team_counts() from public, anon;
grant execute on function public.clinic_team_counts() to authenticated;
