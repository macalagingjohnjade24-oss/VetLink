import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { Appointment, AppointmentStatus } from '../data/mockAppointments';
import { CLINICS } from '../data/mockClinics';
import { appointmentService } from '../services/appointmentService';
import { bookingService } from '../services/bookingService';
import { errorMessage } from '../utils/errors';
import { useAuth } from './AuthContext';
import { usePets } from './PetContext';

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
  ownerName: '',
  contact: '',
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
  loadingAppointments: boolean;
  /** Set when the appointments query fails, so screens can show a retry state. */
  error: string | null;
  refreshAppointments: () => Promise<void>;
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
  const { user } = useAuth();
  const { pets } = usePets();
  const [draft, setDraft] = useState<BookingDraft>(emptyDraft);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loadingAppointments, setLoadingAppointments] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refreshAppointments = useCallback(async () => {
    if (!user) {
      setAppointments([]);
      setError(null);
      setLoadingAppointments(false);
      return;
    }
    setError(null);
    try {
      setAppointments(await appointmentService.list());
    } catch (err) {
      setAppointments([]);
      setError(errorMessage(err, 'We couldn’t load your appointments.'));
    } finally {
      setLoadingAppointments(false);
    }
  }, [user]);

  useEffect(() => {
    setLoadingAppointments(true);
    void refreshAppointments();
  }, [refreshAppointments]);

  const ownerDefaults = useCallback(
    () => ({
      ownerName: `${user?.firstName ?? ''} ${user?.lastName ?? ''}`.trim(),
      contact: user?.mobile || user?.email || '',
    }),
    [user],
  );

  const updateDraft = useCallback((patch: Partial<BookingDraft>) => {
    setDraft((current) => ({ ...current, ...patch }));
  }, []);

  const resetDraft = useCallback(() => setDraft(emptyDraft), []);

  const startBooking = useCallback(
    (seed?: { clinicId?: string; petId?: string; serviceId?: string }) => {
      setDraft({
        ...emptyDraft,
        ...ownerDefaults(),
        clinicId: seed?.clinicId ?? null,
        petId: seed?.petId ?? null,
        serviceId: seed?.serviceId ?? null,
      });
    },
    [ownerDefaults],
  );

  const submitBooking = useCallback(async () => {
    if (!user) throw new Error('Sign in again to book an appointment.');
    const clinic = CLINICS.find((item) => item.id === draft.clinicId);
    const pet = pets.find((item) => item.id === draft.petId);
    const service = clinic?.services.find((item) => item.id === draft.serviceId);
    if (!clinic || !pet || !service || !draft.dateISO || !draft.time) {
      throw new Error('The booking request is incomplete.');
    }

    const appointment = await appointmentService.create({
      ownerId: user.id,
      clinicId: clinic.id,
      petId: pet.id,
      serviceId: service.id,
      serviceName: service.name,
      price: service.price,
      dateISO: draft.dateISO,
      timeLabel: draft.time,
      ownerName: draft.ownerName,
      contact: draft.contact,
      reason: draft.reason,
      symptoms: draft.symptoms,
      notes: draft.notes,
      attachmentName: draft.attachmentName,
    });
    await refreshAppointments();
    return appointment;
  }, [draft, pets, refreshAppointments, user]);

  const cancelAppointment = useCallback(
    async (id: string, reason: string, note?: string) => {
      await appointmentService.requestCancellation(id, reason, note);
      await refreshAppointments();
    },
    [refreshAppointments],
  );

  const rescheduleAppointment = useCallback(
    async (id: string, dateISO: string, time: string, reason?: string) => {
      await appointmentService.requestReschedule(id, dateISO, time, reason);
      await refreshAppointments();
    },
    [refreshAppointments],
  );

  const clinicUpdateAppointment = useCallback(
    async (id: string, action: ClinicAction) => {
      const appointment = appointments.find((item) => item.id === id);
      if (!appointment) return;
      const { status, requestedDateISO, requestedTime } = appointment;

      if (action === 'complete') {
        if (status !== 'Confirmed') return;
        await appointmentService.clinicUpdate(id, {
          status: 'completed',
          clinic_note: 'The clinic marked this visit as complete.',
        });
        await refreshAppointments();
        return;
      }

      if (action === 'accept') {
        if (status === 'Pending') {
          await appointmentService.clinicUpdate(id, {
            status: 'confirmed',
            clinic_note: 'The clinic accepted your booking request.',
          });
        } else if (status === 'Reschedule requested' && requestedDateISO && requestedTime) {
          await appointmentService.clinicUpdate(id, {
            status: 'confirmed',
            appointment_date: requestedDateISO.slice(0, 10),
            appointment_time: requestedTime,
            reschedule_requested: false,
            requested_date: null,
            requested_time: null,
            reschedule_reason: null,
            clinic_note: `The clinic moved your visit to ${bookingService.formatShortDate(requestedDateISO)} at ${requestedTime}.`,
          });
        } else if (status === 'Cancellation requested') {
          await appointmentService.clinicUpdate(id, {
            status: 'cancelled',
            cancellation_requested: false,
            clinic_note: 'The clinic confirmed the cancellation.',
          });
        }
        await refreshAppointments();
        return;
      }

      if (status === 'Pending') {
        await appointmentService.clinicUpdate(id, {
          status: 'rejected',
          clinic_note: 'The clinic could not fit this request in. Please choose another time.',
        });
      } else if (status === 'Reschedule requested') {
        await appointmentService.clinicUpdate(id, {
          status: 'confirmed',
          reschedule_requested: false,
          requested_date: null,
          requested_time: null,
          reschedule_reason: null,
          clinic_note: 'The clinic declined the new time. Your original appointment still stands.',
        });
      } else if (status === 'Cancellation requested') {
        await appointmentService.clinicUpdate(id, {
          status: 'confirmed',
          cancellation_requested: false,
          clinic_note: 'The clinic declined the cancellation and still expects you.',
        });
      }
      await refreshAppointments();
    },
    [appointments, refreshAppointments],
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
      loadingAppointments,
      error,
      refreshAppointments,
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
      loadingAppointments,
      error,
      refreshAppointments,
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
