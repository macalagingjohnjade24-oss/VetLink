import { Pressable, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { AppHeader } from '../../components/AppHeader';
import { AppText } from '../../components/AppText';
import { HelpNote } from '../../components/HelpNote';
import { LinkButton } from '../../components/LinkButton';
import { Screen } from '../../components/Screen';
import { colors, radii, spacing } from '../../theme';
import type { ProfileScreenProps } from '../../navigation/types';

/** PO-60 Privacy and Security */
export function PrivacySecurityScreen({ navigation }: ProfileScreenProps<'PrivacySecurity'>) {
  return (
    <Screen contentStyle={styles.content}>
      <AppHeader title="Privacy and Security" />

      <Ionicons name="shield-checkmark-outline" size={30} color={colors.text.secondary} />

      <AppText variant="display">Your privacy matters</AppText>
      <AppText variant="body" color={colors.text.secondary}>
        Control your information and account security.
      </AppText>

      <Pressable
        accessibilityRole="button"
        onPress={() => navigation.navigate('ChangePassword')}
        style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}
      >
        <View style={styles.cardHead}>
          <Ionicons name="document-text-outline" size={22} color={colors.text.brand} />
          <AppText variant="cardTitle">Account security</AppText>
        </View>
        <AppText variant="caption" style={styles.cardCaption}>
          Keep your password strong and private.
        </AppText>
      </Pressable>

      <AppText variant="title" color={colors.text.brand} style={styles.sectionTitle}>
        Your personal data
      </AppText>
      <AppText variant="body">
        Your profile, pet details and appointment information are used to connect you with veterinary care.
        Authorized clinic personnel maintain clinical records.
      </AppText>
      <AppText variant="body" color={colors.text.secondary}>
        Contact support to request a copy of your data, correct account information or discuss account deletion.
      </AppText>

      <LinkButton
        label="Request help with my data"
        icon="help-circle-outline"
        onPress={() => navigation.navigate('HelpSupport')}
      />

      <AppText variant="screenTitle" style={styles.policyTitle}>
        Privacy Policy
      </AppText>
      <AppText variant="body">
        VetLink shares relevant booking and inquiry details with your chosen clinic. You choose when to submit an
        inquiry. Full policy content must be reviewed before release.
      </AppText>

      <AppText variant="screenTitle" style={styles.policyTitle}>
        Terms and Conditions
      </AppText>
      <AppText variant="body">
        Appointments depend on clinic availability and approval. VetLink and its AI assistant do not replace
        professional veterinary care.
      </AppText>

      <HelpNote>Policy summaries for design review, not finalized legal terms.</HelpNote>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { gap: spacing.md, paddingBottom: spacing.xxxl },
  card: {
    gap: spacing.sm,
    padding: spacing.lg,
    borderRadius: radii.card,
    borderWidth: 1,
    borderColor: colors.surface.border,
    backgroundColor: colors.surface.card,
  },
  cardPressed: { backgroundColor: colors.surface.subtle },
  cardHead: { flexDirection: 'row', alignItems: 'center', gap: spacing.lg },
  cardCaption: { marginLeft: 38 },
  sectionTitle: { marginTop: spacing.sm },
  policyTitle: { marginTop: spacing.sm },
});
