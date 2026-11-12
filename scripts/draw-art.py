"""Original vector artwork. Run to regenerate the Orchard Club asset family."""
from pathlib import Path
import math, re
ROOT=Path(__file__).resolve().parent.parent
out=ROOT/'public/art'
ink='#30492e'
def path(d,fill,stroke=ink,sw=2.5): return f'<path d="{d}" fill="{fill}" stroke="{stroke}" stroke-width="{sw}" stroke-linejoin="round" stroke-linecap="round"/>'
def ellipse(x,y,rx,ry,fill,stroke=ink,sw=2.5): return f'<ellipse cx="{x}" cy="{y}" rx="{rx}" ry="{ry}" fill="{fill}" stroke="{stroke}" stroke-width="{sw}"/>'
def circle(x,y,r,fill,stroke=ink,sw=2.5): return ellipse(x,y,r,r,fill,stroke,sw)
def leaf(x=60,y=26): return path(f'M{x} {y}q9 -22 29 -15q-7 24 -29 15','#698d43')+path(f'M{x+3} {y-2}l17 -9','none','#456831',1.5)
def stem(x=58,y=30): return path(f'M{x} {y}q-5 -13 1 -21','none','#785034',4)
def body(color,shape='round'):
    if shape=='pear': return path('M51 25C30 28 43 48 27 65C6 91 30 113 62 111C96 111 113 87 91 62C77 47 81 26 62 25Z',color)
    if shape=='oval': return ellipse(61,70,35,43,color)
    if shape=='apple': return path('M61 35C30 11 8 41 21 77C29 103 42 115 61 104C81 116 99 95 105 66C111 31 86 19 61 35Z',color)
    if shape=='mango': return path('M36 30C64 10 99 36 99 66C101 107 56 121 30 103C6 88 26 68 24 51Q24 37 36 30Z',color)
    return ellipse(62,71,43,40,color)
def seeds(points,color='#fbefb3'):
    return ''.join(ellipse(x,y,1.7,3,color,'none') for x,y in points)
def star(cx,cy,r1,r2,n,color):
    pts=[]
    for i in range(n*2):
        a=i*math.pi/n-math.pi/2;r=r1 if i%2==0 else r2
        pts.append(f'{cx+math.cos(a)*r:.2f},{cy+math.sin(a)*r:.2f}')
    return f'<polygon points="{" ".join(pts)}" fill="{color}" stroke="{ink}" stroke-width="2.5" stroke-linejoin="round"/>'
art=[]
art.append(''.join(circle(x,y,r,c) for x,y,r,c in [(45,74,27,'#6c87bd'),(80,77,25,'#8098cb'),(61,50,26,'#859fd4')])+star(61,38,9,4,5,'#d1dce9')+leaf(66,24))
art.append(ellipse(50,74,25,36,'#91a454')+ellipse(84,79,23,31,'#b0bc72')+leaf(52,35)+stem(50,38))
art.append(''.join(circle(x,y,16,c) for x,y,c in [(43,43,'#aa8bbd'),(75,44,'#b39ac5'),(30,67,'#9d7db2'),(60,66,'#b29ac6'),(88,68,'#9674ac'),(47,89,'#9470ab'),(75,91,'#a17db5'),(62,108,'#865e9f')])+leaf(62,23))
art.append(path('M38 74Q45 43 65 20Q78 46 88 69','none',ink,4)+circle(36,86,26,'#da6266')+circle(87,82,26,'#e77a75')+leaf(65,20))
art.append(path('M20 53C22 19 101 20 104 53C107 76 72 114 62 114C47 113 17 74 20 53Z','#ed796e')+star(61,32,26,11,5,'#6f914b')+seeds([(37,54),(60,52),(84,54),(47,73),(74,74),(61,94)]))
art.append(path('M16 68Q7 61 19 53Q37 14 77 28Q104 38 108 64Q122 71 108 80Q87 116 49 105Q22 99 16 68Z','#efcf58')+leaf(66,25))
art.append(ellipse(63,70,43,43,'#bba078')+ellipse(63,70,34,34,'#a9c568')+ellipse(63,70,12,20,'#eee6b4')+''.join(ellipse(63+22*math.cos(i),70+24*math.sin(i),1.8,3,ink,'none') for i in range(12)))
art.append(body('#e77d64')+star(62,35,25,9,6,'#698c44'))
art.append(body('#91b25d','pear')+path('M55 36C42 40 49 55 36 70C19 93 40 104 62 104C86 104 99 88 83 68C72 55 74 37 63 36Z','#d9dda3')+circle(61,81,19,'#b67d50')+ellipse(56,75,6,9,'#d0a071','none'))
art.append(body('#efaa55')+leaf()+stem())
art.append(body('#adbf67','apple')+leaf()+stem())
art.append(body('#dd7062','apple')+leaf()+stem())
art.append(body('#cbd281','pear')+leaf()+stem())
art.append(body('#edaaa0','apple')+path('M62 38Q78 68 62 103','none','#d1807a',2)+leaf())
art.append(body('#efbd62','mango')+leaf(52,26))
art.append(path('M23 28Q17 94 91 100L106 84Q49 99 40 24Z','#e7bd47')+path('M41 24Q33 82 103 84L111 69Q62 85 56 23Z','#f6db72')+path('M57 22Q48 61 105 68L112 56Q76 65 72 23Z','#f9e89a')+path('M39 28L38 14L71 14L72 25Z','#709244'))
art.append(ellipse(61,75,44,36,'#aa7d58')+ellipse(61,66,39,31,'#f2e4cb')+ellipse(61,65,28,21,'#fff9e8'))
art.append(body('#e8c267','oval')+''.join(path(f'M{x} 32l42 67M{x+30} 32l-42 67','none','#bc934e',1.2) for x in [18,36,54,72])+path('M47 35L32 12L54 21L61 3L69 23L94 11L77 38Z','#70944e'))
art.append(body('#df8998','oval')+path('M35 43L20 32L30 63L15 69L33 82M87 43L105 29L96 65L111 71L91 87','none','#89a55e',5)+ellipse(64,76,27,32,'#fff3df')+seeds([(52,54),(74,63),(48,77),(70,86),(58,97)],ink))
art.append(body('#b8c998')+''.join(path(f'M{x} 33q30 37 0 77','none','#e8e4b2',2) for x in [33,51,69,87])+stem())
art.append(body('#da9856')+ellipse(63,72,26,40,'#edaf65')+ellipse(63,72,10,40,'#f4bb72')+stem())
art.append(body('#8daa63')+''.join(path(f'M{x} 33q-18 37 0 77','none','#4f7851',6) for x in [35,55,75,95])+stem())
art.append(body('#d57c79')+path('M45 36L43 16L58 25L67 14L75 35Z','#d99570')+path('M65 58Q108 58 103 92Q96 113 68 104Z','#f6c4ac')+seeds([(77,72),(91,77),(77,88),(90,94)],'#b95157'))
art.append(body('#eeb76a','oval')+ellipse(62,76,24,31,'#ed8d53')+ellipse(62,76,10,23,'#56482f')+seeds([(61,65),(64,76),(59,87)],'#8f8062'))
art.append(body('#a6b96c','oval')+''.join(star(x,y,3.5,2,4,'#d0d598') for x in range(36,92,12) for y in range(43,106,13))+stem())
art.append(body('#8d6d93')+ellipse(70,84,26,25,'#f6e7da')+''.join(ellipse(70+13*math.cos(a),84+12*math.sin(a),7,11,'#fff8e8') for a in range(6))+star(57,32,25,12,5,'#70904b'))
art.append(star(63,67,52,24,5,'#e6c95e')+star(63,67,34,16,5,'#f6dd81'))
art.append(body('#c4cb7b','pear')+leaf())
art.append(body('#997b9d','pear')+path('M63 43C43 66 27 95 53 105C78 118 98 98 83 76Z','#dba3a1')+seeds([(61,65),(55,81),(73,83),(65,96)]))
art.append(path('M40 25Q60 15 80 25L90 71Q117 106 89 112L61 105L33 113Q8 104 32 72Z','#dc8a87')+leaf(49,24))
art.append(body('#d78f85')+''.join(circle(x,y,3,'#eeb7a0','none') for x in range(33,98,13) for y in range(48,101,14))+leaf())
art.append(body('#b4c981')+ellipse(64,76,31,30,'#eda6a0')+ellipse(64,76,13,17,'#f5d3b1')+seeds([(60,67),(70,78),(60,89)],'#9e7458')+leaf())
art.append(ellipse(45,77,25,32,'#e9ad5e')+ellipse(82,74,25,32,'#f1bd76')+leaf(57,34))
art.append(body('#b5c98c','pear')+''.join(ellipse(x,y,10,13,'#c6d49c') for y,xs in [(46,[50,71]),(67,[35,56,78,95]),(90,[40,61,82])] for x in xs)+stem())
art.append(body('#b78159','pear')+''.join(path(f'M{x-5} {y}l5 5l5 -5','none','#875a3e',1.5) for y in range(45,104,12) for x in range(37,94,12))+stem())
art.append(body('#a9bd7a')+''.join(path(f'M{x} 35q15 35 0 70','none','#d5dca2',3) for x in range(31,100,14))+leaf())
art.append(body('#cc9568','oval')+''.join(path(f'M{x} 29q-16 40 0 78','none','#9a654c',3) for x in [40,60,80])+stem())
art.append(path('M33 24Q9 28 18 49Q2 64 23 79Q24 112 48 109Q69 112 71 88Q91 77 80 59Q86 35 64 35Q53 11 33 24Z','#bf986b')+path('M33 39L53 50M28 68L50 78M42 93L56 89','none','#8d6d4c',2))
art.append(body('#eaa366')+star(62,35,26,10,4,'#6b8951'))
art.append(body('#897ca7')+leaf()+stem()+path('M65 39Q75 70 63 106','none','#675c8c',2))
art.append(ellipse(45,77,24,31,'#e9af56')+ellipse(84,76,23,32,'#f2c56c')+leaf(56,32))
art.append(body('#a4808f')+ellipse(68,79,29,31,'#eed39b')+''.join(circle(x,y,3,'#72523c') for x,y in [(57,65),(75,62),(84,80),(69,91),(53,84),(68,77)])+leaf())
art.append(''.join(circle(x,y,24,c) for x,y,c in [(40,78,'#c2a77c'),(80,80,'#d9bf91'),(61,45,'#ceb382')])+ellipse(81,80,18,19,'#f3e5c6')+circle(81,81,10,'#554936')+leaf(61,24))
art.append(body('#bf7784')+''.join(circle(x,y,3,'#e19f9e','none') for x in range(29,101,10) for y in range(44,107,11))+leaf())
art.append(body('#e0d2a5','oval')+''.join(path(f'M{x} 38q23 35 0 65','none','#ab93ac',3) for x in [35,55,75])+leaf())
art.append(body('#e4bf69','pear')+leaf())
art.append(body('#dfb06b','oval')+''.join(star(x,y,8,3,3,'#eac58a') for x,y in [(31,45),(83,38),(99,70),(36,99),(84,105),(31,72),(69,68)]))
art.append(path('M26 104Q8 68 30 33Q39 20 44 38L40 70L51 20Q58 8 64 23L60 68L78 20Q87 15 86 31L78 74L100 39Q112 36 107 50L92 94Q73 118 26 104Z','#e6c76a')+leaf(23,98))
art.append(body('#cf9ca8','oval')+''.join(star(x,y,4,1.5,4,'#efc8c1') for x,y in [(35,55),(85,49),(37,88),(88,89)])+ellipse(64,29,14,10,'#9bad69'))
art.append(body('#d2b86c')+''.join(star(x,y,6,2.5,3,'#f0d88c') for x in range(30,103,15) for y in range(49,105,16))+path('M38 38L30 12L51 24L64 5L78 24L99 12L90 39Z','#e5b54d')+circle(64,23,4,'#d78368'))
assert len(art)==50,len(art)
for i,a in enumerate(art):
    svg=f'<svg xmlns="http://www.w3.org/2000/svg" width="128" height="128" viewBox="0 0 128 128"><title>Orchard fruit {i+1:02}</title><ellipse cx="64" cy="116" rx="34" ry="5" fill="#30492e" opacity=".09"/>{a}<path d="M37 50q-6 7 -6 14" fill="none" stroke="#fff9dd" stroke-width="5" stroke-linecap="round" opacity=".5"/></svg>'
    (out/f'fruit-{i:02}.svg').write_text(svg)
# All interface illustrations are paths, never font glyphs.
icons={
'leaf':'M7 28C4 10 15 4 34 5C36 26 23 36 7 28ZM8 29L27 13',
'spark':'M20 3L24 15L37 20L24 24L20 37L16 24L3 20L16 15Z',
'basket':'M5 16H35L31 34H9ZM12 16L20 5L28 16M15 23V29M25 23V29',
'clock':'M20 9V21L27 25M15 3H25M20 3V7M33 9L36 12',
'bag':'M8 13H32V35H8ZM14 13V9C14 1 26 1 26 9V13M13 21H27V28H13Z',
'magnet':'M8 5V23C8 38 32 38 32 23V5H24V23C24 29 16 29 16 23V5ZM8 13H16M24 13H32',
'burst':'M20 3L24 12L34 8L30 18L38 24L27 26L26 37L18 30L9 36L11 25L2 20L12 16L9 5Z',
'flower':'M20 16C3 -6 0 21 16 20C-3 35 24 43 20 24C37 43 43 17 24 20C42 1 16 -3 20 16Z',
'honey':'M12 5H28V12H12ZM12 12L7 20V34H33V20L28 12M7 22H33M15 26V30H25V26Z',
'gem':'M11 5H29L37 17L20 36L3 17ZM3 17H37M11 5L15 17L20 36L25 17L29 5',
'ring':'M10 8L16 3H24L30 8L20 19ZM6 26C6 11 34 11 34 26C34 42 6 42 6 26Z',
'sun':'M20 1V6M20 34V39M1 20H6M34 20H39M6 6L10 10M30 30L34 34M34 6L30 10M10 30L6 34',
'fire':'M21 3C24 17 37 15 33 29C28 43 7 37 7 25C6 17 15 14 15 8L21 18Z',
'coin':'M17 12H25M15 20H25M15 28H23M20 8V32',
'dna':'M9 3C9 20 31 20 31 37M31 3C31 20 9 20 9 37M12 8H28M14 13H26M14 27H26M12 32H28',
'spiral':'M21 20C13 11 9 26 20 28C38 32 40 5 21 4C-2 1 -2 38 23 37',
'feather':'M7 35L27 12M8 29C-1 13 20 1 32 4C37 16 26 35 8 29ZM14 21H25',
'gear':'M15 4H25L27 11L34 13L38 21L32 27L32 34L23 37L17 32L9 34L3 26L7 19L5 11L13 10Z',
'shield':'M20 3L35 9V22Q34 31 20 38Q6 31 5 22V9ZM12 20L18 26L29 14',
'rainbow':'M4 33V23C4 -1 36 -1 36 23V33M11 33V23C11 9 29 9 29 23V33M18 33V23H22V33',
'carousel':'M4 13L20 3L36 13ZM20 13V35M6 35H34M10 18V29M30 18V29M6 23H14M26 23H34',
'fountain':'M4 29Q20 42 36 29ZM20 29V8M20 20Q3 5 6 22M20 20Q37 5 34 22M15 8L20 3L25 8',
'dice':'M7 5H33V35H7ZM13 11H15V13H13ZM25 27H27V29H25ZM19 19H21V21H19Z',
'crown':'M5 10L14 19L20 5L26 19L35 10L31 33H9ZM10 27H30',
'ball':'M20 4C-1 4 -1 36 20 36C41 36 41 4 20 4ZM6 13H34M4 23H36M20 4Q5 20 20 36Q35 20 20 4Z',
'bubble':'M5 19C5 7 23 7 23 19C23 31 5 31 5 19ZM25 7C25 0 36 0 36 7C36 14 25 14 25 7ZM25 31C25 23 37 23 37 31C37 39 25 39 25 31Z',
'meteor':'M8 22L30 3M14 29L37 6M21 35L37 19M7 18C-3 30 12 43 23 32Z',
'tree':'M20 4C9 0 6 10 9 14C-1 21 8 30 17 27V37H24V27C37 32 43 18 32 14C35 4 25 0 20 4Z',
'gift':'M4 15H36V23H4ZM7 23V36H33V23M20 15V36M20 15C-4 12 9 -6 20 15C44 -6 44 12 20 15Z',
'map':'M3 9L14 4L26 9L37 4V31L26 36L14 31L3 36ZM14 4V31M26 9V36',
'compass':'M25 10L23 23L10 30L16 16Z',
'infinity':'M20 20C-2 -10 -2 50 20 20C42 -10 42 50 20 20Z',
'hammer':'M7 11L16 3L29 16L20 24ZM22 20L35 33L30 38L17 25',
'juice':'M8 11H32L28 36H12ZM23 11L27 3H35M10 20H30',
'ice':'M8 7L29 3L36 13L32 33L12 37L4 27ZM8 7L15 17L36 13M15 17L12 37M23 7L26 12',
'bomb':'M16 12L14 6L23 3L27 10M25 5Q26 -1 33 3M28 13C46 29 18 47 7 29C0 18 16 7 28 13Z',
'scissors':'M7 26C-1 26 -1 38 7 38C15 38 15 26 7 26ZM30 26C22 26 22 38 30 38C38 38 38 26 30 26ZM9 27L30 3M29 27L8 3',
'sprout':'M20 36V18M20 22C2 24 2 5 3 5C17 3 20 9 20 22ZM20 16C18 2 29 0 36 3C38 15 29 18 20 16Z',
'wheat':'M20 37V8M20 14Q8 16 9 6Q19 6 20 14ZM20 24Q7 26 9 16Q19 16 20 24ZM20 18Q33 20 31 10Q21 10 20 18ZM20 30Q33 32 31 22Q21 22 20 30Z',
'candy':'M12 12L28 28M28 12L12 28M12 12L3 7L3 20L12 24M28 16L37 20L37 33L28 28',
'wind':'M3 13H27Q38 13 34 5Q30 0 25 6M3 21H35M3 29H22Q34 29 28 37',
'lock':'M8 17H32V36H8ZM12 17V10C12 -1 28 -1 28 10V17M20 23V29',
'home':'M3 19L20 3L37 19M8 15V36H32V15M16 36V24H24V36',
'trophy':'M11 4H29V19Q29 28 20 28Q11 28 11 19ZM11 9H3V16Q3 23 12 23M29 9H37V16Q37 23 28 23M20 28V36M11 36H29',
'cloud':'M11 30C-3 30 -2 13 12 14C13 -2 34 0 32 16C43 20 38 30 31 30Z',
'bolt':'M23 2L7 23H19L16 38L34 15H22Z',
'arrow':'M4 20H35M24 8L36 20L24 32',
'volume':'M4 15H11L22 5V35L11 25H4ZM28 13Q36 20 28 27M32 6Q45 20 32 34',
'book':'M20 8Q7 0 3 6V34Q11 29 20 36Q29 29 37 34V6Q30 0 20 8ZM20 8V36',
'calendar':'M6 9H34V36H6ZM6 17H34M13 3V12M27 3V12M13 24H17M23 24H27M13 30H17',
'check':'M6 20L16 30L34 9',
'close':'M9 9L31 31M31 9L9 31',
}
for name,d in icons.items():
    extra=''
    if name in ['clock','coin','compass']: extra='<circle cx="20" cy="21" r="16" fill="#f1cd7e" stroke="#35533b" stroke-width="2.4"/>'
    if name=='sun': extra='<circle cx="20" cy="20" r="9" fill="#edbc67" stroke="#35533b" stroke-width="2.4"/>'
    if name=='gear': extra+='<circle cx="20" cy="20" r="5" fill="#fff7df" stroke="#35533b" stroke-width="2.4"/>'
    (ROOT/'public/icons'/f'{name}.svg').write_text(f'<svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="-2 -2 44 44">{extra}<path d="{d}" fill="none" stroke="#35533b" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg>')
print(f'Drew {len(art)} fruits and {len(icons)} interface icons.')
# Bind fruit definitions to new artwork, remove font-based fallbacks.
f=ROOT/'src/game/data.ts';s=f.read_text(); a,b=s.split('const B =',1)
a=re.sub(r'  emoji: string;\n','',a);a=a.replace('icon?: string','icon: string')
a=re.sub(r'emoji: "[^"]*",\s*','',a);a=re.sub(r'icon: "[^"]*",\s*','',a)
idx=[-1]
def bind(m):
    idx[0]+=1
    return m[0]+f' icon: "/art/fruit-{idx[0]:02}.svg",'
a=re.sub(r'name: "[^"]*",',bind,a)
f.write_text(a+'const B ='+b)
