import { i as __toESM } from "../_runtime.mjs";
import { I as require_jsx_runtime, L as require_react } from "../_libs/@tanstack/react-router+[...].mjs";
import { C as Camera, S as CircleHelp, _ as FlipHorizontal, a as SquareDashed, b as Download, c as Ruler, d as Move, f as MousePointer2, g as Focus, h as LockOpen, i as Trash2, l as RotateCw, m as Lock, n as Undo2, o as Scissors, p as Magnet, s as Scaling, t as Upload, u as Redo2, v as Eye, w as Box, x as Copy, y as EyeOff } from "../_libs/lucide-react.mjs";
import { n as clsx, t as cva } from "../_libs/class-variance-authority+clsx.mjs";
import { t as twMerge } from "../_libs/tailwind-merge.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/routes-RC3eb1IR.js
var import_react = /* @__PURE__ */ __toESM(require_react());
var import_jsx_runtime = require_jsx_runtime();
var __defProp = Object.defineProperty;
var __exportAll = (all, no_symbols) => {
	let target = {};
	for (var name in all) __defProp(target, name, {
		get: all[name],
		enumerable: true
	});
	if (!no_symbols) __defProp(target, Symbol.toStringTag, { value: "Module" });
	return target;
};
var PRINTERS = [
	{
		id: "ender3",
		name: "Ender 3",
		x: 220,
		z: 220,
		y: 250
	},
	{
		id: "prusa-mk4",
		name: "Prusa MK4",
		x: 250,
		z: 210,
		y: 220
	},
	{
		id: "prusa-mini",
		name: "Prusa Mini",
		x: 180,
		z: 180,
		y: 180
	},
	{
		id: "bambu",
		name: "Bambu A1 / P1",
		x: 256,
		z: 256,
		y: 256
	},
	{
		id: "open",
		name: "Open bed 300",
		x: 300,
		z: 300,
		y: 300
	}
];
var PART_COLORS = [
	14212838,
	11450564,
	15261908,
	11845814,
	13620958,
	9410723,
	14538440,
	10135472
];
var EMPTY_SNAPSHOT = {
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
	sectionPos: .5,
	printerId: "ender3",
	measureMm: null,
	mateA: null,
	mateB: null,
	mateReady: false,
	hoverHint: "Drop STL files to begin",
	toast: null,
	stats: {
		tris: 0,
		parts: 0,
		volume: 0
	},
	canUndo: false,
	canRedo: false,
	undoLabel: "",
	redoLabel: ""
};
function cn(...inputs) {
	return twMerge(clsx(inputs));
}
function formatBytes(b) {
	if (b < 1024) return `${b} B`;
	if (b < 1048576) return `${(b / 1024).toFixed(1)} KB`;
	return `${(b / 1048576).toFixed(2)} MB`;
}
function formatNum(n, digits = 2) {
	if (!Number.isFinite(n)) return "—";
	return n.toFixed(digits);
}
var buttonVariants = cva("inline-flex items-center justify-center gap-1.5 font-medium select-none transition-colors duration-150 ease-out focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-accent disabled:pointer-events-none disabled:opacity-40", {
	variants: {
		variant: {
			primary: "bg-accent text-accent-fg hover:bg-fg",
			ghost: "bg-transparent text-muted hover:bg-surface-2 hover:text-fg",
			outline: "border border-line bg-transparent text-fg hover:bg-surface-2",
			danger: "border border-line text-danger hover:bg-surface-2",
			tool: "border border-line bg-surface text-muted hover:text-fg hover:bg-surface-2 data-[on=true]:bg-accent data-[on=true]:text-accent-fg data-[on=true]:border-accent"
		},
		size: {
			sm: "h-7 px-2 text-xs rounded-sm",
			md: "h-9 px-3 text-sm rounded-md",
			icon: "size-9 rounded-md",
			iconSm: "size-7 rounded-sm",
			dock: "size-11 rounded-md"
		}
	},
	defaultVariants: {
		variant: "outline",
		size: "sm"
	}
});
function Button({ className, variant, size, active, ...props }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
		className: cn(buttonVariants({
			variant,
			size
		}), className),
		"data-on": active ? "true" : void 0,
		...props
	});
}
var TOOLS = [
	{
		id: "select",
		label: "Select",
		icon: MousePointer2,
		hint: "Q"
	},
	{
		id: "move",
		label: "Move",
		icon: Move,
		hint: "G"
	},
	{
		id: "rotate",
		label: "Rotate",
		icon: RotateCw,
		hint: "R"
	},
	{
		id: "scale",
		label: "Scale",
		icon: Scaling,
		hint: "S"
	},
	{
		id: "mate",
		label: "Mate",
		icon: Magnet,
		hint: "T"
	},
	{
		id: "measure",
		label: "Measure",
		icon: Ruler,
		hint: "M"
	},
	{
		id: "section",
		label: "Section",
		icon: Scissors,
		hint: "\\"
	}
];
var RENDER_MODES = [
	{
		id: "studio",
		label: "Studio"
	},
	{
		id: "clay",
		label: "Clay"
	},
	{
		id: "metal",
		label: "Metal"
	},
	{
		id: "wire",
		label: "Wire"
	},
	{
		id: "xray",
		label: "X-ray"
	},
	{
		id: "normal",
		label: "Normals"
	},
	{
		id: "print",
		label: "Overhang"
	}
];
function toDisp(mm, units) {
	return units === "in" ? mm / 25.4 : mm;
}
function fromDisp(v, units) {
	return units === "in" ? v * 25.4 : v;
}
function NumField({ label, value, onCommit, digits = 2 }) {
	const [raw, setRaw] = (0, import_react.useState)(null);
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "field",
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("label", { children: label }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
			type: "number",
			step: "any",
			value: raw ?? formatNum(value, digits),
			onChange: (e) => setRaw(e.target.value),
			onFocus: (e) => e.currentTarget.select(),
			onBlur: () => {
				if (raw != null && raw !== "" && Number.isFinite(parseFloat(raw))) onCommit(parseFloat(raw));
				setRaw(null);
			},
			onKeyDown: (e) => {
				if (e.key === "Enter") e.target.blur();
			}
		})]
	});
}
function Workbench() {
	const canvasRef = (0, import_react.useRef)(null);
	const fileRef = (0, import_react.useRef)(null);
	const engineRef = (0, import_react.useRef)(null);
	const [engine, setEngine] = (0, import_react.useState)(null);
	const [dragOver, setDragOver] = (0, import_react.useState)(false);
	const [palette, setPalette] = (0, import_react.useState)(false);
	const [help, setHelp] = (0, import_react.useState)(false);
	const [query, setQuery] = (0, import_react.useState)("");
	const [sheet, setSheet] = (0, import_react.useState)(null);
	const [mateOffset, setMateOffset] = (0, import_react.useState)(0);
	const snap = (0, import_react.useSyncExternalStore)(engine ? engine.subscribe : () => () => {}, engine ? engine.getSnapshot : () => EMPTY_SNAPSHOT, () => EMPTY_SNAPSHOT);
	(0, import_react.useEffect)(() => {
		if (!canvasRef.current) return;
		let cancelled = false;
		let inst = null;
		(async () => {
			const { ViewerEngine } = await import("./engine-DJKDPpNH.mjs");
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
	(0, import_react.useEffect)(() => {
		const onKey = (e) => {
			const el = e.target;
			if (el.matches("input, textarea, select")) {
				if (e.key === "Escape") el.blur();
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
			if (e.key === "?" || e.shiftKey && e.key === "/") {
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
				const step = e.shiftKey ? 1 : .2;
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
	const onDrop = (e) => {
		e.preventDefault();
		setDragOver(false);
		if (e.dataTransfer.files.length) engineRef.current?.loadFiles(e.dataTransfer.files);
	};
	const onFiles = (e) => {
		if (e.target.files?.length) engineRef.current?.loadFiles(e.target.files);
		e.target.value = "";
	};
	const selected = snap.parts.find((p) => p.id === snap.selectedId) ?? null;
	const u = snap.units;
	const digits = u === "in" ? 3 : 2;
	const unit = u === "in" ? "in" : "mm";
	const eng = engineRef.current;
	const commands = [
		{
			id: "kit",
			label: "Load workshop kit",
			run: () => eng?.loadKit()
		},
		{
			id: "open",
			label: "Open STL…",
			run: () => fileRef.current?.click()
		},
		{
			id: "fit",
			label: "Fit all",
			run: () => eng?.fitAll()
		},
		{
			id: "iso",
			label: "Isometric view",
			run: () => eng?.setView("iso")
		},
		{
			id: "top",
			label: "Top view",
			run: () => eng?.setView("top")
		},
		{
			id: "front",
			label: "Front view",
			run: () => eng?.setView("front")
		},
		{
			id: "export",
			label: "Export assembly STL",
			run: () => eng?.exportAssembly()
		},
		{
			id: "export-sel",
			label: "Export selected STL",
			run: () => eng?.exportSelected()
		},
		{
			id: "shot",
			label: "Screenshot",
			run: () => eng?.screenshot()
		},
		{
			id: "drop",
			label: "Drop all to bed",
			run: () => eng?.dropAll()
		},
		{
			id: "orient",
			label: "Auto-orient selected",
			run: () => eng?.autoOrient()
		},
		{
			id: "dup",
			label: "Duplicate",
			run: () => eng?.duplicate()
		},
		{
			id: "undo",
			label: "Undo",
			run: () => eng?.undo()
		},
		{
			id: "show",
			label: "Show all parts",
			run: () => eng?.showAll()
		}
	].filter((c) => c.label.toLowerCase().includes(query.toLowerCase()));
	const runCmd = (fn) => {
		fn();
		setPalette(false);
		setQuery("");
	};
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "flex h-dvh flex-col overflow-hidden bg-bg text-fg",
		onDragOver: (e) => {
			e.preventDefault();
			setDragOver(true);
		},
		onDragLeave: () => setDragOver(false),
		onDrop,
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("header", {
				className: "flex h-12 shrink-0 items-center gap-3 border-b border-line px-3 md:px-4",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "flex items-baseline gap-2",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
							className: "font-sans text-sm font-semibold tracking-tight",
							children: "DATUM"
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
							className: "hidden font-mono text-2xs tracking-widest text-faint uppercase sm:inline",
							children: "Mesh workbench"
						})]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "ml-auto flex min-w-0 items-center gap-4 md:gap-6",
						children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Dro, {
								label: "X",
								value: toDisp(selected?.position[0] ?? 0, u),
								digits,
								empty: !selected
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Dro, {
								label: "Y",
								value: toDisp(selected?.position[1] ?? 0, u),
								digits,
								empty: !selected
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Dro, {
								label: "Z",
								value: toDisp(selected?.position[2] ?? 0, u),
								digits,
								empty: !selected
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "hidden items-center gap-2 lg:flex",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
									className: "hud-label",
									children: unit
								}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
									className: "dro-num text-sm text-muted",
									children: selected ? `${formatNum(toDisp(selected.size[0], u), 1)} × ${formatNum(toDisp(selected.size[1], u), 1)} × ${formatNum(toDisp(selected.size[2], u), 1)}` : "—"
								})]
							})
						]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "hidden items-center gap-1 md:flex",
						children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
								variant: "ghost",
								size: "iconSm",
								title: "Undo",
								disabled: !snap.canUndo,
								onClick: () => eng?.undo(),
								children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Undo2, { className: "size-3.5" })
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
								variant: "ghost",
								size: "iconSm",
								title: "Redo",
								disabled: !snap.canRedo,
								onClick: () => eng?.redo(),
								children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Redo2, { className: "size-3.5" })
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
								variant: "ghost",
								size: "iconSm",
								title: "Command palette",
								onClick: () => setPalette(true),
								children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(SquareDashed, { className: "size-3.5" })
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
								variant: "ghost",
								size: "iconSm",
								title: "Shortcuts",
								onClick: () => setHelp(true),
								children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(CircleHelp, { className: "size-3.5" })
							})
						]
					})
				]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "grid min-h-0 flex-1 grid-cols-1 md:grid-cols-[240px_minmax(0,1fr)_280px]",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("aside", {
						className: "hidden min-h-0 flex-col border-r border-line md:flex",
						children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "flex gap-1 border-b border-line p-2",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Button, {
									variant: "primary",
									size: "sm",
									className: "flex-1",
									onClick: () => fileRef.current?.click(),
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Upload, { className: "size-3.5" }), " Open"]
								}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
									size: "sm",
									className: "flex-1",
									onClick: () => eng?.loadKit(),
									children: "Kit"
								})]
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
								className: "flex flex-wrap gap-1 border-b border-line p-2",
								children: TOOLS.map((t) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
									variant: "tool",
									size: "iconSm",
									active: snap.tool === t.id,
									title: `${t.label} (${t.hint})`,
									onClick: () => eng?.setTool(t.id),
									children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(t.icon, { className: "size-3.5" })
								}, t.id))
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "min-h-0 flex-1 overflow-y-auto p-2",
								children: [
									/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
										className: "mb-2 flex items-center justify-between px-1",
										children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
											className: "hud-label",
											children: "Parts"
										}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
											className: "font-mono text-2xs text-faint tabular-nums",
											children: snap.parts.length
										})]
									}),
									snap.parts.length === 0 && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
										className: "px-1 text-xs leading-relaxed text-muted",
										children: "Drop STL files, or load the workshop kit to try mating, measuring, and print prep."
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("ul", {
										className: "flex flex-col gap-1",
										children: snap.parts.map((p) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("li", { children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
											type: "button",
											onClick: () => eng?.select(p.id),
											className: cn("flex w-full items-center gap-2 rounded-md border px-2 py-2 text-left", p.id === snap.selectedId ? "border-accent bg-surface-2" : "border-line bg-surface hover:border-faint", !p.visible && "opacity-50"),
											children: [
												/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
													className: "size-2.5 shrink-0 rounded-sm border border-line",
													style: { background: p.color }
												}),
												/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
													className: "min-w-0 flex-1 truncate text-xs font-medium",
													children: p.name
												}),
												/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
													className: "font-mono text-2xs text-faint",
													children: p.triCount.toLocaleString()
												})
											]
										}) }, p.id))
									})
								]
							})
						]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "relative min-h-0 bg-bg",
						children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("canvas", {
								ref: canvasRef,
								className: "block size-full"
							}),
							snap.parts.length === 0 && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
								className: "pointer-events-none absolute inset-0 flex items-center justify-center p-6",
								children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
									className: "max-w-sm text-center",
									children: [
										/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
											className: "font-sans text-xl font-medium tracking-tight",
											children: "Drop STL to the plate"
										}),
										/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
											className: "mt-2 text-sm leading-relaxed text-muted text-pretty",
											children: "Multi-part assemblies, planar face mating, measure, section, auto-orient, and binary STL export."
										}),
										/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
											className: "pointer-events-auto mt-5 flex justify-center gap-2",
											children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Button, {
												variant: "primary",
												size: "md",
												onClick: () => fileRef.current?.click(),
												children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Upload, { className: "size-4" }), " Open STL"]
											}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
												size: "md",
												onClick: () => eng?.loadKit(),
												children: "Load kit"
											})]
										})
									]
								})
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
								className: "pointer-events-none absolute top-3 left-3 hidden max-w-xs text-xs text-muted md:block",
								children: snap.hoverHint
							}),
							snap.measureMm != null && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
								className: "absolute bottom-16 left-1/2 z-10 -translate-x-1/2 rounded-md border border-line bg-surface px-3 py-1.5 font-mono text-sm tabular-nums md:bottom-4",
								children: eng?.fmtLen(snap.measureMm)
							}),
							snap.toast && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
								className: "absolute bottom-20 left-1/2 z-20 -translate-x-1/2 rounded-md border border-line bg-surface px-3 py-2 text-sm md:bottom-8",
								children: snap.toast
							}),
							dragOver && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
								className: "absolute inset-3 z-30 flex items-center justify-center rounded-lg border border-dashed border-accent bg-bg/80 text-sm",
								children: "Drop STL files"
							})
						]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("aside", {
						className: "hidden min-h-0 flex-col overflow-y-auto border-l border-line md:flex",
						children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Inspector, {
							snap,
							selected,
							unit,
							digits,
							mateOffset,
							setMateOffset,
							eng
						})
					})
				]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("footer", {
				className: "flex h-8 shrink-0 items-center gap-4 border-t border-line px-3 font-mono text-2xs text-faint",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
						className: "tabular-nums",
						children: [snap.stats.parts, " parts"]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
						className: "tabular-nums",
						children: [snap.stats.tris.toLocaleString(), " tris"]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
						className: "hidden tabular-nums sm:inline",
						children: [
							formatNum(toDisp(snap.stats.volume, u), 1),
							" ",
							unit,
							"³"
						]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
						className: "ml-auto hidden md:inline",
						children: "F fit · G move · R rotate · T mate · M measure · ⌘K"
					})
				]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("nav", {
				className: "flex h-14 shrink-0 items-center justify-around border-t border-line bg-surface px-1 pb-[env(safe-area-inset-bottom)] md:hidden",
				children: [
					TOOLS.slice(0, 5).map((t) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
						variant: "tool",
						size: "dock",
						active: snap.tool === t.id,
						onClick: () => eng?.setTool(t.id),
						"aria-label": t.label,
						children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(t.icon, { className: "size-5" })
					}, t.id)),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
						variant: "tool",
						size: "dock",
						active: sheet === "parts",
						onClick: () => setSheet(sheet === "parts" ? null : "parts"),
						children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Box, { className: "size-5" })
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
						variant: "tool",
						size: "dock",
						active: sheet === "inspect",
						onClick: () => setSheet(sheet === "inspect" ? null : "inspect"),
						children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Focus, { className: "size-5" })
					})
				]
			}),
			sheet && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "fixed inset-x-0 bottom-14 z-20 max-h-[55vh] overflow-y-auto border-t border-line bg-surface md:hidden",
				children: sheet === "parts" ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "p-3",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "mb-2 flex gap-2",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
							variant: "primary",
							size: "sm",
							className: "flex-1",
							onClick: () => fileRef.current?.click(),
							children: "Open"
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
							size: "sm",
							className: "flex-1",
							onClick: () => eng?.loadKit(),
							children: "Kit"
						})]
					}), snap.parts.map((p) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
						type: "button",
						onClick: () => {
							eng?.select(p.id);
							setSheet("inspect");
						},
						className: "mb-1 flex w-full items-center gap-2 rounded-md border border-line px-2 py-3 text-left",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
							className: "size-2.5 rounded-sm",
							style: { background: p.color }
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
							className: "flex-1 truncate text-sm",
							children: p.name
						})]
					}, p.id))]
				}) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Inspector, {
					snap,
					selected,
					unit,
					digits,
					mateOffset,
					setMateOffset,
					eng
				})
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
				ref: fileRef,
				type: "file",
				accept: ".stl,model/stl,application/sla",
				multiple: true,
				className: "hidden",
				onChange: onFiles
			}),
			palette && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "fixed inset-0 z-40 flex items-start justify-center bg-bg/70 pt-24",
				onClick: () => setPalette(false),
				children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "w-full max-w-md rounded-lg border border-line bg-surface p-2 shadow-2xl",
					onClick: (e) => e.stopPropagation(),
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
						autoFocus: true,
						value: query,
						onChange: (e) => setQuery(e.target.value),
						placeholder: "Search commands…",
						className: "mb-2 h-10 w-full rounded-md border border-line bg-bg px-3 text-sm outline-none",
						onKeyDown: (e) => {
							if (e.key === "Escape") setPalette(false);
							if (e.key === "Enter" && commands[0]) runCmd(commands[0].run);
						}
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("ul", {
						className: "max-h-72 overflow-auto",
						children: commands.map((c) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("li", { children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
							type: "button",
							className: "flex h-9 w-full items-center rounded-sm px-3 text-left text-sm hover:bg-surface-2",
							onClick: () => runCmd(c.run),
							children: c.label
						}) }, c.id))
					})]
				})
			}),
			help && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "fixed inset-0 z-40 flex items-center justify-center bg-bg/70 p-4",
				onClick: () => setHelp(false),
				children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "max-h-[80vh] w-full max-w-lg overflow-auto rounded-lg border border-line bg-surface p-5",
					onClick: (e) => e.stopPropagation(),
					children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", {
							className: "text-lg font-medium",
							children: "Shortcuts"
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("dl", {
							className: "mt-4 grid grid-cols-2 gap-x-6 gap-y-2 font-mono text-xs",
							children: [
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
								["Esc", "Cancel"]
							].map(([k, v]) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "contents",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("dt", {
									className: "text-muted",
									children: k
								}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("dd", { children: v })]
							}, k))
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
							className: "mt-4 text-xs leading-relaxed text-muted",
							children: "Mate groups coplanar triangles into real faces. Click A (fixed) then B (moving). Measure snaps to nearby vertices. Overhang mode paints faces that need support."
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
							className: "mt-4 flex justify-end",
							children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
								size: "sm",
								onClick: () => setHelp(false),
								children: "Close"
							})
						})
					]
				})
			})
		]
	});
}
function Dro({ label, value, digits, empty }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "flex items-baseline gap-1.5",
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
			className: "hud-label",
			children: label
		}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
			className: cn("dro-num text-dro", empty && "text-faint"),
			children: empty ? "—" : formatNum(value, digits)
		})]
	});
}
function Inspector({ snap, selected, unit, digits, mateOffset, setMateOffset, eng }) {
	const u = snap.units;
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "flex flex-col gap-1 p-3",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "flex gap-1",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
						size: "sm",
						className: "flex-1",
						onClick: () => eng?.fitAll(),
						children: "Fit"
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
						size: "sm",
						onClick: () => eng?.setView("iso"),
						children: "Iso"
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
						size: "sm",
						onClick: () => eng?.setView("top"),
						children: "Top"
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
						size: "sm",
						onClick: () => eng?.setView("front"),
						children: "Front"
					})
				]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("details", {
				className: "panel",
				open: true,
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("summary", { children: "View" }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "flex flex-col gap-2 pb-3",
					children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", {
							className: "flex items-center justify-between text-xs",
							children: ["Projection", /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
								type: "button",
								className: "rounded-sm border border-line px-2 py-1 font-mono text-2xs",
								onClick: () => eng?.setOrtho(!snap.ortho),
								children: snap.ortho ? "Ortho" : "Persp"
							})]
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", {
							className: "flex items-center justify-between text-xs",
							children: ["Shade", /* @__PURE__ */ (0, import_jsx_runtime.jsx)("select", {
								className: "h-7 rounded-sm border border-line bg-bg px-1 font-mono text-2xs",
								value: snap.renderMode,
								onChange: (e) => eng?.setRenderMode(e.target.value),
								children: RENDER_MODES.map((m) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
									value: m.id,
									children: m.label
								}, m.id))
							})]
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", {
							className: "flex items-center justify-between text-xs",
							children: ["Units", /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("select", {
								className: "h-7 rounded-sm border border-line bg-bg px-1 font-mono text-2xs",
								value: snap.units,
								onChange: (e) => eng?.setUnits(e.target.value),
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
									value: "mm",
									children: "mm"
								}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
									value: "in",
									children: "inch"
								})]
							})]
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)(ToggleRow, {
							label: "Grid / bed",
							on: snap.grid,
							onChange: (v) => eng?.setGrid(v)
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)(ToggleRow, {
							label: "World axes",
							on: snap.axes,
							onChange: (v) => eng?.setAxes(v)
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)(ToggleRow, {
							label: "Sharp edges",
							on: snap.edges,
							onChange: (v) => eng?.setEdges(v)
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)(ToggleRow, {
							label: "Shadows",
							on: snap.shadows,
							onChange: (v) => eng?.setShadows(v)
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)(ToggleRow, {
							label: "Snap 1mm / 15°",
							on: snap.snap,
							onChange: () => eng?.toggleSnap()
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", {
							className: "text-xs text-muted",
							children: ["Exploded", /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
								type: "range",
								min: 0,
								max: 1,
								step: .02,
								value: snap.explode,
								onChange: (e) => eng?.setExplode(parseFloat(e.target.value))
							})]
						})
					]
				})]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("details", {
				className: "panel",
				open: true,
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("summary", { children: "Part" }), selected ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "flex flex-col gap-2 pb-3",
					children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
							className: "truncate text-sm font-medium",
							children: selected.name
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
							className: "font-mono text-2xs text-muted",
							children: [
								selected.triCount.toLocaleString(),
								" tris",
								selected.bytes ? ` · ${formatBytes(selected.bytes)}` : ""
							]
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "grid grid-cols-3 gap-1",
							children: [
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)(NumField, {
									label: "X",
									value: toDisp(selected.position[0], u),
									digits,
									onCommit: (n) => eng?.setPosition(fromDisp(n, u), selected.position[1], selected.position[2])
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)(NumField, {
									label: "Y",
									value: toDisp(selected.position[1], u),
									digits,
									onCommit: (n) => eng?.setPosition(selected.position[0], fromDisp(n, u), selected.position[2])
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)(NumField, {
									label: "Z",
									value: toDisp(selected.position[2], u),
									digits,
									onCommit: (n) => eng?.setPosition(selected.position[0], selected.position[1], fromDisp(n, u))
								})
							]
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "grid grid-cols-3 gap-1",
							children: [
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)(NumField, {
									label: "RX",
									value: selected.rotationDeg[0],
									digits: 1,
									onCommit: (n) => eng?.setRotationDeg(n, selected.rotationDeg[1], selected.rotationDeg[2])
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)(NumField, {
									label: "RY",
									value: selected.rotationDeg[1],
									digits: 1,
									onCommit: (n) => eng?.setRotationDeg(selected.rotationDeg[0], n, selected.rotationDeg[2])
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)(NumField, {
									label: "RZ",
									value: selected.rotationDeg[2],
									digits: 1,
									onCommit: (n) => eng?.setRotationDeg(selected.rotationDeg[0], selected.rotationDeg[1], n)
								})
							]
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "grid grid-cols-3 gap-1",
							children: [
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
									size: "sm",
									disabled: selected.locked,
									onClick: () => eng?.rotate90("x"),
									children: "X 90°"
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
									size: "sm",
									disabled: selected.locked,
									onClick: () => eng?.rotate90("y"),
									children: "Y 90°"
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
									size: "sm",
									disabled: selected.locked,
									onClick: () => eng?.rotate90("z"),
									children: "Z 90°"
								})
							]
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)(NumField, {
							label: "S",
							value: selected.scale[0],
							digits: 3,
							onCommit: (n) => eng?.setUniformScale(n)
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", {
							className: "text-xs text-muted",
							children: [
								"Longest side (",
								unit,
								")",
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)(NumField, {
									label: "L",
									value: toDisp(Math.max(...selected.size), u),
									digits,
									onCommit: (n) => eng?.scaleLongestTo(fromDisp(n, u))
								})
							]
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "flex items-center gap-2",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
								className: "hud-label",
								children: "Color"
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
								type: "color",
								value: selected.color,
								onChange: (e) => eng?.setColor(e.target.value)
							})]
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "flex flex-wrap gap-1",
							children: [
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
									size: "sm",
									onClick: () => eng?.centerOnBed(),
									disabled: selected.locked,
									children: "Center"
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
									size: "sm",
									onClick: () => eng?.dropToBed(),
									disabled: selected.locked,
									children: "Bed"
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
									size: "sm",
									onClick: () => eng?.autoOrient(),
									disabled: selected.locked,
									children: "Orient"
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
									size: "sm",
									onClick: () => eng?.resetXform(),
									children: "Reset"
								})
							]
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "flex flex-wrap gap-1",
							children: [
								/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Button, {
									size: "sm",
									onClick: () => eng?.mirror("x"),
									disabled: selected.locked,
									title: "Mirror X",
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(FlipHorizontal, { className: "size-3.5" }), " X"]
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Button, {
									size: "sm",
									onClick: () => eng?.duplicate(),
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Copy, { className: "size-3.5" }), " Dup"]
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
									size: "sm",
									onClick: () => eng?.setVisible(selected.id, !selected.visible),
									children: selected.visible ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Eye, { className: "size-3.5" }) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)(EyeOff, { className: "size-3.5" })
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
									size: "sm",
									onClick: () => eng?.setLocked(selected.id, !selected.locked),
									children: selected.locked ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Lock, { className: "size-3.5" }) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)(LockOpen, { className: "size-3.5" })
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
									variant: "danger",
									size: "sm",
									onClick: () => eng?.deleteSelected(),
									children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Trash2, { className: "size-3.5" })
								})
							]
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
							className: "font-mono text-2xs text-muted",
							children: [
								"Vol ",
								formatNum(toDisp(selected.volume, u), 2),
								" ",
								unit,
								"³ · ",
								formatNum(toDisp(selected.area, u), 1),
								" ",
								unit,
								"²"
							]
						})
					]
				}) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "pb-3 text-xs text-muted",
					children: "Select a part to transform it."
				})]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("details", {
				className: "panel",
				open: snap.tool === "mate" || snap.tool === "measure" || snap.tool === "section",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("summary", { children: "Assemble" }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "flex flex-col gap-2 pb-3",
					children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
							className: "text-xs leading-relaxed text-muted",
							children: snap.tool === "mate" ? "Click two planar faces on different parts. B moves onto A." : "Switch to Mate to join faces, Measure for distances, Section to clip."
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "flex gap-1 text-2xs font-mono",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
								className: "rounded-sm border border-line px-2 py-1",
								children: snap.mateA ?? "A —"
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
								className: "rounded-sm border border-line px-2 py-1",
								children: snap.mateB ?? "B —"
							})]
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)(NumField, {
							label: "Δ",
							value: mateOffset,
							digits: 2,
							onCommit: setMateOffset
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "flex gap-1",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Button, {
								variant: "primary",
								size: "sm",
								disabled: !snap.mateReady,
								onClick: () => eng?.mate(mateOffset),
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Magnet, { className: "size-3.5" }), " Mate"]
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
								size: "sm",
								onClick: () => eng?.clearFaces(),
								children: "Clear faces"
							})]
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "flex gap-1",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Button, {
								size: "sm",
								active: snap.tool === "measure",
								onClick: () => eng?.setTool("measure"),
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Ruler, { className: "size-3.5" }), " Measure"]
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
								size: "sm",
								onClick: () => eng?.clearMeasure(),
								children: "Clear"
							})]
						}),
						snap.measureMm != null && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
							className: "font-mono text-sm tabular-nums",
							children: eng?.fmtLen(snap.measureMm)
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)(ToggleRow, {
							label: "Section plane",
							on: snap.sectionOn,
							onChange: (v) => eng?.setSection(v, snap.sectionAxis, snap.sectionPos)
						}),
						snap.sectionOn && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
							className: "flex gap-1",
							children: [
								"x",
								"y",
								"z"
							].map((ax) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
								size: "sm",
								active: snap.sectionAxis === ax,
								onClick: () => eng?.setSection(true, ax, snap.sectionPos),
								children: ax.toUpperCase()
							}, ax))
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
							type: "range",
							min: 0,
							max: 1,
							step: .01,
							value: snap.sectionPos,
							onChange: (e) => eng?.setSection(true, snap.sectionAxis, parseFloat(e.target.value))
						})] })
					]
				})]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("details", {
				className: "panel",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("summary", { children: "Print" }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "flex flex-col gap-2 pb-3",
					children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", {
							className: "flex items-center justify-between text-xs",
							children: ["Volume", /* @__PURE__ */ (0, import_jsx_runtime.jsx)("select", {
								className: "h-7 max-w-40 rounded-sm border border-line bg-bg px-1 font-mono text-2xs",
								value: snap.printerId,
								onChange: (e) => eng?.setPrinter(e.target.value),
								children: PRINTERS.map((p) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("option", {
									value: p.id,
									children: [
										p.name,
										" ",
										p.x,
										"×",
										p.z,
										"×",
										p.y
									]
								}, p.id))
							})]
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
							size: "sm",
							onClick: () => eng?.dropAll(),
							children: "Drop all to bed"
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
							size: "sm",
							onClick: () => eng?.setRenderMode("print"),
							children: "Overhang check"
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
							className: "text-2xs leading-relaxed text-muted",
							children: "Overhang shade: cool faces print clean, warm faces need support (over 45°)."
						})
					]
				})]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "mt-2 flex flex-wrap gap-1",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Button, {
						variant: "primary",
						size: "sm",
						disabled: !selected,
						onClick: () => eng?.exportSelected(),
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Download, { className: "size-3.5" }), " Part STL"]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
						size: "sm",
						disabled: !snap.parts.length,
						onClick: () => eng?.exportAssembly(),
						children: "Assembly"
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
						size: "sm",
						onClick: () => eng?.screenshot(),
						children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Camera, { className: "size-3.5" })
					})
				]
			})
		]
	});
}
function ToggleRow({ label, on, onChange }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", {
		className: "flex cursor-pointer items-center justify-between text-xs",
		children: [label, /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
			type: "checkbox",
			checked: on,
			onChange: (e) => onChange(e.target.checked)
		})]
	});
}
var routes_exports = /* @__PURE__ */ __exportAll({ component: () => Home });
function Home() {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Workbench, {});
}
//#endregion
export { PRINTERS as i, EMPTY_SNAPSHOT as n, PART_COLORS as r, routes_exports as t };
