import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '@/auth/AuthProvider';
import { AuthLayout } from '@/layout/AuthLayout';
import { Button } from '@/ui/Button';
import { Icon } from '@/ui/Icon';

/**
 * AUTH-07 — shown to a signed-in pet owner, and to anyone who lands on a
 * section their role does not own.
 */
export function AccessRestrictedScreen() {
  const { roleBlocked, signOut } = useAuth();
  const navigate = useNavigate();

  return (
    <AuthLayout code="AUTH-07" breadcrumb="Clinic personnel / Secure access" footerRight="VetLink support · support@vetlink.ph">
      <div className="auth__restricted">
        <span className="auth__restricted-icon">
          <Icon name="lock" size={28} />
        </span>
        <h1 className="auth__title">Access Restricted</h1>
        <p className="auth__subtitle">
          {roleBlocked
            ? 'This workspace is for clinic personnel and system administrators. Your account is a pet-owner account — use the VetLink mobile app for pet profiles, booking and health records.'
            : 'You do not have permission to open this section. Your Clinic Administrator controls which tools your role can use.'}
        </p>

        <div className="auth__restricted-actions">
          {roleBlocked ? (
            <Button
              onClick={async () => {
                await signOut();
                navigate('/login', { replace: true });
              }}
            >
              Sign out
            </Button>
          ) : (
            <Link to="/login">
              <Button>Return to Login</Button>
            </Link>
          )}
          <Link to="/login">
            <Button variant="outline">Back to Sign In</Button>
          </Link>
        </div>

        <p className="auth__note-copy">
          Need clinic access? Ask your Clinic Administrator to invite your VetLink account.
        </p>
      </div>
    </AuthLayout>
  );
}
