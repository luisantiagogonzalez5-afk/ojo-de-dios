/**
 * Estilos visuales de la interfaz Velorian (Codex 02, 16 oct 2026).
 *
 * Envuelve el motor de post-proceso de GEV (src/ui/visualEffects.js, sin DOM)
 * con la misma secuencia que usaba el shell viejo
 * (src/ui/applicationShell.js:219 y :4369): initStyles() → initPostProcess(),
 * transición de salida del estilo previo y de entrada del nuevo, y los
 * STYLE_PRESET_DEFAULTS del estilo elegido. Normal no tiene preset: volver a
 * Normal conserva bloom/sharpen tal como estén.
 *
 * Arranque conservador: NO se aplica GLOBAL_POST_DEFAULTS (sharpen 49% ON en
 * GEV). Normal se ve exactamente igual que antes de esta tarea; bloom y
 * sharpen arrancan apagados hasta que el Señor, Jarvis o un preset los pidan.
 */
import { VisualEffects } from '../ui/visualEffects.js';
import { STYLES, STYLE_PRESET_DEFAULTS } from '../ui/visualPresets.js';
import { clampBloomIntensity } from '../bloom.js';
import {
  governorRequestRender,
  holdContinuousRender,
  releaseContinuousRender,
} from '../renderGovernor.js';

/** Ids internos en el orden de la tarjeta; no cambian aunque cambie la etiqueta. */
export const STYLE_IDS = ['normal', ...Object.keys(STYLES)];

/** Lo que ve el Señor (mismas etiquetas que src/hud.js:735 del viejo). */
export const STYLE_LABELS = {
  normal: 'Normal',
  retro: 'CRT',
  surveillance: 'NVG',
  thermal: 'FLIR',
  anime: 'Anime',
  noir: 'Noir',
  snow: 'Snow',
};

const pct = (value, max) => Math.round(Math.max(0, Math.min(max, value)));

/**
 * @param {object} options
 * @param {object} options.viewer - Viewer de Cesium (solo usa scene.postProcessStages).
 * @param {object} [options.effects] - Opciones extra para VisualEffects (relojes/fábricas en tests).
 */
export function createVelorianVisual({ viewer, effects: effectOptions = {} }) {
  const effects = new VisualEffects({
    viewer,
    requestRender: governorRequestRender,
    holdRender: holdContinuousRender,
    releaseRender: releaseContinuousRender,
    ...effectOptions,
  });
  effects.initStyles();
  effects.initPostProcess();
  let style = 'normal';
  if (typeof document !== 'undefined') document.documentElement.dataset.gevStyle = style;

  const bloomState = () => ({ enabled: effects.bloomEnabled, intensityPct: effects.bloomIntensity });
  const sharpenState = () => ({
    enabled: effects.sharpenEnabled,
    intensityPct: Math.round(effects.sharpenIntensity * 100),
  });

  /** Valida igual que ApplicationShell.setBloom/setSharpen; null si es válido. */
  const invalid = (label, { enabled, intensityPct }) => {
    if (enabled !== undefined && typeof enabled !== 'boolean') return `Invalid ${label} enabled value: ${enabled}`;
    if (intensityPct !== undefined && (typeof intensityPct !== 'number' || !Number.isFinite(intensityPct)))
      return `Invalid ${label} intensity: ${intensityPct}`;
    return null;
  };

  function applyPreset(name) {
    const preset = STYLE_PRESET_DEFAULTS[name];
    if (!preset) return;
    for (const [target, params] of Object.entries(preset.styleParams || {})) {
      const stage = effects.stages[target];
      if (!stage || !params || typeof params !== 'object') continue;
      for (const [uniform, value] of Object.entries(params)) {
        if (stage.uniforms[uniform] !== undefined) stage.uniforms[uniform] = value;
      }
      governorRequestRender('style-param');
    }
    if (typeof preset.bloom?.intensity === 'number') effects.applyBloomIntensity(clampBloomIntensity(preset.bloom.intensity));
    if (typeof preset.bloom?.enabled === 'boolean') effects.setBloomEnabled(preset.bloom.enabled);
    if (typeof preset.sharpen?.intensity === 'number') effects.applySharpenIntensity(pct(preset.sharpen.intensity, 100) / 100);
    if (typeof preset.sharpen?.enabled === 'boolean') effects.setSharpenEnabled(preset.sharpen.enabled);
  }

  return {
    /** @returns {{ok: true, style: string} | {ok: false, reason: string, style: string}} */
    setStyle(name) {
      if (!STYLE_IDS.includes(name)) return { ok: false, reason: `Estilo visual desconocido: ${name}`, style };
      if (name === style) return { ok: true, style };
      const previous = style;
      style = name;
      if (typeof document !== 'undefined') document.documentElement.dataset.gevStyle = name;
      const out = effects.stages[previous];
      if (previous !== 'normal' && out) effects.startTransition(previous, out.uniforms.intensity, 0.0);
      const into = effects.stages[name];
      if (name !== 'normal' && into) effects.startTransition(name, into.uniforms.intensity, 1.0);
      applyPreset(name);
      return { ok: true, style };
    },
    getStyle: () => style,
    /** intensityPct 0-200 (escala v2 de src/bloom.js). */
    setBloom({ enabled, intensityPct } = {}) {
      const error = invalid('bloom', { enabled, intensityPct });
      if (error) return { ok: false, error, bloom: bloomState() };
      if (intensityPct !== undefined) effects.applyBloomIntensity(pct(intensityPct, 200));
      if (enabled !== undefined) effects.setBloomEnabled(enabled);
      return { ok: true, bloom: bloomState() };
    },
    /** intensityPct 0-100. */
    setSharpen({ enabled, intensityPct } = {}) {
      const error = invalid('sharpen', { enabled, intensityPct });
      if (error) return { ok: false, error, sharpen: sharpenState() };
      if (intensityPct !== undefined) effects.applySharpenIntensity(pct(intensityPct, 100) / 100);
      if (enabled !== undefined) effects.setSharpenEnabled(enabled);
      return { ok: true, sharpen: sharpenState() };
    },
    getState: () => ({ style, bloom: bloomState(), sharpen: sharpenState() }),
    destroy() {
      effects.destroy();
    },
  };
}
