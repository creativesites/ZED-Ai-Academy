#!/usr/bin/env python3
"""Render preset characters (+ optional extra --data) into a sheet.  usage: chars.py out.png [advance] [extra=--data ...]"""
import json, subprocess, sys, os
from PIL import Image, ImageDraw
out = sys.argv[1]; adv = sys.argv[2] if len(sys.argv) > 2 else '30'
extra = sys.argv[3:]
RIVE = os.path.expanduser('~/.rive/bin/rive')
presets = json.load(open('presets.json'))
cells = []
for key, p in presets.items():
    args = [RIVE, 'teacher', f'--screenshot=build/char_{key}.png', f'--advance={adv}']
    for k, v in p.items():
        if k != 'name': args.append(f'--data={k}={v.lstrip("#")}')
    args += extra
    r = subprocess.run(args, capture_output=True, text=True)
    if 'unknown' in r.stdout + r.stderr: print(key, (r.stdout + r.stderr)[-300:])
    im = Image.open(f'build/char_{key}.png').convert('RGBA')
    bg = Image.new('RGBA', im.size, (34, 22, 52, 255)); bg.alpha_composite(im)
    cells.append((p['name'], bg.resize((im.width * 2 // 5, im.height * 2 // 5), Image.LANCZOS)))
w, h = cells[0][1].size
sheet = Image.new('RGB', (w * len(cells), h))
d = ImageDraw.Draw(sheet)
for i, (n, im) in enumerate(cells): sheet.paste(im.convert('RGB'), (i * w, 0)); d.text((i * w + 8, 6), n, fill=(255, 255, 255))
sheet.save(out); print(out, sheet.size)
