import { useEffect, useState } from 'react';
import { Image, Pressable, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import { AppHeader } from '../../components/AppHeader';
import { AppText } from '../../components/AppText';
import { Button } from '../../components/Button';
import { HelpNote } from '../../components/HelpNote';
import { Screen } from '../../components/Screen';
import { LoadingState } from '../../components/States';
import { useBooking } from '../../context/BookingContext';
import type { Clinic, ClinicService } from '../../data/mockClinics';
import { clinicService } from '../../services/clinicService';
import { colors, radii, spacing } from '../../theme';
import type { ClinicsScreenProps, TabParamList } from '../../navigation/types';

/** PO-21 Service Details */
export function ServiceDetailsScreen({ navigation, route }: ClinicsScreenProps<'ServiceDetails'>) {
  const { clinicId, serviceId } = route.params;
  const { startBooking } = useBooking();
  const [clinic, setClinic] = useState<Clinic | null>(null);
  const [service, setService] = useState<ClinicService | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    (async () => {
      const [foundClinic, foundService] = await Promise.all([
        clinicService.getById(clinicId),
        clinicService.getService(clinicId, serviceId),
      ]);
      if (!active) return;
      setClinic(foundClinic);
      setService(foundService);
      setLoading(false);
    })();
    return () => {
      active = false;
    };
  }, [clinicId, serviceId]);

  if (loading) {
    return (
      <Screen contentStyle={styles.content}>
        <AppHeader title="Service Details" />
        <LoadingState />
      </Screen>
    );
  }

  if (!clinic || !service) {
    return (
      <Screen contentStyle={styles.content}>
        <AppHeader title="Service Details" />
        <AppText variant="title">This service is no longer available.</AppText>
        <Button label="Back" variant="secondary" onPress={() => navigation.goBack()} />
      </Screen>
    );
  }

  return (
    <Screen contentStyle={styles.content}>
      <AppHeader title="Service Details" />

      <Image source={clinic.photo} style={styles.hero} resizeMode="cover" />

      <AppText variant="display">{service.name}</AppText>
      <AppText variant="body" color={colors.text.secondary}>
        {clinic.name}
      </AppText>

      <AppText variant="screenTitle">A thoughtful check-in for your pet</AppText>
      <AppText variant="body">
        {service.description} Discuss your pet’s day-to-day wellbeing, recent changes, and any concerns with veterinary
        personnel. The veterinarian determines the appropriate examination and next steps.
      </AppText>

      <View style={styles.metaRow}>
        <AppText variant="caption">₱{service.price}</AppText>
        <AppText variant="caption">{service.durationMinutes} minutes</AppText>
      </View>

      <HelpNote>
        Bring previous medical and vaccination records.{'\n'}Appointment availability is subject to clinic approval.
      </HelpNote>

      <Pressable
        onPress={() => navigation.navigate('ClinicDetails', { clinicId })}
        style={({ pressed }) => [styles.clinicCard, pressed && styles.pressed]}
      >
        <View style={styles.serviceIcon}>
          <Ionicons name="business-outline" size={18} color={colors.brand.primary} />
        </View>
        <View style={styles.flex}>
          <AppText variant="cardTitle">{clinic.name}</AppText>
          <AppText variant="caption">{clinic.address}</AppText>
        </View>
        <Ionicons name="chevron-forward" size={18} color={colors.text.subtle} />
      </Pressable>

      <Button
        label="Book This Service"
        onPress={() => {
          startBooking({ clinicId, serviceId });
          navigation
            .getParent<BottomTabNavigationProp<TabParamList>>()
            ?.navigate('BookingsTab', { screen: 'BookingSelectClinic', params: { clinicId, serviceId } });
        }}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { gap: spacing.md, paddingBottom: spacing.xxxl },
  hero: { width: '100%', height: 190, borderRadius: radii.card, backgroundColor: colors.surface.subtle },
  metaRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  clinicCard: {
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
