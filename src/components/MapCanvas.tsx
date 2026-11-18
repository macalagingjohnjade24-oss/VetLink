import { Pressable, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { Clinic } from '../data/mockClinics';
import { colors, radii, spacing } from '../theme';
import { AppText } from './AppText';

type Props = {
  clinics: Clinic[];
  selectedId: string | null;
  onSelect: (clinic: Clinic) => void;
  height?: number;
};

/**
 * Lightweight, dependency-free map canvas.
 *
 * The Figma map view is a static OpenStreetMap-style image. Because this build must run
 * inside Expo Go without a Google Maps API key, the map is drawn as a stylised street grid
 * with sample clinic pins instead of a native map. Replacing this component with
 * `react-native-maps` (and an API key) is the only change needed later.
 */
export function MapCanvas({ clinics, selectedId, onSelect, height = 360 }: Props) {
  return (
    <View style={[styles.map, { height }]}>
      <View style={styles.roads}>
        {[0.18, 0.38, 0.58, 0.78].map((pos) => (
          <View key={`h${pos}`} style={[styles.roadH, { top: `${pos * 100}%` }]} />
        ))}
        {[0.22, 0.44, 0.66, 0.88].map((pos) => (
          <View key={`v${pos}`} style={[styles.roadV, { left: `${pos * 100}%` }]} />
        ))}
        <View style={styles.park} />
        <View style={styles.river} />
      </View>

      {clinics.map((clinic) => {
        const active = clinic.id === selectedId;
        return (
          <Pressable
            key={clinic.id}
            accessibilityRole="button"
            accessibilityLabel={`${clinic.name} map pin`}
            onPress={() => onSelect(clinic)}
            style={[
              styles.pin,
              {
                left: `${Math.min(Math.max(clinic.coordinates.x, 0.08), 0.86) * 100}%`,
                top: `${Math.min(Math.max(clinic.coordinates.y, 0.1), 0.82) * 100}%`,
              },
              active && styles.pinActive,
            ]}
          >
            <Ionicons name="medkit" size={active ? 16 : 13} color={colors.text.inverse} />
          </Pressable>
        );
      })}

      <View style={styles.legend}>
        <AppText variant="small" style={styles.legendText}>
          Sample clinic pins
        </AppText>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  map: {
    borderRadius: radii.card,
    backgroundColor: '#EEF2F5',
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.surface.border,
  },
  roads: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
  roadH: { position: 'absolute', left: 0, right: 0, height: 10, backgroundColor: '#FFFFFF' },
  roadV: { position: 'absolute', top: 0, bottom: 0, width: 10, backgroundColor: '#FFFFFF' },
  park: {
    position: 'absolute',
    left: '52%',
    top: '60%',
    width: 90,
    height: 70,
    borderRadius: 18,
    backgroundColor: '#DDEBE0',
  },
  river: {
    position: 'absolute',
    left: '-10%',
    top: '8%',
    width: '120%',
    height: 16,
    backgroundColor: '#D8E6F1',
    transform: [{ rotate: '-12deg' }],
  },
  pin: {
    position: 'absolute',
    width: 28,
    height: 28,
    marginLeft: -14,
    marginTop: -14,
    borderRadius: 14,
    backgroundColor: colors.brand.secondary,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  pinActive: {
    width: 34,
    height: 34,
    marginLeft: -17,
    marginTop: -17,
    borderRadius: 17,
    backgroundColor: colors.brand.primary,
  },
  legend: {
    position: 'absolute',
    right: spacing.sm,
    bottom: spacing.sm,
    backgroundColor: 'rgba(255,255,255,0.9)',
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    borderRadius: radii.sm,
  },
  legendText: { fontSize: 9 },
});
