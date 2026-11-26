// MODO DEMO: guarda todo en este navegador y sincroniza entre pestañas
// abiertas en tiempo real (BroadcastChannel). Sirve para probar la app
// antes de conectar Firebase.
import { uid, toMs, dayKey } from './ui.js';
import { DEFAULT_SERVICES, DEFAULT_WORKS } from './defaults.js';
import { sortWorks } from './sort.js';

const KEY = 'datacrammer_demo_v2';
const SESSION = 'alq_demo_session';
export const DEMO_OWNER = { email: 'dueno@demo.bo', password: 'demo1234' };
export const DEMO_CLIENT = { email: 'cliente@demo.bo', password: 'demo1234' };

const bc = 'BroadcastChannel' in self ? new BroadcastChannel('alq_demo') : null;
const subs = { auth: new Set(), services: new Set(), works: new Set(), bookings: new Set() };
let db = load();
// La sesión es por pestaña: así puedes abrir una pestaña como dueño y otra como cliente.
let session = sessionStorage.getItem(SESSION) || localStorage.getItem(SESSION);
const setSession = (v) => { session = v; for (const st of [sessionStorage, localStorage]) v ? st.setItem(SESSION, v) : st.removeItem(SESSION); };

function load() {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return JSON.parse(raw);
  } catch { /* datos dañados: se regeneran */ }
  return seed();
}

function save() {
  try {
    localStorage.setItem(KEY, JSON.stringify(db));
  } catch {
    throw new Error('El almacenamiento del navegador está lleno. En modo demo usa fotos más pequeñas o menos fotos.');
  }
  bc?.postMessage('sync');
  emitAll();
}

function onExternalChange() {
  db = load();
  emitAll();
}
bc && (bc.onmessage = onExternalChange);
self.addEventListener('storage', (e) => { if (e.key === KEY) onExternalChange(); });

const currentUser = () => {
  const u = db.users.find((x) => x.uid === session);
  if (!u) return null;
  const { password, ...rest } = u;
  return { ...rest, role: isAdminEmail(u.email) ? 'admin' : 'client' };
};
const isAdminEmail = (email) => email === DEMO_OWNER.email || (self.APP_SETTINGS?.adminEmails || []).includes(email);

function emitAll() {
  const u = currentUser();
  subs.auth.forEach((cb) => cb(u));
  subs.services.forEach((cb) => cb(sorted(db.services)));
  subs.works.forEach((cb) => cb(sortWorks(db.works)));
  subs.bookings.forEach(({ cb, user }) => cb(bookingsFor(user)));
}
const sorted = (arr) => [...arr].sort((a, b) => (a.order ?? 0) - (b.order ?? 0) || a.name.localeCompare(b.name));
const bookingsFor = (user) => {
  if (!user) return [];
  const list = user.role === 'admin' ? db.bookings : db.bookings.filter((b) => b.uid === user.uid);
  return [...list].sort((a, b) => a.start - b.start);
};
const later = (fn) => setTimeout(fn, 0);

export const mode = 'demo';

export function onAuth(cb) { subs.auth.add(cb); later(() => cb(currentUser())); return () => subs.auth.delete(cb); }

export async function signIn({ email, password }) {
  const u = db.users.find((x) => x.email.toLowerCase() === String(email).trim().toLowerCase());
  if (!u || u.password !== password) throw new Error('Correo o contraseña incorrectos.');
  setSession(u.uid); emitAll();
}

export async function signUp({ name, phone, email, password }) {
  email = String(email).trim().toLowerCase();
  if (db.users.some((x) => x.email === email)) throw new Error('Ya existe una cuenta con ese correo.');
  if (!password || password.length < 6) throw new Error('La contraseña debe tener al menos 6 caracteres.');
  const u = { uid: uid(), name, phone, email, password, createdAt: Date.now() };
  db.users.push(u); setSession(u.uid); save();
}

export async function signInGoogle() { throw new Error('El acceso con Google se activa al conectar Firebase.'); }
export async function resetPassword() { throw new Error('En modo demo no se envían correos.'); }
export async function signOut() { setSession(null); emitAll(); }

export async function updateProfile(patch) {
  const u = db.users.find((x) => x.uid === session);
  if (u) { Object.assign(u, patch); save(); }
}

export function watchServices(cb) { subs.services.add(cb); later(() => cb(sorted(db.services))); return () => subs.services.delete(cb); }
export async function saveService(s) {
  if (s.id) Object.assign(db.services.find((x) => x.id === s.id), s);
  else db.services.push({ ...s, id: uid(), createdAt: Date.now(), order: db.services.length });
  save();
}
export async function deleteService(id) { db.services = db.services.filter((x) => x.id !== id); save(); }

export function watchWorks(cb) { subs.works.add(cb); later(() => cb(sortWorks(db.works))); return () => subs.works.delete(cb); }
export async function saveWork(w) {
  if (w.id) Object.assign(db.works.find((x) => x.id === w.id), w);
  else db.works.push({ ...w, id: uid(), createdAt: Date.now() });
  save();
}
export async function deleteWork(id) { db.works = db.works.filter((x) => x.id !== id); save(); }

export function watchBookings(user, cb) {
  const entry = { cb, user };
  subs.bookings.add(entry);
  later(() => cb(bookingsFor(user)));
  return () => subs.bookings.delete(entry);
}
export async function createBooking(b) {
  const id = uid();
  db.bookings.push({ ...b, id, uid: session, status: 'pendiente', createdAt: Date.now(), updatedAt: Date.now() });
  save();
  return id;
}
export async function updateBooking(id, patch) {
  const b = db.bookings.find((x) => x.id === id);
  if (!b) throw new Error('Reserva no encontrada');
  Object.assign(b, patch, { updatedAt: Date.now() });
  save();
}
export async function deleteBooking(id) { db.bookings = db.bookings.filter((x) => x.id !== id); save(); }

export async function uploadImage(blob) {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result);
    r.onerror = () => reject(new Error('No se pudo leer la imagen'));
    r.readAsDataURL(blob);
  });
}

export async function enablePush() { return false; }

export function resetDemo() { localStorage.removeItem(KEY); setSession(null); location.reload(); }

// ---------- datos de ejemplo ----------
function seed() {
  const owner = { uid: 'owner', name: 'Dueño (demo)', phone: '70000000', email: DEMO_OWNER.email, password: DEMO_OWNER.password, createdAt: Date.now() };
  const client = { uid: 'client1', name: 'María Fernández', phone: '71234567', email: DEMO_CLIENT.email, password: DEMO_CLIENT.password, createdAt: Date.now() };
  const services = DEFAULT_SERVICES.map((x) => ({ ...x, photos: [...x.photos] }));
  const plusDays = (n) => dayKey(Date.now() + n * 864e5);
  const at = (d, h) => toMs(d, h);
  const soon = Math.ceil((Date.now() + 3 * 3600e3) / 3600e3) * 3600e3;
  const loc = (lat, lng, address, reference = '') => ({ lat, lng, address, reference });
  const item = (s, qty) => ({ serviceId: s.id, name: s.name, price: s.price, qty });
  const mk = (id, uid_, name, phone, start, durH, items, location, status, extra = {}) => ({
    id, uid: uid_, clientName: name, clientPhone: phone, clientEmail: '', items,
    total: items.reduce((t, i) => t + i.price * i.qty, 0), start, end: start + durH * 3600e3,
    location, notes: '', status, adminNote: '', createdAt: Date.now() - 864e5, updatedAt: Date.now() - 3600e3, ...extra,
  });
  const [data, promo] = services;
  const bookings = [
    mk('b1', 'client1', 'María Fernández', '71234567', soon, 3, [item(data, 1)],
      loc(-17.3712, -66.1636, 'Av. América esq. Pando, Cala Cala, Cochabamba', 'Colegio, entrada por la puerta lateral'), 'confirmado', { notes: 'Defensa de monografía, 4to piso' }),
    mk('b2', 'c2', 'Jorge Rocha', '76543210', at(plusDays(1), '19:00'), 3, [item(data, 1)],
      loc(-17.4041, -66.0398, 'Plaza principal de Sacaba', 'Iglesia frente a la plaza'), 'pendiente', { notes: 'Culto de jóvenes, necesito cable HDMI largo' }),
    mk('b3', 'c3', 'Lucía Vargas', '70707070', at(plusDays(2), '09:00'), 4, [item(data, 1)],
      loc(-17.3826, -66.2585, 'Av. Blanco Galindo km 13, Vinto', 'Salón de capacitación, portón negro'), 'confirmado', { notes: 'Taller para 40 personas' }),
    mk('b4', 'c4', 'Carlos Méndez', '72222222', at(plusDays(1), '15:00'), 2, [item(promo, 1)],
      loc(-17.3936, -66.1450, 'Universidad, zona Las Cuadras, Cochabamba', 'Aula 204'), 'pendiente'),
    mk('b5', 'client1', 'María Fernández', '71234567', at(plusDays(-6), '10:00'), 2, [item(data, 1)],
      loc(-17.3936, -66.1570, 'Plaza 14 de Septiembre, Cochabamba', ''), 'completado'),
  ];
  return { users: [owner, client], services, works: DEFAULT_WORKS.map((w) => ({ ...w, photos: [...w.photos] })), bookings };
}
