import { Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, radii, shadows, spacing } from '../theme';
import { AppText } from './AppText';

type Props = {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  padded?: boolean;
  flat?: boolean;
};

export function Card({ children, style, padded = true, flat = false }: Props) {
  return <View style={[styles.card, padded && styles.padded, !flat && shadows.card, style]}>{children}</View>;
}

type RowProps = {
  label: string;
  value?: string;
  valueColor?: string;
  muted?: boolean;
};

/** Label/value row used by detail cards and summaries. */
export function DetailRow({ label, value, valueColor, muted }: RowProps) {
  return (
    <View style={styles.row}>
      <AppText variant="caption" style={styles.rowLabel}>
        {label}
      </AppText>
      <AppText variant="bodyStrong" color={valueColor ?? (muted ? colors.text.secondary : colors.text.primary)} style={styles.rowValue}>
        {value ?? '—'}
      </AppText>
    </View>
  );
}

type LinkCardProps = {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  caption: string;
  onPress: () => void;
};

/** Bordered card that opens another settings screen. */
export function LinkCard({ icon, title, caption, onPress }: LinkCardProps) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [styles.card, styles.padded, styles.linkCard, pressed && styles.linkCardPressed]}
    >
      <Ionicons name={icon} size={22} color={colors.text.brand} />
      <View style={styles.linkCardBody}>
        <AppText variant="cardTitle">{title}</AppText>
        <AppText variant="caption">{caption}</AppText>
      </View>
    </Pressable>
  );
}

export function SectionTitle({ title, action }: { title: string; action?: React.ReactNode }) {
  return (
    <View style={styles.sectionTitle}>
      <AppText variant="cardTitle">{title}</AppText>
      {action}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface.card,
    borderRadius: radii.card,
    borderWidth: 1,
    borderColor: colors.surface.border,
  },
  padded: { padding: spacing.lg },
  row: { flexDirection: 'row', justifyContent: 'space-between', gap: spacing.md, paddingVertical: 6 },
  rowLabel: { flexShrink: 1 },
  rowValue: { textAlign: 'right', flexShrink: 1 },
  sectionTitle: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: spacing.sm },
  linkCard: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.lg },
  linkCardPressed: { backgroundColor: colors.surface.subtle },
  linkCardBody: { flex: 1, gap: spacing.xs },
});
