# Builds public/fonts/pdf/NotoSansSC-{Regular,Bold}.ttf for the AI-teacher study-notes PDF.
# Source: Noto Sans SC variable font from github.com/google/fonts (ofl/notosanssc), SIL OFL 1.1.
# Usage: python3 scripts/build-pdf-cjk-fonts.py NotoSansSC[wght].ttf public/fonts/pdf  (needs fonttools)

import sys
from fontTools.ttLib import TTFont
from fontTools.varLib import instancer
from fontTools import subset
from fontTools.pens.ttGlyphPen import TTGlyphPen

def decompose(font):
    """Flatten composite glyphs: pdf-lib's fontkit subsetter drops their components."""
    glyf = font["glyf"]
    gs = font.getGlyphSet()
    n = 0
    for name in font.getGlyphOrder():
        g = glyf[name]
        if g.isComposite():
            pen = TTGlyphPen(gs)
            gs[name].draw(pen)
            glyf[name] = pen.glyph()
            n += 1
    return n

src, outdir = sys.argv[1], sys.argv[2]
chars = set()
# GB2312 symbol rows (0xA1-0xA9) + level-1 hanzi (0xB0-0xD7): the ~3,755 most common characters.
for hi in list(range(0xA1, 0xAA)) + list(range(0xB0, 0xD8)):
    for lo in range(0xA1, 0xFF):
        try: chars.add(ord(bytes([hi, lo]).decode("gb2312")))
        except UnicodeDecodeError: pass
ranges = [(0x20,0x7E),(0xA0,0x24F),(0x2B0,0x2FF),(0x300,0x36F),(0x2000,0x206F),(0x20A0,0x20CF),(0x2100,0x214F),(0x2190,0x21FF),(0x2200,0x22FF),(0x2460,0x24FF),(0x2500,0x257F),(0x25A0,0x25FF),(0x3000,0x303F),(0x3040,0x30FF),(0xFF00,0xFFEF)]
for a,b in ranges: chars.update(range(a,b+1))
print("requested codepoints", len(chars))
for name, wght in [("Regular", 400), ("Bold", 700)]:
    f = TTFont(src)
    inst = instancer.instantiateVariableFont(f, {"wght": wght})
    opts = subset.Options()
    opts.layout_features = []
    opts.drop_tables += ["GSUB", "GPOS", "GDEF", "BASE", "STAT", "vhea", "vmtx", "VORG"]
    opts.name_IDs = ["*"]
    opts.notdef_outline = True
    opts.hinting = False
    opts.desubroutinize = True
    s = subset.Subsetter(opts)
    s.populate(unicodes=sorted(chars))
    s.subset(inst)
    print("decomposed", decompose(inst))
    out = f"{outdir}/NotoSansSC-{name}.ttf"
    inst.save(out)
    print(out, len(inst.getBestCmap()))
