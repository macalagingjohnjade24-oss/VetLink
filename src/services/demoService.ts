import { STORAGE_KEYS, storage } from './storage';

/**
 * Everything the demo writes while you use it. Sign-in and onboarding progress are
 * deliberately left alone so a reset returns to the seeded data, not the welcome flow.
 */
const DEMO_STATE_KEYS = [
  STORAGE_KEYS.pets,
  STORAGE_KEYS.createdAppointments,
  STORAGE_KEYS.appointmentOverrides,
  STORAGE_KEYS.notificationPreferences,
  STORAGE_KEYS.notificationReads,
  STORAGE_KEYS.recentSearches,
  STORAGE_KEYS.savedClinics,
  STORAGE_KEYS.supportInquiries,
  STORAGE_KEYS.clinicInquiries,
  STORAGE_KEYS.demoProfileOverrides,
];

export const demoService = {
  async resetDemoData(): Promise<void> {
    await Promise.all(DEMO_STATE_KEYS.map((key) => storage.remove(key)));
  },
};
