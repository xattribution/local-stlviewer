/**
 * Meshbench geometry core.
 *
 * Pure functions, no DOM and no three.js. Runs identically in the browser main
 * thread, in a Web Worker and under Node for tests.
 *
 * Convention: a mesh is a flat Float32Array of triangle soup, 9 floats per
 * triangle (three xyz vertices), in millimetres. Z is up (printer convention).
 * The functions that need a polygon triangulator (caps, hole filling) take an
 * `earcut(flat2d, holeIndices, 2)` function as an argument so this module stays
 * dependency free.
 */

// ---------- small vector helpers ----------
const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const mul = (a, s) => [a[0] * s, a[1] * s, a[2] * s];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const len = (a) => Math.hypot(a[0], a[1], a[2]);
const norm = (a) => { const l = len(a) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };
export const vec = { sub, add, mul, dot, cross, len, norm };

const textDecoder = new TextDecoder();

// ============================================================ parsing

/** Parse binary or ASCII STL. Returns { positions, name }. */
export function parseSTL(buffer) {
  if (!(buffer instanceof ArrayBuffer)) buffer = buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength);
  const bytes = new Uint8Array(buffer);
  const view = new DataView(buffer);
  const declared = buffer.byteLength >= 84 ? view.getUint32(80, true) : -1;
  const binarySizeMatches = declared >= 0 && buffer.byteLength === 84 + declared * 50;
  if (!binarySizeMatches) {
    const head = textDecoder.decode(bytes.subarray(0, Math.min(4096, bytes.length)));
    if (/^\s*solid\b/i.test(head) && /\bfacet\b|\bvertex\b|\bendsolid\b/i.test(head)) {
      return parseAsciiSTL(textDecoder.decode(bytes));
    }
  }
  if (buffer.byteLength < 84) throw new Error('STL file is too small to contain geometry.');
  let n = declared;
  if (84 + n * 50 > buffer.byteLength) {
    // Truncated file: salvage what is there rather than refusing outright.
    n = Math.floor((buffer.byteLength - 84) / 50);
  }
  const pos = new Float32Array(n * 9);
  let o = 84;
  for (let i = 0; i < n; i++) {
    o += 12; // skip facet normal; recomputed from winding
    for (let k = 0; k < 9; k++) { pos[i * 9 + k] = view.getFloat32(o, true); o += 4; }
    o += 2; // attribute byte count
  }
  const name = textDecoder.decode(bytes.subarray(0, 80)).replace(/\0.*$/s, '').trim();
  return { positions: pos, name: /^(solid|binary|stl|color)/i.test(name) ? '' : name.slice(0, 60), truncated: n !== declared };
}

export function parseAsciiSTL(text) {
  const out = [];
  const re = /vertex\s+([-+\d.eE]+)\s+([-+\d.eE]+)\s+([-+\d.eE]+)/g;
  let m;
  while ((m = re.exec(text))) out.push(+m[1], +m[2], +m[3]);
  const tri = Math.floor(out.length / 9);
  const nameM = /^\s*solid\s+([^\r\n]*)/.exec(text);
  return { positions: new Float32Array(out.slice(0, tri * 9)), name: nameM ? nameM[1].trim() : '' };
}

/** Parse Wavefront OBJ (positions + faces; fans polygons; supports negative indices). */
export function parseOBJ(text) {
  const v = [];
  const out = [];
  let name = '';
  const lines = text.split(/\r?\n/);
  for (const raw of lines) {
    const line = raw.trim();
    if (line.startsWith('v ')) {
      const p = line.split(/\s+/);
      v.push([+p[1], +p[2], +p[3]]);
    } else if (line.startsWith('f ')) {
      const idx = line.split(/\s+/).slice(1).map((t) => { const i = parseInt(t.split('/')[0], 10); return i < 0 ? v.length + i : i - 1; });
      for (let i = 1; i + 1 < idx.length; i++) {
        const a = v[idx[0]], b = v[idx[i]], c = v[idx[i + 1]];
        if (a && b && c) out.push(a[0], a[1], a[2], b[0], b[1], b[2], c[0], c[1], c[2]);
      }
    } else if (line.startsWith('o ') && !name) name = line.slice(2).trim();
  }
  return { positions: new Float32Array(out), name };
}

/** Minimal ZIP reader (stored + deflate). Returns { [name]: Uint8Array }. */
export async function readZip(buffer) {
  const view = new DataView(buffer), bytes = new Uint8Array(buffer);
  let eocd = -1;
  const stop = Math.max(0, buffer.byteLength - 65557);
  for (let i = buffer.byteLength - 22; i >= stop; i--) {
    if (view.getUint32(i, true) === 0x06054b50) { eocd = i; break; }
  }
  if (eocd < 0) throw new Error('Not a zip container.');
  const count = view.getUint16(eocd + 10, true);
  let off = view.getUint32(eocd + 16, true);
  const files = {};
  for (let i = 0; i < count; i++) {
    if (view.getUint32(off, true) !== 0x02014b50) break;
    const method = view.getUint16(off + 10, true);
    const csize = view.getUint32(off + 20, true);
    const nlen = view.getUint16(off + 28, true), elen = view.getUint16(off + 30, true), clen = view.getUint16(off + 32, true);
    const lho = view.getUint32(off + 42, true);
    const name = textDecoder.decode(bytes.subarray(off + 46, off + 46 + nlen));
    const lnlen = view.getUint16(lho + 26, true), lelen = view.getUint16(lho + 28, true);
    const dataStart = lho + 30 + lnlen + lelen;
    const raw = bytes.subarray(dataStart, dataStart + csize);
    let data;
    if (method === 0) data = raw;
    else if (method === 8) data = await inflateRaw(raw);
    else throw new Error('Unsupported zip compression method ' + method);
    files[name] = data;
    off += 46 + nlen + elen + clen;
  }
  return files;
}

async function inflateRaw(raw) {
  if (typeof DecompressionStream !== 'undefined') {
    const ds = new DecompressionStream('deflate-raw');
    const w = ds.writable.getWriter();
    w.write(raw); w.close();
    return new Uint8Array(await new Response(ds.readable).arrayBuffer());
  }
  // Node fallback (tests)
  const zlib = await import('node:zlib');
  return new Uint8Array(zlib.inflateRawSync(raw));
}

/**
 * Parse a 3MF package. Supports mesh objects, component assemblies (recursive,
 * with transforms), build item transforms and the unit attribute.
 * Returns an array of { positions, name }.
 */
export async function parse3MF(buffer, parseXml) {
  const files = await readZip(buffer);
  const modelName = Object.keys(files).find((n) => /^3D\/.*\.model$/i.test(n)) || Object.keys(files).find((n) => /\.model$/i.test(n));
  if (!modelName) throw new Error('3MF has no 3D model file.');
  const xml = textDecoder.decode(files[modelName]);
  const doc = parseXml ? parseXml(xml) : new DOMParser().parseFromString(xml, 'application/xml');
  const unitScale = { micron: 0.001, millimeter: 1, centimeter: 10, inch: 25.4, foot: 304.8, meter: 1000 }[(doc.documentElement.getAttribute('unit') || 'millimeter').toLowerCase()] || 1;
  const objects = new Map();
  for (const obj of Array.from(doc.getElementsByTagName('object'))) {
    const id = obj.getAttribute('id');
    const name = obj.getAttribute('name') || '';
    const mesh = obj.getElementsByTagName('mesh')[0];
    if (mesh) {
      const vs = [];
      for (const v of Array.from(mesh.getElementsByTagName('vertex'))) vs.push(+v.getAttribute('x') * unitScale, +v.getAttribute('y') * unitScale, +v.getAttribute('z') * unitScale);
      const out = [];
      for (const t of Array.from(mesh.getElementsByTagName('triangle'))) {
        const a = +t.getAttribute('v1') * 3, b = +t.getAttribute('v2') * 3, c = +t.getAttribute('v3') * 3;
        if (a + 2 < vs.length && b + 2 < vs.length && c + 2 < vs.length) out.push(vs[a], vs[a + 1], vs[a + 2], vs[b], vs[b + 1], vs[b + 2], vs[c], vs[c + 1], vs[c + 2]);
      }
      objects.set(id, { kind: 'mesh', positions: new Float32Array(out), name });
    } else {
      const comps = obj.getElementsByTagName('components')[0];
      if (!comps) continue;
      const list = [];
      for (const c of Array.from(comps.getElementsByTagName('component'))) list.push({ id: c.getAttribute('objectid'), transform: parse3MFTransform(c.getAttribute('transform'), unitScale) });
      objects.set(id, { kind: 'components', list, name });
    }
  }
  const resolve = (id, transform, depth, out) => {
    const o = objects.get(id);
    if (!o || depth > 32) return;
    if (o.kind === 'mesh') { out.push({ positions: transform ? transformPositions(o.positions, transform) : o.positions, name: o.name }); return; }
    for (const c of o.list) resolve(c.id, composeAffine(transform, c.transform), depth + 1, out);
  };
  const parts = [];
  for (const it of Array.from(doc.getElementsByTagName('item'))) {
    const sub = [];
    resolve(it.getAttribute('objectid'), parse3MFTransform(it.getAttribute('transform'), unitScale), 0, sub);
    if (sub.length === 1) { sub[0].name = sub[0].name || (objects.get(it.getAttribute('objectid')) || {}).name || ''; parts.push(sub[0]); }
    else if (sub.length > 1) parts.push({ positions: concat(sub.map((s) => s.positions)), name: (objects.get(it.getAttribute('objectid')) || {}).name || '' });
  }
  if (!parts.length) for (const o of objects.values()) if (o.kind === 'mesh' && o.positions.length) parts.push({ positions: o.positions, name: o.name });
  return parts;
}

// 3MF transform attribute: "m00 m01 m02 m10 m11 m12 m20 m21 m22 m30 m31 m32", row vector convention.
function parse3MFTransform(attr, unitScale) {
  if (!attr) return null;
  const m = attr.trim().split(/\s+/).map(Number);
  if (m.length !== 12 || m.some((x) => !isFinite(x))) return null;
  return [m[0], m[3], m[6], m[9] * unitScale, m[1], m[4], m[7], m[10] * unitScale, m[2], m[5], m[8], m[11] * unitScale];
}

/** Compose two 3x4 row-major affines: result = a ∘ b (apply b first, then a). */
export function composeAffine(a, b) {
  if (!a) return b; if (!b) return a;
  const r = new Array(12);
  for (let i = 0; i < 3; i++) {
    for (let j = 0; j < 3; j++) r[i * 4 + j] = a[i * 4] * b[j] + a[i * 4 + 1] * b[4 + j] + a[i * 4 + 2] * b[8 + j];
    r[i * 4 + 3] = a[i * 4] * b[3] + a[i * 4 + 1] * b[7] + a[i * 4 + 2] * b[11] + a[i * 4 + 3];
  }
  return r;
}

/** Apply a 3x4 row-major affine [r00 r01 r02 tx, r10 r11 r12 ty, r20 r21 r22 tz]. Mirroring transforms flip winding. */
export function transformPositions(pos, m) {
  const out = new Float32Array(pos.length);
  for (let i = 0; i < pos.length; i += 3) {
    const x = pos[i], y = pos[i + 1], z = pos[i + 2];
    out[i] = m[0] * x + m[1] * y + m[2] * z + m[3];
    out[i + 1] = m[4] * x + m[5] * y + m[6] * z + m[7];
    out[i + 2] = m[8] * x + m[9] * y + m[10] * z + m[11];
  }
  const det = m[0] * (m[5] * m[10] - m[6] * m[9]) - m[1] * (m[4] * m[10] - m[6] * m[8]) + m[2] * (m[4] * m[9] - m[5] * m[8]);
  return det < 0 ? flipWinding(out) : out;
}

export function flipWinding(pos) {
  const out = new Float32Array(pos.length);
  for (let i = 0; i < pos.length; i += 9) {
    out[i] = pos[i]; out[i + 1] = pos[i + 1]; out[i + 2] = pos[i + 2];
    out[i + 3] = pos[i + 6]; out[i + 4] = pos[i + 7]; out[i + 5] = pos[i + 8];
    out[i + 6] = pos[i + 3]; out[i + 7] = pos[i + 4]; out[i + 8] = pos[i + 5];
  }
  return out;
}

export function scalePositions(pos, s) { const out = new Float32Array(pos.length); for (let i = 0; i < pos.length; i++) out[i] = pos[i] * s; return out; }

export function concat(arrs) {
  let n = 0; for (const a of arrs) n += a.length;
  const out = new Float32Array(n); let o = 0;
  for (const a of arrs) { out.set(a, o); o += a.length; }
  return out;
}

export function allFinite(pos) { for (let i = 0; i < pos.length; i++) if (!Number.isFinite(pos[i])) return false; return true; }

// ============================================================ metrics

export function bounds(pos) {
  let x0 = Infinity, y0 = Infinity, z0 = Infinity, x1 = -Infinity, y1 = -Infinity, z1 = -Infinity;
  for (let i = 0; i < pos.length; i += 3) {
    const x = pos[i], y = pos[i + 1], z = pos[i + 2];
    if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; if (z < z0) z0 = z; if (z > z1) z1 = z;
  }
  if (!isFinite(x0)) return { min: [0, 0, 0], max: [0, 0, 0], size: [0, 0, 0], center: [0, 0, 0] };
  const min = [x0, y0, z0], max = [x1, y1, z1];
  return { min, max, size: sub(max, min), center: mul(add(min, max), 0.5) };
}

/** Triangle count, surface area (mm²), signed volume (mm³, negative = inverted) and bounds. */
export function metrics(pos) {
  let area = 0, vol = 0;
  for (let i = 0; i < pos.length; i += 9) {
    const ax = pos[i], ay = pos[i + 1], az = pos[i + 2], bx = pos[i + 3], by = pos[i + 4], bz = pos[i + 5], cx = pos[i + 6], cy = pos[i + 7], cz = pos[i + 8];
    const ux = bx - ax, uy = by - ay, uz = bz - az, vx = cx - ax, vy = cy - ay, vz = cz - az;
    const nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
    area += Math.sqrt(nx * nx + ny * ny + nz * nz) * 0.5;
    vol += (ax * (by * cz - bz * cy) - ay * (bx * cz - bz * cx) + az * (bx * cy - by * cx)) / 6;
  }
  return { triangles: pos.length / 9, area, volume: vol, bounds: bounds(pos) };
}

export function triNormal(pos, t) {
  const i = t * 9;
  return norm(cross([pos[i + 3] - pos[i], pos[i + 4] - pos[i + 1], pos[i + 5] - pos[i + 2]], [pos[i + 6] - pos[i], pos[i + 7] - pos[i + 1], pos[i + 8] - pos[i + 2]]));
}
export function triArea(pos, t) {
  const i = t * 9;
  return len(cross([pos[i + 3] - pos[i], pos[i + 4] - pos[i + 1], pos[i + 5] - pos[i + 2]], [pos[i + 6] - pos[i], pos[i + 7] - pos[i + 1], pos[i + 8] - pos[i + 2]])) / 2;
}
export function triCentroid(pos, t) {
  const i = t * 9;
  return [(pos[i] + pos[i + 3] + pos[i + 6]) / 3, (pos[i + 1] + pos[i + 4] + pos[i + 7]) / 3, (pos[i + 2] + pos[i + 5] + pos[i + 8]) / 3];
}

// ============================================================ welding + topology

/**
 * Weld coincident vertices within `tol` using a quantised open-addressing hash.
 * Returns { verts: Float32Array, index: Uint32Array } (index has one entry per soup vertex).
 */
export function weld(pos, tol = 1e-4) {
  const q = 1 / tol;
  const nIn = pos.length / 3;
  let cap = 1; while (cap < nIn * 2) cap <<= 1;
  const mask = cap - 1;
  const table = new Int32Array(cap).fill(-1);
  const qx = new Int32Array(nIn), qy = new Int32Array(nIn), qz = new Int32Array(nIn); // quantised coords per unique vertex
  const index = new Uint32Array(nIn);
  const verts = new Float32Array(nIn * 3);
  let nOut = 0;
  for (let i = 0; i < nIn; i++) {
    const x = Math.round(pos[i * 3] * q) | 0, y = Math.round(pos[i * 3 + 1] * q) | 0, z = Math.round(pos[i * 3 + 2] * q) | 0;
    let h = (Math.imul(x, 73856093) ^ Math.imul(y, 19349663) ^ Math.imul(z, 83492791)) & mask;
    for (;;) {
      const id = table[h];
      if (id === -1) {
        table[h] = nOut; qx[nOut] = x; qy[nOut] = y; qz[nOut] = z;
        verts[nOut * 3] = pos[i * 3]; verts[nOut * 3 + 1] = pos[i * 3 + 1]; verts[nOut * 3 + 2] = pos[i * 3 + 2];
        index[i] = nOut++;
        break;
      }
      if (qx[id] === x && qy[id] === y && qz[id] === z) { index[i] = id; break; }
      h = (h + 1) & mask;
    }
  }
  return { verts: verts.slice(0, nOut * 3), index };
}

/**
 * Full mesh topology report. Edge keys are numbers `min * nV + max`.
 * Returns boundary/non-manifold/winding edge lists, degenerate and duplicate flags,
 * shell membership per triangle, and the raw edge map for downstream operations.
 */
export function topology(pos, tol = 1e-4) {
  const { verts, index } = weld(pos, tol);
  const nV = verts.length / 3;
  const nTri = index.length / 3;
  const edgeMap = new Map(); // key -> { f: [tri...], d: [+1|-1...] }
  const degenerate = new Uint8Array(nTri);
  const duplicate = new Uint8Array(nTri);
  const triKeys = new Set();
  for (let t = 0; t < nTri; t++) {
    const a = index[t * 3], b = index[t * 3 + 1], c = index[t * 3 + 2];
    if (a === b || b === c || a === c) { degenerate[t] = 1; continue; }
    const ax = verts[a * 3], ay = verts[a * 3 + 1], az = verts[a * 3 + 2];
    const ux = verts[b * 3] - ax, uy = verts[b * 3 + 1] - ay, uz = verts[b * 3 + 2] - az, vx = verts[c * 3] - ax, vy = verts[c * 3 + 1] - ay, vz = verts[c * 3 + 2] - az;
    const nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
    if (nx * nx + ny * ny + nz * nz < 1e-16) { degenerate[t] = 1; continue; }
    const lo = Math.min(a, b, c), hi = Math.max(a, b, c), mid = a + b + c - lo - hi;
    const tk = lo + ',' + mid + ',' + hi;
    if (triKeys.has(tk)) { duplicate[t] = 1; continue; }
    triKeys.add(tk);
    addEdge(edgeMap, nV, a, b, t); addEdge(edgeMap, nV, b, c, t); addEdge(edgeMap, nV, c, a, t);
  }
  const boundary = [], nonManifold = [], winding = [];
  for (const [key, e] of edgeMap) {
    if (e.f.length === 1) boundary.push(key);
    else if (e.f.length > 2) nonManifold.push(key);
    else if (e.d[0] === e.d[1]) winding.push(key);
  }
  // shells: union-find over triangles sharing an edge
  const parent = new Int32Array(nTri); for (let i = 0; i < nTri; i++) parent[i] = i;
  const find = (x) => { while (parent[x] !== x) { parent[x] = parent[parent[x]]; x = parent[x]; } return x; };
  for (const e of edgeMap.values()) for (let i = 1; i < e.f.length; i++) { const a = find(e.f[0]), b = find(e.f[i]); if (a !== b) parent[a] = b; }
  const shellOf = new Int32Array(nTri); const shellIds = new Map();
  for (let t = 0; t < nTri; t++) {
    if (degenerate[t] || duplicate[t]) { shellOf[t] = -1; continue; }
    const r = find(t); if (!shellIds.has(r)) shellIds.set(r, shellIds.size); shellOf[t] = shellIds.get(r);
  }
  let degenerateCount = 0, duplicateCount = 0;
  for (let t = 0; t < nTri; t++) { degenerateCount += degenerate[t]; duplicateCount += duplicate[t]; }
  return {
    verts, index, nV, nTri, boundary, nonManifold, winding, degenerate, duplicate, shellOf, shellCount: shellIds.size, edgeMap,
    degenerateCount, duplicateCount,
    watertight: boundary.length === 0 && nonManifold.length === 0 && winding.length === 0,
  };
}
function addEdge(edgeMap, nV, p, r, t) {
  const key = p < r ? p * nV + r : r * nV + p;
  let e = edgeMap.get(key);
  if (!e) { e = { f: [], d: [] }; edgeMap.set(key, e); }
  e.f.push(t); e.d.push(p < r ? 1 : -1);
}
export function decodeEdge(key, nV) { const a = Math.floor(key / nV); return [a, key - a * nV]; }

/** Serializable subset of a topology report (for worker transfer / UI). */
export function topologySummary(topo) {
  return {
    nTri: topo.nTri, boundary: topo.boundary.length, nonManifold: topo.nonManifold.length, winding: topo.winding.length,
    degenerate: topo.degenerateCount, duplicate: topo.duplicateCount, shells: topo.shellCount, watertight: topo.watertight,
  };
}

export function splitShells(pos, topo) {
  topo = topo || topology(pos);
  const buckets = new Map();
  for (let t = 0; t < topo.nTri; t++) { const s = topo.shellOf[t]; if (s < 0) continue; if (!buckets.has(s)) buckets.set(s, []); buckets.get(s).push(t); }
  const out = [];
  for (const tris of buckets.values()) {
    const p = new Float32Array(tris.length * 9);
    tris.forEach((t, i) => p.set(pos.subarray(t * 9, t * 9 + 9), i * 9));
    out.push(p);
  }
  out.sort((a, b) => b.length - a.length);
  return out;
}

export function cleanTriangles(pos, topo) {
  topo = topo || topology(pos);
  const keep = [];
  for (let t = 0; t < topo.nTri; t++) if (!topo.degenerate[t] && !topo.duplicate[t]) keep.push(t);
  const p = new Float32Array(keep.length * 9);
  keep.forEach((t, i) => p.set(pos.subarray(t * 9, t * 9 + 9), i * 9));
  return p;
}

/** Edge keys -> line-segment positions (6 floats per edge) for display. */
export function edgeLines(topo, keys) {
  const out = new Float32Array(keys.length * 6);
  keys.forEach((k, i) => {
    const [a, b] = decodeEdge(k, topo.nV);
    out.set(topo.verts.subarray(a * 3, a * 3 + 3), i * 6);
    out.set(topo.verts.subarray(b * 3, b * 3 + 3), i * 6 + 3);
  });
  return out;
}

/**
 * Re-orient triangles so every shell has consistent winding, and flip whole
 * shells whose signed volume is negative (inside-out). Returns new positions
 * and the number of triangles flipped.
 */
export function unifyNormals(pos, topo) {
  topo = topo || topology(pos);
  const { nTri, index, nV, edgeMap } = topo;
  const flipped = new Uint8Array(nTri);
  const visited = new Uint8Array(nTri);
  const out = new Float32Array(pos);
  const neighbors = faceNeighbors(topo);
  const dirOf = (t, a, b) => { // +1 if edge a->b appears in that order in tri t (with current flip state)
    const i = t * 3; const v = [index[i], index[i + 1], index[i + 2]];
    if (flipped[t]) v.reverse();
    for (let k = 0; k < 3; k++) if (v[k] === a && v[(k + 1) % 3] === b) return 1;
    return -1;
  };
  let flips = 0;
  for (let s = 0; s < nTri; s++) {
    if (visited[s] || topo.shellOf[s] < 0) continue;
    const stack = [s]; visited[s] = 1;
    while (stack.length) {
      const t = stack.pop();
      for (const n of neighbors[t]) {
        if (visited[n]) continue;
        // shared edge between t and n
        const ta = [index[t * 3], index[t * 3 + 1], index[t * 3 + 2]], na = [index[n * 3], index[n * 3 + 1], index[n * 3 + 2]];
        const shared = ta.filter((x) => na.includes(x));
        if (shared.length !== 2) continue;
        // consistent orientation: the shared edge must be traversed in opposite directions
        if (dirOf(t, shared[0], shared[1]) === dirOf(n, shared[0], shared[1])) { flipped[n] = 1; flips++; }
        visited[n] = 1; stack.push(n);
      }
    }
  }
  void edgeMap; void nV;
  // per-shell volume sign: flip inverted shells entirely
  const shellVol = new Float64Array(topo.shellCount);
  for (let t = 0; t < nTri; t++) {
    const s = topo.shellOf[t]; if (s < 0) continue;
    const i = t * 9; let a = [pos[i], pos[i + 1], pos[i + 2]], b = [pos[i + 3], pos[i + 4], pos[i + 5]], c = [pos[i + 6], pos[i + 7], pos[i + 8]];
    if (flipped[t]) { const tmp = b; b = c; c = tmp; }
    shellVol[s] += dot(a, cross(b, c)) / 6;
  }
  for (let t = 0; t < nTri; t++) {
    const s = topo.shellOf[t];
    let f = flipped[t];
    if (s >= 0 && shellVol[s] < 0) f = f ? 0 : 1;
    if (f) { const i = t * 9; out[i + 3] = pos[i + 6]; out[i + 4] = pos[i + 7]; out[i + 5] = pos[i + 8]; out[i + 6] = pos[i + 3]; out[i + 7] = pos[i + 4]; out[i + 8] = pos[i + 5]; }
  }
  let changed = 0; for (let t = 0; t < nTri; t++) { const i = t * 9; if (out[i + 3] !== pos[i + 3] || out[i + 4] !== pos[i + 4] || out[i + 5] !== pos[i + 5]) changed++; }
  return { positions: out, flipped: changed };
}

/** Face adjacency (triangles sharing a manifold edge). */
export function faceNeighbors(topo) {
  if (topo._neighbors) return topo._neighbors;
  const nb = Array.from({ length: topo.nTri }, () => []);
  for (const e of topo.edgeMap.values()) {
    if (e.f.length !== 2) continue;
    nb[e.f[0]].push(e.f[1]); nb[e.f[1]].push(e.f[0]);
  }
  topo._neighbors = nb;
  return nb;
}

/**
 * Grow a coplanar region from a seed triangle (used by the mate tool).
 * Returns { faces, normal, centroid (area weighted), area }.
 */
export function growPlanar(pos, topo, seed, dotTol = 0.9995, planeTol = 0.05) {
  const nb = faceNeighbors(topo);
  const n0 = triNormal(pos, seed);
  const c0 = triCentroid(pos, seed);
  const d0 = dot(n0, c0);
  const seen = new Uint8Array(topo.nTri);
  const stack = [seed]; seen[seed] = 1;
  const faces = [];
  let area = 0; let cx = 0, cy = 0, cz = 0;
  while (stack.length) {
    const t = stack.pop();
    faces.push(t);
    const a = triArea(pos, t), c = triCentroid(pos, t);
    area += a; cx += c[0] * a; cy += c[1] * a; cz += c[2] * a;
    for (const m of nb[t]) {
      if (seen[m]) continue;
      const nm = triNormal(pos, m);
      if (dot(n0, nm) < dotTol) continue;
      if (Math.abs(dot(n0, triCentroid(pos, m)) - d0) > planeTol) continue;
      seen[m] = 1; stack.push(m);
    }
  }
  return { faces, normal: n0, centroid: area > 0 ? [cx / area, cy / area, cz / area] : c0, area };
}

// ============================================================ BVH + rays

export function buildBVH(pos) {
  const n = pos.length / 9;
  const cx = new Float32Array(n), cy = new Float32Array(n), cz = new Float32Array(n);
  for (let t = 0; t < n; t++) { const o = t * 9; cx[t] = (pos[o] + pos[o + 3] + pos[o + 6]) / 3; cy[t] = (pos[o + 1] + pos[o + 4] + pos[o + 7]) / 3; cz[t] = (pos[o + 2] + pos[o + 5] + pos[o + 8]) / 3; }
  const order = new Uint32Array(n); for (let i = 0; i < n; i++) order[i] = i;
  const nodes = [];
  const triBounds = (t, min, max) => { const o = t * 9; for (let k = 0; k < 3; k++) { const a = pos[o + k], b = pos[o + 3 + k], c = pos[o + 6 + k]; const lo = Math.min(a, b, c), hi = Math.max(a, b, c); if (lo < min[k]) min[k] = lo; if (hi > max[k]) max[k] = hi; } };
  const stack = [[0, n, -1, 0]]; // start, end, parentIndex, side
  while (stack.length) {
    const [start, end, parent, side] = stack.pop();
    const min = [Infinity, Infinity, Infinity], max = [-Infinity, -Infinity, -Infinity];
    for (let i = start; i < end; i++) triBounds(order[i], min, max);
    const id = nodes.length;
    nodes.push({ min, max, left: -1, right: -1, start, count: end - start });
    if (parent >= 0) { if (side === 0) nodes[parent].left = id; else nodes[parent].right = id; }
    if (end - start <= 6) continue;
    const ext = [max[0] - min[0], max[1] - min[1], max[2] - min[2]];
    const axis = ext[0] > ext[1] ? (ext[0] > ext[2] ? 0 : 2) : (ext[1] > ext[2] ? 1 : 2);
    const c = axis === 0 ? cx : axis === 1 ? cy : cz;
    order.subarray(start, end).sort((a, b) => c[a] - c[b]);
    const mid = (start + end) >> 1;
    nodes[id].count = 0;
    stack.push([mid, end, id, 1], [start, mid, id, 0]);
  }
  return { nodes, order, pos };
}

function rayBox(o, invd, min, max) {
  let tmin = -Infinity, tmax = Infinity;
  for (let k = 0; k < 3; k++) { const t1 = (min[k] - o[k]) * invd[k], t2 = (max[k] - o[k]) * invd[k]; tmin = Math.max(tmin, Math.min(t1, t2)); tmax = Math.min(tmax, Math.max(t1, t2)); }
  return tmax >= Math.max(tmin, 0) ? tmin : Infinity;
}

/** Möller–Trumbore. Returns t along the ray or Infinity. */
export function rayTri(pos, t, o, d) {
  const i = t * 9;
  const ax = pos[i], ay = pos[i + 1], az = pos[i + 2];
  const e1x = pos[i + 3] - ax, e1y = pos[i + 4] - ay, e1z = pos[i + 5] - az, e2x = pos[i + 6] - ax, e2y = pos[i + 7] - ay, e2z = pos[i + 8] - az;
  const px = d[1] * e2z - d[2] * e2y, py = d[2] * e2x - d[0] * e2z, pz = d[0] * e2y - d[1] * e2x;
  const det = e1x * px + e1y * py + e1z * pz;
  if (Math.abs(det) < 1e-12) return Infinity;
  const inv = 1 / det, tx = o[0] - ax, ty = o[1] - ay, tz = o[2] - az;
  const u = (tx * px + ty * py + tz * pz) * inv; if (u < 0 || u > 1) return Infinity;
  const qx = ty * e1z - tz * e1y, qy = tz * e1x - tx * e1z, qz = tx * e1y - ty * e1x;
  const v = (d[0] * qx + d[1] * qy + d[2] * qz) * inv; if (v < 0 || u + v > 1) return Infinity;
  const tt = (e2x * qx + e2y * qy + e2z * qz) * inv;
  return tt > 1e-6 ? tt : Infinity;
}

export function raycast(bvh, o, d, skipTri = -1) {
  const invd = [1 / d[0], 1 / d[1], 1 / d[2]];
  let best = Infinity, bestTri = -1;
  const stack = [0];
  while (stack.length) {
    const n = bvh.nodes[stack.pop()];
    if (rayBox(o, invd, n.min, n.max) >= best) continue;
    if (n.count) {
      for (let i = n.start; i < n.start + n.count; i++) { const t = bvh.order[i]; if (t === skipTri) continue; const tt = rayTri(bvh.pos, t, o, d); if (tt < best) { best = tt; bestTri = t; } }
    } else stack.push(n.left, n.right);
  }
  return { t: best, tri: bestTri };
}

/** Wall thickness per triangle: distance from the centroid inward to the opposite surface. */
export function thickness(pos, bvh) {
  bvh = bvh || buildBVH(pos);
  const n = pos.length / 9, out = new Float32Array(n);
  for (let t = 0; t < n; t++) {
    const nrm = triNormal(pos, t);
    const r = raycast(bvh, triCentroid(pos, t), [-nrm[0], -nrm[1], -nrm[2]], t);
    out[t] = r.t;
  }
  return out;
}

export function insideSolid(bvh, p) {
  const d = norm([0.3713, 0.5482, 0.7491]); let hits = 0; let o = p.slice(); let guard = 0;
  while (guard++ < 200) { const r = raycast(bvh, o, d); if (!isFinite(r.t)) break; hits++; o = add(o, mul(d, r.t + 1e-4)); }
  return hits % 2 === 1;
}

// ============================================================ overhang + orientation

/** Per-triangle flag: 0 fine, 1 overhang (needs support), 2 bed contact. angleDeg is measured from vertical. */
export function overhang(pos, angleDeg = 45, bedZ = null) {
  const n = pos.length / 9, out = new Uint8Array(n);
  const cosLimit = Math.cos((90 - angleDeg) * Math.PI / 180);
  const b = bounds(pos); const floor = bedZ == null ? b.min[2] : bedZ;
  for (let t = 0; t < n; t++) {
    const i = t * 9, nrm = triNormal(pos, t);
    if (nrm[2] >= 0) continue;
    const maxZ = Math.max(pos[i + 2], pos[i + 5], pos[i + 8]);
    if (maxZ <= floor + 0.3 && nrm[2] < -0.7) { out[t] = 2; continue; }
    if (-nrm[2] > cosLimit) out[t] = 1;
  }
  return out;
}

export function overhangArea(pos, flags) {
  let a = 0, c = 0;
  for (let t = 0; t < flags.length; t++) { if (flags[t] === 1) a += triArea(pos, t); else if (flags[t] === 2) c += triArea(pos, t); }
  return { overhang: a, contact: c };
}

/** Quaternion [x,y,z,w] rotating unit vector a onto b. */
export function quatFromTo(a, b) {
  a = norm(a); b = norm(b);
  const d = dot(a, b);
  if (d > 1 - 1e-9) return [0, 0, 0, 1];
  if (d < -1 + 1e-9) { let ax = cross([1, 0, 0], a); if (len(ax) < 1e-6) ax = cross([0, 1, 0], a); ax = norm(ax); return [ax[0], ax[1], ax[2], 0]; }
  const c = cross(a, b); const w = 1 + d; const l = Math.hypot(c[0], c[1], c[2], w);
  return [c[0] / l, c[1] / l, c[2] / l, w / l];
}
export function quatToMatrix(q) {
  const [x, y, z, w] = q;
  return [1 - 2 * (y * y + z * z), 2 * (x * y - z * w), 2 * (x * z + y * w), 0,
    2 * (x * y + z * w), 1 - 2 * (x * x + z * z), 2 * (y * z - x * w), 0,
    2 * (x * z - y * w), 2 * (y * z + x * w), 1 - 2 * (x * x + y * y), 0];
}

/** Rank candidate print orientations by support area, bed contact and height. Heuristic, not a slicer. */
export function rankOrientations(pos, opts = {}) {
  const angle = opts.angle || 45, maxCandidates = opts.candidates || 14;
  const n = pos.length / 9;
  const cands = [[0, 0, -1], [0, 0, 1], [1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0]];
  const clusters = [];
  const step = Math.max(1, Math.floor(n / 20000));
  for (let t = 0; t < n; t += step) {
    const nrm = triNormal(pos, t), a = triArea(pos, t);
    let found = null;
    for (const c of clusters) if (dot(c.n, nrm) > 0.995) { found = c; break; }
    if (found) found.a += a; else clusters.push({ n: nrm, a });
    if (clusters.length > 4000) break;
  }
  clusters.sort((x, y) => y.a - x.a);
  for (const c of clusters.slice(0, maxCandidates)) if (!cands.some((k) => dot(k, c.n) > 0.995)) cands.push(c.n);
  const results = [];
  for (const down of cands) {
    const q = quatFromTo(down, [0, 0, -1]);
    const p = transformPositions(pos, quatToMatrix(q));
    const flags = overhang(p, angle);
    const { overhang: oa, contact } = overhangArea(p, flags);
    const b = bounds(p);
    results.push({ down, quat: q, overhangArea: oa, contactArea: contact, height: b.size[2], footprint: b.size[0] * b.size[1] });
  }
  const maxO = Math.max(...results.map((r) => r.overhangArea), 1), maxC = Math.max(...results.map((r) => r.contactArea), 1), maxH = Math.max(...results.map((r) => r.height), 1);
  for (const r of results) r.score = (r.overhangArea / maxO) * 0.6 + (1 - r.contactArea / maxC) * 0.25 + (r.height / maxH) * 0.15;
  results.sort((a, b) => a.score - b.score);
  return results;
}

// ============================================================ plane slicing

export function planeBasis(n) {
  let u = Math.abs(n[0]) < 0.9 ? cross(n, [1, 0, 0]) : cross(n, [0, 1, 0]);
  u = norm(u); const v = norm(cross(n, u)); return { u, v };
}

/** Nudge d so no vertex sits within eps of the plane (avoids degenerate slivers). */
export function nudgePlane(pos, n, d, eps = 1e-5) {
  for (let iter = 0; iter < 12; iter++) {
    let minAbs = Infinity;
    for (let i = 0; i < pos.length; i += 3) { const s = Math.abs(pos[i] * n[0] + pos[i + 1] * n[1] + pos[i + 2] * n[2] - d); if (s < minAbs) minAbs = s; }
    if (minAbs > eps) return d;
    d += eps * 2.3;
  }
  return d;
}

/** Mesh ∩ plane as a flat list of segment endpoints [p0, p1, p0, p1, ...]. */
export function sectionSegments(pos, n, d) { return sectionSegmentsWithTri(pos, n, d).segs; }

/** Like sectionSegments, but also reports the source triangle of each segment. */
export function sectionSegmentsWithTri(pos, n, d) {
  const segs = [], tris = [];
  for (let i = 0; i < pos.length; i += 9) {
    const p = [[pos[i], pos[i + 1], pos[i + 2]], [pos[i + 3], pos[i + 4], pos[i + 5]], [pos[i + 6], pos[i + 7], pos[i + 8]]];
    const s = p.map((q) => dot(n, q) - d);
    const pts = [];
    for (let k = 0; k < 3; k++) {
      const a = p[k], b = p[(k + 1) % 3], sa = s[k], sb = s[(k + 1) % 3];
      if ((sa < 0 && sb >= 0) || (sa >= 0 && sb < 0)) { const t = sa / (sa - sb); pts.push(add(a, mul(sub(b, a), t))); }
    }
    if (pts.length === 2) { segs.push(pts[0], pts[1]); tris.push(i / 9); }
  }
  return { segs, tris };
}

/** Chain segments into closed loops and open chains. */
export function chainLoops(segs, tol = 1e-3) {
  const q = 1 / tol;
  const key = (p) => Math.round(p[0] * q) + ',' + Math.round(p[1] * q) + ',' + Math.round(p[2] * q);
  const adj = new Map(); const pts = new Map();
  for (let i = 0; i < segs.length; i += 2) {
    const a = key(segs[i]), b = key(segs[i + 1]); if (a === b) continue;
    pts.set(a, segs[i]); pts.set(b, segs[i + 1]);
    if (!adj.has(a)) adj.set(a, []); if (!adj.has(b)) adj.set(b, []);
    adj.get(a).push(b); adj.get(b).push(a);
  }
  const used = new Set(); const loops = [], open = [];
  for (const start of adj.keys()) {
    if (used.has(start)) continue;
    const chain = [start]; used.add(start);
    let prev = null, cur = start;
    for (;;) {
      const nb = adj.get(cur).filter((k) => k !== prev && !used.has(k));
      if (!nb.length) break;
      prev = cur; cur = nb[0]; used.add(cur); chain.push(cur);
    }
    prev = chain[1] || null; cur = start;
    for (;;) {
      const nb = adj.get(cur).filter((k) => k !== prev && !used.has(k));
      if (!nb.length) break;
      prev = cur; cur = nb[0]; used.add(cur); chain.unshift(cur);
    }
    const closed = chain.length >= 3 && adj.get(chain[chain.length - 1]).includes(chain[0]);
    const arr = chain.map((k) => pts.get(k));
    if (closed) loops.push(arr); else open.push(arr);
  }
  return { loops, open };
}

export function signedArea2(poly) { let a = 0; for (let i = 0; i < poly.length; i++) { const p = poly[i], q = poly[(i + 1) % poly.length]; a += p[0] * q[1] - q[0] * p[1]; } return a / 2; }
export function pointInPoly2(pt, poly) { let inside = false; for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) { const pi = poly[i], pj = poly[j]; if (((pi[1] > pt[1]) !== (pj[1] > pt[1])) && (pt[0] < (pj[0] - pi[0]) * (pt[1] - pi[1]) / (pj[1] - pi[1]) + pi[0])) inside = !inside; } return inside; }

/** Triangulate closed planar loops (with nesting) into cap triangles whose normal = capNormal. */
export function triangulateLoops(loops, n, capNormal, earcutFn) {
  const { u, v } = planeBasis(n);
  const to2 = (p) => [dot(p, u), dot(p, v)];
  const polys = loops.map((l) => ({ pts3: l, pts2: l.map(to2) }));
  for (const p of polys) p.area = signedArea2(p.pts2);
  for (const p of polys) { p.depth = 0; for (const o of polys) if (o !== p && Math.abs(o.area) > Math.abs(p.area) && pointInPoly2(p.pts2[0], o.pts2)) p.depth++; }
  const outers = polys.filter((p) => p.depth % 2 === 0);
  for (const o of outers) o.holes = [];
  for (const p of polys) if (p.depth % 2 === 1) {
    let best = null; for (const o of outers) if (Math.abs(o.area) > Math.abs(p.area) && pointInPoly2(p.pts2[0], o.pts2)) { if (!best || Math.abs(o.area) < Math.abs(best.area)) best = o; }
    if (best) best.holes.push(p);
  }
  const tris = [];
  const wantCCW = dot(cross(u, v), capNormal) >= 0; // CCW in (u,v) has normal +n
  for (const o of outers) {
    const flat = [], holeIdx = [], all3 = [];
    for (const p of o.pts2) flat.push(p[0], p[1]); all3.push(...o.pts3);
    for (const h of o.holes) { holeIdx.push(all3.length); for (const p of h.pts2) flat.push(p[0], p[1]); all3.push(...h.pts3); }
    const all2 = all3.map(to2);
    const idx = splitTJunctions(earcutFn(flat, holeIdx.length ? holeIdx : null, 2), all2);
    for (let i = 0; i < idx.length; i += 3) {
      const a = all3[idx[i]], b = all3[idx[i + 1]], c = all3[idx[i + 2]];
      const a2 = all2[idx[i]], b2 = all2[idx[i + 1]], c2 = all2[idx[i + 2]];
      const ccw = (b2[0] - a2[0]) * (c2[1] - a2[1]) - (b2[1] - a2[1]) * (c2[0] - a2[0]) > 0;
      if (ccw === wantCCW) tris.push(...a, ...b, ...c); else tris.push(...a, ...c, ...b);
    }
  }
  return { tris: new Float32Array(tris), outers, polys };
}


/**
 * Earcut discards collinear boundary vertices, which leaves T-junctions between a cap and
 * the side walls that still reference those vertices. Split cap triangles at every polygon
 * vertex that lies strictly inside one of their edges so the cap stays welded to the walls.
 */
function splitTJunctions(idx, pts2, eps = 1e-4) {
  const n = pts2.length;
  const byX = Array.from({ length: n }, (_, i) => i).sort((a, b) => pts2[a][0] - pts2[b][0]);
  const xs = byX.map((i) => pts2[i][0]);
  const lowerBound = (x) => { let lo = 0, hi = xs.length; while (lo < hi) { const m = (lo + hi) >> 1; if (xs[m] < x) lo = m + 1; else hi = m; } return lo; };
  const out = [];
  const queue = [];
  for (let i = 0; i < idx.length; i += 3) queue.push([idx[i], idx[i + 1], idx[i + 2]]);
  let guard = 0;
  while (queue.length && guard++ < 2e6) {
    const [a, b, c] = queue.pop();
    let split = false;
    for (const [p, q, r] of [[a, b, c], [b, c, a], [c, a, b]]) {
      const P = pts2[p], Q = pts2[q];
      const dx = Q[0] - P[0], dy = Q[1] - P[1]; const l2 = dx * dx + dy * dy;
      if (l2 < eps * eps) continue;
      const x0 = Math.min(P[0], Q[0]) - eps, x1 = Math.max(P[0], Q[0]) + eps, y0 = Math.min(P[1], Q[1]) - eps, y1 = Math.max(P[1], Q[1]) + eps;
      const on = [];
      for (let j = lowerBound(x0); j < xs.length && xs[j] <= x1; j++) {
        const k = byX[j];
        if (k === p || k === q || k === r) continue;
        const K = pts2[k];
        if (K[1] < y0 || K[1] > y1) continue;
        const t = ((K[0] - P[0]) * dx + (K[1] - P[1]) * dy) / l2;
        if (t <= 1e-7 || t >= 1 - 1e-7) continue;
        if (Math.hypot(K[0] - (P[0] + dx * t), K[1] - (P[1] + dy * t)) > eps) continue;
        on.push([t, k]);
      }
      if (on.length) {
        on.sort((x, y) => x[0] - y[0]);
        let prev = p;
        for (const [, k] of on) { queue.push([prev, k, r]); prev = k; }
        queue.push([prev, q, r]);
        split = true; break;
      }
    }
    if (split) continue;
    const A = pts2[a], B = pts2[b], C = pts2[c];
    const area2 = Math.abs((B[0] - A[0]) * (C[1] - A[1]) - (B[1] - A[1]) * (C[0] - A[0]));
    const longest = Math.max(Math.hypot(B[0] - A[0], B[1] - A[1]), Math.hypot(C[0] - B[0], C[1] - B[1]), Math.hypot(A[0] - C[0], A[1] - C[1]));
    if (longest < eps || area2 / longest < eps) continue; // sliver: its neighbour across the long edge gets split at the apex instead
    out.push(a, b, c);
  }
  return out;
}

/**
 * Cut by plane n·p = d. Returns { above, below, loops, open, d, n, capInfo }; above = n·p >= d side.
 * When a topology report is supplied and the mesh has several shells, each shell is capped
 * independently so overlapping (non-unioned) solids still produce closed halves.
 */
export function cutByPlane(pos, n, dIn, earcutFn, opts = {}) {
  n = norm(n);
  const d = nudgePlane(pos, n, dIn);
  const above = [], below = [];
  for (let i = 0; i < pos.length; i += 9) {
    const p = [[pos[i], pos[i + 1], pos[i + 2]], [pos[i + 3], pos[i + 4], pos[i + 5]], [pos[i + 6], pos[i + 7], pos[i + 8]]];
    const s = p.map((q) => dot(n, q) - d);
    const posCount = (s[0] > 0) + (s[1] > 0) + (s[2] > 0);
    if (posCount === 3) { above.push(...p[0], ...p[1], ...p[2]); continue; }
    if (posCount === 0) { below.push(...p[0], ...p[1], ...p[2]); continue; }
    const lone = posCount === 1 ? s.findIndex((x) => x > 0) : s.findIndex((x) => x <= 0);
    const A = p[lone], B = p[(lone + 1) % 3], C = p[(lone + 2) % 3];
    const sA = s[lone], sB = s[(lone + 1) % 3], sC = s[(lone + 2) % 3];
    const AB = add(A, mul(sub(B, A), sA / (sA - sB))), AC = add(A, mul(sub(C, A), sA / (sA - sC)));
    const loneSide = sA > 0 ? above : below, otherSide = sA > 0 ? below : above;
    loneSide.push(...A, ...AB, ...AC);
    otherSide.push(...AB, ...B, ...C, ...AB, ...C, ...AC);
  }
  const { segs, tris } = sectionSegmentsWithTri(pos, n, d);
  // group section segments by shell so overlapping shells are capped separately
  const groups = new Map();
  const topo = opts.topo && opts.topo.shellCount > 1 ? opts.topo : null;
  for (let i = 0; i < tris.length; i++) {
    const g = topo ? topo.shellOf[tris[i]] : 0;
    if (!groups.has(g)) groups.set(g, []);
    groups.get(g).push(segs[i * 2], segs[i * 2 + 1]);
  }
  const loops = [], open = [];
  const capParts = [];
  const capInfo = { outers: [], polys: [] };
  const extra = opts.extraHoles || [];
  let extraUsed = false;
  for (const gsegs of groups.values()) {
    const c = chainLoops(gsegs);
    loops.push(...c.loops); open.push(...c.open);
    if (!c.loops.length || !earcutFn) continue;
    // pocket holes are attached to whichever shell contains them
    let holes = [];
    if (extra.length && !extraUsed) {
      const { u, v } = planeBasis(n);
      const to2 = (p) => [dot(p, u), dot(p, v)];
      const polys2 = c.loops.map((l) => l.map(to2));
      holes = extra.filter((h) => polys2.some((poly) => pointInPoly2(to2(h[0]), poly)));
      if (holes.length) extraUsed = true;
    }
    const r = triangulateLoops(c.loops.concat(holes), n, [-n[0], -n[1], -n[2]], earcutFn); // above piece's cap faces -n
    capParts.push(r.tris); capInfo.outers.push(...r.outers); capInfo.polys.push(...r.polys);
  }
  const capAbove = concat(capParts), capBelow = flipWinding(capAbove);
  const A = new Float32Array(above.length + capAbove.length); A.set(above); A.set(capAbove, above.length);
  const B = new Float32Array(below.length + capBelow.length); B.set(below); B.set(capBelow, below.length);
  return { above: A, below: B, loops, open, d, n, capInfo: capParts.length ? capInfo : null };
}

/** Pocket (blind hole) walls + floor, starting on the cut plane and going along dir. */
export function pocketGeometry(center, dir, radius, depth, segments, n) {
  const { u, v } = planeBasis(n);
  const ring = [];
  for (let i = 0; i < segments; i++) { const a = i / segments * Math.PI * 2; ring.push(add(center, add(mul(u, Math.cos(a) * radius), mul(v, Math.sin(a) * radius)))); }
  const floorC = add(center, mul(dir, depth));
  const floorRing = ring.map((p) => add(p, mul(dir, depth)));
  const tris = [];
  for (let i = 0; i < segments; i++) {
    const a = ring[i], b = ring[(i + 1) % segments], c = floorRing[(i + 1) % segments], dd = floorRing[i];
    const mid = mul(add(add(a, b), add(c, dd)), 0.25);
    const toAxis = sub(add(center, mul(dir, depth / 2)), mid);
    const nrm = cross(sub(b, a), sub(dd, a));
    if (dot(nrm, toAxis) > 0) tris.push(...a, ...b, ...c, ...a, ...c, ...dd); else tris.push(...a, ...c, ...b, ...a, ...dd, ...c);
  }
  for (let i = 0; i < segments; i++) {
    const a = floorRing[i], b = floorRing[(i + 1) % segments];
    const nrm = cross(sub(a, floorC), sub(b, floorC));
    if (dot(nrm, dir) < 0) tris.push(...floorC, ...a, ...b); else tris.push(...floorC, ...b, ...a);
  }
  return { tris: new Float32Array(tris), ring };
}

/** Closed cylinder along Z centred at the origin. */
export function cylinderSolid(radius, length, segments = 48) {
  const tris = [];
  const h = length / 2;
  for (let i = 0; i < segments; i++) {
    const a0 = i / segments * Math.PI * 2, a1 = (i + 1) / segments * Math.PI * 2;
    const p0 = [Math.cos(a0) * radius, Math.sin(a0) * radius], p1 = [Math.cos(a1) * radius, Math.sin(a1) * radius];
    tris.push(p0[0], p0[1], -h, p1[0], p1[1], -h, p1[0], p1[1], h);
    tris.push(p0[0], p0[1], -h, p1[0], p1[1], h, p0[0], p0[1], h);
    tris.push(0, 0, h, p0[0], p0[1], h, p1[0], p1[1], h);
    tris.push(0, 0, -h, p1[0], p1[1], -h, p0[0], p0[1], -h);
  }
  return new Float32Array(tris);
}

/** Pick well-spread pocket centres inside the cap polygons, away from edges. */
export function placePockets(capInfo, n, count, radius, margin) {
  const outers = capInfo.outers.filter((o) => Math.abs(o.area) > (radius + margin) * (radius + margin) * 4);
  if (!outers.length) return [];
  const distToEdges = (pt, poly) => { let m = Infinity; for (let i = 0; i < poly.length; i++) { const a = poly[i], b = poly[(i + 1) % poly.length]; const abx = b[0] - a[0], aby = b[1] - a[1]; const l2 = abx * abx + aby * aby || 1; let t = ((pt[0] - a[0]) * abx + (pt[1] - a[1]) * aby) / l2; t = Math.max(0, Math.min(1, t)); const dx = pt[0] - (a[0] + t * abx), dy = pt[1] - (a[1] + t * aby); m = Math.min(m, Math.hypot(dx, dy)); } return m; };
  const candidates = [];
  const need = radius + margin;
  for (const o of outers) {
    let minx = Infinity, miny = Infinity, maxx = -Infinity, maxy = -Infinity;
    for (const p of o.pts2) { minx = Math.min(minx, p[0]); maxx = Math.max(maxx, p[0]); miny = Math.min(miny, p[1]); maxy = Math.max(maxy, p[1]); }
    const steps = 40; const sx = (maxx - minx) / steps, sy = (maxy - miny) / steps;
    if (sx <= 0 || sy <= 0) continue;
    for (let i = 0; i <= steps; i++) for (let j = 0; j <= steps; j++) {
      const pt = [minx + i * sx, miny + j * sy];
      if (!pointInPoly2(pt, o.pts2)) continue;
      if (o.holes.some((h) => pointInPoly2(pt, h.pts2))) continue;
      let dmin = distToEdges(pt, o.pts2); for (const h of o.holes) dmin = Math.min(dmin, distToEdges(pt, h.pts2));
      if (dmin >= need) candidates.push({ pt, clearance: dmin });
    }
  }
  if (!candidates.length) return [];
  candidates.sort((a, b) => b.clearance - a.clearance);
  const chosen = [candidates[0]];
  while (chosen.length < count) {
    let best = null, bestD = -1;
    for (const c of candidates) { let dmin = Infinity; for (const ch of chosen) dmin = Math.min(dmin, Math.hypot(c.pt[0] - ch.pt[0], c.pt[1] - ch.pt[1])); const score = Math.min(dmin, c.clearance * 2); if (score > bestD) { bestD = score; best = c; } }
    if (!best || bestD < need * 2) break;
    chosen.push(best);
  }
  return chosen.map((c) => ({ pt2: c.pt, clearance: c.clearance }));
}

export function planePoint2To3(pt2, n, d) { const { u, v } = planeBasis(n); return add(add(mul(u, pt2[0]), mul(v, pt2[1])), mul(n, d)); }
export function circleLoop3(center, n, radius, segments = 32) { const { u, v } = planeBasis(n); const out = []; for (let i = 0; i < segments; i++) { const a = i / segments * Math.PI * 2; out.push(add(center, add(mul(u, Math.cos(a) * radius), mul(v, Math.sin(a) * radius)))); } return out; }

/**
 * Cut with optional alignment-pin pockets on both faces.
 * pocket: { count, diameter, depth, clearance, margin, floorWall }
 * Returns { above, below, pins:[{center}], pin (cylinder positions), loops, open, warnings }.
 */
export function cutWithPockets(pos, n, d, earcutFn, pocket, topo = null) {
  const base = cutByPlane(pos, n, d, earcutFn, { topo });
  const warnings = [];
  if (base.open.length) warnings.push(base.open.length + ' open section chain(s): the mesh is not closed here, so caps may be incomplete.');
  if (!pocket || !pocket.count || !base.capInfo) return { ...base, pins: [], warnings };
  const r = pocket.diameter / 2 + (pocket.clearance || 0);
  const spots = placePockets(base.capInfo, base.n, pocket.count, r, pocket.margin ?? 2);
  if (!spots.length) { warnings.push('No room for pin pockets on this cut face.'); return { ...base, pins: [], warnings }; }
  const bvhA = buildBVH(base.above), bvhB = buildBVH(base.below);
  const pins = [], holes = [];
  let skipped = 0;
  for (const s of spots) {
    const c = planePoint2To3(s.pt2, base.n, base.d);
    const upHit = raycast(bvhA, add(c, mul(base.n, 1e-3)), base.n).t;
    const downHit = raycast(bvhB, add(c, mul(base.n, -1e-3)), [-base.n[0], -base.n[1], -base.n[2]]).t;
    const wall = pocket.floorWall ?? 1.5;
    if (!(upHit > pocket.depth + wall && downHit > pocket.depth + wall)) { skipped++; continue; }
    holes.push(circleLoop3(c, base.n, r));
    pins.push({ center: c });
  }
  if (skipped) warnings.push(`Skipped ${skipped} pocket${skipped > 1 ? 's' : ''}: not enough material depth there.`);
  if (!pins.length) return { ...base, pins: [], warnings };
  const cut = cutByPlane(pos, n, d, earcutFn, { extraHoles: holes, topo });
  const upParts = [cut.above], downParts = [cut.below];
  for (const p of pins) {
    upParts.push(pocketGeometry(p.center, cut.n, r, pocket.depth, 32, cut.n).tris);
    downParts.push(pocketGeometry(p.center, [-cut.n[0], -cut.n[1], -cut.n[2]], r, pocket.depth, 32, cut.n).tris);
  }
  return {
    above: concat(upParts), below: concat(downParts), loops: cut.loops, open: cut.open, d: cut.d, n: cut.n, pins, warnings,
    pin: cylinderSolid(pocket.diameter / 2, pocket.depth * 2 - 0.4),
  };
}

// ============================================================ hole filling

/** Cap planar boundary loops. Returns { positions, filled, skipped }. */
export function fillHoles(pos, earcutFn, topo) {
  topo = topo || topology(pos);
  if (!topo.boundary.length) return { positions: pos, filled: 0, skipped: 0 };
  const dir = new Map();
  for (const key of topo.boundary) {
    const e = topo.edgeMap.get(key); const [a, b] = decodeEdge(key, topo.nV);
    const from = e.d[0] === 1 ? a : b, to = e.d[0] === 1 ? b : a;
    dir.set(to, from); // fill polygon traverses opposite to the face edge
  }
  const seen = new Set(); const added = []; let filled = 0, skipped = 0;
  for (const start of dir.keys()) {
    if (seen.has(start)) continue;
    const loop = []; let cur = start; let guard = 0;
    while (cur !== undefined && !seen.has(cur) && guard++ < 200000) { seen.add(cur); loop.push(cur); cur = dir.get(cur); }
    if (cur !== start || loop.length < 3) { skipped++; continue; }
    const pts = loop.map((i) => [topo.verts[i * 3], topo.verts[i * 3 + 1], topo.verts[i * 3 + 2]]);
    let nx = 0, ny = 0, nz = 0; // Newell normal
    for (let i = 0; i < pts.length; i++) { const p = pts[i], q = pts[(i + 1) % pts.length]; nx += (p[1] - q[1]) * (p[2] + q[2]); ny += (p[2] - q[2]) * (p[0] + q[0]); nz += (p[0] - q[0]) * (p[1] + q[1]); }
    if (len([nx, ny, nz]) < 1e-9) { skipped++; continue; }
    const nrm = norm([nx, ny, nz]);
    const r = triangulateLoops([pts], nrm, nrm, earcutFn);
    if (!r.tris.length) { skipped++; continue; }
    added.push(r.tris); filled++;
  }
  return { positions: concat([pos, ...added]), filled, skipped };
}

// ============================================================ export

export function writeSTL(pos, name = 'meshbench') {
  const n = pos.length / 9;
  const buf = new ArrayBuffer(84 + n * 50), view = new DataView(buf);
  const header = new TextEncoder().encode(('Meshbench ' + name).slice(0, 80)); new Uint8Array(buf).set(header, 0);
  view.setUint32(80, n, true);
  let o = 84;
  for (let t = 0; t < n; t++) {
    const nrm = triNormal(pos, t);
    view.setFloat32(o, nrm[0], true); view.setFloat32(o + 4, nrm[1], true); view.setFloat32(o + 8, nrm[2], true); o += 12;
    for (let k = 0; k < 9; k++) { view.setFloat32(o, pos[t * 9 + k], true); o += 4; }
    view.setUint16(o, 0, true); o += 2;
  }
  return buf;
}

const crcTable = (() => { const t = new Uint32Array(256); for (let i = 0; i < 256; i++) { let c = i; for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; t[i] = c >>> 0; } return t; })();
export function crc32(bytes) { let c = 0xFFFFFFFF; for (let i = 0; i < bytes.length; i++) c = crcTable[(c ^ bytes[i]) & 0xFF] ^ (c >>> 8); return (c ^ 0xFFFFFFFF) >>> 0; }

/** Write a stored (uncompressed) zip. entries: [{ name, data: Uint8Array }]. */
export function writeZipStored(entries) {
  const parts = [], central = []; let offset = 0;
  const enc = new TextEncoder();
  for (const e of entries) {
    const nameB = enc.encode(e.name), crc = crc32(e.data);
    const lh = new ArrayBuffer(30), v = new DataView(lh);
    v.setUint32(0, 0x04034b50, true); v.setUint16(4, 20, true); v.setUint16(6, 0, true); v.setUint16(8, 0, true); v.setUint16(10, 0, true); v.setUint16(12, 0x21, true);
    v.setUint32(14, crc, true); v.setUint32(18, e.data.length, true); v.setUint32(22, e.data.length, true); v.setUint16(26, nameB.length, true); v.setUint16(28, 0, true);
    parts.push(new Uint8Array(lh), nameB, e.data);
    const ch = new ArrayBuffer(46), c = new DataView(ch);
    c.setUint32(0, 0x02014b50, true); c.setUint16(4, 20, true); c.setUint16(6, 20, true); c.setUint16(8, 0, true); c.setUint16(10, 0, true); c.setUint16(12, 0, true); c.setUint16(14, 0x21, true);
    c.setUint32(16, crc, true); c.setUint32(20, e.data.length, true); c.setUint32(24, e.data.length, true); c.setUint16(28, nameB.length, true); c.setUint16(30, 0, true); c.setUint16(32, 0, true); c.setUint16(34, 0, true); c.setUint16(36, 0, true); c.setUint32(38, 0, true); c.setUint32(42, offset, true);
    central.push(new Uint8Array(ch), nameB);
    offset += 30 + nameB.length + e.data.length;
  }
  let cdSize = 0; for (const c of central) cdSize += c.length;
  const eocd = new ArrayBuffer(22), e = new DataView(eocd);
  e.setUint32(0, 0x06054b50, true); e.setUint16(4, 0, true); e.setUint16(6, 0, true); e.setUint16(8, entries.length, true); e.setUint16(10, entries.length, true); e.setUint32(12, cdSize, true); e.setUint32(16, offset, true); e.setUint16(20, 0, true);
  const all = [...parts, ...central, new Uint8Array(eocd)];
  let total = 0; for (const a of all) total += a.length;
  const out = new Uint8Array(total); let o = 0; for (const a of all) { out.set(a, o); o += a.length; }
  return out;
}

const fmtNum = (x) => Number(x.toFixed(5)).toString();

/** parts: [{ name, positions (world mm), color? '#rrggbb' }] -> 3MF bytes; one object + build item per part. */
export function write3MF(parts) {
  const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');
  let objects = '', items = '';
  parts.forEach((p, i) => {
    const { verts, index } = weld(p.positions, 1e-5);
    let vs = '', ts = '';
    for (let k = 0; k < verts.length; k += 3) vs += `<vertex x="${fmtNum(verts[k])}" y="${fmtNum(verts[k + 1])}" z="${fmtNum(verts[k + 2])}"/>`;
    for (let k = 0; k < index.length; k += 3) { if (index[k] === index[k + 1] || index[k + 1] === index[k + 2] || index[k] === index[k + 2]) continue; ts += `<triangle v1="${index[k]}" v2="${index[k + 1]}" v3="${index[k + 2]}"/>`; }
    objects += `<object id="${i + 1}" name="${esc(p.name)}" type="model"><mesh><vertices>${vs}</vertices><triangles>${ts}</triangles></mesh></object>`;
    items += `<item objectid="${i + 1}"/>`;
  });
  const model = `<?xml version="1.0" encoding="UTF-8"?>\n<model unit="millimeter" xml:lang="en-US" xmlns="http://schemas.microsoft.com/3dmanufacturing/core/2015/02"><metadata name="Application">Meshbench</metadata><resources>${objects}</resources><build>${items}</build></model>`;
  const rels = `<?xml version="1.0" encoding="UTF-8"?>\n<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Target="/3D/3dmodel.model" Id="rel0" Type="http://schemas.microsoft.com/3dmanufacturing/2013/01/3dmodel"/></Relationships>`;
  const types = `<?xml version="1.0" encoding="UTF-8"?>\n<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="model" ContentType="application/vnd.ms-package.3dmanufacturing-3dmodel+xml"/></Types>`;
  const enc = new TextEncoder();
  return writeZipStored([{ name: '[Content_Types].xml', data: enc.encode(types) }, { name: '_rels/.rels', data: enc.encode(rels) }, { name: '3D/3dmodel.model', data: enc.encode(model) }]);
}

/** Section loops -> SVG string; 1 user unit = 1 mm. */
export function sectionSVG(loops, open, n) {
  const { u, v } = planeBasis(n);
  const to2 = (p) => [dot(p, u), -dot(p, v)];
  const all = loops.concat(open).map((l) => l.map(to2));
  let minx = Infinity, miny = Infinity, maxx = -Infinity, maxy = -Infinity;
  for (const l of all) for (const p of l) { minx = Math.min(minx, p[0]); maxx = Math.max(maxx, p[0]); miny = Math.min(miny, p[1]); maxy = Math.max(maxy, p[1]); }
  if (!isFinite(minx)) return null;
  const pad = 5; const w = maxx - minx + pad * 2, h = maxy - miny + pad * 2;
  const path = (l) => l.map((p, i) => (i ? 'L' : 'M') + fmtNum(p[0] - minx + pad) + ' ' + fmtNum(p[1] - miny + pad)).join(' ');
  const closed = loops.map((l) => `<path d="${path(l.map(to2))} Z" fill="none" stroke="#000" stroke-width="0.2"/>`).join('');
  const opens = open.map((l) => `<path d="${path(l.map(to2))}" fill="none" stroke="#c00" stroke-width="0.2"/>`).join('');
  return `<?xml version="1.0" encoding="UTF-8"?>\n<svg xmlns="http://www.w3.org/2000/svg" width="${fmtNum(w)}mm" height="${fmtNum(h)}mm" viewBox="0 0 ${fmtNum(w)} ${fmtNum(h)}">${closed}${opens}</svg>`;
}

// ============================================================ sample geometry

/** Revolve a profile [[r, z], ...] around Z. Optional ridge(angle, z) scales the radius. Watertight. */
export function revolve(profile, segments = 96, ridge = null) {
  const rings = profile.map(([r, z]) => { const ring = []; for (let i = 0; i < segments; i++) { const a = i / segments * Math.PI * 2; const rr = r * (ridge ? ridge(a, z) : 1); ring.push([Math.cos(a) * rr, Math.sin(a) * rr, z]); } return ring; });
  const tris = [];
  for (let k = 0; k + 1 < rings.length; k++) {
    const A = rings[k], B = rings[k + 1];
    for (let i = 0; i < segments; i++) { const j = (i + 1) % segments; tris.push(...A[i], ...A[j], ...B[j], ...A[i], ...B[j], ...B[i]); }
  }
  const bottom = rings[0], top = rings[rings.length - 1];
  const cb = [0, 0, profile[0][1]], ct = [0, 0, profile[profile.length - 1][1]];
  for (let i = 0; i < segments; i++) { const j = (i + 1) % segments; tris.push(...cb, ...bottom[j], ...bottom[i]); tris.push(...ct, ...top[i], ...top[j]); }
  const out = new Float32Array(tris);
  return metrics(out).volume < 0 ? flipWinding(out) : out;
}

export function sampleKnob() {
  const profile = [[10, 0], [15, 0], [15, 6], [13, 8], [13, 20], [11, 30], [11, 36], [4, 40]];
  return revolve(profile, 120, (a, z) => (z >= 8 && z <= 30) ? 1 + 0.06 * Math.cos(a * 12) : 1);
}

export function sampleBox(w, d, h) {
  const x = w / 2, y = d / 2; const v = [[-x, -y, 0], [x, -y, 0], [x, y, 0], [-x, y, 0], [-x, -y, h], [x, -y, h], [x, y, h], [-x, y, h]];
  const f = [[0, 2, 1], [0, 3, 2], [4, 5, 6], [4, 6, 7], [0, 1, 5], [0, 5, 4], [1, 2, 6], [1, 6, 5], [2, 3, 7], [2, 7, 6], [3, 0, 4], [3, 4, 7]];
  const out = []; for (const [a, b, c] of f) out.push(...v[a], ...v[b], ...v[c]); return new Float32Array(out);
}

/** A bracket with a hole and a chamfer: a good torture test for cut, overhang and thickness. */
export function sampleBracket() {
  const base = sampleBox(60, 30, 5);
  const wall = transformPositions(sampleBox(5, 24, 40), [1, 0, 0, -25, 0, 1, 0, 0, 0, 0, 1, 4]);
  const boss = transformPositions(cylinderSolid(6, 12, 48), [1, 0, 0, 12, 0, 1, 0, 0, 0, 0, 1, 11]);
  return concat([base, wall, boss]);
}
