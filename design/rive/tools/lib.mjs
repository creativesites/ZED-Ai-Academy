// RML emit helpers for the ZAI teacher generator.
// All art is authored in absolute artboard coordinates; the helpers convert to
// the local space of the enclosing group so poses stay readable.

let counter = 200;
export const nid = () => `0:${counter++}`;
export const named = {};
export let NS = '';
export const setNs = (n) => { NS = n; };
export const ID = (name) => (named[NS + name] ||= nid());
export const posOf = (obj) => POS[NS + obj];
export const f = (n) => (Math.round(n * 100) / 100).toString();

// ---- origin stack (group pivots in absolute space) ---------------------------------------
export const O = { x: 0, y: 0 };
const stack = [];
export function pushOrigin(x, y) { stack.push({ ...O }); O.x = x; O.y = y; }
export function popOrigin() { Object.assign(O, stack.pop()); }
export const rel = (x, y) => [x - O.x, y - O.y];

// ---- colours ----------------------------------------------------------------------------
export function argb(hex6, a = 1) {
  const h = hex6.replace('#', '').toUpperCase();
  return Math.round(a * 255).toString(16).toUpperCase().padStart(2, '0') + h;
}

// ---- view model registry -----------------------------------------------------------------
export const VM = { id: '0:40', props: {}, enumVals: {} };
export const vmPath = (name) => {
  if (!VM.props[name]) throw new Error(`unknown VM prop ${name}`);
  return `${VM.id}-${VM.props[name]}`;
};

// ---- paint -------------------------------------------------------------------------------
// spec: {solid, bind?} | {radial:{cx,cy,r,stops}} | {linear:{x1,y1,x2,y2,stops}}
// stops: [[pos, 'AARRGGBB' | {bind,name}]]
function stopXml(pos, col) {
  if (typeof col === 'object' && col.bind) {
    return `<GradientStop colorValue="${col.fallback}" position="${f(pos)}"><DataBindContext sourcePathIds="${vmPath(col.bind)}" propertyKey="38"/></GradientStop>`;
  }
  return `<GradientStop colorValue="${col}" position="${f(pos)}"/>`;
}
function colorXml(spec, cx0, cy0) {
  const dx = (x) => f(x - cx0), dy = (y) => f(y - cy0);
  if (spec.solid) {
    const bind = spec.bind ? `<DataBindContext sourcePathIds="${vmPath(spec.bind)}" propertyKey="37"/>` : '';
    return bind ? `<SolidColor colorValue="${spec.solid}">${bind}</SolidColor>` : `<SolidColor colorValue="${spec.solid}"/>`;
  }
  if (spec.radial) {
    const g = spec.radial;
    return `<RadialGradient startX="${dx(g.cx)}" startY="${dy(g.cy)}" endX="${dx(g.cx + g.r)}" endY="${dy(g.cy)}">${g.stops.map(([p, c]) => stopXml(p, c)).join('')}</RadialGradient>`;
  }
  if (spec.linear) {
    const g = spec.linear;
    return `<LinearGradient startX="${dx(g.x1)}" startY="${dy(g.y1)}" endX="${dx(g.x2)}" endY="${dy(g.y2)}">${g.stops.map(([p, c]) => stopXml(p, c)).join('')}</LinearGradient>`;
  }
  throw new Error('bad paint');
}
const fillXml = (spec, cx, cy) => `<Fill${spec.rule ? ` fillRule="${spec.rule}"` : ''}>${colorXml(spec, cx, cy)}</Fill>`;
const strokeXml = (spec, cx, cy) =>
  `<Stroke thickness="${f(spec.w)}" cap="${spec.cap || 'round'}" join="${spec.join || 'round'}">${colorXml(spec, cx, cy)}</Stroke>`;

// ---- paths -------------------------------------------------------------------------------
// pts: [x,y] smooth | [x,y,'c',radius] corner. Catmull-Rom -> cubic handles.
export function vertsXml(pts, closed, ox, oy, k = 1) {
  const n = pts.length;
  return pts.map((p, i) => {
    const x = p[0] - ox, y = p[1] - oy;
    if (p[2] === 'c') return `<StraightVertex x="${f(x)}" y="${f(y)}"${p[3] ? ` radius="${p[3]}"` : ''}/>`;
    const pv = closed ? pts[(i - 1 + n) % n] : pts[Math.max(0, i - 1)];
    const nx = closed ? pts[(i + 1) % n] : pts[Math.min(n - 1, i + 1)];
    const vx = ((nx[0] - pv[0]) / 6) * k, vy = ((nx[1] - pv[1]) / 6) * k;
    const d = Math.hypot(vx, vy), a = Math.atan2(vy, vx);
    return `<CubicDetachedVertex x="${f(x)}" y="${f(y)}" inRotation="${f(a + Math.PI)}" inDistance="${f(d)}" outRotation="${f(a)}" outDistance="${f(d)}"/>`;
  }).join('');
}
const bbox = (pts) => {
  const xs = pts.map((p) => p[0]), ys = pts.map((p) => p[1]);
  return { x0: Math.min(...xs), x1: Math.max(...xs), y0: Math.min(...ys), y1: Math.max(...ys) };
};

// A shape from a smooth point list. Extra attrs/children allowed.
export function blob({ name, pts, closed = true, fills = [], strokes = [], k = 1, id, attrs = '', extra = '' }) {
  const b = bbox(pts), cx = (b.x0 + b.x1) / 2, cy = (b.y0 + b.y1) / 2;
  const [lx, ly] = rel(cx, cy);
  const idAttr = id ? ` id="${id}"` : '';
  return `<Shape x="${f(lx)}" y="${f(ly)}" name="${name}"${idAttr}${attrs}>` +
    `<PointsPath isClosed="${closed}" name="Path">${vertsXml(pts, closed, cx, cy, k)}</PointsPath>` +
    fills.map((s) => fillXml(s, cx, cy)).join('') + strokes.map((s) => strokeXml(s, cx, cy)).join('') + extra + `</Shape>`;
}

// Ellipse / circle shape at absolute (cx,cy).
export function ellipse({ name, cx, cy, rx, ry = rx, fills = [], strokes = [], id, attrs = '', extra = '', rot = 0 }) {
  const [lx, ly] = rel(cx, cy);
  const idAttr = id ? ` id="${id}"` : '';
  return `<Shape x="${f(lx)}" y="${f(ly)}"${rot ? ` rotation="${f(rot)}"` : ''} name="${name}"${idAttr}${attrs}>` +
    `<Ellipse width="${f(rx * 2)}" height="${f(ry * 2)}" originX="0.5" originY="0.5" name="Path"/>` +
    fills.map((s) => fillXml(s, cx, cy)).join('') + strokes.map((s) => strokeXml(s, cx, cy)).join('') + extra + `</Shape>`;
}

// Rounded rectangle centred at (cx,cy).
export function rrect({ name, cx, cy, w, h, r, fills = [], strokes = [], id, attrs = '', extra = '', rot = 0, ox = 0.5, oy = 0.5 }) {
  const [lx, ly] = rel(cx, cy);
  const idAttr = id ? ` id="${id}"` : '';
  return `<Shape x="${f(lx)}" y="${f(ly)}"${rot ? ` rotation="${f(rot)}"` : ''} name="${name}"${idAttr}${attrs}>` +
    `<Rectangle width="${f(w)}" height="${f(h)}" originX="${ox}" originY="${oy}" cornerRadiusTL="${f(r)}" name="Path"/>` +
    fills.map((s) => fillXml(s, cx - (ox - 0.5) * w * 0, cy)).join('') + strokes.map((s) => strokeXml(s, cx, cy)).join('') + extra + `</Shape>`;
}

// Group node with pivot (px,py) in absolute space. fn() emits children in absolute coords.
export const POS = {};   // rest local position of every named group (x/y keyframes are absolute)
export function group(name, px, py, fn, { id, attrs = '', pos } = {}) {
  let [lx, ly] = rel(px, py);
  if (pos) [lx, ly] = pos;
  POS[NS + name] = [lx, ly];
  pushOrigin(px, py);
  const inner = fn();
  popOrigin();
  const idAttr = id ? ` id="${id}"` : '';
  return `<Node x="${f(lx)}" y="${f(ly)}" name="${name}"${idAttr}${attrs}>${inner}</Node>`;
}

// ---- lighting helpers --------------------------------------------------------------------
// Key light from upper-left-front, warm bounce from lower-right, amber rim on the right.
export const LIGHT = { x: -0.5, y: -0.62 };
const WARM = 'FFC47A', DUSK = '2A0F2E';

// Volume shading for a roughly round form centred (cx,cy), radius r. Returns paint specs to
// stack ABOVE the flat base fill. Everything is alpha-only so any base colour recolours cleanly.
export function volume(cx, cy, r, o = {}) {
  const shadow = o.shadow ?? 0.5, hi = o.hi ?? 0.3, bounce = o.bounce ?? 0.22, rim = o.rim ?? 0.5, tint = o.tint || DUSK, rimC = o.rimC || WARM, bounceC = o.bounceC || WARM;
  const out = [];
  out.push({ radial: { cx: cx + LIGHT.x * 0.42 * r, cy: cy + LIGHT.y * 0.42 * r, r: r * 1.25, stops: [[0, argb(tint, 0)], [0.5, argb(tint, 0)], [0.82, argb(tint, shadow * 0.55)], [1, argb(tint, shadow)]] } });
  if (bounce) out.push({ radial: { cx: cx + 0.5 * r, cy: cy + 0.62 * r, r: r * 0.7, stops: [[0, argb(bounceC, bounce)], [1, argb(bounceC, 0)]] } });
  if (hi) out.push({ radial: { cx: cx + LIGHT.x * 0.5 * r, cy: cy + LIGHT.y * 0.5 * r, r: r * 0.55, stops: [[0, argb('FFFFFF', hi)], [1, argb('FFFFFF', 0)]] } });
  if (rim) out.push({ linear: { x1: cx + r, y1: cy - 0.1 * r, x2: cx + r * 0.8, y2: cy + 0.1 * r, stops: [[0, argb(rimC, rim)], [1, argb(rimC, 0)]] } });
  return out;
}

// Cylinder shading across a limb whose local x spans -hw..hw centred at (cx,cy).
export function cylinder(cx, cy, hw, o = {}) {
  const shadow = o.shadow ?? 0.5, hi = o.hi ?? 0.28, rim = o.rim ?? 0.55, tint = o.tint || DUSK, rimC = o.rimC || WARM;
  return [
    { linear: { x1: cx - hw, y1: cy, x2: cx + hw, y2: cy, stops: [[0, argb('FFFFFF', hi * 0.4)], [0.22, argb('FFFFFF', hi)], [0.5, argb(tint, 0)], [0.8, argb(tint, shadow * 0.7)], [1, argb(tint, shadow)]] } },
    { linear: { x1: cx + hw, y1: cy, x2: cx + hw * 0.72, y2: cy, stops: [[0, argb(rimC, rim)], [1, argb(rimC, 0)]] } },
  ];
}

// Solo whose active child is chosen by a 1-frame animation
export const soloXml = (name, firstId, inner) => `<Solo activeComponentId="${firstId}" name="${name}" id="${ID(name)}">${inner}</Solo>`;
export const nodeXml = (name, id, inner) => `<Node name="${name}" id="${id}">${inner}</Node>`;
