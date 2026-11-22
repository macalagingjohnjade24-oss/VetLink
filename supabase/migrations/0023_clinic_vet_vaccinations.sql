-- ============================================================================
-- VetLink — 0023 clinic-scoped veterinarian vaccination list
--
-- VET-08 reads `vaccinations` directly (vaccinations_staff_read, 0008), but the
-- pet's name came from an embedded `pets` row, which is subject to the pet
-- policies. A vaccination recorded at the clinic for a pet the veterinarian
-- cannot otherwise read — no booking, no desk registration — therefore rendered
-- with no patient name, which is useless on the screen that exists to show it.
--
-- clinic_vet_vaccinations(target_clinic) returns the same records with the pet's
-- name, joined inside a security definer function, exactly as
-- clinic_limited_due_vaccinations() already does for limited staff (0008/0014).
-- It exposes a name only; species, breed, owner and every clinical column stay
-- behind the pet policies. is_clinic_veterinarian() is what refuses every other
-- caller, and every row is still filtered to one clinic.
--
-- Repeatable: the function is replaced, not altered.
-- ============================================================================

create or replace function public.clinic_vet_vaccinations(target_clinic uuid)
returns table (
  vaccination_id uuid,
  pet_id uuid,
  pet_name text,
  vaccine_name text,
  vaccination_date date,
  next_due_date date,
  dosage text,
  batch_number text,
  veterinarian_name text
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
         v.veterinarian_name
    from public.vaccinations v
    join public.pets p on p.id = v.pet_id
   where v.clinic_id = target_clinic
     and public.is_clinic_veterinarian(target_clinic)
   order by v.next_due_date nulls last, v.vaccine_name;
$$;

revoke all on function public.clinic_vet_vaccinations(uuid) from public, anon;
grant execute on function public.clinic_vet_vaccinations(uuid) to authenticated;
