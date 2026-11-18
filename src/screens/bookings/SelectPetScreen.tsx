import { StyleSheet, View } from 'react-native';
import { AppHeader } from '../../components/AppHeader';
import { AppText } from '../../components/AppText';
import { BookingStep } from '../../components/BookingStep';
import { Button } from '../../components/Button';
import { HelpNote } from '../../components/HelpNote';
import { Screen } from '../../components/Screen';
import { useBooking } from '../../context/BookingContext';
import { CLINICS } from '../../data/mockClinics';
import { usePets } from '../../context/PetContext';
import { colors, radii, spacing } from '../../theme';
import type { BookingsScreenProps } from '../../navigation/types';

/** PO-24 Select Pet */
export function SelectPetScreen({ navigation }: BookingsScreenProps<'BookingSelectPet'>) {
  const { draft, updateDraft } = useBooking();
  const { pets } = usePets();
  const clinic = CLINICS.find((item) => item.id === draft.clinicId);

  return (
    <Screen contentStyle={styles.content}>
      <AppHeader title="Select Pet" />

      <BookingStep step={1} />
      <AppText variant="display">Select Your Pet</AppText>
      <AppText variant="body" color={colors.text.secondary}>
        Who’s coming in for a visit?
      </AppText>

      {pets.map((pet) => {
        const selected = draft.petId === pet.id;
        return (
          <View key={pet.id} style={[styles.petCard, selected && styles.petCardSelected]}>
            <View style={styles.petHead}>
              <View style={[styles.avatar, { backgroundColor: pet.species === 'Dog' ? colors.brand.peach : colors.surface.tint }]}>
                <AppText variant="title" color={colors.text.brand}>
                  {pet.name.slice(0, 1)}
                </AppText>
              </View>
              <View style={styles.flex}>
                <AppText variant="cardTitle">{pet.name}</AppText>
                <AppText variant="caption">
                  {pet.species} · {pet.breed} · {pet.ageLabel}
                </AppText>
              </View>
            </View>
            <Button
              label={selected ? `${pet.name} selected` : `Select ${pet.name}`}
              variant={selected ? 'secondary' : 'primary'}
              size="sm"
              fullWidth={false}
              onPress={() => {
                updateDraft({ petId: pet.id });
                navigation.navigate('BookingSelectService');
              }}
            />
          </View>
        );
      })}

      <HelpNote>
        {clinic?.name ?? 'Choose a clinic first'}
        {'\n'}Your pet’s details will be shared with this clinic for your visit.
      </HelpNote>

      <Button
        label="Continue"
        disabled={!draft.petId}
        onPress={() => navigation.navigate('BookingSelectService')}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { gap: spacing.md, paddingBottom: spacing.xxxl },
  petCard: {
    gap: spacing.sm,
    padding: spacing.lg,
    borderRadius: radii.card,
    borderWidth: 1,
    borderColor: colors.surface.border,
    backgroundColor: colors.surface.card,
  },
  petCardSelected: { borderColor: colors.brand.primary },
  petHead: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  avatar: { width: 44, height: 44, borderRadius: radii.pill, alignItems: 'center', justifyContent: 'center' },
  flex: { flex: 1 },
});
