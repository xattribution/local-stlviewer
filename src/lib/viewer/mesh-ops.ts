import * as THREE from "three";
import { mergeVertices } from "three/addons/utils/BufferGeometryUtils.js";

const _box = new THREE.Box3();
const _size = new THREE.Vector3();
const _va = new THREE.Vector3();
const _vb = new THREE.Vector3();
const _vc = new THREE.Vector3();

export function prepareGeometry(geo: THREE.BufferGeometry): THREE.BufferGeometry {
  geo.deleteAttribute("uv");
  geo.deleteAttribute("uv1");
  geo.deleteAttribute("uv2");
  geo.deleteAttribute("color");
  let g = geo;
  try {
    g = mergeVertices(geo, 1e-4);
    if (g !== geo) geo.dispose();
  } catch {
    g = geo;
  }
  if (!g.attributes.normal) g.computeVertexNormals();
  g.computeBoundingBox();
  g.computeBoundingSphere();
  return g;
}

export function sitOnPlate(geo: THREE.BufferGeometry) {
  geo.computeBoundingBox();
  const b = geo.boundingBox;
  if (!b) return;
  const cx = (b.min.x + b.max.x) / 2;
  const cz = (b.min.z + b.max.z) / 2;
  geo.translate(-cx, -b.min.y, -cz);
  geo.computeBoundingBox();
  geo.computeVertexNormals();
  geo.computeBoundingSphere();
}

export function volumeOf(geo: THREE.BufferGeometry): number {
  const pos = geo.attributes.position;
  const idx = geo.index;
  let vol = 0;
  const triCount = idx ? idx.count / 3 : pos.count / 3;
  for (let t = 0; t < triCount; t++) {
    let ia: number, ib: number, ic: number;
    if (idx) {
      const i = t * 3;
      ia = idx.getX(i);
      ib = idx.getX(i + 1);
      ic = idx.getX(i + 2);
    } else {
      ia = t * 3;
      ib = ia + 1;
      ic = ia + 2;
    }
    _va.fromBufferAttribute(pos, ia);
    _vb.fromBufferAttribute(pos, ib);
    _vc.fromBufferAttribute(pos, ic);
    vol += _va.dot(_vb.cross(_vc));
  }
  return Math.abs(vol) / 6;
}

export function areaOf(geo: THREE.BufferGeometry): number {
  const pos = geo.attributes.position;
  const idx = geo.index;
  let area = 0;
  const triCount = idx ? idx.count / 3 : pos.count / 3;
  for (let t = 0; t < triCount; t++) {
    let ia: number, ib: number, ic: number;
    if (idx) {
      const i = t * 3;
      ia = idx.getX(i);
      ib = idx.getX(i + 1);
      ic = idx.getX(i + 2);
    } else {
      ia = t * 3;
      ib = ia + 1;
      ic = ia + 2;
    }
    _va.fromBufferAttribute(pos, ia);
    _vb.fromBufferAttribute(pos, ib);
    _vc.fromBufferAttribute(pos, ic);
    area += _vb.sub(_va).cross(_vc.sub(_va)).length() * 0.5;
  }
  return area;
}

export function localSize(geo: THREE.BufferGeometry): THREE.Vector3 {
  geo.computeBoundingBox();
  const b = geo.boundingBox ?? new THREE.Box3();
  return b.getSize(new THREE.Vector3());
}

export function worldSize(object: THREE.Object3D): THREE.Vector3 {
  _box.setFromObject(object);
  return _box.getSize(new THREE.Vector3());
}

export function dropMeshToBed(mesh: THREE.Object3D) {
  mesh.updateMatrixWorld(true);
  _box.setFromObject(mesh);
  mesh.position.y -= _box.min.y;
  mesh.updateMatrixWorld(true);
}

export function centerMeshOnBed(mesh: THREE.Object3D) {
  mesh.updateMatrixWorld(true);
  _box.setFromObject(mesh);
  const c = _box.getCenter(new THREE.Vector3());
  mesh.position.x -= c.x;
  mesh.position.z -= c.z;
  _box.setFromObject(mesh);
  mesh.position.y -= _box.min.y;
  mesh.updateMatrixWorld(true);
}

export function bakeWorld(mesh: THREE.Mesh): THREE.BufferGeometry {
  mesh.updateMatrixWorld(true);
  const g = mesh.geometry.clone();
  g.applyMatrix4(mesh.matrixWorld);
  if (mesh.matrixWorld.determinant() < 0) flipWinding(g);
  g.computeVertexNormals();
  g.computeBoundingBox();
  g.computeBoundingSphere();
  return g;
}

export function flipWinding(geo: THREE.BufferGeometry) {
  const idx = geo.index;
  if (idx) {
    const arr = idx.array;
    for (let i = 0; i + 2 < arr.length; i += 3) {
      const tmp = arr[i + 1]!;
      arr[i + 1] = arr[i + 2]!;
      arr[i + 2] = tmp;
    }
    idx.needsUpdate = true;
  } else {
    const pos = geo.attributes.position;
    const tmp = new THREE.Vector3();
    for (let i = 0; i + 2 < pos.count; i += 3) {
      tmp.fromBufferAttribute(pos, i + 1);
      pos.setXYZ(i + 1, pos.getX(i + 2), pos.getY(i + 2), pos.getZ(i + 2));
      pos.setXYZ(i + 2, tmp.x, tmp.y, tmp.z);
    }
    pos.needsUpdate = true;
  }
}

export function autoOrientGeometry(geo: THREE.BufferGeometry): THREE.BufferGeometry {
  const base = geo.clone();
  sitOnPlate(base);
  const rots: THREE.Matrix4[] = [];
  const faces = [
    [0, 1, 0],
    [0, -1, 0],
    [1, 0, 0],
    [-1, 0, 0],
    [0, 0, 1],
    [0, 0, -1],
  ] as const;
  for (const up of faces) {
    for (let t = 0; t < 4; t++) {
      const m = new THREE.Matrix4();
      const y = new THREE.Vector3(...up);
      const x0 =
        Math.abs(y.x) < 0.9 ? new THREE.Vector3(1, 0, 0) : new THREE.Vector3(0, 0, 1);
      const x = new THREE.Vector3().crossVectors(x0, y).normalize();
      const z = new THREE.Vector3().crossVectors(x, y).normalize();
      const c = Math.cos((t * Math.PI) / 2);
      const s = Math.sin((t * Math.PI) / 2);
      const xt = x.clone().multiplyScalar(c).addScaledVector(z, s);
      const zt = z.clone().multiplyScalar(c).addScaledVector(x, -s);
      m.makeBasis(xt, y, zt);
      rots.push(m);
    }
  }
  let best = new THREE.Matrix4();
  let bestScore = -Infinity;
  let bestHeight = Infinity;
  const tmp = base.clone();
  for (const rot of rots) {
    tmp.copy(base);
    tmp.applyMatrix4(rot);
    tmp.computeBoundingBox();
    if (!tmp.boundingBox) continue;
    tmp.boundingBox.getSize(_size);
    const height = _size.y;
    const baseArea = _size.x * _size.z;
    const score = baseArea / (height + 1e-6) - height * 0.008;
    if (
      score > bestScore + 1e-8 ||
      (Math.abs(score - bestScore) < 1e-8 && height < bestHeight)
    ) {
      bestScore = score;
      bestHeight = height;
      best.copy(rot);
    }
  }
  tmp.dispose();
  const out = base.clone();
  out.applyMatrix4(best);
  sitOnPlate(out);
  base.dispose();
  return out;
}

export function applyOverhangColors(mesh: THREE.Mesh, thresholdDeg = 45) {
  mesh.updateMatrixWorld(true);
  const geo = mesh.geometry;
  const pos = geo.attributes.position;
  if (!geo.attributes.normal) geo.computeVertexNormals();
  const nrm = geo.attributes.normal;
  const colors = new Float32Array(pos.count * 3);
  const n = new THREE.Vector3();
  const normalMatrix = new THREE.Matrix3().getNormalMatrix(mesh.matrixWorld);
  const thresh = thresholdDeg;
  for (let i = 0; i < pos.count; i++) {
    n.fromBufferAttribute(nrm, i).applyMatrix3(normalMatrix).normalize();
    const fromUp = (Math.acos(THREE.MathUtils.clamp(n.y, -1, 1)) * 180) / Math.PI;
    const overhang = Math.max(0, fromUp - 90);
    let r: number, g: number, b: number;
    if (overhang <= 1) {
      r = 0.42;
      g = 0.58;
      b = 0.48;
    } else if (overhang < thresh) {
      const t = overhang / thresh;
      r = 0.42 + t * 0.42;
      g = 0.58 - t * 0.12;
      b = 0.48 - t * 0.28;
    } else {
      const t = Math.min(1, (overhang - thresh) / 45);
      r = 0.84 + t * 0.1;
      g = 0.32 - t * 0.14;
      b = 0.22 - t * 0.06;
    }
    colors[i * 3] = r;
    colors[i * 3 + 1] = g;
    colors[i * 3 + 2] = b;
  }
  geo.setAttribute("color", new THREE.BufferAttribute(colors, 3));
}

export function triCountOf(geo: THREE.BufferGeometry) {
  return geo.index ? geo.index.count / 3 : geo.attributes.position.count / 3;
}
