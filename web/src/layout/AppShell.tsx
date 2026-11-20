import type { ReactNode } from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import { ROLE_LABEL, scopeLabel } from '@/auth/roles';
import { useAuth, type ConsoleUser } from '@/auth/AuthProvider';
import { NAV, ROLE_NOTE } from '@/shell/nav';
import { Icon } from '@/ui/Icon';
import { Logo } from '@/ui/Logo';

type Props = {
  user: ConsoleUser;
  children: ReactNode;
};

const initials = (user: ConsoleUser) =>
  `${user.firstName.charAt(0)}${user.lastName.charAt(0)}`.toUpperCase() || 'VL';

/**
 * Sidebar + top header + content area, shared by every role. Widths come from
 * the Figma frames: 256px sidebar, 80px header, 1120px content column.
 */
export function AppShell({ user, children }: Props) {
  const { signOut } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const items = NAV[user.role];
  const current = items.find((item) => item.path === location.pathname) ?? items[0];
  const isSystemAdmin = user.role === 'system_administrator';
  const contextName = isSystemAdmin ? 'VetLink Control Center' : (user.clinicName ?? 'No clinic assigned');
  const contextMeta = isSystemAdmin
    ? 'All clinics · Restricted access'
    : [user.clinicReference, user.membershipStatus === 'invited' ? 'Invitation pending' : 'Verified']
        .filter(Boolean)
        .join(' · ');

  return (
    <div className="shell">
      <aside className="sidebar">
        <Logo className="sidebar__brand" />

        <div className="sidebar__context">
          <p className="sidebar__context-label">
            {isSystemAdmin ? 'Platform administration' : 'Your assigned clinic'}
          </p>
          <p className="sidebar__context-name">{contextName}</p>
          <p className="sidebar__context-meta">{contextMeta || 'Contact VetLink support'}</p>
        </div>

        <nav className="sidebar__nav" aria-label="Workspace sections">
          {items.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              className={({ isActive }) =>
                `sidebar__item${isActive ? ' sidebar__item--active' : ''}`
              }
            >
              <Icon name={item.icon} size={20} />
              <span>{item.label}</span>
            </NavLink>
          ))}
        </nav>

        <div className="sidebar__account">
          <div className="sidebar__account-note">
            <p className="sidebar__account-label">{ROLE_NOTE[user.role].label}</p>
            <p className="sidebar__account-copy">{ROLE_NOTE[user.role].copy}</p>
          </div>
          <hr className="divider" />
          <div className="sidebar__account-row">
            <span className="avatar">
              {user.avatarUrl ? <img src={user.avatarUrl} alt="" /> : initials(user)}
            </span>
            <div>
              <p className="sidebar__account-name">
                {user.firstName} {user.lastName}
              </p>
              <p className="sidebar__account-role">{ROLE_LABEL[user.role]}</p>
            </div>
          </div>
          <button
            type="button"
            className="sidebar__logout"
            onClick={async () => {
              await signOut();
              navigate('/login', { replace: true });
            }}
          >
            <Icon name="logout" size={16} />
            Log out
          </button>
        </div>
      </aside>

      <div className="shell__main">
        <header className="topbar">
          <div className="topbar__titles">
            <p className="topbar__crumb">
              {contextName} / {isSystemAdmin ? 'Platform administration' : 'Clinic administration'}
            </p>
            <p className="topbar__title">{current?.label ?? 'Dashboard'}</p>
          </div>
          <div className="topbar__actions">
            <span className="topbar__scope">
              <Icon name="shield" size={20} />
              {scopeLabel(user.role, user.mfaEnrolled)}
            </span>
            <button type="button" className="icon-button" aria-label="Notifications" disabled>
              <Icon name="bell" size={22} />
              <span className="icon-button__dot" aria-hidden="true" />
            </button>
            <div className="topbar__user">
              <span className="avatar">
                {user.avatarUrl ? <img src={user.avatarUrl} alt="" /> : initials(user)}
              </span>
              <div>
                <p className="topbar__user-name">
                  {user.firstName} {user.lastName}
                </p>
                <p className="topbar__user-role">{ROLE_LABEL[user.role]}</p>
              </div>
            </div>
          </div>
        </header>

        {children}
      </div>
    </div>
  );
}
