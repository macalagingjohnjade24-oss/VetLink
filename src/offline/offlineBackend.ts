/**
 * Offline mode.
 *
 * A clearly labelled, session-only demo of VetLink so the screens can be used
 * before a Supabase project is connected. It never talks to the network, never
 * writes to a clinic and never pretends to be real data:
 *  - the data is seeded from the bundled mock catalogues,
 *  - changes live in memory only and are dropped when offline mode exits or the
 *    app restarts,
 *  - the offline banner (components/Screen.tsx) is shown on every screen.
 *
 * Live mode is unaffected: services only consult this module when
 * `offlineMode.isActive()` is true.
 */
import type { ImageSourcePropType } from 'react-native';
import type { Appointment, AppointmentStatus } from '../data/mockAppointments';
import { APPOINTMENTS } from '../data/mockAppointments';
import type { AppNotification } from '../data/mockNotifications';
import { NOTIFICATIONS } from '../data/mockNotifications';
import type { Pet, PetGender, PetSpecies } from '../data/mockPets';
import { PETS } from '../data/mockPets';
import type { MedicalRecord } from '../data/mockMedicalRecords';
import { MEDICAL_RECORDS } from '../data/mockMedicalRecords';
import type { Vaccination } from '../data/mockVaccinations';
import { VACCINATIONS } from '../data/mockVaccinations';
import type { UserAccount } from '../data/mockUsers';
import type { InquiryCategory } from '../data/mockAssistant';
import { bookingService } from '../services/bookingService';
import { ageLabelFrom, formatTimeLabel, timeLabelToISO } from '../utils/petFormat';

/** Owner shown while offline. The seeded pets belong to this id. */
export const OFFLINE_ACCOUNT: UserAccount = {
  id: 'usr_demo_owner',
  firstName: 'Alex',
  lastName: 'Santos',
  email: 'offline@vetlink.local',
  mobile: '+63 917 555 0142',
  verified: true,
  address: 'Makati City, Metro Manila',
};

type OfflineState = {
  pets: Pet[];
  appointments: Appointment[];
  notifications: AppNotification[];
  medicalRecords: MedicalRecord[];
  vaccinations: Vaccination[];
  inquiries: OfflineInquiry[];
};

export type OfflineInquiry = {
  id: string;
  reference: string;
  ownerName: string;
  contact: string;
  petName: string;
  petSpecies: string;
  category: InquiryCategory;
  details: string;
  clinicId: string;
  clinicName: string;
  submittedAtISO: string;
};

type PetFields = {
  name: string;
  species: PetSpecies;
  breed: string;
  gender: PetGender;
  birthDate: string;
  weightKg: string;
  color: string;
  microchip: string;
  notes: string;
  photo?: ImageSourcePropType | null;
};

type AppointmentInput = {
  clinicId: string;
  petId: string;
  serviceId: string;
  serviceName: string;
  price: number;
  dateISO: string;
  timeLabel: string;
  ownerName: string;
  contact: string;
  reason?: string;
  symptoms?: string;
  notes?: string;
  attachmentName?: string | null;
};

type AppointmentPatch = {
  status?: string;
  appointment_date?: string;
  appointment_time?: string;
  clinic_note?: string;
  cancellation_requested?: boolean;
  reschedule_requested?: boolean;
  requested_date?: string | null;
  requested_time?: string | null;
  reschedule_reason?: string | null;
};

let active = false;
let state: OfflineState | null = null;

function seed(): OfflineState {
  return {
    pets: PETS.map((pet) => ({ ...pet })),
    appointments: APPOINTMENTS.map((appointment) => ({ ...appointment })),
    notifications: NOTIFICATIONS.map((notification) => ({ ...notification })),
    medicalRecords: MEDICAL_RECORDS.map((record) => ({ ...record, attachments: [...record.attachments] })),
    vaccinations: VACCINATIONS.map((vaccination) => ({ ...vaccination })),
    inquiries: [],
  };
}

function data(): OfflineState {
  if (!state) state = seed();
  return state;
}

const copy = <T,>(item: T): T => ({ ...item });

const shortDate = (dateISO: string) => {
  const date = new Date(`${dateISO.slice(0, 10)}T00:00:00`);
  if (Number.isNaN(date.getTime())) return dateISO;
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
};

const ACTIVE_STATUSES: AppointmentStatus[] = [
  'Pending',
  'Confirmed',
  'Reschedule requested',
  'Cancellation requested',
];

const STATUS_BY_KEY: Record<string, AppointmentStatus> = {
  pending: 'Pending',
  confirmed: 'Confirmed',
  rescheduled: 'Reschedule requested',
  cancelled: 'Cancelled',
  completed: 'Completed',
  rejected: 'Rejected',
};

function findAppointment(id: string): Appointment {
  const found = data().appointments.find((appointment) => appointment.id === id);
  if (!found) throw new Error('This appointment is no longer available.');
  return found;
}

function replaceAppointment(id: string, next: Appointment) {
  data().appointments = data().appointments.map((appointment) => (appointment.id === id ? next : appointment));
  return copy(next);
}

function applyPatch(appointment: Appointment, patch: AppointmentPatch): Appointment {
  const next: Appointment = { ...appointment };

  if (patch.status) next.status = STATUS_BY_KEY[patch.status] ?? next.status;

  if (patch.appointment_date) {
    const time = patch.appointment_time ?? timeLabelToISO(next.timeLabel);
    next.dateISO = `${patch.appointment_date.slice(0, 10)}T${time}`;
    next.dateLabel = shortDate(patch.appointment_date);
    next.timeLabel = formatTimeLabel(time);
  } else if (patch.appointment_time) {
    next.dateISO = `${next.dateISO.slice(0, 10)}T${patch.appointment_time}`;
    next.timeLabel = formatTimeLabel(patch.appointment_time);
  }

  if (patch.clinic_note !== undefined) next.clinicNote = patch.clinic_note;
  if (patch.cancellation_requested === false) {
    next.cancellationReason = undefined;
    if (!patch.status) next.status = 'Confirmed';
  }
  if (patch.reschedule_requested === false) {
    next.requestedDateISO = undefined;
    next.requestedTime = undefined;
    next.rescheduleReason = undefined;
  }
  if (patch.requested_date !== undefined) next.requestedDateISO = patch.requested_date ?? undefined;
  if (patch.requested_time) next.requestedTime = formatTimeLabel(patch.requested_time);
  if (patch.reschedule_reason !== undefined) next.rescheduleReason = patch.reschedule_reason ?? undefined;

  return next;
}

export const offlineMode = {
  isActive: () => active,
  /** Starts the session and reseeds the sample data. */
  activate() {
    active = true;
    state = seed();
  },
  deactivate() {
    active = false;
    state = null;
  },
};

export const offlineData = {
  pets(): Pet[] {
    return data().pets.map(copy);
  },

  petById(id: string): Pet | null {
    const found = data().pets.find((pet) => pet.id === id);
    return found ? copy(found) : null;
  },

  addPet(ownerId: string, input: PetFields): Pet {
    const pet: Pet = {
      id: `pet_offline_${Date.now()}`,
      ownerId,
      name: input.name.trim(),
      species: input.species,
      breed: input.breed.trim(),
      birthDate: input.birthDate,
      ageLabel: ageLabelFrom(input.birthDate),
      gender: input.gender,
      weightKg: Number(input.weightKg) || 0,
      color: input.color.trim(),
      microchip: input.microchip.trim() || undefined,
      notes: input.notes.trim() || undefined,
      photo: input.photo ?? null,
    };
    data().pets.push(pet);
    return copy(pet);
  },

  updatePet(id: string, input: PetFields): Pet {
    const pet = data().pets.find((item) => item.id === id);
    if (!pet) throw new Error('This pet is no longer in your profile.');
    const next: Pet = {
      ...pet,
      name: input.name.trim(),
      species: input.species,
      breed: input.breed.trim(),
      birthDate: input.birthDate,
      ageLabel: ageLabelFrom(input.birthDate),
      gender: input.gender,
      weightKg: Number(input.weightKg) || 0,
      color: input.color.trim(),
      microchip: input.microchip.trim() || undefined,
      notes: input.notes.trim() || undefined,
      photo: input.photo === undefined ? pet.photo : input.photo,
    };
    data().pets = data().pets.map((item) => (item.id === id ? next : item));
    return copy(next);
  },

  setPetPhoto(id: string, photo: ImageSourcePropType): Pet {
    const pet = data().pets.find((item) => item.id === id);
    if (!pet) throw new Error('This pet is no longer in your profile.');
    const next: Pet = { ...pet, photo };
    data().pets = data().pets.map((item) => (item.id === id ? next : item));
    return copy(next);
  },

  removePet(id: string) {
    data().pets = data().pets.filter((pet) => pet.id !== id);
  },

  appointments(): Appointment[] {
    return [...data().appointments].sort((a, b) => b.dateISO.localeCompare(a.dateISO)).map(copy);
  },

  upcomingAppointments(): Appointment[] {
    return data()
      .appointments.filter((appointment) => ACTIVE_STATUSES.includes(appointment.status))
      .sort((a, b) => a.dateISO.localeCompare(b.dateISO))
      .map(copy);
  },

  appointmentById(id: string): Appointment | null {
    const found = data().appointments.find((appointment) => appointment.id === id);
    return found ? copy(found) : null;
  },

  createAppointment(input: AppointmentInput): Appointment {
    const dateOnly = input.dateISO.slice(0, 10);
    const clash = data().appointments.find(
      (appointment) =>
        appointment.clinicId === input.clinicId &&
        appointment.dateISO.slice(0, 10) === dateOnly &&
        appointment.timeLabel === input.timeLabel &&
        appointment.status !== 'Cancelled' &&
        appointment.status !== 'Rejected',
    );
    if (clash) {
      throw new Error('That time has already been requested at this clinic. Please pick a different slot.');
    }

    const appointment: Appointment = {
      id: `apt_offline_${Date.now()}`,
      reference: bookingService.buildReference(input.dateISO, data().appointments.length),
      clinicId: input.clinicId,
      petId: input.petId,
      serviceId: input.serviceId,
      serviceName: input.serviceName,
      dateISO: `${dateOnly}T${timeLabelToISO(input.timeLabel)}`,
      timeLabel: input.timeLabel,
      dateLabel: shortDate(input.dateISO),
      status: 'Pending',
      price: input.price,
      ownerName: input.ownerName,
      contact: input.contact,
      reason: input.reason?.trim() || undefined,
      symptoms: input.symptoms?.trim() || undefined,
      notes: input.notes?.trim() || undefined,
      attachmentName: input.attachmentName ?? null,
      createdAt: new Date().toISOString(),
    };
    data().appointments.push(appointment);
    return copy(appointment);
  },

  requestCancellation(id: string, reason: string, note?: string): Appointment {
    const appointment = findAppointment(id);
    return replaceAppointment(id, {
      ...appointment,
      status: 'Cancellation requested',
      cancellationReason: [reason, note].filter(Boolean).join(' — ') || reason,
      cancellationNote: note,
    });
  },

  requestReschedule(id: string, dateISO: string, timeLabel: string, reason?: string): Appointment {
    const appointment = findAppointment(id);
    return replaceAppointment(id, {
      ...appointment,
      status: 'Reschedule requested',
      requestedDateISO: dateISO.slice(0, 10),
      requestedTime: timeLabel,
      rescheduleReason: reason?.trim() || undefined,
    });
  },

  clinicUpdate(id: string, patch: AppointmentPatch): Appointment {
    const appointment = findAppointment(id);
    return replaceAppointment(id, applyPatch(appointment, patch));
  },

  notifications(): AppNotification[] {
    return data().notifications.map(copy);
  },

  notificationById(id: string): AppNotification | null {
    const found = data().notifications.find((notification) => notification.id === id);
    return found ? copy(found) : null;
  },

  markNotificationRead(id: string) {
    data().notifications = data().notifications.map((notification) =>
      notification.id === id ? { ...notification, read: true } : notification,
    );
  },

  markAllNotificationsRead() {
    data().notifications = data().notifications.map((notification) => ({ ...notification, read: true }));
  },

  medicalRecordsFor(petId: string): MedicalRecord[] {
    return data()
      .medicalRecords.filter((record) => record.petId === petId)
      .sort((a, b) => b.dateISO.localeCompare(a.dateISO))
      .map(copy);
  },

  medicalRecordById(id: string): MedicalRecord | null {
    const found = data().medicalRecords.find((record) => record.id === id);
    return found ? copy(found) : null;
  },

  vaccinations(): Vaccination[] {
    return data()
      .vaccinations.slice()
      .sort((a, b) => (a.nextDueISO ?? '9999').localeCompare(b.nextDueISO ?? '9999'))
      .map(copy);
  },

  vaccinationsFor(petId: string): Vaccination[] {
    return data()
      .vaccinations.filter((vaccination) => vaccination.petId === petId)
      .sort((a, b) => (b.administeredOn ?? '').localeCompare(a.administeredOn ?? ''))
      .map(copy);
  },

  vaccinationById(id: string): Vaccination | null {
    const found = data().vaccinations.find((vaccination) => vaccination.id === id);
    return found ? copy(found) : null;
  },

  submitInquiry(input: Omit<OfflineInquiry, 'id' | 'reference' | 'submittedAtISO'>): OfflineInquiry {
    const inquiry: OfflineInquiry = {
      ...input,
      id: `inq_offline_${Date.now()}`,
      reference: `INQ-${String(data().inquiries.length + 1).padStart(4, '0')}`,
      submittedAtISO: new Date().toISOString(),
    };
    data().inquiries.push(inquiry);
    return copy(inquiry);
  },

  inquiryById(id: string): OfflineInquiry | null {
    const found = data().inquiries.find((inquiry) => inquiry.id === id);
    return found ? copy(found) : null;
  },
};
