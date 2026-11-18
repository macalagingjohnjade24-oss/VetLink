import { useCallback, useEffect, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { AppHeader } from '../../components/AppHeader';
import { AppText } from '../../components/AppText';
import { LinkButton } from '../../components/LinkButton';
import { Button } from '../../components/Button';
import { HelpNote } from '../../components/HelpNote';
import { MapCanvas } from '../../components/MapCanvas';
import { Screen } from '../../components/Screen';
import { LoadingState } from '../../components/States';
import type { Clinic } from '../../data/mockClinics';
import { clinicService, emptyFilters } from '../../services/clinicService';
import { colors, radii, spacing } from '../../theme';
import type { ClinicsScreenProps } from '../../navigation/types';

/** PO-17 Map View — stylised map canvas, no API key required. */
export function MapViewScreen({ navigation, route }: ClinicsScreenProps<'MapView'>) {
  const [clinics, setClinics] = useState<Clinic[]>([]);
  const [selected, setSelected] = useState<Clinic | null>(null);
  const [loading, setLoading] = useState(true);
  const [zoom, setZoom] = useState(1);

  const load = useCallback(async () => {
    const found = await clinicService.discover(route.params?.filters ?? emptyFilters);
    setClinics(found);
    setSelected(found[0] ?? null);
    setLoading(false);
  }, [route.params?.filters]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <Screen contentStyle={styles.content}>
      <AppHeader title="Map View" />

      <AppText variant="label">Find nearby clinics</AppText>
      <View style={styles.locationField}>
        <Ionicons name="location-outline" size={18} color={colors.text.secondary} />
        <AppText variant="body">Makati City, Metro Manila</AppText>
      </View>

      {loading ? <LoadingState label="Loading map…" /> : null}

      {!loading ? (
        <>
          <View style={styles.mapWrap}>
            <View style={[styles.mapScale, { transform: [{ scale: zoom }] }]}>
              <MapCanvas clinics={clinics} selectedId={selected?.id ?? null} onSelect={setSelected} height={360} />
            </View>
          </View>

          <AppText variant="small">© OpenStreetMap contributors · Sample clinic pins</AppText>

          <View style={styles.controls}>
            <LinkButton
              label="Zoom in"
              icon="add-outline"
              fullWidth={false}
              onPress={() => setZoom((z) => Math.min(1.4, +(z + 0.1).toFixed(2)))}
            />
            <LinkButton
              label="Zoom out"
              icon="remove-outline"
              fullWidth={false}
              onPress={() => setZoom((z) => Math.max(0.8, +(z - 0.1).toFixed(2)))}
            />
            <LinkButton label="Locate" icon="locate-outline" fullWidth={false} onPress={() => setSelected(clinics[0] ?? null)} />
          </View>

          {selected ? (
            <Pressable
              onPress={() => navigation.navigate('ClinicDetails', { clinicId: selected.id })}
              style={({ pressed }) => [styles.selectedCard, pressed && styles.pressed]}
            >
              <View style={styles.pinBadge}>
                <Ionicons name="medkit" size={16} color={colors.text.inverse} />
              </View>
              <View style={styles.flex}>
                <AppText variant="cardTitle" numberOfLines={1}>
                  {selected.name}
                </AppText>
                <AppText variant="caption">
                  {selected.distanceKm.toFixed(1)} km away · {selected.openNow ? 'Open today' : 'Closed now'}
                </AppText>
              </View>
              <Ionicons name="chevron-forward" size={18} color={colors.text.subtle} />
            </Pressable>
          ) : null}

          <Button
            label="Switch to List View"
            variant="secondary"
            onPress={() =>
              navigation.navigate('ClinicSearchResults', { filters: route.params?.filters ?? emptyFilters })
            }
          />

          <HelpNote title="Map preview">
            This build draws an approximate street map with sample pins so it runs in Expo Go without a Google Maps API
            key. Add a provider key and swap in a native map later — the rest of the locator works unchanged.
          </HelpNote>
        </>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { gap: spacing.sm, paddingBottom: spacing.xxxl },
  locationField: {
    minHeight: 52,
    borderRadius: radii.input,
    borderWidth: 1,
    borderColor: colors.surface.border,
    backgroundColor: colors.surface.card,
    paddingHorizontal: spacing.lg - 2,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  mapWrap: { borderRadius: radii.card, overflow: 'hidden', marginTop: spacing.xs },
  mapScale: { width: '100%' },
  controls: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    columnGap: spacing.md,
    rowGap: spacing.sm,
    marginVertical: spacing.xs,
  },
  selectedCard: {
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
  pinBadge: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.brand.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  flex: { flex: 1, gap: 2 },
});
