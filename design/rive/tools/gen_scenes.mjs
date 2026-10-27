// Generates design/rive/scenes/scene.rml — four layered scene artboards + SceneVM/SceneSM.
// Run: node design/rive/tools/gen_scenes.mjs
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { blob, ellipse, rrect, group, argb, ID, nid, VM, f, setNs } from './lib.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const contract = JSON.parse(fs.readFileSync(path.join(here, '../../../docs/rive/teacher.contract.json'), 'utf8'));
const W = 2400, H = 1500;

// ---------------- SceneVM ----------------
const vmDef = contract.viewModels.SceneVM;
VM.id = '0:40';
let propXml = '', instXml = '';
for (const [name, d] of Object.entries(vmDef)) {
  const pid = nid(); VM.props[name] = pid;
  if (d.type === 'number') { propXml += `<ViewModelPropertyNumber name="${name}" id="${pid}"/>`; instXml += `<ViewModelInstanceNumber propertyValue="${d.default}" viewModelPropertyId="${pid}"/>`; }
  if (d.type === 'boolean') { propXml += `<ViewModelPropertyBoolean name="${name}" id="${pid}"/>`; instXml += `<ViewModelInstanceBoolean propertyValue="${d.default}" viewModelPropertyId="${pid}"/>`; }
  if (d.type === 'trigger') { propXml += `<ViewModelPropertyTrigger name="${name}" id="${pid}"/>`; instXml += `<ViewModelInstanceTrigger propertyValue="0" viewModelPropertyId="${pid}"/>`; }
}
const vmXml = `<ViewModel defaultInstanceId="0:41" name="SceneVM" id="0:40">${propXml}<ViewModelInstance exports="true" name="Default" id="0:41">${instXml}</ViewModelInstance></ViewModel>`;

// ---------------- converters ----------------
let convXml = '';
const convs = {};
function conv(key, minO, maxO, minI = -100, maxI = 100) {
  if (convs[key]) return convs[key];
  const id = nid(); convs[key] = id;
  convXml += `<DataConverterRangeMapper minInput="${minI}" maxInput="${maxI}" minOutput="${minO}" maxOutput="${maxO}" clampLower="true" clampUpper="true" name="${key}" id="${id}"/>`;
  return id;
}
const DEPTH = { sky: 14, far: 34, mid: 62, frame: 104, glow: 150 };

// ---------------- paint helpers ----------------
const lin = (x1, y1, x2, y2, stops) => ({ linear: { x1, y1, x2, y2, stops: stops.map(([p, c, a = 1]) => [p, argb(c, a)]) } });
const rad = (cx, cy, r, stops) => ({ radial: { cx, cy, r, stops: stops.map(([p, c, a = 1]) => [p, argb(c, a)]) } });
const fullRect = (name, fills, extra = '') => rrect({ name, cx: W / 2, cy: H / 2, w: W, h: H, r: 0, fills, extra });
const skyline = (name, base, pts, color, hi) => blob({ name, pts: [[-40, H + 40, 'c'], ...pts, [W + 40, H + 40, 'c']], k: 0.7, fills: [{ solid: argb(color) }, lin(0, base - 200, 0, base + 200, [[0, 'FFFFFF', hi ?? 0.1], [1, '000000', 0.25]])] });
// split an XML string into its top-level elements
function topLevel(xml) {
  const out = []; let depth = 0, start = 0; const re = /<(\/?)([A-Za-z]+)[^>]*?(\/?)>/g; let m;
  while ((m = re.exec(xml))) {
    if (m[1]) depth--; else if (!m[3]) depth++;
    if (depth === 0) { out.push(xml.slice(start, re.lastIndex)); start = re.lastIndex; }
  }
  return out;
}
// layer node (parallax-bound); inner is authored back -> front, Rive paints first-declared on top
function layer(name, depthKey, inner) {
  inner = topLevel(inner).reverse().join('');
  const d = DEPTH[depthKey];
  return `<Node name="${name}" id="${ID(name)}"><DataBindContext sourcePathIds="${VM.id}-${VM.props.parallaxX}" propertyKey="13" converterId="${conv('px_' + depthKey, -d, d)}"/><DataBindContext sourcePathIds="${VM.id}-${VM.props.parallaxY}" propertyKey="14" converterId="${conv('py_' + depthKey, -d * 0.5, d * 0.5)}"/>${inner}</Node>`;
}
const stars = (n, seed, y0, y1, id) => {
  let s = '', r = seed;
  const rnd = () => (r = (r * 16807) % 2147483647) / 2147483647;
  for (let i = 0; i < n; i++) s += ellipse({ name: 'Star', cx: rnd() * W, cy: y0 + rnd() * (y1 - y0), rx: 2 + rnd() * 3.5, fills: [{ solid: argb('FFF6E0', 0.5 + rnd() * 0.5) }] });
  return s;
};
const lantern = (name, cx, top, len, color = 'E8453C') => group(name, cx, top, () =>
  blob({ name: 'Cord', pts: [[cx, top], [cx, top + len]], closed: false, strokes: [{ w: 5, solid: argb('3A1A2A') }] }) +
  rrect({ name: 'CapT', cx, cy: top + len, w: 78, h: 16, r: 6, fills: [{ solid: argb('3A1A2A') }] }) +
  ellipse({ name: 'Body', cx, cy: top + len + 66, rx: 62, ry: 76, fills: [{ solid: argb(color) }, rad(cx, top + len + 66, 80, [[0, 'FFD27A', 0.95], [0.55, 'FF7A3A', 0.4], [1, '7A1020', 0.55]]), lin(cx - 62, 0, cx + 62, 0, [[0, 'FFFFFF', 0.25], [0.5, 'FFFFFF', 0], [1, '3A0010', 0.4]])] }) +
  [-30, 0, 30].map((dx) => blob({ name: 'Rib', pts: [[cx + dx * 0.4, top + len + 8], [cx + dx, top + len + 66], [cx + dx * 0.4, top + len + 124]], closed: false, strokes: [{ w: 3, solid: argb('7A1020', 0.45) }] })).join('') +
  rrect({ name: 'CapB', cx, cy: top + len + 140, w: 60, h: 14, r: 6, fills: [{ solid: argb('3A1A2A') }] }) +
  blob({ name: 'Tassel', pts: [[cx, top + len + 146], [cx, top + len + 196]], closed: false, strokes: [{ w: 7, solid: argb('FFC060') }] }), { id: ID(name) });
const glowDisc = (name, cx, cy, r, c, a = 0.5, id) => ellipse({ name, cx, cy, rx: r, id, fills: [rad(cx, cy, r, [[0, c, a], [0.5, c, a * 0.35], [1, c, 0]])] });

// ---------------- animation helpers ----------------
const animXml = [];
function anim(name, frames, loop, tracks) {
  const id = ID('anim_' + name);
  const body = tracks.map(([obj, prop, keys]) => `<KeyedObject objectId="${ID(obj)}"><KeyedProperty property="${prop}">${keys.map(([fr, v, e = 'io']) => e === 'io' ? `<KeyFrameDouble value="${f(v)}" frame="${fr}" interpolationType="cubic"><CubicEaseInterpolator x1="0.42" y1="0" x2="0.58" y2="1"/></KeyFrameDouble>` : `<KeyFrameDouble value="${f(v)}" frame="${fr}" interpolationType="${e === 'l' ? 'linear' : 'hold'}"/>`).join('')}</KeyedProperty></KeyedObject>`).join('');
  animXml.push(`<LinearAnimation loopValue="${loop}" duration="${frames}" fps="60" name="${name}" id="${id}">${body}</LinearAnimation>`);
  return id;
}
const sway = (obj, amp, dur, ph = 0) => [obj, 'rotation', [[0, -amp * ph, 'io'], [dur / 2, amp * ph || amp, 'io'], [dur, -amp * ph, 'io']]];
const swayK = (obj, amp, dur, ph = 1) => [obj, 'rotation', [[0, -amp * ph], [dur / 2, amp * ph], [dur, -amp * ph]]];
const pulse = (obj, lo, hi, dur, off = 0) => [obj, 'opacity', [[0, lo], [dur / 2 + off, hi], [dur, lo]]];

// ---------------- scenes ----------------
function teaHouse() {
  const sky = layer('L_sky', 'sky', fullRect('Sky', [lin(0, 0, 0, H, [[0, '160F36'], [0.45, '3A1C56'], [0.75, 'C2506A'], [1, 'FFB867']])]) +
    group('Stars', 0, 0, () => stars(46, 7, 20, 600), { id: ID('Stars') }) + glowDisc('MoonGlow', 1700, 470, 330, 'FFD9A0', 0.55, ID('MoonGlow')) + ellipse({ name: 'Moon', cx: 1700, cy: 470, rx: 96, fills: [{ solid: argb('FFF0D2') }, rad(1670, 440, 110, [[0, 'FFFFFF', 0.6], [1, 'FFFFFF', 0]]), lin(1600, 480, 1800, 480, [[0.6, '8A5A7A', 0], [1, '8A5A7A', 0.4]])] }));
  const far = layer('L_far', 'far', skyline('HillsFar', 900, [[300, 860], [620, 760], [940, 840], [1260, 720], [1600, 820], [1900, 740], [2250, 840]], '5A3A78', 0.15) + glowDisc('HazeFar', 1200, 980, 900, 'FF9A6A', 0.28));
  const mid = layer('L_mid', 'mid', skyline('HillsMid', 1020, [[200, 980], [520, 900], [880, 990], [1240, 880], [1580, 980], [1960, 900], [2300, 990]], '3E2760', 0.1) +
    // pagoda silhouette
    blob({ name: 'Pagoda', pts: [[1900, 980, 'c'], [1900, 820, 'c'], [1860, 800, 'c'], [1960, 770, 'c'], [1940, 720, 'c'], [1990, 680, 'c'], [2040, 720, 'c'], [2020, 770, 'c'], [2120, 800, 'c'], [2080, 820, 'c'], [2080, 980, 'c']], fills: [{ solid: argb('2A1A48') }] }));
  const wall = blob({ name: 'WallRing', pts: [[-80, -80, 'c'], [W + 80, -80, 'c'], [W + 80, H + 80, 'c'], [-80, H + 80, 'c']], fills: [{ rule: 'evenOdd', solid: argb('2E1838') }] });
  // moon gate: a wall with a circular hole (evenOdd)
  const gate = `<Shape x="1200" y="700" name="MoonGateWall"><Rectangle x="0" y="0" width="${W + 200}" height="${H + 200}" originX="0.5" originY="0.5" name="Slab"/><Ellipse x="0" y="0" width="1240" height="1240" originX="0.5" originY="0.5" name="Hole"/><Fill fillRule="evenOdd"><LinearGradient startX="0" startY="-700" endX="0" endY="800"><GradientStop colorValue="${argb('3A2046')}" position="0"/><GradientStop colorValue="${argb('241230')}" position="1"/></LinearGradient></Fill></Shape>`;
  const ring = ellipse({ name: 'GateRing', cx: 1200, cy: 700, rx: 620, strokes: [{ w: 46, linear: { x1: 600, y1: 100, x2: 1800, y2: 1300, stops: [[0, argb('8A3A3A')], [0.5, argb('B8553E')], [1, argb('5A2230')]] } }], fills: [] }) +
    ellipse({ name: 'GateRingHi', cx: 1200, cy: 700, rx: 646, strokes: [{ w: 6, solid: argb('FFC47A', 0.5) }], fills: [] });
  const frame = layer('L_frame', 'frame', gate + ring + lantern('LanternL', 330, -40, 180) + lantern('LanternR', 2070, -40, 150));
  const fg = layer('L_glow', 'glow', rrect({ name: 'Table', cx: 1200, cy: 1480, w: 2600, h: 240, r: 0, fills: [lin(0, 1360, 0, 1600, [[0, '7A4A38'], [1, '3A2020']])] }) +
    rrect({ name: 'TableEdge', cx: 1200, cy: 1362, w: 2600, h: 14, r: 7, fills: [{ solid: argb('FFC47A', 0.5) }] }) + glowDisc('WarmFloorGlow', 1200, 1500, 1100, 'FFB867', 0.35, ID('WarmGlow')));
  const amb = anim('ambient', 300, 'loop', [swayK('LanternL', 0.06, 300), swayK('LanternR', 0.06, 300, -1), pulse('MoonGlow', 0.7, 1, 300), pulse('Stars', 0.6, 1, 150)]);
  const cel = anim('celebrate', 100, 'oneShot', [['WarmGlow', 'opacity', [[0, 1], [30, 1], [100, 1]]], swayK('LanternL', 0.16, 100), swayK('LanternR', 0.16, 100, -1)]);
  return { content: fg + frame + mid + far + sky, amb, cel, nightTargets: ['Stars'] };
}
function cafe() {
  const sky = layer('L_sky', 'sky', fullRect('Sky', [lin(0, 0, 0, H, [[0, '3A1A4A'], [0.4, 'C2506A'], [0.7, 'FF9A5A'], [1, 'FFD08A']])]) + glowDisc('SunGlow', 1200, 960, 620, 'FFE0A0', 0.7, ID('SunGlow')) + ellipse({ name: 'Sun', cx: 1200, cy: 960, rx: 150, fills: [{ solid: argb('FFF1C8') }, rad(1170, 930, 160, [[0, 'FFFFFF', 0.7], [1, 'FFFFFF', 0]])] }));
  const far = layer('L_far', 'far', skyline('RoofsFar', 1000, [[200, 990], [500, 960], [800, 1000], [1100, 950], [1450, 1000], [1800, 960], [2200, 1000]], '8A3A4A', 0.12));
  const mid = layer('L_mid', 'mid', skyline('RoofsMid', 1100, [[150, 1090], [450, 1060], [760, 1100], [1050, 1050], [1400, 1100], [1750, 1060], [2250, 1100]], '5A2A3E', 0.1) +
    // bell tower
    blob({ name: 'Tower', pts: [[1650, 1100, 'c'], [1650, 780, 'c'], [1620, 760, 'c'], [1690, 640, 'c'], [1760, 760, 'c'], [1730, 780, 'c'], [1730, 1100, 'c']], fills: [{ solid: argb('4A2238') }] }) +
    ellipse({ name: 'BellHole', cx: 1690, cy: 830, rx: 26, ry: 36, fills: [{ solid: argb('FFB060', 0.55) }] }) +
    // orange tree
    [[2020, 930, 120], [1930, 990, 100], [2130, 1000, 110], [2020, 1060, 130]].map(([x, y, r]) => ellipse({ name: 'Foliage', cx: x, cy: y, rx: r, fills: [{ solid: argb('3A5A32') }, rad(x - 30, y - 40, r, [[0, '9AC46A', 0.4], [1, '1A2A18', 0.45]])] })).join('') +
    [[1980, 950], [2060, 1000], [1950, 1030], [2110, 960], [2030, 1070]].map(([x, y]) => ellipse({ name: 'Orange', cx: x, cy: y, rx: 18, fills: [{ solid: argb('FF9A2A') }, rad(x - 5, y - 6, 16, [[0, 'FFE0A0', 0.7], [1, 'FFE0A0', 0]])] })).join(''));
  const swallows = group('Swallows', 0, 0, () => [[500, 520], [640, 470], [560, 610]].map(([x, y], i) => blob({ name: 'Swallow', pts: [[x - 22, y - 8], [x, y + 4], [x + 22, y - 8]], closed: false, strokes: [{ w: 5, solid: argb('2A1030', 0.8) }] })).join(''), { id: ID('Swallows') });
  const wall = `<Shape x="1200" y="750" name="ArchWall"><Rectangle x="0" y="0" width="2700" height="1700" originX="0.5" originY="0.5" name="Slab"/><Rectangle x="0" y="150" width="1040" height="1500" originX="0.5" originY="0.5" cornerRadiusTL="520" name="Arch"/><Fill fillRule="evenOdd"><LinearGradient startX="0" startY="-800" endX="0" endY="800"><GradientStop colorValue="${argb('C0603E')}" position="0"/><GradientStop colorValue="${argb('8A3A38')}" position="1"/></LinearGradient></Fill></Shape>`;
  const arch = rrect({ name: 'ArchTrim', cx: 1200, cy: 900, w: 1040, h: 1500, r: 520, fills: [], strokes: [{ w: 36, linear: { x1: 0, y1: 150, x2: 0, y2: 1500, stops: [[0, argb('FFD9A0')], [1, argb('C8804A')]] } }] });
  const frame = layer('L_frame', 'frame', wall + arch);
  const fg = layer('L_glow', 'glow', rrect({ name: 'Sill', cx: 1200, cy: 1490, w: 2600, h: 200, r: 0, fills: [lin(0, 1380, 0, 1600, [[0, 'A8603E'], [1, '4A2230']])] }) + glowDisc('WarmFloorGlow', 1200, 1480, 1000, 'FFB060', 0.4, ID('WarmGlow')));
  const amb = anim('ambient', 300, 'loop', [pulse('SunGlow', 0.75, 1, 150), ['Swallows', 'x', [[0, -120, 'io'], [150, 140, 'io'], [300, -120, 'io']]], ['Swallows', 'y', [[0, 0, 'io'], [150, -50, 'io'], [300, 0, 'io']]]]);
  const cel = anim('celebrate', 100, 'oneShot', [['SunGlow', 'opacity', [[0, 1], [40, 1], [100, 1]]]]);
  return { content: fg + frame + swallows + mid + far + sky, amb, cel };
}
function rooftop() {
  const sky = layer('L_sky', 'sky', fullRect('Sky', [lin(0, 0, 0, H, [[0, '0A1030'], [0.5, '1F2F6A'], [0.85, '5A5A9A'], [1, 'E8A0A0']])]) + group('Stars', 0, 0, () => stars(70, 21, 10, 900), { id: ID('Stars') }) + glowDisc('HorizonGlow', 1200, 1100, 900, 'FFB0B0', 0.32));
  const far = layer('L_far', 'far', skyline('CityFar', 1050, [[180, 1040], [420, 1000], [700, 1050], [980, 1010], [1400, 1050], [1700, 1000], [2000, 1050], [2250, 1020]], '2A3068', 0.1) +
    // distant lattice tower
    blob({ name: 'Tower', pts: [[1840, 1060, 'c'], [1880, 800, 'c'], [1920, 560, 'c'], [1932, 470, 'c'], [1944, 560, 'c'], [1984, 800, 'c'], [2024, 1060, 'c'], [1990, 1060, 'c'], [1960, 860, 'c'], [1932, 860, 'c'], [1904, 860, 'c'], [1874, 1060, 'c']], fills: [{ solid: argb('1A2050') }, lin(1840, 0, 2024, 0, [[0, 'FFFFFF', 0.12], [1, '000000', 0.3]])] }) +
    ellipse({ name: 'TowerBeacon', cx: 1932, cy: 460, rx: 9, fills: [{ solid: argb('FFE9A0') }] }));
  const mid = layer('L_mid', 'mid', skyline('Roofs', 1150, [[120, 1130], [380, 1090, ], [640, 1140], [900, 1100], [1500, 1140], [1760, 1100], [2100, 1140], [2300, 1110]], '1A2250', 0.1) +
    [[250, 1000], [560, 1010], [1650, 990], [2000, 1005]].map(([x, y]) => rrect({ name: 'LitWindow', cx: x, cy: y, w: 26, h: 36, r: 5, fills: [{ solid: argb('FFD27A', 0.85) }] })).join(''));
  const wallShape = `<Shape x="1200" y="750" name="WindowWall"><Rectangle x="0" y="0" width="2700" height="1700" originX="0.5" originY="0.5" name="Slab"/><Rectangle x="0" y="-60" width="1180" height="1280" originX="0.5" originY="0.5" cornerRadiusTL="40" name="Opening"/><Fill fillRule="evenOdd"><LinearGradient startX="0" startY="-800" endX="0" endY="800"><GradientStop colorValue="${argb('2A3060')}" position="0"/><GradientStop colorValue="${argb('141838')}" position="1"/></LinearGradient></Fill></Shape>`;
  const mull = [[1200, 90, 1200, 1330], [800, 90, 800, 1330], [1600, 90, 1600, 1330], [610, 520, 1790, 520], [610, 920, 1790, 920]].map(([x1, y1, x2, y2]) => blob({ name: 'Mullion', pts: [[x1, y1], [x2, y2]], closed: false, strokes: [{ w: 22, linear: { x1, y1, x2: x1 + 40, y2, stops: [[0, argb('D8DCF0')], [1, argb('7A80A8')]] } }] })).join('');
  const frameTrim = rrect({ name: 'WindowTrim', cx: 1200, cy: 690, w: 1210, h: 1310, r: 44, fills: [], strokes: [{ w: 36, solid: argb('E4E6F6') }, { w: 8, solid: argb('FFD9A0', 0.5) }] });
  const frame = layer('L_frame', 'frame', wallShape + mull + frameTrim);
  const rail = [200, 420, 640, 860, 1560, 1780, 2000, 2220].map((x) => rrect({ name: 'Baluster', cx: x, cy: 1400, w: 26, h: 200, r: 12, fills: [lin(x - 13, 0, x + 13, 0, [[0, '8A90B8'], [1, '1A2040']])] })).join('') +
    rrect({ name: 'RailTop', cx: 1200, cy: 1300, w: 2600, h: 40, r: 20, fills: [lin(0, 1280, 0, 1320, [[0, 'B8BEE0'], [1, '3A4070']])] }) + rrect({ name: 'RailBase', cx: 1200, cy: 1500, w: 2600, h: 60, r: 10, fills: [{ solid: argb('141838') }] });
  const fg = layer('L_glow', 'glow', rail + glowDisc('WarmFloorGlow', 1200, 1500, 1000, 'FFB0A0', 0.25, ID('WarmGlow')));
  const amb = anim('ambient', 240, 'loop', [pulse('Stars', 0.55, 1, 120), pulse('WarmGlow', 0.8, 1, 240)]);
  const cel = anim('celebrate', 100, 'oneShot', [['WarmGlow', 'opacity', [[0, 1], [40, 1], [100, 1]]]]);
  return { content: fg + frame + mid + far + sky, amb, cel, nightTargets: ['Stars'] };
}
function clinic() {
  const sky = layer('L_sky', 'sky', fullRect('Wall', [lin(0, 0, 0, H, [[0, 'EAF4F2'], [1, 'CFE6E4']])]));
  const leaf = (cx, cy, rot, len, c = '3E9A6A') => blob({ name: 'Leaf', pts: [[cx, cy], [cx + len * 0.3, cy - len * 0.22], [cx + len, cy - len * 0.1], [cx + len * 0.3, cy + len * 0.2]], k: 0.9, fills: [{ solid: argb(c) }, lin(cx, cy - 40, cx + len, cy + 40, [[0, 'FFFFFF', 0.25], [1, '0A3A24', 0.3]])] });
  const plant = (id, x0, mirror) => group(id, x0, 1360, () => [-80, -50, -20, 10, 40, 70].map((a, i) => { const t = (a * Math.PI) / 180 * mirror - Math.PI / 2; const len = 280 + (i % 3) * 60; const ex = x0 + Math.cos(t) * len, ey = 1360 + Math.sin(t) * len; return blob({ name: 'Frond', pts: [[x0, 1360], [x0 + (ex - x0) * 0.5 + 40 * mirror, 1360 + (ey - 1360) * 0.55], [ex, ey]], closed: false, strokes: [{ w: 30 - i * 2, cap: 'round', linear: { x1: x0, y1: 1360, x2: ex, y2: ey, stops: [[0, argb('2E7A52')], [1, argb('7ACB8A')]] } }] }); }).join('') + rrect({ name: 'Pot', cx: x0, cy: 1430, w: 200, h: 150, r: 30, fills: [{ solid: argb('E8DCCB') }, lin(x0 - 100, 0, x0 + 100, 0, [[0, 'FFFFFF', 0.3], [1, '3A2A20', 0.3]])] }), { id: ID(id) });
  const far = layer('L_far', 'far', blob({ name: 'WindowView', pts: [[0, 0, 'c'], [0, 0, 'c']], fills: [] }) + '');
  const windowShape = rrect({ name: 'WindowGlass', cx: 1200, cy: 600, w: 1100, h: 820, r: 28, fills: [lin(0, 190, 0, 1010, [[0, 'DDF0FF'], [0.6, 'F4FAFF'], [1, 'FFFFFF']]), rad(900, 340, 520, [[0, 'FFFFFF', 0.8], [1, 'FFFFFF', 0]])] });
  const view = ellipse({ name: 'Hedge1', cx: 800, cy: 1000, rx: 260, ry: 130, fills: [{ solid: argb('A8D4B0') }] }) + ellipse({ name: 'Hedge2', cx: 1500, cy: 1020, rx: 300, ry: 140, fills: [{ solid: argb('96C8A4') }] }) + ellipse({ name: 'Cloud', cx: 1400, cy: 420, rx: 160, ry: 50, fills: [{ solid: argb('FFFFFF', 0.85) }] });
  const mid = layer('L_mid', 'mid', windowShape + view + glowDisc('SunBeam', 1000, 380, 520, 'FFFFFF', 0.6, ID('SunBeam')) +
    blob({ name: 'MullV', pts: [[1200, 190], [1200, 1010]], closed: false, strokes: [{ w: 18, solid: argb('F4F8F8') }] }) + blob({ name: 'MullH', pts: [[650, 600], [1750, 600]], closed: false, strokes: [{ w: 18, solid: argb('F4F8F8') }] }) +
    rrect({ name: 'WindowTrim', cx: 1200, cy: 600, w: 1118, h: 838, r: 34, fills: [], strokes: [{ w: 26, solid: argb('F4F8F8') }] }) +
    rrect({ name: 'Sill', cx: 1200, cy: 1030, w: 1240, h: 36, r: 12, fills: [lin(0, 1010, 0, 1050, [[0, 'FFFFFF'], [1, 'B8CCCA']])] }));
  const frame = layer('L_frame', 'frame', plant('PlantL', 260, 1) + plant('PlantR', 2140, -1));
  const fg = layer('L_glow', 'glow', rrect({ name: 'Counter', cx: 1200, cy: 1490, w: 2600, h: 200, r: 0, fills: [lin(0, 1390, 0, 1600, [[0, 'F4F8F8'], [1, 'B8CCCA']])] }) + glowDisc('SoftLight', 1200, 700, 1200, 'FFFFFF', 0.25, ID('WarmGlow')));
  const amb = anim('ambient', 300, 'loop', [swayK('PlantL', 0.03, 300), swayK('PlantR', 0.03, 300, -1), pulse('SunBeam', 0.55, 0.9, 300)]);
  const cel = anim('celebrate', 100, 'oneShot', [['WarmGlow', 'opacity', [[0, 1], [40, 1], [100, 1]]]]);
  return { content: fg + frame + mid + sky, amb, cel };
}

// ---------------- assemble artboards ----------------
const NAMES = ['Scene_TeaHouse', 'Scene_Cafe', 'Scene_Rooftop', 'Scene_Clinic'];
const builders = [teaHouse, cafe, rooftop, clinic];
const pv = (n) => `${VM.id}-${VM.props[n]}`;
const cNum = (p, op, v) => `<TransitionViewModelCondition opValue="${op}"><TransitionPropertyViewModelComparator><BindablePropertyNumber><DataBindContext sourcePathIds="${pv(p)}" propertyKey="636"/></BindablePropertyNumber></TransitionPropertyViewModelComparator><TransitionValueNumberComparator value="${v}"/></TransitionViewModelCondition>`;
const cBool = (p, v) => `<TransitionViewModelCondition><TransitionPropertyViewModelComparator><BindablePropertyBoolean><DataBindContext sourcePathIds="${pv(p)}" propertyKey="634"/></BindablePropertyBoolean></TransitionPropertyViewModelComparator><TransitionValueBooleanComparator value="${v}"/></TransitionViewModelCondition>`;
const cTrig = (p) => `<TransitionViewModelCondition><TransitionPropertyViewModelComparator><BindablePropertyTrigger><DataBindContext sourcePathIds="${pv(p)}" propertyKey="686"/></BindablePropertyTrigger></TransitionPropertyViewModelComparator><TransitionValueTriggerComparator/></TransitionViewModelCondition>`;
const tr = (to, d, c = '') => `<StateTransition stateToId="${to}" duration="${d}">${c}</StateTransition>`;

let artboards = '';
builders.forEach((b, i) => {
  setNs(`s${i}_`);
  animXml.length = 0;
  const sc = b();
  // time of day: night tint + day warmth
  const tint = rrect({ name: 'NightTint', cx: W / 2, cy: H / 2, w: W, h: H, r: 0, fills: [{ solid: argb(i === 3 ? '3A4A8A' : '0A0A30') }] })
    .replace('<Shape ', `<Shape opacity="0.3" `).replace(/<\/Shape>$/, `<DataBindContext sourcePathIds="${pv('timeOfDay')}" propertyKey="18" converterId="${conv('tod_tint_' + i, 0, i === 3 ? 0.18 : 0.36, 0, 100)}"/></Shape>`);
  const flash = rrect({ name: 'Flash', cx: W / 2, cy: H / 2, w: W, h: H, r: 0, id: ID('Flash'), attrs: ' opacity="0"', fills: [rad(W / 2, 900, 1500, [[0, 'FFE9B0', 0.45], [1, 'FFE9B0', 0]])] });
  const flashAnim = anim('flash', 100, 'oneShot', [['Flash', 'opacity', [[0, 0], [18, 1], [100, 0]]]]);
  const celAnim = sc.cel;
  const idle = nid(), amb = nid(), cel = nid(), ambE = nid();
  const sm = `<StateMachine name="SceneSM" id="${ID('SceneSM')}">` +
    `<StateMachineLayer name="Ambient"><ExitState x="0" y="-300"/><AnyState x="0" y="-150">${tr(ambE, 300, cBool('reducedMotion', true))}${tr(ambE, 300, cBool('ambience', false))}</AnyState><EntryState><StateTransition stateToId="${amb}"/></EntryState>` +
    `<AnimationState x="220" animationId="${sc.amb}" id="${amb}">${tr(ambE, 300, cBool('reducedMotion', true))}${tr(ambE, 300, cBool('ambience', false))}</AnimationState>` +
    `<AnimationState x="460" id="${ambE}">${tr(amb, 300, cBool('reducedMotion', false) + cBool('ambience', true))}</AnimationState></StateMachineLayer>` +
    `<StateMachineLayer name="Celebrate"><ExitState x="0" y="-300"/><AnyState x="0" y="-150">${tr(cel, 100, cTrig('celebrate'))}</AnyState><EntryState><StateTransition stateToId="${idle}"/></EntryState><AnimationState x="220" id="${idle}"/>` +
    `<BlendStateDirect x="460" id="${cel}"><BlendAnimationDirect animationId="${flashAnim}" blendSource="1" mixValue="1"/><BlendAnimationDirect animationId="${celAnim}" blendSource="1" mixValue="1"/><BlendStateTransition stateToId="${idle}" enableExitTime="true" exitTimeIsPercetange="true" exitTime="100" duration="300"/></BlendStateDirect></StateMachineLayer></StateMachine>`;
  const stars = (sc.nightTargets || []).length ? `` : '';
  artboards += `<Artboard defaultStateMachineId="${ID('SceneSM')}" viewModelId="0:40" viewModelInstanceId="0:41" styleId="${nid()}" x="${i * 2600}" width="${W}" height="${H}" name="${NAMES[i]}" id="${nid()}">` +
    `<LayoutComponentStyle name="Style" id="${ID('style')}"/>`.replace(/id="[^"]+"/, `id="${'0:' + (900 + i)}"`) + tint + flash + sc.content + sm + animXml.join('') + `</Artboard>`;
  artboards = artboards.replace(/styleId="0:\d+" x="(\d+)"/, (m, x) => m).replace(`styleId="${/styleId="(0:\d+)"/.exec(artboards.split('<Artboard ').pop())[1]}"`, `styleId="0:${900 + i}"`);
});
setNs('');
const rml = `<Rive version="1" kind="fragment">${artboards}${vmXml}${convXml}</Rive>`;
fs.writeFileSync(path.join(here, '../scenes/scene.rml'), rml.replace(/></g, '>\n<'));
console.log('wrote scenes/scene.rml', (rml.length / 1024).toFixed(0), 'KB');
