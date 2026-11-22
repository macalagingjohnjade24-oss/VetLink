import { useState } from 'react';
import { Link, useLocation, useParams } from 'react-router-dom';
import { useAuth } from '@/auth/AuthProvider';
import { useAsync } from '@/lib/useAsync';
import { formatDate, fullName, initials, label } from '@/lib/format';
import { fetchClinicStaffMember, updateClinicStaffMembership } from '@/clinic/staff';
import { clinicRoleSummary } from '@/clinic/roles';
import { ClinicFooter, FailedPage, InvitationPending, LoadingPage, NoClinicAssigned } from '@/clinic/components';
import {
  ConfirmDialog,
  DetailRow,
  Notice,
  PageHeader,
  Panel,
  StatusBadge,
} from '@/sa/components';
import { Button } from '@/ui/Button';

/** CA-08 — one team member, from the clinic's point of view. */
export function ClinicStaffDetails() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const clinicId = user?.clinicId ?? null;
  const invited = user?.membershipStatus === 'invited';
  const location = useLocation();

  const [flash, setFlash] = useState(
    (location.state as { flash?: string } | null)?.flash ?? null,
  );
  const [notice, setNotice] = useState<string | null>(null);
  const [pendingStatus, setPendingStatus] = useState<'active' | 'suspended' | null>(null);
  const [busy, setBusy] = useState(false);

  const state = useAsync(async () => {
    if (!clinicId) throw new Error('No clinic is attached to this account.');
    if (invited) return null;
    if (!id) throw new Error('No staff member was selected.');
    const member = await fetchClinicStaffMember(clinicId, id);
    if (!member) throw new Error('That staff member is not on this clinic’s team.');
    return { member };
  }, [clinicId, invited, id]);

  if (!clinicId) return <NoClinicAssigned title="Staff details" />;

  if (invited) {
    return <InvitationPending clinicName={user?.clinicName ?? null} email={user?.email ?? ''} />;
  }

  if (state.loading) return <LoadingPage rows={4} />;

  if (state.error || !state.data) {
    return (
      <FailedPage
        title="Staff details"
        message={state.error}
        onRetry={state.reload}
        actions={
          <Link className="linkish" to="/clinic-admin/staff">
            Back to staff management
          </Link>
        }
      />
    );
  }

  const { member } = state.data;
  const profile = member.profile;
  const name = profile ? fullName(profile) : 'Account not linked';
  const isSelf = member.user_id === user?.id;
  const vetLinkManaged = member.staff_role === 'clinic_administrator';

  const changeStatus = async () => {
    if (!pendingStatus || busy) return;
    setBusy(true);
    setNotice(null);
    try {
      await updateClinicStaffMembership(clinicId, member.id, { status: pendingStatus });
      setFlash(
        pendingStatus === 'suspended'
          ? `${name} can no longer access the clinic.`
          : `${name} can access the clinic again.`,
      );
      setPendingStatus(null);
      state.reload();
    } catch (error) {
      setNotice(error instanceof Error ? error.message : String(error));
      setPendingStatus(null);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="page">
      <PageHeader
        title={name}
        subtitle={
          <span className="row" style={{ gap: 10 }}>
            {label(member.staff_role)}
            <StatusBadge status={member.status} />
          </span>
        }
        actions={
          <>
            <Link to="/clinic-admin/staff">
              <Button variant="ghost">Back to staff</Button>
            </Link>
            {!vetLinkManaged ? (
              <Link to={`/clinic-admin/staff/${member.id}/edit`}>
                <Button variant="outline">Edit staff</Button>
              </Link>
            ) : null}
            {member.status === 'active' && !isSelf ? (
              <Button variant="danger" onClick={() => setPendingStatus('suspended')}>
                Deactivate
              </Button>
            ) : null}
            {member.status === 'suspended' ? (
              <Button onClick={() => setPendingStatus('active')}>Reactivate</Button>
            ) : null}
          </>
        }
      />

      {flash ? <Notice tone="success">{flash}</Notice> : null}
      {notice ? <Notice tone="error">{notice}</Notice> : null}

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
              <p className="table__secondary">{label(member.staff_role)}</p>
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
            <DetailRow term="Role">{label(member.staff_role)}</DetailRow>
            <DetailRow term="Status">
              <StatusBadge status={member.status} />
            </DetailRow>
            <DetailRow term="Joined">{formatDate(member.created_at)}</DetailRow>
            <DetailRow term="Clinic">{user?.clinicName ?? '—'}</DetailRow>
            <DetailRow term="Reference">{user?.clinicReference ?? '—'}</DetailRow>
          </dl>
          {isSelf ? (
            <p className="stat__note" style={{ marginTop: 12 }}>
              This is your own membership. Another Clinic Administrator must deactivate it.
            </p>
          ) : null}
        </Panel>
      </div>

      <Panel title="Assigned permissions" subtitle="Determined by the membership role">
        <p className="muted" style={{ lineHeight: 1.6 }}>
          {clinicRoleSummary(member.staff_role)}
        </p>
        <p className="stat__note" style={{ marginTop: 12 }}>
          Permissions are enforced by row-level security and the clinic RPCs. Role and status
          changes are recorded against your account.
        </p>
      </Panel>

      <ConfirmDialog
        open={pendingStatus !== null}
        title={
          pendingStatus === 'suspended' ? `Deactivate ${name}?` : `Reactivate ${name}?`
        }
        description={
          pendingStatus === 'suspended'
            ? 'They stay in the directory but lose access to every clinic screen and RPC immediately. Assignments and history are kept, and you can reactivate them later.'
            : 'Their existing role is restored, so they can reach the clinic workspace again.'
        }
        confirmLabel={pendingStatus === 'suspended' ? 'Deactivate account' : 'Reactivate account'}
        confirmVariant={pendingStatus === 'suspended' ? 'danger' : 'primary'}
        busy={busy}
        onConfirm={() => void changeStatus()}
        onClose={() => {
          if (!busy) setPendingStatus(null);
        }}
      />

      <ClinicFooter right="Membership data is clinic-scoped by row-level security" />
    </div>
  );
}
