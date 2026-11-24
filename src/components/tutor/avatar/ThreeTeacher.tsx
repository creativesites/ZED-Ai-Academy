"use client";

import { forwardRef, useEffect, useImperativeHandle, useMemo, useRef, useState } from "react";
import type * as THREE_NS from "three";
import { composeFaceMorphs, damp, stylizedMouthShape } from "@/lib/tutor/blendshapes";
import type { Gesture, Mood, ToneShape, VisemeValue } from "@/lib/tutor/contract.generated";
import type { SceneArtboard } from "@/lib/tutor/rive-driver";
import { DEFAULT_PERSONA_LOOK, type AvatarDriver, type AvatarProps, type PersonaLook } from "./types";

// Three.js WebGL 3D Talking Avatar behind AvatarDriver.
// Supports both:
// 1. Custom .glb / .gltf 3D models (Ready Player Me, Avaturn, Blender) with automatic Oculus + ARKit
//    morph-target lip-sync, eye blinking, moods, and head/neck gesture motion.
// 2. A built-in stylized 3D starter teacher colored and hair-styled from PersonaLook inside a
//    procedural 3D room environment matching the active scenario scene (Classroom, Studio, TeaHouse,
//    Cafe, Clinic, Rooftop) with RoomEnvironment reflections and dynamic camera motion.

export type ThreeTeacherProps = AvatarProps & {
  variant?: "full" | "bust";
  /** Optional custom .glb/.gltf model URL (Ready Player Me, Avaturn, Blender). */
  glbUrl?: string | null;
  /** Active scenario scene to build a matching procedural 3D environment. */
  sceneName?: SceneArtboard | null;
  onReady?: () => void;
  onLoadError?: (error: Error) => void;
  label?: string;
};

type DriverState = {
  viseme: VisemeValue;
  mood: Mood;
  moodIntensity: number;
  speaking: boolean;
  listening: boolean;
  voiceLevel: number;
  thinking: boolean;
  lookX: number;
  lookY: number;
  reducedMotion: boolean;
  gesture: Gesture;
  gestureStartAt: number;
  gestureDurationMs: number;
  toneShape?: ToneShape;
};

type StylizedRig = {
  root: THREE_NS.Group;
  headGroup: THREE_NS.Group;
  leftEye: THREE_NS.Group;
  rightEye: THREE_NS.Group;
  leftBrow: THREE_NS.Mesh;
  rightBrow: THREE_NS.Mesh;
  mouthMesh: THREE_NS.Mesh;
  leftArm: THREE_NS.Group;
  rightArm: THREE_NS.Group;
  haloRing: THREE_NS.Mesh;
};

type EnvironmentRig = {
  group: THREE_NS.Group;
  floaters: Array<{ mesh: THREE_NS.Mesh; baseY: number; phase: number; speed: number }>;
  bgHex: number;
  fogHex: number;
  keyHex: number;
  rimHex: number;
  hemiSky: number;
  hemiGround: number;
};

function buildSceneEnvironment(
  THREE: typeof THREE_NS,
  sceneName: SceneArtboard | null | undefined,
  variant: "full" | "bust",
): EnvironmentRig {
  const group = new THREE.Group();
  const floaters: EnvironmentRig["floaters"] = [];

  const kind = sceneName ?? "Scene_Classroom";

  // Palette per scene
  let bgHex = 0x1e293b;
  let fogHex = 0x1e293b;
  let keyHex = 0xfff3df;
  let rimHex = 0x38bdf8;
  let hemiSky = 0xfff8ee;
  let hemiGround = 0x2a3548;

  if (kind === "Scene_Classroom") {
    bgHex = 0xf4ece1;
    fogHex = 0xf4ece1;
    keyHex = 0xfff5e4;
    rimHex = 0xfd8b55;
    hemiSky = 0xffffff;
    hemiGround = 0x8a7560;
  } else if (kind === "Scene_Studio") {
    bgHex = 0x101c28;
    fogHex = 0x101c28;
    keyHex = 0xfff1dc;
    rimHex = 0x2dd4bf;
    hemiSky = 0xdbeafe;
    hemiGround = 0x1e1b3a;
  } else if (kind === "Scene_TeaHouse" || kind === "Scene_Cafe") {
    bgHex = 0x2b1d18;
    fogHex = 0x2b1d18;
    keyHex = 0xffe6c2;
    rimHex = 0xfd5523;
    hemiSky = 0xffedd5;
    hemiGround = 0x3b2218;
  } else if (kind === "Scene_Clinic") {
    bgHex = 0xe9f3f6;
    fogHex = 0xe9f3f6;
    keyHex = 0xffffff;
    rimHex = 0x14b8a6;
    hemiSky = 0xf0fdfa;
    hemiGround = 0x64748b;
  } else if (kind === "Scene_Rooftop") {
    bgHex = 0x1c1936;
    fogHex = 0x1c1936;
    keyHex = 0xffddb5;
    rimHex = 0xf472b6;
    hemiSky = 0xfde68a;
    hemiGround = 0x1e1b4b;
  }

  if (variant === "bust") {
    return { group, floaters, bgHex, fogHex, keyHex, rimHex, hemiSky, hemiGround };
  }

  // Back wall subtle depth backdrop
  const wallMat = new THREE.MeshStandardMaterial({
    color: bgHex,
    roughness: 0.92,
    metalness: 0.02,
  });
  const backWall = new THREE.Mesh(new THREE.PlaneGeometry(14, 9), wallMat);
  backWall.position.set(0, 0.5, -2.4);
  group.add(backWall);

  // Foreground desk/table surface
  const deskColor =
    kind === "Scene_Clinic"
      ? 0xf8fafc
      : kind === "Scene_Studio"
        ? 0x1e293b
        : 0x9a6b44;
  const deskMat = new THREE.MeshStandardMaterial({
    color: deskColor,
    roughness: kind === "Scene_Clinic" ? 0.35 : 0.62,
    metalness: kind === "Scene_Studio" ? 0.25 : 0.05,
  });
  const desk = new THREE.Mesh(new THREE.BoxGeometry(5.5, 0.14, 1.4), deskMat);
  desk.position.set(0, -1.24, 0.55);
  group.add(desk);

  if (kind === "Scene_Classroom") {
    // Framed matte chalkboard behind the teacher
    const frameMat = new THREE.MeshStandardMaterial({ color: 0x8b5a2b, roughness: 0.7 });
    const boardMat = new THREE.MeshStandardMaterial({ color: 0x1e4338, roughness: 0.85 });
    const frame = new THREE.Mesh(new THREE.BoxGeometry(3.8, 1.95, 0.08), frameMat);
    frame.position.set(0, 0.55, -2.25);
    const inner = new THREE.Mesh(new THREE.PlaneGeometry(3.55, 1.72), boardMat);
    inner.position.set(0, 0.55, -2.2);
    group.add(frame, inner);
  } else if (kind === "Scene_Studio") {
    // Glowing vertical acoustic light slats
    const panelMat = new THREE.MeshStandardMaterial({ color: 0x1d2b3a, roughness: 0.75 });
    const glowMat = new THREE.MeshStandardMaterial({
      color: 0x2dd4bf,
      emissive: 0x14b8a6,
      emissiveIntensity: 0.8,
      roughness: 0.2,
    });
    const warmGlowMat = new THREE.MeshStandardMaterial({
      color: 0xfd5523,
      emissive: 0xfd5523,
      emissiveIntensity: 0.7,
      roughness: 0.2,
    });
    for (let i = -3; i <= 3; i += 1) {
      if (i === 0) continue;
      const slat = new THREE.Mesh(new THREE.BoxGeometry(0.18, 3.2, 0.08), panelMat);
      slat.position.set(i * 0.65, 0.4, -2.2);
      group.add(slat);
    }
    const leftStrip = new THREE.Mesh(new THREE.BoxGeometry(0.05, 2.4, 0.05), glowMat);
    leftStrip.position.set(-1.65, 0.45, -2.12);
    const rightStrip = new THREE.Mesh(new THREE.BoxGeometry(0.05, 2.4, 0.05), warmGlowMat);
    rightStrip.position.set(1.65, 0.45, -2.12);
    group.add(leftStrip, rightStrip);
  } else if (kind === "Scene_TeaHouse" || kind === "Scene_Cafe") {
    // Cozy pendant lamp + ceramic cup on desk
    const lampMat = new THREE.MeshStandardMaterial({
      color: 0xffd29d,
      emissive: 0xf59e0b,
      emissiveIntensity: 0.85,
      roughness: 0.3,
    });
    const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.24, 24, 24), lampMat);
    lamp.position.set(1.35, 1.45, -1.2);
    group.add(lamp);

    const cupMat = new THREE.MeshStandardMaterial({ color: 0xfef3c7, roughness: 0.25, metalness: 0.05 });
    const cup = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.085, 0.18, 20), cupMat);
    cup.position.set(0.88, -1.08, 0.55);
    group.add(cup);
  } else if (kind === "Scene_Clinic") {
    const stripMat = new THREE.MeshStandardMaterial({
      color: 0x0d9488,
      emissive: 0x14b8a6,
      emissiveIntensity: 0.3,
      roughness: 0.3,
    });
    const strip = new THREE.Mesh(new THREE.BoxGeometry(5.2, 0.08, 0.05), stripMat);
    strip.position.set(0, 1.15, -2.25);
    group.add(strip);
  }

  // Subtle ambient floating bokeh orbs for depth & life
  const orbGeo = new THREE.SphereGeometry(0.055, 12, 12);
  const orbColors = [rimHex, keyHex, 0xfd5523];
  const positions: Array<[number, number, number]> = [
    [-1.7, 0.9, -1.6],
    [1.65, 0.7, -1.5],
    [-1.25, -0.35, -1.3],
    [1.35, -0.25, -1.4],
    [0.2, 1.35, -1.7],
  ];
  positions.forEach(([x, y, z], idx) => {
    const mat = new THREE.MeshBasicMaterial({
      color: orbColors[idx % orbColors.length],
      transparent: true,
      opacity: kind === "Scene_Classroom" || kind === "Scene_Clinic" ? 0.22 : 0.32,
    });
    const orb = new THREE.Mesh(orbGeo, mat);
    orb.position.set(x, y, z);
    group.add(orb);
    floaters.push({ mesh: orb, baseY: y, phase: idx * 1.4, speed: 0.7 + idx * 0.15 });
  });

  return { group, floaters, bgHex, fogHex, keyHex, rimHex, hemiSky, hemiGround };
}

function buildStylizedTeacher(THREE: typeof THREE_NS, look: PersonaLook): StylizedRig {
  const root = new THREE.Group();

  const skinMat = new THREE.MeshStandardMaterial({
    color: new THREE.Color(look.skinColor),
    roughness: 0.55,
    metalness: 0.04,
  });
  const hairMat = new THREE.MeshStandardMaterial({
    color: new THREE.Color(look.hairColor),
    roughness: 0.72,
    metalness: 0.08,
  });
  const outfitMat = new THREE.MeshStandardMaterial({
    color: new THREE.Color(look.outfitPrimary),
    roughness: 0.65,
    metalness: 0.05,
  });
  const collarMat = new THREE.MeshStandardMaterial({
    color: new THREE.Color(look.outfitSecondary),
    roughness: 0.6,
  });
  const accentMat = new THREE.MeshStandardMaterial({
    color: new THREE.Color(look.accentColor),
    roughness: 0.35,
    metalness: 0.25,
    emissive: new THREE.Color(look.accentColor),
    emissiveIntensity: 0.12,
  });
  const whiteMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.2 });
  const pupilMat = new THREE.MeshStandardMaterial({ color: 0x16121f, roughness: 0.15, metalness: 0.1 });
  const mouthMat = new THREE.MeshStandardMaterial({ color: 0x7c2d3c, roughness: 0.45 });

  // Torso & shoulders
  const torso = new THREE.Mesh(new THREE.CylinderGeometry(0.46, 0.64, 1.05, 32), outfitMat);
  torso.position.set(0, -0.82, 0);
  root.add(torso);

  const collar = new THREE.Mesh(new THREE.TorusGeometry(0.3, 0.075, 16, 32), collarMat);
  collar.rotation.x = Math.PI / 2;
  collar.position.set(0, -0.32, 0.02);
  root.add(collar);

  // Neck
  const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.19, 0.28, 24), skinMat);
  neck.position.set(0, -0.22, 0);
  root.add(neck);

  // Arms for wave / explain / thumbs_up / celebrate
  const leftArm = new THREE.Group();
  leftArm.position.set(-0.56, -0.52, 0);
  const leftLimb = new THREE.Mesh(new THREE.CapsuleGeometry(0.12, 0.45, 8, 16), outfitMat);
  leftLimb.position.set(0, -0.22, 0);
  const leftHand = new THREE.Mesh(new THREE.SphereGeometry(0.125, 16, 16), skinMat);
  leftHand.position.set(0, -0.5, 0);
  leftArm.add(leftLimb, leftHand);
  root.add(leftArm);

  const rightArm = new THREE.Group();
  rightArm.position.set(0.56, -0.52, 0);
  const rightLimb = new THREE.Mesh(new THREE.CapsuleGeometry(0.12, 0.45, 8, 16), outfitMat);
  rightLimb.position.set(0, -0.22, 0);
  const rightHand = new THREE.Mesh(new THREE.SphereGeometry(0.125, 16, 16), skinMat);
  rightHand.position.set(0, -0.5, 0);
  rightArm.add(rightLimb, rightHand);
  root.add(rightArm);

  // Head group
  const headGroup = new THREE.Group();
  headGroup.position.set(0, 0.28, 0);
  root.add(headGroup);

  const head = new THREE.Mesh(new THREE.SphereGeometry(0.48, 36, 36), skinMat);
  head.scale.set(0.96, 1.05, 0.94);
  headGroup.add(head);

  // Ears
  const earGeo = new THREE.SphereGeometry(0.09, 16, 16);
  const leftEar = new THREE.Mesh(earGeo, skinMat);
  leftEar.position.set(-0.45, -0.02, -0.02);
  const rightEar = new THREE.Mesh(earGeo, skinMat);
  rightEar.position.set(0.45, -0.02, -0.02);
  headGroup.add(leftEar, rightEar);

  // Nose
  const nose = new THREE.Mesh(new THREE.SphereGeometry(0.055, 16, 16), skinMat);
  nose.scale.set(0.9, 1.25, 1.0);
  nose.position.set(0, -0.04, 0.44);
  headGroup.add(nose);

  // Hair variations based on PersonaLook.hairStyle
  const hairCap = new THREE.Mesh(
    new THREE.SphereGeometry(0.505, 32, 24, 0, Math.PI * 2, 0, Math.PI * 0.58),
    hairMat,
  );
  hairCap.position.set(0, 0.06, -0.02);
  hairCap.rotation.x = -0.18;
  headGroup.add(hairCap);

  if (look.hairStyle === "bun") {
    const bun = new THREE.Mesh(new THREE.SphereGeometry(0.22, 24, 24), hairMat);
    bun.position.set(0, 0.56, -0.16);
    headGroup.add(bun);
  } else if (look.hairStyle === "curly") {
    const puffOffsets = [
      [-0.44, 0.14, -0.06],
      [0.44, 0.14, -0.06],
      [-0.38, -0.14, -0.12],
      [0.38, -0.14, -0.12],
      [0, 0.44, -0.12],
    ];
    for (const [x, y, z] of puffOffsets) {
      const puff = new THREE.Mesh(new THREE.SphereGeometry(0.18, 18, 18), hairMat);
      puff.position.set(x, y, z);
      headGroup.add(puff);
    }
  } else if (look.hairStyle === "bob" || look.hairStyle === "braids") {
    const sideGeo = new THREE.CapsuleGeometry(0.13, 0.36, 8, 16);
    const leftSide = new THREE.Mesh(sideGeo, hairMat);
    leftSide.position.set(-0.42, -0.08, -0.06);
    const rightSide = new THREE.Mesh(sideGeo, hairMat);
    rightSide.position.set(0.42, -0.08, -0.06);
    headGroup.add(leftSide, rightSide);
  }

  // Eyes (with gaze pupils)
  function makeEye(x: number) {
    const g = new THREE.Group();
    g.position.set(x, 0.06, 0.41);
    const sclera = new THREE.Mesh(new THREE.SphereGeometry(0.085, 20, 20), whiteMat);
    sclera.scale.set(1, 1.05, 0.65);
    const pupil = new THREE.Mesh(new THREE.SphereGeometry(0.048, 16, 16), pupilMat);
    pupil.position.set(0, 0, 0.045);
    const glint = new THREE.Mesh(new THREE.SphereGeometry(0.015, 10, 10), whiteMat);
    glint.position.set(0.02, 0.02, 0.082);
    g.add(sclera, pupil, glint);
    return g;
  }
  const leftEye = makeEye(-0.165);
  const rightEye = makeEye(0.165);
  headGroup.add(leftEye, rightEye);

  // Eyebrows
  const browGeo = new THREE.CapsuleGeometry(0.022, 0.13, 6, 12);
  const leftBrow = new THREE.Mesh(browGeo, hairMat);
  leftBrow.rotation.z = Math.PI / 2;
  leftBrow.position.set(-0.165, 0.21, 0.42);
  const rightBrow = new THREE.Mesh(browGeo, hairMat);
  rightBrow.rotation.z = Math.PI / 2;
  rightBrow.position.set(0.165, 0.21, 0.42);
  headGroup.add(leftBrow, rightBrow);

  // Subtle rosy cheeks for warmth
  const cheekMat = new THREE.MeshStandardMaterial({
    color: 0xfb7185,
    roughness: 0.7,
    transparent: true,
    opacity: 0.22,
  });
  const cheekGeo = new THREE.SphereGeometry(0.068, 14, 14);
  const leftCheek = new THREE.Mesh(cheekGeo, cheekMat);
  leftCheek.scale.set(1.25, 0.75, 0.4);
  leftCheek.position.set(-0.27, -0.07, 0.38);
  const rightCheek = new THREE.Mesh(cheekGeo, cheekMat);
  rightCheek.scale.set(1.25, 0.75, 0.4);
  rightCheek.position.set(0.27, -0.07, 0.38);
  headGroup.add(leftCheek, rightCheek);

  // Optional stylish round glasses for blazer/academic or book/clipboard teachers
  if (look.outfitStyle === "blazer" || look.prop === "book" || look.prop === "clipboard") {
    const frameMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.25, metalness: 0.75 });
    const lensGeo = new THREE.TorusGeometry(0.115, 0.012, 10, 28);
    const leftLens = new THREE.Mesh(lensGeo, frameMat);
    leftLens.position.set(-0.165, 0.06, 0.47);
    const rightLens = new THREE.Mesh(lensGeo, frameMat);
    rightLens.position.set(0.165, 0.06, 0.47);
    const bridge = new THREE.Mesh(new THREE.CylinderGeometry(0.009, 0.009, 0.1, 8), frameMat);
    bridge.rotation.z = Math.PI / 2;
    bridge.position.set(0, 0.07, 0.47);
    headGroup.add(leftLens, rightLens, bridge);
  }

  // Articulated mouth (scales smoothly with visemes)
  const mouthMesh = new THREE.Mesh(new THREE.CapsuleGeometry(0.045, 0.08, 8, 16), mouthMat);
  mouthMesh.rotation.z = Math.PI / 2;
  mouthMesh.position.set(0, -0.2, 0.43);
  headGroup.add(mouthMesh);

  // Subtle blazer lapels on torso
  const lapelGeo = new THREE.BoxGeometry(0.16, 0.5, 0.06);
  const leftLapel = new THREE.Mesh(lapelGeo, collarMat);
  leftLapel.position.set(-0.16, -0.58, 0.43);
  leftLapel.rotation.z = -0.22;
  const rightLapel = new THREE.Mesh(lapelGeo, collarMat);
  rightLapel.position.set(0.16, -0.58, 0.43);
  rightLapel.rotation.z = 0.22;
  root.add(leftLapel, rightLapel);

  // Subtle ambient halo behind the teacher that pulses while speaking / listening / thinking
  const haloRing = new THREE.Mesh(new THREE.TorusGeometry(0.86, 0.022, 12, 64), accentMat);
  haloRing.position.set(0, 0.12, -0.55);
  root.add(haloRing);

  return {
    root,
    headGroup,
    leftEye,
    rightEye,
    leftBrow,
    rightBrow,
    mouthMesh,
    leftArm,
    rightArm,
    haloRing,
  };
}

export const ThreeTeacher = forwardRef<AvatarDriver, ThreeTeacherProps>(function ThreeTeacher(props, ref) {
  const { persona, reducedMotion = false, variant = "full", glbUrl, sceneName, className, label } = props;
  const containerRef = useRef<HTMLDivElement>(null);
  const [ready, setReady] = useState(false);

  const latestProps = useRef(props);
  useEffect(() => {
    latestProps.current = props;
  });

  const mergedLook = useMemo<PersonaLook>(
    () => ({ ...DEFAULT_PERSONA_LOOK, ...persona }),
    [persona],
  );

  const stateRef = useRef<DriverState>({
    viseme: 0,
    mood: "warm",
    moodIntensity: 70,
    speaking: false,
    listening: false,
    voiceLevel: 0,
    thinking: false,
    lookX: 0,
    lookY: 0,
    reducedMotion,
    gesture: "idle",
    gestureStartAt: 0,
    gestureDurationMs: 0,
  });

  useEffect(() => {
    stateRef.current.reducedMotion = reducedMotion;
  }, [reducedMotion]);

  const gestureTimers = useRef<number[]>([]);

  const driver = useMemo<AvatarDriver>(
    () => ({
      playGesture(name, opts) {
        const now = performance.now();
        const duration = name === "celebrate" ? 1300 : name === "wave" ? 1100 : 850;
        stateRef.current.gesture = name;
        stateRef.current.gestureStartAt = now;
        stateRef.current.gestureDurationMs = duration;
        stateRef.current.toneShape = opts?.toneShape;

        for (const t of gestureTimers.current) window.clearTimeout(t);
        gestureTimers.current = [];

        latestProps.current.onEvent?.({ type: "gestureStart", gesture: name, toneShape: opts?.toneShape });
        const peakTimer = window.setTimeout(() => {
          latestProps.current.onEvent?.({ type: "gesturePeak", gesture: name, toneShape: opts?.toneShape });
        }, Math.round(duration * 0.45));
        const endTimer = window.setTimeout(() => {
          stateRef.current.gesture = "idle";
          latestProps.current.onEvent?.({ type: "gestureEnd", gesture: name, toneShape: opts?.toneShape });
        }, duration);
        gestureTimers.current.push(peakTimer, endTimer);
      },
      setMood(mood, intensity = 70) {
        stateRef.current.mood = mood;
        stateRef.current.moodIntensity = intensity;
      },
      setViseme(v) {
        stateRef.current.viseme = v;
      },
      setSpeaking(on) {
        stateRef.current.speaking = on;
        if (!on) stateRef.current.viseme = 0;
      },
      setListening(on, voiceLevel = 0) {
        stateRef.current.listening = on;
        stateRef.current.voiceLevel = voiceLevel;
      },
      setThinking(on) {
        stateRef.current.thinking = on;
      },
      lookAt(x, y) {
        stateRef.current.lookX = x;
        stateRef.current.lookY = y;
      },
    }),
    [],
  );

  useImperativeHandle(ref, () => driver, [driver]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    let disposed = false;
    let rafId = 0;
    let renderer: THREE_NS.WebGLRenderer | null = null;
    let resizeObserver: ResizeObserver | null = null;
    let onVisibility: (() => void) | null = null;
    let onPointerMove: ((e: PointerEvent) => void) | null = null;
    let pmrem: THREE_NS.PMREMGenerator | null = null;
    let envTex: THREE_NS.Texture | null = null;

    async function boot() {
      const THREE = await import("three");
      if (disposed || !container) return;

      const width = Math.max(1, container.clientWidth);
      const height = Math.max(1, container.clientHeight);

      const envRig = buildSceneEnvironment(THREE, sceneName, variant);
      const scene = new THREE.Scene();
      if (variant === "full") {
        scene.background = new THREE.Color(envRig.bgHex);
        scene.fog = new THREE.Fog(envRig.fogHex, 4.5, 11);
      }
      scene.add(envRig.group);

      const baseCamZ = variant === "bust" ? 2.35 : 3.05;
      const baseCamY = variant === "bust" ? 0.24 : 0.08;
      const camera = new THREE.PerspectiveCamera(variant === "bust" ? 30 : 34, width / height, 0.1, 50);
      camera.position.set(0, baseCamY, baseCamZ);
      camera.lookAt(0, variant === "bust" ? 0.2 : 0.02, 0);

      try {
        renderer = new THREE.WebGLRenderer({ antialias: true, alpha: variant === "bust", powerPreference: "high-performance" });
      } catch (err) {
        latestProps.current.onLoadError?.(err instanceof Error ? err : new Error("WebGL unavailable"));
        return;
      }

      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
      renderer.setSize(width, height, false);
      renderer.outputColorSpace = THREE.SRGBColorSpace;
      renderer.toneMapping = THREE.ACESFilmicToneMapping;
      renderer.toneMappingExposure = 1.06;
      renderer.domElement.style.width = "100%";
      renderer.domElement.style.height = "100%";
      renderer.domElement.style.display = "block";
      container.innerHTML = "";
      container.appendChild(renderer.domElement);

      // Subtle PMREM RoomEnvironment for studio-grade reflections on eyes, skin, and GLB materials
      try {
        const { RoomEnvironment } = await import("three/examples/jsm/environments/RoomEnvironment.js");
        if (!disposed && renderer) {
          pmrem = new THREE.PMREMGenerator(renderer);
          envTex = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
          scene.environment = envTex;
        }
      } catch {
        // Non-fatal: 3-point lights still illuminate the scene cleanly
      }

      // Scene-tuned 3-point studio lighting
      const hemi = new THREE.HemisphereLight(envRig.hemiSky, envRig.hemiGround, 1.25);
      scene.add(hemi);

      const keyLight = new THREE.DirectionalLight(envRig.keyHex, 1.45);
      keyLight.position.set(2.2, 3.0, 3.2);
      scene.add(keyLight);

      const rimLight = new THREE.DirectionalLight(envRig.rimHex, 0.9);
      rimLight.position.set(-2.5, 1.8, -2.0);
      scene.add(rimLight);

      // Gentle pointer parallax on desktop
      let parallaxX = 0;
      let parallaxY = 0;
      if (variant === "full") {
        onPointerMove = (e: PointerEvent) => {
          const rect = container.getBoundingClientRect();
          if (rect.width <= 0 || rect.height <= 0) return;
          const nx = ((e.clientX - rect.left) / rect.width - 0.5) * 2;
          const ny = ((e.clientY - rect.top) / rect.height - 0.5) * 2;
          parallaxX = Math.max(-1, Math.min(1, nx)) * 0.12;
          parallaxY = Math.max(-1, Math.min(1, -ny)) * 0.06;
        };
        container.addEventListener("pointermove", onPointerMove, { passive: true });
      }

      // Load custom GLB if provided; otherwise build the stylized 3D starter teacher
      let stylized: StylizedRig | null = null;
      let glbRoot: THREE_NS.Object3D | null = null;
      let glbHeadBone: THREE_NS.Object3D | null = null;
      const morphMeshes: Array<THREE_NS.Mesh> = [];

      if (glbUrl && glbUrl.trim().length > 0) {
        try {
          const { GLTFLoader } = await import("three/examples/jsm/loaders/GLTFLoader.js");
          const loader = new GLTFLoader();
          const gltf = await loader.loadAsync(glbUrl.trim());
          if (disposed) return;

          glbRoot = gltf.scene;
          const box = new THREE.Box3().setFromObject(glbRoot);
          const size = box.getSize(new THREE.Vector3());
          const center = box.getCenter(new THREE.Vector3());
          const maxDim = Math.max(size.x, size.y, size.z, 0.001);
          const scale = (variant === "bust" ? 1.85 : 2.1) / maxDim;
          glbRoot.scale.setScalar(scale);
          glbRoot.position.set(-center.x * scale, -center.y * scale - (variant === "bust" ? 0.35 : 0.1), -center.z * scale);

          glbRoot.traverse((obj) => {
            const mesh = obj as THREE_NS.Mesh;
            if (mesh.isMesh && mesh.morphTargetDictionary && mesh.morphTargetInfluences) {
              morphMeshes.push(mesh);
            }
            if (!glbHeadBone && /head|neck/i.test(obj.name)) {
              glbHeadBone = obj;
            }
          });
          scene.add(glbRoot);
        } catch (err) {
          console.warn("[ThreeTeacher] Custom GLB failed to load, falling back to stylized 3D teacher.", err);
          stylized = buildStylizedTeacher(THREE, mergedLook);
          scene.add(stylized.root);
        }
      } else {
        stylized = buildStylizedTeacher(THREE, mergedLook);
        scene.add(stylized.root);
      }

      const handleResize = () => {
        if (!container || !renderer) return;
        const w = Math.max(1, container.clientWidth);
        const h = Math.max(1, container.clientHeight);
        camera.aspect = w / h;
        camera.updateProjectionMatrix();
        renderer.setSize(w, h, false);
      };
      resizeObserver = typeof ResizeObserver !== "undefined" ? new ResizeObserver(handleResize) : null;
      resizeObserver?.observe(container);

      setReady(true);
      latestProps.current.onReady?.();

      let lastTime = performance.now();
      let nextBlinkAt = lastTime + 2600;
      let mouthOpen = 0.08;
      let mouthWidth = 1.0;

      const animate = (now: number) => {
        if (disposed || !renderer) return;
        const dt = Math.min(0.05, Math.max(0.001, (now - lastTime) / 1000));
        lastTime = now;
        const t = now / 1000;
        const st = stateRef.current;

        // Periodic natural eye blink
        let blink = 0;
        if (!st.reducedMotion) {
          const sinceBlink = now - nextBlinkAt;
          if (sinceBlink >= 0 && sinceBlink < 140) {
            blink = Math.sin((sinceBlink / 140) * Math.PI);
          } else if (sinceBlink >= 140) {
            nextBlinkAt = now + 2400 + Math.random() * 2600;
          }
        }

        // Compute gesture offsets
        let gesturePitch = 0;
        let gestureYaw = 0;
        let rightArmZ = -0.15;
        let leftArmZ = 0.15;

        if (st.gesture !== "idle" && st.gestureDurationMs > 0) {
          const p = Math.min(1, (now - st.gestureStartAt) / st.gestureDurationMs);
          const waveEnv = Math.sin(p * Math.PI);
          if (st.gesture === "nod") gesturePitch = Math.sin(p * Math.PI * 3) * 0.22 * waveEnv;
          else if (st.gesture === "head_shake") gestureYaw = Math.sin(p * Math.PI * 4) * 0.28 * waveEnv;
          else if (st.gesture === "wave") rightArmZ = -0.15 + waveEnv * 2.1 + Math.sin(p * Math.PI * 6) * 0.25 * waveEnv;
          else if (st.gesture === "celebrate") {
            rightArmZ = -0.15 + waveEnv * 2.3;
            leftArmZ = 0.15 - waveEnv * 2.3;
            gesturePitch = -0.1 * waveEnv;
          } else if (st.gesture === "explain" || st.gesture === "thumbs_up") {
            rightArmZ = -0.15 + waveEnv * 1.1;
          } else if (st.gesture === "think") {
            gesturePitch = -0.14 * waveEnv;
            gestureYaw = 0.18 * waveEnv;
          }
        }

        const targetYaw = (st.lookX / 100) * 0.32 + gestureYaw;
        const targetPitch = (st.lookY / 100) * 0.22 + gesturePitch + (st.thinking ? -0.1 : 0);

        // Animate custom GLB morph targets & head bone
        if (glbRoot) {
          const morphs = composeFaceMorphs({
            viseme: st.viseme,
            mood: st.mood,
            moodIntensity: st.moodIntensity,
            blink,
          });
          for (const mesh of morphMeshes) {
            const dict = mesh.morphTargetDictionary!;
            const infl = mesh.morphTargetInfluences!;
            for (const [name, idx] of Object.entries(dict)) {
              const target = morphs[name] ?? 0;
              infl[idx] = damp(infl[idx] ?? 0, target, 18, dt);
            }
          }
          if (glbHeadBone) {
            glbHeadBone.rotation.y = damp(glbHeadBone.rotation.y, targetYaw, 8, dt);
            glbHeadBone.rotation.x = damp(glbHeadBone.rotation.x, targetPitch, 8, dt);
          } else if (!st.reducedMotion) {
            glbRoot.rotation.y = damp(glbRoot.rotation.y, targetYaw * 0.5, 6, dt);
          }
        }

        // Animate built-in stylized 3D teacher
        if (stylized) {
          const breathe = st.reducedMotion ? 0 : Math.sin(t * 2.1) * 0.025;
          stylized.root.position.y = breathe;
          stylized.headGroup.rotation.y = damp(stylized.headGroup.rotation.y, targetYaw, 8, dt);
          stylized.headGroup.rotation.x = damp(stylized.headGroup.rotation.x, targetPitch, 8, dt);

          const eyeScaleY = Math.max(0.08, 1 - blink * 0.92);
          stylized.leftEye.scale.y = eyeScaleY;
          stylized.rightEye.scale.y = eyeScaleY;

          // Eyebrow mood expression
          const browLift =
            st.mood === "surprised" || st.mood === "curious"
              ? 0.045
              : st.mood === "happy" || st.mood === "proud"
                ? 0.025
                : st.mood === "concerned"
                  ? -0.02
                  : 0;
          stylized.leftBrow.position.y = damp(stylized.leftBrow.position.y, 0.21 + browLift, 10, dt);
          stylized.rightBrow.position.y = damp(stylized.rightBrow.position.y, 0.21 + browLift, 10, dt);

          // Viseme mouth articulation
          const targetMouth = stylizedMouthShape(st.viseme);
          mouthOpen = damp(mouthOpen, targetMouth.openY, 22, dt);
          mouthWidth = damp(mouthWidth, targetMouth.widthX, 18, dt);
          stylized.mouthMesh.scale.set(0.55 + mouthOpen * 1.4, mouthWidth, 1);

          // Arms
          stylized.rightArm.rotation.z = damp(stylized.rightArm.rotation.z, rightArmZ, 10, dt);
          stylized.leftArm.rotation.z = damp(stylized.leftArm.rotation.z, leftArmZ, 10, dt);

          // Halo ring subtle pulse
          const haloScale = st.speaking
            ? 1.03 + Math.sin(t * 8) * 0.03
            : st.listening
              ? 1.04 + (st.voiceLevel / 100) * 0.08
              : 1.0;
          stylized.haloRing.scale.setScalar(damp(stylized.haloRing.scale.x, haloScale, 8, dt));
        }

        // Dynamic camera framing: gentle push-in on celebrate/listening + soft parallax
        if (!st.reducedMotion && variant === "full") {
          const zoomOffset = st.gesture === "celebrate" ? -0.22 : st.listening ? -0.1 : 0;
          camera.position.x = damp(camera.position.x, parallaxX, 4, dt);
          camera.position.y = damp(camera.position.y, baseCamY + parallaxY, 4, dt);
          camera.position.z = damp(camera.position.z, baseCamZ + zoomOffset, 3.5, dt);
          camera.lookAt(0, 0.02, 0);
        }

        // Subtle floating ambient bokeh orbs
        if (!st.reducedMotion) {
          for (const f of envRig.floaters) {
            f.mesh.position.y = f.baseY + Math.sin(t * f.speed + f.phase) * 0.09;
          }
        }

        renderer.render(scene, camera);
        rafId = requestAnimationFrame(animate);
      };

      onVisibility = () => {
        if (document.hidden) {
          cancelAnimationFrame(rafId);
          rafId = 0;
        } else if (!disposed && !rafId) {
          lastTime = performance.now();
          rafId = requestAnimationFrame(animate);
        }
      };
      document.addEventListener("visibilitychange", onVisibility);

      if (!document.hidden) {
        rafId = requestAnimationFrame(animate);
      }
    }

    void boot();

    return () => {
      disposed = true;
      cancelAnimationFrame(rafId);
      for (const t of gestureTimers.current) window.clearTimeout(t);
      gestureTimers.current = [];
      if (onVisibility) document.removeEventListener("visibilitychange", onVisibility);
      if (onPointerMove) container.removeEventListener("pointermove", onPointerMove);
      resizeObserver?.disconnect();
      envTex?.dispose();
      pmrem?.dispose();
      if (renderer) {
        renderer.dispose();
        renderer = null;
      }
    };
  }, [glbUrl, mergedLook, sceneName, variant]);

  return (
    <div
      ref={containerRef}
      role="img"
      aria-label={label ?? "Animated 3D AI teacher"}
      className={`relative h-full w-full transition-opacity duration-300 ${ready ? "opacity-100" : "opacity-0"} ${className ?? ""}`}
    />
  );
});
