import { CLINICS, type Clinic, type ClinicService } from '../data/mockClinics';
import { requireSupabase } from '../lib/supabase';
import { offlineMode } from '../offline/offlineBackend';
import { mapClinic, mapClinicService, type ClinicRow, type ClinicServiceRow } from '../types/backend';
import { withDistances } from '../lib/geo';
import { locationService } from './locationService';

export type ServiceWithClinic = ClinicService & { clinicId: string; clinicName: string };

export type SortKey = 'nearest' | 'name' | 'availability';

export type ClinicFilters = {
  query: string;
  distanceKm: number | null;
  services: string[];
  openToday: boolean;
  hasAvailability: boolean;
  sort: SortKey;
};

export const emptyFilters: ClinicFilters = {
  query: '',
  distanceKm: null,
  services: [],
  openToday: false,
  hasAvailability: false,
  sort: 'nearest',
};

const matches = (haystack: string, needle: string) => haystack.toLowerCase().includes(needle.toLowerCase());

const serviceMatches = (clinic: Clinic, key: string) =>
  clinic.services.some((service) => service.name.toLowerCase().includes(key.toLowerCase()));

/** Normalises free text ("dental care") to the clinic service wording. */
const serviceKeyMatches = (clinic: Clinic, filterKey: string) =>
  filterKey === 'dental' ? serviceMatches(clinic, 'dental') : serviceMatches(clinic, filterKey);

export function applyFilters(clinics: Clinic[], filters: ClinicFilters): Clinic[] {
  const query = filters.query.trim();
  const filtered = clinics.filter((clinic) => {
    if (filters.distanceKm !== null && clinic.distanceKm > filters.distanceKm) return false;
    if (filters.openToday && !clinic.openNow) return false;
    if (filters.hasAvailability && !clinic.hasAvailability) return false;
    if (filters.services.length && !filters.services.every((key) => serviceKeyMatches(clinic, key))) return false;
    if (query && !(matches(clinic.name, query) || matches(clinic.area, query) || clinic.services.some((s) => matches(s.name, query))))
      return false;
    return true;
  });

  const sorted = [...filtered];
  if (filters.sort === 'nearest') sorted.sort((a, b) => a.distanceKm - b.distanceKm);
  if (filters.sort === 'name') sorted.sort((a, b) => a.name.localeCompare(b.name));
  if (filters.sort === 'availability')
    sorted.sort((a, b) => Number(b.hasAvailability) - Number(a.hasAvailability) || a.distanceKm - b.distanceKm);
  return sorted;
}

export const sortLabel = (sort: SortKey) =>
  sort === 'nearest' ? 'Nearest first' : sort === 'name' ? 'Name (A–Z)' : 'Availability';

/** "Paws & Care Veterinary Clinic" → "Paws & Care" for compact record lines. */
export function shortClinicName(name: string): string {
  return name.replace(/\s+Veterinary Clinic$/, '').replace(/\s+Animal Clinic$/, '');
}

/** Keeps `data/mockClinics`' CLINICS array pointing at the live catalogue (screens read it synchronously). */
function publish(clinics: Clinic[]) {
  CLINICS.length = 0;
  CLINICS.push(...clinics);
  return clinics;
}

async function loadCatalogue(): Promise<Clinic[]> {
  const client = requireSupabase();
  const [{ data: clinicRows, error: clinicError }, { data: serviceRows, error: serviceError }] = await Promise.all([
    client.from('clinics').select('*').eq('status', 'approved').order('clinic_name'),
    client.from('clinic_services').select('*').eq('availability', 'available').order('price'),
  ]);
  if (clinicError) throw new Error(clinicError.message);
  if (serviceError) throw new Error(serviceError.message);

  const rows = (clinicRows ?? []) as ClinicRow[];
  const services = (serviceRows ?? []) as ClinicServiceRow[];
  const mapped = rows.map((row) => mapClinic(row, services));
  // Real distances from the owner when their position is known; otherwise the
  // distance stored on each clinic row stands.
  return publish(withDistances(mapped, locationService.current() ?? (await locationService.quiet())));
}

export const clinicService = {
  async list(): Promise<Clinic[]> {
    if (offlineMode.isActive()) return [...CLINICS];
    return loadCatalogue();
  },

  async discover(filters: ClinicFilters): Promise<Clinic[]> {
    if (offlineMode.isActive()) return applyFilters(withDistances(CLINICS, locationService.current()), filters);
    return applyFilters(await loadCatalogue(), filters);
  },

  async getById(id: string): Promise<Clinic | null> {
    const cached = CLINICS.find((clinic) => clinic.id === id);
    if (cached) return cached;
    if (offlineMode.isActive()) return null;
    await loadCatalogue();
    return CLINICS.find((clinic) => clinic.id === id) ?? null;
  },

  async getService(clinicId: string, serviceId: string): Promise<ClinicService | null> {
    const clinic = await this.getById(clinicId);
    return clinic?.services.find((service) => service.id === serviceId) ?? null;
  },

  /** Discovery "recently viewed" has no server-side history table; nearest clinics stand in. */
  async recentlyViewed(): Promise<Clinic[]> {
    return [...CLINICS].sort((a, b) => a.distanceKm - b.distanceKm).slice(0, 2);
  },

  async featured(): Promise<Clinic[]> {
    return CLINICS.filter((clinic) => clinic.featured);
  },

  async allServices(): Promise<ServiceWithClinic[]> {
    return CLINICS.flatMap((clinic) =>
      clinic.services.map((service) => ({ ...service, clinicId: clinic.id, clinicName: clinic.name })),
    );
  },

  /** Kept for the home dashboard / notifications callers. */
  async nearby(): Promise<Clinic[]> {
    return [...CLINICS].sort((a, b) => a.distanceKm - b.distanceKm).slice(0, 3);
  },
};
