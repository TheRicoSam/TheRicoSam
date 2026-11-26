// MODO EN LÍNEA: Firebase (Auth + Firestore en tiempo real + Storage + Push).
import { sortWorks } from './sort.js';
const V = '10.12.2';
const base = `https://www.gstatic.com/firebasejs/${V}`;

const [{ initializeApp }, A, F, S, M] = await Promise.all([
  import(`${base}/firebase-app.js`),
  import(`${base}/firebase-auth.js`),
  import(`${base}/firebase-firestore.js`),
  import(`${base}/firebase-storage.js`),
  import(`${base}/firebase-messaging.js`),
]);

const app = initializeApp(self.FIREBASE_CONFIG);
const auth = A.getAuth(app);
const db = F.initializeFirestore(app, {
  localCache: F.persistentLocalCache({ tabManager: F.persistentMultipleTabManager() }),
});
const storage = S.getStorage(app);
const admins = (self.APP_SETTINGS?.adminEmails || []).map((e) => e.toLowerCase());

export const mode = 'firebase';
let me = null;

const ERR = {
  'auth/invalid-credential': 'Correo o contraseña incorrectos.',
  'auth/wrong-password': 'Correo o contraseña incorrectos.',
  'auth/user-not-found': 'No existe una cuenta con ese correo.',
  'auth/email-already-in-use': 'Ya existe una cuenta con ese correo.',
  'auth/weak-password': 'La contraseña debe tener al menos 6 caracteres.',
  'auth/invalid-email': 'El correo no es válido.',
  'auth/popup-closed-by-user': 'Se cerró la ventana de Google.',
  'auth/network-request-failed': 'Sin conexión a internet.',
  'auth/operation-not-allowed': 'Falta activar el acceso anónimo en Firebase (Authentication › Anónimo).',
  'auth/admin-restricted-operation': 'Falta activar el acceso anónimo en Firebase (Authentication › Anónimo).',
  'permission-denied': 'No tienes permiso para hacer esto.',
};
const nice = (e) => new Error(ERR[e?.code] || e?.message || 'Ocurrió un error');
const wrap = (fn) => async (...a) => { try { return await fn(...a); } catch (e) { throw nice(e); } };

export function onAuth(cb) {
  return A.onAuthStateChanged(auth, async (u) => {
    if (!u) { me = null; return cb(null); }
    let profile = {};
    try {
      const snap = await F.getDoc(F.doc(db, 'users', u.uid));
      profile = snap.exists() ? snap.data() : {};
      if (!snap.exists()) {
        profile = { name: pendingName || u.displayName || '', phone: '', createdAt: Date.now() };
        await F.setDoc(F.doc(db, 'users', u.uid), profile, { merge: true });
      }
      if (u.email && profile.emailLower !== u.email.toLowerCase()) {
        await F.setDoc(F.doc(db, 'users', u.uid), { email: u.email, emailLower: (u.email || '').toLowerCase() }, { merge: true });
      }
    } catch { /* sin conexión: se usa el caché */ }
    me = {
      uid: u.uid,
      email: u.email,
      name: profile.name || pendingName || u.displayName || (u.email || '').split('@')[0] || 'Cliente',
      phone: profile.phone || '',
      role: admins.includes((u.email || '').toLowerCase()) ? 'admin' : 'client',
    };
    cb(me);
  });
}

// Clientes: entran solo con su nombre (cuenta anónima guardada en su celular).
let pendingName = '';
export const signInName = wrap(async ({ name }) => {
  pendingName = name.trim();
  const cred = await A.signInAnonymously(auth);
  await A.updateProfile(cred.user, { displayName: pendingName });
  await F.setDoc(F.doc(db, 'users', cred.user.uid), { name: pendingName }, { merge: true });
  if (me && me.uid === cred.user.uid) me.name = pendingName;
});
export const signIn = wrap(({ email, password }) => A.signInWithEmailAndPassword(auth, email.trim(), password));
export const signUp = wrap(async ({ name, phone, email, password }) => {
  const cred = await A.createUserWithEmailAndPassword(auth, email.trim(), password);
  await A.updateProfile(cred.user, { displayName: name });
  await F.setDoc(F.doc(db, 'users', cred.user.uid), { name, phone, email: email.trim(), createdAt: Date.now() }, { merge: true });
});
export const signInGoogle = wrap(() => A.signInWithPopup(auth, new A.GoogleAuthProvider()));
export const resetPassword = wrap((email) => A.sendPasswordResetEmail(auth, email.trim()));
export const signOut = () => A.signOut(auth);
export const updateProfile = wrap(async (patch) => {
  await F.setDoc(F.doc(db, 'users', auth.currentUser.uid), patch, { merge: true });
  Object.assign(me, patch);
});

const list = (snap) => snap.docs.map((d) => ({ id: d.id, ...d.data() }));

export function watchServices(cb) {
  return F.onSnapshot(F.collection(db, 'services'), (s) =>
    cb(list(s).sort((a, b) => (a.order ?? 0) - (b.order ?? 0) || a.name.localeCompare(b.name))), console.error);
}
export const saveService = wrap(async ({ id, ...s }) => {
  if (id) await F.setDoc(F.doc(db, 'services', id), s, { merge: true });
  else await F.addDoc(F.collection(db, 'services'), { ...s, createdAt: Date.now(), order: Date.now() });
});
export const deleteService = wrap((id) => F.deleteDoc(F.doc(db, 'services', id)));

export function watchWorks(cb) {
  return F.onSnapshot(F.collection(db, 'works'), (s) => cb(sortWorks(list(s))), console.error);
}
export const saveWork = wrap(async ({ id, ...w }) => {
  if (id) await F.setDoc(F.doc(db, 'works', id), w, { merge: true });
  else await F.addDoc(F.collection(db, 'works'), { ...w, createdAt: Date.now() });
});
export const deleteWork = wrap((id) => F.deleteDoc(F.doc(db, 'works', id)));

export function watchBookings(user, cb) {
  if (!user) { cb([]); return () => {}; }
  const col = F.collection(db, 'bookings');
  const q = user.role === 'admin' ? col : F.query(col, F.where('uid', '==', user.uid));
  return F.onSnapshot(q, (s) => cb(list(s).sort((a, b) => a.start - b.start)), (e) => console.error(e));
}
export const createBooking = wrap(async (b) => {
  const ref = await F.addDoc(F.collection(db, 'bookings'), {
    ...b, uid: auth.currentUser.uid, status: 'pendiente', createdAt: Date.now(), updatedAt: Date.now(),
  });
  return ref.id;
});
export const updateBooking = wrap((id, patch) => F.updateDoc(F.doc(db, 'bookings', id), { ...patch, updatedAt: Date.now() }));
export const deleteBooking = wrap((id) => F.deleteDoc(F.doc(db, 'bookings', id)));

export const uploadImage = wrap(async (blob) => {
  const r = S.ref(storage, `images/${Date.now()}-${Math.random().toString(36).slice(2)}.jpg`);
  await S.uploadBytes(r, blob, { contentType: 'image/jpeg' });
  return S.getDownloadURL(r);
});

// Notificaciones push (llegan aunque la app esté cerrada). Requiere la clave VAPID
// y las Cloud Functions de la carpeta /functions.
export async function enablePush(registration, onForeground) {
  if (!self.FIREBASE_VAPID_KEY || !(await M.isSupported())) return false;
  const messaging = M.getMessaging(app);
  const token = await M.getToken(messaging, { vapidKey: self.FIREBASE_VAPID_KEY, serviceWorkerRegistration: registration });
  if (!token || !auth.currentUser) return false;
  await F.setDoc(F.doc(db, 'users', auth.currentUser.uid), { fcmTokens: F.arrayUnion(token) }, { merge: true });
  M.onMessage(messaging, (p) => onForeground?.(p.data || {}));
  return true;
}
