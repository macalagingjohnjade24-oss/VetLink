import { useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { AppHeader } from '../../components/AppHeader';
import { AppText } from '../../components/AppText';
import { HelpNote } from '../../components/HelpNote';
import { PetAvatar } from '../../components/PetAvatar';
import { Screen } from '../../components/Screen';
import { EmptyState, ErrorState, LoadingState } from '../../components/States';
import { usePets } from '../../context/PetContext';
import { CLINICS } from '../../data/mockClinics';
import type { MedicalRecord } from '../../data/mockMedicalRecords';
import { shortClinicName } from '../../services/clinicService';
import { medicalRecordService } from '../../services/medicalRecordService';
import { errorMessage } from '../../utils/errors';
import { colors, radii, spacing } from '../../theme';
import type { PetsScreenProps } from '../../navigation/types';

/** PO-38 Medical History */
export function MedicalHistoryScreen({ navigation, route }: PetsScreenProps<'MedicalHistory'>) {
  const { petId } = route.params;
  const { getPet } = usePets();
  const pet = getPet(petId);
  const [records, setRecords] = useState<MedicalRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(null);
    void medicalRecordService
      .forPet(petId)
      .then((entries) => {
        if (active) setRecords(entries);
      })
      .catch((err) => {
        if (!active) return;
        setRecords([]);
        setError(errorMessage(err, 'We couldn’t load this medical timeline.'));
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [petId, reloadKey]);

  const grouped = useMemo(() => {
    const map = new Map<string, MedicalRecord[]>();
    records.forEach((record) => {
      const key = medicalRecordService.monthHeading(record.dateISO);
      map.set(key, [...(map.get(key) ?? []), record]);
    });
    return [...map.entries()];
  }, [records]);

  return (
    <Screen contentStyle={styles.content}>
      <AppHeader title="Medical History" />

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

      <AppText variant="display">{pet ? `${pet.name}’s medical timeline` : 'Medical timeline'}</AppText>
      <AppText variant="body" color={colors.text.secondary}>
        Clinic-entered records, in one place.
      </AppText>

      {loading ? (
        <LoadingState />
      ) : error ? (
        <ErrorState
          title="We couldn’t load this timeline"
          message={error}
          onRetry={() => setReloadKey((key) => key + 1)}
        />
      ) : grouped.length === 0 ? (
        <EmptyState
          icon="document-text-outline"
          title="No medical records yet"
          message="Records appear here once your clinic adds a visit."
        />
      ) : (
        grouped.map(([month, entries]) => (
          <View key={month} style={styles.group}>
            <AppText variant="badge" color={colors.text.secondary} style={styles.month}>
              {month}
            </AppText>
            {entries.map((record) => {
              const clinic = CLINICS.find((item) => item.id === record.clinicId);
              return (
                <View key={record.id} style={styles.item}>
                  <Pressable
                    accessibilityRole="button"
                    onPress={() => navigation.navigate('MedicalRecordDetails', { recordId: record.id })}
                    style={({ pressed }) => [styles.card, pressed && styles.pressed]}
                  >
                    <AppText variant="cardTitle">{record.title}</AppText>
                    <AppText variant="caption">
                      {medicalRecordService.shortDate(record.dateISO)} ·{' '}
                      {shortClinicName(clinic?.name ?? 'Clinic')} · View Details
                    </AppText>
                  </Pressable>
                  <HelpNote>
                    Recorded diagnosis: {record.diagnosis ?? 'Not recorded'}
                    {'\n'}Treatment: {record.treatment ?? 'Refer to the clinic record'}
                  </HelpNote>
                </View>
              );
            })}
          </View>
        ))
      )}

      <HelpNote>
        Records are maintained by the veterinary clinic. Contact the clinic if information appears incomplete.
      </HelpNote>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { gap: spacing.md, paddingBottom: spacing.xxxl },
  petRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  flex: { flex: 1 },
  group: { gap: spacing.sm },
  month: { letterSpacing: 0.8 },
  item: { gap: spacing.sm },
  card: {
    gap: 2,
    padding: spacing.lg,
    borderRadius: radii.card,
    borderWidth: 1,
    borderColor: colors.surface.border,
    backgroundColor: colors.surface.card,
  },
  pressed: { backgroundColor: colors.surface.subtle },
});
