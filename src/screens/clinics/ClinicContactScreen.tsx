import { useEffect, useState } from 'react';
import { Linking, Pressable, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import { AppHeader } from '../../components/AppHeader';
import { AppText } from '../../components/AppText';
import { Button } from '../../components/Button';
import { HelpNote } from '../../components/HelpNote';
import { MapCanvas } from '../../components/MapCanvas';
import { Screen } from '../../components/Screen';
import { LoadingState } from '../../components/States';
import { useBooking } from '../../context/BookingContext';
import type { Clinic } from '../../data/mockClinics';
import { clinicService } from '../../services/clinicService';
import { directionsUrl } from '../../lib/geo';
import { colors, radii, spacing } from '../../theme';
import type { ClinicsScreenProps, TabParamList } from '../../navigation/types';

/** PO-22 Clinic Contact Information */
export function ClinicContactScreen({ navigation, route }: ClinicsScreenProps<'ClinicContact'>) {
  const { clinicId } = route.params;
  const { startBooking } = useBooking();
  const [clinic, setClinic] = useState<Clinic | null>(null);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Clinic | null>(null);

  useEffect(() => {
    let active = true;
    (async () => {
      const found = await clinicService.getById(clinicId);
      if (!active) return;
      setClinic(found);
      setSelected(found);
      setLoading(false);
    })();
    return () => {
      active = false;
    };
  }, [clinicId]);

  if (loading) {
    return (
      <Screen contentStyle={styles.content}>
        <AppHeader title="Clinic Contact Information" />
        <LoadingState />
      </Screen>
    );
  }

  if (!clinic) {
    return (
      <Screen contentStyle={styles.content}>
        <AppHeader title="Clinic Contact Information" />
        <AppText variant="title">This clinic is no longer available.</AppText>
      </Screen>
    );
  }

  return (
    <Screen contentStyle={styles.content}>
      <AppHeader title="Clinic Contact Information" />

      <AppText variant="display">Let’s get in touch</AppText>
      <AppText variant="body" color={colors.text.secondary}>
        {clinic.name}
      </AppText>

      <HelpNote title="Address">{clinic.address}</HelpNote>

      <Pressable
        onPress={() => void Linking.openURL(`tel:${clinic.phone.replace(/\s/g, '')}`)}
        style={({ pressed }) => [styles.row, pressed && styles.pressed]}
        accessibilityRole="button"
        accessibilityLabel={`Call ${clinic.name}`}
      >
        <View style={styles.icon}>
          <Ionicons name="call-outline" size={18} color={colors.brand.primary} />
        </View>
        <View style={styles.flex}>
          <AppText variant="caption">Clinic phone</AppText>
          <AppText variant="title">{clinic.phone}</AppText>
        </View>
        <AppText variant="caption" color={colors.text.brand}>
          Call
        </AppText>
      </Pressable>

      <Pressable
        onPress={() => void Linking.openURL(`mailto:${clinic.email}`)}
        style={({ pressed }) => [styles.row, pressed && styles.pressed]}
        accessibilityRole="button"
        accessibilityLabel={`Email ${clinic.name}`}
      >
        <View style={styles.icon}>
          <Ionicons name="mail-outline" size={18} color={colors.brand.primary} />
        </View>
        <View style={styles.flex}>
          <AppText variant="caption">Clinic email</AppText>
          <AppText variant="body">{clinic.email}</AppText>
        </View>
        <AppText variant="caption" color={colors.text.brand}>
          Email
        </AppText>
      </Pressable>

      <HelpNote title="Operating hours">
        {clinic.hoursLine}
        {'\n'}
        {clinic.hoursNote}
      </HelpNote>

      {clinic.location ? (
        <>
          <MapCanvas clinics={[clinic]} selectedId={clinic.id} onSelect={() => undefined} height={210} />
          <Button
            label="Get Directions"
            variant="secondary"
            onPress={() => void Linking.openURL(directionsUrl(clinic.location!))}
          />
        </>
      ) : (
        <HelpNote title="Map location">This clinic has not set its location on the map yet.</HelpNote>
      )}

      <Button
        label="Book an Appointment"
        onPress={() => {
          startBooking({ clinicId });
          navigation
            .getParent<BottomTabNavigationProp<TabParamList>>()
            ?.navigate('BookingsTab', { screen: 'BookingSelectClinic', params: { clinicId } });
        }}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { gap: spacing.md, paddingBottom: spacing.xxxl },
  row: {
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
  icon: {
    width: 36,
    height: 36,
    borderRadius: radii.pill,
    backgroundColor: colors.surface.tint,
    alignItems: 'center',
    justifyContent: 'center',
  },
  flex: { flex: 1, gap: 2 },
});
