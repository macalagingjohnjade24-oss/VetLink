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

/** PO-31 Booking Successful */
export function BookingSuccessScreen({ navigation, route }: BookingsScreenProps<'BookingSuccess'>) {
  const { appointmentId } = route.params;
  const { getAppointment } = useBooking();
  const { pets } = usePets();
  const appointment = getAppointment(appointmentId);

  const clinic = CLINICS.find((item) => item.id === appointment?.clinicId);
  const pet = pets.find((item) => item.id === appointment?.petId);

  if (!appointment) {
    return (
      <Screen contentStyle={styles.content}>
        <AppHeader title="Booking Successful" />
        <AppText variant="title">We couldn’t find that appointment.</AppText>
        <Button label="Go to My Appointments" onPress={() => navigation.navigate('BookingsHome')} />
      </Screen>
    );
  }

  const confirmed = appointment.status === 'Confirmed';

  return (
    <Screen contentStyle={styles.content}>
      <AppHeader title="Booking Successful" />

      <AppText variant="display">
        {confirmed ? `You’re all set, ${pet?.name ?? 'friend'}!` : 'Request updated'}
      </AppText>
      <AppText variant="body" color={colors.text.secondary}>
        {confirmed
          ? 'The clinic has approved your appointment request.'
          : 'Your appointment request is still waiting for clinic approval.'}
      </AppText>

      <Badge label={appointment.status} tone={confirmed ? 'success' : 'warning'} />

      <View style={styles.card}>
        <AppText variant="cardTitle">{appointment.serviceName}</AppText>
        <AppText variant="caption">
          {pet?.name ?? 'Your pet'} · {appointment.dateLabel} · {appointment.timeLabel}
        </AppText>
      </View>

      <HelpNote>
        {clinic?.name ?? 'Clinic'}
        {'\n'}
        {clinic?.address ?? 'Address'}
        {'\n'}
        {`Reference: ${appointment.reference}`}
      </HelpNote>

      <AppText variant="caption">Please bring your pet’s previous health records.</AppText>

      <Button label="Go to My Appointments" onPress={() => navigation.navigate('BookingsHome')} />
      <Button
        label="Back to Home"
        variant="secondary"
        onPress={() => navigation.getParent<BottomTabNavigationProp<TabParamList>>()?.navigate('HomeTab')}
      />

      <AppText variant="small" color={colors.text.subtle}>
        Requested {bookingService.formatShortDate(appointment.createdAt ?? appointment.dateISO)}
      </AppText>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { gap: spacing.md, paddingBottom: spacing.xxxl },
  card: {
    gap: 4,
    padding: spacing.lg,
    borderRadius: radii.card,
    borderWidth: 1,
    borderColor: colors.surface.border,
    backgroundColor: colors.surface.card,
  },
});
