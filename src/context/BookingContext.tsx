import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { APPOINTMENTS, type Appointment, type AppointmentStatus } from '../data/mockAppointments';
import { usePets } from './PetContext';
import { CLINICS } from '../data/mockClinics';
import { bookingService } from '../services/bookingService';
import { STORAGE_KEYS, storage } from '../services/storage';

export type BookingDraft = {
  clinicId: string | null;
  petId: string | null;
  serviceId: string | null;
  dateISO: string | null;
  time: string | null;
  ownerName: string;
  contact: string;
  reason: string;
  symptoms: string;
  notes: string;
  attachmentName: string | null;
};

export const emptyDraft: BookingDraft = {
  clinicId: null,
  petId: null,
  serviceId: null,
  dateISO: null,
  time: null,
  ownerName: 'Alex Santos',
  contact: '+63 917 555 0142',
  reason: '',
  symptoms: '',
  notes: '',
  attachmentName: null,
};

type BookingContextValue = {
  draft: BookingDraft;
  updateDraft: (patch: Partial<BookingDraft>) => void;
  resetDraft: () => void;
  /** Starts a fresh request, optionally seeded with the clinic/service the owner tapped in the locator. */
  startBooking: (seed?: { clinicId?: string; petId?: string; serviceId?: string }) => void;
  appointments: Appointment[];
  submitBooking: () => Promise<Appointment>;
  cancelAppointment: (id: string, reason: string, note?: string) => Promise<void>;
  rescheduleAppointment: (id: string, dateISO: string, time: string, reason?: string) => Promise<void>;
  /** Clinic side of the flow: answer the request on the appointment, or close a confirmed visit. */
  clinicUpdateAppointment: (id: string, action: ClinicAction) => Promise<void>;
  getAppointment: (id: string) => Appointment | null;
};

export type ClinicAction = 'accept' | 'decline' | 'complete';

const BookingContext = createContext<BookingContextValue | null>(null);

export function BookingProvider({ children }: { children: React.ReactNode }) {
  const { pets } = usePets();
  const [draft, setDraft] = useState<BookingDraft>(emptyDraft);
  const [created, setCreated] = useState<Appointment[]>([]);
  const [overrides, setOverrides] = useState<Record<string, Partial<Appointment>>>({});

  const loadCreated = useCallback(async () => {
    const [saved, savedOverrides] = await Promise.all([
      storage.get<Appointment[]>(STORAGE_KEYS.createdAppointments),
      storage.get<Record<string, Partial<Appointment>>>(STORAGE_KEYS.appointmentOverrides),
    ]);
    setCreated(saved ?? []);
    setOverrides(savedOverrides ?? {});
  }, []);

  useEffect(() => {
    void loadCreated();
  }, [loadCreated]);

  const updateDraft = useCallback((patch: Partial<BookingDraft>) => {
    setDraft((current) => ({ ...current, ...patch }));
  }, []);

  const resetDraft = useCallback(() => setDraft(emptyDraft), []);

  const startBooking = useCallback((seed?: { clinicId?: string; petId?: string; serviceId?: string }) => {
    setDraft({
      ...emptyDraft,
      clinicId: seed?.clinicId ?? null,
      petId: seed?.petId ?? null,
      serviceId: seed?.serviceId ?? null,
    });
  }, []);

  /** Mock appointments are static, so status and reschedule changes live in an override map. */
  const appointments = useMemo(() => {
    const all = [...created, ...APPOINTMENTS].map((appointment) =>
      overrides[appointment.id] ? { ...appointment, ...overrides[appointment.id] } : appointment,
    );
    return all.sort((a, b) => a.dateISO.localeCompare(b.dateISO));
  }, [created, overrides]);

  const persist = useCallback(async (next: Appointment[]) => {
    setCreated(next);
    await storage.set(STORAGE_KEYS.createdAppointments, next);
  }, []);

  const submitBooking = useCallback(async () => {
    const clinic = CLINICS.find((item) => item.id === draft.clinicId);
    const pet = pets.find((item) => item.id === draft.petId);
    const service = clinic?.services.find((item) => item.id === draft.serviceId);
    if (!clinic || !pet || !service || !draft.dateISO || !draft.time) {
      throw new Error('The booking request is incomplete.');
    }

    const reference = bookingService.buildReference(draft.dateISO, created.length + APPOINTMENTS.length);
    const appointment: Appointment = {
      id: `apt_${Date.now()}`,
      reference,
      clinicId: clinic.id,
      petId: pet.id,
      serviceId: service.id,
      serviceName: service.name,
      dateISO: draft.dateISO,
      timeLabel: draft.time,
      dateLabel: bookingService.formatShortDate(draft.dateISO),
      status: 'Pending',
      price: service.price,
      notes: draft.notes,
      ownerName: draft.ownerName,
      contact: draft.contact,
      reason: draft.reason,
      symptoms: draft.symptoms,
      attachmentName: draft.attachmentName,
      createdAt: new Date().toISOString(),
    };

    await persist([appointment, ...created]);
    return appointment;
  }, [created, draft, persist, pets]);

  const applyOverride = useCallback(async (id: string, patch: Partial<Appointment>) => {
    const next = { ...overrides, [id]: { ...overrides[id], ...patch } };
    setOverrides(next);
    await storage.set(STORAGE_KEYS.appointmentOverrides, next);
  }, [overrides]);

  const cancelAppointment = useCallback(
    async (id: string, reason: string, note?: string) => {
      await applyOverride(id, {
        status: 'Cancellation requested' as AppointmentStatus,
        cancellationReason: reason,
        cancellationNote: note,
        clinicNote: undefined,
      });
    },
    [applyOverride],
  );

  const rescheduleAppointment = useCallback(
    async (id: string, dateISO: string, time: string, reason?: string) => {
      await applyOverride(id, {
        status: 'Reschedule requested' as AppointmentStatus,
        requestedDateISO: dateISO,
        requestedTime: time,
        rescheduleReason: reason,
      });
    },
    [applyOverride],
  );

  const clinicUpdateAppointment = useCallback(
    async (id: string, action: ClinicAction) => {
      const appointment = appointments.find((item) => item.id === id);
      if (!appointment) return;
      const { status, requestedDateISO, requestedTime } = appointment;

      if (action === 'complete') {
        if (status !== 'Confirmed') return;
        await applyOverride(id, {
          status: 'Completed' as AppointmentStatus,
          clinicNote: 'The clinic marked this visit as complete.',
        });
        return;
      }

      if (action === 'accept') {
        if (status === 'Pending') {
          await applyOverride(id, {
            status: 'Confirmed' as AppointmentStatus,
            clinicNote: 'The clinic accepted your booking request.',
          });
          return;
        }
        if (status === 'Reschedule requested' && requestedDateISO && requestedTime) {
          await applyOverride(id, {
            status: 'Confirmed' as AppointmentStatus,
            dateISO: requestedDateISO,
            timeLabel: requestedTime,
            dateLabel: bookingService.formatShortDate(requestedDateISO),
            requestedDateISO: undefined,
            requestedTime: undefined,
            rescheduleReason: undefined,
            clinicNote: `The clinic moved your visit to ${bookingService.formatShortDate(requestedDateISO)} at ${requestedTime}.`,
          });
          return;
        }
        if (status === 'Cancellation requested') {
          await applyOverride(id, {
            status: 'Cancelled' as AppointmentStatus,
            clinicNote: 'The clinic confirmed the cancellation.',
          });
        }
        return;
      }

      if (status === 'Pending') {
        await applyOverride(id, {
          status: 'Rejected' as AppointmentStatus,
          clinicNote: 'The clinic could not fit this request in. Please choose another time.',
        });
      } else if (status === 'Reschedule requested') {
        await applyOverride(id, {
          status: 'Confirmed' as AppointmentStatus,
          requestedDateISO: undefined,
          requestedTime: undefined,
          rescheduleReason: undefined,
          clinicNote: 'The clinic declined the new time. Your original appointment still stands.',
        });
      } else if (status === 'Cancellation requested') {
        await applyOverride(id, {
          status: 'Confirmed' as AppointmentStatus,
          clinicNote: 'The clinic declined the cancellation and still expects you.',
        });
      }
    },
    [appointments, applyOverride],
  );

  const getAppointment = useCallback(
    (id: string) => appointments.find((appointment) => appointment.id === id) ?? null,
    [appointments],
  );

  const value = useMemo<BookingContextValue>(
    () => ({
      draft,
      updateDraft,
      resetDraft,
      startBooking,
      appointments,
      submitBooking,
      cancelAppointment,
      rescheduleAppointment,
      clinicUpdateAppointment,
      getAppointment,
    }),
    [
      draft,
      updateDraft,
      resetDraft,
      startBooking,
      appointments,
      submitBooking,
      cancelAppointment,
      rescheduleAppointment,
      clinicUpdateAppointment,
      getAppointment,
    ],
  );

  return <BookingContext.Provider value={value}>{children}</BookingContext.Provider>;
}

export function useBooking() {
  const context = useContext(BookingContext);
  if (!context) throw new Error('useBooking must be used inside <BookingProvider>.');
  return context;
}
