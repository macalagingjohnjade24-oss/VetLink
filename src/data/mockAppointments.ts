export type AppointmentStatus =
  | 'Pending'
  | 'Confirmed'
  | 'Reschedule requested'
  | 'Cancellation requested'
  | 'Completed'
  | 'Cancelled'
  | 'Rejected';

export type Appointment = {
  id: string;
  reference: string;
  clinicId: string;
  petId: string;
  serviceId: string;
  serviceName: string;
  dateISO: string;
  timeLabel: string;
  dateLabel: string;
  status: AppointmentStatus;
  price: number;
  notes?: string;
  /** Booking request details captured in the booking flow. */
  ownerName?: string;
  contact?: string;
  reason?: string;
  symptoms?: string;
  attachmentName?: string | null;
  createdAt?: string;
  cancellationReason?: string;
  cancellationNote?: string;
  rescheduleReason?: string;
  requestedDateISO?: string;
  requestedTime?: string;
  /** Note the clinic leaves when it accepts or declines a request. */
  clinicNote?: string;
};

export const APPOINTMENTS: Appointment[] = [
  {
    id: 'apt_upcoming_wellness',
    reference: 'VL-2418-0921',
    clinicId: 'clinic_paws_care',
    petId: 'pet_milo',
    serviceId: 'svc_consultation',
    serviceName: 'Wellness consultation',
    dateISO: '2026-11-20T10:00:00',
    timeLabel: '10:00 AM',
    dateLabel: 'Nov 20',
    status: 'Confirmed',
    price: 750,
    notes: 'Please bring previous medical records.',
  },
  {
    id: 'apt_upcoming_vaccine',
    reference: 'VL-2418-1044',
    clinicId: 'clinic_happy_tails',
    petId: 'pet_coco',
    serviceId: 'svc_vaccination_ht',
    serviceName: 'Vaccination',
    dateISO: '2026-11-26T09:00:00',
    timeLabel: '9:00 AM',
    dateLabel: 'Nov 26',
    status: 'Pending',
    price: 900,
  },
  {
    id: 'apt_past_dental',
    reference: 'VL-2409-0312',
    clinicId: 'clinic_paws_care',
    petId: 'pet_milo',
    serviceId: 'svc_dental',
    serviceName: 'Dental check-up',
    dateISO: '2026-10-12T11:30:00',
    timeLabel: '11:30 AM',
    dateLabel: 'Oct 12',
    status: 'Completed',
    price: 1400,
  },
];
