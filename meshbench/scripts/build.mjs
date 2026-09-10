// Bundles Meshbench into a single self-contained HTML file: dist/meshbench.html.
// three.js (ESM) + the app are compiled by esbuild into one inline script; the geometry
// core is additionally compiled as a Web Worker and embedded as a text blob.
import { build } from 'esbuild';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const src = (f) => path.join(root, 'src', f);
const minify = !process.argv.includes('--dev');

const pkg = JSON.parse(await readFile(path.join(root, 'package.json'), 'utf8'));
const threePkg = JSON.parse(await readFile(path.join(root, 'node_modules/three/package.json'), 'utf8'));

async function bundle(entry, opts = {}) {
  const r = await build({
    entryPoints: [entry], bundle: true, write: false, format: 'iife', target: ['es2022'], minify, external: ['node:zlib'], legalComments: 'none',
    define: { __MESHBENCH_VERSION__: JSON.stringify(pkg.version), __THREE_VERSION__: JSON.stringify(threePkg.version) },
    logLevel: 'warning', ...opts,
  });
  return r.outputFiles[0].text;
}

const [app, worker, css, html] = await Promise.all([
  bundle(src('app.js')),
  bundle(src('worker.js')),
  readFile(src('styles.css'), 'utf8'),
  readFile(src('index.html'), 'utf8'),
]);

// The worker source is embedded as a text node; </script> must not appear inside it.
const workerSafe = worker.replace(/<\/script/gi, '<\\/script');
const appSafe = app.replace(/<\/script/gi, '<\\/script');

const out = html
  .replace('/*__STYLES__*/', () => css)
  .replace('<!--__WORKER__-->', () => `<script type="text/plain" id="worker-src">${workerSafe}</script>`)
  .replace('<!--__APP__-->', () => `<script>${appSafe}</script>`)
  .replace(/__MESHBENCH_VERSION__/g, pkg.version)
  .replace(/__THREE_VERSION__/g, threePkg.version);

await mkdir(path.join(root, 'dist'), { recursive: true });
await writeFile(path.join(root, 'dist/meshbench.html'), out);
console.log(`dist/meshbench.html  ${(out.length / 1024).toFixed(0)} KB  (three ${threePkg.version}, ${minify ? 'minified' : 'dev'})`);
