// Runs qa/perf.html in headless Chrome with an optional CPU throttle and prints the result JSON.
// usage: node perf_cdp.mjs [throttleRate=4] [secs=10] [port=8765]
import { spawn } from 'node:child_process';
const rate = +(process.argv[2] || 4), secs = +(process.argv[3] || 10), port = process.argv[4] || 8765;
const CHROME = process.env.CHROME || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const chrome = spawn(CHROME, ['--headless=new', '--remote-debugging-port=9333', '--no-sandbox', '--disable-background-timer-throttling', '--disable-renderer-backgrounding', '--user-data-dir=/tmp/zai-perf-profile', 'about:blank'], { stdio: 'ignore' });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let targets;
for (let i = 0; i < 40; i++) { try { targets = await (await fetch('http://localhost:9333/json')).json(); if (targets.length) break; } catch {} await sleep(250); }
const page = targets.find((t) => t.type === 'page');
const ws = new WebSocket(page.webSocketDebuggerUrl);
await new Promise((r) => (ws.onopen = r));
let id = 0; const pending = new Map();
ws.onmessage = (m) => { const d = JSON.parse(m.data); if (d.id && pending.has(d.id)) { pending.get(d.id)(d); pending.delete(d.id); } };
const send = (method, params = {}) => new Promise((r) => { const i = ++id; pending.set(i, r); ws.send(JSON.stringify({ id: i, method, params })); });
await send('Page.enable'); await send('Runtime.enable');
const ver = await (await fetch('http://localhost:9333/json/version')).json();
await send('Emulation.setCPUThrottlingRate', { rate });
await send('Page.navigate', { url: `http://localhost:${port}/perf.html?secs=${secs}&teacher=${process.env.TEACHER || 'zai_teacher.riv'}` });
let res = null;
for (let i = 0; i < (secs + 90) * 4 && !res; i++) {
  await sleep(250);
  const r = await send('Runtime.evaluate', { expression: 'JSON.stringify(window.__result)', returnByValue: true });
  if (r.result?.result?.value && r.result.result.value !== 'null') res = JSON.parse(r.result.result.value);
}
console.log(JSON.stringify({ chrome: ver.Browser, cpuThrottle: rate + 'x', ...res }));
chrome.kill(); process.exit(0);
