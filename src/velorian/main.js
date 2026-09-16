/**
 * Ojo de Dios — arranque de la interfaz Velorian (15 sep 2026).
 *
 * Entrada de velorian.html. Compone el MISMO motor de God's Eye View
 * (Cesium, capas de datos reales, las 28 acciones de voz) con una interfaz
 * construida desde cero: ni un template, ni una hoja de estilo, ni un
 * controlador de panel de GEV se carga aquí. El único puente con la UI
 * original es el punto de inyección `Controls` de src/app/controls.js, por
 * donde entra VelorianShell en lugar del StyleManager de GEV.
 *
 * Jarvis manda: src/app/tools.js expone window.__gevVoiceCommands.runner y
 * src/voice/jarvisBridge.js lo conecta a ws://127.0.0.1:8765, igual que antes.
 */
import { createApplication } from '../app/application.js';
import { createStandalonePlaceSearch } from '../standalone/placeSearch.js';
import { createStandaloneScene } from '../standalone/scene.js';
import { createApplicationControls } from '../app/controls.js';
import { createApplicationData } from '../app/data.js';
import { createApplicationTools } from '../app/tools.js';
import { describeError } from '../standalone/errors.js';
import { VelorianShell } from './shell.js';
import { createHero } from './hero.js';
import { installCursor } from './cursor.js';
import { mountLayersPanel } from './panels.js';

const hero = createHero();
const loadingScreen = document.getElementById('loading-screen');
const loaderStatus = loadingScreen.querySelector('.loader-status');

let placeSearch;
let shell;

/** Chrome propio: sin first-run de GEV, sin diálogo de llaves. Abre el hero. */
function startVelorianChrome({ styleManager, dataManager, signal }) {
  shell = styleManager;
  mountLayersPanel({ shell, dataManager, signal });
  hero.markEngineReady();
  void hero.reveal().then(() => {
    if (!signal.aborted) console.log('[OJO DE DIOS] interfaz Velorian lista.');
  });
  return async () => {};
}

const application = createApplication({
  createScene: (context) => {
    placeSearch = createStandalonePlaceSearch({
      resolveApiKey: () => import.meta.env.GOOGLE_MAPS_API_KEY,
      signal: context.signal,
    });
    return createStandaloneScene({
      ...context,
      googleApiKey: import.meta.env.GOOGLE_MAPS_API_KEY,
      cesiumToken: import.meta.env.CESIUM_ION_TOKEN,
      loaderStatus,
    });
  },
  createControls: (context) =>
    createApplicationControls({ ...context, loaderStatus, placeSearch, Controls: VelorianShell }),
  createData: (context) =>
    createApplicationData({ ...context, allowQaRegistration: import.meta.env.DEV }),
  createTools: (context) =>
    createApplicationTools({
      ...context,
      loadingScreen,
      placeSearch,
      startChrome: startVelorianChrome,
    }),
});

const stopCursor = installCursor();
window.addEventListener('beforeunload', stopCursor, { once: true });

application.start().catch((error) => {
  console.error("[OJO DE DIOS] el motor no arrancó:", error);
  hero.fail(`Error: ${describeError(error)}`);
});

export { application };
