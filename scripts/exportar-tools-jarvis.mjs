#!/usr/bin/env node
// Vuelca el catálogo de las 28 herramientas de voz de God's Eye View a gev_tools.json
// en la raíz del repo. Fuente única de verdad: si GEV cambia sus herramientas, Jarvis
// las hereda al volver a correr este script — no hay que editar prompts a mano.
import { writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { GEV_REALTIME_TOOLS } from '../server/providers/openai/tools.js';

const outPath = fileURLToPath(new URL('../gev_tools.json', import.meta.url));

await writeFile(outPath, JSON.stringify(GEV_REALTIME_TOOLS, null, 2) + '\n', 'utf8');

console.log(`gev_tools.json escrito con ${GEV_REALTIME_TOOLS.length} herramientas.`);
