import { useEffect, useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { AuthLayout } from '@/layout/AuthLayout';
import { friendlyAuthError, supabase } from '@/lib/supabase';
import { Button } from '@/ui/Button';
import { Icon } from '@/ui/Icon';
import { Input } from '@/ui/Input';

type Phase = 'checking' | 'ready' | 'expired';

export function ResetPasswordScreen() {
  const navigate = useNavigate();
  const [phase, setPhase] = useState<Phase>('checking');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // Supabase sends the recovery link back here with a fragment or a PKCE code.
  // detectSessionInUrl exchanges it; this waits for that session to appear.
  useEffect(() => {
    let active = true;
    const query = new URLSearchParams(window.location.search);
    const hash = new URLSearchParams(window.location.hash.replace(/^#/, ''));
    const linkError = query.get('error_description') ?? hash.get('error_description');

    if (linkError) {
      setError(linkError.replace(/\+/g, ' '));
      setPhase('expired');
      return;
    }

    const check = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!active) return;
      setPhase(session ? 'ready' : 'expired');
    };

    void check();
    const retry = window.setTimeout(() => void check(), 1200);

    const { data: subscription } = supabase.auth.onAuthStateChange((event, session) => {
      if (!active) return;
      if (session && (event === 'PASSWORD_RECOVERY' || event === 'SIGNED_IN')) {
        setPhase('ready');
      }
    });

    return () => {
      active = false;
      window.clearTimeout(retry);
      subscription.subscription.unsubscribe();
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
      await supabase.auth.signOut();
      navigate('/login', {
        replace: true,
        state: { message: 'Password updated. Sign in with your new password.' },
      });
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Unable to update the password.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <AuthLayout code="AUTH-03" breadcrumb="Clinic personnel / Secure access">
      {phase === 'checking' ? (
        <p className="muted">Checking your reset link…</p>
      ) : phase === 'expired' ? (
        <>
          <div className="auth__success-icon" style={{ background: 'var(--danger-bg)', color: 'var(--danger)' }}>
            <Icon name="alert" size={22} />
          </div>
          <h1 className="auth__title">This link has expired</h1>
          <p className="auth__subtitle">
            Reset links can only be used once. Request a new one and open it in this browser.
          </p>
          {error ? (
            <div className="alert alert--error auth__alert" role="alert">
              <Icon name="alert" size={18} />
              <span>{error}</span>
            </div>
          ) : null}
          <div className="auth__submit">
            <Link to="/forgot-password">
              <Button size="auth">Request a new link</Button>
            </Link>
          </div>
          <p className="auth__note-copy">
            <Link to="/login">Return to Login</Link>
          </p>
        </>
      ) : (
        <>
          <p className="auth__eyebrow">Account recovery</p>
          <h1 className="auth__title">Reset Password</h1>
          <p className="auth__subtitle">
            Choose a new password for your VetLink clinic account. You&rsquo;ll sign in with it next.
          </p>

          <form onSubmit={onSubmit} noValidate>
            <div className="auth__fields">
              <Input
                label="New password"
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
                {busy ? 'Saving…' : 'Reset Password'}
              </Button>
            </div>
          </form>

          <p className="auth__note-copy">
            <Link to="/login">Return to Login</Link>
          </p>
        </>
      )}
    </AuthLayout>
  );
}
