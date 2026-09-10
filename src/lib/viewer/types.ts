export type Tool =
  | "select"
  | "move"
  | "rotate"
  | "scale"
  | "mate"
  | "measure"
  | "section";

export type RenderMode =
  | "studio"
  | "clay"
  | "metal"
  | "wire"
  | "xray"
  | "normal"
  | "print";

export type Units = "mm" | "in";

export type ViewPreset =
  | "iso"
  | "front"
  | "back"
  | "right"
  | "left"
  | "top"
  | "bottom";

export interface PrinterPreset {
  id: string;
  name: string;
  x: number;
  z: number;
  y: number;
}

export const PRINTERS: PrinterPreset[] = [
  { id: "ender3", name: "Ender 3", x: 220, z: 220, y: 250 },
  { id: "prusa-mk4", name: "Prusa MK4", x: 250, z: 210, y: 220 },
  { id: "prusa-mini", name: "Prusa Mini", x: 180, z: 180, y: 180 },
  { id: "bambu", name: "Bambu A1 / P1", x: 256, z: 256, y: 256 },
  { id: "open", name: "Open bed 300", x: 300, z: 300, y: 300 },
];

export const PART_COLORS = [
  0xd8dee6, 0xaeb8c4, 0xe8e0d4, 0xb4c0b6, 0xcfd6de, 0x8f98a3, 0xddd6c8,
  0x9aa7b0,
];

export interface PartSnapshot {
  id: number;
  name: string;
  color: string;
  visible: boolean;
  locked: boolean;
  triCount: number;
  bytes: number;
  position: [number, number, number];
  rotationDeg: [number, number, number];
  scale: [number, number, number];
  size: [number, number, number];
  volume: number;
  area: number;
}

export interface EngineSnapshot {
  parts: PartSnapshot[];
  selectedId: number | null;
  tool: Tool;
  units: Units;
  renderMode: RenderMode;
  ortho: boolean;
  grid: boolean;
  axes: boolean;
  shadows: boolean;
  edges: boolean;
  snap: boolean;
  explode: number;
  sectionOn: boolean;
  sectionAxis: "x" | "y" | "z";
  sectionPos: number;
  printerId: string;
  measureMm: number | null;
  mateA: string | null;
  mateB: string | null;
  mateReady: boolean;
  hoverHint: string;
  toast: string | null;
  stats: { tris: number; parts: number; volume: number };
  canUndo: boolean;
  canRedo: boolean;
  undoLabel: string;
  redoLabel: string;
}

export const EMPTY_SNAPSHOT: EngineSnapshot = {
  parts: [],
  selectedId: null,
  tool: "select",
  units: "mm",
  renderMode: "studio",
  ortho: false,
  grid: true,
  axes: true,
  shadows: true,
  edges: true,
  snap: true,
  explode: 0,
  sectionOn: false,
  sectionAxis: "y",
  sectionPos: 0.5,
  printerId: "ender3",
  measureMm: null,
  mateA: null,
  mateB: null,
  mateReady: false,
  hoverHint: "Drop STL files to begin",
  toast: null,
  stats: { tris: 0, parts: 0, volume: 0 },
  canUndo: false,
  canRedo: false,
  undoLabel: "",
  redoLabel: "",
};
