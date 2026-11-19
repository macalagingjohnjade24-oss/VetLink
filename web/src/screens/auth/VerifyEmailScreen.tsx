import { useState, type FormEvent } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { ROLE_HOME } from '@/auth/roles';
import { useAuth } from '@/auth/AuthProvider';
import { AuthLayout } from '@/layout/AuthLayout';
import { friendlyAuthError, supabase, toAbsoluteUrl } from '@/lib/supabase';
import { Button } from '@/ui/Button';
import { CodeInput } from '@/ui/CodeInput';
import { Icon } from '@/ui/Icon';
import { Input } from '@/ui/Input';

export function VerifyEmailScreen() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const { refresh } = useAuth();

  const [email, setEmail] = useState(params.get('email') ?? '');
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [resending, setResending] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setNotice(null);

    if (!email.trim()) {
      setError('Enter the email address you registered with.');
      return;
    }
    if (code.length !== 6) {
      setError('Enter the six-digit code from the confirmation email.');
      return;
    }

    setBusy(true);
    try {
      const { error: verifyError } = await supabase.auth.verifyOtp({
        email: email.trim(),
        token: code,
        type: 'signup',
      });
      if (verifyError) throw new Error(friendlyAuthError(verifyError.message));

      const account = await refresh();
      if (!account) {
        navigate('/login', { replace: true, state: { message: 'Email confirmed. Sign in to continue.' } });
        return;
      }
      if (!account.profileComplete) {
        navigate('/complete-profile', { replace: true });
        return;
      }
      navigate(ROLE_HOME[account.role], { replace: true });
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Unable to verify that code.');
    } finally {
      setBusy(false);
    }
  }

  async function resend() {
    setError(null);
    setNotice(null);
    if (!email.trim()) {
      setError('Enter the email address you registered with.');
      return;
    }

    setResending(true);
    try {
      const { error: resendError } = await supabase.auth.resend({
        type: 'signup',
        email: email.trim(),
        options: { emailRedirectTo: toAbsoluteUrl('/login') },
      });
      if (resendError) throw new Error(friendlyAuthError(resendError.message));
      setNotice('A new confirmation code is on its way. It can take a minute to arrive.');
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Unable to resend the code.');
    } finally {
      setResending(false);
    }
  }

  return (
    <AuthLayout code="AUTH-04" breadcrumb="Clinic personnel / Secure access">
      <p className="auth__eyebrow">Verify your account</p>
      <h1 className="auth__title">Check your email</h1>
      <p className="auth__subtitle">
        Enter the six-digit code from the VetLink confirmation email. The code confirms the address
        for your clinic account.
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
          <div className="field">
            <span className="field__label">Verification code</span>
            <CodeInput value={code} onChange={setCode} disabled={busy} />
          </div>
        </div>

        {notice ? (
          <div className="alert alert--success auth__alert" role="status">
            <Icon name="check" size={18} />
            <span>{notice}</span>
          </div>
        ) : null}

        {error ? (
          <div className="alert alert--error auth__alert" role="alert">
            <Icon name="alert" size={18} />
            <span>{error}</span>
          </div>
        ) : null}

        <div className="auth__submit">
          <Button type="submit" size="auth" loading={busy}>
            {busy ? 'Verifying…' : 'Verify'}
          </Button>
        </div>

        <div className="auth__submit">
          <Button
            type="button"
            size="auth"
            variant="peach"
            loading={resending}
            onClick={() => void resend()}
          >
            Resend Code
          </Button>
        </div>
      </form>

      <p className="auth__note-copy">
        <Link to="/login">Return to Login</Link>
      </p>
    </AuthLayout>
  );
}
