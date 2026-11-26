import {
  icon, googleLogo, esc, $, $$, toast, modal, confirmDialog, lightbox, resizeImage, avatar,
  time, dayLong, dayShort, dayNum, monShort, monthYear, relDay, untilText, dayKey, toMs, hhmmOf, isToday, cap,
  money, STATUS, statusBadge, waLink, telLink, gmapsDir, wazeDir,
} from './ui.js';
import { DEFAULT_SERVICES, DEFAULT_WORKS } from './defaults.js';
import { BASE, hoursOf, lineAmount, calcTotal, kmFromBase, zoneOf } from './pricing.js';
import { createMap, locationPicker, pinIcon, CBBA } from './map.js';
import { registerSW, swRegistration, permission, askPermission, notify, startReminders, diffBookings, downloadICS } from './notify.js';

const CFG = self.APP_SETTINGS || {};
const CUR = CFG.currency || 'Bs';
const BIZ = CFG.businessName || 'Alquileres';
const ONLINE_MODE = !!self.FIREBASE_CONFIG?.apiKey;
const L = self.L;
const root = $('#app');

let api;
try {
  api = ONLINE_MODE ? await import('./backend-firebase.js') : await import('./backend-demo.js');
} catch (e) {
  root.innerHTML = `<div class="empty" style="padding-top:20vh"><div class="ico">${icon('wifi')}</div><h3>No se pudo conectar</h3><p>Revisa tu conexión a internet y vuelve a intentar.</p><p style="margin-top:16px"><button class="btn" onclick="location.reload()">Reintentar</button></p></div>`;
  throw e;
}

const S = { ready: false, user: null, services: [], works: [], bookings: [], online: navigator.onLine, bookingsLoaded: false };
let unsubBookings = null;
let cleanup = null;
let currentView = null;
let shellFor = null;
let detail = null; // modal de reserva abierto

document.title = `${BIZ} · Reservas`;
registerSW();
startReminders(() => S);

// ---------- datos en tiempo real ----------
// En línea: mientras Firebase esté vacío se muestra el catálogo inicial, y la
// primera vez que entra el dueño se guarda (luego se edita desde la app).
const RAW = { services: null, works: null };
api.watchServices((list) => { RAW.services = list; S.services = list.length || !ONLINE_MODE ? list : DEFAULT_SERVICES; seedOnline(); refresh(); });
api.watchWorks((list) => { RAW.works = list; S.works = list.length || !ONLINE_MODE ? list : DEFAULT_WORKS; seedOnline(); refresh(); });
let seeded = false;
async function seedOnline() {
  if (!ONLINE_MODE || seeded || !isAdmin() || !RAW.services || !RAW.works || RAW.services.length || RAW.works.length) return;
  seeded = true;
  try {
    for (const s of DEFAULT_SERVICES) await api.saveService(s);
    for (const w of DEFAULT_WORKS) await api.saveWork(w);
  } catch (e) { console.warn('No se pudo cargar el catálogo inicial', e); }
}
api.onAuth((user) => {
  const changed = user?.uid !== S.user?.uid || user?.role !== S.user?.role;
  const first = !S.ready;
  S.user = user; S.ready = true;
  if (changed) {
    unsubBookings?.(); S.bookings = []; S.bookingsLoaded = false;
    if (user) unsubBookings = api.watchBookings(user, (list) => {
      if (S.bookingsLoaded) diffBookings(S.bookings, list, S.user);
      S.bookings = list; S.bookingsLoaded = true; refresh(); detail?.refresh();
    });
    shellFor = null;
    seedOnline();
    if (user && location.hash.length < 3) location.hash = isAdmin() ? '#/panel' : '#/inicio';
    if (user && ONLINE_MODE && permission() === 'granted') setupPush();
  }
  if (changed || first) route();
  else if (user) { S.user = user; paintBadges(); }
});
addEventListener('online', () => { S.online = true; paintConn(); });
addEventListener('offline', () => { S.online = false; paintConn(); });
addEventListener('hashchange', route);
navigator.serviceWorker?.addEventListener('message', (e) => { if (e.data?.url) location.hash = e.data.url.replace(/^.*#/, '#'); });

const isAdmin = () => S.user?.role === 'admin';
const svcById = (id) => S.services.find((s) => s.id === id);
const itemsText = (b) => (b.items || []).map((i) => `${i.qty > 1 ? `${i.qty} × ` : ''}${i.name}`).join(', ');
const upcoming = (list) => list.filter((b) => (b.end || b.start) > Date.now() && ['pendiente', 'confirmado'].includes(b.status));
const conflictsOf = (b) => S.bookings.filter((o) => o.id !== b.id && o.status === 'confirmado' && o.start < (b.end || b.start) && b.start < (o.end || o.start));
const priceTag = (s) => (s.price > 0 ? `${money(s.price, CUR)} <small>${esc(s.unit || '')}</small>` : '<span style="font-size:15px">Consultar precio</span>');
// Precios: los servicios "por hora" se multiplican por las horas reservadas (se cobra la hora empezada).
const fmtH = (h) => `${h} h`;
const lineMoney = (i, hours) => {
  if (!(i.price > 0)) return 'A consultar';
  const h = hours ?? i.hours;
  if (i.perHour && !h) return `${money(i.price * i.qty, CUR)} / hora`;
  return `${money(lineAmount(i, h), CUR)}${i.perHour ? ` · ${fmtH(h)}` : ''}`;
};
const hasConsult = (items) => (items || []).some((i) => !(i.price > 0));
// Línea del recargo por zona (zone: nombre o null; extra: monto).
const surchargeLine = (zone, extra, known = true) =>
  `<div class="row" style="justify-content:space-between;margin-top:6px"><span class="strong" style="font-weight:600">Recargo por distancia${zone ? ` (${esc(zone)})` : ''}</span><span class="muted small">${!known ? 'A consultar' : extra > 0 ? money(extra, CUR) : 'Sin recargo'}</span></div>`;
const kmText = (loc) => { const k = kmFromBase(loc); return k == null ? '' : `≈ ${k < 10 ? k.toFixed(1) : Math.round(k)} km`; };
const tones = ['g1', 'g2', 'g3', 'g4', 'g5', 'g6'];
const toneOf = (s, i = 0) => s.tone || tones[i % tones.length];

async function setupPush() {
  try {
    const reg = swRegistration() || (await navigator.serviceWorker.ready);
    await api.enablePush(reg, (d) => d.title && toast(d.title, d.body || ''));
  } catch (e) { console.warn('Push no disponible', e); }
}

// ---------- rutas ----------
const CLIENT_NAV = [
  ['inicio', 'Inicio', 'home'], ['reservar', 'Reservar', 'calPlus'], ['mis-reservas', 'Mis reservas', 'list'],
  ['galeria', 'Trabajos', 'images'], ['perfil', 'Perfil', 'user'],
];
const ADMIN_NAV = [
  ['panel', 'Panel', 'dashboard'], ['agenda', 'Agenda', 'calendar'], ['mapa', 'Mapa', 'map'], ['reservas', 'Reservas', 'list'],
  ['servicios', 'Servicios', 'box'], ['galeria', 'Trabajos', 'images'], ['perfil', 'Perfil', 'user'],
];
const ADMIN_TABS = ['panel', 'agenda', 'mapa', 'reservas', 'perfil'];
const TITLES = {
  inicio: [BIZ, CFG.tagline || ''], reservar: ['Nueva reserva', 'Elige, agenda y marca el lugar en el mapa'],
  'mis-reservas': ['Mis reservas', 'Estado de tus solicitudes en tiempo real'], galeria: ['Trabajos realizados', 'Así quedan nuestros servicios'],
  perfil: ['Perfil', 'Tu cuenta y notificaciones'], panel: ['Panel', ''], agenda: ['Agenda', 'Todos tus alquileres por día'],
  mapa: ['Mapa de trabajos', 'Dónde tienes que ir · Cochabamba'], reservas: ['Reservas', 'Confirma o rechaza solicitudes'],
  servicios: ['Servicios', 'Lo que ofreces, con precios y fotos'],
};

function parseHash() {
  const [path, qs] = location.hash.replace(/^#\/?/, '').split('?');
  return { path: path || '', params: new URLSearchParams(qs || '') };
}

function route() {
  if (!S.ready) return;
  if (!S.user) { cleanup?.(); cleanup = null; shellFor = null; currentView = null; return renderAuth(); }
  let { path, params } = parseHash();
  if (path.startsWith('reserva/')) {
    const id = path.split('/')[1];
    const base = isAdmin() ? 'reservas' : 'mis-reservas';
    history.replaceState(null, '', `#/${currentView || base}`);
    path = currentView || base;
    setTimeout(() => openBooking(id), 0);
  }
  const views = isAdmin() ? ADMIN_VIEWS : CLIENT_VIEWS;
  if (!views[path]) { location.replace(`#/${isAdmin() ? 'panel' : 'inicio'}`); return; }
  if (shellFor !== S.user.uid + S.user.role) renderShell();
  const same = currentView === path;
  currentView = path;
  $$('.nav a, .tabbar a').forEach((a) => a.classList.toggle('active', a.dataset.v === path));
  const [t, sub] = TITLES[path] || ['', ''];
  $('#tb-title').textContent = t;
  $('#tb-sub').textContent = path === 'panel' ? cap(dayLong(Date.now())) : path === 'inicio' ? `Hola, ${S.user.name.split(' ')[0]} 👋` : sub;
  mount(params, !same);
}

function mount(params = parseHash().params, scrollTop = true) {
  const el = $('#view');
  if (!el) return;
  cleanup?.(); cleanup = null;
  const view = (isAdmin() ? ADMIN_VIEWS : CLIENT_VIEWS)[currentView];
  el.className = `content ${view.wide ? 'wide' : ''}`;
  const y = scrollY;
  cleanup = view.render(el, params) || null;
  if (scrollTop) scrollTo(0, 0); else scrollTo(0, y);
}

let refreshTimer;
function refresh() {
  if (!S.user || !currentView) return;
  clearTimeout(refreshTimer);
  refreshTimer = setTimeout(() => {
    paintBadges();
    const view = (isAdmin() ? ADMIN_VIEWS : CLIENT_VIEWS)[currentView];
    if (view && !view.keep) mount(undefined, false);
  }, 60);
}

// ---------- estructura ----------
function renderShell() {
  shellFor = S.user.uid + S.user.role;
  const nav = isAdmin() ? ADMIN_NAV : CLIENT_NAV;
  const tabs = isAdmin() ? ADMIN_NAV.filter(([v]) => ADMIN_TABS.includes(v)) : CLIENT_NAV;
  root.innerHTML = `
  <div class="shell">
    <aside class="sidebar">
      <div class="brand"><div class="brand-mark"></div><div><div class="brand-name">${esc(BIZ)}</div><div class="brand-sub">${isAdmin() ? 'Panel del dueño' : 'Reservas en línea'}</div></div></div>
      <div class="nav-label">${isAdmin() ? 'Gestión' : 'Menú'}</div>
      <nav class="nav">${nav.map(([v, t, ic]) => `<a href="#/${v}" data-v="${v}">${icon(ic)}<span>${t}</span>${v === 'reservas' || v === 'mis-reservas' ? '<span class="badge count hidden" data-badge></span>' : ''}</a>`).join('')}</nav>
      <div class="side-foot">
        ${!isAdmin() ? `<a class="btn btn-wa block" href="${waLink(CFG.whatsapp, `Hola ${BIZ}, quiero consultar sobre un alquiler.`)}" target="_blank" rel="noopener">${icon('chat')} Escríbenos por WhatsApp</a>` : ''}
        <div class="me-card">${avatar(S.user.name)}<div class="who"><b>${esc(S.user.name)}</b><span>${isAdmin() ? 'Administrador' : 'Cliente'}</span></div><button id="logout" title="Cerrar sesión">${icon('logout', 'sm')}</button></div>
      </div>
    </aside>
    <div class="main">
      <header class="topbar" id="topbar">
        <a class="t-brand" href="#/${isAdmin() ? 'panel' : 'inicio'}" aria-label="Inicio"></a>
        <div style="min-width:0;flex:1"><h1 id="tb-title"></h1><div class="sub" id="tb-sub"></div></div>
        <span class="conn" id="conn"></span>
      </header>
      <main id="view" class="content"></main>
    </div>
    <nav class="tabbar">${tabs.map(([v, t, ic]) => `<a href="#/${v}" data-v="${v}">${icon(ic)}<span>${v === 'mis-reservas' ? 'Reservas' : t}</span>${v === 'reservas' || v === 'mis-reservas' ? '<span class="dot hidden" data-badge></span>' : ''}</a>`).join('')}</nav>
  </div>`;
  $('#logout').onclick = async () => { if (await confirmDialog({ title: '¿Cerrar sesión?', ok: 'Cerrar sesión' })) api.signOut(); };
  addEventListener('scroll', () => $('#topbar')?.classList.toggle('scrolled', scrollY > 4), { passive: true });
  paintConn(); paintBadges();
}

function paintConn() {
  const el = $('#conn');
  if (!el) return;
  if (!ONLINE_MODE) { el.className = 'conn demo'; el.textContent = 'Modo demo'; el.title = 'Datos guardados solo en este navegador'; }
  else if (S.online) { el.className = 'conn'; el.textContent = 'En línea'; el.title = 'Sincronizado en tiempo real'; }
  else { el.className = 'conn off'; el.textContent = 'Sin conexión'; el.title = 'Los cambios se enviarán al volver internet'; }
}

function paintBadges() {
  const n = isAdmin() ? S.bookings.filter((b) => b.status === 'pendiente' && b.end > Date.now()).length : 0;
  $$('[data-badge]').forEach((b) => { b.textContent = n; b.classList.toggle('hidden', !n); });
}

// ---------- piezas comunes ----------
function bookingRow(b) {
  const admin = isAdmin();
  const conf = admin && ['pendiente', 'confirmado'].includes(b.status) && conflictsOf(b).length;
  return `<div class="bitem" data-open="${b.id}">
    <div class="datechip ${isToday(b.start) ? 'today' : ''}"><b>${dayNum(b.start)}</b><span>${monShort(b.start)}</span></div>
    <div style="min-width:0">
      <div class="b-title">${esc(admin ? b.clientName : itemsText(b))}</div>
      <div class="b-sub"><span>${icon('clock', 'sm')} ${relDay(b.start)} · ${time(b.start)}–${time(b.end)}</span>
        <span style="max-width:100%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${icon('pin', 'sm')} ${esc(b.location?.address || 'Sin dirección')}</span>
        ${admin ? `<span>${icon('box', 'sm')} ${esc(itemsText(b))}</span>` : ''}</div>
    </div>
    <div class="b-right">${statusBadge(b.status)}${conf ? `<span class="conflict">${icon('alert', 'sm')} Se cruza con otra</span>` : ''}</div>
  </div>`;
}

function bindOpen(el) {
  el.addEventListener('click', (e) => {
    const o = e.target.closest('[data-open]');
    if (o && !e.target.closest('button, a')) openBooking(o.dataset.open);
  });
}

const emptyBox = (ic, title, text, action = '') =>
  `<div class="empty"><div class="ico">${icon(ic, 'lg')}</div><h3>${title}</h3><p>${text}</p>${action ? `<div style="margin-top:16px">${action}</div>` : ''}</div>`;

const svcMedia = (s, i) => s.photos?.length
  ? `<img src="${esc(s.photos[0])}" alt="${esc(s.name)}" loading="lazy">${s.photos.length > 1 ? `<span class="count-photos">${icon('image', 'sm')} ${s.photos.length}</span>` : ''}`
  : `<div class="ph ${toneOf(s, i)}">${icon(s.icon || 'projector')}</div>`;

function notifBanner() {
  const p = permission();
  if (p === 'granted' || p === 'unsupported') return '';
  return `<div class="banner" style="margin-bottom:20px"><div class="ico">${icon('bell')}</div>
    <div style="flex:1"><b>Activa las notificaciones</b><div class="small muted">${isAdmin() ? 'Te avisamos de cada nueva solicitud, 1 día antes y 15 minutos antes de cada trabajo.' : 'Te avisamos cuando confirmemos tu reserva, 1 día antes y 15 minutos antes.'}</div></div>
    <button class="btn sm" data-enable-notif>${p === 'denied' ? 'Cómo activar' : 'Activar'}</button></div>`;
}
function bindNotif(el) {
  el.querySelector('[data-enable-notif]')?.addEventListener('click', async () => {
    if (permission() === 'denied') return toast('Notificaciones bloqueadas', 'Actívalas en la configuración del navegador: candado junto a la dirección › Notificaciones › Permitir.');
    const r = await askPermission();
    if (r === 'granted') { notify('Notificaciones activadas', 'Recibirás avisos de tus reservas.', { kind: 'ok' }); if (ONLINE_MODE) setupPush(); }
    mount(undefined, false);
  });
}

// ---------- detalle de una reserva ----------
function openBooking(id) {
  detail?.api.close();
  let dmap = null;
  const draw = (el) => {
    dmap?.remove(); dmap = null;
    const b = S.bookings.find((x) => x.id === id);
    if (!b) { el.querySelector('.modal-body').innerHTML = emptyBox('alert', 'Reserva no encontrada', 'Puede que se haya eliminado.'); return; }
    const admin = isAdmin();
    const conf = admin && ['pendiente', 'confirmado'].includes(b.status) ? conflictsOf(b) : [];
    const lat = b.location?.lat, lng = b.location?.lng;
    el.querySelector('.modal-head h2').innerHTML = `${esc(admin ? b.clientName : 'Tu reserva')} ${statusBadge(b.status)}`;
    el.querySelector('.modal-body').innerHTML = `
      ${conf.length ? `<div class="banner warn" style="margin-bottom:14px"><div class="ico">${icon('alert')}</div><div><b>Se cruza con ${conf.length} reserva${conf.length > 1 ? 's' : ''} confirmada${conf.length > 1 ? 's' : ''}</b><div class="small">${conf.map((c) => `${esc(c.clientName)} (${time(c.start)}–${time(c.end)})`).join(' · ')}</div></div></div>` : ''}
      ${b.status === 'pendiente' && !admin ? `<div class="banner" style="margin-bottom:14px"><div class="ico">${icon('clock')}</div><div><b>Esperando confirmación</b><div class="small muted">Te avisaremos aquí apenas confirmemos la disponibilidad.</div></div></div>` : ''}
      ${b.adminNote ? `<div class="dl full" style="margin-bottom:12px;border-color:color-mix(in srgb,var(--brand) 35%,transparent)"><div class="k">${icon('chat', 'sm')} Mensaje del negocio</div><div class="v">${esc(b.adminNote)}</div></div>` : ''}
      <div class="detail-grid">
        <div class="dl"><div class="k">${icon('calendar', 'sm')} Fecha</div><div class="v">${dayLong(b.start)}</div><div class="tiny muted">${untilText(b.start)}</div></div>
        <div class="dl"><div class="k">${icon('clock', 'sm')} Horario</div><div class="v">${time(b.start)} – ${time(b.end)}</div></div>
        ${admin ? `<div class="dl"><div class="k">${icon('user', 'sm')} Cliente</div><div class="v">${esc(b.clientName)}</div></div>
        <div class="dl"><div class="k">${icon('phone', 'sm')} Teléfono</div><div class="v"><a href="${telLink(b.clientPhone)}">${esc(b.clientPhone || '—')}</a></div></div>` : ''}
        <div class="dl full"><div class="k">${icon('pin', 'sm')} Dirección</div><div class="v">${esc(b.location?.address || '—')}</div>${b.location?.reference ? `<div class="small muted" style="margin-top:4px">Referencia: ${esc(b.location.reference)}</div>` : ''}${admin && kmFromBase(b.location) != null ? `<div class="small" style="margin-top:4px;color:var(--brand);font-weight:700">${kmText(b.location)} en línea recta desde ${esc(BASE.name)}</div>` : ''}</div>
        <div class="dl full"><div class="k">${icon('box', 'sm')} Servicios</div>
          ${(b.items || []).map((i) => `<div class="row" style="justify-content:space-between;margin-top:6px"><span class="strong" style="font-weight:600">${i.qty} × ${esc(i.name)}</span><span class="muted small">${lineMoney(i, hoursOf(b.start, b.end))}</span></div>`).join('')}
          ${surchargeLine(b.zone, b.extra, b.status !== 'pendiente' || !!b.zone || b.extra > 0)}
          <div class="row" style="justify-content:space-between;margin-top:10px;padding-top:10px;border-top:1px dashed var(--line-strong)"><b>${b.status === 'pendiente' ? 'Total referencial' : 'Total'}</b><b class="price">${money(b.total, CUR)}${hasConsult(b.items) ? ' <small>+ extras a consultar</small>' : ''}</b></div>
          ${b.status === 'pendiente' && !admin && !b.zone ? '<div class="tiny muted" style="margin-top:6px">Tu zona no tiene tarifa fija: te indicamos el recargo al confirmar.</div>' : ''}</div>
        ${b.notes ? `<div class="dl full"><div class="k">${icon('edit', 'sm')} Notas del cliente</div><div class="v" style="font-weight:500">${esc(b.notes)}</div></div>` : ''}
      </div>
      ${lat ? `<div class="map" id="d-map" style="height:240px;margin-top:14px"></div>
      <div class="row wrap" style="margin-top:10px">
        <a class="btn sm" href="${gmapsDir(lat, lng)}" target="_blank" rel="noopener">${icon('nav', 'sm')} Cómo llegar (Google Maps)</a>
        <a class="btn sm ghost" href="${wazeDir(lat, lng)}" target="_blank" rel="noopener">Abrir en Waze</a>
      </div>` : ''}
      <p class="tiny muted" style="margin-top:14px">Solicitada ${dayShort(b.createdAt)} ${time(b.createdAt)} · Código ${esc(b.id.slice(0, 6).toUpperCase())}</p>`;

    const actions = [];
    const live = (b.end || b.start) > Date.now();
    if (admin) {
      if (b.clientPhone) actions.push(`<a class="btn ghost btn-wa" href="${waLink(b.clientPhone.length <= 8 ? `591${b.clientPhone}` : b.clientPhone, `Hola ${b.clientName}, te escribimos de ${BIZ} por tu reserva del ${dayLong(b.start)}.`)}" target="_blank" rel="noopener">${icon('chat', 'sm')} WhatsApp</a>`);
      if (['pendiente', 'confirmado'].includes(b.status)) actions.push(`<button class="btn ghost" data-act="edit">${icon('edit', 'sm')} Cambiar horario</button>`);
      if (b.status === 'pendiente') actions.push(`<button class="btn danger-soft" data-act="reject">${icon('x', 'sm')} No puedo</button>`, `<button class="btn ok" data-act="confirm">${icon('check', 'sm')} Confirmar</button>`);
      if (b.status === 'confirmado') actions.push(`<button class="btn ghost" data-act="ics">${icon('download', 'sm')} Calendario</button>`, `<button class="btn" data-act="done">${icon('checkCircle', 'sm')} Completado</button>`);
      if (['rechazado', 'cancelado', 'completado'].includes(b.status)) actions.push(`<button class="btn danger-soft" data-act="delete">${icon('trash', 'sm')} Eliminar</button>`);
    } else {
      actions.push(`<a class="btn ghost btn-wa" href="${waLink(CFG.whatsapp, `Hola, consulto por mi reserva ${b.id.slice(0, 6).toUpperCase()} del ${dayLong(b.start)}.`)}" target="_blank" rel="noopener">${icon('chat', 'sm')} WhatsApp</a>`);
      if (b.status === 'confirmado') actions.push(`<button class="btn ghost" data-act="ics">${icon('download', 'sm')} Agregar a mi calendario</button>`);
      if (live && ['pendiente', 'confirmado'].includes(b.status)) actions.push(`<button class="btn danger-soft" data-act="cancel">Cancelar reserva</button>`);
    }
    el.querySelector('.modal-foot').innerHTML = actions.join('') || '<button class="btn ghost" data-close>Cerrar</button>';

    if (lat) {
      dmap = createMap(el.querySelector('#d-map'), { center: [lat, lng], zoom: 17, layersControl: true, locate: true });
      L.marker([lat, lng], { icon: pinIcon(STATUS[b.status]?.color) }).addTo(dmap);
    }

    el.querySelector('.modal-foot').onclick = async (e) => {
      const a = e.target.closest('[data-act]')?.dataset.act;
      if (!a) return;
      try {
        if (a === 'confirm') {
          confirmBooking(b);
        } else if (a === 'reject') {
          const note = await confirmDialog({ title: '¿No puedes atender esta reserva?', ok: 'Avisar al cliente', danger: true, input: { label: 'Motivo / alternativa (opcional)', placeholder: 'Ej.: Ese día está ocupado, ¿te sirve el domingo?' } });
          if (note === null) return;
          await api.updateBooking(b.id, { status: 'rechazado', adminNote: note });
          toast('Cliente avisado', 'Se marcó como no disponible.');
        } else if (a === 'done') {
          await api.updateBooking(b.id, { status: 'completado' }); toast('¡Trabajo completado!', '', 'ok');
        } else if (a === 'cancel') {
          if (!(await confirmDialog({ title: '¿Cancelar la reserva?', text: 'Le avisaremos al negocio.', ok: 'Sí, cancelar', danger: true }))) return;
          await api.updateBooking(b.id, { status: 'cancelado' }); toast('Reserva cancelada');
        } else if (a === 'delete') {
          if (!(await confirmDialog({ title: '¿Eliminar esta reserva?', text: 'No se puede deshacer.', ok: 'Eliminar', danger: true }))) return;
          await api.deleteBooking(b.id); detail?.api.close();
        } else if (a === 'ics') downloadICS(b, BIZ);
        else if (a === 'edit') editSchedule(b);
      } catch (err) { toast('No se pudo guardar', err.message, 'bad'); }
    };
  };
  const m = modal({ title: '', body: '', foot: ' ', wide: true, onMount: (el) => draw(el) });
  const el = m.el.querySelector('.modal');
  m.onClose = () => { dmap?.remove(); detail = null; };
  detail = { id, api: m, refresh: () => { const y = el.scrollTop; draw(el); el.scrollTop = y; } };
}

function confirmBooking(b) {
  const conf = conflictsOf(b);
  const hours = hoursOf(b.start, b.end);
  modal({
    title: 'Confirmar reserva',
    body: `<div class="col">
      ${conf.length ? `<div class="banner warn"><div class="ico">${icon('alert')}</div><div class="small"><b>Se cruza con ${conf.map((c) => `${esc(c.clientName)} (${time(c.start)}–${time(c.end)})`).join(', ')}</b><br>Puedes confirmar igual si tienes otro equipo.</div></div>` : ''}
      <div class="detail-grid">
        <div class="dl"><div class="k">${icon('user', 'sm')} Cliente</div><div class="v">${esc(b.clientName)}</div><div class="tiny muted">${dayLong(b.start)} · ${time(b.start)}–${time(b.end)} (${fmtH(hours)})</div></div>
        <div class="dl"><div class="k">${icon('pin', 'sm')} Distancia</div><div class="v">${b.zone ? `${esc(b.zone)} · ` : 'Zona sin tarifa · '}${kmText(b.location) || '—'}</div><div class="tiny muted">en línea recta desde ${esc(BASE.name)}</div></div>
      </div>
      <div class="dl">${(b.items || []).map((i) => `<div class="row" style="justify-content:space-between"><span>${i.qty} × ${esc(i.name)}</span><span class="muted small">${lineMoney(i, hours)}</span></div>`).join('')}</div>
      <div class="form-grid">
        <div class="field"><label>Recargo por distancia (${CUR})</label><input class="input" id="cb-x" type="number" min="0" step="1" value="${b.extra || 0}"><span class="hint">${b.zone ? `Tarifa de ${esc(b.zone)}: ${money((zoneOf(b.location) || {}).fee ?? b.extra ?? 0, CUR)}. Puedes cambiarlo.` : 'Esta zona no tiene tarifa: escribe el recargo.'}</span></div>
        <div class="field"><label>Total a cobrar</label><div class="input" id="cb-t" style="display:flex;align-items:center;font-weight:800;background:var(--surface-2)"></div>${hasConsult(b.items) ? '<span class="hint">Hay extras "a consultar": súmalos en el recargo o escríbelos en el mensaje.</span>' : ''}</div>
        <div class="field full"><label>Mensaje para el cliente (opcional)</label><textarea class="input" id="cb-n" placeholder="Ej.: Llegamos 30 min antes para instalar."></textarea></div>
      </div></div>`,
    foot: '<button class="btn ghost" data-close>Volver</button><button class="btn ok" id="cb-ok">' + icon('check', 'sm') + ' Confirmar y avisar</button>',
    onMount: (el, m) => {
      const x = el.querySelector('#cb-x'), t = el.querySelector('#cb-t');
      const paint = () => (t.textContent = money(calcTotal(b.items, b.start, b.end, x.value), CUR));
      x.oninput = paint; paint();
      el.querySelector('#cb-ok').onclick = async () => {
        const extra = Math.max(0, +x.value || 0);
        try {
          await api.updateBooking(b.id, { status: 'confirmado', adminNote: el.querySelector('#cb-n').value.trim(), extra, total: calcTotal(b.items, b.start, b.end, extra) });
          m.close(); toast('Reserva confirmada', `${b.clientName} ya fue notificado.`, 'ok');
        } catch (err) { toast('No se pudo confirmar', err.message, 'bad'); }
      };
    },
  });
}

function editSchedule(b) {
  modal({
    title: 'Cambiar horario',
    body: `<div class="form-grid">
      <div class="field full"><label>Fecha</label><input class="input" type="date" id="es-d" value="${dayKey(b.start)}"></div>
      <div class="field"><label>Desde</label><input class="input" type="time" id="es-s" value="${hhmmOf(b.start)}"></div>
      <div class="field"><label>Hasta</label><input class="input" type="time" id="es-e" value="${hhmmOf(b.end)}"></div>
      <p class="small muted full">El cliente recibirá un aviso con el nuevo horario.</p></div>`,
    foot: '<button class="btn ghost" data-close>Volver</button><button class="btn" id="es-ok">Guardar</button>',
    onMount: (el, m) => {
      el.querySelector('#es-ok').onclick = async () => {
        const d = el.querySelector('#es-d').value, s = el.querySelector('#es-s').value, e = el.querySelector('#es-e').value;
        if (!d || !s || !e) return toast('Completa fecha y horas', '', 'bad');
        const start = toMs(d, s); let end = toMs(d, e); if (end <= start) end += 864e5;
        try { await api.updateBooking(b.id, { start, end, total: calcTotal(b.items, start, end, b.extra), reminded1d: false, reminded15m: false }); m.close(); toast('Horario actualizado', '', 'ok'); }
        catch (err) { toast('No se pudo guardar', err.message, 'bad'); }
      };
    },
  });
}

// =====================================================================
//                               DUEÑO
// =====================================================================
function vPanel(el) {
  const now = Date.now();
  const pend = S.bookings.filter((b) => b.status === 'pendiente' && b.end > now);
  const conf = S.bookings.filter((b) => b.status === 'confirmado');
  const todayL = conf.filter((b) => isToday(b.start));
  const week = conf.filter((b) => b.start > now && b.start < now + 7 * 864e5);
  const monthK = dayKey(now).slice(0, 7);
  const income = S.bookings.filter((b) => ['confirmado', 'completado'].includes(b.status) && dayKey(b.start).slice(0, 7) === monthK).reduce((t, b) => t + (b.total || 0), 0);
  const next = conf.filter((b) => b.end > now).sort((a, b) => a.start - b.start)[0];
  const soon = upcoming(S.bookings).filter((b) => b.status === 'confirmado' && b.start < now + 2 * 864e5);

  el.innerHTML = `<div class="fade-in">
    ${notifBanner()}
    ${next ? `<section class="hero"><div class="next-grid">
      <div><div class="eyebrow">${icon('sparkle', 'sm')} ${next.start <= now ? 'En curso ahora' : 'Próximo trabajo'}</div>
        <h2 style="font-size:26px">${esc(next.clientName)}</h2>
        <p class="lead" style="margin-top:4px">${esc(itemsText(next))}</p>
        <div class="countdown" id="cd"></div>
        <div class="meta">
          <div>${icon('calendar', 'sm')}<span>${dayLong(next.start)} · ${time(next.start)}–${time(next.end)}</span></div>
          <div>${icon('pin', 'sm')}<span>${esc(next.location?.address || '')}${next.location?.reference ? `<br><span style="color:#8ea0bb">${esc(next.location.reference)}</span>` : ''}</span></div>
        </div>
        <div class="row wrap" style="margin-top:20px">
          <a class="btn" href="${gmapsDir(next.location.lat, next.location.lng)}" target="_blank" rel="noopener">${icon('nav', 'sm')} Cómo llegar</a>
          <a class="btn ghost" href="${telLink(next.clientPhone)}">${icon('phone', 'sm')} Llamar</a>
          <button class="btn ghost" data-open-b="${next.id}">Ver detalle</button>
        </div></div>
      <div class="mini-map" id="next-map"></div></div></section>`
    : `<section class="hero"><div class="eyebrow">${icon('sparkle', 'sm')} Todo al día</div><h2>No tienes trabajos confirmados próximos</h2><p class="lead">Cuando confirmes una reserva aparecerá aquí con cuenta regresiva y la ruta para llegar.</p></section>`}

    <div class="kpis section">
      ${kpi('Por confirmar', pend.length, 'Solicitudes nuevas', 'bell', 'var(--pending-bg)', 'var(--pending)')}
      ${kpi('Hoy', todayL.length, todayL.length ? `Primero a las ${time(todayL[0].start)}` : 'Sin trabajos hoy', 'calendar', 'var(--brand-50)', 'var(--brand)')}
      ${kpi('Próximos 7 días', week.length, 'Confirmados', 'list', 'var(--info-bg)', 'var(--info)')}
      ${kpi('Ingresos del mes', money(income, CUR), 'Confirmados y completados', 'money', 'var(--ok-bg)', 'var(--ok)')}
    </div>

    <div class="grid section" style="grid-template-columns:repeat(auto-fit,minmax(340px,1fr));align-items:start">
      <div class="card"><div class="card-head"><h3 style="flex:1">Solicitudes por confirmar</h3>${pend.length ? `<span class="badge st-pendiente">${pend.length}</span>` : ''}</div>
        <div class="blist">${pend.length ? pend.map((b) => `${bookingRow(b)}<div class="row" style="padding:0 20px 14px 96px;gap:8px;border-bottom:1px solid var(--line)">
          <button class="btn sm ok" data-q="confirm" data-id="${b.id}">${icon('check', 'sm')} Confirmar</button>
          <button class="btn sm danger-soft" data-q="reject" data-id="${b.id}">No puedo</button></div>`).join('')
        : emptyBox('checkCircle', 'Nada pendiente', 'Las nuevas solicitudes aparecen aquí al instante.')}</div></div>
      <div class="card"><div class="card-head"><h3 style="flex:1">Hoy y mañana</h3><a href="#/agenda" class="small strong" style="color:var(--brand)">Ver agenda</a></div>
        <div class="blist">${soon.length ? soon.map(bookingRow).join('') : emptyBox('calendar', 'Sin trabajos', 'No tienes trabajos confirmados para hoy ni mañana.')}</div></div>
    </div></div>`;

  bindOpen(el); bindNotif(el);
  el.querySelector('[data-open-b]')?.addEventListener('click', (e) => openBooking(e.currentTarget.dataset.openB));
  el.querySelectorAll('[data-q]').forEach((btn) => btn.onclick = async () => {
    const b = S.bookings.find((x) => x.id === btn.dataset.id);
    if (btn.dataset.q === 'confirm') {
      confirmBooking(b);
    } else {
      const note = await confirmDialog({ title: '¿No puedes atender esta reserva?', ok: 'Avisar al cliente', danger: true, input: { label: 'Motivo / alternativa (opcional)' } });
      if (note === null) return;
      await api.updateBooking(b.id, { status: 'rechazado', adminNote: note });
    }
  });

  let map, timer;
  if (next) {
    map = createMap(el.querySelector('#next-map'), { center: [next.location.lat, next.location.lng], zoom: 15, layersControl: false, locate: false });
    L.marker([next.location.lat, next.location.lng], { icon: pinIcon('#f97316') }).addTo(map);
    const cd = el.querySelector('#cd');
    const paint = () => {
      let s = Math.max(0, Math.floor((next.start - Date.now()) / 1000));
      if (next.start <= Date.now()) { cd.innerHTML = `<div><b>EN</b><span>curso</span></div><div><b>${time(next.end)}</b><span>termina</span></div>`; return; }
      const d = Math.floor(s / 86400); s %= 86400; const h = Math.floor(s / 3600); s %= 3600; const m = Math.floor(s / 60); s %= 60;
      cd.innerHTML = [[d, 'días'], [h, 'horas'], [m, 'min'], [s, 'seg']].filter(([v, k], i) => i > 0 || v > 0).map(([v, k]) => `<div><b>${String(v).padStart(2, '0')}</b><span>${k}</span></div>`).join('');
    };
    paint(); timer = setInterval(paint, 1000);
  }
  return () => { clearInterval(timer); map?.remove(); };
}
const kpi = (label, val, foot, ic, bg, fg) =>
  `<div class="card kpi"><div class="k-top"><span>${label}</span><span class="k-ico" style="background:${bg};color:${fg}">${icon(ic, 'sm')}</span></div><div class="k-val">${val}</div><div class="k-foot">${foot}</div></div>`;

// ---------- agenda ----------
const AG = { month: null, sel: null };
function vAgenda(el) {
  AG.sel ||= dayKey(Date.now());
  AG.month ||= AG.sel.slice(0, 7);
  const [y, mo] = AG.month.split('-').map(Number);
  const first = new Date(Date.UTC(y, mo - 1, 1));
  const startDow = (first.getUTCDay() + 6) % 7; // lunes primero
  const days = [];
  for (let i = -startDow; i < 42 - startDow; i++) {
    const d = new Date(Date.UTC(y, mo - 1, 1 + i)).toISOString().slice(0, 10);
    days.push(d);
  }
  const byDay = {};
  S.bookings.forEach((b) => { if (['pendiente', 'confirmado', 'completado'].includes(b.status)) (byDay[dayKey(b.start)] ||= []).push(b); });
  const todayK = dayKey(Date.now());
  const selList = (byDay[AG.sel] || []).sort((a, b) => a.start - b.start);
  const selMs = toMs(AG.sel, '12:00');

  el.innerHTML = `<div class="agenda-layout fade-in">
    <div class="card cal">
      <div class="cal-head"><h3>${cap(monthYear(toMs(`${AG.month}-15`, '12:00')))}</h3>
        <button class="btn icon sm ghost" data-m="-1" aria-label="Mes anterior">${icon('left', 'sm')}</button>
        <button class="btn sm ghost" data-m="0">Hoy</button>
        <button class="btn icon sm ghost" data-m="1" aria-label="Mes siguiente">${icon('right', 'sm')}</button></div>
      <div class="cal-grid">${['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'].map((d) => `<div class="cal-dow">${d}</div>`).join('')}
        ${days.map((d) => `<button class="cal-day ${d.slice(0, 7) !== AG.month ? 'out' : ''} ${d === todayK ? 'today' : ''} ${d === AG.sel ? 'sel' : ''}" data-d="${d}">
          ${+d.slice(8)}<span class="cal-dots">${(byDay[d] || []).slice(0, 4).map((b) => `<i style="background:${STATUS[b.status].color}"></i>`).join('')}</span></button>`).join('')}
      </div>
      <div class="row wrap small muted" style="margin-top:14px;gap:14px">${['pendiente', 'confirmado', 'completado'].map((s) => `<span class="row" style="gap:6px"><i style="width:8px;height:8px;border-radius:50%;background:${STATUS[s].color}"></i>${STATUS[s].label}</span>`).join('')}</div>
    </div>
    <div class="card">
      <div class="card-head"><div style="flex:1"><h3>${dayLong(selMs)}</h3><div class="small muted">${selList.length ? `${selList.length} alquiler${selList.length > 1 ? 'es' : ''}` : 'Día libre'}</div></div></div>
      <div class="timeline">${selList.length ? selList.map((b) => `<div class="tl-item" data-open="${b.id}">
          <div class="tl-time">${time(b.start)}<small>${time(b.end)}</small></div>
          <div style="min-width:0"><div class="row" style="justify-content:space-between"><b class="strong">${esc(b.clientName)}</b>${statusBadge(b.status)}</div>
          <div class="small muted" style="margin-top:2px">${esc(itemsText(b))}</div>
          <div class="small" style="margin-top:4px;display:flex;gap:6px">${icon('pin', 'sm')}<span>${esc(b.location?.address || '')}</span></div></div></div>`).join('')
        : emptyBox('calendar', 'Sin alquileres este día', 'Elige otro día en el calendario.')}</div>
    </div></div>`;
  bindOpen(el);
  el.querySelectorAll('[data-d]').forEach((b) => b.onclick = () => { AG.sel = b.dataset.d; if (AG.sel.slice(0, 7) !== AG.month) AG.month = AG.sel.slice(0, 7); mount(undefined, false); });
  el.querySelectorAll('[data-m]').forEach((b) => b.onclick = () => {
    const k = +b.dataset.m;
    if (k === 0) { AG.sel = todayK; AG.month = todayK.slice(0, 7); }
    else { const d = new Date(Date.UTC(y, mo - 1 + k, 1)); AG.month = d.toISOString().slice(0, 7); }
    mount(undefined, false);
  });
}

// ---------- mapa de trabajos ----------
const MV = { filter: 'week', view: null };
function vMapa(el) {
  const now = Date.now();
  const lim = { today: dayKey(now), week: now + 7 * 864e5, all: Infinity };
  const list = upcoming(S.bookings).filter((b) => MV.filter === 'today' ? dayKey(b.start) === lim.today : b.start < lim[MV.filter]).sort((a, b) => a.start - b.start);
  el.innerHTML = `<div class="map-layout fade-in">
    <div class="card map-side">
      <div class="card-head" style="flex-wrap:wrap"><div class="seg">${[['today', 'Hoy'], ['week', '7 días'], ['all', 'Todos']].map(([k, t]) => `<button class="${MV.filter === k ? 'on' : ''}" data-f="${k}">${t}</button>`).join('')}</div>
        <span class="small muted">${list.length} lugar${list.length === 1 ? '' : 'es'}</span></div>
      <div>${list.length ? list.map((b, i) => `<div class="bitem" data-fly="${b.id}" style="grid-template-columns:34px 1fr">
          <div style="width:30px;height:30px;border-radius:50%;background:${STATUS[b.status].color};color:#fff;display:grid;place-items:center;font-weight:800;font-size:13px">${i + 1}</div>
          <div style="min-width:0"><div class="b-title">${esc(b.clientName)}</div><div class="b-sub"><span>${relDay(b.start)} · ${time(b.start)}</span><span>${esc(b.location?.address || '')}</span></div></div></div>`).join('')
        : emptyBox('map', 'Sin lugares', 'No hay trabajos en este período.')}</div>
    </div>
    <div class="map tall" id="jobs-map"></div></div>`;
  const map = createMap(el.querySelector('#jobs-map'), MV.view || {});
  const markers = {};
  list.forEach((b, i) => {
    if (!b.location?.lat) return;
    const mk = L.marker([b.location.lat, b.location.lng], { icon: pinIcon(STATUS[b.status].color, String(i + 1)) }).addTo(map);
    mk.bindPopup(`<b>${esc(b.clientName)}</b> ${statusBadge(b.status)}<br>${relDay(b.start)} · ${time(b.start)}–${time(b.end)}<br><span style="color:#64748b">${esc(b.location.address)}</span>
      <div style="display:flex;gap:6px;margin-top:8px"><a class="btn sm" style="color:#fff" href="${gmapsDir(b.location.lat, b.location.lng)}" target="_blank" rel="noopener">Cómo llegar</a><button class="btn sm ghost" data-pop="${b.id}">Detalle</button></div>`);
    markers[b.id] = mk;
  });
  map.on('popupopen', (e) => e.popup.getElement().querySelector('[data-pop]')?.addEventListener('click', (ev) => openBooking(ev.currentTarget.dataset.pop)));
  const pts = Object.values(markers).map((m) => m.getLatLng());
  if (!MV.view && pts.length) map.fitBounds(L.latLngBounds(pts).pad(0.25), { maxZoom: 15 });
  el.querySelectorAll('[data-f]').forEach((b) => b.onclick = () => { MV.filter = b.dataset.f; MV.view = null; mount(undefined, false); });
  el.querySelectorAll('[data-fly]').forEach((r) => r.onclick = () => { const m = markers[r.dataset.fly]; if (m) { map.flyTo(m.getLatLng(), 17); m.openPopup(); if (innerWidth < 900) el.querySelector('#jobs-map').scrollIntoView({ behavior: 'smooth' }); } });
  return () => { MV.view = { center: map.getCenter(), zoom: map.getZoom() }; map.remove(); };
}

// ---------- lista de reservas ----------
const RV = { filter: 'pendiente', q: '' };
function vReservas(el) {
  el.innerHTML = `<div class="fade-in">
    <div class="row wrap" style="margin-bottom:16px">
      <div class="seg">${[['pendiente', 'Por confirmar'], ['proximas', 'Próximas'], ['historial', 'Historial'], ['todas', 'Todas']].map(([k, t]) => `<button class="${RV.filter === k ? 'on' : ''}" data-f="${k}">${t}</button>`).join('')}</div>
      <div class="spacer"></div>
      <div class="input-icon" style="min-width:240px;flex:1;max-width:340px">${icon('search', 'sm')}<input class="input" id="q" placeholder="Buscar cliente, teléfono o zona" value="${esc(RV.q)}"></div>
    </div>
    <div class="card"><div class="blist" id="bl"></div></div></div>`;
  const paint = () => {
    const now = Date.now();
    const q = RV.q.toLowerCase().trim();
    let list = S.bookings.filter((b) => {
      if (RV.filter === 'pendiente') return b.status === 'pendiente' && b.end > now;
      if (RV.filter === 'proximas') return b.status === 'confirmado' && b.end > now;
      if (RV.filter === 'historial') return b.end <= now || ['rechazado', 'cancelado', 'completado'].includes(b.status);
      return true;
    });
    if (q) list = list.filter((b) => [b.clientName, b.clientPhone, b.location?.address, itemsText(b)].join(' ').toLowerCase().includes(q));
    if (RV.filter === 'historial' || RV.filter === 'todas') list = [...list].reverse();
    el.querySelector('#bl').innerHTML = list.length ? list.map(bookingRow).join('') : emptyBox('list', 'Sin reservas', q ? 'No hay coincidencias con tu búsqueda.' : 'No hay reservas en esta sección.');
  };
  paint(); bindOpen(el);
  el.querySelectorAll('[data-f]').forEach((b) => b.onclick = () => { RV.filter = b.dataset.f; mount(undefined, false); });
  el.querySelector('#q').oninput = (e) => { RV.q = e.target.value; paint(); };
}

// ---------- servicios ----------
function vServicios(el) {
  el.innerHTML = `<div class="fade-in">
    <div class="section-head"><div style="flex:1"><h2>Tu catálogo</h2><p>Los clientes ven estos servicios al reservar.</p></div><button class="btn" id="new">${icon('plus', 'sm')} Nuevo servicio</button></div>
    ${S.services.length ? `<div class="svc-grid">${S.services.map((s, i) => `<div class="card svc">
      <div class="svc-media">${svcMedia(s, i)}</div>
      <div class="svc-body"><div class="row" style="justify-content:space-between"><h3>${esc(s.name)}</h3>${s.active === false ? '<span class="badge st-cancelado">Oculto</span>' : ''}</div><p>${esc(s.description)}</p>
      <div class="svc-foot"><span class="price">${priceTag(s)}</span><button class="btn sm ghost" data-edit="${s.id}">${icon('edit', 'sm')} Editar</button></div></div></div>`).join('')}</div>`
      : emptyBox('box', 'Aún no tienes servicios', 'Agrega lo que alquilas, con precio y fotos.')}</div>`;
  el.querySelector('#new').onclick = () => editService();
  el.querySelectorAll('[data-edit]').forEach((b) => b.onclick = () => editService(svcById(b.dataset.edit)));
}

function photosEditor(container, photos) {
  const paint = () => {
    container.innerHTML = `<div class="photos-edit">${photos.map((p, i) => `<div class="ph-item"><img src="${esc(p)}" alt=""><button type="button" data-rm="${i}" aria-label="Quitar">${icon('x', 'sm')}</button></div>`).join('')}
      <label class="add">${icon('plus')}<span>Agregar fotos</span><input type="file" accept="image/*" multiple hidden></label></div>`;
    container.querySelectorAll('[data-rm]').forEach((b) => b.onclick = () => { photos.splice(+b.dataset.rm, 1); paint(); });
    container.querySelector('input').onchange = async (e) => {
      const files = [...e.target.files];
      const add = container.querySelector('label.add');
      add.innerHTML = '<span class="small">Subiendo…</span>';
      for (const f of files) {
        try {
          const blob = await resizeImage(f, ONLINE_MODE ? 1600 : 900, ONLINE_MODE ? 0.82 : 0.7);
          photos.push(await api.uploadImage(blob));
        } catch (err) { toast('No se pudo subir una foto', err.message, 'bad'); }
      }
      paint();
    };
  };
  paint();
}

function editService(s = null) {
  const photos = [...(s?.photos || [])];
  modal({
    title: s ? 'Editar servicio' : 'Nuevo servicio',
    body: `<div class="form-grid">
      <div class="field full"><label>Nombre</label><input class="input" id="sv-n" value="${esc(s?.name)}" placeholder="Ej.: Data + pantalla"></div>
      <div class="field full"><label>Descripción</label><textarea class="input" id="sv-d" placeholder="Qué incluye, capacidad, medidas…">${esc(s?.description)}</textarea></div>
      <div class="field"><label>Precio (${CUR})</label><input class="input" id="sv-p" type="number" min="0" step="1" value="${s?.price ?? ''}"></div>
      <div class="field"><label>Unidad</label><input class="input" id="sv-u" value="${esc(s?.unit || 'por alquiler')}" placeholder="por alquiler, por hora, por día…"></div>
      <div class="field full"><label>Fotos</label><div id="sv-ph"></div><span class="hint">La primera foto es la portada.</span></div>
      <label class="row full small strong"><input type="checkbox" id="sv-h" ${s?.perHour ? 'checked' : ''}> El precio es por hora (se multiplica por las horas reservadas)</label>
      <label class="row full small strong"><input type="checkbox" id="sv-a" ${s?.active === false ? '' : 'checked'}> Visible para los clientes</label>
      <p class="full tiny muted">Deja el precio en 0 para que diga "Consultar precio".</p></div>`,
    foot: `${s ? `<button class="btn danger-soft" id="sv-del" style="margin-right:auto">${icon('trash', 'sm')} Eliminar</button>` : ''}<button class="btn ghost" data-close>Cancelar</button><button class="btn" id="sv-ok">Guardar</button>`,
    onMount: (el, m) => {
      photosEditor(el.querySelector('#sv-ph'), photos);
      el.querySelector('#sv-ok').onclick = async () => {
        const name = el.querySelector('#sv-n').value.trim();
        if (!name) return toast('Escribe el nombre del servicio', '', 'bad');
        try {
          await api.saveService({ ...(s ? { id: s.id } : {}), name, description: el.querySelector('#sv-d').value.trim(), price: +el.querySelector('#sv-p').value || 0, unit: el.querySelector('#sv-u').value.trim(), perHour: el.querySelector('#sv-h').checked, photos, active: el.querySelector('#sv-a').checked });
          m.close(); toast('Servicio guardado', '', 'ok');
        } catch (err) { toast('No se pudo guardar', err.message, 'bad'); }
      };
      el.querySelector('#sv-del')?.addEventListener('click', async () => {
        if (!(await confirmDialog({ title: `¿Eliminar "${s.name}"?`, ok: 'Eliminar', danger: true }))) return;
        await api.deleteService(s.id); m.close();
      });
    },
  });
}

// ---------- galería de trabajos ----------
function vGaleria(el) {
  const admin = isAdmin();
  el.innerHTML = `<div class="fade-in">
    <div class="section-head"><div style="flex:1"><h2>Trabajos realizados</h2><p>${admin ? 'Sube fotos de tus trabajos para que los clientes vean la calidad de la proyección.' : 'Fotos reales de clases, defensas, cultos y eventos donde llevamos nuestro data.'}</p></div>
      ${admin ? `<button class="btn" id="new">${icon('plus', 'sm')} Nuevo trabajo</button>` : `<a class="btn" href="#/reservar">${icon('calPlus', 'sm')} Reservar</a>`}</div>
    ${S.works.length ? `<div class="gallery">${S.works.map((w) => `<div class="card work" data-w="${w.id}">
      ${w.photos?.[0] ? `<img src="${esc(w.photos[0])}" alt="${esc(w.title)}" loading="lazy">` : `<div class="ph g1" style="aspect-ratio:4/3;display:grid;place-items:center;color:#fff">${icon('image', 'lg')}</div>`}
      <div class="w-body"><div class="row" style="justify-content:space-between"><b>${esc(w.title)}</b>${admin ? `<button class="btn sm ghost icon" data-ew="${w.id}" aria-label="Editar">${icon('edit', 'sm')}</button>` : ''}</div>
      <div class="small muted">${[w.serviceId && svcById(w.serviceId)?.name, w.date && cap(dayShort(w.date)), w.place].filter(Boolean).map(esc).join(' · ')}</div>
      ${w.description ? `<p class="small" style="margin-top:6px">${esc(w.description)}</p>` : ''}</div>
      ${w.photos?.length > 1 ? `<div class="thumbs">${w.photos.slice(1, 6).map((p) => `<img src="${esc(p)}" alt="" loading="lazy">`).join('')}${w.photos.length > 6 ? `<span class="small muted" style="align-self:center">+${w.photos.length - 6}</span>` : ''}</div>` : ''}
    </div>`).join('')}</div>`
      : emptyBox('images', 'Aún no hay trabajos publicados', admin ? 'Agrega fotos de los eventos que ya hiciste.' : 'Pronto verás aquí fotos de nuestros trabajos.')}</div>`;
  el.querySelector('#new')?.addEventListener('click', () => editWork());
  el.querySelectorAll('[data-w]').forEach((c) => c.onclick = (e) => {
    const w = S.works.find((x) => x.id === c.dataset.w);
    if (e.target.closest('[data-ew]')) return editWork(w);
    lightbox(w.photos, 0, w.title);
  });
}

function editWork(w = null) {
  const photos = [...(w?.photos || [])];
  modal({
    title: w ? 'Editar trabajo' : 'Nuevo trabajo realizado',
    body: `<div class="form-grid">
      <div class="field full"><label>Título</label><input class="input" id="w-t" value="${esc(w?.title)}" placeholder="Ej.: Defensa de tesis en la UMSS"></div>
      <div class="field"><label>Servicio</label><select class="input" id="w-s"><option value="">—</option>${S.services.map((s) => `<option value="${s.id}" ${w?.serviceId === s.id ? 'selected' : ''}>${esc(s.name)}</option>`).join('')}</select></div>
      <div class="field"><label>Fecha</label><input class="input" type="date" id="w-d" value="${w?.date ? dayKey(w.date) : ''}"></div>
      <div class="field full"><label>Lugar / zona</label><input class="input" id="w-p" value="${esc(w?.place)}" placeholder="Ej.: Quillacollo"></div>
      <div class="field full"><label>Descripción</label><textarea class="input" id="w-de">${esc(w?.description)}</textarea></div>
      <div class="field full"><label>Fotos</label><div id="w-ph"></div></div></div>`,
    foot: `${w ? `<button class="btn danger-soft" id="w-del" style="margin-right:auto">${icon('trash', 'sm')} Eliminar</button>` : ''}<button class="btn ghost" data-close>Cancelar</button><button class="btn" id="w-ok">Publicar</button>`,
    onMount: (el, m) => {
      photosEditor(el.querySelector('#w-ph'), photos);
      el.querySelector('#w-ok').onclick = async () => {
        const title = el.querySelector('#w-t').value.trim();
        if (!title) return toast('Escribe un título', '', 'bad');
        if (!photos.length) return toast('Agrega al menos una foto', '', 'bad');
        const d = el.querySelector('#w-d').value;
        try {
          await api.saveWork({ ...(w ? { id: w.id } : {}), title, serviceId: el.querySelector('#w-s').value, date: d ? toMs(d, '12:00') : (w?.date || 0), place: el.querySelector('#w-p').value.trim(), description: el.querySelector('#w-de').value.trim(), photos });
          m.close(); toast('Trabajo publicado', 'Tus clientes ya pueden verlo.', 'ok');
        } catch (err) { toast('No se pudo guardar', err.message, 'bad'); }
      };
      el.querySelector('#w-del')?.addEventListener('click', async () => {
        if (!(await confirmDialog({ title: '¿Eliminar este trabajo?', ok: 'Eliminar', danger: true }))) return;
        await api.deleteWork(w.id); m.close();
      });
    },
  });
}

// ---------- perfil ----------
function vPerfil(el) {
  const p = permission();
  const admin = isAdmin();
  el.innerHTML = `<div class="fade-in grid" style="grid-template-columns:repeat(auto-fit,minmax(320px,1fr));align-items:start">
    <div class="card pad col">
      <div class="row">${avatar(S.user.name, 56)}<div><h2>${esc(S.user.name)}</h2><div class="small muted">${esc(S.user.email)} · ${admin ? 'Administrador' : 'Cliente'}</div></div></div>
      <div class="field"><label>Nombre</label><input class="input" id="p-n" value="${esc(S.user.name)}"></div>
      <div class="field"><label>Celular / WhatsApp</label><input class="input" id="p-p" type="tel" value="${esc(S.user.phone)}" placeholder="7XXXXXXX"></div>
      <button class="btn" id="p-save">Guardar cambios</button>
    </div>
    <div class="col">
      <div class="card pad col">
        <h3>Notificaciones</h3>
        <div class="row"><span class="k-ico" style="width:38px;height:38px;border-radius:10px;display:grid;place-items:center;background:${p === 'granted' ? 'var(--ok-bg)' : 'var(--pending-bg)'};color:${p === 'granted' ? 'var(--ok)' : 'var(--pending)'}">${icon('bell', 'sm')}</span>
          <div style="flex:1"><b class="strong">${p === 'granted' ? 'Activadas' : p === 'denied' ? 'Bloqueadas en el navegador' : p === 'unsupported' ? 'No disponibles en este navegador' : 'Desactivadas'}</b>
          <div class="small muted">Avisos de confirmación, 1 día antes y 15 minutos antes.</div></div></div>
        ${p !== 'granted' && p !== 'unsupported' ? '<button class="btn soft" data-enable-notif>Activar notificaciones</button>' : '<button class="btn ghost" id="p-test">Probar notificación</button>'}
        <p class="tiny muted">${ONLINE_MODE && self.FIREBASE_VAPID_KEY ? 'Los avisos llegan aunque la app esté cerrada.' : 'Mientras la app esté abierta (o en segundo plano) recibirás los avisos. Para tenerlos siempre, usa también "Agregar a mi calendario" en cada reserva.'}</p>
        <p class="tiny muted">En iPhone: abre la app desde Safari › Compartir › "Agregar a inicio" para habilitar las notificaciones.</p>
      </div>
      ${admin ? `<div class="card pad col"><h3>Administrar</h3>
        <a class="btn ghost" href="#/servicios" style="justify-content:flex-start">${icon('box', 'sm')} Servicios y precios</a>
        <a class="btn ghost" href="#/galeria" style="justify-content:flex-start">${icon('images', 'sm')} Fotos de trabajos realizados</a>
        <a class="btn ghost" href="#/agenda" style="justify-content:flex-start">${icon('calendar', 'sm')} Agenda</a></div>` : ''}
      <div class="card pad col">
        <h3>Sesión</h3>
        <button class="btn danger-soft" id="p-out">${icon('logout', 'sm')} Cerrar sesión</button>
        ${!ONLINE_MODE ? '<button class="btn ghost" id="p-reset">Reiniciar datos de demostración</button>' : ''}
      </div>
    </div></div>`;
  bindNotif(el);
  el.querySelector('#p-save').onclick = async () => {
    try { await api.updateProfile({ name: el.querySelector('#p-n').value.trim(), phone: el.querySelector('#p-p').value.trim() }); toast('Perfil actualizado', '', 'ok'); }
    catch (e) { toast('No se pudo guardar', e.message, 'bad'); }
  };
  el.querySelector('#p-test')?.addEventListener('click', () => notify('Así se verán tus avisos', 'Ejemplo: "Empieza en 15 min · Data en Cala Cala"', { tag: 'test' }));
  el.querySelector('#p-out').onclick = () => api.signOut();
  el.querySelector('#p-reset')?.addEventListener('click', async () => { if (await confirmDialog({ title: '¿Reiniciar la demo?', text: 'Se borrarán los datos de prueba de este navegador.', ok: 'Reiniciar', danger: true })) api.resetDemo(); });
}

// =====================================================================
//                               CLIENTE
// =====================================================================
function vInicio(el) {
  const mine = upcoming(S.bookings);
  const services = S.services.filter((s) => s.active !== false);
  el.innerHTML = `<div class="fade-in">
    ${notifBanner()}
    <section class="hero">
      <div class="eyebrow">${icon('pin', 'sm')} Cochabamba · Sacaba · Vinto</div>
      <h1 style="font-size:clamp(28px,4.4vw,46px);max-width:680px">Que tu presentación <span style="color:var(--hl)">se vea en grande.</span></h1>
      <p class="lead">Alquila un data (proyector Epson) a <b style="color:#fff">34 Bs</b>. Elige la fecha, marca en el mapa dónde será tu clase, defensa o evento, y te lo llevamos. Te confirmamos por aquí al instante.</p>
      <div class="row wrap" style="margin-top:22px">
        <a class="btn lg" href="#/reservar">${icon('calPlus')} Reservar un data</a>
        <a class="btn lg ghost" href="#/galeria">${icon('images')} Ver trabajos</a>
      </div>
    </section>
    ${mine.length ? `<div class="section"><div class="section-head"><h2 style="flex:1">Tus próximas reservas</h2><a href="#/mis-reservas" class="small strong">Ver todas</a></div>
      <div class="card"><div class="blist">${mine.slice(0, 3).map(bookingRow).join('')}</div></div></div>` : ''}
    <div class="section"><div class="section-head"><div style="flex:1"><h2>Nuestros servicios</h2><p>Te llevamos el proyector a Cochabamba, Sacaba y Vinto.</p></div></div>
      ${services.length ? `<div class="svc-grid">${services.map((s, i) => `<div class="card svc" data-s="${s.id}" style="cursor:pointer">
        <div class="svc-media">${svcMedia(s, i)}</div>
        <div class="svc-body"><h3>${esc(s.name)}</h3><p>${esc(s.description)}</p>
        <div class="svc-foot"><span class="price">${priceTag(s)}</span><a class="btn sm" href="#/reservar?s=${s.id}">Reservar</a></div></div></div>`).join('')}</div>`
      : emptyBox('box', 'Catálogo en preparación', 'Muy pronto verás aquí nuestros servicios.')}</div>
    ${S.works.length ? `<div class="section"><div class="section-head"><h2 style="flex:1">Trabajos recientes</h2><a href="#/galeria" class="small strong">Ver galería</a></div>
      <div class="svc-grid">${S.works.slice(0, 3).map((w) => `<div class="card svc" data-w="${w.id}" style="cursor:pointer"><div class="svc-media">${w.photos?.[0] ? `<img src="${esc(w.photos[0])}" alt="" loading="lazy">` : ''}</div><div class="svc-body"><h3>${esc(w.title)}</h3><span class="small muted">${esc(w.place || '')}</span></div></div>`).join('')}</div></div>` : ''}
    <div class="section card pad row wrap" style="justify-content:space-between">
      <div><h3>¿Tienes dudas o quieres la promoción?</h3><p class="muted small">Escríbenos al ${esc(CFG.whatsappDisplay || CFG.whatsapp)} y te ayudamos.</p></div>
      <a class="btn btn-wa" href="${waLink(CFG.whatsapp, `Hola ${BIZ}, quiero consultar sobre un alquiler.`)}" target="_blank" rel="noopener">${icon('chat', 'sm')} WhatsApp</a>
    </div></div>`;
  bindOpen(el); bindNotif(el);
  el.querySelectorAll('[data-s]').forEach((c) => c.onclick = (e) => { if (!e.target.closest('a')) showService(svcById(c.dataset.s)); });
  el.querySelectorAll('[data-w]').forEach((c) => c.onclick = () => { const w = S.works.find((x) => x.id === c.dataset.w); lightbox(w.photos, 0, w.title); });
}

function showService(s) {
  if (!s) return;
  modal({
    title: esc(s.name), wide: true,
    body: `${s.photos?.length ? `<div class="photos-edit" style="grid-template-columns:repeat(auto-fill,minmax(150px,1fr))">${s.photos.map((p, i) => `<div class="ph-item" data-i="${i}" style="cursor:zoom-in"><img src="${esc(p)}" alt=""></div>`).join('')}</div>` : `<div class="svc-media ${toneOf(s)}" style="border-radius:16px"><div class="ph">${icon(s.icon || 'projector')}</div></div>`}
      <p style="margin-top:16px">${esc(s.description)}</p><p class="price" style="margin-top:12px">${priceTag(s)}</p>`,
    foot: `<button class="btn ghost" data-close>Cerrar</button><a class="btn" href="#/reservar?s=${s.id}" data-close>${icon('calPlus', 'sm')} Reservar este servicio</a>`,
    onMount: (el) => el.querySelectorAll('[data-i]').forEach((x) => x.onclick = () => lightbox(s.photos, +x.dataset.i, s.name)),
  });
}

function vMisReservas(el) {
  const now = Date.now();
  const up = S.bookings.filter((b) => b.end > now && ['pendiente', 'confirmado'].includes(b.status));
  const past = S.bookings.filter((b) => !up.includes(b)).reverse();
  el.innerHTML = `<div class="fade-in">${notifBanner()}
    <div class="section-head"><h2 style="flex:1">Próximas</h2><a class="btn sm" href="#/reservar">${icon('plus', 'sm')} Nueva reserva</a></div>
    <div class="card"><div class="blist">${up.length ? up.map(bookingRow).join('') : emptyBox('calendar', 'No tienes reservas próximas', 'Haz tu primera reserva en menos de un minuto.', `<a class="btn" href="#/reservar">${icon('calPlus', 'sm')} Reservar</a>`)}</div></div>
    ${past.length ? `<div class="section"><div class="section-head"><h2>Anteriores</h2></div><div class="card"><div class="blist">${past.map(bookingRow).join('')}</div></div></div>` : ''}</div>`;
  bindOpen(el); bindNotif(el);
}

// ---------- asistente de reserva ----------
let W = null;
const newWizard = () => ({ step: 1, qty: {}, date: '', start: '', end: '', location: null, reference: '', name: S.user?.name || '', phone: S.user?.phone || '', notes: '', sending: false });
const STEPS = ['Servicios', 'Fecha y hora', 'Ubicación', 'Confirmar'];

function vReservar(el, params) {
  if (!W || W.done) W = newWizard();
  const pre = params.get('s');
  if (pre && svcById(pre) && !W.qty[pre]) { W.qty[pre] = 1; history.replaceState(null, '', '#/reservar'); }
  let pickMap = null;

  const items = () => Object.entries(W.qty).filter(([, q]) => q > 0).map(([id, qty]) => { const s = svcById(id); return s && { serviceId: id, name: s.name, price: s.price || 0, qty, ...(s.perHour ? { perHour: true } : {}) }; }).filter(Boolean);
  const zone = () => zoneOf(W.location);
  const total = () => calcTotal(items(), startMs(), endMs(), zone()?.fee || 0);
  const startMs = () => (W.date && W.start ? toMs(W.date, W.start) : null);
  const endMs = () => { if (!W.date || !W.end) return null; let e = toMs(W.date, W.end); if (e <= startMs()) e += 864e5; return e; };

  const summary = () => `<div class="card pad summary"><h3 style="margin-bottom:10px">Resumen</h3>
    ${items().length ? items().map((i) => `<div class="line"><span>${i.qty} × ${esc(i.name)}</span><span class="muted">${lineMoney(i, hoursOf(startMs(), endMs()))}</span></div>`).join('') : '<p class="small muted">Elige al menos un servicio.</p>'}
    ${startMs() ? `<div class="line" style="margin-top:6px"><span class="muted">${icon('calendar', 'sm')}</span><span style="text-align:right">${dayLong(startMs())}<br>${time(startMs())}${endMs() ? ` – ${time(endMs())}` : ''}</span></div>` : ''}
    ${W.location ? `<div class="line"><span class="muted">${icon('pin', 'sm')}</span><span style="text-align:right">${esc(W.location.address || `${W.location.lat}, ${W.location.lng}`)}</span></div>` : ''}
    ${W.location ? surchargeLine(zone()?.name, zone()?.fee || 0, !!zone()) : ''}
    <div class="line total"><span>Total referencial</span><span>${money(total(), CUR)}</span></div>
    ${hasConsult(items()) ? '<p class="tiny muted">Los extras "a consultar" se suman al confirmar.</p>' : ''}
    ${!W.location ? '<p class="tiny" style="margin-top:6px;color:var(--pending);font-weight:600">+ Recargo por distancia según tu zona (se calcula al marcar el lugar).</p>' : !zone() ? '<p class="tiny" style="margin-top:6px;color:var(--pending);font-weight:600">Tu zona no tiene tarifa fija: te indicamos el recargo al confirmar.</p>' : ''}
    <p class="tiny muted" style="margin-top:8px">No pagas nada ahora. Te confirmamos disponibilidad y precio final por la app o WhatsApp.</p></div>`;

  const quickDates = () => {
    const out = [['Hoy', 0], ['Mañana', 1]];
    const dow = new Date(Date.now() - 4 * 3600e3).getUTCDay();
    out.push(['Este sábado', ((6 - dow + 7) % 7) || 7], ['Este domingo', ((7 - dow) % 7) || 7]);
    return out.map(([t, n]) => [t, dayKey(Date.now() + n * 864e5)]);
  };

  const stepBody = () => {
    if (W.step === 1) return `<div class="col">${S.services.filter((s) => s.active !== false).map((s, i) => `<div class="pick ${W.qty[s.id] ? 'on' : ''}">
        <div class="thumb">${s.photos?.[0] ? `<img src="${esc(s.photos[0])}" alt="">` : `<div class="ph ${toneOf(s, i)}" style="position:absolute;inset:0;display:grid;place-items:center;color:#fff">${icon(s.icon || 'projector')}</div>`}</div>
        <div style="min-width:0"><b class="strong">${esc(s.name)}</b><div class="small muted" style="display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden">${esc(s.description)}</div><div class="price" style="font-size:15px;margin-top:2px">${priceTag(s)}</div></div>
        <div class="stepper"><button type="button" data-dec="${s.id}" aria-label="Menos">−</button><input inputmode="numeric" data-qty="${s.id}" value="${W.qty[s.id] || 0}"><button type="button" data-inc="${s.id}" aria-label="Más">+</button></div></div>`).join('') || emptyBox('box', 'No hay servicios disponibles', 'Vuelve más tarde.')}</div>`;
    if (W.step === 2) return `<div class="card pad col">
        <div class="field"><label>¿Qué día?</label><div class="chips" style="margin-bottom:8px">${quickDates().map(([t, d]) => `<button type="button" class="chip ${W.date === d ? 'on' : ''}" data-qd="${d}">${t}</button>`).join('')}</div>
          <input class="input" type="date" id="w-date" min="${dayKey(Date.now())}" value="${W.date}"></div>
        <div class="form-grid"><div class="field"><label>Desde (hora)</label><input class="input" type="time" id="w-start" value="${W.start}" step="900"></div>
          <div class="field"><label>Hasta (hora)</label><input class="input" type="time" id="w-end" value="${W.end}" step="900"></div></div>
        <div class="field"><label>Duración rápida</label><div class="chips">${[1, 2, 3, 4, 8].map((h) => `<button type="button" class="chip" data-dur="${h}">${h} hora${h > 1 ? 's' : ''}</button>`).join('')}</div></div>
        <p class="small muted">Horario de Bolivia. Si termina pasada la medianoche, se toma como el día siguiente.</p></div>`;
    if (W.step === 3) return `<div class="col"><div id="picker"></div>
        <div class="card pad form-grid">
          <div class="field full"><label>Dirección</label><input class="input" id="w-addr" value="${esc(W.location?.address || '')}" placeholder="Se completa al marcar el mapa; puedes corregirla"></div>
          <div class="field full"><label>Referencia para llegar</label><input class="input" id="w-ref" value="${esc(W.reference)}" placeholder="Ej.: Aula 204, 2do piso · iglesia frente a la plaza"></div></div></div>`;
    return `<div class="card pad form-grid">
        <div class="field"><label>Tu nombre</label><input class="input" id="w-name" value="${esc(W.name)}" autocomplete="name"></div>
        <div class="field"><label>Celular / WhatsApp</label><input class="input" id="w-phone" type="tel" value="${esc(W.phone)}" placeholder="7XXXXXXX" autocomplete="tel"></div>
        <div class="field full"><label>Detalles del evento (opcional)</label><textarea class="input" id="w-notes" placeholder="Tipo de evento (clase, defensa, culto, taller…), si necesitas pantalla o parlante…">${esc(W.notes)}</textarea></div>
        <div class="full banner"><div class="ico">${icon('shield')}</div><div class="small">Al enviar, el negocio recibe tu solicitud al instante y te confirma por esta app. Te avisaremos 1 día antes y 15 minutos antes.</div></div></div>`;
  };

  const draw = () => {
    pickMap?.remove(); pickMap = null;
    el.innerHTML = `<div class="fade-in">
      <div class="steps">${STEPS.map((t, i) => `<div class="step ${W.step === i + 1 ? 'on' : W.step > i + 1 ? 'done' : ''}"><span class="n">${W.step > i + 1 ? icon('check', 'sm') : i + 1}</span><span class="t">${t}</span></div>`).join('')}</div>
      <div class="wiz-layout"><div><h2 style="margin-bottom:14px">${['¿Qué quieres alquilar?', '¿Cuándo lo necesitas?', '¿Dónde será?', 'Tus datos'][W.step - 1]}</h2><div id="wbody">${stepBody()}</div>
        <div class="wiz-actions">${W.step > 1 ? `<button class="btn ghost" id="back">${icon('left', 'sm')} Atrás</button>` : '<span></span>'}
          <button class="btn lg" id="next" ${W.sending ? 'disabled' : ''}>${W.step < 4 ? `Continuar ${icon('arrow', 'sm')}` : `${icon('send', 'sm')} ${W.sending ? 'Enviando…' : 'Enviar solicitud'}`}</button></div></div>
        <div id="sum">${summary()}</div></div></div>`;
    bind();
  };
  const paintSummary = () => { const s = el.querySelector('#sum'); if (s) s.innerHTML = summary(); };

  const bind = () => {
    el.querySelector('#back')?.addEventListener('click', () => { W.step--; draw(); scrollTo(0, 0); });
    el.querySelector('#next').onclick = next;
    if (W.step === 1) {
      const set = (id, v) => { W.qty[id] = Math.max(0, Math.min(999, v | 0)); const inp = el.querySelector(`[data-qty="${id}"]`); inp.value = W.qty[id]; inp.closest('.pick').classList.toggle('on', W.qty[id] > 0); paintSummary(); };
      el.querySelectorAll('[data-inc]').forEach((b) => b.onclick = () => set(b.dataset.inc, (W.qty[b.dataset.inc] || 0) + 1));
      el.querySelectorAll('[data-dec]').forEach((b) => b.onclick = () => set(b.dataset.dec, (W.qty[b.dataset.dec] || 0) - 1));
      el.querySelectorAll('[data-qty]').forEach((i) => i.oninput = () => set(i.dataset.qty, +i.value.replace(/\D/g, '')));
    }
    if (W.step === 2) {
      const d = el.querySelector('#w-date'), s = el.querySelector('#w-start'), e = el.querySelector('#w-end');
      d.onchange = () => { W.date = d.value; el.querySelectorAll('[data-qd]').forEach((c) => c.classList.toggle('on', c.dataset.qd === W.date)); paintSummary(); };
      s.onchange = () => { W.start = s.value; paintSummary(); };
      e.onchange = () => { W.end = e.value; paintSummary(); };
      el.querySelectorAll('[data-qd]').forEach((c) => c.onclick = () => { d.value = c.dataset.qd; d.onchange(); });
      el.querySelectorAll('[data-dur]').forEach((c) => c.onclick = () => {
        if (!W.start) return toast('Primero elige la hora de inicio', '', 'bad');
        const [h, m] = W.start.split(':').map(Number);
        const t = (h + +c.dataset.dur) % 24;
        W.end = `${String(t).padStart(2, '0')}:${String(m).padStart(2, '0')}`; e.value = W.end; paintSummary();
      });
    }
    if (W.step === 3) {
      const addr = el.querySelector('#w-addr');
      pickMap = locationPicker(el.querySelector('#picker'), {
        value: W.location,
        onChange: (loc) => {
          W.location = { lat: loc.lat, lng: loc.lng, address: loc.address ?? W.location?.address ?? '' };
          if (loc.resolving) addr.placeholder = 'Buscando dirección…';
          else if (loc.address != null) addr.value = loc.address;
          W.location.address = addr.value;
          paintSummary();
        },
      });
      addr.oninput = () => { if (W.location) { W.location.address = addr.value; paintSummary(); } };
      el.querySelector('#w-ref').oninput = (e) => (W.reference = e.target.value);
    }
    if (W.step === 4) {
      el.querySelector('#w-name').oninput = (e) => (W.name = e.target.value);
      el.querySelector('#w-phone').oninput = (e) => (W.phone = e.target.value);
      el.querySelector('#w-notes').oninput = (e) => (W.notes = e.target.value);
    }
  };

  const next = async () => {
    if (W.step === 1 && !items().length) return toast('Elige al menos un servicio', 'Usa el botón + para agregar.', 'bad');
    if (W.step === 2) {
      if (!W.date || !W.start || !W.end) return toast('Completa el día y el horario', '', 'bad');
      if (startMs() < Date.now() + 30 * 60000) return toast('Elige un horario futuro', 'Debe ser al menos 30 minutos desde ahora.', 'bad');
    }
    if (W.step === 3) {
      if (!W.location) return toast('Marca el lugar en el mapa', 'Toca el mapa o busca la dirección.', 'bad');
      W.location.address = el.querySelector('#w-addr').value.trim() || W.location.address;
    }
    if (W.step < 4) { W.step++; draw(); scrollTo(0, 0); return; }
    if (!W.name.trim() || W.phone.replace(/\D/g, '').length < 7) return toast('Escribe tu nombre y un celular válido', '', 'bad');
    W.sending = true; draw();
    try {
      const id = await api.createBooking({
        clientName: W.name.trim(), clientPhone: W.phone.trim(), clientEmail: S.user.email || '',
        items: items().map((i) => (i.perHour ? { ...i, hours: hoursOf(startMs(), endMs()) } : i)), total: total(), extra: zone()?.fee || 0, zone: zone()?.name || null, start: startMs(), end: endMs(),
        location: { lat: W.location.lat, lng: W.location.lng, address: W.location.address, reference: W.reference.trim() },
        notes: W.notes.trim(),
      });
      if (W.name !== S.user.name || W.phone !== S.user.phone) api.updateProfile({ name: W.name.trim(), phone: W.phone.trim() }).catch(() => {});
      W.done = true;
      el.innerHTML = `<div class="card pad fade-in" style="max-width:560px;margin:20px auto;text-align:center;padding:40px 24px">
        <div style="width:72px;height:72px;margin:0 auto 18px;border-radius:50%;background:var(--ok-bg);color:var(--ok);display:grid;place-items:center">${icon('check', 'lg')}</div>
        <h2>¡Solicitud enviada!</h2><p class="muted" style="margin-top:8px">Recibimos tu reserva para el <b>${dayLong(startMs())}</b> a las <b>${time(startMs())}</b>. Te avisaremos aquí en cuanto la confirmemos.</p>
        ${permission() !== 'granted' && permission() !== 'unsupported' ? `<button class="btn soft" style="margin-top:18px" data-enable-notif>${icon('bell', 'sm')} Avisarme cuando confirmen</button>` : ''}
        <div class="row wrap" style="justify-content:center;margin-top:18px"><a class="btn" href="#/mis-reservas">Ver mis reservas</a><button class="btn ghost" id="see">Ver detalle</button></div></div>`;
      bindNotif(el);
      el.querySelector('#see').onclick = () => openBooking(id);
    } catch (e) { W.sending = false; draw(); toast('No se pudo enviar', e.message, 'bad'); }
  };

  draw();
  return () => pickMap?.remove();
}

// =====================================================================
//                               ACCESO
// =====================================================================
function renderAuth(tab = 'in') {
  root.innerHTML = `<div class="auth">
    <section class="auth-art">
      <div class="brand" style="padding:0"><div class="brand-mark"></div><div><div class="brand-name">${esc(BIZ)}</div><div class="brand-sub">${esc(CFG.tagline || '')}</div></div></div>
      <div><h1>Que tu presentación <em>se vea en grande.</em></h1><p style="margin-top:14px;font-size:17px;color:#a5b4c8;max-width:480px">Alquiler de data (proyectores) en Cochabamba, Sacaba y Vinto. Reserva en línea y recibe la confirmación al instante.</p>
        <div class="feats">
          <div class="feat"><div class="ico">${icon('projector')}</div><div><b>Reserva en 4 pasos</b><span>Proyector, fecha, lugar y listo.</span></div></div>
          <div class="feat"><div class="ico">${icon('map')}</div><div><b>Mapa detallado de Cochabamba</b><span>Marca la ubicación exacta: calles, zonas y satélite.</span></div></div>
          <div class="feat"><div class="ico">${icon('bell')}</div><div><b>Confirmación y recordatorios</b><span>Avisos al confirmar, 1 día antes y 15 minutos antes.</span></div></div>
        </div></div>
      <div class="small" style="color:#5b6984">© ${new Date().getFullYear()} ${esc(BIZ)} · Cochabamba, Bolivia</div>
    </section>
    <section class="auth-form"><div class="auth-card">
      <div><h2 style="font-size:26px">${tab === 'in' ? 'Bienvenido' : 'Crea tu cuenta'}</h2><p class="muted">${tab === 'in' ? 'Ingresa para reservar o ver tus reservas.' : 'Solo te tomará un momento.'}</p></div>
      <div class="seg" style="width:100%"><button style="flex:1" class="${tab === 'in' ? 'on' : ''}" data-tab="in">Iniciar sesión</button><button style="flex:1" class="${tab === 'up' ? 'on' : ''}" data-tab="up">Registrarme</button></div>
      ${ONLINE_MODE ? `<button class="btn ghost block lg" id="g">${googleLogo} Continuar con Google</button><div class="divider">o con tu correo</div>` : ''}
      <form class="col" id="f" novalidate>
        ${tab === 'up' ? `<div class="field"><label>Nombre completo</label><input class="input" name="name" required autocomplete="name"></div>
        <div class="field"><label>Celular / WhatsApp</label><input class="input" name="phone" type="tel" required placeholder="7XXXXXXX" autocomplete="tel"></div>` : ''}
        <div class="field"><label>Correo electrónico</label><input class="input" name="email" type="email" required autocomplete="email"></div>
        <div class="field"><label>Contraseña</label><input class="input" name="password" type="password" required minlength="6" autocomplete="${tab === 'in' ? 'current-password' : 'new-password'}"></div>
        <button class="btn lg block" type="submit">${tab === 'in' ? 'Ingresar' : 'Crear cuenta'}</button>
        ${tab === 'in' && ONLINE_MODE ? '<button type="button" class="small" id="forgot" style="background:none;border:0;color:var(--brand);cursor:pointer;font-weight:600">¿Olvidaste tu contraseña?</button>' : ''}
      </form>
      ${!ONLINE_MODE ? `<div class="demo-box"><div class="row"><span class="badge st-pendiente plain">Modo demo</span><span class="small muted">Prueba la app con un clic</span></div>
        <div class="row"><button class="btn soft" style="flex:1" data-demo="client">${icon('user', 'sm')} Soy cliente</button><button class="btn dark" style="flex:1" data-demo="owner">${icon('dashboard', 'sm')} Soy el dueño</button></div>
        <p class="tiny muted">Abre la app en dos pestañas (una como dueño y otra como cliente) para ver cómo se actualiza en tiempo real.</p></div>` : ''}
    </div></section></div>`;
  root.querySelectorAll('[data-tab]').forEach((b) => b.onclick = () => renderAuth(b.dataset.tab));
  const run = async (fn, btn) => {
    const old = btn.innerHTML; btn.disabled = true; btn.textContent = 'Un momento…';
    try { await fn(); } catch (e) { toast('No se pudo ingresar', e.message, 'bad'); btn.disabled = false; btn.innerHTML = old; }
  };
  root.querySelector('#f').onsubmit = (e) => {
    e.preventDefault();
    const d = Object.fromEntries(new FormData(e.target));
    if (!d.email || !d.password) return toast('Completa correo y contraseña', '', 'bad');
    if (tab === 'up' && (!d.name?.trim() || (d.phone || '').replace(/\D/g, '').length < 7)) return toast('Escribe tu nombre y un celular válido', '', 'bad');
    run(() => (tab === 'in' ? api.signIn(d) : api.signUp(d)), e.target.querySelector('[type=submit]'));
  };
  root.querySelector('#g')?.addEventListener('click', (e) => run(() => api.signInGoogle(), e.currentTarget));
  root.querySelector('#forgot')?.addEventListener('click', async () => {
    const email = root.querySelector('[name=email]').value;
    if (!email) return toast('Escribe tu correo arriba', '', 'bad');
    try { await api.resetPassword(email); toast('Te enviamos un correo', 'Revisa tu bandeja para crear una nueva contraseña.', 'ok'); } catch (err) { toast('No se pudo enviar', err.message, 'bad'); }
  });
  root.querySelectorAll('[data-demo]').forEach((b) => b.onclick = async () => {
    const { DEMO_OWNER, DEMO_CLIENT } = await import('./backend-demo.js');
    run(() => api.signIn(b.dataset.demo === 'owner' ? DEMO_OWNER : DEMO_CLIENT), b);
  });
}

// ---------- tablas de vistas ----------
const CLIENT_VIEWS = {
  inicio: { render: vInicio }, reservar: { render: vReservar, keep: true }, 'mis-reservas': { render: vMisReservas },
  galeria: { render: vGaleria }, perfil: { render: vPerfil, keep: true },
};
const ADMIN_VIEWS = {
  panel: { render: vPanel }, agenda: { render: vAgenda }, mapa: { render: vMapa, wide: true }, reservas: { render: vReservas },
  servicios: { render: vServicios }, galeria: { render: vGaleria }, perfil: { render: vPerfil, keep: true },
};
