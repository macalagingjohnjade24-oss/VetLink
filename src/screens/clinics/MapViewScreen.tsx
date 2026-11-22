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
import { locationService } from '../../services/locationService';
import type { LatLng } from '../../lib/geo';
import { colors, radii, spacing } from '../../theme';
import type { ClinicsScreenProps } from '../../navigation/types';

/**
 * PO-17 Map View — a real OpenStreetMap map (free, no API key) with a pin per
 * clinic. "Locate me" asks for the owner's position once, then distances and
 * the nearest-first order use it.
 */
export function MapViewScreen({ navigation, route }: ClinicsScreenProps<'MapView'>) {
  const [clinics, setClinics] = useState<Clinic[]>([]);
  const [selected, setSelected] = useState<Clinic | null>(null);
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<LatLng | null>(locationService.current());
  const [locating, setLocating] = useState(false);
  const [locateNote, setLocateNote] = useState<string | null>(null);
  const [fitKey, setFitKey] = useState(0);

  const load = useCallback(async () => {
    const found = await clinicService.discover(route.params?.filters ?? emptyFilters);
    setClinics(found);
    setSelected((current) => found.find((clinic) => clinic.id === current?.id) ?? found[0] ?? null);
    setLoading(false);
  }, [route.params?.filters]);

  const locate = async () => {
    setLocating(true);
    setLocateNote(null);
    const position = await locationService.locate();
    setLocating(false);
    if (!position) {
      setLocateNote('Location is off or was not allowed. Distances use each clinic’s listed area instead.');
      return;
    }
    setUser(position);
    await load();
    setFitKey((key) => key + 1);
  };

  const unmapped = clinics.filter((clinic) => !clinic.location).length;

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <Screen contentStyle={styles.content}>
      <AppHeader title="Map View" />

      <AppText variant="label">Find nearby clinics</AppText>
      <View style={styles.locationField}>
        <Ionicons name="location-outline" size={18} color={colors.text.secondary} />
        <AppText variant="body">{user ? 'Near your current location' : 'Metro Manila · tap Locate me for distances from you'}</AppText>
      </View>

      {loading ? <LoadingState label="Loading map…" /> : null}

      {!loading ? (
        <>
          <View style={styles.mapWrap}>
            <MapCanvas
              clinics={clinics}
              selectedId={selected?.id ?? null}
              onSelect={setSelected}
              height={380}
              user={user}
              fitKey={fitKey}
            />
          </View>

          <View style={styles.controls}>
            <LinkButton
              label={locating ? 'Locating…' : 'Locate me'}
              icon="locate-outline"
              fullWidth={false}
              onPress={() => void locate()}
            />
            <LinkButton
              label="Show all clinics"
              icon="expand-outline"
              fullWidth={false}
              onPress={() => setFitKey((key) => key + 1)}
            />
          </View>
          {locateNote ? <AppText variant="small">{locateNote}</AppText> : null}

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

          {unmapped ? (
            <HelpNote title="Some clinics are not on the map yet">
              {unmapped} clinic{unmapped === 1 ? ' has' : 's have'} not set a map location. They still appear in the list
              view.
            </HelpNote>
          ) : null}
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
