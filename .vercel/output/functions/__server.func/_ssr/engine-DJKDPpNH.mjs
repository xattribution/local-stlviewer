import { i as PRINTERS, n as EMPTY_SNAPSHOT, r as PART_COLORS } from "./routes-RC3eb1IR.mjs";
import { $ as Sprite, A as LineLoop, B as MeshPhysicalMaterial, C as Float32BufferAttribute, D as HemisphereLight, E as Group, F as Mesh, G as Plane, H as OrthographicCamera, I as MeshBasicMaterial, J as Raycaster, K as PlaneGeometry, L as MeshLambertMaterial, M as MathUtils, N as Matrix3, O as Line, P as Matrix4, Q as SphereGeometry, R as MeshMatcapMaterial, S as ExtrudeGeometry, T as GridHelper, U as Path, V as MeshStandardMaterial, W as PerspectiveCamera, X as Scene, Y as SRGBColorSpace, Z as Shape, _ as Color, a as STLLoader, b as EdgesGeometry, c as PMREMGenerator, d as AxesHelper, et as SpriteMaterial, f as Box3, g as CanvasTexture, h as BufferGeometry, i as STLExporter, j as LineSegments, k as LineBasicMaterial, l as WebGLRenderer, m as BufferAttribute, n as mergeVertices, nt as Vector3, o as TransformControls, p as BoxGeometry, q as Quaternion, r as RoomEnvironment, s as OrbitControls, t as mergeGeometries, tt as Vector2, u as AmbientLight, v as CylinderGeometry, w as Fog, x as Euler, y as DirectionalLight, z as MeshNormalMaterial } from "../_libs/three.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/engine-DJKDPpNH.js
var _va$1 = new Vector3();
var _vb$1 = new Vector3();
var _vc$1 = new Vector3();
var _ab = new Vector3();
var _ac = new Vector3();
var _n = new Vector3();
function faceIndices(geo, face) {
	const idx = geo.index;
	if (idx) {
		const i = face * 3;
		return [
			idx.getX(i),
			idx.getX(i + 1),
			idx.getX(i + 2)
		];
	}
	const i = face * 3;
	return [
		i,
		i + 1,
		i + 2
	];
}
function buildTopology(geo) {
	const pos = geo.attributes.position;
	const faceCount = geo.index ? geo.index.count / 3 : pos.count / 3;
	const neighbors = Array.from({ length: faceCount }, () => []);
	const normals = new Float32Array(faceCount * 3);
	const centroids = new Float32Array(faceCount * 3);
	const edgeMap = /* @__PURE__ */ new Map();
	const keyAt = (i) => {
		return `${Math.round(pos.getX(i) * 1e3)},${Math.round(pos.getY(i) * 1e3)},${Math.round(pos.getZ(i) * 1e3)}`;
	};
	const edgeKey = (a, b) => a < b ? `${a}|${b}` : `${b}|${a}`;
	for (let f = 0; f < faceCount; f++) {
		const [ia, ib, ic] = faceIndices(geo, f);
		_va$1.fromBufferAttribute(pos, ia);
		_vb$1.fromBufferAttribute(pos, ib);
		_vc$1.fromBufferAttribute(pos, ic);
		_ab.subVectors(_vb$1, _va$1);
		_ac.subVectors(_vc$1, _va$1);
		_n.crossVectors(_ab, _ac);
		const len = _n.length();
		if (len > 1e-12) _n.multiplyScalar(1 / len);
		normals[f * 3] = _n.x;
		normals[f * 3 + 1] = _n.y;
		normals[f * 3 + 2] = _n.z;
		centroids[f * 3] = (_va$1.x + _vb$1.x + _vc$1.x) / 3;
		centroids[f * 3 + 1] = (_va$1.y + _vb$1.y + _vc$1.y) / 3;
		centroids[f * 3 + 2] = (_va$1.z + _vb$1.z + _vc$1.z) / 3;
		const ka = keyAt(ia);
		const kb = keyAt(ib);
		const kc = keyAt(ic);
		const edges = [
			edgeKey(ka, kb),
			edgeKey(kb, kc),
			edgeKey(kc, ka)
		];
		for (const e of edges) {
			const other = edgeMap.get(e);
			if (other === void 0) edgeMap.set(e, f);
			else {
				neighbors[f].push(other);
				neighbors[other].push(f);
			}
		}
	}
	return {
		faceCount,
		neighbors,
		normals,
		centroids
	};
}
function growPlanar(topo, start, dotTol = .9994, planeTol = .08) {
	if (start < 0 || start >= topo.faceCount) return [start];
	const nx = topo.normals[start * 3];
	const ny = topo.normals[start * 3 + 1];
	const nz = topo.normals[start * 3 + 2];
	const cx = topo.centroids[start * 3];
	const cy = topo.centroids[start * 3 + 1];
	const cz = topo.centroids[start * 3 + 2];
	const planeD = nx * cx + ny * cy + nz * cz;
	const seen = new Uint8Array(topo.faceCount);
	const stack = [start];
	const out = [];
	seen[start] = 1;
	while (stack.length) {
		const f = stack.pop();
		out.push(f);
		const nbrs = topo.neighbors[f] ?? [];
		for (const n of nbrs) {
			if (seen[n]) continue;
			const nnx = topo.normals[n * 3];
			const nny = topo.normals[n * 3 + 1];
			const nnz = topo.normals[n * 3 + 2];
			if (nx * nnx + ny * nny + nz * nnz < dotTol) continue;
			const pcx = topo.centroids[n * 3];
			const pcy = topo.centroids[n * 3 + 1];
			const pcz = topo.centroids[n * 3 + 2];
			if (Math.abs(nx * pcx + ny * pcy + nz * pcz - planeD) > planeTol) continue;
			seen[n] = 1;
			stack.push(n);
		}
	}
	return out;
}
function faceLocalFrame(geo, topo, faces) {
	const pos = geo.attributes.position;
	_n.set(0, 0, 0);
	const point = new Vector3();
	for (const f of faces) {
		_n.x += topo.normals[f * 3];
		_n.y += topo.normals[f * 3 + 1];
		_n.z += topo.normals[f * 3 + 2];
		point.x += topo.centroids[f * 3];
		point.y += topo.centroids[f * 3 + 1];
		point.z += topo.centroids[f * 3 + 2];
	}
	_n.normalize();
	point.multiplyScalar(1 / Math.max(faces.length, 1));
	const [ia, ib, ic] = faceIndices(geo, faces[0] ?? 0);
	_va$1.fromBufferAttribute(pos, ia);
	_vb$1.fromBufferAttribute(pos, ib);
	_vc$1.fromBufferAttribute(pos, ic);
	return {
		localNormal: _n.clone(),
		localPoint: point.clone(),
		triangle: [
			_va$1.clone(),
			_vb$1.clone(),
			_vc$1.clone()
		]
	};
}
function planarHelperGeometry(geo, faces, offset) {
	const pos = geo.attributes.position;
	const verts = [];
	const n = new Vector3();
	for (const f of faces) {
		const [ia, ib, ic] = faceIndices(geo, f);
		_va$1.fromBufferAttribute(pos, ia);
		_vb$1.fromBufferAttribute(pos, ib);
		_vc$1.fromBufferAttribute(pos, ic);
		n.subVectors(_vb$1, _va$1).cross(_ac.subVectors(_vc$1, _va$1));
		if (n.lengthSq() > 1e-16) n.normalize();
		verts.push(_va$1.x + n.x * offset, _va$1.y + n.y * offset, _va$1.z + n.z * offset, _vb$1.x + n.x * offset, _vb$1.y + n.y * offset, _vb$1.z + n.z * offset, _vc$1.x + n.x * offset, _vc$1.y + n.y * offset, _vc$1.z + n.z * offset);
	}
	const g = new BufferGeometry();
	g.setAttribute("position", new Float32BufferAttribute(verts, 3));
	g.computeVertexNormals();
	return g;
}
var _box$1 = new Box3();
var _size$1 = new Vector3();
var _va = new Vector3();
var _vb = new Vector3();
var _vc = new Vector3();
function prepareGeometry(geo) {
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
function sitOnPlate(geo) {
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
function volumeOf(geo) {
	const pos = geo.attributes.position;
	const idx = geo.index;
	let vol = 0;
	const triCount = idx ? idx.count / 3 : pos.count / 3;
	for (let t = 0; t < triCount; t++) {
		let ia, ib, ic;
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
function areaOf(geo) {
	const pos = geo.attributes.position;
	const idx = geo.index;
	let area = 0;
	const triCount = idx ? idx.count / 3 : pos.count / 3;
	for (let t = 0; t < triCount; t++) {
		let ia, ib, ic;
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
		area += _vb.sub(_va).cross(_vc.sub(_va)).length() * .5;
	}
	return area;
}
function dropMeshToBed(mesh) {
	mesh.updateMatrixWorld(true);
	_box$1.setFromObject(mesh);
	mesh.position.y -= _box$1.min.y;
	mesh.updateMatrixWorld(true);
}
function centerMeshOnBed(mesh) {
	mesh.updateMatrixWorld(true);
	_box$1.setFromObject(mesh);
	const c = _box$1.getCenter(new Vector3());
	mesh.position.x -= c.x;
	mesh.position.z -= c.z;
	_box$1.setFromObject(mesh);
	mesh.position.y -= _box$1.min.y;
	mesh.updateMatrixWorld(true);
}
function bakeWorld(mesh) {
	mesh.updateMatrixWorld(true);
	const g = mesh.geometry.clone();
	g.applyMatrix4(mesh.matrixWorld);
	if (mesh.matrixWorld.determinant() < 0) flipWinding(g);
	g.computeVertexNormals();
	g.computeBoundingBox();
	g.computeBoundingSphere();
	return g;
}
function flipWinding(geo) {
	const idx = geo.index;
	if (idx) {
		const arr = idx.array;
		for (let i = 0; i + 2 < arr.length; i += 3) {
			const tmp = arr[i + 1];
			arr[i + 1] = arr[i + 2];
			arr[i + 2] = tmp;
		}
		idx.needsUpdate = true;
	} else {
		const pos = geo.attributes.position;
		const tmp = new Vector3();
		for (let i = 0; i + 2 < pos.count; i += 3) {
			tmp.fromBufferAttribute(pos, i + 1);
			pos.setXYZ(i + 1, pos.getX(i + 2), pos.getY(i + 2), pos.getZ(i + 2));
			pos.setXYZ(i + 2, tmp.x, tmp.y, tmp.z);
		}
		pos.needsUpdate = true;
	}
}
function autoOrientGeometry(geo) {
	const base = geo.clone();
	sitOnPlate(base);
	const rots = [];
	for (const up of [
		[
			0,
			1,
			0
		],
		[
			0,
			-1,
			0
		],
		[
			1,
			0,
			0
		],
		[
			-1,
			0,
			0
		],
		[
			0,
			0,
			1
		],
		[
			0,
			0,
			-1
		]
	]) for (let t = 0; t < 4; t++) {
		const m = new Matrix4();
		const y = new Vector3(...up);
		const x0 = Math.abs(y.x) < .9 ? new Vector3(1, 0, 0) : new Vector3(0, 0, 1);
		const x = new Vector3().crossVectors(x0, y).normalize();
		const z = new Vector3().crossVectors(x, y).normalize();
		const c = Math.cos(t * Math.PI / 2);
		const s = Math.sin(t * Math.PI / 2);
		const xt = x.clone().multiplyScalar(c).addScaledVector(z, s);
		const zt = z.clone().multiplyScalar(c).addScaledVector(x, -s);
		m.makeBasis(xt, y, zt);
		rots.push(m);
	}
	let best = new Matrix4();
	let bestScore = -Infinity;
	let bestHeight = Infinity;
	const tmp = base.clone();
	for (const rot of rots) {
		tmp.copy(base);
		tmp.applyMatrix4(rot);
		tmp.computeBoundingBox();
		if (!tmp.boundingBox) continue;
		tmp.boundingBox.getSize(_size$1);
		const height = _size$1.y;
		const score = _size$1.x * _size$1.z / (height + 1e-6) - height * .008;
		if (score > bestScore + 1e-8 || Math.abs(score - bestScore) < 1e-8 && height < bestHeight) {
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
function applyOverhangColors(mesh, thresholdDeg = 45) {
	mesh.updateMatrixWorld(true);
	const geo = mesh.geometry;
	const pos = geo.attributes.position;
	if (!geo.attributes.normal) geo.computeVertexNormals();
	const nrm = geo.attributes.normal;
	const colors = new Float32Array(pos.count * 3);
	const n = new Vector3();
	const normalMatrix = new Matrix3().getNormalMatrix(mesh.matrixWorld);
	const thresh = thresholdDeg;
	for (let i = 0; i < pos.count; i++) {
		n.fromBufferAttribute(nrm, i).applyMatrix3(normalMatrix).normalize();
		const fromUp = Math.acos(MathUtils.clamp(n.y, -1, 1)) * 180 / Math.PI;
		const overhang = Math.max(0, fromUp - 90);
		let r, g, b;
		if (overhang <= 1) {
			r = .42;
			g = .58;
			b = .48;
		} else if (overhang < thresh) {
			const t = overhang / thresh;
			r = .42 + t * .42;
			g = .58 - t * .12;
			b = .48 - t * .28;
		} else {
			const t = Math.min(1, (overhang - thresh) / 45);
			r = .84 + t * .1;
			g = .32 - t * .14;
			b = .22 - t * .06;
		}
		colors[i * 3] = r;
		colors[i * 3 + 1] = g;
		colors[i * 3 + 2] = b;
	}
	geo.setAttribute("color", new BufferAttribute(colors, 3));
}
function triCountOf(geo) {
	return geo.index ? geo.index.count / 3 : geo.attributes.position.count / 3;
}
function mergeParts(geos) {
	const cleaned = geos.map((g) => {
		const n = g.index ? g.toNonIndexed() : g.clone();
		for (const key of Object.keys(n.attributes)) if (key !== "position") n.deleteAttribute(key);
		return n;
	});
	const merged = mergeGeometries(cleaned, false);
	for (const g of cleaned) g.dispose();
	for (const g of geos) g.dispose();
	if (!merged) return new BoxGeometry(10, 10, 10);
	merged.computeVertexNormals();
	return merged;
}
function hexShape(acrossFlats) {
	const r = acrossFlats / Math.sqrt(3);
	const s = new Shape();
	for (let i = 0; i < 6; i++) {
		const a = i / 6 * Math.PI * 2 + Math.PI / 6;
		const x = Math.cos(a) * r;
		const y = Math.sin(a) * r;
		if (i === 0) s.moveTo(x, y);
		else s.lineTo(x, y);
	}
	s.closePath();
	return s;
}
function finish(geo) {
	sitOnPlate(geo);
	return prepareGeometry(geo);
}
function makeCalibrationCube(size = 20) {
	const box = new BoxGeometry(size, size, size);
	const step = new BoxGeometry(size * .28, size * .12, size * .28);
	step.translate(size * .22, size * .56, size * .22);
	const notch = new BoxGeometry(size * .18, size * .18, size * .06);
	notch.translate(-size * .22, size * .59, size * .47);
	return finish(mergeParts([
		box,
		step,
		notch
	]));
}
function makeLBracket() {
	const a = new BoxGeometry(40, 4, 20);
	a.translate(0, 2, 0);
	const b = new BoxGeometry(4, 40, 20);
	b.translate(-18, 20, 0);
	return finish(mergeParts([a, b]));
}
function makeHexBolt() {
	const head = new ExtrudeGeometry(hexShape(13), {
		depth: 5.5,
		bevelEnabled: false
	});
	head.rotateX(-Math.PI / 2);
	head.translate(0, 20, 0);
	const shaft = new CylinderGeometry(4, 4, 20, 24);
	shaft.translate(0, 10, 0);
	return finish(mergeParts([head, shaft]));
}
function makeHexNut() {
	const shape = hexShape(13);
	const hole = new Path();
	hole.absarc(0, 0, 3.4, 0, Math.PI * 2, true);
	shape.holes.push(hole);
	const geo = new ExtrudeGeometry(shape, {
		depth: 6.4,
		bevelEnabled: false,
		curveSegments: 24
	});
	geo.rotateX(-Math.PI / 2);
	return finish(geo);
}
function makePlate() {
	const shape = new Shape();
	shape.moveTo(-30, -20);
	shape.lineTo(30, -20);
	shape.lineTo(30, 20);
	shape.lineTo(-30, 20);
	shape.closePath();
	for (const [x, y] of [
		[-22, -12],
		[22, -12],
		[-22, 12],
		[22, 12]
	]) {
		const p = new Path();
		p.absarc(x, y, 3, 0, Math.PI * 2, true);
		shape.holes.push(p);
	}
	const geo = new ExtrudeGeometry(shape, {
		depth: 4,
		bevelEnabled: false,
		curveSegments: 20
	});
	geo.rotateX(-Math.PI / 2);
	return finish(geo);
}
function makeGear(teeth = 16) {
	const rInner = 13.2;
	const rOuter = 18.4;
	const shape = new Shape();
	for (let i = 0; i < teeth; i++) {
		const a0 = i / teeth * Math.PI * 2;
		const a1 = a0 + Math.PI * 2 / teeth * .28;
		a0 + Math.PI * 2 / teeth * .5;
		const a3 = a0 + Math.PI * 2 / teeth * .78;
		const a4 = a0 + Math.PI * 2 / teeth;
		const pts = [
			[
				Math.cos(a0) * rInner,
				Math.sin(a0) * rInner,
				0
			],
			[
				Math.cos(a1) * rInner,
				Math.sin(a1) * rInner,
				0
			],
			[
				Math.cos(a1) * rOuter,
				Math.sin(a1) * rOuter,
				0
			],
			[
				Math.cos(a3) * rOuter,
				Math.sin(a3) * rOuter,
				0
			],
			[
				Math.cos(a3) * rInner,
				Math.sin(a3) * rInner,
				0
			],
			[
				Math.cos(a4) * rInner,
				Math.sin(a4) * rInner,
				0
			]
		];
		for (let p = 0; p < pts.length; p++) {
			const pt = pts[p];
			if (i === 0 && p === 0) shape.moveTo(pt[0], pt[1]);
			else shape.lineTo(pt[0], pt[1]);
		}
	}
	shape.closePath();
	const hole = new Path();
	hole.absarc(0, 0, 5, 0, Math.PI * 2, true);
	shape.holes.push(hole);
	const geo = new ExtrudeGeometry(shape, {
		depth: 6,
		bevelEnabled: false,
		curveSegments: 12
	});
	geo.rotateX(-Math.PI / 2);
	return finish(geo);
}
function workshopKit() {
	return [
		{
			name: "CAL-20.stl",
			geometry: makeCalibrationCube(20),
			color: 14212838
		},
		{
			name: "BRACKET-L.stl",
			geometry: makeLBracket(),
			color: 11450564
		},
		{
			name: "HEX-M8.stl",
			geometry: makeHexBolt(),
			color: 9410723
		},
		{
			name: "NUT-M8.stl",
			geometry: makeHexNut(),
			color: 13620958
		},
		{
			name: "PLATE-60.stl",
			geometry: makePlate(),
			color: 15261908
		},
		{
			name: "GEAR-16.stl",
			geometry: makeGear(16),
			color: 11845814
		}
	];
}
var _raycaster = new Raycaster();
var _pointer = new Vector2();
var _box = new Box3();
var _size = new Vector3();
var _v = new Vector3();
function readTrs(obj) {
	return {
		pos: obj.position.clone(),
		quat: obj.quaternion.clone(),
		scale: obj.scale.clone()
	};
}
function writeTrs(obj, t) {
	obj.position.copy(t.pos);
	obj.quaternion.copy(t.quat);
	obj.scale.copy(t.scale);
	obj.updateMatrixWorld(true);
}
function makeMatcapTexture() {
	const size = 256;
	const canvas = document.createElement("canvas");
	canvas.width = size;
	canvas.height = size;
	const ctx = canvas.getContext("2d");
	const img = ctx.createImageData(size, size);
	for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
		const nx = x / size * 2 - 1;
		const ny = y / size * 2 - 1;
		const r2 = nx * nx + ny * ny;
		const i = (y * size + x) * 4;
		const nz = Math.sqrt(Math.max(0, 1 - r2));
		const ndl = Math.max(0, nx * .25 + ny * .55 + nz * .78);
		const spec = Math.pow(ndl, 24);
		const rim = Math.pow(1 - nz, 3) * 40;
		const v = r2 > 1.05 ? 18 : 48 + ndl * 155 + spec * 48 + rim;
		img.data[i] = v;
		img.data[i + 1] = v + 2;
		img.data[i + 2] = v + 6;
		img.data[i + 3] = 255;
	}
	ctx.putImageData(img, 0, 0);
	const tex = new CanvasTexture(canvas);
	tex.colorSpace = SRGBColorSpace;
	return tex;
}
function faceLabelTexture(text) {
	const s = 128;
	const c = document.createElement("canvas");
	c.width = s;
	c.height = s;
	const ctx = c.getContext("2d");
	ctx.fillStyle = "#1a1b1e";
	ctx.fillRect(0, 0, s, s);
	ctx.strokeStyle = "#3a3c42";
	ctx.lineWidth = 4;
	ctx.strokeRect(2, 2, 124, 124);
	ctx.fillStyle = "#d0d4db";
	ctx.font = "600 22px 'IBM Plex Mono', monospace";
	ctx.textAlign = "center";
	ctx.textBaseline = "middle";
	ctx.fillText(text, s / 2, s / 2);
	const tex = new CanvasTexture(c);
	tex.colorSpace = SRGBColorSpace;
	return tex;
}
function measureSprite(text) {
	const c = document.createElement("canvas");
	c.width = 512;
	c.height = 128;
	const ctx = c.getContext("2d");
	ctx.clearRect(0, 0, 512, 128);
	ctx.fillStyle = "rgba(12,12,14,0.82)";
	roundRect(ctx, 16, 24, 480, 80, 10);
	ctx.fill();
	ctx.strokeStyle = "rgba(208,212,219,0.35)";
	ctx.lineWidth = 2;
	ctx.stroke();
	ctx.fillStyle = "#ecece8";
	ctx.font = "600 48px 'IBM Plex Mono', ui-monospace, monospace";
	ctx.textAlign = "center";
	ctx.textBaseline = "middle";
	ctx.fillText(text, 256, 64);
	const tex = new CanvasTexture(c);
	tex.colorSpace = SRGBColorSpace;
	const mat = new SpriteMaterial({
		map: tex,
		depthTest: false,
		transparent: true
	});
	const sprite = new Sprite(mat);
	sprite.scale.set(28, 7, 1);
	sprite.renderOrder = 20;
	return sprite;
}
function roundRect(ctx, x, y, w, h, r) {
	ctx.beginPath();
	ctx.moveTo(x + r, y);
	ctx.arcTo(x + w, y, x + w, y + h, r);
	ctx.arcTo(x + w, y + h, x, y + h, r);
	ctx.arcTo(x, y + h, x, y, r);
	ctx.arcTo(x, y, x + w, y, r);
	ctx.closePath();
}
var ViewerEngine = class {
	canvas;
	renderer;
	scene;
	persp;
	ortho;
	camera;
	controls;
	tcontrols;
	grid;
	axes;
	bedGroup;
	volumeHelper = null;
	dirLight;
	matcap;
	envTex;
	parts = [];
	selectedId = null;
	tool = "select";
	units = "mm";
	renderMode = "studio";
	usingOrtho = false;
	showGrid = true;
	showAxes = true;
	showShadows = true;
	showEdges = true;
	snapOn = true;
	explodeAmt = 0;
	sectionOn = false;
	sectionAxis = "y";
	sectionPos = .5;
	clipPlane = new Plane(new Vector3(0, -1, 0), 0);
	printerId = "ender3";
	colorIndex = 0;
	nextId = 1;
	snapshot = { ...EMPTY_SNAPSHOT };
	listeners = /* @__PURE__ */ new Set();
	toastTimer = null;
	raf = 0;
	lastT = 0;
	disposed = false;
	resizeObs;
	pointerStart = {
		x: 0,
		y: 0,
		t: 0
	};
	hoverHelper = null;
	hoverKey = "";
	faceA = null;
	faceB = null;
	measurePts = [];
	measureGroup = new Group();
	undoStack = [];
	redoStack = [];
	dragStart = null;
	cubeScene = new Scene();
	cubeCamera = new PerspectiveCamera(50, 1, .1, 20);
	cubeMesh;
	triadScene = new Scene();
	triadCamera = new PerspectiveCamera(50, 1, .1, 20);
	camAnim = null;
	loader = new STLLoader();
	exporter = new STLExporter();
	constructor(canvas) {
		this.canvas = canvas;
		this.renderer = new WebGLRenderer({
			canvas,
			antialias: true,
			alpha: false,
			preserveDrawingBuffer: false,
			powerPreference: "high-performance"
		});
		this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
		this.renderer.setClearColor(1052948, 1);
		this.renderer.outputColorSpace = SRGBColorSpace;
		this.renderer.toneMapping = 4;
		this.renderer.toneMappingExposure = 1.25;
		this.renderer.shadowMap.enabled = true;
		this.renderer.shadowMap.type = 1;
		this.renderer.localClippingEnabled = true;
		this.scene = new Scene();
		this.scene.background = new Color(1052948);
		this.scene.fog = new Fog(1052948, 520, 1600);
		this.persp = new PerspectiveCamera(46, 1, .1, 4e3);
		this.persp.position.set(160, 120, 190);
		this.ortho = new OrthographicCamera(-100, 100, 100, -100, .1, 4e3);
		this.camera = this.persp;
		this.controls = new OrbitControls(this.persp, canvas);
		this.controls.enableDamping = true;
		this.controls.dampingFactor = .08;
		this.controls.screenSpacePanning = true;
		this.controls.minDistance = 5;
		this.controls.maxDistance = 2500;
		this.controls.target.set(0, 20, 0);
		const pmrem = new PMREMGenerator(this.renderer);
		this.envTex = pmrem.fromScene(new RoomEnvironment(), .04).texture;
		this.scene.environment = this.envTex;
		pmrem.dispose();
		this.matcap = makeMatcapTexture();
		this.scene.add(new AmbientLight(13159892, .55));
		const hemi = new HemisphereLight(15265524, 2763826, .85);
		this.scene.add(hemi);
		this.dirLight = new DirectionalLight(16775408, 1.45);
		this.dirLight.position.set(80, 160, 70);
		this.dirLight.castShadow = true;
		this.dirLight.shadow.mapSize.set(1024, 1024);
		this.dirLight.shadow.camera.near = 10;
		this.dirLight.shadow.camera.far = 500;
		this.dirLight.shadow.camera.left = -180;
		this.dirLight.shadow.camera.right = 180;
		this.dirLight.shadow.camera.top = 180;
		this.dirLight.shadow.camera.bottom = -180;
		this.dirLight.shadow.bias = -15e-5;
		this.scene.add(this.dirLight);
		const fill = new DirectionalLight(10135739, .35);
		fill.position.set(-90, 40, -60);
		this.scene.add(fill);
		this.grid = new GridHelper(220, 22, 3816772, 2237739);
		this.grid.position.y = .02;
		this.scene.add(this.grid);
		this.axes = new AxesHelper(36);
		this.scene.add(this.axes);
		this.bedGroup = new Group();
		this.scene.add(this.bedGroup);
		this.rebuildBed();
		this.tcontrols = new TransformControls(this.persp, canvas);
		this.tcontrols.setSize(.85);
		this.tcontrols.addEventListener("dragging-changed", (e) => {
			this.controls.enabled = !Boolean(e.value);
			if (e.value) {
				const p = this.selected();
				this.dragStart = p ? readTrs(p.mesh) : null;
			} else if (this.dragStart) {
				const p = this.selected();
				if (p) {
					const before = this.dragStart;
					const after = readTrs(p.mesh);
					if (before.pos.distanceTo(after.pos) > 1e-6 || before.quat.angleTo(after.quat) > 1e-6) this.pushUndo({
						name: "Transform",
						undo: () => {
							writeTrs(p.mesh, before);
							this.emit();
						},
						redo: () => {
							writeTrs(p.mesh, after);
							this.emit();
						}
					});
				}
				this.dragStart = null;
				this.emit();
			}
		});
		this.tcontrols.addEventListener("change", () => {
			if (this.tcontrols.dragging) this.emit();
		});
		this.scene.add(this.tcontrols.getHelper());
		this.tcontrols.detach();
		this.measureGroup.renderOrder = 10;
		this.scene.add(this.measureGroup);
		const mats = [
			"RIGHT",
			"LEFT",
			"TOP",
			"BOTTOM",
			"FRONT",
			"BACK"
		].map((l) => new MeshBasicMaterial({ map: faceLabelTexture(l) }));
		this.cubeMesh = new Mesh(new BoxGeometry(1, 1, 1), mats);
		this.cubeScene.add(this.cubeMesh);
		const cubeEdges = new LineSegments(new EdgesGeometry(new BoxGeometry(1.002, 1.002, 1.002)), new LineBasicMaterial({ color: 9146778 }));
		this.cubeScene.add(cubeEdges);
		this.cubeScene.add(new AmbientLight(16777215, 1));
		const triad = new AxesHelper(1);
		this.triadScene.add(triad);
		this.resize();
		this.resizeObs = new ResizeObserver(() => this.resize());
		if (canvas.parentElement) this.resizeObs.observe(canvas.parentElement);
		canvas.addEventListener("pointerdown", this.onPointerDown);
		canvas.addEventListener("pointerup", this.onPointerUp);
		canvas.addEventListener("pointermove", this.onPointerMove);
		canvas.addEventListener("dblclick", this.onDblClick);
		canvas.style.touchAction = "none";
		this.snapshot = this.computeSnapshot();
		this.loop(0);
	}
	subscribe = (fn) => {
		this.listeners.add(fn);
		return () => {
			this.listeners.delete(fn);
		};
	};
	getSnapshot = () => this.snapshot;
	emit() {
		this.snapshot = this.computeSnapshot();
		this.listeners.forEach((fn) => fn());
	}
	flash(msg, ms = 2200) {
		this.snapshot = {
			...this.computeSnapshot(),
			toast: msg
		};
		this.listeners.forEach((fn) => fn());
		if (this.toastTimer) window.clearTimeout(this.toastTimer);
		this.toastTimer = window.setTimeout(() => {
			this.toastTimer = null;
			this.emit();
		}, ms);
	}
	selected() {
		return this.parts.find((p) => p.id === this.selectedId) ?? null;
	}
	partById(id) {
		return this.parts.find((p) => p.id === id) ?? null;
	}
	computeSnapshot() {
		const parts = this.parts.map((p) => {
			p.mesh.updateMatrixWorld(true);
			_box.setFromObject(p.mesh);
			_box.getSize(_size);
			const e = new Euler().setFromQuaternion(p.mesh.quaternion, "XYZ");
			return {
				id: p.id,
				name: p.name,
				color: "#" + p.baseColor.getHexString(),
				visible: p.visible,
				locked: p.locked,
				triCount: p.triCount,
				bytes: p.sizeBytes,
				position: [
					p.mesh.position.x,
					p.mesh.position.y,
					p.mesh.position.z
				],
				rotationDeg: [
					MathUtils.radToDeg(e.x),
					MathUtils.radToDeg(e.y),
					MathUtils.radToDeg(e.z)
				],
				scale: [
					p.mesh.scale.x,
					p.mesh.scale.y,
					p.mesh.scale.z
				],
				size: [
					_size.x,
					_size.y,
					_size.z
				],
				volume: p.volume * p.mesh.scale.x * p.mesh.scale.y * p.mesh.scale.z,
				area: p.area
			};
		});
		const toast = this.toastTimer !== null ? this.snapshot.toast ?? null : null;
		return {
			parts,
			selectedId: this.selectedId,
			tool: this.tool,
			units: this.units,
			renderMode: this.renderMode,
			ortho: this.usingOrtho,
			grid: this.showGrid,
			axes: this.showAxes,
			shadows: this.showShadows,
			edges: this.showEdges,
			snap: this.snapOn,
			explode: this.explodeAmt,
			sectionOn: this.sectionOn,
			sectionAxis: this.sectionAxis,
			sectionPos: this.sectionPos,
			printerId: this.printerId,
			measureMm: this.measurePts.length === 2 ? this.measurePts[0].distanceTo(this.measurePts[1]) : null,
			mateA: this.faceA ? this.partById(this.faceA.partId)?.name ?? "A" : null,
			mateB: this.faceB ? this.partById(this.faceB.partId)?.name ?? "B" : null,
			mateReady: !!(this.faceA && this.faceB && this.faceA.partId !== this.faceB.partId),
			hoverHint: this.hintText(),
			toast,
			stats: {
				tris: this.parts.reduce((s, p) => s + p.triCount, 0),
				parts: this.parts.length,
				volume: parts.reduce((s, p) => s + p.volume, 0)
			},
			canUndo: this.undoStack.length > 0,
			canRedo: this.redoStack.length > 0,
			undoLabel: this.undoStack.at(-1)?.name ?? "",
			redoLabel: this.redoStack.at(-1)?.name ?? ""
		};
	}
	hintText() {
		if (!this.parts.length) return "Drop STL files or load the workshop kit";
		switch (this.tool) {
			case "mate":
				if (!this.faceA) return "Click a planar face on the fixed part";
				if (!this.faceB) return "Click a face on the moving part";
				return "Faces ready — Mate, or click again to replace B";
			case "measure": return this.measurePts.length === 1 ? "Click the second point" : "Click two points · snaps to vertices";
			case "section": return "Drag the section slider in the inspector";
			case "move": return "Drag the gizmo · arrows nudge · Shift = 1 mm";
			case "rotate": return "Drag rings to rotate · 90° buttons in inspector";
			case "scale": return "Drag the gizmo or set exact size";
			default: return "Orbit · pan · zoom · double-click a part to isolate";
		}
	}
	pushUndo(cmd) {
		this.undoStack.push(cmd);
		if (this.undoStack.length > 60) this.undoStack.shift();
		this.redoStack = [];
	}
	undo() {
		const cmd = this.undoStack.pop();
		if (!cmd) return;
		cmd.undo();
		this.redoStack.push(cmd);
		this.syncGizmo();
		this.emit();
		this.flash(`Undo ${cmd.name}`);
	}
	redo() {
		const cmd = this.redoStack.pop();
		if (!cmd) return;
		cmd.redo();
		this.undoStack.push(cmd);
		this.syncGizmo();
		this.emit();
		this.flash(`Redo ${cmd.name}`);
	}
	loop = (t) => {
		if (this.disposed) return;
		this.raf = requestAnimationFrame(this.loop);
		const dt = Math.min(.05, (t - this.lastT) / 1e3 || .016);
		this.lastT = t;
		if (this.camAnim) {
			this.controls.enableDamping = false;
			this.camAnim.t += dt;
			const k = Math.min(1, this.camAnim.t / this.camAnim.dur);
			const e = 1 - Math.pow(1 - k, 3);
			this.persp.position.lerpVectors(this.camAnim.fromP, this.camAnim.toP, e);
			this.controls.target.lerpVectors(this.camAnim.fromT, this.camAnim.toT, e);
			if (k >= 1) {
				this.persp.position.copy(this.camAnim.toP);
				this.controls.target.copy(this.camAnim.toT);
				this.camAnim = null;
				this.controls.enableDamping = true;
			}
		}
		this.controls.update();
		this.syncOrthoFromPersp();
		this.renderer.setScissorTest(false);
		const cam = this.activeCam();
		this.renderer.render(this.scene, cam);
		this.renderOverlays();
	};
	activeCam() {
		return this.usingOrtho ? this.ortho : this.persp;
	}
	syncOrthoFromPersp() {
		const wrap = this.canvas.parentElement;
		const w = wrap?.clientWidth || this.canvas.clientWidth || 1;
		const h = wrap?.clientHeight || this.canvas.clientHeight || 1;
		const aspect = w / Math.max(h, 1);
		const hh = this.persp.position.distanceTo(this.controls.target) * Math.tan(MathUtils.degToRad(this.persp.fov / 2));
		this.ortho.left = -hh * aspect;
		this.ortho.right = hh * aspect;
		this.ortho.top = hh;
		this.ortho.bottom = -hh;
		this.ortho.position.copy(this.persp.position);
		this.ortho.quaternion.copy(this.persp.quaternion);
		this.ortho.near = this.persp.near;
		this.ortho.far = this.persp.far;
		this.ortho.updateProjectionMatrix();
		this.tcontrols.camera = this.activeCam();
	}
	renderOverlays() {
		const wrap = this.canvas.parentElement;
		const w = wrap?.clientWidth || 1;
		const h = wrap?.clientHeight || 1;
		const dpr = this.renderer.getPixelRatio();
		const cube = Math.round(Math.min(96, Math.max(64, w * .11)));
		const margin = 12;
		const cubeX = w - cube - margin;
		const cubeY = h - cube - margin;
		const dir = this.persp.position.clone().sub(this.controls.target).normalize();
		this.cubeCamera.position.copy(dir).multiplyScalar(2.6);
		this.cubeCamera.up.copy(this.persp.up);
		this.cubeCamera.lookAt(0, 0, 0);
		this.cubeCamera.updateProjectionMatrix();
		this.renderer.setScissorTest(true);
		this.renderer.clearDepth();
		this.renderer.setViewport(cubeX * dpr, cubeY * dpr, cube * dpr, cube * dpr);
		this.renderer.setScissor(cubeX * dpr, cubeY * dpr, cube * dpr, cube * dpr);
		this.renderer.render(this.cubeScene, this.cubeCamera);
		const tri = 72;
		this.triadCamera.position.copy(dir).multiplyScalar(3.2);
		this.triadCamera.up.copy(this.persp.up);
		this.triadCamera.lookAt(0, 0, 0);
		this.renderer.setViewport(margin * dpr, margin * dpr, tri * dpr, tri * dpr);
		this.renderer.setScissor(margin * dpr, margin * dpr, tri * dpr, tri * dpr);
		this.renderer.render(this.triadScene, this.triadCamera);
		this.renderer.setScissorTest(false);
		this.renderer.setViewport(0, 0, w * dpr, h * dpr);
	}
	cubeRect() {
		const wrap = this.canvas.parentElement;
		const w = wrap?.clientWidth || 1;
		wrap?.clientHeight;
		const cube = Math.round(Math.min(96, Math.max(64, w * .11)));
		const margin = 12;
		return {
			x: w - cube - margin,
			y: margin,
			size: cube
		};
	}
	resize() {
		const wrap = this.canvas.parentElement;
		const w = Math.max(1, wrap?.clientWidth || this.canvas.clientWidth || 1);
		const h = Math.max(1, wrap?.clientHeight || this.canvas.clientHeight || 1);
		this.renderer.setSize(w, h, false);
		this.persp.aspect = w / h;
		this.persp.updateProjectionMatrix();
		this.syncOrthoFromPersp();
	}
	dispose() {
		this.disposed = true;
		cancelAnimationFrame(this.raf);
		this.resizeObs.disconnect();
		this.canvas.removeEventListener("pointerdown", this.onPointerDown);
		this.canvas.removeEventListener("pointerup", this.onPointerUp);
		this.canvas.removeEventListener("pointermove", this.onPointerMove);
		this.canvas.removeEventListener("dblclick", this.onDblClick);
		this.tcontrols.dispose();
		this.controls.dispose();
		for (const p of this.parts) this.disposePart(p);
		this.renderer.dispose();
		this.matcap.dispose();
		this.envTex.dispose();
	}
	disposePart(p) {
		this.scene.remove(p.mesh);
		p.mesh.geometry.dispose();
		const mat = p.mesh.material;
		if (Array.isArray(mat)) mat.forEach((m) => m.dispose());
		else mat.dispose();
		p.edges.geometry.dispose();
		p.edges.material.dispose();
		p.originalGeometry.dispose();
	}
	makeMaterial(color, opacity, vertexColors = false) {
		const side = 2;
		switch (this.renderMode) {
			case "clay": return new MeshMatcapMaterial({
				color: 14210252,
				matcap: this.matcap,
				side
			});
			case "metal": return new MeshStandardMaterial({
				color,
				metalness: .86,
				roughness: .26,
				envMapIntensity: 1.1,
				side
			});
			case "wire": return new MeshBasicMaterial({
				color,
				wireframe: true,
				side
			});
			case "xray": return new MeshPhysicalMaterial({
				color,
				transparent: true,
				opacity: .22,
				depthWrite: false,
				roughness: .2,
				metalness: .1,
				side
			});
			case "normal": return new MeshNormalMaterial({ side });
			case "print": return new MeshLambertMaterial({
				vertexColors: true,
				side
			});
			default: return new MeshStandardMaterial({
				color,
				metalness: .08,
				roughness: .52,
				envMapIntensity: .55,
				side,
				transparent: opacity < .999,
				opacity
			});
		}
	}
	applyMaterials() {
		for (const p of this.parts) {
			const old = p.mesh.material;
			if (this.renderMode === "print") applyOverhangColors(p.mesh);
			p.mesh.material = this.makeMaterial(p.baseColor, p.opacity, this.renderMode === "print");
			if (Array.isArray(old)) old.forEach((m) => m.dispose());
			else old.dispose();
			p.edges.visible = this.showEdges && this.renderMode !== "wire" && this.renderMode !== "xray";
			p.mesh.castShadow = this.showShadows && this.renderMode !== "xray" && this.renderMode !== "wire";
			p.mesh.receiveShadow = this.showShadows;
		}
	}
	addPrepared(geometry, name, sizeBytes, colorHex, position) {
		const geo = prepareGeometry(geometry);
		const color = new Color(colorHex ?? PART_COLORS[this.colorIndex % PART_COLORS.length]);
		this.colorIndex++;
		const mesh = new Mesh(geo, this.makeMaterial(color, 1));
		mesh.castShadow = this.showShadows;
		mesh.receiveShadow = this.showShadows;
		if (position) mesh.position.copy(position);
		const edges = new LineSegments(new EdgesGeometry(geo, 24), new LineBasicMaterial({
			color: 921362,
			transparent: true,
			opacity: .42
		}));
		edges.visible = this.showEdges;
		mesh.add(edges);
		const id = this.nextId++;
		mesh.userData.partId = id;
		const topo = buildTopology(geo);
		const part = {
			id,
			name,
			mesh,
			edges,
			originalGeometry: geo.clone(),
			topology: topo,
			sizeBytes,
			triCount: Math.round(triCountOf(geo)),
			volume: volumeOf(geo),
			area: areaOf(geo),
			visible: true,
			locked: false,
			baseColor: color,
			opacity: 1,
			restPosition: mesh.position.clone()
		};
		this.parts.push(part);
		this.scene.add(mesh);
		this.select(id);
		return part;
	}
	loadFiles(fileList) {
		const files = Array.from(fileList).filter((f) => f.name.toLowerCase().endsWith(".stl") || f.type && (f.type.includes("stl") || f.type === "application/sla"));
		if (!files.length) {
			this.flash("No STL files found");
			return;
		}
		let cursor = 0;
		files.forEach((file, i) => {
			const reader = new FileReader();
			reader.onload = () => {
				try {
					const geom = this.loader.parse(reader.result);
					sitOnPlate(geom);
					const part = this.addPrepared(geom, file.name, file.size);
					if (files.length > 1) {
						_box.setFromObject(part.mesh);
						_box.getSize(_size);
						part.mesh.position.x = cursor + _size.x / 2;
						cursor += _size.x + 8;
						part.restPosition.copy(part.mesh.position);
					}
					if (i === files.length - 1) {
						this.fitAll();
						this.flash(`Loaded ${files.length} part${files.length > 1 ? "s" : ""}`);
					}
					this.emit();
				} catch (err) {
					console.error(err);
					this.flash(`Failed to parse ${file.name}`);
				}
			};
			reader.readAsArrayBuffer(file);
		});
	}
	loadKit() {
		const kit = workshopKit();
		let cursor = 0;
		const added = [];
		for (const item of kit) try {
			const part = this.addPrepared(item.geometry, item.name, 0, item.color);
			_box.setFromObject(part.mesh);
			_box.getSize(_size);
			part.mesh.position.x = cursor + _size.x / 2;
			cursor += _size.x + 10;
			part.restPosition.copy(part.mesh.position);
			added.push(part);
		} catch (err) {
			console.error("kit part failed", item.name, err);
		}
		if (added.length) {
			const groupBox = new Box3();
			for (const p of added) groupBox.expandByObject(p.mesh);
			const gc = groupBox.getCenter(new Vector3());
			for (const p of added) {
				p.mesh.position.x -= gc.x;
				p.mesh.position.z -= gc.z;
				dropMeshToBed(p.mesh);
				p.restPosition.copy(p.mesh.position);
			}
		}
		this.pushUndo({
			name: "Load kit",
			undo: () => {
				for (const p of added) this.removePartInternal(p.id);
				this.emit();
			},
			redo: () => {}
		});
		this.fitAll();
		this.flash("Workshop kit loaded — try Mate on two faces");
		this.emit();
	}
	select(id) {
		this.selectedId = id;
		for (const p of this.parts) {
			const mat = p.mesh.material;
			if ("emissive" in mat && mat.emissive) mat.emissive.setHex(p.id === id ? 1382946 : 0);
		}
		this.syncGizmo();
		this.emit();
	}
	syncGizmo() {
		const p = this.selected();
		if ((this.tool === "move" || this.tool === "rotate" || this.tool === "scale") && p && p.visible && !p.locked && this.explodeAmt < .01) {
			this.tcontrols.attach(p.mesh);
			const mode = this.tool === "move" ? "translate" : this.tool === "rotate" ? "rotate" : "scale";
			this.tcontrols.setMode(mode);
			this.tcontrols.setTranslationSnap(this.snapOn ? 1 : null);
			this.tcontrols.setRotationSnap(this.snapOn ? Math.PI / 12 : null);
			this.tcontrols.setScaleSnap(this.snapOn ? .05 : null);
		} else this.tcontrols.detach();
	}
	setTool(tool) {
		this.tool = tool;
		if (tool !== "mate") this.canvas.style.cursor = "";
		else this.canvas.style.cursor = "crosshair";
		if (tool === "measure") this.canvas.style.cursor = "crosshair";
		this.syncGizmo();
		this.emit();
	}
	toggleSnap() {
		this.snapOn = !this.snapOn;
		this.syncGizmo();
		this.emit();
	}
	setUnits(u) {
		this.units = u;
		this.emit();
	}
	setRenderMode(mode) {
		this.renderMode = mode;
		this.applyMaterials();
		this.emit();
	}
	setOrtho(on) {
		this.usingOrtho = on;
		this.controls.object = this.activeCam();
		this.syncGizmo();
		this.emit();
	}
	setGrid(on) {
		this.showGrid = on;
		this.grid.visible = on;
		this.bedGroup.visible = on;
		this.emit();
	}
	setAxes(on) {
		this.showAxes = on;
		this.axes.visible = on;
		this.emit();
	}
	setShadows(on) {
		this.showShadows = on;
		this.renderer.shadowMap.enabled = on;
		this.dirLight.castShadow = on;
		this.applyMaterials();
		this.emit();
	}
	setEdges(on) {
		this.showEdges = on;
		this.applyMaterials();
		this.emit();
	}
	setPrinter(id) {
		this.printerId = id;
		this.rebuildBed();
		this.emit();
	}
	rebuildBed() {
		while (this.bedGroup.children.length) {
			const c = this.bedGroup.children[0];
			this.bedGroup.remove(c);
			if (c instanceof Mesh) {
				c.geometry.dispose();
				c.material.dispose();
			}
		}
		if (this.volumeHelper) {
			this.scene.remove(this.volumeHelper);
			this.volumeHelper.geometry.dispose();
			this.volumeHelper.material.dispose();
			this.volumeHelper = null;
		}
		const printer = PRINTERS.find((p) => p.id === this.printerId) ?? PRINTERS[0];
		const plane = new Mesh(new PlaneGeometry(printer.x, printer.z), new MeshStandardMaterial({
			color: 1842722,
			roughness: .9,
			metalness: .1,
			transparent: true,
			opacity: .55
		}));
		plane.rotation.x = -Math.PI / 2;
		plane.receiveShadow = true;
		this.bedGroup.add(plane);
		const outline = new LineLoop(new BufferGeometry().setFromPoints([
			new Vector3(-printer.x / 2, .04, -printer.z / 2),
			new Vector3(printer.x / 2, .04, -printer.z / 2),
			new Vector3(printer.x / 2, .04, printer.z / 2),
			new Vector3(-printer.x / 2, .04, printer.z / 2)
		]), new LineBasicMaterial({ color: 6054248 }));
		this.bedGroup.add(outline);
		this.grid.scale.set(printer.x / 220, 1, printer.z / 220);
		const vol = new BoxGeometry(printer.x, printer.y, printer.z);
		vol.translate(0, printer.y / 2, 0);
		this.volumeHelper = new LineSegments(new EdgesGeometry(vol), new LineBasicMaterial({
			color: 3816772,
			transparent: true,
			opacity: .55
		}));
		vol.dispose();
		this.scene.add(this.volumeHelper);
	}
	setPosition(x, y, z) {
		const p = this.selected();
		if (!p || p.locked) return;
		const before = readTrs(p.mesh);
		p.mesh.position.set(x, y, z);
		this.pushUndo({
			name: "Position",
			undo: () => writeTrs(p.mesh, before),
			redo: () => p.mesh.position.set(x, y, z)
		});
		this.emit();
	}
	setRotationDeg(x, y, z) {
		const p = this.selected();
		if (!p || p.locked) return;
		const before = readTrs(p.mesh);
		p.mesh.rotation.set(MathUtils.degToRad(x), MathUtils.degToRad(y), MathUtils.degToRad(z));
		const after = readTrs(p.mesh);
		this.pushUndo({
			name: "Rotate",
			undo: () => writeTrs(p.mesh, before),
			redo: () => writeTrs(p.mesh, after)
		});
		this.emit();
	}
	setScale(x, y, z) {
		const p = this.selected();
		if (!p || p.locked) return;
		const before = readTrs(p.mesh);
		p.mesh.scale.set(x, y, z);
		this.pushUndo({
			name: "Scale",
			undo: () => writeTrs(p.mesh, before),
			redo: () => p.mesh.scale.set(x, y, z)
		});
		this.emit();
	}
	setUniformScale(s) {
		this.setScale(s, s, s);
	}
	scaleLongestTo(mm) {
		const p = this.selected();
		if (!p || p.locked) return;
		_box.setFromObject(p.mesh);
		_box.getSize(_size);
		const k = mm / Math.max(_size.x, _size.y, _size.z, 1e-6);
		this.setScale(p.mesh.scale.x * k, p.mesh.scale.y * k, p.mesh.scale.z * k);
	}
	rotate90(axis) {
		const p = this.selected();
		if (!p || p.locked) return;
		const before = readTrs(p.mesh);
		const q = new Quaternion();
		const v = axis === "x" ? new Vector3(1, 0, 0) : axis === "y" ? new Vector3(0, 1, 0) : new Vector3(0, 0, 1);
		q.setFromAxisAngle(v, Math.PI / 2);
		p.mesh.quaternion.premultiply(q);
		const after = readTrs(p.mesh);
		this.pushUndo({
			name: `${axis.toUpperCase()} 90°`,
			undo: () => writeTrs(p.mesh, before),
			redo: () => writeTrs(p.mesh, after)
		});
		this.emit();
	}
	dropToBed(id) {
		const p = id != null ? this.partById(id) : this.selected();
		if (!p || p.locked) return;
		const before = readTrs(p.mesh);
		dropMeshToBed(p.mesh);
		const after = readTrs(p.mesh);
		this.pushUndo({
			name: "Drop to bed",
			undo: () => writeTrs(p.mesh, before),
			redo: () => writeTrs(p.mesh, after)
		});
		this.emit();
		this.flash("Dropped to bed");
	}
	centerOnBed(id) {
		const p = id != null ? this.partById(id) : this.selected();
		if (!p || p.locked) return;
		const before = readTrs(p.mesh);
		centerMeshOnBed(p.mesh);
		const after = readTrs(p.mesh);
		this.pushUndo({
			name: "Center",
			undo: () => writeTrs(p.mesh, before),
			redo: () => writeTrs(p.mesh, after)
		});
		this.emit();
	}
	dropAll() {
		const befores = this.parts.map((p) => ({
			id: p.id,
			trs: readTrs(p.mesh)
		}));
		for (const p of this.parts) if (!p.locked) dropMeshToBed(p.mesh);
		const afters = this.parts.map((p) => ({
			id: p.id,
			trs: readTrs(p.mesh)
		}));
		this.pushUndo({
			name: "Drop all",
			undo: () => {
				for (const b of befores) {
					const p = this.partById(b.id);
					if (p) writeTrs(p.mesh, b.trs);
				}
			},
			redo: () => {
				for (const a of afters) {
					const p = this.partById(a.id);
					if (p) writeTrs(p.mesh, a.trs);
				}
			}
		});
		this.emit();
		this.flash("All parts on the bed");
	}
	autoOrient() {
		const p = this.selected();
		if (!p || p.locked) return;
		const beforeGeo = p.mesh.geometry;
		const beforeTrs = readTrs(p.mesh);
		p.mesh.updateMatrixWorld(true);
		const baked = bakeWorld(p.mesh);
		const oriented = autoOrientGeometry(baked);
		baked.dispose();
		p.mesh.geometry = oriented;
		p.mesh.position.set(0, 0, 0);
		p.mesh.quaternion.identity();
		p.mesh.scale.set(1, 1, 1);
		this.rebuildEdges(p);
		p.topology = buildTopology(oriented);
		p.volume = volumeOf(oriented);
		p.area = areaOf(oriented);
		p.triCount = Math.round(triCountOf(oriented));
		this.clearFaces();
		this.pushUndo({
			name: "Auto-orient",
			undo: () => {
				p.mesh.geometry = beforeGeo;
				writeTrs(p.mesh, beforeTrs);
				this.rebuildEdges(p);
			},
			redo: () => {
				p.mesh.geometry = oriented;
				p.mesh.position.set(0, 0, 0);
				p.mesh.quaternion.identity();
				p.mesh.scale.set(1, 1, 1);
				this.rebuildEdges(p);
			}
		});
		this.fitPart(p.id);
		this.flash("Auto-oriented to flattest base");
		this.emit();
	}
	resetXform() {
		const p = this.selected();
		if (!p) return;
		const beforeGeo = p.mesh.geometry;
		const beforeTrs = readTrs(p.mesh);
		const restored = p.originalGeometry.clone();
		p.mesh.geometry = restored;
		p.mesh.position.set(0, 0, 0);
		p.mesh.quaternion.identity();
		p.mesh.scale.set(1, 1, 1);
		this.rebuildEdges(p);
		p.topology = buildTopology(restored);
		this.clearFaces();
		this.pushUndo({
			name: "Reset",
			undo: () => {
				p.mesh.geometry = beforeGeo;
				writeTrs(p.mesh, beforeTrs);
				this.rebuildEdges(p);
			},
			redo: () => {
				p.mesh.geometry = restored;
				p.mesh.position.set(0, 0, 0);
				p.mesh.quaternion.identity();
				p.mesh.scale.set(1, 1, 1);
				this.rebuildEdges(p);
			}
		});
		this.emit();
		this.flash("Reset to original");
	}
	mirror(axis) {
		const p = this.selected();
		if (!p || p.locked) return;
		const beforeGeo = p.mesh.geometry;
		const beforeTrs = readTrs(p.mesh);
		const baked = bakeWorld(p.mesh);
		const sx = axis === "x" ? -1 : 1;
		const sy = axis === "y" ? -1 : 1;
		const sz = axis === "z" ? -1 : 1;
		baked.scale(sx, sy, sz);
		sitOnPlate(baked);
		p.mesh.geometry = baked;
		p.mesh.position.set(0, 0, 0);
		p.mesh.quaternion.identity();
		p.mesh.scale.set(1, 1, 1);
		this.rebuildEdges(p);
		p.topology = buildTopology(baked);
		p.volume = volumeOf(baked);
		this.pushUndo({
			name: `Mirror ${axis.toUpperCase()}`,
			undo: () => {
				p.mesh.geometry = beforeGeo;
				writeTrs(p.mesh, beforeTrs);
				this.rebuildEdges(p);
			},
			redo: () => {
				p.mesh.geometry = baked;
				p.mesh.position.set(0, 0, 0);
				p.mesh.quaternion.identity();
				p.mesh.scale.set(1, 1, 1);
				this.rebuildEdges(p);
			}
		});
		this.emit();
	}
	rebuildEdges(p) {
		p.edges.geometry.dispose();
		p.edges.geometry = new EdgesGeometry(p.mesh.geometry, 24);
	}
	duplicate() {
		const p = this.selected();
		if (!p) return;
		const geo = p.mesh.geometry.clone();
		const clone = this.addPrepared(geo, p.name.replace(/\.stl$/i, "") + " copy", p.sizeBytes, p.baseColor.getHex());
		clone.mesh.position.copy(p.mesh.position);
		clone.mesh.quaternion.copy(p.mesh.quaternion);
		clone.mesh.scale.copy(p.mesh.scale);
		_box.setFromObject(p.mesh);
		_box.getSize(_size);
		clone.mesh.position.x += _size.x + 4;
		clone.restPosition.copy(clone.mesh.position);
		const id = clone.id;
		this.pushUndo({
			name: "Duplicate",
			undo: () => this.removePartInternal(id),
			redo: () => {}
		});
		this.flash("Duplicated");
		this.emit();
	}
	deleteSelected() {
		if (this.selectedId == null) return;
		this.deletePart(this.selectedId);
	}
	deletePart(id) {
		const p = this.partById(id);
		if (!p) return;
		this.removePartInternal(id);
		this.pushUndo({
			name: "Delete",
			undo: () => {
				this.parts.push(p);
				this.scene.add(p.mesh);
				this.select(p.id);
			},
			redo: () => this.removePartInternal(id)
		});
		this.flash("Deleted");
		this.emit();
	}
	removePartInternal(id) {
		const idx = this.parts.findIndex((p) => p.id === id);
		if (idx < 0) return;
		const p = this.parts[idx];
		if (this.faceA?.partId === id || this.faceB?.partId === id) this.clearFaces();
		if (this.tcontrols.object === p.mesh) this.tcontrols.detach();
		this.scene.remove(p.mesh);
		this.parts.splice(idx, 1);
		if (this.selectedId === id) this.selectedId = this.parts.at(-1)?.id ?? null;
		this.syncGizmo();
	}
	setVisible(id, visible) {
		const p = this.partById(id);
		if (!p) return;
		p.visible = visible;
		p.mesh.visible = visible;
		this.emit();
	}
	setLocked(id, locked) {
		const p = this.partById(id);
		if (!p) return;
		p.locked = locked;
		this.syncGizmo();
		this.emit();
	}
	setColor(hex) {
		const p = this.selected();
		if (!p) return;
		p.baseColor.set(hex);
		this.applyMaterials();
		this.emit();
	}
	setOpacity(v) {
		const p = this.selected();
		if (!p) return;
		p.opacity = v;
		this.applyMaterials();
		this.emit();
	}
	isolate(id) {
		for (const p of this.parts) {
			const vis = p.id === id;
			p.visible = vis;
			p.mesh.visible = vis;
		}
		this.select(id);
		this.fitPart(id);
	}
	showAll() {
		for (const p of this.parts) {
			p.visible = true;
			p.mesh.visible = true;
		}
		this.emit();
	}
	setExplode(v) {
		if (this.explodeAmt < .001 && v > 0) for (const p of this.parts) p.restPosition.copy(p.mesh.position);
		this.explodeAmt = v;
		const box = new Box3();
		for (const p of this.parts) box.expandByObject(p.mesh);
		const center = box.isEmpty() ? new Vector3() : box.getCenter(new Vector3());
		center.y = 0;
		for (const p of this.parts) {
			const dir = p.restPosition.clone().sub(center);
			dir.y *= .25;
			if (dir.lengthSq() < 1e-6) dir.set(p.id, 0, 0);
			p.mesh.position.copy(p.restPosition).addScaledVector(dir, v * 1.15);
		}
		this.syncGizmo();
		this.emit();
	}
	setSection(on, axis, pos) {
		this.sectionOn = on;
		if (axis) this.sectionAxis = axis;
		if (pos != null) this.sectionPos = pos;
		this.updateClip();
		this.emit();
	}
	updateClip() {
		if (!this.sectionOn) {
			this.renderer.clippingPlanes = [];
			return;
		}
		const box = new Box3();
		for (const p of this.parts) if (p.visible) box.expandByObject(p.mesh);
		if (box.isEmpty()) box.set(new Vector3(-50, 0, -50), new Vector3(50, 80, 50));
		const min = this.sectionAxis === "x" ? box.min.x : this.sectionAxis === "y" ? box.min.y : box.min.z;
		const v = min + ((this.sectionAxis === "x" ? box.max.x : this.sectionAxis === "y" ? box.max.y : box.max.z) - min) * this.sectionPos;
		const n = new Vector3(this.sectionAxis === "x" ? -1 : 0, this.sectionAxis === "y" ? -1 : 0, this.sectionAxis === "z" ? -1 : 0);
		this.clipPlane.setFromNormalAndCoplanarPoint(n, new Vector3(this.sectionAxis === "x" ? v : 0, this.sectionAxis === "y" ? v : 0, this.sectionAxis === "z" ? v : 0));
		this.renderer.clippingPlanes = [this.clipPlane];
	}
	clearFaces() {
		if (this.faceA) {
			this.faceA.helper.parent?.remove(this.faceA.helper);
			this.faceA.helper.geometry.dispose();
			this.faceA.helper.material.dispose();
		}
		if (this.faceB) {
			this.faceB.helper.parent?.remove(this.faceB.helper);
			this.faceB.helper.geometry.dispose();
			this.faceB.helper.material.dispose();
		}
		this.faceA = null;
		this.faceB = null;
		this.clearHover();
		this.emit();
	}
	clearHover() {
		if (this.hoverHelper) {
			this.hoverHelper.parent?.remove(this.hoverHelper);
			this.hoverHelper.geometry.dispose();
			this.hoverHelper.material.dispose();
			this.hoverHelper = null;
		}
		this.hoverKey = "";
	}
	makeFaceHelper(part, faces, color) {
		const geo = planarHelperGeometry(part.mesh.geometry, faces, .12);
		const mat = new MeshBasicMaterial({
			color,
			transparent: true,
			opacity: .72,
			depthTest: true,
			side: 2,
			polygonOffset: true,
			polygonOffsetFactor: -2
		});
		const helper = new Mesh(geo, mat);
		helper.renderOrder = 8;
		part.mesh.add(helper);
		return helper;
	}
	mate(offset = 0) {
		if (!this.faceA || !this.faceB) return;
		const a = this.partById(this.faceA.partId);
		const b = this.partById(this.faceB.partId);
		if (!a || !b || a.id === b.id || b.locked) return;
		a.mesh.updateMatrixWorld(true);
		b.mesh.updateMatrixWorld(true);
		const nA = this.faceA.localNormal.clone().transformDirection(a.mesh.matrixWorld).normalize();
		const pA = this.faceA.localPoint.clone().applyMatrix4(a.mesh.matrixWorld);
		const nB = this.faceB.localNormal.clone().transformDirection(b.mesh.matrixWorld).normalize();
		const pB = this.faceB.localPoint.clone().applyMatrix4(b.mesh.matrixWorld);
		const targetN = nA.clone().negate();
		const q = new Quaternion().setFromUnitVectors(nB, targetN);
		const before = readTrs(b.mesh);
		const newQuat = q.clone().multiply(b.mesh.quaternion);
		const origin = b.mesh.position.clone();
		const rel = pB.clone().sub(origin).applyQuaternion(q);
		const newPos = pA.clone().addScaledVector(nA, offset).sub(rel);
		b.mesh.quaternion.copy(newQuat);
		b.mesh.position.copy(newPos);
		b.mesh.updateMatrixWorld(true);
		const after = readTrs(b.mesh);
		this.pushUndo({
			name: "Mate faces",
			undo: () => writeTrs(b.mesh, before),
			redo: () => writeTrs(b.mesh, after)
		});
		this.select(b.id);
		this.flash("Faces mated");
		this.emit();
	}
	clearMeasure() {
		this.measurePts = [];
		while (this.measureGroup.children.length) {
			const c = this.measureGroup.children[0];
			this.measureGroup.remove(c);
			if (c instanceof Mesh || c instanceof Line || c instanceof Sprite) {
				c.geometry?.dispose?.();
				const mat = c.material;
				if (Array.isArray(mat)) mat.forEach((m) => m.dispose());
				else if (mat) {
					const m = mat;
					if (m.map) m.map.dispose();
					m.dispose();
				}
			}
		}
		this.emit();
	}
	rebuildMeasure() {
		this.clearMeasureKeepPts();
		const pts = this.measurePts;
		const sphereGeo = new SphereGeometry(.7, 16, 12);
		const mat = new MeshBasicMaterial({
			color: 13685979,
			depthTest: false
		});
		for (const p of pts) {
			const s = new Mesh(sphereGeo, mat);
			s.position.copy(p);
			s.renderOrder = 12;
			this.measureGroup.add(s);
		}
		if (pts.length === 2) {
			const g = new BufferGeometry().setFromPoints(pts);
			const line = new Line(g, new LineBasicMaterial({
				color: 13685979,
				depthTest: false
			}));
			line.renderOrder = 12;
			this.measureGroup.add(line);
			const d = pts[0].distanceTo(pts[1]);
			const label = measureSprite(this.fmtLen(d));
			label.position.copy(pts[0]).add(pts[1]).multiplyScalar(.5);
			this.measureGroup.add(label);
		}
	}
	clearMeasureKeepPts() {
		const pts = this.measurePts.slice();
		this.clearMeasure();
		this.measurePts = pts;
	}
	fmtLen(mm) {
		if (this.units === "in") return `${(mm / 25.4).toFixed(3)} in`;
		return `${mm.toFixed(2)} mm`;
	}
	fitAll() {
		if (!this.parts.length) return;
		const box = new Box3();
		for (const p of this.parts) if (p.visible) box.expandByObject(p.mesh);
		this.fitBox(box, 1.75);
	}
	fitPart(id) {
		const p = this.partById(id);
		if (!p) return;
		_box.setFromObject(p.mesh);
		this.fitBox(_box, 1.6);
	}
	fitBox(box, offset) {
		if (box.isEmpty()) return;
		const size = box.getSize(new Vector3());
		const center = box.getCenter(new Vector3());
		const maxDim = Math.max(size.x, size.y, size.z, 1);
		const fov = this.persp.fov * (Math.PI / 180);
		const dist = Math.abs(maxDim / 2 / Math.tan(fov / 2)) * offset;
		const dir = this.persp.position.clone().sub(this.controls.target);
		if (dir.lengthSq() < 1e-6) dir.set(.75, .55, 1);
		dir.normalize();
		this.animateCamera(center.clone().addScaledVector(dir, dist), center);
		this.persp.near = Math.max(maxDim / 400, .05);
		this.persp.far = maxDim * 80;
		this.persp.updateProjectionMatrix();
	}
	setView(preset) {
		const box = new Box3();
		for (const p of this.parts) if (p.visible) box.expandByObject(p.mesh);
		if (box.isEmpty()) box.set(new Vector3(-40, 0, -40), new Vector3(40, 40, 40));
		const center = box.getCenter(new Vector3());
		const size = box.getSize(new Vector3());
		const d = Math.max(size.x, size.y, size.z, 40) * 1.8;
		const dir = {
			iso: new Vector3(.75, .55, 1),
			front: new Vector3(0, .08, 1),
			back: new Vector3(0, .08, -1),
			right: new Vector3(1, .08, 0),
			left: new Vector3(-1, .08, 0),
			top: new Vector3(.001, 1, 0),
			bottom: new Vector3(.001, -1, 0)
		}[preset].clone().normalize();
		this.animateCamera(center.clone().addScaledVector(dir, d), center);
	}
	animateCamera(toP, toT) {
		this.camAnim = {
			fromP: this.persp.position.clone(),
			toP,
			fromT: this.controls.target.clone(),
			toT,
			t: 0,
			dur: .38
		};
	}
	eventToNdc(e) {
		const rect = this.canvas.getBoundingClientRect();
		_pointer.x = (e.clientX - rect.left) / rect.width * 2 - 1;
		_pointer.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
		return {
			x: e.clientX - rect.left,
			y: e.clientY - rect.top,
			rect
		};
	}
	hitCube(e) {
		const cube = this.cubeRect();
		const rect = this.canvas.getBoundingClientRect();
		const x = e.clientX - rect.left;
		const y = e.clientY - rect.top;
		if (x < cube.x || y < cube.y || x > cube.x + cube.size || y > cube.y + cube.size) return null;
		const nx = (x - cube.x) / cube.size * 2 - 1;
		const ny = -((y - cube.y) / cube.size) * 2 + 1;
		_raycaster.setFromCamera(new Vector2(nx, ny), this.cubeCamera);
		const hits = _raycaster.intersectObject(this.cubeMesh, false);
		if (!hits.length) return null;
		return [
			"right",
			"left",
			"top",
			"bottom",
			"front",
			"back"
		][hits[0].face?.materialIndex ?? 0] ?? "iso";
	}
	hitParts(e) {
		this.eventToNdc(e);
		_raycaster.setFromCamera(_pointer, this.activeCam());
		const meshes = this.parts.filter((p) => p.visible).map((p) => p.mesh);
		return _raycaster.intersectObjects(meshes, false);
	}
	onPointerDown = (e) => {
		this.pointerStart = {
			x: e.clientX,
			y: e.clientY,
			t: performance.now()
		};
		if (this.hitCube(e)) this.controls.enabled = false;
	};
	onPointerUp = (e) => {
		this.controls.enabled = true;
		const dx = e.clientX - this.pointerStart.x;
		const dy = e.clientY - this.pointerStart.y;
		if (dx * dx + dy * dy > 16) return;
		const view = this.hitCube(e);
		if (view) {
			this.setView(view);
			return;
		}
		if (this.tcontrols.dragging || this.tcontrols.axis) return;
		if (this.tool === "mate") {
			this.pickMate(e);
			return;
		}
		if (this.tool === "measure") {
			this.pickMeasure(e);
			return;
		}
		const hits = this.hitParts(e);
		if (hits.length) {
			const id = hits[0].object.userData.partId;
			const part = this.partById(id);
			if (part && !part.locked) this.select(id);
		} else if (this.tool === "select") this.select(null);
	};
	onPointerMove = (e) => {
		if (this.tool !== "mate" || this.tcontrols.dragging) return;
		const hits = this.hitParts(e);
		if (!hits.length) {
			this.clearHover();
			return;
		}
		const hit = hits[0];
		const id = hit.object.userData.partId;
		const part = this.partById(id);
		if (!part || hit.faceIndex == null) return;
		const faces = growPlanar(part.topology, hit.faceIndex);
		const key = `${id}:${faces[0]}:${faces.length}`;
		if (key === this.hoverKey) return;
		this.clearHover();
		this.hoverKey = key;
		this.hoverHelper = this.makeFaceHelper(part, faces, 13685979);
		this.hoverHelper.material.opacity = .38;
	};
	onDblClick = (e) => {
		const hits = this.hitParts(e);
		if (hits.length) {
			const id = hits[0].object.userData.partId;
			this.fitPart(id);
		} else this.fitAll();
	};
	pickMate(e) {
		const hits = this.hitParts(e);
		if (!hits.length) return;
		const hit = hits[0];
		const id = hit.object.userData.partId;
		const part = this.partById(id);
		if (!part || hit.faceIndex == null) return;
		const faces = growPlanar(part.topology, hit.faceIndex);
		const frame = faceLocalFrame(part.mesh.geometry, part.topology, faces);
		const entry = {
			partId: id,
			faces,
			localNormal: frame.localNormal,
			localPoint: frame.localPoint,
			helper: this.makeFaceHelper(part, faces, this.faceA ? 12107976 : 15263459)
		};
		if (!this.faceA) {
			this.faceA = entry;
			this.flash("Face A locked");
		} else if (id === this.faceA.partId) {
			this.flash("Pick a face on a different part");
			entry.helper.parent?.remove(entry.helper);
			entry.helper.geometry.dispose();
			return;
		} else {
			if (this.faceB) {
				this.faceB.helper.parent?.remove(this.faceB.helper);
				this.faceB.helper.geometry.dispose();
				this.faceB.helper.material.dispose();
			}
			this.faceB = entry;
			this.flash("Face B ready — mating");
			this.mate(0);
		}
		this.emit();
	}
	pickMeasure(e) {
		const hits = this.hitParts(e);
		if (!hits.length) return;
		const hit = hits[0];
		let pt = hit.point.clone();
		const part = this.partById(hit.object.userData.partId);
		if (part && hit.faceIndex != null) {
			const geo = part.mesh.geometry;
			const pos = geo.attributes.position;
			const idx = geo.index;
			const i = hit.faceIndex * 3;
			const verts = [
				idx ? idx.getX(i) : i,
				idx ? idx.getX(i + 1) : i + 1,
				idx ? idx.getX(i + 2) : i + 2
			].map((vi) => {
				return new Vector3().fromBufferAttribute(pos, vi).applyMatrix4(part.mesh.matrixWorld);
			});
			let best = pt;
			let bestD = Infinity;
			const rect = this.canvas.getBoundingClientRect();
			for (const v of verts) {
				_v.copy(v).project(this.activeCam());
				const sx = (_v.x * .5 + .5) * rect.width;
				const sy = (-_v.y * .5 + .5) * rect.height;
				const dx = sx - (e.clientX - rect.left);
				const dy = sy - (e.clientY - rect.top);
				const d = dx * dx + dy * dy;
				if (d < bestD && d < 196) {
					bestD = d;
					best = v;
				}
			}
			pt = best;
		}
		if (this.measurePts.length >= 2) this.measurePts = [];
		this.measurePts.push(pt);
		this.rebuildMeasure();
		this.emit();
		if (this.measurePts.length === 2) this.flash(this.fmtLen(this.measurePts[0].distanceTo(this.measurePts[1])));
	}
	nudge(dx, dy, dz) {
		const p = this.selected();
		if (!p || p.locked || this.tool !== "move") return;
		p.mesh.position.x += dx;
		p.mesh.position.y += dy;
		p.mesh.position.z += dz;
		this.emit();
	}
	exportSelected(binary = true) {
		const p = this.selected();
		if (!p) {
			this.flash("Select a part to export");
			return;
		}
		this.exportMeshes([p.mesh], p.name.replace(/\.stl$/i, "") + "_datum.stl", binary);
	}
	exportAssembly(binary = true) {
		const meshes = this.parts.filter((p) => p.visible).map((p) => p.mesh);
		if (!meshes.length) {
			this.flash("Nothing to export");
			return;
		}
		this.exportMeshes(meshes, "datum-assembly.stl", binary);
	}
	exportMeshes(meshes, filename, binary) {
		const group = new Group();
		const temps = [];
		for (const m of meshes) {
			const g = bakeWorld(m);
			temps.push(g);
			group.add(new Mesh(g));
		}
		const data = this.exporter.parse(group, { binary });
		temps.forEach((g) => g.dispose());
		const blob = new Blob([data], { type: "application/octet-stream" });
		const url = URL.createObjectURL(blob);
		const a = document.createElement("a");
		a.href = url;
		a.download = filename;
		a.click();
		URL.revokeObjectURL(url);
		this.flash(`Exported ${filename}`);
	}
	screenshot() {
		this.renderer.render(this.scene, this.activeCam());
		this.canvas.toBlob((blob) => {
			if (!blob) return;
			const url = URL.createObjectURL(blob);
			const a = document.createElement("a");
			a.href = url;
			a.download = "datum-view.png";
			a.click();
			URL.revokeObjectURL(url);
			this.flash("Screenshot saved");
		}, "image/png");
	}
	rename(id, name) {
		const p = this.partById(id);
		if (!p) return;
		p.name = name;
		this.emit();
	}
};
//#endregion
export { ViewerEngine };
