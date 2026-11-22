-- ============================================================================
-- VetLink — 0018 service-role grants for owner registration
--
-- 0012 gave the service role exactly the privileges the two existing Edge
-- Functions needed. register-pet-owner (AM-10) also files the owner's pet and
-- the clinic's register row, so without these grants every registration ends
-- in "permission denied for table pets" after the account has been created.
--
-- service_role is server-only, already has BYPASSRLS, and is the only role
-- that writes another person's pets or the clinic owner register. Nothing here
-- reaches anon or authenticated.
-- ============================================================================

-- SELECT as well as INSERT: the function asks PostgREST to return the new
-- pet id, and a representation read needs the table privilege too.
grant select, insert on public.pets to service_role;
grant select, insert, update on public.clinic_owner_registrations to service_role;
