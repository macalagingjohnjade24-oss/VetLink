import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { bookingService } from '../services/bookingService';
import { colors, radii, spacing } from '../theme';
import { AppText } from './AppText';

const WEEKDAYS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
const MAX_MONTHS_AHEAD = 3;

type Props = {
  selectedISO: string | null;
  onSelect: (iso: string) => void;
  /** Dates before this month are out of range; defaults to the current month. */
  today?: Date;
};

const toISO = (date: Date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;

/** Sunday-first month grid with unavailable days muted (PO-26 / PO-48). */
export function CalendarPicker({ selectedISO, onSelect, today: providedToday }: Props) {
  const today = useMemo(() => providedToday ?? new Date(), [providedToday]);
  const [month, setMonth] = useState(() => new Date(today.getFullYear(), today.getMonth(), 1));

  const earliest = new Date(today.getFullYear(), today.getMonth(), 1);
  const latest = new Date(today.getFullYear(), today.getMonth() + MAX_MONTHS_AHEAD, 1);
  const canGoBack = month > earliest;
  const canGoForward = month < latest;

  const cells = useMemo(() => {
    const year = month.getFullYear();
    const monthIndex = month.getMonth();
    const firstWeekday = new Date(year, monthIndex, 1).getDay();
    const daysInMonth = new Date(year, monthIndex + 1, 0).getDate();
    return [
      ...Array.from({ length: firstWeekday }, () => null),
      ...Array.from({ length: daysInMonth }, (_, index) => new Date(year, monthIndex, index + 1)),
    ];
  }, [month]);

  return (
    <View style={styles.wrapper}>
      <View style={styles.monthRow}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Previous month"
          disabled={!canGoBack}
          onPress={() => setMonth((current) => new Date(current.getFullYear(), current.getMonth() - 1, 1))}
          hitSlop={10}
          style={!canGoBack && styles.disabled}
        >
          <Ionicons name="chevron-back" size={22} color={colors.text.brand} />
        </Pressable>
        <AppText variant="cardTitle" color={colors.text.brand}>
          {bookingService.monthLabel(month)}
        </AppText>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Next month"
          disabled={!canGoForward}
          onPress={() => setMonth((current) => new Date(current.getFullYear(), current.getMonth() + 1, 1))}
          hitSlop={10}
          style={!canGoForward && styles.disabled}
        >
          <Ionicons name="chevron-forward" size={22} color={colors.text.brand} />
        </Pressable>
      </View>

      <View style={styles.grid}>
        {WEEKDAYS.map((day, index) => (
          <View key={`${day}-${index}`} style={styles.cell}>
            <AppText variant="badge" color={colors.text.secondary}>
              {day}
            </AppText>
          </View>
        ))}

        {cells.map((date, index) => {
          if (!date) return <View key={`blank-${index}`} style={styles.cell} />;
          const iso = toISO(date);
          const available = bookingService.isDateAvailable(date, today);
          const selected = selectedISO === iso;

          return (
            <Pressable
              key={iso}
              disabled={!available}
              accessibilityRole="button"
              accessibilityLabel={bookingService.formatLongDate(iso)}
              accessibilityState={{ disabled: !available, selected }}
              onPress={() => onSelect(iso)}
              style={styles.cell}
            >
              <View style={[styles.day, selected && styles.daySelected]}>
                <AppText
                  variant="body"
                  color={selected ? colors.text.inverse : available ? colors.text.primary : colors.text.subtle}
                  style={selected ? styles.daySelectedText : undefined}
                >
                  {date.getDate()}
                </AppText>
              </View>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { gap: spacing.sm },
  monthRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.sm,
  },
  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  cell: { width: `${100 / 7}%`, aspectRatio: 1, alignItems: 'center', justifyContent: 'center' },
  day: { width: 34, height: 34, borderRadius: radii.pill, alignItems: 'center', justifyContent: 'center' },
  daySelected: { backgroundColor: colors.brand.primary },
  daySelectedText: { fontFamily: 'Inter_600SemiBold' },
  disabled: { opacity: 0.3 },
});
