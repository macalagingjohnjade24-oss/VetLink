import { supabase } from '@/lib/supabase';
import { fetchClinicTeam } from './data';
import { sendClinicNotification } from './notifications';
import type { ClinicTask, TaskPriority, TaskStatus } from './tasks';

/**
 * Data for the limited Clinic Staff workspace (CS-01 – CS-04) and the clinic
 * administrator's task board (CA-14).
 *
 * Limited staff never read appointment, pet or owner rows directly: 0014/0015
 * withdraw those policies and hand them three security-definer reads instead —
 * today's schedule without owner columns, today's pets as name and species,
 * and due vaccinations as name, vaccine and date. Everything below goes
 * through those, so the screens cannot show more than the database allows.
 */

function failure(error: { message: string } | null) {
  if (error) throw new Error(error.message);
}

const TASK_COLUMNS =
  'id,clinic_id,title,description,priority,status,assigned_to,created_by,due_at,completed_at,created_at,updated_at' as const;

/** Tasks assigned to the caller at this clinic (clinic_tasks_staff_read). */
export async function fetchMyTasks(clinicId: string, userId: string): Promise<ClinicTask[]> {
  const { data, error } = await supabase
    .from('clinic_tasks')
    .select(TASK_COLUMNS)
    .eq('clinic_id', clinicId)
    .eq('assigned_to', userId);
  failure(error);
  return (data ?? []) as ClinicTask[];
}

/** Every task at the clinic, for the administrator's board. */
export async function fetchClinicTasks(clinicId: string): Promise<ClinicTask[]> {
  const { data, error } = await supabase
    .from('clinic_tasks')
    .select(TASK_COLUMNS)
    .eq('clinic_id', clinicId)
    .order('created_at', { ascending: false })
    .limit(500);
  failure(error);
  return (data ?? []) as ClinicTask[];
}

/**
 * clinic_tasks_assignee_update lets an assignee change their own row and
 * nobody else's, and clinic_tasks_admin_all lets the administrator change any.
 * A refused update returns zero rows rather than an error, so that is checked.
 */
export async function updateTaskStatus(id: string, status: TaskStatus): Promise<void> {
  const { data, error } = await supabase
    .from('clinic_tasks')
    .update({
      status,
      completed_at: status === 'completed' ? new Date().toISOString() : null,
    })
    .eq('id', id)
    .select('id')
    .maybeSingle();
  failure(error);
  if (!data) throw new Error('That task was not updated. It may be assigned to someone else.');
}

export type TaskInput = {
  title: string;
  description: string | null;
  priority: TaskPriority;
  assigned_to: string;
  due_at: string | null;
};

/**
 * Writes one task (clinic_tasks_admin_all), then tells the assignee. The
 * notice is a courtesy: a task that saved stays saved even if it fails.
 */
export async function createClinicTask(
  clinicId: string,
  createdBy: string,
  input: TaskInput,
): Promise<{ notified: boolean }> {
  const { error } = await supabase
    .from('clinic_tasks')
    .insert({ clinic_id: clinicId, created_by: createdBy, ...input });
  failure(error);

  try {
    await sendClinicNotification({
      clinicId,
      userIds: [input.assigned_to],
      title: 'New task assigned',
      message: input.title,
    });
    return { notified: true };
  } catch {
    return { notified: false };
  }
}

export type LimitedScheduleRow = {
  appointment_id: string;
  reference: string | null;
  appointment_time: string;
  status: string;
  service_name: string | null;
  pet_id: string;
  pet_name: string;
  species: string;
};

/** Today's schedule without owner columns (clinic_limited_schedule, 0015). */
export async function fetchLimitedSchedule(clinicId: string): Promise<LimitedScheduleRow[]> {
  const { data, error } = await supabase.rpc('clinic_limited_schedule', { target_clinic: clinicId });
  failure(error);
  return (data ?? []) as LimitedScheduleRow[];
}

export type LimitedPetRow = { pet_id: string; pet_name: string; species: string };

/** Today's booked pets as name and species only (clinic_limited_pets, 0008). */
export async function fetchLimitedPets(clinicId: string): Promise<LimitedPetRow[]> {
  const { data, error } = await supabase.rpc('clinic_limited_pets', { target_clinic: clinicId });
  failure(error);
  return ((data ?? []) as LimitedPetRow[]).sort((a, b) => a.pet_name.localeCompare(b.pet_name));
}

export type LimitedDueVaccination = {
  vaccination_id: string;
  pet_name: string;
  vaccine_name: string;
  next_due_date: string;
};

/** Scheduled vaccinations as pet name, vaccine and due date (0008). */
export async function fetchLimitedDueVaccinations(clinicId: string): Promise<LimitedDueVaccination[]> {
  const { data, error } = await supabase.rpc('clinic_limited_due_vaccinations', {
    target_clinic: clinicId,
  });
  failure(error);
  return ((data ?? []) as LimitedDueVaccination[]).sort((a, b) =>
    a.next_due_date.localeCompare(b.next_due_date),
  );
}

/**
 * Sends a note to every receptionist on the team. Limited staff may not change
 * a booking, so "notify reception" is how an arrival or a problem reaches the
 * people who can.
 */
export async function notifyReception(clinicId: string, title: string, message: string): Promise<number> {
  const team = await fetchClinicTeam(clinicId);
  const desk = team.filter(
    (member) =>
      member.staff_role === 'receptionist' && (member.status === 'active' || member.status === 'invited'),
  );
  if (!desk.length) throw new Error('This clinic has no appointment manager to notify yet.');
  return sendClinicNotification({
    clinicId,
    userIds: desk.map((member) => member.user_id),
    title,
    message,
  });
}
