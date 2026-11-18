import { StyleSheet, View } from 'react-native';
import { APPOINTMENT_STATUSES, AppointmentBadge, statusDescription } from '../../components/AppointmentBadge';
import { AppHeader } from '../../components/AppHeader';
import { AppText } from '../../components/AppText';
import { Button } from '../../components/Button';
import { HelpNote } from '../../components/HelpNote';
import { Screen } from '../../components/Screen';
import { useBooking } from '../../context/BookingContext';
import { colors, radii, spacing } from '../../theme';
import type { BookingsScreenProps } from '../../navigation/types';

/** PO-50 Appointment Status */
export function AppointmentStatusScreen({ navigation, route }: BookingsScreenProps<'AppointmentStatus'>) {
  const { appointmentId } = route.params;
  const { getAppointment } = useBooking();
  const appointment = getAppointment(appointmentId);

  return (
    <Screen contentStyle={styles.content}>
      <AppHeader title="Appointment Status" />

      <AppText variant="display">Every update, in view</AppText>
      <AppText variant="body" color={colors.text.secondary}>
        Appointment status guide
      </AppText>

      <View style={styles.current}>
        <AppText variant="title" color={colors.text.brand}>
          {appointment?.status ?? 'Unknown'}
        </AppText>
      </View>

      <HelpNote>
        Track your appointment from request to completion. The status below reflects your latest action.
      </HelpNote>

      <AppText variant="title">Understand your booking status</AppText>

      {APPOINTMENT_STATUSES.map((status) => (
        <View key={status} style={styles.row}>
          <AppointmentBadge status={status} />
          <AppText variant="caption" style={styles.flex}>
            {statusDescription[status]}
          </AppText>
        </View>
      ))}

      <Button
        label="View Appointment"
        onPress={() => navigation.goBack()}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { gap: spacing.md, paddingBottom: spacing.xxxl },
  current: {
    padding: spacing.lg,
    borderRadius: radii.card,
    backgroundColor: colors.surface.tint,
  },
  row: { gap: spacing.xs, paddingVertical: spacing.xs },
  flex: { flex: 1 },
});
