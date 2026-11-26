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
  tagline: 'Alquiler de data (proyectores) · Cochabamba, Sacaba y Vinto',
  // Correo(s) del dueño: quien entre con este correo verá el panel de administración.
  adminEmails: ['samistotelesrico777@gmail.com'],
  // WhatsApp del negocio, con código de país y sin "+" (ej.: 59171234567).
  whatsapp: '59176499536',
  whatsappDisplay: '76499536',
  currency: 'Bs',
  // Punto desde donde sales (para calcular la distancia y el recargo). Cámbialo por tu dirección.
  base: { lat: -17.3935, lng: -66.157, name: 'la Plaza 14 de Septiembre' },
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
