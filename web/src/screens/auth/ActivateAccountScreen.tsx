import { useEffect, useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { AuthLayout } from '@/layout/AuthLayout';
import { friendlyAuthError, supabase } from '@/lib/supabase';
import { Button } from '@/ui/Button';
import { Icon } from '@/ui/Icon';
import { Input } from '@/ui/Input';

type Phase = 'checking' | 'ready' | 'expired';

async function waitForSession(attempts = 8): Promise<boolean> {
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (session) return true;
    await new Promise((resolve) => window.setTimeout(resolve, 250));
  }
  return false;
}

export function ActivateAccountScreen() {
  const navigate = useNavigate();
  const [phase, setPhase] = useState<Phase>('checking');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [linkError, setLinkError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // Supabase invitation links arrive either as a PKCE code, a token hash, or a
  // fragment session. detectSessionInUrl handles the last one; the others are
  // exchanged here before the password form is shown.
  useEffect(() => {
    let active = true;
    const query = new URLSearchParams(window.location.search);
    const hash = new URLSearchParams(window.location.hash.replace(/^#/, ''));
    const reportedError = query.get('error_description') ?? hash.get('error_description');

    if (reportedError) {
      setLinkError(reportedError.replace(/\+/g, ' '));
      setPhase('expired');
      return;
    }

    (async () => {
      const code = query.get('code');
      const tokenHash = query.get('token_hash');
      const type = query.get('type') ?? 'invite';

      if (code && !(await waitForSession(3))) {
        const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
        if (exchangeError && !/flow state|verifier/i.test(exchangeError.message)) {
          if (active) {
            setLinkError(friendlyAuthError(exchangeError.message));
            setPhase('expired');
            return;
          }
        }
      }

      if (tokenHash && !(await waitForSession(2))) {
        const { error: otpError } = await supabase.auth.verifyOtp({
          type: type as 'invite',
          token_hash: tokenHash,
        });
        if (otpError && active) {
          setLinkError(friendlyAuthError(otpError.message));
          setPhase('expired');
          return;
        }
      }

      const signedIn = await waitForSession(10);
      if (!active) return;
      setPhase(signedIn ? 'ready' : 'expired');
    })();

    return () => {
      active = false;
    };
  }, []);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    if (password.length < 8) {
      setError('Use a password with at least 8 characters.');
      return;
    }
    if (password !== confirm) {
      setError('The two passwords do not match.');
      return;
    }

    setBusy(true);
    try {
      const { error: updateError } = await supabase.auth.updateUser({ password });
      if (updateError) throw new Error(friendlyAuthError(updateError.message));

      // Marks any invitation row for this account as active.
      const { error: acceptError } = await supabase.rpc('accept_staff_invitation');
      if (acceptError) throw new Error(acceptError.message);

      navigate('/complete-profile', { replace: true });
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Unable to activate the account.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <AuthLayout code="AUTH-05" breadcrumb="Clinic personnel / Account activation">
      {phase === 'checking' ? (
        <p className="muted">Checking your invitation…</p>
      ) : phase === 'expired' ? (
        <>
          <div
            className="auth__success-icon"
            style={{ background: 'var(--danger-bg)', color: 'var(--danger)' }}
          >
            <Icon name="alert" size={22} />
          </div>
          <h1 className="auth__title">This invitation has expired</h1>
          <p className="auth__subtitle">
            Invitation links can only be used once. Ask your Clinic Administrator to send a new
            invitation, then open it in this browser.
          </p>
          {linkError ? (
            <div className="alert alert--error auth__alert" role="alert">
              <Icon name="alert" size={18} />
              <span>{linkError}</span>
            </div>
          ) : null}
          <div className="auth__submit">
            <Link to="/login">
              <Button size="auth" variant="outline">
                Return to Login
              </Button>
            </Link>
          </div>
        </>
      ) : (
        <>
          <p className="auth__eyebrow">You&rsquo;re invited</p>
          <h1 className="auth__title">Activate Account</h1>
          <p className="auth__subtitle">
            Choose a password for your VetLink staff account. Your clinic and role are assigned by
            your Clinic Administrator.
          </p>

          <form onSubmit={onSubmit} noValidate>
            <div className="auth__fields">
              <Input
                label="Create password"
                name="password"
                autoComplete="new-password"
                revealable
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                hint="At least 8 characters."
                disabled={busy}
              />
              <Input
                label="Confirm password"
                name="confirm-password"
                autoComplete="new-password"
                revealable
                value={confirm}
                onChange={(event) => setConfirm(event.target.value)}
                disabled={busy}
              />
            </div>

            {error ? (
              <div className="alert alert--error auth__alert" role="alert">
                <Icon name="alert" size={18} />
                <span>{error}</span>
              </div>
            ) : null}

            <div className="auth__submit">
              <Button type="submit" size="auth" loading={busy}>
                {busy ? 'Activating…' : 'Activate Account'}
              </Button>
            </div>
          </form>
        </>
      )}
    </AuthLayout>
  );
}
