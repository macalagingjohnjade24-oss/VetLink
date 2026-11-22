import { createElement, useEffect, useMemo, useRef } from 'react';
import { StyleSheet, View } from 'react-native';
import { DEFAULT_CENTER } from '../lib/geo';
import { leafletHtml, type MapState } from '../lib/leafletHtml';
import { colors, radii } from '../theme';
import { mapPins, type MapCanvasProps } from './mapPins';

type MapWindow = Window & { vlSet?: (state: MapState) => void };

/** Web build of the clinic map: the same Leaflet page in a same-origin iframe. */
export function MapCanvas({ clinics, selectedId, onSelect, height = 360, user = null, fitKey = 0 }: MapCanvasProps) {
  const frame = useRef<HTMLIFrameElement | null>(null);
  const ready = useRef(false);
  const lastFit = useRef(-1);
  const html = useMemo(() => leafletHtml(clinics[0]?.location ?? user ?? DEFAULT_CENTER, colors.brand.primary), []);
  const latest = useRef({ clinics, onSelect });
  latest.current = { clinics, onSelect };

  const push = () => {
    const target = frame.current?.contentWindow as MapWindow | null | undefined;
    if (!ready.current || !target?.vlSet) return;
    target.vlSet({ pins: mapPins(clinics), selectedId, user, fit: lastFit.current !== fitKey });
    lastFit.current = fitKey;
  };

  useEffect(push, [clinics, selectedId, user, fitKey]);

  useEffect(() => {
    const onMessage = (event: MessageEvent) => {
      if (event.source !== frame.current?.contentWindow) return;
      const msg = (event.data as { vetlinkMap?: { type: string; id?: string } })?.vetlinkMap;
      if (!msg) return;
      if (msg.type === 'ready') {
        ready.current = true;
        lastFit.current = -1;
        push();
      } else if (msg.type === 'select') {
        const clinic = latest.current.clinics.find((item) => item.id === msg.id);
        if (clinic) latest.current.onSelect(clinic);
      }
    };
    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  });

  return (
    <View style={[styles.map, { height }]}>
      {createElement('iframe', {
        ref: frame,
        srcDoc: html,
        title: 'Clinic map',
        style: { border: 0, width: '100%', height: '100%' },
      })}
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
});
