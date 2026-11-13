"""Recria os cinco spritesheets do Patch a partir dos GIFs originais (requer ffmpeg)."""
from pathlib import Path
from tempfile import TemporaryDirectory
import subprocess
ROOT = Path(__file__).resolve().parents[1]
ACTIONS = ['parado', 'triste', 'alimentar', 'dormir', 'banho', 'carinho', 'brincar']
for age in ['bebe', 'filhote', 'juvenil', 'jovem', 'adulto']:
    with TemporaryDirectory(prefix='patch-sprites-') as folder:
        work = Path(folder)
        for row, action in enumerate(ACTIONS):
            subprocess.run(['ffmpeg', '-loglevel', 'error', '-i', str(ROOT / f'pet-{age}-{action}.gif'), '-frames:v', '4', '-vsync', '0', '-start_number', str(row * 4), str(work / '%02d.png')], check=True)
        out = ROOT / 'patch' / 'assets' / f'pet-{age}.webp'
        out.parent.mkdir(parents=True, exist_ok=True)
        subprocess.run(['ffmpeg', '-loglevel', 'error', '-y', '-framerate', '1', '-i', str(work / '%02d.png'), '-vf', 'tile=4x7', '-frames:v', '1', '-c:v', 'libwebp', '-lossless', '1', str(out)], check=True)
        print(out.name)
