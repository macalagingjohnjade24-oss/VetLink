export const CONSOLE_ROLES = [
  'clinic_administrator',
  'receptionist',
  'veterinarian',
  'clinic_staff',
  'system_administrator',
] as const;

export type ConsoleRole = (typeof CONSOLE_ROLES)[number];

/** Mirrors public.profiles.role (0001 + the clinic_staff addition in 0004). */
export type AnyRole = ConsoleRole | 'pet_owner';

export const ROLE_LABEL: Record<AnyRole, string> = {
  clinic_administrator: 'Clinic Administrator',
  receptionist: 'Appointment Manager',
  veterinarian: 'Veterinarian',
  clinic_staff: 'Clinic Staff',
  system_administrator: 'System Administrator',
  pet_owner: 'Pet Owner',
};

export const ROLE_HOME: Record<ConsoleRole, string> = {
  clinic_administrator: '/clinic-admin',
  receptionist: '/appointments',
  veterinarian: '/veterinarian',
  clinic_staff: '/staff',
  system_administrator: '/system-admin',
};

export function isConsoleRole(role: string | null | undefined): role is ConsoleRole {
  return !!role && (CONSOLE_ROLES as readonly string[]).includes(role);
}

/** Scope line shown next to the shield in the header. */
export const ROLE_SCOPE: Record<ConsoleRole, string> = {
  clinic_administrator: 'Clinic access only',
  receptionist: 'Clinic access only',
  veterinarian: 'Clinic access only',
  clinic_staff: 'Limited access',
  system_administrator: 'MFA protected',
};
