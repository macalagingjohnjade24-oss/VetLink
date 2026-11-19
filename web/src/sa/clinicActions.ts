/** Copy and confirmation metadata for the two sensitive clinic-status actions. */
export type ClinicAction = 'suspend' | 'reactivate' | 'deactivate';

export const CLINIC_ACTIONS: Record<
  ClinicAction,
  { title: string; label: string; description: string; variant: 'danger' | 'primary' }
> = {
  suspend: {
    title: 'Suspend this clinic?',
    label: 'Suspend clinic',
    description:
      'The clinic disappears from pet-owner discovery and cannot receive new appointments. Its staff keep their accounts and existing records.',
    variant: 'danger',
  },
  reactivate: {
    title: 'Reactivate this clinic?',
    label: 'Reactivate clinic',
    description:
      'The clinic becomes visible in pet-owner discovery again and can receive new appointment requests.',
    variant: 'primary',
  },
  deactivate: {
    title: 'Deactivate this clinic?',
    label: 'Deactivate clinic',
    description:
      'The account is closed for new activity. Existing records stay in place for auditing; reactivate it from Clinic accounts at any time.',
    variant: 'danger',
  },
};
