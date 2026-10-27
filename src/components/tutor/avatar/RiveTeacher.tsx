"use client";

import { forwardRef, useEffect, useImperativeHandle, useMemo, useRef, useState } from "react";
import { Alignment, EventType, Fit, Layout, Rive } from "@rive-app/canvas";
import type { Event as RiveEventObject, RiveEventPayload } from "@rive-app/canvas";
import { ARTBOARDS } from "@/lib/tutor/contract.generated";
import { FpsGuard, TeacherVmController, toAvatarEvent } from "@/lib/tutor/rive-driver";
import type { TeacherLook } from "@/lib/tutor/rive-driver";
import type { AvatarDriver, AvatarProps } from "./types";
import { cappedPixelRatio, openRiveFile, portFor, RIVE_TEACHER_FILE } from "./rive-runtime";

// The Rive teacher behind the AvatarDriver interface. Same props and handle as PlaceholderTeacher, so
// callers can swap the two. Driver calls become TeacherVM writes (see lib/tutor/rive-driver.ts), and
// Rive events come back through onEvent.

export type RiveTeacherProps = AvatarProps & {
  /** "full" draws the Teacher artboard. "bust" draws TeacherBust for chat bubbles and dashboards. */
  variant?: "full" | "bust";
  onReady?: () => void;
  /** Fires once, when the frame rate stays under 45 fps (see FpsGuard). Use it to turn ambience off. */
  onLowPerformance?: () => void;
  /** Called every 2 s with the measured frame rate of the page's animation loop. */
  onFps?: (fps: number) => void;
  onLoadError?: (error: Error) => void;
  /** Accessible name of the canvas. Defaults to "Animated AI teacher". */
  label?: string;
};

const ARTBOARD_NAMES = { full: "Teacher", bust: "TeacherBust" } as const;

function driverOf(c: TeacherVmController): AvatarDriver {
  return {
    playGesture: c.playGesture,
    setMood: c.setMood,
    setViseme: c.setViseme,
    setSpeaking: c.setSpeaking,
    setListening: c.setListening,
    setThinking: c.setThinking,
    lookAt: c.lookAt,
  };
}

function Silhouette() {
  return (
    <div aria-hidden="true" className="pointer-events-none absolute inset-0 flex items-end justify-center">
      <div
        className="mb-[3%] h-[80%] w-[44%] rounded-t-[50%] motion-safe:animate-pulse"
        style={{
          background: "linear-gradient(180deg, rgba(255,235,210,0.22), rgba(255,235,210,0.06) 70%, transparent)",
          filter: "blur(2px)",
        }}
      />
    </div>
  );
}

export const RiveTeacher = forwardRef<AvatarDriver, RiveTeacherProps>(function RiveTeacher(props, ref) {
  const { persona, reducedMotion = false, variant = "full", className, label } = props;
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [controller] = useState(() => new TeacherVmController());
  const driver = useMemo(() => driverOf(controller), [controller]);
  // The variant that finished loading. Compared with the current one, so a switch shows the silhouette
  // again without a synchronous setState inside the effect.
  const [loadedVariant, setLoadedVariant] = useState<string | null>(null);
  const ready = loadedVariant === variant;
  // Latest props for the runtime callbacks, which are created once per effect run.
  const latest = useRef(props);

  useEffect(() => {
    latest.current = props;
  });

  useImperativeHandle(ref, () => driver, [driver]);

  useEffect(() => {
    controller.setLook((persona ?? {}) as Partial<TeacherLook>);
  }, [controller, persona]);

  useEffect(() => {
    controller.setReducedMotion(reducedMotion);
  }, [controller, reducedMotion]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const artboardName = ARTBOARD_NAMES[variant];
    const artboard = ARTBOARDS[artboardName];

    let disposed = false;
    let instance: Rive | null = null;
    let rafId = 0;

    const guard = new FpsGuard({
      onWindow: (fps) => latest.current.onFps?.(fps),
      onLowPerformance: () => latest.current.onLowPerformance?.(),
    });
    const frame = (now: number) => {
      guard.frame(now);
      rafId = requestAnimationFrame(frame);
    };
    const startMeasuring = () => {
      cancelAnimationFrame(rafId);
      guard.reset(performance.now());
      rafId = requestAnimationFrame(frame);
    };

    const fail = (error: Error) => {
      if (!disposed) latest.current.onLoadError?.(error);
    };

    const onRiveEvent = (e: RiveEventObject) => {
      const data = e.data as RiveEventPayload | undefined;
      if (!data || typeof data !== "object" || !("name" in data)) return;
      const avatarEvent = toAvatarEvent(data.name, data.properties as Record<string, unknown> | undefined);
      if (avatarEvent) latest.current.onEvent?.(avatarEvent);
    };

    // Pause rendering while the tab is hidden. The frame guard restarts with a clean window on return.
    const onVisibility = () => {
      if (document.hidden) {
        cancelAnimationFrame(rafId);
        rafId = 0;
        instance?.stopRendering();
      } else if (instance && !disposed) {
        instance.startRendering();
        startMeasuring();
      }
    };
    document.addEventListener("visibilitychange", onVisibility);

    const resizeObserver =
      typeof ResizeObserver === "undefined"
        ? null
        : new ResizeObserver(() => {
            instance?.resizeDrawingSurfaceToCanvas(cappedPixelRatio());
          });
    resizeObserver?.observe(canvas);

    openRiveFile(RIVE_TEACHER_FILE)
      .then((file) => {
        if (disposed) {
          file.cleanup();
          return;
        }
        instance = new Rive({
          canvas,
          riveFile: file,
          artboard: artboardName,
          stateMachine: artboard.stateMachine,
          autoplay: true,
          autoBind: false,
          enableRiveAssetCDN: false,
          layout: new Layout({ fit: Fit.Contain, alignment: Alignment.BottomCenter }),
          onLoad: () => {
            const r = instance;
            if (disposed || !r) return;
            const vm = r.viewModelByName(artboard.viewModel);
            const vmi = vm?.defaultInstance() ?? vm?.instance() ?? null;
            if (!vmi) {
              fail(new Error(`${artboardName}: no ${artboard.viewModel} instance`));
              return;
            }
            r.bindViewModelInstance(vmi);
            controller.attach(portFor(vmi));
            r.on(EventType.RiveEvent, onRiveEvent);
            r.resizeDrawingSurfaceToCanvas(cappedPixelRatio());
            setLoadedVariant(variant);
            latest.current.onReady?.();
            if (document.hidden) {
              r.stopRendering();
            } else {
              startMeasuring();
            }
          },
          onLoadError: (e) => {
            const detail = e && typeof e === "object" && "data" in e ? String(e.data) : "unknown error";
            fail(new Error(`${artboardName} failed to load: ${detail}`));
          },
        });
      })
      .catch((error: unknown) => {
        fail(error instanceof Error ? error : new Error(String(error)));
      });

    return () => {
      disposed = true;
      cancelAnimationFrame(rafId);
      document.removeEventListener("visibilitychange", onVisibility);
      resizeObserver?.disconnect();
      controller.detach();
      if (instance) {
        instance.off(EventType.RiveEvent, onRiveEvent);
        instance.cleanup();
        instance = null;
      }
    };
  }, [controller, variant]);

  return (
    <div className={`relative ${className ?? ""}`}>
      <canvas
        ref={canvasRef}
        role="img"
        aria-label={label ?? "Animated AI teacher"}
        className={`block h-full w-full transition-opacity duration-500 ${ready ? "opacity-100" : "opacity-0"}`}
      />
      {!ready && <Silhouette />}
    </div>
  );
});
