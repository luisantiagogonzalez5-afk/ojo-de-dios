/** Renderer propio; conserva los puntos de entrada que usa DataLayerManager. */
export function createVelorianLayerPanel(callbacks) {
  const { getLayers, isEnabled, setEnabled, setLayerParams, getRowControls,
    hasRowControls, subscribeRowControls, onHiddenRefresh = () => {} } = callbacks;
  let container;
  let destroyed = false;
  const rows = new Map();
  const pending = new Set();
  const element = (tag, className, text) => {
    const node = document.createElement(tag);
    node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  };
  const busy = (layer) => ['enabling', 'disabling'].includes(layer.lifecycleState);
  const count = (value) => Number.isFinite(value) ? value.toLocaleString('es-MX') : '—';
  const release = () => {
    for (const entry of rows.values()) {
      entry.unsubscribe?.();
      entry.toggle.removeEventListener('click', entry.onToggle);
      entry.controls.removeEventListener('click', entry.onChip);
      entry.row.remove();
    }
    rows.clear();
  };
  const panel = {
    mount(target) {
      if (destroyed) return;
      release();
      container = target;
      container?.replaceChildren();
      panel._renderToggles();
    },
    destroy() {
      destroyed = true;
      release();
      container = null;
    },
    _buildMetaText(layer) {
      const stats = layer.stats || {};
      const timestamp = typeof stats.lastUpdate === 'number' ? stats.lastUpdate : Date.parse(stats.lastUpdate);
      const age = Number.isFinite(timestamp) ? `hace ${Math.max(0, Math.floor((Date.now() - timestamp) / 60000))} min` : 'sin actualización';
      const detail = stats.error || stats.lastError || stats.managerRefreshError || stats.statusMessage || stats.loadingLabel;
      return [stats.source || layer.source, age, detail].filter(Boolean).join(' · ');
    },
    _syncToggleButton(button, layer) {
      button.textContent = layer.enabled ? 'ON' : 'OFF';
      button.setAttribute('aria-label', `${layer.enabled ? 'Apagar' : 'Encender'} ${layer.name}`);
      button.setAttribute('aria-pressed', String(Boolean(layer.enabled)));
      button.setAttribute('aria-disabled', String(busy(layer) || pending.has(layer.id)));
      button.setAttribute('aria-busy', String(busy(layer) || pending.has(layer.id)));
    },
    _renderToggles() {
      if (destroyed || !container) return;
      const layers = getLayers().filter((layer) => layer.showInTogglePanel);
      const ids = new Set(layers.map((layer) => layer.id));
      for (const [id, entry] of rows) {
        if (ids.has(id)) continue;
        entry.unsubscribe?.();
        entry.toggle.removeEventListener('click', entry.onToggle);
        entry.controls.removeEventListener('click', entry.onChip);
        entry.row.remove();
        rows.delete(id);
      }
      for (const layer of layers) {
        let entry = rows.get(layer.id);
        if (!entry) {
          const row = element('div', 'v-lp-row');
          row.dataset.layerId = layer.id;
          const top = element('div', 'v-lp-top');
          const left = element('div', 'v-lp-left');
          const icon = element('span', 'v-lp-icon');
          const name = element('span', 'v-lp-name data-name');
          const total = element('span', 'v-lp-count');
          const toggle = element('button', 'v-lp-toggle');
          toggle.type = 'button';
          const state = element('span', 'v-lp-state');
          state.setAttribute('aria-live', 'polite');
          const meta = element('div', 'v-lp-meta');
          const controls = element('div', 'v-lp-controls');
          left.append(icon, name);
          top.append(left, total, toggle);
          row.append(top, state, meta, controls);
          const onToggle = async () => {
            const current = getLayers().find(({ id }) => id === layer.id);
            if (destroyed || rows.get(layer.id)?.row !== row || !current || busy(current) || pending.has(layer.id)) return;
            pending.add(layer.id);
            panel._syncToggleButton(toggle, current);
            try { await setEnabled(layer.id, !isEnabled(layer.id), { origin: 'panel' }); }
            catch (error) { console.warn(`[Velorian] ${layer.id}:`, error); }
            finally { pending.delete(layer.id); panel._refreshTogglePanel(); }
          };
          const onChip = async (event) => {
            const button = event.target?.closest?.('.v-lp-chip');
            if (destroyed || !button || button.disabled || !isEnabled(layer.id)) return;
            const chip = getRowControls(layer.id)?.chips?.find(({ id }) => id === button.dataset.chipId);
            if (!chip || chip.disabled) return;
            try {
              if (typeof chip.onClick === 'function') await chip.onClick();
              else if (chip.params) await setLayerParams(layer.id, chip.params, { origin: 'panel' });
            } catch (error) { console.warn(`[Velorian] ${layer.id} control:`, error); }
            finally { panel._refreshTogglePanel(); }
          };
          toggle.addEventListener('click', onToggle);
          controls.addEventListener('click', onChip);
          entry = { row, icon, name, total, toggle, state, meta, controls, onToggle, onChip, chips: new Map() };
          rows.set(layer.id, entry);
          container.append(row);
          if (hasRowControls(layer.id)) entry.unsubscribe = subscribeRowControls(layer.id, () => panel._refreshTogglePanel());
        }
        entry.row.classList.toggle('is-on', Boolean(layer.enabled));
        entry.row.classList.toggle('is-busy', busy(layer));
        entry.row.classList.toggle('is-uncertain', Boolean(layer.lifecycleUncertain));
        entry.icon.textContent = layer.icon || '';
        entry.name.textContent = layer.name;
        entry.total.textContent = layer.stats?.countLabel || count(layer.stats?.count);
        entry.state.textContent = [layer.enabled ? 'ON' : 'OFF',
          layer.lifecycleState === 'enabling' ? 'activando…' : layer.lifecycleState === 'disabling' ? 'desactivando…' : '',
          layer.lifecycleUncertain ? 'incierto' : ''].filter(Boolean).join(' · ');
        entry.meta.textContent = panel._buildMetaText(layer);
        panel._syncToggleButton(entry.toggle, layer);
        const descriptor = layer.enabled && hasRowControls(layer.id) ? getRowControls(layer.id) : null;
        const chips = descriptor?.chips || [];
        const legend = descriptor?.legend || [];
        entry.controls.hidden = !chips.length && !legend.length;
        for (const [id, button] of entry.chips) {
          if (chips.some((chip) => chip.id === id)) continue;
          button.remove();
          entry.chips.delete(id);
        }
        for (const chip of chips) {
          let button = entry.chips.get(chip.id);
          if (!button) {
            button = element('button', 'v-lp-chip');
            button.type = 'button';
            button.dataset.chipId = chip.id;
            entry.chips.set(chip.id, button);
            entry.controls.append(button);
          }
          button.className = `v-lp-chip${chip.active ? ' is-active' : ''}`;
          button.dataset.state = chip.state || (chip.active ? 'active' : 'idle');
          button.textContent = chip.label;
          button.title = chip.title || '';
          button.disabled = Boolean(chip.disabled);
          button.setAttribute('aria-pressed', String(Boolean(chip.active)));
          button.setAttribute('aria-busy', String(Boolean(chip.busy)));
        }
        for (const node of entry.controls.querySelectorAll('.v-lp-legend')) node.remove();
        for (const item of legend) {
          const node = element('span', 'v-lp-legend');
          node.title = item.blurb || '';
          const swatch = element('span', 'v-lp-swatch');
          swatch.style.background = item.color;
          node.append(swatch, element('span', '', `${item.label} ${count(item.count)}`));
          entry.controls.append(node);
        }
      }
    },
    _refreshTogglePanel() {
      if (destroyed || !container) return;
      if (document.hidden) { onHiddenRefresh(); return; }
      panel._renderToggles();
    },
  };
  return panel;
}

/** onData se ejecuta antes del primer buildTogglePanel del arranque compartido. */
export function installVelorianLayerPanel(dataManager) {
  // El manager no ofrece fábrica pública: sustituimos solo esta instancia,
  // conservando su propiedad y su ruta normal de destrucción del panel.
  dataManager._getLayerPanel = () => {
    if (!dataManager._layerPanel) {
      const panel = createVelorianLayerPanel({
        getLayers: () => dataManager.getAll(),
        isEnabled: (id) => dataManager.isEnabled(id),
        setEnabled: (id, enabled, options) => dataManager.setEnabled(id, enabled, options),
        setLayerParams: (id, params, options) => dataManager.setLayerParams(id, params, options),
        getRowControls: (id) => dataManager._rowControlsFor(id),
        hasRowControls: (id) => typeof dataManager.layers.get(id)?.module?.getRowControls === 'function',
        subscribeRowControls: (id, listener) => {
          const module = dataManager.layers.get(id)?.module;
          module?.setRowControlsListener?.(listener);
          return () => module?.setRowControlsListener?.(null);
        },
        onHiddenRefresh: () => { dataManager._panelRefreshPendingOnVisible = true; },
      });
      dataManager._layerPanel = panel;
      const unsubscribe = dataManager.subscribe(() => panel._refreshTogglePanel());
      const destroy = panel.destroy;
      panel.destroy = () => { unsubscribe(); destroy(); };
    }
    return dataManager._layerPanel;
  };
}
