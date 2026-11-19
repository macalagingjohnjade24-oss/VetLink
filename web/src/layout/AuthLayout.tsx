import type { ReactNode } from 'react';
import illustration from '@/assets/auth-illustration.png';
import { Icon } from '@/ui/Icon';
import { Logo } from '@/ui/Logo';

type Props = {
  code: string;
  breadcrumb: string;
  children: ReactNode;
  footerRight?: string;
  /** AUTH-06 uses the wider 460px form column. */
  wide?: boolean;
};

/**
 * AUTH-01 … AUTH-07 share this shell: 560px brand rail, centred form column,
 * with the screen code in the top-right corner exactly as designed.
 */
export function AuthLayout({ code, breadcrumb, children, footerRight, wide }: Props) {
  return (
    <div className="auth">
      <aside className="auth__rail">
        <Logo />
        <div className="auth__rail-body">
          <p className="auth__rail-eyebrow">Clinic personnel</p>
          <h2 className="auth__rail-title">
            Veterinary Care,
            <br />
            Connected.
          </h2>
          <img
            className="auth__illustration"
            src={illustration}
            alt="A veterinarian examining a dog while a cat waits beside them"
          />
          <p className="auth__rail-heading">Better care starts with a connected team.</p>
          <p className="auth__rail-copy">
            One secure workspace for your clinic&rsquo;s people, appointments and patient care.
          </p>
          <div className="auth__rail-note">
            <Icon name="shield" size={22} />
            <div>
              <p className="auth__rail-note-title">Secure, role-based access</p>
              <p className="auth__rail-note-copy">Only the tools and records your role permits.</p>
            </div>
          </div>
        </div>
        <p className="auth__rail-footer">VetLink / Clinic workspace</p>
      </aside>

      <main className="auth__panel">
        <div className="auth__panel-header">
          <span>{breadcrumb}</span>
          <span>{code}</span>
        </div>
        <div className="auth__body">
          <div className={`auth__form${wide ? ' auth__form--wide' : ''}`}>{children}</div>
        </div>
        <div className="auth__panel-footer">
          <span>&copy; 2026 VetLink. Veterinary Care, Connected.</span>
          <span>{footerRight ?? 'Need help? Contact your Clinic Administrator.'}</span>
        </div>
      </main>
    </div>
  );
}
