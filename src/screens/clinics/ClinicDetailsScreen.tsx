import { useCallback, useEffect, useState } from 'react';
import { Image, Pressable, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import { AppHeader } from '../../components/AppHeader';
import { AppText } from '../../components/AppText';
import { Button } from '../../components/Button';
import { HelpNote } from '../../components/HelpNote';
import { Screen } from '../../components/Screen';
import { LoadingState } from '../../components/States';
import type { Clinic } from '../../data/mockClinics';
import { useBooking } from '../../context/BookingContext';
import { clinicService } from '../../services/clinicService';
import { STORAGE_KEYS, storage } from '../../services/storage';
import { colors, radii, spacing } from '../../theme';
import type { ClinicsScreenProps, TabParamList } from '../../navigation/types';

/** PO-19 Clinic Details */
export function ClinicDetailsScreen({ navigation, route }: ClinicsScreenProps<'ClinicDetails'>) {
  const { clinicId } = route.params;
  const [clinic, setClinic] = useState<Clinic | null>(null);
  const [loading, setLoading] = useState(true);
  const [saved, setSaved] = useState(false);
  const { startBooking } = useBooking();

  useEffect(() => {
    let active = true;
    (async () => {
      const found = await clinicService.getById(clinicId);
      const savedIds = (await storage.get<string[]>(STORAGE_KEYS.savedClinics)) ?? [];
      if (!active) return;
      setClinic(found);
      setSaved(savedIds.includes(clinicId));
      setLoading(false);
    })();
    return () => {
      active = false;
    };
  }, [clinicId]);

  const toggleSave = useCallback(async () => {
    const savedIds = (await storage.get<string[]>(STORAGE_KEYS.savedClinics)) ?? [];
    const next = savedIds.includes(clinicId) ? savedIds.filter((id) => id !== clinicId) : [...savedIds, clinicId];
    await storage.set(STORAGE_KEYS.savedClinics, next);
    setSaved(next.includes(clinicId));
  }, [clinicId]);

  if (loading) {
    return (
      <Screen contentStyle={styles.content}>
        <AppHeader title="Clinic Details" />
        <LoadingState />
      </Screen>
    );
  }

  if (!clinic) {
    return (
      <Screen contentStyle={styles.content}>
        <AppHeader title="Clinic Details" />
        <AppText variant="title">This clinic is no longer available.</AppText>
        <Button label="Back to clinics" variant="secondary" onPress={() => navigation.goBack()} />
      </Screen>
    );
  }

  return (
    <Screen contentStyle={styles.content}>
      <AppHeader title="Clinic Details" />

      <Image source={clinic.photo} style={styles.hero} resizeMode="cover" />

      <AppText variant="display">{clinic.name}</AppText>
      <AppText variant="body" color={colors.text.secondary}>
        {clinic.address} · {clinic.distanceKm.toFixed(1)} km
      </AppText>

      <View style={styles.actionsRow}>
        <Pressable onPress={() => void toggleSave()} hitSlop={6} accessibilityState={{ selected: saved }}>
          <AppText variant="bodyStrong">{saved ? '♥ Saved' : '♡ Save clinic'}</AppText>
        </Pressable>
        <Pressable onPress={() => navigation.navigate('ClinicContact', { clinicId })} hitSlop={6}>
          <AppText variant="bodyStrong">Contact clinic</AppText>
        </Pressable>
      </View>

      <HelpNote>
        {clinic.hoursLine}
        {'\n'}
        {clinic.hoursNote}
      </HelpNote>

      <AppText variant="screenTitle">Care for every chapter</AppText>
      <AppText variant="body">{clinic.description}</AppText>

      <Button
        label="Book Appointment"
        onPress={() => {
          startBooking({ clinicId });
          navigation
            .getParent<BottomTabNavigationProp<TabParamList>>()
            ?.navigate('BookingsTab', { screen: 'BookingSelectClinic', params: { clinicId } });
        }}
      />

      <AppText variant="title">Available services</AppText>
      {clinic.services.slice(0, 2).map((service) => (
        <Pressable
          key={service.id}
          onPress={() => navigation.navigate('ServiceDetails', { clinicId, serviceId: service.id })}
          style={({ pressed }) => [styles.serviceCard, pressed && styles.pressed]}
        >
          <View style={styles.serviceIcon}>
            <Ionicons name="medkit-outline" size={18} color={colors.brand.primary} />
          </View>
          <View style={styles.flex}>
            <AppText variant="cardTitle">{service.name}</AppText>
            <AppText variant="caption">{service.description}</AppText>
          </View>
          <AppText variant="caption" color={colors.text.brand}>
            ₱{service.price}
          </AppText>
        </Pressable>
      ))}

      <Button
        label="View all services"
        variant="secondary"
        onPress={() => navigation.navigate('ClinicServices', { clinicId })}
      />
      <Pressable onPress={() => navigation.navigate('ClinicContact', { clinicId })} hitSlop={6}>
        <AppText variant="bodyStrong">Location, hours &amp; contact information</AppText>
      </Pressable>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { gap: spacing.md, paddingBottom: spacing.xxxl },
  hero: { width: '100%', height: 204, borderRadius: radii.card, backgroundColor: colors.surface.subtle },
  actionsRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.md },
  serviceCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.md,
    borderRadius: radii.card,
    borderWidth: 1,
    borderColor: colors.surface.border,
    backgroundColor: colors.surface.card,
  },
  pressed: { backgroundColor: colors.surface.subtle },
  serviceIcon: {
    width: 36,
    height: 36,
    borderRadius: radii.pill,
    backgroundColor: colors.surface.tint,
    alignItems: 'center',
    justifyContent: 'center',
  },
  flex: { flex: 1, gap: 2 },
});
