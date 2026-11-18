import { Pressable, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing } from '../theme';
import { AppText } from './AppText';

type Props = {
  label: string;
  selected: boolean;
  onPress: () => void;
  mode?: 'radio' | 'checkbox';
};

export function ChoiceRow({ label, selected, onPress, mode = 'checkbox' }: Props) {
  return (
    <Pressable accessibilityRole={mode === 'radio' ? 'radio' : 'checkbox'} accessibilityState={{ checked: selected }} onPress={onPress} style={styles.row}>
      <View style={[styles.box, mode === 'radio' && styles.radio, selected && styles.selected]}>
        {selected ? (
          mode === 'radio' ? (
            <View style={styles.dot} />
          ) : (
            <Ionicons name="checkmark" size={14} color={colors.text.inverse} />
          )
        ) : null}
      </View>
      <AppText variant="body" style={styles.label}>
        {label}
      </AppText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingVertical: 5 },
  box: {
    width: 20,
    height: 20,
    borderRadius: 5,
    borderWidth: 1.5,
    borderColor: colors.brand.primary,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface.card,
  },
  radio: { borderRadius: 10 },
  selected: { backgroundColor: colors.brand.primary },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.surface.card },
  label: { flexShrink: 1 },
});
