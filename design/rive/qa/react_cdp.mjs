// usage: node react_cdp.mjs  (serves nothing itself; expects qa/ served on :8765 with react-test/ built)
import { spawn } from 'node:child_process';
const CHROME = process.env.CHROME || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const chrome = spawn(CHROME, ['--headless=new', '--remote-debugging-port=9333', '--no-sandbox', '--user-data-dir=/tmp/zai-perf-profile', 'about:blank'], { stdio: 'ignore' });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let targets; for (let i = 0; i < 40; i++) { try { targets = await (await fetch('http://localhost:9333/json')).json(); if (targets.length) break; } catch {} await sleep(250); }
const ws = new WebSocket(targets.find((t) => t.type === 'page').webSocketDebuggerUrl); await new Promise((r) => (ws.onopen = r));
let id = 0; const pending = new Map(); ws.onmessage = (m) => { const d = JSON.parse(m.data); if (pending.has(d.id)) { pending.get(d.id)(d); pending.delete(d.id); } };
const send = (method, params = {}) => new Promise((r) => { const i = ++id; pending.set(i, r); ws.send(JSON.stringify({ id: i, method, params })); });
await send('Page.enable'); await send('Runtime.enable');
await send('Page.navigate', { url: 'http://localhost:8765/react-test/index.html' });
let res = null;
for (let i = 0; i < 200 && !res; i++) { await sleep(250); const r = await send('Runtime.evaluate', { expression: 'JSON.stringify(window.__result)', returnByValue: true }); const v = r.result?.result?.value; if (v && v !== 'null') res = JSON.parse(v); }
console.log(JSON.stringify(res, null, 1)); chrome.kill(); process.exit(0);
