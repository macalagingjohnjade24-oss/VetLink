import { useAuth } from '@/auth/AuthProvider';
import { ROLE_LABEL } from '@/auth/roles';
import { label } from '@/lib/format';
import { ClinicFooter } from '@/clinic/components';
import { AccountProfile } from './AccountProfile';

const ROLE_COPY: Record<string, { title: string; access: string; footer: string }> = {
  receptionist: {
    title: 'My profile',
    access: 'Front desk · appointments, owners and pets of this clinic',
    footer: 'Front desk',
  },
  veterinarian: {
    title: 'Veterinarian profile',
    access: 'Clinic-scoped clinical access · records and vaccinations',
    footer: 'Clinical workspace',
  },
  clinic_staff: {
    title: 'Staff profile and settings',
    access: 'Limited access · assigned tasks and permitted details, no clinical editing',
    footer: 'Staff workspace',
  },
};

/** AUTH-06 (front desk), VET-12 and CS-06: a clinic member's own account. */
export function StaffProfile() {
  const { user } = useAuth();
  if (!user) return null;
  const copy = ROLE_COPY[user.role] ?? ROLE_COPY.clinic_staff;
  const clinic = [user.clinicName, user.clinicReference].filter(Boolean).join(' · ');

  return (
    <AccountProfile
      title={copy.title}
      subtitle="Manage your contact details and password. Clinic access is assigned by your clinic administrator."
      detailsAudience="Shown to your clinic team"
      scopeRows={[
        { term: 'Clinic', value: clinic || 'No clinic assigned' },
        {
          term: 'Membership',
          value: `${ROLE_LABEL[user.role]} · ${label(user.membershipStatus ?? 'none')}`,
        },
        { term: 'Access', value: copy.access },
      ]}
      roleNote="Your clinic assignment and role can only be changed by your clinic administrator. A browser session cannot grant itself a role or another clinic, and no platform administration permissions come with this account."
      footer={
        <ClinicFooter
          left={copy.footer}
          right={`${user.clinicReference ?? 'Clinic-scoped'} · account changes are your own actions`}
        />
      }
    />
  );
}
