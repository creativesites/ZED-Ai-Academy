"use client";

import { useEffect, useRef } from "react";
import type { SceneArtboard } from "@/lib/tutor/rive-driver";
import { useReducedMotion } from "./use-reduced-motion";

// Drifting glyphs on a canvas behind the stage. Decorative: aria-hidden, pointer-events none.
// Paused when the page is hidden and drawn once, still, when the learner prefers reduced motion.

// Glyphs follow the scene's language, so a Spanish café does not float Chinese characters.
const GLYPHS: Record<SceneArtboard, readonly string[]> = {
  Scene_TeaHouse: ["你", "好", "学", "谢", "水", "山", "天", "茶", "ní", "hǎo", "xièxie", "ā", "ǒ"],
  Scene_Cafe: ["¡Hola!", "café", "ñ", "¿", "gracias", "por favor", "té", "á", "é", "pan", "sí"],
  Scene_Rooftop: ["Bonjour", "merci", "ç", "é", "è", "à", "pain", "café", "oui", "ô", "s'il vous plaît"],
  Scene_Clinic: ["Hello", "pain", "how", "when", "where", "breathe", "ache", "fever", "rest", "?"],
};

type Particle = { x: number; y: number; size: number; speed: number; alpha: number; glyph: string };

function makeParticles(width: number, height: number, count: number, glyphs: readonly string[]): Particle[] {
  return Array.from({ length: count }, (_, i) => ({
    x: Math.random() * width,
    y: Math.random() * height,
    size: 14 + ((i * 7) % 18),
    speed: 6 + ((i * 13) % 14),
    alpha: 0.06 + ((i * 3) % 7) * 0.012,
    glyph: glyphs[i % glyphs.length],
  }));
}

export function SceneBackdrop({ className, scene = "Scene_TeaHouse" }: { className?: string; scene?: SceneArtboard }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const reduced = useReducedMotion();

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let width = 0;
    let height = 0;
    let particles: Particle[] = [];
    let raf = 0;
    let last = performance.now();

    const resize = () => {
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      width = canvas.clientWidth;
      height = canvas.clientHeight;
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      particles = makeParticles(width, height, width < 500 ? 16 : 26, GLYPHS[scene] ?? GLYPHS.Scene_TeaHouse);
      draw(0);
    };

    const draw = (dt: number) => {
      ctx.clearRect(0, 0, width, height);
      ctx.fillStyle = "#fd5523";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      for (const p of particles) {
        if (!reduced) {
          p.y -= p.speed * dt;
          if (p.y < -30) {
            p.y = height + 30;
            p.x = Math.random() * width;
          }
        }
        ctx.globalAlpha = p.alpha;
        ctx.font = `${p.size}px "Noto Serif SC", "Songti SC", serif`;
        ctx.fillText(p.glyph, p.x, p.y);
      }
      ctx.globalAlpha = 1;
    };

    const loop = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      draw(dt);
      raf = requestAnimationFrame(loop);
    };

    resize();
    const observer = new ResizeObserver(resize);
    observer.observe(canvas);

    const onVisibility = () => {
      cancelAnimationFrame(raf);
      if (!document.hidden && !reduced) {
        last = performance.now();
        raf = requestAnimationFrame(loop);
      }
    };
    document.addEventListener("visibilitychange", onVisibility);

    if (!reduced && !document.hidden) raf = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(raf);
      observer.disconnect();
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [reduced, scene]);

  return <canvas ref={canvasRef} aria-hidden="true" className={className} style={{ pointerEvents: "none" }} />;
}
