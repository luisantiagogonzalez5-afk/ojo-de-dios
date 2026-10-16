/**
 * VelorianShell — el "styleManager" de la interfaz Velorian (15 sep 2026).
 *
 * Reemplaza al StyleManager/ApplicationShell de GEV (197 KB, 136 ids de DOM)
 * vía el punto de inyección `Controls` de src/app/controls.js. El motor
 * (Cesium, capas, las 28 acciones de src/voice/gevActions.js) sigue intacto:
 * todo lo que ese motor pide al shell está aquí, con nuestro DOM o con un
 * fallback honesto. Las acciones cuya función todavía no existe en esta
 * interfaz (cabina, contexto, detección) regresan
 * `{ ok: false, reason }` — jarvisBridge lo convierte en gev_error y Jarvis
 * le dice al Señor "no pude", en vez de reventar en silencio.
 *
 * Contrato que sí cumple (usado por el motor y por gevActions.js):
 *   hasShareState, initialRestorePromise, orbitController.stop, hud.destroy,
 *   dispose, attachDataManager, activeStyle, setPanelCollapsed,
 *   getControlState, getContextModeState, getCockpitState, getDetectionState,
 *   setStyle, setBloom, setSharpen (motor real vía ./visual.js).
 *
 * El shell crea su propio objeto visual en el constructor (lo más simple:
 * controls.js ya le pasa el viewer y no hay que tocar src/app/). `visual` en
 * las opciones solo existe para inyectar un doble en pruebas.
 */
import { createVelorianVisual } from './visual.js';

// Ids de panel que el modelo puede pedir con set_panel_open (gevActions.js:29-54).
const PANEL_IDS = new Set([
  'data-panel', 'location-bar', 'control-panel', 'cctv-panel', 'radio-panel',
  'global-context-panel', 'scene-panel', 'pp-toggles',
]);

export class VelorianShell {
  constructor(viewer, { services = {}, mapStackController = null, placeSearch = null, visual = null } = {}) {
    this.viewer = viewer;
    this.services = services;
    this.mapStackController = mapStackController;
    this.placeSearch = placeSearch;
    this._dataManager = null;
    this.visual = visual || createVelorianVisual({ viewer });
    this.hasShareState = false;
    this.initialRestorePromise = Promise.resolve();
    // Sustitutos mínimos de lo que controls.js/tools.js desmontan al salir.
    this.orbitController = { stop() {} };
    this.hud = { visible: false, destroy() {}, getVariant: () => null };
    this._listeners = new Set();
  }

  get activeStyle() {
    return this.visual.getStyle();
  }

  attachDataManager(dataManager) {
    this._dataManager = dataManager;
    this._emit();
  }

  get dataManager() {
    return this._dataManager;
  }

  /** Suscripción simple para que la interfaz reaccione a cambios del shell. */
  subscribe(listener) {
    this._listeners.add(listener);
    return () => this._listeners.delete(listener);
  }

  _emit() {
    for (const listener of this._listeners) {
      try { listener(this); } catch (error) { console.error('[velorian] listener', error); }
    }
  }

  // ---- paneles (set_panel_open / show_data_layers_menu / set_context_mode) --
  setPanelCollapsed(panelId, collapsed, { explicit = false } = {}) {
    if (!PANEL_IDS.has(panelId)) return false;
    const panel = document.getElementById(panelId);
    if (!panel) return false;
    panel.classList.toggle('collapsed', Boolean(collapsed));
    panel.dataset.explicit = explicit ? '1' : '';
    this._emit();
    return true;
  }

  isPanelCollapsed(panelId) {
    return document.getElementById(panelId)?.classList.contains('collapsed') ?? true;
  }

  // ---- estado que las acciones leen para narrar --------------------------
  getControlState() {
    const { style, bloom, sharpen } = this.visual.getState();
    return {
      style,
      mapStack: this.mapStackController?.getActiveId?.() || null,
      hud: { visible: false, layout: null },
      detection: this.getDetectionState(),
      bloom,
      sharpen,
    };
  }

  // ---- estilos visuales (set_visual_style / set_post_processing) ---------
  _applyVisual(result) {
    if (result.ok) this._emit();
    return result;
  }
  setStyle(style) { return this._applyVisual(this.visual.setStyle(style)); }
  setBloom(options) { return this._applyVisual(this.visual.setBloom(options)); }
  setSharpen(options) { return this._applyVisual(this.visual.setSharpen(options)); }

  getContextModeState() {
    // La interfaz Velorian arranca en modo normal; el modo contexto (panel
    // de contactos 250 km) se construye en una fase posterior.
    return { mode: 'normal', available: false };
  }

  getCockpitState() {
    return { active: false, available: false };
  }

  getDetectionState() {
    return { enabled: false, available: false };
  }

  getAircraftTrackingTarget() {
    return null;
  }

  // ---- funciones aún no construidas en esta interfaz ----------------------
  // Regresan un resultado claro en vez de lanzar: la acción reporta ok:false
  // y Jarvis se lo dice al Señor.
  _pendiente(nombre) {
    return { ok: false, reason: `${nombre} aún no existe en la interfaz Velorian` };
  }
  setMapStack() { return this._pendiente('set_map_stack'); }
  setHudVisible() { return this._pendiente('set_hud'); }
  setHudLayout() { return this._pendiente('set_hud'); }
  setDetection() { return this._pendiente('set_detection'); }
  setContextMode() { return this._pendiente('set_context_mode'); }
  controlCockpit() { return this._pendiente('control_cockpit'); }

  dispose() {
    this._listeners.clear();
    this.visual.destroy();
  }
}
