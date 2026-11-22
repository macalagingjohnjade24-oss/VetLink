import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { Logo } from '@/ui/Logo';

/** Header and footer shared by the public registration pages (REG-01 – REG-10). */
export function RegisterLayout({ children }: { children: ReactNode }) {
  return (
    <div className="reg">
      <header className="reg__header">
        <div className="reg__brand">
          <Link to="/register" aria-label="VetLink clinic registration">
            <Logo className="reg__logo" />
          </Link>
          <span className="reg__tagline">Veterinary Care, Connected.</span>
        </div>
        <nav className="reg__links" aria-label="Registration">
          <Link to="/register" className="reg__link--secondary">
            Clinic registration
          </Link>
          <Link to="/login">Already registered? Login</Link>
        </nav>
      </header>
      <main className="reg__main">{children}</main>
      <footer className="reg__footer">
        <span>© {new Date().getFullYear()} VetLink. All rights reserved.</span>
        <span>Application support · Privacy Policy · Terms of Use</span>
      </footer>
    </div>
  );
}
