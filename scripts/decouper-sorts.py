"""Découpe les deux états des sorts fournis par Philippe (03/11/2026).
Recadre sur les pixels opaques, conserve une marge et exporte à deux fois la taille d'affichage.
"""
from pathlib import Path
from PIL import Image

root = Path(__file__).resolve().parents[1]
for n in range(1, 4):
    sheet = Image.open(root / f"sources-images/phare/sort-{n}.png").convert("RGBA")
    half = sheet.width // 2
    for state, offset in [("pret", 0), ("vide", half)]:
        frame = sheet.crop((offset, 0, offset + half, sheet.height))
        bounds = frame.getchannel("A").point(lambda v: 255 if v > 100 else 0).getbbox()
        if not bounds:
            raise ValueError("État vide dans la planche")
        # Le seuil sert au cadrage seulement : les transparences du dessin sont préservées.
        x0, y0, x1, y1 = bounds
        frame = frame.crop((x0 - 3, y0 - 3, x1 + 3, y1 + 3))
        frame.thumbnail((144, 144), Image.Resampling.LANCZOS)
        canvas = Image.new("RGBA", (144, 144))
        canvas.alpha_composite(frame, ((144 - frame.width) // 2, (144 - frame.height) // 2))
        canvas.save(root / f"src/images/phare/sort-{n}-{state}.webp", lossless=True)
