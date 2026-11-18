import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { AppHeader } from '../../components/AppHeader';
import { AppText } from '../../components/AppText';
import { LinkButton } from '../../components/LinkButton';
import { BookingStep } from '../../components/BookingStep';
import { Button } from '../../components/Button';
import { HelpNote } from '../../components/HelpNote';
import { Screen } from '../../components/Screen';
import { useBooking } from '../../context/BookingContext';
import { CLINICS } from '../../data/mockClinics';
import { usePets } from '../../context/PetContext';
import { bookingService } from '../../services/bookingService';
import { colors, radii, spacing } from '../../theme';
import type { BookingsScreenProps } from '../../navigation/types';

/** PO-29 Review Booking Details */
export function BookingReviewScreen({ navigation }: BookingsScreenProps<'BookingReview'>) {
  const { draft, submitBooking, resetDraft } = useBooking();
  const { pets } = usePets();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const clinic = CLINICS.find((item) => item.id === draft.clinicId);
  const pet = pets.find((item) => item.id === draft.petId);
  const service = clinic?.services.find((item) => item.id === draft.serviceId);

  const rows: { label: string; value: string }[] = [
    { label: 'CLINIC', value: clinic?.name ?? '—' },
    { label: 'PET & SERVICE', value: `${pet?.name ?? '—'} · ${service?.name ?? '—'}` },
    {
      label: 'REQUESTED DATE & TIME',
      value: `${draft.dateISO ? bookingService.formatShortDate(draft.dateISO) : '—'} · ${draft.time ?? '—'}`,
    },
    { label: 'OWNER', value: `${draft.ownerName} · ${draft.contact}` },
    { label: 'REASON', value: draft.reason || '—' },
    { label: 'NOTES', value: draft.notes || draft.symptoms || '—' },
  ];

  const confirm = async () => {
    if (submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      const appointment = await submitBooking();
      resetDraft();
      navigation.replace('BookingConfirmation', { appointmentId: appointment.id });
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'The booking could not be submitted.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Screen contentStyle={styles.content}>
      <AppHeader title="Review Booking Details" />

      <BookingStep step={6} />
      <AppText variant="display">Review your request</AppText>

      <View style={styles.summary}>
        {rows.map((row) => (
          <View key={row.label} style={styles.row}>
            <AppText variant="small" color={colors.text.secondary} style={styles.rowLabel}>
              {row.label}
            </AppText>
            <AppText variant="body" style={styles.rowValue}>
              {row.value}
            </AppText>
          </View>
        ))}
      </View>

      <View style={styles.links}>
        <LinkButton
          label="Edit clinic, pet or service"
          icon="create-outline"
          onPress={() => navigation.navigate('BookingSelectClinic')}
        />
        <LinkButton label="Edit date & time" icon="calendar-outline" onPress={() => navigation.navigate('BookingSelectDate')} />
        <LinkButton
          label="Edit appointment information"
          icon="document-text-outline"
          onPress={() => navigation.navigate('BookingInformation')}
        />
      </View>

      <HelpNote>
        Confirming submits a request. Your appointment is not confirmed until the clinic approves it.
      </HelpNote>

      {error ? (
        <AppText variant="caption" color={colors.status.danger}>
          {error}
        </AppText>
      ) : null}

      <Button
        label="Confirm Appointment"
        loading={submitting}
        disabled={!clinic || !pet || !service || !draft.dateISO || !draft.time}
        onPress={() => void confirm()}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { gap: spacing.md, paddingBottom: spacing.xxxl },
  summary: {
    gap: spacing.md,
    padding: spacing.lg,
    borderRadius: radii.card,
    borderWidth: 1,
    borderColor: colors.surface.border,
    backgroundColor: colors.surface.card,
  },
  row: { gap: 2 },
  rowLabel: { letterSpacing: 0.6 },
  rowValue: { color: colors.text.primary },
  links: { gap: spacing.sm + 2 },
});
