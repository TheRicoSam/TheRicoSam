// Notificaciones: avisos al instante + recordatorios 1 día antes y 15 min antes.
import { toast, time, dayLong, untilText } from './ui.js';

export const REMINDERS = [
  { id: '1d', before: 24 * 60, min: 30 },  // 1 día antes (si se confirma con menos tiempo, avisa igual si faltan > 30 min)
  { id: '15m', before: 15, min: 0 },       // 15 minutos antes
];

let swReg = null;
export async function registerSW() {
  if (!('serviceWorker' in navigator)) return null;
  try { swReg = await navigator.serviceWorker.register('sw.js'); } catch { swReg = null; }
  return swReg;
}
export const swRegistration = () => swReg;

export const permission = () => ('Notification' in self ? Notification.permission : 'unsupported');
export async function askPermission() {
  if (!('Notification' in self)) return 'unsupported';
  return Notification.requestPermission();
}

let audioCtx;
function chime() {
  try {
    audioCtx ||= new (self.AudioContext || self.webkitAudioContext)();
    const t = audioCtx.currentTime;
    [880, 1318.5].forEach((f, i) => {
      const o = audioCtx.createOscillator(), g = audioCtx.createGain();
      o.type = 'sine'; o.frequency.value = f;
      g.gain.setValueAtTime(0.0001, t + i * 0.14);
      g.gain.exponentialRampToValueAtTime(0.18, t + i * 0.14 + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, t + i * 0.14 + 0.5);
      o.connect(g).connect(audioCtx.destination); o.start(t + i * 0.14); o.stop(t + i * 0.14 + 0.55);
    });
  } catch { /* sin audio */ }
}

// Muestra una notificación del sistema (si hay permiso) y un aviso dentro de la app.
export async function notify(title, body, { tag, url = '#/', kind = '' } = {}) {
  toast(title, body, kind);
  chime();
  if (permission() !== 'granted') return;
  const opts = { body, tag, icon: 'icons/icon-192.png', badge: 'icons/icon-192.png', data: { url }, renotify: !!tag, vibrate: [120, 60, 120] };
  try {
    const reg = swReg || (await navigator.serviceWorker?.ready);
    if (reg) return reg.showNotification(title, opts);
  } catch { /* usa la API simple */ }
  try { new Notification(title, opts); } catch { /* no soportado */ }
}

// ---------- recordatorios mientras la app está abierta ----------
const SENT = 'alq_sent_reminders';
const sent = () => { try { return new Set(JSON.parse(localStorage.getItem(SENT) || '[]')); } catch { return new Set(); } };
const markSent = (key) => { const s = sent(); s.add(key); localStorage.setItem(SENT, JSON.stringify([...s].slice(-400))); };

export function startReminders(getState) {
  const tick = () => {
    const { user, bookings } = getState();
    if (!user) return;
    const now = Date.now();
    const done = sent();
    for (const b of bookings) {
      if (b.status !== 'confirmado' || b.start <= now) continue;
      for (const r of REMINDERS) {
        const key = `${b.id}:${r.id}:${b.start}`;
        const left = (b.start - now) / 60000;
        if (done.has(key) || left > r.before || left <= r.min) continue;
        // Si ya corresponde el aviso de 15 min, no mandar también el de 1 día.
        if (r.id === '1d' && left <= 15) { markSent(key); continue; }
        markSent(key);
        const who = user.role === 'admin' ? `${b.clientName} · ` : '';
        const what = (b.items || []).map((i) => i.name).join(', ');
        const title = r.id === '15m' ? `⏰ Empieza ${untilText(b.start)}` : `📅 Recordatorio: ${untilText(b.start)}`;
        notify(title, `${who}${what} — ${dayLong(b.start)}, ${time(b.start)} · ${b.location?.address || ''}`, { tag: `${b.id}-${r.id}`, url: `#/reserva/${b.id}` });
      }
    }
  };
  tick();
  return setInterval(tick, 20000);
}

// ---------- avisos de cambios en tiempo real ----------
export function diffBookings(prev, next, user) {
  if (!prev || !user) return;
  const old = new Map(prev.map((b) => [b.id, b]));
  for (const b of next) {
    const o = old.get(b.id);
    if (user.role === 'admin') {
      if (!o && b.status === 'pendiente') notify('Nueva solicitud de reserva', `${b.clientName} · ${dayLong(b.start)} ${time(b.start)}`, { tag: `new-${b.id}`, url: `#/reserva/${b.id}` });
      else if (o && o.status !== b.status && b.status === 'cancelado') notify('Reserva cancelada por el cliente', `${b.clientName} · ${dayLong(b.start)}`, { tag: `st-${b.id}`, url: `#/reserva/${b.id}`, kind: 'bad' });
    } else if (o && o.status !== b.status) {
      if (b.status === 'confirmado') notify('¡Tu reserva está confirmada! ✅', `${dayLong(b.start)} a las ${time(b.start)}${b.total ? ` · Total: Bs ${b.total}` : ''}${b.adminNote ? ` · ${b.adminNote}` : ''}`, { tag: `st-${b.id}`, url: `#/reserva/${b.id}`, kind: 'ok' });
      else if (b.status === 'rechazado') notify('No hay disponibilidad para tu fecha', b.adminNote || 'Escríbenos para buscar otra fecha u horario.', { tag: `st-${b.id}`, url: `#/reserva/${b.id}`, kind: 'bad' });
      else if (b.status === 'completado') notify('Servicio completado', '¡Gracias por confiar en nosotros!', { tag: `st-${b.id}`, url: `#/reserva/${b.id}` });
    } else if (o && o.start !== b.start && user.role !== 'admin') {
      notify('Tu reserva cambió de horario', `${dayLong(b.start)} a las ${time(b.start)}`, { tag: `st-${b.id}`, url: `#/reserva/${b.id}` });
    }
  }
}

// ---------- calendario del teléfono (.ics con alarmas 1 día y 15 min) ----------
export function downloadICS(b, businessName) {
  const z = (ms) => new Date(ms).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
  const escI = (s) => String(s || '').replace(/[\\,;]/g, (c) => `\\${c}`).replace(/\n/g, '\\n');
  const what = (b.items || []).map((i) => `${i.qty} × ${i.name}`).join(', ');
  const ics = [
    'BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//DataCrammer//Reservas//ES', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH',
    'BEGIN:VEVENT', `UID:${b.id}@alquileres`, `DTSTAMP:${z(Date.now())}`, `DTSTART:${z(b.start)}`, `DTEND:${z(b.end || b.start + 3600e3)}`,
    `SUMMARY:${escI(`${businessName}: ${what}`)}`, `LOCATION:${escI(b.location?.address)}`,
    `GEO:${b.location?.lat};${b.location?.lng}`,
    `DESCRIPTION:${escI(`${b.clientName} · ${b.clientPhone}\n${b.location?.reference || ''}\nMapa: https://www.google.com/maps?q=${b.location?.lat},${b.location?.lng}`)}`,
    'BEGIN:VALARM', 'ACTION:DISPLAY', 'DESCRIPTION:Mañana tienes un alquiler', 'TRIGGER:-P1D', 'END:VALARM',
    'BEGIN:VALARM', 'ACTION:DISPLAY', 'DESCRIPTION:Empieza en 15 minutos', 'TRIGGER:-PT15M', 'END:VALARM',
    'END:VEVENT', 'END:VCALENDAR',
  ].join('\r\n');
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([ics], { type: 'text/calendar' }));
  a.download = `reserva-${b.id.slice(0, 6)}.ics`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}

