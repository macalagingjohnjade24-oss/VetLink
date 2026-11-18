import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import { colors, spacing } from '../../theme';
import { AppText } from '../../components/AppText';
import { Logo } from '../../components/Logo';
import { Screen } from '../../components/Screen';
import { useAuth } from '../../context/AuthContext';
import type { ScreenProps } from '../../navigation/types';

/** PO-01 Splash Screen — brand moment, then the onboarding tour (or the app when already signed in). */
export function SplashScreen({ navigation }: ScreenProps<'Splash'>) {
  const { initializing, user } = useAuth();

  useEffect(() => {
    if (initializing) return;
    const timer = setTimeout(() => {
      navigation.reset({
        index: 0,
        routes: [{ name: user ? 'Main' : 'Welcome' }],
      });
    }, 1400);
    return () => clearTimeout(timer);
  }, [initializing, navigation, user]);

  return (
    <Screen scroll={false} contentStyle={styles.content}>
      <View style={styles.center}>
        <Logo size="lg" />
        <AppText variant="title" color={colors.text.brand} style={styles.tagline}>
          Veterinary Care, Connected.
        </AppText>
        <AppText variant="body" color={colors.text.secondary}>
          A little closer to better care.
        </AppText>
      </View>
      <View style={styles.dots}>
        <View style={[styles.dot, styles.dotActive]} />
        <View style={styles.dot} />
        <View style={styles.dot} />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { justifyContent: 'center', alignItems: 'center' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.sm },
  tagline: { marginTop: spacing.lg },
  dots: { flexDirection: 'row', gap: 6, paddingBottom: spacing.xxl },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.brand.peach },
  dotActive: { width: 22, backgroundColor: colors.brand.primary },
});
