import test from 'node:test';
import assert from 'node:assert/strict';
import { basePlan, estimateTrip, estimateReturn, liveEta, scaleTurns, trafficFactor, MIN } from '../src/eta-realista.js';
import { PLACES } from '../scripts/datos-app.js';

const sacaba = PLACES.find((p) => p.id === 'farm-sacaba');
const lopez = PLACES.find((p) => p.id === 'plant-lopez');
// Miércoles 18/11/2026 en hora de Bolivia (UTC-4).
const at = (h, m = 0, day = 18) => Date.UTC(2026, 10, day, h + 4, m);

test('hora pico es más lenta que la madrugada', () => {
  assert.ok(trafficFactor(at(18)) > trafficFactor(at(3)));
  assert.ok(basePlan(sacaba, at(17)).outbound > basePlan(sacaba, at(3)).outbound);
});

test('domingo tiene menos tráfico que un día hábil', () => {
  assert.ok(trafficFactor(at(18, 0, 22)) < trafficFactor(at(18)));
});

test('granja: carga mucho más larga que la descarga en matadero', () => {
  assert.ok(basePlan(sacaba, at(10)).total > basePlan(lopez, at(10)).total + 120);
});

test('sin historial igual da una ventana, sesgada hacia el atraso', () => {
  const e = estimateTrip(sacaba, [], at(10));
  assert.ok(e.etaMin < e.eta && e.eta < e.etaMax);
  assert.ok(e.etaMax - e.eta > e.eta - e.etaMin);
  assert.equal(e.basis, 'road');
});

const done = (id, start, minutes, extra = {}) => ({
  id, kind: 'farm', destination: 'farm-sacaba', status: 'done', learning: 1,
  first: start, returned: start + minutes * MIN, left: null, ...extra,
});

test('el historial corrige el modelo y un atípico no lo arrastra', () => {
  const base = estimateTrip(sacaba, [], at(14)).minutes;
  const hist = [1, 2, 3, 4, 5, 6].map((d) => done('t' + d, at(14, 0, 18 - d), base + 60));
  hist.push(done('raro', at(14, 0, 10), base + 600));
  const e = estimateTrip(sacaba, hist, at(14));
  assert.ok(Math.abs(e.minutes - (base + 60)) <= 20, `obtuve ${e.minutes}, esperaba ~${base + 60}`);
  assert.equal(e.outliers, 1);
  assert.equal(e.basis, 'history');
});

test('viajes marcados como atípicos o de otro destino no cuentan', () => {
  const hist = [done('a', at(9, 0, 15), 900, { learning: 0 }), { ...done('b', at(9, 0, 15), 900), destination: 'farm-tarata' }];
  assert.equal(estimateTrip(sacaba, hist, at(9)).count, 0);
});

test('camión atrasado: la llegada se mueve hacia adelante', () => {
  const e = estimateTrip(sacaba, [], at(8));
  const trip = { id: 'x', kind: 'farm', destination: 'farm-sacaba', status: 'active', first: at(8), left: null, eta: e.eta, etaMin: e.etaMin, etaMax: e.etaMax };
  const now = e.eta + 30 * MIN;
  const live = liveEta(trip, sacaba, [], now);
  assert.ok(live.late && live.eta > now);
  assert.equal(live.lateBy, 30);
  assert.ok(!liveEta(trip, sacaba, [], e.eta - MIN).late);
});

test('vuelta desde la salida del destino', () => {
  const r = estimateReturn(sacaba, [], at(16));
  assert.ok(r.minutes > sacaba.inMin && r.minutes < 120);
  assert.equal(estimateReturn(sacaba, [], at(16), 45).eta, at(16) + 45 * MIN);
});

test('turnos en balanza cuando llegan juntos', () => {
  const t = scaleTurns([{ id: 'a', eta: at(10) }, { id: 'b', eta: at(10, 2) }, { id: 'c', eta: at(11) }]);
  assert.deepEqual(t.map((x) => x.waitMin), [0, 4, 0]);
});
