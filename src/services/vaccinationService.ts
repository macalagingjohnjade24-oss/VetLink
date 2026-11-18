import { VACCINATIONS, type Vaccination, type VaccinationStatus } from '../data/mockVaccinations';

const wait = (ms = 150) => new Promise((resolve) => setTimeout(resolve, ms));

/** Records are mock clinic entries; status is derived from the recorded next date. */
export function vaccinationStatus(vaccination: Vaccination): VaccinationStatus {
  if (!vaccination.nextDueISO) return vaccination.status;
  const today = new Date().toISOString().slice(0, 10);
  if (vaccination.nextDueISO < today) return 'Overdue';
  return vaccination.status === 'Upcoming' ? 'Upcoming' : 'Completed';
}

export const vaccinationService = {
  async list(): Promise<Vaccination[]> {
    await wait();
    return VACCINATIONS;
  },

  async forPet(petId: string): Promise<Vaccination[]> {
    await wait();
    return VACCINATIONS.filter((entry) => entry.petId === petId);
  },

  async upcoming(): Promise<Vaccination[]> {
    await wait(120);
    return VACCINATIONS.filter((v) => vaccinationStatus(v) === 'Upcoming' || vaccinationStatus(v) === 'Overdue');
  },

  async getById(id: string): Promise<Vaccination | null> {
    await wait(100);
    return VACCINATIONS.find((entry) => entry.id === id) ?? null;
  },

  async nextDueFor(petId: string): Promise<Vaccination | null> {
    await wait(100);
    const due = VACCINATIONS.filter((entry) => entry.petId === petId && entry.nextDueISO).sort((a, b) =>
      (a.nextDueISO ?? '').localeCompare(b.nextDueISO ?? ''),
    );
    return due[0] ?? null;
  },
};
