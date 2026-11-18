import type { ReactNode } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, radii, spacing } from '../theme';
import { AppText } from './AppText';

export type ButtonVariant = 'primary' | 'secondary' | 'peach' | 'ghost';
type Props = {
  label: string;
  onPress?: () => void;
  variant?: ButtonVariant;
  size?: 'md' | 'sm';
  icon?: keyof typeof Ionicons.glyphMap;
  /** Custom leading graphic (e.g. a multicolour brand mark) instead of an Ionicons glyph. */
  iconNode?: ReactNode;
  iconRight?: boolean;
  disabled?: boolean;
  loading?: boolean;
  fullWidth?: boolean;
  style?: StyleProp<ViewStyle>;
};

/** Primary/secondary/peach/ghost action matching the Figma button component (350x52, radius 14). */
export function Button({
  label,
  onPress,
  variant = 'primary',
  size = 'md',
  icon,
  iconNode,
  iconRight,
  disabled,
  loading,
  fullWidth = true,
  style,
}: Props) {
  const isDisabled = disabled || loading;
  const palette = {
    primary: { bg: colors.brand.primary, pressed: colors.brand.primaryPressed, border: 'transparent', text: colors.text.inverse },
    secondary: { bg: colors.surface.card, pressed: colors.surface.tint, border: colors.brand.primary, text: colors.text.brand },
    peach: { bg: colors.brand.peach, pressed: colors.brand.peachPressed, border: 'transparent', text: colors.text.brand },
    ghost: { bg: 'transparent', pressed: colors.surface.tint, border: 'transparent', text: colors.text.brand },
  }[variant];

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: !!isDisabled, busy: !!loading }}
      onPress={isDisabled ? undefined : onPress}
      android_ripple={{ color: 'rgba(255,255,255,0.18)' }}
      style={({ pressed }) => [
        styles.base,
        size === 'sm' ? styles.sm : styles.md,
        {
          backgroundColor: isDisabled ? colors.surface.disabled : pressed ? palette.pressed : palette.bg,
          borderColor: variant === 'secondary' ? palette.border : 'transparent',
          borderWidth: variant === 'secondary' ? 1.5 : 0,
          opacity: isDisabled && !loading ? 0.6 : 1,
        },
        !fullWidth && styles.auto,
        style,
      ]}
    >
      <View style={styles.content}>
        {loading ? (
          <ActivityIndicator color={palette.text} size="small" />
        ) : !iconRight ? (
          iconNode ?? (icon ? <Ionicons name={icon} size={18} color={isDisabled ? colors.text.secondary : palette.text} /> : null)
        ) : null}
        <AppText
          variant="cardTitle"
          style={{ color: isDisabled ? colors.text.secondary : palette.text }}
        >
          {label}
        </AppText>
        {iconRight && icon && !loading ? (
          <Ionicons name={icon} size={18} color={isDisabled ? colors.text.secondary : palette.text} />
        ) : null}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radii.button,
    paddingHorizontal: spacing.lg,
  },
  md: { minHeight: 52 },
  sm: { minHeight: 44 },
  auto: { alignSelf: 'flex-start' },
  content: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
});
