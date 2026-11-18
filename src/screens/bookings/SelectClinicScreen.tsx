import { useEffect } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import { AppHeader } from '../../components/AppHeader';
import { AppText } from '../../components/AppText';
import { BookingStep } from '../../components/BookingStep';
import { Button } from '../../components/Button';
import { HelpNote } from '../../components/HelpNote';
import { Screen } from '../../components/Screen';
import { useBooking } from '../../context/BookingContext';
import { CLINICS } from '../../data/mockClinics';
import { colors, radii, spacing } from '../../theme';
import type { BookingsScreenProps, TabParamList } from '../../navigation/types';

/** PO-23 Select Veterinary Clinic */
export function SelectClinicScreen({ navigation, route }: BookingsScreenProps<'BookingSelectClinic'>) {
  const { draft, updateDraft } = useBooking();
  const preselected = route.params?.clinicId;
  const preselectedService = route.params?.serviceId;

  useEffect(() => {
    if (preselected) updateDraft({ clinicId: preselected, serviceId: preselectedService ?? null });
    // Only seed the draft when the screen is opened with a clinic from the locator.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [preselected, preselectedService]);

  const openClinicDetails = (clinicId: string) =>
    navigation
      .getParent<BottomTabNavigationProp<TabParamList>>()
      ?.navigate('ClinicsTab', { screen: 'ClinicDetails', params: { clinicId } });

  return (
    <Screen contentStyle={styles.content}>
      <AppHeader title="Select Veterinary Clinic" />

      <BookingStep step={1} />
      <AppText variant="display">Choose your clinic</AppText>
      <AppText variant="body" color={colors.text.secondary}>
        You can pick a different clinic at any point before confirming.
      </AppText>

      {CLINICS.map((clinic) => {
        const selected = draft.clinicId === clinic.id;
        return (
          <View key={clinic.id} style={[styles.clinicCard, selected && styles.clinicCardSelected]}>
            <View style={styles.clinicHead}>
              <View style={styles.flex}>
                <AppText variant="cardTitle">{clinic.name}</AppText>
                <AppText variant="caption">
                  {clinic.area} · {clinic.distanceKm.toFixed(1)} km away
                </AppText>
              </View>
              {selected ? (
                <AppText variant="badge" color={colors.text.brand}>
                  SELECTED
                </AppText>
              ) : null}
            </View>
            <View style={styles.serviceRow}>
              <AppText variant="caption" color={colors.text.brand} style={styles.flex}>
                {clinic.services
                  .slice(0, 2)
                  .map((service) => service.name.replace(' consultation', ''))
                  .join('  ·  ')}
              </AppText>
              <Pressable hitSlop={6} onPress={() => openClinicDetails(clinic.id)}>
                <AppText variant="caption" color={colors.text.brand}>
                  View Details →
                </AppText>
              </Pressable>
            </View>
            <Button
              label={selected ? 'Selected' : 'Select Clinic'}
              variant={selected ? 'secondary' : 'primary'}
              size="sm"
              fullWidth={false}
              onPress={() => {
                updateDraft({ clinicId: clinic.id });
                navigation.navigate('BookingSelectPet');
              }}
            />
          </View>
        );
      })}

      <HelpNote>Clinic availability is confirmed by the clinic once your request is sent.</HelpNote>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { gap: spacing.md, paddingBottom: spacing.xxxl },
  clinicCard: {
    gap: spacing.sm,
    padding: spacing.lg,
    borderRadius: radii.card,
    borderWidth: 1,
    borderColor: colors.surface.border,
    backgroundColor: colors.surface.card,
  },
  clinicCardSelected: { borderColor: colors.brand.primary },
  clinicHead: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm },
  serviceRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  flex: { flex: 1 },
});
