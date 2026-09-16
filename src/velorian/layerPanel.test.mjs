import test from 'node:test';
import assert from 'node:assert/strict';
import { createVelorianLayerPanel, installVelorianLayerPanel } from './layerPanel.js';

class Element {
  constructor(tag) {
    this.tagName = tag;
    this.children = [];
    this.dataset = {};
    this.style = {};
    this.attributes = {};
    this.listeners = new Map();
    this.className = '';
    this.classList = {
      contains: (name) => this.className.split(' ').includes(name),
      toggle: (name, on) => {
        const names = new Set(this.className.split(' ').filter(Boolean));
        if (on) names.add(name); else names.delete(name);
        this.className = [...names].join(' ');
      },
    };
  }
  append(...nodes) { for (const node of nodes) { node.parent = this; this.children.push(node); } }
  replaceChildren(...nodes) { this.children = []; this.append(...nodes); }
  remove() { if (this.parent) this.parent.children = this.parent.children.filter((node) => node !== this); }
  setAttribute(name, value) { this.attributes[name] = value; }
  getAttribute(name) { return this.attributes[name]; }
  addEventListener(name, fn) { this.listeners.set(name, fn); }
  removeEventListener(name, fn) { if (this.listeners.get(name) === fn) this.listeners.delete(name); }
  matches(selector) { return selector === '[data-layer-id]' ? Boolean(this.dataset.layerId) : this.classList.contains(selector.slice(1)); }
  closest(selector) { return this.matches(selector) ? this : this.parent?.closest(selector); }
  querySelectorAll(selector) { return this.children.flatMap((node) => [...(node.matches(selector) ? [node] : []), ...node.querySelectorAll(selector)]); }
  querySelector(selector) { return this.querySelectorAll(selector)[0] || null; }
}

function fixture(t) {
  const previous = globalThis.document;
  globalThis.document = { hidden: false, createElement: (tag) => new Element(tag) };
  t.after(() => { if (previous === undefined) delete globalThis.document; else globalThis.document = previous; });
  const layers = [
    { id: 'on', enabled: true, lifecycleState: 'enabled' },
    { id: 'busy', enabled: false, lifecycleState: 'enabling' },
    { id: 'uncertain', enabled: false, lifecycleState: 'disabled', lifecycleUncertain: true },
  ].map((layer) => ({ ...layer, name: layer.id, source: 'Fuente', icon: '◉', showInTogglePanel: true, stats: { count: 0, lastUpdate: Date.now() - 120000 } }));
  const calls = [];
  const listeners = new Map();
  let hidden = 0;
  const descriptor = { chips: [{ id: 'chip', label: 'Filtro', params: { filter: true } }], legend: [{ label: 'Datos', count: 3, color: '#1a7bff' }] };
  const callbacks = {
    getLayers: () => layers,
    isEnabled: (id) => layers.find((layer) => layer.id === id).enabled,
    setEnabled: async (...args) => { calls.push(args); },
    setLayerParams: async (...args) => { calls.push(args); },
    getRowControls: () => descriptor,
    hasRowControls: (id) => id === 'on',
    subscribeRowControls: (id, fn) => { listeners.set(id, fn); return () => listeners.delete(id); },
    onHiddenRefresh: () => hidden++,
  };
  const panel = createVelorianLayerPanel(callbacks);
  t.after(() => panel.destroy());
  const container = new Element('div');
  panel.mount(container);
  return { layers, calls, listeners, descriptor, callbacks, panel, container, hidden: () => hidden };
}

test('Velorian conserva contrato de voz, estados independientes y toggle con origin panel', async (t) => {
  const f = fixture(t);
  const rows = f.container.querySelectorAll('[data-layer-id]');
  assert.equal(rows.length, 3);
  for (const row of rows) assert.ok(row.querySelector('.data-name'));
  assert.equal(rows[0].querySelector('.v-lp-count').textContent, '0');
  assert.match(rows[0].querySelector('.v-lp-meta').textContent, /Fuente · hace 2 min/);
  assert.equal(rows[1].querySelector('.v-lp-state').textContent, 'OFF · activando…');
  assert.equal(rows[2].querySelector('.v-lp-state').textContent, 'OFF · incierto');
  await rows[0].querySelector('.v-lp-toggle').listeners.get('click')();
  await rows[1].querySelector('.v-lp-toggle').listeners.get('click')();
  await rows[2].querySelector('.v-lp-toggle').listeners.get('click')();
  assert.deepEqual(f.calls, [['on', false, { origin: 'panel' }], ['uncertain', true, { origin: 'panel' }]]);
  f.layers[0].lifecycleState = 'disabling';
  f.layers[0].lifecycleUncertain = true;
  f.panel._refreshTogglePanel();
  assert.equal(rows[0].querySelector('.v-lp-state').textContent, 'ON · desactivando… · incierto');
});

test('Velorian actualiza chips en su nodo, conserva foco de voz y limpia listeners', async (t) => {
  const f = fixture(t);
  const row = f.container.children[0];
  row.classList.toggle('gev-voice-focus', true);
  const chip = row.querySelector('.v-lp-chip');
  f.descriptor.chips[0].params = { filter: false };
  f.listeners.get('on')();
  assert.equal(row.querySelector('.v-lp-chip'), chip);
  assert.ok(row.classList.contains('gev-voice-focus'));
  assert.equal(row.querySelector('.v-lp-swatch').style.background, '#1a7bff');
  await row.querySelector('.v-lp-controls').listeners.get('click')({ target: chip });
  assert.deepEqual(f.calls, [['on', { filter: false }, { origin: 'panel' }]]);
  document.hidden = true;
  f.panel._refreshTogglePanel();
  assert.equal(f.hidden(), 1);
  document.hidden = false;
  f.layers[0].enabled = false;
  f.panel._refreshTogglePanel();
  assert.equal(row.querySelector('.v-lp-controls').hidden, true);
  const toggle = row.querySelector('.v-lp-toggle');
  f.panel.destroy();
  assert.equal(f.listeners.size, 0);
  assert.equal(toggle.listeners.size, 0);
  assert.equal(f.container.children.length, 0);
});

test('Velorian instala la fábrica y cancela la suscripción del manager al destruir', (t) => {
  const f = fixture(t);
  let listener;
  const manager = {
    ...f.callbacks,
    getAll: f.callbacks.getLayers,
    _rowControlsFor: f.callbacks.getRowControls,
    layers: new Map(),
    subscribe(fn) { listener = fn; return () => { listener = null; }; },
  };
  installVelorianLayerPanel(manager);
  const panel = manager._getLayerPanel();
  assert.equal(manager._getLayerPanel(), panel);
  panel.mount(new Element('div'));
  listener();
  panel.destroy();
  assert.equal(listener, null);
});

test('Velorian mantiene single-flight y relee visibilidad al terminar la operación', async (t) => {
  const f = fixture(t);
  f.panel.destroy();
  let settle;
  f.callbacks.setEnabled = (...args) => {
    f.calls.push(args);
    return new Promise((resolve) => { settle = resolve; });
  };
  const panel = createVelorianLayerPanel(f.callbacks);
  t.after(() => panel.destroy());
  panel.mount(f.container);
  const button = f.container.children[0].querySelector('.v-lp-toggle');
  const click = button.listeners.get('click');
  const first = click();
  await click();
  assert.equal(f.calls.length, 1);
  assert.equal(button.getAttribute('aria-busy'), 'true');
  f.layers[0].enabled = false;
  settle();
  await first;
  assert.equal(button.textContent, 'OFF');
  assert.equal(button.getAttribute('aria-busy'), 'false');
});
