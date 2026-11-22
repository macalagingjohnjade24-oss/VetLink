import { useMemo, useState } from 'react';
import { useAuth } from '@/auth/AuthProvider';
import { formatDateTime, fullName, label } from '@/lib/format';
import { useAsync } from '@/lib/useAsync';
import { fetchClinicTeam } from '@/clinic/data';
import { createClinicTask, fetchClinicTasks, updateTaskStatus } from '@/clinic/staffWorkspace';
import {
  TASK_PRIORITY_LABEL,
  TASK_STATUS_OPTIONS,
  filterTasks,
  taskCode,
  taskSummary,
  type TaskPriority,
} from '@/clinic/tasks';
import { todayIso } from '@/clinic/data';
import {
  ClinicFooter,
  FailedPage,
  InvitationPending,
  LoadingPage,
  NoClinicAssigned,
  TextArea,
} from '@/clinic/components';
import { EmptyState, Metric, Notice, PageHeader, Panel, SelectField } from '@/sa/components';
import { Button } from '@/ui/Button';
import { Input } from '@/ui/Input';
import { TaskBadge } from '@/screens/cs/Tasks';

const PRIORITIES: { value: TaskPriority; label: string }[] = [
  { value: 'normal', label: 'Normal' },
  { value: 'high', label: 'High' },
  { value: 'urgent', label: 'Urgent' },
  { value: 'low', label: 'Low' },
];

/**
 * CA-14 — assign and follow the clinic's staff tasks.
 *
 * clinic_tasks_admin_all (0004) gives the clinic administrator every write;
 * assignees then move their own task forward on CS-02. Without this board no
 * task could ever reach the Clinic Staff workspace.
 */
export function ClinicTasks() {
  const { user } = useAuth();
  const clinicId = user?.clinicId ?? null;
  const invited = user?.membershipStatus === 'invited';

  const [status, setStatus] = useState('open');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [assignee, setAssignee] = useState('');
  const [priority, setPriority] = useState<TaskPriority>('normal');
  const [due, setDue] = useState('');
  const [saving, setSaving] = useState(false);
  const [cancelling, setCancelling] = useState<string | null>(null);
  const [notice, setNotice] = useState<{ tone: 'success' | 'error'; text: string } | null>(null);

  const state = useAsync(async () => {
    if (!clinicId) throw new Error('No clinic is attached to this account.');
    if (invited) return null;
    const [tasks, team] = await Promise.all([fetchClinicTasks(clinicId), fetchClinicTeam(clinicId)]);
    return { tasks, team };
  }, [clinicId, invited]);

  const team = useMemo(
    () =>
      (state.data?.team ?? []).filter(
        (member) =>
          member.staff_role !== 'clinic_administrator' &&
          (member.status === 'active' || member.status === 'invited'),
      ),
    [state.data],
  );
  const names = useMemo(
    () =>
      new Map(
        (state.data?.team ?? []).map((member) => [
          member.user_id,
          member.profile ? fullName(member.profile) || 'Unnamed member' : 'Account not linked',
        ]),
      ),
    [state.data],
  );

  if (!clinicId || !user) return <NoClinicAssigned title="Staff tasks" />;
  if (invited) return <InvitationPending clinicName={user.clinicName} email={user.email} />;
  if (state.loading) return <LoadingPage rows={6} />;
  if (state.error || !state.data) {
    return <FailedPage title="Staff tasks" message={state.error} onRetry={state.reload} />;
  }

  const now = new Date().toISOString();
  const summary = taskSummary(state.data.tasks, now, todayIso());
  const rows = filterTasks(state.data.tasks, { term: '', status, priority: 'all' }, now);

  const create = async () => {
    if (saving) return;
    if (title.trim().length < 3) {
      setNotice({ tone: 'error', text: 'Give the task a title of at least three characters.' });
      return;
    }
    if (!assignee) {
      setNotice({ tone: 'error', text: 'Choose who the task is for.' });
      return;
    }
    setSaving(true);
    setNotice(null);
    try {
      const { notified } = await createClinicTask(clinicId, user.id, {
        title: title.trim(),
        description: description.trim() || null,
        priority,
        assigned_to: assignee,
        due_at: due ? new Date(due).toISOString() : null,
      });
      setTitle('');
      setDescription('');
      setDue('');
      setPriority('normal');
      setNotice({
        tone: 'success',
        text: `Task assigned to ${names.get(assignee) ?? 'the team member'}${
          notified ? ' and they were notified' : '. Their notification could not be sent'
        }.`,
      });
      state.reload();
    } catch (error) {
      setNotice({ tone: 'error', text: error instanceof Error ? error.message : String(error) });
    } finally {
      setSaving(false);
    }
  };

  const cancel = async (id: string) => {
    if (cancelling) return;
    setCancelling(id);
    try {
      await updateTaskStatus(id, 'cancelled');
      state.reload();
    } catch (error) {
      setNotice({ tone: 'error', text: error instanceof Error ? error.message : String(error) });
    } finally {
      setCancelling(null);
    }
  };

  return (
    <div className="page">
      <PageHeader
        title="Staff tasks"
        subtitle={`${user.clinicName ?? 'Your clinic'} · assign work to your team and follow its progress`}
        actions={
          <Button variant="outline" onClick={state.reload}>
            Refresh
          </Button>
        }
      />

      {notice ? <Notice tone={notice.tone}>{notice.text}</Notice> : null}

      <div className="metrics">
        <Metric label="Open" value={summary.pending + summary.inProgress} />
        <Metric label="In progress" value={summary.inProgress} />
        <Metric label="Overdue" value={summary.overdue} />
        <Metric label="Completed today" value={summary.completedToday} />
      </div>

      <div className="grid grid--main">
        <Panel
          title={`${rows.length} task${rows.length === 1 ? '' : 's'}`}
          actions={
            <SelectField label="Status" value={status} onChange={setStatus} options={TASK_STATUS_OPTIONS} />
          }
          flush
        >
          {rows.length ? (
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr>
                    <th>Task</th>
                    <th>Assigned to</th>
                    <th>Due</th>
                    <th>Status</th>
                    <th className="table__right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((task) => (
                    <tr key={task.id}>
                      <td className="table__primary">
                        {task.title}
                        <span className="table__secondary">
                          {taskCode(task)} · {TASK_PRIORITY_LABEL[task.priority]}
                        </span>
                      </td>
                      <td>{task.assigned_to ? (names.get(task.assigned_to) ?? 'Former member') : 'Unassigned'}</td>
                      <td className="table__mono">{task.due_at ? formatDateTime(task.due_at) : '—'}</td>
                      <td>
                        <TaskBadge task={task} now={now} />
                      </td>
                      <td className="table__right">
                        {task.status === 'pending' || task.status === 'in_progress' ? (
                          <Button
                            size="sm"
                            variant="ghost"
                            loading={cancelling === task.id}
                            onClick={() => void cancel(task.id)}
                          >
                            Cancel
                          </Button>
                        ) : (
                          <span className="muted">—</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <EmptyState
              icon="clipboard"
              title={state.data.tasks.length ? 'No tasks match this status' : 'No tasks yet'}
              description="Tasks you assign appear here and in the assignee's workspace."
            />
          )}
        </Panel>

        <Panel title="Assign a task" subtitle="The assignee is notified and can update its progress">
          <div style={{ display: 'grid', gap: 14 }}>
            <Input
              label="Title"
              value={title}
              maxLength={120}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="Prepare consultation room 2"
            />
            <TextArea
              label="Instructions (optional)"
              value={description}
              onChange={setDescription}
              rows={3}
              maxLength={1000}
            />
            <SelectField
              label="Assign to"
              value={assignee}
              onChange={setAssignee}
              options={[
                { value: '', label: team.length ? 'Choose a team member' : 'No team members yet' },
                ...team.map((member) => ({
                  value: member.user_id,
                  label: `${names.get(member.user_id)} · ${label(member.staff_role)}`,
                })),
              ]}
            />
            <SelectField
              label="Priority"
              value={priority}
              onChange={(value) => setPriority(value as TaskPriority)}
              options={PRIORITIES}
            />
            <Input
              label="Due (optional)"
              type="datetime-local"
              value={due}
              onChange={(event) => setDue(event.target.value)}
            />
            <div className="row" style={{ justifyContent: 'flex-end' }}>
              <Button onClick={() => void create()} loading={saving} disabled={!team.length}>
                Assign task
              </Button>
            </div>
          </div>
        </Panel>
      </div>

      <ClinicFooter right="Tasks stay inside this clinic; assignees update only their own" />
    </div>
  );
}
