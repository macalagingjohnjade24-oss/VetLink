import { Image, Pressable, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { Clinic } from '../data/mockClinics';
import { colors, radii, spacing } from '../theme';
import { AppText } from './AppText';

type Props = {
  clinic: Clinic;
  onPress: () => void;
};

/** Photo-led clinic card matching the Figma discovery/search result cards. */
export function ClinicPhotoCard({ clinic, onPress }: Props) {
  const meta = `${clinic.area} · ${clinic.distanceKm.toFixed(1)} km · ${clinic.openNow ? 'Open today' : 'Opens later'}`;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${clinic.name}, ${clinic.distanceKm} km away`}
      onPress={onPress}
      style={({ pressed }) => [styles.card, pressed && styles.pressed]}
    >
      <Image source={clinic.photo} style={styles.photo} resizeMode="cover" />
      <View style={styles.body}>
        <View style={styles.titleRow}>
          <AppText variant="title" numberOfLines={1} style={styles.title}>
            {clinic.name}
          </AppText>
          <View style={styles.rating}>
            <Ionicons name="star" size={12} color={colors.brand.accent} />
            <AppText variant="small" color={colors.text.primary}>
              {clinic.rating.toFixed(1)}
            </AppText>
          </View>
        </View>
        <AppText variant="caption" numberOfLines={1}>
          {meta}
        </AppText>
        <View style={styles.footer}>
          <AppText variant="caption" color={colors.text.brand} numberOfLines={1} style={styles.services}>
            {clinic.services
              .map((service) => service.name.replace('General consultation', 'Consultation'))
              .slice(0, 2)
              .join('  ·  ')}
          </AppText>
          <AppText variant="caption" color={colors.text.brand}>
            View Details →
          </AppText>
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: radii.card,
    borderWidth: 1,
    borderColor: colors.surface.border,
    backgroundColor: colors.surface.card,
    overflow: 'hidden',
  },
  pressed: { backgroundColor: colors.surface.subtle },
  photo: { width: '100%', height: 126, backgroundColor: colors.surface.subtle },
  body: { padding: spacing.md, gap: 3 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  title: { flex: 1 },
  rating: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  footer: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm, marginTop: 2 },
  services: { flex: 1 },
});
