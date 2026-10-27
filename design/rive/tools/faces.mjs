// Face styles (contract enum FaceStyle): each swaps face shape, nose, lips, eye form, lashes, brows
// (and a beard for Tinashe). Lín keeps the original features; the others are distinct, natural
// proportions, not caricatures.
import { blob, ellipse, argb, ID } from './lib.mjs';

export const FACE_STYLES = ['lin', 'sofia', 'camille', 'tendai', 'tinashe'];
const SHADE = '2A0F2E', INK = '1B1020';
const hairC = () => ({ solid: argb('2A2230'), bind: 'hairColor' });

export const FS = {
  lin:     { mw: 1.0,  lip: 1.0,  eye: { sx: 1.0,  sy: 1.0,  rot: 0 } },
  sofia:   { mw: 1.06, lip: 1.28, eye: { sx: 1.04, sy: 0.97, rot: 0.02 } },
  camille: { mw: 1.0,  lip: 1.12, eye: { sx: 1.06, sy: 0.92, rot: 0.07 } },
  tendai:  { mw: 1.1,  lip: 1.32, eye: { sx: 1.03, sy: 1.0,  rot: 0 } },
  tinashe: { mw: 1.08, lip: 1.2,  eye: { sx: 0.94, sy: 0.9,  rot: 0 } },
};

// face outlines (absolute coordinates)
export const FACE_PTS = {
  lin: [[600, 250], [722, 262], [812, 332], [864, 432], [872, 544], [850, 652], [792, 752], [700, 818], [600, 838], [500, 818], [408, 752], [350, 652], [328, 544], [336, 432], [388, 332], [478, 262]],
  sofia: [[600, 246], [724, 258], [816, 330], [870, 434], [880, 548], [860, 664], [800, 764], [704, 826], [600, 846], [496, 826], [400, 764], [340, 664], [320, 548], [330, 434], [384, 330], [476, 258]],
  camille: [[600, 248], [716, 262], [804, 334], [856, 432], [862, 540], [834, 646], [770, 744], [686, 816], [600, 840], [514, 816], [430, 744], [366, 646], [338, 540], [344, 432], [396, 334], [484, 262]],
  tendai: [[600, 252], [726, 262], [818, 334], [872, 436], [880, 548], [858, 660], [798, 760], [704, 824], [600, 842], [496, 824], [402, 760], [342, 660], [320, 548], [328, 436], [382, 334], [474, 262]],
  tinashe: [[600, 248], [722, 258], [814, 326], [868, 426], [878, 536], [866, 640], [842, 736], [790, 800], [700, 838], [600, 846], [500, 838], [410, 800], [358, 736], [334, 640], [322, 536], [332, 426], [386, 326], [478, 258]],
};

// nose: tip size and the span/weight of the nostril wings
const NOSE = {
  sofia: { rx: 22, ry: 15, ww: 46, tw: 6 },
  camille: { rx: 19, ry: 13, ww: 40, tw: 5.5 },
  tendai: { rx: 24, ry: 16, ww: 52, tw: 6.5 },
  tinashe: { rx: 25, ry: 16, ww: 54, tw: 7 },
};
export function noseVariant(style, linNose) {
  if (style === 'lin') return linNose;
  const n = NOSE[style], cx = 600, y = 632;
  return ellipse({ name: 'NoseHi', cx: 598, cy: y, rx: n.rx, ry: n.ry, fills: [{ radial: { cx: 596, cy: y - 2, r: n.rx + 6, stops: [[0, argb('FFFFFF', 0.5)], [1, argb('FFFFFF', 0)]] } }] }) +
    blob({ name: 'NoseShade', pts: [[612, 590], [634, 624], [632, 650], [604, 658], [608, 628]], fills: [{ radial: { cx: 620, cy: 630, r: 38, stops: [[0, argb('3A1A12', 0.45)], [1, argb('3A1A12', 0)]] } }] }) +
    [-1, 1].map((s) => blob({ name: 'NoseWing', pts: [[cx + s * n.ww, 634], [cx + s * (n.ww - 6), 652], [cx + s * (n.ww - 24), 660]], closed: false, strokes: [{ w: n.tw, solid: argb('3A1A12', 0.5) }] }) +
      ellipse({ name: 'Nostril', cx: cx + s * n.ww * 0.5, cy: 656, rx: 9, ry: 5, fills: [{ solid: argb('2A100A', 0.4) }] })).join('');
}

// lashes: stroke weight and the outer flick
const LASH = { lin: { w: 11, wing: [14, 12, 22, 26] }, sofia: { w: 12, wing: [16, 14, 28, 30] }, camille: { w: 10, wing: [16, 12, 30, 36] }, tendai: { w: 12, wing: [12, 10, 20, 22] }, tinashe: null };
export function lashVariant(style, side) {
  const l = LASH[style];
  if (!l) return '';
  const s = side === 'L' ? -1 : 1, cx = 600 + s * 98, cy = 548;
  const pts = s < 0
    ? [[cx - 62, cy - 14], [cx - 52, cy - 46], [cx - 24, cy - 66], [cx + 12, cy - 72], [cx + 46, cy - 56], [cx + 62, cy - 30]]
    : [[cx - 62, cy - 30], [cx - 46, cy - 56], [cx - 12, cy - 72], [cx + 24, cy - 66], [cx + 52, cy - 46], [cx + 62, cy - 14]];
  const [a, b, c, d] = l.wing;
  const wing = s < 0 ? [[cx - 62, cy - 14], [cx - 62 - a, cy - 14 - b], [cx - 62 - c, cy - 14 - d]] : [[cx + 62, cy - 14], [cx + 62 + a, cy - 14 - b], [cx + 62 + c, cy - 14 - d]];
  return blob({ name: `Lash${side}`, pts, closed: false, strokes: [{ w: l.w, solid: argb(INK) }] }) + blob({ name: `Wing${side}`, pts: wing, closed: false, strokes: [{ w: l.w - 3, solid: argb(INK) }] });
}

// brows: offsets from the brow centre for the left brow (mirrored for the right), stroke width
const BROW = {
  lin: { pts: [[-56, 10], [-20, -8], [28, -12], [56, 2]], w: 24 },
  sofia: { pts: [[-58, 12], [-24, -8], [24, -14], [58, 4]], w: 26 },
  camille: { pts: [[-58, 14], [-26, -14], [16, -20], [58, -2]], w: 20 },
  tendai: { pts: [[-58, 6], [-24, -4], [24, -6], [58, 2]], w: 26 },
  tinashe: { pts: [[-60, 8], [-24, -4], [26, -8], [60, 0]], w: 32 },
};
export function browVariant(style, side) {
  const s = side === 'L' ? -1 : 1, cx = 600 + s * 100, cy = 452;
  const b = BROW[style];
  const pts = (s < 0 ? b.pts : b.pts.map(([x, y]) => [-x, y]).reverse()).map(([x, y]) => [cx + x, cy + y]);
  return blob({ name: 'BrowBound', pts, closed: false, strokes: [{ w: b.w, solid: argb('2A2230'), bind: 'hairColor' }] }) +
    blob({ name: 'BrowHi', pts: pts.map(([x, y]) => [x - 3, y - 5]), closed: false, strokes: [{ w: 6, solid: argb('FFFFFF', 0.2) }] });
}

// short beard + moustache for Tinashe (sits above the face, below mouth/nose in z-order)
export function beard() {
  const jaw = [[352, 600], [350, 690], [378, 760], [430, 810], [500, 838], [600, 848], [700, 838], [770, 810], [822, 760], [850, 690], [848, 600], [816, 650], [790, 716], [740, 764], [670, 786], [600, 790], [530, 786], [460, 764], [410, 716], [384, 650]];
  const must = [[548, 664], [576, 657], [600, 660], [624, 657], [652, 664], [628, 673], [600, 669], [572, 673]];
  const fill = [hairC(), { radial: { cx: 560, cy: 740, r: 300, stops: [[0.5, argb('12081C', 0)], [1, argb('12081C', 0.5)]] } }, { linear: { x1: 440, y1: 700, x2: 480, y2: 760, stops: [[0, argb('FFF2DC', 0.12)], [1, argb('FFF2DC', 0)]] } }];
  return blob({ name: 'Moustache', pts: must, fills: fill }) + blob({ name: 'Beard', pts: jaw, fills: fill });
}
