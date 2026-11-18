import { useCallback, useEffect, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { AppHeader } from '../../components/AppHeader';
import { AppText } from '../../components/AppText';
import { Button } from '../../components/Button';
import { ClinicPhotoCard } from '../../components/ClinicPhotoCard';
import { HelpNote } from '../../components/HelpNote';
import { Screen } from '../../components/Screen';
import { SearchField } from '../../components/SearchField';
import { LoadingState } from '../../components/States';
import type { Clinic } from '../../data/mockClinics';
import { clinicService, emptyFilters, sortLabel, type ClinicFilters } from '../../services/clinicService';
import { colors, spacing } from '../../theme';
import type { ClinicsScreenProps } from '../../navigation/types';

/** PO-16 Clinic Search Results */
export function ClinicSearchResultsScreen({ navigation, route }: ClinicsScreenProps<'ClinicSearchResults'>) {
  const initial = route.params?.filters ?? { ...emptyFilters, query: route.params?.query ?? '' };
  const [filters, setFilters] = useState<ClinicFilters>(initial);
  const [results, setResults] = useState<Clinic[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters arrive back from the Filter & Sort screen through route params.
  useEffect(() => {
    if (route.params?.filters) setFilters(route.params.filters);
    else if (route.params?.query !== undefined) setFilters((current) => ({ ...current, query: route.params?.query ?? '' }));
  }, [route.params?.filters, route.params?.query]);

  const load = useCallback(async (next: ClinicFilters) => {
    setLoading(true);
    const found = await clinicService.discover(next);
    setResults(found);
    setLoading(false);
  }, []);

  useEffect(() => {
    const handle = setTimeout(() => void load(filters), 220);
    return () => clearTimeout(handle);
  }, [filters, load]);

  const reset = () => setFilters({ ...emptyFilters });

  return (
    <Screen contentStyle={styles.content}>
      <AppHeader title="Clinic Search Results" />

      <AppText variant="label">Search query</AppText>
      <SearchField
        value={filters.query}
        onChangeText={(value) => setFilters((current) => ({ ...current, query: value }))}
        placeholder="Veterinary clinics in Makati"
      />
      {filters.query ? (
        <Pressable onPress={() => setFilters((current) => ({ ...current, query: '' }))} hitSlop={6}>
          <AppText variant="bodyStrong">Clear search</AppText>
        </Pressable>
      ) : null}

      <AppText variant="display">Care that fits your search</AppText>
      <AppText variant="body" color={colors.text.secondary}>
        {loading ? 'Searching clinics…' : `${results.length} ${results.length === 1 ? 'clinic' : 'clinics'} near Makati City`}
      </AppText>

      <View style={styles.sortRow}>
        <AppText variant="bodyStrong">{sortLabel(filters.sort)}</AppText>
        <Pressable
          onPress={() => navigation.navigate('FilterSort', { filters, returnTo: 'ClinicSearchResults' })}
          hitSlop={6}
        >
          <AppText variant="bodyStrong">Filter &amp; sort</AppText>
        </Pressable>
      </View>

      {loading ? <LoadingState label="Searching clinics…" /> : null}

      {!loading && results.length === 0 ? (
        <View style={styles.empty}>
          <HelpNote title="No clinics match your filters">
            Try a wider distance or remove a service filter.
          </HelpNote>
          <Button label="Reset filters" variant="secondary" onPress={reset} />
        </View>
      ) : null}

      {!loading
        ? results.map((clinic) => (
            <ClinicPhotoCard
              key={clinic.id}
              clinic={clinic}
              onPress={() => navigation.navigate('ClinicDetails', { clinicId: clinic.id })}
            />
          ))
        : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { gap: spacing.sm, paddingBottom: spacing.xxxl },
  sortRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginVertical: spacing.xs },
  empty: { gap: spacing.md },
});
