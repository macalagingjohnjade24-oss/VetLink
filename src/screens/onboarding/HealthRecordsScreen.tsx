import { OnboardingLayout } from './OnboardingLayout';
import { useAuth } from '../../context/AuthContext';
import type { ScreenProps } from '../../navigation/types';

/** PO-05 Onboarding – Manage Pet Health Records */
export function HealthRecordsScreen({ navigation }: ScreenProps<'HealthRecords'>) {
  const { finishOnboarding } = useAuth();

  const goToAuth = (route: 'SignUp' | 'Login') => {
    void finishOnboarding();
    navigation.navigate(route);
  };

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
    />
  );
}
