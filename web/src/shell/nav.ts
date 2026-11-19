import type { IconName } from '@/ui/Icon';
import type { ConsoleRole } from '@/auth/roles';

export type NavItem = {
  path: string;
  label: string;
  icon: IconName;
  /** Figma frame this route will implement. */
  code: string;
  /** Build phase that delivers it (see the Phase 1 plan). */
  phase: number;
};

/**
 * Navigation is taken from the Figma sidebars (CA-01, AM-01, VET-01, CS-01,
 * SA-01). Routes that are not built yet render an honest "arriving in phase N"
 * panel rather than placeholder data.
 */
export const NAV: Record<ConsoleRole, NavItem[]> = {
  clinic_administrator: [
    { path: '/clinic-admin', label: 'Dashboard', icon: 'home', code: 'CA-01', phase: 4 },
    { path: '/clinic-admin/profile', label: 'Clinic profile', icon: 'map-pin', code: 'CA-02', phase: 4 },
    { path: '/clinic-admin/services', label: 'Services', icon: 'stethoscope', code: 'CA-04', phase: 4 },
    { path: '/clinic-admin/staff', label: 'Staff management', icon: 'users', code: 'CA-06', phase: 4 },
    { path: '/clinic-admin/permissions', label: 'Permissions', icon: 'lock', code: 'CA-09', phase: 4 },
    { path: '/clinic-admin/reports', label: 'Reports', icon: 'chart', code: 'CA-10', phase: 4 },
    { path: '/clinic-admin/import-export', label: 'Import / export', icon: 'download', code: 'CA-11', phase: 4 },
    { path: '/clinic-admin/notifications', label: 'Notifications', icon: 'bell', code: 'CA-12', phase: 4 },
    { path: '/clinic-admin/settings', label: 'Settings', icon: 'settings', code: 'CA-13', phase: 4 },
  ],
  receptionist: [
    { path: '/appointments', label: 'Dashboard', icon: 'home', code: 'AM-01', phase: 5 },
    { path: '/appointments/management', label: 'Appointment management', icon: 'calendar', code: 'AM-02', phase: 5 },
    { path: '/appointments/requests', label: 'Appointment requests', icon: 'clipboard', code: 'AM-03', phase: 5 },
    { path: '/appointments/calendar', label: 'Schedule calendar', icon: 'calendar', code: 'AM-05', phase: 5 },
    { path: '/appointments/owners', label: 'Pet owners', icon: 'users', code: 'AM-09', phase: 5 },
    { path: '/appointments/pets', label: 'Pets', icon: 'clipboard', code: 'AM-11', phase: 5 },
    { path: '/appointments/inquiries', label: 'Client inquiries', icon: 'mail', code: 'AM-13', phase: 5 },
    { path: '/appointments/notifications', label: 'Notifications', icon: 'bell', code: 'AM-14', phase: 5 },
    { path: '/appointments/profile', label: 'My profile', icon: 'user', code: 'AUTH-06', phase: 5 },
  ],
  veterinarian: [
    { path: '/veterinarian', label: 'Dashboard', icon: 'home', code: 'VET-01', phase: 6 },
    { path: '/veterinarian/appointments', label: 'Appointments', icon: 'calendar', code: 'VET-02', phase: 6 },
    { path: '/veterinarian/patients', label: 'Patients', icon: 'clipboard', code: 'VET-03', phase: 6 },
    { path: '/veterinarian/records', label: 'Medical records', icon: 'file', code: 'VET-06', phase: 6 },
    { path: '/veterinarian/vaccinations', label: 'Vaccinations', icon: 'shield', code: 'VET-08', phase: 6 },
    { path: '/veterinarian/consultations', label: 'Consultation history', icon: 'clock', code: 'VET-11', phase: 6 },
    { path: '/veterinarian/profile', label: 'My profile', icon: 'user', code: 'VET-12', phase: 6 },
  ],
  clinic_staff: [
    { path: '/staff', label: 'Dashboard', icon: 'home', code: 'CS-01', phase: 7 },
    { path: '/staff/tasks', label: 'Assigned tasks', icon: 'clipboard', code: 'CS-02', phase: 7 },
    { path: '/staff/appointments', label: 'Appointment assistance', icon: 'calendar', code: 'CS-03', phase: 7 },
    { path: '/staff/pets', label: 'Pet information', icon: 'clipboard', code: 'CS-04', phase: 7 },
    { path: '/staff/notifications', label: 'Notifications', icon: 'bell', code: 'CS-05', phase: 7 },
    { path: '/staff/profile', label: 'My profile', icon: 'user', code: 'CS-06', phase: 7 },
  ],
  system_administrator: [
    { path: '/system-admin', label: 'Dashboard', icon: 'home', code: 'SA-01', phase: 3 },
    { path: '/system-admin/clinics', label: 'Clinic directory', icon: 'map-pin', code: 'SA-02', phase: 3 },
    { path: '/system-admin/applications', label: 'Applications', icon: 'clipboard', code: 'SA-03', phase: 3 },
    { path: '/system-admin/accounts', label: 'Clinic accounts', icon: 'shield', code: 'SA-06', phase: 3 },
    { path: '/system-admin/users', label: 'Platform users', icon: 'users', code: 'SA-08', phase: 3 },
    { path: '/system-admin/roles', label: 'Roles & access', icon: 'lock', code: 'SA-10', phase: 3 },
    { path: '/system-admin/monitoring', label: 'Monitoring', icon: 'chart', code: 'SA-11', phase: 3 },
    { path: '/system-admin/reports', label: 'Reports & analytics', icon: 'chart', code: 'SA-12', phase: 3 },
    { path: '/system-admin/audit', label: 'Audit logs', icon: 'clock', code: 'SA-13', phase: 3 },
    { path: '/system-admin/notifications', label: 'Notifications', icon: 'bell', code: 'SA-14', phase: 3 },
    { path: '/system-admin/settings', label: 'System settings', icon: 'settings', code: 'SA-15', phase: 3 },
    { path: '/system-admin/profile', label: 'My profile', icon: 'user', code: 'SA-16', phase: 3 },
  ],
};

export const ALL_NAV_ITEMS: NavItem[] = Object.values(NAV)
  .flat()
  .filter((item, index, all) => all.findIndex((candidate) => candidate.path === item.path) === index);

/** Sidebar footer copy per role, taken from the Figma sidebars. */
export const ROLE_NOTE: Record<ConsoleRole, { label: string; copy: string }> = {
  clinic_administrator: {
    label: 'Clinic administrator',
    copy: 'Clinic access only. Records stay within this clinic.',
  },
  receptionist: {
    label: 'Appointment manager',
    copy: 'Front desk access. Medical records stay clinic-scoped.',
  },
  veterinarian: {
    label: 'Veterinarian',
    copy: 'Clinical access for this clinic only.',
  },
  clinic_staff: {
    label: 'Limited staff access',
    copy: 'Assigned tasks and permitted details. No clinical record editing.',
  },
  system_administrator: {
    label: 'System administrator',
    copy: 'Platform-wide access. Clinical records remain clinic-scoped.',
  },
};
