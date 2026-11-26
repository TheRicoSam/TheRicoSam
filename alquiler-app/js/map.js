// Mapas de Cochabamba (Leaflet + OpenStreetMap) con búsqueda de direcciones.
import { icon, esc } from './ui.js';

const L = self.L;
export const CBBA = { center: [-17.3895, -66.1568], zoom: 13 };
// Área metropolitana + valles (Sipe Sipe, Vinto, Quillacollo, Tiquipaya, Sacaba, Tarata, Punata...)
const BOUNDS = L.latLngBounds([-17.95, -66.75], [-16.95, -65.35]);
const VIEWBOX = '-66.55,-17.20,-65.85,-17.62'; // búsqueda priorizada en el valle central

function baseLayers() {
  const voyager = L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
    maxZoom: 20, subdomains: 'abcd',
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/">CARTO</a>',
  });
  const osm = L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19, attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
  });
  const sat = L.layerGroup([
    L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
      maxZoom: 19, attribution: 'Imágenes &copy; Esri, Maxar, Earthstar Geographics',
    }),
    L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager_only_labels/{z}/{x}/{y}{r}.png', { maxZoom: 20, subdomains: 'abcd' }),
  ]);
  return { 'Calles': voyager, 'Detallado (calles y negocios)': osm, 'Satélite': sat };
}

export function pinIcon(color = '#ea580c', label = '') {
  return L.divIcon({
    className: '', iconSize: [36, 46], iconAnchor: [18, 44], popupAnchor: [0, -40],
    html: `<div class="pin"><svg viewBox="0 0 36 46"><path d="M18 1C8.6 1 1 8.4 1 17.6 1 30 18 45 18 45s17-15 17-27.4C35 8.4 27.4 1 18 1z" fill="${color}" stroke="#fff" stroke-width="2"/>${label ? '' : '<circle cx="18" cy="17" r="6" fill="#fff"/>'}</svg>${label ? `<span>${esc(label)}</span>` : ''}</div>`,
  });
}

export function createMap(el, { center = CBBA.center, zoom = CBBA.zoom, interactive = true, layersControl = true, locate = true } = {}) {
  const map = L.map(el, {
    center, zoom, minZoom: 10, maxZoom: 20, maxBounds: BOUNDS, maxBoundsViscosity: 0.8,
    zoomControl: false, attributionControl: true,
    dragging: interactive, scrollWheelZoom: interactive, touchZoom: interactive, doubleClickZoom: interactive, boxZoom: interactive, keyboard: interactive,
  });
  map.attributionControl.setPrefix(false);
  const layers = baseLayers();
  layers['Calles'].addTo(map);
  if (interactive) L.control.zoom({ position: 'bottomright', zoomInTitle: 'Acercar', zoomOutTitle: 'Alejar' }).addTo(map);
  if (layersControl && interactive) L.control.layers(layers, null, { position: 'topright', collapsed: true }).addTo(map);
  if (locate && interactive) addLocate(map);
  // Leaflet necesita recalcular el tamaño cuando el contenedor aparece/cambia.
  const ro = new ResizeObserver(() => map.invalidateSize());
  ro.observe(el);
  map.on('unload', () => ro.disconnect());
  return map;
}

function addLocate(map, onFound) {
  let meMarker = null;
  const Ctl = L.Control.extend({
    options: { position: 'topright' },
    onAdd() {
      const div = L.DomUtil.create('div', 'leaflet-bar');
      div.innerHTML = `<a class="locate-btn" href="#" title="Mi ubicación" role="button">${icon('locate', 'sm')}</a>`;
      L.DomEvent.disableClickPropagation(div);
      div.querySelector('a').onclick = (e) => {
        e.preventDefault();
        if (!navigator.geolocation) return;
        navigator.geolocation.getCurrentPosition((p) => {
          const ll = [p.coords.latitude, p.coords.longitude];
          meMarker?.remove();
          meMarker = L.marker(ll, { icon: L.divIcon({ className: '', html: '<div class="me-dot"></div>', iconSize: [18, 18] }), interactive: false }).addTo(map);
          map.flyTo(ll, 17);
          map.fire('located', { latlng: L.latLng(ll) });
        }, () => alert('No se pudo obtener tu ubicación. Activa el GPS y da permiso de ubicación.'), { enableHighAccuracy: true, timeout: 12000 });
      };
      return div;
    },
  });
  new Ctl().addTo(map);
}

// ---------- geocodificación (OpenStreetMap Nominatim) ----------
let lastCall = 0;
async function throttle() {
  const wait = Math.max(0, 1100 - (Date.now() - lastCall));
  if (wait) await new Promise((r) => setTimeout(r, wait));
  lastCall = Date.now();
}

export async function searchPlaces(q) {
  await throttle();
  const url = `https://nominatim.openstreetmap.org/search?format=jsonv2&addressdetails=1&limit=7&countrycodes=bo&accept-language=es&viewbox=${VIEWBOX}&bounded=0&q=${encodeURIComponent(q + (/cochabamba/i.test(q) ? '' : ', Cochabamba'))}`;
  const res = await fetch(url, { headers: { Accept: 'application/json' } });
  if (!res.ok) throw new Error('No se pudo buscar');
  return (await res.json()).map((r) => ({ lat: +r.lat, lng: +r.lon, name: r.name || r.display_name.split(',')[0], address: shortAddress(r) }));
}

export async function reverseGeocode(lat, lng) {
  try {
    await throttle();
    const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=jsonv2&addressdetails=1&zoom=18&accept-language=es&lat=${lat}&lon=${lng}`);
    if (!res.ok) return '';
    return shortAddress(await res.json());
  } catch { return ''; }
}

function shortAddress(r) {
  const a = r.address || {};
  const street = [a.road || a.pedestrian || a.footway, a.house_number].filter(Boolean).join(' ');
  const parts = [r.name && r.name !== a.road ? r.name : '', street, a.neighbourhood || a.suburb || a.quarter, a.city || a.town || a.village || a.municipality]
    .filter(Boolean);
  const uniq = [...new Set(parts)];
  return uniq.join(', ') || r.display_name || '';
}

// ---------- selector de ubicación ----------
export function locationPicker(wrapEl, { value, onChange }) {
  wrapEl.innerHTML = `
    <div class="map-wrap">
      <div class="map" id="pick-map"></div>
      <div class="map-search">
        <form autocomplete="off"><input type="search" placeholder="Busca calle, zona, plaza o lugar…" aria-label="Buscar dirección"><button type="submit" aria-label="Buscar">${icon('search')}</button></form>
        <div class="map-results hidden"></div>
      </div>
      <div class="map-hint">Toca el mapa o arrastra el pin al lugar exacto</div>
    </div>`;
  const map = createMap(wrapEl.querySelector('#pick-map'), { center: value ? [value.lat, value.lng] : CBBA.center, zoom: value ? 17 : 13 });
  let marker = null;
  const hint = wrapEl.querySelector('.map-hint');

  const setPoint = async (latlng, address) => {
    if (!marker) {
      marker = L.marker(latlng, { draggable: true, icon: pinIcon('#ea580c') }).addTo(map);
      marker.on('dragend', () => setPoint(marker.getLatLng()));
    } else marker.setLatLng(latlng);
    hint.classList.add('hidden');
    const pos = { lat: +latlng.lat.toFixed(6), lng: +latlng.lng.toFixed(6) };
    onChange({ ...pos, address: address ?? null, resolving: address == null });
    if (address == null) {
      const addr = await reverseGeocode(pos.lat, pos.lng);
      onChange({ ...pos, address: addr, resolving: false });
    }
  };

  if (value) setPoint(L.latLng(value.lat, value.lng), value.address || '');
  map.on('click', (e) => setPoint(e.latlng));
  map.on('located', (e) => setPoint(e.latlng));

  const form = wrapEl.querySelector('form');
  const results = wrapEl.querySelector('.map-results');
  L.DomEvent.disableClickPropagation(wrapEl.querySelector('.map-search'));
  form.onsubmit = async (e) => {
    e.preventDefault();
    const q = form.querySelector('input').value.trim();
    if (q.length < 3) return;
    results.classList.remove('hidden');
    results.innerHTML = '<div style="padding:12px 14px" class="small muted">Buscando…</div>';
    try {
      const found = await searchPlaces(q);
      results.innerHTML = found.length
        ? found.map((r, i) => `<button type="button" data-i="${i}">${icon('pin', 'sm')}<span><b>${esc(r.name)}</b><br><span class="muted">${esc(r.address)}</span></span></button>`).join('')
        : '<div style="padding:12px 14px" class="small muted">Sin resultados. Prueba con otra referencia o marca el punto en el mapa.</div>';
      results.querySelectorAll('button').forEach((b) => (b.onclick = () => {
        const r = found[+b.dataset.i];
        results.classList.add('hidden');
        map.flyTo([r.lat, r.lng], 18);
        setPoint(L.latLng(r.lat, r.lng), r.address);
      }));
    } catch {
      results.innerHTML = '<div style="padding:12px 14px" class="small muted">No se pudo buscar. Revisa tu conexión.</div>';
    }
  };
  return map;
}
