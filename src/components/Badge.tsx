import { StyleSheet, View } from 'react-native';
import { radii, spacing } from '../theme';
import { colors } from '../theme';
import { AppText } from './AppText';

export type BadgeTone = 'success' | 'warning' | 'danger' | 'info' | 'neutral' | 'brand' | 'peach';

const tones: Record<BadgeTone, { bg: string; fg: string }> = {
  success: { bg: colors.status.successBg, fg: colors.status.success },
  warning: { bg: colors.status.warningBg, fg: colors.status.warning },
  danger: { bg: colors.status.dangerBg, fg: colors.status.danger },
  info: { bg: colors.status.infoBg, fg: colors.status.info },
  neutral: { bg: colors.status.neutralBg, fg: colors.status.neutral },
  brand: { bg: colors.surface.tint, fg: colors.text.brand },
  peach: { bg: colors.brand.peach, fg: colors.text.brand },
};

export function Badge({ label, tone = 'neutral' }: { label: string; tone?: BadgeTone }) {
  const palette = tones[tone];
  return (
    <View style={[styles.badge, { backgroundColor: palette.bg }]}>
      <AppText variant="badge" color={palette.fg}>
        {label}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
    borderRadius: radii.pill,
    alignSelf: 'flex-start',
  },
});
