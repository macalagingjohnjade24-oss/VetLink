import { useState, type FormEvent } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '@/auth/AuthProvider';
import { useAsync } from '@/lib/useAsync';
import { fullName, label } from '@/lib/format';
import {
  STAFF_ROLE_OPTIONS,
  fetchClinicStaffMember,
  updateClinicStaffMembership,
  type EditableStaffRole,
} from '@/clinic/staff';
import { ClinicFooter, InvitationPending, NoClinicAssigned } from '@/clinic/components';
import {
  DetailRow,
  ErrorState,
  LoadingState,
  Notice,
  PageHeader,
  Panel,
  SelectField,
} from '@/sa/components';
import { Button } from '@/ui/Button';
import type { TeamMember } from '@/clinic/data';

function RoleForm({
  clinicId,
  member,
}: {
  clinicId: string;
  member: TeamMember;
}) {
  const navigate = useNavigate();
  const [role, setRole] = useState<EditableStaffRole>(member.staff_role as EditableStaffRole);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const name = member.profile ? fullName(member.profile) : 'this staff member';

  const save = async (event: FormEvent) => {
    event.preventDefault();
    if (saving || role === member.staff_role) return;
    setSaving(true);
    setError(null);
    try {
      await updateClinicStaffMembership(clinicId, member.id, { staff_role: role });
      navigate(`/clinic-admin/staff/${member.id}`, {
        replace: true,
        state: { flash: `${name} is now ${label(role).toLowerCase()}.` },
      });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setSaving(false);
    }
  };

  return (
    <form className="stack" onSubmit={save}>
      {error ? <Notice tone="error">{error}</Notice> : null}

      <Panel
        title="Assigned role"
        subtitle="The role decides which clinic screens, RPCs and records this membership can reach."
      >
        <SelectField
          label="Role"
          value={role}
          onChange={(value) => setRole(value as EditableStaffRole)}
          options={[...STAFF_ROLE_OPTIONS]}
        />
        <p className="field__hint" style={{ marginTop: 10 }}>
          Clinic administrators are provisioned by VetLink and are not editable here.
        </p>
      </Panel>

      <Panel title="Staff profile" subtitle="Managed by the staff member, not the clinic">
        <dl className="detail">
          <DetailRow term="Name">{name}</DetailRow>
          <DetailRow term="Email">{member.profile?.email ?? '—'}</DetailRow>
          <DetailRow term="Contact number">{member.profile?.mobile_number ?? '—'}</DetailRow>
          <DetailRow term="Status">{label(member.status)}</DetailRow>
        </dl>
        <p className="stat__note" style={{ marginTop: 12 }}>
          Name, contact number and photo are edited by the staff member in their own profile.
          Email changes go through VetLink support.
        </p>
      </Panel>

      <div className="row" style={{ justifyContent: 'flex-end', gap: 10 }}>
        <Link to={`/clinic-admin/staff/${member.id}`}>
          <Button variant="ghost">Cancel</Button>
        </Link>
        <Button type="submit" loading={saving} disabled={role === member.staff_role}>
          Save role
        </Button>
      </div>
    </form>
  );
}

/** CA-06 edit — membership role, the only staff field the clinic controls. */
export function ClinicStaffEdit() {
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

  if (!clinicId) return <NoClinicAssigned title="Edit staff" />;

  if (invited) {
    return <InvitationPending clinicName={user?.clinicName ?? null} email={user?.email ?? ''} />;
  }

  if (state.loading) {
    return (
      <div className="page">
        <LoadingState rows={3} />
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

  return (
    <div className="page">
      <PageHeader
        title="Edit staff"
        subtitle={member.profile ? fullName(member.profile) : 'Clinic staff member'}
        actions={
          <Link to={`/clinic-admin/staff/${member.id}`}>
            <Button variant="ghost">Cancel</Button>
          </Link>
        }
      />

      {member.staff_role === 'clinic_administrator' ? (
        <Panel>
          <Notice tone="info">
            Clinic administrators are provisioned and managed by VetLink, so their role cannot be
            changed from the clinic console.
          </Notice>
          <div style={{ marginTop: 14 }}>
            <Link to={`/clinic-admin/staff/${member.id}`}>
              <Button variant="outline">Back to details</Button>
            </Link>
          </div>
        </Panel>
      ) : (
        <RoleForm clinicId={clinicId} member={member} />
      )}

      <ClinicFooter right="Role changes are clinic-scoped and audited" />
    </div>
  );
}
