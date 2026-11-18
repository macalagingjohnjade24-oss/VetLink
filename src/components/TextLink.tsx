import { Pressable, StyleSheet, type StyleProp, type ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing } from '../theme';
import { AppText } from './AppText';

type Props = {
  label: string;
  onPress?: () => void;
  icon?: keyof typeof Ionicons.glyphMap;
  tone?: 'brand' | 'danger';
  disabled?: boolean;
  /** 'center' for page footers; inline links sit at the start of their row. */
  align?: 'start' | 'center';
  style?: StyleProp<ViewStyle>;
};

/**
 * Plain brand-coloured text for links that read as part of the page copy —
 * "View all", "Forgot Password?". Boxed actions use `LinkButton` instead.
 */
export function TextLink({ label, onPress, icon, tone = 'brand', disabled, align = 'start', style }: Props) {
  const fg = disabled ? colors.text.subtle : tone === 'danger' ? colors.status.danger : colors.text.brand;

  return (
    <Pressable
      accessibilityRole="link"
      accessibilityState={{ disabled: !!disabled }}
      disabled={disabled}
      onPress={onPress}
      hitSlop={8}
      style={({ pressed }) => [
        styles.base,
        align === 'center' ? styles.center : styles.start,
        pressed && styles.pressed,
        style,
      ]}
    >
      {icon ? <Ionicons name={icon} size={16} color={fg} /> : null}
      <AppText variant="link" color={fg}>
        {label}
      </AppText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: spacing.xs },
  start: { alignSelf: 'flex-start' },
  center: { alignSelf: 'center' },
  pressed: { opacity: 0.6 },
});
