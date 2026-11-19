import { useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { formatDate, formatDateTime, fullName, humaniseAction, label } from '@/lib/format';
import { useAsync } from '@/lib/useAsync';
import {
  fetchAuditForActor,
  fetchClinics,
  fetchMemberships,
  fetchProfile,
  fetchProfiles,
  type Membership,
  type Profile,
} from '@/sa/data';
import {
  ConsoleFooter,
  DetailRow,
  EmptyState,
  ErrorState,
  LoadingState,
  Notice,
  PageHeader,
  Pager,
  Panel,
  SearchField,
  SelectField,
  StatusBadge,
} from '@/sa/components';
import { Button } from '@/ui/Button';

const PAGE_SIZE = 12;

type Row = {
  profile: Profile;
  membership: Membership | null;
  clinicName: string;
  status: string;
  statusLabel: string;
  tone: 'success' | 'warning' | 'danger' | 'neutral';
};

function accountState(profile: Profile, membership: Membership | null): Pick<Row, 'status' | 'statusLabel' | 'tone'> {
  if (profile.role === 'system_administrator') {
    return { status: 'platform', statusLabel: 'Platform admin', tone: 'neutral' };
  }
  if (!membership) {
    return profile.role === 'pet_owner'
      ? { status: 'owner', statusLabel: 'Pet owner', tone: 'neutral' }
      : { status: 'no_clinic', statusLabel: 'No clinic', tone: 'warning' };
  }
  if (membership.status === 'active') {
    return { status: 'active', statusLabel: 'Active', tone: 'success' };
  }
  if (membership.status === 'invited') {
    return { status: 'invited', statusLabel: 'Invitation pending', tone: 'warning' };
  }
  return { status: membership.status, statusLabel: label(membership.status), tone: 'danger' };
}

/** SA-08 — every account on the platform, clinic-scoped or not. */
export function PlatformUsers() {
  const [search, setSearch] = useState('');
  const [role, setRole] = useState('all');
  const [account, setAccount] = useState('all');
  const [page, setPage] = useState(1);

  const state = useAsync(
    () =>
      Promise.all([fetchProfiles(), fetchMemberships(), fetchClinics()]).then(
        ([profiles, memberships, clinics]) => ({ profiles, memberships, clinics }),
      ),
    [],
  );

  const rows = useMemo<Row[]>(() => {
    if (!state.data) return [];
    const { profiles, memberships, clinics } = state.data;
    return profiles.map((profile) => {
      const membership =
        memberships.find((row) => row.user_id === profile.id && row.status !== 'revoked') ?? null;
      const clinic = membership ? clinics.find((row) => row.id === membership.clinic_id) : null;
      return {
        profile,
        membership,
        clinicName: clinic?.clinic_name ?? '—',
        ...accountState(profile, membership),
      };
    });
  }, [state.data]);

  const term = search.trim().toLowerCase();
  const filtered = rows.filter((row) => {
    if (role !== 'all' && row.profile.role !== role) return false;
    if (account === 'active' && row.status !== 'active') return false;
    if (account === 'invited' && row.status !== 'invited') return false;
    if (account === 'none' && row.membership) return false;
    if (!term) return true;
    return [fullName(row.profile), row.profile.email, row.clinicName]
      .filter(Boolean)
      .some((value) => String(value).toLowerCase().includes(term));
  });

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const current = Math.min(page, pageCount);
  const visible = filtered.slice((current - 1) * PAGE_SIZE, current * PAGE_SIZE);

  return (
    <div className="page">
      <PageHeader
        title="Platform user management"
        subtitle="Pet owners, clinic teams and administrators across every clinic."
      />

      <Notice tone="info">
        Accounts are read-only here: <strong>profiles.role</strong> is intentionally not writable by
        any browser client. Roles change through clinic provisioning and staff invitations, which
        run in the service role.
      </Notice>

      <Panel
        title={`${filtered.length} user${filtered.length === 1 ? '' : 's'}`}
        subtitle="Open an account for its clinic access and administrative history."
        actions={
          <div className="toolbar__group">
            <SearchField
              value={search}
              onChange={(value) => {
                setSearch(value);
                setPage(1);
              }}
              placeholder="Name, email or clinic"
              label="Search users"
            />
            <SelectField
              label="Role"
              value={role}
              onChange={(value) => {
                setRole(value);
                setPage(1);
              }}
              options={[
                { value: 'all', label: 'All roles' },
                { value: 'pet_owner', label: 'Pet owner' },
                { value: 'clinic_administrator', label: 'Clinic administrator' },
                { value: 'receptionist', label: 'Appointment manager' },
                { value: 'veterinarian', label: 'Veterinarian' },
                { value: 'clinic_staff', label: 'Clinic staff' },
                { value: 'system_administrator', label: 'System administrator' },
              ]}
            />
            <SelectField
              label="Account"
              value={account}
              onChange={(value) => {
                setAccount(value);
                setPage(1);
              }}
              options={[
                { value: 'all', label: 'Any status' },
                { value: 'active', label: 'Active' },
                { value: 'invited', label: 'Invitation pending' },
                { value: 'none', label: 'No clinic' },
              ]}
            />
          </div>
        }
        flush
      >
        {state.loading ? (
          <LoadingState rows={6} />
        ) : state.error ? (
          <ErrorState message={state.error} onRetry={state.reload} />
        ) : visible.length ? (
          <>
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr>
                    <th>User</th>
                    <th>Email</th>
                    <th>Clinic</th>
                    <th>Role</th>
                    <th>Account</th>
                    <th>Registered</th>
                    <th className="table__right" />
                  </tr>
                </thead>
                <tbody>
                  {visible.map((row) => (
                    <tr key={row.profile.id}>
                      <td>
                        <Link className="linkish" to={`/system-admin/users/${row.profile.id}`}>
                          {fullName(row.profile)}
                        </Link>
                        <p className="table__secondary">
                          {row.membership ? row.membership.staff_role.replace(/_/g, ' ') : 'No membership'}
                        </p>
                      </td>
                      <td>{row.profile.email ?? '—'}</td>
                      <td>{row.clinicName}</td>
                      <td>{label(row.profile.role)}</td>
                      <td>
                        <StatusBadge status={row.status} tone={row.tone}>
                          {row.statusLabel}
                        </StatusBadge>
                      </td>
                      <td className="table__mono">{formatDate(row.profile.created_at)}</td>
                      <td className="table__right">
                        <Link to={`/system-admin/users/${row.profile.id}`}>
                          <Button size="sm" variant="outline">
                            Open
                          </Button>
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Pager page={current} pageSize={PAGE_SIZE} total={filtered.length} onPage={setPage} />
          </>
        ) : (
          <EmptyState title="No users match those filters" description="Adjust the search or filters." />
        )}
      </Panel>

      <ConsoleFooter />
    </div>
  );
}

/** SA-09 — one account: details, clinic access and administrative activity. */
export function UserDetails() {
  const { id } = useParams<{ id: string }>();

  const state = useAsync(async () => {
    if (!id) throw new Error('No user was selected.');
    const [profile, memberships, clinics, activity] = await Promise.all([
      fetchProfile(id),
      fetchMemberships(),
      fetchClinics(),
      fetchAuditForActor(id, 15),
    ]);
    if (!profile) throw new Error('That account no longer exists.');
    return {
      profile,
      memberships: memberships.filter((row) => row.user_id === id),
      clinics,
      activity,
    };
  }, [id]);

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
        <Link to="/system-admin/users" className="linkish">
          Back to platform users
        </Link>
      </div>
    );
  }

  const { profile, memberships, clinics, activity } = state.data;
  const primary = memberships.find((row) => row.status !== 'revoked') ?? null;

  return (
    <div className="page">
      <PageHeader
        title={fullName(profile)}
        subtitle={
          <span className="row" style={{ gap: 10 }}>
            {profile.email ?? 'No email'} · {label(profile.role)}
            <StatusBadge status={primary?.status ?? (profile.role === 'pet_owner' ? 'owner' : 'no_clinic')}>
              {primary ? label(primary.status) : profile.role === 'pet_owner' ? 'Pet owner' : 'No clinic'}
            </StatusBadge>
          </span>
        }
        actions={
          <Link to="/system-admin/users">
            <Button variant="ghost">Back to users</Button>
          </Link>
        }
      />

      <div className="grid grid--detail">
        <Panel title="Account information">
          <dl className="detail">
            <DetailRow term="Full name">{fullName(profile)}</DetailRow>
            <DetailRow term="Email">{profile.email ?? '—'}</DetailRow>
            <DetailRow term="Mobile">{profile.mobile_number ?? '—'}</DetailRow>
            <DetailRow term="Platform role">{label(profile.role)}</DetailRow>
            <DetailRow term="Console access">
              {profile.role === 'pet_owner'
                ? 'None — mobile app only'
                : 'Yes — role routes the console'}
            </DetailRow>
            <DetailRow term="Registered">{formatDateTime(profile.created_at)}</DetailRow>
            <DetailRow term="Profile updated">{formatDateTime(profile.updated_at)}</DetailRow>
          </dl>
        </Panel>

        <Panel title="Clinic access" subtitle="Memberships decide what the clinic data policies allow">
          {memberships.length ? (
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr>
                    <th>Clinic</th>
                    <th>Staff role</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {memberships.map((row) => {
                    const clinic = clinics.find((candidate) => candidate.id === row.clinic_id);
                    return (
                      <tr key={row.id}>
                        <td>
                          <Link className="linkish" to={`/system-admin/clinics/${row.clinic_id}`}>
                            {clinic?.clinic_name ?? 'Removed clinic'}
                          </Link>
                        </td>
                        <td>{label(row.staff_role)}</td>
                        <td>
                          <StatusBadge status={row.status} />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <EmptyState
              icon="shield"
              title="No clinic membership"
              description={
                profile.role === 'pet_owner'
                  ? 'This is a pet-owner account; it never reaches clinic data.'
                  : 'The account has a console role but no clinic attached yet.'
              }
            />
          )}
        </Panel>
      </div>

      <Panel title="Administrative activity" subtitle="Audit entries written by this account">
        {activity.length ? (
          <div className="timeline">
            {activity.map((entry) => (
              <div className="timeline__item" key={entry.id}>
                <span className="timeline__time">{formatDate(entry.created_at)}</span>
                <div>
                  <span>{humaniseAction(entry.action)}</span>
                  <p className="timeline__meta">
                    {entry.entity_type ? `${entry.entity_type} · ` : ''}
                    {entry.clinic_id
                      ? clinics.find((clinic) => clinic.id === entry.clinic_id)?.clinic_name ?? 'Clinic'
                      : 'Platform'}
                  </p>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <EmptyState
            icon="clock"
            title="No administrative actions"
            description="Only privileged actions are audited, so a normal pet-owner account stays empty here."
          />
        )}
      </Panel>

      <ConsoleFooter />
    </div>
  );
}
