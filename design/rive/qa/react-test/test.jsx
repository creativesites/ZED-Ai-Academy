import React, { useEffect, useRef } from 'react';
import { createRoot } from 'react-dom/client';
import { useRive, useViewModel, useViewModelInstance, useViewModelInstanceEnum, useViewModelInstanceTrigger, useViewModelInstanceNumber, useViewModelInstanceBoolean } from '@rive-app/react-canvas';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function App() {
  const { rive, RiveComponent } = useRive({ src: 'zai_teacher.riv', artboard: 'Teacher', stateMachines: 'TeacherSM', autoplay: true });
  const vm = useViewModel(rive, { name: 'TeacherVM' });
  const vmi = useViewModelInstance(vm, { useDefault: true, rive });
  const gesture = useViewModelInstanceEnum('gesture', vmi);
  const tone = useViewModelInstanceEnum('toneShape', vmi);
  const faceStyle = useViewModelInstanceEnum('faceStyle', vmi);
  const play = useViewModelInstanceTrigger('playGesture', vmi);
  const countTo = useViewModelInstanceNumber('countTo', vmi);
  const speaking = useViewModelInstanceBoolean('speaking', vmi);
  const ref = useRef({ started: false, log: [] });

  useEffect(() => {
    if (!rive || !vmi || !gesture.setValue || !play.trigger || !countTo.setValue || ref.current.started) return;
    ref.current.started = true;
    const log = ref.current.log; let frame = 0;
    rive.on('riveevent', (e) => log.push({ name: e.data.name, props: e.data.properties }));
    (async () => {
      const run = async (label, g, ms) => { const from = log.length; gesture.setValue(g); play.trigger(); await sleep(ms); const ev = log.slice(from); return { label, start: ev.filter((x) => x.name === 'gestureStart').length, peak: ev.filter((x) => x.name === 'gesturePeak').length, end: ev.filter((x) => x.name === 'gestureEnd').length, traceStart: ev.filter((x) => x.name === 'traceStart').length, traceEnd: ev.filter((x) => x.name === 'traceEnd').length, gestureProp: ev[0]?.props?.gesture }; };
      await sleep(800);
      const out = [];
      out.push(await run('wave', 'wave', 2200));
      out.push(await run('wave again (re-fire)', 'wave', 2200));
      out.push(await run('nod', 'nod', 1400));
      for (const n of [1, 2, 3, 4, 5]) { countTo.setValue(n); await sleep(100); out.push(await run(`count ${n}`, 'count', 1400 + n * 560)); }
      tone.setValue('t2'); out.push(await run('trace_tone t2', 'trace_tone', 2200));
      faceStyle.setValue('tinashe'); await sleep(300);
      window.__result = { reactCanvas: '@rive-app/react-canvas', gestureEnumValues: gesture.values, faceStyleValues: faceStyle.values, results: out };
    })().catch((e) => { window.__result = { error: String(e) }; });
  });
  return <div style={{ width: 600, height: 750 }}><RiveComponent /></div>;
}
createRoot(document.getElementById('root')).render(<App />);
