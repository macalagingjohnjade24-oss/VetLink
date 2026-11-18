-- ===========================================================================
-- VetLink — OPTIONAL development seed data
-- ---------------------------------------------------------------------------
-- This file is for LOCAL / DEVELOPMENT testing only. It inserts two published
-- clinics and their services so clinic discovery, clinic services and the
-- booking flow have something to show before real clinics are onboarded.
--
--   * No users, pets, appointments, medical or vaccination records are seeded.
--   * Do NOT run this against a production database.
-- ===========================================================================

insert into public.clinics (
  id, clinic_name, description, email, contact_number, address, area, city, province,
  latitude, longitude, distance_km, rating, review_count, operating_hours,
  featured, has_availability, status
)
values
  (
    '11111111-1111-4111-8111-111111111111',
    'Paws & Care Veterinary Clinic',
    'A welcoming neighbourhood clinic offering preventive care and consultations for dogs and cats.',
    'hello@pawsandcare.example',
    '+63 2 8555 0128',
    '123 Amorsolo Street, Legazpi Village',
    'Amorsolo Street',
    'Makati City',
    'Metro Manila',
    14.5547, 121.0144, 1.2, 4.8, 214,
    '{"days": [1,2,3,4,5,6], "opens": "08:00", "closes": "18:00", "note": "Monday–Saturday · Closed Sunday"}',
    false, true, 'approved'
  ),
  (
    '22222222-2222-4222-8222-222222222222',
    'Companion Animal Center',
    'A calm, modern practice with wellness plans, grooming and preventive care for companion animals.',
    'team@companionanimal.example',
    '+63 2 8555 0163',
    '24 Legazpi Street, Legazpi Village',
    'Legazpi Village',
    'Makati City',
    'Metro Manila',
    14.5592, 121.0181, 2.4, 4.7, 186,
    '{"days": [1,2,3,4,5,6], "opens": "09:00", "closes": "19:00", "note": "Monday–Saturday · Sunday by appointment"}',
    true, true, 'approved'
  )
on conflict (id) do nothing;

insert into public.clinic_services (clinic_id, service_name, description, price, estimated_duration, availability)
values
  ('11111111-1111-4111-8111-111111111111', 'General consultation', 'Routine wellness checks and health concerns.', 750, 30, 'available'),
  ('11111111-1111-4111-8111-111111111111', 'Vaccination', 'Discuss appropriate vaccinations with the clinic.', 950, 20, 'available'),
  ('11111111-1111-4111-8111-111111111111', 'Dental consultation', 'An assessment of oral health and care needs.', 1400, 45, 'limited'),
  ('22222222-2222-4222-8222-222222222222', 'General consultation', 'Wellness checks and health concerns.', 800, 30, 'available'),
  ('22222222-2222-4222-8222-222222222222', 'Vaccination', 'Core and booster vaccines.', 1000, 20, 'available'),
  ('22222222-2222-4222-8222-222222222222', 'Grooming', 'Routine grooming and coat care.', 900, 60, 'available')
on conflict (clinic_id, (lower(service_name))) do nothing;
