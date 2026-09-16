/**
 * VelorianShell — el "styleManager" de la interfaz Velorian (15 sep 2026).
 *
 * Reemplaza al StyleManager/ApplicationShell de GEV (197 KB, 136 ids de DOM)
 * vía el punto de inyección `Controls` de src/app/controls.js. El motor
 * (Cesium, capas, las 28 acciones de src/voice/gevActions.js) sigue intacto:
 * todo lo que ese motor pide al shell está aquí, con nuestro DOM o con un
 * fallback honesto. Las acciones cuya función todavía no existe en esta
 * interfaz (estilos visuales, cabina, contexto, detección) regresan
 * `{ ok: false, reason }` — jarvisBridge lo convierte en gev_error y Jarvis
 * le dice al Señor "no pude", en vez de reventar en silencio.
 *
 * Contrato que sí cumple (usado por el motor y por gevActions.js):
 *   hasShareState, initialRestorePromise, orbitController.stop, hud.destroy,
 *   dispose, attachDataManager, activeStyle, setPanelCollapsed,
 *   getControlState, getContextModeState, getCockpitState, getDetectionState.
 */

// Ids de panel que el modelo puede pedir con set_panel_open (gevActions.js:29-54).
const PANEL_IDS = new Set([
  'data-panel', 'location-bar', 'control-panel', 'cctv-panel', 'radio-panel',
  'global-context-panel', 'scene-panel', 'pp-toggles',
]);

export class VelorianShell {
  constructor(viewer, { services = {}, mapStackController = null, placeSearch = null } = {}) {
    this.viewer = viewer;
    this.services = services;
    this.mapStackController = mapStackController;
    this.placeSearch = placeSearch;
    this._dataManager = null;
    this.activeStyle = 'normal';
    this.hasShareState = false;
    this.initialRestorePromise = Promise.resolve();
    // Sustitutos mínimos de lo que controls.js/tools.js desmontan al salir.
    this.orbitController = { stop() {} };
    this.hud = { visible: false, destroy() {}, getVariant: () => null };
    this._listeners = new Set();
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
    return {
      style: this.activeStyle,
      mapStack: this.mapStackController?.getActiveId?.() || null,
      hud: { visible: false, layout: null },
      detection: this.getDetectionState(),
      bloom: { enabled: false, intensityPct: 0 },
      sharpen: { enabled: false, intensityPct: 0 },
    };
  }

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
  setStyle() { return this._pendiente('set_visual_style'); }
  setBloom() { return this._pendiente('set_post_processing'); }
  setSharpen() { return this._pendiente('set_post_processing'); }
  setMapStack() { return this._pendiente('set_map_stack'); }
  setHudVisible() { return this._pendiente('set_hud'); }
  setHudLayout() { return this._pendiente('set_hud'); }
  setDetection() { return this._pendiente('set_detection'); }
  setContextMode() { return this._pendiente('set_context_mode'); }
  controlCockpit() { return this._pendiente('control_cockpit'); }

  dispose() {
    this._listeners.clear();
  }
}
