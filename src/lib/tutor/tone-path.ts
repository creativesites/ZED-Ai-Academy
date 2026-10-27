import { TONE_TRACE } from "./contract.generated.ts";
import type { ToneShape } from "./contract.generated.ts";

// Samples the normalised tone contours from the contract. Pure, no React.
// Contract coordinates: x runs 0..1 left to right, y runs 0..1 top to bottom (0 = high pitch).

export type Point = readonly [number, number];
export type Box = { x: number; y: number; w: number; h: number };

function clamp01(v: number): number {
  return Math.min(1, Math.max(0, v));
}

export function tonePoints(tone: ToneShape): ReadonlyArray<Point> {
  return TONE_TRACE.paths[tone];
}

/**
 * Point at arc-length fraction `u` (0..1) along a polyline. Constant speed along the path,
 * so a fingertip driven by this moves evenly.
 */
export function samplePolyline(points: ReadonlyArray<Point>, u: number): [number, number] {
  if (points.length === 0) return [0, 0];
  if (points.length === 1) return [points[0][0], points[0][1]];

  const lengths: number[] = [];
  let total = 0;
  for (let i = 1; i < points.length; i++) {
    const dx = points[i][0] - points[i - 1][0];
    const dy = points[i][1] - points[i - 1][1];
    const len = Math.hypot(dx, dy);
    lengths.push(len);
    total += len;
  }
  if (total === 0) return [points[0][0], points[0][1]];

  let remaining = clamp01(u) * total;
  for (let i = 0; i < lengths.length; i++) {
    if (remaining <= lengths[i] || i === lengths.length - 1) {
      const f = lengths[i] === 0 ? 0 : clamp01(remaining / lengths[i]);
      const a = points[i];
      const b = points[i + 1];
      return [a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f];
    }
    remaining -= lengths[i];
  }
  const last = points[points.length - 1];
  return [last[0], last[1]];
}

/** Point on a tone contour, mapped into a screen box. */
export function toneBoxPoint(tone: ToneShape, u: number, box: Box): { x: number; y: number } {
  const [px, py] = samplePolyline(tonePoints(tone), u);
  return { x: box.x + px * box.w, y: box.y + py * box.h };
}

/** SVG path data ("M x y L x y ...") for a whole tone contour inside a box. */
export function toneBoxPath(tone: ToneShape, box: Box, steps = 48): string {
  const parts: string[] = [];
  for (let i = 0; i <= steps; i++) {
    const p = toneBoxPoint(tone, i / steps, box);
    parts.push(`${i === 0 ? "M" : "L"}${p.x.toFixed(1)} ${p.y.toFixed(1)}`);
  }
  return parts.join(" ");
}
