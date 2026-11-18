export type NotificationCategory = 'appointments' | 'health' | 'general';

export type AppNotification = {
  id: string;
  category: NotificationCategory;
  title: string;
  meta: string;
  timeLabel: string;
  day: 'TODAY' | 'YESTERDAY';
  read: boolean;
  /** Detail screen content. */
  detailTitle: string;
  detailMeta: string;
  body: string;
  badge?: { label: string; tone: 'success' | 'warning' | 'brand' | 'neutral' };
  appointmentId?: string;
  clinicId?: string;
  guidance?: string;
};

export const NOTIFICATIONS: AppNotification[] = [
  {
    id: 'notif_reminder_milo',
    category: 'appointments',
    title: 'Appointment reminder',
    meta: 'Milo · Nov 20, 10:00 AM · 8:30 AM',
    timeLabel: '8:30 AM',
    day: 'TODAY',
    read: false,
    detailTitle: 'A little reminder for Milo',
    detailMeta: 'Appointment reminder · Nov 19, 2026 at 8:30 AM',
    body:
      'Your wellness consultation at Paws & Care Veterinary Clinic is tomorrow, November 20 at 10:00 AM. Please bring any previous medical records and arrive a little early.',
    badge: { label: 'Confirmed', tone: 'success' },
    appointmentId: 'apt_upcoming_wellness',
    clinicId: 'clinic_paws_care',
    guidance: '123 Amorsolo Street, Makati City',
  },
  {
    id: 'notif_vaccine_milo',
    category: 'health',
    title: 'Vaccination due soon',
    meta: 'Rabies booster · Nov 24 · 8:00 AM',
    timeLabel: '8:00 AM',
    day: 'TODAY',
    read: false,
    detailTitle: 'Rabies booster due for Milo',
    detailMeta: 'Vaccination reminder · Nov 19, 2026 at 8:00 AM',
    body:
      'Milo’s rabies booster is due on November 24, 2026. Book a short vaccination visit at Paws & Care Veterinary Clinic to keep his records up to date.',
    badge: { label: 'Due soon', tone: 'warning' },
    clinicId: 'clinic_paws_care',
    guidance: 'Vaccination visits usually take about 20 minutes.',
  },
  {
    id: 'notif_booking_confirmed',
    category: 'appointments',
    title: 'Booking confirmed',
    meta: 'Your Nov 20 visit is confirmed · 4:15 PM',
    timeLabel: '4:15 PM',
    day: 'YESTERDAY',
    read: true,
    detailTitle: 'Your visit is confirmed',
    detailMeta: 'Appointment update · Nov 18, 2026 at 4:15 PM',
    body:
      'Paws & Care Veterinary Clinic confirmed your wellness consultation for Milo on November 20, 2026 at 10:00 AM.',
    badge: { label: 'Confirmed', tone: 'success' },
    appointmentId: 'apt_upcoming_wellness',
    clinicId: 'clinic_paws_care',
    guidance: 'You can reschedule or cancel from My Appointments.',
  },
  {
    id: 'notif_health_tip',
    category: 'health',
    title: 'Keeping Milo cool this season',
    meta: 'Clinic guidance · 9:10 AM',
    timeLabel: '9:10 AM',
    day: 'YESTERDAY',
    read: true,
    detailTitle: 'Warm-weather care for Milo',
    detailMeta: 'Clinic guidance · Nov 18, 2026 at 9:10 AM',
    body:
      'Shorter walks in the early morning and fresh water throughout the day help pets stay comfortable in warmer weather.',
    badge: { label: 'Health tip', tone: 'brand' },
    clinicId: 'clinic_paws_care',
    guidance: 'Call your clinic if you notice unusual lethargy or appetite changes.',
  },
];
