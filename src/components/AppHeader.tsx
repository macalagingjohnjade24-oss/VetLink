import { Pressable, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { colors, spacing } from '../theme';
import { AppText } from './AppText';

type Props = {
  title?: string;
  showBack?: boolean;
  onBack?: () => void;
  right?: React.ReactNode;
};

/** Mobile header used across the design: back chevron + burgundy title. */
export function AppHeader({ title, showBack = true, onBack, right }: Props) {
  const navigation = useNavigation();

  return (
    <View style={styles.row}>
      {showBack ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Go back"
          hitSlop={8}
          onPress={() => (onBack ? onBack() : navigation.goBack())}
          style={styles.back}
        >
          <Ionicons name="chevron-back" size={24} color={colors.text.brand} />
        </Pressable>
      ) : (
        <View style={styles.back} />
      )}
      {title ? <AppText variant="screenTitle">{title}</AppText> : null}
      <View style={styles.spacer}>{right}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.lg,
    paddingVertical: spacing.md,
    minHeight: 44,
  },
  back: { width: 28, height: 28, alignItems: 'flex-start', justifyContent: 'center' },
  spacer: { flex: 1, alignItems: 'flex-end' },
});
