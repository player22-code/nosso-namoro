"""Run from repository root: python tests/verify-assets.py (Pillow required)."""
from pathlib import Path
import re
import wave
from PIL import Image
root = Path(__file__).resolve().parents[1]
source = (root/'cassinos.js').read_text() + (root/'cassinos.css').read_text()
paths = set(re.findall(r"['\"]([^'\"\n]+\.(?:gif|png|jpg|wav|ogg))['\"]", source))
for name in sorted(paths):
    p = root/name
    assert p.is_file(), f'Missing: {name}'
    assert p.parent == root, f'Not in root: {name}'
    if p.suffix in {'.gif', '.png', '.jpg'}:
        with Image.open(p) as im:
            im.verify()
    elif p.suffix == '.wav':
        with wave.open(str(p)) as sound:
            assert sound.getnframes() > 0
for name in ['coelho_idle.gif','coelho_vitoria.gif','coelho_derrota.gif','coelho_grande_vitoria.gif','cucoparado.gif','cucofeliz.gif','cucotriste.gif']:
    with Image.open(root/name) as im:
        assert im.n_frames > 1, f'Not animated: {name}'
print(f'PASS: {len(paths)} root resources exist; PNG/JPEG/GIF and WAV headers decode; character GIFs are animated.')
