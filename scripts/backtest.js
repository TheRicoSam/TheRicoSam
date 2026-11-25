// Compara el cálculo actual de la app con el nuevo motor usando las boletas reales.
// Uso: node scripts/backtest.js
import { basePlan, estimateTrip, MIN } from '../src/eta-realista.js';
import { PLACES, RECEIPTS } from './datos-app.js';

// Cálculo actual de la app (copiado del código publicado).
function appActual(p) {
  const farm = p.kind === 'farm';
  const r = (m) => Math.max(10, Math.ceil(m / 5) * 5);
  const out = p.outMin == null ? 35 : r(p.outMin * (farm ? 1.35 : 1.6));
  const inn = p.inMin == null ? 35 : r(p.inMin * (farm ? 1.6 : 1.35));
  return out + (farm ? 120 : 60) + inn;
}

const fmt = (m) => `${Math.floor(m / 60)} h ${String(Math.round(m % 60)).padStart(2, '0')}`;
const pad = (s, n) => String(s).padEnd(n);

const rows = RECEIPTS.map((b) => {
  const place = PLACES.find((p) => p.name === b.zone);
  const real = (b.closed - b.first) / MIN;
  const before = appActual(place);
  const after = basePlan(place, b.first).total;
  return { b, place, real, before, after };
});

console.log(pad('Boleta', 8), pad('Zona', 12), pad('Real', 9), pad('App hoy', 10), pad('Error', 9), pad('Nuevo', 9), 'Error');
for (const r of rows)
  console.log(
    pad(r.b.ticket, 8), pad(r.b.zone, 12), pad(fmt(r.real), 9),
    pad(fmt(r.before), 10), pad(Math.round(r.before - r.real) + ' min', 9),
    pad(fmt(r.after), 9), Math.round(r.after - r.real) + ' min',
  );
const mae = (k) => Math.round(rows.reduce((s, r) => s + Math.abs(r[k] - r.real), 0) / rows.length);
console.log(`\nError medio absoluto · app hoy: ${mae('before')} min · nuevo (sin historial): ${mae('after')} min`);

// Nota sobre el historial.
console.log(`(Cada zona tiene 1 boleta; el historial se vuelve útil a partir de 2–3 viajes por destino.)`);
