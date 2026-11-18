import { OnboardingLayout } from './OnboardingLayout';
import type { ScreenProps } from '../../navigation/types';

/** PO-05 Onboarding – Manage Pet Health Records */
export function HealthRecordsScreen({ navigation }: ScreenProps<'HealthRecords'>) {
  const goToAuth = (route: 'SignUp' | 'Login') => navigation.navigate(route);

  return (
    <OnboardingLayout
      image={require('../../../assets/onboarding/cat.png')}
      page={4}
      heading="Every Record, Together"
      body="Keep your pet's medical history, vaccination records, and appointments organized wherever you go."
      primaryLabel="Get Started"
      onPrimary={() => goToAuth('SignUp')}
      secondaryLabel="Skip to create account"
      onSecondary={() => goToAuth('SignUp')}
      onSwipePrev={() => navigation.navigate('Appointments')}
    />
  );
}
