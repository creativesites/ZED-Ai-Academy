// Arms + hands. FK chain: Shoulder -> Elbow -> Wrist -> Hand(Solo of poses). Rest pose is
// straight down; the idle/gesture animations pose the chain.
import { blob, ellipse, rrect, group, volume, cylinder, argb, nid, ID, f, O, rel, pushOrigin, popOrigin } from './lib.mjs';

const SHADE = '2A0F2E', WARM = 'FFC47A';
const skin = () => ({ solid: argb('E8B48F'), bind: 'skinColor' });
const outfit = () => ({ solid: argb('2FA37F'), bind: 'outfitPrimary' });
const outfit2 = () => ({ solid: argb('FFF4E2'), bind: 'outfitSecondary' });

export const SHOULDER = { L: [262, 1048], R: [938, 1048] };
export const WRIST = { L: [262, 1048 + 262 + 238], R: [938, 1048 + 262 + 238] };
export const UPPER = 262, FORE = 238, TIP = 178;   // TIP = wrist -> fingertip when pointing

// Hand shape builders. Local origin = wrist, +y toward fingertips. s = +1 thumb toward +x.
function capsule(x, y, w, h, rot = 0, r = w / 2) {
  // Rectangle origin at top-centre so it extends downward from (x,y), rotated about its top.
  return `<Rectangle x="${f(x)}" y="${f(y)}" width="${f(w)}" height="${f(h)}" originX="0.5" originY="0" cornerRadiusTL="${f(r)}" rotation="${f(rot)}" name="Finger"/>`;
}
function handShape(name, s, geoms, extraFills = [], strokes = []) {
  const shading = [
    ...volume(0, 62, 86, { shadow: 0.5, hi: 0.3, bounce: 0.2, rim: 0.5, tint: '5A2030' }),
    { linear: { x1: 0, y1: 0, x2: 0, y2: 26, stops: [[0, argb(SHADE, 0.35)], [1, argb(SHADE, 0)]] } },
    ...extraFills,
  ];
  const paint = (spec) => {
    // inline (local coordinate) paint emit
    const col = spec.solid
      ? `<SolidColor colorValue="${spec.solid}">${spec.bind ? `<DataBindContext sourcePathIds="@@${spec.bind}" propertyKey="37"/>` : ''}</SolidColor>`
      : spec.radial
        ? `<RadialGradient startX="${f(spec.radial.cx)}" startY="${f(spec.radial.cy)}" endX="${f(spec.radial.cx + spec.radial.r)}" endY="${f(spec.radial.cy)}">${spec.radial.stops.map(([p, c]) => `<GradientStop colorValue="${c}" position="${p}"/>`).join('')}</RadialGradient>`
        : `<LinearGradient startX="${f(spec.linear.x1)}" startY="${f(spec.linear.y1)}" endX="${f(spec.linear.x2)}" endY="${f(spec.linear.y2)}">${spec.linear.stops.map(([p, c]) => `<GradientStop colorValue="${c}" position="${p}"/>`).join('')}</LinearGradient>`;
    return `<Fill>${col}</Fill>`;
  };
  return `<Shape name="${name}">${geoms}${[skin(), ...shading].map(paint).join('')}${strokes.join('')}</Shape>`;
}

export function handOpen(s) {
  const geoms =
    `<Ellipse x="0" y="58" width="108" height="124" originX="0.5" originY="0.5" name="Palm"/>` +
    capsule(-s * 38, 82, 26, 60, s * 0.08) + capsule(-s * 13, 90, 27, 76, s * 0.02) + capsule(s * 13, 90, 27, 72, -s * 0.03) + capsule(s * 37, 82, 25, 56, -s * 0.1) +
    // thumb sweeping toward the body
    capsule(s * 42, 38, 30, 66, -s * 0.85);
  const grooves = [-0.5, 0.5, 1.5].map((i) => `<Shape name="Groove"><PointsPath isClosed="false"><StraightVertex x="${f(s * (-25 + i * 25 + 12.5) * 1)}" y="104"/><StraightVertex x="${f(s * (-25 + i * 25 + 12.5) * 1)}" y="140"/></PointsPath><Stroke thickness="4" cap="round"><SolidColor colorValue="${argb(SHADE, 0.25)}"/></Stroke></Shape>`);
  return handShape('HandOpen', s, geoms, [], []);
}

function ell(x, y, w, h, name = 'Knuckle') { return `<Ellipse x="${f(x)}" y="${f(y)}" width="${f(w)}" height="${f(h)}" originX="0.5" originY="0.5" name="${name}"/>`; }

export function handPoint(s) {
  const geoms = ell(0, 60, 110, 124, 'Palm') + capsule(s * 30, 76, 28, 104, s * 0.02) +
    ell(-s * 36, 112, 28, 40) + ell(-s * 12, 116, 28, 42) + ell(s * 8, 114, 26, 40) +
    capsule(s * 44, 40, 28, 60, -s * 0.9);
  return handShape('HandPoint', s, geoms);
}
export function handThumb(s) {
  const geoms = ell(0, 66, 112, 116, 'Palm') + ell(-s * 38, 118, 30, 40) + ell(-s * 14, 124, 30, 42) + ell(s * 10, 124, 30, 42) + ell(s * 34, 116, 28, 38) +
    capsule(s * 40, 40, 32, 86, Math.PI + s * 0.25);
  return handShape('HandThumb', s, geoms);
}
export function handFist(s) {
  const geoms = ell(0, 66, 112, 116, 'Palm') + ell(-s * 38, 118, 30, 40) + ell(-s * 14, 124, 30, 42) + ell(s * 10, 124, 30, 42) + ell(s * 34, 116, 28, 38) +
    capsule(s * 40, 44, 30, 62, -s * 1.1);
  return handShape('HandFist', s, geoms);
}
// n extended fingers (index first, then middle, ring, pinky; thumb joins at 5)
export function handCount(n, s) {
  const xs = [s * 46, s * 16, -s * 16, -s * 46];            // index, middle, ring, pinky (index nearest the thumb)
  const lens = [112, 126, 116, 92], rots = [s * -0.1, s * -0.03, s * 0.04, s * 0.11];
  let g = ell(0, 64, 118, 116, 'Palm'), grooves = '';
  for (let i = 0; i < 4; i++) g += i < n ? capsule(xs[i], 84, 28, lens[i] - 8, rots[i]) : ell(xs[i], 118 + (i % 2) * 4, 30, 40);
  for (let i = 0; i < 3; i++) if (i + 1 < n) {
    const gx = (xs[i] + xs[i + 1]) / 2;
    grooves += `<Shape name="Groove"><PointsPath isClosed="false"><StraightVertex x="${f(gx)}" y="96"/><StraightVertex x="${f(gx + (rots[i] + rots[i + 1]) * 40)}" y="${f(60 + Math.min(lens[i], lens[i + 1]) * 0.75)}"/></PointsPath><Stroke thickness="5" cap="round"><SolidColor colorValue="${argb('3A1A12', 0.34)}"/></Stroke></Shape>`;
  }
  g += n >= 5 ? capsule(s * 56, 44, 30, 72, -s * 1.0) : capsule(s * 30, 70, 30, 50, -s * 1.25);
  return grooves + handShape(`HandCount${n}`, s, g);
}
export const HAND_POSES = ['open', 'point', 'thumb', 'fist', 'count_1', 'count_2', 'count_3', 'count_4', 'count_5'];
function handPoses(side, s) {
  const mk = { open: handOpen, point: handPoint, thumb: handThumb, fist: handFist, count_1: (x) => handCount(1, x), count_2: (x) => handCount(2, x), count_3: (x) => handCount(3, x), count_4: (x) => handCount(4, x), count_5: (x) => handCount(5, x) };
  return `<Solo activeComponentId="${ID(`hand_open_${side}`)}" name="HandPose${side}" id="${ID(`HandSolo${side}`)}">` +
    HAND_POSES.map((p) => `<Node name="${p}" id="${ID(`hand_${p}_${side}`)}">${mk[p](s)}</Node>`).join('') + `</Solo>`;
}

export function arm(side, wristExtras = () => '') {
  const [sx, sy] = SHOULDER[side];
  const s = side === 'L' ? 1 : -1;          // thumb toward body centre
  const ex = sx, ey = sy + UPPER, wx = sx, wy = ey + FORE;
  const sleeveW = 134, foreW = 118;

  return group(`Shoulder${side}`, sx, sy, () => {
    const elbow = group(`Elbow${side}`, ex, ey, () => {
      // hand poses live in a wrist group; Solo picks the pose
      const hand = group(`Wrist${side}`, wx, wy, () => wristExtras() + handPoses(side, s), { id: ID(`Wrist${side}`) });
      const cuff = rrect({
        name: `Cuff${side}`, cx: wx, cy: wy - 6, w: foreW - 10, h: 44, r: 20,
        fills: [outfit2(), ...cylinder(wx, wy, (foreW - 10) / 2, { shadow: 0.45, hi: 0.2, rim: 0.4, tint: SHADE })],
      });
      const fore = rrect({
        name: `Forearm${side}`, cx: ex, cy: ey + FORE / 2 - 8, w: foreW, h: FORE + 30, r: foreW / 2,
        fills: [outfit(), ...cylinder(ex, ey + 100, foreW / 2, { shadow: 0.5, hi: 0.26, rim: 0.28, rimC: 'FFD9A8', tint: '0B2A28' }),
          { linear: { x1: ex, y1: ey - 20, x2: ex, y2: ey + 40, stops: [[0, argb(SHADE, 0.45)], [1, argb(SHADE, 0)]] } }],
      });
      return hand + cuff + fore;
    }, { id: ID(`Elbow${side}`) });
    const upper = rrect({
      name: `UpperArm${side}`, cx: sx, cy: sy + UPPER / 2 - 6, w: sleeveW, h: UPPER + 40, r: sleeveW / 2,
      fills: [outfit(), ...cylinder(sx, sy + 100, sleeveW / 2, { shadow: 0.5, hi: 0.26, rim: 0.28, rimC: 'FFD9A8', tint: '0B2A28' }),
        { radial: { cx: sx - 20 * s, cy: sy - 10, r: 90, stops: [[0, argb('FFFFFF', 0.22)], [1, argb('FFFFFF', 0)]] } }],
    });
    const dir = side === 'L' ? 1 : -1;
    const cast = rrect({
      name: `ArmShadow${side}`, cx: sx + 26 * dir, cy: sy + UPPER / 2 + 14, w: sleeveW + 90, h: UPPER + 60, r: sleeveW / 2 + 20,
      fills: [{ linear: { x1: sx - 70, y1: 0, x2: sx + 120 * dir, y2: 0, stops: dir > 0 ? [[0, argb(SHADE, 0)], [0.45, argb(SHADE, 0.3)], [1, argb(SHADE, 0)]] : [[0, argb(SHADE, 0)], [0.45, argb(SHADE, 0.3)], [1, argb(SHADE, 0)]] } }],
    });
    const cap = ellipse({ name: `ShoulderCap${side}`, cx: sx, cy: sy + 6, rx: 76, ry: 70, fills: [outfit(), ...volume(sx, sy + 6, 76, { shadow: 0.4, hi: 0.24, bounce: 0, rim: 0.26, rimC: 'FFD9A8', tint: '0B2A28' })] });
    return elbow + upper + cap + cast;
  }, { id: ID(`Shoulder${side}`) });
}

function handOpenXml(s) { return handOpen(s); }
