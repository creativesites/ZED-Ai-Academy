#!/usr/bin/env node
// Contract check for the ZAI teacher and scene Rive files (npm run test:rive).
// Serves a harness page with the pinned runtime and public/rive/*.riv, runs checks.js in headless
// Chromium against docs/rive/teacher.contract.json, prints a table, and exits 1 on any failure.
import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import { createServer } from "node:http";
import { createRequire } from "node:module";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, "..", "..");
const RUNTIME = join(ROOT, "node_modules", "@rive-app", "canvas");

const ROUTES = {
  "/": { file: join(HERE, "harness.html"), type: "text/html; charset=utf-8" },
  "/checks.js": { file: join(HERE, "checks.js"), type: "text/javascript; charset=utf-8" },
  "/rive.js": { file: join(RUNTIME, "rive.js"), type: "text/javascript; charset=utf-8" },
  "/rive.wasm": { file: join(RUNTIME, "rive.wasm"), type: "application/wasm" },
  "/zai_teacher.riv": { file: join(ROOT, "public", "rive", "zai_teacher.riv"), type: "application/octet-stream" },
  "/zai_scenes.riv": { file: join(ROOT, "public", "rive", "zai_scenes.riv"), type: "application/octet-stream" },
  "/contract.json": { file: join(ROOT, "docs", "rive", "teacher.contract.json"), type: "application/json" },
};

const require = createRequire(import.meta.url);
let chromium;
try {
  ({ chromium } = require("playwright"));
} catch {
  console.error("test:rive needs Playwright. Install it, or set NODE_PATH to a directory that contains it.");
  process.exit(2);
}

for (const route of Object.values(ROUTES)) {
  try {
    await stat(route.file);
  } catch {
    console.error(`Missing ${route.file}. Run npm install and npm run sync:rive first.`);
    process.exit(2);
  }
}

const server = createServer((req, res) => {
  const path = new URL(req.url, "http://localhost").pathname;
  const route = ROUTES[path];
  if (!route) {
    res.writeHead(404).end("not found");
    return;
  }
  res.writeHead(200, { "content-type": route.type, "cache-control": "no-store" });
  createReadStream(route.file).pipe(res);
});

await new Promise((r) => server.listen(0, "127.0.0.1", r));
const { port } = server.address();
const base = `http://127.0.0.1:${port}`;

let rows = [];
let pageErrors = [];
let browser;
try {
  browser = await chromium.launch();
  const page = await browser.newPage();
  page.on("pageerror", (e) => pageErrors.push(e.message));
  page.on("console", (m) => {
    if (m.type() === "error") pageErrors.push(`console: ${m.text()}`);
  });
  await page.goto(`${base}/`);
  rows = await page.evaluate(() => window.runRiveChecks());
} catch (e) {
  rows = [{ group: "Setup", name: "browser run", ok: false, detail: String(e && e.message ? e.message : e) }];
} finally {
  if (browser) await browser.close();
  server.close();
}

if (pageErrors.length > 0) {
  rows.push({ group: "Page", name: "no page or console errors", ok: false, detail: pageErrors.slice(0, 3).join(" | ") });
} else {
  rows.push({ group: "Page", name: "no page or console errors", ok: true, detail: "" });
}

const passed = rows.filter((r) => r.ok).length;
const failed = rows.length - passed;
const widths = {
  result: 6,
  group: Math.max(5, ...rows.map((r) => r.group.length)),
  name: Math.max(5, ...rows.map((r) => r.name.length)),
};

const line = (cells) => `| ${cells.join(" | ")} |`;
console.log(line(["Result".padEnd(widths.result), "Group".padEnd(widths.group), "Check".padEnd(widths.name), "Detail"]));
console.log(line(["-".repeat(widths.result), "-".repeat(widths.group), "-".repeat(widths.name), "------"]));
for (const r of rows) {
  console.log(
    line([
      (r.ok ? "PASS" : "FAIL").padEnd(widths.result),
      r.group.padEnd(widths.group),
      r.name.padEnd(widths.name),
      r.detail,
    ]),
  );
}
console.log(`\nrive contract check: ${passed} passed, ${failed} failed, ${rows.length} checks`);
process.exitCode = failed === 0 ? 0 : 1;
