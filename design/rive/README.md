# ZAI teacher Rive files

Runtime files (what the app loads):

| File | Contents |
|---|---|
| `zai_teacher.riv` | `Teacher` (1200x1500) and `TeacherBust` (512x512) artboards, `TeacherVM`, `TeacherSM`, `BustSM` |
| `zai_scenes.riv` | `Scene_TeaHouse`, `Scene_Cafe`, `Scene_Rooftop`, `Scene_Clinic`, `SceneVM`, `SceneSM` |

The names, enums and events are defined by `docs/rive/teacher.contract.json` (currently 1.1.0).
`presets.json` has the view-model values for the five characters (Lín Lǎoshī, Sofía, Camille, Nurse Tendai, Tinashe).
`QA_REPORT.md` has the test results, tested runtime versions and known gaps.

## How the files are made

The `.riv` files are built from text (RML) with the [Rive CLI](https://rive.app). The RML is **generated** by the scripts in `tools/`,
so the characters are edited in code, not in the Rive editor. Do not hand-edit `teacher/scene.rml` or `scenes/scene.rml`; they are overwritten.

```
tools/lib.mjs         paint/shape helpers and the 3D lighting helpers (volume(), cylinder())
tools/art.mjs         face, eyes, hair, torso
tools/faces.mjs       faceStyle variants (face shape, nose, lips, eye form, lashes, brows, beard)
tools/mouth.mjs       the 9 viseme mouths (one set per face style)
tools/arms.mjs        arms and hand poses
tools/variants.mjs    hair, outfit and prop variants
tools/anim.mjs        gestures (IK baked to keyframes), moods, look, state machines
tools/gen_teacher.mjs generates teacher/scene.rml from the contract
tools/gen_scenes.mjs  generates scenes/scene.rml
```

## Regenerating

Requirements: Node 20+, the Rive CLI (`~/.rive/bin/rive`, tested with 1.5.1), Python 3 with Pillow for the preview helpers.

```bash
cd design/rive
node tools/gen_teacher.mjs          # writes teacher/scene.rml
node tools/gen_scenes.mjs           # writes scenes/scene.rml
~/.rive/bin/rive teacher --verify   # compile check (also: rive inspect teacher --summary)
~/.rive/bin/rive scenes --verify
~/.rive/bin/rive teacher --once     # writes teacher/build/zai_teacher.riv
~/.rive/bin/rive scenes --once      # writes scenes/build/zai_scenes.riv
cp teacher/build/zai_teacher.riv zai_teacher.riv
cp scenes/build/zai_scenes.riv zai_scenes.riv
```

Render a frame without a window (set any view-model value with `--data`, fire a gesture with `gesture=` plus `playGesture=1`):

```bash
~/.rive/bin/rive teacher --screenshot=out.png --advance=44 --data=gesture=wave --data=playGesture=1
~/.rive/bin/rive teacher --artboard=TeacherBust --screenshot=bust.png --data=faceStyle=tinashe
tools/render.sh previews/test.png 30                 # regenerate + verify + render
python3 tools/chars.py previews/cast_final.png 30    # all presets side by side
python3 tools/sheet.py out.png wave point_card "count:124:countTo=3"
```

Colour values for `--data` are bare hex (no `#`).

## QA harnesses (`qa/`)

They load the built `.riv` in Chrome. Nothing here is needed at runtime, and the downloaded runtimes, `node_modules` and copies
of the `.riv` files are git-ignored.

```bash
cd design/rive/qa
cp ../zai_teacher.riv ../zai_scenes.riv .
python3 -m http.server 8765 &                 # serve this folder

# 1. event/trigger test, frame stepped with @rive-app/canvas-advanced 2.47.1
mkdir -p v247 && (cd v247 && curl -sLO https://cdn.jsdelivr.net/npm/@rive-app/canvas-advanced@2.47.1/canvas_advanced.mjs && curl -sLO https://cdn.jsdelivr.net/npm/@rive-app/canvas-advanced@2.47.1/rive.wasm)
./run_advanced.sh

# 2. teacher + scene together with CPU throttle (@rive-app/canvas 2.47.1 from the CDN)
node perf_cdp.mjs 4 15                        # 4x throttle, 15 s

# 3. @rive-app/react-canvas 4.37.1 hooks test
cd react-test && npm install && npm run build && cp ../zai_teacher.riv . && cd .. && node react_cdp.mjs
```

## Runtime requirement

Use `@rive-app/canvas` / `canvas-advanced` **2.45 or newer** (2.31.x fires a view-model trigger only once) and `@rive-app/react-canvas` 4.37.1 or newer.
