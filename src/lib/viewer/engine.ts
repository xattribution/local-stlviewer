import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { TransformControls } from "three/addons/controls/TransformControls.js";
import { STLLoader } from "three/addons/loaders/STLLoader.js";
import { STLExporter } from "three/addons/exporters/STLExporter.js";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";
import {
  type EngineSnapshot,
  type PartSnapshot,
  type RenderMode,
  type Tool,
  type Units,
  type ViewPreset,
  EMPTY_SNAPSHOT,
  PART_COLORS,
  PRINTERS,
} from "./types";
import { buildTopology, growPlanar, faceLocalFrame, planarHelperGeometry, type Topology } from "./topology";
import {
  prepareGeometry,
  sitOnPlate,
  volumeOf,
  areaOf,
  dropMeshToBed,
  centerMeshOnBed,
  bakeWorld,
  autoOrientGeometry,
  applyOverhangColors,
  triCountOf,
} from "./mesh-ops";
import { workshopKit } from "./primitives";

export interface Part {
  id: number;
  name: string;
  mesh: THREE.Mesh;
  edges: THREE.LineSegments;
  originalGeometry: THREE.BufferGeometry;
  topology: Topology;
  sizeBytes: number;
  triCount: number;
  volume: number;
  area: number;
  visible: boolean;
  locked: boolean;
  baseColor: THREE.Color;
  opacity: number;
  restPosition: THREE.Vector3;
}

interface FacePick {
  partId: number;
  faces: number[];
  localNormal: THREE.Vector3;
  localPoint: THREE.Vector3;
  helper: THREE.Mesh;
}

interface UndoCmd {
  name: string;
  undo: () => void;
  redo: () => void;
}

interface Trs {
  pos: THREE.Vector3;
  quat: THREE.Quaternion;
  scale: THREE.Vector3;
}

const _raycaster = new THREE.Raycaster();
const _pointer = new THREE.Vector2();
const _box = new THREE.Box3();
const _size = new THREE.Vector3();
const _v = new THREE.Vector3();

function readTrs(obj: THREE.Object3D): Trs {
  return {
    pos: obj.position.clone(),
    quat: obj.quaternion.clone(),
    scale: obj.scale.clone(),
  };
}

function writeTrs(obj: THREE.Object3D, t: Trs) {
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
  const ctx = canvas.getContext("2d")!;
  const img = ctx.createImageData(size, size);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const nx = (x / size) * 2 - 1;
      const ny = (y / size) * 2 - 1;
      const r2 = nx * nx + ny * ny;
      const i = (y * size + x) * 4;
      const nz = Math.sqrt(Math.max(0, 1 - r2));
      const ndl = Math.max(0, nx * 0.25 + ny * 0.55 + nz * 0.78);
      const spec = Math.pow(ndl, 24);
      const rim = Math.pow(1 - nz, 3) * 40;
      const v = r2 > 1.05 ? 18 : 48 + ndl * 155 + spec * 48 + rim;
      img.data[i] = v;
      img.data[i + 1] = v + 2;
      img.data[i + 2] = v + 6;
      img.data[i + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function faceLabelTexture(text: string) {
  const s = 128;
  const c = document.createElement("canvas");
  c.width = s;
  c.height = s;
  const ctx = c.getContext("2d")!;
  ctx.fillStyle = "#1a1b1e";
  ctx.fillRect(0, 0, s, s);
  ctx.strokeStyle = "#3a3c42";
  ctx.lineWidth = 4;
  ctx.strokeRect(2, 2, s - 4, s - 4);
  ctx.fillStyle = "#d0d4db";
  ctx.font = "600 22px 'IBM Plex Mono', monospace";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(text, s / 2, s / 2);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function measureSprite(text: string) {
  const c = document.createElement("canvas");
  c.width = 512;
  c.height = 128;
  const ctx = c.getContext("2d")!;
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
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  const mat = new THREE.SpriteMaterial({
    map: tex,
    depthTest: false,
    transparent: true,
  });
  const sprite = new THREE.Sprite(mat);
  sprite.scale.set(28, 7, 1);
  sprite.renderOrder = 20;
  return sprite;
}

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

export class ViewerEngine {
  readonly canvas: HTMLCanvasElement;
  private renderer: THREE.WebGLRenderer;
  private scene: THREE.Scene;
  private persp: THREE.PerspectiveCamera;
  private ortho: THREE.OrthographicCamera;
  private camera: THREE.Camera;
  private controls: OrbitControls;
  private tcontrols: TransformControls;
  private grid: THREE.GridHelper;
  private axes: THREE.AxesHelper;
  private bedGroup: THREE.Group;
  private volumeHelper: THREE.LineSegments | null = null;
  private dirLight: THREE.DirectionalLight;
  private matcap: THREE.Texture;
  private envTex: THREE.Texture;
  private parts: Part[] = [];
  private selectedId: number | null = null;
  private tool: Tool = "select";
  private units: Units = "mm";
  private renderMode: RenderMode = "studio";
  private usingOrtho = false;
  private showGrid = true;
  private showAxes = true;
  private showShadows = true;
  private showEdges = true;
  private snapOn = true;
  private explodeAmt = 0;
  private sectionOn = false;
  private sectionAxis: "x" | "y" | "z" = "y";
  private sectionPos = 0.5;
  private clipPlane = new THREE.Plane(new THREE.Vector3(0, -1, 0), 0);
  private printerId = "ender3";
  private colorIndex = 0;
  private nextId = 1;
  private snapshot: EngineSnapshot = { ...EMPTY_SNAPSHOT };
  private listeners = new Set<() => void>();
  private toastTimer: number | null = null;
  private raf = 0;
  private lastT = 0;
  private disposed = false;
  private resizeObs: ResizeObserver;
  private pointerStart = { x: 0, y: 0, t: 0 };
  private hoverHelper: THREE.Mesh | null = null;
  private hoverKey = "";
  private faceA: FacePick | null = null;
  private faceB: FacePick | null = null;
  private measurePts: THREE.Vector3[] = [];
  private measureGroup = new THREE.Group();
  private undoStack: UndoCmd[] = [];
  private redoStack: UndoCmd[] = [];
  private dragStart: Trs | null = null;
  private cubeScene = new THREE.Scene();
  private cubeCamera = new THREE.PerspectiveCamera(50, 1, 0.1, 20);
  private cubeMesh: THREE.Mesh;
  private triadScene = new THREE.Scene();
  private triadCamera = new THREE.PerspectiveCamera(50, 1, 0.1, 20);
  private camAnim: {
    fromP: THREE.Vector3;
    toP: THREE.Vector3;
    fromT: THREE.Vector3;
    toT: THREE.Vector3;
    t: number;
    dur: number;
  } | null = null;
  private loader = new STLLoader();
  private exporter = new STLExporter();

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    this.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      alpha: false,
      preserveDrawingBuffer: false,
      powerPreference: "high-performance",
    });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.renderer.setClearColor(0x101114, 1);
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.25;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFShadowMap;
    this.renderer.localClippingEnabled = true;

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x101114);
    this.scene.fog = new THREE.Fog(0x101114, 520, 1600);

    this.persp = new THREE.PerspectiveCamera(46, 1, 0.1, 4000);
    this.persp.position.set(160, 120, 190);
    this.ortho = new THREE.OrthographicCamera(-100, 100, 100, -100, 0.1, 4000);
    this.camera = this.persp;

    this.controls = new OrbitControls(this.persp, canvas);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.08;
    this.controls.screenSpacePanning = true;
    this.controls.minDistance = 5;
    this.controls.maxDistance = 2500;
    this.controls.target.set(0, 20, 0);

    const pmrem = new THREE.PMREMGenerator(this.renderer);
    this.envTex = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    this.scene.environment = this.envTex;
    pmrem.dispose();

    this.matcap = makeMatcapTexture();

    this.scene.add(new THREE.AmbientLight(0xc8cdd4, 0.55));
    const hemi = new THREE.HemisphereLight(0xe8eef4, 0x2a2c32, 0.85);
    this.scene.add(hemi);
    this.dirLight = new THREE.DirectionalLight(0xfff8f0, 1.45);
    this.dirLight.position.set(80, 160, 70);
    this.dirLight.castShadow = true;
    this.dirLight.shadow.mapSize.set(1024, 1024);
    this.dirLight.shadow.camera.near = 10;
    this.dirLight.shadow.camera.far = 500;
    this.dirLight.shadow.camera.left = -180;
    this.dirLight.shadow.camera.right = 180;
    this.dirLight.shadow.camera.top = 180;
    this.dirLight.shadow.camera.bottom = -180;
    this.dirLight.shadow.bias = -0.00015;
    this.scene.add(this.dirLight);
    const fill = new THREE.DirectionalLight(0x9aa8bb, 0.35);
    fill.position.set(-90, 40, -60);
    this.scene.add(fill);

    this.grid = new THREE.GridHelper(220, 22, 0x3a3d44, 0x22252b);
    this.grid.position.y = 0.02;
    this.scene.add(this.grid);
    this.axes = new THREE.AxesHelper(36);
    this.scene.add(this.axes);

    this.bedGroup = new THREE.Group();
    this.scene.add(this.bedGroup);
    this.rebuildBed();

    this.tcontrols = new TransformControls(this.persp, canvas);
    this.tcontrols.setSize(0.85);
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
          if (before.pos.distanceTo(after.pos) > 1e-6 || before.quat.angleTo(after.quat) > 1e-6) {
            this.pushUndo({
              name: "Transform",
              undo: () => {
                writeTrs(p.mesh, before);
                this.emit();
              },
              redo: () => {
                writeTrs(p.mesh, after);
                this.emit();
              },
            });
          }
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

    // View cube
    const labels = ["RIGHT", "LEFT", "TOP", "BOTTOM", "FRONT", "BACK"];
    const mats = labels.map(
      (l) =>
        new THREE.MeshBasicMaterial({
          map: faceLabelTexture(l),
        }),
    );
    this.cubeMesh = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), mats);
    this.cubeScene.add(this.cubeMesh);
    const cubeEdges = new THREE.LineSegments(
      new THREE.EdgesGeometry(new THREE.BoxGeometry(1.002, 1.002, 1.002)),
      new THREE.LineBasicMaterial({ color: 0x8b919a }),
    );
    this.cubeScene.add(cubeEdges);
    this.cubeScene.add(new THREE.AmbientLight(0xffffff, 1));

    const triad = new THREE.AxesHelper(1);
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

  subscribe = (fn: () => void) => {
    this.listeners.add(fn);
    return () => {
      this.listeners.delete(fn);
    };
  };

  getSnapshot = () => this.snapshot;

  private emit() {
    this.snapshot = this.computeSnapshot();
    this.listeners.forEach((fn) => fn());
  }

  flash(msg: string, ms = 2200) {
    this.snapshot = { ...this.computeSnapshot(), toast: msg };
    this.listeners.forEach((fn) => fn());
    if (this.toastTimer) window.clearTimeout(this.toastTimer);
    this.toastTimer = window.setTimeout(() => {
      this.toastTimer = null;
      this.emit();
    }, ms);
  }

  private selected(): Part | null {
    return this.parts.find((p) => p.id === this.selectedId) ?? null;
  }

  private partById(id: number) {
    return this.parts.find((p) => p.id === id) ?? null;
  }

  private computeSnapshot(): EngineSnapshot {
    const parts: PartSnapshot[] = this.parts.map((p) => {
      p.mesh.updateMatrixWorld(true);
      _box.setFromObject(p.mesh);
      _box.getSize(_size);
      const e = new THREE.Euler().setFromQuaternion(p.mesh.quaternion, "XYZ");
      return {
        id: p.id,
        name: p.name,
        color: "#" + p.baseColor.getHexString(),
        visible: p.visible,
        locked: p.locked,
        triCount: p.triCount,
        bytes: p.sizeBytes,
        position: [p.mesh.position.x, p.mesh.position.y, p.mesh.position.z],
        rotationDeg: [
          THREE.MathUtils.radToDeg(e.x),
          THREE.MathUtils.radToDeg(e.y),
          THREE.MathUtils.radToDeg(e.z),
        ],
        scale: [p.mesh.scale.x, p.mesh.scale.y, p.mesh.scale.z],
        size: [_size.x, _size.y, _size.z],
        volume: p.volume * p.mesh.scale.x * p.mesh.scale.y * p.mesh.scale.z,
        area: p.area,
      };
    });
    const toast =
      this.toastTimer !== null ? (this.snapshot.toast ?? null) : null;
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
      measureMm: this.measurePts.length === 2 ? this.measurePts[0]!.distanceTo(this.measurePts[1]!) : null,
      mateA: this.faceA ? (this.partById(this.faceA.partId)?.name ?? "A") : null,
      mateB: this.faceB ? (this.partById(this.faceB.partId)?.name ?? "B") : null,
      mateReady: !!(this.faceA && this.faceB && this.faceA.partId !== this.faceB.partId),
      hoverHint: this.hintText(),
      toast,
      stats: {
        tris: this.parts.reduce((s, p) => s + p.triCount, 0),
        parts: this.parts.length,
        volume: parts.reduce((s, p) => s + p.volume, 0),
      },
      canUndo: this.undoStack.length > 0,
      canRedo: this.redoStack.length > 0,
      undoLabel: this.undoStack.at(-1)?.name ?? "",
      redoLabel: this.redoStack.at(-1)?.name ?? "",
    };
  }

  private hintText() {
    if (!this.parts.length) return "Drop STL files or load the workshop kit";
    switch (this.tool) {
      case "mate":
        if (!this.faceA) return "Click a planar face on the fixed part";
        if (!this.faceB) return "Click a face on the moving part";
        return "Faces ready — Mate, or click again to replace B";
      case "measure":
        return this.measurePts.length === 1
          ? "Click the second point"
          : "Click two points · snaps to vertices";
      case "section":
        return "Drag the section slider in the inspector";
      case "move":
        return "Drag the gizmo · arrows nudge · Shift = 1 mm";
      case "rotate":
        return "Drag rings to rotate · 90° buttons in inspector";
      case "scale":
        return "Drag the gizmo or set exact size";
      default:
        return "Orbit · pan · zoom · double-click a part to isolate";
    }
  }

  private pushUndo(cmd: UndoCmd) {
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

  private loop = (t: number) => {
    if (this.disposed) return;
    this.raf = requestAnimationFrame(this.loop);
    const dt = Math.min(0.05, (t - this.lastT) / 1000 || 0.016);
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

  private activeCam() {
    return this.usingOrtho ? this.ortho : this.persp;
  }

  private syncOrthoFromPersp() {
    const wrap = this.canvas.parentElement;
    const w = wrap?.clientWidth || this.canvas.clientWidth || 1;
    const h = wrap?.clientHeight || this.canvas.clientHeight || 1;
    const aspect = w / Math.max(h, 1);
    const d = this.persp.position.distanceTo(this.controls.target);
    const hh = d * Math.tan(THREE.MathUtils.degToRad(this.persp.fov / 2));
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

  private renderOverlays() {
    const wrap = this.canvas.parentElement;
    const w = wrap?.clientWidth || 1;
    const h = wrap?.clientHeight || 1;
    const dpr = this.renderer.getPixelRatio();
    const cube = Math.round(Math.min(96, Math.max(64, w * 0.11)));
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

  private cubeRect() {
    const wrap = this.canvas.parentElement;
    const w = wrap?.clientWidth || 1;
    const h = wrap?.clientHeight || 1;
    const cube = Math.round(Math.min(96, Math.max(64, w * 0.11)));
    const margin = 12;
    return {
      x: w - cube - margin,
      y: margin,
      size: cube,
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

  private disposePart(p: Part) {
    this.scene.remove(p.mesh);
    p.mesh.geometry.dispose();
    const mat = p.mesh.material;
    if (Array.isArray(mat)) mat.forEach((m) => m.dispose());
    else mat.dispose();
    p.edges.geometry.dispose();
    (p.edges.material as THREE.Material).dispose();
    p.originalGeometry.dispose();
  }

  // ---------- parts ----------
  private makeMaterial(color: THREE.Color, opacity: number, vertexColors = false): THREE.Material {
    const side = THREE.DoubleSide;
    switch (this.renderMode) {
      case "clay":
        return new THREE.MeshMatcapMaterial({
          color: 0xd8d4cc,
          matcap: this.matcap,
          side,
        });
      case "metal":
        return new THREE.MeshStandardMaterial({
          color,
          metalness: 0.86,
          roughness: 0.26,
          envMapIntensity: 1.1,
          side,
        });
      case "wire":
        return new THREE.MeshBasicMaterial({ color, wireframe: true, side });
      case "xray":
        return new THREE.MeshPhysicalMaterial({
          color,
          transparent: true,
          opacity: 0.22,
          depthWrite: false,
          roughness: 0.2,
          metalness: 0.1,
          side,
        });
      case "normal":
        return new THREE.MeshNormalMaterial({ side });
      case "print":
        return new THREE.MeshLambertMaterial({
          vertexColors: true,
          side,
        });
      default:
        return new THREE.MeshStandardMaterial({
          color,
          metalness: 0.08,
          roughness: 0.52,
          envMapIntensity: 0.55,
          side,
          transparent: opacity < 0.999,
          opacity,
        });
    }
    void vertexColors;
  }

  private applyMaterials() {
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

  private addPrepared(
    geometry: THREE.BufferGeometry,
    name: string,
    sizeBytes: number,
    colorHex?: number,
    position?: THREE.Vector3,
  ): Part {
    const geo = prepareGeometry(geometry);
    const color = new THREE.Color(colorHex ?? PART_COLORS[this.colorIndex % PART_COLORS.length]!);
    this.colorIndex++;
    const mesh = new THREE.Mesh(geo, this.makeMaterial(color, 1));
    mesh.castShadow = this.showShadows;
    mesh.receiveShadow = this.showShadows;
    if (position) mesh.position.copy(position);
    const edges = new THREE.LineSegments(
      new THREE.EdgesGeometry(geo, 24),
      new THREE.LineBasicMaterial({
        color: 0x0e0f12,
        transparent: true,
        opacity: 0.42,
      }),
    );
    edges.visible = this.showEdges;
    mesh.add(edges);
    const id = this.nextId++;
    mesh.userData.partId = id;
    const topo = buildTopology(geo);
    const part: Part = {
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
      restPosition: mesh.position.clone(),
    };
    this.parts.push(part);
    this.scene.add(mesh);
    this.select(id);
    return part;
  }

  loadFiles(fileList: FileList | File[]) {
    const files = Array.from(fileList).filter(
      (f) =>
        f.name.toLowerCase().endsWith(".stl") ||
        (f.type && (f.type.includes("stl") || f.type === "application/sla")),
    );
    if (!files.length) {
      this.flash("No STL files found");
      return;
    }
    let cursor = 0;
    files.forEach((file, i) => {
      const reader = new FileReader();
      reader.onload = () => {
        try {
          const geom = this.loader.parse(reader.result as ArrayBuffer);
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
    const added: Part[] = [];
    for (const item of kit) {
      try {
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
    }
    if (added.length) {
      const groupBox = new THREE.Box3();
      for (const p of added) groupBox.expandByObject(p.mesh);
      const gc = groupBox.getCenter(new THREE.Vector3());
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
      redo: () => {
        /* kit redo skipped — parts disposed */
      },
    });
    this.fitAll();
    this.flash("Workshop kit loaded — try Mate on two faces");
    this.emit();
  }

  select(id: number | null) {
    this.selectedId = id;
    for (const p of this.parts) {
      const mat = p.mesh.material as THREE.MeshStandardMaterial;
      if ("emissive" in mat && mat.emissive) {
        mat.emissive.setHex(p.id === id ? 0x151a22 : 0x000000);
      }
    }
    this.syncGizmo();
    this.emit();
  }

  private syncGizmo() {
    const p = this.selected();
    const xform = this.tool === "move" || this.tool === "rotate" || this.tool === "scale";
    if (xform && p && p.visible && !p.locked && this.explodeAmt < 0.01) {
      this.tcontrols.attach(p.mesh);
      const mode = this.tool === "move" ? "translate" : this.tool === "rotate" ? "rotate" : "scale";
      this.tcontrols.setMode(mode);
      this.tcontrols.setTranslationSnap(this.snapOn ? 1 : null);
      this.tcontrols.setRotationSnap(this.snapOn ? Math.PI / 12 : null);
      this.tcontrols.setScaleSnap(this.snapOn ? 0.05 : null);
    } else {
      this.tcontrols.detach();
    }
  }

  setTool(tool: Tool) {
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

  setUnits(u: Units) {
    this.units = u;
    this.emit();
  }

  setRenderMode(mode: RenderMode) {
    this.renderMode = mode;
    this.applyMaterials();
    this.emit();
  }

  setOrtho(on: boolean) {
    this.usingOrtho = on;
    this.controls.object = this.activeCam();
    this.syncGizmo();
    this.emit();
  }

  setGrid(on: boolean) {
    this.showGrid = on;
    this.grid.visible = on;
    this.bedGroup.visible = on;
    this.emit();
  }

  setAxes(on: boolean) {
    this.showAxes = on;
    this.axes.visible = on;
    this.emit();
  }

  setShadows(on: boolean) {
    this.showShadows = on;
    this.renderer.shadowMap.enabled = on;
    this.dirLight.castShadow = on;
    this.applyMaterials();
    this.emit();
  }

  setEdges(on: boolean) {
    this.showEdges = on;
    this.applyMaterials();
    this.emit();
  }

  setPrinter(id: string) {
    this.printerId = id;
    this.rebuildBed();
    this.emit();
  }

  private rebuildBed() {
    while (this.bedGroup.children.length) {
      const c = this.bedGroup.children[0]!;
      this.bedGroup.remove(c);
      if (c instanceof THREE.Mesh) {
        c.geometry.dispose();
        (c.material as THREE.Material).dispose();
      }
    }
    if (this.volumeHelper) {
      this.scene.remove(this.volumeHelper);
      this.volumeHelper.geometry.dispose();
      (this.volumeHelper.material as THREE.Material).dispose();
      this.volumeHelper = null;
    }
    const printer = PRINTERS.find((p) => p.id === this.printerId) ?? PRINTERS[0]!;
    const plane = new THREE.Mesh(
      new THREE.PlaneGeometry(printer.x, printer.z),
      new THREE.MeshStandardMaterial({
        color: 0x1c1e22,
        roughness: 0.9,
        metalness: 0.1,
        transparent: true,
        opacity: 0.55,
      }),
    );
    plane.rotation.x = -Math.PI / 2;
    plane.receiveShadow = true;
    this.bedGroup.add(plane);
    const outline = new THREE.LineLoop(
      new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(-printer.x / 2, 0.04, -printer.z / 2),
        new THREE.Vector3(printer.x / 2, 0.04, -printer.z / 2),
        new THREE.Vector3(printer.x / 2, 0.04, printer.z / 2),
        new THREE.Vector3(-printer.x / 2, 0.04, printer.z / 2),
      ]),
      new THREE.LineBasicMaterial({ color: 0x5c6168 }),
    );
    this.bedGroup.add(outline);
    this.grid.scale.set(printer.x / 220, 1, printer.z / 220);

    const vol = new THREE.BoxGeometry(printer.x, printer.y, printer.z);
    vol.translate(0, printer.y / 2, 0);
    this.volumeHelper = new THREE.LineSegments(
      new THREE.EdgesGeometry(vol),
      new THREE.LineBasicMaterial({
        color: 0x3a3d44,
        transparent: true,
        opacity: 0.55,
      }),
    );
    vol.dispose();
    this.scene.add(this.volumeHelper);
  }

  // ---------- transform ops ----------
  setPosition(x: number, y: number, z: number) {
    const p = this.selected();
    if (!p || p.locked) return;
    const before = readTrs(p.mesh);
    p.mesh.position.set(x, y, z);
    this.pushUndo({
      name: "Position",
      undo: () => writeTrs(p.mesh, before),
      redo: () => p.mesh.position.set(x, y, z),
    });
    this.emit();
  }

  setRotationDeg(x: number, y: number, z: number) {
    const p = this.selected();
    if (!p || p.locked) return;
    const before = readTrs(p.mesh);
    p.mesh.rotation.set(
      THREE.MathUtils.degToRad(x),
      THREE.MathUtils.degToRad(y),
      THREE.MathUtils.degToRad(z),
    );
    const after = readTrs(p.mesh);
    this.pushUndo({
      name: "Rotate",
      undo: () => writeTrs(p.mesh, before),
      redo: () => writeTrs(p.mesh, after),
    });
    this.emit();
  }

  setScale(x: number, y: number, z: number) {
    const p = this.selected();
    if (!p || p.locked) return;
    const before = readTrs(p.mesh);
    p.mesh.scale.set(x, y, z);
    this.pushUndo({
      name: "Scale",
      undo: () => writeTrs(p.mesh, before),
      redo: () => p.mesh.scale.set(x, y, z),
    });
    this.emit();
  }

  setUniformScale(s: number) {
    this.setScale(s, s, s);
  }

  scaleLongestTo(mm: number) {
    const p = this.selected();
    if (!p || p.locked) return;
    _box.setFromObject(p.mesh);
    _box.getSize(_size);
    const longest = Math.max(_size.x, _size.y, _size.z, 1e-6);
    const k = mm / longest;
    this.setScale(p.mesh.scale.x * k, p.mesh.scale.y * k, p.mesh.scale.z * k);
  }

  rotate90(axis: "x" | "y" | "z") {
    const p = this.selected();
    if (!p || p.locked) return;
    const before = readTrs(p.mesh);
    const q = new THREE.Quaternion();
    const v =
      axis === "x" ? new THREE.Vector3(1, 0, 0) : axis === "y" ? new THREE.Vector3(0, 1, 0) : new THREE.Vector3(0, 0, 1);
    q.setFromAxisAngle(v, Math.PI / 2);
    p.mesh.quaternion.premultiply(q);
    const after = readTrs(p.mesh);
    this.pushUndo({
      name: `${axis.toUpperCase()} 90°`,
      undo: () => writeTrs(p.mesh, before),
      redo: () => writeTrs(p.mesh, after),
    });
    this.emit();
  }

  dropToBed(id?: number) {
    const p = id != null ? this.partById(id) : this.selected();
    if (!p || p.locked) return;
    const before = readTrs(p.mesh);
    dropMeshToBed(p.mesh);
    const after = readTrs(p.mesh);
    this.pushUndo({
      name: "Drop to bed",
      undo: () => writeTrs(p.mesh, before),
      redo: () => writeTrs(p.mesh, after),
    });
    this.emit();
    this.flash("Dropped to bed");
  }

  centerOnBed(id?: number) {
    const p = id != null ? this.partById(id) : this.selected();
    if (!p || p.locked) return;
    const before = readTrs(p.mesh);
    centerMeshOnBed(p.mesh);
    const after = readTrs(p.mesh);
    this.pushUndo({
      name: "Center",
      undo: () => writeTrs(p.mesh, before),
      redo: () => writeTrs(p.mesh, after),
    });
    this.emit();
  }

  dropAll() {
    const befores = this.parts.map((p) => ({ id: p.id, trs: readTrs(p.mesh) }));
    for (const p of this.parts) if (!p.locked) dropMeshToBed(p.mesh);
    const afters = this.parts.map((p) => ({ id: p.id, trs: readTrs(p.mesh) }));
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
      },
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
      },
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
      },
    });
    this.emit();
    this.flash("Reset to original");
  }

  mirror(axis: "x" | "y" | "z") {
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
      },
    });
    this.emit();
  }

  private rebuildEdges(p: Part) {
    p.edges.geometry.dispose();
    p.edges.geometry = new THREE.EdgesGeometry(p.mesh.geometry, 24);
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
      redo: () => {
        /* disposed */
      },
    });
    this.flash("Duplicated");
    this.emit();
  }

  deleteSelected() {
    if (this.selectedId == null) return;
    this.deletePart(this.selectedId);
  }

  deletePart(id: number) {
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
      redo: () => this.removePartInternal(id),
    });
    this.flash("Deleted");
    this.emit();
  }

  private removePartInternal(id: number) {
    const idx = this.parts.findIndex((p) => p.id === id);
    if (idx < 0) return;
    const p = this.parts[idx]!;
    if (this.faceA?.partId === id || this.faceB?.partId === id) this.clearFaces();
    if (this.tcontrols.object === p.mesh) this.tcontrols.detach();
    this.scene.remove(p.mesh);
    this.parts.splice(idx, 1);
    if (this.selectedId === id) this.selectedId = this.parts.at(-1)?.id ?? null;
    this.syncGizmo();
  }

  setVisible(id: number, visible: boolean) {
    const p = this.partById(id);
    if (!p) return;
    p.visible = visible;
    p.mesh.visible = visible;
    this.emit();
  }

  setLocked(id: number, locked: boolean) {
    const p = this.partById(id);
    if (!p) return;
    p.locked = locked;
    this.syncGizmo();
    this.emit();
  }

  setColor(hex: string) {
    const p = this.selected();
    if (!p) return;
    p.baseColor.set(hex);
    this.applyMaterials();
    this.emit();
  }

  setOpacity(v: number) {
    const p = this.selected();
    if (!p) return;
    p.opacity = v;
    this.applyMaterials();
    this.emit();
  }

  isolate(id: number) {
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

  // ---------- explode ----------
  setExplode(v: number) {
    if (this.explodeAmt < 0.001 && v > 0) {
      for (const p of this.parts) p.restPosition.copy(p.mesh.position);
    }
    this.explodeAmt = v;
    const box = new THREE.Box3();
    for (const p of this.parts) box.expandByObject(p.mesh);
    const center = box.isEmpty() ? new THREE.Vector3() : box.getCenter(new THREE.Vector3());
    center.y = 0;
    for (const p of this.parts) {
      const dir = p.restPosition.clone().sub(center);
      dir.y *= 0.25;
      if (dir.lengthSq() < 1e-6) dir.set(p.id, 0, 0);
      p.mesh.position.copy(p.restPosition).addScaledVector(dir, v * 1.15);
    }
    this.syncGizmo();
    this.emit();
  }

  // ---------- section ----------
  setSection(on: boolean, axis?: "x" | "y" | "z", pos?: number) {
    this.sectionOn = on;
    if (axis) this.sectionAxis = axis;
    if (pos != null) this.sectionPos = pos;
    this.updateClip();
    this.emit();
  }

  private updateClip() {
    if (!this.sectionOn) {
      this.renderer.clippingPlanes = [];
      return;
    }
    const box = new THREE.Box3();
    for (const p of this.parts) if (p.visible) box.expandByObject(p.mesh);
    if (box.isEmpty()) box.set(new THREE.Vector3(-50, 0, -50), new THREE.Vector3(50, 80, 50));
    const min = this.sectionAxis === "x" ? box.min.x : this.sectionAxis === "y" ? box.min.y : box.min.z;
    const max = this.sectionAxis === "x" ? box.max.x : this.sectionAxis === "y" ? box.max.y : box.max.z;
    const v = min + (max - min) * this.sectionPos;
    const n = new THREE.Vector3(
      this.sectionAxis === "x" ? -1 : 0,
      this.sectionAxis === "y" ? -1 : 0,
      this.sectionAxis === "z" ? -1 : 0,
    );
    this.clipPlane.setFromNormalAndCoplanarPoint(n, new THREE.Vector3(
      this.sectionAxis === "x" ? v : 0,
      this.sectionAxis === "y" ? v : 0,
      this.sectionAxis === "z" ? v : 0,
    ));
    this.renderer.clippingPlanes = [this.clipPlane];
  }

  // ---------- mate ----------
  clearFaces() {
    if (this.faceA) {
      this.faceA.helper.parent?.remove(this.faceA.helper);
      this.faceA.helper.geometry.dispose();
      (this.faceA.helper.material as THREE.Material).dispose();
    }
    if (this.faceB) {
      this.faceB.helper.parent?.remove(this.faceB.helper);
      this.faceB.helper.geometry.dispose();
      (this.faceB.helper.material as THREE.Material).dispose();
    }
    this.faceA = null;
    this.faceB = null;
    this.clearHover();
    this.emit();
  }

  private clearHover() {
    if (this.hoverHelper) {
      this.hoverHelper.parent?.remove(this.hoverHelper);
      this.hoverHelper.geometry.dispose();
      (this.hoverHelper.material as THREE.Material).dispose();
      this.hoverHelper = null;
    }
    this.hoverKey = "";
  }

  private makeFaceHelper(part: Part, faces: number[], color: number) {
    const geo = planarHelperGeometry(part.mesh.geometry, faces, 0.12);
    const mat = new THREE.MeshBasicMaterial({
      color,
      transparent: true,
      opacity: 0.72,
      depthTest: true,
      side: THREE.DoubleSide,
      polygonOffset: true,
      polygonOffsetFactor: -2,
    });
    const helper = new THREE.Mesh(geo, mat);
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
    const q = new THREE.Quaternion().setFromUnitVectors(nB, targetN);
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
      redo: () => writeTrs(b.mesh, after),
    });
    this.select(b.id);
    this.flash("Faces mated");
    this.emit();
  }

  // ---------- measure ----------
  clearMeasure() {
    this.measurePts = [];
    while (this.measureGroup.children.length) {
      const c = this.measureGroup.children[0]!;
      this.measureGroup.remove(c);
      if (c instanceof THREE.Mesh || c instanceof THREE.Line || c instanceof THREE.Sprite) {
        c.geometry?.dispose?.();
        const mat = (c as THREE.Mesh).material;
        if (Array.isArray(mat)) mat.forEach((m) => m.dispose());
        else if (mat) {
          const m = mat as THREE.Material & { map?: THREE.Texture };
          if (m.map) m.map.dispose();
          m.dispose();
        }
      }
    }
    this.emit();
  }

  private rebuildMeasure() {
    this.clearMeasureKeepPts();
    const pts = this.measurePts;
    const sphereGeo = new THREE.SphereGeometry(0.7, 16, 12);
    const mat = new THREE.MeshBasicMaterial({ color: 0xd0d4db, depthTest: false });
    for (const p of pts) {
      const s = new THREE.Mesh(sphereGeo, mat);
      s.position.copy(p);
      s.renderOrder = 12;
      this.measureGroup.add(s);
    }
    if (pts.length === 2) {
      const g = new THREE.BufferGeometry().setFromPoints(pts);
      const line = new THREE.Line(
        g,
        new THREE.LineBasicMaterial({ color: 0xd0d4db, depthTest: false }),
      );
      line.renderOrder = 12;
      this.measureGroup.add(line);
      const d = pts[0]!.distanceTo(pts[1]!);
      const label = measureSprite(this.fmtLen(d));
      label.position.copy(pts[0]!).add(pts[1]!).multiplyScalar(0.5);
      this.measureGroup.add(label);
    }
  }

  private clearMeasureKeepPts() {
    const pts = this.measurePts.slice();
    this.clearMeasure();
    this.measurePts = pts;
  }

  fmtLen(mm: number) {
    if (this.units === "in") return `${(mm / 25.4).toFixed(3)} in`;
    return `${mm.toFixed(2)} mm`;
  }

  // ---------- views ----------
  fitAll() {
    if (!this.parts.length) return;
    const box = new THREE.Box3();
    for (const p of this.parts) if (p.visible) box.expandByObject(p.mesh);
    this.fitBox(box, 1.75);
  }

  fitPart(id: number) {
    const p = this.partById(id);
    if (!p) return;
    _box.setFromObject(p.mesh);
    this.fitBox(_box, 1.6);
  }

  private fitBox(box: THREE.Box3, offset: number) {
    if (box.isEmpty()) return;
    const size = box.getSize(new THREE.Vector3());
    const center = box.getCenter(new THREE.Vector3());
    const maxDim = Math.max(size.x, size.y, size.z, 1);
    const fov = this.persp.fov * (Math.PI / 180);
    const dist = Math.abs(maxDim / 2 / Math.tan(fov / 2)) * offset;
    const dir = this.persp.position.clone().sub(this.controls.target);
    if (dir.lengthSq() < 1e-6) dir.set(0.75, 0.55, 1);
    dir.normalize();
    this.animateCamera(center.clone().addScaledVector(dir, dist), center);
    this.persp.near = Math.max(maxDim / 400, 0.05);
    this.persp.far = maxDim * 80;
    this.persp.updateProjectionMatrix();
  }

  setView(preset: ViewPreset) {
    const box = new THREE.Box3();
    for (const p of this.parts) if (p.visible) box.expandByObject(p.mesh);
    if (box.isEmpty()) box.set(new THREE.Vector3(-40, 0, -40), new THREE.Vector3(40, 40, 40));
    const center = box.getCenter(new THREE.Vector3());
    const size = box.getSize(new THREE.Vector3());
    const d = Math.max(size.x, size.y, size.z, 40) * 1.8;
    const dirs: Record<ViewPreset, THREE.Vector3> = {
      iso: new THREE.Vector3(0.75, 0.55, 1),
      front: new THREE.Vector3(0, 0.08, 1),
      back: new THREE.Vector3(0, 0.08, -1),
      right: new THREE.Vector3(1, 0.08, 0),
      left: new THREE.Vector3(-1, 0.08, 0),
      top: new THREE.Vector3(0.001, 1, 0),
      bottom: new THREE.Vector3(0.001, -1, 0),
    };
    const dir = dirs[preset].clone().normalize();
    this.animateCamera(center.clone().addScaledVector(dir, d), center);
  }

  private animateCamera(toP: THREE.Vector3, toT: THREE.Vector3) {
    this.camAnim = {
      fromP: this.persp.position.clone(),
      toP,
      fromT: this.controls.target.clone(),
      toT,
      t: 0,
      dur: 0.38,
    };
  }

  // ---------- pointer ----------
  private eventToNdc(e: { clientX: number; clientY: number }) {
    const rect = this.canvas.getBoundingClientRect();
    _pointer.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    _pointer.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
    return { x: e.clientX - rect.left, y: e.clientY - rect.top, rect };
  }

  private hitCube(e: { clientX: number; clientY: number }): ViewPreset | null {
    const cube = this.cubeRect();
    const rect = this.canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    if (x < cube.x || y < cube.y || x > cube.x + cube.size || y > cube.y + cube.size) return null;
    const nx = ((x - cube.x) / cube.size) * 2 - 1;
    const ny = -((y - cube.y) / cube.size) * 2 + 1;
    _raycaster.setFromCamera(new THREE.Vector2(nx, ny), this.cubeCamera);
    const hits = _raycaster.intersectObject(this.cubeMesh, false);
    if (!hits.length) return null;
    const idx = hits[0]!.face?.materialIndex ?? 0;
    return (["right", "left", "top", "bottom", "front", "back"] as ViewPreset[])[idx] ?? "iso";
  }

  private hitParts(e: { clientX: number; clientY: number }) {
    this.eventToNdc(e);
    _raycaster.setFromCamera(_pointer, this.activeCam());
    const meshes = this.parts.filter((p) => p.visible).map((p) => p.mesh);
    return _raycaster.intersectObjects(meshes, false);
  }

  private onPointerDown = (e: PointerEvent) => {
    this.pointerStart = { x: e.clientX, y: e.clientY, t: performance.now() };
    if (this.hitCube(e)) {
      this.controls.enabled = false;
    }
  };

  private onPointerUp = (e: PointerEvent) => {
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
      const id = hits[0]!.object.userData.partId as number;
      const part = this.partById(id);
      if (part && !part.locked) this.select(id);
    } else if (this.tool === "select") {
      this.select(null);
    }
  };

  private onPointerMove = (e: PointerEvent) => {
    if (this.tool !== "mate" || this.tcontrols.dragging) return;
    const hits = this.hitParts(e);
    if (!hits.length) {
      this.clearHover();
      return;
    }
    const hit = hits[0]!;
    const id = hit.object.userData.partId as number;
    const part = this.partById(id);
    if (!part || hit.faceIndex == null) return;
    const faces = growPlanar(part.topology, hit.faceIndex);
    const key = `${id}:${faces[0]}:${faces.length}`;
    if (key === this.hoverKey) return;
    this.clearHover();
    this.hoverKey = key;
    this.hoverHelper = this.makeFaceHelper(part, faces, 0xd0d4db);
    (this.hoverHelper.material as THREE.MeshBasicMaterial).opacity = 0.38;
  };

  private onDblClick = (e: MouseEvent) => {
    const hits = this.hitParts(e);
    if (hits.length) {
      const id = hits[0]!.object.userData.partId as number;
      this.fitPart(id);
    } else this.fitAll();
  };

  private pickMate(e: PointerEvent) {
    const hits = this.hitParts(e);
    if (!hits.length) return;
    const hit = hits[0]!;
    const id = hit.object.userData.partId as number;
    const part = this.partById(id);
    if (!part || hit.faceIndex == null) return;
    const faces = growPlanar(part.topology, hit.faceIndex);
    const frame = faceLocalFrame(part.mesh.geometry, part.topology, faces);
    const entry: FacePick = {
      partId: id,
      faces,
      localNormal: frame.localNormal,
      localPoint: frame.localPoint,
      helper: this.makeFaceHelper(part, faces, this.faceA ? 0xb8c0c8 : 0xe8e6e3),
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
        (this.faceB.helper.material as THREE.Material).dispose();
      }
      this.faceB = entry;
      this.flash("Face B ready — mating");
      this.mate(0);
    }
    this.emit();
  }

  private pickMeasure(e: PointerEvent) {
    const hits = this.hitParts(e);
    if (!hits.length) return;
    const hit = hits[0]!;
    let pt = hit.point.clone();
    const part = this.partById(hit.object.userData.partId as number);
    if (part && hit.faceIndex != null) {
      const geo = part.mesh.geometry;
      const pos = geo.attributes.position;
      const idx = geo.index;
      const i = hit.faceIndex * 3;
      const ia = idx ? idx.getX(i) : i;
      const ib = idx ? idx.getX(i + 1) : i + 1;
      const ic = idx ? idx.getX(i + 2) : i + 2;
      const verts = [ia, ib, ic].map((vi) => {
        const v = new THREE.Vector3().fromBufferAttribute(pos, vi);
        return v.applyMatrix4(part.mesh.matrixWorld);
      });
      let best = pt;
      let bestD = Infinity;
      const rect = this.canvas.getBoundingClientRect();
      for (const v of verts) {
        _v.copy(v).project(this.activeCam());
        const sx = (_v.x * 0.5 + 0.5) * rect.width;
        const sy = (-_v.y * 0.5 + 0.5) * rect.height;
        const dx = sx - (e.clientX - rect.left);
        const dy = sy - (e.clientY - rect.top);
        const d = dx * dx + dy * dy;
        if (d < bestD && d < 14 * 14) {
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
    if (this.measurePts.length === 2) {
      this.flash(this.fmtLen(this.measurePts[0]!.distanceTo(this.measurePts[1]!)));
    }
  }

  nudge(dx: number, dy: number, dz: number) {
    const p = this.selected();
    if (!p || p.locked || this.tool !== "move") return;
    p.mesh.position.x += dx;
    p.mesh.position.y += dy;
    p.mesh.position.z += dz;
    this.emit();
  }

  // ---------- export ----------
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

  private exportMeshes(meshes: THREE.Mesh[], filename: string, binary: boolean) {
    const group = new THREE.Group();
    const temps: THREE.BufferGeometry[] = [];
    for (const m of meshes) {
      const g = bakeWorld(m);
      temps.push(g);
      group.add(new THREE.Mesh(g));
    }
    const data = this.exporter.parse(group, { binary });
    temps.forEach((g) => g.dispose());
    const blob = new Blob([data as BlobPart], { type: "application/octet-stream" });
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

  rename(id: number, name: string) {
    const p = this.partById(id);
    if (!p) return;
    p.name = name;
    this.emit();
  }
}
