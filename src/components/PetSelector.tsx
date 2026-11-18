import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { Pet } from '../data/mockPets';
import { colors, radii, spacing } from '../theme';
import { AppText } from './AppText';
import { PetAvatar } from './PetAvatar';

type Props = {
  pets: Pet[];
  selectedId?: string;
  onSelect: (petId: string) => void;
  label?: string;
};

/** "Selected pet" field from the health record frames — opens a small inline picker. */
export function PetSelector({ pets, selectedId, onSelect, label = 'Selected pet' }: Props) {
  const [open, setOpen] = useState(false);
  const selected = pets.find((pet) => pet.id === selectedId) ?? pets[0];

  return (
    <View style={styles.wrapper}>
      <AppText variant="label">{label}</AppText>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Selected pet ${selected ? selected.name : 'none'}`}
        onPress={() => setOpen((value) => !value)}
        style={styles.field}
      >
        <AppText variant="body" style={styles.flex}>
          {selected ? `${selected.name} · ${selected.breed}` : 'Choose a pet'}
        </AppText>
        <Ionicons name={open ? 'chevron-up' : 'chevron-down'} size={18} color={colors.text.secondary} />
      </Pressable>

      {open ? (
        <View style={styles.options}>
          {pets.map((pet) => {
            const active = pet.id === selected?.id;
            return (
              <Pressable
                key={pet.id}
                accessibilityRole="button"
                accessibilityState={{ selected: active }}
                onPress={() => {
                  onSelect(pet.id);
                  setOpen(false);
                }}
                style={[styles.option, active && styles.optionActive]}
              >
                <PetAvatar pet={pet} size={36} radius={10} />
                <View style={styles.flex}>
                  <AppText variant="bodyStrong" color={active ? colors.text.brand : colors.text.primary}>
                    {pet.name}
                  </AppText>
                  <AppText variant="caption">
                    {pet.species} · {pet.breed}
                  </AppText>
                </View>
                {active ? <Ionicons name="checkmark" size={18} color={colors.brand.primary} /> : null}
              </Pressable>
            );
          })}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { gap: spacing.xs + 2 },
  field: {
    minHeight: 52,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.lg - 2,
    borderRadius: radii.input,
    borderWidth: 1,
    borderColor: colors.surface.border,
    backgroundColor: colors.surface.card,
  },
  flex: { flex: 1 },
  options: {
    gap: spacing.xs,
    padding: spacing.sm,
    borderRadius: radii.card,
    borderWidth: 1,
    borderColor: colors.surface.border,
    backgroundColor: colors.surface.card,
  },
  option: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, padding: spacing.sm, borderRadius: radii.input },
  optionActive: { backgroundColor: colors.surface.tint },
});
