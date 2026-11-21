import { Link, useParams } from 'react-router-dom';
import { useAuth } from '@/auth/AuthProvider';
import { useAsync } from '@/lib/useAsync';
import { formatDate, fullName, initials } from '@/lib/format';
import { fetchClinicStaffMember, STAFF_ROLE_LABEL } from '@/clinic/staff';
import { ClinicFooter, InvitationPending } from '@/clinic/components';
import {
  DetailRow,
  EmptyState,
  ErrorState,
  LoadingState,
  Notice,
  PageHeader,
  Panel,
  StatusBadge,
} from '@/sa/components';
import { Button } from '@/ui/Button';

/** What each clinic role can reach, mirroring the 0008 permission matrix in words. */
const ROLE_ACCESS: Record<string, string> = {
  clinic_administrator:
    'Full clinic administration: profile, services, staff, appointments and clinic reports. Clinical records stay with veterinarians.',
  receptionist:
    'Appointment management plus owner and pet contact details. No medical or vaccination record editing.',
  veterinarian:
    'Assigned appointments, patient history, medical records and vaccinations for this clinic.',
  clinic_staff:
    'Assigned tasks and limited pet details through the staff RPCs. Read-only everywhere else.',
};

/** CA-08 — one team member, from the clinic's point of view. */
export function ClinicStaffDetails() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const clinicId = user?.clinicId ?? null;
  const invited = user?.membershipStatus === 'invited';

  const state = useAsync(async () => {
    if (!clinicId) throw new Error('No clinic is attached to this account.');
    if (invited) return null;
    if (!id) throw new Error('No staff member was selected.');
    const member = await fetchClinicStaffMember(clinicId, id);
    if (!member) throw new Error('That staff member is not on this clinic’s team.');
    return { member };
  }, [clinicId, invited, id]);

  if (!clinicId) {
    return (
      <div className="page">
        <PageHeader title="Staff details" subtitle="No clinic assigned yet" />
        <Panel>
          <EmptyState
            icon="map-pin"
            title="No clinic is attached to this account"
            description="A Clinic Administrator manages one clinic. Ask a VetLink System Administrator to provision the clinic account first."
          />
        </Panel>
      </div>
    );
  }

  if (invited) {
    return <InvitationPending clinicName={user?.clinicName ?? null} email={user?.email ?? ''} />;
  }

  if (state.loading) {
    return (
      <div className="page">
        <LoadingState rows={4} />
      </div>
    );
  }

  if (state.error || !state.data) {
    return (
      <div className="page">
        <ErrorState message={state.error ?? 'Unknown error'} onRetry={state.reload} />
        <Link className="linkish" to="/clinic-admin/staff">
          Back to staff management
        </Link>
      </div>
    );
  }

  const { member } = state.data;
  const profile = member.profile;
  const name = profile ? fullName(profile) : 'Account not linked';

  return (
    <div className="page">
      <PageHeader
        title={name}
        subtitle={
          <span className="row" style={{ gap: 10 }}>
            {STAFF_ROLE_LABEL[member.staff_role] ?? member.staff_role}
            <StatusBadge status={member.status} />
          </span>
        }
        actions={
          <Link to="/clinic-admin/staff">
            <Button variant="ghost">Back to staff</Button>
          </Link>
        }
      />

      {member.status === 'invited' ? (
        <Notice tone="info">
          Invitation pending. They activate their account from the email sent to{' '}
          {profile?.email ?? 'their address'}; until then no clinic data is readable to them.
        </Notice>
      ) : null}
      {member.status === 'suspended' ? (
        <Notice tone="warning">
          Access suspended. The account stays in place, but the clinic's data is closed to them
          while the membership status is suspended.
        </Notice>
      ) : null}
      {member.status === 'revoked' ? (
        <Notice tone="error">
          Access revoked. This membership no longer grants any clinic access.
        </Notice>
      ) : null}

      <div className="grid grid--detail">
        <Panel title="Staff profile" subtitle="Contact details from their VetLink account">
          <div className="row" style={{ gap: 16, marginBottom: 18 }}>
            <span className="avatar" style={{ width: 64, height: 64, fontSize: 20 }}>
              {profile?.profile_picture ? (
                <img src={profile.profile_picture} alt="" />
              ) : (
                initials(profile?.first_name, profile?.last_name)
              )}
            </span>
            <div>
              <p className="table__primary" style={{ fontSize: 16 }}>
                {name}
              </p>
              <p className="table__secondary">{STAFF_ROLE_LABEL[member.staff_role] ?? member.staff_role}</p>
            </div>
          </div>
          <dl className="detail">
            <DetailRow term="Email">{profile?.email ?? '—'}</DetailRow>
            <DetailRow term="Contact number">{profile?.mobile_number ?? '—'}</DetailRow>
            <DetailRow term="Account">
              {profile ? 'Linked VetLink account' : 'Profile not created yet'}
            </DetailRow>
          </dl>
        </Panel>

        <Panel title="Membership" subtitle="Scoped to this clinic only">
          <dl className="detail">
            <DetailRow term="Role">{STAFF_ROLE_LABEL[member.staff_role] ?? member.staff_role}</DetailRow>
            <DetailRow term="Status">
              <StatusBadge status={member.status} />
            </DetailRow>
            <DetailRow term="Joined">{formatDate(member.created_at)}</DetailRow>
            <DetailRow term="Clinic">{user?.clinicName ?? '—'}</DetailRow>
            <DetailRow term="Reference">{user?.clinicReference ?? '—'}</DetailRow>
          </dl>
        </Panel>
      </div>

      <Panel title="Assigned permissions" subtitle="Determined by the membership role">
        <p className="muted" style={{ lineHeight: 1.6 }}>
          {ROLE_ACCESS[member.staff_role] ?? 'No clinic permissions are granted to this role.'}
        </p>
        <p className="stat__note" style={{ marginTop: 12 }}>
          Permissions are enforced by row-level security and the clinic RPCs. Role and account
          changes are the remaining CA-06 actions and arrive in a later commit.
        </p>
      </Panel>

      <ClinicFooter right="Membership data is clinic-scoped by row-level security" />
    </div>
  );
}
