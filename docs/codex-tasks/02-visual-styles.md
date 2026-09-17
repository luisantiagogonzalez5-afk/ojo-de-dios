# Tarea 02 — Estilos visuales reales en la interfaz Velorian

Repo `ojo-de-dios`, rama `velorian`. Misma disciplina que la tarea 01
(`docs/codex-tasks/01-layer-panel.md`): leer antes de escribir, no tocar
el motor, verificar y reportar.

## Contexto

- `src/velorian/shell.js` (`VelorianShell`) hoy tiene `setStyle`, `setBloom`,
  `setSharpen` como stubs que regresan `{ok:false}`; `activeStyle` es
  siempre `'normal'`. `set_visual_style` en `src/voice/gevActions.js` llama
  `styleManager.setStyle(style)` y narra ok:true sin mirar el retorno —
  falso positivo que esta tarea elimina haciéndolo real.
- El motor de post-proceso YA existe y es DOM-free: `src/ui/visualEffects.js`
  (`class VisualEffects`, constructor `{viewer, requestRender, holdRender,
  releaseRender}`, métodos `initStyles()`, `initPostProcess()`,
  `setStageIntensity(stage, value)`, `applyBloomIntensity`, `setBloomEnabled`,
  `applySharpenIntensity`, `setSharpenEnabled`, `startTransition(styleName,
  from, to)`, `stop()`, `destroy()`). Shaders en `src/ui/visualPresets.js`
  (`STYLES`: retro, surveillance, thermal, anime, noir, snow;
  `STYLE_PRESET_DEFAULTS`, `GLOBAL_POST_DEFAULTS`, `TRANSITION_DURATION_MS`).
  Estos dos archivos son lógica pura y SE PUEDEN importar desde
  `src/velorian/` (no cargan DOM ni templates de GEV).
- Referencia de cómo lo hacía el shell viejo (solo para leer, no copiar el
  archivo): `src/ui/applicationShell.js:219` (construcción de
  `VisualEffects`) y `:4369` (`setStyle`: transición de salida del estilo
  previo con `_startTransition(prev, intensidad, 0)` y entrada del nuevo
  con `(next, 0, 1)`, `document.documentElement.dataset.gevStyle = style`).
- Etiquetas que ve el Señor (en `src/hud.js:735` del viejo): `surveillance`
  → "NVG", `thermal` → "FLIR", `retro` → "CRT". Los ids internos no cambian.
- `requestRender/holdRender/releaseRender` vienen de `src/renderGovernor.js`
  (`governorRequestRender`, `holdContinuousRender`, `releaseContinuousRender`)
  — ya las usa `src/app/tools.js`.

## Qué construir

1. `src/velorian/visual.js` — `export function createVelorianVisual({ viewer })`
   que instancia `VisualEffects` con los callbacks del render governor,
   llama `initStyles()` + `initPostProcess()` en el orden del shell viejo,
   y expone: `setStyle(name)` (transición salida/entrada igual que
   `applicationShell.js:4369`, `dataset.gevStyle`), `getStyle()`,
   `setBloom({enabled, intensityPct})`, `setSharpen({enabled, intensityPct})`,
   `getState()` → `{style, bloom:{enabled,intensityPct}, sharpen:{...}}`,
   `destroy()`. Aplicar `STYLE_PRESET_DEFAULTS[style]` al cambiar de estilo.
2. `src/velorian/shell.js` — `VelorianShell` crea/recibe el objeto visual
   (elegir lo más simple y documentarlo) y reemplaza los stubs: `setStyle`,
   `setBloom`, `setSharpen` reales; `activeStyle` real; `getControlState()`
   reporta valores reales; `dispose()` llama `visual.destroy()`.
3. Dock: en `velorian.html` un botón "Estilo" (icono de lente) junto a los
   dos existentes; abre una tarjeta `#control-panel` (id de contrato:
   `set_panel_open('control-panel')` debe abrirla vía
   `shell.setPanelCollapsed`) con 7 píldoras: Normal, CRT, NVG, FLIR, Anime,
   Noir, Snow (ids `normal, retro, surveillance, thermal, anime, noir, snow`)
   + dos sliders (bloom, sharpen). Clases con prefijo `v-vs-`. La píldora
   activa en azul; sincronizar con `shell.subscribe` cuando cambie por voz.
4. `velorian.css`: reglas de la tarjeta y píldoras. Nada de `src/ui/styles`.

## Prohibido
- Tocar `src/ui/visualEffects.js`, `src/ui/visualPresets.js`, `src/app/*`,
  `src/voice/*`, `src/data/*`.
- Cargar templates o CSS de `src/ui/` en `velorian.html`.
- Dependencias nuevas.

## Verificación (correr y reportar)
1. `node --check` de cada JS tocado.
2. `npm test` sin bajar de 3399 pases.
3. `npm run build` limpio.
4. Test Node `src/velorian/visual.test.mjs` con un `viewer` falso
   (`scene.postProcessStages` con `add/remove`; leer
   `src/ui/visualEffects.test.mjs` si existe para el patrón): afirmar que
   `setStyle('thermal')` deja `getStyle()==='thermal'`, que volver a
   `'normal'` apaga la etapa previa, y que `getState()` refleja
   bloom/sharpen tras `setBloom({enabled:true,intensityPct:120})`.

Entregar: lista de archivos y salida de los 4 pasos.
