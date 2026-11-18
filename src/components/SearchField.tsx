import { useRef, type ComponentRef } from 'react';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFieldFocus } from '../hooks/fieldFocus';
import { colors, fontFamily, radii, spacing } from '../theme';

type Props = {
  value: string;
  onChangeText: (value: string) => void;
  placeholder?: string;
  autoFocus?: boolean;
  onSubmit?: () => void;
};

/** Search input matching the Figma 350x52 field with a leading icon. */
export function SearchField({ value, onChangeText, placeholder, autoFocus, onSubmit }: Props) {
  const fieldRef = useRef<ComponentRef<typeof View>>(null);
  const reportFocus = useFieldFocus();

  return (
    <View ref={fieldRef} style={styles.field}>
      <Ionicons name="search-outline" size={18} color={colors.text.secondary} />
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.text.subtle}
        autoFocus={autoFocus}
        onFocus={() => reportFocus?.(fieldRef)}
        returnKeyType="search"
        onSubmitEditing={onSubmit}
        accessibilityLabel="Search VetLink"
        style={styles.input}
      />
      {value.length > 0 ? (
        <Pressable onPress={() => onChangeText('')} hitSlop={10} accessibilityLabel="Clear search">
          <Ionicons name="close-circle" size={18} color={colors.text.subtle} />
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
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
  input: {
    flex: 1,
    fontFamily: fontFamily.regular,
    fontSize: 14,
    color: colors.text.primary,
    paddingVertical: 0,
  },
});
