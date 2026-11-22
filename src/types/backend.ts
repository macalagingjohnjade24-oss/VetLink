import type { Appointment, AppointmentStatus } from '../data/mockAppointments';
import type { Clinic, ClinicService } from '../data/mockClinics';
import type { MedicalAttachment, MedicalRecord } from '../data/mockMedicalRecords';
import type { AppNotification, NotificationCategory } from '../data/mockNotifications';
import type { PetGender, PetSpecies, Pet } from '../data/mockPets';
import type { UserAccount } from '../data/mockUsers';
import type { Vaccination, VaccinationStatus } from '../data/mockVaccinations';
import { ageLabelFrom, formatISODate, formatTimeLabel } from '../utils/petFormat';
import { toLatLng } from '../lib/geo';

/**
 * Row shapes returned by the VetLink Supabase schema (see supabase/migrations).
 * They are kept explicit so every screen keeps receiving the same domain types
 * it already used with the mock data.
 */

export type UserRole =
  | 'pet_owner'
  | 'veterinarian'
  | 'clinic_administrator'
  | 'receptionist'
  | 'system_administrator';

export type ProfileRow = {
  id: string;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  mobile_number: string | null;
  profile_picture: string | null;
  role: UserRole;
  address: string | null;
  created_at: string;
  updated_at: string;
};

export type ClinicRow = {
  id: string;
  clinic_name: string;
  description: string | null;
  email: string | null;
  contact_number: string | null;
  address: string | null;
  area: string | null;
  city: string | null;
  province: string | null;
  latitude: number | null;
  longitude: number | null;
  distance_km: number | null;
  rating: number | null;
  review_count: number | null;
  logo_url: string | null;
  operating_hours: OperatingHours | null;
  featured: boolean | null;
  has_availability: boolean | null;
  status: string;
  created_at: string;
  updated_at: string;
};

export type OperatingHours = {
  days?: number[];
  opens?: string;
  closes?: string;
  note?: string;
} | null;

export type ClinicServiceRow = {
  id: string;
  clinic_id: string;
  service_name: string;
  description: string | null;
  price: number | null;
  estimated_duration: number | null;
  availability: string | null;
  created_at: string;
  updated_at: string;
};

export type PetRow = {
  id: string;
  owner_id: string;
  pet_name: string;
  species: string;
  breed: string | null;
  sex: string | null;
  date_of_birth: string | null;
  weight: number | null;
  color: string | null;
  microchip: string | null;
  profile_picture: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

export type AppointmentRow = {
  id: string;
  reference: string | null;
  owner_id: string;
  clinic_id: string;
  pet_id: string;
  service_id: string | null;
  appointment_date: string;
  appointment_time: string | null;
  reason_for_visit: string | null;
  additional_notes: string | null;
  symptoms: string | null;
  attachment_name: string | null;
  owner_name: string | null;
  contact: string | null;
  service_name: string | null;
  price: number | null;
  status: string;
  cancellation_reason: string | null;
  cancellation_requested: boolean | null;
  reschedule_requested: boolean | null;
  requested_date: string | null;
  requested_time: string | null;
  reschedule_reason: string | null;
  clinic_note: string | null;
  created_at: string;
  updated_at: string;
};

export type MedicalRecordRow = {
  id: string;
  pet_id: string;
  owner_id: string;
  clinic_id: string | null;
  veterinarian_name: string | null;
  diagnosis: string | null;
  treatment: string | null;
  prescription: string | null;
  notes: string | null;
  record_date: string;
  attachment_url: string | null;
  created_at: string;
  updated_at: string;
};

export type VaccinationRow = {
  id: string;
  pet_id: string;
  owner_id: string;
  clinic_id: string | null;
  vaccine_name: string;
  vaccination_date: string | null;
  next_due_date: string | null;
  veterinarian_name: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

export type NotificationRow = {
  id: string;
  user_id: string;
  title: string;
  message: string;
  notification_type: string;
  related_appointment_id: string | null;
  is_read: boolean;
  created_at: string;
};

export type InquiryRecord = {
  id: string;
  reference: string;
  ownerId: string;
  ownerName: string;
  contact: string;
  petName: string;
  petSpecies: string;
  category: string;
  details: string;
  clinicId: string;
  clinicName: string;
  submittedAtISO: string;
  status: string;
};

const FALLBACK_CLINIC_PHOTO = require('../../assets/onboarding/clinic.png');

const toPhoto = (url: string | null, fallback: number | null) => (url ? { uri: url } : fallback);

export function mapProfile(row: ProfileRow): UserAccount {
  return {
    id: row.id,
    firstName: row.first_name ?? '',
    lastName: row.last_name ?? '',
    email: row.email ?? '',
    mobile: row.mobile_number ?? '',
    verified: true,
    avatarUri: row.profile_picture,
    address: row.address ?? undefined,
  };
}

function clinicHours(hours: OperatingHours): { openNow: boolean; hoursLine: string; hoursNote: string } {
  if (!hours?.opens || !hours?.closes) {
    return { openNow: false, hoursLine: 'Hours not recorded', hoursNote: 'Contact the clinic for opening hours' };
  }
  const now = new Date();
  const day = now.getDay();
  const current = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
  const openToday = (hours.days ?? [1, 2, 3, 4, 5, 6]).includes(day);
  const openNow = openToday && current >= hours.opens && current < hours.closes;
  const opens = formatTimeLabel(hours.opens);
  const closes = formatTimeLabel(hours.closes);
  return {
    openNow,
    hoursLine: openNow ? `Open today · ${opens}–${closes}` : openToday ? `Opens ${opens}` : 'Closed today',
    hoursNote: hours.note ?? `${opens}–${closes}`,
  };
}

export function mapClinicService(row: ClinicServiceRow): ClinicService {
  return {
    id: row.id,
    name: row.service_name,
    description: row.description ?? '',
    durationMinutes: row.estimated_duration ?? 30,
    price: Number(row.price ?? 0),
  };
}

export function mapClinic(row: ClinicRow, services: ClinicServiceRow[] = []): Clinic {
  const hours = clinicHours(row.operating_hours);
  return {
    id: row.id,
    name: row.clinic_name,
    city: row.city ?? '',
    area: row.area ?? row.city ?? '',
    address: row.address ?? '',
    distanceKm: Number(row.distance_km ?? 0),
    rating: Number(row.rating ?? 0),
    reviewCount: Number(row.review_count ?? 0),
    openNow: hours.openNow,
    hoursLine: hours.hoursLine,
    hoursNote: hours.hoursNote,
    phone: row.contact_number ?? '',
    email: row.email ?? '',
    description: row.description ?? '',
    services: services.filter((service) => service.clinic_id === row.id).map(mapClinicService),
    photo: toPhoto(row.logo_url, FALLBACK_CLINIC_PHOTO) as Clinic['photo'],
    location: toLatLng(row.latitude, row.longitude),
    featured: Boolean(row.featured),
    hasAvailability: Boolean(row.has_availability),
  };
}

export function mapPet(row: PetRow): Pet {
  return {
    id: row.id,
    ownerId: row.owner_id,
    name: row.pet_name,
    species: (row.species === 'Cat' ? 'Cat' : 'Dog') as PetSpecies,
    breed: row.breed ?? '',
    birthDate: row.date_of_birth ?? '',
    ageLabel: row.date_of_birth ? ageLabelFrom(row.date_of_birth) : 'Age unknown',
    gender: ((row.sex ?? 'male').toLowerCase() === 'female' ? 'Female' : 'Male') as PetGender,
    weightKg: Number(row.weight ?? 0),
    color: row.color ?? '',
    microchip: row.microchip ?? undefined,
    notes: row.notes ?? undefined,
    photo: row.profile_picture ? { uri: row.profile_picture } : null,
  };
}

function appointmentStatus(row: AppointmentRow): AppointmentStatus {
  if (row.cancellation_requested) return 'Cancellation requested';
  if (row.reschedule_requested) return 'Reschedule requested';
  switch (row.status) {
    case 'confirmed':
      return 'Confirmed';
    case 'completed':
      return 'Completed';
    case 'cancelled':
      return 'Cancelled';
    case 'rejected':
      return 'Rejected';
    case 'rescheduled':
      return 'Reschedule requested';
    default:
      return 'Pending';
  }
}

export function mapAppointment(row: AppointmentRow): Appointment {
  const dateISO = `${row.appointment_date}T${(row.appointment_time ?? '00:00:00').slice(0, 8)}`;
  const date = new Date(dateISO);
  return {
    id: row.id,
    reference: row.reference ?? `VL-${row.id.slice(0, 6).toUpperCase()}`,
    clinicId: row.clinic_id,
    petId: row.pet_id,
    serviceId: row.service_id ?? '',
    serviceName: row.service_name ?? 'Clinic service',
    dateISO,
    timeLabel: formatTimeLabel(row.appointment_time ?? undefined),
    dateLabel: Number.isNaN(date.getTime())
      ? formatISODate(row.appointment_date)
      : date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
    status: appointmentStatus(row),
    price: Number(row.price ?? 0),
    notes: row.additional_notes ?? undefined,
    ownerName: row.owner_name ?? undefined,
    contact: row.contact ?? undefined,
    reason: row.reason_for_visit ?? undefined,
    symptoms: row.symptoms ?? undefined,
    attachmentName: row.attachment_name,
    createdAt: row.created_at,
    cancellationReason: row.cancellation_reason ?? undefined,
    cancellationNote: row.cancellation_reason ?? undefined,
    rescheduleReason: row.reschedule_reason ?? undefined,
    requestedDateISO: row.requested_date ?? undefined,
    requestedTime: row.requested_time ?? undefined,
    clinicNote: row.clinic_note ?? undefined,
  };
}

function attachmentFromUrl(url: string): MedicalAttachment {
  const name = url.split('/').pop() ?? 'attachment';
  const isImage = /\.(png|jpe?g|webp)$/i.test(name);
  return {
    id: url,
    name,
    kind: isImage ? 'Image' : 'PDF',
    sizeLabel: 'Attachment',
    uploadedLabel: 'Added by the clinic',
    previewTitle: 'CLINIC ATTACHMENT',
    previewLines: [name],
  };
}

export function mapMedicalRecord(row: MedicalRecordRow): MedicalRecord {
  return {
    id: row.id,
    reference: `MR-${row.record_date.replace(/-/g, '').slice(2, 6)}-${row.id.slice(0, 3).toUpperCase()}`,
    petId: row.pet_id,
    title: row.diagnosis || row.treatment || 'Medical record',
    dateISO: row.record_date,
    clinicId: row.clinic_id ?? '',
    veterinarian: row.veterinarian_name ?? undefined,
    consultation: row.treatment ?? undefined,
    diagnosis: row.diagnosis ?? undefined,
    treatment: row.treatment ?? undefined,
    prescriptions: row.prescription ?? undefined,
    notes: row.notes ?? undefined,
    attachments: row.attachment_url ? [attachmentFromUrl(row.attachment_url)] : [],
  };
}

export function mapVaccination(row: VaccinationRow): Vaccination {
  const today = new Date().toISOString().slice(0, 10);
  let status: VaccinationStatus = 'Completed';
  if (row.next_due_date) status = row.next_due_date < today ? 'Overdue' : 'Upcoming';
  return {
    id: row.id,
    reference: `VR-${(row.vaccination_date ?? '').replace(/-/g, '').slice(0, 6) || row.id.slice(0, 6).toUpperCase()}`,
    petId: row.pet_id,
    vaccine: row.vaccine_name,
    administeredOn: row.vaccination_date,
    nextDueISO: row.next_due_date,
    clinicId: row.clinic_id ?? '',
    status,
    veterinarian: row.veterinarian_name ?? undefined,
    details: row.notes ?? undefined,
    reminderDays: 7,
  };
}

const NOTIFICATION_CATEGORY: Record<string, NotificationCategory> = {
  appointment_confirmed: 'appointments',
  appointment_cancelled: 'appointments',
  appointment_rescheduled: 'appointments',
  appointment_reminder: 'appointments',
  vaccination_reminder: 'health',
  health: 'health',
  account: 'general',
};

const BADGE_TONE: Record<string, AppNotification['badge']> = {
  appointment_confirmed: { label: 'Confirmed', tone: 'success' },
  appointment_cancelled: { label: 'Cancelled', tone: 'warning' },
  appointment_rescheduled: { label: 'Rescheduled', tone: 'warning' },
  appointment_reminder: { label: 'Reminder', tone: 'brand' },
  vaccination_reminder: { label: 'Due soon', tone: 'warning' },
};

export function mapNotification(row: NotificationRow): AppNotification {
  const created = new Date(row.created_at);
  const today = new Date();
  const isToday = created.toDateString() === today.toDateString();
  const timeLabel = created.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  return {
    id: row.id,
    category: NOTIFICATION_CATEGORY[row.notification_type] ?? 'general',
    title: row.title,
    meta: row.message.length > 72 ? `${row.message.slice(0, 72).trimEnd()}…` : row.message,
    timeLabel,
    day: isToday ? 'TODAY' : 'YESTERDAY',
    read: row.is_read,
    detailTitle: row.title,
    detailMeta: `${row.notification_type.replace(/_/g, ' ')} · ${formatISODate(row.created_at.slice(0, 10))} at ${timeLabel}`,
    body: row.message,
    badge: BADGE_TONE[row.notification_type],
    appointmentId: row.related_appointment_id ?? undefined,
  };
}

export function mapInquiry(row: {
  id: string;
  reference: string | null;
  owner_id: string;
  clinic_id: string | null;
  clinic_name: string | null;
  inquiry_type: string | null;
  owner_name: string | null;
  contact: string | null;
  pet_name: string | null;
  pet_species: string | null;
  details: string | null;
  status: string;
  created_at: string;
}): InquiryRecord {
  return {
    id: row.id,
    reference: row.reference ?? `INQ-${row.id.slice(0, 8).toUpperCase()}`,
    ownerId: row.owner_id,
    ownerName: row.owner_name ?? '',
    contact: row.contact ?? '',
    petName: row.pet_name ?? '',
    petSpecies: row.pet_species ?? '',
    category: row.inquiry_type ?? 'General inquiry',
    details: row.details ?? '',
    clinicId: row.clinic_id ?? '',
    clinicName: row.clinic_name ?? '',
    submittedAtISO: row.created_at,
    status: row.status,
  };
}
