import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { AppHeader } from '../../components/AppHeader';
import { AppText } from '../../components/AppText';
import { BookingStep } from '../../components/BookingStep';
import { Button } from '../../components/Button';
import { HelpNote } from '../../components/HelpNote';
import { Input } from '../../components/Input';
import { Screen } from '../../components/Screen';
import { useBooking } from '../../context/BookingContext';
import { CLINICS } from '../../data/mockClinics';
import { usePets } from '../../context/PetContext';
import { bookingService } from '../../services/bookingService';
import { colors, radii, spacing } from '../../theme';
import type { BookingsScreenProps } from '../../navigation/types';

/** PO-28 Appointment Information */
export function BookingInformationScreen({ navigation }: BookingsScreenProps<'BookingInformation'>) {
  const { draft, updateDraft } = useBooking();
  const { pets } = usePets();
  const [pickerError, setPickerError] = useState<string | null>(null);

  const clinic = CLINICS.find((item) => item.id === draft.clinicId);
  const pet = pets.find((item) => item.id === draft.petId);
  const service = clinic?.services.find((item) => item.id === draft.serviceId);

  const attach = async () => {
    setPickerError(null);
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      setPickerError('Photo access is off. You can continue without an attachment.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.7 });
    if (result.canceled) return;
    const asset = result.assets[0];
    updateDraft({ attachmentName: asset.fileName ?? 'Attachment' });
  };

  const complete = draft.ownerName.trim() && draft.contact.trim() && draft.reason.trim() && draft.symptoms.trim();

  return (
    <Screen contentStyle={styles.content}>
      <AppHeader title="Appointment Information" />

      <BookingStep step={5} />
      <AppText variant="display">Tell us about the visit</AppText>

      <HelpNote>
        {pet ? `${pet.name} · ${pet.breed}` : 'Selected pet'}
        {'\n'}
        {service?.name ?? 'Selected service'} ·{' '}
        {draft.dateISO ? bookingService.formatShortDate(draft.dateISO) : 'Date'} {draft.time ?? ''}
      </HelpNote>

      <Input
        label="Owner name"
        value={draft.ownerName}
        onChangeText={(value) => updateDraft({ ownerName: value })}
        placeholder="Alex Santos"
        autoCapitalize="words"
      />
      <Input
        label="Contact number"
        value={draft.contact}
        onChangeText={(value) => updateDraft({ contact: value })}
        placeholder="+63 917 555 0142"
        keyboardType="phone-pad"
      />
      <Input
        label="Reason for appointment"
        value={draft.reason}
        onChangeText={(value) => updateDraft({ reason: value })}
        placeholder="Routine wellness check"
      />
      <Input
        label="Symptoms or concerns"
        value={draft.symptoms}
        onChangeText={(value) => updateDraft({ symptoms: value })}
        placeholder="No new concerns to report"
        multiline
      />
      <Input
        label="Additional notes (optional)"
        value={draft.notes}
        onChangeText={(value) => updateDraft({ notes: value })}
        placeholder="Anything the clinic should know"
        multiline
      />

      <AppText variant="label">Attachment (optional)</AppText>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Upload a photo or document"
        onPress={() => void attach()}
        style={styles.upload}
      >
        <Ionicons name="cloud-upload-outline" size={20} color={colors.text.brand} />
        <AppText variant="body" color={draft.attachmentName ? colors.text.primary : colors.text.secondary} style={styles.flex}>
          {draft.attachmentName ?? 'Upload a photo or document'}
        </AppText>
        {draft.attachmentName ? (
          <Pressable hitSlop={8} onPress={() => updateDraft({ attachmentName: null })} accessibilityLabel="Remove attachment">
            <Ionicons name="close-circle" size={18} color={colors.text.secondary} />
          </Pressable>
        ) : null}
      </Pressable>
      {pickerError ? (
        <AppText variant="caption" color={colors.status.danger}>
          {pickerError}
        </AppText>
      ) : null}

      <AppText variant="caption">Required fields must be completed before continuing.</AppText>

      <Button
        label="Continue"
        disabled={!complete}
        onPress={() => navigation.navigate('BookingReview')}
      />
      <View style={styles.spacer} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { gap: spacing.md, paddingBottom: spacing.xxxl },
  upload: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    minHeight: 52,
    paddingHorizontal: spacing.lg - 2,
    borderRadius: radii.input,
    borderWidth: 1,
    borderColor: colors.surface.border,
    backgroundColor: colors.surface.card,
  },
  flex: { flex: 1 },
  spacer: { height: spacing.sm },
});
