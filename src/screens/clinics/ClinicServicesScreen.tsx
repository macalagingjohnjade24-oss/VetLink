import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { AppHeader } from '../../components/AppHeader';
import { AppText } from '../../components/AppText';
import { LinkButton } from '../../components/LinkButton';
import { HelpNote } from '../../components/HelpNote';
import { Screen } from '../../components/Screen';
import { LoadingState } from '../../components/States';
import type { Clinic } from '../../data/mockClinics';
import { clinicService } from '../../services/clinicService';
import { colors, radii, spacing } from '../../theme';
import type { ClinicsScreenProps } from '../../navigation/types';

/** PO-20 Clinic Services */
export function ClinicServicesScreen({ navigation, route }: ClinicsScreenProps<'ClinicServices'>) {
  const { clinicId } = route.params;
  const [clinic, setClinic] = useState<Clinic | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    (async () => {
      const found = await clinicService.getById(clinicId);
      if (!active) return;
      setClinic(found);
      setLoading(false);
    })();
    return () => {
      active = false;
    };
  }, [clinicId]);

  return (
    <Screen contentStyle={styles.content}>
      <AppHeader title="Clinic Services" />

      <AppText variant="display">Care for your companion</AppText>
      <AppText variant="body" color={colors.text.secondary}>
        {clinic?.name ?? 'Loading clinic…'}
      </AppText>

      {loading ? <LoadingState /> : null}

      {clinic
        ? clinic.services.map((service) => (
            <View key={service.id} style={styles.serviceCard}>
              <View style={styles.serviceHeader}>
                <View style={styles.serviceIcon}>
                  <Ionicons name="medkit-outline" size={18} color={colors.brand.primary} />
                </View>
                <View style={styles.flex}>
                  <AppText variant="cardTitle">{service.name}</AppText>
                  <AppText variant="caption">{service.description}</AppText>
                </View>
              </View>
              <View style={styles.serviceFooter}>
                <AppText variant="caption">
                  ₱{service.price} · {service.durationMinutes} min
                </AppText>
                <LinkButton
                  label="Select Service"
                  fullWidth={false}
                  onPress={() => navigation.navigate('ServiceDetails', { clinicId, serviceId: service.id })}
                />
              </View>
            </View>
          ))
        : null}

      <HelpNote>Service availability and any fees are confirmed directly by the clinic.</HelpNote>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { gap: spacing.md, paddingBottom: spacing.xxxl },
  serviceCard: {
    borderRadius: radii.card,
    borderWidth: 1,
    borderColor: colors.surface.border,
    backgroundColor: colors.surface.card,
    padding: spacing.lg,
    gap: spacing.md,
  },
  serviceHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.md },
  serviceIcon: {
    width: 36,
    height: 36,
    borderRadius: radii.pill,
    backgroundColor: colors.surface.tint,
    alignItems: 'center',
    justifyContent: 'center',
  },
  serviceFooter: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm },
  flex: { flex: 1, gap: 2 },
});
