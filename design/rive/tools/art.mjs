// Lín Lǎoshī — 3D-look character art (vector, gradient-lit). Coordinates are absolute
// artboard pixels on the 1200 x 1500 Teacher artboard (rest pose).
import { blob, ellipse, rrect, group, volume, cylinder, argb, nid, ID, f, O, rel, pushOrigin, popOrigin } from './lib.mjs';

const INK = '1B1020';          // darkest tone (no pure black)
const SHADE = '2A0F2E';         // shadow tint (deep dusk plum)
const WARM = 'FFC47A';          // amber rim / bounce light

const skin = () => ({ solid: argb('E8B48F'), bind: 'skinColor' });
const skinShade = () => ({ solid: argb('C98D6A'), bind: 'skinShadeColor' });
const hair = () => ({ solid: argb('2A2230'), bind: 'hairColor' });
const outfit = () => ({ solid: argb('2FA37F'), bind: 'outfitPrimary' });
const outfit2 = () => ({ solid: argb('FFF4E2'), bind: 'outfitSecondary' });
const accent = () => ({ solid: argb('FFB547'), bind: 'accentColor' });

// ---------------------------------------------------------------------------------------
// HEAD
// ---------------------------------------------------------------------------------------
const FACE = [
  [600, 250], [722, 262], [812, 332], [864, 432], [872, 544], [850, 652], [792, 752],
  [700, 818], [600, 838], [500, 818], [408, 752], [350, 652], [328, 544], [336, 432], [388, 332], [478, 262],
];

export function faceBase() {
  const cx = 600, cy = 560, r = 300;
  return blob({
    name: 'Face', pts: FACE, k: 1,
    fills: [
      skin(),
      ...volume(cx, cy, r, { shadow: 0.42, hi: 0.26, bounce: 0.2, rim: 0.45, tint: '5A2030' }),
      // soft jaw/chin underside occlusion
      { linear: { x1: 600, y1: 740, x2: 600, y2: 840, stops: [[0, argb(SHADE, 0)], [1, argb(SHADE, 0.28)]] } },
      // forehead catch-light
      { radial: { cx: 560, cy: 330, r: 120, stops: [[0, argb('FFFFFF', 0.22)], [1, argb('FFFFFF', 0)]] } },
    ],
  });
}

export function ears() {
  const mk = (side) => {
    const s = side === 'L' ? -1 : 1, cx = 600 + s * 262;
    const pts = [[cx - 20 * s, 528], [cx + 16 * s, 520], [cx + 40 * s, 548], [cx + 42 * s, 604], [cx + 22 * s, 654], [cx - 16 * s, 650], [cx - 24 * s, 590]];
    return blob({
      name: `Ear${side}`, pts,
      fills: [skinShade(), ...volume(cx + 10 * s, 592, 62, { shadow: 0.4, hi: 0.18, bounce: 0, rim: s > 0 ? 0.35 : 0, rimC: 'FFD9A8' }),
        { radial: { cx: cx + 6 * s, cy: 592, r: 24, stops: [[0, argb('7A3A2A', 0.35)], [1, argb('7A3A2A', 0)]] } }],
    });
  };
  return mk('R') + mk('L');
}

export function earrings() {
  const mk = (side) => {
    const s = side === 'L' ? -1 : 1, cx = 600 + s * 268, cy = 676;
    return ellipse({
      name: `Stud${side}`, cx, cy, rx: 15,
      fills: [accent(),
        { radial: { cx: cx - 5, cy: cy - 6, r: 18, stops: [[0, argb('FFFFFF', 0.95)], [0.35, argb('FFFFFF', 0.15)], [1, argb('FFFFFF', 0)]] } },
        { radial: { cx: cx + 3, cy: cy + 4, r: 20, stops: [[0.5, argb(SHADE, 0)], [1, argb(SHADE, 0.5)]] } }],
    });
  };
  return mk('R') + mk('L');
}

export function cheeks() {
  const mk = (side) => {
    const s = side === 'L' ? -1 : 1, cx = 600 + s * 128, cy = 668;
    return ellipse({
      name: `Cheek${side}`, cx, cy, rx: 70, ry: 48, id: ID(`Cheek${side}`), attrs: ' opacity="0.7"',
      fills: [{ radial: { cx, cy, r: 70, stops: [[0, argb('FF6F6A', 0.5)], [0.55, argb('FF6F6A', 0.2)], [1, argb('FF6F6A', 0)]] } }],
    });
  };
  return mk('R') + mk('L');
}

export function nose() {
  return (
    // tip highlight
    ellipse({ name: 'NoseHi', cx: 596, cy: 632, rx: 17, ry: 12, fills: [{ radial: { cx: 596, cy: 630, r: 20, stops: [[0, argb('FFFFFF', 0.55)], [1, argb('FFFFFF', 0)]] } }] }) +
    // shadow side of nose + nostril hint
    blob({ name: 'NoseShade', pts: [[610, 588], [630, 622], [624, 646], [602, 652], [606, 626]], fills: [{ radial: { cx: 618, cy: 628, r: 34, stops: [[0, argb('7A3A2A', 0.45)], [1, argb('7A3A2A', 0)]] } }] }) +
    blob({ name: 'Nostrils', pts: [[572, 644], [600, 654], [628, 644]], closed: false, fills: [], strokes: [{ w: 5, solid: argb('8A4A3A', 0.5) }] })
  );
}

// ---------------------------------------------------------------------------------------
// EYES — sclera sphere, iris with depth, catchlights, lid that slides to blink
// ---------------------------------------------------------------------------------------
export function eye(side) {
  const s = side === 'L' ? -1 : 1, cx = 600 + s * 98, cy = 548, rx = 54, ry = 68;
  const openId = ID(`Eye${side}Opening`);
  const clip = `<ClippingShape sourceId="${openId}"/>`;
  return group(`Eye${side}`, cx, cy, () => {
    const parts = [];
    // Lid (skin) rests above the eye opening and slides down to blink; clipped to the opening.
    parts.push(group(`Lid${side}`, cx, cy, () =>
      blob({
        name: 'LidShape', pts: [[cx - rx - 14, cy - ry - 260], [cx + rx + 14, cy - ry - 260], [cx + rx + 16, cy - ry - 26], [cx, cy - ry - 4], [cx - rx - 16, cy - ry - 26]],
        fills: [skin(), { linear: { x1: cx, y1: cy - ry - 70, x2: cx, y2: cy - ry, stops: [[0, argb(SHADE, 0)], [1, argb(SHADE, 0.3)]] } }],
        strokes: [{ w: 9, solid: argb(INK, 0.9) }], closed: false, extra: clip,
      }), { id: ID(`Lid${side}`) }));
    // catchlights are fixed relative to the eye (light source), not the iris
    parts.push(ellipse({ name: 'CatchBig', cx: cx - 18, cy: cy - 22, rx: 13, ry: 15, fills: [{ solid: argb('FFFFFF', 0.97) }], extra: clip }));
    parts.push(ellipse({ name: 'CatchSmall', cx: cx + 16, cy: cy + 22, rx: 6.5, ry: 7.5, fills: [{ solid: argb('FFFFFF', 0.85) }], extra: clip }));
    // iris group (moves with gaze)
    parts.push(group(`Gaze${side}`, cx, cy + 4, () => group(`Iris${side}`, cx, cy + 4, () =>
      ellipse({ name: 'IrisOuter', cx, cy: cy + 4, rx: 40, ry: 46,
        fills: [{ solid: argb('3B2418') },
          { radial: { cx, cy: cy + 18, r: 52, stops: [[0, argb('B8793E', 0.95)], [0.55, argb('7A4524', 0.7)], [1, argb('2A160E', 0)]] } },
          { radial: { cx, cy: cy + 4, r: 48, stops: [[0.6, argb(INK, 0)], [1, argb(INK, 0.85)]] } }], extra: clip }) +
      ellipse({ name: 'Pupil', cx, cy: cy + 4, rx: 19, ry: 22, fills: [{ solid: argb('0E0710') }], extra: clip }) +
      ellipse({ name: 'IrisGlow', cx, cy: cy + 30, rx: 22, ry: 10, fills: [{ radial: { cx, cy: cy + 30, r: 24, stops: [[0, argb('FFD9A0', 0.55)], [1, argb('FFD9A0', 0)]] } }], extra: clip }),
    { id: ID(`Iris${side}`) }), { id: ID(`Gaze${side}`) }));
    // sclera: sphere shading + lid shadow; also the clip source (the eye opening)
    parts.push(ellipse({
      name: `Eye${side}Opening`, cx, cy, rx, ry, id: openId,
      fills: [{ solid: argb('FFF9F4') },
        { radial: { cx: cx - 8, cy: cy - 10, r: 78, stops: [[0.45, argb('B8A8D8', 0)], [1, argb('8C7AB4', 0.55)]] } },
        { linear: { x1: cx, y1: cy - ry, x2: cx, y2: cy - ry * 0.1, stops: [[0, argb(SHADE, 0.55)], [1, argb(SHADE, 0)]] } }],
    }));
    return parts.join('');
  }, { id: ID(`Eye${side}`) });
}

export function lashesAndBrows() {
  const lash = (side) => {
    const s = side === 'L' ? -1 : 1, cx = 600 + s * 98, cy = 548;
    const pts = s < 0
      ? [[cx - 62, cy - 14], [cx - 52, cy - 46], [cx - 24, cy - 66], [cx + 12, cy - 72], [cx + 46, cy - 56], [cx + 62, cy - 30]]
      : [[cx - 62, cy - 30], [cx - 46, cy - 56], [cx - 12, cy - 72], [cx + 24, cy - 66], [cx + 52, cy - 46], [cx + 62, cy - 14]];
    const wing = s < 0 ? [[cx - 62, cy - 14], [cx - 76, cy - 26], [cx - 84, cy - 40]] : [[cx + 62, cy - 14], [cx + 76, cy - 26], [cx + 84, cy - 40]];
    return blob({ name: `Lash${side}`, pts, closed: false, strokes: [{ w: 11, solid: argb(INK) }] }) +
      blob({ name: `Wing${side}`, pts: wing, closed: false, strokes: [{ w: 8, solid: argb(INK) }] });
  };
  return lash('L') + lash('R');
}

export function brow(side) {
  const s = side === 'L' ? -1 : 1, cx = 600 + s * 100, cy = 452;
  const pts = s < 0 ? [[cx - 56, cy + 10], [cx - 20, cy - 8], [cx + 28, cy - 12], [cx + 56, cy + 2]] : [[cx - 56, cy + 2], [cx - 28, cy - 12], [cx + 20, cy - 8], [cx + 56, cy + 10]];
  return group(`Brow${side}`, cx, cy, () =>
    blob({ name: 'BrowBound', pts, closed: false, strokes: [{ w: 24, solid: argb('2A2230'), bind: 'hairColor' }] }) +
    blob({ name: 'BrowHi', pts: pts.map(([x, y]) => [x - 3, y - 5]), closed: false, strokes: [{ w: 6, solid: argb('FFFFFF', 0.22) }] }),
  { id: ID(`Brow${side}`) });
}

// ---------------------------------------------------------------------------------------
// HAIR — bob with side-swept bangs, glossy spec band, warm rim
// ---------------------------------------------------------------------------------------
export function hairBack() {
  const pts = [
    [318, 812], [292, 700], [282, 540], [300, 380], [370, 240], [480, 160], [610, 132], [740, 156], [840, 230], [905, 360],
    [918, 540], [908, 700], [884, 812], [820, 832], [760, 800], [440, 800], [380, 832],
  ];
  return blob({
    name: 'HairBack', pts, k: 1,
    fills: [hair(),
      ...volume(600, 480, 360, { shadow: 0.6, hi: 0, bounce: 0.1, rim: 0.3, rimC: 'FFD9A8', tint: '12081C' }),
      { linear: { x1: 600, y1: 140, x2: 600, y2: 820, stops: [[0, argb('FFFFFF', 0.06)], [1, argb(INK, 0.35)]] } }],
  });
}

export function hairFront() {
  const outer = [
    [322, 806], [296, 690], [290, 540], [310, 390], [378, 262], [490, 178], [616, 148], [742, 170], [836, 240], [896, 360],
    [910, 540], [902, 690], [880, 808],
  ];
  const inner = [
    [846, 792], [858, 676], [864, 540], [842, 424], [790, 340], [724, 296], [660, 318], [584, 368], [506, 420], [436, 466], [392, 530], [372, 640], [366, 760],
  ];
  const pts = [...outer, ...inner];
  const body = blob({
    name: 'HairFront', pts, k: 1,
    fills: [hair(),
      ...volume(600, 420, 330, { shadow: 0.55, hi: 0, bounce: 0.08, rim: 0.28, rimC: 'FFD9A8', tint: '12081C' }),
      { linear: { x1: 600, y1: 140, x2: 600, y2: 520, stops: [[0, argb('FFFFFF', 0.08)], [1, argb(INK, 0.25)]] } }],
  });
  // glossy highlight arcs following the form (the "shiny hair" band)
  const gloss1 = blob({
    name: 'HairGloss', pts: [[392, 290], [450, 224], [540, 190], [640, 182], [722, 198]], closed: false,
    strokes: [{ w: 30, linear: { x1: 392, y1: 290, x2: 722, y2: 198, stops: [[0, argb('FFF2DC', 0)], [0.4, argb('FFF2DC', 0.5)], [0.7, argb('FFF2DC', 0.42)], [1, argb('FFF2DC', 0)]] } }],
  });
  const gloss2 = blob({
    name: 'HairGloss2', pts: [[460, 440], [520, 392], [596, 350], [660, 326]], closed: false,
    strokes: [{ w: 16, linear: { x1: 460, y1: 440, x2: 660, y2: 326, stops: [[0, argb('FFF2DC', 0)], [0.5, argb('FFF2DC', 0.26)], [1, argb('FFF2DC', 0)]] } }],
  });
  const sideGloss = blob({
    name: 'HairGlossSide', pts: [[324, 520], [316, 620], [330, 720]], closed: false,
    strokes: [{ w: 20, linear: { x1: 324, y1: 520, x2: 330, y2: 720, stops: [[0, argb('FFF2DC', 0)], [0.5, argb('FFF2DC', 0.28)], [1, argb('FFF2DC', 0)]] } }],
  });
  // strand definition inside bangs
  const strands = [0, 1, 2].map((i) =>
    blob({ name: `Strand${i}`, pts: [[690 - i * 70, 300 + i * 20], [610 - i * 80, 360 + i * 28], [520 - i * 86, 420 + i * 36]], closed: false, strokes: [{ w: 5, solid: argb(INK, 0.5) }] })).join('');
  // cast shadow of the fringe on the forehead
  const castShadow = blob({
    name: 'FringeShadow', pts: [[700, 312], [620, 372], [532, 430], [450, 480], [430, 520], [520, 470], [610, 420], [694, 362]],
    fills: [{ linear: { x1: 640, y1: 330, x2: 600, y2: 450, stops: [[0, argb(SHADE, 0.22)], [1, argb(SHADE, 0)]] } }],
  });
  return { front: gloss1 + gloss2 + sideGloss + strands + body, shadow: castShadow };
}

// ---------------------------------------------------------------------------------------
// NECK + TORSO
// ---------------------------------------------------------------------------------------
export function neck() {
  return blob({
    name: 'Neck', pts: [[530, 800], [670, 800], [684, 900], [718, 944], [482, 944], [516, 900]],
    fills: [skinShade(),
      { linear: { x1: 540, y1: 880, x2: 680, y2: 880, stops: [[0, argb('FFFFFF', 0.12)], [0.5, argb(SHADE, 0)], [1, argb(SHADE, 0.4)]] } },
      // chin cast shadow
      { linear: { x1: 600, y1: 800, x2: 600, y2: 892, stops: [[0, argb(SHADE, 0.62)], [1, argb(SHADE, 0)]] } }],
  });
}

export function torso() {
  const body = [[468, 928], [380, 940], [290, 972], [222, 1030], [196, 1110], [188, 1230], [186, 1400], [186, 1560, 'c'], [1014, 1560, 'c'], [1014, 1400], [1012, 1230], [1004, 1110], [978, 1030], [910, 972], [820, 940], [732, 928]];
  const cardigan = blob({
    name: 'Cardigan', pts: body, k: 0.9,
    fills: [outfit(),
      ...volume(600, 1180, 460, { shadow: 0.5, hi: 0.14, bounce: 0.12, rim: 0.26, rimC: 'FFD9A8', bounceC: 'FFB98A', tint: '0B2A28' }),
      // cardigan shoulder highlight
      { radial: { cx: 380, cy: 1010, r: 170, stops: [[0, argb('FFFFFF', 0.2)], [1, argb('FFFFFF', 0)]] } }],
  });
  // blouse V (cream, with soft shading)
  const blouse = blob({
    name: 'Blouse', pts: [[498, 930, 'c'], [702, 930, 'c'], [676, 1030], [640, 1148], [600, 1212, 'c'], [560, 1148], [524, 1030]],
    k: 0.8,
    fills: [outfit2(),
      { linear: { x1: 500, y1: 940, x2: 700, y2: 1200, stops: [[0, argb('FFFFFF', 0)], [1, argb(SHADE, 0.3)]] } },
      { linear: { x1: 600, y1: 930, x2: 600, y2: 1010, stops: [[0, argb(SHADE, 0.34)], [1, argb(SHADE, 0)]] } }],
  });
  // lapel edges: crisp highlight on the outer fold + soft occlusion where cardigan overlaps blouse
  const lapel = (s) => {
    const edge = s < 0 ? [[484, 934], [540, 1040], [584, 1160], [600, 1214]] : [[716, 934], [660, 1040], [616, 1160], [600, 1214]];
    return blob({ name: s < 0 ? 'LapelEdge_L' : 'LapelEdge_R', pts: edge, closed: false, strokes: [{ w: 8, solid: argb('0B2A28', 0.5) }] }) +
      blob({ name: s < 0 ? 'LapelHi_L' : 'LapelHi_R', pts: edge.map(([x, y]) => [x - s * 16, y]), closed: false, strokes: [{ w: 7, solid: argb('FFFFFF', s < 0 ? 0.2 : 0.09) }] });
  };
  const collar = (s) => lapel(s);
  const edgeAO = '';
  // ribbed placket lines
  const rib = [-1, 1].map((s) => blob({ name: `Rib${s}`, pts: [[600 + s * 70, 1180], [600 + s * 96, 1300], [600 + s * 108, 1440]], closed: false, strokes: [{ w: 6, solid: argb(SHADE, 0.25) }] })).join('');
  // buttons
  const buttons = [1290, 1400].map((y, i) => ellipse({
    name: `Button${i}`, cx: 600, cy: y, rx: 20,
    fills: [accent(), { radial: { cx: 592, cy: y - 8, r: 22, stops: [[0, argb('FFFFFF', 0.8)], [0.4, argb('FFFFFF', 0.12)], [1, argb('FFFFFF', 0)]] } }, { radial: { cx: 604, cy: y + 6, r: 24, stops: [[0.5, argb(SHADE, 0)], [1, argb(SHADE, 0.5)]] } }],
    strokes: [{ w: 3, solid: argb(SHADE, 0.45) }],
  })).join('');
  // pendant: gold chain + glossy sphere
  const chain = blob({ name: 'Chain', pts: [[528, 940], [560, 1030], [600, 1074], [640, 1030], [672, 940]], closed: false, strokes: [{ w: 5, solid: argb('FFD27A') }] });
  const pendant = ellipse({
    name: 'Pendant', cx: 600, cy: 1096, rx: 24,
    fills: [accent(),
      { radial: { cx: 590, cy: 1085, r: 26, stops: [[0, argb('FFFFFF', 0.95)], [0.35, argb('FFFFFF', 0.2)], [1, argb('FFFFFF', 0)]] } },
      { radial: { cx: 606, cy: 1106, r: 28, stops: [[0.45, argb(SHADE, 0)], [1, argb(SHADE, 0.55)]] } }],
    strokes: [{ w: 3, solid: argb('8A5A10', 0.5) }],
  });
  // neck-base shadow onto blouse/skin
  const neckAO = ellipse({ name: 'NeckAO', cx: 600, cy: 950, rx: 140, ry: 34, fills: [{ radial: { cx: 600, cy: 950, r: 140, stops: [[0, argb(SHADE, 0.4)], [1, argb(SHADE, 0)]] } }] });
  return neckAO + pendant + chain + buttons + rib + edgeAO + collar(-1) + collar(1) + blouse + cardigan;
}
