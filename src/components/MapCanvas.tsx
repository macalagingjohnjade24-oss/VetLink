import { useEffect, useMemo, useRef } from 'react';
import { StyleSheet, View } from 'react-native';
import { WebView, type WebViewMessageEvent } from 'react-native-webview';
import { DEFAULT_CENTER } from '../lib/geo';
import { leafletHtml, type MapState } from '../lib/leafletHtml';
import { mapPins, type MapCanvasProps } from './mapPins';
import { colors, radii } from '../theme';

// react-native-webview 14 types default the props generic to `undefined`,
// which turns every prop into `never` under React 19 types; `object` fixes it.
const MapWebView = WebView<object>;

/**
 * Real clinic map (OpenStreetMap via Leaflet) in a WebView — free, no API key,
 * and it runs in Expo Go. The web build uses MapCanvas.web.tsx (an iframe).
 */
export function MapCanvas({ clinics, selectedId, onSelect, height = 360, user = null, fitKey = 0 }: MapCanvasProps) {
  const ref = useRef<WebView<object>>(null);
  const ready = useRef(false);
  const lastFit = useRef(-1);
  // The page is built once; data changes are pushed into it, so the map does
  // not reload (and lose its zoom) every time a pin is selected.
  const html = useMemo(() => leafletHtml(clinics[0]?.location ?? user ?? DEFAULT_CENTER, colors.brand.primary), []);

  const push = () => {
    if (!ready.current) return;
    const state: MapState = { pins: mapPins(clinics), selectedId, user, fit: lastFit.current !== fitKey };
    lastFit.current = fitKey;
    ref.current?.injectJavaScript(`window.vlSet && window.vlSet(${JSON.stringify(state)}); true;`);
  };

  useEffect(push, [clinics, selectedId, user, fitKey]);

  const onMessage = (event: WebViewMessageEvent) => {
    try {
      const msg = JSON.parse(event.nativeEvent.data) as { type: string; id?: string };
      if (msg.type === 'ready') {
        ready.current = true;
        lastFit.current = -1;
        push();
      } else if (msg.type === 'select') {
        const clinic = clinics.find((item) => item.id === msg.id);
        if (clinic) onSelect(clinic);
      }
    } catch {
      // Ignore anything that is not one of the map's own messages.
    }
  };

  return (
    <View style={[styles.map, { height }]}>
      <MapWebView
        ref={ref}
        source={{ html, baseUrl: 'https://localhost/' }}
        originWhitelist={['*']}
        onMessage={onMessage}
        javaScriptEnabled
        domStorageEnabled
        setSupportMultipleWindows={false}
        style={styles.web}
      />
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
  web: { flex: 1, backgroundColor: 'transparent' },
});
