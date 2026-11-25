# Texto para pegar en ChatGPT

Copia todo lo que está debajo de la línea, junto con el archivo `src/eta-realista.js`, en el chat donde creaste la app.

---

Quiero que los tiempos de regreso a la balanza sean más realistas. Con mis boletas reales la app se queda corta 1½–3½ horas en las granjas cercanas. Te adjunto `eta-realista.js`: úsalo como motor de cálculo, en el cliente y en el servidor (`/api/operacion`), sin cambiar el diseño ni los datos guardados.

1. Reemplaza el cálculo del plan base (hoy `ida×1,35 + 120 + vuelta×1,6`) por `basePlan(destino, primeraLlegada)` y la estimación con historial por `estimateTrip(destino, viajes, primeraLlegada)`. Guarda en el viaje `eta`, `etaMin` y `etaMax`.
2. Al registrar la salida del destino, usa `estimateReturn(destino, viajes, salida, minutosManuales)`.
3. En el panel de operación, para cada viaje activo usa `liveEta(viaje, destino, viajes, ahora)`. Si `late` es verdadero, muestra la nueva hora con la etiqueta "Atrasado · +N min" en vez de "Hace N min", y cuéntalo en los avisos.
4. Muestra siempre la "Ventana orientativa" (`etaMin`–`etaMax`), aunque no haya historial.
5. Con `scaleTurns(viajesActivos)`, si `waitMin > 0` muestra "Turno n.º X en balanza · espera ~N min".
6. Usa los textos de `BASIS_TEXT` para explicar de dónde sale la estimación.
7. En "Ajustar los minutos de este viaje", el valor por defecto de carga en granja pasa a 210 min y la descarga en matadero a 75 min.
8. Mantén los viajes marcados como atípicos fuera del aprendizaje, como hasta ahora.
