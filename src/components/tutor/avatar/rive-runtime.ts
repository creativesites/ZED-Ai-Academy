"use client";

import { RiveFile, RuntimeLoader } from "@rive-app/canvas";
import type { ViewModelInstance } from "@rive-app/canvas";
import type { RGB, VmPort } from "@/lib/tutor/rive-driver";

// Rive loading for the teacher and the scenes. Files and the wasm are served from /rive, which is filled
// by `npm run sync:rive` and checked by `npm run check:rive`. Each instance opens its own RiveFile. The
// runtime counts references per file, and cleaning up the last instance releases the file, so a file
// cached for reuse is destroyed on the next scene switch. The HTTP cache keeps the download cheap.

export const RIVE_BASE_URL = "/rive/";
export const RIVE_TEACHER_FILE = "zai_teacher.riv";
export const RIVE_SCENES_FILE = "zai_scenes.riv";

/** Device pixel ratio cap for every Rive canvas. Above this the drawing surface costs more than it shows. */
export const MAX_DEVICE_PIXEL_RATIO = 1.5;

let runtimeConfigured = false;

function configureRuntime(): void {
  if (runtimeConfigured) return;
  runtimeConfigured = true;
  RuntimeLoader.setWasmUrl(`${RIVE_BASE_URL}rive.wasm`);
}

/** Opens a .riv file for one Rive instance. The instance's cleanup() releases it. */
export async function openRiveFile(name: string): Promise<RiveFile> {
  configureRuntime();
  const file = new RiveFile({ src: `${RIVE_BASE_URL}${name}`, enableRiveAssetCDN: false });
  await file.init();
  return file;
}

/** The device pixel ratio, capped. Safe to call on the client only. */
export function cappedPixelRatio(): number {
  const dpr = typeof window === "undefined" ? 1 : window.devicePixelRatio || 1;
  return Math.min(dpr, MAX_DEVICE_PIXEL_RATIO);
}

/** Adapts a runtime view model instance to the controller's port. Accessors are cached per property. */
export function portFor(vmi: ViewModelInstance): VmPort {
  const cache = new Map<string, unknown>();
  const lookup = <T,>(key: string, find: () => T | null): T | null => {
    if (cache.has(key)) return cache.get(key) as T | null;
    const found = find();
    cache.set(key, found);
    return found;
  };
  return {
    setEnum: (name, value) => {
      const p = lookup(`e:${name}`, () => vmi.enum(name));
      if (p) p.value = value;
    },
    setNumber: (name, value) => {
      const p = lookup(`n:${name}`, () => vmi.number(name));
      if (p) p.value = value;
    },
    setBoolean: (name, value) => {
      const p = lookup(`b:${name}`, () => vmi.boolean(name));
      if (p) p.value = value;
    },
    setColor: (name, [r, g, b]: RGB) => {
      lookup(`c:${name}`, () => vmi.color(name))?.rgb(r, g, b);
    },
    fireTrigger: (name) => {
      lookup(`t:${name}`, () => vmi.trigger(name))?.trigger();
    },
  };
}
