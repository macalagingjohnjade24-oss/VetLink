import { useState } from 'react';
import { useAuth } from '@/auth/AuthProvider';
import { formatDateTime, relativeTime } from '@/lib/format';
import { useAsync } from '@/lib/useAsync';
import { fetchMyTasks, updateTaskStatus } from '@/clinic/staffWorkspace';
import {
  TASK_PRIORITY_LABEL,
  TASK_PRIORITY_OPTIONS,
  TASK_STATE_LABEL,
  TASK_STATE_TONE,
  TASK_STATUS_OPTIONS,
  filterTasks,
  nextTaskStatus,
  taskCode,
  taskState,
  taskSummary,
  type ClinicTask,
} from '@/clinic/tasks';
import { todayIso } from '@/clinic/data';
import {
  ClinicFooter,
  FailedPage,
  InvitationPending,
  LoadingPage,
  NoClinicAssigned,
} from '@/clinic/components';
import {
  EmptyState,
  Metric,
  Notice,
  PageHeader,
  Pager,
  Panel,
  SearchField,
  SelectField,
  StatusBadge,
} from '@/sa/components';
import { Button } from '@/ui/Button';

const PAGE_SIZE = 10;

export function TaskBadge({ task, now }: { task: ClinicTask; now: string }) {
  const state = taskState(task, now);
  return (
    <StatusBadge status={state} tone={TASK_STATE_TONE[state]}>
      {TASK_STATE_LABEL[state]}
    </StatusBadge>
  );
}

/**
 * CS-02 — the tasks assigned to this staff member.
 *
 * An assignee moves their own task from pending to in progress to completed
 * (clinic_tasks_assignee_update). Creating, reassigning and cancelling stay with
 * the clinic administrator, so none of those controls exist here.
 */
export function StaffTasks() {
  const { user } = useAuth();
  const clinicId = user?.clinicId ?? null;
  const invited = user?.membershipStatus === 'invited';

  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('open');
  const [priority, setPriority] = useState('all');
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<{ tone: 'success' | 'error'; text: string } | null>(null);

  const state = useAsync(async () => {
    if (!clinicId || !user) throw new Error('No clinic is attached to this account.');
    if (invited) return [];
    return fetchMyTasks(clinicId, user.id);
  }, [clinicId, invited, user?.id]);

  if (!clinicId || !user) return <NoClinicAssigned title="Assigned tasks" role={user?.role} />;
  if (invited) return <InvitationPending clinicName={user.clinicName} email={user.email} />;
  if (state.loading) return <LoadingPage rows={6} />;
  if (state.error || !state.data) {
    return <FailedPage title="Assigned tasks" message={state.error} onRetry={state.reload} />;
  }

  const now = new Date().toISOString();
  const summary = taskSummary(state.data, now, todayIso());
  const rows = filterTasks(state.data, { term: search, status, priority }, now);
  const pages = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
  const currentPage = Math.min(page, pages);
  const visible = rows.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);
  const focus = state.data.find((task) => task.id === selected) ?? rows[0] ?? null;
  const next = focus ? nextTaskStatus(focus) : null;

  const advance = async () => {
    if (!focus || !next || busy) return;
    setBusy(true);
    setNotice(null);
    try {
      await updateTaskStatus(focus.id, next.status);
      setNotice({
        tone: 'success',
        text: `${taskCode(focus)} is now ${next.status === 'completed' ? 'completed' : 'in progress'}.`,
      });
      state.reload();
    } catch (error) {
      setNotice({ tone: 'error', text: error instanceof Error ? error.message : String(error) });
    } finally {
      setBusy(false);
    }
  };

  const clear = () => {
    setSearch('');
    setStatus('open');
    setPriority('all');
    setPage(1);
  };

  return (
    <div className="page">
      <PageHeader
        title="Assigned tasks"
        subtitle={`Your responsibilities at ${user.clinicName ?? 'your clinic'}. Update your own progress; assignments are managed by the clinic.`}
        actions={
          <Button variant="outline" onClick={state.reload}>
            Refresh
          </Button>
        }
      />

      {notice ? <Notice tone={notice.tone}>{notice.text}</Notice> : null}

      <div className="metrics">
        <Metric label="Assigned" value={summary.total} />
        <Metric label="Pending" value={summary.pending} />
        <Metric label="In progress" value={summary.inProgress} />
        <Metric label="Overdue" value={summary.overdue} />
      </div>

      <Panel
        title={`${rows.length} task${rows.length === 1 ? '' : 's'}`}
        actions={
          <div className="toolbar__group">
            <SearchField
              value={search}
              onChange={(value) => {
                setSearch(value);
                setPage(1);
              }}
              placeholder="Search title or task ID"
              label="Search tasks"
            />
            <SelectField
              label="Status"
              value={status}
              onChange={(value) => {
                setStatus(value);
                setPage(1);
              }}
              options={TASK_STATUS_OPTIONS}
            />
            <SelectField
              label="Priority"
              value={priority}
              onChange={(value) => {
                setPriority(value);
                setPage(1);
              }}
              options={TASK_PRIORITY_OPTIONS}
            />
          </div>
        }
        flush
      >
        {visible.length ? (
          <>
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr>
                    <th>Task / description</th>
                    <th>Priority</th>
                    <th>Due</th>
                    <th>Status</th>
                    <th>Task ID</th>
                    <th className="table__right">Details</th>
                  </tr>
                </thead>
                <tbody>
                  {visible.map((task) => (
                    <tr key={task.id} aria-selected={focus?.id === task.id}>
                      <td className="table__primary">
                        {task.title}
                        {task.description ? (
                          <span className="table__secondary">{task.description}</span>
                        ) : null}
                      </td>
                      <td>{TASK_PRIORITY_LABEL[task.priority]}</td>
                      <td className="table__mono">{task.due_at ? formatDateTime(task.due_at) : 'No due time'}</td>
                      <td>
                        <TaskBadge task={task} now={now} />
                      </td>
                      <td className="table__mono">{taskCode(task)}</td>
                      <td className="table__right">
                        <Button size="sm" variant="ghost" onClick={() => setSelected(task.id)}>
                          View
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Pager page={currentPage} pageSize={PAGE_SIZE} total={rows.length} onPage={setPage} />
          </>
        ) : state.data.length ? (
          <EmptyState
            icon="search"
            title="No tasks match your filters"
            description="Clear filters to see your assigned tasks."
            action={
              <Button variant="outline" size="sm" onClick={clear} style={{ marginTop: 10 }}>
                Clear filters
              </Button>
            }
          />
        ) : (
          <EmptyState
            icon="clipboard"
            title="No tasks assigned to you"
            description="When your clinic administrator assigns you a task, it appears here and in your notifications."
          />
        )}
      </Panel>

      {focus ? (
        <Panel
          title={`${taskCode(focus)} · ${focus.title}`}
          subtitle={`${TASK_PRIORITY_LABEL[focus.priority]} priority · ${
            focus.due_at ? `due ${formatDateTime(focus.due_at)}` : 'no due time'
          } · assigned ${relativeTime(focus.created_at)}`}
          actions={
            next ? (
              <Button onClick={() => void advance()} loading={busy}>
                {next.label}
              </Button>
            ) : (
              <TaskBadge task={focus} now={now} />
            )
          }
        >
          <p>{focus.description ?? 'No further instructions were given for this task.'}</p>
          <p className="stat__note" style={{ marginTop: 10 }}>
            Escalate booking changes to reception; clinical records are not editable from this workspace.
          </p>
        </Panel>
      ) : null}

      <ClinicFooter
        left="Staff workspace"
        right={`${user.clinicReference ?? 'Clinic-scoped by row-level security'} · your own assigned tasks`}
      />
    </div>
  );
}
