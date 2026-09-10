// Minimal XML DOM for tests (Node has no DOMParser). Supports the subset parse3MF uses:
// documentElement, getAttribute, getElementsByTagName (descendants, document order).
class El {
  constructor(name, attrs) { this.tagName = name; this.attrs = attrs; this.children = []; }
  getAttribute(k) { return k in this.attrs ? this.attrs[k] : null; }
  getElementsByTagName(name) { const out = []; const walk = (e) => { for (const c of e.children) { if (c.tagName === name) out.push(c); walk(c); } }; walk(this); return out; }
}
class Doc { constructor(root) { this.documentElement = root; } getElementsByTagName(n) { return (this.documentElement.tagName === n ? [this.documentElement] : []).concat(this.documentElement.getElementsByTagName(n)); } }
export class DOMParser {
  parseFromString(xml) {
    const re = /<\?[^?]*\?>|<!--[\s\S]*?-->|<\/([\w:.-]+)\s*>|<([\w:.-]+)((?:\s+[\w:.-]+\s*=\s*"[^"]*")*)\s*(\/?)>/g;
    const stack = []; let root = null; let m;
    while ((m = re.exec(xml))) {
      if (m[0].startsWith('<?') || m[0].startsWith('<!--')) continue;
      if (m[1]) { stack.pop(); continue; }
      const attrs = {}; const ar = /([\w:.-]+)\s*=\s*"([^"]*)"/g; let a; while ((a = ar.exec(m[3] || ''))) attrs[a[1]] = a[2];
      const el = new El(m[2], attrs);
      if (stack.length) stack[stack.length - 1].children.push(el); else root = el;
      if (!m[4]) stack.push(el);
    }
    return new Doc(root);
  }
}
