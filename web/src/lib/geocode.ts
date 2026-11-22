/**
 * Address search for the clinic location picker, using OpenStreetMap's free
 * Nominatim service (no API key). Its usage policy allows light, interactive
 * use — one search per button press here — and asks clients to identify
 * themselves, which the browser's Referer header does.
 *
 * The URL builder and parser are pure so `npm test` covers them in Node.
 */

export type GeoPoint = { lat: number; lng: number };
export type GeocodeResult = GeoPoint & { label: string };

/** Metro Manila: where the map opens before a clinic has a location. */
export const DEFAULT_CENTER: GeoPoint = { lat: 14.5995, lng: 120.9842 };

export function nominatimUrl(query: string, countryCodes = 'ph'): string {
  const params = new URLSearchParams({
    format: 'jsonv2',
    limit: '1',
    addressdetails: '0',
    countrycodes: countryCodes,
    q: query.trim(),
  });
  return `https://nominatim.openstreetmap.org/search?${params.toString()}`;
}

/** The first usable hit from a Nominatim JSON response, or null. */
export function parseNominatim(body: unknown): GeocodeResult | null {
  if (!Array.isArray(body) || !body.length) return null;
  const hit = body[0] as { lat?: unknown; lon?: unknown; display_name?: unknown };
  const lat = Number(hit.lat);
  const lng = Number(hit.lon);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  return { lat, lng, label: typeof hit.display_name === 'string' ? hit.display_name : '' };
}

/** Six decimals is ~10 cm — plenty for a clinic door, and keeps the fields tidy. */
export const roundCoord = (value: number) => Math.round(value * 1e6) / 1e6;

export async function geocodeAddress(query: string): Promise<GeocodeResult | null> {
  if (!query.trim()) return null;
  const response = await fetch(nominatimUrl(query), { headers: { Accept: 'application/json' } });
  if (!response.ok) throw new Error('The address search is unavailable right now. Place the pin on the map instead.');
  return parseNominatim(await response.json());
}

/** Form values (text or numbers) as a point, or null while either is missing or invalid. */
export function toPoint(lat: unknown, lng: unknown): GeoPoint | null {
  if (lat === null || lat === undefined || lng === null || lng === undefined) return null;
  if (String(lat).trim() === '' || String(lng).trim() === '') return null;
  const la = Number(lat);
  const lo = Number(lng);
  if (!Number.isFinite(la) || !Number.isFinite(lo) || la < -90 || la > 90 || lo < -180 || lo > 180) return null;
  return { lat: la, lng: lo };
}
