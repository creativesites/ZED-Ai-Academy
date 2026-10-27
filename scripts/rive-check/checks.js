// Runs inside the harness page (Chromium). Loads the teacher and scene .riv files with the Rive runtime
// and checks them against docs/rive/teacher.contract.json. Returns an array of
// { group, name, ok, detail } rows for run.mjs to print. Plain browser JavaScript, no build step.
(function () {
  "use strict";

  const WAIT_GESTURE_MS = 15000;
  const BLEND_OUT_MS = 900;

  function sleep(ms) {
    return new Promise((r) => setTimeout(r, ms));
  }

  async function waitFor(predicate, timeoutMs) {
    const start = performance.now();
    while (performance.now() - start < timeoutMs) {
      if (predicate()) return true;
      await sleep(16);
    }
    return predicate();
  }

  function fail(err) {
    return err && err.message ? err.message : String(err);
  }

  async function loadFile(url) {
    const buf = await (await fetch(url)).arrayBuffer();
    const file = new rive.RiveFile({ buffer: buf, enableRiveAssetCDN: false });
    await file.init();
    return file;
  }

  // One canvas per instance, on screen and tiny, so the runtime draws and advances normally.
  function createInstance(file, artboard, stateMachine) {
    return new Promise((resolve, reject) => {
      const canvas = document.createElement("canvas");
      canvas.width = 300;
      canvas.height = 300;
      canvas.style.cssText = "position:fixed;left:0;top:0;width:300px;height:300px;opacity:0.01;pointer-events:none";
      document.body.appendChild(canvas);
      const r = new rive.Rive({
        canvas,
        riveFile: file,
        artboard,
        stateMachine,
        autoplay: true,
        autoBind: false,
        enableRiveAssetCDN: false,
        onLoad: () => resolve({ r, canvas }),
        onLoadError: (e) => reject(new Error(`load ${artboard}: ${JSON.stringify((e && e.data) || e)}`)),
      });
    });
  }

  function bindViewModel(r, vmName) {
    const vm = r.viewModelByName(vmName);
    if (!vm) throw new Error(`no view model ${vmName}`);
    const vmi = vm.defaultInstance() || vm.instance();
    if (!vmi) throw new Error(`no instance of ${vmName}`);
    r.bindViewModelInstance(vmi);
    return vmi;
  }

  function accessor(vmi, type, name) {
    switch (type) {
      case "number":
        return vmi.number(name);
      case "boolean":
        return vmi.boolean(name);
      case "enum":
        return vmi.enum(name);
      case "trigger":
        return vmi.trigger(name);
      case "color":
        return vmi.color(name);
      default:
        return null;
    }
  }

  // Event collector. Rive events are read from the runtime's riveevent callback.
  function collectEvents(r) {
    const events = [];
    r.on(rive.EventType.RiveEvent, (e) => {
      const d = e && e.data;
      if (d && typeof d.name === "string") {
        events.push({ name: d.name, props: d.properties || {} });
      }
    });
    return events;
  }

  function sameList(a, b) {
    return Array.isArray(a) && a.length === b.length && a.every((v, i) => v === b[i]);
  }

  async function runAll() {
    const rows = [];
    const add = (group, name, ok, detail) => rows.push({ group, name, ok: !!ok, detail: detail || "" });

    const contract = await (await fetch("/contract.json")).json();
    rive.RuntimeLoader.setWasmUrl("/rive.wasm");

    const teacherFile = await loadFile("/zai_teacher.riv");
    const sceneFile = await loadFile("/zai_scenes.riv");

    // Teacher: TeacherSM on the full artboard ------------------------------------------------
    const teacher = await createInstance(teacherFile, "Teacher", contract.artboards.Teacher.stateMachine);
    const tr = teacher.r;
    const tvmi = bindViewModel(tr, contract.artboards.Teacher.viewModel);
    const events = collectEvents(tr);

    add(
      "Artboards",
      "Teacher size and state machine",
      tr.artboardWidth === contract.artboards.Teacher.size[0] &&
        tr.artboardHeight === contract.artboards.Teacher.size[1] &&
        tr.stateMachineNames.includes(contract.artboards.Teacher.stateMachine),
      `${tr.artboardWidth}x${tr.artboardHeight}, state machines: ${tr.stateMachineNames.join(", ")}`,
    );

    // Every TeacherVM property exists with the contract type.
    const tvm = contract.viewModels.TeacherVM;
    const missing = [];
    for (const [name, def] of Object.entries(tvm)) {
      const acc = accessor(tvmi, def.type, name);
      if (!acc) missing.push(`${name}:${def.type}`);
    }
    add(
      "TeacherVM",
      `properties present with contract types (${Object.keys(tvm).length})`,
      missing.length === 0,
      missing.length ? `missing or wrong type: ${missing.join(", ")}` : "all present",
    );

    // Enum value lists match the contract, in order.
    const enumMismatch = [];
    for (const [name, def] of Object.entries(tvm)) {
      if (def.type !== "enum") continue;
      const acc = tvmi.enum(name);
      const want = contract.enums[def.enum];
      if (!acc || !sameList(acc.values, want)) enumMismatch.push(`${name} (${def.enum})`);
    }
    add(
      "TeacherVM",
      "enum value lists match the contract",
      enumMismatch.length === 0,
      enumMismatch.length ? `differs: ${enumMismatch.join(", ")}` : "all enums match",
    );

    // Defaults in the file match the contract.
    const defaultMismatch = [];
    for (const [name, def] of Object.entries(tvm)) {
      if (def.default === undefined) continue;
      const acc = accessor(tvmi, def.type, name);
      if (!acc) continue;
      if (def.type === "color") {
        const hex = parseInt(def.default.replace("#", ""), 16);
        if ((acc.value & 0xffffff) !== hex) defaultMismatch.push(name);
      } else if (acc.value !== def.default) {
        defaultMismatch.push(`${name}=${acc.value}`);
      }
    }
    add(
      "TeacherVM",
      "defaults match the contract",
      defaultMismatch.length === 0,
      defaultMismatch.length ? `differs: ${defaultMismatch.join(", ")}` : "all defaults match",
    );

    // Every gesture is accepted by the enum.
    const rejected = [];
    for (const g of contract.enums.Gesture) {
      tvmi.enum("gesture").value = g;
      if (tvmi.enum("gesture").value !== g) rejected.push(g);
    }
    tvmi.enum("gesture").value = "idle";
    add(
      "Gestures",
      `every Gesture value accepted (${contract.enums.Gesture.length})`,
      rejected.length === 0,
      rejected.length ? `rejected: ${rejected.join(", ")}` : "all accepted",
    );

    // Each gesture: gestureStart and gestureEnd for that gesture. idle is the rest pose, so it must not
    // emit gesture events. Between gestures the harness waits for the blend-out to finish (see
    // BLEND_OUT_MS): a trigger fired inside it is dropped by the file (QA_REPORT, known gaps).
    for (const g of contract.enums.Gesture) {
      const mark = events.length;
      tvmi.enum("gesture").value = g;
      tvmi.trigger("playGesture").trigger();
      if (g === "idle") {
        await sleep(1000);
        const mine = events.slice(mark).filter((e) => e.name.startsWith("gesture")).map((e) => e.name);
        add("Gestures", "playGesture idle: rest pose, no gesture events", mine.length === 0, `events: ${mine.join(" > ") || "none"}`);
        continue;
      }
      const ended = await waitFor(
        () => events.slice(mark).some((e) => e.name === "gestureEnd" && e.props.gesture === g),
        WAIT_GESTURE_MS,
      );
      const mine = events.slice(mark).filter((e) => e.props.gesture === g).map((e) => e.name);
      const started = mine.includes("gestureStart");
      add(
        "Gestures",
        `playGesture ${g}: gestureStart and gestureEnd`,
        ended && started,
        `events: ${mine.join(" > ") || "none"}`,
      );
      await sleep(BLEND_OUT_MS);
    }

    // count with countTo 1..5 gives exactly that many gesturePeaks.
    for (let n = 1; n <= 5; n++) {
      const mark = events.length;
      tvmi.enum("gesture").value = "count";
      tvmi.number("countTo").value = n;
      tvmi.trigger("playGesture").trigger();
      await waitFor(
        () => events.slice(mark).some((e) => e.name === "gestureEnd" && e.props.gesture === "count"),
        WAIT_GESTURE_MS,
      );
      const peaks = events.slice(mark).filter((e) => e.name === "gesturePeak" && e.props.gesture === "count").length;
      add("Gestures", `count with countTo ${n}: ${n} gesturePeak`, peaks === n, `got ${peaks}`);
      await sleep(BLEND_OUT_MS);
    }
    tvmi.enum("gesture").value = "idle";

    // trace_tone with each tone shape gives traceStart and traceEnd.
    for (const tone of contract.enums.ToneShape) {
      const mark = events.length;
      tvmi.enum("toneShape").value = tone;
      tvmi.enum("gesture").value = "trace_tone";
      tvmi.trigger("playGesture").trigger();
      const ended = await waitFor(
        () => events.slice(mark).some((e) => e.name === "traceEnd" && e.props.toneShape === tone),
        WAIT_GESTURE_MS,
      );
      const mine = events.slice(mark).filter((e) => e.name.startsWith("trace")).map((e) => `${e.name}:${e.props.toneShape}`);
      const started = events.slice(mark).some((e) => e.name === "traceStart" && e.props.toneShape === tone);
      add("Tone trace", `trace_tone ${tone}: traceStart and traceEnd`, ended && started, mine.join(" > ") || "none");
      await sleep(BLEND_OUT_MS);
    }
    tvmi.enum("gesture").value = "idle";
    await sleep(200);

    // Expressive writes do not throw and read back.
    let writeError = null;
    try {
      for (const v of [0, 1, 2, 3, 4, 5, 6, 7, 8]) tvmi.number("viseme").value = v;
      tvmi.boolean("speaking").value = true;
      tvmi.boolean("speaking").value = false;
      tvmi.number("lookX").value = -100;
      tvmi.number("lookY").value = 100;
      tvmi.number("voiceLevel").value = 60;
      tvmi.color("skinColor").rgb(0x7a, 0x4a, 0x30);
    } catch (e) {
      writeError = fail(e);
    }
    add("TeacherVM", "viseme, speaking, look, voiceLevel and colour writes", !writeError, writeError || "no errors");

    const colourBack = (tvmi.color("skinColor").value & 0xffffff) === 0x7a4a30;
    add("TeacherVM", "colour write reads back as RGB", colourBack, colourBack ? "" : "read back differs");

    // Face styles: every value is accepted.
    const faceRejected = [];
    for (const f of contract.enums.FaceStyle) {
      tvmi.enum("faceStyle").value = f;
      if (tvmi.enum("faceStyle").value !== f) faceRejected.push(f);
    }
    tvmi.enum("faceStyle").value = "lin";
    add(
      "TeacherVM",
      `every FaceStyle value accepted (${contract.enums.FaceStyle.length})`,
      faceRejected.length === 0,
      faceRejected.length ? `rejected: ${faceRejected.join(", ")}` : "all accepted",
    );

    teacher.canvas.remove();

    // TeacherBust: the subset it uses, on BustSM ----------------------------------------------
    const bust = await createInstance(teacherFile, "TeacherBust", contract.artboards.TeacherBust.stateMachine);
    const br = bust.r;
    const bvmi = bindViewModel(br, contract.artboards.TeacherBust.viewModel);
    add(
      "Artboards",
      "TeacherBust size and state machine",
      br.artboardWidth === contract.artboards.TeacherBust.size[0] &&
        br.artboardHeight === contract.artboards.TeacherBust.size[1] &&
        br.stateMachineNames.includes(contract.artboards.TeacherBust.stateMachine),
      `${br.artboardWidth}x${br.artboardHeight}, state machines: ${br.stateMachineNames.join(", ")}`,
    );
    const busMissing = [];
    const colourNames = Object.keys(tvm).filter((k) => tvm[k].type === "color");
    const usesExpanded = contract.artboards.TeacherBust.uses.flatMap((u) => (u === "colors" ? colourNames : [u]));
    for (const name of usesExpanded) {
      const def = tvm[name];
      if (!def) {
        busMissing.push(`${name} (not in TeacherVM)`);
        continue;
      }
      if (!accessor(bvmi, def.type, name)) busMissing.push(name);
    }
    add(
      "TeacherBust",
      `uses-list properties present (${usesExpanded.length}, "colors" expanded)`,
      busMissing.length === 0,
      busMissing.length ? `missing: ${busMissing.join(", ")}` : "all present",
    );
    let bustFace = true;
    for (const f of contract.enums.FaceStyle) {
      bvmi.enum("faceStyle").value = f;
      if (bvmi.enum("faceStyle").value !== f) bustFace = false;
    }
    bvmi.enum("faceStyle").value = "lin";
    add("TeacherBust", "faceStyle values accepted on the bust", bustFace, "");
    // A bust gesture is not expected, but the view model must still accept the trigger without error.
    let bustFire = null;
    try {
      bvmi.trigger("playGesture").trigger();
      await sleep(300);
    } catch (e) {
      bustFire = fail(e);
    }
    add("TeacherBust", "playGesture trigger fires without error", !bustFire, bustFire || "");
    bust.canvas.remove();

    // Scenes: SceneSM and SceneVM on each scene artboard -------------------------------------
    const sceneVm = contract.viewModels.SceneVM;
    for (const artboard of ["Scene_TeaHouse", "Scene_Cafe", "Scene_Rooftop", "Scene_Clinic"]) {
      const scene = await createInstance(sceneFile, artboard, contract.artboards[artboard].stateMachine);
      const sr = scene.r;
      const svmi = bindViewModel(sr, contract.artboards[artboard].viewModel);
      const sceneMissing = [];
      for (const [name, def] of Object.entries(sceneVm)) {
        if (!accessor(svmi, def.type, name)) sceneMissing.push(`${name}:${def.type}`);
      }
      add(
        "SceneVM",
        `${artboard}: SceneVM properties present, SceneSM exists`,
        sceneMissing.length === 0 && sr.stateMachineNames.includes(contract.artboards[artboard].stateMachine),
        sceneMissing.length ? `missing: ${sceneMissing.join(", ")}` : `${sr.artboardWidth}x${sr.artboardHeight}`,
      );

      let sceneErr = null;
      try {
        svmi.number("timeOfDay").value = 40;
        svmi.number("parallaxX").value = 60;
        svmi.number("parallaxY").value = -30;
        svmi.boolean("ambience").value = false;
        svmi.boolean("ambience").value = true;
        svmi.boolean("reducedMotion").value = false;
        svmi.trigger("celebrate").trigger();
        await sleep(300);
      } catch (e) {
        sceneErr = fail(e);
      }
      add("SceneVM", `${artboard}: writes and celebrate trigger`, !sceneErr, sceneErr || "no errors");
      scene.canvas.remove();
    }

    return rows;
  }

  window.runRiveChecks = async function () {
    try {
      return await runAll();
    } catch (e) {
      return [{ group: "Setup", name: "harness ran to completion", ok: false, detail: fail(e) }];
    }
  };
})();
