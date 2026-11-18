import { useMemo } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { AppHeader } from '../../components/AppHeader';
import { AppText } from '../../components/AppText';
import { AppointmentBadge, isClosedStatus } from '../../components/AppointmentBadge';
import { Button } from '../../components/Button';
import { Card } from '../../components/Card';
import { Screen } from '../../components/Screen';
import { EmptyState } from '../../components/States';
import { useBooking } from '../../context/BookingContext';
import type { Appointment } from '../../data/mockAppointments';
import { CLINICS } from '../../data/mockClinics';
import { usePets } from '../../context/PetContext';
import { colors, radii, spacing } from '../../theme';
import type { BookingsScreenProps } from '../../navigation/types';

function AppointmentCard({ appointment, onPress }: { appointment: Appointment; onPress: () => void }) {
  const { pets } = usePets();
  const clinic = CLINICS.find((item) => item.id === appointment.clinicId);
  const pet = pets.find((item) => item.id === appointment.petId);
  const isPast = isClosedStatus(appointment.status);

  return (
    <Pressable accessibilityRole="button" onPress={onPress}>
      <Card style={[styles.card, isPast && styles.cardMuted]}>
        <View style={styles.cardTop}>
          <View style={styles.dateChip}>
            <AppText variant="badge" color={colors.text.brand}>
              {appointment.dateLabel.toUpperCase()}
            </AppText>
          </View>
          <AppointmentBadge status={appointment.status} />
        </View>
        <AppText variant="cardTitle">{appointment.serviceName}</AppText>
        <AppText variant="caption">
          {pet?.name ?? 'Your pet'} · {appointment.timeLabel} · {clinic?.name ?? 'Clinic'}
        </AppText>
        <AppText variant="small" color={colors.text.subtle}>
          Reference {appointment.reference}
        </AppText>
      </Card>
    </Pressable>
  );
}

/** Bookings tab home — My Appointments list fed by booking state. */
export function BookingsHomeScreen({ navigation }: BookingsScreenProps<'BookingsHome'>) {
  const { appointments, startBooking } = useBooking();

  const { upcoming, past } = useMemo(() => {
    const todayISO = new Date().toISOString().slice(0, 10);
    return {
      upcoming: appointments.filter((item) => item.dateISO.slice(0, 10) >= todayISO && !isClosedStatus(item.status)),
      past: appointments.filter((item) => item.dateISO.slice(0, 10) < todayISO || isClosedStatus(item.status)),
    };
  }, [appointments]);

  const pendingCount = upcoming.filter((item) => item.status === 'Pending').length;

  return (
    <Screen contentStyle={styles.content}>
      <AppHeader title="My Appointments" showBack={false} />

      <AppText variant="display">Your visits</AppText>
      <AppText variant="body" color={colors.text.secondary}>
        {upcoming.length} upcoming{pendingCount ? ` · ${pendingCount} awaiting clinic approval` : ''}
      </AppText>

      <Button
        label="Book a new appointment"
        icon="add"
        onPress={() => {
          startBooking();
          navigation.navigate('BookingSelectClinic');
        }}
      />

      <AppText variant="title">Upcoming</AppText>
      {upcoming.length === 0 ? (
        <EmptyState
          icon="calendar-outline"
          title="No upcoming appointments"
          message="Requests you send to a clinic will appear here while you wait for approval."
        />
      ) : (
        upcoming.map((appointment) => (
          <AppointmentCard
            key={appointment.id}
            appointment={appointment}
            onPress={() => navigation.navigate('AppointmentDetails', { appointmentId: appointment.id })}
          />
        ))
      )}

      <AppText variant="title">Past appointments</AppText>
      {past.length === 0 ? (
        <AppText variant="body" color={colors.text.secondary}>
          Completed visits will be listed here.
        </AppText>
      ) : (
        past.map((appointment) => (
          <AppointmentCard
            key={appointment.id}
            appointment={appointment}
            onPress={() => navigation.navigate('AppointmentDetails', { appointmentId: appointment.id })}
          />
        ))
      )}

      <Pressable accessibilityRole="button" onPress={() => navigation.navigate('ClinicConsole')} hitSlop={6}>
        <AppText variant="link">Open clinic console (demo)</AppText>
      </Pressable>

      <AppText variant="caption">
        Appointments stay on this device. Rescheduling and cancellation are requests until the clinic confirms them.
      </AppText>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { gap: spacing.md, paddingBottom: spacing.xxxl },
  card: { gap: 4 },
  cardMuted: { backgroundColor: colors.surface.subtle },
  cardTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.xs },
  dateChip: {
    paddingHorizontal: spacing.md,
    paddingVertical: 5,
    borderRadius: radii.pill,
    backgroundColor: colors.surface.tint,
  },
});
