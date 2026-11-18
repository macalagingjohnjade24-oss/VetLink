import { useMemo } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { AppHeader } from '../../components/AppHeader';
import { AppText } from '../../components/AppText';
import { BookingStep } from '../../components/BookingStep';
import { Button } from '../../components/Button';
import { HelpNote } from '../../components/HelpNote';
import { Screen } from '../../components/Screen';
import { useBooking } from '../../context/BookingContext';
import { CLINICS } from '../../data/mockClinics';
import { bookingService } from '../../services/bookingService';
import { colors, radii, spacing } from '../../theme';
import type { BookingsScreenProps } from '../../navigation/types';

/** PO-27 Choose Available Time */
export function SelectTimeScreen({ navigation }: BookingsScreenProps<'BookingSelectTime'>) {
  const { draft, updateDraft } = useBooking();
  const clinic = CLINICS.find((item) => item.id === draft.clinicId);

  const slots = useMemo(
    () => (draft.dateISO ? bookingService.slotsFor(draft.dateISO, draft.clinicId ?? 'clinic') : []),
    [draft.dateISO, draft.clinicId],
  );

  return (
    <Screen contentStyle={styles.content}>
      <AppHeader title="Choose Available Time" />

      <BookingStep step={4} />
      <AppText variant="display">Find a time that fits</AppText>

      <HelpNote>
        {clinic?.name ?? 'Selected clinic'}
        {'\n'}
        {draft.dateISO ? bookingService.formatLongDate(draft.dateISO) : 'Choose a date first'}
      </HelpNote>

      <AppText variant="title">Morning &amp; afternoon availability</AppText>

      <View style={styles.slots}>
        {slots.map((slot) => {
          const selected = draft.time === slot.time;
          return (
            <Pressable
              key={slot.time}
              disabled={!slot.available}
              accessibilityRole="button"
              accessibilityLabel={`${slot.time}${slot.available ? '' : ' unavailable'}`}
              accessibilityState={{ disabled: !slot.available, selected }}
              onPress={() => updateDraft({ time: slot.time })}
              style={[
                styles.slot,
                selected && styles.slotSelected,
                !slot.available && styles.slotUnavailable,
              ]}
            >
              <AppText
                variant="bodyStrong"
                color={selected ? colors.text.inverse : slot.available ? colors.text.brand : colors.text.subtle}
              >
                {slot.time}
              </AppText>
            </Pressable>
          );
        })}
      </View>

      <HelpNote>Times shown are requests. The clinic confirms the final appointment time.</HelpNote>

      <Button
        label="Continue"
        disabled={!draft.time}
        onPress={() => navigation.navigate('BookingInformation')}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { gap: spacing.md, paddingBottom: spacing.xxxl },
  slots: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm + 2 },
  slot: {
    width: '31.5%',
    minHeight: 52,
    borderRadius: radii.input,
    borderWidth: 1,
    borderColor: colors.surface.border,
    backgroundColor: colors.surface.card,
    alignItems: 'center',
    justifyContent: 'center',
  },
  slotSelected: { backgroundColor: colors.brand.primary, borderColor: colors.brand.primary },
  slotUnavailable: { backgroundColor: colors.surface.disabled, borderColor: colors.surface.border },
});
