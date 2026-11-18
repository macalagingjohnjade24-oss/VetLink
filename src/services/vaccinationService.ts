import type { Vaccination, VaccinationStatus } from '../data/mockVaccinations';
import { requireSupabase } from '../lib/supabase';
import { offlineData, offlineMode } from '../offline/offlineBackend';
import { mapVaccination, type VaccinationRow } from '../types/backend';

/** Status is derived from the recorded next-due date, so a missed booster turns Overdue. */
export function vaccinationStatus(vaccination: Vaccination): VaccinationStatus {
  if (!vaccination.nextDueISO) return vaccination.status === 'Upcoming' ? 'Upcoming' : 'Completed';
  const today = new Date().toISOString().slice(0, 10);
  if (vaccination.nextDueISO < today) return 'Overdue';
  return 'Upcoming';
}

const rows = async (query: PromiseLike<{ data: unknown; error: { message: string } | null }>) => {
  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return (data as VaccinationRow[]).map(mapVaccination);
};

export const vaccinationService = {
  async list(): Promise<Vaccination[]> {
    if (offlineMode.isActive()) return offlineData.vaccinations();
    return rows(
      requireSupabase().from('vaccinations').select('*').order('next_due_date', { ascending: true, nullsFirst: false }),
    );
  },

  async forPet(petId: string): Promise<Vaccination[]> {
    if (offlineMode.isActive()) return offlineData.vaccinationsFor(petId);
    return rows(requireSupabase().from('vaccinations').select('*').eq('pet_id', petId).order('vaccination_date', { ascending: false }));
  },

  async upcoming(): Promise<Vaccination[]> {
    const all = await this.list();
    return all.filter((entry) => vaccinationStatus(entry) === 'Upcoming' || vaccinationStatus(entry) === 'Overdue');
  },

  async getById(id: string): Promise<Vaccination | null> {
    if (offlineMode.isActive()) return offlineData.vaccinationById(id);
    const { data, error } = await requireSupabase().from('vaccinations').select('*').eq('id', id).maybeSingle();
    if (error) throw new Error(error.message);
    return data ? mapVaccination(data as VaccinationRow) : null;
  },

  async nextDueFor(petId: string): Promise<Vaccination | null> {
    const all = await this.forPet(petId);
    const due = all.filter((entry) => entry.nextDueISO).sort((a, b) => (a.nextDueISO ?? '').localeCompare(b.nextDueISO ?? ''));
    return due[0] ?? null;
  },
};
