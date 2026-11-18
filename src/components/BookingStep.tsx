import { StyleSheet, View } from 'react-native';
import { colors, spacing } from '../theme';
import { AppText } from './AppText';

type Props = { step: number; total?: number; reversed?: boolean };

/** "BOOK A VISIT · 2 OF 7" step marker used at the top of every booking screen. */
export function BookingStep({ step, total = 7, reversed = false }: Props) {
  return (
    <View style={[styles.row, reversed && styles.reversed]}>
      <>
        <AppText variant="badge" color={colors.text.brand} style={styles.label}>
          BOOK A VISIT
        </AppText>
        <AppText variant="badge" color={colors.text.brand} style={styles.label}>
          ·
        </AppText>
        <AppText variant="badge" color={colors.text.brand} style={styles.label}>
          {step} OF {total}
        </AppText>
      </>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm - 2 },
  reversed: { flexDirection: 'row-reverse', justifyContent: 'flex-end' },
  label: { letterSpacing: 0.6 },
});
