#!/usr/bin/env python3
"""Render gestures at their peak frame into a labelled contact sheet.
usage: tools/sheet.py out.png gesture[:advance[:extra=--data args]] ..."""
import subprocess, sys, os
from PIL import Image, ImageDraw
out = sys.argv[1]
items = sys.argv[2:]
RIVE = os.path.expanduser('~/.rive/bin/rive')
PEAK = {'wave':54,'nod':22,'head_shake':40,'explain':40,'point_card':40,'point_left':42,'point_right':42,'thumbs_up':36,'clap':30,'think':50,'listen':50,'celebrate':40,'shrug':44,'beckon':40,'oops':40,'trace_tone':70,'count':80,'idle':10}
cells = []
for it in items:
    parts = it.split(':')
    g = parts[0]; adv = int(parts[1]) if len(parts) > 1 and parts[1] else PEAK.get(g.split('@')[0], 40)
    extra = parts[2].split(',') if len(parts) > 2 else []
    name, _, tone = g.partition('@')
    png = f'build/sheet_{it.replace(":","_").replace("=","-").replace(",","_")}.png'
    args = [RIVE, 'teacher', f'--screenshot={png}', f'--advance={adv}', f'--data=gesture={name}', '--data=playGesture=1'] + [f'--data={e}' for e in extra]
    if tone: args.append(f'--data=toneShape={tone}')
    subprocess.run(args, capture_output=True)
    im = Image.open(png).convert('RGBA')
    bg = Image.new('RGBA', im.size, (34, 22, 52, 255)); bg.alpha_composite(im)
    cells.append((it, bg.resize((im.width // 3, im.height // 3), Image.LANCZOS)))
cols = min(4, len(cells)); rows = (len(cells) + cols - 1) // cols
w, h = cells[0][1].size
sheet = Image.new('RGBA', (w * cols, h * rows), (20, 12, 34, 255))
d = ImageDraw.Draw(sheet)
for i, (label, im) in enumerate(cells):
    x, y = (i % cols) * w, (i // cols) * h
    sheet.paste(im, (x, y)); d.text((x + 8, y + 6), label, fill=(255, 255, 255, 255))
sheet.convert('RGB').save(out); print(out, sheet.size)
