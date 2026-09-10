import * as THREE from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import { prepareGeometry, sitOnPlate } from "./mesh-ops";

function mergeParts(geos: THREE.BufferGeometry[]) {
  const cleaned = geos.map((g) => {
    const n = g.index ? g.toNonIndexed() : g.clone();
    for (const key of Object.keys(n.attributes)) {
      if (key !== "position") n.deleteAttribute(key);
    }
    return n;
  });
  const merged = mergeGeometries(cleaned, false);
  for (const g of cleaned) g.dispose();
  for (const g of geos) g.dispose();
  if (!merged) {
    const fallback = new THREE.BoxGeometry(10, 10, 10);
    return fallback;
  }
  merged.computeVertexNormals();
  return merged;
}

function hexShape(acrossFlats: number) {
  const r = acrossFlats / Math.sqrt(3);
  const s = new THREE.Shape();
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2 + Math.PI / 6;
    const x = Math.cos(a) * r;
    const y = Math.sin(a) * r;
    if (i === 0) s.moveTo(x, y);
    else s.lineTo(x, y);
  }
  s.closePath();
  return s;
}

function finish(geo: THREE.BufferGeometry) {
  sitOnPlate(geo);
  return prepareGeometry(geo);
}

export function makeCalibrationCube(size = 20) {
  const box = new THREE.BoxGeometry(size, size, size);
  const step = new THREE.BoxGeometry(size * 0.28, size * 0.12, size * 0.28);
  step.translate(size * 0.22, size * 0.56, size * 0.22);
  const notch = new THREE.BoxGeometry(size * 0.18, size * 0.18, size * 0.06);
  notch.translate(-size * 0.22, size * 0.59, size * 0.47);
  const merged = mergeParts([box, step, notch]);
  return finish(merged);
}

export function makeLBracket() {
  const a = new THREE.BoxGeometry(40, 4, 20);
  a.translate(0, 2, 0);
  const b = new THREE.BoxGeometry(4, 40, 20);
  b.translate(-18, 20, 0);
  const merged = mergeParts([a, b]);
  return finish(merged);
}

export function makeHexBolt() {
  const head = new THREE.ExtrudeGeometry(hexShape(13), {
    depth: 5.5,
    bevelEnabled: false,
  });
  head.rotateX(-Math.PI / 2);
  head.translate(0, 20, 0);
  const shaft = new THREE.CylinderGeometry(4, 4, 20, 24);
  shaft.translate(0, 10, 0);
  const merged = mergeParts([head, shaft]);
  return finish(merged);
}

export function makeHexNut() {
  const shape = hexShape(13);
  const hole = new THREE.Path();
  hole.absarc(0, 0, 3.4, 0, Math.PI * 2, true);
  shape.holes.push(hole);
  const geo = new THREE.ExtrudeGeometry(shape, {
    depth: 6.4,
    bevelEnabled: false,
    curveSegments: 24,
  });
  geo.rotateX(-Math.PI / 2);
  return finish(geo);
}

export function makePlate() {
  const shape = new THREE.Shape();
  shape.moveTo(-30, -20);
  shape.lineTo(30, -20);
  shape.lineTo(30, 20);
  shape.lineTo(-30, 20);
  shape.closePath();
  const holes: [number, number][] = [
    [-22, -12],
    [22, -12],
    [-22, 12],
    [22, 12],
  ];
  for (const [x, y] of holes) {
    const p = new THREE.Path();
    p.absarc(x, y, 3, 0, Math.PI * 2, true);
    shape.holes.push(p);
  }
  const geo = new THREE.ExtrudeGeometry(shape, {
    depth: 4,
    bevelEnabled: false,
    curveSegments: 20,
  });
  geo.rotateX(-Math.PI / 2);
  return finish(geo);
}

export function makeGear(teeth = 16) {
  const pitch = 16;
  const addendum = 2.4;
  const dedendum = 2.8;
  const rInner = pitch - dedendum;
  const rOuter = pitch + addendum;
  const shape = new THREE.Shape();
  for (let i = 0; i < teeth; i++) {
    const a0 = (i / teeth) * Math.PI * 2;
    const a1 = a0 + ((Math.PI * 2) / teeth) * 0.28;
    const a2 = a0 + ((Math.PI * 2) / teeth) * 0.5;
    const a3 = a0 + ((Math.PI * 2) / teeth) * 0.78;
    const a4 = a0 + (Math.PI * 2) / teeth;
    const pts: [number, number, number][] = [
      [Math.cos(a0) * rInner, Math.sin(a0) * rInner, 0],
      [Math.cos(a1) * rInner, Math.sin(a1) * rInner, 0],
      [Math.cos(a1) * rOuter, Math.sin(a1) * rOuter, 0],
      [Math.cos(a3) * rOuter, Math.sin(a3) * rOuter, 0],
      [Math.cos(a3) * rInner, Math.sin(a3) * rInner, 0],
      [Math.cos(a4) * rInner, Math.sin(a4) * rInner, 0],
    ];
    for (let p = 0; p < pts.length; p++) {
      const pt = pts[p]!;
      if (i === 0 && p === 0) shape.moveTo(pt[0], pt[1]);
      else shape.lineTo(pt[0], pt[1]);
    }
    void a2;
  }
  shape.closePath();
  const hole = new THREE.Path();
  hole.absarc(0, 0, 5, 0, Math.PI * 2, true);
  shape.holes.push(hole);
  const geo = new THREE.ExtrudeGeometry(shape, {
    depth: 6,
    bevelEnabled: false,
    curveSegments: 12,
  });
  geo.rotateX(-Math.PI / 2);
  return finish(geo);
}

export interface KitPart {
  name: string;
  geometry: THREE.BufferGeometry;
  color: number;
}

export function workshopKit(): KitPart[] {
  return [
    { name: "CAL-20.stl", geometry: makeCalibrationCube(20), color: 0xd8dee6 },
    { name: "BRACKET-L.stl", geometry: makeLBracket(), color: 0xaeb8c4 },
    { name: "HEX-M8.stl", geometry: makeHexBolt(), color: 0x8f98a3 },
    { name: "NUT-M8.stl", geometry: makeHexNut(), color: 0xcfd6de },
    { name: "PLATE-60.stl", geometry: makePlate(), color: 0xe8e0d4 },
    { name: "GEAR-16.stl", geometry: makeGear(16), color: 0xb4c0b6 },
  ];
}
