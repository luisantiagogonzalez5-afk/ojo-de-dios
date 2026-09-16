# Tarea 01 — Panel de capas propio (interfaz Velorian)

Repo: este mismo (`ojo-de-dios`, rama `velorian`). Node >= 24.14. Sin llaves
de API en el entorno: los tests y el build no las necesitan.

## Contexto que ya existe — LEER ANTES DE ESCRIBIR

- `velorian.html` + `src/velorian/` es la interfaz nueva. Arranque en
  `src/velorian/main.js`; shell en `src/velorian/shell.js`; hoja de estilo
  única `src/velorian/velorian.css`; panel actual en `src/velorian/panels.js`.
- Hoy las FILAS del panel de capas las pinta código de la interfaz vieja:
  `src/app/data.js:78` llama `dataManager.buildTogglePanel(#data-toggles)`,
  que internamente construye `src/ui/layerPanel.js` (LayerPanel de GEV).
  Esta tarea lo reemplaza por un renderer nuestro.
- Contrato del manager (NO cambiarlo): `src/data/manager.js:1983-1999`
  construye el panel con 8 callbacks:
  `getLayers, isEnabled, setEnabled, setLayerParams, getRowControls,
  hasRowControls, subscribeRowControls, onHiddenRefresh`.
  `getAll()` devuelve filas `{ id, name, icon, source, showInTogglePanel,
  enabled, lifecycleState, lifecycleUncertain, stats }` (`manager.js:1866-1881`).
  `enabled` es la visibilidad asentada; `lifecycleState` la fase en curso;
  `lifecycleUncertain` cuando un rechazo dejó el estado real desconocido —
  la fila debe mostrar los tres (ON / activando… / incierto), no solo ON/OFF.
- Contrato de DOM que las acciones de voz exigen (`src/voice/gevActions.js:2151-2161`):
  contenedor `#data-toggles`, filas con `data-layer-id="<id>"`, un `.data-name`
  dentro de cada fila, y una clase `.gev-voice-focus` que resalte 3 s
  (ya está estilizada en `velorian.css`).

## Qué construir

1. `src/velorian/layerPanel.js` — `export function createVelorianLayerPanel(callbacks)`
   con la MISMA superficie que `src/ui/layerPanel.js` expone hacia el manager
   (lee esa clase para ver qué métodos llama el manager sobre la instancia:
   render/refresh/destroy y el listener de row controls). Renderiza filas
   Velorian: icono, nombre (`.data-name`), fuente + "hace N min" del `stats`,
   contador, botón toggle tipo píldora, chips de `getRowControls` (si
   `hasRowControls`), leyenda con swatch. Estados visuales: apagada,
   encendida (azul), activando (pulso), incierta (ámbar). Suscribirse al
   manager para repintar en cambios.
2. Enganche: en `src/velorian/main.js` (o `panels.js`), ANTES de que corra
   `createApplicationData`, reemplazar la fábrica del panel. Forma correcta
   sin tocar `src/data/manager.js`: en `startVelorianChrome` (o antes, en
   `createData`), construir nuestro panel con los 8 callbacks tomando
   `dataManager` y asignar `dataManager._layerPanel`/el método
   `_getLayerPanel` según cómo esté escrito `manager.js:1983-1999` — leer
   ese bloque y usar el punto de sustitución más limpio que exista (si el
   manager permite inyectar el panel por opción o método, usar eso; si no,
   sobreescribir `_getLayerPanel` en la instancia con un comentario que
   explique por qué).
3. CSS: las reglas `#data-toggles .data-*` de `velorian.css` se reemplazan
   por reglas para las clases nuevas (prefijo `v-lp-`). Mismo lenguaje:
   vidrio, azul `#1a7bff`, Inter/JetBrains Mono, transiciones
   `cubic-bezier(0.22,1,0.36,1)`.

## Prohibido
- Tocar `src/data/*`, `src/layers/*`, `src/voice/*`, `src/app/*` salvo la
  línea de enganche descrita arriba (y solo si no hay opción de inyección).
- Cargar cualquier archivo de `src/ui/` desde `velorian.html` (el renderer
  viejo deja de usarse en esta página; en `index.html` sigue igual).
- Dependencias nuevas en `package.json`.

## Verificación (correr y reportar)
1. `node --check src/velorian/layerPanel.js` y de cada archivo tocado.
2. `npm test` — no bajar de 3395 pases (los 4 fallos de macOS son ajenos;
   en Linux pueden pasar, mejor).
3. `npm run build` limpio.
4. Prueba de contrato sin navegador: script Node que importe el módulo con
   un `document` mínimo (jsdom NO está instalado — usar el patrón de los
   tests existentes, p. ej. `src/qaVesselCardsHarness.test.mjs`, para
   fabricar DOM), pase callbacks falsos con 3 capas (una ON, una activando,
   una incierta) y afirme: 3 filas `[data-layer-id]`, cada una con
   `.data-name`, y que el toggle llama `setEnabled(id, !enabled, {origin:'panel'})`.
   Guardarlo como `src/velorian/layerPanel.test.mjs`.

Entregar: lista de archivos, salida de los 4 pasos.
