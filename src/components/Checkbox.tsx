import { Pressable, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, radii, spacing } from '../theme';
import { AppText } from './AppText';

type Props = {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label?: string;
  error?: boolean;
};

export function Checkbox({ checked, onChange, label, error }: Props) {
  return (
    <Pressable
      accessibilityRole="checkbox"
      accessibilityState={{ checked }}
      onPress={() => onChange(!checked)}
      style={styles.row}
      hitSlop={6}
    >
      <View style={[styles.box, checked && styles.boxChecked, error && styles.boxError]}>
        {checked ? <Ionicons name="checkmark" size={16} color={colors.text.inverse} /> : null}
      </View>
      {label ? (
        <AppText variant="bodyStrong" style={styles.label}>
          {label}
        </AppText>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  box: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: colors.brand.primary,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface.card,
  },
  boxChecked: { backgroundColor: colors.brand.primary },
  boxError: { borderColor: colors.status.danger },
  label: { flexShrink: 1 },
});
