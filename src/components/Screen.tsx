import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, spacing } from '../theme';

type Props = {
  children: React.ReactNode;
  scroll?: boolean;
  padded?: boolean;
  contentStyle?: StyleProp<ViewStyle>;
  style?: StyleProp<ViewStyle>;
  keyboard?: boolean;
  footer?: React.ReactNode;
  /** Lets a screen scroll its own content, e.g. a chat following the newest message. */
  scrollRef?: React.RefObject<React.ComponentRef<typeof ScrollView> | null>;
  onContentSizeChange?: () => void;
};

/** White screen shell with safe areas, scrolling and keyboard avoidance. */
export function Screen({
  children,
  scroll = true,
  padded = true,
  contentStyle,
  style,
  keyboard = false,
  footer,
  scrollRef,
  onContentSizeChange,
}: Props) {
  const body = scroll ? (
    <ScrollView
      ref={scrollRef}
      onContentSizeChange={onContentSizeChange}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
      contentContainerStyle={[padded && styles.padded, styles.scrollContent, contentStyle]}
    >
      {children}
    </ScrollView>
  ) : (
    <View style={[styles.fill, padded && styles.padded, contentStyle]}>{children}</View>
  );

  return (
    <SafeAreaView style={[styles.safe, style]} edges={['top', 'left', 'right']}>
      {keyboard ? (
        <KeyboardAvoidingView
          style={styles.fill}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          keyboardVerticalOffset={Platform.OS === 'ios' ? 8 : 0}
        >
          {body}
        </KeyboardAvoidingView>
      ) : (
        body
      )}
      {footer ? <View style={styles.footer}>{footer}</View> : null}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.surface.background },
  fill: { flex: 1 },
  scrollContent: { flexGrow: 1, gap: spacing.md },
  padded: { paddingHorizontal: spacing.gutter },
  footer: {
    paddingHorizontal: spacing.gutter,
    paddingTop: spacing.md,
    paddingBottom: spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.surface.border,
    backgroundColor: colors.surface.background,
  },
});
