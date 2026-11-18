import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import { AppHeader } from '../../components/AppHeader';
import { AppText } from '../../components/AppText';
import { LinkCard } from '../../components/Card';
import { LinkButton } from '../../components/LinkButton';
import { Screen } from '../../components/Screen';
import {
  DEFAULT_NOTIFICATION_PREFERENCES,
  NOTIFICATION_PREFERENCE_ROWS,
  type NotificationPreferences,
} from '../../data/mockSettings';
import { settingsService } from '../../services/settingsService';
import { colors, radii, spacing } from '../../theme';
import type { ProfileScreenProps, TabParamList } from '../../navigation/types';

/** PO-58 Account Settings */
export function AccountSettingsScreen({ navigation }: ProfileScreenProps<'AccountSettings'>) {
  const [preferences, setPreferences] = useState<NotificationPreferences>(DEFAULT_NOTIFICATION_PREFERENCES);

  useEffect(() => {
    let active = true;
    void settingsService.getNotificationPreferences().then((saved) => {
      if (active) setPreferences(saved);
    });
    return () => {
      active = false;
    };
  }, []);

  const toggle = async (key: keyof NotificationPreferences, value: boolean) => {
    setPreferences((current) => ({ ...current, [key]: value }));
    await settingsService.updateNotificationPreferences({ [key]: value });
  };

  return (
    <Screen contentStyle={styles.content}>
      <AppHeader title="Account Settings" />

      <AppText variant="display">Make VetLink yours</AppText>
      <AppText variant="body" color={colors.text.secondary}>
        Account settings
      </AppText>

      <LinkCard
        icon="person-outline"
        title="Personal information"
        caption="Your name, photo and contact details"
        onPress={() => navigation.navigate('EditProfile')}
      />
      <LinkCard
        icon="lock-closed-outline"
        title="Security settings"
        caption="Change your password"
        onPress={() => navigation.navigate('ChangePassword')}
      />
      <LinkCard
        icon="shield-checkmark-outline"
        title="Privacy and Security"
        caption="Manage personal data and privacy"
        onPress={() => navigation.navigate('PrivacySecurity')}
      />
      <LinkCard
        icon="help-circle-outline"
        title="Help and Support"
        caption="Questions, issues and appointment help"
        onPress={() => navigation.navigate('HelpSupport')}
      />
      <LinkCard
        icon="information-circle-outline"
        title="About VetLink"
        caption="Our purpose, policies and app version"
        onPress={() => navigation.navigate('About')}
      />

      <AppText variant="title" style={styles.sectionTitle}>
        Notification preferences
      </AppText>
      <View style={styles.prefCard}>
        {NOTIFICATION_PREFERENCE_ROWS.map((row, index) => {
          const enabled = preferences[row.key];
          return (
            <Pressable
              key={row.key}
              accessibilityRole="switch"
              accessibilityState={{ checked: enabled }}
              accessibilityLabel={row.label}
              onPress={() => void toggle(row.key, !enabled)}
              style={({ pressed }) => [
                styles.prefRow,
                index > 0 && styles.prefRowDivided,
                pressed && styles.prefRowPressed,
              ]}
            >
              <AppText variant="bodyStrong" color={colors.text.primary} style={styles.prefLabel}>
                {row.label}
              </AppText>
              <AppText variant="bodyStrong" color={enabled ? colors.text.brand : colors.text.secondary}>
                {enabled ? 'On' : 'Off'}
              </AppText>
            </Pressable>
          );
        })}
      </View>

      <LinkButton
        label="View notifications"
        icon="notifications-outline"
        onPress={() =>
          navigation.getParent<BottomTabNavigationProp<TabParamList>>()?.navigate('HomeTab', { screen: 'Notifications' })
        }
      />
      <LinkButton label="Log Out" icon="log-out-outline" onPress={() => navigation.navigate('Logout')} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { gap: spacing.md, paddingBottom: spacing.xxxl },
  sectionTitle: { marginTop: spacing.sm },
  prefCard: {
    backgroundColor: colors.surface.card,
    borderRadius: radii.card,
    borderWidth: 1,
    borderColor: colors.surface.border,
    paddingHorizontal: spacing.lg,
  },
  prefRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingVertical: spacing.md },
  prefRowDivided: { borderTopWidth: 1, borderTopColor: colors.surface.border },
  prefLabel: { flex: 1 },
  prefRowPressed: { opacity: 0.7 },
});
