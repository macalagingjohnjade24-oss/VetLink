import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import { AppHeader } from '../../components/AppHeader';
import { AppText } from '../../components/AppText';
import { Button } from '../../components/Button';
import { HelpNote } from '../../components/HelpNote';
import { Screen } from '../../components/Screen';
import { EmptyState, ErrorState, LoadingState } from '../../components/States';
import { usePets } from '../../context/PetContext';
import type { Vaccination } from '../../data/mockVaccinations';
import { formatBirthDate } from '../../services/petService';
import { vaccinationService, vaccinationStatus } from '../../services/vaccinationService';
import { errorMessage } from '../../utils/errors';
import { colors, radii, spacing } from '../../theme';
import type { PetsScreenProps, TabParamList } from '../../navigation/types';

/** PO-42 Upcoming Vaccinations */
export function UpcomingVaccinationsScreen({ navigation, route }: PetsScreenProps<'UpcomingVaccinations'>) {
  const petId = route.params?.petId;
  const { getPet } = usePets();
  const [records, setRecords] = useState<Vaccination[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(null);
    void vaccinationService
      .upcoming()
      .then((entries) => {
        if (!active) return;
        setRecords(petId ? entries.filter((entry) => entry.petId === petId) : entries);
      })
      .catch((err) => {
        if (!active) return;
        setRecords([]);
        setError(errorMessage(err, 'We couldn’t load upcoming vaccinations.'));
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [petId, reloadKey]);

  const bookAppointment = () =>
    navigation.getParent<BottomTabNavigationProp<TabParamList>>()?.navigate('BookingsTab', {
      screen: 'BookingSelectClinic',
    });

  return (
    <Screen contentStyle={styles.content}>
      <AppHeader title="Upcoming Vaccinations" />

      <AppText variant="display">Stay a step ahead</AppText>
      <AppText variant="body" color={colors.text.secondary}>
        Upcoming vaccination reminders
      </AppText>

      {loading ? (
        <LoadingState />
      ) : error ? (
        <ErrorState
          title="We couldn’t load upcoming vaccinations"
          message={error}
          onRetry={() => setReloadKey((key) => key + 1)}
        />
      ) : records.length === 0 ? (
        <EmptyState
          icon="shield-checkmark-outline"
          title="Nothing due right now"
          message="Reminders appear here when your clinic records a next date."
        />
      ) : (
        records.map((record) => {
          const pet = getPet(record.petId);
          const status = vaccinationStatus(record);
          return (
            <View key={record.id} style={styles.card}>
              <HelpNote>
                {pet?.name ?? 'Your pet'} · {record.vaccine}
                {'\n'}
                {record.nextDueISO ? `Due ${formatBirthDate(record.nextDueISO)}` : 'Next date not recorded · Ask your clinic'}
                {record.nextDueISO && record.reminderDays
                  ? `\nReminder: On · ${record.reminderDays} days before`
                  : ''}
              </HelpNote>
              {status === 'Overdue' ? (
                <AppText variant="caption" color={colors.status.danger}>
                  This vaccination is past its recorded next date.
                </AppText>
              ) : null}
              <Button
                label="View Record Details"
                variant="secondary"
                size="sm"
                onPress={() => navigation.navigate('VaccinationDetails', { vaccinationId: record.id })}
              />
              <Button label="Request an Appointment" size="sm" onPress={bookAppointment} />
            </View>
          );
        })
      )}

      <HelpNote>
        Reminders reflect dates recorded by your clinic and do not replace veterinary advice.
      </HelpNote>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { gap: spacing.md, paddingBottom: spacing.xxxl },
  card: {
    gap: spacing.sm,
    padding: spacing.lg,
    borderRadius: radii.card,
    borderWidth: 1,
    borderColor: colors.surface.border,
    backgroundColor: colors.surface.card,
  },
});
