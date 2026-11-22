import { useMemo, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '@/auth/AuthProvider';
import { useAsync } from '@/lib/useAsync';
import { formatDate, fullName, initials, label } from '@/lib/format';
import { fetchClinicTeam } from '@/clinic/data';
import { ClinicFooter, FailedPage, InvitationPending, LoadingPage, NoClinicAssigned } from '@/clinic/components';
import {
  EmptyState,
  Metric,
  Notice,
  PageHeader,
  Panel,
  SearchField,
  SelectField,
  StatusBadge,
} from '@/sa/components';
import { Button } from '@/ui/Button';

const ROLE_FILTERS = [
  { value: 'all', label: 'All roles' },
  { value: 'clinic_administrator', label: 'Clinic administrator' },
  { value: 'receptionist', label: 'Appointment manager' },
  { value: 'veterinarian', label: 'Veterinarian' },
  { value: 'clinic_staff', label: 'Clinic staff' },
];

const STATUS_FILTERS = [
  { value: 'all', label: 'All statuses' },
  { value: 'active', label: 'Active' },
  { value: 'invited', label: 'Invitation pending' },
  { value: 'suspended', label: 'Suspended' },
  { value: 'revoked', label: 'Revoked' },
];

/** CA-06 — the clinic's own team, searchable and filterable. */
export function ClinicStaff() {
  const { user } = useAuth();
  const clinicId = user?.clinicId ?? null;
  const invited = user?.membershipStatus === 'invited';
  const location = useLocation();
  const flash = (location.state as { flash?: string } | null)?.flash ?? null;

  const [search, setSearch] = useState('');
  const [role, setRole] = useState('all');
  const [status, setStatus] = useState('all');

  const state = useAsync(async () => {
    if (!clinicId) throw new Error('No clinic is attached to this account.');
    if (invited) return null;
    return { team: await fetchClinicTeam(clinicId) };
  }, [clinicId, invited]);

  const team = state.data?.team ?? [];

  const rows = useMemo(() => {
    const term = search.trim().toLowerCase();
    return team
      .filter((member) => {
        if (role !== 'all' && member.staff_role !== role) return false;
        if (status !== 'all' && member.status !== status) return false;
        if (!term) return true;
        return [
          member.profile?.first_name,
          member.profile?.last_name,
          member.profile?.email,
          member.profile?.mobile_number,
          label(member.staff_role),
        ]
          .filter(Boolean)
          .some((value) => String(value).toLowerCase().includes(term));
      })
      .sort((a, b) => {
        const adminRank =
          Number(b.staff_role === 'clinic_administrator') -
          Number(a.staff_role === 'clinic_administrator');
        if (adminRank !== 0) return adminRank;
        return (a.profile ? fullName(a.profile) : '').localeCompare(
          b.profile ? fullName(b.profile) : '',
        );
      });
  }, [team, search, role, status]);

  const counts = useMemo(
    () => ({
      total: team.length,
      active: team.filter((member) => member.status === 'active').length,
      invited: team.filter((member) => member.status === 'invited').length,
      suspended: team.filter((member) => member.status === 'suspended').length,
    }),
    [team],
  );

  if (!clinicId) return <NoClinicAssigned title="Staff management" />;

  if (invited) {
    return <InvitationPending clinicName={user?.clinicName ?? null} email={user?.email ?? ''} />;
  }

  if (state.loading) return <LoadingPage rows={5} />;

  if (state.error || !state.data) {
    return <FailedPage title="Staff management" message={state.error} onRetry={state.reload} />;
  }

  return (
    <div className="page">
      <PageHeader
        title="Staff management"
        subtitle="Everyone with a membership at your clinic. Invited accounts cannot open the workspace until they activate."
        actions={
          <Link to="/clinic-admin/staff/new">
            <Button>Add staff</Button>
          </Link>
        }
      />

      {flash ? <Notice tone="success">{flash}</Notice> : null}

      <div className="metrics">
        <Metric label="Team members" value={counts.total} />
        <Metric label="Active" value={counts.active} />
        <Metric label="Invitation pending" value={counts.invited} />
        <Metric label="Suspended" value={counts.suspended} />
      </div>

      <Panel
        title={`${rows.length} team member${rows.length === 1 ? '' : 's'}`}
        subtitle="Search by name, email, contact number or role."
        actions={
          <div className="toolbar__group">
            <SearchField value={search} onChange={setSearch} placeholder="Name or email" />
            <SelectField label="Role" value={role} onChange={setRole} options={ROLE_FILTERS} />
            <SelectField
              label="Status"
              value={status}
              onChange={setStatus}
              options={STATUS_FILTERS}
            />
          </div>
        }
        flush
      >
        {rows.length ? (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Staff</th>
                  <th>Contact number</th>
                  <th>Role</th>
                  <th>Status</th>
                  <th>Added</th>
                  <th className="table__right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((member) => {
                  const name = member.profile ? fullName(member.profile) : 'Account not linked';
                  return (
                    <tr key={member.id}>
                      <td>
                        <div className="row" style={{ gap: 12 }}>
                          <span className="avatar">
                            {member.profile?.profile_picture ? (
                              <img src={member.profile.profile_picture} alt="" />
                            ) : (
                              initials(member.profile?.first_name, member.profile?.last_name)
                            )}
                          </span>
                          <div>
                            <p className="table__primary">{name}</p>
                            <p className="table__secondary">{member.profile?.email ?? 'No email'}</p>
                          </div>
                        </div>
                      </td>
                      <td>{member.profile?.mobile_number ?? '—'}</td>
                      <td>{label(member.staff_role)}</td>
                      <td>
                        <StatusBadge status={member.status} />
                      </td>
                      <td className="table__mono">{formatDate(member.created_at)}</td>
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
        ) : team.length ? (
          <EmptyState
            title="No staff match those filters"
            description="Clear the search or choose a different role or status."
          />
        ) : (
          <EmptyState
            icon="users"
            title="No team members yet"
            description="Invite the clinic's first receptionist, veterinarian or clinic staff member."
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

      <ClinicFooter right="Team data is clinic-scoped; invitations go through invite-staff" />
    </div>
  );
}
