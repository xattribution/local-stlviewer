// Presentation materials: filament finish presets, colour swatches and the shader
// injection that draws printed layer lines and speckle without needing UVs.
import * as THREE from 'three';

export const FINISHES = [
  { id: 'matte', name: 'Matte PLA', note: 'Diffuse, chalky surface. Hides layer lines best.', chip: 'linear-gradient(135deg,#d9d6cf,#b9b6ae)',
    p: { roughness: 0.85, metalness: 0, clearcoat: 0, specularIntensity: 0.45 } },
  { id: 'standard', name: 'Standard PLA', note: 'Slight satin sheen, the everyday look.', chip: 'linear-gradient(135deg,#e2dfd8 0%,#c4c1b9 60%,#f1efe9 100%)',
    p: { roughness: 0.5, metalness: 0, clearcoat: 0.12, clearcoatRoughness: 0.45, specularIntensity: 0.7 } },
  { id: 'glossy', name: 'Glossy PETG', note: 'Wet-look gloss with a hint of translucency.', chip: 'linear-gradient(135deg,#dfe4e7 0%,#9fb0b8 45%,#f4f7f8 60%,#a9b8bf 100%)',
    p: { roughness: 0.18, metalness: 0, clearcoat: 0.7, clearcoatRoughness: 0.12, specularIntensity: 1, ior: 1.52 }, trans: 0.12 },
  { id: 'silk', name: 'Silk PLA', note: 'Pearlescent, shifting highlights. Layer lines almost vanish.', chip: 'linear-gradient(135deg,#f2d7c8 0%,#c7a58f 35%,#fbe9df 55%,#b98b73 100%)',
    p: { roughness: 0.32, metalness: 0.28, clearcoat: 0.55, clearcoatRoughness: 0.2, sheen: 1, sheenRoughness: 0.35, iridescence: 0.3, iridescenceIOR: 1.6, specularIntensity: 1 } },
  { id: 'marble', name: 'Marble PLA', note: 'Off-white with dark flecks.', chip: 'radial-gradient(circle at 30% 40%,#4a4a4a 0 1.5px,transparent 2px),radial-gradient(circle at 70% 65%,#4a4a4a 0 1px,transparent 1.5px),radial-gradient(circle at 55% 20%,#4a4a4a 0 1px,transparent 1.5px),linear-gradient(135deg,#efece6,#d7d3cb)',
    p: { roughness: 0.62, metalness: 0, clearcoat: 0.1, clearcoatRoughness: 0.5 }, speckle: { scale: 1.6, threshold: 0.955, amount: 0.9, color: '#3e3c3a' }, defaultColor: '#ecebe6' },
  { id: 'metal', name: 'Metal fill', note: 'Bronze/steel filled filament: heavy, dull metallic sparkle.', chip: 'linear-gradient(135deg,#b7a27c 0%,#7d6a4b 50%,#d1bd94 100%)',
    p: { roughness: 0.52, metalness: 0.62, clearcoat: 0, specularIntensity: 1 }, speckle: { scale: 7, threshold: 0.9, amount: 0.45, color: '#f0e2c0' }, defaultColor: '#a88f66' },
  { id: 'carbon', name: 'Carbon fibre', note: 'Matte black composite with a fine fibre fleck.', chip: 'linear-gradient(135deg,#2a2b2d,#141516)',
    p: { roughness: 0.78, metalness: 0.05, clearcoat: 0, specularIntensity: 0.6 }, speckle: { scale: 9, threshold: 0.86, amount: 0.3, color: '#6d6f73' }, defaultColor: '#202224' },
  { id: 'glitter', name: 'Sparkle', note: 'Glitter-loaded filament with bright flecks.', chip: 'radial-gradient(circle at 25% 30%,#fff 0 1px,transparent 1.5px),radial-gradient(circle at 70% 60%,#fff 0 1px,transparent 1.5px),radial-gradient(circle at 45% 80%,#fff 0 1px,transparent 1.5px),linear-gradient(135deg,#6a4ea1,#3d2c6a)',
    p: { roughness: 0.42, metalness: 0.15, clearcoat: 0.4, clearcoatRoughness: 0.25, specularIntensity: 1 }, speckle: { scale: 5, threshold: 0.965, amount: 1, color: '#ffffff' }, defaultColor: '#5b3f93' },
  { id: 'clear', name: 'Translucent', note: 'Natural or tinted see-through filament.', chip: 'linear-gradient(135deg,rgba(190,220,235,.9),rgba(120,170,200,.55))',
    p: { roughness: 0.22, metalness: 0, clearcoat: 0.5, clearcoatRoughness: 0.15, ior: 1.5, specularIntensity: 1 }, trans: 0.75, defaultColor: '#cfe4ee' },
  { id: 'resin', name: 'Resin', note: 'Smooth SLA print: no layer lines, glassy grey.', chip: 'linear-gradient(135deg,#a9adb3 0%,#7d8288 50%,#c4c8cc 100%)',
    p: { roughness: 0.28, metalness: 0, clearcoat: 0.35, clearcoatRoughness: 0.2, specularIntensity: 0.9, ior: 1.5 }, noLayers: true, defaultColor: '#8f939a' },
];
export const FINISH_BY_ID = Object.fromEntries(FINISHES.map((f) => [f.id, f]));

export const SWATCHES = [
  ['#f2f0eb', 'White'], ['#1c1c1e', 'Black'], ['#8a8d90', 'Grey'], ['#c9ccd1', 'Silver'], ['#c8352a', 'Red'], ['#e5731f', 'Orange'], ['#f0c41b', 'Yellow'], ['#2f8f4e', 'Green'],
  ['#1f8f8a', 'Teal'], ['#2457c5', 'Blue'], ['#1c2d5c', 'Navy'], ['#6b3fa0', 'Purple'], ['#e5799c', 'Pink'], ['#7a4f2f', 'Brown'], ['#d9c9ad', 'Beige'], ['#c9a13a', 'Gold'],
];

export const DEFAULT_FINISH = { preset: 'standard', color: '#e8e6e1', trans: 0, rough: 0.5 };

export const BACKDROPS = {
  studio: { stops: ['#f3f3f1', '#d9dad8', '#b9bbba'], floor: '#d8d9d7' },
  warm: { stops: ['#f8f3ea', '#e6dccd', '#cbbfae'], floor: '#e3d9ca' },
  white: { stops: ['#ffffff', '#ffffff', '#ffffff'], floor: '#ffffff' },
  dark: { stops: ['#3a3d42', '#202226', '#121316'], floor: '#24262a' },
  transparent: { stops: null, floor: null },
};

const GLSL_COMMON = `
varying vec3 vMbWorld;
uniform float uLayer, uLineStrength, uLineBump, uSpeckleScale, uSpeckleAmount, uSpeckleThreshold, uLinesOn;
uniform vec3 uSpeckleColor;
float mbHash(vec3 p) { p = fract(p * 0.3183099 + vec3(0.1, 0.3, 0.7)); p *= 17.0; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }
`;

/**
 * Patch a MeshPhysicalMaterial so it renders printed layer lines (a normal ripple plus a
 * faint valley shade, driven by world Z) and optional filament speckle, all procedurally.
 */
export function installFinishShader(material) {
  const uniforms = {
    uLayer: { value: 0.2 }, uLineStrength: { value: 0.45 }, uLineBump: { value: 0.4 }, uLinesOn: { value: 1 },
    uSpeckleScale: { value: 1 }, uSpeckleAmount: { value: 0 }, uSpeckleThreshold: { value: 0.9 }, uSpeckleColor: { value: new THREE.Color('#000000') },
  };
  material.userData.finishUniforms = uniforms;
  material.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniforms);
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vMbWorld;')
      .replace('#include <project_vertex>', '#include <project_vertex>\nvMbWorld = (modelMatrix * vec4(transformed, 1.0)).xyz;');
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>' + GLSL_COMMON)
      .replace('#include <color_fragment>', `#include <color_fragment>
      {
        if (uSpeckleAmount > 0.0) {
          float h = mbHash(floor(vMbWorld * uSpeckleScale));
          float sp = smoothstep(uSpeckleThreshold, uSpeckleThreshold + 0.02, h);
          diffuseColor.rgb = mix(diffuseColor.rgb, uSpeckleColor, sp * uSpeckleAmount);
        }
        if (uLinesOn > 0.5) {
          float ph = fract(vMbWorld.z / uLayer);
          float valley = 1.0 - smoothstep(0.0, 0.3, ph) * (1.0 - smoothstep(0.7, 1.0, ph));
          diffuseColor.rgb *= 1.0 - uLineStrength * 0.09 * valley;
        }
      }`)
      .replace('#include <normal_fragment_begin>', `#include <normal_fragment_begin>
      if (uLinesOn > 0.5) {
        vec3 zView = normalize((viewMatrix * vec4(0.0, 0.0, 1.0, 0.0)).xyz);
        float side = 1.0 - abs(dot(normal, zView));
        float w = cos(6.2831853 * vMbWorld.z / uLayer);
        normal = normalize(normal + zView * (uLineBump * uLineStrength * side * w));
      }`);
  };
  material.customProgramCacheKey = () => 'meshbench-finish';
  return material;
}

/** Create a presentation material for a part finish. */
export function makeFinishMaterial() {
  const m = new THREE.MeshPhysicalMaterial({ color: 0xffffff, side: THREE.DoubleSide, flatShading: false });
  installFinishShader(m);
  return m;
}

/**
 * Apply a finish ({ preset, color, trans, rough }) and the studio-wide layer settings
 * ({ on, height, strength }) to a material created by makeFinishMaterial.
 */
export function applyFinish(material, finish, layers) {
  const f = FINISH_BY_ID[finish.preset] || FINISH_BY_ID.standard;
  const p = { roughness: 0.5, metalness: 0, clearcoat: 0, clearcoatRoughness: 0.3, sheen: 0, sheenRoughness: 0.5, iridescence: 0, iridescenceIOR: 1.3, specularIntensity: 1, ior: 1.45, ...f.p };
  const roughAdj = (finish.rough ?? 0.5) - 0.5; // slider: gloss ↔ matte
  material.roughness = THREE.MathUtils.clamp(p.roughness + roughAdj * 0.7, 0.04, 1);
  material.metalness = p.metalness;
  material.clearcoat = p.clearcoat; material.clearcoatRoughness = p.clearcoatRoughness;
  material.sheen = p.sheen; material.sheenRoughness = p.sheenRoughness;
  material.iridescence = p.iridescence; material.iridescenceIOR = p.iridescenceIOR;
  material.specularIntensity = p.specularIntensity; material.ior = p.ior;
  material.color.set(finish.color || f.defaultColor || DEFAULT_FINISH.color);
  material.sheenColor.copy(material.color).lerp(new THREE.Color(0xffffff), 0.5);
  const t = THREE.MathUtils.clamp(finish.trans ?? f.trans ?? 0, 0, 1);
  material.transmission = t;
  material.thickness = t > 0 ? 1.5 + 8 * t : 0;
  material.attenuationColor.set(finish.color || f.defaultColor || DEFAULT_FINISH.color);
  material.attenuationDistance = t > 0 ? 3 + 30 * (1 - t) : Infinity;
  material.transparent = false; material.opacity = 1; material.depthWrite = true;
  const u = material.userData.finishUniforms;
  const sp = f.speckle;
  u.uSpeckleAmount.value = sp ? sp.amount : 0;
  if (sp) { u.uSpeckleScale.value = sp.scale; u.uSpeckleThreshold.value = sp.threshold; u.uSpeckleColor.value.set(sp.color); }
  const linesOn = layers.on && !f.noLayers;
  u.uLinesOn.value = linesOn ? 1 : 0;
  u.uLayer.value = Math.max(0.05, layers.height || 0.2);
  // silk and glossy finishes visually hide layer lines; scale the effect per preset
  const hide = f.id === 'silk' ? 0.35 : f.id === 'glossy' ? 0.7 : f.id === 'clear' ? 0.6 : 1;
  u.uLineStrength.value = THREE.MathUtils.clamp(layers.strength ?? 0.45, 0, 1) * hide;
  material.needsUpdate = true;
}

/** A radial alpha fade texture for the studio floor disc. */
export function radialFadeTexture(size = 512) {
  const c = document.createElement('canvas'); c.width = c.height = size;
  const ctx = c.getContext('2d');
  const g = ctx.createRadialGradient(size / 2, size / 2, size * 0.18, size / 2, size / 2, size / 2);
  g.addColorStop(0, '#ffffff'); g.addColorStop(0.5, '#d9d9d9'); g.addColorStop(1, '#000000'); // alphaMap reads the green channel
  ctx.fillStyle = g; ctx.fillRect(0, 0, size, size);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.NoColorSpace; return t;
}

/**
 * Studio sweep: a large inside-out sphere with a vertex-colour gradient (light band near the
 * horizon, darker overhead and underfoot). Being part of the scene, it also shows through
 * translucent parts in three's transmission pass, which a CSS backdrop cannot.
 */
export function makeBackdropSphere() {
  const geo = new THREE.SphereGeometry(1, 48, 32);
  geo.setAttribute('color', new THREE.BufferAttribute(new Float32Array(geo.attributes.position.count * 3), 3));
  const mat = new THREE.MeshBasicMaterial({ side: THREE.BackSide, vertexColors: true, toneMapped: false, fog: false, depthWrite: false });
  const mesh = new THREE.Mesh(geo, mat); mesh.renderOrder = -10; mesh.frustumCulled = false;
  return mesh;
}
export function paintBackdropSphere(mesh, backdrop) {
  const b = BACKDROPS[backdrop];
  const pos = mesh.geometry.attributes.position, col = mesh.geometry.attributes.color;
  if (!b || !b.stops) { mesh.visible = false; return; }
  mesh.visible = true;
  const light = new THREE.Color(b.stops[0]), mid = new THREE.Color(b.stops[1]), dark = new THREE.Color(b.stops[2]);
  const tmp = new THREE.Color();
  for (let i = 0; i < pos.count; i++) {
    const t = pos.getZ(i); // elevation, -1..1 (Z up)
    const band = Math.exp(-Math.pow((t - 0.12) / 0.42, 2));
    tmp.copy(t < 0 ? mid : dark).lerp(light, band);
    col.setXYZ(i, tmp.r, tmp.g, tmp.b);
  }
  col.needsUpdate = true;
}

/** Paint a backdrop gradient onto a 2D canvas context (for PNG export compositing). */
export function paintBackdrop(ctx, w, h, backdrop) {
  const b = BACKDROPS[backdrop];
  if (!b || !b.stops) return false;
  const g = ctx.createRadialGradient(w * 0.5, h * 0.35, 0, w * 0.5, h * 0.35, Math.hypot(w, h) * 0.62);
  g.addColorStop(0, b.stops[0]); g.addColorStop(0.55, b.stops[1]); g.addColorStop(1, b.stops[2]);
  ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
  return true;
}
