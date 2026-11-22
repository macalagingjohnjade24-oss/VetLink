import type { LatLng } from './geo';
import type { TileConfig } from './mapTiles';

/**
 * The clinic map page, shared by the native WebView and the web iframe.
 *
 * Leaflet with MapTiler tiles (EXPO_PUBLIC_MAPTILER_KEY) or, without a key,
 * OpenStreetMap's free tiles. The
 * page talks to the app with JSON messages:
 *   in:  window.vlSet({ pins, selectedId, user, fit })
 *   out: { type: 'select', id }   — a pin was tapped
 *        { type: 'ready' }        — the map can receive data
 */

export type MapPin = { id: string; name: string; subtitle: string; lat: number; lng: number };

export type MapState = {
  pins: MapPin[];
  selectedId: string | null;
  user: LatLng | null;
  /** Re-frame the map around the pins (and the user) on this update. */
  fit: boolean;
};

const LEAFLET = 'https://unpkg.com/leaflet@1.9.4/dist';

export function leafletHtml(center: LatLng, brand: string, tiles: TileConfig): string {
  return `<!doctype html>
<html><head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1" />
<link rel="stylesheet" href="${LEAFLET}/leaflet.css" />
<script src="${LEAFLET}/leaflet.js"></script>
<style>
  html, body, #map { height: 100%; margin: 0; background: #eef2f5; }
  .vl-pin { width: 26px; height: 26px; border-radius: 50% 50% 50% 0; background: ${brand};
    transform: rotate(-45deg); border: 2px solid #fff; box-shadow: 0 2px 6px rgba(0,0,0,.35); }
  .vl-pin--on { width: 34px; height: 34px; background: #ff6b00; }
  .vl-me { width: 16px; height: 16px; border-radius: 50%; background: #3185d6; border: 3px solid #fff;
    box-shadow: 0 0 0 6px rgba(49,133,214,.25); }
  .leaflet-popup-content { margin: 10px 12px; font: 13px/1.35 -apple-system, Segoe UI, Roboto, sans-serif; }
  .leaflet-popup-content b { color: ${brand}; }
  #err { display: none; position: absolute; inset: 0; align-items: center; justify-content: center;
    text-align: center; padding: 24px; color: #64748b; font: 14px sans-serif; }
</style>
</head><body>
<div id="map"></div>
<div id="err">The map needs an internet connection to load.</div>
<script>
(function () {
  function send(msg) {
    var text = JSON.stringify(msg);
    if (window.ReactNativeWebView) window.ReactNativeWebView.postMessage(text);
    else if (window.parent !== window) window.parent.postMessage({ vetlinkMap: msg }, '*');
  }
  if (!window.L) { document.getElementById('err').style.display = 'flex'; return; }

  var map = L.map('map', { zoomControl: true, attributionControl: true })
    .setView([${center.lat}, ${center.lng}], 12);
  L.tileLayer(${JSON.stringify(tiles.url)}, {
    maxZoom: ${tiles.maxZoom},
    attribution: ${JSON.stringify(tiles.attribution)}
  }).addTo(map);

  var markers = {};
  var me = null;
  var fitted = false;

  function icon(on) {
    return L.divIcon({ className: '', html: '<div class="vl-pin' + (on ? ' vl-pin--on' : '') + '"></div>',
      iconSize: on ? [34, 34] : [26, 26], iconAnchor: on ? [17, 34] : [13, 26], popupAnchor: [0, -28] });
  }
  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) {
    return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }

  window.vlSet = function (state) {
    var seen = {};
    state.pins.forEach(function (pin) {
      seen[pin.id] = true;
      var on = pin.id === state.selectedId;
      var m = markers[pin.id];
      if (!m) {
        m = L.marker([pin.lat, pin.lng]).addTo(map);
        m.on('click', function () { send({ type: 'select', id: pin.id }); });
        markers[pin.id] = m;
      }
      m.setLatLng([pin.lat, pin.lng]).setIcon(icon(on)).setZIndexOffset(on ? 1000 : 0);
      m.bindPopup('<b>' + esc(pin.name) + '</b><br>' + esc(pin.subtitle));
      if (on && !state.fit) { m.openPopup(); map.panTo([pin.lat, pin.lng]); }
    });
    Object.keys(markers).forEach(function (id) {
      if (!seen[id]) { map.removeLayer(markers[id]); delete markers[id]; }
    });

    if (state.user) {
      var at = [state.user.lat, state.user.lng];
      if (!me) me = L.marker(at, { icon: L.divIcon({ className: '', html: '<div class="vl-me"></div>',
        iconSize: [16, 16], iconAnchor: [8, 8] }), zIndexOffset: 2000 }).addTo(map).bindPopup('You are here');
      else me.setLatLng(at);
    }

    if (state.fit || !fitted) {
      var points = state.pins.map(function (p) { return [p.lat, p.lng]; });
      if (state.user) points.push([state.user.lat, state.user.lng]);
      if (points.length === 1) map.setView(points[0], 15);
      else if (points.length > 1) map.fitBounds(points, { padding: [36, 36], maxZoom: 15 });
      fitted = points.length > 0;
    }
  };
  send({ type: 'ready' });
})();
</script>
</body></html>`;
}
