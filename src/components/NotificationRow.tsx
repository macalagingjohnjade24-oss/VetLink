import { Pressable, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { AppNotification } from '../data/mockNotifications';
import { colors, radii, spacing } from '../theme';
import { AppText } from './AppText';

const icons: Record<AppNotification['category'], keyof typeof Ionicons.glyphMap> = {
  appointments: 'calendar-outline',
  health: 'medkit-outline',
  general: 'megaphone-outline',
};

export function NotificationRow({ notification, onPress }: { notification: AppNotification; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${notification.title}${notification.read ? '' : ', unread'}`}
      onPress={onPress}
      style={({ pressed }) => [styles.row, pressed && styles.pressed]}
    >
      <View style={[styles.icon, !notification.read && styles.iconUnread]}>
        <Ionicons name={icons[notification.category]} size={18} color={colors.brand.primary} />
      </View>
      <View style={styles.body}>
        <View style={styles.titleRow}>
          {!notification.read ? <View style={styles.dot} /> : null}
          <AppText variant="cardTitle" numberOfLines={1} style={styles.title}>
            {notification.title}
          </AppText>
        </View>
        <AppText variant="caption" numberOfLines={1}>
          {notification.meta}
        </AppText>
      </View>
      <AppText variant="small">{notification.timeLabel}</AppText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.sm,
    borderRadius: radii.card,
  },
  pressed: { backgroundColor: colors.surface.subtle },
  icon: {
    width: 36,
    height: 36,
    borderRadius: radii.pill,
    backgroundColor: colors.surface.subtle,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconUnread: { backgroundColor: colors.surface.tint },
  body: { flex: 1, gap: 2 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  title: { flexShrink: 1 },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: colors.brand.primary },
});
