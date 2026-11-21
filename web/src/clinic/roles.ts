/**
 * The clinic role model in words, shared by CA-06–CA-09.
 *
 * Each entry restates what supabase/migrations already enforces: 0002 for the
 * base policies, 0004 for staff/notifications, 0008 for the narrowed clinical
 * access. This file grants nothing — the database decides — so the console and
 * the staff screens can describe access the same way instead of drifting.
 */

export const CLINIC_ROLES = [
  'clinic_administrator',
  'receptionist',
  'veterinarian',
  'clinic_staff',
] as const;

export type ClinicRole = (typeof CLINIC_ROLES)[number];

/** `partial` means the policy allows part of the row: scoped rows, or read-only. */
export type ClinicAccess = 'yes' | 'no' | 'partial';

export const CLINIC_ROLE_SUMMARY: Record<ClinicRole, string> = {
  clinic_administrator:
    'Full clinic administration: profile, services, staff, appointments and clinic reports. Clinical records and record attachments are closed to this role, and so are platform-level settings.',
  receptionist:
    'Appointment management plus owner and pet contact details, with read-only vaccination records. Medical records stay with veterinarians.',
  veterinarian:
    'Appointments assigned to them, plus the patient history, medical records and vaccinations they author. Clinic-wide figures are limited to their own rows.',
  clinic_staff:
    'Today’s times, statuses, services and the booked pets’ names and species, read through clinic_limited_schedule(). No appointment rows, no owner contact details, no full pet records, and no status or clinical writes.',
};

export function clinicRoleSummary(role: string): string {
  return CLINIC_ROLE_SUMMARY[role as ClinicRole] ?? 'No clinic permissions are granted to this role.';
}

export const ADMINISTRATOR_MANAGED_NOTE =
  'Clinic administrators are provisioned by VetLink. This console cannot promote or demote that membership, and the database refuses the change even if a request is sent directly.';

export type ClinicCapability = {
  name: string;
  /** The policy or RPC the row restates, plus the scope it applies. */
  detail: string;
  access: Record<ClinicRole, ClinicAccess>;
};

/**
 * Deliberately literal: where a policy is broader than this console (owner and
 * pet reads, service reads), the cell says yes rather than pretending the UI is
 * the boundary. Where a policy narrows rows (assigned veterinarian, today-only
 * staff), the cell says partial and the detail explains the scope.
 */
export const CLINIC_CAPABILITIES: ClinicCapability[] = [
  {
    name: 'Appointment management',
    detail:
      'Read requests and confirm, reschedule or cancel bookings — the 0008 appointments policies scope the rows. Limited staff have no appointment-row read at all; they see today’s schedule through clinic_limited_schedule(), which omits the owner’s name and contact number stored on the row.',
    access: {
      clinic_administrator: 'yes',
      receptionist: 'yes',
      veterinarian: 'partial',
      clinic_staff: 'partial',
    },
  },
  {
    name: 'Owner contact details',
    detail:
      'Owner profiles for anyone with a booking here — is_patient_clinician(): administrators, receptionists and veterinarians. Limited staff have no owner read at all.',
    access: {
      clinic_administrator: 'yes',
      receptionist: 'yes',
      veterinarian: 'yes',
      clinic_staff: 'no',
    },
  },
  {
    name: 'Pet details',
    detail:
      'Full pet records for owners with a booking here, through pets_clinician_read. Limited staff get only today’s pet name and species from clinic_limited_pets().',
    access: {
      clinic_administrator: 'yes',
      receptionist: 'yes',
      veterinarian: 'yes',
      clinic_staff: 'partial',
    },
  },
  {
    name: 'Medical records',
    detail:
      'Read every record in the clinic; edit only the records they authored. 0008 removed every other role.',
    access: {
      clinic_administrator: 'no',
      receptionist: 'no',
      veterinarian: 'yes',
      clinic_staff: 'no',
    },
  },
  {
    name: 'Vaccination records',
    detail:
      'Veterinarians write vaccinations; receptionists read due dates. Administrators and limited staff have no policy.',
    access: {
      clinic_administrator: 'no',
      receptionist: 'partial',
      veterinarian: 'yes',
      clinic_staff: 'no',
    },
  },
  {
    name: 'Clinic profile and services',
    detail:
      'Reading is open to every active membership (clinics_staff_read, clinic_services_public_read); only the administrator can update them.',
    access: {
      clinic_administrator: 'yes',
      receptionist: 'partial',
      veterinarian: 'partial',
      clinic_staff: 'partial',
    },
  },
  {
    name: 'Clinic reports',
    detail:
      'clinic_dashboard() accepts any active membership, and the appointment rows behind a report are scoped per role — so only the administrator sees every booking. Limited staff get the counts but no appointment rows to break down.',
    access: {
      clinic_administrator: 'yes',
      receptionist: 'partial',
      veterinarian: 'partial',
      clinic_staff: 'partial',
    },
  },
  {
    name: 'Staff management',
    detail:
      'Invite staff and change a membership’s role or status. invite-staff re-checks the caller, and the membership write policies are administrator-only.',
    access: {
      clinic_administrator: 'yes',
      receptionist: 'no',
      veterinarian: 'no',
      clinic_staff: 'no',
    },
  },
];
