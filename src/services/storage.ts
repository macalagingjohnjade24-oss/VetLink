import AsyncStorage from '@react-native-async-storage/async-storage';

/** Thin, defensive wrapper so screens/services never touch AsyncStorage directly. */
export const storage = {
  async get<T>(key: string): Promise<T | null> {
    try {
      const raw = await AsyncStorage.getItem(key);
      return raw ? (JSON.parse(raw) as T) : null;
    } catch {
      return null;
    }
  },
  async set(key: string, value: unknown): Promise<void> {
    try {
      await AsyncStorage.setItem(key, JSON.stringify(value));
    } catch {
      // Persistence is best-effort; the mock app must keep working without it.
    }
  },
  async remove(key: string): Promise<void> {
    try {
      await AsyncStorage.removeItem(key);
    } catch {
      // ignore
    }
  },
};

export const STORAGE_KEYS = {
  accounts: 'vetlink.accounts.v1',
  session: 'vetlink.session.v1',
  notificationReads: 'vetlink.notifications.read.v1',
  recentSearches: 'vetlink.search.recent.v1',
  savedClinics: 'vetlink.clinics.saved.v1',
  createdAppointments: 'vetlink.appointments.created.v1',
  pets: 'vetlink.pets.v1',
  appointmentOverrides: 'vetlink.appointments.overrides.v1',
  notificationPreferences: 'vetlink.settings.notifications.v1',
  supportInquiries: 'vetlink.support.inquiries.v1',
  demoProfileOverrides: 'vetlink.account.demo.overrides.v1',
  clinicInquiries: 'vetlink.inquiries.clinic.v1',
} as const;
