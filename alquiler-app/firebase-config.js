/*
 * CONFIGURACIÓN DEL NEGOCIO Y DE FIREBASE
 * ---------------------------------------
 * Este archivo lo leen la app y el service worker (notificaciones).
 *
 * 1) Cambia los datos de tu negocio en APP_SETTINGS.
 * 2) Mientras FIREBASE_CONFIG esté vacío, la app funciona en "MODO DEMO"
 *    (los datos se guardan solo en este navegador, sirve para probarla).
 * 3) Para que funcione en tiempo real por internet entre tú y tus clientes,
 *    pega aquí la configuración de tu proyecto Firebase (ver README.md).
 */
self.APP_SETTINGS = {
  businessName: 'Data Crammer',
  tagline: 'Alquiler de data (proyectores) · Quillacollo, Cochabamba y alrededores',
  // Correo(s) del dueño: quien entre con este correo verá el panel de administración.
  adminEmails: ['samistotelesrico777@gmail.com'],
  // WhatsApp del negocio, con código de país y sin "+" (ej.: 59171234567).
  whatsapp: '59176499536',
  whatsappDisplay: '76499536',
  currency: 'Bs',
  // Punto desde donde sales (para mostrar la distancia).
  base: { lat: -17.3926, lng: -66.2786, name: 'la Plaza Bolívar de Quillacollo' },
  // Recargo por distancia según la zona del cliente (Bs). Las zonas que no estén
  // aquí quedan como "recargo a consultar" y tú escribes el monto al confirmar.
  // lat/lng = centro de la zona; radiusKm = hasta dónde llega aproximadamente.
  zones: [
    { name: 'Quillacollo', fee: 0, lat: -17.3926, lng: -66.2786, radiusKm: 4.5 },
    { name: 'Vinto', fee: 5, lat: -17.3972, lng: -66.3128, radiusKm: 4 },
    { name: 'Colcapirhua', fee: 10, lat: -17.3874, lng: -66.2394, radiusKm: 3 },
    { name: 'Sipe Sipe', fee: 15, lat: -17.4497, lng: -66.3822, radiusKm: 5 },
    { name: 'Cochabamba', fee: 15, lat: -17.3895, lng: -66.1568, radiusKm: 7 },
    { name: 'Tiquipaya', fee: 20, lat: -17.3381, lng: -66.2156, radiusKm: 5 },
    { name: 'Sacaba', fee: 20, lat: -17.4033, lng: -66.0408, radiusKm: 6 },
  ],
};

self.FIREBASE_CONFIG = {
  // apiKey: '...',
  // authDomain: '...firebaseapp.com',
  // projectId: '...',
  // storageBucket: '...appspot.com',
  // messagingSenderId: '...',
  // appId: '...',
};

// Clave pública "Web Push" (Firebase › Configuración del proyecto › Cloud Messaging).
self.FIREBASE_VAPID_KEY = '';
