import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '@/auth/AuthProvider';
import { STAFF_ROLE_OPTIONS, inviteClinicStaff, type StaffInviteInput } from '@/clinic/staff';
import { InvitationPending } from '@/clinic/components';
import { Notice, PageHeader, Panel, SelectField } from '@/sa/components';
import { Button } from '@/ui/Button';
import { Input } from '@/ui/Input';

const blank = (value: string) => (value.trim() ? value.trim() : null);

/** CA-07 — invite a receptionist, veterinarian or clinic staff member. */
export function ClinicStaffInvite() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const clinicId = user?.clinicId ?? null;
  const invited = user?.membershipStatus === 'invited';

  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [mobile, setMobile] = useState('');
  const [staffRole, setStaffRole] = useState<StaffInviteInput['staff_role']>('receptionist');

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [notice, setNotice] = useState<string | null>(null);
  const [sending, setSending] = useState(false);

  if (!clinicId) {
    return (
      <div className="page">
        <PageHeader title="Add staff" subtitle="No clinic assigned yet" />
        <Panel>
          <Notice tone="info">
            A Clinic Administrator manages one clinic. Ask a VetLink System Administrator to
            provision the clinic account first.
          </Notice>
        </Panel>
      </div>
    );
  }

  if (invited) {
    return <InvitationPending clinicName={user?.clinicName ?? null} email={user?.email ?? ''} />;
  }

  const validate = () => {
    const next: Record<string, string> = {};
    if (!firstName.trim()) next.firstName = 'First name is required.';
    if (!lastName.trim()) next.lastName = 'Last name is required.';
    if (!email.trim()) next.email = 'Email is required.';
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      next.email = 'Enter a valid email address.';
    }
    if (mobile.trim().length > 40) next.mobile = 'Use 40 characters or fewer.';
    return next;
  };

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (sending) return;

    const nextErrors = validate();
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length) {
      setNotice('Check the highlighted fields before sending the invitation.');
      return;
    }

    setSending(true);
    setNotice(null);
    try {
      const result = await inviteClinicStaff(clinicId, {
        email: email.trim(),
        first_name: firstName.trim(),
        last_name: lastName.trim(),
        mobile_number: blank(mobile),
        staff_role: staffRole,
      });
      navigate('/clinic-admin/staff', { replace: true, state: { flash: result.message } });
    } catch (error) {
      setNotice(error instanceof Error ? error.message : String(error));
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="page">
      <PageHeader
        title="Add staff account"
        subtitle={`${user?.clinicName ?? 'Your clinic'} · the invitation is sent by email`}
        actions={
          <>
            <Link to="/clinic-admin/staff">
              <Button variant="ghost">Cancel</Button>
            </Link>
            <Button type="submit" form="clinic-staff-invite" loading={sending}>
              Send invitation
            </Button>
          </>
        }
      />

      {notice ? <Notice tone="error">{notice}</Notice> : null}

      <form id="clinic-staff-invite" className="stack" noValidate onSubmit={handleSubmit}>
        <Panel
          title="Staff details"
          subtitle="An existing VetLink account is linked immediately; a new address receives an activation email."
        >
          <div className="grid grid--two">
            <Input
              label="First name"
              value={firstName}
              onChange={(event) => setFirstName(event.target.value)}
              error={errors.firstName}
              maxLength={80}
            />
            <Input
              label="Last name"
              value={lastName}
              onChange={(event) => setLastName(event.target.value)}
              error={errors.lastName}
              maxLength={80}
            />
            <Input
              label="Email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              error={errors.email}
              type="email"
              maxLength={160}
              placeholder="name@clinic.ph"
            />
            <Input
              label="Contact number"
              value={mobile}
              onChange={(event) => setMobile(event.target.value)}
              error={errors.mobile}
              maxLength={40}
              placeholder="+63 917 000 0000"
            />
            <SelectField
              label="Assigned role"
              value={staffRole}
              onChange={(value) => setStaffRole(value as StaffInviteInput['staff_role'])}
              options={[...STAFF_ROLE_OPTIONS]}
            />
            <p className="field__hint" style={{ alignSelf: 'end', paddingBottom: 10 }}>
              Clinic administrators are provisioned by VetLink and cannot be invited here.
            </p>
          </div>
        </Panel>

        <Notice tone="info">
          The invitation returns to the console's activation screen, where the person sets a
          password. Until they accept, the membership stays <strong>invitation pending</strong> and
          the workspace stays closed to them.
        </Notice>

        <div className="row" style={{ justifyContent: 'flex-end', gap: 10 }}>
          <Link to="/clinic-admin/staff">
            <Button variant="ghost">Cancel</Button>
          </Link>
          <Button type="submit" loading={sending}>
            Send invitation
          </Button>
        </div>
      </form>

      <footer className="page__footer">
        <span>VetLink · Clinic administration · CA-07</span>
        <span>Invitations are sent by the invite-staff function</span>
      </footer>
    </div>
  );
}
