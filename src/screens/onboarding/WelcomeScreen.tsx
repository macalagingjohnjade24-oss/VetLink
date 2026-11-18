import { OnboardingLayout } from './OnboardingLayout';
import type { ScreenProps } from '../../navigation/types';

/** PO-02 Onboarding Welcome */
export function WelcomeScreen({ navigation }: ScreenProps<'Welcome'>) {
  const goNext = () => navigation.navigate('FindClinics');

  return (
    <OnboardingLayout
      image={require('../../../assets/onboarding/dog.png')}
      page={1}
      heading="Your Pet's Health, All in One Place"
      body="Find trusted care, keep every record organized, and make more time for happy moments together."
      primaryLabel="Get Started"
      onPrimary={goNext}
      onSwipeNext={goNext}
      secondaryLabel="I Already Have an Account"
      secondaryVariant="outline"
      onSecondary={() => navigation.navigate('Login')}
    />
  );
}
