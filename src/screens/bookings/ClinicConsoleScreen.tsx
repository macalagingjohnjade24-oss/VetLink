import { useMemo } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { AppHeader } from '../../components/AppHeader';
import { AppText } from '../../components/AppText';
import { AppointmentBadge, isAwaitingClinic, isClosedStatus } from '../../components/AppointmentBadge';
import { Card } from '../../components/Card';
import { HelpNote } from '../../components/HelpNote';
import { Screen } from '../../components/Screen';
import { EmptyState } from '../../components/States';
import { useBooking } from '../../context/BookingContext';
import { usePets } from '../../context/PetContext';
import { CLINICS } from '../../data/mockClinics';
import type { Appointment } from '../../data/mockAppointments';
import { bookingService } from '../../services/bookingService';
import { colors, spacing } from '../../theme';
import type { BookingsScreenProps } from '../../navigation/types';

function RequestCard({ appointment, onPress }: { appointment: Appointment; onPress: () => void }) {
  const { pets } = usePets();
  const clinic = CLINICS.find((item) => item.id === appointment.clinicId);
  const pet = pets.find((item) => item.id === appointment.petId);

  return (
    <Pressable accessibilityRole="button" onPress={onPress}>
      <Card style={styles.card}>
        <View style={styles.head}>
          <AppText variant="cardTitle" style={styles.flex}>
            {appointment.serviceName}
          </AppText>
          <AppointmentBadge status={appointment.status} />
        </View>
        <AppText variant="caption">
          {pet?.name ?? 'Pet'} · {appointment.ownerName ?? 'Alex Santos'}
        </AppText>
        <AppText variant="caption">
          {bookingService.formatShortDate(appointment.dateISO)} · {appointment.timeLabel} ·{' '}
          {clinic?.name ?? 'Clinic'}
        </AppText>
        <AppText variant="small" color={colors.text.subtle}>
          Reference {appointment.reference}
        </AppText>
      </Card>
    </Pressable>
  );
}

/** Mock clinic console: the other side of the booking, where requests get answered. */
export function ClinicConsoleScreen({ navigation }: BookingsScreenProps<'ClinicConsole'>) {
  const { appointments } = useBooking();

  const { waiting, confirmed, closed } = useMemo(
    () => ({
      waiting: appointments.filter((item) => isAwaitingClinic(item.status)),
      confirmed: appointments.filter((item) => item.status === 'Confirmed'),
      closed: appointments.filter((item) => isClosedStatus(item.status)),
    }),
    [appointments],
  );

  const open = (appointmentId: string) => navigation.navigate('ClinicAppointment', { appointmentId });

  return (
    <Screen contentStyle={styles.content}>
      <AppHeader title="Clinic Console" />

      <AppText variant="display">The clinic side</AppText>
      <AppText variant="body" color={colors.text.secondary}>
        Mock staff view. Answer requests so owners get a real outcome.
      </AppText>

      <HelpNote>
        Demo only: this console stands in for a clinic&apos;s booking desk and shares the same local
        data as the owner app.
      </HelpNote>

      <AppText variant="title">Needs a decision</AppText>
      {waiting.length === 0 ? (
        <EmptyState
          icon="checkmark-done-outline"
          title="Nothing waiting"
          message="New booking, reschedule and cancellation requests show up here."
        />
      ) : (
        waiting.map((appointment) => (
          <RequestCard
            key={appointment.id}
            appointment={appointment}
            onPress={() => open(appointment.id)}
          />
        ))
      )}

      <AppText variant="title">Confirmed visits</AppText>
      {confirmed.length === 0 ? (
        <AppText variant="body" color={colors.text.secondary}>
          Accepted bookings appear here until the visit is completed.
        </AppText>
      ) : (
        confirmed.map((appointment) => (
          <RequestCard
            key={appointment.id}
            appointment={appointment}
            onPress={() => open(appointment.id)}
          />
        ))
      )}

      <AppText variant="title">Closed</AppText>
      {closed.map((appointment) => (
        <RequestCard
          key={appointment.id}
          appointment={appointment}
          onPress={() => open(appointment.id)}
        />
      ))}
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { gap: spacing.md, paddingBottom: spacing.xxxl },
  card: { gap: 2 },
  head: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: 2 },
  flex: { flex: 1 },
});
