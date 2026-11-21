import type { ReactNode } from 'react';
import { BrowserRouter, Navigate, Outlet, Route, Routes } from 'react-router-dom';
import { ROLE_HOME } from '@/auth/roles';
import { AuthProvider, useAuth } from '@/auth/AuthProvider';
import { AppShell } from '@/layout/AppShell';
import { ActivateAccountScreen } from '@/screens/auth/ActivateAccountScreen';
import { AccessRestrictedScreen } from '@/screens/auth/AccessRestrictedScreen';
import { CompleteProfileScreen } from '@/screens/auth/CompleteProfileScreen';
import { ForgotPasswordScreen } from '@/screens/auth/ForgotPasswordScreen';
import { LoginScreen } from '@/screens/auth/LoginScreen';
import { ResetPasswordScreen } from '@/screens/auth/ResetPasswordScreen';
import { VerifyEmailScreen } from '@/screens/auth/VerifyEmailScreen';
import { AdminDashboard } from '@/screens/sa/AdminDashboard';
import { ClinicAccounts } from '@/screens/sa/Accounts';
import { ApplicationReview, Applications } from '@/screens/sa/Applications';
import { AuditLogs } from '@/screens/sa/AuditLog';
import { ClinicDetails, ClinicDirectory } from '@/screens/sa/Clinics';
import { Monitoring } from '@/screens/sa/Monitoring';
import { SystemNotifications } from '@/screens/sa/Notifications';
import { AdminProfile } from '@/screens/sa/Profile';
import { Reports } from '@/screens/sa/Reports';
import { RolesAndAccess } from '@/screens/sa/Roles';
import { SystemSettings } from '@/screens/sa/Settings';
import { PlatformUsers, UserDetails } from '@/screens/sa/Users';
import { ClinicDashboard } from '@/screens/ca/ClinicDashboard';
import { ClinicPermissions } from '@/screens/ca/ClinicPermissions';
import { ClinicProfile } from '@/screens/ca/ClinicProfile';
import { ClinicReports } from '@/screens/ca/ClinicReports';
import { ClinicProfileEdit } from '@/screens/ca/ClinicProfileEdit';
import { ClinicServiceForm } from '@/screens/ca/ClinicServiceForm';
import { ClinicServices } from '@/screens/ca/ClinicServices';
import { ClinicStaff } from '@/screens/ca/ClinicStaff';
import { ClinicStaffDetails } from '@/screens/ca/ClinicStaffDetails';
import { ClinicStaffEdit } from '@/screens/ca/ClinicStaffEdit';
import { ClinicStaffInvite } from '@/screens/ca/ClinicStaffInvite';
import { SectionPage } from '@/screens/SectionPage';
import { SetupNotice } from '@/screens/SetupNotice';
import { ALL_NAV_ITEMS } from '@/shell/nav';

/** Signed-in console users never see the login screen again. */
function PublicOnly({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  if (user) return <Navigate to={ROLE_HOME[user.role]} replace />;
  return <>{children}</>;
}

function ProtectedLayout() {
  const { user, roleBlocked } = useAuth();
  if (roleBlocked) return <Navigate to="/access-restricted" replace />;
  if (!user) return <Navigate to="/login" replace />;
  return (
    <AppShell user={user}>
      <Outlet />
    </AppShell>
  );
}

function IndexRedirect() {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" replace />;
  return <Navigate to={ROLE_HOME[user.role]} replace />;
}

function NotFound() {
  const { user } = useAuth();
  return (
    <div className="page">
      <div className="card">
        <h2>That page does not exist</h2>
        <p className="muted" style={{ marginTop: 8 }}>
          Check the address, or return to your dashboard.
        </p>
        <a className="auth__link" href={user ? ROLE_HOME[user.role] : '/login'} style={{ display: 'inline-block', marginTop: 14 }}>
          {user ? 'Back to dashboard' : 'Back to sign in'}
        </a>
      </div>
    </div>
  );
}

/**
 * Platform-wide screens are gated on the role as well as the route: hiding a
 * link is never the boundary, and the RLS policies behind each query assume a
 * system_administrator caller.
 */
function SystemAdministratorOnly({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  if (!user || user.role !== 'system_administrator') {
    return (
      <div className="page">
        <div className="card">
          <h2>System Administrator access only</h2>
          <p className="muted" style={{ marginTop: 8 }}>
            This area manages the whole VetLink platform. Clinic accounts stay inside their own
            clinic, and pet-owner accounts use the mobile app.
          </p>
          <a
            className="auth__link"
            href={user ? ROLE_HOME[user.role] : '/login'}
            style={{ display: 'inline-block', marginTop: 14 }}
          >
            Back to your dashboard
          </a>
        </div>
      </div>
    );
  }
  return <>{children}</>;
}

/** CA-01 – CA-10. CA-11 – CA-13 still render their SectionPage notice. */
const CLINIC_ADMIN_ROUTES: { path: string; element: ReactNode }[] = [
  { path: '/clinic-admin', element: <ClinicDashboard /> },
  { path: '/clinic-admin/profile', element: <ClinicProfile /> },
  { path: '/clinic-admin/profile/edit', element: <ClinicProfileEdit /> },
  { path: '/clinic-admin/services', element: <ClinicServices /> },
  { path: '/clinic-admin/services/new', element: <ClinicServiceForm /> },
  { path: '/clinic-admin/services/:id/edit', element: <ClinicServiceForm /> },
  { path: '/clinic-admin/staff', element: <ClinicStaff /> },
  { path: '/clinic-admin/staff/new', element: <ClinicStaffInvite /> },
  { path: '/clinic-admin/staff/:id', element: <ClinicStaffDetails /> },
  { path: '/clinic-admin/staff/:id/edit', element: <ClinicStaffEdit /> },
  { path: '/clinic-admin/permissions', element: <ClinicPermissions /> },
  { path: '/clinic-admin/reports', element: <ClinicReports /> },
];

/** A clinic workspace belongs to the clinic's administrator, not its staff. */
function ClinicAdministratorOnly({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  if (!user || user.role !== 'clinic_administrator') {
    return (
      <div className="page">
        <div className="card">
          <h2>Clinic Administrator access only</h2>
          <p className="muted" style={{ marginTop: 8 }}>
            This workspace manages a clinic's profile, services, staff and reports. Other clinic
            roles keep their own workspace, and pet-owner accounts use the mobile app.
          </p>
          <a
            className="auth__link"
            href={user ? ROLE_HOME[user.role] : '/login'}
            style={{ display: 'inline-block', marginTop: 14 }}
          >
            Back to your dashboard
          </a>
        </div>
      </div>
    );
  }
  return <>{children}</>;
}

/** SA-01 – SA-16. Detail routes carry SA-04, SA-05, SA-07 and SA-09. */
const SYSTEM_ADMIN_ROUTES: { path: string; element: ReactNode }[] = [
  { path: '/system-admin', element: <AdminDashboard /> },
  { path: '/system-admin/clinics', element: <ClinicDirectory /> },
  { path: '/system-admin/clinics/:id', element: <ClinicDetails /> },
  { path: '/system-admin/applications', element: <Applications /> },
  { path: '/system-admin/applications/:id', element: <ApplicationReview /> },
  { path: '/system-admin/accounts', element: <ClinicAccounts /> },
  { path: '/system-admin/users', element: <PlatformUsers /> },
  { path: '/system-admin/users/:id', element: <UserDetails /> },
  { path: '/system-admin/roles', element: <RolesAndAccess /> },
  { path: '/system-admin/monitoring', element: <Monitoring /> },
  { path: '/system-admin/reports', element: <Reports /> },
  { path: '/system-admin/audit', element: <AuditLogs /> },
  { path: '/system-admin/notifications', element: <SystemNotifications /> },
  { path: '/system-admin/settings', element: <SystemSettings /> },
  { path: '/system-admin/profile', element: <AdminProfile /> },
];

const DEFINED_PATHS = new Set(
  [...SYSTEM_ADMIN_ROUTES, ...CLINIC_ADMIN_ROUTES].map((route) => route.path),
);

function AppRoutes() {
  const { status } = useAuth();

  if (status === 'unconfigured') return <SetupNotice />;
  if (status === 'loading') {
    return <p className="auth__spinner">Restoring your session…</p>;
  }

  return (
    <Routes>
      <Route
        path="/login"
        element={
          <PublicOnly>
            <LoginScreen />
          </PublicOnly>
        }
      />
      <Route
        path="/forgot-password"
        element={
          <PublicOnly>
            <ForgotPasswordScreen />
          </PublicOnly>
        }
      />
      <Route path="/reset-password" element={<ResetPasswordScreen />} />
      <Route
        path="/verify-email"
        element={
          <PublicOnly>
            <VerifyEmailScreen />
          </PublicOnly>
        }
      />
      <Route path="/activate" element={<ActivateAccountScreen />} />
      <Route path="/complete-profile" element={<CompleteProfileScreen />} />
      <Route path="/access-restricted" element={<AccessRestrictedScreen />} />

      <Route element={<ProtectedLayout />}>
        <Route index element={<IndexRedirect />} />
        {SYSTEM_ADMIN_ROUTES.map((route) => (
          <Route
            key={route.path}
            path={route.path}
            element={<SystemAdministratorOnly>{route.element}</SystemAdministratorOnly>}
          />
        ))}
        {CLINIC_ADMIN_ROUTES.map((route) => (
          <Route
            key={route.path}
            path={route.path}
            element={<ClinicAdministratorOnly>{route.element}</ClinicAdministratorOnly>}
          />
        ))}
        {ALL_NAV_ITEMS.filter((item) => !DEFINED_PATHS.has(item.path)).map((item) => (
          <Route key={item.path} path={item.path} element={<SectionPage item={item} />} />
        ))}
        <Route path="*" element={<NotFound />} />
      </Route>
    </Routes>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
    </BrowserRouter>
  );
}
