import test from 'node:test';
import assert from 'node:assert/strict';
import { createVelorianVisual, STYLE_IDS } from './visual.js';
import { VelorianShell } from './shell.js';
import { TRANSITION_DURATION_MS } from '../ui/visualPresets.js';

function fixture() {
  let time = 0;
  let next = 0;
  const frames = new Map();
  const stages = new Set();
  const bloom = { enabled: false, uniforms: { glowOnly: true, contrast: 1, brightness: 1, delta: 1, sigma: 1, stepSize: 1 } };
  const viewer = {
    scene: {
      postProcessStages: {
        bloom,
        add(stage) { stages.add(stage); },
        remove(stage) { return stages.delete(stage); },
      },
    },
  };
  const visual = createVelorianVisual({
    viewer,
    effects: {
      requestFrame: (callback) => { const id = next++; frames.set(id, callback); return id; },
      cancelFrame: (id) => frames.delete(id),
      now: () => time,
      wallNow: () => 10_000 + time,
      createStage: (options) => ({ ...options, enabled: true }),
    },
  });
  const tick = (value) => {
    time = value;
    const pending = [...frames.values()];
    frames.clear();
    for (const callback of pending) callback();
  };
  const stage = (name) => [...stages].find((s) => s.name === `godsEyeView_${name}`);
  return { visual, stages, stage, tick, bloom };
}

test('arranca en normal con las 6 etapas de estilo + sharpen, todas apagadas', () => {
  const f = fixture();
  assert.equal(f.visual.getStyle(), 'normal');
  assert.equal(f.stages.size, 7);
  assert.ok([...f.stages].every((s) => !s.enabled));
  assert.deepEqual(STYLE_IDS, ['normal', 'retro', 'surveillance', 'thermal', 'anime', 'noir', 'snow']);
});

test('setStyle(thermal) enciende FLIR y aplica su preset', () => {
  const f = fixture();
  assert.deepEqual(f.visual.setStyle('thermal'), { ok: true, style: 'thermal' });
  assert.equal(f.visual.getStyle(), 'thermal');
  f.tick(TRANSITION_DURATION_MS);
  const thermal = f.stage('thermal');
  assert.equal(thermal.uniforms.intensity, 1);
  assert.equal(thermal.enabled, true);
  assert.equal(thermal.uniforms.sensitivity, 0.85);
  assert.deepEqual(f.visual.getState().sharpen, { enabled: true, intensityPct: 49 });
});

test('volver a normal apaga la etapa previa', () => {
  const f = fixture();
  f.visual.setStyle('thermal');
  f.tick(TRANSITION_DURATION_MS);
  f.visual.setStyle('normal');
  f.tick(TRANSITION_DURATION_MS * 2 + 1);
  const thermal = f.stage('thermal');
  assert.equal(f.visual.getStyle(), 'normal');
  assert.equal(thermal.uniforms.intensity, 0);
  assert.equal(thermal.enabled, false);
});

test('getState refleja bloom/sharpen y rechaza valores inválidos', () => {
  const f = fixture();
  assert.equal(f.visual.setBloom({ enabled: true, intensityPct: 120 }).ok, true);
  assert.deepEqual(f.visual.getState().bloom, { enabled: true, intensityPct: 120 });
  assert.equal(f.bloom.enabled, true);
  f.visual.setSharpen({ enabled: true, intensityPct: 70 });
  assert.deepEqual(f.visual.getState().sharpen, { enabled: true, intensityPct: 70 });
  assert.equal(f.visual.setBloom({ intensityPct: Number.NaN }).ok, false);
  assert.equal(f.visual.setStyle('infrarrojo').ok, false);
  assert.equal(f.visual.getStyle(), 'normal');
});

test('destroy retira las etapas y restaura el bloom de Cesium', () => {
  const f = fixture();
  f.visual.setBloom({ enabled: true, intensityPct: 150 });
  f.visual.destroy();
  assert.equal(f.stages.size, 0);
  assert.equal(f.bloom.enabled, false);
  assert.equal(f.bloom.uniforms.glowOnly, true);
});

test('VelorianShell delega en el visual real y avisa a los suscriptores', () => {
  const f = fixture();
  const shell = new VelorianShell({}, { visual: f.visual });
  let calls = 0;
  shell.subscribe(() => { calls += 1; });
  assert.equal(shell.setStyle('surveillance').ok, true);
  assert.equal(shell.activeStyle, 'surveillance');
  assert.equal(shell.setBloom({ enabled: true, intensityPct: 120 }).ok, true);
  const state = shell.getControlState();
  assert.equal(state.style, 'surveillance');
  assert.deepEqual(state.bloom, { enabled: true, intensityPct: 120 });
  assert.equal(calls, 2);
  assert.equal(shell.setStyle('nope').ok, false);
  assert.equal(calls, 2);
  shell.dispose();
  assert.equal(f.stages.size, 0);
});
