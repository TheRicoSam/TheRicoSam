# Data Crammer · App de alquiler de data (proyectores)

Una sola app web para el dueño y sus clientes. Se puede instalar en el celular como app (PWA) y funciona en tiempo real por internet.

## Qué hace

**Clientes**
- Ven el catálogo de servicios con precios y fotos, y la galería de trabajos realizados.
- Reservan en 4 pasos: servicios y cantidades → fecha y hora → **ubicación en el mapa de Cochabamba** (buscador de calles y zonas, GPS, vista satelital) → datos de contacto.
- Ven el estado de cada reserva en tiempo real (pendiente, confirmada, no disponible) y reciben un aviso cuando el dueño responde.
- Reciben recordatorios **1 día antes** y **15 minutos antes**. También pueden "Agregar a mi calendario" (archivo .ics que ya trae las dos alarmas).

**Dueño (panel de administración)**
- **Panel**: próximo trabajo con cuenta regresiva, mapa y botón *Cómo llegar*; solicitudes por confirmar; números del día, de la semana y del mes.
- **Confirmar o rechazar** cada solicitud con un mensaje para el cliente. La app avisa si dos reservas confirmadas se cruzan de horario.
- **Agenda** mensual con los alquileres de cada día.
- **Mapa de trabajos**: todos los lugares numerados por orden, con navegación por Google Maps o Waze.
- **Servicios**: crear y editar servicios con precio y fotos.
- **Trabajos realizados**: subir fotos de eventos pasados para que los clientes las vean.
- Avisos de cada nueva solicitud, más los recordatorios de 1 día y 15 minutos.

## Precios

- **Data (proyector): 34 Bs por hora.** **Laptop: 20 Bs por hora.** Se cobra la hora empezada (de 14:00 a 16:30 son 3 h).
- **Recargo por distancia según la zona** (sales desde la Plaza Bolívar de Quillacollo):

  | Zona | Recargo |
  |---|---|
  | Quillacollo | sin recargo |
  | Vinto | 5 Bs |
  | Colcapirhua | 10 Bs |
  | Sipe Sipe | 15 Bs |
  | Cochabamba | 15 Bs |
  | Tiquipaya | 20 Bs |
  | Sacaba | 20 Bs |
  | Otras zonas (Tarata, Capinota, Punata…) | a consultar |

  La app detecta la zona con el punto marcado en el mapa y suma el recargo al total. Al confirmar, puedes cambiar el monto. Las tarifas se editan en `firebase-config.js` › `zones`.
- Para que un servicio diga "Consultar precio", pon su precio en 0 desde **Servicios › Editar**.

## Probarla ya (modo demo)

Sin configurar nada, la app arranca en **modo demo**: los datos quedan solo en ese navegador.

```bash
cd alquiler-app
python3 -m http.server 8080
# abre http://localhost:8080
```

Usa los botones "Soy el dueño" / "Soy cliente". Para ver el tiempo real, abre dos pestañas: en una entra como dueño, y en la otra cierra la sesión y entra como cliente.

## Ponerla en línea (tiempo real entre todos los celulares)

1. Entra a <https://console.firebase.google.com>, crea un proyecto y agrega una **app web** (`</>`). Copia la configuración en `firebase-config.js` › `FIREBASE_CONFIG`.
2. **Authentication** › Método de acceso: activa **Anónimo** (para que tus clientes entren solo con su nombre) y **Google** (para ti, el dueño).
3. **Firestore Database** › Crear base de datos (región `southamerica-east1`, São Paulo).
4. **Storage** › Comenzar (para las fotos).
5. Tu correo de dueño, el nombre Data Crammer y el WhatsApp 76499536 ya están configurados (`firebase-config.js`, `firestore.rules`, `storage.rules`, `functions/index.js`). Si cambias de correo, cámbialo en esos 4 archivos.
6. Publica (necesitas Node.js):
   ```bash
   npm install -g firebase-tools
   firebase login
   cd alquiler-app
   firebase use --add            # elige tu proyecto
   firebase deploy --only hosting,firestore,storage
   ```
   Te dará una dirección como `https://tu-proyecto.web.app`. Esa es la app que compartes con tus clientes.
7. Entra con **Google** usando tu correo: verás el panel del dueño. Para el panel, el correo tiene que estar verificado, y con Google ya lo está. La primera vez que entres se guardan solos tus servicios (data a 34 Bs y la Promoción 2) y las fotos de trabajos; luego los editas desde la app.

### Notificaciones con la app cerrada (opcional, recomendado)

Sin este paso, los avisos llegan mientras la app está abierta o en segundo plano, y los recordatorios del calendario (.ics) funcionan siempre. Para que lleguen **también con la app cerrada**:

1. Firebase › Configuración del proyecto › **Cloud Messaging** › Certificados web push › *Generar par de claves*. Copia la clave en `FIREBASE_VAPID_KEY`.
2. Activa el plan **Blaze**. Es de pago por uso, pero este volumen entra en la capa gratuita.
3. `cd functions && npm install && cd .. && firebase deploy --only functions,hosting`

Las funciones envían el aviso de nueva solicitud al dueño, el de confirmación o rechazo al cliente, y los recordatorios de 1 día y 15 minutos antes a los dos.

> En iPhone, las notificaciones web solo funcionan si la app se agregó a la pantalla de inicio (Safari › Compartir › *Agregar a inicio*).

## Archivos

| Archivo | Para qué |
|---|---|
| `firebase-config.js` | Datos del negocio y claves de Firebase |
| `js/app.js` | Pantallas del dueño y del cliente |
| `js/map.js` | Mapas de Cochabamba (OpenStreetMap/CARTO/Esri satélite) y buscador de direcciones |
| `js/notify.js` | Avisos, recordatorios 1 día / 15 min y calendario .ics |
| `js/backend-firebase.js` / `js/backend-demo.js` | Datos en línea (Firebase) o de demostración |
| `sw.js` | App instalable y notificaciones push |
| `functions/index.js` | Envío automático de notificaciones push |
| `firestore.rules`, `storage.rules` | Seguridad: cada cliente ve solo sus reservas |
