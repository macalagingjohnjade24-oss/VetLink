import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { AppHeader } from '../../components/AppHeader';
import { AppText } from '../../components/AppText';
import { HelpNote } from '../../components/HelpNote';
import { Screen } from '../../components/Screen';
import { EmptyState, LoadingState } from '../../components/States';
import { usePets } from '../../context/PetContext';
import type { MedicalAttachment, MedicalRecord } from '../../data/mockMedicalRecords';
import { medicalRecordService } from '../../services/medicalRecordService';
import { colors, radii, spacing } from '../../theme';
import type { PetsScreenProps } from '../../navigation/types';

/** PO-44 Medical Record Attachments */
export function MedicalRecordAttachmentsScreen({ route }: PetsScreenProps<'MedicalRecordAttachments'>) {
  const { recordId } = route.params;
  const { getPet } = usePets();
  const [record, setRecord] = useState<MedicalRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [active, setActive] = useState<MedicalAttachment | null>(null);

  useEffect(() => {
    let activeRequest = true;
    void medicalRecordService.getById(recordId).then((entry) => {
      if (!activeRequest) return;
      setRecord(entry);
      setActive(entry?.attachments[0] ?? null);
      setLoading(false);
    });
    return () => {
      activeRequest = false;
    };
  }, [recordId]);

  const pet = record ? getPet(record.petId) : null;

  return (
    <Screen contentStyle={styles.content}>
      <AppHeader title="Medical Record Attachments" />

      <AppText variant="display">Medical attachments</AppText>
      <AppText variant="body" color={colors.text.secondary}>
        {pet?.name ?? 'Your pet'} · {record?.title ?? 'Record'} ·{' '}
        {record ? medicalRecordService.longDate(record.dateISO) : ''}
      </AppText>

      {loading ? (
        <LoadingState />
      ) : !record || record.attachments.length === 0 ? (
        <EmptyState
          icon="document-outline"
          title="No attachments"
          message="Documents uploaded by the clinic will appear here."
        />
      ) : (
        <>
          {record.attachments.map((attachment) => {
            const selected = active?.id === attachment.id;
            return (
              <View key={attachment.id} style={styles.item}>
                <View style={styles.fileRow}>
                  <View style={styles.fileIcon}>
                    <Ionicons name="document-text-outline" size={20} color={colors.brand.primary} />
                  </View>
                  <View style={styles.flex}>
                    <AppText variant="cardTitle">{attachment.name}</AppText>
                    <AppText variant="caption">
                      {attachment.kind} · {attachment.sizeLabel} · Uploaded {attachment.uploadedLabel}
                    </AppText>
                  </View>
                </View>
                <AppText
                  variant="link"
                  onPress={() => setActive(selected ? null : attachment)}
                  accessibilityRole="button"
                >
                  {selected ? 'Hide preview' : 'View preview'}
                </AppText>

                {selected ? (
                  <View style={styles.preview}>
                    <AppText variant="badge" color={colors.text.brand} style={styles.previewTitle}>
                      {attachment.previewTitle}
                    </AppText>
                    {attachment.previewLines.map((line, index) => (
                      <AppText key={line} variant={index === 0 ? 'bodyStrong' : 'caption'}>
                        {line}
                      </AppText>
                    ))}
                    <AppText variant="small" color={colors.text.subtle} style={styles.previewNote}>
                      Preview only · the original document is held by the clinic.
                    </AppText>
                  </View>
                ) : null}
              </View>
            );
          })}

          <HelpNote>
            Attachments are clinic-entered files. VetLink never edits or replaces clinical documents.
          </HelpNote>
        </>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { gap: spacing.md, paddingBottom: spacing.xxxl },
  item: { gap: spacing.sm },
  fileRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  fileIcon: {
    width: 40,
    height: 40,
    borderRadius: radii.pill,
    backgroundColor: colors.surface.tint,
    alignItems: 'center',
    justifyContent: 'center',
  },
  flex: { flex: 1, gap: 2 },
  preview: {
    gap: spacing.xs,
    padding: spacing.lg,
    borderRadius: radii.card,
    backgroundColor: colors.surface.tint,
  },
  previewTitle: { letterSpacing: 0.8 },
  previewNote: { marginTop: spacing.sm },
});
