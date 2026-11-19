import { Link } from 'react-router-dom';
import { ROLE_HOME } from '@/auth/roles';
import { useAuth } from '@/auth/AuthProvider';
import { NAV, type NavItem } from '@/shell/nav';
import { Icon } from '@/ui/Icon';

/**
 * Sections that are not built yet render this panel. It names the Figma frame
 * and the phase that delivers the screen instead of showing invented data.
 */
export function SectionPage({ item }: { item: NavItem }) {
  const { user } = useAuth();
  if (!user) return null;

  const allowed = NAV[user.role].some((navItem) => navItem.path === item.path);
  if (!allowed) {
    return (
      <div className="page">
        <div className="card">
          <h2>This section is not available to your role</h2>
          <p className="muted" style={{ marginTop: 8 }}>
            {item.label} belongs to another workspace. Your access stays inside your own clinic and
            role.
          </p>
          <Link to={ROLE_HOME[user.role]} className="auth__link" style={{ display: 'inline-block', marginTop: 14 }}>
            Back to your dashboard
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="page">
      <header className="page__header">
        <div>
          <h1 className="page__title">{item.label}</h1>
          <p className="page__subtitle">
            {user.clinicName ?? 'VetLink platform'} · Figma frame {item.code}
          </p>
        </div>
      </header>

      <section className="card">
        <h2>Scheduled for Phase {item.phase}</h2>
        <p className="muted" style={{ marginTop: 8, maxWidth: 640 }}>
          The design for <strong>{item.code} {item.label}</strong> is in the Figma file. Phase 2
          delivered authentication, the design system and this workspace shell; the screens and
          Supabase queries for this section arrive in Phase {item.phase}.
        </p>
        <div className="alert alert--info" style={{ marginTop: 18 }}>
          <Icon name="shield" size={18} />
          <span>
            Every list here will read real Supabase data scoped by your clinic membership — no sample
            rows are shown in the meantime.
          </span>
        </div>
      </section>

      <footer className="page__footer">
        <span>
          {user.clinicName ?? 'VetLink'} {user.clinicReference ? `· ${user.clinicReference}` : ''}
        </span>
        <span>VetLink · Clinic workspace</span>
      </footer>
    </div>
  );
}
