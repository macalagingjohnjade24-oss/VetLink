-- ============================================================================
-- VetLink — 0025 an applicant can read the status of their own application
--
-- submit_clinic_application() (0004) leaves the applicant with an *invited*
-- clinic_administrator membership, and every clinics read policy needs an
-- active one (or an approved clinic). So until approval the applicant could not
-- see their own pending — or rejected — application, and REG-08/09/10 had
-- nothing to show.
--
-- my_clinic_application() returns the caller's most recent application only:
-- name, reference, status, dates, the reviewer's remarks and the document
-- count. Nothing about any other clinic, and no write. auth.uid() is the whole
-- scope, so an anonymous call returns no row.
-- ============================================================================

create or replace function public.my_clinic_application()
returns table (
  clinic_id uuid,
  clinic_name text,
  reference text,
  status text,
  submitted_at timestamptz,
  reviewed_at timestamptz,
  review_notes text,
  document_count integer
)
language sql
stable
security definer
set search_path = public
as $$
  select c.id,
         c.clinic_name,
         c.reference,
         c.status,
         c.submitted_at,
         c.reviewed_at,
         c.review_notes,
         (select count(*)::integer from public.clinic_documents d where d.clinic_id = c.id)
    from public.clinic_memberships m
    join public.clinics c on c.id = m.clinic_id
   where m.user_id = auth.uid()
     and m.staff_role = 'clinic_administrator'
   order by coalesce(c.submitted_at, c.created_at) desc
   limit 1;
$$;

revoke all on function public.my_clinic_application() from public, anon;
grant execute on function public.my_clinic_application() to authenticated;
