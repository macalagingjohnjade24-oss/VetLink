import { StyleSheet, View } from 'react-native';
import { spacing } from '../theme';
import { AppText } from './AppText';
import { LinkButton } from './LinkButton';

type Props = {
  title: string;
  actionLabel?: string;
  onAction?: () => void;
};

/** Section heading with an optional "View all" style action. */
export function SectionHeader({ title, actionLabel, onAction }: Props) {
  return (
    <View style={styles.row}>
      <AppText variant="title">{title}</AppText>
      {actionLabel && onAction ? (
        <LinkButton label={actionLabel} fullWidth={false} onPress={onAction} />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: spacing.lg,
    marginBottom: spacing.sm,
  },
});
