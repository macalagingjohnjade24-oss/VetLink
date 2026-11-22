import * as Location from 'expo-location';
import type { LatLng } from '../lib/geo';

/**
 * The pet owner's position, for real clinic distances and the map's "Locate me".
 *
 * Asked for only when a screen needs it, never at launch. A refusal, a phone
 * with location off, or a web browser without permission all resolve to null;
 * the locator then falls back to the distances stored on each clinic.
 */
let lastKnown: LatLng | null = null;

export const locationService = {
  /** The most recent fix this session, without prompting. */
  current(): LatLng | null {
    return lastKnown;
  },

  /** Asks permission if needed and reads a fresh position. */
  async locate(): Promise<LatLng | null> {
    try {
      const permission = await Location.requestForegroundPermissionsAsync();
      if (permission.status !== 'granted') return lastKnown;
      const position = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      lastKnown = { lat: position.coords.latitude, lng: position.coords.longitude };
      return lastKnown;
    } catch {
      return lastKnown;
    }
  },

  /** Uses a position already granted earlier without showing a prompt. */
  async quiet(): Promise<LatLng | null> {
    try {
      const permission = await Location.getForegroundPermissionsAsync();
      if (permission.status !== 'granted') return lastKnown;
      const position =
        (await Location.getLastKnownPositionAsync()) ??
        (await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }));
      if (position) lastKnown = { lat: position.coords.latitude, lng: position.coords.longitude };
      return lastKnown;
    } catch {
      return lastKnown;
    }
  },
};
