import { StyleSheet } from 'react-native';
import { AppHeader } from '../../components/AppHeader';
import { AppText } from '../../components/AppText';
import { BookingStep } from '../../components/BookingStep';
import { Button } from '../../components/Button';
import { CalendarPicker } from '../../components/CalendarPicker';
import { HelpNote } from '../../components/HelpNote';
import { Screen } from '../../components/Screen';
import { useBooking } from '../../context/BookingContext';
import { bookingService } from '../../services/bookingService';
import { colors, spacing } from '../../theme';
import type { BookingsScreenProps } from '../../navigation/types';

/** PO-26 Choose Appointment Date */
export function SelectDateScreen({ navigation }: BookingsScreenProps<'BookingSelectDate'>) {
  const { draft, updateDraft } = useBooking();

  return (
    <Screen contentStyle={styles.content}>
      <AppHeader title="Choose Appointment Date" />

      <BookingStep step={3} />
      <AppText variant="display">Choose a date</AppText>
      <AppText variant="body" color={colors.text.secondary}>
        Choose an available appointment date.
      </AppText>

      <CalendarPicker selectedISO={draft.dateISO} onSelect={(iso) => updateDraft({ dateISO: iso, time: null })} />

      <HelpNote>
        {draft.dateISO ? `● Selected: ${bookingService.formatLongDate(draft.dateISO)}` : 'Choose an available date'}
        {'\n'}Muted dates are unavailable.
      </HelpNote>

      <Button label="Continue" disabled={!draft.dateISO} onPress={() => navigation.navigate('BookingSelectTime')} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { gap: spacing.md, paddingBottom: spacing.xxxl },
});
