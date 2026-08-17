// Copies the browser-loaded static assets that can't be consumed via normal
// ESM import out of node_modules and into public/vendor/:
//
// - shaka-player: no `module`/`exports` field in its package.json — it's a
//   Closure-Compiler global script meant to be loaded via <script src>, not
//   bundled, so it's copied as-is and loaded that way in HevcShakaPlayer.
// - @hevcjs/core's transcode-worker.js and wasm/hevc-decode.js(.wasm): these
//   are handed to hevc.js as `workerUrl`/`wasmUrl` and loaded at runtime via
//   `new Worker(url)` / `importScripts`, which need real fetchable URLs, not
//   bundled modules — so they're copied out too. hevc-decode.wasm is also
//   duplicated alongside transcode-worker.js itself (not just under wasm/)
//   because the worker resolves the wasm binary's location relative to its
//   own script URL, not the wasm loader's.
//
// @hevcjs/shaka-plugin is NOT copied here — it ships a proper ESM export and
// is imported normally in HevcShakaPlayer, letting Next.js's bundler resolve
// it (and its own transitive dependency on mp4box) like any other package.

import { cpSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const nodeModules = join(root, 'node_modules');
const vendorDir = join(root, 'public', 'vendor');

mkdirSync(join(vendorDir, 'hevcjs-core', 'wasm'), { recursive: true });

const copies = [
  ['shaka-player/dist/shaka-player.compiled.debug.js', 'shaka-player.compiled.debug.js'],
  ['@hevcjs/core/dist/transcode-worker.js', 'hevcjs-core/transcode-worker.js'],
  ['@hevcjs/core/dist/wasm/hevc-decode.js', 'hevcjs-core/wasm/hevc-decode.js'],
  ['@hevcjs/core/dist/wasm/hevc-decode.wasm', 'hevcjs-core/wasm/hevc-decode.wasm'],
  ['@hevcjs/core/dist/wasm/hevc-decode.wasm', 'hevcjs-core/hevc-decode.wasm'],
];

for (const [from, to] of copies) {
  cpSync(join(nodeModules, from), join(vendorDir, to));
  console.log(`copied ${from} -> public/vendor/${to}`);
}
