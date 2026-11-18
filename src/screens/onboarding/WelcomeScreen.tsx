import { OnboardingLayout } from './OnboardingLayout';
import { useAuth } from '../../context/AuthContext';
import type { ScreenProps } from '../../navigation/types';

/** PO-02 Onboarding Welcome */
export function WelcomeScreen({ navigation }: ScreenProps<'Welcome'>) {
  const { finishOnboarding } = useAuth();

  return (
    <OnboardingLayout
      image={require('../../../assets/onboarding/dog.png')}
      page={1}
      heading="Your Pet's Health, All in One Place"
      body="Find trusted care, keep every record organized, and make more time for happy moments together."
      primaryLabel="Get Started"
      onPrimary={() => {
        void finishOnboarding();
        navigation.navigate('SignUp');
      }}
      secondaryLabel="I Already Have an Account"
      secondaryVariant="outline"
      onSecondary={() => {
        void finishOnboarding();
        navigation.navigate('Login');
      }}
    />
  );
}
