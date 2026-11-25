# LA PRECISA · Tiempos de llegada más realistas

## Qué estaba mal

La app calculaba el regreso así: `ida × 1,35 + 120 min de carga + vuelta × 1,6`.
Con las boletas reales (081122–081140) se ve que **se queda corta por 1½ a 3½ horas** en las granjas cercanas:

| Boleta | Zona | Real | App hoy | Error | Nuevo | Error |
|---|---|---|---|---|---|---|
| 081140 | Pocona | 8 h 25 | 8 h 30 | +5 min | 9 h 28 | +63 min |
| 081133 | Tutimayu | 6 h 44 | 3 h 55 | −169 min | 5 h 30 | −74 min |
| 081128 | Santiváñez | 5 h 39 | 3 h 45 | −114 min | 5 h 26 | −13 min |
| 081127 | Tarata | 5 h 52 | 4 h 25 | −87 min | 6 h 03 | +11 min |
| 081126 | Sacaba | 7 h 06 | 3 h 25 | −221 min | 5 h 15 | −111 min |
| 081122 | San Benito | 6 h 45 | 4 h 40 | −125 min | 6 h 14 | −30 min |

**Error medio: 120 min → 51 min**, antes de que la app aprenda de los viajes nuevos.
(Las boletas 081143–081149 no se usan: se cerraron todas juntas el mismo minuto, no es su regreso físico.)

El problema principal no era la carretera, sino el **tiempo fijo en la granja** (espera de la cuadrilla, carga de jaulas, papeles): en la realidad son unas 3½ horas, no 2.

## Qué cambia

1. **Tráfico según la hora.** La parte urbana de la ruta (primeros ~18 km, por la Blanco Galindo) es más lenta en hora pico (7–9, 12–14, 17–20) y más rápida de noche. Sábado y domingo tienen su propia tabla.
2. **Cada tramo a su hora.** La vuelta se calcula con el tráfico de la hora en que el camión realmente vuelve, no con el de la hora de salida.
3. **Vacío vs. cargado.** Un camión con pollos va más lento que vacío.
4. **Tiempos fijos reales.** Carga en granja 210 min, descarga en matadero 75 min, acceso a granja 10 min y 10 min de espera para pesar al volver.
5. **Aprende mejor del historial.**
   - Aprende la *diferencia* entre lo real y el modelo, así lo aprendido sirve a cualquier hora.
   - Los viajes recientes pesan más (un viaje de hace 30 días vale la mitad).
   - Los viajes a una hora parecida pesan más (sin el corte brusco de ±2 h).
   - Los atípicos se descartan solos, además de los que marcas a mano.
   - Con pocos viajes se mezcla con el modelo; con más viajes manda el historial.
6. **Siempre hay ventana de llegada** (antes solo con 3+ viajes). Es más ancha hacia el atraso, porque los camiones se atrasan más de lo que se adelantan.
7. **Camión atrasado = nueva estimación.** Si pasó la hora y no llegó, la app ya no muestra "Hace 40 min": calcula una nueva hora probable y lo marca como **Atrasado**.
8. **Turnos en la balanza.** Si llegan dos camiones juntos, el segundo espera; se muestra su turno.

## Archivos

- `src/eta-realista.js`: el motor de cálculo (sin dependencias). Los valores ajustables están en `CONFIG`.
- `scripts/backtest.js`: compara la app actual con el nuevo cálculo usando tus boletas (`npm run backtest`).
- `test/eta.test.js`: pruebas (`npm test`).
- `docs/PROMPT-CHATGPT.md`: texto para pegar en ChatGPT y que aplique los cambios a tu app.

## Cómo seguir afinándolo

- Registra siempre la **salida del destino**: separa la espera en la granja del viaje y mejora mucho la hora de vuelta.
- Confirma el **regreso físico** de cada boleta ("Verificar" en Historial).
- Con 2–3 viajes reales por destino el historial empieza a corregir; con 5 o más, manda.
- Si una zona sigue fallando, cambia solo su tiempo en `CONFIG.service` o ponle tiempos del operador.
