/* Meshbench application: UI, scene and tools. Geometry math lives in geometry.js and runs
   in a Web Worker (worker.js) whenever it is heavy. */
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { TransformControls } from 'three/addons/controls/TransformControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { toCreasedNormals } from 'three/addons/utils/BufferGeometryUtils.js';
import { Earcut } from 'three/src/extras/Earcut.js';
import * as G from './geometry.js';
import { createOps } from './ops.js';
import { FINISHES, FINISH_BY_ID, SWATCHES, DEFAULT_FINISH, BACKDROPS, makeFinishMaterial, applyFinish, radialFadeTexture, makeBackdropSphere, paintBackdropSphere } from './materials.js';

const $ = (id) => document.getElementById(id);
const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));
THREE.Object3D.DEFAULT_UP.set(0, 0, 1);

const PALETTE = ['#cfc9bf', '#bfc9d3', '#d0c2ae', '#bccdb9', '#ccbcc7', '#c5c8b5', '#cbbfbf', '#b8c8ce'];
const SHELL_COLORS = [[0.36, 0.55, 0.86], [0.86, 0.47, 0.36], [0.42, 0.72, 0.47], [0.80, 0.62, 0.30], [0.62, 0.45, 0.78], [0.35, 0.70, 0.72], [0.80, 0.42, 0.62], [0.55, 0.60, 0.35]];
const VERSION = typeof __MESHBENCH_VERSION__ !== 'undefined' ? __MESHBENCH_VERSION__ : 'dev';

// ---------------------------------------------------------------- state
const S = {
  parts: [], sel: [], tool: 'select', lens: 'solid', history: [], future: [], showBed: true, ortho: false, mode: 'bench',
  bed: [256, 256, 256], section: { on: false, axis: 2, pos: NaN }, measurements: [], measurePending: null,
  cut: { axis: 2, pos: NaN, tilt: 0 }, orientResults: null, dirty: true, uid: 1, edgeKind: null, snap: true,
  mate: { a: null }, presenting: false,
  studio: { backdrop: 'studio', lighting: 'soft', exposure: 1, groundShadow: true, floor: true, turntable: false, turntableSpeed: 4, smooth: true, layers: { on: true, height: 0.2, strength: 0.45 } },
};
const selected = () => S.sel.map((id) => S.parts.find((p) => p.id === id)).filter(Boolean);
const primary = () => selected()[0] || null;

// ---------------------------------------------------------------- worker
const localOps = createOps(G, Earcut.triangulate);
let worker = null;
try {
  const src = $('worker-src');
  if (src && typeof Worker !== 'undefined') worker = new Worker(URL.createObjectURL(new Blob([src.textContent], { type: 'text/javascript' })));
} catch (e) { console.warn('Worker unavailable, running geometry on the main thread', e); worker = null; }
let jobId = 0; const jobs = new Map();
if (worker) {
  worker.onmessage = (e) => { const j = jobs.get(e.data.id); if (!j) return; jobs.delete(e.data.id); e.data.ok ? j.resolve(e.data.result) : j.reject(new Error(e.data.error)); };
  worker.onerror = (e) => { console.error('worker error', e); for (const j of jobs.values()) j.reject(new Error('Background worker crashed')); jobs.clear(); worker = null; };
}
function work(op, args) {
  if (!worker) return new Promise((res, rej) => { setTimeout(() => { try { res(localOps[op](args).result); } catch (e) { rej(e); } }, 0); });
  return new Promise((resolve, reject) => { const id = ++jobId; jobs.set(id, { resolve, reject }); worker.postMessage({ id, op, args }); });
}

// ---------------------------------------------------------------- scene
const canvas = $('viewport');
const center = $('center');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, preserveDrawingBuffer: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
renderer.setClearColor(0xaeb2b7, 1);
renderer.localClippingEnabled = true;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFShadowMap;
const scene = new THREE.Scene();
const camP = new THREE.PerspectiveCamera(40, 1, 1, 20000);
const camO = new THREE.OrthographicCamera(-100, 100, 100, -100, -20000, 20000);
camP.position.set(320, -300, 220); camO.position.copy(camP.position);
const ctlP = new OrbitControls(camP, canvas), ctlO = new OrbitControls(camO, canvas);
for (const c of [ctlP, ctlO]) { c.target.set(128, 128, 30); c.enableDamping = false; c.mouseButtons = { LEFT: THREE.MOUSE.ROTATE, MIDDLE: THREE.MOUSE.DOLLY, RIGHT: THREE.MOUSE.PAN }; c.addEventListener('change', () => (S.dirty = true)); }
ctlO.enabled = false;
const cam = () => (S.ortho ? camO : camP);
const ctl = () => (S.ortho ? ctlO : ctlP);

// bench lighting
const benchLights = new THREE.Group();
benchLights.add(new THREE.HemisphereLight(0xffffff, 0x60656c, 1.3));
const headlight = new THREE.DirectionalLight(0xffffff, 1.4); headlight.position.set(0.4, -0.6, 1);
camP.add(headlight); camO.add(headlight.clone()); scene.add(camP, camO);
scene.add(benchLights);
// studio lighting (render mode)
const studioLights = new THREE.Group(); studioLights.visible = false; scene.add(studioLights);
const keyLight = new THREE.DirectionalLight(0xfff4e6, 2.2); keyLight.castShadow = true;
keyLight.shadow.mapSize.set(2048, 2048); keyLight.shadow.bias = -0.0004; keyLight.shadow.normalBias = 0.05; keyLight.shadow.radius = 6;
const fillLight = new THREE.DirectionalLight(0xdfe8f5, 0.9);
const rimLight = new THREE.DirectionalLight(0xffffff, 1.2);
studioLights.add(keyLight, keyLight.target, fillLight, rimLight);
let envTexture = null;
function ensureEnv() { if (envTexture) return envTexture; const pm = new THREE.PMREMGenerator(renderer); envTexture = pm.fromScene(new RoomEnvironment(), 0.04).texture; pm.dispose(); return envTexture; }

const partsGroup = new THREE.Group(); scene.add(partsGroup);
const bedGroup = new THREE.Group(); scene.add(bedGroup);
const helpers = new THREE.Group(); scene.add(helpers);
const studioGroup = new THREE.Group(); studioGroup.visible = false; scene.add(studioGroup);
const shadowCatcher = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.ShadowMaterial({ opacity: 0.28, transparent: true, depthWrite: false })); shadowCatcher.receiveShadow = true; shadowCatcher.renderOrder = -1; studioGroup.add(shadowCatcher);
const floorDisc = new THREE.Mesh(new THREE.CircleGeometry(1, 96), new THREE.MeshStandardMaterial({ color: 0xd8d9d7, roughness: 0.96, metalness: 0, transparent: true, depthWrite: false, alphaMap: radialFadeTexture() })); floorDisc.receiveShadow = true; floorDisc.renderOrder = -2; floorDisc.position.z = -0.02; studioGroup.add(floorDisc);
const backdropSphere = makeBackdropSphere(); studioGroup.add(backdropSphere);

const gizmo = new TransformControls(camP, canvas);
gizmo.setSpace('world'); gizmo.size = 0.9; scene.add(gizmo.getHelper());
gizmo.addEventListener('dragging-changed', (e) => { ctl().enabled = !e.value; });
gizmo.addEventListener('mouseDown', () => pushHistory());
gizmo.addEventListener('objectChange', () => { const p = primary(); if (p) invalidate(p); S.dirty = true; scheduleUI(); });

// axis triad (corner overlay)
const triadScene = new THREE.Scene(); const triadCam = new THREE.PerspectiveCamera(40, 1, 0.1, 20); triadCam.up.set(0, 0, 1);
{
  const mk = (dir, color, label) => {
    const g = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3(...dir)]);
    triadScene.add(new THREE.Line(g, new THREE.LineBasicMaterial({ color })));
    const c = document.createElement('canvas'); c.width = c.height = 64; const x = c.getContext('2d'); x.font = 'bold 40px system-ui'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillStyle = '#' + color.toString(16).padStart(6, '0'); x.fillText(label, 32, 34);
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: t, depthTest: false })); sp.position.set(dir[0] * 1.35, dir[1] * 1.35, dir[2] * 1.35); sp.scale.setScalar(0.55); triadScene.add(sp);
  };
  mk([1, 0, 0], 0xc0392b, 'X'); mk([0, 1, 0], 0x27ae60, 'Y'); mk([0, 0, 1], 0x2980b9, 'Z');
}

function buildBed() {
  while (bedGroup.children.length) { const c = bedGroup.children.pop(); c.geometry && c.geometry.dispose(); c.material && c.material.dispose(); }
  const [W, D, H] = S.bed;
  const minor = [], major = [];
  for (let x = 0; x <= W + 1e-6; x += 10) (x % 50 === 0 ? major : minor).push(x, 0, 0, x, D, 0);
  for (let y = 0; y <= D + 1e-6; y += 10) (y % 50 === 0 ? major : minor).push(0, y, 0, W, y, 0);
  const mk = (arr, color, op) => { const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(arr, 3)); return new THREE.LineSegments(g, new THREE.LineBasicMaterial({ color, transparent: true, opacity: op })); };
  const plate = new THREE.Mesh(new THREE.PlaneGeometry(W, D), new THREE.MeshBasicMaterial({ color: 0xa2a6ab })); plate.position.set(W / 2, D / 2, -0.05); bedGroup.add(plate);
  bedGroup.add(mk(minor, 0x8e9297, 0.6)); bedGroup.add(mk(major, 0x6d7177, 0.8));
  const box = [0, 0, 0, W, 0, 0, W, 0, 0, W, D, 0, W, D, 0, 0, D, 0, 0, D, 0, 0, 0, 0, 0, 0, H, W, 0, H, W, 0, H, W, D, H, W, D, H, 0, D, H, 0, D, H, 0, 0, H, 0, 0, 0, 0, 0, H, W, 0, 0, W, 0, H, W, D, 0, W, D, H, 0, D, 0, 0, D, H];
  bedGroup.add(mk(box, 0x5f6368, 0.45));
  bedGroup.add(mk([0, 0, 0, 14, 0, 0], 0xb23a2f, 0.9)); bedGroup.add(mk([0, 0, 0, 0, 14, 0], 0x25764a, 0.9));
  bedGroup.visible = S.showBed && S.mode === 'bench';
  S.dirty = true;
}

function resize() {
  const w = canvas.clientWidth || 1, h = canvas.clientHeight || 1;
  renderer.setSize(w, h, false);
  camP.aspect = w / h; camP.updateProjectionMatrix();
  const half = (camO.top - camO.bottom) / 2; camO.left = -half * w / h; camO.right = half * w / h; camO.updateProjectionMatrix();
  S.dirty = true;
}
new ResizeObserver(resize).observe(canvas);

const labelLayer = document.createElement('div'); labelLayer.style.cssText = 'position:absolute;inset:0;pointer-events:none;overflow:hidden'; center.appendChild(labelLayer);
let camAnim = null;
function frame(t) {
  requestAnimationFrame(frame);
  if (camAnim) {
    const k = Math.min(1, (t - camAnim.t0) / camAnim.dur), e = 1 - Math.pow(1 - k, 3);
    for (const [c, ctrl, from, to] of camAnim.items) { c.position.lerpVectors(from.p, to.p, e); ctrl.target.lerpVectors(from.t, to.t, e); if (c.isOrthographicCamera) { c.zoom = from.zoom + (to.zoom - from.zoom) * e; c.updateProjectionMatrix(); } ctrl.update(); }
    if (k >= 1) camAnim = null;
    S.dirty = true;
  }
  if (S.mode === 'render' && S.studio.turntable) { ctl().autoRotate = true; ctl().autoRotateSpeed = S.studio.turntableSpeed; ctl().update(); S.dirty = true; } else { ctlP.autoRotate = ctlO.autoRotate = false; }
  if (!S.dirty) return;
  S.dirty = false;
  renderScene();
  updateLabels();
}
function renderScene() {
  const w = canvas.clientWidth || 1, h = canvas.clientHeight || 1, dpr = renderer.getPixelRatio();
  renderer.setScissorTest(false);
  renderer.setViewport(0, 0, w * dpr, h * dpr);
  renderer.render(scene, cam());
  if (!S.presenting) {
    const size = 74, m = 10;
    const dir = cam().position.clone().sub(ctl().target).normalize();
    triadCam.position.copy(dir).multiplyScalar(4.2); triadCam.lookAt(0, 0, 0);
    renderer.setScissorTest(true);
    renderer.setViewport((w - size - m) * dpr, m * dpr, size * dpr, size * dpr);
    renderer.setScissor((w - size - m) * dpr, m * dpr, size * dpr, size * dpr);
    renderer.clearDepth();
    renderer.render(triadScene, triadCam);
    renderer.setScissorTest(false);
    renderer.setViewport(0, 0, w * dpr, h * dpr);
  }
}
requestAnimationFrame(frame);

// ---------------------------------------------------------------- parts
function makeBenchMaterial(color) { return new THREE.MeshStandardMaterial({ color, roughness: 0.72, metalness: 0, flatShading: true, side: THREE.DoubleSide, envMapIntensity: 0.4 }); }
function createPart(pos, name, opts = {}) {
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.computeVertexNormals(); geo.computeBoundingSphere(); geo.computeBoundingBox();
  const color = opts.color || PALETTE[(S.uid - 1) % PALETTE.length];
  const mesh = new THREE.Mesh(geo, makeBenchMaterial(new THREE.Color(color)));
  mesh.castShadow = true; mesh.receiveShadow = true;
  if (opts.matrix) { const m = new THREE.Matrix4().fromArray(opts.matrix); m.decompose(mesh.position, mesh.quaternion, mesh.scale); }
  const part = { id: opts.id || ('p' + (S.uid++)), name: name || 'Part', pos, geoVersion: opts.geoVersion || 1, color, visible: opts.visible !== false, mesh, cache: {}, benchGeo: geo, finish: { ...DEFAULT_FINISH, ...(opts.finish || {}) } };
  if (!opts.finish) part.finish.color = color;
  mesh.visible = part.visible; mesh.userData.part = part;
  partsGroup.add(mesh);
  if (S.mode === 'render') enterRenderPart(part);
  return part;
}
function disposePart(p) {
  partsGroup.remove(p.mesh); p.benchGeo.dispose(); if (p.cache.renderGeo) p.cache.renderGeo.dispose();
  const m = p.mesh.material; if (Array.isArray(m)) m.forEach((x) => x.dispose()); else m.dispose();
  if (p.renderMat) p.renderMat.dispose();
  if (p.mateHelper) { p.mesh.remove(p.mateHelper); p.mateHelper.geometry.dispose(); }
  work('forget', { key: topoKey(p) });
}
function invalidate(p) { p.cache.world = null; p.cache.wmetrics = null; p.cache.overhang = null; }
function topoKey(p) { return p.id + ':' + p.geoVersion; }
function worldMatrix34(p) { p.mesh.updateMatrixWorld(true); const e = p.mesh.matrixWorld.elements; return [e[0], e[4], e[8], e[12], e[1], e[5], e[9], e[13], e[2], e[6], e[10], e[14]]; }
function worldPos(p) { if (!p.cache.world) p.cache.world = G.transformPositions(p.pos, worldMatrix34(p)); return p.cache.world; }
function worldMetrics(p) { if (!p.cache.wmetrics) p.cache.wmetrics = G.metrics(worldPos(p)); return p.cache.wmetrics; }
function topoLocal(p) { if (!p.cache.topoLocal || p.cache.topoLocalVersion !== p.geoVersion) { p.cache.topoLocal = G.topology(p.pos); p.cache.topoLocalVersion = p.geoVersion; } return p.cache.topoLocal; }
/** Async topology report from the worker (summary + defect edge lines + shell ids), cached per geometry version. */
function topoInfo(p) {
  if (p.cache.topoInfo && p.cache.topoInfoVersion === p.geoVersion) return p.cache.topoInfo;
  if (!p.cache.topoPromise || p.cache.topoInfoVersion !== p.geoVersion) {
    p.cache.topoInfoVersion = p.geoVersion;
    p.cache.topoInfo = null;
    const v = p.geoVersion;
    p.cache.topoPromise = work('topology', { key: topoKey(p), pos: p.pos }).then((r) => { if (p.geoVersion === v) { p.cache.topoInfo = r; p.cache.topoPromise = null; refreshPanels(); if (S.lens === 'shells' || S.edgeKind) { applyLens(); if (S.edgeKind) showEdges(S.edgeKind); } } return r; }).catch((e) => { status('Mesh check failed: ' + e.message, 'bad'); p.cache.topoPromise = null; });
  }
  return null;
}
function addPart(pos, name, opts) { const p = createPart(pos, name, opts); S.parts.push(p); return p; }
function removePart(p) { const i = S.parts.indexOf(p); if (i >= 0) S.parts.splice(i, 1); disposePart(p); S.sel = S.sel.filter((id) => id !== p.id); }
function replacePart(old, newParts) {
  const i = S.parts.indexOf(old);
  disposePart(old);
  S.parts.splice(i, 1, ...newParts.filter((p) => !S.parts.includes(p)));
  S.sel = newParts.map((p) => p.id);
}
/** Replace a part's geometry (local coords) keeping its transform, name, colour and finish. */
function replaceGeometry(p, newPos, opts = {}) {
  const np = createPart(newPos, opts.name || p.name, { color: p.color, visible: p.visible, matrix: opts.identity ? undefined : p.mesh.matrix.toArray(), finish: p.finish });
  replacePart(p, [np]);
  return np;
}
function select(ids, additive = false) { S.sel = additive ? Array.from(new Set([...S.sel, ...ids])) : ids.slice(); S.orientResults = null; refreshAll(); }
function toggleSelect(id) { S.sel = S.sel.includes(id) ? S.sel.filter((x) => x !== id) : [...S.sel, id]; S.orientResults = null; refreshAll(); }

// ---------------------------------------------------------------- history
function snapshot() { return { parts: S.parts.map((p) => ({ id: p.id, name: p.name, pos: p.pos, geoVersion: p.geoVersion, color: p.color, visible: p.visible, m: p.mesh.matrix.toArray(), finish: { ...p.finish } })), sel: S.sel.slice() }; }
function pushHistory() { S.history.push(snapshot()); if (S.history.length > 60) S.history.shift(); S.future.length = 0; updateHistoryButtons(); }
function restore(snap) {
  const keep = new Map(); for (const p of S.parts) keep.set(p.id, p);
  const next = [];
  for (const r of snap.parts) {
    let p = keep.get(r.id);
    if (p && p.pos === r.pos) keep.delete(r.id);
    else { if (p) { disposePart(p); keep.delete(r.id); } p = createPart(r.pos, r.name, { id: r.id, color: r.color, visible: r.visible, finish: r.finish, geoVersion: r.geoVersion }); }
    p.name = r.name; p.color = r.color; p.visible = r.visible; p.mesh.visible = r.visible; p.finish = { ...r.finish };
    const m = new THREE.Matrix4().fromArray(r.m); m.decompose(p.mesh.position, p.mesh.quaternion, p.mesh.scale); invalidate(p);
    if (S.mode === 'render') applyPartFinish(p);
    next.push(p);
  }
  for (const p of keep.values()) disposePart(p);
  S.parts = next; S.sel = snap.sel.filter((id) => next.some((p) => p.id === id)); S.orientResults = null;
  clearMate(); refreshAll();
}
function undo() { if (!S.history.length) return; S.future.push(snapshot()); restore(S.history.pop()); updateHistoryButtons(); status('Undone'); }
function redo() { if (!S.future.length) return; S.history.push(snapshot()); restore(S.future.pop()); updateHistoryButtons(); status('Redone'); }
function updateHistoryButtons() { $('btn-undo').disabled = !S.history.length; $('btn-redo').disabled = !S.future.length; }

// ---------------------------------------------------------------- UI helpers
const fmt = (x, d = 2) => (Math.abs(x) >= 1e5 ? x.toExponential(2) : x.toFixed(d));
const fmtInt = (x) => x.toLocaleString('en-US');
let statusTimer = null;
function status(msg, kind = '') { const el = $('status-msg'); el.textContent = msg; el.className = kind; clearTimeout(statusTimer); if (kind !== 'bad') statusTimer = setTimeout(() => { if (el.textContent === msg) { el.textContent = 'Ready'; el.className = ''; } }, 6000); }
let busyCount = 0;
function busy(on, label) { busyCount = Math.max(0, busyCount + (on ? 1 : -1)); $('busy').classList.toggle('hidden', busyCount === 0); if (label) $('busy').textContent = label; }
async function withBusy(label, fn) { busy(true, label); try { return await fn(); } catch (e) { console.error(e); status(e.message || String(e), 'bad'); } finally { busy(false); } }
function download(data, filename, type = 'application/octet-stream') {
  const blob = data instanceof Blob ? data : new Blob([data], { type });
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = filename; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 4000);
}
const safeName = (s) => (s || 'part').replace(/[^\w.-]+/g, '_').slice(0, 60);
let uiTimer = null; function scheduleUI() { if (uiTimer) return; uiTimer = setTimeout(() => { uiTimer = null; refreshPanels(); }, 60); }
function escapeText(s) { const d = document.createElement('div'); d.textContent = s; return d.innerHTML; }

// ---------------------------------------------------------------- import
async function importFiles(files) {
  const scale = parseFloat($('import-units').value) || 1;
  const added = [];
  const snap = snapshot();
  for (const f of files) {
    const ext = (f.name.split('.').pop() || '').toLowerCase();
    try {
      if (ext === 'json' || ext === 'mbench') { await openProject(f); continue; }
      busy(true, 'Reading ' + f.name + '…');
      const buf = await f.arrayBuffer();
      let items;
      if (ext === 'stl') { const r = G.parseSTL(buf); if (r.truncated) status(f.name + ' looks truncated; loaded what was there', 'bad'); items = [r]; }
      else if (ext === 'obj') items = [G.parseOBJ(new TextDecoder().decode(buf))];
      else if (ext === '3mf') items = await G.parse3MF(buf);
      else { status('Skipped ' + f.name + ': not an STL, OBJ or 3MF file', 'bad'); continue; }
      const base = f.name.replace(/\.[^.]+$/, '');
      items.forEach((it, i) => {
        if (!it.positions.length) { status(f.name + ' contains no triangles', 'bad'); return; }
        let pos = it.positions; if (scale !== 1) pos = G.scalePositions(pos, scale);
        if (!G.allFinite(pos)) { status(f.name + ' has non-finite coordinates', 'bad'); return; }
        const name = items.length > 1 ? (it.name || base + ' ' + (i + 1)) : base;
        added.push(addPart(pos, name));
      });
    } catch (e) { console.error(e); status('Could not read ' + f.name + ': ' + e.message, 'bad'); }
    finally { busy(false); }
  }
  if (added.length) {
    S.history.push(snap); if (S.history.length > 60) S.history.shift(); S.future.length = 0; updateHistoryButtons();
    let minZ = Infinity, minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const p of added) { const b = worldMetrics(p).bounds; minZ = Math.min(minZ, b.min[2]); minX = Math.min(minX, b.min[0]); minY = Math.min(minY, b.min[1]); maxX = Math.max(maxX, b.max[0]); maxY = Math.max(maxY, b.max[1]); }
    const offBed = minX < 0 || minY < 0 || maxX > S.bed[0] || maxY > S.bed[1];
    const dx = offBed ? S.bed[0] / 2 - (minX + maxX) / 2 : 0, dy = offBed ? S.bed[1] / 2 - (minY + maxY) / 2 : 0, dz = -minZ;
    for (const p of added) { p.mesh.position.x += dx; p.mesh.position.y += dy; p.mesh.position.z += dz; invalidate(p); }
    S.sel = added.map((p) => p.id);
    refreshAll(); fitView();
    const big = added.reduce((s, p) => s + p.pos.length / 9, 0);
    status('Added ' + added.length + ' part' + (added.length > 1 ? 's' : '') + ' (' + fmtInt(big) + ' triangles)' + (offBed ? ', moved onto the bed' : ''));
  } else refreshAll();
}

// ---------------------------------------------------------------- view
function sceneBounds(onlyVisible = true) {
  const b = new THREE.Box3();
  for (const p of S.parts) { if (onlyVisible && !p.visible) continue; const m = worldMetrics(p).bounds; b.expandByPoint(new THREE.Vector3(...m.min)); b.expandByPoint(new THREE.Vector3(...m.max)); }
  if (b.isEmpty()) b.set(new THREE.Vector3(0, 0, 0), new THREE.Vector3(S.bed[0], S.bed[1], Math.min(S.bed[2], 60)));
  return b;
}
function animateTo(pP, tP, pO, tO, zoomO) {
  camAnim = { t0: performance.now(), dur: 320, items: [[camP, ctlP, { p: camP.position.clone(), t: ctlP.target.clone() }, { p: pP, t: tP }], [camO, ctlO, { p: camO.position.clone(), t: ctlO.target.clone(), zoom: camO.zoom }, { p: pO, t: tO, zoom: zoomO }]] };
  S.dirty = true;
}
function fitView(bounds, dirOverride) {
  const b = bounds || sceneBounds();
  const c = b.getCenter(new THREE.Vector3()); const r = Math.max(b.getSize(new THREE.Vector3()).length() / 2, 5);
  const dir = dirOverride || cam().position.clone().sub(ctl().target).normalize(); if (dir.lengthSq() < 1e-6) dir.set(1, -1, 0.7).normalize();
  const w = canvas.clientWidth || 1, h = canvas.clientHeight || 1;
  const vfov = camP.fov * Math.PI / 180, hfov = 2 * Math.atan(Math.tan(vfov / 2) * (w / h));
  const dist = r / Math.sin(Math.min(vfov, hfov) / 2) * 1.05;
  camP.near = Math.max(0.1, dist / 200); camP.far = dist * 400; camP.updateProjectionMatrix();
  const half = r * 1.1; camO.top = half; camO.bottom = -half; camO.left = -half * w / h; camO.right = half * w / h; camO.updateProjectionMatrix();
  animateTo(c.clone().add(dir.clone().multiplyScalar(dist)), c.clone(), c.clone().add(dir.clone().multiplyScalar(dist)), c.clone(), 1);
}
function setView(name) {
  const dirs = { iso: [1, -1, 0.75], top: [0, 0, 1], front: [0, -1, 0.02], right: [1, 0, 0.02] };
  for (const k of [camP, camO]) k.up.set(0, 0, 1);
  fitView(null, new THREE.Vector3(...dirs[name]).normalize());
}
function setOrtho(on) {
  S.ortho = on; ctlP.enabled = !on; ctlO.enabled = on; camAnim = null;
  const w = canvas.clientWidth || 1, h = canvas.clientHeight || 1;
  if (on) { camO.position.copy(camP.position); ctlO.target.copy(ctlP.target); const d = camP.position.distanceTo(ctlP.target); const half = d * Math.tan(camP.fov * Math.PI / 360); camO.top = half; camO.bottom = -half; camO.left = -half * w / h; camO.right = half * w / h; camO.zoom = 1; camO.updateProjectionMatrix(); }
  else { const half = (camO.top - camO.bottom) / 2 / camO.zoom; const d = half / Math.tan(camP.fov * Math.PI / 360); const dir = camO.position.clone().sub(ctlO.target).normalize(); ctlP.target.copy(ctlO.target); camP.position.copy(ctlO.target).add(dir.multiplyScalar(d)); }
  gizmo.camera = cam(); ctl().update(); $('btn-ortho').classList.toggle('on', on); S.dirty = true;
}

// ---------------------------------------------------------------- lenses
function applyLens() {
  if (S.mode === 'render') { S.dirty = true; return; }
  const lens = S.lens;
  for (const p of S.parts) {
    const m = p.mesh.material, g = p.mesh.geometry;
    m.wireframe = lens === 'wire'; m.transparent = lens === 'xray'; m.opacity = lens === 'xray' ? 0.35 : 1; m.depthWrite = lens !== 'xray';
    let colors = null;
    if (lens === 'shells') colors = shellColors(p);
    else if (lens === 'overhang') colors = overhangColors(p);
    else if (lens === 'thickness') colors = thicknessColors(p);
    if (colors) { g.setAttribute('color', new THREE.BufferAttribute(colors, 3)); m.vertexColors = true; m.color.set(0xffffff); }
    else { if (g.getAttribute('color')) g.deleteAttribute('color'); m.vertexColors = false; m.color.set(p.color); }
    const isSel = S.sel.includes(p.id);
    m.emissive.set(isSel && !colors ? 0x1d5fc1 : 0x000000); m.emissiveIntensity = 0.14;
    m.needsUpdate = true;
  }
  $$('#lens button').forEach((b) => b.classList.toggle('on', b.dataset.lens === lens));
  $('overhang-row').classList.toggle('hidden', lens !== 'overhang');
  $('thick-row').classList.toggle('hidden', lens !== 'thickness'); $('thick-note').classList.toggle('hidden', lens !== 'thickness');
  S.dirty = true;
}
function fillTri(colors, t, r, g, b) { for (let k = 0; k < 3; k++) { colors[t * 9 + k * 3] = r; colors[t * 9 + k * 3 + 1] = g; colors[t * 9 + k * 3 + 2] = b; } }
function shellColors(p) {
  const c = new Float32Array(p.pos.length);
  const info = topoInfo(p);
  if (!info) { c.fill(0.8); return c; }
  for (let t = 0; t < info.shellOf.length; t++) { const s = info.shellOf[t]; const col = s < 0 ? [0.9, 0.2, 0.2] : SHELL_COLORS[s % SHELL_COLORS.length]; fillTri(c, t, col[0], col[1], col[2]); }
  return c;
}
function overhangColors(p) {
  const angle = parseFloat($('overhang-angle').value) || 45;
  const flags = G.overhang(worldPos(p), angle, 0); p.cache.overhang = flags;
  const c = new Float32Array(p.pos.length);
  for (let t = 0; t < flags.length; t++) { if (flags[t] === 1) fillTri(c, t, 0.82, 0.32, 0.26); else if (flags[t] === 2) fillTri(c, t, 0.24, 0.48, 0.80); else fillTri(c, t, 0.86, 0.86, 0.84); }
  return c;
}
function thicknessColors(p) {
  const c = new Float32Array(p.pos.length);
  const th = p.cache.thickness; const limit = parseFloat($('thick-limit').value) || 1;
  if (!th || th.key !== thicknessKey(p)) { c.fill(0.8); return c; }
  for (let t = 0; t < th.values.length; t++) {
    const v = th.values[t];
    if (!isFinite(v)) fillTri(c, t, 0.86, 0.86, 0.84);
    else if (v < limit) fillTri(c, t, 0.82, 0.25, 0.22);
    else if (v < limit * 2) fillTri(c, t, 0.90, 0.66, 0.25);
    else fillTri(c, t, 0.80, 0.84, 0.80);
  }
  return c;
}
function thicknessKey(p) { return p.geoVersion + ':' + p.mesh.scale.toArray().map((v) => v.toFixed(4)).join(); }
function runThickness() {
  const p = primary(); if (!p) return;
  withBusy('Sampling wall thickness…', async () => {
    const wp = worldPos(p);
    const values = await work('thickness', { pos: wp });
    p.cache.thickness = { values, key: thicknessKey(p) };
    const limit = parseFloat($('thick-limit').value) || 1;
    let thinArea = 0, total = 0, min = Infinity;
    for (let t = 0; t < values.length; t++) { const a = G.triArea(wp, t); total += a; if (values[t] < limit) thinArea += a; if (values[t] < min) min = values[t]; }
    $('thick-note').textContent = `Thinnest sample ${isFinite(min) ? fmt(min) : '—'} mm. ${fmt(100 * thinArea / (total || 1), 1)}% of the surface reads under ${limit} mm. Sampled from triangle centres inward, so tiny features between samples can be missed.`;
    S.lens = 'thickness'; applyLens();
  });
}

// ---------------------------------------------------------------- overlays
const overlay = { edges: null, section: null, plane: null, cutLines: null, measure: new THREE.Group() };
helpers.add(overlay.measure);
function clearObj(key) { const o = overlay[key]; if (o) { helpers.remove(o); o.geometry && o.geometry.dispose(); o.material && o.material.dispose(); overlay[key] = null; } }
function showEdges(kind) {
  clearObj('edges'); S.edgeKind = kind;
  const p = primary(); refreshCheckButtons();
  if (!p || !kind) { S.dirty = true; return; }
  const info = topoInfo(p); if (!info) return;
  const lines = kind === 'boundary' ? info.boundary : kind === 'nonmanifold' ? info.nonManifold : info.winding;
  if (!lines.length) return;
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(lines, 3));
  const line = new THREE.LineSegments(g, new THREE.LineBasicMaterial({ color: 0xb23a2f, depthTest: false })); line.renderOrder = 5;
  line.matrixAutoUpdate = false; line.matrix.copy(p.mesh.matrixWorld);
  overlay.edges = line; helpers.add(line); S.dirty = true;
}
function planeDef(cfg) { // world-space plane from axis/pos/tilt through the selected part's centre
  const p = primary(); const b = p ? worldMetrics(p).bounds : { center: [S.bed[0] / 2, S.bed[1] / 2, 0] };
  const axis = [0, 0, 0]; axis[cfg.axis] = 1;
  let n = axis;
  if (cfg.tilt) { const t = cfg.tilt * Math.PI / 180; const other = cfg.axis === 0 ? [0, 1, 0] : [1, 0, 0]; const third = G.vec.cross(other, axis); n = G.vec.norm(G.vec.add(G.vec.mul(axis, Math.cos(t)), G.vec.mul(third, Math.sin(t)))); }
  const base = b.center.slice(); base[cfg.axis] = cfg.pos;
  return { n, d: G.vec.dot(n, base), base };
}
function lineOverlay(segs, color) {
  const arr = new Float32Array(segs.length * 3); segs.forEach((q, i) => arr.set(q, i * 3));
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(arr, 3));
  const l = new THREE.LineSegments(g, new THREE.LineBasicMaterial({ color, depthTest: false })); l.renderOrder = 6; return l;
}
function updateSection() {
  clearObj('section');
  const on = S.section.on && S.mode === 'bench';
  const planes = [];
  if (on) { const axis = new THREE.Vector3(); axis.setComponent(S.section.axis, -1); planes.push(new THREE.Plane(axis, S.section.pos)); }
  for (const p of S.parts) { p.mesh.material.clippingPlanes = planes; p.mesh.material.needsUpdate = true; }
  if (on) {
    const p = primary();
    if (p) { const def = planeDef({ axis: S.section.axis, pos: S.section.pos, tilt: 0 }); const segs = G.sectionSegments(worldPos(p), def.n, def.d); if (segs.length) { overlay.section = lineOverlay(segs, 0x1d5fc1); helpers.add(overlay.section); } }
  }
  S.dirty = true;
}
function updateCutPreview() {
  clearObj('plane'); clearObj('cutLines');
  const p = primary(); const show = $('cut-preview').checked && $('tab-modify').classList.contains('on') && S.mode === 'bench';
  if (!p || !show) { S.dirty = true; return; }
  const def = planeDef(S.cut);
  const b = worldMetrics(p).bounds; const size = Math.hypot(...b.size) * 1.1;
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(size, size), new THREE.MeshBasicMaterial({ color: 0x1d5fc1, transparent: true, opacity: 0.16, side: THREE.DoubleSide, depthWrite: false }));
  mesh.position.set(...def.base); mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), new THREE.Vector3(...def.n));
  overlay.plane = mesh; helpers.add(mesh);
  const segs = G.sectionSegments(worldPos(p), def.n, def.d);
  if (segs.length) { overlay.cutLines = lineOverlay(segs, 0x174d9c); helpers.add(overlay.cutLines); }
  S.dirty = true;
}
function rebuildMeasureOverlay() {
  const grp = overlay.measure; while (grp.children.length) { const c = grp.children.pop(); c.geometry.dispose(); c.material.dispose(); }
  const dotGeo = new THREE.SphereGeometry(1, 12, 8);
  const mk = (pt, col) => { const m = new THREE.Mesh(dotGeo, new THREE.MeshBasicMaterial({ color: col, depthTest: false })); m.position.set(...pt); m.renderOrder = 8; m.scale.setScalar(measureDotSize()); grp.add(m); };
  for (const m of S.measurements) { mk(m.a, 0x1d5fc1); mk(m.b, 0x1d5fc1); const g = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(...m.a), new THREE.Vector3(...m.b)]); const l = new THREE.Line(g, new THREE.LineBasicMaterial({ color: 0x1d5fc1, depthTest: false })); l.renderOrder = 7; grp.add(l); }
  if (S.measurePending) mk(S.measurePending, 0xa8690e);
  S.dirty = true;
}
function measureDotSize() { const d = cam().position.distanceTo(ctl().target); return Math.max(0.3, d / 300); }
function updateLabels() {
  labelLayer.innerHTML = '';
  if (S.presenting) return;
  const w = canvas.clientWidth, h = canvas.clientHeight;
  for (const m of S.measurements) {
    const mid = new THREE.Vector3((m.a[0] + m.b[0]) / 2, (m.a[1] + m.b[1]) / 2, (m.a[2] + m.b[2]) / 2).project(cam());
    if (mid.z > 1) continue;
    const el = document.createElement('div'); el.className = 'mlabel'; el.textContent = fmt(m.d) + ' mm';
    el.style.left = ((mid.x + 1) / 2 * w) + 'px'; el.style.top = ((1 - mid.y) / 2 * h) + 'px';
    labelLayer.appendChild(el);
  }
}

// ---------------------------------------------------------------- picking / tools
const raycaster = new THREE.Raycaster();
let downPos = null;
canvas.addEventListener('pointerdown', (e) => { downPos = [e.clientX, e.clientY, e.button]; canvas.focus(); });
canvas.addEventListener('pointerup', (e) => {
  if (!downPos || downPos[2] !== 0) { downPos = null; return; }
  const moved = Math.hypot(e.clientX - downPos[0], e.clientY - downPos[1]); downPos = null;
  if (moved > 4 || gizmo.dragging || gizmo.axis) return;
  const hit = pick(e);
  if (S.tool === 'lay') { if (hit) layOnFace(hit); return; }
  if (S.tool === 'mate') { if (hit) pickMate(hit); return; }
  if (S.tool === 'measure') { if (hit) addMeasurePoint(snapPoint(hit, e)); return; }
  if (hit) { const id = hit.object.userData.part.id; if (e.ctrlKey || e.metaKey || e.shiftKey) toggleSelect(id); else if (!S.sel.includes(id) || S.sel.length > 1) select([id]); }
  else if (!(e.ctrlKey || e.metaKey || e.shiftKey)) select([]);
});
canvas.addEventListener('dblclick', (e) => { const hit = pick(e); if (hit) fitView(new THREE.Box3().setFromObject(hit.object)); else fitView(); });
function pick(e) {
  const r = canvas.getBoundingClientRect();
  raycaster.setFromCamera(new THREE.Vector2(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1), cam());
  const hits = raycaster.intersectObjects(S.parts.filter((p) => p.visible).map((p) => p.mesh), false);
  for (const h of hits) { if (S.section.on && S.mode === 'bench' && h.point.getComponent(S.section.axis) > S.section.pos + 1e-6) continue; return h; }
  return null;
}
/** Snap a hit to the nearest vertex of the hit triangle if it is within 12 screen pixels. */
function snapPoint(hit, e) {
  const p = hit.object.userData.part; const i = hit.faceIndex * 9; const r = canvas.getBoundingClientRect();
  let best = hit.point.toArray(), bestD = 12 * 12;
  for (let k = 0; k < 3; k++) {
    const v = new THREE.Vector3(p.pos[i + k * 3], p.pos[i + k * 3 + 1], p.pos[i + k * 3 + 2]).applyMatrix4(p.mesh.matrixWorld);
    const s = v.clone().project(cam()); const sx = (s.x + 1) / 2 * r.width, sy = (1 - s.y) / 2 * r.height;
    const d = (sx - (e.clientX - r.left)) ** 2 + (sy - (e.clientY - r.top)) ** 2;
    if (d < bestD) { bestD = d; best = v.toArray(); }
  }
  return best;
}
function layOnFace(hit) {
  const p = hit.object.userData.part;
  const n = hit.face.normal.clone().transformDirection(p.mesh.matrixWorld).normalize();
  pushHistory();
  rotateAboutCenter(p, new THREE.Quaternion().setFromUnitVectors(n, new THREE.Vector3(0, 0, -1)));
  select([p.id]); status('Laid ' + p.name + ' on the picked face');
}
function addMeasurePoint(pt) {
  if (!S.measurePending) { S.measurePending = pt; rebuildMeasureOverlay(); hint('Click the second point'); return; }
  const a = S.measurePending, b = pt; S.measurePending = null;
  S.measurements.push({ a, b, d: Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]), dx: Math.abs(a[0] - b[0]), dy: Math.abs(a[1] - b[1]), dz: Math.abs(a[2] - b[2]) });
  rebuildMeasureOverlay(); renderMeasureList(); hint('Click the first point of the next measurement');
}
function renderMeasureList() {
  const el = $('measure-list'); el.innerHTML = '';
  if (!S.measurements.length) { el.innerHTML = '<div class="empty">Use the measure tool and click two points on any part.</div>'; return; }
  S.measurements.forEach((m, i) => { const d = document.createElement('div'); d.className = 'item'; d.innerHTML = `<span>${i + 1}. <b>${fmt(m.d)} mm</b></span><button title="Remove">×</button><span class="sub">ΔX ${fmt(m.dx)} · ΔY ${fmt(m.dy)} · ΔZ ${fmt(m.dz)}</span>`; d.querySelector('button').onclick = () => { S.measurements.splice(i, 1); rebuildMeasureOverlay(); renderMeasureList(); }; el.appendChild(d); });
}
// ---- mate faces
function faceHelper(p, faces, color) {
  const arr = new Float32Array(faces.length * 9);
  faces.forEach((t, i) => arr.set(p.pos.subarray(t * 9, t * 9 + 9), i * 9));
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(arr, 3)); g.computeVertexNormals();
  const m = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.55, side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -3, depthTest: true }));
  m.renderOrder = 4; p.mesh.add(m); return m;
}
function clearMate() {
  for (const p of S.parts) if (p.mateHelper) { p.mesh.remove(p.mateHelper); p.mateHelper.geometry.dispose(); p.mateHelper.material.dispose(); p.mateHelper = null; }
  S.mate.a = null; if ($('mate-status')) $('mate-status').textContent = 'No face picked.'; S.dirty = true;
}
function pickMate(hit) {
  const p = hit.object.userData.part;
  withBusy('Finding the flat face…', async () => {
    const topo = topoLocal(p);
    const region = G.growPlanar(p.pos, topo, hit.faceIndex, 0.9995, 0.05);
    if (region.faces.length < 1) return;
    if (!S.mate.a || S.mate.a.partId === p.id) {
      clearMate();
      S.mate.a = { partId: p.id, normal: region.normal, point: region.centroid };
      p.mateHelper = faceHelper(p, region.faces, 0x1d5fc1);
      $('mate-status').textContent = `Face A: ${p.name} (${fmt(region.area / 100, 1)} cm²). Now click a face on the part to move.`;
      hint('Click a face on the part to move');
      S.dirty = true; return;
    }
    const a = S.parts.find((q) => q.id === S.mate.a.partId); if (!a) { clearMate(); return; }
    const gap = parseFloat($('mate-gap').value) || 0;
    a.mesh.updateMatrixWorld(true); p.mesh.updateMatrixWorld(true);
    const nA = new THREE.Vector3(...S.mate.a.normal).transformDirection(a.mesh.matrixWorld).normalize();
    const pA = new THREE.Vector3(...S.mate.a.point).applyMatrix4(a.mesh.matrixWorld);
    const nB = new THREE.Vector3(...region.normal).transformDirection(p.mesh.matrixWorld).normalize();
    const pB = new THREE.Vector3(...region.centroid).applyMatrix4(p.mesh.matrixWorld);
    pushHistory();
    const q = new THREE.Quaternion().setFromUnitVectors(nB, nA.clone().negate());
    p.mesh.quaternion.premultiply(q);
    const pBrot = pB.clone().sub(p.mesh.position).applyQuaternion(q).add(p.mesh.position);
    const target = pA.clone().addScaledVector(nA, gap);
    p.mesh.position.add(target.sub(pBrot));
    invalidate(p);
    clearMate(); select([p.id]);
    status(`Mated ${p.name} onto ${a.name}` + (gap ? ` with a ${gap} mm gap` : ''));
    hint('Click a face on the part that stays put');
  });
}
function setTool(t) {
  S.tool = t; S.measurePending = null; rebuildMeasureOverlay();
  if (t !== 'mate') clearMate();
  $$('#tools button').forEach((b) => b.classList.toggle('on', b.dataset.tool === t));
  const p = primary();
  if (['move', 'rotate', 'scale'].includes(t) && p && S.sel.length === 1 && S.mode === 'bench') {
    gizmo.setMode({ move: 'translate', rotate: 'rotate', scale: 'scale' }[t]); gizmo.attach(p.mesh);
    gizmo.setTranslationSnap(S.snap ? 1 : null); gizmo.setRotationSnap(S.snap ? THREE.MathUtils.degToRad(15) : null); gizmo.setScaleSnap(S.snap ? 0.05 : null);
  } else gizmo.detach();
  const hints = { select: 'Click a part to select · Ctrl-click adds · drag to orbit · double-click to frame', move: 'Drag the arrows to move · arrow keys nudge (Shift = 1 mm)', rotate: 'Drag a ring to rotate', scale: 'Drag a handle to scale', lay: 'Click the face that should sit on the bed', mate: 'Click a flat face on the part that stays put', measure: 'Click the first point (snaps to vertices)' };
  hint(hints[t], t !== 'select'); S.dirty = true;
}
function hint(text, tool = S.tool !== 'select') { $('hint').innerHTML = text; $('hint').classList.toggle('tool', tool); }

// ---------------------------------------------------------------- operations
function forSelected(fn, label) { const ps = selected(); if (!ps.length) { status('Select a part first', 'bad'); return; } pushHistory(); for (const p of ps) { fn(p); invalidate(p); } refreshAll(); if (label) status(label); }
/** Rotate a part in world space about its bounding-box centre, then re-seat it on the bed. */
function rotateAboutCenter(p, q) {
  const before = worldMetrics(p).bounds.center;
  p.mesh.quaternion.premultiply(q); invalidate(p);
  const after = worldMetrics(p).bounds; p.mesh.position.x += before[0] - after.center[0]; p.mesh.position.y += before[1] - after.center[1]; p.mesh.position.z -= after.min[2]; invalidate(p);
}
function dropToBed(p) { const b = worldMetrics(p).bounds; p.mesh.position.z -= b.min[2]; }
function centerOnBed(p) { const b = worldMetrics(p).bounds; p.mesh.position.x += S.bed[0] / 2 - b.center[0]; p.mesh.position.y += S.bed[1] / 2 - b.center[1]; }
function mirror(axis) {
  forSelected((p) => {
    const wp = worldPos(p); const b = G.bounds(wp); const m = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0]; m[axis * 5] = -1; m[axis * 4 + 3] = 2 * b.center[axis];
    replaceGeometry(p, G.transformPositions(wp, m), { identity: true });
  }, 'Mirrored');
}
function bake() { forSelected((p) => replaceGeometry(p, worldPos(p), { identity: true }), 'Transform written into the mesh'); }
function flipNormals() { forSelected((p) => replaceGeometry(p, G.flipWinding(p.pos)), 'Normals flipped'); }
function inchesToMm() { forSelected((p) => { const np = replaceGeometry(p, G.scalePositions(p.pos, 25.4)); dropToBed(np); }, 'Rescaled ×25.4'); }
function rotate90(axis) { const v = [0, 0, 0]; v[axis] = 1; forSelected((p) => rotateAboutCenter(p, new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(...v), Math.PI / 2)), 'Rotated 90° about ' + 'XYZ'[axis]); }

function geometryOp(op, label, done) {
  const p = primary(); if (!p) return;
  return withBusy(label, async () => {
    const r = await work(op, { key: topoKey(p), pos: p.pos });
    const msg = done(r, p);
    if (msg) refreshAll();
    if (typeof msg === 'string') status(msg);
  });
}
function cleanBad() { geometryOp('clean', 'Removing bad triangles…', (pos, p) => { if (pos.length === p.pos.length) { status('Nothing to remove'); return false; } pushHistory(); replaceGeometry(p, pos); return 'Removed ' + ((p.pos.length - pos.length) / 9) + ' bad triangles'; }); }
function fillHoles() { geometryOp('fill', 'Filling holes…', (r, p) => { if (!r.filled) { status(r.skipped ? 'Found ' + r.skipped + ' boundary loop(s) that could not be capped' : 'No holes to fill'); return false; } pushHistory(); replaceGeometry(p, r.positions); return 'Filled ' + r.filled + ' hole' + (r.filled > 1 ? 's' : '') + (r.skipped ? ', skipped ' + r.skipped : ''); }); }
function unifyNormals() { geometryOp('unify', 'Fixing normals…', (r, p) => { if (!r.flipped) { status('Normals were already consistent'); return false; } pushHistory(); replaceGeometry(p, r.positions); return 'Flipped ' + fmtInt(r.flipped) + ' triangles'; }); }
function splitShells() { geometryOp('split', 'Separating shells…', (shells, p) => { if (shells.length < 2) { status('This part is already a single shell'); return false; } pushHistory(); const news = shells.map((pos, i) => createPart(pos, p.name + ' ' + (i + 1), { visible: p.visible, matrix: p.mesh.matrix.toArray(), finish: p.finish })); replacePart(p, news); return 'Separated into ' + shells.length + ' parts'; }); }
function mergeSelected() {
  const ps = selected(); if (ps.length < 2) { status('Select two or more parts to combine', 'bad'); return; }
  pushHistory();
  const np = createPart(G.concat(ps.map((p) => worldPos(p))), ps[0].name + ' + ' + (ps.length - 1), { color: ps[0].color, finish: ps[0].finish });
  const idx = S.parts.indexOf(ps[0]);
  for (const p of ps) { disposePart(p); S.parts.splice(S.parts.indexOf(p), 1); }
  S.parts.splice(Math.min(idx, S.parts.length), 0, np); S.sel = [np.id]; refreshAll(); status('Combined ' + ps.length + ' parts');
}
function duplicateSelected() {
  const ps = selected(); if (!ps.length) return; pushHistory();
  const news = ps.map((p) => { const np = createPart(p.pos, p.name + ' copy', { color: p.color, visible: p.visible, matrix: p.mesh.matrix.toArray(), finish: p.finish, geoVersion: p.geoVersion }); const b = worldMetrics(p).bounds; np.mesh.position.x += b.size[0] + 8; S.parts.splice(S.parts.indexOf(p) + 1, 0, np); return np; });
  S.sel = news.map((p) => p.id); refreshAll(); status('Duplicated');
}
function deleteSelected() { const ps = selected(); if (!ps.length) return; pushHistory(); for (const p of ps) removePart(p); refreshAll(); status('Deleted ' + ps.length + ' part' + (ps.length > 1 ? 's' : '')); }
function renameSelected() {
  const p = primary(); if (!p) return;
  const row = $$('#parts .part').find((r) => r.dataset.id === p.id); if (!row) return;
  const nameEl = row.querySelector('.name'); const input = document.createElement('input'); input.type = 'text'; input.value = p.name; input.className = 'name-edit';
  nameEl.replaceWith(input); input.focus(); input.select();
  let finished = false;
  const done = (ok) => { if (finished) return; finished = true; if (ok && input.value.trim() && input.value.trim() !== p.name) { pushHistory(); p.name = input.value.trim(); } refreshAll(); };
  input.addEventListener('keydown', (e) => { if (e.key === 'Enter') done(true); if (e.key === 'Escape') done(false); e.stopPropagation(); });
  input.addEventListener('blur', () => done(true));
}
function cutPart() {
  const p = primary(); if (!p) return;
  const pin = $('pin-on').checked ? { count: parseInt($('pin-count').value) || 2, diameter: parseFloat($('pin-dia').value) || 4, depth: parseFloat($('pin-depth').value) || 6, clearance: parseFloat($('pin-clear').value) || 0, margin: 1.5 } : null;
  withBusy('Cutting…', async () => {
    const def = planeDef(S.cut);
    const wp = worldPos(p);
    const r = await work('cut', { key: topoKey(p) + ':w:' + p.mesh.matrix.toArray().map((v) => v.toFixed(3)).join(','), pos: wp, n: def.n, d: def.d, pocket: pin });
    if (!r.above.length || !r.below.length) { status('The plane does not pass through the part', 'bad'); return; }
    pushHistory();
    const keep = $('cut-keep').value; const layFlat = $('cut-flip').checked;
    const axisName = ['X', 'Y', 'Z'][S.cut.axis];
    const hi = S.cut.axis === 2 ? 'top' : axisName + '+', lo = S.cut.axis === 2 ? 'bottom' : axisName + '−';
    const news = [];
    const above = keep !== 'below' ? createPart(r.above, p.name + ' ' + hi, { color: p.color, finish: p.finish }) : null;
    const below = keep !== 'above' ? createPart(r.below, p.name + ' ' + lo, { color: p.color, finish: p.finish }) : null;
    if (above) news.push(above); if (below) news.push(below);
    if (r.pins.length && pin && $('pin-part').checked) news.push(createPart(r.pin, 'Pin ' + pin.diameter + ' mm × ' + fmt(pin.depth * 2 - 0.4, 1), { finish: { ...DEFAULT_FINISH, color: '#8a8d90' } }));
    replacePart(p, news);
    const nrm = new THREE.Vector3(...r.n || def.n), down = new THREE.Vector3(0, 0, -1);
    if (layFlat) {
      // The cut face of the "above" half already faces -n; the "below" half's cut face faces +n. Turn each so its cut face points down.
      if (above) rotateAboutCenter(above, new THREE.Quaternion().setFromUnitVectors(nrm.clone().negate(), down));
      if (below) rotateAboutCenter(below, new THREE.Quaternion().setFromUnitVectors(nrm.clone(), down));
    }
    const c0 = worldMetrics(news[0]).bounds; let x = c0.min[0]; const cy = c0.center[1];
    for (const np of news) { dropToBed(np); invalidate(np); const b = worldMetrics(np).bounds; np.mesh.position.x += x - b.min[0]; np.mesh.position.y += cy - b.center[1]; invalidate(np); x += b.size[0] + 10; }
    refreshAll(); fitView();
    const msg = 'Cut ' + p.name + (r.pins.length ? ' with ' + r.pins.length + ' pin pocket' + (r.pins.length > 1 ? 's' : '') : '') + (r.warnings.length ? ' — ' + r.warnings.join(' ') : '');
    status(msg, r.warnings.length ? 'bad' : 'ok');
  });
}
function arrange() {
  const ps = S.parts.filter((p) => p.visible); if (!ps.length) return;
  pushHistory();
  const gap = parseFloat($('arrange-gap').value) || 0; const [W] = S.bed;
  const items = ps.map((p) => ({ p, b: worldMetrics(p).bounds })).sort((a, b) => (b.b.size[0] * b.b.size[1]) - (a.b.size[0] * a.b.size[1]));
  let x = gap, y = gap, rowH = 0;
  for (const it of items) {
    const w = it.b.size[0], d = it.b.size[1];
    if (x + w > W && x > gap) { x = gap; y += rowH + gap; rowH = 0; }
    it.p.mesh.position.x += x - it.b.min[0]; it.p.mesh.position.y += y - it.b.min[1]; it.p.mesh.position.z -= it.b.min[2]; invalidate(it.p);
    x += w + gap; rowH = Math.max(rowH, d);
  }
  refreshAll(); fitView(); status('Arranged ' + ps.length + ' parts from the front-left corner');
}
function dropAll() { const ps = S.parts.filter((p) => p.visible); if (!ps.length) return; pushHistory(); for (const p of ps) { dropToBed(p); invalidate(p); } refreshAll(); status('All parts on the bed'); }
function rankOrientations() {
  const p = primary(); if (!p) return;
  withBusy('Ranking orientations…', async () => { S.orientResults = await work('orient', { pos: worldPos(p), angle: parseFloat($('overhang-angle').value) || 45 }); renderOrientList(); });
}
function applyOrientation(r) {
  const p = primary(); if (!p) return; pushHistory();
  rotateAboutCenter(p, new THREE.Quaternion(r.quat[0], r.quat[1], r.quat[2], r.quat[3]));
  S.orientResults = null; refreshAll(); status('Orientation applied');
}
function renderOrientList() {
  const el = $('orient-list'); el.innerHTML = '';
  if (!S.orientResults) { el.innerHTML = '<div class="empty">No ranking yet.</div>'; return; }
  const named = [[[0, 0, -1], '-Z down (as is)'], [[0, 0, 1], '+Z down (flip)'], [[1, 0, 0], '+X down'], [[-1, 0, 0], '-X down'], [[0, 1, 0], '+Y down'], [[0, -1, 0], '-Y down']];
  S.orientResults.slice(0, 6).forEach((r, i) => {
    const d = document.createElement('div'); d.className = 'item';
    const hit = named.find(([a]) => G.vec.dot(a, r.down) > 0.995);
    const label = hit ? hit[1] : 'Face (' + r.down.map((v) => v.toFixed(2)).join(', ') + ') down';
    d.innerHTML = `<span><b>${i + 1}.</b> ${label}</span><span>Overhang ${fmt(r.overhangArea / 100, 1)} cm²</span><span class="sub">Contact ${fmt(r.contactArea / 100, 1)} cm² · height ${fmt(r.height, 1)} mm · footprint ${fmt(r.footprint / 100, 1)} cm²</span>`;
    d.onclick = () => applyOrientation(r); el.appendChild(d);
  });
}

// ---------------------------------------------------------------- render (presentation) mode
function renderGeometry(p) {
  if (!S.studio.smooth) return p.benchGeo;
  if (!p.cache.renderGeo || p.cache.renderGeoVersion !== p.geoVersion) {
    if (p.cache.renderGeo) p.cache.renderGeo.dispose();
    p.cache.renderGeo = toCreasedNormals(p.benchGeo, THREE.MathUtils.degToRad(40)); p.cache.renderGeoVersion = p.geoVersion;
  }
  return p.cache.renderGeo;
}
function applyPartFinish(p) { if (!p.renderMat) p.renderMat = makeFinishMaterial(); applyFinish(p.renderMat, p.finish, S.studio.layers); S.dirty = true; }
function enterRenderPart(p) { applyPartFinish(p); p.mesh.geometry = renderGeometry(p); p.mesh.material = p.renderMat; p.mesh.material.clippingPlanes = []; }
function exitRenderPart(p) { p.mesh.geometry = p.benchGeo; p.mesh.material = p.mesh.userData.benchMat || (p.mesh.userData.benchMat = makeBenchMaterial(new THREE.Color(p.color))); }
function enterRender() {
  if (S.mode === 'render') return;
  S.mode = 'render';
  for (const p of S.parts) { p.mesh.userData.benchMat = p.mesh.material; enterRenderPart(p); }
  scene.environment = ensureEnv();
  benchLights.visible = false; headlight.visible = false; studioLights.visible = true; studioGroup.visible = true;
  bedGroup.visible = false; helpers.visible = false; gizmo.detach();
  renderer.setClearColor(0x000000, 0);
  updateStudio(); refreshRenderPanel(); S.dirty = true;
}
function exitRender() {
  if (S.mode === 'bench') return;
  S.mode = 'bench';
  for (const p of S.parts) exitRenderPart(p);
  scene.environment = null;
  benchLights.visible = true; headlight.visible = true; studioLights.visible = false; studioGroup.visible = false;
  bedGroup.visible = S.showBed; helpers.visible = true;
  renderer.setClearColor(0xaeb2b7, 1); renderer.toneMappingExposure = 1;
  center.className = '';
  refreshAll(); S.dirty = true;
}
const LIGHTING = {
  soft: { key: [[-0.55, -0.85, 1.25], 1.7], fill: [[1.1, 0.5, 0.55], 0.9], rim: [[0.3, 1.1, 0.8], 0.6], env: 0.95 },
  contrast: { key: [[0.9, -0.7, 1.05], 2.9], fill: [[-1, 0.3, 0.4], 0.32], rim: [[0.2, 1.1, 0.7], 0.35], env: 0.4 },
  rim: { key: [[-0.45, -0.95, 0.9], 1.3], fill: [[1, 0.2, 0.5], 0.55], rim: [[0.15, 1.2, 0.65], 2.6], env: 0.7 },
};
function updateStudio() {
  const st = S.studio;
  center.className = 'bg-' + st.backdrop;
  const b = sceneBounds(); const c = b.getCenter(new THREE.Vector3()); const r = Math.max(b.getSize(new THREE.Vector3()).length() / 2, 10);
  const L = LIGHTING[st.lighting] || LIGHTING.soft;
  const place = (light, [dir, intensity]) => { light.position.copy(c).add(new THREE.Vector3(...dir).normalize().multiplyScalar(r * 4)); light.intensity = intensity; light.target.position.copy(c); light.target.updateMatrixWorld(); };
  place(keyLight, L.key); place(fillLight, L.fill); place(rimLight, L.rim);
  studioLights.add(fillLight.target, rimLight.target);
  scene.environmentIntensity = L.env;
  keyLight.castShadow = st.groundShadow;
  const sc = keyLight.shadow.camera; sc.left = -r * 1.5; sc.right = r * 1.5; sc.top = r * 1.5; sc.bottom = -r * 1.5; sc.near = r * 1.5; sc.far = r * 7; sc.updateProjectionMatrix();
  keyLight.shadow.normalBias = Math.max(0.01, r * 0.0015);
  const floorZ = Math.min(b.min.z, 0);
  shadowCatcher.visible = st.groundShadow; shadowCatcher.position.set(c.x, c.y, floorZ + 0.01); shadowCatcher.scale.set(r * 8, r * 8, 1);
  const bd = BACKDROPS[st.backdrop];
  floorDisc.visible = st.floor && !!bd.floor; if (bd.floor) floorDisc.material.color.set(bd.floor);
  floorDisc.position.set(c.x, c.y, floorZ - 0.02); floorDisc.scale.set(r * 3.2, r * 3.2, 1);
  paintBackdropSphere(backdropSphere, st.backdrop);
  backdropSphere.position.set(c.x, c.y, floorZ); backdropSphere.scale.setScalar(r * 60);
  camP.far = Math.max(camP.far, r * 200); camP.updateProjectionMatrix();
  for (const p of S.parts) { p.mesh.castShadow = true; p.mesh.receiveShadow = true; }
  renderer.toneMappingExposure = st.exposure;
  S.dirty = true;
}
function finishTargets() { const ps = selected(); return ps.length ? ps : S.parts; }
function setFinish(patch, historyLabel) {
  const ps = finishTargets(); if (!ps.length) return;
  if (historyLabel) pushHistory();
  for (const p of ps) { Object.assign(p.finish, patch); if (S.mode === 'render') applyPartFinish(p); }
  refreshRenderPanel();
}
function refreshRenderPanel() {
  const ps = finishTargets(); const f = ps[0] ? ps[0].finish : DEFAULT_FINISH;
  $('finish-target').textContent = !S.parts.length ? '' : selected().length ? (selected().length === 1 ? selected()[0].name : selected().length + ' parts') : 'all parts';
  $$('#finish-presets button').forEach((b) => b.classList.toggle('on', b.dataset.id === f.preset));
  $$('#swatches button').forEach((b) => b.classList.toggle('on', b.dataset.color.toLowerCase() === (f.color || '').toLowerCase()));
  $('finish-color').value = f.color; if (document.activeElement !== $('finish-hex')) $('finish-hex').value = f.color;
  const preset = FINISH_BY_ID[f.preset] || FINISH_BY_ID.standard;
  $('finish-note').textContent = preset.note;
  const tr = Math.round((f.trans ?? preset.trans ?? 0) * 100); $('finish-trans').value = tr; $('finish-trans-v').textContent = tr + '%';
  $('finish-rough').value = Math.round((f.rough ?? 0.5) * 100);
}
function buildRenderPanel() {
  const pre = $('finish-presets'); pre.innerHTML = '';
  for (const f of FINISHES) { const b = document.createElement('button'); b.dataset.id = f.id; b.title = f.note; b.innerHTML = `<i class="chip" style="background:${f.chip}"></i><span>${f.name}</span>`; b.onclick = () => setFinish({ preset: f.id, trans: f.trans ?? 0, ...(f.defaultColor && !selectedHasCustomColor() ? { color: f.defaultColor } : {}) }, 'finish'); pre.appendChild(b); }
  const sw = $('swatches'); sw.innerHTML = '';
  for (const [c, n] of SWATCHES) { const b = document.createElement('button'); b.dataset.color = c; b.title = n; b.style.background = c; b.onclick = () => setFinish({ color: c }, 'colour'); sw.appendChild(b); }
  $('finish-color').addEventListener('input', () => setFinish({ color: $('finish-color').value }));
  $('finish-color').addEventListener('change', () => setFinish({ color: $('finish-color').value }, 'colour'));
  $('finish-hex').addEventListener('change', () => { const v = $('finish-hex').value.trim(); if (/^#[0-9a-f]{6}$/i.test(v)) setFinish({ color: v.toLowerCase() }, 'colour'); else refreshRenderPanel(); });
  $('finish-trans').addEventListener('input', () => { $('finish-trans-v').textContent = $('finish-trans').value + '%'; setFinish({ trans: parseInt($('finish-trans').value) / 100 }); });
  $('finish-rough').addEventListener('input', () => setFinish({ rough: parseInt($('finish-rough').value) / 100 }));
  $('btn-finish-all').onclick = () => { const f = primary() ? primary().finish : null; if (!f) return; pushHistory(); for (const p of S.parts) { p.finish = { ...f }; if (S.mode === 'render') applyPartFinish(p); } status('Finish applied to all parts'); };
  const st = S.studio;
  const relayers = () => { st.layers = { on: $('layers-on').checked, height: parseFloat($('layer-h').value) || 0.2, strength: parseInt($('layer-str').value) / 100 }; if (S.mode === 'render') for (const p of S.parts) applyPartFinish(p); };
  $('layers-on').addEventListener('change', relayers); $('layer-h').addEventListener('change', relayers); $('layer-str').addEventListener('input', relayers);
  $('backdrop').addEventListener('change', () => { st.backdrop = $('backdrop').value; updateStudio(); });
  $('lighting').addEventListener('change', () => { st.lighting = $('lighting').value; updateStudio(); });
  $('exposure').addEventListener('input', () => { st.exposure = parseInt($('exposure').value) / 100; updateStudio(); });
  $('ground-shadow').addEventListener('change', () => { st.groundShadow = $('ground-shadow').checked; updateStudio(); });
  $('show-floor').addEventListener('change', () => { st.floor = $('show-floor').checked; updateStudio(); });
  $('turntable').addEventListener('change', () => { st.turntable = $('turntable').checked; S.dirty = true; });
  $('turntable-speed').addEventListener('input', () => { st.turntableSpeed = parseInt($('turntable-speed').value); });
  $('smooth-on').addEventListener('change', () => { st.smooth = $('smooth-on').checked; if (S.mode === 'render') for (const p of S.parts) p.mesh.geometry = renderGeometry(p); S.dirty = true; });
  $('btn-render-png').onclick = () => exportImage(parseInt($('png-scale').value) || 2, false);
  $('btn-render-clip').onclick = () => exportImage(parseInt($('png-scale').value) || 2, true);
}
function selectedHasCustomColor() { const p = finishTargets()[0]; return p && p.finish.color && p.finish.color !== p.color && !FINISHES.some((f) => f.defaultColor === p.finish.color); }
function syncStudioInputs() {
  const st = S.studio;
  $('layers-on').checked = st.layers.on; $('layer-h').value = String(st.layers.height); $('layer-str').value = Math.round(st.layers.strength * 100);
  $('backdrop').value = st.backdrop; $('lighting').value = st.lighting; $('exposure').value = Math.round(st.exposure * 100);
  $('ground-shadow').checked = st.groundShadow; $('show-floor').checked = st.floor; $('turntable').checked = st.turntable; $('turntable-speed').value = st.turntableSpeed; $('smooth-on').checked = st.smooth;
}
async function exportImage(scale, toClipboard) {
  await withBusy('Rendering image…', async () => {
    await new Promise((r) => setTimeout(r, 30));
    const w = canvas.clientWidth || 1, h = canvas.clientHeight || 1, dpr = renderer.getPixelRatio();
    const W = Math.min(8192, Math.round(w * scale)), H = Math.min(8192, Math.round(h * scale));
    renderer.setPixelRatio(1); renderer.setSize(W, H, false); renderer.setScissorTest(false); renderer.setViewport(0, 0, W, H);
    renderer.render(scene, cam());
    const blob = await new Promise((r) => canvas.toBlob(r, 'image/png'));
    renderer.setPixelRatio(dpr); resize(); S.dirty = true;
    if (!blob) throw new Error('Could not encode the image');
    if (toClipboard) {
      try { await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]); status('Image copied to the clipboard (' + W + '×' + H + ')', 'ok'); return; }
      catch (e) { status('Clipboard blocked here; saved as a file instead', 'bad'); }
    }
    const name = (primary() ? safeName(primary().name) : 'meshbench') + (S.mode === 'render' ? '-render' : '-view') + '.png';
    download(blob, name, 'image/png'); status('Saved ' + name + ' (' + W + '×' + H + ')', 'ok');
  });
}

// ---------------------------------------------------------------- panels
function refreshAll() { refreshParts(); refreshPanels(); refreshOverlays(); applyLens(); setTool(S.tool); if (S.mode === 'render') { for (const p of S.parts) if (p.mesh.material !== p.renderMat) enterRenderPart(p); updateStudio(); refreshRenderPanel(); } }
function refreshOverlays() { if (S.edgeKind) showEdges(S.edgeKind); updateSection(); updateCutPreview(); rebuildMeasureOverlay(); }
function refreshParts() {
  const el = $('parts'); el.innerHTML = '';
  $('parts-count').textContent = S.parts.length ? S.parts.length : '';
  $('empty-hint').classList.toggle('hidden', S.parts.length > 0);
  $('dropzone').classList.toggle('hidden', S.parts.length > 0);
  for (const p of S.parts) {
    const row = document.createElement('div'); row.className = 'part' + (S.sel.includes(p.id) ? ' selected' : '') + (p.visible ? '' : ' hidden-part'); row.dataset.id = p.id;
    const b = worldMetrics(p).bounds;
    row.innerHTML = `<button class="eye" title="${p.visible ? 'Hide' : 'Show'}">${eyeIcon(p.visible)}</button><div><div class="name"></div><div class="meta">${fmtInt(p.pos.length / 9)} tri · ${fmt(b.size[0], 1)} × ${fmt(b.size[1], 1)} × ${fmt(b.size[2], 1)}</div></div><input type="color" value="${p.color}" title="Part colour">`;
    row.querySelector('.name').textContent = p.name;
    row.querySelector('.eye').onclick = (e) => { e.stopPropagation(); pushHistory(); p.visible = !p.visible; p.mesh.visible = p.visible; refreshAll(); };
    const colorInput = row.querySelector('input[type=color]');
    colorInput.addEventListener('input', (e) => { p.color = e.target.value; if (p.mesh.userData.benchMat) p.mesh.userData.benchMat.color.set(p.color); if (p.finish.color === undefined) p.finish.color = p.color; applyLens(); });
    colorInput.addEventListener('click', (e) => e.stopPropagation());
    row.addEventListener('click', (e) => { if (e.ctrlKey || e.metaKey || e.shiftKey) toggleSelect(p.id); else select([p.id]); });
    row.addEventListener('dblclick', () => { select([p.id]); renameSelected(); });
    el.appendChild(row);
  }
  let tris = 0; for (const p of S.parts) tris += p.pos.length / 9;
  $('status-totals').textContent = S.parts.length ? `${S.parts.length} part${S.parts.length > 1 ? 's' : ''} · ${fmtInt(tris)} triangles` : '';
}
function eyeIcon(on) { return on ? '<svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.4"><path d="M1 8s2.5-4.5 7-4.5S15 8 15 8s-2.5 4.5-7 4.5S1 8 1 8z"/><circle cx="8" cy="8" r="2"/></svg>' : '<svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.4"><path d="M1 8s2.5-4.5 7-4.5S15 8 15 8s-2.5 4.5-7 4.5S1 8 1 8z" opacity=".4"/><path d="M2 14L14 2"/></svg>'; }

function refreshPanels() {
  const ps = selected(), p = ps[0] || null;
  $$('.disabled-when-empty').forEach((el) => el.classList.toggle('off', !p));
  $('insp-name').textContent = p ? (ps.length > 1 ? ps.length + ' parts selected' : p.name) : 'No selection';
  const kv = $('insp-kv'); kv.innerHTML = '';
  if (p) {
    let tris = 0, area = 0, vol = 0; const bb = new THREE.Box3();
    for (const q of ps) { const m = worldMetrics(q); tris += m.triangles; area += m.area; vol += m.volume; bb.expandByPoint(new THREE.Vector3(...m.bounds.min)); bb.expandByPoint(new THREE.Vector3(...m.bounds.max)); }
    const sz = bb.getSize(new THREE.Vector3());
    const rows = [['Size (X × Y × Z)', `${fmt(sz.x)} × ${fmt(sz.y)} × ${fmt(sz.z)} mm`], ['Triangles', fmtInt(tris)], ['Surface area', fmt(area / 100) + ' cm²'], ['Volume', fmt(vol / 1000) + ' cm³' + (vol < 0 ? ' (inverted normals)' : '')]];
    if (ps.length === 1) { const info = topoInfo(p); rows.push(['Shells', info ? String(info.summary.shells) : '…']); rows.push(['Min corner', `${fmt(bb.min.x, 1)}, ${fmt(bb.min.y, 1)}, ${fmt(bb.min.z, 1)}`]); }
    for (const [k, v] of rows) kv.insertAdjacentHTML('beforeend', `<span class="k">${k}</span><span class="v">${v}</span>`);
    $('dims').textContent = `${fmt(sz.x, 1)} × ${fmt(sz.y, 1)} × ${fmt(sz.z, 1)} mm`; $('dims').classList.remove('hidden');
    $('status-sel').textContent = ps.length === 1 ? p.name : ps.length + ' selected';
  } else { $('dims').classList.add('hidden'); $('status-sel').textContent = ''; }
  const cl = $('check-list'); cl.innerHTML = ''; $('insp-badge').innerHTML = '';
  if (p && ps.length === 1) {
    const info = topoInfo(p);
    if (!info) { cl.innerHTML = '<span class="n muted">Checking mesh…</span><span></span><span></span>'; $('btn-clean').disabled = $('btn-fill').disabled = $('btn-unify').disabled = $('btn-split').disabled = true; $('shell-count-hint').textContent = ''; }
    else {
      const s = info.summary;
      const items = [['Boundary edges (holes)', s.boundary, 'boundary'], ['Non-manifold edges', s.nonManifold, 'nonmanifold'], ['Inconsistent winding', s.winding, 'winding'], ['Degenerate triangles', s.degenerate, null], ['Duplicate triangles', s.duplicate, null]];
      for (const [n, c, kind] of items) cl.insertAdjacentHTML('beforeend', `<span class="n">${n}</span><span class="c ${c ? 'bad' : ''}">${fmtInt(c)}</span>${kind && c ? `<button data-edge="${kind}" class="${S.edgeKind === kind ? 'on' : ''}">Show</button>` : '<span></span>'}`);
      $$('#check-list button').forEach((b) => b.onclick = () => showEdges(S.edgeKind === b.dataset.edge ? null : b.dataset.edge));
      const inverted = worldMetrics(p).volume < 0;
      $('insp-badge').innerHTML = s.watertight && !inverted ? '<span class="badge ok">Closed and consistent</span>' : s.watertight && inverted ? '<span class="badge warn">Closed but inside out</span>' : '<span class="badge bad">Needs repair</span>';
      $('btn-clean').disabled = !(s.degenerate || s.duplicate); $('btn-fill').disabled = !s.boundary; $('btn-unify').disabled = !(s.winding || inverted);
      $('shell-count-hint').textContent = s.shells > 1 ? '(' + s.shells + ')' : ''; $('btn-split').disabled = s.shells < 2;
    }
  } else { cl.innerHTML = `<span class="n muted">${p ? 'Select a single part to check it' : 'Select a part'}</span><span></span><span></span>`; $('btn-clean').disabled = $('btn-fill').disabled = $('btn-unify').disabled = $('btn-split').disabled = true; $('shell-count-hint').textContent = ''; }
  $('btn-merge').disabled = ps.length < 2;
  if (p) {
    $('xform-target').textContent = ps.length > 1 ? 'first of ' + ps.length : '';
    const b = worldMetrics(p).bounds; const e = new THREE.Euler().setFromQuaternion(p.mesh.quaternion, 'XYZ');
    const vals = { p0: p.mesh.position.x, p1: p.mesh.position.y, p2: p.mesh.position.z, r0: e.x * 180 / Math.PI, r1: e.y * 180 / Math.PI, r2: e.z * 180 / Math.PI, s0: b.size[0], s1: b.size[1], s2: b.size[2] };
    $$('#xform-sec input[data-x]').forEach((i) => { if (document.activeElement !== i) i.value = fmt(vals[i.dataset.x], i.dataset.x[0] === 'r' ? 1 : 2); });
    if (document.activeElement !== $('scale-pct')) $('scale-pct').value = fmt(p.mesh.scale.x * 100, 1);
    const ax = S.cut.axis; const lo = b.min[ax], hi = b.max[ax];
    const sl = $('cut-slider'); sl.min = lo; sl.max = hi; sl.step = (hi - lo) / 1000 || 0.1;
    if (S.cut.pos < lo || S.cut.pos > hi || !isFinite(S.cut.pos)) S.cut.pos = (lo + hi) / 2;
    sl.value = S.cut.pos; if (document.activeElement !== $('cut-pos')) $('cut-pos').value = fmt(S.cut.pos, 2);
    const sa = S.section.axis; const s2 = $('sec-slider'); s2.min = b.min[sa]; s2.max = b.max[sa]; s2.step = (b.max[sa] - b.min[sa]) / 1000 || 0.1;
    if (!isFinite(S.section.pos) || S.section.pos < b.min[sa] - 1e-6 || S.section.pos > b.max[sa] + 1e-6) S.section.pos = (b.min[sa] + b.max[sa]) / 2;
    s2.value = S.section.pos; if (document.activeElement !== $('sec-pos')) $('sec-pos').value = fmt(S.section.pos, 2);
  }
  refreshPrint(); renderOrientList(); refreshRenderPanel();
}
function refreshCheckButtons() { $$('#check-list button').forEach((b) => b.classList.toggle('on', b.dataset.edge === S.edgeKind)); }
function refreshPrint() {
  const fr = $('fit-report'); fr.innerHTML = '';
  const [W, D, H] = S.bed;
  const vis = S.parts.filter((p) => p.visible);
  if (!vis.length) fr.innerHTML = '<span class="k muted">No visible parts</span><span></span>';
  else {
    let allOk = true;
    for (const p of vis) {
      const b = worldMetrics(p).bounds; const s = b.size;
      const fitsSize = s[0] <= W + 1e-6 && s[1] <= D + 1e-6 && s[2] <= H + 1e-6;
      const fitsSizeRot = fitsSize || (s[1] <= W && s[0] <= D && s[2] <= H);
      const onBed = b.min[0] >= -1e-6 && b.min[1] >= -1e-6 && b.max[0] <= W + 1e-6 && b.max[1] <= D + 1e-6 && b.min[2] >= -0.01 && b.max[2] <= H + 1e-6;
      let v, cls;
      if (onBed) { v = 'Fits'; cls = 'ok'; } else if (fitsSizeRot) { v = fitsSize ? 'Fits if moved' : 'Fits if rotated 90°'; cls = 'warn'; allOk = false; } else { v = 'Too big'; cls = 'bad'; allOk = false; }
      if (b.min[2] < -0.01) { v += ' · below bed'; cls = cls === 'ok' ? 'warn' : cls; }
      fr.insertAdjacentHTML('beforeend', `<span class="k">${escapeText(p.name)}</span><span class="v ${cls}">${v}</span>`);
    }
    const sz = sceneBounds().getSize(new THREE.Vector3());
    fr.insertAdjacentHTML('beforeend', `<span class="k">All parts together</span><span class="v ${allOk ? 'ok' : 'warn'}">${fmt(sz.x, 1)} × ${fmt(sz.y, 1)} × ${fmt(sz.z, 1)} of ${W} × ${D} × ${H}</span>`);
  }
  const mk = $('material-kv'); mk.innerHTML = '';
  const ps = selected(); if (!ps.length) return;
  const density = parseFloat($('material').value), infill = (parseFloat($('infill').value) || 0) / 100, wall = parseFloat($('wall').value) || 0, price = parseFloat($('price').value) || 0;
  let vol = 0, area = 0; for (const p of ps) { const m = worldMetrics(p); vol += Math.abs(m.volume); area += m.area; }
  const shell = Math.min(vol, area * wall); const printed = shell + (vol - shell) * infill;
  const gSolid = vol / 1000 * density, gInfill = printed / 1000 * density;
  const lenM = (v) => (v / 1000) / (Math.PI * 0.0875 * 0.0875) / 100;
  const rows = [['Volume', fmt(vol / 1000) + ' cm³'], ['Mass if solid', fmt(gSolid, 1) + ' g'], [`Mass at ${Math.round(infill * 100)}% infill`, fmt(gInfill, 1) + ' g'], ['Filament (1.75 mm)', fmt(lenM(printed), 2) + ' m'], ['Material cost', fmt(gInfill / 1000 * price, 2)]];
  const oh = ps.length === 1 && S.lens === 'overhang' && ps[0].cache.overhang ? G.overhangArea(worldPos(ps[0]), ps[0].cache.overhang) : null;
  if (oh) rows.push(['Overhang surface', fmt(oh.overhang / 100, 1) + ' cm²']);
  for (const [k, v] of rows) mk.insertAdjacentHTML('beforeend', `<span class="k">${k}</span><span class="v">${v}</span>`);
}

// ---------------------------------------------------------------- numeric transform inputs
$$('#xform-sec input[data-x]').forEach((inp) => inp.addEventListener('change', () => {
  const p = primary(); if (!p) return; const k = inp.dataset.x, v = parseFloat(inp.value); if (!isFinite(v)) return;
  pushHistory();
  if (k[0] === 'p') p.mesh.position.setComponent(+k[1], v);
  else if (k[0] === 'r') { const e = new THREE.Euler().setFromQuaternion(p.mesh.quaternion, 'XYZ'); const a = [e.x, e.y, e.z]; a[+k[1]] = v * Math.PI / 180; p.mesh.quaternion.setFromEuler(new THREE.Euler(a[0], a[1], a[2], 'XYZ')); }
  else if (k[0] === 's') {
    const axis = +k[1]; const b = worldMetrics(p).bounds; const cur = b.size[axis]; if (cur <= 0 || v <= 0) return;
    const f = v / cur; const lock = $('lock-ratio').checked;
    const isAxisAligned = Math.abs(Math.abs(p.mesh.quaternion.w) - 1) < 1e-6;
    if (lock || !isAxisAligned) p.mesh.scale.multiplyScalar(f); else p.mesh.scale.setComponent(axis, p.mesh.scale.getComponent(axis) * f);
    if (!lock && !isAxisAligned) status('Part is rotated, so it was scaled uniformly');
    invalidate(p); const nb = worldMetrics(p).bounds; p.mesh.position.x += b.center[0] - nb.center[0]; p.mesh.position.y += b.center[1] - nb.center[1]; p.mesh.position.z += b.min[2] - nb.min[2];
  }
  invalidate(p); refreshAll();
}));
$('scale-pct').addEventListener('change', () => { const p = primary(); if (!p) return; const v = parseFloat($('scale-pct').value) / 100; if (!(v > 0)) return; pushHistory(); const b = worldMetrics(p).bounds; p.mesh.scale.setScalar(v); invalidate(p); const nb = worldMetrics(p).bounds; p.mesh.position.x += b.center[0] - nb.center[0]; p.mesh.position.y += b.center[1] - nb.center[1]; p.mesh.position.z += b.min[2] - nb.min[2]; invalidate(p); refreshAll(); });

// ---------------------------------------------------------------- export / project
function exportSelectedSTL() { const ps = selected(); if (!ps.length) { status('Select a part first', 'bad'); return; } ps.forEach((p, i) => setTimeout(() => download(G.writeSTL(worldPos(p), p.name), safeName(p.name) + '.stl', 'model/stl'), i * 250)); status('Exporting ' + ps.length + ' STL file' + (ps.length > 1 ? 's' : '')); }
function exportMergedSTL() { const ps = S.parts.filter((p) => p.visible); if (!ps.length) { status('No visible parts', 'bad'); return; } download(G.writeSTL(G.concat(ps.map(worldPos)), 'assembly'), 'meshbench-all.stl', 'model/stl'); status('Exported merged STL (' + ps.length + ' parts, not boolean-unioned)'); }
function export3MF() { const ps = S.parts.filter((p) => p.visible); if (!ps.length) { status('No visible parts', 'bad'); return; } withBusy('Writing 3MF…', async () => { const bytes = await work('write3mf', { parts: ps.map((p) => ({ name: p.name, positions: worldPos(p) })) }); download(bytes, 'meshbench.3mf', 'model/3mf'); status('Exported 3MF with ' + ps.length + ' object' + (ps.length > 1 ? 's' : '')); }); }
function exportSVG() { const p = primary(); if (!p) { status('Select a part first', 'bad'); return; } const def = S.section.on ? planeDef({ axis: S.section.axis, pos: S.section.pos, tilt: 0 }) : planeDef(S.cut); withBusy('Tracing section…', async () => { const r = await work('section', { pos: worldPos(p), n: def.n, d: def.d }); if (!r.svg) { status('The plane does not cross the part', 'bad'); return; } download(r.svg, safeName(p.name) + '-section.svg', 'image/svg+xml'); status('Exported section outline (' + r.loops + ' loops' + (r.open ? ', ' + r.open + ' open' : '') + ')'); }); }
function exportReport() {
  const ps = selected().length ? selected() : S.parts; if (!ps.length) return;
  const lines = ['Meshbench report — ' + new Date().toISOString(), 'Bed ' + S.bed.join(' × ') + ' mm', ''];
  for (const p of ps) { const m = worldMetrics(p), b = m.bounds, info = topoInfo(p); const s = info ? info.summary : null; lines.push(p.name, `  size ${fmt(b.size[0])} × ${fmt(b.size[1])} × ${fmt(b.size[2])} mm  position ${fmt(b.min[0], 1)}, ${fmt(b.min[1], 1)}, ${fmt(b.min[2], 1)}`, `  triangles ${m.triangles}  area ${fmt(m.area / 100)} cm²  volume ${fmt(m.volume / 1000)} cm³` + (s ? `  shells ${s.shells}` : ''), s ? `  boundary edges ${s.boundary}  non-manifold ${s.nonManifold}  winding ${s.winding}  degenerate ${s.degenerate}  duplicate ${s.duplicate}` : '  (mesh check still running)', s ? `  ${s.watertight ? 'closed and consistent' : 'needs repair'}` : '', `  finish ${p.finish.preset} ${p.finish.color}`, ''); }
  download(lines.join('\n'), 'meshbench-report.txt', 'text/plain'); status('Report exported');
}
function saveProject() {
  const proj = { app: 'meshbench', version: 2, bed: S.bed, studio: S.studio, parts: S.parts.map((p) => ({ name: p.name, color: p.color, visible: p.visible, matrix: p.mesh.matrix.toArray(), finish: p.finish, stl: b64(new Uint8Array(G.writeSTL(p.pos, p.name))) })) };
  download(JSON.stringify(proj), 'meshbench-project.mbench.json', 'application/json'); status('Project saved');
}
async function openProject(file) {
  const proj = JSON.parse(await file.text());
  if (proj.app !== 'meshbench' || !Array.isArray(proj.parts)) throw new Error('not a Meshbench project');
  if (Array.isArray(proj.bed) && proj.bed.length === 3) { S.bed = proj.bed.map(Number); $('bed-w').value = S.bed[0]; $('bed-d').value = S.bed[1]; $('bed-h').value = S.bed[2]; $('bed-preset').value = 'custom'; buildBed(); }
  if (proj.studio && typeof proj.studio === 'object') { S.studio = { ...S.studio, ...proj.studio, layers: { ...S.studio.layers, ...(proj.studio.layers || {}) } }; syncStudioInputs(); }
  const added = [];
  for (const r of proj.parts) {
    const pos = G.parseSTL(unb64(r.stl).buffer).positions; if (!G.allFinite(pos) || !pos.length) continue;
    const finish = r.finish && typeof r.finish === 'object' ? { ...DEFAULT_FINISH, ...r.finish } : undefined;
    added.push(addPart(pos, String(r.name || 'Part'), { color: /^#[0-9a-f]{6}$/i.test(r.color) ? r.color : undefined, visible: r.visible !== false, matrix: Array.isArray(r.matrix) && r.matrix.length === 16 ? r.matrix.map(Number) : undefined, finish }));
  }
  S.sel = added.map((p) => p.id); refreshAll(); fitView(); status('Opened project with ' + added.length + ' parts');
}
function b64(bytes) { let s = ''; for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000)); return btoa(s); }
function unb64(s) { const bin = atob(s); const out = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i); return out; }
function addSample(kind) {
  const pos = kind === 'knob' ? G.sampleKnob() : kind === 'bracket' ? G.sampleBracket() : G.sampleBox(20, 20, 20);
  const name = kind === 'knob' ? 'Sample knob' : kind === 'bracket' ? 'Sample bracket' : 'Calibration cube';
  pushHistory(); const p = addPart(pos, name); p.mesh.position.set(S.bed[0] / 2, S.bed[1] / 2, 0); S.sel = [p.id]; refreshAll(); fitView(); status('Added ' + name);
}

// ---------------------------------------------------------------- wiring
$('btn-open').onclick = () => $('file-input').click();
$('dropzone').onclick = () => $('file-input').click();
$('btn-openproj').onclick = $('exp-openproj').onclick = () => $('file-input').click();
$('file-input').addEventListener('change', (e) => { importFiles(Array.from(e.target.files)); e.target.value = ''; });
let dragDepth = 0;
window.addEventListener('dragenter', (e) => { e.preventDefault(); dragDepth++; document.body.classList.add('dragging'); });
window.addEventListener('dragleave', (e) => { e.preventDefault(); if (--dragDepth <= 0) { dragDepth = 0; document.body.classList.remove('dragging'); } });
window.addEventListener('dragover', (e) => e.preventDefault());
window.addEventListener('drop', (e) => { e.preventDefault(); dragDepth = 0; document.body.classList.remove('dragging'); if (e.dataTransfer && e.dataTransfer.files.length) importFiles(Array.from(e.dataTransfer.files)); });
$('sample-select').addEventListener('change', () => { const v = $('sample-select').value; if (v) addSample(v); $('sample-select').value = ''; });
$('btn-undo').onclick = undo; $('btn-redo').onclick = redo;
$('btn-save').onclick = saveProject; $('exp-proj').onclick = saveProject;
$('btn-help').onclick = () => $('shortcuts').classList.remove('hidden'); $('btn-help-close').onclick = () => $('shortcuts').classList.add('hidden'); $('shortcuts').addEventListener('click', (e) => { if (e.target === $('shortcuts')) $('shortcuts').classList.add('hidden'); });
function setPresenting(on) { S.presenting = on; document.body.classList.toggle('presenting', on); $('btn-present').classList.toggle('on', on); resize(); S.dirty = true; }
$('btn-present').onclick = () => setPresenting(!S.presenting);
$('btn-showall').onclick = () => { if (S.parts.some((p) => !p.visible)) { pushHistory(); for (const p of S.parts) { p.visible = true; p.mesh.visible = true; } refreshAll(); } };
$('btn-dup').onclick = duplicateSelected; $('btn-del').onclick = deleteSelected; $('btn-rename').onclick = renameSelected;
$$('#tools button').forEach((b) => b.onclick = () => setTool(b.dataset.tool));
$$('#views button[data-view]').forEach((b) => b.onclick = () => setView(b.dataset.view));
$('btn-fit').onclick = () => fitView(); $('btn-ortho').onclick = () => setOrtho(!S.ortho);
$('btn-bed').onclick = () => { S.showBed = !S.showBed; bedGroup.visible = S.showBed && S.mode === 'bench'; $('btn-bed').classList.toggle('on', S.showBed); S.dirty = true; };
$$('#tabs button').forEach((b) => b.onclick = () => { $$('#tabs button').forEach((x) => x.classList.toggle('on', x === b)); $$('.tab').forEach((t) => t.classList.toggle('on', t.id === 'tab-' + b.dataset.tab)); if (b.dataset.tab === 'render') enterRender(); else exitRender(); updateCutPreview(); });
$$('#lens button').forEach((b) => b.onclick = () => { S.lens = b.dataset.lens; if (S.lens === 'thickness' && primary() && !(primary().cache.thickness && primary().cache.thickness.key === thicknessKey(primary()))) runThickness(); else applyLens(); refreshPrint(); });
$('overhang-angle').addEventListener('change', () => { applyLens(); refreshPrint(); });
$('thick-limit').addEventListener('change', () => { if (S.lens === 'thickness') applyLens(); });
$('btn-thick').onclick = runThickness;
$('btn-clean').onclick = cleanBad; $('btn-fill').onclick = fillHoles; $('btn-unify').onclick = unifyNormals; $('btn-split').onclick = splitShells; $('btn-merge').onclick = mergeSelected;
$('sec-on').addEventListener('change', () => { S.section.on = $('sec-on').checked; updateSection(); });
$('sec-axis').addEventListener('change', () => { S.section.axis = +$('sec-axis').value; S.section.pos = NaN; refreshPanels(); updateSection(); });
$('sec-slider').addEventListener('input', () => { S.section.pos = +$('sec-slider').value; $('sec-pos').value = fmt(S.section.pos); if (!S.section.on) { S.section.on = true; $('sec-on').checked = true; } updateSection(); });
$('sec-pos').addEventListener('change', () => { S.section.pos = +$('sec-pos').value; $('sec-slider').value = S.section.pos; updateSection(); });
$('btn-sec-svg').onclick = exportSVG; $('exp-svg').onclick = exportSVG;
$('btn-measure-clear').onclick = () => { S.measurements = []; S.measurePending = null; rebuildMeasureOverlay(); renderMeasureList(); };
$('btn-drop').onclick = () => forSelected(dropToBed, 'Dropped to bed'); $('btn-center').onclick = () => forSelected(centerOnBed, 'Centered on bed');
$('btn-reset').onclick = () => forSelected((p) => { p.mesh.position.set(0, 0, 0); p.mesh.quaternion.identity(); p.mesh.scale.setScalar(1); invalidate(p); dropToBed(p); centerOnBed(p); }, 'Transform reset');
$('btn-rot-x').onclick = () => rotate90(0); $('btn-rot-y').onclick = () => rotate90(1); $('btn-rot-z').onclick = () => rotate90(2);
$('btn-mirror-x').onclick = () => mirror(0); $('btn-mirror-y').onclick = () => mirror(1); $('btn-mirror-z').onclick = () => mirror(2);
$('btn-inch').onclick = inchesToMm; $('btn-flip').onclick = flipNormals; $('btn-bake').onclick = bake;
$('snap-on').addEventListener('change', () => { S.snap = $('snap-on').checked; setTool(S.tool); });
$('btn-mate-clear').onclick = () => { clearMate(); if (S.tool === 'mate') hint('Click a flat face on the part that stays put'); };
$('cut-axis').addEventListener('change', () => { S.cut.axis = +$('cut-axis').value; S.cut.pos = NaN; refreshPanels(); updateCutPreview(); });
$('cut-slider').addEventListener('input', () => { S.cut.pos = +$('cut-slider').value; $('cut-pos').value = fmt(S.cut.pos); updateCutPreview(); });
$('cut-pos').addEventListener('change', () => { S.cut.pos = +$('cut-pos').value; $('cut-slider').value = S.cut.pos; updateCutPreview(); });
$('cut-tilt').addEventListener('change', () => { S.cut.tilt = +$('cut-tilt').value || 0; updateCutPreview(); });
$('cut-preview').addEventListener('change', updateCutPreview);
$('pin-on').addEventListener('change', () => $('pin-opts').classList.toggle('hidden', !$('pin-on').checked));
$('btn-cut').onclick = cutPart;
$('bed-preset').addEventListener('change', () => { const v = $('bed-preset').value; if (v !== 'custom') { const a = v.split(',').map(Number); $('bed-w').value = a[0]; $('bed-d').value = a[1]; $('bed-h').value = a[2]; applyBed(); } });
for (const id of ['bed-w', 'bed-d', 'bed-h']) $(id).addEventListener('change', () => { $('bed-preset').value = 'custom'; applyBed(); });
function applyBed() { S.bed = [$('bed-w'), $('bed-d'), $('bed-h')].map((i) => Math.max(10, parseFloat(i.value) || 10)); buildBed(); refreshPrint(); }
$('btn-arrange').onclick = arrange; $('btn-dropall').onclick = dropAll; $('btn-orient').onclick = rankOrientations;
for (const id of ['material', 'infill', 'wall', 'price']) $(id).addEventListener('change', refreshPrint);
$('exp-stl-sel').onclick = exportSelectedSTL; $('exp-stl-merged').onclick = exportMergedSTL; $('exp-3mf').onclick = export3MF; $('exp-png').onclick = () => exportImage(1, false); $('exp-report').onclick = exportReport;

let lastNudge = 0;
function nudge(dx, dy, dz) {
  const ps = selected(); if (!ps.length) return;
  const now = performance.now(); if (now - lastNudge > 800) pushHistory(); lastNudge = now;
  for (const p of ps) { p.mesh.position.x += dx; p.mesh.position.y += dy; p.mesh.position.z += dz; invalidate(p); }
  S.dirty = true; scheduleUI();
}
window.addEventListener('keydown', (e) => {
  const tag = (e.target.tagName || '').toLowerCase(); if (tag === 'input' || tag === 'select' || tag === 'textarea') return;
  const k = e.key.toLowerCase(); const mod = e.ctrlKey || e.metaKey;
  if (mod && k === 'z') { e.preventDefault(); e.shiftKey ? redo() : undo(); return; }
  if (mod && k === 'y') { e.preventDefault(); redo(); return; }
  if (mod && k === 's') { e.preventDefault(); saveProject(); return; }
  if (mod && k === 'd') { e.preventDefault(); duplicateSelected(); return; }
  if (mod && k === 'a') { e.preventDefault(); select(S.parts.map((p) => p.id)); return; }
  if (mod) return;
  const step = e.shiftKey ? 1 : 0.2;
  const map = {
    q: () => setTool('select'), g: () => setTool('move'), r: () => setTool('rotate'), s: () => setTool('scale'), l: () => setTool('lay'), t: () => setTool('mate'), m: () => setTool('measure'),
    f: () => fitView(), p: () => setOrtho(!S.ortho), 1: () => setView('iso'), 2: () => setView('top'), 3: () => setView('front'), 4: () => setView('right'),
    b: () => forSelected(dropToBed, 'Dropped to bed'), c: () => forSelected(centerOnBed, 'Centered on bed'),
    x: () => { $('sec-on').checked = !$('sec-on').checked; S.section.on = $('sec-on').checked; updateSection(); },
    h: () => { const ps = selected(); if (!ps.length) return; pushHistory(); for (const p of ps) { p.visible = !p.visible; p.mesh.visible = p.visible; } refreshAll(); },
    o: () => $('file-input').click(), tab: () => setPresenting(!S.presenting), delete: deleteSelected, backspace: deleteSelected, f2: renameSelected,
    arrowleft: () => nudge(-step, 0, 0), arrowright: () => nudge(step, 0, 0), arrowup: () => nudge(0, step, 0), arrowdown: () => nudge(0, -step, 0), pageup: () => nudge(0, 0, step), pagedown: () => nudge(0, 0, -step),
    escape: () => { if (!$('shortcuts').classList.contains('hidden')) $('shortcuts').classList.add('hidden'); else if (S.presenting) setPresenting(false); else if (S.tool !== 'select') setTool('select'); else select([]); },
    '?': () => $('shortcuts').classList.toggle('hidden'),
  };
  if (map[k]) { e.preventDefault(); map[k](); }
});

// ---------------------------------------------------------------- boot
buildRenderPanel(); syncStudioInputs();
buildBed(); resize(); refreshAll(); renderMeasureList(); updateHistoryButtons();
setView('iso');
window.meshbench = { S, G, addSample, importFiles, enterRender, exitRender, setFinish, exportImage, work, select, refreshAll, topoInfo, invalidate, fitView, setView, THREE, camera: cam, version: VERSION };
