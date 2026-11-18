import { useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import { AppHeader } from '../../components/AppHeader';
import { AppText } from '../../components/AppText';
import { LinkButton } from '../../components/LinkButton';
import { ClinicCard } from '../../components/ClinicCard';
import { PetCard } from '../../components/PetCard';
import { Screen } from '../../components/Screen';
import { SearchField } from '../../components/SearchField';
import { EmptyState, LoadingState } from '../../components/States';
import { useApp } from '../../context/AppContext';
import type { Clinic } from '../../data/mockClinics';
import { clinicService, type ServiceWithClinic } from '../../services/clinicService';
import { searchService, type SearchResults } from '../../services/searchService';
import { colors, radii, spacing } from '../../theme';
import type { HomeScreenProps, TabParamList } from '../../navigation/types';

/** PO-13 Global Search */
export function GlobalSearchScreen({ navigation }: HomeScreenProps<'GlobalSearch'>) {
  const { recentSearches, addRecentSearch, clearRecentSearches } = useApp();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResults | null>(null);
  const [searching, setSearching] = useState(false);
  const [popularServices, setPopularServices] = useState<ServiceWithClinic[]>([]);
  const [suggestedClinics, setSuggestedClinics] = useState<Clinic[]>([]);

  useEffect(() => {
    let active = true;
    (async () => {
      const [services, clinics] = await Promise.all([clinicService.allServices(), clinicService.list()]);
      if (!active) return;
      const unique: ServiceWithClinic[] = [];
      for (const service of services) {
        if (!unique.some((item) => item.name === service.name)) unique.push(service);
      }
      setPopularServices(unique.slice(0, 2));
      setSuggestedClinics(clinics.slice(0, 2));
    })();
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    const handle = setTimeout(async () => {
      if (!query.trim()) {
        setResults(null);
        setSearching(false);
        return;
      }
      setSearching(true);
      const found = await searchService.search(query);
      setResults(found);
      setSearching(false);
    }, 250);
    return () => clearTimeout(handle);
  }, [query]);

  const openTab = (tab: keyof TabParamList) =>
    navigation.getParent<BottomTabNavigationProp<TabParamList>>()?.navigate(tab);
  const openClinic = (clinicId: string) =>
    navigation
      .getParent<BottomTabNavigationProp<TabParamList>>()
      ?.navigate('ClinicsTab', { screen: 'ClinicDetails', params: { clinicId } });
  const openService = (clinicId: string, serviceId: string) =>
    navigation
      .getParent<BottomTabNavigationProp<TabParamList>>()
      ?.navigate('ClinicsTab', { screen: 'ServiceDetails', params: { clinicId, serviceId } });
  const openPet = (petId: string) =>
    navigation
      .getParent<BottomTabNavigationProp<TabParamList>>()
      ?.navigate('PetsTab', { screen: 'PetDetails', params: { petId } });
  const openAppointment = (appointmentId: string) =>
    navigation
      .getParent<BottomTabNavigationProp<TabParamList>>()
      ?.navigate('BookingsTab', { screen: 'AppointmentDetails', params: { appointmentId } });

  const hasQuery = query.trim().length > 0;
  const showEmpty = hasQuery && !searching && results?.total === 0;

  const runSearch = (term: string) => {
    setQuery(term);
    void addRecentSearch(term);
  };

  const sections = useMemo(() => {
    if (!results) return [];
    return [
      { key: 'clinics', title: 'Clinics', count: results.clinics.length },
      { key: 'services', title: 'Services', count: results.services.length },
      { key: 'pets', title: 'Pets', count: results.pets.length },
      { key: 'appointments', title: 'Appointments', count: results.appointments.length },
    ].filter((section) => section.count > 0);
  }, [results]);

  return (
    <Screen contentStyle={styles.content}>
      <AppHeader title="Global Search" />

      <AppText variant="label">Search VetLink</AppText>
      <SearchField
        value={query}
        onChangeText={setQuery}
        placeholder="Clinics, services, or pets"
        onSubmit={() => void addRecentSearch(query)}
      />

      {hasQuery ? (
        <LinkButton label="Clear search" icon="close-outline" fullWidth={false} onPress={() => setQuery('')} />
      ) : null}

      {!hasQuery ? (
        <>
          <AppText variant="display">Find what you need</AppText>

          <View style={styles.block}>
            <View style={styles.blockHeader}>
              <AppText variant="title">Recent searches</AppText>
              {recentSearches.length > 0 ? (
                <Pressable onPress={() => void clearRecentSearches()} hitSlop={6}>
                  <AppText variant="caption">Clear</AppText>
                </Pressable>
              ) : null}
            </View>
            {recentSearches.length === 0 ? (
              <AppText variant="caption">Your recent searches will appear here.</AppText>
            ) : (
              recentSearches.map((term) => (
                <Pressable key={term} onPress={() => runSearch(term)} hitSlop={6} style={styles.recentRow}>
                  <Ionicons name="time-outline" size={16} color={colors.text.secondary} />
                  <AppText variant="bodyStrong">{term}</AppText>
                </Pressable>
              ))
            )}
          </View>

          <View style={styles.block}>
            <AppText variant="title">Popular services</AppText>
            {popularServices.map((service) => (
              <Pressable
                key={service.id}
                onPress={() => runSearch(service.name)}
                style={({ pressed }) => [styles.serviceRow, pressed && styles.pressed]}
              >
                <View style={styles.serviceIcon}>
                  <Ionicons name="medkit-outline" size={18} color={colors.brand.primary} />
                </View>
                <View style={styles.flex}>
                  <AppText variant="cardTitle">{service.name}</AppText>
                  <AppText variant="caption" numberOfLines={1}>
                    {service.description}
                  </AppText>
                </View>
                <Ionicons name="chevron-forward" size={18} color={colors.text.subtle} />
              </Pressable>
            ))}
          </View>

          <View style={styles.block}>
            <AppText variant="title">Suggested clinics</AppText>
            {suggestedClinics.map((clinic) => (
              <ClinicCard key={clinic.id} clinic={clinic} onPress={() => openClinic(clinic.id)} />
            ))}
          </View>
        </>
      ) : (
        <>
          {searching ? <LoadingState label="Searching VetLink…" /> : null}

          {showEmpty ? (
            <EmptyState
              icon="search-outline"
              title="No matches found"
              message={`We couldn’t find anything for “${query.trim()}”. Try a clinic, service or pet name.`}
            />
          ) : null}

          {results && !searching
            ? sections.map((section) => (
                <View key={section.key} style={styles.block}>
                  <AppText variant="title">
                    {section.title} ({section.count})
                  </AppText>

                  {section.key === 'clinics'
                    ? results.clinics.map((clinic) => (
                        <ClinicCard key={clinic.id} clinic={clinic} onPress={() => openClinic(clinic.id)} />
                      ))
                    : null}

                  {section.key === 'services'
                    ? results.services.map((service) => (
                        <Pressable
                          key={`${service.clinicId}-${service.id}`}
                          onPress={() => openService(service.clinicId, service.id)}
                          style={({ pressed }) => [styles.serviceRow, pressed && styles.pressed]}
                        >
                          <View style={styles.serviceIcon}>
                            <Ionicons name="medkit-outline" size={18} color={colors.brand.primary} />
                          </View>
                          <View style={styles.flex}>
                            <AppText variant="cardTitle">{service.name}</AppText>
                            <AppText variant="caption" numberOfLines={1}>
                              {service.clinicName} · ₱{service.price}
                            </AppText>
                          </View>
                          <Ionicons name="chevron-forward" size={18} color={colors.text.subtle} />
                        </Pressable>
                      ))
                    : null}

                  {section.key === 'pets'
                    ? results.pets.map((pet) => <PetCard key={pet.id} pet={pet} onPress={() => openPet(pet.id)} />)
                    : null}

                  {section.key === 'appointments'
                    ? results.appointments.map((appointment) => (
                        <Pressable
                          key={appointment.id}
                          onPress={() => openAppointment(appointment.id)}
                          style={({ pressed }) => [styles.serviceRow, pressed && styles.pressed]}
                        >
                          <View style={styles.serviceIcon}>
                            <Ionicons name="calendar-outline" size={18} color={colors.brand.primary} />
                          </View>
                          <View style={styles.flex}>
                            <AppText variant="cardTitle">{appointment.serviceName}</AppText>
                            <AppText variant="caption">
                              {appointment.dateLabel} · {appointment.timeLabel} · {appointment.status}
                            </AppText>
                          </View>
                          <Ionicons name="chevron-forward" size={18} color={colors.text.subtle} />
                        </Pressable>
                      ))
                    : null}
                </View>
              ))
            : null}
        </>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { gap: spacing.md, paddingBottom: spacing.xxxl },
  block: { gap: spacing.sm, marginTop: spacing.sm },
  blockHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  recentRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingVertical: 4 },
  serviceRow: {
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
