import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { AppHeader } from '../../components/AppHeader';
import { AppText } from '../../components/AppText';
import { LinkButton } from '../../components/LinkButton';
import { NotificationRow } from '../../components/NotificationRow';
import { Screen } from '../../components/Screen';
import { EmptyState, LoadingState } from '../../components/States';
import { useApp } from '../../context/AppContext';
import { useAuth } from '../../context/AuthContext';
import type { NotificationCategory } from '../../data/mockNotifications';
import { colors, radii, spacing } from '../../theme';
import type { HomeScreenProps } from '../../navigation/types';

type Filter = 'all' | Extract<NotificationCategory, 'appointments' | 'health'>;

const FILTERS: { key: Filter; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'appointments', label: 'Appointments' },
  { key: 'health', label: 'Health' },
];

/** PO-12 Notifications */
export function NotificationsScreen({ navigation }: HomeScreenProps<'Notifications'>) {
  const { user } = useAuth();
  const { notifications, loadingNotifications, markAllRead, unreadCount } = useApp();
  const [filter, setFilter] = useState<Filter>('all');

  const filtered = filter === 'all' ? notifications : notifications.filter((n) => n.category === filter);
  const days: ('TODAY' | 'YESTERDAY')[] = ['TODAY', 'YESTERDAY'];

  return (
    <Screen contentStyle={styles.content}>
      <AppHeader title="Notifications" />

      <AppText variant="display">{`You’re all caught up on care${user ? '' : ''}`}</AppText>

      <View style={styles.filterRow}>
        {FILTERS.map((item) => {
          const active = item.key === filter;
          return (
            <Pressable
              key={item.key}
              accessibilityRole="button"
              accessibilityState={{ selected: active }}
              onPress={() => setFilter(item.key)}
              style={[styles.chip, active && styles.chipActive]}
            >
              <AppText variant="caption" color={active ? colors.text.inverse : colors.text.brand}>
                {item.label}
              </AppText>
            </Pressable>
          );
        })}
      </View>

      <LinkButton
        label={unreadCount === 0 ? 'All notifications read' : `Mark all as read (${unreadCount})`}
        icon="checkmark-done-outline"
        disabled={unreadCount === 0}
        onPress={() => void markAllRead()}
      />

      {loadingNotifications ? <LoadingState label="Loading notifications…" /> : null}

      {!loadingNotifications && filtered.length === 0 ? (
        <EmptyState
          icon="notifications-off-outline"
          title="Nothing here yet"
          message="Appointment updates, vaccination reminders and clinic announcements will appear here."
        />
      ) : null}

      {days.map((day) => {
        const items = filtered.filter((n) => n.day === day);
        if (!items.length) return null;
        return (
          <View key={day} style={styles.group}>
            <AppText variant="label" style={styles.dayLabel}>
              {day}
            </AppText>
            {items.map((notification) => (
              <NotificationRow
                key={notification.id}
                notification={notification}
                onPress={() => navigation.navigate('NotificationDetails', { id: notification.id })}
              />
            ))}
          </View>
        );
      })}
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { gap: spacing.md, paddingBottom: spacing.xxxl },
  filterRow: { flexDirection: 'row', gap: spacing.sm, flexWrap: 'wrap' },
  chip: {
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: colors.surface.border,
    backgroundColor: colors.surface.card,
  },
  chipActive: { backgroundColor: colors.brand.primary, borderColor: colors.brand.primary },
  group: { gap: 2 },
  dayLabel: { letterSpacing: 0.6, marginTop: spacing.sm },
});
