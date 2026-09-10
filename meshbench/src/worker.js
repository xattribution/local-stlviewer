// Web Worker entry: runs the heavy geometry operations off the main thread.
import * as G from './geometry.js';
import { Earcut } from 'three/src/extras/Earcut.js';
import { createOps } from './ops.js';

const ops = createOps(G, Earcut.triangulate);
self.onmessage = (e) => {
  const { id, op, args } = e.data;
  try {
    const fn = ops[op];
    if (!fn) throw new Error('Unknown worker op ' + op);
    const { result, transfer } = fn(args);
    self.postMessage({ id, ok: true, result }, transfer || []);
  } catch (err) {
    self.postMessage({ id, ok: false, error: String((err && err.message) || err) });
  }
};
