import { useState } from 'react';
import { StyleSheet } from 'react-native';
import { AppHeader } from '../../components/AppHeader';
import { AppText } from '../../components/AppText';
import { Button } from '../../components/Button';
import { HelpNote } from '../../components/HelpNote';
import { Logo } from '../../components/Logo';
import { Screen } from '../../components/Screen';
import { useAuth } from '../../context/AuthContext';
import { colors, spacing } from '../../theme';
import type { ProfileScreenProps } from '../../navigation/types';

/** PO-63 Logout Confirmation */
export function LogoutScreen({ navigation }: ProfileScreenProps<'Logout'>) {
  const { signOut } = useAuth();
  const [leaving, setLeaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const confirm = async () => {
    setLeaving(true);
    setError(null);
    try {
      const root = navigation.getParent()?.getParent();
      await signOut();
      root?.reset({ index: 0, routes: [{ name: 'Login' }] });
    } catch {
      setError('We couldn’t log you out. Please try again.');
      setLeaving(false);
    }
  };

  return (
    <Screen contentStyle={styles.content}>
      <AppHeader title="Logout Confirmation" />

      <Logo size="sm" />

      <AppText variant="display">Log out of VetLink?</AppText>
      <AppText variant="body" color={colors.text.secondary}>
        You can log back in anytime to view your pets, appointments and records.
      </AppText>

      <HelpNote>Your information stays safely connected to your account.</HelpNote>

      {error ? <HelpNote tone="danger">{error}</HelpNote> : null}

      <Button label="Log Out" loading={leaving} onPress={() => void confirm()} />
      <Button label="Cancel" variant="secondary" onPress={() => navigation.goBack()} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { gap: spacing.md, paddingBottom: spacing.xxxl, paddingTop: spacing.xxl },
});
