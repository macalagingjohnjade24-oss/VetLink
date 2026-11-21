-- ============================================================================
-- VetLink — 0012 service-role grants for the Edge Functions
--
-- The public tables were created by the migration role (`postgres`), and in
-- this project that did not carry the usual service_role table grants. The
-- Auth Admin API still worked, but the PostgREST calls inside invite-staff and
-- provision-clinic-admin failed with 42501 on `profiles` before they could
-- read the existing account. Invitations and provisioning could not complete,
-- and the system-administrator guard could not be reached.
--
-- service_role is server-only (its key never ships in a client), already has
-- BYPASSRLS, and these are exactly the tables the two functions touch:
--   profiles, clinic_memberships, clinics, notifications, platform_audit_log.
-- No browser role gains anything here.
-- ============================================================================

grant select, update on public.profiles to service_role;
grant select, insert, update on public.clinic_memberships to service_role;
grant select, update on public.clinics to service_role;
grant insert on public.notifications to service_role;
grant insert on public.platform_audit_log to service_role;
