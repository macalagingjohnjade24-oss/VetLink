import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { AppHeader } from '../../components/AppHeader';
import { AppText } from '../../components/AppText';
import { Button } from '../../components/Button';
import { CalendarPicker } from '../../components/CalendarPicker';
import { HelpNote } from '../../components/HelpNote';
import { Input } from '../../components/Input';
import { Screen } from '../../components/Screen';
import { useBooking } from '../../context/BookingContext';
import { usePets } from '../../context/PetContext';
import { CLINICS } from '../../data/mockClinics';
import { bookingService } from '../../services/bookingService';
import { colors, radii, spacing } from '../../theme';
import type { BookingsScreenProps } from '../../navigation/types';

/** PO-48 Reschedule Appointment */
export function RescheduleAppointmentScreen({ navigation, route }: BookingsScreenProps<'RescheduleAppointment'>) {
  const { appointmentId } = route.params;
  const { getAppointment, rescheduleAppointment } = useBooking();
  const { pets } = usePets();
  const appointment = getAppointment(appointmentId);

  const [dateISO, setDateISO] = useState<string | null>(null);
  const [time, setTime] = useState<string | null>(null);
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);

  if (!appointment) {
    return (
      <Screen contentStyle={styles.content}>
        <AppHeader title="Reschedule Appointment" />
        <AppText variant="title">This appointment is no longer available.</AppText>
      </Screen>
    );
  }

  const pet = pets.find((item) => item.id === appointment.petId);
  const clinic = CLINICS.find((item) => item.id === appointment.clinicId);
  const slots = dateISO ? bookingService.slotsFor(dateISO, appointment.clinicId) : [];

  const submit = async () => {
    if (!dateISO || !time || submitting) return;
    setSubmitting(true);
    await rescheduleAppointment(appointment.id, dateISO, time, reason);
    setSubmitting(false);
    navigation.goBack();
  };

  return (
    <Screen contentStyle={styles.content}>
      <AppHeader title="Reschedule Appointment" />

      <AppText variant="display">Need another time?</AppText>
      <AppText variant="body" color={colors.text.secondary}>
        Submit a request to change your visit.
      </AppText>

      <HelpNote>
        Current appointment
        {'\n'}
        {pet?.name ?? 'Your pet'} · {bookingService.formatShortDate(appointment.dateISO)} · {appointment.timeLabel}
        {'\n'}
        {clinic?.name ?? 'Clinic'}
      </HelpNote>

      <AppText variant="title">Select new date</AppText>
      <CalendarPicker selectedISO={dateISO} onSelect={(iso) => setDateISO(iso)} />

      <AppText variant="title">Select available time</AppText>
      <View style={styles.slots}>
        {slots.length === 0 ? (
          <AppText variant="caption">Choose a date to see available times.</AppText>
        ) : (
          slots.map((slot) => {
            const selected = time === slot.time;
            return (
              <Pressable
                key={slot.time}
                disabled={!slot.available}
                accessibilityRole="button"
                accessibilityLabel={`${slot.time}${slot.available ? '' : ' unavailable'}`}
                accessibilityState={{ disabled: !slot.available, selected }}
                onPress={() => setTime(slot.time)}
                style={[styles.slot, selected && styles.slotSelected, !slot.available && styles.slotUnavailable]}
              >
                <AppText
                  variant="bodyStrong"
                  color={selected ? colors.text.inverse : slot.available ? colors.text.brand : colors.text.subtle}
                >
                  {slot.time}
                </AppText>
              </Pressable>
            );
          })
        )}
      </View>

      <Input
        label="Reason for rescheduling"
        value={reason}
        onChangeText={setReason}
        placeholder="My work schedule has changed."
      />

      <HelpNote>
        {dateISO && time
          ? `Requested change: ${bookingService.formatShortDate(dateISO)} at ${time}.`
          : 'Choose a new date and time to request a change.'}
        {'\n'}Your current appointment stays active until the clinic approves the change.
      </HelpNote>

      <Button
        label="Submit Reschedule Request"
        loading={submitting}
        disabled={!dateISO || !time}
        onPress={() => void submit()}
      />
      <Button label="Keep Current Appointment" variant="secondary" onPress={() => navigation.goBack()} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { gap: spacing.md, paddingBottom: spacing.xxxl },
  slots: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm + 2 },
  slot: {
    width: '31.5%',
    minHeight: 52,
    borderRadius: radii.input,
    borderWidth: 1,
    borderColor: colors.surface.border,
    backgroundColor: colors.surface.card,
    alignItems: 'center',
    justifyContent: 'center',
  },
  slotSelected: { backgroundColor: colors.brand.primary, borderColor: colors.brand.primary },
  slotUnavailable: { backgroundColor: colors.surface.disabled, borderColor: colors.surface.border },
});
