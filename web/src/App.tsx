import type { ReactNode } from 'react';
import { BrowserRouter, Navigate, Outlet, Route, Routes } from 'react-router-dom';
import { ROLE_HOME, type ConsoleRole } from '@/auth/roles';
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
import { ClinicImportExport } from '@/screens/ca/ClinicImportExport';
import { ClinicNotifications } from '@/screens/ca/ClinicNotifications';
import { ClinicPermissions } from '@/screens/ca/ClinicPermissions';
import { ClinicProfile } from '@/screens/ca/ClinicProfile';
import { ClinicReports } from '@/screens/ca/ClinicReports';
import { ClinicProfileEdit } from '@/screens/ca/ClinicProfileEdit';
import { ClinicServiceForm } from '@/screens/ca/ClinicServiceForm';
import { ClinicServices } from '@/screens/ca/ClinicServices';
import { ClinicSettings } from '@/screens/ca/ClinicSettings';
import { ClinicStaff } from '@/screens/ca/ClinicStaff';
import { ClinicStaffDetails } from '@/screens/ca/ClinicStaffDetails';
import { ClinicStaffEdit } from '@/screens/ca/ClinicStaffEdit';
import { ClinicStaffInvite } from '@/screens/ca/ClinicStaffInvite';
import { ClinicTasks } from '@/screens/ca/ClinicTasks';
import { AppointmentDetails } from '@/screens/am/AppointmentDetails';
import { CancelAppointment } from '@/screens/am/CancelAppointment';
import { AppointmentManagement } from '@/screens/am/AppointmentManagement';
import { AppointmentRequests } from '@/screens/am/AppointmentRequests';
import { AppointmentsDashboard } from '@/screens/am/AppointmentsDashboard';
import { CreateAppointment } from '@/screens/am/CreateAppointment';
import { PetOwners } from '@/screens/am/PetOwners';
import { Inquiries } from '@/screens/am/Inquiries';
import { InquiryDetails } from '@/screens/am/InquiryDetails';
import { OwnerDetails } from '@/screens/am/OwnerDetails';
import { PetDetails } from '@/screens/am/PetDetails';
import { Pets } from '@/screens/am/Pets';
import { RegisterOwner } from '@/screens/am/RegisterOwner';
import { RescheduleAppointment } from '@/screens/am/RescheduleAppointment';
import { ScheduleCalendar } from '@/screens/am/ScheduleCalendar';
import { VetAppointments } from '@/screens/vet/Appointments';
import { VetConsultationWorkspace } from '@/screens/vet/ConsultationWorkspace';
import { VetDashboard } from '@/screens/vet/Dashboard';
import { VetPatientDetails } from '@/screens/vet/PatientDetails';
import { VetRecordDetails } from '@/screens/vet/RecordDetails';
import { StaffAppointments } from '@/screens/cs/Appointments';
import { StaffDashboard } from '@/screens/cs/Dashboard';
import { StaffPets } from '@/screens/cs/Pets';
import { StaffTasks } from '@/screens/cs/Tasks';
import { MyNotifications } from '@/screens/shared/MyNotifications';
import { StaffProfile } from '@/screens/shared/StaffProfile';
import { VetConsultationDetails } from '@/screens/vet/ConsultationDetails';
import { VetConsultations } from '@/screens/vet/Consultations';
import { VetPatients } from '@/screens/vet/Patients';
import { VetRecordForm } from '@/screens/vet/RecordForm';
import { VetRecords } from '@/screens/vet/Records';
import { VetVaccinations } from '@/screens/vet/Vaccinations';
import { VetVaccinationDetails } from '@/screens/vet/VaccinationDetails';
import { VetVaccinationForm } from '@/screens/vet/VaccinationForm';
import { SetupNotice } from '@/screens/SetupNotice';
import { RegisterApply } from '@/screens/register/Apply';
import { RegisterLanding } from '@/screens/register/Landing';
import { RegisterStatus } from '@/screens/register/Status';

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


type GuardCopy = { title: string; copy: string };

/**
 * Every workspace is gated on the role as well as the route: hiding a link is
 * never the boundary, and the RLS policies behind each screen's queries assume
 * a caller of that role.
 */
const GUARDS: Record<ConsoleRole, GuardCopy> = {
  system_administrator: {
    title: 'System Administrator access only',
    copy: 'This area manages the whole VetLink platform. Clinic accounts stay inside their own clinic, and pet-owner accounts use the mobile app.',
  },
  clinic_administrator: {
    title: 'Clinic Administrator access only',
    copy: "This workspace manages a clinic's profile, services, staff and reports. Other clinic roles keep their own workspace, and pet-owner accounts use the mobile app.",
  },
  receptionist: {
    title: 'Appointment Manager access only',
    copy: "This workspace manages one clinic's appointments, owners and pets. Other clinic roles keep their own workspace, and pet-owner accounts use the mobile app.",
  },
  veterinarian: {
    title: 'Veterinarian access only',
    copy: 'This workspace shows the appointments assigned to one veterinarian, with the patient history and clinical records they author. The front desk keeps the clinic-wide schedule, and pet-owner accounts use the mobile app.',
  },
  clinic_staff: {
    title: 'Clinic Staff access only',
    copy: "This workspace shows one staff member's assigned tasks and the limited schedule and pet details their role permits. Other clinic roles keep their own workspace.",
  },
};

function RoleOnly({ role, children }: { role: ConsoleRole; children: ReactNode }) {
  const { user } = useAuth();
  if (!user || user.role !== role) {
    return (
      <div className="page">
        <div className="card">
          <h2>{GUARDS[role].title}</h2>
          <p className="muted" style={{ marginTop: 8 }}>
            {GUARDS[role].copy}
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

/** CA-01 – CA-14. */
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
  { path: '/clinic-admin/tasks', element: <ClinicTasks /> },
  { path: '/clinic-admin/permissions', element: <ClinicPermissions /> },
  { path: '/clinic-admin/reports', element: <ClinicReports /> },
  { path: '/clinic-admin/import-export', element: <ClinicImportExport /> },
  { path: '/clinic-admin/notifications', element: <ClinicNotifications /> },
  { path: '/clinic-admin/settings', element: <ClinicSettings /> },
];


/** AM-01 – AM-14. */
const APPOINTMENT_ROUTES: { path: string; element: ReactNode }[] = [
  { path: '/appointments', element: <AppointmentsDashboard /> },
  { path: '/appointments/management', element: <AppointmentManagement /> },
  { path: '/appointments/requests', element: <AppointmentRequests /> },
  { path: '/appointments/calendar', element: <ScheduleCalendar /> },
  { path: '/appointments/owners', element: <PetOwners /> },
  { path: '/appointments/owners/new', element: <RegisterOwner /> },
  { path: '/appointments/owners/:id', element: <OwnerDetails /> },
  { path: '/appointments/pets', element: <Pets /> },
  { path: '/appointments/pets/:id', element: <PetDetails /> },
  { path: '/appointments/inquiries', element: <Inquiries /> },
  { path: '/appointments/inquiries/:id', element: <InquiryDetails /> },
  { path: '/appointments/notifications', element: <MyNotifications /> },
  { path: '/appointments/profile', element: <StaffProfile /> },
  { path: '/appointments/new', element: <CreateAppointment /> },
  { path: '/appointments/:id/reschedule', element: <RescheduleAppointment /> },
  { path: '/appointments/:id/cancel', element: <CancelAppointment /> },
  { path: '/appointments/:id', element: <AppointmentDetails /> },
];

/** VET-01 – VET-12, plus the inbox the topbar bell opens. */
const VETERINARIAN_ROUTES: { path: string; element: ReactNode }[] = [
  { path: '/veterinarian', element: <VetDashboard /> },
  { path: '/veterinarian/appointments', element: <VetAppointments /> },
  { path: '/veterinarian/appointments/:id/consult', element: <VetConsultationWorkspace /> },
  { path: '/veterinarian/patients', element: <VetPatients /> },
  { path: '/veterinarian/patients/:id', element: <VetPatientDetails /> },
  { path: '/veterinarian/records', element: <VetRecords /> },
  { path: '/veterinarian/records/new', element: <VetRecordForm /> },
  { path: '/veterinarian/records/:id', element: <VetRecordDetails /> },
  { path: '/veterinarian/vaccinations', element: <VetVaccinations /> },
  { path: '/veterinarian/vaccinations/new', element: <VetVaccinationForm /> },
  { path: '/veterinarian/vaccinations/:id', element: <VetVaccinationDetails /> },
  { path: '/veterinarian/consultations', element: <VetConsultations /> },
  { path: '/veterinarian/consultations/:id', element: <VetConsultationDetails /> },
  { path: '/veterinarian/notifications', element: <MyNotifications /> },
  { path: '/veterinarian/profile', element: <StaffProfile /> },
];

/** CS-01 – CS-06. */
const CLINIC_STAFF_ROUTES: { path: string; element: ReactNode }[] = [
  { path: '/staff', element: <StaffDashboard /> },
  { path: '/staff/tasks', element: <StaffTasks /> },
  { path: '/staff/appointments', element: <StaffAppointments /> },
  { path: '/staff/pets', element: <StaffPets /> },
  { path: '/staff/notifications', element: <MyNotifications /> },
  { path: '/staff/profile', element: <StaffProfile /> },
];



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

const ROUTE_GROUPS: { role: ConsoleRole; routes: { path: string; element: ReactNode }[] }[] = [
  { role: 'system_administrator', routes: SYSTEM_ADMIN_ROUTES },
  { role: 'clinic_administrator', routes: CLINIC_ADMIN_ROUTES },
  { role: 'receptionist', routes: APPOINTMENT_ROUTES },
  { role: 'veterinarian', routes: VETERINARIAN_ROUTES },
  { role: 'clinic_staff', routes: CLINIC_STAFF_ROUTES },
];

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
      {/* REG-01 – REG-10: public, and usable by a signed-in pet-owner applicant. */}
      <Route path="/register" element={<RegisterLanding />} />
      <Route path="/register/apply" element={<RegisterApply />} />
      <Route path="/register/status" element={<RegisterStatus />} />

      <Route element={<ProtectedLayout />}>
        <Route index element={<IndexRedirect />} />
        {ROUTE_GROUPS.flatMap(({ role, routes }) =>
          routes.map((route) => (
            <Route
              key={route.path}
              path={route.path}
              element={<RoleOnly role={role}>{route.element}</RoleOnly>}
            />
          )),
        )}
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
