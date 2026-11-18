import { useMemo, useRef } from 'react';
import { Image, PanResponder, StyleSheet, View, type ImageSourcePropType } from 'react-native';
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
  /** Swipe left to open the next slide. Omit it on the last slide. */
  onSwipeNext?: () => void;
  /** Swipe right to go back to the previous slide. Omit it on the first slide. */
  onSwipePrev?: () => void;
};

/** A horizontal drag long enough to count as a swipe, measured in points. */
const SWIPE_DISTANCE = 48;
/** A quick flick counts even when it travels less than SWIPE_DISTANCE. */
const SWIPE_VELOCITY = 0.4;

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
  onSwipeNext,
  onSwipePrev,
}: Props) {
  // The handlers live in a ref so the responder below is created once and still
  // calls the current screen's navigation callbacks.
  const swipeHandlers = useRef({ onSwipeNext, onSwipePrev });
  swipeHandlers.current = { onSwipeNext, onSwipePrev };

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        // Only take over gestures that are clearly horizontal, so the vertical
        // scroll and the buttons keep working normally.
        onMoveShouldSetPanResponder: (_event, gesture) =>
          Math.abs(gesture.dx) > 16 && Math.abs(gesture.dx) > Math.abs(gesture.dy) * 1.5,
        onPanResponderRelease: (_event, gesture) => {
          if (gesture.dx <= -SWIPE_DISTANCE || gesture.vx <= -SWIPE_VELOCITY) {
            swipeHandlers.current.onSwipeNext?.();
          } else if (gesture.dx >= SWIPE_DISTANCE || gesture.vx >= SWIPE_VELOCITY) {
            swipeHandlers.current.onSwipePrev?.();
          }
        },
      }),
    [],
  );

  return (
    <View style={styles.flex} {...panResponder.panHandlers}>
      <Screen safeBottom contentStyle={styles.content}>
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
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
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
