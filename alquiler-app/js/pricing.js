// Cálculo de precios: horas, recargo por zona y distancia desde la base.
const CFG = self.APP_SETTINGS || {};
export const BASE = CFG.base || { lat: -17.3926, lng: -66.2786, name: 'la Plaza Bolívar de Quillacollo' };
export const ZONES = CFG.zones || [];

// Se cobra la hora empezada: de 14:00 a 16:30 son 3 horas.
export const hoursOf = (start, end) => (start && end && end > start ? Math.ceil((end - start) / 3600e3 - 1e-9) : null);
export const lineAmount = (i, hours) => (i.price || 0) * i.qty * (i.perHour ? (hours ?? i.hours ?? 1) : 1);
export const calcTotal = (items, start, end, extra = 0) =>
  (items || []).reduce((t, i) => t + lineAmount(i, hoursOf(start, end)), 0) + (+extra || 0);

export function kmBetween(a, b) {
  const R = 6371, r = (x) => (x * Math.PI) / 180;
  const dLat = r(b.lat - a.lat), dLng = r(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(r(a.lat)) * Math.cos(r(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}
export const kmFromBase = (loc) => (loc?.lat ? kmBetween(BASE, loc) : null);

// Zona del lugar: el centro de municipio más cercano (relativo a su tamaño).
// Si queda lejos de todas las zonas con tarifa, devuelve null ("recargo a consultar").
export function zoneOf(loc) {
  if (!loc?.lat || !ZONES.length) return null;
  let best = null, score = Infinity;
  for (const z of ZONES) {
    const s = kmBetween(z, loc) / (z.radiusKm || 4);
    if (s < score) { score = s; best = z; }
  }
  return score <= 1 ? { name: best.name, fee: best.fee } : null;
}
