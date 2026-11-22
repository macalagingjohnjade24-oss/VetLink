import { Link } from 'react-router-dom';
import { useAuth } from '@/auth/AuthProvider';
import { formatClock, formatTime, relativeTime } from '@/lib/format';
import { useAsync } from '@/lib/useAsync';
import { todayIso } from '@/clinic/data';
import { fetchNotifications } from '@/clinic/notifications';
import { fetchLimitedSchedule, fetchMyTasks } from '@/clinic/staffWorkspace';
import { sortTasks, taskSummary } from '@/clinic/tasks';
import {
  ClinicFooter,
  FailedPage,
  InvitationPending,
  LoadingPage,
  NoClinicAssigned,
} from '@/clinic/components';
import { EmptyState, PageHeader, Panel, Stat } from '@/sa/components';
import { Button } from '@/ui/Button';
import { TaskBadge } from './Tasks';

const INACTIVE = new Set(['cancelled', 'rejected']);

function greeting(now = new Date()) {
  const hour = now.getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 18) return 'Good afternoon';
  return 'Good evening';
}

/** CS-01 — a limited staff member's day: their tasks, today's visits, their notices. */
export function StaffDashboard() {
  const { user } = useAuth();
  const clinicId = user?.clinicId ?? null;
  const invited = user?.membershipStatus === 'invited';

  const state = useAsync(async () => {
    if (!clinicId || !user) throw new Error('No clinic is attached to this account.');
    if (invited) return null;
    const [tasks, schedule, inbox] = await Promise.all([
      fetchMyTasks(clinicId, user.id),
      fetchLimitedSchedule(clinicId),
      fetchNotifications(),
    ]);
    return { tasks, schedule, inbox };
  }, [clinicId, invited, user?.id]);

  if (!clinicId || !user) return <NoClinicAssigned title="Dashboard" role={user?.role} />;
  if (invited) return <InvitationPending clinicName={user.clinicName} email={user.email} />;
  if (state.loading) return <LoadingPage rows={6} />;
  if (state.error || !state.data) {
    return <FailedPage title="Dashboard" message={state.error} onRetry={state.reload} />;
  }

  const now = new Date().toISOString();
  const today = todayIso();
  const { tasks, schedule, inbox } = state.data;
  const summary = taskSummary(tasks, now, today);
  const open = sortTasks(tasks, now).filter(
    (task) => task.status === 'pending' || task.status === 'in_progress',
  );
  const visits = schedule.filter((row) => !INACTIVE.has(row.status));
  const unread = inbox.filter((notification) => !notification.is_read);
  const todaysWork = summary.dueToday + summary.completedToday;
  const longDate = new Date().toLocaleDateString(undefined, {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });

  return (
    <div className="page">
      <PageHeader
        title={`${greeting()}, ${user.firstName || 'there'}`}
        subtitle={`${longDate} · ${user.clinicName ?? 'Your clinic'}`}
        actions={
          <Link to="/staff/tasks">
            <Button>View assigned tasks</Button>
          </Link>
        }
      />

      <div className="grid grid--stats">
        <Stat
          label="Assigned tasks"
          value={summary.pending + summary.inProgress}
          note={`${summary.pending} pending · ${summary.inProgress} in progress · ${summary.overdue} overdue`}
        />
        <Stat
          label="Completed today"
          value={summary.completedToday}
          note={todaysWork ? `of ${todaysWork} task${todaysWork === 1 ? '' : 's'} on today's list` : 'Nothing due today'}
        />
        <Stat label="Visits to assist" value={visits.length} note="Booked at your clinic today" />
        <Stat label="Unread notifications" value={unread.length} note="Tasks, reminders and clinic updates" />
      </div>

      <div className="grid grid--main">
        <Panel title="Your task priorities" flush>
          {open.length ? (
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr>
                    <th>Task / responsibility</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {open.slice(0, 5).map((task) => (
                    <tr key={task.id}>
                      <td className="table__primary">
                        {task.title}
                        <span className="table__secondary">
                          {task.due_at ? `Due ${formatTime(task.due_at)}` : 'No due time'} · {task.priority} priority
                        </span>
                      </td>
                      <td>
                        <TaskBadge task={task} now={now} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <EmptyState
              icon="clipboard"
              title="No open tasks"
              description="You are all caught up. New assignments appear here and in your notifications."
            />
          )}
        </Panel>

        <Panel title="Quick actions">
          <div style={{ display: 'grid', gap: 10 }}>
            <Link to="/staff/appointments">
              <Button style={{ width: '100%' }}>Appointment assistance</Button>
            </Link>
            <Link to="/staff/pets">
              <Button variant="outline" style={{ width: '100%' }}>
                View permitted pet details
              </Button>
            </Link>
          </div>
          <p className="stat__note" style={{ marginTop: 14 }}>
            Only tasks and information permitted by your Clinic Administrator are available.
          </p>
        </Panel>
      </div>

      <div className="grid grid--two">
        <Panel title="Today's visits">
          {visits.length ? (
            <ul style={{ display: 'grid', gap: 6, listStyle: 'none', padding: 0, margin: 0 }}>
              {visits.slice(0, 6).map((row) => (
                <li key={row.appointment_id}>
                  {formatClock(row.appointment_time)} · {row.pet_name} · {row.service_name ?? 'Visit'}
                </li>
              ))}
            </ul>
          ) : (
            <p className="muted">No visits booked today.</p>
          )}
        </Panel>

        <Panel title="Recent notifications">
          {inbox.length ? (
            <ul style={{ display: 'grid', gap: 6, listStyle: 'none', padding: 0, margin: 0 }}>
              {inbox.slice(0, 4).map((notification) => (
                <li key={notification.id} className={notification.is_read ? 'muted' : undefined}>
                  {relativeTime(notification.created_at)} · {notification.title}
                </li>
              ))}
            </ul>
          ) : (
            <p className="muted">No notifications yet.</p>
          )}
          <Link to="/staff/notifications" style={{ display: 'inline-block', marginTop: 12 }}>
            View all notifications →
          </Link>
        </Panel>
      </div>

      <ClinicFooter
        left="Staff workspace"
        right={`${user.clinicReference ?? 'Clinic-scoped by row-level security'} · limited access`}
      />
    </div>
  );
}
