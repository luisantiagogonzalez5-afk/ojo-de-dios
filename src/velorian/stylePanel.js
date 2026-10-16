/**
 * Tarjeta de estilo — contrato: #control-panel (set_panel_open('control-panel')).
 * Píldoras y sliders escriben en el shell; shell.subscribe los resincroniza
 * cuando el cambio llega por voz.
 */
import { STYLE_IDS, STYLE_LABELS } from './visual.js';

export function mountStylePanel({ shell, signal }) {
  const panel = document.getElementById('control-panel');
  const button = document.getElementById('v-btn-style');
  const pills = document.getElementById('v-vs-pills');
  if (!panel || !button || !pills) return;

  button.addEventListener('click', () => {
    shell.setPanelCollapsed('control-panel', !panel.classList.contains('collapsed'), { explicit: true });
  }, { signal });

  const buttons = STYLE_IDS.map((id) => {
    const pill = document.createElement('button');
    pill.type = 'button';
    pill.className = 'v-vs-pill';
    pill.dataset.style = id;
    pill.textContent = STYLE_LABELS[id];
    pill.addEventListener('click', () => shell.setStyle(id), { signal });
    return pill;
  });
  pills.replaceChildren(...buttons);

  // Un slider en 0 apaga el efecto; cualquier otro valor lo enciende con esa intensidad.
  const sliders = ['bloom', 'sharpen'].map((key) => {
    const input = document.getElementById(`v-vs-${key}`);
    const value = document.getElementById(`v-vs-${key}-value`);
    const write = key === 'bloom' ? (o) => shell.setBloom(o) : (o) => shell.setSharpen(o);
    input?.addEventListener('input', () => {
      const intensityPct = Number(input.value);
      write({ intensityPct, enabled: intensityPct > 0 });
    }, { signal });
    return { key, input, value };
  });

  const paint = () => {
    const state = shell.getControlState();
    for (const pill of buttons) {
      const active = pill.dataset.style === state.style;
      pill.classList.toggle('is-active', active);
      pill.setAttribute('aria-pressed', String(active));
    }
    for (const { key, input, value } of sliders) {
      const { enabled, intensityPct } = state[key];
      const shown = enabled ? intensityPct : 0;
      if (input && document.activeElement !== input) input.value = String(shown);
      if (value) value.textContent = enabled ? `${intensityPct}%` : 'OFF';
    }
    button.classList.toggle('is-active', state.style !== 'normal');
  };
  paint();
  const unsubscribe = shell.subscribe(paint);
  signal.addEventListener('abort', unsubscribe, { once: true });
}
