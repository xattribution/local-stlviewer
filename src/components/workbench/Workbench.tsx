import { useEffect, useRef, useState, useSyncExternalStore, type ChangeEvent, type DragEvent } from "react";
import {
  Box,
  Camera,
  Copy,
  Download,
  Eye,
  EyeOff,
  FlipHorizontal,
  Focus,
  HelpCircle,
  Lock,
  Magnet,
  MousePointer2,
  Move,
  Redo2,
  RotateCw,
  Ruler,
  Scaling,
  Scissors,
  Trash2,
  Undo2,
  Unlock,
  Upload,
  BoxSelect,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn, formatBytes, formatNum } from "@/lib/utils";
import type { ViewerEngine } from "@/lib/viewer/engine";
import { EMPTY_SNAPSHOT, PRINTERS, type Tool, type RenderMode } from "@/lib/viewer/types";

const TOOLS: { id: Tool; label: string; icon: typeof Move; hint: string }[] = [
  { id: "select", label: "Select", icon: MousePointer2, hint: "Q" },
  { id: "move", label: "Move", icon: Move, hint: "G" },
  { id: "rotate", label: "Rotate", icon: RotateCw, hint: "R" },
  { id: "scale", label: "Scale", icon: Scaling, hint: "S" },
  { id: "mate", label: "Mate", icon: Magnet, hint: "T" },
  { id: "measure", label: "Measure", icon: Ruler, hint: "M" },
  { id: "section", label: "Section", icon: Scissors, hint: "\\" },
];

const RENDER_MODES: { id: RenderMode; label: string }[] = [
  { id: "studio", label: "Studio" },
  { id: "clay", label: "Clay" },
  { id: "metal", label: "Metal" },
  { id: "wire", label: "Wire" },
  { id: "xray", label: "X-ray" },
  { id: "normal", label: "Normals" },
  { id: "print", label: "Overhang" },
];

function toDisp(mm: number, units: "mm" | "in") {
  return units === "in" ? mm / 25.4 : mm;
}
function fromDisp(v: number, units: "mm" | "in") {
  return units === "in" ? v * 25.4 : v;
}

function NumField({
  label,
  value,
  onCommit,
  digits = 2,
}: {
  label: string;
  value: number;
  onCommit: (n: number) => void;
  digits?: number;
}) {
  const [raw, setRaw] = useState<string | null>(null);
  return (
    <div className="field">
      <label>{label}</label>
      <input
        type="number"
        step="any"
        value={raw ?? formatNum(value, digits)}
        onChange={(e) => setRaw(e.target.value)}
        onFocus={(e) => e.currentTarget.select()}
        onBlur={() => {
          if (raw != null && raw !== "" && Number.isFinite(parseFloat(raw))) onCommit(parseFloat(raw));
          setRaw(null);
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter") (e.target as HTMLInputElement).blur();
        }}
      />
    </div>
  );
}

export function Workbench() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const engineRef = useRef<ViewerEngine | null>(null);
  const [engine, setEngine] = useState<ViewerEngine | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [palette, setPalette] = useState(false);
  const [help, setHelp] = useState(false);
  const [query, setQuery] = useState("");
  const [sheet, setSheet] = useState<null | "parts" | "inspect">(null);
  const [mateOffset, setMateOffset] = useState(0);

  const snap = useSyncExternalStore(
    engine ? engine.subscribe : () => () => {},
    engine ? engine.getSnapshot : () => EMPTY_SNAPSHOT,
    () => EMPTY_SNAPSHOT,
  );

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    let cancelled = false;
    let inst: ViewerEngine | null = null;
    (async () => {
      const { ViewerEngine } = await import("@/lib/viewer/engine");
      if (cancelled || !canvasRef.current) return;
      inst = new ViewerEngine(canvasRef.current);
      engineRef.current = inst;
      setEngine(inst);
    })();
    return () => {
      cancelled = true;
      inst?.dispose();
      engineRef.current = null;
    };
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement;
      if (el.matches("input, textarea, select")) {
        if (e.key === "Escape") (el as HTMLInputElement).blur();
        return;
      }
      const eng = engineRef.current;
      if (!eng) return;
      const meta = e.metaKey || e.ctrlKey;

      if (meta && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setPalette((v) => !v);
        return;
      }
      if (meta && e.key.toLowerCase() === "z") {
        e.preventDefault();
        if (e.shiftKey) eng.redo();
        else eng.undo();
        return;
      }
      if (meta && e.key.toLowerCase() === "d") {
        e.preventDefault();
        eng.duplicate();
        return;
      }
      if (meta && e.key.toLowerCase() === "e") {
        e.preventDefault();
        eng.exportAssembly();
        return;
      }
      if (e.key === "?" || (e.shiftKey && e.key === "/")) {
        e.preventDefault();
        setHelp((v) => !v);
        return;
      }
      if (e.key === "Escape") {
        setPalette(false);
        setHelp(false);
        setSheet(null);
        eng.setTool("select");
        eng.clearFaces();
        return;
      }
      if (e.key === "Delete" || e.key === "Backspace") {
        e.preventDefault();
        eng.deleteSelected();
        return;
      }
      if (!meta) {
        const k = e.key.toLowerCase();
        if (k === "q") eng.setTool("select");
        if (k === "g") eng.setTool(eng.getSnapshot().tool === "move" ? "select" : "move");
        if (k === "r") eng.setTool(eng.getSnapshot().tool === "rotate" ? "select" : "rotate");
        if (k === "s") eng.setTool(eng.getSnapshot().tool === "scale" ? "select" : "scale");
        if (k === "t") eng.setTool("mate");
        if (k === "m") eng.setTool("measure");
        if (k === "f") eng.fitAll();
        if (k === "h") {
          const id = eng.getSnapshot().selectedId;
          if (id != null) {
            const p = eng.getSnapshot().parts.find((x) => x.id === id);
            if (p) eng.setVisible(id, !p.visible);
          }
        }
        if (k === "1") eng.setView("front");
        if (k === "3") eng.setView("right");
        if (k === "7") eng.setView("top");
        if (k === "0") eng.setView("iso");
        if (e.key === " ") {
          e.preventDefault();
          setPalette(true);
        }
        const step = e.shiftKey ? 1 : 0.2;
        if (e.key === "ArrowLeft") eng.nudge(-step, 0, 0);
        if (e.key === "ArrowRight") eng.nudge(step, 0, 0);
        if (e.key === "ArrowUp") eng.nudge(0, 0, -step);
        if (e.key === "ArrowDown") eng.nudge(0, 0, step);
        if (e.key === "PageUp") eng.nudge(0, step, 0);
        if (e.key === "PageDown") eng.nudge(0, -step, 0);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const onDrop = (e: DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    if (e.dataTransfer.files.length) engineRef.current?.loadFiles(e.dataTransfer.files);
  };

  const onFiles = (e: ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.length) engineRef.current?.loadFiles(e.target.files);
    e.target.value = "";
  };

  const selected = snap.parts.find((p) => p.id === snap.selectedId) ?? null;
  const u = snap.units;
  const digits = u === "in" ? 3 : 2;
  const unit = u === "in" ? "in" : "mm";
  const eng = engineRef.current;

  const commands = [
    { id: "kit", label: "Load workshop kit", run: () => eng?.loadKit() },
    { id: "open", label: "Open STL…", run: () => fileRef.current?.click() },
    { id: "fit", label: "Fit all", run: () => eng?.fitAll() },
    { id: "iso", label: "Isometric view", run: () => eng?.setView("iso") },
    { id: "top", label: "Top view", run: () => eng?.setView("top") },
    { id: "front", label: "Front view", run: () => eng?.setView("front") },
    { id: "export", label: "Export assembly STL", run: () => eng?.exportAssembly() },
    { id: "export-sel", label: "Export selected STL", run: () => eng?.exportSelected() },
    { id: "shot", label: "Screenshot", run: () => eng?.screenshot() },
    { id: "drop", label: "Drop all to bed", run: () => eng?.dropAll() },
    { id: "orient", label: "Auto-orient selected", run: () => eng?.autoOrient() },
    { id: "dup", label: "Duplicate", run: () => eng?.duplicate() },
    { id: "undo", label: "Undo", run: () => eng?.undo() },
    { id: "show", label: "Show all parts", run: () => eng?.showAll() },
  ].filter((c) => c.label.toLowerCase().includes(query.toLowerCase()));

  const runCmd = (fn: () => void) => {
    fn();
    setPalette(false);
    setQuery("");
  };

  return (
    <div
      className="flex h-dvh flex-col overflow-hidden bg-bg text-fg"
      onDragOver={(e) => {
        e.preventDefault();
        setDragOver(true);
      }}
      onDragLeave={() => setDragOver(false)}
      onDrop={onDrop}
    >
      <header className="flex h-12 shrink-0 items-center gap-3 border-b border-line px-3 md:px-4">
        <div className="flex items-baseline gap-2">
          <span className="font-sans text-sm font-semibold tracking-tight">DATUM</span>
          <span className="hidden font-mono text-2xs tracking-widest text-faint uppercase sm:inline">
            Mesh workbench
          </span>
        </div>
        <div className="ml-auto flex min-w-0 items-center gap-4 md:gap-6">
          <Dro label="X" value={toDisp(selected?.position[0] ?? 0, u)} digits={digits} empty={!selected} />
          <Dro label="Y" value={toDisp(selected?.position[1] ?? 0, u)} digits={digits} empty={!selected} />
          <Dro label="Z" value={toDisp(selected?.position[2] ?? 0, u)} digits={digits} empty={!selected} />
          <div className="hidden items-center gap-2 lg:flex">
            <span className="hud-label">{unit}</span>
            <span className="dro-num text-sm text-muted">
              {selected
                ? `${formatNum(toDisp(selected.size[0], u), 1)} × ${formatNum(toDisp(selected.size[1], u), 1)} × ${formatNum(toDisp(selected.size[2], u), 1)}`
                : "—"}
            </span>
          </div>
        </div>
        <div className="hidden items-center gap-1 md:flex">
          <Button variant="ghost" size="iconSm" title="Undo" disabled={!snap.canUndo} onClick={() => eng?.undo()}>
            <Undo2 className="size-3.5" />
          </Button>
          <Button variant="ghost" size="iconSm" title="Redo" disabled={!snap.canRedo} onClick={() => eng?.redo()}>
            <Redo2 className="size-3.5" />
          </Button>
          <Button variant="ghost" size="iconSm" title="Command palette" onClick={() => setPalette(true)}>
            <BoxSelect className="size-3.5" />
          </Button>
          <Button variant="ghost" size="iconSm" title="Shortcuts" onClick={() => setHelp(true)}>
            <HelpCircle className="size-3.5" />
          </Button>
        </div>
      </header>

      <div className="grid min-h-0 flex-1 grid-cols-1 md:grid-cols-[240px_minmax(0,1fr)_280px]">
        <aside className="hidden min-h-0 flex-col border-r border-line md:flex">
          <div className="flex gap-1 border-b border-line p-2">
            <Button variant="primary" size="sm" className="flex-1" onClick={() => fileRef.current?.click()}>
              <Upload className="size-3.5" /> Open
            </Button>
            <Button size="sm" className="flex-1" onClick={() => eng?.loadKit()}>
              Kit
            </Button>
          </div>
          <div className="flex flex-wrap gap-1 border-b border-line p-2">
            {TOOLS.map((t) => (
              <Button
                key={t.id}
                variant="tool"
                size="iconSm"
                active={snap.tool === t.id}
                title={`${t.label} (${t.hint})`}
                onClick={() => eng?.setTool(t.id)}
              >
                <t.icon className="size-3.5" />
              </Button>
            ))}
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto p-2">
            <div className="mb-2 flex items-center justify-between px-1">
              <span className="hud-label">Parts</span>
              <span className="font-mono text-2xs text-faint tabular-nums">{snap.parts.length}</span>
            </div>
            {snap.parts.length === 0 && (
              <p className="px-1 text-xs leading-relaxed text-muted">
                Drop STL files, or load the workshop kit to try mating, measuring, and print prep.
              </p>
            )}
            <ul className="flex flex-col gap-1">
              {snap.parts.map((p) => (
                <li key={p.id}>
                  <button
                    type="button"
                    onClick={() => eng?.select(p.id)}
                    className={cn(
                      "flex w-full items-center gap-2 rounded-md border px-2 py-2 text-left",
                      p.id === snap.selectedId
                        ? "border-accent bg-surface-2"
                        : "border-line bg-surface hover:border-faint",
                      !p.visible && "opacity-50",
                    )}
                  >
                    <span
                      className="size-2.5 shrink-0 rounded-sm border border-line"
                      style={{ background: p.color }}
                    />
                    <span className="min-w-0 flex-1 truncate text-xs font-medium">{p.name}</span>
                    <span className="font-mono text-2xs text-faint">{p.triCount.toLocaleString()}</span>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        </aside>

        <div className="relative min-h-0 bg-bg">
          <canvas ref={canvasRef} className="block size-full" />
          {snap.parts.length === 0 && (
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center p-6">
              <div className="max-w-sm text-center">
                <p className="font-sans text-xl font-medium tracking-tight">Drop STL to the plate</p>
                <p className="mt-2 text-sm leading-relaxed text-muted text-pretty">
                  Multi-part assemblies, planar face mating, measure, section, auto-orient, and binary STL export.
                </p>
                <div className="pointer-events-auto mt-5 flex justify-center gap-2">
                  <Button variant="primary" size="md" onClick={() => fileRef.current?.click()}>
                    <Upload className="size-4" /> Open STL
                  </Button>
                  <Button size="md" onClick={() => eng?.loadKit()}>
                    Load kit
                  </Button>
                </div>
              </div>
            </div>
          )}
          <div className="pointer-events-none absolute top-3 left-3 hidden max-w-xs text-xs text-muted md:block">
            {snap.hoverHint}
          </div>
          {snap.measureMm != null && (
            <div className="absolute bottom-16 left-1/2 z-10 -translate-x-1/2 rounded-md border border-line bg-surface px-3 py-1.5 font-mono text-sm tabular-nums md:bottom-4">
              {eng?.fmtLen(snap.measureMm)}
            </div>
          )}
          {snap.toast && (
            <div className="absolute bottom-20 left-1/2 z-20 -translate-x-1/2 rounded-md border border-line bg-surface px-3 py-2 text-sm md:bottom-8">
              {snap.toast}
            </div>
          )}
          {dragOver && (
            <div className="absolute inset-3 z-30 flex items-center justify-center rounded-lg border border-dashed border-accent bg-bg/80 text-sm">
              Drop STL files
            </div>
          )}
        </div>

        <aside className="hidden min-h-0 flex-col overflow-y-auto border-l border-line md:flex">
          <Inspector
            snap={snap}
            selected={selected}
            unit={unit}
            digits={digits}
            mateOffset={mateOffset}
            setMateOffset={setMateOffset}
            eng={eng}
          />
        </aside>
      </div>

      <footer className="flex h-8 shrink-0 items-center gap-4 border-t border-line px-3 font-mono text-2xs text-faint">
        <span className="tabular-nums">{snap.stats.parts} parts</span>
        <span className="tabular-nums">{snap.stats.tris.toLocaleString()} tris</span>
        <span className="hidden tabular-nums sm:inline">
          {formatNum(toDisp(snap.stats.volume, u), 1)} {unit}³
        </span>
        <span className="ml-auto hidden md:inline">F fit · G move · R rotate · T mate · M measure · ⌘K</span>
      </footer>

      <nav className="flex h-14 shrink-0 items-center justify-around border-t border-line bg-surface px-1 pb-[env(safe-area-inset-bottom)] md:hidden">
        {TOOLS.slice(0, 5).map((t) => (
          <Button
            key={t.id}
            variant="tool"
            size="dock"
            active={snap.tool === t.id}
            onClick={() => eng?.setTool(t.id)}
            aria-label={t.label}
          >
            <t.icon className="size-5" />
          </Button>
        ))}
        <Button variant="tool" size="dock" active={sheet === "parts"} onClick={() => setSheet(sheet === "parts" ? null : "parts")}>
          <Box className="size-5" />
        </Button>
        <Button
          variant="tool"
          size="dock"
          active={sheet === "inspect"}
          onClick={() => setSheet(sheet === "inspect" ? null : "inspect")}
        >
          <Focus className="size-5" />
        </Button>
      </nav>

      {sheet && (
        <div className="fixed inset-x-0 bottom-14 z-20 max-h-[55vh] overflow-y-auto border-t border-line bg-surface md:hidden">
          {sheet === "parts" ? (
            <div className="p-3">
              <div className="mb-2 flex gap-2">
                <Button variant="primary" size="sm" className="flex-1" onClick={() => fileRef.current?.click()}>
                  Open
                </Button>
                <Button size="sm" className="flex-1" onClick={() => eng?.loadKit()}>
                  Kit
                </Button>
              </div>
              {snap.parts.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => {
                    eng?.select(p.id);
                    setSheet("inspect");
                  }}
                  className="mb-1 flex w-full items-center gap-2 rounded-md border border-line px-2 py-3 text-left"
                >
                  <span className="size-2.5 rounded-sm" style={{ background: p.color }} />
                  <span className="flex-1 truncate text-sm">{p.name}</span>
                </button>
              ))}
            </div>
          ) : (
            <Inspector
              snap={snap}
              selected={selected}
              unit={unit}
              digits={digits}
              mateOffset={mateOffset}
              setMateOffset={setMateOffset}
              eng={eng}
            />
          )}
        </div>
      )}

      <input ref={fileRef} type="file" accept=".stl,model/stl,application/sla" multiple className="hidden" onChange={onFiles} />

      {palette && (
        <div
          className="fixed inset-0 z-40 flex items-start justify-center bg-bg/70 pt-24"
          onClick={() => setPalette(false)}
        >
          <div
            className="w-full max-w-md rounded-lg border border-line bg-surface p-2 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <input
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search commands…"
              className="mb-2 h-10 w-full rounded-md border border-line bg-bg px-3 text-sm outline-none"
              onKeyDown={(e) => {
                if (e.key === "Escape") setPalette(false);
                if (e.key === "Enter" && commands[0]) runCmd(commands[0].run);
              }}
            />
            <ul className="max-h-72 overflow-auto">
              {commands.map((c) => (
                <li key={c.id}>
                  <button
                    type="button"
                    className="flex h-9 w-full items-center rounded-sm px-3 text-left text-sm hover:bg-surface-2"
                    onClick={() => runCmd(c.run)}
                  >
                    {c.label}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}

      {help && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-bg/70 p-4" onClick={() => setHelp(false)}>
          <div
            className="max-h-[80vh] w-full max-w-lg overflow-auto rounded-lg border border-line bg-surface p-5"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-lg font-medium">Shortcuts</h2>
            <dl className="mt-4 grid grid-cols-2 gap-x-6 gap-y-2 font-mono text-xs">
              {[
                ["G", "Move"],
                ["R", "Rotate"],
                ["S", "Scale"],
                ["T", "Mate faces"],
                ["M", "Measure"],
                ["Q", "Select"],
                ["F", "Fit all"],
                ["1 / 3 / 7 / 0", "Front / Right / Top / Iso"],
                ["H", "Hide selected"],
                ["Del", "Delete"],
                ["⌘Z", "Undo"],
                ["⌘D", "Duplicate"],
                ["⌘E", "Export assembly"],
                ["⌘K / Space", "Command palette"],
                ["Arrows", "Nudge (Shift = 1mm)"],
                ["Esc", "Cancel"],
              ].map(([k, v]) => (
                <div key={k} className="contents">
                  <dt className="text-muted">{k}</dt>
                  <dd>{v}</dd>
                </div>
              ))}
            </dl>
            <p className="mt-4 text-xs leading-relaxed text-muted">
              Mate groups coplanar triangles into real faces. Click A (fixed) then B (moving). Measure snaps to nearby
              vertices. Overhang mode paints faces that need support.
            </p>
            <div className="mt-4 flex justify-end">
              <Button size="sm" onClick={() => setHelp(false)}>
                Close
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Dro({
  label,
  value,
  digits,
  empty,
}: {
  label: string;
  value: number;
  digits: number;
  empty: boolean;
}) {
  return (
    <div className="flex items-baseline gap-1.5">
      <span className="hud-label">{label}</span>
      <span className={cn("dro-num text-dro", empty && "text-faint")}>{empty ? "—" : formatNum(value, digits)}</span>
    </div>
  );
}

function Inspector({
  snap,
  selected,
  unit,
  digits,
  mateOffset,
  setMateOffset,
  eng,
}: {
  snap: typeof EMPTY_SNAPSHOT;
  selected: (typeof EMPTY_SNAPSHOT.parts)[0] | null;
  unit: string;
  digits: number;
  mateOffset: number;
  setMateOffset: (n: number) => void;
  eng: ViewerEngine | null;
}) {
  const u = snap.units;
  return (
    <div className="flex flex-col gap-1 p-3">
      <div className="flex gap-1">
        <Button size="sm" className="flex-1" onClick={() => eng?.fitAll()}>
          Fit
        </Button>
        <Button size="sm" onClick={() => eng?.setView("iso")}>
          Iso
        </Button>
        <Button size="sm" onClick={() => eng?.setView("top")}>
          Top
        </Button>
        <Button size="sm" onClick={() => eng?.setView("front")}>
          Front
        </Button>
      </div>

      <details className="panel" open>
        <summary>View</summary>
        <div className="flex flex-col gap-2 pb-3">
          <label className="flex items-center justify-between text-xs">
            Projection
            <button
              type="button"
              className="rounded-sm border border-line px-2 py-1 font-mono text-2xs"
              onClick={() => eng?.setOrtho(!snap.ortho)}
            >
              {snap.ortho ? "Ortho" : "Persp"}
            </button>
          </label>
          <label className="flex items-center justify-between text-xs">
            Shade
            <select
              className="h-7 rounded-sm border border-line bg-bg px-1 font-mono text-2xs"
              value={snap.renderMode}
              onChange={(e) => eng?.setRenderMode(e.target.value as RenderMode)}
            >
              {RENDER_MODES.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.label}
                </option>
              ))}
            </select>
          </label>
          <label className="flex items-center justify-between text-xs">
            Units
            <select
              className="h-7 rounded-sm border border-line bg-bg px-1 font-mono text-2xs"
              value={snap.units}
              onChange={(e) => eng?.setUnits(e.target.value as "mm" | "in")}
            >
              <option value="mm">mm</option>
              <option value="in">inch</option>
            </select>
          </label>
          <ToggleRow label="Grid / bed" on={snap.grid} onChange={(v) => eng?.setGrid(v)} />
          <ToggleRow label="World axes" on={snap.axes} onChange={(v) => eng?.setAxes(v)} />
          <ToggleRow label="Sharp edges" on={snap.edges} onChange={(v) => eng?.setEdges(v)} />
          <ToggleRow label="Shadows" on={snap.shadows} onChange={(v) => eng?.setShadows(v)} />
          <ToggleRow label="Snap 1mm / 15°" on={snap.snap} onChange={() => eng?.toggleSnap()} />
          <label className="text-xs text-muted">
            Exploded
            <input
              type="range"
              min={0}
              max={1}
              step={0.02}
              value={snap.explode}
              onChange={(e) => eng?.setExplode(parseFloat(e.target.value))}
            />
          </label>
        </div>
      </details>

      <details className="panel" open>
        <summary>Part</summary>
        {selected ? (
          <div className="flex flex-col gap-2 pb-3">
            <p className="truncate text-sm font-medium">{selected.name}</p>
            <p className="font-mono text-2xs text-muted">
              {selected.triCount.toLocaleString()} tris
              {selected.bytes ? ` · ${formatBytes(selected.bytes)}` : ""}
            </p>
            <div className="grid grid-cols-3 gap-1">
              <NumField
                label="X"
                value={toDisp(selected.position[0], u)}
                digits={digits}
                onCommit={(n) =>
                  eng?.setPosition(fromDisp(n, u), selected.position[1], selected.position[2])
                }
              />
              <NumField
                label="Y"
                value={toDisp(selected.position[1], u)}
                digits={digits}
                onCommit={(n) =>
                  eng?.setPosition(selected.position[0], fromDisp(n, u), selected.position[2])
                }
              />
              <NumField
                label="Z"
                value={toDisp(selected.position[2], u)}
                digits={digits}
                onCommit={(n) =>
                  eng?.setPosition(selected.position[0], selected.position[1], fromDisp(n, u))
                }
              />
            </div>
            <div className="grid grid-cols-3 gap-1">
              <NumField
                label="RX"
                value={selected.rotationDeg[0]}
                digits={1}
                onCommit={(n) => eng?.setRotationDeg(n, selected.rotationDeg[1], selected.rotationDeg[2])}
              />
              <NumField
                label="RY"
                value={selected.rotationDeg[1]}
                digits={1}
                onCommit={(n) => eng?.setRotationDeg(selected.rotationDeg[0], n, selected.rotationDeg[2])}
              />
              <NumField
                label="RZ"
                value={selected.rotationDeg[2]}
                digits={1}
                onCommit={(n) => eng?.setRotationDeg(selected.rotationDeg[0], selected.rotationDeg[1], n)}
              />
            </div>
            <div className="grid grid-cols-3 gap-1">
              <Button size="sm" disabled={selected.locked} onClick={() => eng?.rotate90("x")}>
                X 90°
              </Button>
              <Button size="sm" disabled={selected.locked} onClick={() => eng?.rotate90("y")}>
                Y 90°
              </Button>
              <Button size="sm" disabled={selected.locked} onClick={() => eng?.rotate90("z")}>
                Z 90°
              </Button>
            </div>
            <NumField
              label="S"
              value={selected.scale[0]}
              digits={3}
              onCommit={(n) => eng?.setUniformScale(n)}
            />
            <label className="text-xs text-muted">
              Longest side ({unit})
              <NumField
                label="L"
                value={toDisp(Math.max(...selected.size), u)}
                digits={digits}
                onCommit={(n) => eng?.scaleLongestTo(fromDisp(n, u))}
              />
            </label>
            <div className="flex items-center gap-2">
              <span className="hud-label">Color</span>
              <input type="color" value={selected.color} onChange={(e) => eng?.setColor(e.target.value)} />
            </div>
            <div className="flex flex-wrap gap-1">
              <Button size="sm" onClick={() => eng?.centerOnBed()} disabled={selected.locked}>
                Center
              </Button>
              <Button size="sm" onClick={() => eng?.dropToBed()} disabled={selected.locked}>
                Bed
              </Button>
              <Button size="sm" onClick={() => eng?.autoOrient()} disabled={selected.locked}>
                Orient
              </Button>
              <Button size="sm" onClick={() => eng?.resetXform()}>
                Reset
              </Button>
            </div>
            <div className="flex flex-wrap gap-1">
              <Button size="sm" onClick={() => eng?.mirror("x")} disabled={selected.locked} title="Mirror X">
                <FlipHorizontal className="size-3.5" /> X
              </Button>
              <Button size="sm" onClick={() => eng?.duplicate()}>
                <Copy className="size-3.5" /> Dup
              </Button>
              <Button
                size="sm"
                onClick={() => eng?.setVisible(selected.id, !selected.visible)}
              >
                {selected.visible ? <Eye className="size-3.5" /> : <EyeOff className="size-3.5" />}
              </Button>
              <Button size="sm" onClick={() => eng?.setLocked(selected.id, !selected.locked)}>
                {selected.locked ? <Lock className="size-3.5" /> : <Unlock className="size-3.5" />}
              </Button>
              <Button variant="danger" size="sm" onClick={() => eng?.deleteSelected()}>
                <Trash2 className="size-3.5" />
              </Button>
            </div>
            <p className="font-mono text-2xs text-muted">
              Vol {formatNum(toDisp(selected.volume, u), 2)} {unit}³ · {formatNum(toDisp(selected.area, u), 1)} {unit}²
            </p>
          </div>
        ) : (
          <p className="pb-3 text-xs text-muted">Select a part to transform it.</p>
        )}
      </details>

      <details className="panel" open={snap.tool === "mate" || snap.tool === "measure" || snap.tool === "section"}>
        <summary>Assemble</summary>
        <div className="flex flex-col gap-2 pb-3">
          <p className="text-xs leading-relaxed text-muted">
            {snap.tool === "mate"
              ? "Click two planar faces on different parts. B moves onto A."
              : "Switch to Mate to join faces, Measure for distances, Section to clip."}
          </p>
          <div className="flex gap-1 text-2xs font-mono">
            <span className="rounded-sm border border-line px-2 py-1">{snap.mateA ?? "A —"}</span>
            <span className="rounded-sm border border-line px-2 py-1">{snap.mateB ?? "B —"}</span>
          </div>
          <NumField label="Δ" value={mateOffset} digits={2} onCommit={setMateOffset} />
          <div className="flex gap-1">
            <Button
              variant="primary"
              size="sm"
              disabled={!snap.mateReady}
              onClick={() => eng?.mate(mateOffset)}
            >
              <Magnet className="size-3.5" /> Mate
            </Button>
            <Button size="sm" onClick={() => eng?.clearFaces()}>
              Clear faces
            </Button>
          </div>
          <div className="flex gap-1">
            <Button size="sm" active={snap.tool === "measure"} onClick={() => eng?.setTool("measure")}>
              <Ruler className="size-3.5" /> Measure
            </Button>
            <Button size="sm" onClick={() => eng?.clearMeasure()}>
              Clear
            </Button>
          </div>
          {snap.measureMm != null && (
            <p className="font-mono text-sm tabular-nums">{eng?.fmtLen(snap.measureMm)}</p>
          )}
          <ToggleRow
            label="Section plane"
            on={snap.sectionOn}
            onChange={(v) => eng?.setSection(v, snap.sectionAxis, snap.sectionPos)}
          />
          {snap.sectionOn && (
            <>
              <div className="flex gap-1">
                {(["x", "y", "z"] as const).map((ax) => (
                  <Button
                    key={ax}
                    size="sm"
                    active={snap.sectionAxis === ax}
                    onClick={() => eng?.setSection(true, ax, snap.sectionPos)}
                  >
                    {ax.toUpperCase()}
                  </Button>
                ))}
              </div>
              <input
                type="range"
                min={0}
                max={1}
                step={0.01}
                value={snap.sectionPos}
                onChange={(e) => eng?.setSection(true, snap.sectionAxis, parseFloat(e.target.value))}
              />
            </>
          )}
        </div>
      </details>

      <details className="panel">
        <summary>Print</summary>
        <div className="flex flex-col gap-2 pb-3">
          <label className="flex items-center justify-between text-xs">
            Volume
            <select
              className="h-7 max-w-40 rounded-sm border border-line bg-bg px-1 font-mono text-2xs"
              value={snap.printerId}
              onChange={(e) => eng?.setPrinter(e.target.value)}
            >
              {PRINTERS.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} {p.x}×{p.z}×{p.y}
                </option>
              ))}
            </select>
          </label>
          <Button size="sm" onClick={() => eng?.dropAll()}>
            Drop all to bed
          </Button>
          <Button size="sm" onClick={() => eng?.setRenderMode("print")}>
            Overhang check
          </Button>
          <p className="text-2xs leading-relaxed text-muted">
            Overhang shade: cool faces print clean, warm faces need support (over 45°).
          </p>
        </div>
      </details>

      <div className="mt-2 flex flex-wrap gap-1">
        <Button variant="primary" size="sm" disabled={!selected} onClick={() => eng?.exportSelected()}>
          <Download className="size-3.5" /> Part STL
        </Button>
        <Button size="sm" disabled={!snap.parts.length} onClick={() => eng?.exportAssembly()}>
          Assembly
        </Button>
        <Button size="sm" onClick={() => eng?.screenshot()}>
          <Camera className="size-3.5" />
        </Button>
      </div>
    </div>
  );
}

function ToggleRow({
  label,
  on,
  onChange,
}: {
  label: string;
  on: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label className="flex cursor-pointer items-center justify-between text-xs">
      {label}
      <input type="checkbox" checked={on} onChange={(e) => onChange(e.target.checked)} />
    </label>
  );
}
