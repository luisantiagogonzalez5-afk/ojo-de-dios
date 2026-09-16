/**
 * Paneles de la interfaz Velorian — fase 0: el panel de capas (15 sep 2026).
 *
 * El motor ya pinta las filas dentro de #data-toggles (src/app/data.js:78 →
 * DataLayerManager.buildTogglePanel) con el contrato que las acciones de voz
 * esperan (filas [data-layer-id], .data-name, resalte .gev-voice-focus). Aquí
 * solo se controla la tarjeta que las contiene, el botón del dock y la
 * píldora de estado. Las filas se rediseñan en la fase 1.
 */
export function mountLayersPanel({ shell, dataManager, signal }) {
  const panel = document.getElementById('data-panel');
  const button = document.getElementById('v-btn-layers');
  const count = document.getElementById('v-layer-count');
  if (!panel || !button) return;

  const toggle = () => shell.setPanelCollapsed('data-panel', !panel.classList.contains('collapsed'), { explicit: true });
  button.addEventListener('click', toggle, { signal });

  const paint = () => {
    const layers = dataManager.getAll?.() || [];
    const on = layers.filter((l) => l.enabled).length;
    if (count) count.textContent = `${on}/${layers.length}`;
    button.classList.toggle('is-active', on > 0);
  };
  paint();
  const unsubscribe = dataManager.subscribe?.(paint);
  signal.addEventListener('abort', () => unsubscribe?.(), { once: true });

  // Vista global: la misma acción que Jarvis usa por voz.
  document.getElementById('v-btn-globe')?.addEventListener('click', () => {
    window.__gevVoiceCommands?.runner?.('zoom_to_globe', {}, {});
  }, { signal });

  // Estado del puente con Jarvis (evento emitido por src/voice/jarvisBridge.js).
  const dot = document.getElementById('v-jarvis-dot');
  const label = document.getElementById('v-jarvis-label');
  window.addEventListener('jarvis-bridge', (event) => {
    const on = Boolean(event.detail?.connected);
    dot?.classList.toggle('is-on', on);
    if (label) label.textContent = on ? 'JARVIS' : 'JARVIS · SIN ENLACE';
  }, { signal });
}
