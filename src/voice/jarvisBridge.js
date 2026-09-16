/**
 * Puente WebSocket hacia Jarvis (ws://127.0.0.1:8765) — el mismo servidor que ya
 * usa el chat de escritorio y la extensión de Chrome de Jarvis. Este módulo es un
 * cliente más de ese servidor: no expone estado global propio, solo despacha
 * acciones al runner de voz de GEV (`window.__gevVoiceCommands.runner`, i.e.
 * `runGevAction` de gevActions.js) cuando Jarvis lo pide.
 *
 * Protocolo (JSON por mensaje de texto):
 *
 *   → al abrir:        {"type":"gev_hola","version":1,"url":"<location.href>"}
 *   ← acción:           {"type":"gev_accion","id":"<str>","name":"<tool>","args":{}}
 *   → resultado ok:      {"type":"gev_resultado","id":"<mismo id>","ok":true,"result":{}}
 *   → resultado error:   {"type":"gev_error","id":"<mismo id>","ok":false,"error":"<msg>"}
 *   → runner no listo:   {"type":"gev_error","id":"<mismo id>","error":"runner_not_ready"}
 */

const RECONNECT_START_MS = 1000;
const RECONNECT_MAX_MS = 15000;
const RECONNECT_FACTOR = 1.6;

/**
 * Conecta el globo a Jarvis. `getRunner` se resuelve en CADA mensaje entrante
 * (no una sola vez al conectar), porque `window.__gevVoiceCommands` puede no
 * existir todavía cuando el WebSocket abre.
 *
 * @param {object} options
 * @param {() => (Function|null|undefined)} [options.getRunner]
 * @param {string} [options.url]
 * @returns {{ stop(): void }}
 */
export function connectJarvisBridge({
  getRunner = () => window.__gevVoiceCommands?.runner,
  url = 'ws://127.0.0.1:8765',
} = {}) {
  let detenido = false;
  let ws = null;
  let reconnectDelay = RECONNECT_START_MS;
  let reconnectTimer = null;

  function enviar(mensaje) {
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(mensaje));
    }
  }

  async function manejarAccion(data) {
    const { id, name, args } = data;
    const runner = getRunner();
    if (typeof runner !== 'function') {
      enviar({ type: 'gev_error', id, ok: false, error: 'runner_not_ready' });
      return;
    }
    try {
      const result = await runner(name, args || {}, {});
      enviar({ type: 'gev_resultado', id, ok: true, result });
    } catch (error) {
      enviar({
        type: 'gev_error',
        id,
        ok: false,
        error: error?.message || String(error),
      });
    }
  }

  function conectar() {
    if (detenido) return;
    try {
      ws = new WebSocket(url);
    } catch {
      programarReconexion();
      return;
    }

    ws.onopen = () => {
      reconnectDelay = RECONNECT_START_MS;
      enviar({ type: 'gev_hola', version: 1, url: location.href });
      window.dispatchEvent(new CustomEvent('jarvis-bridge', { detail: { connected: true } }));
    };

    ws.onmessage = (event) => {
      let data;
      try {
        data = JSON.parse(event.data);
      } catch {
        return;
      }
      if (data?.type === 'gev_accion') {
        manejarAccion(data);
      }
    };

    ws.onclose = () => {
      window.dispatchEvent(new CustomEvent('jarvis-bridge', { detail: { connected: false } }));
      programarReconexion();
    };

    ws.onerror = () => {
      // onclose se dispara después de onerror; la reconexión se programa ahí.
      console.debug(
        '[jarvisBridge] conexión con Jarvis no disponible, reintentando…',
      );
    };
  }

  function programarReconexion() {
    if (detenido) return;
    clearTimeout(reconnectTimer);
    reconnectTimer = setTimeout(conectar, reconnectDelay);
    reconnectDelay = Math.min(
      reconnectDelay * RECONNECT_FACTOR,
      RECONNECT_MAX_MS,
    );
  }

  conectar();

  return {
    stop() {
      detenido = true;
      clearTimeout(reconnectTimer);
      if (ws) {
        ws.onclose = null;
        ws.close();
        ws = null;
      }
    },
  };
}
