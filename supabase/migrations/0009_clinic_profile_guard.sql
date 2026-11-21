-- ===========================================================================
-- VetLink — 0009 clinic profile write guard
--
-- 0004 granted `authenticated` UPDATE on the System-Administrator columns
-- (status, review_notes, reviewed_at, reviewed_by). Grants are role-wide and
-- clinics_admin_update lets a Clinic Administrator update their own clinic, so
-- the same grant also let an administrator approve, suspend or unsuspend their
-- own clinic straight through the REST API, bypassing platform review.
--
-- Those changes belong to the security-definer RPCs set_clinic_status() and
-- review_clinic_application(), which re-check the caller and write an audit
-- entry. Revoking the column privileges does not affect them: they run as the
-- function owner, not as `authenticated`.
--
-- CA-03 keeps the profile columns it actually edits. Adding a column here is a
-- deliberate decision, not a side effect of a console screen.
-- ===========================================================================

revoke update (status, review_notes, reviewed_at, reviewed_by)
  on public.clinics from authenticated;

-- Set by triggers and the registration RPC, never by a browser edit form.
revoke update (reference, submitted_at, featured, rating, review_count, distance_km)
  on public.clinics from authenticated;

grant update (
  clinic_name, description, email, contact_number,
  address, area, city, province, latitude, longitude,
  logo_url, cover_url, operating_hours, has_availability,
  website, year_established, emergency_service
) on public.clinics to authenticated;
