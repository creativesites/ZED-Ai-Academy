// Animations + state machine for the Teacher artboard.
// Gestures are authored as poses; arm poses come from a 2-bone IK solver baked to keyframes
// (the reachable fingertip path for tone tracing is therefore exactly the contract path).
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { ID, nid, f, VM, NS, setNs, posOf } from './lib.mjs';
import { SHOULDER, UPPER, FORE, TIP } from './arms.mjs';
import { HAIR, OUTFIT, PROP } from './variants.mjs';
import { FACE_STYLES, FS } from './faces.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const contract = JSON.parse(fs.readFileSync(path.join(here, '../../../docs/rive/teacher.contract.json'), 'utf8'));

const EASE = {
  io: [0.42, 0, 0.58, 1], o: [0, 0, 0.35, 1], i: [0.5, 0, 1, 1], soft: [0.3, 0, 0.2, 1],
  back: [0.2, 1.45, 0.4, 1], snap: [0.1, 0, 0.1, 1],
};

// ---------------------------------------------------------------------------------------------
// keyframe emitters. A "track" is [objName, prop, keys]; keys are [frame, value, ease?]
// ---------------------------------------------------------------------------------------------
function keyXml(k, prop) {
  const [frame, value, ease = 'io'] = k;
  if (prop === 'activeComponentId') return `<KeyFrameId value="${value}" frame="${frame}" interpolationType="hold"/>`;
  if (prop === 'propertyValue') return `<KeyFrameString value="${value}" frame="${frame}" interpolationType="hold"/>`;
  if (prop === 'trigger') return `<KeyFrameCallback frame="${frame}"/>`;
  if (ease === 'l') return `<KeyFrameDouble value="${f(value)}" frame="${frame}" interpolationType="linear"/>`;
  if (ease === 'h') return `<KeyFrameDouble value="${f(value)}" frame="${frame}" interpolationType="hold"/>`;
  const [x1, y1, x2, y2] = EASE[ease];
  return `<KeyFrameDouble value="${f(value)}" frame="${frame}" interpolationType="cubic"><CubicEaseInterpolator x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}"/></KeyFrameDouble>`;
}

export const anims = {};
const animXml = [];
import * as LIB from './lib.mjs';
const nsNow = () => LIB.NS;
export function anim(name, frames, loop, tracks) {
  const rawName = name; name = (nsNow() ? nsNow() : '') + name;
  const byObj = new Map();
  for (const [obj, prop, keys0] of tracks) {
    if (!byObj.has(obj)) byObj.set(obj, new Map());
    const m = byObj.get(obj);
    // authored x/y are offsets from the group's rest position; Rive keys absolute local values
    const base = posOf(obj);
    const keys = (prop === 'x' || prop === 'y') && base ? keys0.map(([fr, v, e]) => [fr, v + base[prop === 'x' ? 0 : 1], e]) : keys0;
    m.set(prop, keys);
  }
  const id = ID(`anim_${name}`);
  anims[name] = id;
  const body = [...byObj].map(([obj, props]) =>
    `<KeyedObject objectId="${ID(obj)}">` + [...props].map(([prop, keys]) =>
      `<KeyedProperty property="${prop}">${[...keys].sort((a, b) => a[0] - b[0]).map((k) => keyXml(k, prop)).join('')}</KeyedProperty>`).join('') + `</KeyedObject>`).join('');
  animXml.push(`<LinearAnimation loopValue="${loop}" duration="${frames}" fps="60" name="${name}" id="${id}">${body}</LinearAnimation>`);
  return id;
}

// ---------------------------------------------------------------------------------------------
// 2-bone IK (rotation 0 = pointing down, positive = clockwise; dir(theta) = (-sin, cos))
// ---------------------------------------------------------------------------------------------
export function reach(side, tx, ty, len, shoulderDy = 0) {
  const [sx, sy0] = SHOULDER[side], sy = sy0 + shoulderDy;
  const L1 = UPPER, L2 = FORE + len;
  const dx = tx - sx, dy = ty - sy;
  const d = Math.min(Math.max(Math.hypot(dx, dy), Math.abs(L1 - L2) + 1), L1 + L2 - 0.5);
  const tt = Math.atan2(-dx, dy);
  const alpha = Math.acos((L1 * L1 + d * d - L2 * L2) / (2 * L1 * d));
  const beta = Math.acos((L1 * L1 + L2 * L2 - d * d) / (2 * L1 * L2));
  const cands = [1, -1].map((b) => {
    const th1 = tt + b * alpha, th2 = -b * (Math.PI - beta);
    return { th1, th2, ey: sy + Math.cos(th1) * L1 };
  });
  const c = cands[0].ey >= cands[1].ey ? cands[0] : cands[1];
  return { sh: c.th1, el: c.th2 };
}

// Rest pose (hands relaxed in front of the belly)
const RESTHAND = { L: [470, 1316], R: [730, 1316] };
const rl = reach('L', ...RESTHAND.L, 92), rr = reach('R', ...RESTHAND.R, 92);
export const REST = {
  'ShoulderL.rotation': rl.sh, 'ElbowL.rotation': rl.el, 'WristL.rotation': 0.12,
  'ShoulderR.rotation': rr.sh, 'ElbowR.rotation': rr.el, 'WristR.rotation': -0.12,
};
const restOf = (addr) => {
  if (addr in REST) return REST[addr];
  if (addr.endsWith('.scaleX') || addr.endsWith('.scaleY') || addr.endsWith('.opacity')) return addr.startsWith('Cheek') ? 0.7 : 1;
  return 0;
};
const HAND_OPEN = (s) => ID(`hand_open_${s}`);

// ---------------------------------------------------------------------------------------------
// pose DSL: key = [frame, {addr: value}, ease]; hand poses via {HandL:'point'}
// ---------------------------------------------------------------------------------------------
function armPose(side, tx, ty, len, o = {}) {
  const r = reach(side, tx, ty, len, o.dy || 0);
  if (o.pointAngle != null) o = { ...o, wrist: o.pointAngle - (r.sh + r.el) };   // absolute hand direction (pi = fingers up)
  return { [`Shoulder${side}.rotation`]: r.sh, [`Elbow${side}.rotation`]: r.el, [`Wrist${side}.rotation`]: o.wrist ?? 0 };
}
const REST_POSE = () => ({ ...REST });

const BOUNCE = new Set(['BodyLean.y', 'Body.scaleY', 'Body.scaleX']);
function build(name, frames, keys, { events = {}, hands = {}, rm = false, loop = 'oneShot', exact = false } = {}) {
  // collect tracks per address
  const tr = new Map();
  const put = (addr, frame, v, ease) => { if (!tr.has(addr)) tr.set(addr, []); tr.get(addr).push([frame, v, ease]); };
  for (const [frame, pose, ease] of keys) {
    for (const [addr, v0] of Object.entries(pose)) {
      let v = v0;
      if (rm && !exact && typeof v === 'number') v = BOUNCE.has(addr) ? restOf(addr) : restOf(addr) + (v - restOf(addr)) * 0.5;
      put(addr, frame, v, ease);
    }
  }
  // every touched property starts and ends at rest so gestures blend cleanly
  for (const [addr, ks] of tr) {
    ks.sort((a, b) => a[0] - b[0]);
    if (ks[0][0] > 0) ks.unshift([0, restOf(addr), 'io']);
    if (ks[ks.length - 1][0] < frames) ks.push([frames, restOf(addr), 'io']);
  }
  const tracks = [];
  for (const [addr, ks] of tr) { const [obj, prop] = addr.split('.'); tracks.push([obj, prop, ks]); }
  // hand pose solos
  for (const side of ['L', 'R']) {
    const seq = hands[side];
    if (!seq) continue;
    const ks = seq.map(([fr, pose]) => [fr, ID(`hand_${pose}_${side}`)]);
    if (ks[0][0] > 0) ks.unshift([0, HAND_OPEN(side)]);
    if (ks[ks.length - 1][1] !== HAND_OPEN(side)) ks.push([frames, HAND_OPEN(side)]);
    tracks.push([`HandSolo${side}`, 'activeComponentId', ks]);
  }
  // events
  const label = events.label || name;
  const evList = [['gestureStart', 1], ['gestureEnd', frames - 1], ...(events.extra || [])];
  if (events.peaks) evList.push(['gesturePeak', events.peaks]); else if (events.peak != null) evList.push(['gesturePeak', events.peak]);
  for (const [ev, fr0] of evList) {
    const fr = Array.isArray(fr0) ? fr0[0] : fr0;
    if (fr == null) continue;
    const evName = typeof ev === 'string' ? ev : ev[0];
    const strVal = events.strFor ? events.strFor(evName) : label;
    tracks.push([`${evName}.${evName.startsWith('trace') ? 'toneShape' : 'gesture'}`, 'propertyValue', [[Math.max(0, fr - 1), strVal]]]);
    tracks.push([evName, 'trigger', (Array.isArray(fr0) ? fr0 : [fr0]).map((x) => [x])]);
  }
  return anim(name + (rm ? '_rm' : ''), frames, loop, tracks);
}

// ---------------------------------------------------------------------------------------------
// gesture library
// ---------------------------------------------------------------------------------------------
const G = {}; // name -> (rm) => {id, frames}
function defGesture(name, frames, fn, opts = {}) {
  const label = name.startsWith('trace_') ? 'trace_tone' : name.startsWith('count_') ? 'count' : name;
  G[name] = { frames, make: (rm) => build(name, frames, fn(), { ...opts, rm, events: { ...(opts.events || {}), label } }), opts };
}
const P = (...ps) => Object.assign({}, ...ps);

defGesture('wave', 96, () => {
  const up = P(armPose('R', 1000, 540, 96, { wrist: 0 }));
  const sw = (w) => P(armPose('R', 1000, 540, 96, { wrist: w }));
  return [
    [0, REST_POSE(), 'back'], [16, P(up, { 'HeadAim.rotation': 0.05, 'EyeL.scaleY': 0.9, 'EyeR.scaleY': 0.9 }), 'io'],
    [24, sw(0.5), 'io'], [34, sw(-0.5), 'io'], [44, sw(0.5), 'io'], [54, sw(-0.5), 'io'], [62, sw(0), 'io'],
    [66, P(up, { 'HeadAim.rotation': 0.05, 'EyeL.scaleY': 0.9, 'EyeR.scaleY': 0.9 }), 'io'], [96, REST_POSE(), 'io'],
  ];
}, { events: { peak: 44 } });

defGesture('nod', 54, () => [
  [0, {}, 'o'], [12, { 'HeadAim.y': 16, 'HeadAim.rotation': 0.02, 'EyeL.scaleY': 0.84, 'EyeR.scaleY': 0.84 }, 'io'],
  [24, { 'HeadAim.y': -2, 'EyeL.scaleY': 0.95, 'EyeR.scaleY': 0.95 }, 'io'], [36, { 'HeadAim.y': 16, 'EyeL.scaleY': 0.84, 'EyeR.scaleY': 0.84 }, 'io'], [48, { 'HeadAim.y': 0 }, 'io'],
], { events: { peak: 12 } });

defGesture('head_shake', 60, () => [
  [0, {}, 'o'], [10, { 'HeadAim.rotation': 0.06, 'HeadAim.x': 14, 'BrowL.rotation': -0.12, 'BrowR.rotation': 0.12 }, 'io'],
  [30, { 'HeadAim.rotation': -0.06, 'HeadAim.x': -14, 'BrowL.rotation': -0.12, 'BrowR.rotation': 0.12 }, 'io'],
  [46, { 'HeadAim.rotation': 0.03, 'HeadAim.x': 6, 'BrowL.rotation': -0.08, 'BrowR.rotation': 0.08 }, 'io'],
], { events: { peak: 30 } });

defGesture('explain', 144, () => {
  const a = (dl, dr) => P(armPose('L', 450, 1210 + dl, 92, { wrist: -0.3 }), armPose('R', 750, 1210 + dr, 92, { wrist: 0.3 }));
  return [
    [0, REST_POSE(), 'back'], [20, a(0, 24), 'io'], [48, a(26, -4), 'io'], [76, a(-4, 26), 'io'], [104, a(24, -2), 'io'], [128, a(0, 10), 'io'],
    [20, { 'HeadAim.rotation': 0.03 }, 'io'], [76, { 'HeadAim.rotation': -0.03 }, 'io'],
  ];
}, { hands: { L: [[10, 'open']], R: [[10, 'open']] }, events: { peak: 20 } });

defGesture('point_card', 120, () => {
  const t = armPose('L', 180, 640, TIP, { wrist: 0 });
  return [
    [0, REST_POSE(), 'o'], [26, P(t, { 'HeadAim.rotation': -0.05, 'GazeL.x': -16, 'GazeR.x': -16, 'BodyLean.rotation': -0.012 }), 'back'],
    [96, P(t, { 'HeadAim.rotation': -0.05, 'GazeL.x': -16, 'GazeR.x': -16, 'BodyLean.rotation': -0.012 }), 'io'], [120, REST_POSE(), 'io'],
  ];
}, { hands: { L: [[2, 'point']] }, events: { peak: 26 } });

for (const [name, side, tx, ty] of [['point_left', 'L', 150, 880], ['point_right', 'R', 1050, 880]]) {
  defGesture(name, 84, () => {
    const t = armPose(side, tx, ty, 100, { wrist: side === 'L' ? 0.2 : -0.2 });
    return [[0, REST_POSE(), 'o'], [28, P(t, { 'HeadAim.rotation': side === 'L' ? -0.05 : 0.05, [`Gaze${'L'}.x`]: side === 'L' ? -12 : 12, 'GazeR.x': side === 'L' ? -12 : 12 }), 'back'], [60, P(t), 'io'], [84, REST_POSE(), 'io']];
  }, { events: { peak: 28 } });
}

defGesture('thumbs_up', 84, () => {
  const t = armPose('R', 990, 800, 84, { wrist: 0.1 });
  return [
    [0, REST_POSE(), 'o'], [24, P(t, { 'BodyLean.y': -10, 'EyeL.scaleY': 0.9 }), 'back'], [30, P(t, { 'BodyLean.y': 0, 'EyeR.scaleY': 0.12 }), 'io'],
    [40, P(t, { 'EyeR.scaleY': 1 }), 'io'], [66, P(t), 'io'], [84, REST_POSE(), 'io'],
  ];
}, { hands: { R: [[4, 'thumb']] }, events: { peak: 24 } });

defGesture('clap', 72, () => {
  const ap = P(armPose('L', 500, 1090, 92, { wrist: -0.2 }), armPose('R', 700, 1090, 92, { wrist: 0.2 }));
  const to = P(armPose('L', 588, 1090, 92, { wrist: -0.1 }), armPose('R', 612, 1090, 92, { wrist: 0.1 }));
  const sq = { 'EyeL.scaleY': 0.8, 'EyeR.scaleY': 0.8 };
  return [[0, REST_POSE(), 'o'], [10, P(ap, sq), 'io'], [18, P(to, sq), 'snap'], [26, P(ap, sq), 'io'], [34, P(to, sq), 'snap'], [42, P(ap, sq), 'io'], [50, P(to, sq), 'snap'], [72, REST_POSE(), 'io']];
}, { events: { peak: 18 } });

defGesture('think', 132, () => {
  const t = armPose('R', 668, 842, 70, { wrist: 0.3 });
  const hd = { 'HeadAim.rotation': -0.07, 'GazeL.x': -10, 'GazeR.x': -10, 'GazeL.y': -12, 'GazeR.y': -12, 'BrowR.y': -12 };
  return [[0, REST_POSE(), 'o'], [26, P(t, hd), 'io'], [100, P(t, hd), 'io'], [132, REST_POSE(), 'io']];
}, { hands: { R: [[4, 'point']] } });

defGesture('listen', 144, () => {
  const t = armPose('L', 250, 640, 96, { wrist: 0.5 });
  const hd = { 'HeadAim.rotation': 0.08, 'BodyLean.rotation': 0.03, 'BodyLean.y': -8, 'BrowL.y': -10, 'BrowR.y': -10 };
  return [[0, REST_POSE(), 'o'], [36, P(t, hd), 'back'], [110, P(t, hd, { 'HeadAim.y': 6 }), 'io'], [144, REST_POSE(), 'io']];
}, { events: { peak: 36 } });

defGesture('celebrate', 120, () => {
  const up = P(armPose('L', 170, 400, 96, { wrist: -0.3 }), armPose('R', 1030, 400, 96, { wrist: 0.3 }));
  const sq = { 'EyeL.scaleY': 0.72, 'EyeR.scaleY': 0.72, 'BrowL.y': -10, 'BrowR.y': -10 };
  return [
    [0, REST_POSE(), 'o'], [16, P(up, sq, { 'BodyLean.y': 0 }), 'back'], [28, { 'BodyLean.y': -34 }, 'o'], [40, { 'BodyLean.y': 0 }, 'i'], [54, { 'BodyLean.y': -30 }, 'o'], [66, { 'BodyLean.y': 0 }, 'i'],
    [92, P(up, sq), 'io'], [120, REST_POSE(), 'io'],
  ];
}, { events: { peak: 28 } });

defGesture('shrug', 72, () => {
  const t = P(armPose('L', 300, 1130, 92, { wrist: -0.6 }), armPose('R', 900, 1130, 92, { wrist: 0.6 }));
  return [[0, REST_POSE(), 'o'], [30, P(t, { 'HeadAim.rotation': 0.06, 'BodyLean.y': -8, 'BrowL.y': -8, 'BrowR.y': -8 }), 'back'], [54, P(t, { 'HeadAim.rotation': 0.06 }), 'io'], [72, REST_POSE(), 'io']];
}, { events: { peak: 30 } });

defGesture('beckon', 78, () => {
  const a = (w) => armPose('R', 880, 1020, 96, { wrist: w });
  return [[0, REST_POSE(), 'o'], [14, a(0.1), 'io'], [26, a(0.7), 'io'], [38, a(0), 'io'], [50, a(0.7), 'io'], [62, a(0.1), 'io'], [78, REST_POSE(), 'io']];
});

defGesture('oops', 84, () => {
  const t = armPose('R', 640, 740, 80, { wrist: 0.2 });
  return [
    [0, REST_POSE(), 'o'], [20, P(t, { 'EyeL.scaleY': 1.14, 'EyeR.scaleY': 1.14, 'BrowL.y': -22, 'BrowR.y': -22 }), 'back'],
    [44, P(t, { 'EyeL.scaleY': 0.8, 'EyeR.scaleY': 0.8, 'HeadAim.rotation': 0.05, 'BodyLean.y': -6 }), 'io'], [56, P(t, { 'HeadAim.rotation': -0.05, 'BodyLean.y': 0 }), 'io'], [84, REST_POSE(), 'io'],
  ];
}, { events: { peak: 20 } });

// count: raise the right hand; fingers appear one by one (1 -> n), one gesturePeak per finger
for (let n = 1; n <= 5; n++) {
  const T0 = 24, STEP = 30;                       // 0.5 s per finger
  const frames = T0 + n * STEP + 34;
  const peaks = Array.from({ length: n }, (_, i) => T0 + (i + 1) * STEP);
  defGesture(`count_${n}`, frames, () => {
    const t = armPose('R', 985, 830, 0, { pointAngle: Math.PI + 0.06 });
    const ks = [[0, REST_POSE(), 'o'], [T0 - 4, P(t), 'back']];
    const wr = t['WristR.rotation'];
    peaks.forEach((fr) => ks.push([fr, { 'WristR.rotation': wr + 0.08 }, 'io'], [fr + 12, { 'WristR.rotation': wr }, 'io']));
    ks.push([T0 + n * STEP + 14, P(t), 'io']);
    return ks;
  }, { hands: { R: [[T0 - 6, 'fist'], ...peaks.map((fr, i) => [fr - 4, `count_${i + 1}`])] }, events: { peaks } });
}

// trace_tone: bake IK along the contract path so the fingertip follows it exactly
const TT = contract.toneTrace;
const [bx0, by0, bx1, by1] = TT.traceBox;
function pathAt(pts, u) {
  // piecewise-linear, constant speed along arc length
  const P2 = pts.map(([x, y]) => [bx0 + x * (bx1 - bx0), by0 + y * (by1 - by0)]);
  const seg = [];
  let total = 0;
  for (let i = 1; i < P2.length; i++) { const l = Math.hypot(P2[i][0] - P2[i - 1][0], P2[i][1] - P2[i - 1][1]); seg.push(l); total += l; }
  let d = u * total;
  for (let i = 0; i < seg.length; i++) {
    if (d <= seg[i] || i === seg.length - 1) { const t = seg[i] ? d / seg[i] : 0; return [P2[i][0] + (P2[i + 1][0] - P2[i][0]) * t, P2[i][1] + (P2[i + 1][1] - P2[i][1]) * t]; }
    d -= seg[i];
  }
}
const LEAD = 22, TAIL = 26, HOLD = 12, LIFT = -22;
for (const shape of contract.enums.ToneShape) {
  const ms = TT.durationMs[shape], tf = Math.round(ms * 0.06);
  const frames = LEAD + tf + HOLD + TAIL;
  defGesture(`trace_${shape}`, frames, () => {
    const ks = [[0, REST_POSE(), 'o']];
    const N = Math.max(2, Math.round(tf / 3));
    const first = pathAt(TT.paths[shape], 0);
    ks.push([LEAD, P(armPose('R', ...first, TIP, { dy: LIFT, wrist: 0 }), { 'BodyLean.y': LIFT, 'GazeL.x': 12, 'GazeR.x': 12, 'HeadAim.rotation': 0.03 }), 'back']);
    for (let i = 1; i <= N; i++) {
      const [tx, ty] = pathAt(TT.paths[shape], i / N);
      ks.push([LEAD + Math.round((tf * i) / N), armPose('R', tx, ty, TIP, { dy: LIFT, wrist: 0 }), 'l']);
    }
    ks.push([LEAD + tf + HOLD, {}, 'io']);
    return ks;
  }, { hands: { R: [[2, 'point']] }, exact: true, events: { extra: [['traceStart', LEAD], ['traceEnd', LEAD + tf]], strFor: (ev) => (ev.startsWith('trace') ? shape : 'trace_tone') } });
}

// ---------------------------------------------------------------------------------------------
// moods (full-intensity poses; intensity blends toward neutral)
// ---------------------------------------------------------------------------------------------
const MOODS = {
  neutral: {},
  warm: { 'BrowL.y': -3, 'BrowR.y': -3, 'EyeL.scaleY': 0.95, 'EyeR.scaleY': 0.95, 'CheekL.opacity': 0.95, 'CheekR.opacity': 0.95, 'MouthRig.scaleX': 1.06, 'MouthRig.y': -2 },
  happy: { 'BrowL.y': -9, 'BrowR.y': -9, 'EyeL.scaleY': 0.84, 'EyeR.scaleY': 0.84, 'CheekL.opacity': 1, 'CheekR.opacity': 1, 'MouthRig.scaleX': 1.14, 'MouthRig.scaleY': 1.08, 'MouthRig.y': -6, 'HeadAim.rotation': 0.02 },
  proud: { 'BrowL.y': -6, 'BrowR.y': -6, 'EyeL.scaleY': 0.8, 'EyeR.scaleY': 0.8, 'CheekL.opacity': 0.9, 'CheekR.opacity': 0.9, 'MouthRig.scaleX': 1.08, 'MouthRig.y': -4, 'HeadAim.rotation': -0.04, 'HeadAim.y': -10 },
  curious: { 'BrowL.y': -2, 'BrowR.y': -26, 'BrowR.rotation': -0.14, 'EyeL.scaleY': 1.04, 'EyeR.scaleY': 1.08, 'MouthRig.scaleX': 0.92, 'MouthRig.rotation': -0.04, 'HeadAim.rotation': 0.07 },
  surprised: { 'BrowL.y': -28, 'BrowR.y': -28, 'EyeL.scaleY': 1.12, 'EyeR.scaleY': 1.12, 'MouthRig.scaleX': 0.94, 'MouthRig.scaleY': 1.12, 'CheekL.opacity': 0.4, 'CheekR.opacity': 0.4, 'HeadAim.y': -8 },
  concerned: { 'BrowL.y': -2, 'BrowR.y': -2, 'BrowL.rotation': -0.24, 'BrowR.rotation': 0.24, 'EyeL.scaleY': 0.96, 'EyeR.scaleY': 0.96, 'MouthRig.scaleX': 0.9, 'MouthRig.scaleY': 0.92, 'MouthRig.y': 6, 'CheekL.opacity': 0.45, 'CheekR.opacity': 0.45, 'HeadAim.rotation': 0.03 },
  playful: { 'BrowL.y': 2, 'BrowR.y': -20, 'BrowR.rotation': -0.16, 'EyeL.scaleY': 0.88, 'EyeR.scaleY': 0.94, 'CheekL.opacity': 0.95, 'CheekR.opacity': 0.95, 'MouthRig.scaleX': 1.1, 'MouthRig.rotation': -0.05, 'MouthRig.y': -4, 'HeadAim.rotation': -0.06 },
};
const MOOD_ADDRS = [...new Set(Object.values(MOODS).flatMap((m) => Object.keys(m)))];
const moodAnim = (name) => anim(`mood_${name}`, 1, 'oneShot', MOOD_ADDRS.map((a) => { const [o, p] = a.split('.'); return [o, p, [[0, MOODS[name][a] ?? restOf(a), 'l']]]; }));

// ---------------------------------------------------------------------------------------------
// builder
// ---------------------------------------------------------------------------------------------
// ---------------- conditions / layer helpers ----------------
const cNum = (prop, op, v) => `<TransitionViewModelCondition opValue="${op}"><TransitionPropertyViewModelComparator><BindablePropertyNumber><DataBindContext sourcePathIds="@@${prop}" propertyKey="636"/></BindablePropertyNumber></TransitionPropertyViewModelComparator><TransitionValueNumberComparator value="${v}"/></TransitionViewModelCondition>`;
const cBool = (prop, v) => `<TransitionViewModelCondition><TransitionPropertyViewModelComparator><BindablePropertyBoolean><DataBindContext sourcePathIds="@@${prop}" propertyKey="634"/></BindablePropertyBoolean></TransitionPropertyViewModelComparator><TransitionValueBooleanComparator value="${v}"/></TransitionViewModelCondition>`;
const cEnum = (prop, en, val) => `<TransitionViewModelCondition><TransitionPropertyViewModelComparator><BindablePropertyEnum><DataBindContext sourcePathIds="@@${prop}" propertyKey="637"/></BindablePropertyEnum></TransitionPropertyViewModelComparator><TransitionValueEnumComparator value="${VM.enumVals[en][val]}"/></TransitionViewModelCondition>`;
const cTrig = (prop) => `<TransitionViewModelCondition><TransitionPropertyViewModelComparator><BindablePropertyTrigger><DataBindContext sourcePathIds="@@${prop}" propertyKey="686"/></BindablePropertyTrigger></TransitionPropertyViewModelComparator><TransitionValueTriggerComparator/></TransitionViewModelCondition>`;
const trans = (to, dur, conds = '', extra = '') => `<StateTransition stateToId="${to}" duration="${dur}"${extra}>${conds}</StateTransition>`;
const exit100 = (to, dur) => `<StateTransition stateToId="${to}" duration="${dur}" enableExitTime="true" exitTimeIsPercetange="true" exitTime="100"/>`;
const layer = (name, body) => `<StateMachineLayer name="${name}" id="${ID('layer_' + name)}"><ExitState x="0" y="-300"/>${body}</StateMachineLayer>`;
const loopLayer = (name, animId) => { const s = nid(); return layer(name, `<AnyState x="0" y="-150"/><EntryState><StateTransition stateToId="${s}"/></EntryState><AnimationState x="220" animationId="${animId}" id="${s}"/>`); };



// faceStyle: 1-frame holds selecting nose/lips/face/lash/brow shapes and the eye form
function faceStyleAnims() {
  FACE_STYLES.forEach((st) => anim(`face_${st}`, 1, 'oneShot', [
    ['FaceSolo', 'activeComponentId', [[0, ID(`face_${st}`)]]], ['NoseSolo', 'activeComponentId', [[0, ID(`nose_${st}`)]]],
    ['MouthStyleSolo', 'activeComponentId', [[0, ID(`ms_${st}`)]]], ['LashSolo', 'activeComponentId', [[0, ID(`lash_${st}`)]]],
    ['BrowShapeLSolo', 'activeComponentId', [[0, ID(`bs_${st}_L`)]]], ['BrowShapeRSolo', 'activeComponentId', [[0, ID(`bs_${st}_R`)]]],
    ['BeardSolo', 'activeComponentId', [[0, ID(st === 'tinashe' ? 'bd_beard' : 'bd_none')]]], ['EarringNode', 'opacity', [[0, st === 'tinashe' ? 0 : 1, 'l']]],
    ['EyeFormL', 'scaleX', [[0, FS[st].eye.sx, 'l']]], ['EyeFormR', 'scaleX', [[0, FS[st].eye.sx, 'l']]],
    ['EyeFormL', 'scaleY', [[0, FS[st].eye.sy, 'l']]], ['EyeFormR', 'scaleY', [[0, FS[st].eye.sy, 'l']]],
    ['EyeFormL', 'rotation', [[0, FS[st].eye.rot, 'l']]], ['EyeFormR', 'rotation', [[0, -FS[st].eye.rot, 'l']]],
  ]));
}

export function buildAnimations() {
  const R = REST;
  const idleTracks = (amp, dur, ph) => {
    const k = (v, d, h = dur / 2) => [[0, v, 'io'], [h, v + d, 'io'], [dur, v, 'io']];
    return [
      ['Body', 'scaleY', k(1, 0.012 * amp)], ['Body', 'scaleX', k(1, 0.004 * amp)], ['Body', 'rotation', [[0, -0.004 * ph], [dur / 2, 0.004 * ph], [dur, -0.004 * ph]]],
      ['Head', 'rotation', [[0, 0.01 * ph], [dur * 0.37, -0.012 * ph], [dur * 0.75, 0.014 * ph], [dur, 0.01 * ph]]],
      ['ShoulderL', 'rotation', k(R['ShoulderL.rotation'], 0.02 * ph)], ['ShoulderR', 'rotation', k(R['ShoulderR.rotation'], -0.02 * ph)],
      ['ElbowL', 'rotation', k(R['ElbowL.rotation'], -0.03 * ph)], ['ElbowR', 'rotation', k(R['ElbowR.rotation'], 0.03 * ph)],
      ['WristL', 'rotation', k(R['WristL.rotation'], 0.04 * ph)], ['WristR', 'rotation', k(R['WristR.rotation'], -0.04 * ph)],
    ];
  };
  anim('idle_a', 240, 'loop', idleTracks(1, 240, 1));
  anim('idle_b', 300, 'loop', [...idleTracks(1.15, 300, -1), ['Body', 'x', [[0, 0, 'io'], [100, 5, 'io'], [200, -4, 'io'], [300, 0, 'io']]]]);

  // blink: single, double, single; lid slides down to close, eye squashes a touch
  const BL = 144;
  const blinkAt = (t) => [[t - 4, 0, 'o'], [t + 3, BL, 'o'], [t + 5, BL, 'i'], [t + 11, 0, 'io']];
  const lid = [[0, 0, 'h'], ...blinkAt(130), ...blinkAt(310), ...blinkAt(336), ...blinkAt(520), [600, 0, 'h']];
  anim('blink', 600, 'loop', [['LidL', 'y', lid], ['LidR', 'y', lid]]);

  // saccades: tiny hold-jumps of the gaze wrapper
  const sac = (a, b) => [[0, 0, 'h'], [70, a, 'h'], [150, b, 'h'], [230, -a, 'h'], [340, 0, 'h'], [400, b * 0.5, 'h'], [520, 0, 'h'], [600, 0, 'h']];
  anim('saccade', 600, 'loop', [['GazeL', 'x', sac(2.5, -2)], ['GazeR', 'x', sac(2.5, -2)], ['GazeL', 'y', sac(-1.5, 1.5)], ['GazeR', 'y', sac(-1.5, 1.5)]]);

  // visemes
  const vnames = ['v0_rest', 'v1_AA', 'v2_EH', 'v3_EE', 'v4_OH', 'v5_OO', 'v6_MBP', 'v7_FV', 'v8_CONS'];
  vnames.forEach((n, i) => anim(`viseme_${i}`, 1, 'oneShot', FACE_STYLES.map((st) => [`MouthSolo_${st}`, 'activeComponentId', [[0, ID(`${n}_${st}`)]]])));

  // look joystick ranges
  anim('look_x', 100, 'oneShot', [['IrisL', 'x', [[0, -17, 'l'], [50, 0, 'l'], [100, 17, 'l']]], ['IrisR', 'x', [[0, -17, 'l'], [50, 0, 'l'], [100, 17, 'l']]], ['HeadAim', 'x', [[0, -9, 'l'], [50, 0, 'l'], [100, 9, 'l']]]]);
  anim('look_y', 100, 'oneShot', [['IrisL', 'y', [[0, -16, 'l'], [50, 0, 'l'], [100, 16, 'l']]], ['IrisR', 'y', [[0, -16, 'l'], [50, 0, 'l'], [100, 16, 'l']]], ['HeadAim', 'y', [[0, -8, 'l'], [50, 0, 'l'], [100, 8, 'l']]]]);

  // moods
  Object.keys(MOODS).forEach(moodAnim);

  // attention loops
  const nod = (amp) => [[0, 0, 'io'], [30, amp, 'io'], [60, 0, 'io'], [96, amp * 0.7, 'io'], [130, 0, 'io'], [168, amp, 'io'], [200, 0, 'io'], [240, 0, 'io']];
  const listenTracks = (amp) => [
    ['BodyLean', 'y', [[0, -12, 'io'], [240, -12, 'io']]], ['BodyLean', 'rotation', [[0, 0.025, 'io'], [240, 0.025, 'io']]],
    ['HeadAim', 'y', nod(amp)], ['HeadAim', 'rotation', [[0, 0.05, 'io'], [120, 0.07, 'io'], [240, 0.05, 'io']]],
    ['BrowL', 'y', [[0, -9, 'io'], [240, -9, 'io']]], ['BrowR', 'y', [[0, -9, 'io'], [240, -9, 'io']]],
    ['EyeL', 'scaleY', [[0, 1.05, 'io'], [240, 1.05, 'io']]], ['EyeR', 'scaleY', [[0, 1.05, 'io'], [240, 1.05, 'io']]],
  ];
  anim('listen_a', 240, 'loop', listenTracks(3));
  anim('listen_b', 240, 'loop', listenTracks(15));
  anim('think_loop', 240, 'loop', [
    ['GazeL', 'x', [[0, -9, 'io'], [240, -9, 'io']]], ['GazeR', 'x', [[0, -9, 'io'], [240, -9, 'io']]], ['GazeL', 'y', [[0, -13, 'io'], [240, -13, 'io']]], ['GazeR', 'y', [[0, -13, 'io'], [240, -13, 'io']]],
    ['HeadAim', 'rotation', [[0, -0.06, 'io'], [120, -0.085, 'io'], [240, -0.06, 'io']]], ['BrowR', 'y', [[0, -12, 'io'], [240, -12, 'io']]], ['MouthRig', 'scaleX', [[0, 0.86, 'io'], [60, 0.8, 'io'], [120, 0.86, 'io'], [180, 0.8, 'io'], [240, 0.86, 'io']]],
    ['BodyLean', 'rotation', [[0, -0.01, 'io'], [240, -0.01, 'io']]],
  ]);
  anim('talk_beats', 216, 'loop', [
    ['HeadAim', 'rotation', [[0, 0, 'io'], [30, 0.025, 'io'], [66, -0.015, 'io'], [108, 0.03, 'io'], [150, -0.02, 'io'], [190, 0.012, 'io'], [216, 0, 'io']]],
    ['HeadAim', 'y', [[0, 0, 'io'], [30, 5, 'io'], [66, 0, 'io'], [108, 6, 'io'], [150, 0, 'io'], [190, 4, 'io'], [216, 0, 'io']]],
    ['ElbowL', 'rotation', [[0, R['ElbowL.rotation'], 'io'], [60, R['ElbowL.rotation'] - 0.1, 'io'], [130, R['ElbowL.rotation'] + 0.06, 'io'], [216, R['ElbowL.rotation'], 'io']]],
    ['ElbowR', 'rotation', [[0, R['ElbowR.rotation'], 'io'], [80, R['ElbowR.rotation'] + 0.1, 'io'], [150, R['ElbowR.rotation'] - 0.06, 'io'], [216, R['ElbowR.rotation'], 'io']]],
    ['WristL', 'rotation', [[0, R['WristL.rotation'], 'io'], [60, R['WristL.rotation'] + 0.2, 'io'], [130, R['WristL.rotation'] - 0.1, 'io'], [216, R['WristL.rotation'], 'io']]],
    ['WristR', 'rotation', [[0, R['WristR.rotation'], 'io'], [80, R['WristR.rotation'] - 0.2, 'io'], [150, R['WristR.rotation'] + 0.1, 'io'], [216, R['WristR.rotation'], 'io']]],
  ]);

  faceStyleAnims();
  // variants: 1-frame holds that select the Solo children
  HAIR.forEach((h) => anim(`hair_${h}`, 1, 'oneShot', [['HairBackSolo', 'activeComponentId', [[0, ID(`hb_${h}`)]]], ['HairFrontSolo', 'activeComponentId', [[0, ID(`hf_${h}`)]]]]));
  OUTFIT.forEach((o) => anim(`outfit_${o}`, 1, 'oneShot', [['OutfitSolo', 'activeComponentId', [[0, ID(`of_${o === 'blouse_stripe' ? 'blouse' : o}`)]]], ['EarSolo', 'activeComponentId', [[0, ID(o === 'blouse_stripe' ? 'ear_hoops' : 'ear_studs')]]]]));
  PROP.forEach((p) => anim(`prop_${p}`, 1, 'oneShot', [['HandPropSolo', 'activeComponentId', [[0, ID(p === 'tea_cup' ? 'hp_tea' : p === 'clipboard' ? 'hp_clip' : p === 'stethoscope' ? 'hp_steth' : `hp_${p}`)]]], ['NeckPropSolo', 'activeComponentId', [[0, ID(`np_${p}`)]]]]));
  anim('steam', 180, 'loop', [['Steam', 'y', [[0, 0, 'io'], [90, -12, 'io'], [180, 0, 'io']]], ['Steam', 'opacity', [[0, 0.5, 'io'], [90, 1, 'io'], [180, 0.5, 'io']]]]);

  // gestures (normal + reduced motion)
  for (const g of Object.values(G)) { g.id = g.make(false); g.idRm = g.make(true); }

  // ---------------- events ----------------
  const ev = (n, prop) => `<Event name="${n}" id="${ID(n)}"><CustomPropertyString propertyValue="" name="${prop}" id="${ID(`${n}.${prop}`)}"/></Event>`;
  const events = ev('gestureStart', 'gesture') + ev('gesturePeak', 'gesture') + ev('gestureEnd', 'gesture') + ev('traceStart', 'toneShape') + ev('traceEnd', 'toneShape');

  let layers = '';
  // Base idle: alternate idle_a / idle_b
  const sa = nid(), sb = nid();
  layers += layer('Base', `<AnyState x="0" y="-150"/><EntryState><StateTransition stateToId="${sa}"/></EntryState>` +
    `<AnimationState x="220" animationId="${anims.idle_a}" id="${sa}">${exit100(sb, 700)}</AnimationState><AnimationState x="480" animationId="${anims.idle_b}" id="${sb}">${exit100(sa, 700)}</AnimationState>`);
  layers += loopLayer('Saccade', anims.saccade) + loopLayer('Blink', anims.blink);

  // Face (mood x intensity)
  const moodNames = contract.enums.Mood;
  const ms = moodNames.map(() => nid());
  layers += layer('Face', `<AnyState x="0" y="-150">${moodNames.map((m, i) => trans(ms[i], 120, cEnum('mood', 'Mood', m))).join('')}</AnyState>` +
    `<EntryState><StateTransition stateToId="${ms[1]}"/></EntryState>` +
    moodNames.map((m, i) => `<BlendState1DViewModel x="${220 + (i % 4) * 240}" y="${Math.floor(i / 4) * 140}" id="${ms[i]}"><BindablePropertyNumber><DataBindContext sourcePathIds="@@moodIntensity" propertyKey="636"/></BindablePropertyNumber>` +
      `<BlendAnimation1D animationId="${anims.mood_neutral}" value="0"/><BlendAnimation1D animationId="${anims['mood_' + m]}" value="100"/></BlendState1DViewModel>`).join(''));

  // Attention: listening / thinking
  const sEmpty = nid(), sListen = nid(), sThink = nid();
  layers += layer('Attention', `<AnyState x="0" y="-150">${trans(sListen, 250, cBool('listening', true))}${trans(sThink, 250, cBool('thinking', true) + cBool('listening', false))}</AnyState>` +
    `<EntryState><StateTransition stateToId="${sEmpty}"/></EntryState>` +
    `<AnimationState x="220" y="0" id="${sEmpty}"/>` +
    `<BlendState1DViewModel x="460" y="0" id="${sListen}"><BindablePropertyNumber><DataBindContext sourcePathIds="@@voiceLevel" propertyKey="636"/></BindablePropertyNumber><BlendAnimation1D animationId="${anims.listen_a}" value="0"/><BlendAnimation1D animationId="${anims.listen_b}" value="100"/>` +
    `<BlendStateTransition stateToId="${sEmpty}" duration="300">${cBool('listening', false)}</BlendStateTransition></BlendState1DViewModel>` +
    `<AnimationState x="460" y="140" animationId="${anims.think_loop}" id="${sThink}">${trans(sEmpty, 300, cBool('thinking', false))}</AnimationState>`);

  // Talk beats
  const tEmpty = nid(), tTalk = nid();
  layers += layer('TalkBeats', `<AnyState x="0" y="-150">${trans(tTalk, 250, cBool('speaking', true))}</AnyState><EntryState><StateTransition stateToId="${tEmpty}"/></EntryState>` +
    `<AnimationState x="220" id="${tEmpty}"/><AnimationState x="460" animationId="${anims.talk_beats}" id="${tTalk}">${trans(tEmpty, 250, cBool('speaking', false))}</AnimationState>`);

  // Mouth visemes
  const vs = vnames.map(() => nid());
  layers += layer('Mouth', `<AnyState x="0" y="-150">${vs.map((s, i) => trans(s, 30, cNum('viseme', 'equal', i))).join('')}</AnyState>` +
    `<EntryState><StateTransition stateToId="${vs[0]}"/></EntryState>` +
    vs.map((s, i) => `<AnimationState x="${220 + (i % 3) * 220}" y="${Math.floor(i / 3) * 120}" animationId="${anims['viseme_' + i]}" id="${s}"/>`).join(''));

  // Gesture layer
  const gEmpty = nid();
  const gNames = Object.keys(G);
  const gStates = Object.fromEntries(gNames.flatMap((n) => [[n, nid()], [n + '_rm', nid()]]));
  const gTransitions = [];
  const enumOf = (n) => (n.startsWith('trace_') ? 'trace_tone' : n.startsWith('count_') ? 'count' : n);
  for (const n of gNames) {
    for (const rm of [false, true]) {
      let c = cTrig('playGesture') + cEnum('gesture', 'Gesture', enumOf(n)) + cBool('reducedMotion', rm);
      if (n.startsWith('trace_')) c += cEnum('toneShape', 'ToneShape', n.slice(6));
      if (n.startsWith('count_')) c += cNum('countTo', 'equal', n.slice(6));
      gTransitions.push(trans(gStates[n + (rm ? '_rm' : '')], 150, c, ' enableEarlyExit="true"'));
    }
  }
  gTransitions.push(trans(gEmpty, 150, cTrig('playGesture') + cEnum('gesture', 'Gesture', 'idle')));
  let gx = 0;
  layers += layer('Gesture', `<AnyState x="0" y="-150">${gTransitions.join('')}</AnyState><EntryState><StateTransition stateToId="${gEmpty}"/></EntryState><AnimationState x="220" y="0" id="${gEmpty}"/>` +
    gNames.map((n) => [false, true].map((rm) => { const g = G[n]; return `<AnimationState x="${440 + (gx++ % 8) * 200}" y="${Math.floor(gx / 8) * 130}" animationId="${rm ? g.idRm : g.id}" id="${gStates[n + (rm ? '_rm' : '')]}">${exit100(gEmpty, 180)}</AnimationState>`; }).join('')).join(''));

  const enumLayer = (name, enumName, values, prefix) => {
    const st = values.map(() => nid());
    return layer(name, `<AnyState x="0" y="-150">${values.map((v, i) => trans(st[i], 0, cEnum(name === 'Prop' ? 'prop' : name === 'Hair' ? 'hairStyle' : name === 'FaceStyle' ? 'faceStyle' : 'outfitStyle', enumName, v))).join('')}</AnyState>` +
      `<EntryState><StateTransition stateToId="${st[0]}"/></EntryState>` + values.map((v, i) => `<AnimationState x="${220 + (i % 4) * 220}" y="${Math.floor(i / 4) * 120}" animationId="${anims[prefix + v]}" id="${st[i]}"/>`).join(''));
  };
  layers += enumLayer('FaceStyle', 'FaceStyle', FACE_STYLES, 'face_') + enumLayer('Hair', 'HairStyle', HAIR, 'hair_') + enumLayer('Outfit', 'OutfitStyle', OUTFIT, 'outfit_') + enumLayer('Prop', 'Prop', PROP, 'prop_') + loopLayer('Steam', anims.steam);

  const smId = ID('TeacherSM');
  const sm = `<StateMachine name="TeacherSM" id="${smId}">${layers}</StateMachine>`;

  // look joystick (lookX/lookY -> x/y in -1..1) + converters
  const convX = ID('conv_lookX'), convY = ID('conv_lookY');
  const joystick = `<Joystick posX="0" posY="0" width="100" height="100" xId="${anims.look_x}" yId="${anims.look_y}" name="Look" id="${ID('Joystick')}">` +
    `<DataBindContext sourcePathIds="@@lookX" propertyKey="299" converterId="${convX}"/><DataBindContext sourcePathIds="@@lookY" propertyKey="300" converterId="${convY}"/></Joystick>`;
  const roots = `<DataConverterRangeMapper minInput="-100" maxInput="100" minOutput="-1" maxOutput="1" clampLower="true" clampUpper="true" name="LookXMap" id="${convX}"/>` +
    `<DataConverterRangeMapper minInput="-100" maxInput="100" minOutput="1" maxOutput="-1" clampLower="true" clampUpper="true" name="LookYMap" id="${convY}"/>`;

  return { sm, smId, animations: animXml.join(''), events, joystick, roots, gestureNames: gNames };
}

// ---------------------------------------------------------------------------------------------
// TeacherBust: head-and-shoulders artboard. Same VM, reduced behaviour set (BustSM).
// ---------------------------------------------------------------------------------------------
export function buildBustAnimations() {
  setNs('b_');
  const mark = animXml.length;
  const A = (n) => anims['b_' + n];

  anim('idle', 300, 'loop', [
    ['BustRoot', 'scaleY', [[0, 0.54, 'io'], [150, 0.5465, 'io'], [300, 0.54, 'io']]],
    ['Head', 'rotation', [[0, 0.008, 'io'], [110, -0.012, 'io'], [210, 0.012, 'io'], [300, 0.008, 'io']]],
  ]);
  const BL = 144;
  const blinkAt = (t) => [[t - 4, 0, 'o'], [t + 3, BL, 'o'], [t + 5, BL, 'i'], [t + 11, 0, 'io']];
  const lid = [[0, 0, 'h'], ...blinkAt(130), ...blinkAt(310), ...blinkAt(336), ...blinkAt(520), [600, 0, 'h']];
  anim('blink', 600, 'loop', [['LidL', 'y', lid], ['LidR', 'y', lid]]);
  const sac = (a, b) => [[0, 0, 'h'], [70, a, 'h'], [150, b, 'h'], [230, -a, 'h'], [340, 0, 'h'], [400, b * 0.5, 'h'], [520, 0, 'h'], [600, 0, 'h']];
  anim('saccade', 600, 'loop', [['GazeL', 'x', sac(2.5, -2)], ['GazeR', 'x', sac(2.5, -2)], ['GazeL', 'y', sac(-1.5, 1.5)], ['GazeR', 'y', sac(-1.5, 1.5)]]);
  const vnames = ['v0_rest', 'v1_AA', 'v2_EH', 'v3_EE', 'v4_OH', 'v5_OO', 'v6_MBP', 'v7_FV', 'v8_CONS'];
  vnames.forEach((n, i) => anim(`viseme_${i}`, 1, 'oneShot', FACE_STYLES.map((st) => [`MouthSolo_${st}`, 'activeComponentId', [[0, ID(`${n}_${st}`)]]])));
  anim('look_x', 100, 'oneShot', [['IrisL', 'x', [[0, -17, 'l'], [50, 0, 'l'], [100, 17, 'l']]], ['IrisR', 'x', [[0, -17, 'l'], [50, 0, 'l'], [100, 17, 'l']]], ['HeadAim', 'x', [[0, -9, 'l'], [50, 0, 'l'], [100, 9, 'l']]]]);
  anim('look_y', 100, 'oneShot', [['IrisL', 'y', [[0, -16, 'l'], [50, 0, 'l'], [100, 16, 'l']]], ['IrisR', 'y', [[0, -16, 'l'], [50, 0, 'l'], [100, 16, 'l']]], ['HeadAim', 'y', [[0, -8, 'l'], [50, 0, 'l'], [100, 8, 'l']]]]);
  Object.keys(MOODS).forEach(moodAnim);
  faceStyleAnims();
  const nod = (amp) => [[0, 0, 'io'], [30, amp, 'io'], [60, 0, 'io'], [96, amp * 0.7, 'io'], [130, 0, 'io'], [168, amp, 'io'], [200, 0, 'io'], [240, 0, 'io']];
  const lt = (amp) => [['HeadAim', 'y', nod(amp)], ['HeadAim', 'rotation', [[0, 0.05, 'io'], [120, 0.07, 'io'], [240, 0.05, 'io']]], ['BrowL', 'y', [[0, -9, 'io'], [240, -9, 'io']]], ['BrowR', 'y', [[0, -9, 'io'], [240, -9, 'io']]], ['EyeL', 'scaleY', [[0, 1.05, 'io'], [240, 1.05, 'io']]], ['EyeR', 'scaleY', [[0, 1.05, 'io'], [240, 1.05, 'io']]]];
  anim('listen_a', 240, 'loop', lt(3)); anim('listen_b', 240, 'loop', lt(15));
  anim('talk', 216, 'loop', [['HeadAim', 'rotation', [[0, 0, 'io'], [30, 0.025, 'io'], [66, -0.015, 'io'], [108, 0.03, 'io'], [150, -0.02, 'io'], [190, 0.012, 'io'], [216, 0, 'io']]], ['HeadAim', 'y', [[0, 0, 'io'], [30, 5, 'io'], [66, 0, 'io'], [108, 6, 'io'], [150, 0, 'io'], [190, 4, 'io'], [216, 0, 'io']]]]);
  HAIR.forEach((h) => anim(`hair_${h}`, 1, 'oneShot', [['HairBackSolo', 'activeComponentId', [[0, ID(`hb_${h}`)]]], ['HairFrontSolo', 'activeComponentId', [[0, ID(`hf_${h}`)]]]]));
  OUTFIT.forEach((o) => anim(`outfit_${o}`, 1, 'oneShot', [['OutfitSolo', 'activeComponentId', [[0, ID(`of_${o === 'blouse_stripe' ? 'blouse' : o}`)]]], ['EarSolo', 'activeComponentId', [[0, ID(o === 'blouse_stripe' ? 'ear_hoops' : 'ear_studs')]]], ['NeckPropSolo', 'activeComponentId', [[0, ID(o === 'scrubs' ? 'np_stethoscope' : 'np_none')]]]]));

  // state machine
  let layers = '';
  const sIdle = nid(), sStill = nid();
  layers += layer('Base', `<AnyState x="0" y="-150"/><EntryState><StateTransition stateToId="${sIdle}"/></EntryState>` +
    `<AnimationState x="220" animationId="${A('idle')}" id="${sIdle}">${trans(sStill, 200, cBool('reducedMotion', true))}</AnimationState><AnimationState x="460" id="${sStill}">${trans(sIdle, 200, cBool('reducedMotion', false))}</AnimationState>`);
  layers += loopLayer('Saccade', A('saccade')) + loopLayer('Blink', A('blink'));
  const moodNames = contract.enums.Mood, ms = moodNames.map(() => nid());
  layers += layer('Face', `<AnyState x="0" y="-150">${moodNames.map((m, i) => trans(ms[i], 120, cEnum('mood', 'Mood', m))).join('')}</AnyState><EntryState><StateTransition stateToId="${ms[1]}"/></EntryState>` +
    moodNames.map((m, i) => `<BlendState1DViewModel x="${220 + (i % 4) * 240}" y="${Math.floor(i / 4) * 140}" id="${ms[i]}"><BindablePropertyNumber><DataBindContext sourcePathIds="@@moodIntensity" propertyKey="636"/></BindablePropertyNumber><BlendAnimation1D animationId="${A('mood_neutral')}" value="0"/><BlendAnimation1D animationId="${A('mood_' + m)}" value="100"/></BlendState1DViewModel>`).join(''));
  const sE = nid(), sL = nid();
  layers += layer('Attention', `<AnyState x="0" y="-150">${trans(sL, 250, cBool('listening', true))}</AnyState><EntryState><StateTransition stateToId="${sE}"/></EntryState><AnimationState x="220" id="${sE}"/>` +
    `<BlendState1DViewModel x="460" id="${sL}"><BindablePropertyNumber><DataBindContext sourcePathIds="@@voiceLevel" propertyKey="636"/></BindablePropertyNumber><BlendAnimation1D animationId="${A('listen_a')}" value="0"/><BlendAnimation1D animationId="${A('listen_b')}" value="100"/><BlendStateTransition stateToId="${sE}" duration="300">${cBool('listening', false)}</BlendStateTransition></BlendState1DViewModel>`);
  const tE = nid(), tT = nid();
  layers += layer('TalkBeats', `<AnyState x="0" y="-150">${trans(tT, 250, cBool('speaking', true))}</AnyState><EntryState><StateTransition stateToId="${tE}"/></EntryState><AnimationState x="220" id="${tE}"/><AnimationState x="460" animationId="${A('talk')}" id="${tT}">${trans(tE, 250, cBool('speaking', false))}</AnimationState>`);
  const vs = vnames.map(() => nid());
  layers += layer('Mouth', `<AnyState x="0" y="-150">${vs.map((s, i) => trans(s, 30, cNum('viseme', 'equal', i))).join('')}</AnyState><EntryState><StateTransition stateToId="${vs[0]}"/></EntryState>` +
    vs.map((s, i) => `<AnimationState x="${220 + (i % 3) * 220}" y="${Math.floor(i / 3) * 120}" animationId="${A('viseme_' + i)}" id="${s}"/>`).join(''));
  const enumLayer = (name, prop, enumName, values, prefix) => { const st = values.map(() => nid()); return layer(name, `<AnyState x="0" y="-150">${values.map((v, i) => trans(st[i], 0, cEnum(prop, enumName, v))).join('')}</AnyState><EntryState><StateTransition stateToId="${st[0]}"/></EntryState>` + values.map((v, i) => `<AnimationState x="${220 + (i % 4) * 220}" y="${Math.floor(i / 4) * 120}" animationId="${A(prefix + v)}" id="${st[i]}"/>`).join('')); };
  layers += enumLayer('FaceStyle', 'faceStyle', 'FaceStyle', FACE_STYLES, 'face_') + enumLayer('Hair', 'hairStyle', 'HairStyle', HAIR, 'hair_') + enumLayer('Outfit', 'outfitStyle', 'OutfitStyle', OUTFIT, 'outfit_');
  const smId = ID('BustSM');
  const sm = `<StateMachine name="BustSM" id="${smId}">${layers}</StateMachine>`;
  const cx = ID('conv_lookX'), cy = ID('conv_lookY');
  const joystick = `<Joystick posX="0" posY="0" width="100" height="100" xId="${A('look_x')}" yId="${A('look_y')}" name="Look" id="${ID('Joystick')}"><DataBindContext sourcePathIds="@@lookX" propertyKey="299" converterId="${cx}"/><DataBindContext sourcePathIds="@@lookY" propertyKey="300" converterId="${cy}"/></Joystick>`;
  const roots = `<DataConverterRangeMapper minInput="-100" maxInput="100" minOutput="-1" maxOutput="1" clampLower="true" clampUpper="true" name="BustLookXMap" id="${cx}"/><DataConverterRangeMapper minInput="-100" maxInput="100" minOutput="1" maxOutput="-1" clampLower="true" clampUpper="true" name="BustLookYMap" id="${cy}"/>`;
  const xml = animXml.splice(mark).join('');
  setNs('');
  return { sm, smId, animations: xml, joystick, roots };
}
