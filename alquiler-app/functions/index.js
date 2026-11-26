/**
 * Notificaciones push automáticas (llegan aunque la app esté cerrada):
 *  - Al dueño: cada nueva solicitud y cada cancelación.
 *  - Al cliente: cuando su reserva se confirma, se rechaza o cambia de horario.
 *  - A ambos: 1 día antes y 15 minutos antes de cada reserva confirmada.
 *
 * REGION debe ser la región de tu base Firestore.
 */
const { setGlobalOptions } = require('firebase-functions/v2');
const { onSchedule } = require('firebase-functions/v2/scheduler');
const { onDocumentCreated, onDocumentUpdated } = require('firebase-functions/v2/firestore');
const { initializeApp } = require('firebase-admin/app');
const { getFirestore, FieldValue } = require('firebase-admin/firestore');
const { getMessaging } = require('firebase-admin/messaging');

const ADMIN_EMAILS = ['samistotelesrico777@gmail.com'];
const REGION = 'southamerica-east1'; // São Paulo (la más cercana a Bolivia)
const TZ = 'America/La_Paz';

setGlobalOptions({ region: REGION, maxInstances: 3 });
initializeApp();
const db = getFirestore();

const fmt = (ms, o) => new Intl.DateTimeFormat('es-BO', { timeZone: TZ, ...o }).format(ms);
const when = (ms) => `${fmt(ms, { weekday: 'long', day: 'numeric', month: 'long' })}, ${fmt(ms, { hour: '2-digit', minute: '2-digit', hour12: false })}`;
const items = (b) => (b.items || []).map((i) => i.name).join(', ');
const left = (ms) => {
  const m = Math.round((ms - Date.now()) / 60000);
  if (m < 60) return `${m} min`;
  const h = Math.floor(m / 60);
  return h >= 20 ? 'mañana' : `${h} h ${m % 60} min`;
};

async function tokensOf(uids) {
  const out = [];
  for (const uid of uids) {
    const s = await db.doc(`users/${uid}`).get();
    (s.get('fcmTokens') || []).forEach((t) => out.push({ uid, t }));
  }
  return out;
}
async function adminUids() {
  const s = await db.collection('users').where('emailLower', 'in', ADMIN_EMAILS.map((e) => e.toLowerCase()).slice(0, 30)).get();
  return s.docs.map((d) => d.id);
}

async function send(uids, { title, body, url = '#/', tag }) {
  const list = await tokensOf([...new Set(uids)]);
  if (!list.length) return;
  const res = await getMessaging().sendEachForMulticast({
    tokens: list.map((x) => x.t),
    data: { title, body, url, tag: tag || '' },
    webpush: { headers: { Urgency: 'high', TTL: '3600' } },
  });
  // Limpia tokens de teléfonos que ya no existen.
  const bad = {};
  res.responses.forEach((r, i) => {
    const code = r.error && r.error.code;
    if (code === 'messaging/registration-token-not-registered' || code === 'messaging/invalid-registration-token') (bad[list[i].uid] ||= []).push(list[i].t);
  });
  await Promise.all(Object.entries(bad).map(([uid, t]) => db.doc(`users/${uid}`).update({ fcmTokens: FieldValue.arrayRemove(...t) })));
}

exports.nuevaReserva = onDocumentCreated('bookings/{id}', async (e) => {
  const b = e.data.data();
  await send(await adminUids(), { title: 'Nueva solicitud de reserva', body: `${b.clientName} · ${when(b.start)} · ${items(b)}`, url: `#/reserva/${e.params.id}`, tag: `new-${e.params.id}` });
});

exports.cambioReserva = onDocumentUpdated('bookings/{id}', async (e) => {
  const a = e.data.before.data(), b = e.data.after.data(), id = e.params.id;
  const url = `#/reserva/${id}`, tag = `st-${id}`;
  if (a.status !== b.status) {
    if (b.status === 'confirmado') await send([b.uid], { title: '¡Tu reserva está confirmada! ✅', body: `${when(b.start)}${b.total ? ` · Total: Bs ${b.total}` : ''}${b.adminNote ? ` · ${b.adminNote}` : ''}`, url, tag });
    if (b.status === 'rechazado') await send([b.uid], { title: 'No hay disponibilidad para tu fecha', body: b.adminNote || 'Escríbenos para buscar otra fecha u horario.', url, tag });
    if (b.status === 'cancelado') await send(await adminUids(), { title: 'Reserva cancelada por el cliente', body: `${b.clientName} · ${when(b.start)}`, url, tag });
  } else if (a.start !== b.start) {
    await send([b.uid], { title: 'Tu reserva cambió de horario', body: when(b.start), url, tag });
  }
});

// Revisa cada minuto qué recordatorios corresponde enviar.
exports.recordatorios = onSchedule({ schedule: 'every 1 minutes', timeZone: TZ }, async () => {
  const now = Date.now();
  const snap = await db.collection('bookings')
    .where('status', '==', 'confirmado')
    .where('start', '>', now)
    .where('start', '<=', now + 24 * 3600e3)
    .get();
  if (snap.empty) return;
  const admins = await adminUids();
  for (const d of snap.docs) {
    const b = d.data();
    const mins = (b.start - now) / 60000;
    const url = `#/reserva/${d.id}`;
    const where = b.location && b.location.address ? ` · ${b.location.address}` : '';
    if (!b.reminded15m && mins <= 15) {
      await d.ref.update({ reminded15m: true, reminded1d: true });
      await send([b.uid], { title: `⏰ Tu alquiler empieza en ${left(b.start)}`, body: `${items(b)}${where}`, url, tag: `${d.id}-15m` });
      await send(admins, { title: `⏰ En ${left(b.start)}: ${b.clientName}`, body: `${items(b)}${where}`, url, tag: `${d.id}-15m` });
    } else if (!b.reminded1d && mins > 30) {
      await d.ref.update({ reminded1d: true });
      await send([b.uid], { title: `📅 Recordatorio: tu alquiler es ${left(b.start) === 'mañana' ? 'mañana' : `en ${left(b.start)}`}`, body: `${when(b.start)}${where}`, url, tag: `${d.id}-1d` });
      await send(admins, { title: `📅 ${left(b.start) === 'mañana' ? 'Mañana' : `En ${left(b.start)}`}: ${b.clientName}`, body: `${when(b.start)} · ${items(b)}${where}`, url, tag: `${d.id}-1d` });
    }
  }
});
