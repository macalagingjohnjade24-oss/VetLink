import type { Appointment } from '../data/mockAppointments';
import { requireSupabase } from '../lib/supabase';
import { offlineData, offlineMode } from '../offline/offlineBackend';
import { mapAppointment, type AppointmentRow } from '../types/backend';
import { timeLabelToISO } from '../utils/petFormat';

export type CreateAppointmentInput = {
  ownerId: string;
  clinicId: string;
  petId: string;
  serviceId: string;
  serviceName: string;
  price: number;
  /** YYYY-MM-DD (a time component is ignored). */
  dateISO: string;
  /** "10:00 AM" */
  timeLabel: string;
  ownerName: string;
  contact: string;
  reason?: string;
  symptoms?: string;
  notes?: string;
  attachmentName?: string | null;
};

export type ClinicAppointmentPatch = {
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

const activeStatuses = ['pending', 'confirmed', 'rescheduled'];

export const appointmentService = {
  async list(): Promise<Appointment[]> {
    if (offlineMode.isActive()) return offlineData.appointments();
    const { data, error } = await requireSupabase()
      .from('appointments')
      .select('*')
      .order('appointment_date', { ascending: false });
    if (error) throw new Error(error.message);
    return (data as AppointmentRow[]).map(mapAppointment);
  },

  async upcoming(): Promise<Appointment[]> {
    if (offlineMode.isActive()) return offlineData.upcomingAppointments();
    const { data, error } = await requireSupabase()
      .from('appointments')
      .select('*')
      .in('status', activeStatuses)
      .order('appointment_date', { ascending: true });
    if (error) throw new Error(error.message);
    return (data as AppointmentRow[]).map(mapAppointment);
  },

  async getById(id: string): Promise<Appointment | null> {
    if (offlineMode.isActive()) return offlineData.appointmentById(id);
    const { data, error } = await requireSupabase().from('appointments').select('*').eq('id', id).maybeSingle();
    if (error) throw new Error(error.message);
    return data ? mapAppointment(data as AppointmentRow) : null;
  },

  /** Creates the booking request; the database generates the VL-… reference. */
  async create(input: CreateAppointmentInput): Promise<Appointment> {
    if (offlineMode.isActive()) return offlineData.createAppointment(input);
    const { data, error } = await requireSupabase()
      .from('appointments')
      .insert({
        owner_id: input.ownerId,
        clinic_id: input.clinicId,
        pet_id: input.petId,
        service_id: input.serviceId,
        service_name: input.serviceName,
        price: input.price,
        appointment_date: input.dateISO.slice(0, 10),
        appointment_time: timeLabelToISO(input.timeLabel),
        reason_for_visit: input.reason?.trim() || null,
        additional_notes: input.notes?.trim() || null,
        symptoms: input.symptoms?.trim() || null,
        attachment_name: input.attachmentName ?? null,
        owner_name: input.ownerName,
        contact: input.contact,
        status: 'pending',
      })
      .select('*')
      .single();
    if (error) {
      if (/duplicate key|unique constraint/i.test(error.message)) {
        throw new Error('That time was just requested by another owner. Please pick a different slot.');
      }
      throw new Error(error.message);
    }
    return mapAppointment(data as AppointmentRow);
  },

  /** Owner requests cancellation; the clinic confirms it from their console. */
  async requestCancellation(id: string, reason: string, note?: string): Promise<Appointment> {
    if (offlineMode.isActive()) return offlineData.requestCancellation(id, reason, note);
    const { data, error } = await requireSupabase()
      .from('appointments')
      .update({
        cancellation_requested: true,
        cancellation_reason: [reason, note].filter(Boolean).join(' — ') || reason,
        reschedule_requested: false,
      })
      .eq('id', id)
      .select('*')
      .single();
    if (error) throw new Error(error.message);
    return mapAppointment(data as AppointmentRow);
  },

  /** Owner asks for a new date/time; the original slot stays until the clinic answers. */
  async requestReschedule(id: string, dateISO: string, timeLabel: string, reason?: string): Promise<Appointment> {
    if (offlineMode.isActive()) return offlineData.requestReschedule(id, dateISO, timeLabel, reason);
    const { data, error } = await requireSupabase()
      .from('appointments')
      .update({
        reschedule_requested: true,
        requested_date: dateISO.slice(0, 10),
        requested_time: timeLabelToISO(timeLabel),
        reschedule_reason: reason?.trim() || null,
      })
      .eq('id', id)
      .select('*')
      .single();
    if (error) throw new Error(error.message);
    return mapAppointment(data as AppointmentRow);
  },

  /** Clinic-side action (accept / decline / move / complete). */
  async clinicUpdate(id: string, patch: ClinicAppointmentPatch): Promise<Appointment> {
    if (offlineMode.isActive()) return offlineData.clinicUpdate(id, patch);
    const { data, error } = await requireSupabase()
      .from('appointments')
      .update(patch)
      .eq('id', id)
      .select('*')
      .single();
    if (error) throw new Error(error.message);
    return mapAppointment(data as AppointmentRow);
  },
};
