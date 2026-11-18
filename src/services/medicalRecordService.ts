import { MEDICAL_RECORDS, type MedicalAttachment, type MedicalRecord } from '../data/mockMedicalRecords';

const wait = (ms = 160) => new Promise((resolve) => setTimeout(resolve, ms));

const newestFirst = (a: MedicalRecord, b: MedicalRecord) => b.dateISO.localeCompare(a.dateISO);

export const medicalRecordService = {
  async forPet(petId: string): Promise<MedicalRecord[]> {
    await wait();
    return MEDICAL_RECORDS.filter((record) => record.petId === petId).sort(newestFirst);
  },

  async recent(petId: string, limit = 2): Promise<MedicalRecord[]> {
    await wait(120);
    return MEDICAL_RECORDS.filter((record) => record.petId === petId).sort(newestFirst).slice(0, limit);
  },

  async getById(id: string): Promise<MedicalRecord | null> {
    await wait(100);
    return MEDICAL_RECORDS.find((record) => record.id === id) ?? null;
  },

  attachmentsFor(record: MedicalRecord | null): MedicalAttachment[] {
    return record?.attachments ?? [];
  },

  /** Month heading used by the medical timeline ("OCTOBER 2026"). */
  monthHeading(dateISO: string): string {
    return new Date(dateISO)
      .toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
      .toUpperCase();
  },

  shortDate(dateISO: string): string {
    return new Date(dateISO).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  },

  longDate(dateISO: string): string {
    return new Date(dateISO).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
  },
};
