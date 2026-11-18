import { Pressable, StyleSheet, View } from 'react-native';
import { AppHeader } from '../../components/AppHeader';
import { AppText } from '../../components/AppText';
import { Button } from '../../components/Button';
import { HelpNote } from '../../components/HelpNote';
import { PetAvatar } from '../../components/PetAvatar';
import { Screen } from '../../components/Screen';
import { EmptyState } from '../../components/States';
import { usePets } from '../../context/PetContext';
import { colors, radii, spacing } from '../../theme';
import type { PetsScreenProps } from '../../navigation/types';

/** PO-32 My Pets */
export function MyPetsScreen({ navigation }: PetsScreenProps<'MyPets'>) {
  const { pets } = usePets();
  const count = pets.length;

  return (
    <Screen contentStyle={styles.content}>
      <AppHeader title="My Pets" showBack={false} />

      <AppText variant="display">Your little family</AppText>
      <AppText variant="body" color={colors.text.secondary}>
        {count === 1
          ? 'One companion. One place for their care.'
          : `${count === 0 ? 'No' : count} companions. One place for their care.`}
      </AppText>

      {count === 0 ? (
        <EmptyState
          icon="paw-outline"
          title="No pets yet"
          message="Add your first companion to keep their care details in one place."
        />
      ) : (
        pets.map((pet) => (
          <View key={pet.id} style={styles.card}>
            <View style={styles.cardTop}>
              <PetAvatar pet={pet} size={64} />
              <View style={styles.flex}>
                <AppText variant="cardTitle">{pet.name}</AppText>
                <AppText variant="caption">
                  {pet.species} · {pet.breed} · {pet.ageLabel}
                </AppText>
              </View>
            </View>
            <Pressable
              accessibilityRole="button"
              onPress={() => navigation.navigate('PetDetails', { petId: pet.id })}
              hitSlop={6}
            >
              <AppText variant="bodyStrong">View {pet.name}’s Profile</AppText>
            </Pressable>
          </View>
        ))
      )}

      <Button label="Add Pet" icon="add" onPress={() => navigation.navigate('PetForm', { mode: 'add' })} />

      <HelpNote>Keep your pets’ details up to date for smoother clinic visits.</HelpNote>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { gap: spacing.md, paddingBottom: spacing.xxxl },
  card: {
    gap: spacing.md,
    padding: spacing.lg,
    borderRadius: radii.card,
    borderWidth: 1,
    borderColor: colors.surface.border,
    backgroundColor: colors.surface.card,
  },
  cardTop: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  flex: { flex: 1, gap: 2 },
});
