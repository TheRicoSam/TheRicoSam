// Utilidades de interfaz: íconos, formato, toasts, modales, imágenes.

const P = {
  home: '<path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><path d="M9 22V12h6v10"/>',
  dashboard: '<rect x="3" y="3" width="7" height="9" rx="1.5"/><rect x="14" y="3" width="7" height="5" rx="1.5"/><rect x="14" y="12" width="7" height="9" rx="1.5"/><rect x="3" y="16" width="7" height="5" rx="1.5"/>',
  calendar: '<rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/>',
  calPlus: '<rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18M12 14v4M10 16h4"/>',
  map: '<path d="M3 6l6-3 6 3 6-3v15l-6 3-6-3-6 3z"/><path d="M9 3v15M15 6v15"/>',
  pin: '<path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/>',
  list: '<path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01"/>',
  clock: '<circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/>',
  bell: '<path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/>',
  check: '<path d="M20 6 9 17l-5-5"/>',
  checkCircle: '<circle cx="12" cy="12" r="10"/><path d="m9 12 2 2 4-4"/>',
  x: '<path d="M18 6 6 18M6 6l12 12"/>',
  user: '<path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>',
  users: '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/>',
  image: '<rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-3.1-3.1a2 2 0 0 0-2.8 0L6 21"/>',
  images: '<path d="M18 22H4a2 2 0 0 1-2-2V6"/><rect x="6" y="2" width="16" height="16" rx="2"/><circle cx="12" cy="8" r="2"/><path d="m22 13-2.6-2.6a2 2 0 0 0-2.8 0L10 17"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  nav: '<path d="M3 11 22 2l-9 19-2-8z"/>',
  phone: '<path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.8 19.8 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.12 4.18 2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.13.96.36 1.9.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.9.34 1.85.57 2.81.7A2 2 0 0 1 22 16.92z"/>',
  chat: '<path d="M21 11.5a8.4 8.4 0 0 1-9 8.5 8.4 8.4 0 0 1-3.8-.9L3 21l1.9-5.7a8.4 8.4 0 0 1-.9-3.8A8.5 8.5 0 0 1 12.5 3h.5a8.5 8.5 0 0 1 8 8z"/>',
  logout: '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9"/>',
  right: '<path d="m9 18 6-6-6-6"/>',
  left: '<path d="m15 18-6-6 6-6"/>',
  arrow: '<path d="M5 12h14M12 5l7 7-7 7"/>',
  search: '<circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>',
  locate: '<circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="3"/><path d="M12 2v2M12 20v2M2 12h2M20 12h2"/>',
  box: '<path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><path d="M3.3 7 12 12l8.7-5M12 22V12"/>',
  trash: '<path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>',
  edit: '<path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"/>',
  download: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3"/>',
  alert: '<circle cx="12" cy="12" r="10"/><path d="M12 8v4M12 16h.01"/>',
  wifi: '<path d="M5 12.55a11 11 0 0 1 14.08 0M1.42 9a16 16 0 0 1 21.16 0M8.53 16.11a6 6 0 0 1 6.95 0M12 20h.01"/>',
  money: '<rect x="2" y="6" width="20" height="12" rx="2"/><circle cx="12" cy="12" r="2"/><path d="M6 12h.01M18 12h.01"/>',
  sparkle: '<path d="M12 3l1.9 5.8L20 10l-6.1 1.2L12 17l-1.9-5.8L4 10l6.1-1.2z"/>',
  tent: '<path d="M3.5 21 14 3M20.5 21 10 3M15.5 21 12 15l-3.5 6M2 21h20"/>',
  shield: '<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>',
  send: '<path d="m22 2-7 20-4-9-9-4z"/><path d="M22 2 11 13"/>',
  laptop: '<rect x="3" y="4" width="18" height="12" rx="2"/><path d="M2 20h20"/>',
  cable: '<path d="M4 9a2 2 0 0 1-2-2V5h6v2a2 2 0 0 1-2 2zM3 3v2M7 3v2M5 9v4a4 4 0 0 0 8 0V9a4 4 0 0 1 8 0v6"/><path d="M18 21v-2a1 1 0 0 1-1-1v-1a2 2 0 0 1 2-2h0a2 2 0 0 1 2 2v1a1 1 0 0 1-1 1v2"/>',
  projector: '<rect x="2" y="7" width="20" height="11" rx="2.5"/><circle cx="15.5" cy="12.5" r="3"/><path d="M5.5 10.5h4M5.5 13.5h4M6 18v2M18 18v2"/>',
};

export const icon = (name, cls = '') =>
  `<svg class="i ${cls}" viewBox="0 0 24 24" aria-hidden="true">${P[name] || ''}</svg>`;

export const googleLogo = `<svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true"><path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z"/><path fill="#FF3D00" d="m6.3 14.7 6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"/><path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z"/><path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z"/></svg>`;

export const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

export const $ = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

export const uid = () => (crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(36) + Math.random().toString(36).slice(2));

// ---------- fechas (hora de Bolivia, UTC-4 sin horario de verano) ----------
const TZ = 'America/La_Paz';
const fmt = (opts) => new Intl.DateTimeFormat('es-BO', { timeZone: TZ, ...opts });
const fTime = fmt({ hour: '2-digit', minute: '2-digit', hour12: false });
const fDay = fmt({ weekday: 'long', day: 'numeric', month: 'long' });
const fDayShort = fmt({ weekday: 'short', day: 'numeric', month: 'short' });
const fMon = fmt({ month: 'short' });
const fNum = fmt({ day: 'numeric' });
const fMonthYear = fmt({ month: 'long', year: 'numeric' });

export const time = (ms) => fTime.format(ms);
export const dayLong = (ms) => cap(fDay.format(ms));
export const dayShort = (ms) => fDayShort.format(ms);
export const monShort = (ms) => fMon.format(ms).replace('.', '');
export const dayNum = (ms) => fNum.format(ms);
export const monthYear = (ms) => fMonthYear.format(ms);
export const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);

// Clave de día "AAAA-MM-DD" en hora de Bolivia.
export const dayKey = (ms) => {
  const d = new Date(ms - 4 * 3600e3);
  return d.toISOString().slice(0, 10);
};
// Convierte fecha "AAAA-MM-DD" + hora "HH:MM" (hora de Bolivia) a milisegundos.
export const toMs = (date, hhmm) => Date.parse(`${date}T${hhmm}:00-04:00`);
export const hhmmOf = (ms) => new Date(ms - 4 * 3600e3).toISOString().slice(11, 16);
export const isToday = (ms) => dayKey(ms) === dayKey(Date.now());
export const isTomorrow = (ms) => dayKey(ms) === dayKey(Date.now() + 864e5);

export function relDay(ms) {
  if (isToday(ms)) return 'Hoy';
  if (isTomorrow(ms)) return 'Mañana';
  if (dayKey(ms) === dayKey(Date.now() - 864e5)) return 'Ayer';
  return cap(dayShort(ms));
}

export function untilText(ms) {
  let m = Math.round((ms - Date.now()) / 60000);
  const past = m < 0; m = Math.abs(m);
  let s;
  if (m < 1) s = 'menos de un minuto';
  else if (m < 60) s = `${m} min`;
  else if (m < 1440) { const h = Math.floor(m / 60), r = m % 60; s = `${h} h${r ? ` ${r} min` : ''}`; }
  else { const d = Math.floor(m / 1440), h = Math.floor((m % 1440) / 60); s = `${d} día${d > 1 ? 's' : ''}${h ? ` ${h} h` : ''}`; }
  return past ? `hace ${s}` : `en ${s}`;
}

export const money = (n, cur = 'Bs') => `${cur} ${Number(n || 0).toLocaleString('es-BO', { maximumFractionDigits: 2 })}`;

export const STATUS = {
  pendiente: { label: 'Pendiente', color: '#d97706' },
  confirmado: { label: 'Confirmado', color: '#059669' },
  rechazado: { label: 'No disponible', color: '#dc2626' },
  cancelado: { label: 'Cancelado', color: '#64748b' },
  completado: { label: 'Completado', color: '#2563eb' },
};
export const statusBadge = (s) => `<span class="badge st-${s}">${STATUS[s]?.label || s}</span>`;

export const initials = (name = '') => name.replace(/[^\p{L}\s]/gu, '').trim().split(/\s+/).slice(0, 2).map((w) => w[0]?.toUpperCase() || '').join('') || '?';
export const avatar = (name, size = 36) =>
  `<div style="width:${size}px;height:${size}px;border-radius:${size / 3}px;background:linear-gradient(135deg,#fb923c,#ea580c);color:#fff;display:grid;place-items:center;font-weight:800;font-size:${size * 0.38}px;flex:none">${esc(initials(name))}</div>`;

// ---------- toasts ----------
export function toast(title, body = '', kind = '') {
  const box = $('#toasts');
  const el = document.createElement('div');
  el.className = `toast ${kind}`;
  el.innerHTML = `<div class="ico">${icon(kind === 'bad' ? 'alert' : kind === 'ok' ? 'check' : 'bell', 'sm')}</div><div><b>${esc(title)}</b>${body ? `<p>${esc(body)}</p>` : ''}</div>`;
  box.appendChild(el);
  setTimeout(() => { el.classList.add('out'); setTimeout(() => el.remove(), 300); }, 4800);
}

// ---------- modales ----------
export function modal({ title, body, foot = '', wide = false, onMount }) {
  const back = document.createElement('div');
  back.className = 'modal-back';
  back.innerHTML = `<div class="modal ${wide ? 'wide' : ''}" role="dialog" aria-modal="true">
    <div class="modal-head"><h2>${title}</h2><button class="x-btn" data-close aria-label="Cerrar">${icon('x', 'sm')}</button></div>
    <div class="modal-body">${body}</div>${foot ? `<div class="modal-foot">${foot}</div>` : ''}</div>`;
  const close = () => { back.remove(); document.removeEventListener('keydown', onKey); api.onClose?.(); };
  const onKey = (e) => e.key === 'Escape' && close();
  back.addEventListener('click', (e) => { if (e.target === back || e.target.closest('[data-close]')) close(); });
  document.addEventListener('keydown', onKey);
  document.body.appendChild(back);
  const api = { el: back, close, onClose: null };
  onMount?.(back.querySelector('.modal'), api);
  return api;
}

export function confirmDialog({ title, text = '', ok = 'Aceptar', danger = false, input = null }) {
  return new Promise((resolve) => {
    let done = false;
    const m = modal({
      title: esc(title),
      body: `${text ? `<p class="muted">${esc(text)}</p>` : ''}${input ? `<div class="field" style="margin-top:14px"><label>${esc(input.label)}</label><textarea class="input" id="cd-in" placeholder="${esc(input.placeholder || '')}"></textarea></div>` : ''}`,
      foot: `<button class="btn ghost" data-close>Volver</button><button class="btn ${danger ? 'danger' : ''}" id="cd-ok">${esc(ok)}</button>`,
      onMount: (el, api) => {
        el.querySelector('#cd-ok').onclick = () => { done = true; resolve(input ? (el.querySelector('#cd-in').value || '') : true); api.close(); };
      },
    });
    m.onClose = () => { if (!done) resolve(null); };
  });
}

export function lightbox(photos, start = 0, caption = '') {
  if (!photos?.length) return;
  let i = start;
  const el = document.createElement('div');
  el.className = 'lightbox';
  const draw = () => {
    el.innerHTML = `<img src="${esc(photos[i])}" alt="">
      <button class="lb-close" aria-label="Cerrar">${icon('x')}</button>
      ${photos.length > 1 ? `<button class="lb-btn lb-prev">${icon('left')}</button><button class="lb-btn lb-next">${icon('right')}</button>` : ''}
      <div class="lb-cap">${esc(caption)} ${photos.length > 1 ? `· ${i + 1} / ${photos.length}` : ''}</div>`;
  };
  const onKey = (e) => {
    if (e.key === 'Escape') close();
    if (e.key === 'ArrowRight') { i = (i + 1) % photos.length; draw(); }
    if (e.key === 'ArrowLeft') { i = (i - 1 + photos.length) % photos.length; draw(); }
  };
  const close = () => { el.remove(); document.removeEventListener('keydown', onKey); };
  el.addEventListener('click', (e) => {
    if (e.target.closest('.lb-next')) { i = (i + 1) % photos.length; draw(); }
    else if (e.target.closest('.lb-prev')) { i = (i - 1 + photos.length) % photos.length; draw(); }
    else if (e.target.closest('.lb-close') || e.target === el) close();
  });
  document.addEventListener('keydown', onKey);
  draw();
  document.body.appendChild(el);
}

// Reduce una foto antes de subirla (ahorra datos móviles y espacio).
export function resizeImage(file, maxSide = 1600, quality = 0.82) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      const scale = Math.min(1, maxSide / Math.max(img.width, img.height));
      const c = document.createElement('canvas');
      c.width = Math.round(img.width * scale);
      c.height = Math.round(img.height * scale);
      c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
      URL.revokeObjectURL(url);
      c.toBlob((b) => (b ? resolve(b) : reject(new Error('No se pudo procesar la imagen'))), 'image/jpeg', quality);
    };
    img.onerror = () => reject(new Error('Archivo de imagen no válido'));
    img.src = url;
  });
}

export const waLink = (phone, text = '') => `https://wa.me/${String(phone || '').replace(/\D/g, '')}${text ? `?text=${encodeURIComponent(text)}` : ''}`;
export const telLink = (phone) => `tel:${String(phone || '').replace(/[^\d+]/g, '')}`;
export const gmapsDir = (lat, lng) => `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}&travelmode=driving`;
export const wazeDir = (lat, lng) => `https://waze.com/ul?ll=${lat},${lng}&navigate=yes`;
