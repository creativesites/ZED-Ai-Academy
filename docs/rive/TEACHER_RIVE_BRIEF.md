# ZAI Teacher Characters — Rive Production Brief

Version 1.0 · 2026-10-27
Audience: the agent (and any human animator) building the Rive files.
Companion files:
- `docs/rive/teacher.contract.json`: **exact names, types, enums, events and paths. Build to it. Don't rename anything.**
- `docs/prototypes/speaking-room.html`: motion and scene reference (open it in a browser). It shows the gesture vocabulary, timing, scenes and how the app reacts to events. Its character art is a code placeholder; your job is to replace it with real, warm, professional character art.
- `docs/LANGUAGE_LEARNING_PLAN.md` §5 for product context.

---

## 1. What we're making and why

ZAI Academy is adding AI language teachers (Mandarin first, then Spanish and French; a nurse for healthcare training). A learner talks to the teacher out loud; an AI (Gemini) decides what she says and which gesture to play. Your Rive file is the teacher's body and face. The app drives it through a view model in real time:

```
AI decides:  say("你好")  gesture("point_card")  mood("happy")
App does:    plays audio → sets viseme 30–60×/s, sets gesture + fires playGesture, sets mood
Rive does:   animates, blends, returns to idle, fires gesturePeak / gestureEnd events
App reacts:  launches the flashcard UI at gesturePeak, draws tone trail between traceStart / traceEnd
```

The same `.riv` runs on the web (Next.js, `@rive-app/react-canvas` or the WebGL2 variant) and in a React Native app. It has to look great, feel alive when idle, and run at 60 fps on a cheap Android phone.

## 2. Art direction: Duolingo-like warmth, our own characters

**Target feeling:** a friendly, encouraging teacher you want to see every day. Warm, playful, never childish. Adults (including healthcare professionals) must take her seriously; teens must not find her cringe.

**Inspiration, not imitation.** Learn from Duolingo's approach (bold flat shapes, huge expressive eyes, big readable poses, rubbery appeal). **Don't copy any Duolingo character** (Lily, Duo, Zari, etc.) or their exact proportions, palette or silhouettes. Our characters must be clearly original.

### 2.1 Shape language
- Built from **simple, chunky, rounded geometric shapes**. Circles and soft rounded rectangles; no thin spindly parts.
- **No black outlines.** Use flat colour with one shadow tone and one highlight tone per material. If an edge needs separation, use a slightly darker shade of the same hue.
- **Proportions (half-body frame):** head ≈ 40% of visible height. Large head, narrow neck (short), soft rounded shoulders, slightly short chunky arms, **big readable hands** (four fingers + thumb is fine; mitten-like simplicity is fine).
- **Eyes:** big, slightly vertical ovals with a large dark iris and 1–2 white highlights. Eyes do most of the acting.
- **Brows:** thick, separate shapes; they move a lot.
- **Mouth:** simple shape that changes a lot (see visemes). Show teeth as one white shape and a tongue shape when open.
- **Hair:** strong, simple silhouette in 2–4 big shapes, with overlap/secondary motion on the tips.

### 2.2 Colour
- Warm, saturated, friendly. Skin tones warm and natural (never grey). Each character has one hero outfit colour.
- Colours must be **data-bound** (see §5) so personas and tenants can recolour without new art. Build every fill that uses skin, hair, outfit or accent from the bound colour, and derive shade/highlight as separate bound colours or as overlay shapes with blend/opacity so recolouring still looks good.
- Test that every character still reads on a dark dusk scene (our scenes are mostly evening-lit) and on a plain light background.

### 2.3 Motion principles
- **Never fully still.** Idle has breathing, micro weight shifts, blinks (every 2–6 s, sometimes double), small eye saccades, hair/earring overlap.
- **Snappy anticipation, soft settle.** Gestures have a small anticipation (3–6 frames), a fast action and an overshoot settle. Ease, never linear.
- **Big poses, clear silhouettes.** Every gesture must read as a silhouette at 120 px tall.
- **Squash and stretch, lightly.** On the head and hands during celebrate, thumbs_up and nod. Never rubbery on the face during speech.
- **Listening is acting.** The listening loop is as important as speaking: lean in, soft nods scaled by `voiceLevel`, attentive eyes, occasional encouraging micro-smile.
- **Thinking hides latency.** The `thinking` loop (eyes up and to the side, small "hmm" mouth, finger to chin) plays while the AI prepares a reply. It must loop seamlessly for up to ~4 s.
- **Reduced motion.** When `reducedMotion` is true: no bouncing, half amplitude on secondary motion and gestures, blinks and lip-sync unchanged.

## 3. The cast (v1)

All four share **one rig** (same skeleton, same state machine, same view model) and differ by bound colours, `hairStyle`, `outfitStyle` and `prop`. Build Lín Lǎoshī first; she is the hero and the client demo.

| Character | Role | Personality → acting notes | Look | Defaults |
|---|---|---|---|---|
| **Lín Lǎoshī 林老师** (hero) | Mandarin teacher | Warm, patient, quietly funny; delighted by small wins. Gentle head tilts, precise hand gestures (she traces tones beautifully). | Late 20s–30s. Short black bob with side-swept bangs. Jade-green cardigan over a cream blouse, small gold pendant, small stud earrings. **No costume clichés** (no qipao, no conical hat, no chopsticks in hair). | `hairStyle: bob`, `outfitStyle: cardigan`, prop `tea_cup` (optional) |
| **Sofía** | Spanish teacher | Energetic, expressive, big laugh; talks with her hands. Bigger arm arcs, quicker timing. | Early 30s. Big dark curly hair. Terracotta/mustard blouse. Hoop earrings. | `curly`, `blouse_stripe`, prop `menu` |
| **Camille** | French teacher | Calm, witty, a little theatrical; raised-eyebrow humour. Slower, elegant timing; expressive brows. | Late 20s. Auburn hair in a loose low bun. Navy-and-white striped top under a coral blazer. | `bun`, `blazer`, prop `croissant` |
| **Nurse Tendai** | Healthcare trainer / simulated scenes | Reassuring, professional, kind. Smaller, steadier gestures; strong listening acting. | Zimbabwean, 30s. Short natural hair (or braids variant). Teal scrubs, ID badge, stethoscope prop. | `short` or `braids`, `scrubs`, prop `stethoscope` |

Deliver a **character sheet** for each: front pose, 3 expressions, colours (hex), silhouette check.

## 4. Artboards

Exact names and sizes are in the contract.

| Artboard | Size | Purpose |
|---|---|---|
| `Teacher` | 1200 × 1500, transparent | Main half-body teacher, waist up. Must also read when cropped to landscape (`landscapeCrop` safe area: head, shoulders and raised hands stay inside). Keep the bottom 250 px free of important detail (captions overlay there). |
| `TeacherBust` | 512 × 512, transparent | Head and shoulders for chat bubbles, notifications, dashboard. Supports mood, visemes, look, listening and colours; no arm gestures. |
| `Scene_TeaHouse` | 2400 × 1500 | Mandarin scene: round moon-gate window, distant layered hills, rising moon, two paper lanterns, warm dusk light. |
| `Scene_Cafe` | 2400 × 1500 | Spanish scene: Andalusian arched window, low warm sun, rooftops and a bell tower silhouette, a hint of orange tree. |
| `Scene_Rooftop` | 2400 × 1500 | French scene: tall Parisian window with mullions and a balcony rail, blue hour, distant tower silhouette, first stars. |
| `Scene_Clinic` | 2400 × 1500 | Healthcare scene: bright, calm consultation room, window with soft daylight, plants. |

Scenes go in a separate file `zai_scenes.riv` so the teacher file stays small. Scenes are built in **4–5 depth layers** (sky, far, mid, frame, foreground glow) so `parallaxX`/`parallaxY` can shift them by depth. The teacher is composited by the app in front of the scene. Leave the centre 1200 px clear enough for the character.

## 5. View model (data binding) — the contract

Build view model **`TeacherVM`** with exactly the properties in `teacher.contract.json → viewModels.TeacherVM`, and **`SceneVM`** for scenes. Summary:

| Property | Type | Behaviour you build |
|---|---|---|
| `gesture` | enum `Gesture` | Which gesture `playGesture` plays |
| `playGesture` | trigger | Plays the selected gesture on the Gesture layer, then returns to idle by itself |
| `toneShape` | enum `ToneShape` | Path used by `trace_tone` |
| `countTo` | number 1–5 | Fingers shown by `count` |
| `mood` + `moodIntensity` | enum + 0–100 | Face expression blend (brows, eyes, cheeks, mouth corners). Intensity 0 = neutral, 100 = full. Must layer on top of visemes. |
| `viseme` | number 0–8 | Mouth shape, see §7 |
| `speaking` | bool | Enables mouth layer and subtle talking beats (small hand/head accents every ~0.6–1.2 s) when no gesture is playing |
| `listening` | bool | Listening loop (lean-in, nods scaled by `voiceLevel`) |
| `thinking` | bool | Thinking loop (hides AI latency) |
| `voiceLevel` | 0–100 | Learner's mic level; scales nod size and eye "brightness" |
| `lookX`, `lookY` | −100…100 | Eye + slight head direction (use a joystick/blend). Gestures may override (e.g. `point_card` looks at the card) |
| `reducedMotion` | bool | See §2.3 |
| `skinColor`, `skinShadeColor`, `hairColor`, `outfitPrimary`, `outfitSecondary`, `accentColor` | color | Bound to every relevant fill |
| `hairStyle`, `outfitStyle`, `prop` | enum | Swap shape sets (solos or visibility/opacity per value, whichever binds cleanly) |

**Runtime compatibility rule:** data binding is the primary control surface. If, at build time, any target runtime (especially React Native) can't drive data binding for some type, **also expose the core controls as state machine inputs with the same names** (`gesture` as a number index into the enum order, `playGesture` trigger, `viseme` number, `speaking`/`listening`/`thinking` booleans, `lookX`/`lookY` numbers). Note this in the QA report.

## 6. State machine `TeacherSM`

Layers (they all run at the same time):

| Layer | Contents |
|---|---|
| **Base** | Idle loop (breathing, weight shift, hair overlap). Variants: `idle_a`, `idle_b`, randomly alternated every 6–12 s so idle never looks looped. |
| **Gesture** | One state per `Gesture`, entered on `playGesture`, exits to an empty/idle state at the end. Interrupting with a new `playGesture` blends to the new gesture within ~150 ms. |
| **Talk beats** | Active when `speaking` and no gesture: subtle additive hand/head accents. |
| **Listen / Think** | Additive loops for `listening` and `thinking`. Gesture layer wins over these when both run. |
| **Face** | Mood blend (1D or additive per mood) × `moodIntensity`. |
| **Mouth** | Viseme states, instant or ≤ 40 ms transitions. Only active when `speaking` (otherwise rest/mood mouth). |
| **Eyes** | Auto blink (randomised), saccades, look joystick from `lookX`/`lookY`. |
| **Props** | Prop visibility and any prop idle (tea steam, page flutter). |

### 6.1 Gesture list and timing

Durations are targets (± 20%). "Peak" is where you fire `gesturePeak`.

| Gesture | What it looks like | Duration | Peak | Notes |
|---|---|---|---|---|
| `wave` | Character's left arm (screen right) raised, elbow out and down, forearm up, open hand waving 3 times; head tilt, big smile | 1.6 s | 2nd wave apex | Greeting / goodbye |
| `nod` | 2 soft nods, eyes close slightly | 0.9 s | first nod bottom | Agreement |
| `head_shake` | Gentle "not quite" shake with a kind smile, never scolding | 1.0 s | middle | Used with corrections |
| `explain` | Both hands in front of chest, palms up/open, alternating small beats | 2.4 s, loops while `speaking` | first beat | Default when teaching |
| `point_card` | Character's right hand (screen left) points at `anchors.cardTarget`, eyes follow, slight lean | 2.0 s hold | finger arrives at card | App launches the flashcard at peak |
| `point_left` / `point_right` | Open-hand "over there" presentation to screen left / right | 1.4 s | arm extended | Presenting UI elements |
| `thumbs_up` | Screen-right hand, thumbs up beside shoulder, wink or big smile, small bounce | 1.4 s | thumb fully up | Praise |
| `clap` | 3 quick claps in front of chest, happy squint | 1.2 s | first contact | Big praise |
| `think` | Finger to chin, eyes up and to the side, head tilt | 2.2 s | — | Also the `thinking` loop pose |
| `listen` | Hand cupped near ear, lean in, eyebrows up | 2.4 s, loops while `listening` | hand at ear | "Your turn" |
| `celebrate` | Both arms up, open hands, bounce, eyes squeezed happy | 2.0 s | top of first bounce | App fires confetti + `SceneVM.celebrate` |
| `count` | Holds up `countTo` fingers one by one (1→n) | 0.5 s per finger | each finger (fire peak per count) | "Three tones left!" |
| `shrug` | Small playful shrug, palms up | 1.2 s | top | Light humour |
| `beckon` | Friendly "come closer / try again" hand wave toward self | 1.3 s | — | Encouragement |
| `trace_tone` | Screen-right index finger traces `toneShape` path inside `toneTrace.traceBox`, eyes on fingertip, mouth may keep speaking | `toneTrace.durationMs` | — | Fire `traceStart` / `traceEnd` |
| `oops` | Hand to mouth, wide eyes, then a laugh: for when the teacher "makes a mistake" in a game | 1.4 s | hand at mouth | Humour moments |

### 6.2 Tone tracing (Mandarin signature move)

- Use a **Follow Path constraint** (or equivalent) so the fingertip follows a path per `toneShape`.
- The paths must match `toneTrace.paths` in the contract (normalized inside `toneTrace.traceBox`, artboard units). The app draws a glowing trail along the same path in sync with `traceStart` → `traceEnd`, so a mismatch is visible. Keep fingertip speed even (constant along the path) and ease only at the ends.
- Contours follow standard Mandarin tones: t1 high flat (55), t2 rising (35), t3 dip then rise (214), t4 sharp fall (51), neutral short and low; `rise`/`fall` are sentence intonation for Spanish/French questions/statements.

## 7. Visemes (lip-sync)

The app computes `viseme` from the audio (any language) and updates it rapidly. Build 9 mouth shapes with exact values from the contract:

| Value | Name | Shape notes | Sounds (examples) |
|---|---|---|---|
| 0 | rest | Closed, relaxed; mood controls corners | silence |
| 1 | AA | Wide open, jaw down, teeth + tongue visible | a (father), Mandarin a |
| 2 | EH | Mid-open, wider | e (bed), è, Mandarin e |
| 3 | EE | Slightly open, wide, teeth visible | ee, i, y |
| 4 | OH | Rounded, medium open | o |
| 5 | OO | Small, very rounded, pushed forward | u, w, Mandarin ü, French u |
| 6 | MBP | Lips pressed closed | m, b, p |
| 7 | FV | Top teeth on lower lip | f, v |
| 8 | CONS | Teeth slightly apart, small opening | s, t, d, n, k, sh, zh, ch, x, j, q, l, r |

Rules: mouth shapes combine with mood (a happy "AA" still has lifted corners). Transitions ≤ 40 ms. No jaw "wobble" between identical consecutive values. The `TeacherBust` artboard uses the same 9 shapes.

## 8. Rig and technical requirements

- **One skeleton** for all four characters: spine (2), neck, head, jaw (optional), 2× (shoulder, upper arm, forearm, hand, thumb, fingers grouped as 2–4 bones), hair bones (3–6), earring/pendant bones for overlap. Keep the total under ~60 bones.
- Use **IK constraints** for arms where it helps (pointing, card target), and meshes only where deformation is needed (face squash, hair, sleeves). Keep mesh vertex counts modest.
- **Hands:** pose library: open, relaxed, point, thumbs up, fist, cupped (listen), count 1–5, pinch (tone trace start).
- **Draw order** changes for arms in front of / behind the torso as needed (pointing across the body, finger to chin).
- **Performance budget:** `zai_teacher.riv` ≤ 600 KB; each scene ≤ 900 KB; 60 fps on a 2019-era mid-range Android phone in Chrome (canvas renderer) with teacher + scene running. Use vector shapes; avoid large raster images. If a scene needs texture, use one small compressed image per scene at most.
- **Events:** fire `gestureStart`, `gesturePeak`, `gestureEnd`, `traceStart`, `traceEnd` with a `gesture` (or `toneShape`) string property, exactly as named in the contract.
- **Scenes:** `SceneVM` with `timeOfDay`, `parallaxX/Y`, `celebrate`, `ambience`, `reducedMotion`. Ambient loops: lantern sway + flicker (tea house), sun shimmer + swallows (café), twinkling stars + window glow (rooftop), plant sway + soft light shift (clinic).

## 9. Process and checkpoints

Work in this order and stop for founder review at each ★ checkpoint. Small, frequent previews beat one big reveal.

| Step | Output | Checkpoint |
|---|---|---|
| 1. Style frames | 3 style options for Lín Lǎoshī (front pose + 1 expression each), all in the Duolingo-like warm direction but varying proportion/colour boldness | ★ pick one |
| 2. Character sheets | Final sheets for all 4 characters (colours as hex, expressions, hand poses, silhouette test) | ★ approve |
| 3. Rig + idle | Lín Lǎoshī rigged, `idle_a`/`idle_b`, blinks, look joystick, moods | ★ "does she feel alive?" |
| 4. Visemes + speaking | 9 visemes, talk beats; test with a recorded Mandarin and Spanish line | ★ lip-sync check |
| 5. Gestures | All gestures in §6.1 incl. `trace_tone` with contract paths and events | ★ gesture review (video of each) |
| 6. Data binding + variants | `TeacherVM` complete; Sofía, Camille, Tendai as variants via bound colours/enums; `TeacherBust` | ★ variant review |
| 7. Scenes | `zai_scenes.riv` with 4 scenes and `SceneVM` | ★ scene review |
| 8. QA + handoff | QA report (§10), final files, preview videos | ★ sign-off |

If you use image generation for concepts in step 1, the final art must still be rebuilt as clean Rive vector shapes (no traced raster).

## 10. Deliverables

```
design/rive/
  zai_teacher.riv           # runtime file: Teacher + TeacherBust artboards, TeacherSM, BustSM, TeacherVM
  zai_scenes.riv            # runtime file: 4 scene artboards, SceneSM, SceneVM
  source/                   # Rive editor source/exports needed to keep editing
  sheets/                   # character sheets (PNG) + colour tables
  previews/                 # one short MP4/GIF per gesture, mood sweep, viseme sweep, each scene
  QA_REPORT.md              # see below
```

`QA_REPORT.md` must include:
- Every view model property, enum value, event and artboard actually present, checked against `teacher.contract.json` (✓/✗ table).
- Final `anchors` values (card target, head centre, mouth centre) in artboard coordinates.
- File sizes; fps measured on a low-end Android (or Chrome mobile CPU throttling ×4 as a proxy).
- Whether state machine input mirrors were added for React Native, and which.
- Known limitations and anything you renamed (should be nothing; if unavoidable, propose a contract version bump).

## 11. Acceptance criteria

1. All contract names exist and behave as described; no extra required inputs.
2. Every gesture returns to idle on its own and can be interrupted by another within ~150 ms without popping.
3. Moods layer correctly with visemes and gestures (happy + AA + wave all at once looks right).
4. Lip-sync looks natural on a Mandarin line ("你好！我是林老师。") and a Spanish line ("¡Hola! Soy Sofía.") driven by the app's viseme stream.
5. `trace_tone` fingertip matches the contract paths; `traceStart`/`traceEnd` fire at the right frames.
6. Recolouring via bound colours produces 4 good-looking characters with no stray unbound fills.
7. Reads clearly at 120 px tall (silhouette) and looks crisp at 1500 px tall.
8. Budgets in §8 met.
9. Original characters: no resemblance to existing Duolingo (or other) characters beyond general style.

## 12. Questions to ask before you start

If anything here is unclear or a Rive feature works differently than described, ask rather than guess, and propose the closest alternative that keeps the contract names stable.
