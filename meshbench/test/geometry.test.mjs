import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Earcut } from 'three/src/extras/Earcut.js';
import * as G from '../src/geometry.js';

const earcut = Earcut.triangulate;
const closeTo = (a, b, eps = 1e-3) => Math.abs(a - b) <= eps;

test('sample knob is watertight and its volume is positive', () => {
  const pos = G.sampleKnob();
  const t = G.topology(pos);
  assert.equal(t.watertight, true);
  assert.equal(t.shellCount, 1);
  const m = G.metrics(pos);
  assert.ok(m.volume > 0);
  assert.ok(m.area > 0);
});

test('box metrics: volume and area are exact', () => {
  const pos = G.sampleBox(10, 20, 30);
  const m = G.metrics(pos);
  assert.ok(closeTo(m.volume, 6000));
  assert.ok(closeTo(m.area, 2 * (10 * 20 + 20 * 30 + 10 * 30)));
  assert.deepEqual(m.bounds.size, [10, 20, 30]);
});

test('binary STL round trip preserves triangles', () => {
  const pos = G.sampleBox(4, 5, 6);
  const buf = G.writeSTL(pos, 'box');
  const back = G.parseSTL(buf);
  assert.equal(back.positions.length, pos.length);
  for (let i = 0; i < pos.length; i++) assert.ok(closeTo(back.positions[i], pos[i], 1e-6));
});

test('truncated binary STL is salvaged instead of rejected', () => {
  const pos = G.sampleBox(4, 5, 6);
  const buf = G.writeSTL(pos, 'box');
  const cut = buf.slice(0, 84 + 50 * 7 + 10); // 7 whole triangles + a partial one
  const back = G.parseSTL(cut);
  assert.equal(back.positions.length / 9, 7);
  assert.equal(back.truncated, true);
});

test('ASCII STL parses and detects its name', () => {
  const txt = `solid widget
facet normal 0 0 1
 outer loop
  vertex 0 0 0
  vertex 1 0 0
  vertex 0 1 0
 endloop
endfacet
endsolid widget`;
  const r = G.parseSTL(new TextEncoder().encode(txt).buffer);
  assert.equal(r.positions.length, 9);
  assert.equal(r.name, 'widget');
});

test('OBJ parser fans quads and resolves negative indices', () => {
  const obj = 'o quad\nv 0 0 0\nv 1 0 0\nv 1 1 0\nv 0 1 0\nf -4 -3 -2 -1\n';
  const r = G.parseOBJ(obj);
  assert.equal(r.positions.length / 9, 2);
  assert.equal(r.name, 'quad');
});

test('flipWinding negates volume; transform with mirror keeps volume positive', () => {
  const pos = G.sampleBox(2, 3, 4);
  assert.ok(G.metrics(G.flipWinding(pos)).volume < 0);
  const mirrored = G.transformPositions(pos, [-1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0]);
  assert.ok(G.metrics(mirrored).volume > 0);
});

test('composeAffine applies b then a', () => {
  const a = [1, 0, 0, 10, 0, 1, 0, 0, 0, 0, 1, 0]; // translate x+10
  const b = [2, 0, 0, 0, 0, 2, 0, 0, 0, 0, 2, 0]; // scale 2
  const c = G.composeAffine(a, b);
  const p = G.transformPositions(new Float32Array([1, 1, 1, 0, 0, 0, 0, 0, 1]), c);
  assert.deepEqual(Array.from(p.slice(0, 3)), [12, 2, 2]);
});

test('topology reports boundary edges on an open box and fillHoles closes it', () => {
  const box = G.sampleBox(10, 10, 10);
  const open = box.subarray(18); // drop the two bottom triangles
  const t = G.topology(open);
  assert.equal(t.boundary.length, 4);
  assert.equal(t.watertight, false);
  const filled = G.fillHoles(open, earcut, t);
  assert.equal(filled.filled, 1);
  const t2 = G.topology(filled.positions);
  assert.equal(t2.watertight, true);
  assert.ok(closeTo(G.metrics(filled.positions).volume, 1000));
});

test('duplicate and degenerate triangles are detected and cleaned', () => {
  const box = G.sampleBox(10, 10, 10);
  const dup = G.concat([box, box.subarray(0, 9), new Float32Array([0, 0, 0, 1, 1, 1, 2, 2, 2])]);
  const t = G.topology(dup);
  assert.equal(t.duplicateCount, 1);
  assert.equal(t.degenerateCount, 1);
  const clean = G.cleanTriangles(dup, t);
  assert.equal(clean.length, box.length);
});

test('splitShells separates disjoint solids', () => {
  const a = G.sampleBox(10, 10, 10);
  const b = G.transformPositions(G.sampleBox(4, 4, 4), [1, 0, 0, 40, 0, 1, 0, 0, 0, 0, 1, 0]);
  const shells = G.splitShells(G.concat([a, b]));
  assert.equal(shells.length, 2);
  assert.equal(shells[0].length, a.length);
});

test('unifyNormals repairs an inside-out shell and a single flipped triangle', () => {
  const box = G.sampleBox(10, 10, 10);
  const inverted = G.flipWinding(box);
  const r = G.unifyNormals(inverted);
  assert.ok(G.metrics(r.positions).volume > 0);
  const one = new Float32Array(box);
  [one[3], one[4], one[5], one[6], one[7], one[8]] = [one[6], one[7], one[8], one[3], one[4], one[5]];
  assert.equal(G.topology(one).winding.length, 3);
  const r2 = G.unifyNormals(one);
  assert.equal(G.topology(r2.positions).winding.length, 0);
  assert.ok(closeTo(G.metrics(r2.positions).volume, 1000));
});

test('cutByPlane produces two closed halves whose volumes sum to the original', () => {
  const pos = G.sampleKnob();
  const v0 = G.metrics(pos).volume;
  const r = G.cutByPlane(pos, [0, 0, 1], 20, earcut);
  const va = G.metrics(r.above).volume, vb = G.metrics(r.below).volume;
  assert.ok(closeTo(va + vb, v0, v0 * 1e-4));
  assert.equal(G.topology(r.above).watertight, true);
  assert.equal(G.topology(r.below).watertight, true);
  assert.equal(r.loops.length, 1);
  assert.equal(r.open.length, 0);
});

test('cutWithPockets adds pockets on both halves and a matching pin', () => {
  const pos = G.sampleKnob();
  const r = G.cutWithPockets(pos, [0, 0, 1], 20, earcut, { count: 2, diameter: 4, depth: 6, clearance: 0.15, margin: 1.5 });
  assert.equal(r.pins.length, 2);
  assert.equal(G.topology(r.above).watertight, true);
  assert.equal(G.topology(r.below).watertight, true);
  const vPlain = G.metrics(G.cutByPlane(pos, [0, 0, 1], 20, earcut).above).volume;
  const pocketVol = Math.PI * 2.15 * 2.15 * 6 * 2 * 0.98; // two 32-gon pockets
  assert.ok(closeTo(G.metrics(r.above).volume, vPlain - pocketVol, pocketVol * 0.05));
  assert.ok(G.metrics(r.pin).volume > 0);
  assert.ok(closeTo(G.bounds(r.pin).size[2], 11.6));
});

test('tilted cut plane still yields closed halves', () => {
  const pos = G.sampleBracket();
  const n = G.vec.norm([0.3, 0, 1]);
  const topo = G.topology(pos);
  assert.equal(topo.shellCount, 3);
  const r = G.cutByPlane(pos, n, 8, earcut, { topo });
  assert.ok(r.above.length > 0 && r.below.length > 0);
  assert.equal(G.topology(r.above).boundary.length, 0);
  assert.equal(G.topology(r.below).boundary.length, 0);
  const v0 = G.metrics(pos).volume;
  assert.ok(closeTo(G.metrics(r.above).volume + G.metrics(r.below).volume, v0, v0 * 1e-3));
  // pockets on an overlapping-shell part land on the shell that contains them
  const rp = G.cutWithPockets(pos, [0, 0, 1], 2.5, earcut, { count: 2, diameter: 3, depth: 0.8, clearance: 0.1, margin: 1 }, topo);
  assert.ok(rp.pins.length >= 1);
  assert.equal(G.topology(rp.below).boundary.length, 0);
});

test('overhang flags a ceiling and bed contact', () => {
  const pos = G.sampleBox(10, 10, 10);
  const f = G.overhang(pos, 45);
  const a = G.overhangArea(pos, f);
  assert.ok(closeTo(a.contact, 100));
  assert.ok(closeTo(a.overhang, 0));
  // a T shape: lift a slab on a post
  const post = G.sampleBox(2, 2, 10);
  const slab = G.transformPositions(G.sampleBox(20, 20, 2), [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 10]);
  const f2 = G.overhang(G.concat([post, slab]), 45);
  assert.ok(G.overhangArea(G.concat([post, slab]), f2).overhang > 350);
});

test('rankOrientations prefers the flattest side down for a slab', () => {
  const slab = G.transformPositions(G.sampleBox(40, 30, 4), G.quatToMatrix(G.quatFromTo([0, 0, 1], [1, 0, 0])));
  const r = G.rankOrientations(slab, { angle: 45 });
  assert.ok(r[0].height < 5, 'best orientation should lie flat: ' + r[0].height);
});

test('thickness of a box wall equals the box depth', () => {
  const pos = G.sampleBox(10, 10, 3);
  const th = G.thickness(pos);
  const top = [];
  for (let t = 0; t < th.length; t++) if (G.triNormal(pos, t)[2] > 0.9) top.push(th[t]);
  assert.ok(top.every((v) => closeTo(v, 3)));
});

test('growPlanar collects the whole top face of a box', () => {
  const pos = G.sampleBox(10, 10, 10);
  const topo = G.topology(pos);
  let seed = -1; for (let t = 0; t < 12; t++) if (G.triNormal(pos, t)[2] > 0.9) { seed = t; break; }
  const r = G.growPlanar(pos, topo, seed);
  assert.equal(r.faces.length, 2);
  assert.ok(closeTo(r.area, 100));
  assert.ok(closeTo(r.centroid[2], 10));
});

test('3MF round trip through write3MF and parse3MF, including a component transform', async () => {
  const { DOMParser } = await import('node:util').then(() => import('./xml-shim.mjs'));
  const pos = G.sampleBox(4, 6, 8);
  const bytes = G.write3MF([{ name: 'box', positions: pos }]);
  const parts = await G.parse3MF(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength), (xml) => new DOMParser().parseFromString(xml, 'application/xml'));
  assert.equal(parts.length, 1);
  assert.equal(parts[0].name, 'box');
  assert.ok(closeTo(G.metrics(parts[0].positions).volume, 192));
  // assembly with components + item transform (translate 10 on x, in cm)
  const model = `<?xml version="1.0"?><model unit="centimeter"><resources>
    <object id="1"><mesh><vertices><vertex x="0" y="0" z="0"/><vertex x="1" y="0" z="0"/><vertex x="0" y="1" z="0"/><vertex x="0" y="0" z="1"/></vertices>
    <triangles><triangle v1="0" v2="2" v3="1"/><triangle v1="0" v2="1" v3="3"/><triangle v1="0" v2="3" v3="2"/><triangle v1="1" v2="2" v3="3"/></triangles></mesh></object>
    <object id="2" name="asm"><components><component objectid="1" transform="1 0 0 0 1 0 0 0 1 5 0 0"/><component objectid="1"/></components></object>
    </resources><build><item objectid="2" transform="1 0 0 0 1 0 0 0 1 0 0 2"/></build></model>`;
  const enc = new TextEncoder();
  const zip = G.writeZipStored([{ name: '3D/3dmodel.model', data: enc.encode(model) }]);
  const asm = await G.parse3MF(zip.buffer.slice(zip.byteOffset, zip.byteOffset + zip.byteLength), (xml) => new DOMParser().parseFromString(xml, 'application/xml'));
  assert.equal(asm.length, 1);
  assert.equal(asm[0].name, 'asm');
  assert.equal(asm[0].positions.length / 9, 8);
  const b = G.bounds(asm[0].positions);
  assert.ok(closeTo(b.min[2], 20)); // item translate 2 cm -> 20 mm
  assert.ok(closeTo(b.max[0], 60)); // component translate 5 cm + 1 cm tetra
});

test('sectionSVG emits closed loops in mm', () => {
  const pos = G.sampleBox(10, 10, 10);
  const segs = G.sectionSegments(pos, [0, 0, 1], 5);
  const { loops, open } = G.chainLoops(segs);
  assert.equal(loops.length, 1);
  assert.equal(open.length, 0);
  const svg = G.sectionSVG(loops, open, [0, 0, 1]);
  assert.ok(svg.includes('width="20mm"'));
  assert.ok(svg.includes(' Z"'));
});

test('weld merges coincident vertices within tolerance only', () => {
  const pos = new Float32Array([0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 0.00001, 1, 0, 0, 0, 1, 0.5]);
  const w = G.weld(pos, 1e-4);
  assert.equal(w.verts.length / 3, 4);
});
