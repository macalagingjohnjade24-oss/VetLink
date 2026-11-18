import { Pressable, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { Clinic } from '../data/mockClinics';
import { colors, radii, spacing } from '../theme';
import { AppText } from './AppText';

type Props = {
  clinic: Clinic;
  onPress?: () => void;
};

/** Clinic summary card used on the home dashboard and in search results. */
export function ClinicCard({ clinic, onPress }: Props) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${clinic.name}, ${clinic.city}`}
      onPress={onPress}
      style={({ pressed }) => [styles.card, pressed && styles.pressed]}
    >
      <View style={styles.header}>
        <View style={styles.mark}>
          <Ionicons name="medkit-outline" size={20} color={colors.brand.primary} />
        </View>
        <View style={styles.titleWrap}>
          <AppText variant="title" numberOfLines={1}>
            {clinic.name}
          </AppText>
          <AppText variant="caption" numberOfLines={1}>
            {clinic.city} · {clinic.distanceKm.toFixed(1)} km · {clinic.openNow ? 'Open today' : 'Closed today'}
          </AppText>
        </View>
        <View style={styles.rating}>
          <Ionicons name="star" size={12} color={colors.brand.accent} />
          <AppText variant="small" color={colors.text.primary}>
            {clinic.rating.toFixed(1)}
          </AppText>
        </View>
      </View>

      <View style={styles.footer}>
        <AppText variant="caption" color={colors.text.brand} numberOfLines={1} style={styles.services}>
          {clinic.services.map((service) => service.name).slice(0, 2).join('  ·  ')}
        </AppText>
        <AppText variant="caption" color={colors.text.brand}>
          View Details →
        </AppText>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface.card,
    borderRadius: radii.card,
    borderWidth: 1,
    borderColor: colors.surface.border,
    padding: spacing.lg,
    gap: spacing.md,
  },
  pressed: { backgroundColor: colors.surface.subtle },
  header: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.md },
  mark: {
    width: 40,
    height: 40,
    borderRadius: radii.pill,
    backgroundColor: colors.surface.tint,
    alignItems: 'center',
    justifyContent: 'center',
  },
  titleWrap: { flex: 1, gap: 2 },
  rating: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  footer: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm },
  services: { flex: 1 },
});
