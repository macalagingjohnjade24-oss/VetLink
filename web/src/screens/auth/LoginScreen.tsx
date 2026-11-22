import { useState, type FormEvent } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { ROLE_HOME } from '@/auth/roles';
import { useAuth } from '@/auth/AuthProvider';
import { AuthLayout } from '@/layout/AuthLayout';
import { Button } from '@/ui/Button';
import { Checkbox } from '@/ui/Checkbox';
import { Icon } from '@/ui/Icon';
import { Input } from '@/ui/Input';

type LocationState = { message?: string } | null;

export function LoginScreen() {
  const { signIn } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const notice = (location.state as LocationState)?.message;

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [remember, setRemember] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    if (!email.trim()) {
      setError('Enter the email address for your clinic account.');
      return;
    }
    if (!password) {
      setError('Enter your password.');
      return;
    }

    setBusy(true);
    try {
      const account = await signIn(email, password, remember);
      if (!account) {
        navigate('/access-restricted', { replace: true });
        return;
      }
      navigate(ROLE_HOME[account.role], { replace: true });
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Unable to sign in right now.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <AuthLayout code="AUTH-01" breadcrumb="Clinic personnel / Secure access">
      <p className="auth__eyebrow">Your clinic workspace</p>
      <h1 className="auth__title">Welcome Back</h1>
      <p className="auth__subtitle">Log in to manage your clinic&rsquo;s day, together.</p>

      {notice ? (
        <div className="alert alert--success auth__alert" role="status">
          <Icon name="check" size={18} />
          <span>{notice}</span>
        </div>
      ) : null}

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
          <Input
            label="Password"
            name="password"
            autoComplete="current-password"
            revealable
            placeholder="Enter your password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            disabled={busy}
          />
        </div>

        <div className="auth__row">
          <Checkbox
            label="Remember Me"
            name="remember"
            checked={remember}
            onChange={(event) => setRemember(event.target.checked)}
            disabled={busy}
          />
          <Link className="auth__link" to="/forgot-password">
            Forgot Password?
          </Link>
        </div>

        {error ? (
          <div className="alert alert--error auth__alert" role="alert">
            <Icon name="alert" size={18} />
            <span>{error}</span>
          </div>
        ) : null}

        <div className="auth__submit">
          <Button type="submit" size="auth" loading={busy}>
            {busy ? 'Signing in…' : 'Log in'}
          </Button>
        </div>
      </form>

      <div className="auth__note">
        <p className="auth__note-title">Access tailored to your role</p>
        <p className="auth__note-copy">
          After login, VetLink opens your assigned role&rsquo;s dashboard. Your access is limited to
          your clinic.
        </p>
        <p className="auth__note-copy" style={{ marginTop: 8 }}>
          New clinic?{' '}
          <Link className="auth__link" to="/register">
            Register your clinic
          </Link>
        </p>
      </div>
    </AuthLayout>
  );
}
