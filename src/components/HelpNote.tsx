import { StyleSheet, View } from 'react-native';
import { colors, radii, spacing } from '../theme';
import { AppText } from './AppText';

type Tone = 'brand' | 'success' | 'warning' | 'danger' | 'info';

const tones: Record<Tone, { bg: string; fg: string }> = {
  brand: { bg: colors.surface.tint, fg: colors.text.brand },
  success: { bg: colors.status.successBg, fg: colors.status.success },
  warning: { bg: colors.status.warningBg, fg: colors.status.warning },
  danger: { bg: colors.status.dangerBg, fg: colors.status.danger },
  info: { bg: colors.status.infoBg, fg: colors.status.info },
};

type Props = {
  children: React.ReactNode;
  tone?: Tone;
  title?: string;
};

/** Soft tinted information panel (the #FCF0EB note used throughout the Figma screens). */
export function HelpNote({ children, tone = 'brand', title }: Props) {
  const palette = tones[tone];
  return (
    <View style={[styles.note, { backgroundColor: palette.bg }]}>
      {title ? (
        <AppText variant="bodyStrong" color={palette.fg}>
          {title}
        </AppText>
      ) : null}
      <AppText variant="caption" color={palette.fg}>
        {children}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  note: { borderRadius: radii.card, padding: spacing.lg, gap: spacing.xs },
});
