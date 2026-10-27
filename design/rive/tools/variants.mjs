// Hair / outfit / prop variants. Each family is a Solo whose active child is chosen by a 1-frame
// animation (see anim.mjs) so the enum values from the contract pick the shape set.
import { blob, ellipse, rrect, group, volume, cylinder, argb, nid, ID, f, rel } from './lib.mjs';
import { WRIST } from './arms.mjs';

const INK = '1B1020', SHADE = '2A0F2E';
const hair = () => ({ solid: argb('2A2230'), bind: 'hairColor' });
const skin = () => ({ solid: argb('E8B48F'), bind: 'skinColor' });
const skinShade = () => ({ solid: argb('C98D6A'), bind: 'skinShadeColor' });
const outfit = () => ({ solid: argb('2FA37F'), bind: 'outfitPrimary' });
const outfit2 = () => ({ solid: argb('FFF4E2'), bind: 'outfitSecondary' });
const accent = () => ({ solid: argb('FFB547'), bind: 'accentColor' });
const node = (name, id, inner) => `<Node name="${name}" id="${id}">${inner}</Node>`;
export const HAIR = ['bob', 'curly', 'bun', 'short', 'braids'];
export const OUTFIT = ['cardigan', 'blouse_stripe', 'blazer', 'scrubs'];
export const PROP = ['none', 'tea_cup', 'book', 'menu', 'croissant', 'clipboard', 'stethoscope'];

const hairVol = (cx, cy, r, o = {}) => volume(cx, cy, r, { shadow: 0.55, hi: o.hi ?? 0.12, bounce: 0.06, rim: 0.28, rimC: 'FFD9A8', tint: '12081C' });
const gloss = (pts, w = 22, a = 0.4) => blob({ name: 'Gloss', pts, closed: false, strokes: [{ w, linear: { x1: pts[0][0], y1: pts[0][1], x2: pts[pts.length - 1][0], y2: pts[pts.length - 1][1], stops: [[0, argb('FFF2DC', 0)], [0.5, argb('FFF2DC', a)], [1, argb('FFF2DC', 0)]] } }] });
const curl = (cx, cy, r) => ellipse({ name: 'Curl', cx, cy, rx: r, ry: r * 0.95, fills: [hair(), ...hairVol(cx, cy, r), { radial: { cx: cx - r * 0.3, cy: cy - r * 0.35, r: r * 0.5, stops: [[0, argb('FFF2DC', 0.28)], [1, argb('FFF2DC', 0)]] } }] });

// ---------------- hair: back layer (behind the face) ----------------
export function hairBackVariants(bobBack) {
  const out = [];
  out.push(node('bob', ID('hb_bob'), bobBack));
  // curly: halo of big curls
  const curls = [];
  for (let a = 150; a <= 390; a += 17) { const t = (a * Math.PI) / 180, R = 318 + (a % 34 === 0 ? 14 : 0); curls.push([600 + R * Math.cos(t), 520 - R * Math.sin(t) * 1.02, 98 + (a % 2) * 6]); }
  curls.push([286, 700, 92], [300, 810, 84], [914, 700, 92], [900, 810, 84], [350, 860, 74], [850, 860, 74]);
  out.push(node('curly', ID('hb_curly'), curls.sort((a, b) => a[1] - b[1]).reverse().map(([x, y, r]) => curl(x, y, r)).join('') +
    ellipse({ name: 'CurlCore', cx: 600, cy: 500, rx: 300, ry: 330, fills: [hair(), ...hairVol(600, 500, 330)] })));
  // bun: low cap + a natural-hair puff bun behind the shoulder
  out.push(node('bun', ID('hb_bun'),
    blob({ name: 'BunCap', pts: [[318, 640], [304, 480], [336, 340], [420, 240], [530, 180], [640, 170], [750, 200], [840, 270], [892, 380], [900, 520], [880, 650], [820, 780], [760, 820], [440, 820], [380, 780]], fills: [hair(), ...hairVol(600, 480, 340)] }) +
    [[800, 880, 70], [850, 840, 64], [760, 850, 62], [820, 800, 58], [870, 900, 56], [780, 920, 58]].map(([x, y, r]) => curl(x, y, r)).join('') +
    ellipse({ name: 'HairTie', cx: 742, cy: 820, rx: 24, ry: 16, fills: [accent()], rot: 0.4 })));
  // short natural hair: tight cap
  out.push(node('short', ID('hb_short'), blob({ name: 'ShortBack', pts: [[318, 560], [312, 440], [348, 340], [420, 262], [510, 210], [600, 194], [690, 210], [780, 262], [852, 340], [888, 440], [882, 560], [860, 520], [600, 330], [340, 520]], fills: [hair(), ...hairVol(600, 400, 330)] })));
  // braids: back filler
  out.push(node('braids', ID('hb_braids'), blob({ name: 'BraidBack', pts: [[316, 600], [308, 460], [346, 340], [420, 260], [520, 206], [600, 192], [680, 206], [780, 260], [854, 340], [892, 460], [884, 600], [800, 700], [400, 700]], fills: [hair(), ...hairVol(600, 440, 340)] })));
  return out.join('');
}

// ---------------- hair: front layer (over the face) ----------------
function plait(x, y0, side) {
  let s = '';
  for (let i = 9; i >= 0; i--) {
    const y = y0 + i * 54, x2 = x + side * Math.min(i, 8) * 2.5 + (i % 2 ? 10 : -10) * 0.5;
    s += ellipse({ name: 'Plait', cx: x2, cy: y, rx: 38 - i * 1.4, ry: 36 - i, rot: i % 2 ? 0.5 : -0.5, fills: [hair(), ...hairVol(x2, y, 38 - i * 1.4), { radial: { cx: x2 - 12, cy: y - 12, r: 22, stops: [[0, argb('FFF2DC', 0.26)], [1, argb('FFF2DC', 0)]] } }] });
  }
  s += ellipse({ name: 'PlaitTie', cx: x + side * 22, cy: y0 + 10 * 54, rx: 20, ry: 14, fills: [accent()] });
  return s;
}
export function hairFrontVariants(bobFront) {
  const out = [];
  out.push(node('bob', ID('hf_bob'), bobFront));
  // curly: curls along the hairline
  const fr = [];
  const arc = [[368, 520], [352, 440], [382, 366], [440, 306], [510, 270], [590, 256], [672, 262], [752, 290], [814, 340], [850, 410], [858, 500]];
  arc.forEach(([x, y], i) => fr.push(curl(x, y, 54 + (i % 3) * 8)));
  out.push(node('curly', ID('hf_curly'), fr.join('') + curl(330, 640, 64) + curl(870, 640, 64)));
  // bun: rounded cap with a textured (curl) hairline, ears free
  const bunArc = [[392, 470], [378, 400], [412, 338], [470, 296], [540, 270], [610, 262], [680, 270], [750, 296], [808, 340], [840, 404], [830, 470]];
  out.push(node('bun', ID('hf_bun'),
    blob({ name: 'BunFront', pts: [[322, 600], [306, 470], [338, 340], [420, 242], [530, 186], [650, 176], [770, 214], [850, 290], [890, 400], [880, 560], [856, 470], [816, 392], [752, 336], [690, 306], [620, 312], [540, 352], [466, 408], [410, 470], [372, 560], [352, 640]], fills: [hair(), ...hairVol(600, 380, 330)] }) +
    bunArc.map(([x, y], i) => curl(x, y, 40 + (i % 3) * 6)).join('') +
    gloss([[420, 290], [500, 226], [610, 200], [720, 214]], 26, 0.36)));
  // short: close-cropped cap
  out.push(node('short', ID('hf_short'), blob({ name: 'ShortFront', pts: [[320, 540], [316, 430], [352, 328], [422, 252], [512, 204], [602, 190], [692, 204], [782, 252], [852, 328], [888, 430], [884, 540], [860, 480], [822, 404], [764, 350], [690, 322], [602, 312], [514, 322], [440, 350], [382, 404], [344, 480]], fills: [hair(), ...hairVol(600, 360, 320)] }) +
    gloss([[420, 280], [510, 226], [610, 208], [700, 224]], 24, 0.34)));
  // braids: centre-parted cap + two plaits over the shoulders
  out.push(node('braids', ID('hf_braids'), plait(318, 640, -1) + plait(882, 640, 1) +
    blob({ name: 'BraidFront', pts: [[320, 600], [308, 460], [344, 340], [420, 258], [520, 204], [600, 190], [680, 204], [780, 258], [856, 340], [892, 460], [880, 600], [858, 500], [820, 410], [756, 352], [690, 326], [600, 306], [510, 326], [444, 352], [380, 410], [342, 500]], fills: [hair(), ...hairVol(600, 380, 330)] }) +
    blob({ name: 'Part', pts: [[600, 190], [600, 250], [600, 312]], closed: false, strokes: [{ w: 8, solid: argb(INK, 0.55) }] }) +
    gloss([[400, 290], [500, 232], [600, 214]], 22, 0.34) + gloss([[600, 214], [700, 232], [800, 290]], 22, 0.3)));
  return out.join('');
}

// ---------------- earrings ----------------
export function earringVariants(studs) {
  const hoop = (cx) => blob({ name: 'Hoop', pts: Array.from({ length: 12 }, (_, i) => { const t = (i / 12) * Math.PI * 2; return [cx + 26 * Math.cos(t), 700 + 34 * Math.sin(t)]; }), strokes: [{ w: 8, linear: { x1: cx - 26, y1: 680, x2: cx + 26, y2: 730, stops: [[0, argb('FFE9A0')], [1, argb('B8801A')]] } }] });
  return node('studs', ID('ear_studs'), studs) + node('hoops', ID('ear_hoops'), hoop(332) + hoop(868));
}

// ---------------- outfits ----------------
const BODY = [[468, 928], [380, 940], [290, 972], [222, 1030], [196, 1110], [188, 1230], [186, 1400], [186, 1560, 'c'], [1014, 1560, 'c'], [1014, 1400], [1012, 1230], [1004, 1110], [978, 1030], [910, 972], [820, 940], [732, 928]];
export const bodyPts = BODY;
function shell(extraFills = [], id) {
  return blob({ name: 'Shell', id, pts: BODY, k: 0.9, fills: [outfit(), ...volume(600, 1180, 460, { shadow: 0.5, hi: 0.14, bounce: 0.12, rim: 0.26, rimC: 'FFD9A8', bounceC: 'FFB98A', tint: '0B2A28' }), { radial: { cx: 380, cy: 1010, r: 170, stops: [[0, argb('FFFFFF', 0.2)], [1, argb('FFFFFF', 0)]] } }, ...extraFills] });
}
function shellShade() {
  return blob({ name: 'ShellShade', pts: BODY, k: 0.9, fills: [...volume(600, 1180, 460, { shadow: 0.5, hi: 0.14, bounce: 0.12, rim: 0.26, rimC: 'FFD9A8', bounceC: 'FFB98A', tint: '0B2A28' }), { radial: { cx: 380, cy: 1010, r: 170, stops: [[0, argb('FFFFFF', 0.2)], [1, argb('FFFFFF', 0)]] } }] });
}
const button = (x, y, c = accent) => ellipse({ name: 'Button', cx: x, cy: y, rx: 20, fills: [c(), { radial: { cx: x - 8, cy: y - 8, r: 22, stops: [[0, argb('FFFFFF', 0.8)], [0.4, argb('FFFFFF', 0.12)], [1, argb('FFFFFF', 0)]] } }, { radial: { cx: x + 4, cy: y + 6, r: 24, stops: [[0.5, argb(SHADE, 0)], [1, argb(SHADE, 0.5)]] } }], strokes: [{ w: 3, solid: argb(SHADE, 0.4) }] });
const neckAO = () => ellipse({ name: 'NeckAO', cx: 600, cy: 950, rx: 140, ry: 34, fills: [{ radial: { cx: 600, cy: 950, r: 140, stops: [[0, argb(SHADE, 0.4)], [1, argb(SHADE, 0)]] } }] });
const vEdge = (pts, w = 8, a = 0.5) => blob({ name: 'Edge', pts, closed: false, strokes: [{ w, solid: argb('0B2A28', a) }] });

// a block of horizontal bars, clipped to a source shape (one Shape, many Rectangle paths)
function bars(name, ys, cx, w, h, clipId, bind = 'accentColor', fallback = 'FFB547') {
  const [lx, ly] = [0, 0];
  const rects = ys.map((y) => { const [rx, ry] = rel(cx, y); return `<Rectangle x="${f(rx)}" y="${f(ry)}" width="${w}" height="${h}" originX="0.5" originY="0.5" cornerRadiusTL="${h / 2}" name="Bar"/>`; }).join('');
  return `<Shape name="${name}">${rects}<Fill><SolidColor colorValue="${argb(fallback)}"><DataBindContext sourcePathIds="@@${bind}" propertyKey="37"/></SolidColor></Fill><ClippingShape sourceId="${clipId}"/></Shape>`;
}
export function outfitVariants(cardiganXml) {
  const out = [node('cardigan', ID('of_cardigan'), cardiganXml)];
  // blouse with horizontal stripes and a scoop neck
  const shellB = ID('shell_blouse');
  out.push(node('blouse_stripe', ID('of_blouse'),
    blob({ name: 'Scoop', pts: [[500, 930, 'c'], [520, 1000], [600, 1044], [680, 1000], [700, 930, 'c']], fills: [skinShade(), { linear: { x1: 600, y1: 930, x2: 600, y2: 1044, stops: [[0, argb(SHADE, 0.5)], [1, argb(SHADE, 0)]] } }] }) +
    shellShade() + bars('Stripes', [1090, 1160, 1230, 1300, 1370, 1440, 1510], 600, 1000, 26, shellB) + shell([], shellB) + neckAO()));
  // blazer over a striped top
  const vId = ID('shell_topv');
  const lapEdge = (s) => { const e = s < 0 ? [[486, 934], [520, 1040], [570, 1180], [600, 1250]] : [[714, 934], [680, 1040], [630, 1180], [600, 1250]]; return blob({ name: 'BlazerEdge', pts: e, closed: false, strokes: [{ w: 8, solid: argb('5A1F18', 0.45) }] }) + blob({ name: 'BlazerHi', pts: e.map(([x, y]) => [x - s * 18, y]), closed: false, strokes: [{ w: 7, solid: argb('FFFFFF', s < 0 ? 0.25 : 0.1) }] }); };
  out.push(node('blazer', ID('of_blazer'), button(600, 1340) + lapEdge(-1) + lapEdge(1) +
    bars('TopStripes', [1000, 1050, 1100, 1150, 1200], 600, 300, 16, vId) +
    blob({ name: 'TopV', id: vId, pts: [[506, 930, 'c'], [694, 930, 'c'], [650, 1100], [600, 1250, 'c'], [550, 1100]], k: 0.8, fills: [outfit2(), { linear: { x1: 600, y1: 930, x2: 600, y2: 1250, stops: [[0, argb(SHADE, 0.3)], [1, argb(SHADE, 0.05)]] } }] }) +
    shell() + neckAO()));
  // scrubs: V-neck, white tee, ID badge, pocket
  out.push(node('scrubs', ID('of_scrubs'), neckAO() +
    // badge + lanyard
    rrect({ name: 'Badge', cx: 760, cy: 1230, w: 92, h: 120, r: 12, fills: [{ solid: argb('FFFDF8') }, { linear: { x1: 760, y1: 1170, x2: 760, y2: 1290, stops: [[0, argb('FFFFFF', 0)], [1, argb(SHADE, 0.2)]] } }], strokes: [{ w: 3, solid: argb(SHADE, 0.3) }] }) +
    rrect({ name: 'BadgeBand', cx: 760, cy: 1190, w: 92, h: 30, r: 10, fills: [accent()] }) + ellipse({ name: 'BadgePic', cx: 760, cy: 1240, rx: 20, fills: [skinShade()] }) +
    blob({ name: 'Lanyard', pts: [[540, 930], [640, 1060], [740, 1170]], closed: false, strokes: [{ w: 9, solid: argb('FFB547'), bind: 'accentColor' }] }) +
    rrect({ name: 'Pocket', cx: 440, cy: 1290, w: 150, h: 120, r: 16, fills: [outfit(), { linear: { x1: 440, y1: 1230, x2: 440, y2: 1350, stops: [[0, argb(SHADE, 0.2)], [1, argb(SHADE, 0.06)]] } }], strokes: [{ w: 4, solid: argb('0B2A28', 0.35) }] }) +
    blob({ name: 'ScrubV', pts: [[516, 930, 'c'], [684, 930, 'c'], [630, 1060], [600, 1112, 'c'], [570, 1060]], k: 0.8, fills: [outfit2(), { linear: { x1: 600, y1: 930, x2: 600, y2: 1112, stops: [[0, argb(SHADE, 0.35)], [1, argb(SHADE, 0)]] } }] }) +
    vEdge([[500, 934], [560, 1060], [600, 1120], [640, 1060], [700, 934]], 8, 0.45) + shell()));
  return out.join('');
}

// ---------------- props ----------------
const W = (side) => WRIST[side];
export function handProps(side) {
  const [wx, wy] = W(side);
  const cx = wx, cy = wy + 118;                // grip point below the wrist
  const out = [node('none', ID('hp_none'), '')];
  // tea cup + animated steam
  out.push(node('tea_cup', ID('hp_tea'),
    group('Steam', cx, cy - 60, () =>
      [-18, 0, 18].map((dx, i) => blob({ name: 'SteamWisp', pts: [[cx + dx, cy - 56], [cx + dx + 10, cy - 82], [cx + dx - 8, cy - 108], [cx + dx + 8, cy - 134]], closed: false, strokes: [{ w: 8, solid: argb('FFFFFF', 0.38 - i * 0.06) }] })).join(''), { id: ID('Steam') }) +
    blob({ name: 'CupHandle', pts: [[cx + 36, cy - 14], [cx + 66, cy - 12], [cx + 70, cy + 20], [cx + 38, cy + 24]], closed: false, strokes: [{ w: 14, solid: argb('F4EEE6') }] }) +
    ellipse({ name: 'TeaSurface', cx, cy: cy - 30, rx: 40, ry: 12, fills: [{ solid: argb('9A5B2E') }, { radial: { cx: cx - 10, cy: cy - 32, r: 30, stops: [[0, argb('FFD9A0', 0.5)], [1, argb('FFD9A0', 0)]] } }], strokes: [{ w: 4, solid: argb('F4EEE6') }] }) +
    blob({ name: 'Cup', pts: [[cx - 46, cy - 32], [cx + 46, cy - 32], [cx + 40, cy + 20], [cx + 22, cy + 46], [cx - 22, cy + 46], [cx - 40, cy + 20]], k: 0.8, fills: [{ solid: argb('F7F3EC') }, ...cylinder(cx, cy, 46, { shadow: 0.35, hi: 0.4, rim: 0.3, rimC: 'FFD9A8' }), { linear: { x1: cx, y1: cy + 10, x2: cx, y2: cy + 46, stops: [[0, argb('B8A6C8', 0)], [1, argb('B8A6C8', 0.35)]] } }] })));
  const bookFills = [{ solid: argb('3A5BA0') }, ...cylinder(cx, cy, 64, { shadow: 0.35, hi: 0.3, rim: 0.3, rimC: 'FFD9A8' }), { linear: { x1: cx - 64, y1: cy, x2: cx - 40, y2: cy, stops: [[0, argb(SHADE, 0.4)], [1, argb(SHADE, 0)]] } }];
  out.push(node('book', ID('hp_book'), `<Node name="BookTilt" rotation="0.18">` +
    rrect({ name: 'BookPages', cx: cx + 6, cy: cy + 4, w: 112, h: 142, r: 8, fills: [{ solid: argb('FFF4E2') }] }) +
    rrect({ name: 'BookCover', cx, cy, w: 120, h: 150, r: 10, fills: bookFills }) +
    rrect({ name: 'BookLabel', cx: cx + 4, cy: cy - 30, w: 64, h: 30, r: 6, fills: [accent()] }) + `</Node>`));
  out.push(node('menu', ID('hp_menu'), `<Node name="MenuTilt" rotation="-0.14">` +
    rrect({ name: 'MenuCard', cx, cy, w: 110, h: 156, r: 10, fills: [{ solid: argb('FFF4E2') }, { linear: { x1: cx - 55, y1: cy, x2: cx + 55, y2: cy, stops: [[0, argb('FFFFFF', 0.3)], [1, argb(SHADE, 0.22)]] } }], strokes: [{ w: 4, solid: argb(SHADE, 0.25) }] }) +
    rrect({ name: 'MenuBand', cx, cy: cy - 52, w: 110, h: 34, r: 10, fills: [{ solid: argb('C4572E') }] }) +
    [-14, 6, 26, 46].map((dy) => blob({ name: 'MenuLine', pts: [[cx - 36, cy + dy], [cx + 36, cy + dy]], closed: false, strokes: [{ w: 5, solid: argb(SHADE, 0.45) }] })).join('') + `</Node>`));
  const cr = [-3, -2, -1, 0, 1, 2, 3].map((i) => { const a = i * 0.42, x = cx + Math.sin(a) * 70, y = cy + 20 - Math.cos(a) * 36 + Math.abs(i) * 8, r = 34 - Math.abs(i) * 4.5; return ellipse({ name: 'Croissant', cx: x, cy: y, rx: r, ry: r * 0.78, rot: a, fills: [{ solid: argb('E0A04A') }, ...volume(x, y, r, { shadow: 0.45, hi: 0.34, rim: 0.3, rimC: 'FFE0A0', tint: '5A2A10' })] }); }).join('');
  out.push(node('croissant', ID('hp_croissant'), cr));
  out.push(node('clipboard', ID('hp_clip'), `<Node name="ClipTilt" rotation="0.1">` +
    rrect({ name: 'ClipBoard', cx, cy, w: 118, h: 160, r: 10, fills: [{ solid: argb('B07A44') }, ...cylinder(cx, cy, 59, { shadow: 0.3, hi: 0.2, rim: 0.3, rimC: 'FFD9A8' })] }) +
    rrect({ name: 'ClipPaper', cx, cy: cy + 6, w: 94, h: 128, r: 6, fills: [{ solid: argb('FFFDF8') }] }) +
    [-22, -2, 18, 38].map((dy) => blob({ name: 'PaperLine', pts: [[cx - 32, cy + dy], [cx + 32, cy + dy]], closed: false, strokes: [{ w: 4, solid: argb(SHADE, 0.35) }] })).join('') +
    rrect({ name: 'ClipClamp', cx, cy: cy - 76, w: 50, h: 22, r: 8, fills: [{ solid: argb('C8CED8') }, { linear: { x1: cx, y1: cy - 88, x2: cx, y2: cy - 66, stops: [[0, argb('FFFFFF', 0.6)], [1, argb(SHADE, 0.3)]] } }] }) + `</Node>`));
  out.push(node('stethoscope', ID('hp_steth'), ''));   // worn at the neck instead
  return out.join('');
}

export function neckProps() {
  const out = PROP.map((p) => (p === 'stethoscope' ? '' : node(p, ID(`np_${p}`), '')));
  const tube = blob({ name: 'SteTube', pts: [[470, 936], [446, 1040], [500, 1150], [560, 1200], [600, 1214], [640, 1200], [700, 1150], [754, 1040], [730, 936]], closed: false, strokes: [{ w: 16, linear: { x1: 460, y1: 940, x2: 740, y2: 1210, stops: [[0, argb('3A4C60')], [0.5, argb('5A7088')], [1, argb('2A3846')]] } }] });
  const tubeHi = blob({ name: 'SteHi', pts: [[460, 944], [440, 1040], [494, 1148]], closed: false, strokes: [{ w: 4, solid: argb('FFFFFF', 0.35) }] });
  const piece = ellipse({ name: 'SteChest', cx: 600, cy: 1252, rx: 34, fills: [{ solid: argb('C8CED8') }, { radial: { cx: 588, cy: 1240, r: 36, stops: [[0, argb('FFFFFF', 0.85)], [0.4, argb('FFFFFF', 0.1)], [1, argb('FFFFFF', 0)]] } }, { radial: { cx: 606, cy: 1262, r: 38, stops: [[0.5, argb(SHADE, 0)], [1, argb(SHADE, 0.5)]] } }], strokes: [{ w: 5, solid: argb('5A6676') }] });
  const stem = blob({ name: 'SteStem', pts: [[600, 1214], [600, 1230], [600, 1246]], closed: false, strokes: [{ w: 12, solid: argb('5A6676') }] });
  out[PROP.indexOf('stethoscope')] = node('stethoscope', ID('np_stethoscope'), piece + stem + tubeHi + tube);
  return out.join('');
}
