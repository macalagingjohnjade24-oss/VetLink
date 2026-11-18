import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import { AppHeader } from '../../components/AppHeader';
import { AppText } from '../../components/AppText';
import { Button } from '../../components/Button';
import { HelpNote } from '../../components/HelpNote';
import { Screen } from '../../components/Screen';
import { clinicInquiryService, type ClinicInquiry } from '../../services/clinicInquiryService';
import { colors, radii, spacing } from '../../theme';
import type { ProfileScreenProps, TabParamList } from '../../navigation/types';

/** PO-55 Inquiry Submission Confirmation */
export function AIInquiryConfirmationScreen({ navigation, route }: ProfileScreenProps<'AIInquiryConfirmation'>) {
  const [inquiry, setInquiry] = useState<ClinicInquiry | null>(null);

  useEffect(() => {
    let active = true;
    void clinicInquiryService.getById(route.params.inquiryId).then((found) => {
      if (active) setInquiry(found);
    });
    return () => {
      active = false;
    };
  }, [route.params.inquiryId]);

  if (!inquiry) {
    return (
      <Screen contentStyle={styles.content}>
        <AppHeader title="Inquiry Submission Confirmation" />
        <AppText variant="title">This inquiry is no longer available.</AppText>
        <Button label="Back to Help & Support" variant="secondary" onPress={() => navigation.navigate('HelpSupport')} />
      </Screen>
    );
  }

  return (
    <Screen contentStyle={styles.content}>
      <AppHeader title="Inquiry Submission Confirmation" />

      <AppText variant="display">Your inquiry is on its way</AppText>
      <AppText variant="body" color={colors.text.secondary}>
        The clinic can review the information you submitted.
      </AppText>

      <HelpNote title={`Inquiry reference · ${inquiry.reference}`}>
        Keep this reference if you contact the clinic about your inquiry.
      </HelpNote>

      <View style={styles.card}>
        <AppText variant="screenTitle">{inquiry.category}</AppText>
        <AppText variant="body">
          {inquiry.ownerName} · {inquiry.petName} · {inquiry.petSpecies}
          {'\n'}
          {inquiry.clinicName}
        </AppText>
        <AppText variant="body" color={colors.text.secondary}>
          {inquiry.details}
        </AppText>
      </View>

      <AppText variant="body" color={colors.text.secondary}>
        No response time has been provided by the clinic. For urgent care, contact a veterinary clinic directly.
      </AppText>

      <Button
        label="Return to Chat"
        onPress={() => (navigation.canGoBack() ? navigation.goBack() : navigation.navigate('AIChat'))}
      />
      <Button
        label="Return Home"
        variant="secondary"
        onPress={() =>
          navigation.getParent<BottomTabNavigationProp<TabParamList>>()?.navigate('HomeTab', { screen: 'Home' })
        }
      />
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
});
