-- ============================================================================
-- VetLink — 0022 clinic-scoped veterinarian patient list
--
-- 0014 and 0017 admit a veterinarian to the pets of owners who booked at, or
-- were registered by, a clinic where they hold an active membership. Those
-- predicates are stated per caller, not per clinic id, so a veterinarian with
-- two active memberships reads both clinics' patients from one query and VET-03
-- had no way to narrow that to the clinic the screen names.
--
-- clinic_vet_patients(target_clinic) evaluates the same two predicates for one
-- clinic and returns the pet with its owner's name, so the screen needs a single
-- round trip and cannot widen its own scope. security definer is what lets it
-- read past the pet and profile policies; is_clinic_veterinarian() is what
-- refuses every other caller, including the limited-staff role.
--
-- Repeatable: the function is replaced, not altered.
-- ============================================================================

create or replace function public.clinic_vet_patients(target_clinic uuid)
returns table (
  pet_id uuid,
  pet_name text,
  species text,
  breed text,
  sex text,
  owner_id uuid,
  owner_first_name text,
  owner_last_name text,
  created_at timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  select p.id,
         p.pet_name,
         p.species,
         p.breed,
         p.sex,
         p.owner_id,
         pr.first_name,
         pr.last_name,
         p.created_at
    from public.pets p
    left join public.profiles pr on pr.id = p.owner_id
   where public.is_clinic_veterinarian(target_clinic)
     and p.owner_id in (
       select a.owner_id from public.appointments a where a.clinic_id = target_clinic
       union
       select r.owner_id from public.clinic_owner_registrations r
        where r.clinic_id = target_clinic and r.removed_at is null
     )
   order by p.pet_name, p.id;
$$;

revoke all on function public.clinic_vet_patients(uuid) from public, anon;
grant execute on function public.clinic_vet_patients(uuid) to authenticated;
