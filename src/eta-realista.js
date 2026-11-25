// LA PRECISA · Motor de llegadas realista
// ----------------------------------------------------------------------------
// Reemplaza el cálculo de "Regreso estimado a la balanza" de la app.
// Funciones puras, sin dependencias. Trabaja con los mismos datos que la app:
//
//   destino (place): { id, kind: 'farm'|'plant', outMin, inMin, outKm, inKm, plan? }
//   viaje (trip):    { id, kind, destination, status: 'active'|'done'|'cancelled',
//                      first, left, returned, learning, eta? }   (horas en ms)
//
// Ideas principales (ver docs/MEJORAS.md):
//   1. Cada tramo se calcula a la hora en que realmente ocurre (ida, carga, vuelta),
//      con tráfico por franja horaria en la parte urbana de la ruta.
//   2. Camión vacío y cargado no van a la misma velocidad.
//   3. Tiempos fijos reales: acceso a granja, espera de carga, cola en balanza.
//   4. El historial corrige el sesgo (residuo real − modelo), pesando más los
//      viajes recientes y en horarios parecidos, y descartando atípicos solos.
//   5. Siempre hay una ventana de llegada (aunque no haya historial).
//   6. Si el camión ya pasó su hora y no llegó, la estimación se mueve hacia
//      adelante en vez de quedarse "en el pasado".
//   7. Si varios camiones llegan juntos, se calcula el turno en la balanza.
// ----------------------------------------------------------------------------

export const MIN = 60_000;
const DAY_MIN = 1440;
const BO_OFFSET = -4 * 60; // Bolivia UTC-4, sin horario de verano

// Parámetros calibrados con las boletas 081122–081140 (ver scripts/backtest.js).
// Se pueden ajustar sin tocar el resto del código.
export const CONFIG = {
  // Multiplicador sobre el tiempo de auto (OSRM) en carretera libre.
  truck: { empty: 1.2, loaded: 1.4 },
  // Parte de la ruta que es urbana y sufre tráfico: los primeros km.
  urbanKm: 18,
  // Tráfico en la parte urbana por hora local (0–23). Lunes a viernes.
  trafficWeekday: [
    0.85, 0.85, 0.85, 0.85, 0.9, 1.0, 1.15, 1.45, 1.4, 1.15, 1.1, 1.15,
    1.35, 1.35, 1.15, 1.1, 1.15, 1.4, 1.5, 1.35, 1.15, 1.0, 0.95, 0.9,
  ],
  // Sábado: pico solo al mediodía. Domingo: casi libre.
  trafficSaturday: [
    0.85, 0.85, 0.85, 0.85, 0.85, 0.9, 1.0, 1.1, 1.15, 1.2, 1.2, 1.25,
    1.3, 1.25, 1.15, 1.1, 1.1, 1.15, 1.2, 1.15, 1.05, 1.0, 0.95, 0.9,
  ],
  trafficSunday: [
    0.85, 0.85, 0.85, 0.85, 0.85, 0.85, 0.9, 0.95, 1.0, 1.05, 1.1, 1.1,
    1.15, 1.1, 1.05, 1.05, 1.05, 1.1, 1.15, 1.1, 1.0, 0.95, 0.9, 0.85,
  ],
  // Tiempos fijos (min).
  farmAccess: 10, // tramo de tierra / portón / maniobra en la granja (ida+vuelta)
  service: { farm: 210, plant: 75 }, // espera + carga de pollos | espera + descarga
  scaleQueue: 10, // espera para pesar al volver
  weighMinutes: 6, // lo que ocupa un camión en la balanza (para turnos)
  noRouteLeg: 40, // tramo sin ruta medida
  // Aprendizaje.
  halfLifeDays: 30, // un viaje de hace 30 días pesa la mitad
  hourSigmaMin: 120, // similitud de horario (campana de ±2 h)
  otherDayTypeWeight: 0.5, // fin de semana vs día hábil
  priorStrength: 2, // cuántos "viajes" vale el modelo base
  maxHistory: 40,
  outlierMad: 3.5, // descarta residuos a más de 3,5 MAD
};

// ---------- utilidades de hora local ----------
const localMinuteOfDay = (t) =>
  ((Math.floor(t / MIN) + BO_OFFSET) % DAY_MIN + DAY_MIN) % DAY_MIN;
const localDow = (t) => new Date(t + BO_OFFSET * MIN).getUTCDay();
const isWeekend = (t) => {
  const d = localDow(t);
  return d === 0 || d === 6;
};
const round5 = (m) => Math.round(m / 5) * 5;

export function trafficFactor(t, cfg = CONFIG) {
  const d = localDow(t);
  const table =
    d === 0 ? cfg.trafficSunday : d === 6 ? cfg.trafficSaturday : cfg.trafficWeekday;
  // Interpolación suave entre horas para no tener saltos de 15 min a las :00.
  const m = localMinuteOfDay(t);
  const h = Math.floor(m / 60);
  const f = (m % 60) / 60;
  return table[h] * (1 - f) + table[(h + 1) % 24] * f;
}

// ---------- tramo de carretera ----------
// baseMin: minutos de auto (OSRM). km: distancia. start: hora de salida.
export function legMinutes(baseMin, km, start, loaded, cfg = CONFIG) {
  if (baseMin == null) return cfg.noRouteLeg;
  const truck = loaded ? cfg.truck.loaded : cfg.truck.empty;
  const urbanShare = km ? Math.min(1, cfg.urbanKm / km) : 1;
  const urban = baseMin * urbanShare;
  const rural = baseMin - urban;
  // El tráfico se evalúa a mitad del tramo urbano.
  const tf = trafficFactor(start + (urban * truck * MIN) / 2, cfg);
  return urban * truck * tf + rural * truck;
}

// ---------- modelo base encadenado ----------
// Devuelve los minutos de cada parte, evaluadas a la hora en que ocurren.
export function basePlan(place, start, cfg = CONFIG) {
  if (place.plan) {
    const p = place.plan;
    return { outbound: p.outbound, service: p.service, inbound: p.inbound, fixed: 0, total: p.outbound + p.service + p.inbound, manual: true };
  }
  const farm = place.kind === 'farm';
  // Granja: va vacío, vuelve cargado. Matadero: va cargado, vuelve vacío.
  const outbound = legMinutes(place.outMin, place.outKm, start, !farm, cfg);
  const service = cfg.service[place.kind] ?? 60;
  const backStart = start + (outbound + service) * MIN;
  const inbound = legMinutes(place.inMin, place.inKm, backStart, farm, cfg);
  const fixed = (farm ? cfg.farmAccess : 0) + cfg.scaleQueue;
  return {
    outbound: round5(outbound),
    service,
    inbound: round5(inbound),
    fixed,
    total: outbound + service + inbound + fixed,
    manual: false,
  };
}

// Solo la vuelta, desde la salida del destino.
export function baseReturn(place, left, cfg = CONFIG) {
  if (place.plan) return place.plan.inbound;
  const farm = place.kind === 'farm';
  return (
    legMinutes(place.inMin, place.inKm, left, farm, cfg) +
    (farm ? cfg.farmAccess / 2 : 0) +
    cfg.scaleQueue
  );
}

// ---------- estadística ponderada ----------
function weightedQuantile(items, q) {
  // items: [{v, w}] ordenados por v
  // Cada valor se ubica en el centro de su peso acumulado y se interpola.
  const total = items.reduce((s, i) => s + i.w, 0);
  if (!total) return NaN;
  let acc = 0;
  const pos = items.map((i) => {
    const p = (acc + i.w / 2) / total;
    acc += i.w;
    return p;
  });
  if (q <= pos[0]) return items[0].v;
  for (let k = 1; k < items.length; k++) {
    if (q <= pos[k]) {
      const f = (q - pos[k - 1]) / (pos[k] - pos[k - 1]);
      return items[k - 1].v + (items[k].v - items[k - 1].v) * f;
    }
  }
  return items[items.length - 1].v;
}

function median(values) {
  const s = [...values].sort((a, b) => a - b);
  const n = s.length;
  return n % 2 ? s[(n - 1) / 2] : (s[n / 2 - 1] + s[n / 2]) / 2;
}

// ---------- historial ----------
// field: 'first' (viaje completo) o 'left' (solo la vuelta).
export function historyResiduals(place, trips, at, field, cfg = CONFIG) {
  const rows = [];
  for (const t of trips) {
    const s = t[field];
    if (
      t.destination !== place.id ||
      t.kind !== place.kind ||
      t.status !== 'done' ||
      t.learning === 0 ||
      s == null ||
      t.returned == null ||
      t.returned <= s ||
      t.returned > at
    )
      continue;
    const actual = (t.returned - s) / MIN;
    const model = field === 'first' ? basePlan(place, s, cfg).total : baseReturn(place, s, cfg);
    rows.push({ at: s, id: t.id, actual, residual: actual - model });
  }
  rows.sort((a, b) => b.at - a.at || String(b.id).localeCompare(String(a.id)));
  let recent = rows.slice(0, cfg.maxHistory);

  // Atípicos automáticos (además de los marcados a mano como "atípico").
  let outliers = 0;
  if (recent.length >= 4) {
    const med = median(recent.map((r) => r.residual));
    const mad = median(recent.map((r) => Math.abs(r.residual - med))) || 10;
    const kept = recent.filter((r) => Math.abs(r.residual - med) <= cfg.outlierMad * 1.4826 * mad);
    outliers = recent.length - kept.length;
    recent = kept;
  }

  const atMin = localMinuteOfDay(at);
  const weekend = isWeekend(at);
  for (const r of recent) {
    const ageDays = Math.max(0, (at - r.at) / 86_400_000);
    const d = Math.abs(localMinuteOfDay(r.at) - atMin);
    const dh = Math.min(d, DAY_MIN - d);
    r.w =
      Math.pow(0.5, ageDays / cfg.halfLifeDays) *
      Math.exp(-0.5 * (dh / cfg.hourSigmaMin) ** 2) *
      (isWeekend(r.at) === weekend ? 1 : cfg.otherDayTypeWeight);
  }
  return { rows: recent, outliers };
}

// ---------- estimación principal ----------
function combine(base, hist, cfg) {
  const items = hist.rows
    .filter((r) => r.w > 1e-4)
    .map((r) => ({ v: r.residual, w: r.w }))
    .sort((a, b) => a.v - b.v);
  const sw = items.reduce((s, i) => s + i.w, 0);
  const sw2 = items.reduce((s, i) => s + i.w * i.w, 0);
  const nEff = sw2 ? (sw * sw) / sw2 : 0;
  // Cuánto creemos al historial frente al modelo.
  const trust = nEff / (nEff + cfg.priorStrength);

  // Dispersión a priori: los camiones se atrasan más de lo que se adelantan.
  const priorLow = -(0.07 * base + 5);
  const priorHigh = 0.18 * base + 10;

  let shift = 0;
  let low = priorLow;
  let high = priorHigh;
  if (items.length) {
    shift = trust * weightedQuantile(items, 0.5);
    if (items.length >= 3) {
      const q1 = weightedQuantile(items, 0.15) - weightedQuantile(items, 0.5);
      const q9 = weightedQuantile(items, 0.85) - weightedQuantile(items, 0.5);
      low = trust * Math.min(-5, q1) + (1 - trust) * priorLow;
      high = trust * Math.max(5, q9) + (1 - trust) * priorHigh;
    }
  }
  const minutes = Math.max(5, Math.round(base + shift));
  return {
    minutes,
    earliest: Math.max(1, Math.floor((minutes + low) / 5) * 5),
    latest: Math.ceil((minutes + high) / 5) * 5,
    count: hist.rows.length,
    effective: Math.round(nEff * 10) / 10,
    outliers: hist.outliers,
    trust: Math.round(trust * 100),
  };
}

const basisOf = (r, place, prefix) =>
  r.count === 0
    ? place.plan
      ? prefix + 'operator'
      : place.outKm == null
        ? prefix + 'provisional'
        : prefix + 'road'
    : r.effective >= 3
      ? prefix + 'history'
      : prefix + 'history-start';

// Viaje completo desde la primera llegada a la balanza.
export function estimateTrip(place, trips, first, cfg = CONFIG) {
  const plan = basePlan(place, first, cfg);
  const r = combine(plan.total, historyResiduals(place, trips, first, 'first', cfg), cfg);
  return { ...r, plan, basis: basisOf(r, place, ''), ...toTimes(first, r) };
}

// Vuelta desde que se registró la salida del destino.
export function estimateReturn(place, trips, left, manualMinutes, cfg = CONFIG) {
  if (manualMinutes !== undefined) {
    const r = { minutes: manualMinutes, earliest: null, latest: null, count: 0, effective: 0, outliers: 0, trust: 0 };
    return { ...r, basis: 'return-manual', ...toTimes(left, r) };
  }
  const base = baseReturn(place, left, cfg);
  const r = combine(base, historyResiduals(place, trips, left, 'left', cfg), cfg);
  return { ...r, basis: basisOf(r, place, 'return-'), ...toTimes(left, r) };
}

function toTimes(start, r) {
  return {
    eta: start + r.minutes * MIN,
    etaMin: r.earliest == null ? null : start + r.earliest * MIN,
    etaMax: r.latest == null ? null : start + r.latest * MIN,
  };
}

// ---------- estimación en vivo ----------
// Si ya pasó la hora estimada y el camión no llegó, la llegada se mueve hacia
// adelante: sabemos que el viaje dura MÁS que lo transcurrido.
export function liveEta(trip, place, trips, now, cfg = CONFIG) {
  if (trip.status !== 'active') return null;
  const fromLeft = trip.left != null;
  const start = fromLeft ? trip.left : trip.first;
  const est = fromLeft
    ? estimateReturn(place, trips, start, undefined, cfg)
    : estimateTrip(place, trips, start, cfg);
  const eta = trip.eta ?? est.eta;
  const etaMax = trip.etaMax ?? est.etaMax ?? eta;
  if (now < eta) return { eta, etaMin: trip.etaMin ?? est.etaMin, etaMax, late: false, lateBy: 0 };

  const elapsed = (now - start) / MIN;
  const planned = (eta - start) / MIN;
  // Duraciones reales de este destino que superaron lo transcurrido.
  const hist = historyResiduals(place, trips, start, fromLeft ? 'left' : 'first', cfg).rows;
  const longer = hist.map((r) => r.actual).filter((d) => d > elapsed);
  let remaining;
  if (longer.length >= 2) remaining = median(longer) - elapsed;
  else remaining = 0.1 * planned + 0.25 * (elapsed - planned) + 5; // cuanto más tarde, más margen
  remaining = Math.max(5, Math.round(remaining));
  const revised = now + remaining * MIN;
  return {
    eta: revised,
    etaMin: now,
    etaMax: now + Math.ceil(remaining * 2) * MIN,
    late: true,
    lateBy: Math.round((now - eta) / MIN),
    beyondWindow: now >= etaMax,
  };
}

// ---------- turnos en la balanza ----------
// Si varios camiones llegan casi juntos, no todos pesan a la vez.
export function scaleTurns(activeTrips, cfg = CONFIG) {
  const sorted = activeTrips.filter((t) => t.eta != null).sort((a, b) => a.eta - b.eta);
  let free = -Infinity;
  return sorted.map((t, i) => {
    const turn = Math.max(t.eta, free);
    free = turn + cfg.weighMinutes * MIN;
    return { id: t.id, position: i + 1, turn, waitMin: Math.round((turn - t.eta) / MIN) };
  });
}

// ---------- textos para la interfaz ----------
export const BASIS_TEXT = {
  history: 'Historial de este destino, ajustado al horario y tráfico',
  'history-start': 'Modelo de ruta y tráfico, corregido con los primeros viajes',
  road: 'Ruta medida, tráfico por horario y tiempos de espera típicos',
  operator: 'Tiempos del operador',
  provisional: 'Base provisional sin ruta medida',
  'return-history': 'Vueltas reales desde este destino, ajustadas al tráfico',
  'return-history-start': 'Vuelta por ruta y tráfico, corregida con las primeras vueltas',
  'return-road': 'Vuelta por ruta medida y tráfico a esa hora',
  'return-provisional': 'Vuelta provisional sin ruta medida',
  'return-operator': 'Vuelta según tiempos del operador',
  'return-manual': 'Minutos de vuelta indicados',
};

export function statusOf(trip, live, now, leadMin) {
  if (trip.status !== 'active' || !live) return 'closed';
  if (live.late) return 'late';
  if (now >= (live.etaMin ?? live.eta) - leadMin * MIN) return 'soon';
  return 'road';
}
