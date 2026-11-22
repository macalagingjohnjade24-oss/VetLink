import type { Clinic } from '../data/mockClinics';
import type { LatLng } from '../lib/geo';
import type { MapPin } from '../lib/leafletHtml';

/** Props shared by the native (MapCanvas.tsx) and web (MapCanvas.web.tsx) maps. */
export type MapCanvasProps = {
  clinics: Clinic[];
  selectedId: string | null;
  onSelect: (clinic: Clinic) => void;
  height?: number;
  /** The owner's position, drawn as a blue dot. */
  user?: LatLng | null;
  /** Bump to re-frame the map around every pin and the user. */
  fitKey?: number;
};

/** Clinics that have a location, as map pins. */
export function mapPins(clinics: Clinic[]): MapPin[] {
  return clinics
    .filter((clinic) => clinic.location)
    .map((clinic) => ({
      id: clinic.id,
      name: clinic.name,
      subtitle: [clinic.address || clinic.area, `${clinic.distanceKm.toFixed(1)} km away`]
        .filter(Boolean)
        .join(' · '),
      lat: clinic.location!.lat,
      lng: clinic.location!.lng,
    }));
}
