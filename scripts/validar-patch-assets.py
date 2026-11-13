"""Inventário verificável do pacote; somente leitura. Requer Pillow; uso: python scripts/validar-patch-assets.py [pasta]."""
from pathlib import Path
from PIL import Image
import collections, hashlib, json, sys, wave
ROOT = Path(sys.argv[1]) if len(sys.argv) > 1 else Path(__file__).resolve().parents[1] / 'Patch_Jogo_Completo'
STATES = ['parado','piscando','feliz','triste','rindo','comendo','banho','dormindo','acordando','carinho','dancando','pulando','brincando','comemorando']
report = {'root':str(ROOT), 'files':collections.Counter(), 'bytes':0, 'missing':[], 'images':[], 'sheet_rows':[], 'sounds':[], 'warnings':[]}
for p in ROOT.rglob('*'):
    if p.is_file(): report['files'][p.suffix] += 1; report['bytes'] += p.stat().st_size
for state in STATES:
    for folder, suffix in [('png','png'),('gifs','gif')]:
        p=ROOT/'personagem'/folder/(state+'.'+suffix)
        if not p.exists(): report['missing'].append(str(p)); continue
        with Image.open(p) as im:
            hashes=[]; bboxes=[]
            for i in range(getattr(im,'n_frames',1)):
                im.seek(i); frame=im.convert('RGBA'); hashes.append(hashlib.sha256(frame.tobytes()).hexdigest()); bboxes.append(frame.getchannel('A').getbbox())
            report['images'].append({'file':str(p.relative_to(ROOT)),'size':im.size,'frames':len(hashes),'unique_frames':len(set(hashes)),'alpha':im.convert('RGBA').getchannel('A').getextrema(),'bboxes':bboxes})
            if suffix=='gif' and len(hashes)<12: report['warnings'].append(state+'.gif tem '+str(len(hashes))+' quadro, não 12.')
p=ROOT/'personagem/spritesheet_12_frames_14_estados.png'
if p.exists():
    with Image.open(p) as image:
        image=image.convert('RGBA'); report['sheet_size']=image.size
        for row,state in enumerate(STATES):
            frames=[image.crop((col*240,row*240,(col+1)*240,(row+1)*240)) for col in range(12)]
            n=len({hashlib.sha256(frame.tobytes()).hexdigest() for frame in frames});report['sheet_rows'].append({'row':row,'state':state,'unique_frames':n})
            if n==1:report['warnings'].append('Linha '+state+' estática: requer movimento programado complementar.')
else: report['missing'].append(str(p))
for p in sorted((ROOT/'sons').glob('*.wav')):
    with wave.open(str(p)) as sound: report['sounds'].append({'name':p.name,'channels':sound.getnchannels(),'sample_width':sound.getsampwidth(),'sample_rate':sound.getframerate(),'seconds':round(sound.getnframes()/sound.getframerate(),3)})
report['warnings'] += ['Comendo contém alimento laranja embutido; a FSM usa quadros neutros e prop separado.','Objetos SVG do pacote são placas com emoji; vetores originais isolados estão em patch-game/assets/objects.','Prancha conceitual é uma imagem única, não objetos transparentes individualizados.']
print(json.dumps(report,ensure_ascii=False,indent=2))
if report['missing']:sys.exit(1)
