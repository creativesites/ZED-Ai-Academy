"use client";

import { forwardRef, useEffect, useImperativeHandle, useMemo, useRef, useState } from "react";
import type * as THREE_NS from "three";
import { composeFaceMorphs, damp, stylizedMouthShape } from "@/lib/tutor/blendshapes";
import type { Gesture, Mood, ToneShape, VisemeValue } from "@/lib/tutor/contract.generated";
import { DEFAULT_PERSONA_LOOK, type AvatarDriver, type AvatarProps, type PersonaLook } from "./types";

// Three.js WebGL 3D Talking Avatar behind AvatarDriver.
// Supports both:
// 1. Custom .glb / .gltf 3D models (Ready Player Me, Avaturn, Blender) with automatic Oculus + ARKit
//    morph-target lip-sync, eye blinking, moods, and head/neck gesture motion.
// 2. A built-in stylized 3D starter teacher colored and hair-styled from PersonaLook so 3D works
//    out of the box with zero external files or GPU backend.

export type ThreeTeacherProps = AvatarProps & {
  variant?: "full" | "bust";
  /** Optional custom .glb/.gltf model URL (Ready Player Me, Avaturn, Blender). */
  glbUrl?: string | null;
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

  // Articulated mouth (scales smoothly with visemes)
  const mouthMesh = new THREE.Mesh(new THREE.CapsuleGeometry(0.045, 0.08, 8, 16), mouthMat);
  mouthMesh.rotation.z = Math.PI / 2;
  mouthMesh.position.set(0, -0.2, 0.43);
  headGroup.add(mouthMesh);

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
  const { persona, reducedMotion = false, variant = "full", glbUrl, className, label } = props;
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

    async function boot() {
      const THREE = await import("three");
      if (disposed || !container) return;

      const width = Math.max(1, container.clientWidth);
      const height = Math.max(1, container.clientHeight);

      const scene = new THREE.Scene();
      const camera = new THREE.PerspectiveCamera(variant === "bust" ? 30 : 34, width / height, 0.1, 50);
      camera.position.set(0, variant === "bust" ? 0.24 : 0.05, variant === "bust" ? 2.35 : 3.2);
      camera.lookAt(0, variant === "bust" ? 0.2 : -0.05, 0);

      try {
        renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: "high-performance" });
      } catch (err) {
        latestProps.current.onLoadError?.(err instanceof Error ? err : new Error("WebGL unavailable"));
        return;
      }

      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
      renderer.setSize(width, height, false);
      renderer.outputColorSpace = THREE.SRGBColorSpace;
      renderer.domElement.style.width = "100%";
      renderer.domElement.style.height = "100%";
      renderer.domElement.style.display = "block";
      container.innerHTML = "";
      container.appendChild(renderer.domElement);

      // Warm 3-point studio lighting
      const hemi = new THREE.HemisphereLight(0xfff5e8, 0x3b2d5a, 1.35);
      scene.add(hemi);

      const keyLight = new THREE.DirectionalLight(0xfff1dc, 1.5);
      keyLight.position.set(2.2, 3.0, 3.2);
      scene.add(keyLight);

      const rimLight = new THREE.DirectionalLight(0xff9f68, 0.75);
      rimLight.position.set(-2.5, 1.8, -2.0);
      scene.add(rimLight);

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
      resizeObserver?.disconnect();
      if (renderer) {
        renderer.dispose();
        renderer = null;
      }
    };
  }, [glbUrl, mergedLook, variant]);

  return (
    <div
      ref={containerRef}
      role="img"
      aria-label={label ?? "Animated 3D AI teacher"}
      className={`relative h-full w-full transition-opacity duration-300 ${ready ? "opacity-100" : "opacity-0"} ${className ?? ""}`}
    />
  );
});
