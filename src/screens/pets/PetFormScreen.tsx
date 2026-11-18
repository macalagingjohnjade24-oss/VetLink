import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { AppHeader } from '../../components/AppHeader';
import { AppText } from '../../components/AppText';
import { Button } from '../../components/Button';
import { Input } from '../../components/Input';
import { PetAvatar } from '../../components/PetAvatar';
import { Screen } from '../../components/Screen';
import { usePets } from '../../context/PetContext';
import type { PetGender, PetSpecies } from '../../data/mockPets';
import { colors, radii, spacing } from '../../theme';
import type { PetsScreenProps } from '../../navigation/types';

const SPECIES: PetSpecies[] = ['Dog', 'Cat'];
const GENDERS: PetGender[] = ['Male', 'Female'];

/** PO-34 Add New Pet / PO-35 Edit Pet Information */
export function PetFormScreen({ navigation, route }: PetsScreenProps<'PetForm'>) {
  const { mode, petId } = route.params;
  const { getPet, addPet, updatePet, pendingPhoto, setPendingPhoto } = usePets();
  const pet = petId ? getPet(petId) : null;

  const [name, setName] = useState(pet?.name ?? '');
  const [species, setSpecies] = useState<PetSpecies>(pet?.species ?? 'Dog');
  const [breed, setBreed] = useState(pet?.breed ?? '');
  const [gender, setGender] = useState<PetGender>(pet?.gender ?? 'Male');
  const [birthDate, setBirthDate] = useState(pet?.birthDate ?? '');
  const [weight, setWeight] = useState(pet ? String(pet.weightKg) : '');
  const [color, setColor] = useState(pet?.color ?? '');
  const [microchip, setMicrochip] = useState(pet?.microchip ?? '');
  const [other, setOther] = useState(pet?.notes ?? '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // A photo staged for a previous, cancelled Add Pet attempt must not follow the owner here.
  useEffect(() => {
    if (mode === 'add') setPendingPhoto(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode]);

  const isEdit = mode === 'edit' && !!pet;
  const previewPet = { name: name || 'Your pet', photo: pet?.photo ?? pendingPhoto ?? null };

  const validDate = /^\d{4}-\d{2}-\d{2}$/.test(birthDate) && !Number.isNaN(new Date(birthDate).getTime());
  const complete = name.trim().length > 1 && breed.trim().length > 1 && validDate && Number(weight) > 0;

  const save = async () => {
    if (saving) return;
    setSaving(true);
    setError(null);
    try {
      const payload = {
        name,
        species,
        breed,
        gender,
        birthDate,
        weightKg: weight,
        color,
        microchip,
        notes: other,
        photo: pet?.photo ?? pendingPhoto ?? null,
      };
      if (isEdit && pet) {
        await updatePet(pet.id, payload);
        // Return to the profile that opened the form instead of stacking a second one.
        navigation.popTo('PetDetails', { petId: pet.id });
      } else {
        const created = await addPet(payload);
        setPendingPhoto(null);
        navigation.replace('PetDetails', { petId: created.id });
      }
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'The pet could not be saved.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Screen contentStyle={styles.content}>
      <AppHeader title={isEdit ? 'Edit Pet Information' : 'Add New Pet'} />

      <AppText variant="display">
        {isEdit ? `Edit ${pet?.name ?? 'pet'}’s information` : 'Add a new companion'}
      </AppText>
      <AppText variant="body" color={colors.text.secondary}>
        {isEdit ? 'Keep the little details up to date.' : 'Tell us a little about your pet.'}
      </AppText>

      <Pressable
        accessibilityRole="button"
        accessibilityLabel={isEdit ? 'Change pet photo' : 'Add pet photograph'}
        onPress={() =>
          navigation.navigate('PetPhoto', isEdit && pet ? { petId: pet.id } : undefined)
        }
        style={styles.photoRow}
      >
        <PetAvatar pet={previewPet} size={64} />
        <View style={styles.flex}>
          <AppText variant="bodyStrong">{isEdit ? 'Change pet photo' : 'Add pet photograph'}</AppText>
          <AppText variant="caption">JPG or PNG · optional</AppText>
        </View>
      </Pressable>

      <Input label="Pet name" value={name} onChangeText={setName} placeholder="Enter pet name" autoCapitalize="words" />

      <AppText variant="label">Species</AppText>
      <View style={styles.choiceRow}>
        {SPECIES.map((option) => (
          <Pressable
            key={option}
            accessibilityRole="radio"
            accessibilityState={{ selected: species === option }}
            onPress={() => setSpecies(option)}
            style={[styles.choice, species === option && styles.choiceSelected]}
          >
            <AppText variant="body" color={species === option ? colors.text.inverse : colors.text.primary}>
              {option}
            </AppText>
          </Pressable>
        ))}
      </View>

      <Input label="Breed" value={breed} onChangeText={setBreed} placeholder="Golden Retriever" autoCapitalize="words" />

      <AppText variant="label">Gender</AppText>
      <View style={styles.choiceRow}>
        {GENDERS.map((option) => (
          <Pressable
            key={option}
            accessibilityRole="radio"
            accessibilityState={{ selected: gender === option }}
            onPress={() => setGender(option)}
            style={[styles.choice, gender === option && styles.choiceSelected]}
          >
            <AppText variant="body" color={gender === option ? colors.text.inverse : colors.text.primary}>
              {option}
            </AppText>
          </Pressable>
        ))}
      </View>

      <Input
        label="Date of birth"
        value={birthDate}
        onChangeText={setBirthDate}
        placeholder="2023-05-12"
        helper="Use YYYY-MM-DD"
        keyboardType="numbers-and-punctuation"
      />
      <Input
        label="Weight (kg)"
        value={weight}
        onChangeText={setWeight}
        placeholder="28"
        keyboardType="decimal-pad"
      />
      <Input label="Color" value={color} onChangeText={setColor} placeholder="Golden" autoCapitalize="words" />
      <Input
        label="Microchip number (optional)"
        value={microchip}
        onChangeText={setMicrochip}
        placeholder="981020000123456"
        keyboardType="numbers-and-punctuation"
      />
      <Input
        label="Other information (optional)"
        value={other}
        onChangeText={setOther}
        placeholder="Anything else your clinic should know"
        multiline
      />

      {error ? (
        <AppText variant="caption" color={colors.status.danger}>
          {error}
        </AppText>
      ) : null}

      <Button
        label={isEdit ? 'Save Changes' : 'Save Pet'}
        loading={saving}
        disabled={!complete}
        onPress={() => void save()}
      />
      <Pressable
        accessibilityRole="button"
        onPress={() => {
          setPendingPhoto(null);
          navigation.goBack();
        }}
        hitSlop={6}
        style={styles.cancel}
      >
        <AppText variant="link">Cancel</AppText>
      </Pressable>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { gap: spacing.md, paddingBottom: spacing.xxxl },
  photoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.md,
    borderRadius: radii.card,
    borderWidth: 1,
    borderColor: colors.surface.border,
    backgroundColor: colors.surface.card,
  },
  flex: { flex: 1, gap: 2 },
  choiceRow: { flexDirection: 'row', gap: spacing.sm },
  choice: {
    flex: 1,
    minHeight: 52,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radii.input,
    borderWidth: 1,
    borderColor: colors.surface.border,
    backgroundColor: colors.surface.card,
  },
  choiceSelected: { backgroundColor: colors.brand.primary, borderColor: colors.brand.primary },
  cancel: { alignItems: 'center', paddingVertical: spacing.sm },
});
