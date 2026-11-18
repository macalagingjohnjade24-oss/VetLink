import { StyleSheet, View } from 'react-native';
import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import { AppHeader } from '../../components/AppHeader';
import { AppText } from '../../components/AppText';
import { Badge } from '../../components/Badge';
import { Button } from '../../components/Button';
import { HelpNote } from '../../components/HelpNote';
import { Screen } from '../../components/Screen';
import { useBooking } from '../../context/BookingContext';
import { CLINICS } from '../../data/mockClinics';
import { usePets } from '../../context/PetContext';
import { bookingService } from '../../services/bookingService';
import { colors, radii, spacing } from '../../theme';
import type { BookingsScreenProps, TabParamList } from '../../navigation/types';

/** PO-30 Booking Confirmation */
export function BookingConfirmationScreen({ navigation, route }: BookingsScreenProps<'BookingConfirmation'>) {
  const { appointmentId } = route.params;
  const { getAppointment } = useBooking();
  const { pets } = usePets();
  const appointment = getAppointment(appointmentId);

  const clinic = CLINICS.find((item) => item.id === appointment?.clinicId);
  const pet = pets.find((item) => item.id === appointment?.petId);

  const goHome = () =>
    navigation.getParent<BottomTabNavigationProp<TabParamList>>()?.navigate('HomeTab');

  if (!appointment) {
    return (
      <Screen contentStyle={styles.content}>
        <AppHeader title="Booking Confirmation" />
        <AppText variant="title">We couldn’t find that request.</AppText>
        <Button label="Go to My Appointments" onPress={() => navigation.navigate('BookingsHome')} />
      </Screen>
    );
  }

  return (
    <Screen contentStyle={styles.content}>
      <AppHeader title="Booking Confirmation" />

      <AppText variant="display">Request submitted</AppText>
      <AppText variant="body" color={colors.text.secondary}>
        Your appointment request has been sent to the clinic.
      </AppText>

      <Badge label={appointment.status} tone="warning" />

      <View style={styles.receipt}>
        <AppText variant="caption" color={colors.text.brand}>
          {`REFERENCE  ${appointment.reference}`}
        </AppText>
        <AppText variant="title" color={colors.text.primary}>
          {clinic?.name ?? 'Clinic'}
        </AppText>
        <AppText variant="body">
          {pet?.name ?? 'Your pet'} · {appointment.serviceName}
          {'\n'}Requested: {appointment.dateLabel} at {appointment.timeLabel}
        </AppText>
      </View>

      <HelpNote>
        Waiting for clinic approval. You’ll receive a notification when the status changes.
      </HelpNote>

      <Button label="View Appointment" onPress={() => navigation.navigate('BookingsHome')} />
      <Button label="Return Home" variant="secondary" onPress={goHome} />

      <AppText variant="small" color={colors.text.subtle}>
        Booked {bookingService.formatShortDate(appointment.createdAt ?? new Date().toISOString())}
      </AppText>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { gap: spacing.md, paddingBottom: spacing.xxxl },
  receipt: {
    gap: spacing.xs + 2,
    padding: spacing.lg,
    borderRadius: radii.card,
    borderWidth: 1,
    borderColor: colors.surface.border,
    backgroundColor: colors.surface.card,
  },
});
