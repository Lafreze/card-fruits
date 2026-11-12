"""Small-scale botanical finishes for the original fruit silhouettes."""
import colorsys
import math
import xml.etree.ElementTree as ET

def shade(color, light=0, saturation=1):
    rgb = [int(color[i:i+2],16)/255 for i in (1,3,5)]
    h,l,s=colorsys.rgb_to_hls(*rgb)
    r,g,b=colorsys.hls_to_rgb(h,max(.08,min(.97,l+light)),min(1,s*saturation))
    return '#%02x%02x%02x' % tuple(round(v*255) for v in (r,g,b))

def finish_art(markup, tier):
    tree=ET.fromstring('<g>'+markup+'</g>')
    defs=ET.Element('defs')
    result=ET.Element('g')
    for index,node in enumerate(tree):
        fill=node.get('fill','none')
        stroke=node.get('stroke','none')
        if fill.startswith('#'):
            gradient_id=f'f{index}'
            gradient=ET.SubElement(defs,'radialGradient',{'id':gradient_id,'cx':'29%','cy':'25%','r':'80%','fx':'28%','fy':'22%'})
            for offset,light,sat in [('0%',.18,1.04),('42%',.04,1.22),('78%',-.04,1.15),('100%',-.15,1.05)]:
                ET.SubElement(gradient,'stop',{'offset':offset,'stop-color':shade(fill,light,sat)})
            node.set('fill',f'url(#{gradient_id})')
            if stroke!='none':
                node.set('stroke',shade(fill,-.22,.8))
                node.set('stroke-width',str(min(1.25,float(node.get('stroke-width','1')))))
        elif stroke.startswith('#'):
            node.set('stroke-width',str(float(node.get('stroke-width','1'))*.7))
        result.append(node)
        # Fine reflected light stays within each fleshy shape, never beneath it.
        if fill.startswith('#') and node.tag=='ellipse' and float(node.get('rx',0))>=16 and float(node.get('ry',0))>=16:
            x,y,rx,ry=[float(node.get(k)) for k in ('cx','cy','rx','ry')]
            gleam=ET.SubElement(result,'path',{'d':f'M{x-rx*.55:.2f} {y-ry*.12:.2f} Q{x-rx*.62:.2f} {y-ry*.55:.2f} {x-rx*.1:.2f} {y-ry*.68:.2f}','fill':'none','stroke':'#fffaf0','stroke-width':str(max(1,rx*.065)),'stroke-linecap':'round','opacity':'.32'})
        # Botanical texture clipped to the fruit's first silhouette.
        if index==0 and tier in [5,9,10,11,12,14,22,24,27,30,31,35,38,40,43,45,48,49]:
            clip=ET.SubElement(defs,'clipPath',{'id':'skin'})
            copy=ET.fromstring(ET.tostring(node,encoding='unicode'))
            copy.set('fill','#fff'); copy.set('stroke','none');clip.append(copy)
            texture=ET.SubElement(result,'g',{'clip-path':'url(#skin)'})
            for n in range(48):
                x=20+((n*37+tier*13)%88);y=32+((n*23+tier*7)%78)
                ET.SubElement(texture,'ellipse',{'cx':str(x),'cy':str(y),'rx':'.65','ry':'1','fill':shade(fill,-.27),'opacity':'.20'})
    return ET.tostring(defs,encoding='unicode')+ET.tostring(result,encoding='unicode')
