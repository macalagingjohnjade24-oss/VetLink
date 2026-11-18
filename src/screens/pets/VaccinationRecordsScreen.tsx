import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { AppHeader } from '../../components/AppHeader';
import { AppText } from '../../components/AppText';
import { LinkButton } from '../../components/LinkButton';
import { Badge, type BadgeTone } from '../../components/Badge';
import { HelpNote } from '../../components/HelpNote';
import { PetAvatar } from '../../components/PetAvatar';
import { Screen } from '../../components/Screen';
import { EmptyState, LoadingState } from '../../components/States';
import { usePets } from '../../context/PetContext';
import type { Vaccination, VaccinationStatus } from '../../data/mockVaccinations';
import { formatBirthDate } from '../../services/petService';
import { vaccinationService, vaccinationStatus } from '../../services/vaccinationService';
import { colors, radii, spacing } from '../../theme';
import type { PetsScreenProps } from '../../navigation/types';

export const vaccinationTone: Record<VaccinationStatus, BadgeTone> = {
  Completed: 'success',
  Upcoming: 'warning',
  Overdue: 'danger',
};

/** PO-40 Vaccination Records */
export function VaccinationRecordsScreen({ navigation, route }: PetsScreenProps<'VaccinationRecords'>) {
  const { petId } = route.params;
  const { getPet } = usePets();
  const pet = getPet(petId);
  const [records, setRecords] = useState<Vaccination[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    void vaccinationService.forPet(petId).then((entries) => {
      if (!active) return;
      setRecords(entries);
      setLoading(false);
    });
    return () => {
      active = false;
    };
  }, [petId]);

  return (
    <Screen contentStyle={styles.content}>
      <AppHeader title="Vaccination Records" />

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

      <AppText variant="display">Vaccination records</AppText>
      <AppText variant="body" color={colors.text.secondary}>
        History entered by your veterinary clinic.
      </AppText>

      {loading ? (
        <LoadingState />
      ) : records.length === 0 ? (
        <EmptyState
          icon="shield-checkmark-outline"
          title="No vaccination records yet"
          message="Records appear here once your clinic enters them after a visit."
        />
      ) : (
        records.map((record) => {
          const status = vaccinationStatus(record);
          return (
            <Pressable
              key={record.id}
              accessibilityRole="button"
              onPress={() => navigation.navigate('VaccinationDetails', { vaccinationId: record.id })}
              style={({ pressed }) => [styles.record, pressed && styles.pressed]}
            >
              <View style={styles.recordHead}>
                <AppText variant="cardTitle" style={styles.flex}>
                  {record.vaccine}
                </AppText>
                <Badge label={status} tone={vaccinationTone[status]} />
              </View>
              <AppText variant="caption">
                {record.administeredOn ? `Given ${formatBirthDate(record.administeredOn)}` : 'Administration date not recorded'} ·{' '}
                {record.nextDueISO ? `Booster due ${formatBirthDate(record.nextDueISO)}` : 'Next date not recorded'}
              </AppText>
            </Pressable>
          );
        })
      )}

      <LinkButton
        label="Upcoming Vaccinations"
        icon="calendar-outline"
        onPress={() => navigation.navigate('UpcomingVaccinations', { petId })}
      />

      <HelpNote>Demo vaccination entries. A veterinarian determines the appropriate vaccination schedule.</HelpNote>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { gap: spacing.md, paddingBottom: spacing.xxxl },
  petRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  flex: { flex: 1 },
  record: {
    gap: spacing.xs,
    padding: spacing.lg,
    borderRadius: radii.card,
    borderWidth: 1,
    borderColor: colors.surface.border,
    backgroundColor: colors.surface.card,
  },
  recordHead: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  pressed: { backgroundColor: colors.surface.subtle },
});
