/**
 * Distance helpers for the clinic locator. Pure functions (no React Native
 * imports) so `npm test` can run them in Node.
 */

export type LatLng = { lat: number; lng: number };

/** Metro Manila, used to centre the map before the user's location is known. */
export const DEFAULT_CENTER: LatLng = { lat: 14.5995, lng: 120.9842 };

const EARTH_RADIUS_KM = 6371;
const toRad = (deg: number) => (deg * Math.PI) / 180;

/** Great-circle ("as the crow flies") distance in kilometres. */
export function distanceKm(a: LatLng, b: LatLng): number {
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** A usable coordinate pair, or null for missing / out-of-range values. */
export function toLatLng(lat: unknown, lng: unknown): LatLng | null {
  const la = typeof lat === 'string' ? Number(lat) : lat;
  const lo = typeof lng === 'string' ? Number(lng) : lng;
  if (typeof la !== 'number' || typeof lo !== 'number') return null;
  if (!Number.isFinite(la) || !Number.isFinite(lo)) return null;
  if (la < -90 || la > 90 || lo < -180 || lo > 180) return null;
  if (la === 0 && lo === 0) return null;
  return { lat: la, lng: lo };
}

/**
 * Recomputes each clinic's distance from `origin`, rounded to 0.1 km. Clinics
 * without coordinates keep the distance they already had.
 */
export function withDistances<T extends { location: LatLng | null; distanceKm: number }>(
  clinics: T[],
  origin: LatLng | null,
): T[] {
  if (!origin) return clinics;
  return clinics.map((clinic) =>
    clinic.location
      ? { ...clinic, distanceKm: Math.round(distanceKm(origin, clinic.location) * 10) / 10 }
      : clinic,
  );
}

/** Opens turn-by-turn directions in Google Maps (app or browser) — free, no key. */
export function directionsUrl(destination: LatLng): string {
  return `https://www.google.com/maps/dir/?api=1&destination=${destination.lat},${destination.lng}`;
}
