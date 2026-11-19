import { useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { AuthLayout } from '@/layout/AuthLayout';
import { friendlyAuthError, supabase, toAbsoluteUrl } from '@/lib/supabase';
import { Button } from '@/ui/Button';
import { Icon } from '@/ui/Icon';
import { Input } from '@/ui/Input';

export function ForgotPasswordScreen() {
  const [email, setEmail] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    if (!email.trim()) {
      setError('Enter the email address for your clinic account.');
      return;
    }

    setBusy(true);
    try {
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(email.trim(), {
        redirectTo: toAbsoluteUrl('/reset-password'),
      });
      if (resetError) throw new Error(friendlyAuthError(resetError.message));
      setSent(true);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Unable to send the reset link.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <AuthLayout code="AUTH-02" breadcrumb="Clinic personnel / Secure access">
      {sent ? (
        <>
          <div className="auth__success-icon">
            <Icon name="mail" size={22} />
          </div>
          <h1 className="auth__title">Check your inbox</h1>
          <p className="auth__subtitle">
            If <strong>{email}</strong> belongs to a VetLink clinic account, a password reset link
            is on its way. The link returns you here to choose a new password.
          </p>
          <div className="auth__submit">
            <Link to="/login">
              <Button size="auth" variant="outline">
                Return to Login
              </Button>
            </Link>
          </div>
          <div className="auth__note">
            <p className="auth__note-copy">
              No email after a few minutes? Ask your Clinic Administrator to confirm your account
              address, then try again.
            </p>
          </div>
        </>
      ) : (
        <>
          <p className="auth__eyebrow">Account recovery</p>
          <h1 className="auth__title">Forgot Password</h1>
          <p className="auth__subtitle">
            Enter the email address you use for VetLink and we&rsquo;ll send a link to reset your
            password.
          </p>

          <form onSubmit={onSubmit} noValidate>
            <div className="auth__fields">
              <Input
                label="Email address"
                name="email"
                type="email"
                autoComplete="username"
                placeholder="you@clinic.ph"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
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
                {busy ? 'Sending…' : 'Send Reset Link'}
              </Button>
            </div>
          </form>

          <div className="auth__submit">
            <Link to="/login">
              <Button size="auth" variant="outline">
                Return to Login
              </Button>
            </Link>
          </div>
        </>
      )}
    </AuthLayout>
  );
}
