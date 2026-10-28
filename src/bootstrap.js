import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const original = path.join(here, 'start.js');
const fixed = path.join(here, '.start-fixed.mjs');
let source = fs.readFileSync(original, 'utf8');

// start.js contains a generated route block inside an outer template literal.
// Escape nested template syntax in that block so Node can parse the bootstrap
// file even when generated routes themselves contain template literals.
const marker = 'const routes = `';
const start = source.indexOf(marker);
if (start === -1) throw new Error('ES 24/7 startup route block not found.');
const contentStart = start + marker.length;
const end = source.lastIndexOf('`');
if (end <= contentStart) throw new Error('ES 24/7 startup route block is incomplete.');
const routeBody = source.slice(contentStart, end)
  .replace(/\\`/g, '\\`')
  .replace(/`/g, '\\`')
  .replace(/\$\{/g, '\\${');
source = source.slice(0, contentStart) + routeBody + source.slice(end);
fs.writeFileSync(fixed, source, 'utf8');
await import(fixed + '?v=' + Date.now());
