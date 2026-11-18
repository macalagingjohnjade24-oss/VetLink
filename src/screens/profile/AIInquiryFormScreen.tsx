import { useRef, useState, type ComponentRef } from 'react';
import { Keyboard, ScrollView, StyleSheet, View } from 'react-native';
import { AppHeader } from '../../components/AppHeader';
import { AppText } from '../../components/AppText';
import { Button } from '../../components/Button';
import { ChoiceRow } from '../../components/ChoiceRow';
import { HelpNote } from '../../components/HelpNote';
import { Input } from '../../components/Input';
import { Screen } from '../../components/Screen';
import { useAuth } from '../../context/AuthContext';
import { usePets } from '../../context/PetContext';
import { useKeyboardInset } from '../../hooks/useKeyboardInset';
import { INQUIRY_CATEGORIES, type InquiryCategory } from '../../data/mockAssistant';
import { CLINICS } from '../../data/mockClinics';
import { clinicInquiryService } from '../../services/clinicInquiryService';
import { colors, spacing } from '../../theme';
import type { ProfileScreenProps } from '../../navigation/types';

const CONSENT_COPY =
  'I consent to sharing this information with authorized veterinary personnel for inquiry review. This form is not monitored for emergencies.';

/** Records where a field sits in the scroll content so focus can bring it into view. */
function Field({ onMeasure, children }: { onMeasure: (y: number) => void; children: React.ReactNode }) {
  return <View onLayout={(event) => onMeasure(event.nativeEvent.layout.y)}>{children}</View>;
}

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

  const scrollRef = useRef<ComponentRef<typeof ScrollView>>(null);
  const fieldY = useRef<Record<string, number>>({});
  const pendingField = useRef<string | null>(null);

  const scrollToField = (key: string) => {
    const y = fieldY.current[key];
    if (y == null) return;
    scrollRef.current?.scrollTo({ y: Math.max(y - 96, 0), animated: true });
  };

  const keyboardInset = useKeyboardInset(scrollRef, {
    onShow: () => {
      if (pendingField.current) scrollToField(pendingField.current);
    },
  });

  const focusField = (key: string) => () => {
    pendingField.current = key;
    // The keyboard is already up, so no show event will fire for this field.
    if (Keyboard.isVisible()) scrollToField(key);
  };

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
    <Screen
      contentStyle={[styles.content, { paddingBottom: spacing.xxxl + keyboardInset }]}
      scrollRef={scrollRef}
    >
      <AppHeader title="Preliminary Information" />

      <AppText variant="display">Leave your inquiry</AppText>
      <AppText variant="body" color={colors.text.secondary}>
        Clinic staff are unavailable right now. Share the details for their review.
      </AppText>

      <Field onMeasure={(y) => (fieldY.current.owner = y)}>
        <Input
          label="Owner name"
          value={ownerName}
          onChangeText={setOwnerName}
          autoCapitalize="words"
          onFocus={focusField('owner')}
        />
      </Field>
      <Field onMeasure={(y) => (fieldY.current.contact = y)}>
        <Input
          label="Contact information"
          value={contact}
          onChangeText={setContact}
          autoCapitalize="none"
          onFocus={focusField('contact')}
        />
      </Field>
      <Field onMeasure={(y) => (fieldY.current.pet = y)}>
        <Input
          label="Pet name"
          value={petName}
          onChangeText={setPetName}
          autoCapitalize="words"
          onFocus={focusField('pet')}
        />
      </Field>
      <Field onMeasure={(y) => (fieldY.current.species = y)}>
        <Input label="Pet species" value={petSpecies} onChangeText={setPetSpecies} onFocus={focusField('species')} />
      </Field>
      <Field onMeasure={(y) => (fieldY.current.details = y)}>
        <Input
          label="Inquiry details"
          value={details}
          onChangeText={setDetails}
          multiline
          placeholder="I would like to ask about wellness appointment availability."
          onFocus={focusField('details')}
        />
      </Field>

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
