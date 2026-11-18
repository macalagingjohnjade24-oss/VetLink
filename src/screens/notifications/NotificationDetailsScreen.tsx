import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import { AppHeader } from '../../components/AppHeader';
import { AppText } from '../../components/AppText';
import { Badge } from '../../components/Badge';
import { Button } from '../../components/Button';
import { HelpNote } from '../../components/HelpNote';
import { Screen } from '../../components/Screen';
import { LoadingState } from '../../components/States';
import { useApp } from '../../context/AppContext';
import type { Appointment } from '../../data/mockAppointments';
import type { AppNotification } from '../../data/mockNotifications';
import { appointmentService } from '../../services/appointmentService';
import { notificationService } from '../../services/notificationService';
import { petService } from '../../services/petService';
import { colors, radii, spacing } from '../../theme';
import type { HomeScreenProps, TabParamList } from '../../navigation/types';

/** PO-14 Notification Details */
export function NotificationDetailsScreen({ navigation, route }: HomeScreenProps<'NotificationDetails'>) {
  const { id } = route.params;
  const { markRead } = useApp();
  const [notification, setNotification] = useState<AppNotification | null>(null);
  const [appointment, setAppointment] = useState<Appointment | null>(null);
  const [petName, setPetName] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    (async () => {
      const found = await notificationService.getById(id);
      if (!active) return;
      setNotification(found);
      if (found?.appointmentId) {
        const appointmentRecord = await appointmentService.getById(found.appointmentId);
        if (!active) return;
        setAppointment(appointmentRecord);
        if (appointmentRecord) {
          const pet = await petService.getById(appointmentRecord.petId);
          if (active) setPetName(pet?.name ?? null);
        }
      }
      setLoading(false);
    })();
    void markRead(id);
    return () => {
      active = false;
    };
  }, [id, markRead]);

  if (loading) {
    return (
      <Screen contentStyle={styles.content}>
        <AppHeader title="Notification Details" />
        <LoadingState />
      </Screen>
    );
  }

  if (!notification) {
    return (
      <Screen contentStyle={styles.content}>
        <AppHeader title="Notification Details" />
        <AppText variant="title">This notification is no longer available.</AppText>
        <Button label="Back to notifications" variant="secondary" onPress={() => navigation.goBack()} />
      </Screen>
    );
  }

  return (
    <Screen contentStyle={styles.content}>
      <AppHeader title="Notification Details" />

      {notification.badge ? <Badge label={notification.badge.label} tone={notification.badge.tone} /> : null}

      <AppText variant="display">{notification.detailTitle}</AppText>
      <AppText variant="caption">{notification.detailMeta}</AppText>
      <AppText variant="body">{notification.body}</AppText>

      {appointment ? (
        <View style={styles.appointmentCard}>
          <View style={styles.appointmentIcon}>
            <Ionicons name="calendar-outline" size={20} color={colors.brand.primary} />
          </View>
          <View style={styles.flex}>
            <AppText variant="cardTitle">{appointment.serviceName}</AppText>
            <AppText variant="caption">
              {petName ?? 'Your pet'} · {appointment.dateLabel}, 2026 · {appointment.timeLabel}
            </AppText>
          </View>
        </View>
      ) : null}

      {notification.guidance ? <HelpNote>{notification.guidance}</HelpNote> : null}

      {appointment ? (
        <Button
          label="View Appointment"
          onPress={() =>
            navigation
              .getParent<BottomTabNavigationProp<TabParamList>>()
              ?.navigate('BookingsTab', {
                screen: 'AppointmentDetails',
                params: { appointmentId: appointment.id },
              })
          }
        />
      ) : null}
      <Button label="Back to Notifications" variant="secondary" onPress={() => navigation.goBack()} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { gap: spacing.md, paddingBottom: spacing.xxxl },
  appointmentCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.lg,
    borderRadius: radii.card,
    borderWidth: 1,
    borderColor: colors.surface.border,
    backgroundColor: colors.surface.card,
  },
  appointmentIcon: {
    width: 40,
    height: 40,
    borderRadius: radii.pill,
    backgroundColor: colors.surface.tint,
    alignItems: 'center',
    justifyContent: 'center',
  },
  flex: { flex: 1, gap: 2 },
});
