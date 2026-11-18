import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { AppHeader } from '../../components/AppHeader';
import { AppText } from '../../components/AppText';
import { Button } from '../../components/Button';
import { Card } from '../../components/Card';
import { ChoiceRow } from '../../components/ChoiceRow';
import { Input } from '../../components/Input';
import { Screen } from '../../components/Screen';
import { CLINIC_SERVICE_FILTERS } from '../../data/mockClinics';
import { emptyFilters, type ClinicFilters, type SortKey } from '../../services/clinicService';
import { colors, spacing } from '../../theme';
import type { ClinicsScreenProps } from '../../navigation/types';

const DISTANCES: { label: string; value: number | null }[] = [
  { label: '1 km', value: 1 },
  { label: '5 km', value: 5 },
  { label: '10 km', value: 10 },
  { label: 'Any distance', value: null },
];

const SORTS: { label: string; value: SortKey }[] = [
  { label: 'Nearest', value: 'nearest' },
  { label: 'Name (A–Z)', value: 'name' },
  { label: 'Availability', value: 'availability' },
];

/** PO-18 Filter and Sort Clinics */
export function FilterSortScreen({ navigation, route }: ClinicsScreenProps<'FilterSort'>) {
  const [filters, setFilters] = useState<ClinicFilters>(route.params?.filters ?? { ...emptyFilters });
  const returnTo = route.params?.returnTo ?? 'ClinicSearchResults';

  const toggleService = (key: string) =>
    setFilters((current) => ({
      ...current,
      services: current.services.includes(key)
        ? current.services.filter((item) => item !== key)
        : [...current.services, key],
    }));

  const apply = () => navigation.navigate(returnTo, { filters });

  return (
    <Screen contentStyle={styles.content}>
      <AppHeader title="Filter and Sort Clinics" />

      <AppText variant="display">Find your best fit</AppText>
      <AppText variant="body" color={colors.text.secondary}>
        Choose the care you’re looking for.
      </AppText>

      <Input
        label="Clinic name"
        value={filters.query}
        onChangeText={(value) => setFilters((current) => ({ ...current, query: value }))}
        placeholder="Search clinic name"
      />

      <AppText variant="title">Distance</AppText>
      <Card>
        {DISTANCES.map((distance) => (
          <ChoiceRow
            key={distance.label}
            mode="radio"
            label={distance.label}
            selected={filters.distanceKm === distance.value}
            onPress={() => setFilters((current) => ({ ...current, distanceKm: distance.value }))}
          />
        ))}
      </Card>

      <AppText variant="title">Services</AppText>
      <Card>
        {CLINIC_SERVICE_FILTERS.map((service) => (
          <ChoiceRow
            key={service.key}
            label={service.label}
            selected={filters.services.includes(service.key)}
            onPress={() => toggleService(service.key)}
          />
        ))}
      </Card>

      <AppText variant="title">Availability</AppText>
      <Card>
        <ChoiceRow
          label="Open today"
          selected={filters.openToday}
          onPress={() => setFilters((current) => ({ ...current, openToday: !current.openToday }))}
        />
        <ChoiceRow
          label="Available appointments"
          selected={filters.hasAvailability}
          onPress={() => setFilters((current) => ({ ...current, hasAvailability: !current.hasAvailability }))}
        />
      </Card>

      <AppText variant="title">Sort by</AppText>
      <Card>
        {SORTS.map((sort) => (
          <ChoiceRow
            key={sort.value}
            mode="radio"
            label={sort.label}
            selected={filters.sort === sort.value}
            onPress={() => setFilters((current) => ({ ...current, sort: sort.value }))}
          />
        ))}
      </Card>

      <View style={styles.actions}>
        <Button label="Apply Filters" onPress={apply} />
        <Button label="Reset Filters" variant="secondary" onPress={() => setFilters({ ...emptyFilters, query: filters.query })} />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { gap: spacing.md, paddingBottom: spacing.xxxl },
  actions: { gap: spacing.sm, marginTop: spacing.sm },
});
