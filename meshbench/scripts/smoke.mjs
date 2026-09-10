// Headless browser smoke test: opens dist/meshbench.html in Chromium (software WebGL),
// exercises import, mesh check (worker), cut with pockets, the render tab and PNG export,
// and fails on any console error. Screenshots land in meshbench/screenshots/.
import { chromium } from 'playwright-core';
import { writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import * as G from '../src/geometry.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const shots = path.join(root, 'screenshots');
await mkdir(shots, { recursive: true });
const exe = process.env.CHROMIUM_PATH || '/opt/pw-browsers/chromium';
const browser = await chromium.launch({ executablePath: exe, headless: true, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--allow-file-access-from-files'] });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });
const errors = [];
const logs = [];
page.on('console', (m) => { logs.push(m.type() + ': ' + m.text()); if (m.type() === 'error') errors.push('console: ' + m.text()); });
page.on('pageerror', (e) => errors.push('page: ' + e.message));
const fail = (msg) => { throw new Error(msg); };
const step = async (name, fn) => {
  const t = performance.now();
  try { await fn(); } catch (e) {
    const st = await page.textContent('#status-msg').catch(() => '?');
    const parts = await page.evaluate(() => window.meshbench.S.parts.map((p) => p.name + ' ' + (p.pos.length / 9))).catch(() => '?');
    console.error('  parts: ' + JSON.stringify(parts));
    console.error(`FAIL ${name}: ${e.message}\n  status bar: ${st}\n  console:\n    ${logs.slice(-15).join('\n    ')}`);
    await page.screenshot({ path: path.join(shots, 'failure.png') }).catch(() => {});
    await browser.close(); process.exit(1);
  }
  console.log(`ok  ${name}  (${Math.round(performance.now() - t)} ms)`);
};

await page.goto(pathToFileURL(path.join(root, 'dist/meshbench.html')).href);
await page.waitForFunction(() => window.meshbench && window.meshbench.S, null, { timeout: 20000, polling: 200 });

await step('WebGL context and worker are up', async () => {
  const ok = await page.evaluate(() => !!document.getElementById('viewport').getContext('webgl2') || !!document.getElementById('viewport').getContext('webgl'));
  if (!ok) fail('no WebGL context');
});

await step('sample knob loads and the worker mesh check reports watertight', async () => {
  await page.evaluate(() => window.meshbench.addSample('knob'));
  await page.waitForFunction(() => { const p = window.meshbench.S.parts[0]; return p && p.cache.topoInfo; }, null, { timeout: 20000, polling: 200 });
  const s = await page.evaluate(() => window.meshbench.S.parts[0].cache.topoInfo.summary);
  if (!s.watertight || s.shells !== 1) fail('unexpected summary ' + JSON.stringify(s));
  const badge = await page.textContent('#insp-badge');
  if (!/Closed and consistent/.test(badge)) fail('badge: ' + badge);
  await page.screenshot({ path: path.join(shots, 'bench-knob.png') });
});

await step('an STL from disk imports through the file input', async () => {
  const stl = Buffer.from(G.writeSTL(G.sampleBracket(), 'bracket'));
  const file = path.join(shots, 'bracket.stl');
  await writeFile(file, stl);
  await page.setInputFiles('#file-input', file);
  await page.waitForFunction(() => window.meshbench.S.parts.length === 2, null, { timeout: 20000, polling: 200 });
  await page.waitForFunction(() => window.meshbench.S.parts[1].cache.topoInfo, null, { timeout: 20000, polling: 200 });
  const s = await page.evaluate(() => window.meshbench.S.parts[1].cache.topoInfo.summary);
  if (s.shells !== 3) fail('bracket shells ' + JSON.stringify(s));
});

await step('cut with pin pockets yields two closed halves plus a pin, laid cut-face down', async () => {
  await page.evaluate(() => window.meshbench.select([window.meshbench.S.parts[0].id]));
  await page.click('#tabs button[data-tab="modify"]');
  await page.click('#btn-cut');
  await page.waitForFunction(() => window.meshbench.S.parts.length === 4, null, { timeout: 30000, polling: 200 });
  const names = await page.evaluate(() => window.meshbench.S.parts.map((p) => p.name));
  if (!names.some((n) => /top$/.test(n)) || !names.some((n) => /bottom$/.test(n)) || !names.some((n) => /^Pin/.test(n))) fail('names ' + names.join(', '));
  await page.evaluate(() => Promise.all(window.meshbench.S.parts.map((p) => { window.meshbench.topoInfo(p); return p.cache.topoPromise || Promise.resolve(); })));
  const info = await page.evaluate(() => window.meshbench.S.parts.map((p) => [p.name, p.cache.topoInfo.summary.watertight, Number(window.meshbench.G.metrics(p.pos).volume.toFixed(1))]));
  for (const [n, wt, vol] of info) if (!wt || vol <= 0) fail(`${n} not watertight/positive: ${wt} ${vol}`);
  // both halves should rest with their cut face on the bed: the cut face is flat at z≈0 for both
  const flat = await page.evaluate(() => {
    const S = window.meshbench.S, G = window.meshbench.G;
    return S.parts.filter((p) => /top$|bottom$/.test(p.name)).map((p) => { const wp = G.transformPositions(p.pos, [1,0,0,p.mesh.position.x,0,1,0,p.mesh.position.y,0,0,1,p.mesh.position.z].map((v, i) => (i % 4 === 3 ? v : v)) ); void wp; p.mesh.updateMatrixWorld(true); const e = p.mesh.matrixWorld.elements; const m = [e[0], e[4], e[8], e[12], e[1], e[5], e[9], e[13], e[2], e[6], e[10], e[14]]; const w = G.transformPositions(p.pos, m); const f = G.overhang(w, 45); const a = G.overhangArea(w, f); return [p.name, Number(a.contact.toFixed(1))]; });
  });
  for (const [n, contact] of flat) if (contact < 300) fail(`${n} contact area ${contact} mm² (expected the ~500 mm² cut face on the bed)`);
  await page.screenshot({ path: path.join(shots, 'bench-cut.png') });
});

await step('render tab: presets, colour, translucency and layer lines apply without errors', async () => {
  await page.click('#tabs button[data-tab="render"]');
  await page.evaluate(() => window.meshbench.select(window.meshbench.S.parts.map((p) => p.id)));
  await page.click('#finish-presets button[data-id="silk"]');
  await page.click('#swatches button[data-color="#2457c5"]');
  await page.waitForTimeout(300);
  await page.screenshot({ path: path.join(shots, 'render-silk.png') });
  await page.click('#finish-presets button[data-id="marble"]');
  await page.selectOption('#backdrop', 'warm');
  await page.selectOption('#lighting', 'contrast');
  await page.waitForTimeout(300);
  await page.screenshot({ path: path.join(shots, 'render-marble.png') });
  await page.click('#finish-presets button[data-id="clear"]');
  await page.fill('#finish-hex', '#f0c41b'); await page.press('#finish-hex', 'Enter');
  await page.selectOption('#backdrop', 'dark');
  await page.waitForTimeout(300);
  await page.screenshot({ path: path.join(shots, 'render-translucent.png') });
  const mode = await page.evaluate(() => window.meshbench.S.mode);
  if (mode !== 'render') fail('mode ' + mode);
  const finish = await page.evaluate(() => window.meshbench.S.parts[0].finish);
  if (finish.preset !== 'clear' || finish.color !== '#f0c41b') fail('finish ' + JSON.stringify(finish));
});

await step('PNG export at 2x produces a download', async () => {
  const [dl] = await Promise.all([page.waitForEvent('download', { timeout: 30000 }), page.click('#btn-render-png')]);
  const p = await dl.path();
  const { statSync } = await import('node:fs');
  if (!p || statSync(p).size < 20000) fail('download too small');
  await dl.saveAs(path.join(shots, 'export-2x.png'));
});

await step('leaving the render tab restores the workbench and undo works', async () => {
  await page.click('#tabs button[data-tab="inspect"]');
  const mode = await page.evaluate(() => window.meshbench.S.mode);
  if (mode !== 'bench') fail('mode ' + mode);
  await page.keyboard.press('Control+Z'); // undo colour
  await page.keyboard.press('Control+Z');
  const n = await page.evaluate(() => window.meshbench.S.parts.length);
  if (n !== 4) fail('parts after undo ' + n);
});

await step('3MF export round-trips through the worker', async () => {
  const [dl] = await Promise.all([page.waitForEvent('download', { timeout: 30000 }), page.click('#tabs button[data-tab="export"]').then(() => page.click('#exp-3mf'))]);
  const { readFileSync } = await import('node:fs');
  const buf = readFileSync(await dl.path());
  const { DOMParser } = await import('../test/xml-shim.mjs');
  const parts = await G.parse3MF(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength), (xml) => new DOMParser().parseFromString(xml));
  if (parts.length !== 4) fail('3mf parts ' + parts.length);
});

await step('lenses, section view, orientation ranking and arrange run without errors', async () => {
  await page.click('#tabs button[data-tab="inspect"]');
  await page.evaluate(() => window.meshbench.select([window.meshbench.S.parts.find((p) => /bottom$/.test(p.name)).id]));
  await page.click('#lens button[data-lens="overhang"]');
  await page.click('#lens button[data-lens="thickness"]');
  await page.waitForFunction(() => { const p = window.meshbench.S.parts.find((q) => /bottom$/.test(q.name)); return p.cache.thickness; }, null, { timeout: 30000, polling: 200 });
  const note = await page.textContent('#thick-note');
  if (!/Thinnest sample/.test(note)) fail('thickness note: ' + note);
  await page.click('#lens button[data-lens="shells"]');
  await page.click('#lens button[data-lens="solid"]');
  await page.check('#sec-on');
  const secOn = await page.evaluate(() => window.meshbench.S.section.on && window.meshbench.S.parts[0].mesh.material.clippingPlanes.length === 1);
  if (!secOn) fail('section plane not applied');
  await page.screenshot({ path: path.join(shots, 'bench-section.png') });
  await page.uncheck('#sec-on');
  await page.click('#tabs button[data-tab="print"]');
  await page.click('#btn-orient');
  await page.waitForFunction(() => window.meshbench.S.orientResults && window.meshbench.S.orientResults.length > 5, null, { timeout: 30000, polling: 200 });
  await page.click('#orient-list .item');
  await page.click('#btn-arrange');
  const onBed = await page.evaluate(() => { const S = window.meshbench.S, G = window.meshbench.G; return S.parts.every((p) => { p.mesh.updateMatrixWorld(true); const e = p.mesh.matrixWorld.elements; const b = G.bounds(G.transformPositions(p.pos, [e[0], e[4], e[8], e[12], e[1], e[5], e[9], e[13], e[2], e[6], e[10], e[14]])); return b.min[0] >= -1e-6 && b.min[1] >= -1e-6 && Math.abs(b.min[2]) < 1e-6; }); });
  if (!onBed) fail('arrange left a part off the bed');
});

await step('mate tool: real canvas clicks put the cube on top of the bracket base', async () => {
  await page.evaluate(() => { const S = window.meshbench.S; while (S.parts.length) window.meshbench.S.parts.pop().mesh.removeFromParent(); S.sel = []; window.meshbench.refreshAll(); });
  await page.evaluate(() => window.meshbench.addSample('bracket'));
  await page.evaluate(() => window.meshbench.addSample('box'));
  await page.evaluate(() => { const S = window.meshbench.S; S.parts[1].mesh.position.set(200, 200, 0); window.meshbench.invalidate(S.parts[1]); window.meshbench.refreshAll(); });
  await page.click('#views button[data-view="iso"]');
  await page.waitForTimeout(700); // camera animation is 320 ms
  await page.click('#tools button[data-tool="mate"]');
  const tool = await page.evaluate(() => window.meshbench.S.tool);
  if (tool !== 'mate') fail('mate tool not active: ' + tool);
  // click the top face of the bracket base (world point on the base top, away from the wall and boss), then the cube's bottom-ish side face
  const pts = await page.evaluate(() => {
    const S = window.meshbench.S; const canvas = document.getElementById('viewport'); const r = canvas.getBoundingClientRect();
    const proj = (x, y, z) => { const v = new window.meshbench.THREE.Vector3(x, y, z).project(window.meshbench.camera()); return [r.left + (v.x + 1) / 2 * r.width, r.top + (1 - v.y) / 2 * r.height]; };
    const b = S.parts[0].mesh.position, c = S.parts[1].mesh.position;
    return { base: proj(b.x + 18, b.y - 8, 5), cubeTop: proj(c.x, c.y, 20) };
  });
  await page.mouse.click(pts.base[0], pts.base[1]);
  await page.waitForFunction(() => /Face A/.test(document.getElementById('mate-status').textContent), null, { timeout: 20000, polling: 200 });
  await page.mouse.click(pts.cubeTop[0], pts.cubeTop[1]);
  await page.waitForFunction(() => /^Mated/.test(document.getElementById('status-msg').textContent), null, { timeout: 20000, polling: 200 });
  const cube = await page.evaluate(() => { const S = window.meshbench.S, G = window.meshbench.G; const p = S.parts[1]; p.mesh.updateMatrixWorld(true); const e = p.mesh.matrixWorld.elements; return G.bounds(G.transformPositions(p.pos, [e[0], e[4], e[8], e[12], e[1], e[5], e[9], e[13], e[2], e[6], e[10], e[14]])); });
  // the cube's picked top face now touches the base top (z = 5) from above, i.e. the cube hangs below? No: B is rotated so its face normal opposes A's, so the cube sits with its former top face down on z = 5.
  if (Math.abs(cube.min[2] - 5) > 0.05) fail('cube min z after mate: ' + cube.min[2]);
  await page.screenshot({ path: path.join(shots, 'bench-mate.png') });
});

await step('fill holes closes an open mesh and the project round-trips', async () => {
  const box = G.sampleBox(15, 15, 15); const open = box.subarray(18);
  const file = path.join(shots, 'open-box.stl'); await writeFile(file, Buffer.from(G.writeSTL(open, 'open')));
  await page.setInputFiles('#file-input', file);
  await page.waitForFunction(() => window.meshbench.S.parts.length === 3, null, { timeout: 20000, polling: 200 });
  await page.click('#tabs button[data-tab="inspect"]');
  await page.waitForFunction(() => window.meshbench.S.parts[2].cache.topoInfo, null, { timeout: 20000, polling: 200 });
  const before = await page.evaluate(() => window.meshbench.S.parts[2].cache.topoInfo.summary.boundary);
  if (before !== 4) fail('boundary before ' + before);
  await page.click('#btn-fill');
  await page.waitForFunction(() => { const p = window.meshbench.S.parts[2]; return p.cache.topoInfo && p.cache.topoInfo.summary.boundary === 0; }, null, { timeout: 20000, polling: 200 });
  const [dl] = await Promise.all([page.waitForEvent('download', { timeout: 30000 }), page.keyboard.press('Control+S')]);
  const proj = path.join(shots, 'roundtrip.mbench.json'); await dl.saveAs(proj);
  await page.evaluate(() => { const S = window.meshbench.S; while (S.parts.length) S.parts.pop().mesh.removeFromParent(); S.sel = []; window.meshbench.refreshAll(); });
  await page.setInputFiles('#file-input', proj);
  await page.waitForFunction(() => window.meshbench.S.parts.length === 3, null, { timeout: 20000, polling: 200 });
  const names = await page.evaluate(() => window.meshbench.S.parts.map((p) => p.name + ':' + p.finish.preset));
  if (!names.every((n) => /:standard$/.test(n))) fail('finish lost: ' + names.join(','));
});

await browser.close();
if (errors.length) { console.error('Browser errors:\n' + errors.join('\n')); process.exit(1); }
console.log('smoke test passed');
