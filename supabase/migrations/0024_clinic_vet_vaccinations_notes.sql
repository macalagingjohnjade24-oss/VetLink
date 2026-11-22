-- ============================================================================
-- VetLink — 0024 clinic-scoped veterinarian vaccination read carries notes
--
-- `vaccinations.notes` has existed since 0001, and VET-09's spec lists it, but
-- the read VET-08 and VET-10 share (clinic_vet_vaccinations, 0023) never
-- selected the column. A note could therefore be written and then never shown
-- on the record it belongs to.
--
-- The function is dropped and recreated rather than replaced, because a
-- RETURNS TABLE column list cannot be changed in place. Nothing else moves:
-- still stable, still security definer, still gated on
-- is_clinic_veterinarian(target_clinic), and still only one clinic's rows.
-- ============================================================================

drop function if exists public.clinic_vet_vaccinations(uuid);

create function public.clinic_vet_vaccinations(target_clinic uuid)
returns table (
  vaccination_id uuid,
  pet_id uuid,
  pet_name text,
  vaccine_name text,
  vaccination_date date,
  next_due_date date,
  dosage text,
  batch_number text,
  veterinarian_name text,
  notes text
)
language sql
stable
security definer
set search_path = public
as $$
  select v.id,
         v.pet_id,
         p.pet_name,
         v.vaccine_name,
         v.vaccination_date,
         v.next_due_date,
         v.dosage,
         v.batch_number,
         v.veterinarian_name,
         v.notes
    from public.vaccinations v
    join public.pets p on p.id = v.pet_id
   where v.clinic_id = target_clinic
     and public.is_clinic_veterinarian(target_clinic)
   order by v.next_due_date nulls last, v.vaccine_name;
$$;

revoke all on function public.clinic_vet_vaccinations(uuid) from public, anon;
grant execute on function public.clinic_vet_vaccinations(uuid) to authenticated;
