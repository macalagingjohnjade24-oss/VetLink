import { Pressable, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing } from '../theme';
import { AppText } from './AppText';

type Props = {
  label: string;
  onPress: () => void;
  icon?: keyof typeof Ionicons.glyphMap;
  disabled?: boolean;
  /** Centres the link in page footers; inline links sit at the start of their row. */
  align?: 'start' | 'center';
};

/**
 * Plain brand-coloured text for links that read as part of the page copy —
 * "View all", "Forgot Password?". Boxed actions use `LinkButton` instead.
 */
export function TextLink({ label, onPress, icon, disabled, align = 'start' }: Props) {
  const fg = disabled ? colors.text.subtle : colors.text.brand;

  return (
    <Pressable
      accessibilityRole="link"
      accessibilityState={{ disabled: !!disabled }}
      disabled={disabled}
      onPress={onPress}
      hitSlop={8}
      style={({ pressed }) => [styles.base, align === 'center' && styles.center, pressed && styles.pressed]}
    >
      {icon ? <Ionicons name={icon} size={16} color={fg} /> : null}
      <AppText variant="link" color={fg}>
        {label}
      </AppText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: { flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start', gap: 6, paddingVertical: spacing.xs },
  center: { alignSelf: 'center' },
  pressed: { opacity: 0.6 },
});
