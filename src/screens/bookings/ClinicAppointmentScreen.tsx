import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { AppHeader } from '../../components/AppHeader';
import { AppointmentBadge, isAwaitingClinic, isClosedStatus } from '../../components/AppointmentBadge';
import { AppText } from '../../components/AppText';
import { Button } from '../../components/Button';
import { HelpNote } from '../../components/HelpNote';
import { Screen } from '../../components/Screen';
import { useBooking, type ClinicAction } from '../../context/BookingContext';
import { usePets } from '../../context/PetContext';
import { CLINICS } from '../../data/mockClinics';
import { bookingService } from '../../services/bookingService';
import { colors, radii, spacing } from '../../theme';
import type { BookingsScreenProps } from '../../navigation/types';

type ActionSet = { accept?: string; decline?: string; complete?: string };

const ACTIONS: Record<string, ActionSet> = {
  Pending: { accept: 'Accept booking', decline: 'Decline booking' },
  'Reschedule requested': { accept: 'Accept new time', decline: 'Decline, keep current time' },
  'Cancellation requested': { accept: 'Accept cancellation', decline: 'Decline cancellation' },
  Confirmed: { complete: 'Mark visit complete' },
};

/** Clinic-side detail: the request on one appointment and the actions that resolve it. */
export function ClinicAppointmentScreen({ navigation, route }: BookingsScreenProps<'ClinicAppointment'>) {
  const { appointmentId } = route.params;
  const { getAppointment, clinicUpdateAppointment } = useBooking();
  const { pets } = usePets();
  const [working, setWorking] = useState(false);
  const appointment = getAppointment(appointmentId);

  if (!appointment) {
    return (
      <Screen contentStyle={styles.content}>
        <AppHeader title="Clinic Console" />
        <AppText variant="title">This appointment is no longer available.</AppText>
        <Button label="Back to console" variant="secondary" onPress={() => navigation.goBack()} />
      </Screen>
    );
  }

  const clinic = CLINICS.find((item) => item.id === appointment.clinicId);
  const pet = pets.find((item) => item.id === appointment.petId);
  const actions = ACTIONS[appointment.status];

  const rows: { label: string; value: string }[] = [
    { label: 'CLINIC', value: clinic?.name ?? 'Clinic' },
    { label: 'PET', value: pet?.name ?? 'Pet' },
    { label: 'OWNER', value: `${appointment.ownerName ?? 'Alex Santos'} · ${appointment.contact ?? '+63 917 555 0142'}` },
    {
      label: 'CURRENT SLOT',
      value: `${bookingService.formatShortDate(appointment.dateISO)} · ${appointment.timeLabel}`,
    },
    { label: 'REFERENCE', value: appointment.reference },
    { label: 'REASON FOR VISIT', value: appointment.reason ?? 'Not recorded' },
    { label: 'NOTES', value: appointment.notes || appointment.symptoms || 'No notes added' },
  ];

  const run = async (action: ClinicAction) => {
    if (working) return;
    setWorking(true);
    await clinicUpdateAppointment(appointment.id, action);
    setWorking(false);
    navigation.goBack();
  };

  return (
    <Screen contentStyle={styles.content}>
      <AppHeader title="Clinic Console" />

      <AppText variant="display">{appointment.serviceName}</AppText>
      <AppText variant="body" color={colors.text.secondary}>
        {pet?.name ?? 'Pet'}’s visit · {clinic?.name ?? 'Clinic'}
      </AppText>
      <AppointmentBadge status={appointment.status} />

      {appointment.status === 'Reschedule requested' ? (
        <HelpNote>
          Owner asked for {bookingService.formatShortDate(appointment.requestedDateISO ?? appointment.dateISO)} at{' '}
          {appointment.requestedTime ?? 'a new time'}
          {appointment.rescheduleReason ? `\nReason: ${appointment.rescheduleReason}` : ''}
          {'\n'}Accepting moves the booking. Declining keeps the current slot.
        </HelpNote>
      ) : null}

      {appointment.status === 'Cancellation requested' ? (
        <HelpNote>
          Owner asked to cancel: {appointment.cancellationReason ?? 'No reason given'}
          {appointment.cancellationNote ? `\nNote: ${appointment.cancellationNote}` : ''}
          {'\n'}Accepting frees the slot. Declining keeps the appointment.
        </HelpNote>
      ) : null}

      {appointment.status === 'Pending' ? (
        <HelpNote>
          New request for this slot. Accepting confirms it for the owner; declining asks them to book
          again.
        </HelpNote>
      ) : null}

      {appointment.clinicNote ? <HelpNote>{appointment.clinicNote}</HelpNote> : null}

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

      {actions?.accept ? (
        <Button label={actions.accept} loading={working} onPress={() => void run('accept')} />
      ) : null}
      {actions?.complete ? (
        <Button label={actions.complete} loading={working} onPress={() => void run('complete')} />
      ) : null}
      {actions?.decline ? (
        <Button
          label={actions.decline}
          variant="secondary"
          disabled={working}
          onPress={() => void run('decline')}
        />
      ) : null}

      {isClosedStatus(appointment.status) ? (
        <HelpNote>Nothing to do — this appointment is {appointment.status.toLowerCase()}.</HelpNote>
      ) : isAwaitingClinic(appointment.status) ? null : (
        <HelpNote>No action needed until the visit happens.</HelpNote>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { gap: spacing.md, paddingBottom: spacing.xxxl },
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
