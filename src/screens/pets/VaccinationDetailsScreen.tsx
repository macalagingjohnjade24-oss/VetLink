import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { AppHeader } from '../../components/AppHeader';
import { AppText } from '../../components/AppText';
import { Badge, type BadgeTone } from '../../components/Badge';
import { HelpNote } from '../../components/HelpNote';
import { PetAvatar } from '../../components/PetAvatar';
import { Screen } from '../../components/Screen';
import { LoadingState } from '../../components/States';
import { usePets } from '../../context/PetContext';
import { CLINICS } from '../../data/mockClinics';
import type { Vaccination } from '../../data/mockVaccinations';
import { formatBirthDate } from '../../services/petService';
import { vaccinationService, vaccinationStatus } from '../../services/vaccinationService';
import { colors, radii, spacing } from '../../theme';
import type { PetsScreenProps } from '../../navigation/types';

const tone: Record<string, BadgeTone> = { Completed: 'success', Upcoming: 'warning', Overdue: 'danger' };

/** PO-41 Vaccination Details */
export function VaccinationDetailsScreen({ route }: PetsScreenProps<'VaccinationDetails'>) {
  const { vaccinationId } = route.params;
  const { getPet } = usePets();
  const [record, setRecord] = useState<Vaccination | null>(null);
  const [loading, setLoading] = useState(true);
  const [documentNote, setDocumentNote] = useState(false);

  useEffect(() => {
    let active = true;
    void vaccinationService.getById(vaccinationId).then((entry) => {
      if (!active) return;
      setRecord(entry);
      setLoading(false);
    });
    return () => {
      active = false;
    };
  }, [vaccinationId]);

  if (loading) {
    return (
      <Screen contentStyle={styles.content}>
        <AppHeader title="Vaccination Details" />
        <LoadingState />
      </Screen>
    );
  }

  if (!record) {
    return (
      <Screen contentStyle={styles.content}>
        <AppHeader title="Vaccination Details" />
        <AppText variant="title">This record is no longer available.</AppText>
      </Screen>
    );
  }

  const pet = getPet(record.petId);
  const clinic = CLINICS.find((item) => item.id === record.clinicId);
  const status = vaccinationStatus(record);

  const rows: { label: string; value: string }[] = [
    {
      label: 'ADMINISTRATION DATE',
      value: record.administeredOn ? formatBirthDate(record.administeredOn) : 'Not recorded',
    },
    {
      label: 'NEXT DATE RECORDED',
      value: record.nextDueISO ? formatBirthDate(record.nextDueISO) : 'Not recorded',
    },
    { label: 'CLINIC', value: clinic?.name ?? 'Not recorded' },
    { label: 'ADMINISTERING VETERINARIAN', value: record.veterinarian ?? 'Not recorded' },
    {
      label: 'RECORD DETAILS',
      value: record.details ?? 'Vaccine batch and certificate details available from the clinic.',
    },
  ];

  return (
    <Screen contentStyle={styles.content}>
      <AppHeader title="Vaccination Details" />

      <AppText variant="display">{record.vaccine}</AppText>
      <AppText variant="body" color={colors.text.secondary}>
        Vaccination record · {record.reference}
      </AppText>
      <Badge label={status} tone={tone[status] ?? 'neutral'} />

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

      <View style={styles.card}>
        {rows.map((row) => (
          <View key={row.label} style={styles.row}>
            <AppText variant="small" color={colors.text.secondary} style={styles.rowLabel}>
              {row.label}
            </AppText>
            <AppText variant="body">{row.value}</AppText>
          </View>
        ))}
      </View>

      <Pressable accessibilityRole="button" onPress={() => setDocumentNote(true)} hitSlop={6}>
        <AppText variant="link">View supporting document</AppText>
      </Pressable>
      {documentNote ? (
        <AppText variant="caption">
          Supporting documents are added by the clinic. None is attached to this demo record — ask the clinic for the
          certificate.
        </AppText>
      ) : null}

      <HelpNote>
        Sample clinic-entered record. Contact the clinic to verify details before making care decisions.
      </HelpNote>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { gap: spacing.md, paddingBottom: spacing.xxxl },
  petRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  flex: { flex: 1 },
  card: {
    gap: spacing.md,
    padding: spacing.lg,
    borderRadius: radii.card,
    borderWidth: 1,
    borderColor: colors.surface.border,
    backgroundColor: colors.surface.card,
  },
  row: { gap: 2 },
  rowLabel: { letterSpacing: 0.6 },
});
