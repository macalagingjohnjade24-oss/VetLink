import { OnboardingLayout } from './OnboardingLayout';
import type { ScreenProps } from '../../navigation/types';

/** PO-03 Onboarding – Find Veterinary Clinics */
export function FindClinicsScreen({ navigation }: ScreenProps<'FindClinics'>) {
  return (
    <OnboardingLayout
      image={require('../../../assets/onboarding/clinic.png')}
      page={2}
      heading="Find Veterinary Care Near You"
      body="Discover nearby clinics, explore services, and find a caring team for your pet."
      primaryLabel="Continue"
      onPrimary={() => navigation.navigate('Appointments')}
      secondaryLabel="Skip to create account"
      onSecondary={() => navigation.navigate('SignUp')}
    />
  );
}
