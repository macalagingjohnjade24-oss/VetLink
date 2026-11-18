import { useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import { AppHeader } from '../../components/AppHeader';
import { AppText } from '../../components/AppText';
import { LinkButton } from '../../components/LinkButton';
import { AppointmentBadge } from '../../components/AppointmentBadge';
import { PetSelector } from '../../components/PetSelector';
import { Screen } from '../../components/Screen';
import { EmptyState } from '../../components/States';
import { useBooking } from '../../context/BookingContext';
import { usePets } from '../../context/PetContext';
import { CLINICS } from '../../data/mockClinics';
import { bookingService } from '../../services/bookingService';
import { shortClinicName } from '../../services/clinicService';
import { colors, radii, spacing } from '../../theme';
import type { PetsScreenProps, TabParamList } from '../../navigation/types';

/** PO-43 Appointment History */
export function AppointmentHistoryScreen({ navigation, route }: PetsScreenProps<'AppointmentHistory'>) {
  const { pets } = usePets();
  const { appointments } = useBooking();
  const [petId, setPetId] = useState(route.params?.petId ?? pets[0]?.id);
  const history = useMemo(
    () => appointments.filter((item) => item.petId === petId).sort((a, b) => b.dateISO.localeCompare(a.dateISO)),
    [appointments, petId],
  );

  const pet = pets.find((item) => item.id === petId) ?? pets[0];

  return (
    <Screen contentStyle={styles.content}>
      <AppHeader title="Appointment History" />

      <PetSelector pets={pets} selectedId={pet?.id} onSelect={setPetId} />

      <AppText variant="display">A history of care</AppText>
      <AppText variant="body" color={colors.text.secondary}>
        Past appointments for {pet?.name ?? 'your pet'}
      </AppText>

      {history.length === 0 ? (
        <EmptyState
          icon="calendar-outline"
          title="No appointments yet"
          message="Bookings for this pet will be listed here."
        />
      ) : (
        history.map((appointment) => (
          <View key={appointment.id} style={styles.card}>
            <View style={styles.head}>
              <AppText variant="cardTitle" style={styles.flex}>
                {appointment.serviceName}
              </AppText>
              <AppointmentBadge status={appointment.status} />
            </View>
            <AppText variant="caption">
              {bookingService.formatShortDate(appointment.dateISO)} ·{' '}
              {shortClinicName(CLINICS.find((clinic) => clinic.id === appointment.clinicId)?.name ?? 'Clinic')}
            </AppText>
            <AppText variant="small" color={colors.text.subtle}>
              {appointment.timeLabel} · Reference {appointment.reference}
            </AppText>
          </View>
        ))
      )}

      <LinkButton
        label="View all appointments"
        icon="calendar-outline"
        onPress={() => navigation.getParent<BottomTabNavigationProp<TabParamList>>()?.navigate('BookingsTab')}
      />
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
  head: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  flex: { flex: 1 },
});
