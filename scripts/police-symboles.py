"""
Fabrique src/fonts/emoji/symboles.ttf à partir d'EmojiFont.ttf (Satsuyako, fournie par Philippe) :
ses dessins sont rangés sur des lettres (« C » = cœur plein, « B » = cœur vide). On ne garde que ceux
qui servent et on les place sur leur vrai caractère, pour que « ♥ » s'affiche tout seul en secours
de Minecraftia. Usage : python scripts/police-symboles.py EmojiFont.ttf (fonttools requis).
"""
import sys
from fontTools.ttLib import TTFont
from fontTools import subset

# Caractère voulu -> lettre qui porte le dessin dans EmojiFont.
SYMBOLES = {'♥': 'C', '♡': 'B'}

src, dest = sys.argv[1], 'src/fonts/emoji/symboles.ttf'
font = TTFont(src)
cmap = font.getBestCmap()
glyphs = {ch: cmap[ord(lettre)] for ch, lettre in SYMBOLES.items()}

opts = subset.Options()
opts.notdef_outline = True
opts.name_IDs = ['*']
sub = subset.Subsetter(opts)
sub.populate(glyphs=list(glyphs.values()))
sub.subset(font)

for table in font['cmap'].tables:
    table.cmap = {ord(ch): g for ch, g in glyphs.items()}

# Mise à l'échelle de Minecraftia : un pixel d'EmojiFont vaut 1/16 de la taille, un pixel de Minecraftia 1/8.
# On double donc les dessins (pixels de même taille), on les pose 4 pixels au-dessus de la ligne de base
# (Minecraftia dessine ses lettres entre 5 et 12 pixels) et on laisse 1 pixel d'espace à droite.
upm = font['head'].unitsPerEm
pixel = upm // 8
for g in set(glyphs.values()):
    glyph = font['glyf'][g]
    glyph.coordinates.scale((2, 2))
    glyph.recalcBounds(font['glyf'])
    glyph.coordinates.translate((-glyph.xMin, 4 * pixel - glyph.yMin))
    glyph.recalcBounds(font['glyf'])
    font['hmtx'][g] = (glyph.xMax + pixel, 0)
# Hauteur de ligne de Minecraftia (en fraction de la taille) : 1,75 au-dessus, 0,375 en dessous.
font['hhea'].ascent = font['OS/2'].sTypoAscender = font['OS/2'].usWinAscent = upm * 7 // 4
font['hhea'].descent = font['OS/2'].sTypoDescender = -(upm * 3 // 8)
font['OS/2'].usWinDescent = upm * 3 // 8
font.save(dest)
print(dest, {ch: g for ch, g in glyphs.items()})
