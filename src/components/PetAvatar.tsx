import { Image, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { Pet } from '../data/mockPets';
import { colors, radii } from '../theme';

type Props = {
  pet: Pick<Pet, 'photo' | 'name'>;
  size?: number;
  radius?: number;
};

/** Pet photo (or paw placeholder) used across the pet profile screens. */
export function PetAvatar({ pet, size = 56, radius = 14 }: Props) {
  const box = { width: size, height: size, borderRadius: radius };
  if (pet.photo) {
    return <Image source={pet.photo} style={box} resizeMode="cover" accessibilityLabel={`${pet.name} photo`} />;
  }
  return (
    <View style={[styles.fallback, box]} accessibilityLabel={`${pet.name} photo placeholder`}>
      <Ionicons name="paw" size={Math.round(size * 0.4)} color={colors.brand.primary} />
    </View>
  );
}

const styles = StyleSheet.create({
  fallback: {
    backgroundColor: colors.surface.tint,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radii.card,
  },
});
