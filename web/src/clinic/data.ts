import { supabase } from '@/lib/supabase';
import { formatClock, formatDate } from '@/lib/format';

/**
 * Everything the Clinic Administrator console reads.
 *
 * Every query is clinic-scoped: the caller passes the clinic id from their
 * active membership, and the RLS policies on clinics, clinic_services,
 * appointments and clinic_memberships decide what actually comes back. A
 * clinic id the caller does not belong to returns no rows (or an RPC refusal),
 * never another clinic's data.
 */

export type OperatingHours = {
  days?: number[];
  opens?: string;
  closes?: string;
  note?: string;
} | null;

export type ClinicProfile = {
  id: string;
  reference: string | null;
  clinic_name: string;
  description: string | null;
  email: string | null;
  contact_number: string | null;
  address: string | null;
  area: string | null;
  city: string | null;
  province: string | null;
  website: string | null;
  latitude: number | null;
  longitude: number | null;
  logo_url: string | null;
  cover_url: string | null;
  operating_hours: OperatingHours;
  year_established: number | null;
  emergency_service: boolean;
  has_availability: boolean;
  status: string;
  created_at: string;
  updated_at: string | null;
};

export type TrendPoint = { label: string; value: number };

/** Shape returned by public.clinic_dashboard(target_clinic). */
export type ClinicDashboardCounts = {
  clinic_id: string;
  appointments_total: number;
  appointments_pending: number;
  appointments_confirmed: number;
  appointments_completed: number;
  appointments_cancelled: number;
  appointments_today: number;
  requests_pending: number;
  owners_registered: number;
  pets_registered: number;
  services_active: number;
  services_total: number;
  staff_active: number;
  appointment_trend: TrendPoint[];
};

/** Only the columns the dashboard shows; the pet name comes from the appointment's pet. */
export type ClinicAppointment = {
  id: string;
  reference: string | null;
  appointment_date: string;
  appointment_time: string;
  status: string;
  owner_name: string | null;
  contact: string | null;
  service_name: string | null;
  reason_for_visit: string | null;
  cancellation_requested: boolean;
  reschedule_requested: boolean;
  created_at: string;
  updated_at: string | null;
  pets: { pet_name: string | null } | null;
};

export type TeamProfile = {
  id: string;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  mobile_number: string | null;
  profile_picture: string | null;
};

export type TeamMember = {
  id: string;
  user_id: string;
  staff_role: string;
  status: string;
  created_at: string;
  profile: TeamProfile | null;
};

// One literal, not a concatenation: supabase-js only infers the embedded
// `pets(...)` shape when the select string is a single literal type.
const APPOINTMENT_COLUMNS = 'id,reference,appointment_date,appointment_time,status,owner_name,contact,service_name,reason_for_visit,cancellation_requested,reschedule_requested,created_at,updated_at,pets!appointments_pet_id_fkey(pet_name)' as const;

function failure(error: { message: string } | null) {
  if (error) throw new Error(error.message);
}

/** `YYYY-MM-DD` in the browser's timezone, so "today" matches the date the user sees. */
export function todayIso(): string {
  const now = new Date();
  const local = new Date(now.getTime() - now.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 10);
}

export async function fetchClinicProfile(clinicId: string): Promise<ClinicProfile | null> {
  const { data, error } = await supabase
    .from('clinics')
    .select('*')
    .eq('id', clinicId)
    .maybeSingle();
  failure(error);
  return (data ?? null) as ClinicProfile | null;
}

export async function fetchClinicDashboard(clinicId: string): Promise<ClinicDashboardCounts> {
  const { data, error } = await supabase.rpc('clinic_dashboard', { target_clinic: clinicId });
  failure(error);
  return data as ClinicDashboardCounts;
}

/** The day's schedule: live bookings only, earliest first. */
export async function fetchClinicSchedule(
  clinicId: string,
  date: string,
): Promise<ClinicAppointment[]> {
  const { data, error } = await supabase
    .from('appointments')
    .select(APPOINTMENT_COLUMNS)
    .eq('clinic_id', clinicId)
    .eq('appointment_date', date)
    .in('status', ['pending', 'confirmed', 'rescheduled'])
    .order('appointment_time', { ascending: true });
  failure(error);
  return (data ?? []) as unknown as ClinicAppointment[];
}

/**
 * The columns AM-05's calendar reads. The vet is whichever assignment the
 * booking carries; the two columns exist for historical reasons, so the screen
 * resolves `assigned_vet_user_id ?? veterinarian_id` exactly like AM-02.
 */
export type CalendarAppointment = {
  id: string;
  reference: string | null;
  appointment_date: string;
  appointment_time: string;
  status: string;
  owner_name: string | null;
  service_name: string | null;
  assigned_vet_user_id: string | null;
  veterinarian_id: string | null;
  pets: { pet_name: string | null } | null;
};

const CALENDAR_COLUMNS =
  'id,reference,appointment_date,appointment_time,status,owner_name,service_name,assigned_vet_user_id,veterinarian_id,pets!appointments_pet_id_fkey(pet_name)' as const;

/**
 * Every booking dated inside the range, earliest first. Both dates are
 * inclusive `YYYY-MM-DD` values, and the appointments policy still decides
 * which rows this account may see.
 */
export async function fetchClinicCalendar(
  clinicId: string,
  from: string,
  to: string,
): Promise<CalendarAppointment[]> {
  const { data, error } = await supabase
    .from('appointments')
    .select(CALENDAR_COLUMNS)
    .eq('clinic_id', clinicId)
    .gte('appointment_date', from)
    .lte('appointment_date', to)
    .order('appointment_date', { ascending: true })
    .order('appointment_time', { ascending: true });
  failure(error);
  return (data ?? []) as unknown as CalendarAppointment[];
}

/** Requests still waiting on a decision, longest wait first so nothing is missed. */
export async function fetchAppointmentRequests(
  clinicId: string,
  limit = 5,
): Promise<ClinicAppointment[]> {
  const { data, error } = await supabase
    .from('appointments')
    .select(APPOINTMENT_COLUMNS)
    .eq('clinic_id', clinicId)
    .eq('status', 'pending')
    .order('created_at', { ascending: true })
    .limit(limit);
  failure(error);
  return (data ?? []) as unknown as ClinicAppointment[];
}

/** Newest touched appointments — real clinic activity, not an audit feed. */
export async function fetchRecentAppointmentActivity(
  clinicId: string,
  limit = 6,
): Promise<ClinicAppointment[]> {
  const { data, error } = await supabase
    .from('appointments')
    .select(APPOINTMENT_COLUMNS)
    .eq('clinic_id', clinicId)
    .order('updated_at', { ascending: false, nullsFirst: false })
    .limit(limit);
  failure(error);
  return (data ?? []) as unknown as ClinicAppointment[];
}

/** Live bookings dated after `after`, soonest first — the front desk's next few. */
export async function fetchUpcomingAppointments(
  clinicId: string,
  after: string,
  limit = 6,
): Promise<ClinicAppointment[]> {
  const { data, error } = await supabase
    .from('appointments')
    .select(APPOINTMENT_COLUMNS)
    .eq('clinic_id', clinicId)
    .gt('appointment_date', after)
    .in('status', ['pending', 'confirmed', 'rescheduled'])
    .order('appointment_date', { ascending: true })
    .order('appointment_time', { ascending: true })
    .limit(limit);
  failure(error);
  return (data ?? []) as unknown as ClinicAppointment[];
}

/**
 * The columns AM-02 lists and its details view reads. Both assignment columns
 * exist — `veterinarian_id` from 0004 and `assigned_vet_user_id` from 0008 — so
 * the console shows whichever one the booking actually carries.
 */
export type ManagedAppointment = {
  id: string;
  owner_id: string;
  reference: string | null;
  appointment_date: string;
  appointment_time: string;
  status: string;
  owner_name: string | null;
  contact: string | null;
  service_name: string | null;
  price: number;
  reason_for_visit: string | null;
  additional_notes: string | null;
  clinic_note: string | null;
  cancellation_requested: boolean;
  cancellation_reason: string | null;
  reschedule_requested: boolean;
  requested_date: string | null;
  requested_time: string | null;
  reschedule_reason: string | null;
  veterinarian_id: string | null;
  assigned_vet_user_id: string | null;
  created_at: string;
  updated_at: string | null;
  pets: { pet_name: string | null } | null;
};

const MANAGED_APPOINTMENT_COLUMNS = 'id,owner_id,reference,appointment_date,appointment_time,status,owner_name,contact,service_name,price,reason_for_visit,additional_notes,clinic_note,cancellation_requested,cancellation_reason,reschedule_requested,requested_date,requested_time,reschedule_reason,veterinarian_id,assigned_vet_user_id,created_at,updated_at,pets!appointments_pet_id_fkey(pet_name)' as const;

export type AppointmentFilters = {
  /** `YYYY-MM-DD`, or '' for every date. */
  date: string;
  /** An appointment status, or 'all'. */
  status: string;
  /** The service name recorded on the booking, or 'all'. */
  service: string;
};

/**
 * Every appointment this clinic's staff can see, newest visit first. The
 * filters run in Postgres against the booking's own snapshot columns, so a
 * service that was renamed or removed still finds the bookings it names.
 */
export async function fetchClinicAppointmentList(
  clinicId: string,
  filters: AppointmentFilters,
): Promise<ManagedAppointment[]> {
  let query = supabase
    .from('appointments')
    .select(MANAGED_APPOINTMENT_COLUMNS)
    .eq('clinic_id', clinicId);

  if (filters.status !== 'all') query = query.eq('status', filters.status);
  if (filters.service !== 'all') query = query.eq('service_name', filters.service);
  if (filters.date) query = query.eq('appointment_date', filters.date);

  const { data, error } = await query
    .order('appointment_date', { ascending: false })
    .order('appointment_time', { ascending: false });
  failure(error);
  return (data ?? []) as unknown as ManagedAppointment[];
}

/**
 * One owner the clinic knows: the account details its staff may read, the pets on
 * the account, and when it joined the clinic's records.
 */
export type ClinicOwner = {
  owner_id: string;
  name: string;
  email: string | null;
  contact: string | null;
  pet_count: number;
  /** The first pet on the account, for the lists that name one. */
  pet_name: string | null;
  /** When the account joined this clinic's records, for the owner list. */
  registered_at: string | null;
  /** The moment this clinic first knew them: its first booking or the register. */
  known_at: string | null;
  /** Which of those two came first. */
  source: 'booking' | 'registration';
};

type OwnerBookingRow = {
  owner_id: string;
  owner_name: string | null;
  contact: string | null;
  created_at: string;
  pets: { pet_name: string | null } | null;
};

type OwnerProfileRow = {
  id: string;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  mobile_number: string | null;
  created_at: string;
};

type OwnerRegistrationRow = { owner_id: string; created_at: string };

/**
 * The owners this clinic knows: the ones it registered at the front desk (0017)
 * and the ones behind its bookings, newest registered account first. An owner
 * registered here is reported before their first booking, so the front desk can
 * book for them; the profile and pet policies still decide how much of each
 * account is readable, and a booking's own name and contact stand in when the
 * profile is not readable.
 *
 * Every console owner list reads this, so the owner list and the appointment
 * dashboard cannot disagree about who the clinic's owners are or how many pets
 * they keep.
 */
export async function fetchClinicOwners(clinicId: string): Promise<ClinicOwner[]> {
  const [bookings, registrations] = await Promise.all([
    supabase
      .from('appointments')
      .select('owner_id,owner_name,contact,created_at,pets!appointments_pet_id_fkey(pet_name)')
      .eq('clinic_id', clinicId)
      .order('created_at', { ascending: true }),
    supabase
      .from('clinic_owner_registrations')
      .select('owner_id,created_at')
      .eq('clinic_id', clinicId),
  ]);
  failure(bookings.error);
  failure(registrations.error);

  const firstBooking = new Map<string, OwnerBookingRow>();
  for (const row of (bookings.data ?? []) as unknown as OwnerBookingRow[]) {
    if (!firstBooking.has(row.owner_id)) firstBooking.set(row.owner_id, row);
  }

  const registeredOn = new Map<string, string>();
  for (const row of (registrations.data ?? []) as OwnerRegistrationRow[]) {
    registeredOn.set(row.owner_id, row.created_at);
  }

  const ids = [...new Set([...firstBooking.keys(), ...registeredOn.keys()])];
  if (!ids.length) return [];

  const [profiles, pets] = await Promise.all([
    supabase
      .from('profiles')
      .select('id,first_name,last_name,email,mobile_number,created_at')
      .in('id', ids),
    supabase
      .from('pets')
      .select('owner_id,pet_name')
      .in('owner_id', ids)
      .order('pet_name', { ascending: true }),
  ]);
  failure(profiles.error);
  failure(pets.error);

  const profilesById = new Map(
    ((profiles.data ?? []) as OwnerProfileRow[]).map((profile) => [profile.id, profile]),
  );

  const petCounts = new Map<string, number>();
  const firstPet = new Map<string, string>();
  for (const pet of (pets.data ?? []) as { owner_id: string; pet_name: string | null }[]) {
    petCounts.set(pet.owner_id, (petCounts.get(pet.owner_id) ?? 0) + 1);
    if (pet.pet_name && !firstPet.has(pet.owner_id)) firstPet.set(pet.owner_id, pet.pet_name);
  }

  return ids
    .map((ownerId): ClinicOwner => {
      const booking = firstBooking.get(ownerId) ?? null;
      const registeredAt = registeredOn.get(ownerId) ?? null;
      const profile = profilesById.get(ownerId) ?? null;
      const profileName = `${profile?.first_name ?? ''} ${profile?.last_name ?? ''}`.trim();
      const registeredFirst =
        registeredAt !== null && (!booking || registeredAt < booking.created_at);
      const bookedPet = booking?.pets?.pet_name ?? null;
      const deskPet = firstPet.get(ownerId) ?? null;

      return {
        owner_id: ownerId,
        name: profileName || booking?.owner_name || 'Owner name not recorded',
        email: profile?.email ?? null,
        contact: profile?.mobile_number || booking?.contact || null,
        pet_count: petCounts.get(ownerId) ?? 0,
        // The pet the clinic met them through: the one on their first booking,
        // or the one filed at the desk for a registrant.
        pet_name: registeredFirst ? (deskPet ?? bookedPet) : (bookedPet ?? deskPet),
        registered_at: registeredAt ?? profile?.created_at ?? booking?.created_at ?? null,
        known_at: registeredFirst ? registeredAt : (booking?.created_at ?? registeredAt),
        source: registeredFirst ? 'registration' : 'booking',
      };
    })
    .sort((a, b) => (b.registered_at ?? '').localeCompare(a.registered_at ?? ''));
}

/** What AM-10 sends to the register-pet-owner Edge Function. */
export type PetOwnerRegistrationInput = {
  first_name: string;
  last_name: string;
  email: string;
  mobile_number: string;
  address: string;
  pet: {
    pet_name: string;
    species: string;
    breed: string;
    sex: string;
    date_of_birth: string;
    weight: string;
    color: string;
    microchip: string;
  } | null;
};

export type RegisteredPetOwner = {
  status: 'invited' | 'linked';
  owner_id: string;
  pet_id: string | null;
  email: string;
  message: string;
};

/**
 * Calls the register-pet-owner Edge Function. The function re-checks the
 * caller's active front-desk membership, then creates or links the owner's
 * account, writes the pet and files the clinic's register row with the service
 * role, which never reaches the browser.
 */
export async function registerClinicPetOwner(
  clinicId: string,
  input: PetOwnerRegistrationInput,
): Promise<RegisteredPetOwner> {
  const { data, error } = await supabase.functions.invoke('register-pet-owner', {
    body: { clinic_id: clinicId, ...input },
  });

  if (error) {
    let text = error.message;
    const context = (error as { context?: Response }).context;
    if (context && typeof context.json === 'function') {
      try {
        const payload = (await context.json()) as { error?: string; hint?: string };
        if (payload?.error) text = payload.hint ? `${payload.error} ${payload.hint}` : payload.error;
      } catch {
        /* keep the SDK message when the body is not JSON */
      }
    }
    throw new Error(text);
  }

  if (!data) throw new Error('The registration function returned no result.');
  return data as RegisteredPetOwner;
}

/** The service names this clinic's bookings actually carry, for the filter. */
export async function fetchAppointmentServiceNames(clinicId: string): Promise<string[]> {
  const { data, error } = await supabase
    .from('appointments')
    .select('service_name')
    .eq('clinic_id', clinicId)
    .not('service_name', 'is', null);
  failure(error);
  return [
    ...new Set(
      ((data ?? []) as { service_name: string | null }[])
        .map((row) => row.service_name)
        .filter((name): name is string => Boolean(name)),
    ),
  ].sort((a, b) => a.localeCompare(b));
}

/**
 * Every request still waiting on a decision, longest wait first. AM-03 reads
 * this queue, and the appointments SELECT policy keeps the rows inside the
 * caller's own clinic.
 */
export async function fetchPendingAppointmentRequests(
  clinicId: string,
): Promise<ManagedAppointment[]> {
  const { data, error } = await supabase
    .from('appointments')
    .select(MANAGED_APPOINTMENT_COLUMNS)
    .eq('clinic_id', clinicId)
    .eq('status', 'pending')
    .order('created_at', { ascending: true });
  failure(error);
  return (data ?? []) as unknown as ManagedAppointment[];
}

/**
 * AM-04's record: the booking, plus the pet row this clinic is allowed to read.
 * The booking keeps its own owner and pet names, so the page still renders
 * when the pet's record is outside what this account may read.
 */
export type AppointmentDetail = ManagedAppointment & {
  owner_id: string;
  pet_id: string;
  checked_in_at: string | null;
  pet: {
    pet_name: string | null;
    species: string | null;
    breed: string | null;
    sex: string | null;
    weight: number | null;
    date_of_birth: string | null;
  } | null;
};

const DETAIL_COLUMNS =
  'id,reference,appointment_date,appointment_time,status,owner_name,contact,service_name,price,reason_for_visit,additional_notes,clinic_note,cancellation_requested,cancellation_reason,reschedule_requested,requested_date,requested_time,reschedule_reason,veterinarian_id,assigned_vet_user_id,checked_in_at,created_at,updated_at,owner_id,pet_id,pets!appointments_pet_id_fkey(pet_name)' as const;

/** One booking from this clinic, or null when the row is not this clinic's. */
export async function fetchClinicAppointment(
  clinicId: string,
  appointmentId: string,
): Promise<AppointmentDetail | null> {
  const { data, error } = await supabase
    .from('appointments')
    .select(DETAIL_COLUMNS)
    .eq('clinic_id', clinicId)
    .eq('id', appointmentId)
    .maybeSingle();
  failure(error);
  if (!data) return null;

  const row = data as unknown as Omit<AppointmentDetail, 'pet'>;
  const { data: pet, error: petError } = await supabase
    .from('pets')
    .select('pet_name,species,breed,sex,weight,date_of_birth')
    .eq('id', row.pet_id)
    .maybeSingle();
  failure(petError);

  return { ...row, pet: (pet ?? null) as AppointmentDetail['pet'] };
}

/**
 * What the front desk decided about a pending request.
 *
 * Approve and reject move `pending` to `confirmed` or `rejected`, which the
 * transition trigger from 0008 allows an active receptionist or clinic
 * administrator to do. A reschedule proposal leaves the status pending: the
 * proposed slot goes into `clinic_note`, the note the Pet Owner app shows on
 * the appointment, so the owner can pick a time the clinic can actually keep
 * rather than having their request confirmed at a time they never chose.
 */
export type AppointmentDecision =
  | { action: 'approve'; note: string }
  | { action: 'reject'; note: string }
  | { action: 'reschedule'; date: string; time: string; note: string };

/**
 * Writes the decision and returns the row the database kept. `clinic_id` is
 * repeated in the filter, so the appointments policy decides whether this
 * account may write; zero rows means the request is gone, already decided or
 * no longer this clinic's.
 */
export async function decideAppointmentRequest(
  clinicId: string,
  appointmentId: string,
  decision: AppointmentDecision,
): Promise<ManagedAppointment> {
  const note = decision.note.trim();
  const patch =
    decision.action === 'approve'
      ? { status: 'confirmed', clinic_note: note || 'The clinic accepted your booking request.' }
      : decision.action === 'reject'
        ? {
            status: 'rejected',
            clinic_note: note || 'The clinic could not fit this request in. Please choose another time.',
          }
        : {
            clinic_note: [
              `The clinic proposes ${formatDate(decision.date)} at ${formatClock(decision.time)} instead.`,
              note,
            ]
              .filter(Boolean)
              .join(' '),
          };

  const { data, error } = await supabase
    .from('appointments')
    .update(patch)
    .eq('clinic_id', clinicId)
    .eq('id', appointmentId)
    .select(MANAGED_APPOINTMENT_COLUMNS)
    .maybeSingle();
  failure(error);
  if (!data) {
    throw new Error(
      'The request was not updated. It may have been decided already, or your access was revoked.',
    );
  }
  return data as unknown as ManagedAppointment;
}

/** A pet the clinic may read, for the booking form. */
export type ClinicPet = {
  id: string;
  pet_name: string;
  species: string | null;
  breed: string | null;
};

/** The registered pets of one owner, alphabetically. */
export async function fetchOwnerPets(ownerId: string): Promise<ClinicPet[]> {
  const { data, error } = await supabase
    .from('pets')
    .select('id,pet_name,species,breed')
    .eq('owner_id', ownerId)
    .order('pet_name', { ascending: true });
  failure(error);
  return (data ?? []) as ClinicPet[];
}

/**
 * The booking the front desk fills in. The owner's name and contact are stored
 * on the row as a snapshot, the same way an owner-made request carries them.
 */
export type NewAppointmentInput = {
  ownerId: string;
  petId: string;
  serviceId: string;
  serviceName: string;
  price: number;
  appointmentDate: string;
  appointmentTime: string;
  reasonForVisit: string | null;
  additionalNotes: string | null;
  assignedVetUserId: string | null;
};

export type CreatedAppointment = { id: string; reference: string | null };

/** The clinic's saved operating window, used to propose reschedule slots. */
export async function fetchClinicHours(clinicId: string): Promise<OperatingHours> {
  const { data, error } = await supabase
    .from('clinics')
    .select('operating_hours')
    .eq('id', clinicId)
    .maybeSingle();
  failure(error);
  return (data as { operating_hours: OperatingHours } | null)?.operating_hours ?? null;
}

export type RescheduleInput = { date: string; time: string; reason: string | null };

/**
 * Moves a booking to a new slot.
 *
 * The transition trigger from 0008 lets an active receptionist or clinic
 * administrator move `confirmed` to `rescheduled`; the same call also handles a
 * booking that was already rescheduled. The note records the slot it came from
 * and the reason, because the row keeps no per-change history, and the owner's
 * pending reschedule request, if any, is cleared now that it is answered.
 */
export async function rescheduleClinicAppointment(
  clinicId: string,
  appointment: { id: string; appointment_date: string; appointment_time: string },
  input: RescheduleInput,
): Promise<ManagedAppointment> {
  const moved = `Moved from ${formatDate(appointment.appointment_date)} at ${formatClock(
    appointment.appointment_time,
  )} to ${formatDate(input.date)} at ${formatClock(input.time)}.`;
  const reason = input.reason?.trim();

  const { data, error } = await supabase
    .from('appointments')
    .update({
      appointment_date: input.date,
      appointment_time: input.time,
      status: 'rescheduled',
      clinic_note: [moved, reason].filter(Boolean).join(' '),
      reschedule_requested: false,
      requested_date: null,
      requested_time: null,
      reschedule_reason: null,
    })
    .eq('clinic_id', clinicId)
    .eq('id', appointment.id)
    .select(MANAGED_APPOINTMENT_COLUMNS)
    .maybeSingle();

  if (error) {
    if (error.code === '23505') {
      throw new Error('That date and time is already booked at this clinic. Choose another slot.');
    }
    if (error.code === '42501') {
      throw new Error('Your access does not allow rescheduling this appointment.');
    }
    throw new Error(error.message);
  }
  if (!data) {
    throw new Error(
      'The appointment was not rescheduled. It may have been cancelled, or your access was revoked.',
    );
  }
  return data as unknown as ManagedAppointment;
}

/**
 * Cancels a booking at the owner's or the clinic's request.
 *
 * The transition trigger from 0008 allows an active receptionist or clinic
 * administrator to move a pending, confirmed or rescheduled booking to
 * `cancelled`; completed and rejected bookings have no such transition. The
 * reason is written into the clinic note the owner sees, the owner's own
 * cancellation request is marked answered, and the booking releases its slot.
 */
export async function cancelClinicAppointment(
  clinicId: string,
  appointment: { id: string; cancellation_reason: string | null },
  reason: string,
): Promise<ManagedAppointment> {
  const asked = appointment.cancellation_reason?.trim();
  const note = [
    `Cancelled by the clinic on ${formatDate(todayIso())} at ${new Date().toLocaleTimeString(
      'en-PH',
      { hour: 'numeric', minute: '2-digit' },
    )}.`,
    reason.trim(),
    asked ? `The owner had asked to cancel: ${asked}` : null,
  ]
    .filter(Boolean)
    .join(' ');

  const { data, error } = await supabase
    .from('appointments')
    .update({
      status: 'cancelled',
      clinic_note: note,
      cancellation_requested: false,
      reschedule_requested: false,
      requested_date: null,
      requested_time: null,
      reschedule_reason: null,
    })
    .eq('clinic_id', clinicId)
    .eq('id', appointment.id)
    .select(MANAGED_APPOINTMENT_COLUMNS)
    .maybeSingle();

  if (error) {
    if (error.code === '42501') {
      throw new Error('Your access does not allow cancelling this appointment.');
    }
    throw new Error(error.message);
  }
  if (!data) {
    throw new Error(
      'The appointment was not cancelled. It may already be closed, or your access was revoked.',
    );
  }
  return data as unknown as ManagedAppointment;
}

/**
 * Creates a confirmed booking at this clinic. The staff INSERT policy from 0016
 * allows an active receptionist or clinic administrator to do this, and the
 * slot index refuses a time that is already booked.
 */
export async function createClinicAppointment(
  clinicId: string,
  owner: { name: string; contact: string | null },
  input: NewAppointmentInput,
): Promise<CreatedAppointment> {
  const { data, error } = await supabase
    .from('appointments')
    .insert({
      clinic_id: clinicId,
      owner_id: input.ownerId,
      pet_id: input.petId,
      service_id: input.serviceId,
      service_name: input.serviceName,
      price: input.price,
      appointment_date: input.appointmentDate,
      appointment_time: input.appointmentTime,
      status: 'confirmed',
      owner_name: owner.name,
      contact: owner.contact,
      reason_for_visit: input.reasonForVisit,
      additional_notes: input.additionalNotes,
      assigned_vet_user_id: input.assignedVetUserId,
    })
    .select('id,reference')
    .single();

  if (error) {
    if (error.code === '23505') {
      throw new Error(
        'That date and time is already booked at this clinic. Choose another slot.',
      );
    }
    if (error.code === '42501') {
      throw new Error('Your access does not allow creating appointments at this clinic.');
    }
    throw new Error(error.message);
  }

  return data as CreatedAppointment;
}

export type OwnerRegistration = {
  owner_id: string;
  owner_name: string;
  contact: string | null;
  pet_name: string | null;
  registered_at: string;
  /** How this clinic first knew the owner: their booking, or the front desk. */
  source: 'booking' | 'registration';
};

/**
 * The owners this clinic took on most recently, newest first and one row each.
 *
 * A slice of the same owner list AM-09 reads, so the two cannot disagree about
 * who the clinic's owners are. The date is the moment the clinic first knew each
 * one — their first booking or the front desk's registration — and `source` says
 * which of the two it was.
 */
export async function fetchRecentOwnerRegistrations(
  clinicId: string,
  limit = 5,
): Promise<OwnerRegistration[]> {
  const owners = await fetchClinicOwners(clinicId);

  return owners
    .filter((owner): owner is ClinicOwner & { known_at: string } => Boolean(owner.known_at))
    .sort((a, b) => b.known_at.localeCompare(a.known_at))
    .slice(0, limit)
    .map((owner) => ({
      owner_id: owner.owner_id,
      owner_name: owner.name,
      contact: owner.contact,
      pet_name: owner.pet_name,
      registered_at: owner.known_at,
      source: owner.source,
    }));
}

/**
 * The appointment columns CA-10 aggregates. Pet and owner ids stay in the row
 * so distinct patients and owners can be counted without loading either table.
 */
export type ReportAppointment = {
  id: string;
  reference: string | null;
  appointment_date: string;
  appointment_time: string;
  status: string;
  owner_id: string;
  owner_name: string | null;
  pet_id: string;
  service_name: string | null;
  created_at: string;
  pets: { pet_name: string | null } | null;
};

const REPORT_COLUMNS = 'id,reference,appointment_date,appointment_time,status,owner_id,owner_name,pet_id,service_name,created_at,pets!appointments_pet_id_fkey(pet_name)' as const;

/**
 * Bookings whose visit date is inside the range. The filter runs in Postgres,
 * and the appointments policy still scopes every row to this clinic.
 */
export async function fetchClinicAppointmentsForReport(
  clinicId: string,
  since: string | null,
): Promise<ReportAppointment[]> {
  const base = supabase.from('appointments').select(REPORT_COLUMNS).eq('clinic_id', clinicId);
  const filtered = since ? base.gte('appointment_date', since) : base;
  const { data, error } = await filtered.order('appointment_date', { ascending: false });
  failure(error);
  return (data ?? []) as unknown as ReportAppointment[];
}

/** The clinic's own team: memberships plus the colleague profiles RLS allows. */
export async function fetchClinicTeam(clinicId: string): Promise<TeamMember[]> {
  const { data, error } = await supabase
    .from('clinic_memberships')
    .select('id, user_id, staff_role, status, created_at')
    .eq('clinic_id', clinicId)
    .order('created_at', { ascending: true });
  failure(error);

  const memberships = (data ?? []) as Omit<TeamMember, 'profile'>[];
  if (!memberships.length) return [];

  const ids = [...new Set(memberships.map((row) => row.user_id))];
  const { data: profiles, error: profileError } = await supabase
    .from('profiles')
    .select('id, first_name, last_name, email, mobile_number, profile_picture')
    .in('id', ids);
  failure(profileError);

  const byId = new Map(((profiles ?? []) as TeamProfile[]).map((profile) => [profile.id, profile]));
  return memberships.map((row) => ({ ...row, profile: byId.get(row.user_id) ?? null }));
}

/**
 * The columns CA-03 owns. Status, reference, review fields and the computed
 * discovery columns never appear here, and 0009 removes their UPDATE
 * privilege from `authenticated` as defence in depth.
 */
export type ClinicProfileInput = {
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
  website: string | null;
  operating_hours: OperatingHours;
  logo_url: string | null;
  cover_url: string | null;
};

/**
 * Writes the profile and returns the row the database actually kept. `.eq`
 * repeats the clinic id and nothing else, so the RLS policy on clinics decides
 * whether this account may write; a caller without an active administrator
 * membership updates zero rows and gets an error instead of a silent success.
 */
export async function updateClinicProfile(
  clinicId: string,
  patch: ClinicProfileInput,
): Promise<ClinicProfile> {
  const { data, error } = await supabase
    .from('clinics')
    .update(patch)
    .eq('id', clinicId)
    .select('*')
    .maybeSingle();
  failure(error);
  if (!data) {
    throw new Error(
      'The clinic was not updated. Your administrator access may have been revoked, or the clinic no longer exists.',
    );
  }
  return data as ClinicProfile;
}

/**
 * The two operational switches CA-13 owns. Both columns are inside the UPDATE
 * grant 0009 leaves to administrators, and nothing else is submitted.
 */
export type ClinicSettingsInput = {
  has_availability: boolean;
  emergency_service: boolean;
};

/**
 * Writes the settings and returns the row the database kept. The clinics policy
 * still decides who may write, so a caller without an active administrator
 * membership updates zero rows and gets an error instead of a silent success.
 */
export async function updateClinicSettings(
  clinicId: string,
  patch: ClinicSettingsInput,
): Promise<ClinicProfile> {
  const { data, error } = await supabase
    .from('clinics')
    .update(patch)
    .eq('id', clinicId)
    .select('*')
    .maybeSingle();
  failure(error);
  if (!data) {
    throw new Error(
      'The clinic settings were not updated. Your administrator access may have been revoked, or the clinic no longer exists.',
    );
  }
  return data as ClinicProfile;
}

/**
 * Uploads a logo or cover into the public `clinic-logos` bucket. The path starts
 * with the clinic id, which is exactly what the storage policy checks, so an
 * administrator can only write inside their own clinic's folder.
 */
export async function uploadClinicImage(
  clinicId: string,
  kind: 'logo' | 'cover',
  file: File,
): Promise<string> {
  if (!file.type.startsWith('image/')) {
    throw new Error('Choose a PNG, JPEG or WebP image.');
  }
  if (file.size > 5 * 1024 * 1024) {
    throw new Error('Images must be 5 MB or smaller.');
  }

  const extension =
    file.name.split('.').pop()?.toLowerCase().replace(/[^a-z0-9]/g, '') ||
    (file.type === 'image/png' ? 'png' : file.type === 'image/webp' ? 'webp' : 'jpg');
  const path = `${clinicId}/${kind}-${Date.now()}.${extension}`;

  const { error } = await supabase.storage
    .from('clinic-logos')
    .upload(path, file, { contentType: file.type, upsert: false });
  failure(error);

  const { data } = supabase.storage.from('clinic-logos').getPublicUrl(path);
  return data.publicUrl;
}

export type ServiceAvailability = 'available' | 'limited' | 'unavailable';

export const SERVICE_AVAILABILITY: { value: ServiceAvailability; label: string }[] = [
  { value: 'available', label: 'Available' },
  { value: 'limited', label: 'Limited' },
  { value: 'unavailable', label: 'Unavailable' },
];

export type ClinicService = {
  id: string;
  clinic_id: string;
  service_name: string;
  description: string | null;
  category: string | null;
  price: number;
  estimated_duration: number;
  availability: ServiceAvailability;
  created_at: string;
  updated_at: string | null;
};

/** The columns CA-04/CA-05 write; clinic_id is added by the caller, never typed in. */
export type ClinicServiceInput = {
  service_name: string;
  description: string | null;
  category: string | null;
  price: number;
  estimated_duration: number;
  availability: ServiceAvailability;
};

/** The unique index is on (clinic_id, lower(service_name)); say that in words. */
function serviceFailure(error: { message: string; code?: string } | null) {
  if (!error) return;
  if (error.code === '23505') {
    throw new Error('A service with that name already exists at this clinic. Choose another name.');
  }
  throw new Error(error.message);
}

export async function fetchClinicServices(clinicId: string): Promise<ClinicService[]> {
  const { data, error } = await supabase
    .from('clinic_services')
    .select('*')
    .eq('clinic_id', clinicId)
    .order('service_name', { ascending: true });
  failure(error);
  return (data ?? []) as ClinicService[];
}

export async function fetchClinicService(
  clinicId: string,
  serviceId: string,
): Promise<ClinicService | null> {
  const { data, error } = await supabase
    .from('clinic_services')
    .select('*')
    .eq('clinic_id', clinicId)
    .eq('id', serviceId)
    .maybeSingle();
  failure(error);
  return (data ?? null) as ClinicService | null;
}

export async function createClinicService(
  clinicId: string,
  input: ClinicServiceInput,
): Promise<ClinicService> {
  const { data, error } = await supabase
    .from('clinic_services')
    .insert({ clinic_id: clinicId, ...input })
    .select('*')
    .single();
  serviceFailure(error);
  return data as ClinicService;
}

/** Zero rows means the service is not this clinic's (or the caller lost admin access). */
export async function updateClinicService(
  clinicId: string,
  serviceId: string,
  input: ClinicServiceInput,
): Promise<ClinicService> {
  const { data, error } = await supabase
    .from('clinic_services')
    .update(input)
    .eq('clinic_id', clinicId)
    .eq('id', serviceId)
    .select('*')
    .maybeSingle();
  serviceFailure(error);
  if (!data) {
    throw new Error('The service was not updated. It may belong to another clinic, or your access was revoked.');
  }
  return data as ClinicService;
}

export async function setClinicServiceAvailability(
  clinicId: string,
  serviceId: string,
  availability: ServiceAvailability,
): Promise<ClinicService> {
  const { data, error } = await supabase
    .from('clinic_services')
    .update({ availability })
    .eq('clinic_id', clinicId)
    .eq('id', serviceId)
    .select('*')
    .maybeSingle();
  serviceFailure(error);
  if (!data) {
    throw new Error('The service was not updated. It may belong to another clinic, or your access was revoked.');
  }
  return data as ClinicService;
}
