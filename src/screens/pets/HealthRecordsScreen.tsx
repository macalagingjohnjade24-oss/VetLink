import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { AppHeader } from '../../components/AppHeader';
import { AppText } from '../../components/AppText';
import { Button } from '../../components/Button';
import { HelpNote } from '../../components/HelpNote';
import { LinkButton } from '../../components/LinkButton';
import { PetAvatar } from '../../components/PetAvatar';
import { PetSelector } from '../../components/PetSelector';
import { Screen } from '../../components/Screen';
import { useBooking } from '../../context/BookingContext';
import { usePets } from '../../context/PetContext';
import { CLINICS } from '../../data/mockClinics';
import type { MedicalRecord } from '../../data/mockMedicalRecords';
import { shortClinicName } from '../../services/clinicService';
import { formatBirthDate } from '../../services/petService';
import { medicalRecordService } from '../../services/medicalRecordService';
import { vaccinationService } from '../../services/vaccinationService';
import { colors, radii, spacing } from '../../theme';
import type { PetsScreenProps } from '../../navigation/types';

/** PO-37 Health Records Overview */
export function HealthRecordsScreen({ navigation, route }: PetsScreenProps<'HealthRecords'>) {
  const { pets } = usePets();
  const { appointments } = useBooking();
  const [petId, setPetId] = useState(route.params?.petId ?? pets[0]?.id);
  const [records, setRecords] = useState<MedicalRecord[]>([]);
  const [nextVaccination, setNextVaccination] = useState<string | null>(null);

  useEffect(() => {
    if (!petId) return;
    let active = true;
    void Promise.all([medicalRecordService.recent(petId, 2), vaccinationService.nextDueFor(petId)]).then(
      ([recent, vaccination]) => {
        if (!active) return;
        setRecords(recent);
        setNextVaccination(vaccination?.nextDueISO ?? null);
      },
    );
    return () => {
      active = false;
    };
  }, [petId]);

  const pet = pets.find((item) => item.id === petId) ?? pets[0];

  return (
    <Screen contentStyle={styles.content}>
      <AppHeader title="Health Records Overview" />

      <PetSelector pets={pets} selectedId={pet?.id} onSelect={setPetId} />

      <AppText variant="display">A healthy overview</AppText>
      <AppText variant="body" color={colors.text.secondary}>
        {pet ? `${pet.name}’s care, connected.` : 'Choose a pet to see their records.'}
      </AppText>

      {pet ? (
        <View style={styles.petRow}>
          <PetAvatar pet={pet} size={56} />
          <View style={styles.flex}>
            <AppText variant="cardTitle">{pet.name}</AppText>
            <AppText variant="caption">
              {pet.species} · {pet.breed} · {pet.ageLabel}
            </AppText>
          </View>
        </View>
      ) : null}

      <HelpNote>
        Vaccination reminder
        {'\n'}
        {nextVaccination ? `Next due ${formatBirthDate(nextVaccination)}` : 'No next date recorded'}
      </HelpNote>
      {pet ? (
        <LinkButton
          label="View upcoming vaccinations"
          icon="calendar-outline"
          onPress={() => navigation.navigate('UpcomingVaccinations', { petId: pet.id })}
        />
      ) : null}

      <AppText variant="title">Recent medical records</AppText>
      {records.length === 0 ? (
        <AppText variant="body" color={colors.text.secondary}>
          No clinic-entered records yet.
        </AppText>
      ) : (
        records.map((record) => (
          <Pressable
            key={record.id}
            accessibilityRole="button"
            onPress={() => navigation.navigate('MedicalRecordDetails', { recordId: record.id })}
            style={({ pressed }) => [styles.record, pressed && styles.pressed]}
          >
            <AppText variant="cardTitle">{record.title}</AppText>
            <AppText variant="caption">
              {medicalRecordService.longDate(record.dateISO)} ·{' '}
              {shortClinicName(CLINICS.find((clinic) => clinic.id === record.clinicId)?.name ?? 'Clinic')}
            </AppText>
          </Pressable>
        ))
      )}

      {pet ? (
        <>
          <Button
            label="Medical History"
            variant="secondary"
            onPress={() => navigation.navigate('MedicalHistory', { petId: pet.id })}
          />
          <Button
            label="Vaccination Records"
            variant="secondary"
            onPress={() => navigation.navigate('VaccinationRecords', { petId: pet.id })}
          />
          <Button
            label="Appointment History"
            variant="secondary"
            onPress={() => navigation.navigate('AppointmentHistory', { petId: pet.id })}
          />
        </>
      ) : null}

      <HelpNote>Demo records · Clinical information is entered and maintained by authorized veterinary personnel.</HelpNote>

      {pet ? (
        <AppText variant="small" color={colors.text.subtle}>
          {appointments.filter((appointment) => appointment.petId === pet.id).length} appointments on record for{' '}
          {pet.name}
        </AppText>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { gap: spacing.md, paddingBottom: spacing.xxxl },
  petRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  flex: { flex: 1 },
  record: {
    gap: 2,
    padding: spacing.lg,
    borderRadius: radii.card,
    borderWidth: 1,
    borderColor: colors.surface.border,
    backgroundColor: colors.surface.card,
  },
  pressed: { backgroundColor: colors.surface.subtle },
});
