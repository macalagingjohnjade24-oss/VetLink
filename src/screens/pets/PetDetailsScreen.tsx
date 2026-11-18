import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { AppHeader } from '../../components/AppHeader';
import { AppText } from '../../components/AppText';
import { Button } from '../../components/Button';
import { HelpNote } from '../../components/HelpNote';
import { PetAvatar } from '../../components/PetAvatar';
import { Screen } from '../../components/Screen';
import { TextLink } from '../../components/TextLink';
import { usePets } from '../../context/PetContext';
import { APPOINTMENTS } from '../../data/mockAppointments';
import { CLINICS } from '../../data/mockClinics';
import { formatBirthDate } from '../../services/petService';
import { vaccinationService } from '../../services/vaccinationService';
import { colors, radii, spacing } from '../../theme';
import type { PetsScreenProps } from '../../navigation/types';

/** PO-33 Pet Profile Details */
export function PetDetailsScreen({ navigation, route }: PetsScreenProps<'PetDetails'>) {
  const { petId } = route.params;
  const { getPet } = usePets();
  const pet = getPet(petId);
  const [nextVaccination, setNextVaccination] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    void vaccinationService.nextDueFor(petId).then((entry) => {
      if (active) setNextVaccination(entry?.nextDueISO ?? null);
    });
    return () => {
      active = false;
    };
  }, [petId]);

  if (!pet) {
    return (
      <Screen contentStyle={styles.content}>
        <AppHeader title="Pet Profile Details" />
        <AppText variant="title">This pet is no longer in your profile.</AppText>
        <Button label="Back to My Pets" variant="secondary" onPress={() => navigation.navigate('MyPets')} />
      </Screen>
    );
  }

  const lastVisit = APPOINTMENTS.filter(
    (appointment) => appointment.petId === pet.id && appointment.status === 'Completed',
  ).sort((a, b) => b.dateISO.localeCompare(a.dateISO))[0];

  return (
    <Screen contentStyle={styles.content}>
      <AppHeader title="Pet Profile Details" />

      <View style={styles.heroWrap}>
        <PetAvatar pet={pet} size={180} radius={radii.card} />
      </View>

      <AppText variant="display">Meet {pet.name}</AppText>
      <AppText variant="body" color={colors.text.secondary}>
        {pet.gender === 'Male' ? 'Your very good boy.' : 'Your very good girl.'}
      </AppText>

      <View style={styles.card}>
        <AppText variant="cardTitle">
          {pet.species} · {pet.breed} · {pet.gender}
        </AppText>
        <AppText variant="body" color={colors.text.secondary} style={styles.lines}>
          Born {formatBirthDate(pet.birthDate)} · {pet.ageLabel}
          {'\n'}Weight: {pet.weightKg} kg · Color: {pet.color || 'Not added'}
          {'\n'}Microchip: {pet.microchip || 'Not added'}
          {'\n'}Owner: Alex Santos
        </AppText>
      </View>

      <HelpNote>
        Health overview
        {'\n'}Last visit: {lastVisit ? lastVisit.dateLabel : 'No completed visits'}
        {'\n'}Next vaccination: {nextVaccination ? formatBirthDate(nextVaccination) : 'Not recorded'}
      </HelpNote>

      <Button label="View Health Records" onPress={() => navigation.navigate('HealthRecords', { petId })} />

      <View style={styles.links}>
        <TextLink
          label="Vaccination Records"
          icon="medkit-outline"
          onPress={() => navigation.navigate('VaccinationRecords', { petId })}
        />
        <TextLink
          label="Upcoming Vaccinations"
          icon="calendar-outline"
          onPress={() => navigation.navigate('UpcomingVaccinations', { petId })}
        />
        <TextLink
          label="Medical History"
          icon="document-text-outline"
          onPress={() => navigation.navigate('MedicalHistory', { petId })}
        />
        <TextLink
          label="Appointment History"
          icon="time-outline"
          onPress={() => navigation.navigate('AppointmentHistory', { petId })}
        />
      </View>

      <Button
        label="Edit Profile"
        variant="secondary"
        onPress={() => navigation.navigate('PetForm', { mode: 'edit', petId })}
      />

      <HelpNote>
        Records and visit notes are entered by your veterinary clinic. Contact the clinic if something looks
        incomplete.
      </HelpNote>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { gap: spacing.md, paddingBottom: spacing.xxxl },
  heroWrap: { alignItems: 'center', marginTop: spacing.sm },
  card: {
    gap: spacing.sm,
    padding: spacing.lg,
    borderRadius: radii.card,
    borderWidth: 1,
    borderColor: colors.surface.border,
    backgroundColor: colors.surface.card,
  },
  lines: { lineHeight: 22 },
  links: { gap: spacing.xs, marginTop: spacing.xs },
});
