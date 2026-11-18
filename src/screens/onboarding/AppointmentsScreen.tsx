import { OnboardingLayout } from './OnboardingLayout';
import type { ScreenProps } from '../../navigation/types';

/** PO-04 Onboarding – Book Appointments */
export function AppointmentsScreen({ navigation }: ScreenProps<'Appointments'>) {
  const goNext = () => navigation.navigate('HealthRecords');

  return (
    <OnboardingLayout
      image={require('../../../assets/onboarding/vet.png')}
      page={3}
      heading="Make Time for Care"
      body="Choose your vet, select your preferred time, and track your appointment requests in one place."
      primaryLabel="Continue"
      onPrimary={goNext}
      secondaryLabel="Skip to create account"
      onSecondary={() => navigation.navigate('SignUp')}
      onSwipeNext={goNext}
      onSwipePrev={() => navigation.navigate('FindClinics')}
    />
  );
}
