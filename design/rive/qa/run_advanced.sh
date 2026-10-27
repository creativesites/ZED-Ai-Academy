#!/bin/bash
# Frame-stepped runtime test (canvas-advanced 2.47.1). usage: qa/run_advanced.sh  (needs qa/ served on :8765 and v247/ + zai_teacher.riv in qa/)
CH="${CHROME:-/Applications/Google Chrome.app/Contents/MacOS/Google Chrome}"
"$CH" --headless --disable-gpu --no-sandbox --virtual-time-budget=120000 --dump-dom http://localhost:8765/auto2.html 2>/dev/null | grep -o 'RESULT \[.*\]</pre>' | sed 's#</pre>##; s/^RESULT //' | python3 -c "
import sys,json
for x in json.load(sys.stdin):
    if x[0] in ('--','fire') or (x[0]=='EV' and x[2] in ('gestureStart','gesturePeak','gestureEnd')) : print(x)"
