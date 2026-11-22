import { Link } from 'react-router-dom';
import illustration from '@/assets/auth-illustration.png';
import { Button } from '@/ui/Button';
import { Icon, type IconName } from '@/ui/Icon';
import { RegisterLayout } from './RegisterLayout';

const BENEFITS: { icon: IconName; title: string; copy: string }[] = [
  {
    icon: 'map-pin',
    title: 'Be discovered locally',
    copy: 'Make your clinic’s location, services and operating hours easy for pet owners to find.',
  },
  {
    icon: 'calendar',
    title: 'Simplify appointment requests',
    copy: 'Bring booking requests and your clinic’s schedule together in one workspace.',
  },
  {
    icon: 'shield',
    title: 'Keep access in the right hands',
    copy: 'Your clinic’s records stay separate, with permissions tailored to each team member.',
  },
];

/** REG-01 — where a clinic starts joining VetLink. */
export function RegisterLanding() {
  return (
    <RegisterLayout>
      <section className="reg-hero">
        <div>
          <p className="reg__eyebrow">For independent veterinary clinics</p>
          <h1 className="reg__title">
            Welcome to VetLink.
            <br />
            More connected care starts here.
          </h1>
          <p className="reg__lead">
            Help pet owners discover your clinic, organize appointment requests, and keep your team
            connected around every patient’s care.
          </p>
          <div className="reg-hero__actions">
            <Link to="/register/apply">
              <Button>Register your clinic</Button>
            </Link>
            <Link to="/login" className="auth__link">
              Already registered? Login
            </Link>
          </div>
          <p className="stat__note" style={{ marginTop: 12 }}>
            For clinic owners and authorized representatives.
          </p>
        </div>
        <img className="reg-hero__art" src={illustration} alt="" />
      </section>

      <section className="reg-cards" aria-label="Why join">
        {BENEFITS.map((benefit) => (
          <article className="reg-card" key={benefit.title}>
            <Icon name={benefit.icon} size={20} />
            <h3>{benefit.title}</h3>
            <p>{benefit.copy}</p>
          </article>
        ))}
      </section>

      <section className="reg-path">
        <h2 style={{ fontSize: 20 }}>A simple path to joining</h2>
        <ol>
          <li>1 · Create your proposed administrator account</li>
          <li>2 · Submit clinic details and documents</li>
          <li>3 · System Administrator review</li>
        </ol>
        <p className="reg-warning">
          Submitting an application does not activate your clinic. Access is provided only after approval.
        </p>
        <p className="stat__note" style={{ marginTop: 8 }}>
          Already applied? <Link to="/register/status">Check your application status</Link>.
        </p>
      </section>
    </RegisterLayout>
  );
}
