/**
 * Clinic tasks (CS-01, CS-02, CA-14) as pure list logic.
 *
 * No Supabase import, so `npm test` can run it in Node. The row shape is the
 * clinic_tasks table (0004). Who may read and change a row is the database's
 * call: every active member reads the clinic's tasks, the clinic administrator
 * writes them, and an assignee may update only their own.
 */

export type TaskStatus = 'pending' | 'in_progress' | 'completed' | 'cancelled';
export type TaskPriority = 'low' | 'normal' | 'high' | 'urgent';

export type ClinicTask = {
  id: string;
  clinic_id: string;
  title: string;
  description: string | null;
  priority: TaskPriority;
  status: TaskStatus;
  assigned_to: string | null;
  created_by: string | null;
  due_at: string | null;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
};

/** What a badge shows: the stored status, or "overdue" for open work past due. */
export type TaskState = TaskStatus | 'overdue';

export const TASK_STATE_LABEL: Record<TaskState, string> = {
  pending: 'Pending',
  in_progress: 'In progress',
  completed: 'Completed',
  cancelled: 'Cancelled',
  overdue: 'Overdue',
};

export const TASK_STATE_TONE: Record<TaskState, 'success' | 'warning' | 'danger' | 'neutral'> = {
  pending: 'warning',
  in_progress: 'success',
  completed: 'success',
  cancelled: 'neutral',
  overdue: 'danger',
};

export const TASK_PRIORITY_LABEL: Record<TaskPriority, string> = {
  low: 'Low',
  normal: 'Normal',
  high: 'High',
  urgent: 'Urgent',
};

const PRIORITY_RANK: Record<TaskPriority, number> = { urgent: 0, high: 1, normal: 2, low: 3 };

export const TASK_STATUS_OPTIONS = [
  { value: 'all', label: 'All statuses' },
  { value: 'open', label: 'Open (pending or in progress)' },
  { value: 'overdue', label: 'Overdue' },
  { value: 'pending', label: 'Pending' },
  { value: 'in_progress', label: 'In progress' },
  { value: 'completed', label: 'Completed' },
  { value: 'cancelled', label: 'Cancelled' },
];

export const TASK_PRIORITY_OPTIONS = [
  { value: 'all', label: 'All priorities' },
  { value: 'urgent', label: 'Urgent' },
  { value: 'high', label: 'High' },
  { value: 'normal', label: 'Normal' },
  { value: 'low', label: 'Low' },
];

const isOpen = (task: ClinicTask) => task.status === 'pending' || task.status === 'in_progress';

/** `now` is an ISO timestamp, so a task due at 08:30 is overdue at 08:31 the same day. */
export function taskState(task: ClinicTask, now: string): TaskState {
  if (isOpen(task) && task.due_at && task.due_at < now) return 'overdue';
  return task.status;
}

/** A short, stable handle for a task in conversation: "TSK-1A2B3C". */
export const taskCode = (task: Pick<ClinicTask, 'id'>) =>
  `TSK-${task.id.replace(/-/g, '').slice(0, 6).toUpperCase()}`;

/**
 * Open work first — overdue, then by due time, then by priority — and finished
 * work after it, most recently finished first.
 */
export function sortTasks(tasks: ClinicTask[], now: string): ClinicTask[] {
  return [...tasks].sort((a, b) => {
    const openA = isOpen(a) ? 0 : 1;
    const openB = isOpen(b) ? 0 : 1;
    if (openA !== openB) return openA - openB;
    if (openA === 0) {
      const lateA = taskState(a, now) === 'overdue' ? 0 : 1;
      const lateB = taskState(b, now) === 'overdue' ? 0 : 1;
      if (lateA !== lateB) return lateA - lateB;
      const dueA = a.due_at ?? '￿';
      const dueB = b.due_at ?? '￿';
      if (dueA !== dueB) return dueA < dueB ? -1 : 1;
      return PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority];
    }
    const doneA = a.completed_at ?? a.updated_at;
    const doneB = b.completed_at ?? b.updated_at;
    return doneA < doneB ? 1 : doneA > doneB ? -1 : 0;
  });
}

export type TaskFilters = { term: string; status: string; priority: string };

export function filterTasks(tasks: ClinicTask[], filters: TaskFilters, now: string): ClinicTask[] {
  const term = filters.term.trim().toLowerCase();
  return sortTasks(tasks, now).filter((task) => {
    const state = taskState(task, now);
    if (filters.status === 'open' && !isOpen(task)) return false;
    if (filters.status === 'overdue' && state !== 'overdue') return false;
    if (!['all', 'open', 'overdue'].includes(filters.status) && task.status !== filters.status) {
      return false;
    }
    if (filters.priority !== 'all' && task.priority !== filters.priority) return false;
    if (!term) return true;
    return [task.title, task.description, taskCode(task)]
      .filter(Boolean)
      .some((value) => String(value).toLowerCase().includes(term));
  });
}

/** The local calendar day of a timestamp, so 07:00 in Manila is not filed under yesterday's UTC date. */
export function localDay(iso: string): string {
  const date = new Date(iso);
  const pad = (value: number) => String(value).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/** The figures above CS-01 and CS-02. `today` is the local `YYYY-MM-DD`. */
export function taskSummary(
  tasks: ClinicTask[],
  now: string,
  today: string,
  dayOf: (iso: string) => string = localDay,
) {
  return {
    total: tasks.filter((task) => task.status !== 'cancelled').length,
    pending: tasks.filter((task) => task.status === 'pending').length,
    inProgress: tasks.filter((task) => task.status === 'in_progress').length,
    overdue: tasks.filter((task) => taskState(task, now) === 'overdue').length,
    completedToday: tasks.filter(
      (task) => task.status === 'completed' && Boolean(task.completed_at) && dayOf(task.completed_at as string) === today,
    ).length,
    /** Due today, plus open work with no due time — both are today's to do. */
    dueToday: tasks.filter(
      (task) => (task.due_at ? dayOf(task.due_at) === today : isOpen(task)),
    ).length,
  };
}

/**
 * The status an assignee can move a task to next. Cancelling is the clinic
 * administrator's decision, so it is never offered here.
 */
export function nextTaskStatus(task: ClinicTask): { status: TaskStatus; label: string } | null {
  if (task.status === 'pending') return { status: 'in_progress', label: 'Start task' };
  if (task.status === 'in_progress') return { status: 'completed', label: 'Mark completed' };
  return null;
}
