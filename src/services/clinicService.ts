import { CLINICS, RECENTLY_VIEWED_CLINIC_IDS, type Clinic, type ClinicService } from '../data/mockClinics';

const wait = (ms = 200) => new Promise((resolve) => setTimeout(resolve, ms));

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

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/** "Paws & Care Veterinary Clinic" → "Paws & Care" for compact record lines. */
export function shortClinicName(name: string): string {
  return name.replace(/\s+Veterinary Clinic$/, '').replace(/\s+Animal Clinic$/, '');
}

export const clinicService = {
  async list(): Promise<Clinic[]> {
    await delay(180);
    return CLINICS;
  },

  async discover(filters: ClinicFilters): Promise<Clinic[]> {
    await delay(220);
    return applyFilters(CLINICS, filters);
  },

  async getById(id: string): Promise<Clinic | null> {
    await delay(120);
    return CLINICS.find((clinic) => clinic.id === id) ?? null;
  },

  async getService(clinicId: string, serviceId: string): Promise<ClinicService | null> {
    await delay(120);
    return CLINICS.find((clinic) => clinic.id === clinicId)?.services.find((service) => service.id === serviceId) ?? null;
  },

  async recentlyViewed(): Promise<Clinic[]> {
    await delay(120);
    return RECENTLY_VIEWED_CLINIC_IDS.map((id) => CLINICS.find((c) => c.id === id)).filter(Boolean) as Clinic[];
  },

  async featured(): Promise<Clinic[]> {
    await delay(120);
    return CLINICS.filter((clinic) => clinic.featured);
  },

  async allServices(): Promise<ServiceWithClinic[]> {
    await delay(150);
    return CLINICS.flatMap((clinic) =>
      clinic.services.map((service) => ({ ...service, clinicId: clinic.id, clinicName: clinic.name })),
    );
  },

  /** Kept for the home dashboard / notifications callers. */
  async nearby(): Promise<Clinic[]> {
    await delay(150);
    return [...CLINICS].sort((a, b) => a.distanceKm - b.distanceKm).slice(0, 3);
  },
};

export { wait };
