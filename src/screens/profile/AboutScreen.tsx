import { Image, Pressable, StyleSheet } from 'react-native';
import { AppHeader } from '../../components/AppHeader';
import { AppText } from '../../components/AppText';
import { Logo } from '../../components/Logo';
import { Screen } from '../../components/Screen';
import { colors, radii, spacing } from '../../theme';
import type { ProfileScreenProps } from '../../navigation/types';

/** PO-62 About VetLink */
export function AboutScreen({ navigation }: ProfileScreenProps<'About'>) {
  return (
    <Screen contentStyle={styles.content}>
      <AppHeader title="About VetLink" />

      <Logo size="sm" />

      <AppText variant="display">Veterinary Care, Connected.</AppText>
      <AppText variant="body" color={colors.text.secondary}>
        Version 1.0.0 · Pet Owner
      </AppText>

      <Image
        source={require('../../../assets/onboarding/vet.png')}
        style={styles.photo}
        resizeMode="cover"
        accessibilityLabel="A veterinarian with a dog"
      />

      <AppText variant="screenTitle">Better connected. Better cared for.</AppText>
      <AppText variant="body">
        VetLink helps pet owners discover nearby veterinary clinics, request appointments and keep pet health
        records together in one easy-to-use app.
      </AppText>

      <AppText variant="title" style={styles.sectionTitle}>
        Our purpose
      </AppText>
      <AppText variant="body">
        To make it simpler for families and veterinary teams to stay connected through every stage of a pet’s life.
      </AppText>

      <Pressable accessibilityRole="button" hitSlop={6} onPress={() => navigation.navigate('PrivacySecurity')}>
        <AppText variant="bodyStrong">Privacy Policy</AppText>
      </Pressable>
      <Pressable accessibilityRole="button" hitSlop={6} onPress={() => navigation.navigate('PrivacySecurity')}>
        <AppText variant="bodyStrong">Terms and Conditions</AppText>
      </Pressable>

      <AppText variant="small" style={styles.copyright}>
        © 2026 VetLink. All rights reserved.
      </AppText>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { gap: spacing.md, paddingBottom: spacing.xxxl },
  photo: { width: '100%', height: 200, borderRadius: radii.card, backgroundColor: colors.surface.subtle },
  sectionTitle: { marginTop: spacing.sm },
  copyright: { marginTop: spacing.sm, color: colors.text.secondary },
});
