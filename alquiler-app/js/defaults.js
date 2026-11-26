// Catálogo y galería iniciales de Data Crammer.
// Al entrar el dueño por primera vez (modo en línea) se guardan en Firebase,
// y desde ahí se pueden editar en la app (Servicios / Trabajos).

export const DEFAULT_SERVICES = [
  {
    id: 'data-proyector',
    name: 'Alquiler de data (proyector Epson)',
    description: 'Proyector Epson 3LCD con imagen nítida y brillante para presentaciones, clases, defensas de tesis, cultos, talleres y eventos. 34 Bs por hora; lo llevamos e instalamos en Cochabamba, Sacaba y Vinto (según la distancia se suma un recargo).',
    price: 34, unit: 'por hora', perHour: true, active: true, order: 0,
    photos: ['img/flyer-34bs.jpg', 'img/festival-danza.jpg', 'img/iglesia-ninos.jpg', 'img/defensa-monografia.jpg'],
  },
  {
    id: 'promo-invitacion',
    name: 'Promoción 2 · Por invitación',
    description: 'Precio especial por invitación. Consulta los detalles y condiciones por WhatsApp antes de reservar.',
    price: 0, unit: '', active: true, order: 1,
    photos: ['img/flyer-promocion.jpg', 'img/iglesia-ninos.jpg'],
  },
  {
    id: 'laptop',
    name: 'Laptop',
    description: 'Laptop lista para tu presentación (PowerPoint, PDF, videos). Se alquila junto con el data.',
    price: 0, unit: '', active: true, order: 2, icon: 'laptop', tone: 'g2',
    photos: [],
  },
  {
    id: 'cable-hdmi',
    name: 'Cable HDMI largo',
    description: 'Cable HDMI largo para conectar tu laptop al data aunque esté lejos del escenario o del púlpito.',
    price: 0, unit: '', active: true, order: 3, icon: 'cable', tone: 'g6',
    photos: [],
  },
];

export const DEFAULT_WORKS = [
  { id: 'w-festival', title: 'Festival de danza hebrea', description: 'Proyección en escenario para un festival en iglesia.', photos: ['img/festival-danza.jpg'], order: 0 },
  { id: 'w-iglesia', title: 'Clase en iglesia', description: 'Presentación para niños y jóvenes.', photos: ['img/iglesia-ninos.jpg'], order: 1 },
  { id: 'w-monografia', title: 'Defensa de monografía', description: 'Proyector instalado para la defensa de un estudiante.', photos: ['img/defensa-monografia.jpg'], order: 2 },
  { id: 'w-universidad', title: 'Exposición universitaria', description: 'Caso práctico de finanzas e inventarios.', photos: ['img/exposicion-finanzas.jpg', 'img/caso-practico.jpg'], order: 3 },
  { id: 'w-salon', title: 'Evento en salón amplio', description: 'Proyección para un auditorio lleno.', photos: ['img/salon-eventos.jpg'], order: 4 },
  { id: 'w-toldo', title: 'Presentación al aire libre', description: 'Proyección bajo toldo para una reunión comunitaria.', photos: ['img/toldo-aire-libre.jpg'], order: 5 },
  { id: 'w-inclusion', title: 'Taller de inclusión', description: 'Taller en sala con proyección sobre pantalla.', photos: ['img/taller-inclusion.jpg'], order: 6 },
  { id: 'w-policia', title: 'Capacitación: policía comunitaria', description: 'Presentación institucional con proyector y laptop.', photos: ['img/policia-comunitaria.jpg'], order: 7 },
  { id: 'w-aula', title: 'Instrucción en aula', description: 'Clase práctica con apoyo visual.', photos: ['img/instruccion-aula.jpg'], order: 8 },
];
