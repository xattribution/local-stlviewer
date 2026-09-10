import * as THREE from "three";

export interface Topology {
  faceCount: number;
  neighbors: number[][];
  normals: Float32Array;
  centroids: Float32Array;
}

const _va = new THREE.Vector3();
const _vb = new THREE.Vector3();
const _vc = new THREE.Vector3();
const _ab = new THREE.Vector3();
const _ac = new THREE.Vector3();
const _n = new THREE.Vector3();

function faceIndices(
  geo: THREE.BufferGeometry,
  face: number,
): [number, number, number] {
  const idx = geo.index;
  if (idx) {
    const i = face * 3;
    return [idx.getX(i), idx.getX(i + 1), idx.getX(i + 2)];
  }
  const i = face * 3;
  return [i, i + 1, i + 2];
}

export function buildTopology(geo: THREE.BufferGeometry): Topology {
  const pos = geo.attributes.position;
  const faceCount = geo.index ? geo.index.count / 3 : pos.count / 3;
  const neighbors: number[][] = Array.from({ length: faceCount }, () => []);
  const normals = new Float32Array(faceCount * 3);
  const centroids = new Float32Array(faceCount * 3);
  const edgeMap = new Map<string, number>();

  const keyAt = (i: number) => {
    const x = Math.round(pos.getX(i) * 1000);
    const y = Math.round(pos.getY(i) * 1000);
    const z = Math.round(pos.getZ(i) * 1000);
    return `${x},${y},${z}`;
  };

  const edgeKey = (a: string, b: string) => (a < b ? `${a}|${b}` : `${b}|${a}`);

  for (let f = 0; f < faceCount; f++) {
    const [ia, ib, ic] = faceIndices(geo, f);
    _va.fromBufferAttribute(pos, ia);
    _vb.fromBufferAttribute(pos, ib);
    _vc.fromBufferAttribute(pos, ic);
    _ab.subVectors(_vb, _va);
    _ac.subVectors(_vc, _va);
    _n.crossVectors(_ab, _ac);
    const len = _n.length();
    if (len > 1e-12) _n.multiplyScalar(1 / len);
    normals[f * 3] = _n.x;
    normals[f * 3 + 1] = _n.y;
    normals[f * 3 + 2] = _n.z;
    centroids[f * 3] = (_va.x + _vb.x + _vc.x) / 3;
    centroids[f * 3 + 1] = (_va.y + _vb.y + _vc.y) / 3;
    centroids[f * 3 + 2] = (_va.z + _vb.z + _vc.z) / 3;

    const ka = keyAt(ia);
    const kb = keyAt(ib);
    const kc = keyAt(ic);
    const edges = [edgeKey(ka, kb), edgeKey(kb, kc), edgeKey(kc, ka)];
    for (const e of edges) {
      const other = edgeMap.get(e);
      if (other === undefined) {
        edgeMap.set(e, f);
      } else {
        neighbors[f].push(other);
        neighbors[other].push(f);
      }
    }
  }

  return { faceCount, neighbors, normals, centroids };
}

export function growPlanar(
  topo: Topology,
  start: number,
  dotTol = 0.9994,
  planeTol = 0.08,
): number[] {
  if (start < 0 || start >= topo.faceCount) return [start];
  const nx = topo.normals[start * 3]!;
  const ny = topo.normals[start * 3 + 1]!;
  const nz = topo.normals[start * 3 + 2]!;
  const cx = topo.centroids[start * 3]!;
  const cy = topo.centroids[start * 3 + 1]!;
  const cz = topo.centroids[start * 3 + 2]!;
  const planeD = nx * cx + ny * cy + nz * cz;
  const seen = new Uint8Array(topo.faceCount);
  const stack = [start];
  const out: number[] = [];
  seen[start] = 1;
  while (stack.length) {
    const f = stack.pop()!;
    out.push(f);
    const nbrs = topo.neighbors[f] ?? [];
    for (const n of nbrs) {
      if (seen[n]) continue;
      const nnx = topo.normals[n * 3]!;
      const nny = topo.normals[n * 3 + 1]!;
      const nnz = topo.normals[n * 3 + 2]!;
      if (nx * nnx + ny * nny + nz * nnz < dotTol) continue;
      const pcx = topo.centroids[n * 3]!;
      const pcy = topo.centroids[n * 3 + 1]!;
      const pcz = topo.centroids[n * 3 + 2]!;
      if (Math.abs(nx * pcx + ny * pcy + nz * pcz - planeD) > planeTol) continue;
      seen[n] = 1;
      stack.push(n);
    }
  }
  return out;
}

export function faceLocalFrame(
  geo: THREE.BufferGeometry,
  topo: Topology,
  faces: number[],
) {
  const pos = geo.attributes.position;
  _n.set(0, 0, 0);
  const point = new THREE.Vector3();
  for (const f of faces) {
    _n.x += topo.normals[f * 3]!;
    _n.y += topo.normals[f * 3 + 1]!;
    _n.z += topo.normals[f * 3 + 2]!;
    point.x += topo.centroids[f * 3]!;
    point.y += topo.centroids[f * 3 + 1]!;
    point.z += topo.centroids[f * 3 + 2]!;
  }
  _n.normalize();
  point.multiplyScalar(1 / Math.max(faces.length, 1));
  const [ia, ib, ic] = faceIndices(geo, faces[0] ?? 0);
  _va.fromBufferAttribute(pos, ia);
  _vb.fromBufferAttribute(pos, ib);
  _vc.fromBufferAttribute(pos, ic);
  return {
    localNormal: _n.clone(),
    localPoint: point.clone(),
    triangle: [_va.clone(), _vb.clone(), _vc.clone()] as [
      THREE.Vector3,
      THREE.Vector3,
      THREE.Vector3,
    ],
  };
}

export function planarHelperGeometry(
  geo: THREE.BufferGeometry,
  faces: number[],
  offset: number,
): THREE.BufferGeometry {
  const pos = geo.attributes.position;
  const verts: number[] = [];
  const n = new THREE.Vector3();
  for (const f of faces) {
    const [ia, ib, ic] = faceIndices(geo, f);
    _va.fromBufferAttribute(pos, ia);
    _vb.fromBufferAttribute(pos, ib);
    _vc.fromBufferAttribute(pos, ic);
    n.subVectors(_vb, _va).cross(_ac.subVectors(_vc, _va));
    if (n.lengthSq() > 1e-16) n.normalize();
    verts.push(
      _va.x + n.x * offset,
      _va.y + n.y * offset,
      _va.z + n.z * offset,
      _vb.x + n.x * offset,
      _vb.y + n.y * offset,
      _vb.z + n.z * offset,
      _vc.x + n.x * offset,
      _vc.y + n.y * offset,
      _vc.z + n.z * offset,
    );
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(verts, 3));
  g.computeVertexNormals();
  return g;
}
