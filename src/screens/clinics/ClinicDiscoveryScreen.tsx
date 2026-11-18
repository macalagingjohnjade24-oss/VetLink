import { useCallback, useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { AppHeader } from '../../components/AppHeader';
import { AppText } from '../../components/AppText';
import { LinkButton } from '../../components/LinkButton';
import { Button } from '../../components/Button';
import { ClinicPhotoCard } from '../../components/ClinicPhotoCard';
import { Screen } from '../../components/Screen';
import { SearchField } from '../../components/SearchField';
import { LoadingState } from '../../components/States';
import type { Clinic } from '../../data/mockClinics';
import { clinicService } from '../../services/clinicService';
import { colors, radii, spacing } from '../../theme';
import type { ClinicsScreenProps } from '../../navigation/types';

/** PO-15 Clinic Discovery */
export function ClinicDiscoveryScreen({ navigation }: ClinicsScreenProps<'ClinicDiscovery'>) {
  const [query, setQuery] = useState('');
  const [nearby, setNearby] = useState<Clinic[]>([]);
  const [featured, setFeatured] = useState<Clinic[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const [near, feat] = await Promise.all([clinicService.nearby(), clinicService.featured()]);
    setNearby(near);
    setFeatured(feat);
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const openSearch = () =>
    navigation.navigate('ClinicSearchResults', { query: query.trim() || undefined });

  return (
    <Screen contentStyle={styles.content}>
      <AppHeader title="Clinic Discovery" showBack={false} />

      <View style={styles.locationChip}>
        <Ionicons name="location-outline" size={14} color={colors.text.brand} />
        <AppText variant="bodyStrong">Makati City, Metro Manila</AppText>
      </View>

      <AppText variant="display">Good care, close by</AppText>
      <AppText variant="body" color={colors.text.secondary}>
        Find a trusted team for your pet.
      </AppText>

      <AppText variant="label" style={styles.label}>
        Search clinics
      </AppText>
      <SearchField
        value={query}
        onChangeText={setQuery}
        placeholder="Search by clinic or service"
        onSubmit={openSearch}
      />

      <View style={styles.viewRow}>
        <AppText variant="bodyStrong">List view</AppText>
        <LinkButton label="Map view" icon="map-outline" fullWidth={false} onPress={() => navigation.navigate('MapView')} />
        <LinkButton
          label="Filters"
          icon="options-outline"
          fullWidth={false}
          onPress={() => navigation.navigate('FilterSort', { returnTo: 'ClinicSearchResults' })}
        />
      </View>

      <Button
        label="Filter clinics"
        variant="secondary"
        icon="options-outline"
        onPress={() => navigation.navigate('FilterSort', { returnTo: 'ClinicSearchResults' })}
      />

      {loading ? <LoadingState label="Finding clinics near you…" /> : null}

      {!loading ? (
        <>
          <AppText variant="screenTitle">Nearby clinics</AppText>
          {nearby.map((clinic) => (
            <ClinicPhotoCard
              key={clinic.id}
              clinic={clinic}
              onPress={() => navigation.navigate('ClinicDetails', { clinicId: clinic.id })}
            />
          ))}

          <AppText variant="screenTitle" style={styles.sectionGap}>
            Featured clinic
          </AppText>
          {featured.map((clinic) => (
            <ClinicPhotoCard
              key={clinic.id}
              clinic={clinic}
              onPress={() => navigation.navigate('ClinicDetails', { clinicId: clinic.id })}
            />
          ))}
        </>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { gap: spacing.sm, paddingBottom: spacing.xxxl },
  locationChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'flex-start',
    backgroundColor: colors.surface.tint,
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
    borderRadius: radii.pill,
  },
  label: { marginTop: spacing.sm },
  viewRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.lg, marginVertical: spacing.xs },
  sectionGap: { marginTop: spacing.md },
});
