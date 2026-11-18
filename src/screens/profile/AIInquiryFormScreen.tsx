import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { AppHeader } from '../../components/AppHeader';
import { AppText } from '../../components/AppText';
import { Button } from '../../components/Button';
import { ChoiceRow } from '../../components/ChoiceRow';
import { HelpNote } from '../../components/HelpNote';
import { Input } from '../../components/Input';
import { Screen } from '../../components/Screen';
import { useAuth } from '../../context/AuthContext';
import { usePets } from '../../context/PetContext';
import { INQUIRY_CATEGORIES, type InquiryCategory } from '../../data/mockAssistant';
import { CLINICS } from '../../data/mockClinics';
import { clinicInquiryService } from '../../services/clinicInquiryService';
import { colors, spacing } from '../../theme';
import type { ProfileScreenProps } from '../../navigation/types';

const CONSENT_COPY =
  'I consent to sharing this information with authorized veterinary personnel for inquiry review. This form is not monitored for emergencies.';

/** PO-54 Preliminary Information */
export function AIInquiryFormScreen({ navigation, route }: ProfileScreenProps<'AIInquiryForm'>) {
  const { user } = useAuth();
  const { pets } = usePets();
  const firstPet = pets[0];

  const [ownerName, setOwnerName] = useState(`${user?.firstName ?? ''} ${user?.lastName ?? ''}`.trim());
  const [contact, setContact] = useState(user?.email ?? '');
  const [petName, setPetName] = useState(firstPet?.name ?? '');
  const [petSpecies, setPetSpecies] = useState<string>(firstPet?.species ?? '');
  const [category, setCategory] = useState<InquiryCategory>(route.params?.category ?? 'Appointment assistance');
  const [details, setDetails] = useState(route.params?.details ?? '');
  const [clinicId, setClinicId] = useState(CLINICS[0].id);
  const [consent, setConsent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const submit = async () => {
    setError(null);
    if (!ownerName.trim() || !contact.trim() || !petName.trim() || !petSpecies.trim()) {
      setError('Add your name, contact information and your pet’s details.');
      return;
    }
    if (!details.trim()) {
      setError('Tell the clinic what you would like to ask about.');
      return;
    }
    if (!consent) {
      setError('Tick the consent box so clinic staff can review your inquiry.');
      return;
    }
    const clinic = CLINICS.find((item) => item.id === clinicId) ?? CLINICS[0];
    setSubmitting(true);
    try {
      const inquiry = await clinicInquiryService.submit({
        ownerName: ownerName.trim(),
        contact: contact.trim(),
        petName: petName.trim(),
        petSpecies: petSpecies.trim(),
        category,
        details: details.trim(),
        clinicId: clinic.id,
        clinicName: clinic.name,
      });
      navigation.replace('AIInquiryConfirmation', { inquiryId: inquiry.id });
    } catch {
      setError('We couldn’t submit your inquiry. Please try again.');
      setSubmitting(false);
    }
  };

  return (
    <Screen contentStyle={styles.content} keyboard>
      <AppHeader title="Preliminary Information" />

      <AppText variant="display">Leave your inquiry</AppText>
      <AppText variant="body" color={colors.text.secondary}>
        Clinic staff are unavailable right now. Share the details for their review.
      </AppText>

      <Input label="Owner name" value={ownerName} onChangeText={setOwnerName} autoCapitalize="words" />
      <Input label="Contact information" value={contact} onChangeText={setContact} autoCapitalize="none" />
      <Input label="Pet name" value={petName} onChangeText={setPetName} autoCapitalize="words" />
      <Input label="Pet species" value={petSpecies} onChangeText={setPetSpecies} />
      <Input
        label="Inquiry details"
        value={details}
        onChangeText={setDetails}
        multiline
        placeholder="I would like to ask about wellness appointment availability."
      />

      <AppText variant="label">Inquiry category</AppText>
      <View style={styles.options}>
        {INQUIRY_CATEGORIES.map((option) => (
          <ChoiceRow
            key={option}
            mode="radio"
            label={option}
            selected={category === option}
            onPress={() => setCategory(option)}
          />
        ))}
      </View>

      <AppText variant="label">Preferred clinic</AppText>
      <View style={styles.options}>
        {CLINICS.map((clinic) => (
          <ChoiceRow
            key={clinic.id}
            mode="radio"
            label={clinic.name}
            selected={clinicId === clinic.id}
            onPress={() => setClinicId(clinic.id)}
          />
        ))}
      </View>

      <HelpNote>
        <ChoiceRow mode="checkbox" label={CONSENT_COPY} selected={consent} onPress={() => setConsent(!consent)} />
      </HelpNote>

      {error ? <HelpNote tone="danger">{error}</HelpNote> : null}

      <Button label="Submit Inquiry" loading={submitting} onPress={() => void submit()} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { gap: spacing.md, paddingBottom: spacing.xxxl },
  options: { gap: 2 },
});
