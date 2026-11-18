import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { AppText } from '../../components/AppText';
import { Button } from '../../components/Button';
import { ClinicCard } from '../../components/ClinicCard';
import { HelpNote } from '../../components/HelpNote';
import { Logo } from '../../components/Logo';
import { PetCard } from '../../components/PetCard';
import { Screen } from '../../components/Screen';
import { SectionHeader } from '../../components/SectionHeader';
import { useApp } from '../../context/AppContext';
import { useAuth } from '../../context/AuthContext';
import type { Appointment } from '../../data/mockAppointments';
import type { Clinic } from '../../data/mockClinics';
import { usePets } from '../../context/PetContext';
import { appointmentService } from '../../services/appointmentService';
import { clinicService } from '../../services/clinicService';
import { colors, radii, spacing } from '../../theme';
import type { HomeScreenProps, RootStackParamList, TabParamList } from '../../navigation/types';

/** PO-11 Home Dashboard */
export function HomeScreen({ navigation }: HomeScreenProps<'Home'>) {
  const { user } = useAuth();
  const { unreadCount } = useApp();
  const [appointment, setAppointment] = useState<Appointment | null>(null);
  const [clinic, setClinic] = useState<Clinic | null>(null);
  const { pets } = usePets();
  const [recentClinics, setRecentClinics] = useState<Clinic[]>([]);

  useEffect(() => {
    let active = true;
    (async () => {
      const [upcoming, recent] = await Promise.all([appointmentService.upcoming(), clinicService.recentlyViewed()]);
      if (!active) return;
      const next = upcoming[0] ?? null;
      setAppointment(next);
      setRecentClinics(recent);
      if (next) setClinic(await clinicService.getById(next.clinicId));
    })();
    return () => {
      active = false;
    };
  }, []);

  const openTab = (tab: keyof TabParamList) => {
    navigation.getParent<BottomTabNavigationProp<TabParamList>>()?.navigate(tab);
  };

  const greeting = new Date().getHours() < 12 ? 'Good morning' : new Date().getHours() < 18 ? 'Good afternoon' : 'Good evening';

  return (
    <Screen contentStyle={styles.content}>
      <View style={styles.topBar}>
        <Logo size="md" />
        <View style={styles.topActions}>
          <Pressable accessibilityLabel="Search VetLink" hitSlop={8} onPress={() => navigation.navigate('GlobalSearch')}>
            <Ionicons name="search-outline" size={22} color={colors.text.primary} />
          </Pressable>
          <Pressable accessibilityLabel="Notifications" hitSlop={8} onPress={() => navigation.navigate('Notifications')}>
            <Ionicons name="notifications-outline" size={22} color={colors.text.primary} />
            {unreadCount > 0 ? <View style={styles.bellDot} /> : null}
          </Pressable>
        </View>
      </View>

      <AppText variant="display">
        {greeting}, {user?.firstName ?? 'there'}!
      </AppText>
      <AppText variant="body" color={colors.text.secondary}>
        How are your pets feeling today?
      </AppText>

      <View style={styles.banner}>
        <AppText style={styles.bannerTitle}>Happy pets.{'\n'}Healthier tomorrows.</AppText>
        <AppText variant="caption" color={colors.text.brand} style={styles.bannerBody}>
          Trusted care is just around the corner.
        </AppText>
      </View>

      <Button label="Find a Veterinary Clinic" onPress={() => openTab('ClinicsTab')} />

      <SectionHeader title="Upcoming appointment" />
      {appointment ? (
        <Pressable
          accessibilityRole="button"
          onPress={() =>
            navigation
              .getParent<BottomTabNavigationProp<TabParamList>>()
              ?.navigate('BookingsTab', { screen: 'AppointmentDetails', params: { appointmentId: appointment.id } })
          }
          style={({ pressed }) => [styles.appointmentCard, pressed && styles.pressed]}
        >
          <View style={styles.appointmentIcon}>
            <Ionicons name="calendar-outline" size={20} color={colors.brand.primary} />
          </View>
          <View style={styles.flex}>
            <AppText variant="cardTitle">{appointment.serviceName}</AppText>
            <AppText variant="caption">
              {pets.find((pet) => pet.id === appointment.petId)?.name ?? 'Your pet'} · {appointment.dateLabel} ·{' '}
              {appointment.timeLabel} · {appointment.status}
            </AppText>
            {clinic ? (
              <AppText variant="small" numberOfLines={1}>
                {clinic.name}
              </AppText>
            ) : null}
          </View>
          <Ionicons name="chevron-forward" size={18} color={colors.text.subtle} />
        </Pressable>
      ) : null}

      <SectionHeader title="My Pets" actionLabel="View all" onAction={() => openTab('PetsTab')} />
      <View style={styles.stack}>
        {pets.map((pet) => (
          <PetCard
            key={pet.id}
            pet={pet}
            onPress={() =>
              navigation
                .getParent<BottomTabNavigationProp<TabParamList>>()
                ?.navigate('PetsTab', { screen: 'PetDetails', params: { petId: pet.id } })
            }
          />
        ))}
      </View>

      <HelpNote>Health reminder · Milo’s rabies booster is due Nov 24.</HelpNote>
      <Pressable onPress={() => navigation.navigate('Notifications')} hitSlop={6}>
        <AppText variant="bodyStrong">View vaccination reminder</AppText>
      </Pressable>

      <SectionHeader title="Recently viewed clinics" />
      {recentClinics.map((recent) => (
        <ClinicCard
          key={recent.id}
          clinic={recent}
          onPress={() =>
            navigation
              .getParent<BottomTabNavigationProp<TabParamList>>()
              ?.navigate('ClinicsTab', { screen: 'ClinicDetails', params: { clinicId: recent.id } })
          }
        />
      ))}

      <Button
        label="Ask the VetLink AI Assistant"
        variant="secondary"
        icon="sparkles-outline"
        onPress={() =>
          navigation
            .getParent<BottomTabNavigationProp<TabParamList>>()
            ?.getParent<NativeStackNavigationProp<RootStackParamList>>()
            ?.navigate('AI', { screen: 'AIAssistant' })
        }
        style={styles.aiButton}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { gap: spacing.sm, paddingBottom: spacing.xxxl },
  topBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingTop: spacing.sm },
  topActions: { flexDirection: 'row', alignItems: 'center', gap: spacing.lg },
  bellDot: {
    position: 'absolute',
    top: -1,
    right: -1,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.brand.accent,
    borderWidth: 1.5,
    borderColor: colors.surface.background,
  },
  banner: {
    backgroundColor: colors.brand.peach,
    borderRadius: radii.card,
    padding: spacing.lg,
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  bannerTitle: { fontFamily: 'Inter_700Bold', fontSize: 24, lineHeight: 30, color: colors.text.brand },
  bannerBody: { fontSize: 13 },
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
  pressed: { backgroundColor: colors.surface.subtle },
  appointmentIcon: {
    width: 40,
    height: 40,
    borderRadius: radii.pill,
    backgroundColor: colors.surface.tint,
    alignItems: 'center',
    justifyContent: 'center',
  },
  flex: { flex: 1, gap: 2 },
  stack: { gap: spacing.sm },
  aiButton: { marginTop: spacing.lg },
});
