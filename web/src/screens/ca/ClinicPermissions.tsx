import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '@/auth/AuthProvider';
import { useAsync } from '@/lib/useAsync';
import { fullName, label } from '@/lib/format';
import { fetchClinicTeam, type TeamMember } from '@/clinic/data';
import {
  STAFF_ROLE_OPTIONS,
  updateClinicStaffMembership,
  type EditableStaffRole,
} from '@/clinic/staff';
import {
  ADMINISTRATOR_MANAGED_NOTE,
  CLINIC_CAPABILITIES,
  CLINIC_ROLES,
  type ClinicAccess,
} from '@/clinic/roles';
import { ClinicFooter, InvitationPending, NoClinicAssigned } from '@/clinic/components';
import {
  ConfirmDialog,
  EmptyState,
  ErrorState,
  LoadingState,
  Metric,
  Notice,
  PageHeader,
  Panel,
  StatusBadge,
} from '@/sa/components';
import { Button } from '@/ui/Button';
import { Icon } from '@/ui/Icon';

/** The three shapes a cell can take, using the matrix classes from console.css. */
function AccessCell({ access }: { access: ClinicAccess }) {
  if (access === 'yes') {
    return (
      <td>
        <span className="matrix__yes" aria-label="Allowed">
          <Icon name="check" size={16} />
        </span>
      </td>
    );
  }
  if (access === 'partial') {
    return (
      <td>
        <span className="matrix__partial" title="Scoped rows, or read-only">
          Partial
        </span>
      </td>
    );
  }
  return (
    <td>
      <span className="matrix__no" aria-label="Not allowed">
        —
      </span>
    </td>
  );
}

/** CA-09 — who can do what in this clinic, plus the role each member holds. */
export function ClinicPermissions() {
  const { user } = useAuth();
  const clinicId = user?.clinicId ?? null;
  const invited = user?.membershipStatus === 'invited';

  const [pending, setPending] = useState<{ member: TeamMember; staffRole: EditableStaffRole } | null>(
    null,
  );
  const [busy, setBusy] = useState(false);
  const [flash, setFlash] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const state = useAsync(async () => {
    if (!clinicId) throw new Error('No clinic is attached to this account.');
    if (invited) return null;
    return { team: await fetchClinicTeam(clinicId) };
  }, [clinicId, invited]);

  const team = state.data?.team ?? [];

  const byRole = useMemo(
    () =>
      CLINIC_ROLES.map((role) => ({
        role,
        members: team.filter((member) => member.staff_role === role),
      })),
    [team],
  );

  const activeCount = team.filter((member) => member.status === 'active').length;
  const pendingName = pending?.member.profile ? fullName(pending.member.profile) : 'this member';

  const applyRole = async () => {
    if (!pending || !clinicId || busy) return;
    setBusy(true);
    setNotice(null);
    try {
      await updateClinicStaffMembership(clinicId, pending.member.id, {
        staff_role: pending.staffRole,
      });
      const name = pending.member.profile ? fullName(pending.member.profile) : 'This member';
      setFlash(`${name} is now ${label(pending.staffRole).toLowerCase()}.`);
      setPending(null);
      state.reload();
    } catch (error) {
      setNotice(error instanceof Error ? error.message : String(error));
      setPending(null);
    } finally {
      setBusy(false);
    }
  };

  if (!clinicId) return <NoClinicAssigned title="Staff permissions" />;

  if (invited) {
    return <InvitationPending clinicName={user?.clinicName ?? null} email={user?.email ?? ''} />;
  }

  if (state.loading) {
    return (
      <div className="page">
        <LoadingState rows={5} />
      </div>
    );
  }

  if (state.error || !state.data) {
    return (
      <div className="page">
        <ErrorState message={state.error ?? 'Unknown error'} onRetry={state.reload} />
      </div>
    );
  }

  return (
    <div className="page">
      <PageHeader
        title="Staff permissions"
        subtitle="Access follows the membership role. Each row restates a row-level security policy or clinic RPC; nothing on this page can widen it."
        actions={
          <Link to="/clinic-admin/staff/new">
            <Button>Add staff</Button>
          </Link>
        }
      />

      {flash ? <Notice tone="success">{flash}</Notice> : null}
      {notice ? <Notice tone="error">{notice}</Notice> : null}

      <div className="metrics">
        <Metric label="Team members" value={team.length} />
        <Metric label="Active accounts" value={activeCount} />
        <Metric label="Roles in use" value={byRole.filter((group) => group.members.length > 0).length} />
        <Metric
          label="Veterinarians"
          value={team.filter((member) => member.staff_role === 'veterinarian').length}
        />
      </div>

      <Panel
        title="Permission matrix"
        subtitle="Partial means the policy allows part of the row: only scoped rows, or read but not write. Where a policy is broader than this console, the cell says so."
        flush
      >
        <div className="table-wrap">
          <table className="matrix">
            <thead>
              <tr>
                <th>Permission</th>
                {CLINIC_ROLES.map((role) => (
                  <th key={role}>
                    {label(role)}
                    <span className="table__secondary" style={{ display: 'block', fontWeight: 500 }}>
                      {team.filter((member) => member.staff_role === role).length} assigned
                    </span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {CLINIC_CAPABILITIES.map((capability) => (
                <tr key={capability.name}>
                  <td>
                    <p className="table__primary">{capability.name}</p>
                    <p className="table__secondary">{capability.detail}</p>
                  </td>
                  {CLINIC_ROLES.map((role) => (
                    <AccessCell key={role} access={capability.access[role]} />
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>

      <Notice tone="info">{ADMINISTRATOR_MANAGED_NOTE}</Notice>

      <Panel
        title="Role assignments"
        subtitle="Changing a role takes effect immediately; the next request from that account is checked against the new role."
        flush
      >
        {team.length ? (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Member</th>
                  <th>Status</th>
                  <th>Role</th>
                  <th className="table__right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {team.map((member) => {
                  const name = member.profile ? fullName(member.profile) : 'Account not linked';
                  const vetLinkManaged = member.staff_role === 'clinic_administrator';
                  return (
                    <tr key={member.id}>
                      <td>
                        <p className="table__primary">{name}</p>
                        <p className="table__secondary">{member.profile?.email ?? 'No email'}</p>
                      </td>
                      <td>
                        <StatusBadge status={member.status} />
                      </td>
                      <td>
                        {vetLinkManaged ? (
                          <span className="muted">Clinic administrator · VetLink managed</span>
                        ) : (
                          <select
                            className="control__select"
                            aria-label={`Role for ${name}`}
                            value={member.staff_role}
                            disabled={busy}
                            onChange={(event) =>
                              setPending({
                                member,
                                staffRole: event.target.value as EditableStaffRole,
                              })
                            }
                          >
                            {STAFF_ROLE_OPTIONS.map((option) => (
                              <option key={option.value} value={option.value}>
                                {option.label}
                              </option>
                            ))}
                          </select>
                        )}
                      </td>
                      <td className="table__right">
                        <Link to={`/clinic-admin/staff/${member.id}`}>
                          <Button size="sm" variant="outline">
                            View details
                          </Button>
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState
            icon="users"
            title="No team members yet"
            description="Invite the clinic's first appointment manager, veterinarian or staff member to assign a role."
            action={
              <Link to="/clinic-admin/staff/new">
                <Button size="sm" style={{ marginTop: 10 }}>
                  Add staff
                </Button>
              </Link>
            }
          />
        )}
      </Panel>

      <ConfirmDialog
        open={pending !== null}
        title={
          pending
            ? `Change ${pendingName} to ${label(pending.staffRole).toLowerCase()}?`
            : 'Change role?'
        }
        description="The membership keeps its history and assignments; only the permissions that role grants change. The staff member sees the new workspace the next time their session loads."
        confirmLabel="Save role"
        busy={busy}
        onConfirm={() => void applyRole()}
        onClose={() => {
          if (!busy) setPending(null);
        }}
      />

      <ClinicFooter right="Permissions are enforced by row-level security, not by this page" />
    </div>
  );
}
