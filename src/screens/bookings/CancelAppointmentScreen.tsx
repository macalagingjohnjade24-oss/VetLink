import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { AppHeader } from '../../components/AppHeader';
import { AppText } from '../../components/AppText';
import { Button } from '../../components/Button';
import { ChoiceRow } from '../../components/ChoiceRow';
import { HelpNote } from '../../components/HelpNote';
import { Input } from '../../components/Input';
import { Screen } from '../../components/Screen';
import { useBooking } from '../../context/BookingContext';
import { usePets } from '../../context/PetContext';
import { CLINICS } from '../../data/mockClinics';
import { bookingService } from '../../services/bookingService';
import { colors, radii, spacing } from '../../theme';
import type { BookingsScreenProps } from '../../navigation/types';

const REASONS = [
  'I’m no longer available',
  'My pet is feeling better',
  'I booked the wrong time',
  'I need a different service',
  'Other reason',
];

/** PO-49 Cancel Appointment */
export function CancelAppointmentScreen({ navigation, route }: BookingsScreenProps<'CancelAppointment'>) {
  const { appointmentId } = route.params;
  const { getAppointment, cancelAppointment } = useBooking();
  const { pets } = usePets();
  const appointment = getAppointment(appointmentId);

  const [reason, setReason] = useState<string | null>(REASONS[0]);
  const [note, setNote] = useState('');
  const [submitting, setSubmitting] = useState(false);

  if (!appointment) {
    return (
      <Screen contentStyle={styles.content}>
        <AppHeader title="Cancel Appointment" />
        <AppText variant="title">This appointment is no longer available.</AppText>
      </Screen>
    );
  }

  const pet = pets.find((item) => item.id === appointment.petId);
  const clinic = CLINICS.find((item) => item.id === appointment.clinicId);

  const confirm = async () => {
    if (!reason || submitting) return;
    setSubmitting(true);
    await cancelAppointment(appointment.id, reason, note);
    setSubmitting(false);
    navigation.goBack();
  };

  return (
    <Screen contentStyle={styles.content} keyboard>
      <AppHeader title="Cancel Appointment" />

      <AppText variant="display">Cancel this visit?</AppText>
      <AppText variant="body" color={colors.text.secondary}>
        Please review the details before continuing.
      </AppText>

      <View style={styles.card}>
        <AppText variant="cardTitle">{appointment.serviceName}</AppText>
        <AppText variant="caption">
          {pet?.name ?? 'Your pet'} · {bookingService.formatShortDate(appointment.dateISO)} · {appointment.timeLabel}
        </AppText>
        <AppText variant="caption">{clinic?.name ?? 'Clinic'}</AppText>
      </View>

      <AppText variant="label">Cancellation reason</AppText>
      <View style={styles.card}>
        {REASONS.map((option) => (
          <ChoiceRow
            key={option}
            mode="radio"
            label={option}
            selected={reason === option}
            onPress={() => setReason(option)}
          />
        ))}
      </View>

      <Input
        label="Additional information (optional)"
        value={note}
        onChangeText={setNote}
        placeholder="Share any details with the clinic"
        multiline
      />

      <HelpNote>
        This sends a cancellation request. Your appointment stays booked until the clinic accepts it.
        {'\n'}If you still need care, consider requesting another time instead.
      </HelpNote>

      <Button
        label="Request Cancellation"
        loading={submitting}
        disabled={!reason}
        onPress={() => void confirm()}
      />
      <Pressable accessibilityRole="button" onPress={() => navigation.goBack()} hitSlop={6} style={styles.link}>
        <AppText variant="link">Keep Appointment</AppText>
      </Pressable>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { gap: spacing.md, paddingBottom: spacing.xxxl },
  card: {
    gap: 2,
    padding: spacing.lg,
    borderRadius: radii.card,
    borderWidth: 1,
    borderColor: colors.surface.border,
    backgroundColor: colors.surface.card,
  },
  link: { alignItems: 'center', paddingVertical: spacing.sm },
});
