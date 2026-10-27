// Copies the Rive files the app loads from design/rive (the source of truth) into public/rive.
//   npm run sync:rive   copy the .riv files, and the runtime wasm from node_modules
//   npm run check:rive  fail if anything in public/rive differs from its source (sha256)
// The wasm is not in design/rive. It comes from the pinned @rive-app/canvas, so the engine always
// matches the JavaScript that drives it.
import { createHash } from "node:crypto";
import { copyFile, mkdir, readFile, readdir, stat } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const SOURCE_DIR = join(ROOT, "design", "rive");
const DEST_DIR = join(ROOT, "public", "rive");
const RUNTIME_DIR = join(ROOT, "node_modules", "@rive-app", "canvas");

const RIV_FILES = ["zai_teacher.riv", "zai_scenes.riv"];
const RUNTIME_FILES = [{ from: join(RUNTIME_DIR, "rive.wasm"), name: "rive.wasm" }];

const checkMode = process.argv.includes("--check");

async function sha256(path) {
  return createHash("sha256").update(await readFile(path)).digest("hex");
}

async function exists(path) {
  try {
    await stat(path);
    return true;
  } catch {
    return false;
  }
}

async function sync() {
  await mkdir(DEST_DIR, { recursive: true });
  for (const name of RIV_FILES) {
    await copyFile(join(SOURCE_DIR, name), join(DEST_DIR, name));
    console.log(`copied design/rive/${name} -> public/rive/${name}`);
  }
  for (const file of RUNTIME_FILES) {
    if (!(await exists(file.from))) throw new Error(`Missing ${file.from}. Run npm install first.`);
    await copyFile(file.from, join(DEST_DIR, file.name));
    console.log(`copied node_modules/@rive-app/canvas/${file.name} -> public/rive/${file.name}`);
  }
}

async function check() {
  const problems = [];
  for (const name of RIV_FILES) {
    const src = join(SOURCE_DIR, name);
    const dest = join(DEST_DIR, name);
    if (!(await exists(dest))) {
      problems.push(`public/rive/${name} is missing (run npm run sync:rive)`);
      continue;
    }
    if ((await sha256(src)) !== (await sha256(dest))) {
      problems.push(`public/rive/${name} differs from design/rive/${name} (run npm run sync:rive)`);
    }
  }
  for (const file of RUNTIME_FILES) {
    const dest = join(DEST_DIR, file.name);
    if (!(await exists(file.from))) {
      problems.push(`node_modules/@rive-app/canvas/${file.name} is missing (run npm install)`);
    } else if (!(await exists(dest))) {
      problems.push(`public/rive/${file.name} is missing (run npm run sync:rive)`);
    } else if ((await sha256(file.from)) !== (await sha256(dest))) {
      problems.push(`public/rive/${file.name} differs from the installed @rive-app/canvas (run npm run sync:rive)`);
    }
  }
  // A stray .riv in public/rive would ship a file nobody reviewed.
  const present = (await exists(DEST_DIR)) ? await readdir(DEST_DIR) : [];
  for (const name of present) {
    if (name.endsWith(".riv") && !RIV_FILES.includes(name)) {
      problems.push(`public/rive/${name} is not a known Rive file (remove it or add it to design/rive)`);
    }
  }

  if (problems.length > 0) {
    for (const p of problems) console.error(`FAIL ${p}`);
    process.exitCode = 1;
    return;
  }
  console.log(`OK public/rive matches design/rive (${RIV_FILES.join(", ")}) and @rive-app/canvas wasm`);
}

if (checkMode) {
  await check();
} else {
  await sync();
}
