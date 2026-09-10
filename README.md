# local-stlviewer

Two mesh tools for 3D printing live in this repository.

## `meshbench/` — Meshbench 2.0 (offline, single file)

Open `meshbench/dist/meshbench.html` in a browser. Import STL / OBJ / 3MF, check and repair meshes, cut with dowel pockets, orient and arrange for the bed, and present the part in a chosen filament finish (matte, silk, marble, metal, clear, …) with a PNG export. See [meshbench/README.md](meshbench/README.md) for the feature list, architecture, the code review that produced it, and how to build and test.

```
cd meshbench && npm install && npm run check
```

## `src/` — DATUM (Grok version)

A TanStack Start + React 19 + three.js web app with auth, PGLite and Vercel scaffolding. STL viewer with mate faces, view cube, snapping, lock/isolate/explode.

```
npm install && npm run dev
```
