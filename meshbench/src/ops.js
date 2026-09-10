// Heavy geometry operations, shared by the Web Worker and the main-thread fallback.
export function createOps(G, earcut) {
  const topoCache = new Map(); // key -> topology
  const getTopo = (key, pos) => {
    let t = key ? topoCache.get(key) : null;
    if (!t) {
      t = G.topology(pos);
      if (key) { topoCache.set(key, t); if (topoCache.size > 10) topoCache.delete(topoCache.keys().next().value); }
    }
    return t;
  };
  return {
    topology({ key, pos }) {
      const t = getTopo(key, pos);
      return { result: { summary: G.topologySummary(t), boundary: G.edgeLines(t, t.boundary), nonManifold: G.edgeLines(t, t.nonManifold), winding: G.edgeLines(t, t.winding), shellOf: t.shellOf } };
    },
    forget({ key }) { topoCache.delete(key); return { result: true }; },
    clean({ key, pos }) { const p = G.cleanTriangles(pos, getTopo(key, pos)); return { result: p, transfer: [p.buffer] }; },
    fill({ key, pos }) { const r = G.fillHoles(pos, earcut, getTopo(key, pos)); return { result: r, transfer: r.positions !== pos ? [r.positions.buffer] : [] }; },
    unify({ key, pos }) { const r = G.unifyNormals(pos, getTopo(key, pos)); return { result: r, transfer: [r.positions.buffer] }; },
    split({ key, pos }) { const shells = G.splitShells(pos, getTopo(key, pos)); return { result: shells, transfer: shells.map((s) => s.buffer) }; },
    thickness({ pos }) { const v = G.thickness(pos); return { result: v, transfer: [v.buffer] }; },
    orient({ pos, angle }) { return { result: G.rankOrientations(pos, { angle, candidates: 12 }) }; },
    cut({ key, pos, n, d, pocket }) {
      const r = G.cutWithPockets(pos, n, d, earcut, pocket, getTopo(key, pos));
      const transfer = [r.above.buffer, r.below.buffer]; if (r.pin) transfer.push(r.pin.buffer);
      return { result: { above: r.above, below: r.below, pin: r.pin || null, pins: r.pins, warnings: r.warnings, loops: r.loops.length, open: r.open.length }, transfer };
    },
    section({ pos, n, d }) { const { loops, open } = G.chainLoops(G.sectionSegments(pos, n, d)); return { result: { svg: G.sectionSVG(loops, open, n), loops: loops.length, open: open.length } }; },
    write3mf({ parts }) { const b = G.write3MF(parts); return { result: b, transfer: [b.buffer] }; },
  };
}
