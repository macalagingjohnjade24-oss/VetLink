import { useRef, type ComponentRef } from 'react';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';
import { useFieldFocus } from '../hooks/fieldFocus';
import { colors, fontFamily, radii, spacing } from '../theme';

type Props = {
  value: string;
  onChange: (value: string) => void;
  length?: number;
  error?: boolean;
};

/** Six-digit code entry, styled like the Figma verification card. */
export function CodeInput({ value, onChange, length = 6, error }: Props) {
  const inputs = useRef<Array<ComponentRef<typeof TextInput> | null>>([]);
  const containerRef = useRef<ComponentRef<typeof View>>(null);
  const reportFocus = useFieldFocus();
  const digits = value.padEnd(length, ' ').slice(0, length).split('');

  const setDigit = (index: number, digit: string) => {
    const next = value.split('');
    next[index] = digit;
    onChange(next.join('').replace(/\s/g, '').slice(0, length));
    if (digit && index < length - 1) inputs.current[index + 1]?.focus();
  };

  return (
    <View ref={containerRef} style={[styles.container, error && styles.containerError]}>
      {digits.map((digit, index) => (
        <Pressable key={index} onPress={() => inputs.current[index]?.focus()} style={styles.cell}>
          <TextInput
            ref={(ref) => {
              inputs.current[index] = ref;
            }}
            value={digit.trim()}
            onChangeText={(text) => {
              const digitsOnly = text.replace(/\D/g, '');
              if (digitsOnly.length > 1) {
                // Pasting a full code fills the remaining boxes.
                const next = value.padEnd(length, ' ').split('');
                digitsOnly
                  .slice(0, length - index)
                  .split('')
                  .forEach((digit, offset) => {
                    next[index + offset] = digit;
                  });
                onChange(next.join('').replace(/\s/g, '').slice(0, length));
                inputs.current[Math.min(index + digitsOnly.length, length - 1)]?.focus();
                return;
              }
              setDigit(index, digitsOnly.slice(-1));
            }}
            onKeyPress={(event) => {
              if (event.nativeEvent.key === 'Backspace' && !digit.trim() && index > 0) {
                inputs.current[index - 1]?.focus();
              }
            }}
            onFocus={() => reportFocus?.(containerRef)}
            keyboardType="number-pad"
            maxLength={1}
            style={styles.input}
            textAlign="center"
            accessibilityLabel={`Digit ${index + 1}`}
          />
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderRadius: radii.card,
    borderWidth: 1,
    borderColor: colors.surface.border,
    backgroundColor: colors.surface.card,
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.md,
    gap: spacing.xs,
  },
  containerError: { borderColor: colors.status.danger },
  cell: { flex: 1, alignItems: 'center' },
  input: {
    width: '100%',
    fontFamily: fontFamily.semibold,
    fontSize: 28,
    lineHeight: 40,
    color: colors.text.brand,
    padding: 0,
  },
});
