import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, radii, spacing } from '../theme';
import { AppText } from './AppText';
import { Button } from './Button';

export function LoadingState({ label = 'Loading…' }: { label?: string }) {
  return (
    <View style={styles.center}>
      <ActivityIndicator color={colors.brand.primary} />
      <AppText variant="caption">{label}</AppText>
    </View>
  );
}

type EmptyProps = {
  icon?: keyof typeof Ionicons.glyphMap;
  title: string;
  message?: string;
  actionLabel?: string;
  onAction?: () => void;
};

type ErrorProps = {
  title?: string;
  message: string;
  onRetry?: () => void;
  retryLabel?: string;
};

/** Shown in place of data when a query fails, with a way to try again. */
export function ErrorState({
  title = 'We couldn’t load this',
  message,
  onRetry,
  retryLabel = 'Try again',
}: ErrorProps) {
  return (
    <View style={styles.center}>
      <View style={[styles.iconWrap, styles.errorIconWrap]}>
        <Ionicons name="alert-circle-outline" size={26} color={colors.status.danger} />
      </View>
      <AppText variant="cardTitle" center>
        {title}
      </AppText>
      <AppText variant="caption" center>
        {message}
      </AppText>
      {onRetry ? <Button label={retryLabel} onPress={onRetry} size="sm" fullWidth={false} /> : null}
    </View>
  );
}

export function EmptyState({ icon = 'paw-outline', title, message, actionLabel, onAction }: EmptyProps) {
  return (
    <View style={styles.center}>
      <View style={styles.iconWrap}>
        <Ionicons name={icon} size={26} color={colors.brand.primary} />
      </View>
      <AppText variant="cardTitle" center>
        {title}
      </AppText>
      {message ? (
        <AppText variant="caption" center>
          {message}
        </AppText>
      ) : null}
      {actionLabel && onAction ? <Button label={actionLabel} onPress={onAction} size="sm" fullWidth={false} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  center: { alignItems: 'center', justifyContent: 'center', gap: spacing.sm, paddingVertical: spacing.xxl },
  iconWrap: {
    width: 56,
    height: 56,
    borderRadius: radii.pill,
    backgroundColor: colors.surface.tint,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.xs,
  },
  errorIconWrap: { backgroundColor: colors.status.dangerBg },
});
