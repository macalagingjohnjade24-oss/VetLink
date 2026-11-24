import { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { DEFAULT_CENTER, geocodeAddress, roundCoord, type GeoPoint } from '@/lib/geocode';
import { mapTiles, type TileConfig } from '@/lib/mapTiles';
import { Button } from './Button';

const pinIcon = L.divIcon({
  className: '',
  html: '<div class="map-pin"></div>',
  iconSize: [30, 30],
  iconAnchor: [15, 30],
});

/** MapTiler when VITE_MAPTILER_KEY is set, OpenStreetMap otherwise. */
const MAP_KEY = import.meta.env.VITE_MAPTILER_KEY;
const TILES = mapTiles(MAP_KEY);

/**
 * MapTiler answers a refused key (locked to the mobile app, invalid, over
 * quota) with a 403 *image* reading "Invalid key", which the browser draws
 * instead of reporting an error. So try one tile first and use
 * OpenStreetMap's tiles unless MapTiler accepts this site. Checked once.
 */
let tilesCheck: Promise<TileConfig> | null = null;
function usableTiles(): Promise<TileConfig> {
  if (TILES.provider !== 'maptiler') return Promise.resolve(TILES);
  tilesCheck ??= fetch(TILES.url.replace('{z}/{x}/{y}', '0/0/0'))
    .then((response) => (response.ok ? TILES : mapTiles(null)))
    .catch(() => mapTiles(null));
  return tilesCheck;
}

/**
 * Pick a clinic's location on a map (Leaflet; MapTiler tiles when
 * VITE_MAPTILER_KEY is set, free OpenStreetMap tiles otherwise).
 * Click the map or drag the pin, search the address, or use this device's
 * location. With `readOnly` it just shows where the clinic is.
 */
export function LocationPicker({
  value,
  onChange,
  address = '',
  readOnly = false,
  height = 300,
}: {
  value: GeoPoint | null;
  onChange?: (point: GeoPoint) => void;
  /** The typed address, searched by "Find address". */
  address?: string;
  readOnly?: boolean;
  height?: number;
}) {
  const box = useRef<HTMLDivElement>(null);
  const map = useRef<L.Map | null>(null);
  const marker = useRef<L.Marker | null>(null);
  const changed = useRef(onChange);
  changed.current = onChange;
  const [busy, setBusy] = useState<'search' | 'locate' | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const place = (point: GeoPoint, pan = true) => {
    const at: L.LatLngExpression = [point.lat, point.lng];
    if (!map.current) return;
    if (!marker.current) {
      marker.current = L.marker(at, { icon: pinIcon, draggable: !readOnly }).addTo(map.current);
      marker.current.on('dragend', () => {
        const ll = marker.current!.getLatLng();
        changed.current?.({ lat: roundCoord(ll.lat), lng: roundCoord(ll.lng) });
      });
    } else {
      marker.current.setLatLng(at);
    }
    if (pan) map.current.setView(at, Math.max(map.current.getZoom(), 16));
  };

  // Create the map once.
  useEffect(() => {
    if (!box.current || map.current) return;
    const start = value ?? DEFAULT_CENTER;
    const instance = L.map(box.current, { scrollWheelZoom: false }).setView([start.lat, start.lng], value ? 16 : 11);
    void usableTiles().then((tiles) => {
      if (map.current !== instance) return;
      L.tileLayer(tiles.url, { maxZoom: tiles.maxZoom, attribution: tiles.attribution }).addTo(instance);
    });
    if (!readOnly) {
      instance.on('click', (event: L.LeafletMouseEvent) => {
        changed.current?.({ lat: roundCoord(event.latlng.lat), lng: roundCoord(event.latlng.lng) });
      });
    }
    map.current = instance;
    if (value) place(value, false);
    // The container can change size after layout (grids, tabs); re-measure once.
    const timer = window.setTimeout(() => instance.invalidateSize(), 200);
    return () => {
      window.clearTimeout(timer);
      instance.remove();
      map.current = null;
      marker.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [readOnly]);

  // Follow the value when it is typed in the fields or set from a search.
  useEffect(() => {
    if (!value || !map.current) return;
    const current = marker.current?.getLatLng();
    if (current && current.lat === value.lat && current.lng === value.lng) return;
    place(value, true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value?.lat, value?.lng]);

  const findAddress = async () => {
    setBusy('search');
    setMessage(null);
    try {
      const hit = await geocodeAddress(address, MAP_KEY);
      if (!hit) {
        setMessage('That address was not found. Click the map where the clinic is instead.');
        return;
      }
      changed.current?.({ lat: roundCoord(hit.lat), lng: roundCoord(hit.lng) });
      setMessage(`Found: ${hit.label}. Drag the pin to the exact entrance if needed.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : String(error));
    } finally {
      setBusy(null);
    }
  };

  const useMyLocation = () => {
    if (!navigator.geolocation) {
      setMessage('This browser cannot share its location. Click the map instead.');
      return;
    }
    setBusy('locate');
    setMessage(null);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setBusy(null);
        changed.current?.({ lat: roundCoord(position.coords.latitude), lng: roundCoord(position.coords.longitude) });
      },
      () => {
        setBusy(null);
        setMessage('Location was not shared. Click the map where the clinic is instead.');
      },
      { enableHighAccuracy: true, timeout: 10000 },
    );
  };

  return (
    <div className="location-picker">
      {readOnly ? null : (
        <div className="location-picker__tools">
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => void findAddress()}
            loading={busy === 'search'}
            disabled={!address.trim() || busy !== null}
          >
            Find address on map
          </Button>
          <Button type="button" size="sm" variant="ghost" onClick={useMyLocation} loading={busy === 'locate'} disabled={busy !== null}>
            Use my current location
          </Button>
        </div>
      )}
      <div ref={box} className="location-picker__map" style={{ height }} role="application" aria-label="Clinic location map" />
      <p className="field__hint">
        {message ??
          (readOnly
            ? value
              ? 'Shown to pet owners in the VetLink app.'
              : 'No location set yet.'
            : value
              ? 'Drag the pin, or click the map, to adjust the location.'
              : 'Click the map where the clinic is, or search the address.')}
      </p>
    </div>
  );
}
