import { Pressable, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, radii, spacing } from '../theme';
import { AppText } from './AppText';

type Props = {
  label: string;
  onPress?: () => void;
  icon?: keyof typeof Ionicons.glyphMap;
  tone?: 'brand' | 'danger';
  disabled?: boolean;
  /** False for inline rows, where the button hugs its label instead of filling the line. */
  fullWidth?: boolean;
};

/**
 * Outlined secondary action: same shape as `Button`, but tinted and lighter so
 * the screen's primary CTA still leads. Use it wherever an action would
 * otherwise be a line of plain text.
 */
export function LinkButton({ label, onPress, icon, tone = 'brand', disabled, fullWidth = true }: Props) {
  const fg = tone === 'danger' ? colors.status.danger : colors.text.brand;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: !!disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.base,
        fullWidth ? styles.full : styles.hug,
        {
          backgroundColor: tone === 'danger' ? colors.status.dangerBg : colors.surface.tint,
          borderColor: tone === 'danger' ? 'transparent' : colors.brand.peach,
        },
        disabled && styles.disabled,
        pressed && styles.pressed,
      ]}
    >
      {icon ? <Ionicons name={icon} size={18} color={fg} /> : null}
      <AppText variant="cardTitle" color={fg} style={styles.label}>
        {label}
      </AppText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    borderRadius: radii.button,
    borderWidth: 1,
  },
  full: { minHeight: 48 },
  hug: { alignSelf: 'flex-start', minHeight: 44, paddingHorizontal: spacing.sm },
  label: { flexShrink: 1, textAlign: 'center' },
  disabled: { opacity: 0.5 },
  pressed: { opacity: 0.85 },
});
