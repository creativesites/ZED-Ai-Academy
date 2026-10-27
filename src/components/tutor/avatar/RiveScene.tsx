"use client";

import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from "react";
import { Alignment, Fit, Layout, Rive } from "@rive-app/canvas";
import { ARTBOARDS } from "@/lib/tutor/contract.generated";
import { SceneVmController } from "@/lib/tutor/rive-driver";
import type { SceneArtboard } from "@/lib/tutor/rive-driver";
import { cappedPixelRatio, openRiveFile, portFor, RIVE_SCENES_FILE } from "./rive-runtime";

// The backdrop: one of the four scene artboards in zai_scenes.riv, drawn behind the teacher. Decorative,
// so it is aria-hidden. Parallax follows the mouse on desktop and the device orientation when the browser
// already delivers it. We never call requestPermission, so nothing is prompted.

export type RiveSceneHandle = { celebrate(): void };

export type RiveSceneProps = {
  scene: SceneArtboard;
  /** 0 midday, 70 golden dusk (default), 100 night. */
  timeOfDay?: number;
  reducedMotion?: boolean;
  /** Ambient loops the caller wants (lanterns, steam, birds, stars). Off under reduced motion or lowPerformance. */
  ambience?: boolean;
  /** Set by the page after the frame rate stayed low. */
  lowPerformance?: boolean;
  className?: string;
};

// Mouse position maps to a fraction of the full range, so the scene drifts rather than jumps.
const POINTER_X = 0.6;
const POINTER_Y = 0.4;
// About 20 degrees of tilt is the full parallax range.
const TILT_RANGE_DEG = 20;

let warnedLoad = false;

function clamp100(v: number): number {
  return Math.max(-100, Math.min(100, v));
}

export const RiveScene = forwardRef<RiveSceneHandle, RiveSceneProps>(function RiveScene(props, ref) {
  const { scene, timeOfDay = 70, reducedMotion = false, ambience = true, lowPerformance = false, className } = props;
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [controller] = useState(() => new SceneVmController());
  const [loadedScene, setLoadedScene] = useState<string | null>(null);
  const ready = loadedScene === scene;

  useImperativeHandle(ref, () => ({ celebrate: controller.celebrate }), [controller]);

  useEffect(() => {
    controller.setOptions({ timeOfDay, ambience, reducedMotion, lowPerformance });
  }, [controller, timeOfDay, ambience, reducedMotion, lowPerformance]);

  // Parallax input. Off under reduced motion, and the scene is held still there.
  useEffect(() => {
    if (reducedMotion) return;

    const onPointer = (e: PointerEvent) => {
      if (e.pointerType !== "mouse") return;
      const x = ((e.clientX / Math.max(1, window.innerWidth)) * 2 - 1) * 100 * POINTER_X;
      const y = ((e.clientY / Math.max(1, window.innerHeight)) * 2 - 1) * 100 * POINTER_Y;
      controller.setOptions({ parallaxX: clamp100(x), parallaxY: clamp100(y) });
    };

    let baseBeta: number | null = null;
    const onOrientation = (e: DeviceOrientationEvent) => {
      // Without permission the browser sends no values (or nulls), and we simply get nothing.
      if (e.gamma == null || e.beta == null) return;
      if (baseBeta === null) baseBeta = e.beta;
      controller.setOptions({
        parallaxX: clamp100((e.gamma / TILT_RANGE_DEG) * 100),
        parallaxY: clamp100(((e.beta - baseBeta) / TILT_RANGE_DEG) * 100),
      });
    };

    window.addEventListener("pointermove", onPointer);
    const hasOrientation = typeof window !== "undefined" && "DeviceOrientationEvent" in window;
    if (hasOrientation) window.addEventListener("deviceorientation", onOrientation);
    return () => {
      window.removeEventListener("pointermove", onPointer);
      if (hasOrientation) window.removeEventListener("deviceorientation", onOrientation);
    };
  }, [controller, reducedMotion]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const artboard = ARTBOARDS[scene];

    let disposed = false;
    let instance: Rive | null = null;

    const onVisibility = () => {
      if (!instance) return;
      if (document.hidden) instance.stopRendering();
      else instance.startRendering();
    };
    document.addEventListener("visibilitychange", onVisibility);

    const resizeObserver =
      typeof ResizeObserver === "undefined"
        ? null
        : new ResizeObserver(() => {
            instance?.resizeDrawingSurfaceToCanvas(cappedPixelRatio());
          });
    resizeObserver?.observe(canvas);

    openRiveFile(RIVE_SCENES_FILE)
      .then((file) => {
        if (disposed) {
          file.cleanup();
          return;
        }
        instance = new Rive({
          canvas,
          riveFile: file,
          artboard: scene,
          stateMachine: artboard.stateMachine,
          autoplay: true,
          autoBind: false,
          enableRiveAssetCDN: false,
          // Cover, not contain: the scene fills the stage and the teacher stands on top of it.
          layout: new Layout({ fit: Fit.Cover, alignment: Alignment.Center }),
          onLoad: () => {
            const r = instance;
            if (disposed || !r) return;
            const vm = r.viewModelByName(artboard.viewModel);
            const vmi = vm?.defaultInstance() ?? vm?.instance() ?? null;
            if (!vmi) {
              if (!warnedLoad) console.warn(`[tutor] ${scene}: no ${artboard.viewModel} instance`);
              warnedLoad = true;
              return;
            }
            r.bindViewModelInstance(vmi);
            controller.attach(portFor(vmi));
            r.resizeDrawingSurfaceToCanvas(cappedPixelRatio());
            if (document.hidden) r.stopRendering();
            setLoadedScene(scene);
          },
          onLoadError: (e) => {
            // The backdrop is decoration: without it the stage keeps its gradient. Log once.
            if (!warnedLoad) {
              const detail = e && typeof e === "object" && "data" in e ? String(e.data) : "unknown error";
              console.warn(`[tutor] ${scene} failed to load, using the gradient backdrop: ${detail}`);
            }
            warnedLoad = true;
          },
        });
      })
      .catch((error: unknown) => {
        if (!warnedLoad) console.warn("[tutor] zai_scenes.riv failed to load, using the gradient backdrop", error);
        warnedLoad = true;
      });

    return () => {
      disposed = true;
      document.removeEventListener("visibilitychange", onVisibility);
      resizeObserver?.disconnect();
      controller.detach();
      if (instance) {
        instance.cleanup();
        instance = null;
      }
    };
  }, [controller, scene]);

  return (
    <div aria-hidden="true" className={`pointer-events-none absolute inset-0 ${className ?? ""}`}>
      <canvas
        ref={canvasRef}
        className={`block h-full w-full transition-opacity duration-700 ${ready ? "opacity-100" : "opacity-0"}`}
      />
    </div>
  );
});
