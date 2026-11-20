import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/auth/AuthProvider';
import { ROLE_LABEL, scopeLabel } from '@/auth/roles';
import { supabase } from '@/lib/supabase';
import { formatDateTime, initials } from '@/lib/format';
import { changePassword, updateOwnProfile, verifyCurrentPassword } from '@/sa/data';
import {
  ConfirmDialog,
  ConsoleFooter,
  Notice,
  PageHeader,
  Panel,
} from '@/sa/components';
import { Button } from '@/ui/Button';
import { Input } from '@/ui/Input';

/** SA-16 — the administrator's own account, security and session. */
export function AdminProfile() {
  const { user, refresh } = useAuth();
  const navigate = useNavigate();

  const [firstName, setFirstName] = useState(user?.firstName ?? '');
  const [lastName, setLastName] = useState(user?.lastName ?? '');
  const [mobile, setMobile] = useState(user?.mobile ?? '');
  const [detailsNotice, setDetailsNotice] = useState<{ tone: 'success' | 'error'; text: string } | null>(
    null,
  );
  const [savingDetails, setSavingDetails] = useState(false);

  const [password, setPassword] = useState('');
  const [currentPassword, setCurrentPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [passwordNotice, setPasswordNotice] = useState<{ tone: 'success' | 'error'; text: string } | null>(
    null,
  );
  const [savingPassword, setSavingPassword] = useState(false);

  const [expiresAt, setExpiresAt] = useState<number | null>(null);
  const [confirmSignOut, setConfirmSignOut] = useState(false);
  const [signingOut, setSigningOut] = useState(false);

  useEffect(() => {
    void supabase.auth.getSession().then(({ data }) => {
      setExpiresAt(data.session?.expires_at ?? null);
    });
  }, []);

  if (!user) return null;

  const detailsDirty =
    firstName !== user.firstName || lastName !== user.lastName || mobile !== user.mobile;

  const saveDetails = async () => {
    if (!firstName.trim() || !lastName.trim()) {
      setDetailsNotice({ tone: 'error', text: 'Both names are required.' });
      return;
    }
    setSavingDetails(true);
    try {
      await updateOwnProfile(user.id, {
        first_name: firstName.trim(),
        last_name: lastName.trim(),
        mobile_number: mobile.trim() || null,
      });
      await refresh();
      setDetailsNotice({ tone: 'success', text: 'Your profile details were updated.' });
    } catch (failure) {
      setDetailsNotice({
        tone: 'error',
        text: failure instanceof Error ? failure.message : String(failure),
      });
    } finally {
      setSavingDetails(false);
    }
  };

  const savePassword = async () => {
    if (!currentPassword) {
      setPasswordNotice({ tone: 'error', text: 'Enter your current password.' });
      return;
    }
    if (password.length < 8) {
      setPasswordNotice({ tone: 'error', text: 'Use at least eight characters.' });
      return;
    }
    if (password !== confirmation) {
      setPasswordNotice({ tone: 'error', text: 'The two passwords do not match.' });
      return;
    }
    setSavingPassword(true);
    try {
      await verifyCurrentPassword(user.email, currentPassword);
      await changePassword(password);
      setCurrentPassword('');
      setPassword('');
      setConfirmation('');
      setPasswordNotice({ tone: 'success', text: 'Your password was changed.' });
    } catch (failure) {
      setPasswordNotice({
        tone: 'error',
        text: failure instanceof Error ? failure.message : String(failure),
      });
    } finally {
      setSavingPassword(false);
    }
  };

  const signOutEverywhere = async () => {
    setSigningOut(true);
    await supabase.auth.signOut({ scope: 'global' });
    navigate('/login', { replace: true });
  };

  return (
    <div className="page">
      <PageHeader
        title="My profile"
        subtitle={`${ROLE_LABEL[user.role]} · ${scopeLabel(user.role, user.mfaEnrolled)}`}
      />

      <div className="grid grid--detail">
        <Panel title="Personal details" subtitle="Shown to other administrators in the console">
          <div className="stack--sm" style={{ display: 'grid', gap: 14 }}>
            <div className="row" style={{ gap: 14 }}>
              <span className="avatar" style={{ width: 52, height: 52, fontSize: 18 }}>
                {user.avatarUrl ? <img src={user.avatarUrl} alt="" /> : initials(user.firstName, user.lastName)}
              </span>
              <div>
                <p className="table__primary">
                  {user.firstName} {user.lastName}
                </p>
                <p className="table__secondary">{user.email}</p>
              </div>
            </div>
            <div className="grid grid--two" style={{ gap: 12 }}>
              <Input
                label="First name"
                value={firstName}
                onChange={(event) => setFirstName(event.target.value)}
              />
              <Input
                label="Last name"
                value={lastName}
                onChange={(event) => setLastName(event.target.value)}
              />
            </div>
            <Input
              label="Mobile number"
              value={mobile}
              onChange={(event) => setMobile(event.target.value)}
              placeholder="+63 917 000 0000"
            />
            <Input
              label="Email address"
              value={user.email}
              readOnly
              disabled
              hint="Email changes are handled by VetLink support so audit history stays intact."
            />
            {detailsNotice ? <Notice tone={detailsNotice.tone}>{detailsNotice.text}</Notice> : null}
            <div className="row" style={{ justifyContent: 'flex-end' }}>
              <Button
                onClick={() => void saveDetails()}
                loading={savingDetails}
                disabled={!detailsDirty}
              >
                Save details
              </Button>
            </div>
          </div>
        </Panel>

        <div className="stack">
          <Panel title="Account security">
            <dl className="detail" style={{ gridTemplateColumns: '130px 1fr' }}>
              <dt>Role</dt>
              <dd>{ROLE_LABEL[user.role]}</dd>
              <dt>Scope</dt>
              <dd>Platform-wide · clinical records stay clinic-scoped</dd>
              <dt>Session</dt>
              <dd>
                {expiresAt
                  ? `Access token valid until ${formatDateTime(new Date(expiresAt * 1000).toISOString())}`
                  : 'No active session token'}
              </dd>
              <dt>MFA</dt>
              <dd>
                {user.mfaEnrolled
                  ? 'Enrolled — authenticator app (TOTP) verified'
                  : 'MFA not enrolled'}
              </dd>
            </dl>
            <div className="row" style={{ justifyContent: 'flex-end', marginTop: 16 }}>
              <Button variant="outline" onClick={() => setConfirmSignOut(true)}>
                Sign out of all devices
              </Button>
            </div>
          </Panel>

          <Panel title="Change password" subtitle="At least eight characters">
            <div className="stack--sm" style={{ display: 'grid', gap: 12 }}>
              <Input
                label="Current password"
                revealable
                value={currentPassword}
                onChange={(event) => setCurrentPassword(event.target.value)}
                autoComplete="current-password"
              />
              <Input
                label="New password"
                revealable
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                autoComplete="new-password"
              />
              <Input
                label="Confirm new password"
                revealable
                value={confirmation}
                onChange={(event) => setConfirmation(event.target.value)}
                autoComplete="new-password"
              />
              {passwordNotice ? <Notice tone={passwordNotice.tone}>{passwordNotice.text}</Notice> : null}
              <div className="row" style={{ justifyContent: 'flex-end' }}>
                <Button
                  onClick={() => void savePassword()}
                  loading={savingPassword}
                  disabled={!currentPassword || !password || !confirmation}
                >
                  Update password
                </Button>
              </div>
            </div>
          </Panel>

          <Panel title="Role and permissions">
            <p className="stat__note">
              Your role is written by the service role only. If platform access needs to change, it
              is done by another System Administrator through the provisioning flow — a browser
              session cannot grant itself a role.
            </p>
          </Panel>
        </div>
      </div>

      <ConfirmDialog
        open={confirmSignOut}
        title="Sign out everywhere?"
        description="Every signed-in device, including this console, will be signed out. You will need your password to return."
        confirmLabel="Sign out everywhere"
        confirmVariant="danger"
        busy={signingOut}
        onConfirm={() => void signOutEverywhere()}
        onClose={() => setConfirmSignOut(false)}
      />

      <ConsoleFooter right="Account changes are your own actions" />
    </div>
  );
}
