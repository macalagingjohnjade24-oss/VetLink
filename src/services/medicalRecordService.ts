import type { MedicalAttachment, MedicalRecord } from '../data/mockMedicalRecords';
import { requireSupabase } from '../lib/supabase';
import { offlineData, offlineMode } from '../offline/offlineBackend';
import { mapMedicalRecord, type MedicalRecordRow } from '../types/backend';

const byNewest = (a: MedicalRecord, b: MedicalRecord) => b.dateISO.localeCompare(a.dateISO);

/** Records are entered by clinics; owners only ever read them (RLS enforces it). */
export const medicalRecordService = {
  async forPet(petId: string): Promise<MedicalRecord[]> {
    if (offlineMode.isActive()) return offlineData.medicalRecordsFor(petId);
    const { data, error } = await requireSupabase()
      .from('medical_records')
      .select('*')
      .eq('pet_id', petId)
      .order('record_date', { ascending: false });
    if (error) throw new Error(error.message);
    return (data as MedicalRecordRow[]).map(mapMedicalRecord).sort(byNewest);
  },

  async recent(petId: string, limit = 2): Promise<MedicalRecord[]> {
    const records = await this.forPet(petId);
    return records.slice(0, limit);
  },

  async getById(id: string): Promise<MedicalRecord | null> {
    if (offlineMode.isActive()) return offlineData.medicalRecordById(id);
    const { data, error } = await requireSupabase().from('medical_records').select('*').eq('id', id).maybeSingle();
    if (error) throw new Error(error.message);
    return data ? mapMedicalRecord(data as MedicalRecordRow) : null;
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
