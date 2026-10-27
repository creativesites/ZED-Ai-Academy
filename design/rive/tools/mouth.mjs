// Nine viseme mouth shapes (contract values 0..8), authored around (600, 690).
import { blob, ellipse, rrect, group, argb, nid, ID, f } from './lib.mjs';

const MX = 600, MY = 690;
const LIP = 'B04A5C', LIP_HI = 'D8707F', LIP_LO = '7A2640', CAV = '3A0F20', CAV2 = '7A2438', TONGUE = 'E5707F';

// opening: half-width w, upper depth ut, lower depth lt
function opening(w, ut, lt, dy = 0) {
  return [
    [MX - w, MY + dy, 'c', 10], [MX - w * 0.55, MY + dy - ut * 0.86], [MX, MY + dy - ut], [MX + w * 0.55, MY + dy - ut * 0.86], [MX + w, MY + dy, 'c', 10],
    [MX + w * 0.6, MY + dy + lt * 0.84], [MX, MY + dy + lt], [MX - w * 0.6, MY + dy + lt * 0.84],
  ];
}

const K = 1.32;
function openMouth(name, o) {
  const { teethOverLip = false } = o;
  const w = o.w * K, ut = o.ut * K, lt = o.lt * K, teethTop = (o.teethTop || 0) * K, teethBot = (o.teethBot || 0) * K, tongue = (o.tongue || 0) * K, dy = o.dy || 0, lipW = (o.lipW || 20) * 1.15;
  const openId = nid();
  const pts = opening(w, ut, lt, dy);
  const clip = `<ClippingShape sourceId="${openId}"/>`;
  return group(name, MX, MY, () => {
  const parts = [];
  // lips (tube), gloss on lower lip
  parts.push(blob({ name: 'LipGloss', pts: [[MX - w * 0.4, MY + dy + lt + lipW * 0.35], [MX, MY + dy + lt + lipW * 0.5], [MX + w * 0.4, MY + dy + lt + lipW * 0.35]], closed: false, strokes: [{ w: 5, solid: argb('FFFFFF', 0.45) }] }));
  parts.push(blob({
    name: 'Lips', pts, closed: true,
    strokes: [{ w: lipW, linear: { x1: MX, y1: MY + dy - ut - lipW, x2: MX, y2: MY + dy + lt + lipW, stops: [[0, argb(LIP_LO)], [0.45, argb(LIP)], [1, argb(LIP_HI)]] } }],
  }));
  if (teethTop > 0) parts.push(rrect({
    name: 'TeethTop', cx: MX, cy: MY + dy - ut + teethTop / 2 - 2, w: w * 1.7, h: teethTop, r: 8,
    fills: [{ solid: argb('FFFBF4') }, { linear: { x1: MX, y1: MY + dy - ut, x2: MX, y2: MY + dy - ut + teethTop, stops: [[0, argb('3A0F20', 0.35)], [0.35, argb('3A0F20', 0)], [1, argb('B8A6C8', 0.35)]] } }],
    extra: teethOverLip ? '' : clip,
  }));
  if (teethBot > 0) parts.push(rrect({
    name: 'TeethBot', cx: MX, cy: MY + dy + lt - teethBot / 2 + 2, w: w * 1.45, h: teethBot, r: 8,
    fills: [{ solid: argb('F6EFE8') }, { linear: { x1: MX, y1: MY + dy + lt - teethBot, x2: MX, y2: MY + dy + lt, stops: [[0, argb('B8A6C8', 0.3)], [1, argb('3A0F20', 0.4)]] } }], extra: clip,
  }));
  if (tongue > 0) parts.push(ellipse({
    name: 'Tongue', cx: MX, cy: MY + dy + lt * 0.78, rx: w * 0.62, ry: tongue,
    fills: [{ solid: argb(TONGUE) }, { radial: { cx: MX - 6, cy: MY + dy + lt * 0.7, r: w * 0.5, stops: [[0, argb('FFFFFF', 0.4)], [1, argb('FFFFFF', 0)]] } }, { linear: { x1: MX, y1: MY + dy + lt * 0.5, x2: MX, y2: MY + dy + lt, stops: [[0, argb(CAV, 0.4)], [1, argb(CAV, 0)]] } }], extra: clip,
  }));
  parts.push(blob({
    name: 'Cavity', pts, id: openId,
    fills: [{ linear: { x1: MX, y1: MY + dy - ut, x2: MX, y2: MY + dy + lt, stops: [[0, argb(CAV)], [1, argb(CAV2)]] } }],
  }));
  return parts.join('');
  }, { id: ID(name) });
}

function closedMouth(name, o) {
  const w = o.w * K, smile = (o.smile ?? 10) * K, thick = (o.thick ?? 18) * 1.2, press = !!o.press;
  return group(name, MX, MY, () => {
  const parts = [];
  const line = [[MX - w, MY - smile * 0.2], [MX - w * 0.5, MY + smile * 0.55], [MX, MY + smile * 0.75], [MX + w * 0.5, MY + smile * 0.55], [MX + w, MY - smile * 0.2]];
  // lower lip plump + gloss
  parts.push(blob({ name: 'LowerGloss', pts: [[MX - w * 0.38, MY + smile * 0.75 + 17], [MX, MY + smile * 0.75 + 20], [MX + w * 0.38, MY + smile * 0.75 + 17]], closed: false, strokes: [{ w: 5, solid: argb('FFFFFF', 0.5) }] }));
  parts.push(blob({
    name: 'LowerLip', pts: [[MX - w * 0.78, MY + smile * 0.2], [MX - w * 0.4, MY + smile * 0.75 + 20 - (press ? 8 : 0)], [MX, MY + smile * 0.75 + 26 - (press ? 8 : 0)], [MX + w * 0.4, MY + smile * 0.75 + 20 - (press ? 8 : 0)], [MX + w * 0.78, MY + smile * 0.2]],
    fills: [{ linear: { x1: MX, y1: MY + smile * 0.5, x2: MX, y2: MY + smile * 0.75 + 28, stops: [[0, argb(LIP)], [1, argb(LIP_HI)]] } }],
  }));
  parts.push(blob({
    name: 'UpperLip', pts: [[MX - w, MY - smile * 0.2, 'c', 8], [MX - w * 0.5, MY + smile * 0.55 - thick * 0.9], [MX - w * 0.14, MY + smile * 0.75 - thick * 1.1], [MX, MY + smile * 0.75 - thick * 0.85], [MX + w * 0.14, MY + smile * 0.75 - thick * 1.1], [MX + w * 0.5, MY + smile * 0.55 - thick * 0.9], [MX + w, MY - smile * 0.2, 'c', 8], [MX + w * 0.5, MY + smile * 0.55 + 2], [MX, MY + smile * 0.75 + 3], [MX - w * 0.5, MY + smile * 0.55 + 2]],
    fills: [{ linear: { x1: MX, y1: MY - thick, x2: MX, y2: MY + smile, stops: [[0, argb(LIP_LO)], [1, argb(LIP)]] } }],
  }));
  parts.push(blob({ name: 'MouthLine', pts: line, closed: false, strokes: [{ w: 5, solid: argb('5A1A2C', 0.9) }] }));
  // little dimples at corners (3D cheek definition)
  parts.push(blob({ name: 'DimpleL', pts: [[MX - w - 14, MY - 6], [MX - w - 6, MY + 4], [MX - w + 2, MY + 6]], closed: false, strokes: [{ w: 4, solid: argb('7A3A2A', 0.35) }] }));
  parts.push(blob({ name: 'DimpleR', pts: [[MX + w + 14, MY - 6], [MX + w + 6, MY + 4], [MX + w - 2, MY + 6]], closed: false, strokes: [{ w: 4, solid: argb('7A3A2A', 0.35) }] }));
  return parts.join('');
  }, { id: ID(name) });
}

// index = viseme value 0..8
export const VISEME_NAMES = ['rest', 'AA', 'EH', 'EE', 'OH', 'OO', 'MBP', 'FV', 'CONS'];
export function visemes() {
  return [
    closedMouth('v0_rest', { w: 46, smile: 14 }),
    openMouth('v1_AA', { w: 52, ut: 24, lt: 66, teethTop: 22, tongue: 20 }),
    openMouth('v2_EH', { w: 60, ut: 20, lt: 40, teethTop: 20, tongue: 12 }),
    openMouth('v3_EE', { w: 66, ut: 14, lt: 24, teethTop: 16, teethBot: 12 }),
    openMouth('v4_OH', { w: 34, ut: 34, lt: 50, teethTop: 10, tongue: 14, lipW: 24 }),
    openMouth('v5_OO', { w: 22, ut: 22, lt: 28, tongue: 8, lipW: 28 }),
    closedMouth('v6_MBP', { w: 42, smile: 2, thick: 22, press: true }),
    openMouth('v7_FV', { w: 50, ut: 10, lt: 26, teethTop: 20, teethOverLip: true, lipW: 18 }),
    openMouth('v8_CONS', { w: 54, ut: 14, lt: 20, teethTop: 14, teethBot: 10 }),
  ];
}
