import { Image, StyleSheet, View, type ImageSourcePropType } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, radii, spacing } from '../../theme';
import { AppText } from '../../components/AppText';
import { Button } from '../../components/Button';
import { Logo } from '../../components/Logo';
import { Screen } from '../../components/Screen';

type Props = {
  image: ImageSourcePropType;
  page: number;
  pageCount?: number;
  heading: string;
  body: string;
  primaryLabel: string;
  onPrimary: () => void;
  secondaryLabel: string;
  onSecondary: () => void;
  secondaryVariant?: 'link' | 'outline';
};

/** Shared onboarding slide layout, matching the 390x844 Figma onboarding frames. */
export function OnboardingLayout({
  image,
  page,
  pageCount = 4,
  heading,
  body,
  primaryLabel,
  onPrimary,
  secondaryLabel,
  onSecondary,
  secondaryVariant = 'link',
}: Props) {
  // `Screen` reserves the top, left and right safe areas only, so the slide has
  // to keep its own gap above the home indicator / system navigation bar.
  const { bottom } = useSafeAreaInsets();

  return (
    <Screen contentStyle={[styles.content, { paddingBottom: spacing.xxl + bottom }]}>
      <View style={styles.logoRow}>
        <Logo size="md" />
      </View>

      <Image source={image} style={styles.image} resizeMode="cover" />

      <View style={styles.dots} accessibilityLabel={`Step ${page} of ${pageCount}`}>
        {Array.from({ length: pageCount }).map((_, index) => (
          <View key={index} style={[styles.dot, index === page - 1 && styles.dotActive]} />
        ))}
      </View>

      <AppText variant="display" style={styles.heading}>
        {heading}
      </AppText>
      <AppText variant="body" color={colors.text.secondary} style={styles.body}>
        {body}
      </AppText>

      <View style={styles.actions}>
        <Button label={primaryLabel} onPress={onPrimary} />
        {secondaryVariant === 'outline' ? (
          <Button label={secondaryLabel} variant="secondary" onPress={onSecondary} style={styles.secondary} />
        ) : (
          <Button label={secondaryLabel} variant="ghost" onPress={onSecondary} style={styles.secondary} />
        )}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { gap: 0, paddingBottom: spacing.xxl },
  logoRow: { paddingTop: spacing.sm, paddingBottom: spacing.lg },
  image: {
    width: '100%',
    height: 280,
    borderRadius: radii.card,
    backgroundColor: colors.surface.subtle,
  },
  dots: { flexDirection: 'row', gap: 6, marginTop: spacing.lg },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.brand.peach },
  dotActive: { width: 22, backgroundColor: colors.brand.primary },
  heading: { marginTop: spacing.md },
  body: { marginTop: spacing.md },
  actions: { marginTop: spacing.xxxl, gap: spacing.sm },
  secondary: { marginTop: spacing.xs },
});
