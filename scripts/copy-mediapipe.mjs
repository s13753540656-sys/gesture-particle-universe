import { cp, mkdir } from 'node:fs/promises';
import { build } from 'esbuild';
await mkdir('public/mediapipe/wasm', { recursive: true });
await cp('node_modules/@mediapipe/tasks-vision/wasm', 'public/mediapipe/wasm', { recursive: true });
// MediaPipe's WASM loader uses importScripts, which requires a classic Worker.
// Bundle as an IIFE for both Vite dev and production instead of a module Worker.
await build({ entryPoints: ['src/vision/hand.worker.ts'], bundle: true, format: 'iife',
  platform: 'browser', target: 'es2022', minify: true, outfile: 'public/mediapipe/hand.worker.js' });
console.log('MediaPipe WASM and classic Worker ready.');
