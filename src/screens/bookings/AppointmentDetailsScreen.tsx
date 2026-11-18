import { StyleSheet, View } from 'react-native';
import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import { AppHeader } from '../../components/AppHeader';
import { AppointmentBadge, isClosedStatus } from '../../components/AppointmentBadge';
import { AppText } from '../../components/AppText';
import { Button } from '../../components/Button';
import { HelpNote } from '../../components/HelpNote';
import { LinkButton } from '../../components/LinkButton';
import { Screen } from '../../components/Screen';
import { useBooking } from '../../context/BookingContext';
import { usePets } from '../../context/PetContext';
import { CLINICS } from '../../data/mockClinics';
import { bookingService } from '../../services/bookingService';
import { colors, radii, spacing } from '../../theme';
import type { BookingsScreenProps, TabParamList } from '../../navigation/types';

/** PO-47 Appointment Details */
export function AppointmentDetailsScreen({ navigation, route }: BookingsScreenProps<'AppointmentDetails'>) {
  const { appointmentId } = route.params;
  const { getAppointment, startBooking } = useBooking();
  const { pets } = usePets();
  const appointment = getAppointment(appointmentId);

  if (!appointment) {
    return (
      <Screen contentStyle={styles.content}>
        <AppHeader title="Appointment Details" />
        <AppText variant="title">This appointment is no longer available.</AppText>
        <Button label="Back to My Appointments" variant="secondary" onPress={() => navigation.navigate('BookingsHome')} />
      </Screen>
    );
  }

  const clinic = CLINICS.find((item) => item.id === appointment.clinicId);
  const pet = pets.find((item) => item.id === appointment.petId);
  const locked = isClosedStatus(appointment.status);

  const bookAgain = () => {
    startBooking({
      clinicId: appointment.clinicId,
      petId: pet?.id,
      serviceId: appointment.serviceId,
    });
    navigation.navigate(pet ? 'BookingSelectService' : 'BookingSelectPet');
  };

  const rows: { label: string; value: string }[] = [
    { label: 'CLINIC', value: clinic?.name ?? 'Clinic' },
    { label: 'PET & SERVICE', value: `${pet?.name ?? 'Your pet'} · ${appointment.serviceName}` },
    {
      label: 'DATE & TIME',
      value: `${bookingService.formatShortDate(appointment.dateISO)} · ${appointment.timeLabel}`,
    },
    {
      label: 'OWNER',
      value: `${appointment.ownerName ?? 'Alex Santos'} · ${appointment.contact ?? '+63 917 555 0142'}`,
    },
    { label: 'REASON', value: appointment.reason ?? 'Not recorded' },
    { label: 'NOTES', value: appointment.notes || appointment.symptoms || 'No notes added' },
  ];

  return (
    <Screen contentStyle={styles.content}>
      <AppHeader title="Appointment Details" />

      <AppText variant="display">{pet ? `${pet.name}’s visit` : 'Your visit'}</AppText>
      <AppText variant="body" color={colors.text.secondary}>
        Appointment {appointment.reference}
      </AppText>
      <AppointmentBadge status={appointment.status} />

      {appointment.status === 'Reschedule requested' && appointment.requestedDateISO ? (
        <HelpNote>
          Requested change: {bookingService.formatShortDate(appointment.requestedDateISO)} at{' '}
          {appointment.requestedTime}
          {'\n'}Your current appointment stays active until the clinic approves the change.
        </HelpNote>
      ) : null}

      {appointment.status === 'Cancellation requested' ? (
        <HelpNote>
          Cancellation requested: {appointment.cancellationReason ?? 'No reason given'}
          {'\n'}The clinic will confirm. Your visit still stands until then.
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

      <LinkButton
        label="Clinic contact & location"
        icon="location-outline"
        onPress={() =>
          navigation
            .getParent<BottomTabNavigationProp<TabParamList>>()
            ?.navigate('ClinicsTab', { screen: 'ClinicContact', params: { clinicId: appointment.clinicId } })
        }
      />

      {appointment.status === 'Rejected' ? (
        <>
          <HelpNote>
            The clinic couldn’t accept this request. Book the same clinic, service and pet again for a new time.
          </HelpNote>
          <Button label="Book again" onPress={bookAgain} />
        </>
      ) : locked ? (
        <HelpNote>
          This appointment is {appointment.status.toLowerCase()}. Rescheduling and cancellation are no longer available
          for it.
        </HelpNote>
      ) : appointment.status === 'Cancellation requested' ? (
        <HelpNote>
          Your cancellation is with the clinic. You can’t change this booking until they respond.
        </HelpNote>
      ) : (
        <>
          <Button
            label="Reschedule Appointment"
            onPress={() => navigation.navigate('RescheduleAppointment', { appointmentId })}
          />
          <LinkButton
            label="Cancel Appointment"
            icon="close-circle-outline"
            tone="danger"
            onPress={() => navigation.navigate('CancelAppointment', { appointmentId })}
          />
        </>
      )}

      <LinkButton
        label="Track appointment status"
        icon="pulse-outline"
        onPress={() => navigation.navigate('AppointmentStatus', { appointmentId })}
      />

      <HelpNote>
        Changes are subject to clinic policy and approval. Contact the clinic for urgent schedule changes.
      </HelpNote>
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
