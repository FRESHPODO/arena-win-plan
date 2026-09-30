"""Extract readable representative colors without modifying source images."""
import colorsys
import json
import re
from collections import defaultdict
from pathlib import Path
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]

def color(path, champion=False):
    if path.suffix == '.svg':
        fills = re.findall(r'fill[:=]["\s]*(#[0-9a-fA-F]{6})', path.read_text(encoding='utf-8'))
        return max(fills, key=lambda value: max(int(value[i:i+2],16) for i in (1,3,5))) if fills else '#b7c8d9'
    image = Image.open(path).convert('RGBA')
    if champion:
        w, h = image.size
        image = image.crop((w // 6, h // 6, w * 5 // 6, h * 5 // 6))
    groups = defaultdict(list)
    for r, g, b, alpha in image.getdata():
        hue, sat, val = colorsys.rgb_to_hsv(r/255, g/255, b/255)
        if alpha < 160 or val < .25 or sat < .18:
            continue
        groups[int(hue * 24) % 24].append((r, g, b, sat * val))
    if not groups:
        return '#b7c8d9'
    pixels = max(groups.values(), key=lambda ps: sum(p[3] for p in ps))
    total = sum(p[3] for p in pixels)
    rgb = [sum(p[i]*p[3] for p in pixels)/total/255 for i in range(3)]
    h, s, v = colorsys.rgb_to_hsv(*rgb)
    rgb = colorsys.hsv_to_rgb(h, min(s, .68), max(v, .84))
    return '#' + ''.join(f'{round(c*255):02x}' for c in rgb)

icons = json.loads((ROOT/'data/stat-icons.json').read_text(encoding='utf-8'))
stats = {key: color(ROOT/'imgs/stats'/filename) for key,filename in icons.items()}
champions = {f'imgs/champions/icons/{p.name}': color(p, True) for p in (ROOT/'imgs/champions/icons').glob('*.png')}
(ROOT/'data/icon-colors.json').write_text(json.dumps({'stats':stats,'champions':champions},ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
print(json.dumps({'stats':stats,'champions':len(champions)},ensure_ascii=False))
