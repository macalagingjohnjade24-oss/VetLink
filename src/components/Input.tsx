import { useRef, useState, type ComponentRef } from 'react';
import {
  Pressable,
  StyleSheet,
  TextInput,
  View,
  type StyleProp,
  type TextInputProps,
  type ViewStyle,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFieldFocus } from '../hooks/fieldFocus';
import { colors, fontFamily, radii, spacing } from '../theme';
import { AppText } from './AppText';

type Props = TextInputProps & {
  label?: string;
  error?: string | null;
  helper?: string;
  containerStyle?: StyleProp<ViewStyle>;
};

/** Text field matching the Figma input: 52px tall, 10px radius, #E2E8F0 border. */
export function Input({ label, error, helper, containerStyle, style, secureTextEntry, multiline, ...rest }: Props) {
  const [focused, setFocused] = useState(false);
  const [revealed, setRevealed] = useState(false);
  const wrapperRef = useRef<ComponentRef<typeof View>>(null);
  const reportFocus = useFieldFocus();
  const isPassword = !!secureTextEntry;

  return (
    <View ref={wrapperRef} style={[styles.wrapper, containerStyle]}>
      {label ? (
        <AppText variant="label" style={styles.label}>
          {label}
        </AppText>
      ) : null}
      <View
        style={[
          styles.field,
          multiline && styles.multilineField,
          focused && styles.fieldFocused,
          !!error && styles.fieldError,
        ]}
      >
        <TextInput
          {...rest}
          multiline={multiline}
          secureTextEntry={isPassword && !revealed}
          placeholderTextColor={colors.text.subtle}
          onFocus={(e) => {
            setFocused(true);
            reportFocus?.(wrapperRef);
            rest.onFocus?.(e);
          }}
          onBlur={(e) => {
            setFocused(false);
            rest.onBlur?.(e);
          }}
          style={[styles.input, multiline && styles.multilineInput, style]}
        />
        {isPassword ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={revealed ? 'Hide password' : 'Show password'}
            onPress={() => setRevealed((v) => !v)}
            hitSlop={10}
          >
            <Ionicons name={revealed ? 'eye-off-outline' : 'eye-outline'} size={20} color={colors.text.secondary} />
          </Pressable>
        ) : null}
      </View>
      {error ? (
        <AppText variant="caption" color={colors.status.danger} style={styles.message}>
          {error}
        </AppText>
      ) : helper ? (
        <AppText variant="caption" style={styles.message}>
          {helper}
        </AppText>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { gap: spacing.xs + 2 },
  label: { marginLeft: 2 },
  field: {
    minHeight: 52,
    borderRadius: radii.input,
    borderWidth: 1,
    borderColor: colors.surface.border,
    backgroundColor: colors.surface.card,
    paddingHorizontal: spacing.lg - 2,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  multilineField: { alignItems: 'flex-start', paddingVertical: spacing.md, minHeight: 96 },
  fieldFocused: { borderColor: colors.brand.primary },
  fieldError: { borderColor: colors.status.danger },
  input: {
    flex: 1,
    fontFamily: fontFamily.regular,
    fontSize: 14,
    lineHeight: 20,
    color: colors.text.primary,
    paddingVertical: 0,
  },
  multilineInput: { minHeight: 72, textAlignVertical: 'top' },
  message: { marginLeft: 2 },
});
