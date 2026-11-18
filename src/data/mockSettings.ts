/** Mock account preferences. Stored locally only; no notification service exists yet. */
export type NotificationPreferences = {
  appointmentUpdates: boolean;
  vaccinationReminders: boolean;
  emailNotifications: boolean;
};

export const DEFAULT_NOTIFICATION_PREFERENCES: NotificationPreferences = {
  appointmentUpdates: true,
  vaccinationReminders: true,
  emailNotifications: true,
};

export const NOTIFICATION_PREFERENCE_ROWS: { key: keyof NotificationPreferences; label: string }[] = [
  { key: 'appointmentUpdates', label: 'Appointment updates' },
  { key: 'vaccinationReminders', label: 'Vaccination reminders' },
  { key: 'emailNotifications', label: 'Email notifications' },
];
