/**
 * Which map tiles to draw. With a MapTiler key (VITE_MAPTILER_KEY) the maps use
 * MapTiler "Streets"; without one they fall back to OpenStreetMap's free tiles,
 * so the app works before a key is set up.
 *
 * Pure (no Vite or Leaflet imports) so `npm test` covers it in Node.
 */

export type TileConfig = {
  provider: 'maptiler' | 'openstreetmap';
  url: string;
  attribution: string;
  maxZoom: number;
};

const OSM_ATTRIBUTION = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors';

/** A pasted key can carry quotes or spaces; placeholders count as no key. */
export function cleanMapKey(raw: string | undefined | null): string | null {
  const key = (raw ?? '').trim().replace(/^['"]+|['"]+$/g, '').trim();
  if (!key || /\s/.test(key) || /^(your|<|replace|changeme|xxx)/i.test(key)) return null;
  return key;
}

export function mapTiles(rawKey: string | undefined | null): TileConfig {
  const key = cleanMapKey(rawKey);
  if (key) {
    return {
      provider: 'maptiler',
      url: `https://api.maptiler.com/maps/streets-v2/256/{z}/{x}/{y}.png?key=${encodeURIComponent(key)}`,
      attribution: `<a href="https://www.maptiler.com/copyright/" target="_blank">&copy; MapTiler</a> ${OSM_ATTRIBUTION}`,
      maxZoom: 20,
    };
  }
  return {
    provider: 'openstreetmap',
    url: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
    attribution: OSM_ATTRIBUTION,
    maxZoom: 19,
  };
}

/** MapTiler Geocoding search URL, limited to the Philippines. */
export function maptilerGeocodeUrl(query: string, key: string, country = 'ph'): string {
  const params = new URLSearchParams({ key, country, limit: '1' });
  return `https://api.maptiler.com/geocoding/${encodeURIComponent(query.trim())}.json?${params.toString()}`;
}

/** The first hit of a MapTiler Geocoding response (GeoJSON, [lng, lat] order). */
export function parseMaptilerGeocode(body: unknown): { lat: number; lng: number; label: string } | null {
  const features = (body as { features?: unknown })?.features;
  if (!Array.isArray(features) || !features.length) return null;
  const hit = features[0] as { center?: unknown; place_name?: unknown };
  if (!Array.isArray(hit.center) || hit.center.length < 2) return null;
  const lng = Number(hit.center[0]);
  const lat = Number(hit.center[1]);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  return { lat, lng, label: typeof hit.place_name === 'string' ? hit.place_name : '' };
}
