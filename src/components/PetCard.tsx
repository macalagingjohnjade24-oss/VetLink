import { Image, Pressable, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { Pet } from '../data/mockPets';
import { colors, radii, spacing } from '../theme';
import { AppText } from './AppText';

type Props = {
  pet: Pet;
  onPress?: () => void;
};

export function PetCard({ pet, onPress }: Props) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${pet.name}, ${pet.breed}`}
      onPress={onPress}
      style={({ pressed }) => [styles.card, pressed && styles.pressed]}
    >
      {pet.photo ? (
        <Image source={pet.photo} style={styles.photo} resizeMode="cover" />
      ) : (
        <View style={[styles.photo, styles.photoFallback]}>
          <Ionicons name="paw" size={22} color={colors.brand.primary} />
        </View>
      )}
      <View style={styles.body}>
        <AppText variant="cardTitle">{pet.name}</AppText>
        <AppText variant="caption" numberOfLines={1}>
          {pet.species} · {pet.breed} · {pet.ageLabel}
        </AppText>
      </View>
      <Ionicons name="chevron-forward" size={18} color={colors.text.subtle} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.md,
    borderRadius: radii.card,
    borderWidth: 1,
    borderColor: colors.surface.border,
    backgroundColor: colors.surface.card,
  },
  pressed: { backgroundColor: colors.surface.subtle },
  photo: { width: 56, height: 56, borderRadius: 12, backgroundColor: colors.surface.subtle },
  photoFallback: { alignItems: 'center', justifyContent: 'center' },
  body: { flex: 1, gap: 2 },
});
