import { StyleSheet, View } from 'react-native';
import { AppHeader } from '../../components/AppHeader';
import { AppText } from '../../components/AppText';
import { BookingStep } from '../../components/BookingStep';
import { Button } from '../../components/Button';
import { ChoiceRow } from '../../components/ChoiceRow';
import { HelpNote } from '../../components/HelpNote';
import { Screen } from '../../components/Screen';
import { useBooking } from '../../context/BookingContext';
import { CLINICS } from '../../data/mockClinics';
import { usePets } from '../../context/PetContext';
import { colors, radii, spacing } from '../../theme';
import type { BookingsScreenProps } from '../../navigation/types';

/** PO-25 Select Service */
export function SelectServiceScreen({ navigation }: BookingsScreenProps<'BookingSelectService'>) {
  const { draft, updateDraft } = useBooking();
  const { pets } = usePets();
  const clinic = CLINICS.find((item) => item.id === draft.clinicId);
  const pet = pets.find((item) => item.id === draft.petId);

  if (!clinic) {
    return (
      <Screen contentStyle={styles.content}>
        <AppHeader title="Select Service" />
        <AppText variant="title">Choose a clinic first.</AppText>
        <Button label="Select a clinic" onPress={() => navigation.navigate('BookingSelectClinic')} />
      </Screen>
    );
  }

  return (
    <Screen contentStyle={styles.content}>
      <AppHeader title="Select Service" />

      <BookingStep step={2} />
      <AppText variant="display">Choose a service</AppText>

      <HelpNote>
        {clinic.name}
        {'\n'}
        {pet ? `For ${pet.name} · ${pet.species} · ${pet.breed}` : 'Select a pet to continue'}
      </HelpNote>

      {clinic.services.map((service) => {
        const selected = draft.serviceId === service.id;
        return (
          <View key={service.id} style={[styles.serviceCard, selected && styles.serviceCardSelected]}>
            <ChoiceRow
              mode="radio"
              label={service.name}
              selected={selected}
              onPress={() => updateDraft({ serviceId: service.id })}
            />
            <AppText variant="caption" style={styles.description}>
              {service.description}
            </AppText>
            <AppText variant="small" color={colors.text.subtle}>
              ₱{service.price} · {service.durationMinutes} min
            </AppText>
          </View>
        );
      })}

      <HelpNote>The clinic will confirm service availability and any applicable fees.</HelpNote>

      <Button
        label="Continue"
        disabled={!draft.serviceId}
        onPress={() => navigation.navigate('BookingSelectDate')}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { gap: spacing.md, paddingBottom: spacing.xxxl },
  serviceCard: {
    gap: spacing.xs,
    padding: spacing.lg,
    borderRadius: radii.card,
    borderWidth: 1,
    borderColor: colors.surface.border,
    backgroundColor: colors.surface.card,
  },
  serviceCardSelected: { borderColor: colors.brand.primary },
  description: { marginLeft: 28 },
});
