import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom';
import { ROLE_LABEL, scopeLabel } from '@/auth/roles';
import { useAuth, type ConsoleUser } from '@/auth/AuthProvider';
import { countUnreadNotifications } from '@/clinic/notifications';
import { NAV, NOTIFICATIONS_PATH, ROLE_NOTE, WORKSPACE_LABEL } from '@/shell/nav';
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
 *
 * Up to 1080px wide (tablets and phones) the sidebar becomes a drawer opened
 * from the ☰ button in the top bar, so the page content starts at the top of
 * the screen instead of below the whole navigation.
 */
export function AppShell({ user, children }: Props) {
  const { signOut } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const items = NAV[user.role];
  // The deepest section that contains this page, so /appointments/owners/123 keeps
  // saying "Pet owners". A page directly under the console root — an appointment,
  // a new booking — names the management screen it is opened from instead.
  const root = items[0];
  const deepest = items
    .filter(
      (item) => location.pathname === item.path || location.pathname.startsWith(`${item.path}/`),
    )
    .reduce((best, item) => (item.path.length > best.path.length ? item : best), root);
  const current =
    deepest.path === root.path && location.pathname !== root.path
      ? (items.find((item) => item.path === `${root.path}/management`) ?? deepest)
      : deepest;
  const isSystemAdmin = user.role === 'system_administrator';
  const [unread, setUnread] = useState(0);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuButton = useRef<HTMLButtonElement>(null);
  const drawer = useRef<HTMLElement>(null);

  // Choosing a page closes the drawer.
  useEffect(() => {
    setMenuOpen(false);
  }, [location.pathname]);

  // While open: Escape closes it, the page behind does not scroll, and focus
  // moves into the drawer, returning to the ☰ button when it closes.
  useEffect(() => {
    if (!menuOpen) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setMenuOpen(false);
    };
    document.addEventListener('keydown', onKey);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    drawer.current?.querySelector<HTMLElement>('.sidebar__close')?.focus();
    const button = menuButton.current;
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = previousOverflow;
      button?.focus();
    };
  }, [menuOpen]);

  // Re-counted on every navigation, so reading the inbox clears the dot.
  useEffect(() => {
    let live = true;
    countUnreadNotifications()
      .then((count) => {
        if (live) setUnread(count);
      })
      .catch(() => {
        if (live) setUnread(0);
      });
    return () => {
      live = false;
    };
  }, [location.pathname, user.id]);

  const contextName = isSystemAdmin ? 'VetLink Control Center' : (user.clinicName ?? 'No clinic assigned');
  const contextMeta = isSystemAdmin
    ? 'All clinics · Restricted access'
    : [user.clinicReference, user.membershipStatus === 'invited' ? 'Invitation pending' : 'Verified']
        .filter(Boolean)
        .join(' · ');

  return (
    <div className={`shell${menuOpen ? ' shell--menu-open' : ''}`}>
      <aside
        id="workspace-menu"
        ref={drawer}
        className={`sidebar${menuOpen ? ' sidebar--open' : ''}`}
        aria-label="Workspace menu"
      >
        <div className="sidebar__top">
          <Logo className="sidebar__brand" />
          <button
            type="button"
            className="icon-button sidebar__close"
            aria-label="Close menu"
            onClick={() => setMenuOpen(false)}
          >
            <Icon name="x" size={22} />
          </button>
        </div>

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
              // The section the page belongs to, not every prefix of it: the
              // dashboard's path is the root of every other path in its role.
              className={`sidebar__item${item.path === current.path ? ' sidebar__item--active' : ''}`}
              aria-current={item.path === current.path ? 'page' : undefined}
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

      {menuOpen ? (
        <div className="shell__backdrop" aria-hidden="true" onClick={() => setMenuOpen(false)} />
      ) : null}

      <div className="shell__main">
        <header className="topbar">
          <button
            ref={menuButton}
            type="button"
            className="icon-button topbar__menu"
            aria-label="Open menu"
            aria-controls="workspace-menu"
            aria-expanded={menuOpen}
            onClick={() => setMenuOpen(true)}
          >
            <Icon name="menu" size={24} />
          </button>
          <div className="topbar__titles">
            <p className="topbar__crumb">
              {contextName} / {WORKSPACE_LABEL[user.role]}
            </p>
            <p className="topbar__title">{current?.label ?? 'Dashboard'}</p>
          </div>
          <div className="topbar__actions">
            <span className="topbar__scope">
              <Icon name="shield" size={20} />
              {scopeLabel(user.role, user.mfaEnrolled)}
            </span>
            <Link
              to={NOTIFICATIONS_PATH[user.role]}
              className="icon-button"
              aria-label={unread ? `Notifications, ${unread} unread` : 'Notifications'}
            >
              <Icon name="bell" size={22} />
              {unread ? <span className="icon-button__dot" aria-hidden="true" /> : null}
            </Link>
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
