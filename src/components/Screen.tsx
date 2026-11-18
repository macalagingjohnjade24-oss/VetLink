import { createContext, useCallback, useContext, useEffect, useRef, type ComponentRef } from 'react';
import { Keyboard, ScrollView, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../context/AuthContext';
import { FieldFocusContext, type FieldRef } from '../hooks/fieldFocus';
import { useKeyboardInset } from '../hooks/useKeyboardInset';
import { navigationRef } from '../navigation/navigationRef';
import { colors, spacing } from '../theme';
import { AppText } from './AppText';
import { TextLink } from './TextLink';

type Props = {
  children: React.ReactNode;
  scroll?: boolean;
  padded?: boolean;
  contentStyle?: StyleProp<ViewStyle>;
  style?: StyleProp<ViewStyle>;
  footer?: React.ReactNode;
  /** Lets a screen scroll its own content, e.g. a chat following the newest message. */
  scrollRef?: React.RefObject<React.ComponentRef<typeof ScrollView> | null>;
  onContentSizeChange?: () => void;
};

const ReserveBottomContext = createContext(true);

/**
 * Always-on reminder that the data on screen is sample data. Rendered by every
 * `Screen`, so offline mode can never be mistaken for a real account.
 */
function OfflineBanner() {
  const { offline, exitOfflineMode } = useAuth();
  if (!offline) return null;

  const exit = () => {
    void exitOfflineMode().then(() => {
      if (navigationRef.isReady()) navigationRef.reset({ index: 0, routes: [{ name: 'Login' }] });
    });
  };

  return (
    <View style={styles.offlineBar}>
      <Ionicons name="cloud-offline-outline" size={16} color={colors.status.warning} />
      <AppText variant="small" color={colors.status.warning} style={styles.offlineText}>
        Offline mode · sample data only. Nothing is sent to a clinic.
      </AppText>
      <TextLink label="Exit" onPress={exit} />
    </View>
  );
}

/**
 * Opts a subtree out of reserving the bottom safe area. Only the tab navigator
 * does this: its screens sit above the tab bar, which already clears the system
 * bar, so reserving the inset again would only add a second gap.
 */
export function WithoutBottomInset({ children }: { children: React.ReactNode }) {
  return <ReserveBottomContext.Provider value={false}>{children}</ReserveBottomContext.Provider>;
}

/**
 * White screen shell with safe areas, scrolling and keyboard handling.
 *
 * While the keyboard is open the scroll content is padded by exactly the part
 * of the screen it covers, and any text field that reports focus through
 * `FieldFocusContext` is scrolled above it. Both numbers are measured, so this
 * works whether Android resizes the window or not.
 */
export function Screen({
  children,
  scroll = true,
  padded = true,
  contentStyle,
  style,
  footer,
  scrollRef,
  onContentSizeChange,
}: Props) {
  const reserveBottom = useContext(ReserveBottomContext);
  const innerRef = useRef<ComponentRef<typeof ScrollView>>(null);
  const ref = scrollRef ?? innerRef;
  const offsetY = useRef(0);
  const keyboardTopRef = useRef<number | null>(null);
  const pendingField = useRef<FieldRef | null>(null);

  const reveal = useCallback(
    (field: FieldRef | null, top: number | null = keyboardTopRef.current) => {
      const node = field?.current;
      const view = ref.current;
      if (!node || !view) return;
      node.measureInWindow((_x, y, _width, height) => {
        view.measureInWindow((_viewX, viewY, _viewWidth, viewHeight) => {
          const visibleBottom = top == null ? viewY + viewHeight : Math.min(viewY + viewHeight, top);
          const overflow = y + height + 16 - visibleBottom;
          if (overflow > 0) view.scrollTo({ y: Math.max(0, offsetY.current + overflow), animated: true });
        });
      });
    },
    [ref],
  );

  const { inset, keyboardTop } = useKeyboardInset(ref, {
    onShow: (top) => {
      keyboardTopRef.current = top;
      reveal(pendingField.current, top);
    },
  });

  useEffect(() => {
    keyboardTopRef.current = keyboardTop;
  }, [keyboardTop]);

  const reportFocus = useCallback(
    (field: FieldRef) => {
      pendingField.current = field;
      // When the keyboard is not up yet, its show event scrolls the field.
      if (!Keyboard.isVisible()) return;
      reveal(field);
      setTimeout(() => reveal(field), 150);
    },
    [reveal],
  );

  const body = scroll ? (
    <ScrollView
      ref={ref}
      onScroll={(event) => {
        offsetY.current = event.nativeEvent.contentOffset.y;
      }}
      scrollEventThrottle={32}
      onContentSizeChange={onContentSizeChange}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
      contentContainerStyle={[
        padded && styles.padded,
        styles.scrollContent,
        contentStyle,
        inset > 0 && { paddingBottom: inset },
      ]}
    >
      {children}
    </ScrollView>
  ) : (
    <View style={[styles.fill, padded && styles.padded, contentStyle]}>{children}</View>
  );

  return (
    <SafeAreaView
      style={[styles.safe, style]}
      edges={reserveBottom ? ['top', 'left', 'right', 'bottom'] : ['top', 'left', 'right']}
    >
      <OfflineBanner />
      {scroll ? <FieldFocusContext.Provider value={reportFocus}>{body}</FieldFocusContext.Provider> : body}
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
  offlineBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.gutter,
    paddingVertical: spacing.sm,
    backgroundColor: colors.status.warningBg,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.surface.border,
  },
  offlineText: { flex: 1 },
});
