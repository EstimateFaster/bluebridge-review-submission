
# -*- coding: utf-8 -*-
"""生成 Vela 天气页所需资产（纯本地绘制，无第三方素材，避免版权问题）。
输出：src/common/weather/*.png
"""
import math, random, os
from PIL import Image, ImageDraw, ImageFilter, ImageChops

OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "src", "common", "weather")
os.makedirs(OUT, exist_ok=True)
S = 4  # supersampling

def lerp(a, b, t):
    return tuple(int(round(a[i] + (b[i]-a[i])*t)) for i in range(len(a)))

def vgrad(size, stops):
    """stops: [(pos0..1, (r,g,b,a)), ...] vertical"""
    w, h = size
    col = Image.new("RGBA", (1, h))
    for y in range(h):
        t = y / max(1, h-1)
        c = stops[0][1]
        for i in range(len(stops)-1):
            p0, c0 = stops[i]; p1, c1 = stops[i+1]
            if p0 <= t <= p1:
                k = 0 if p1 == p0 else (t-p0)/(p1-p0)
                c = tuple(int(c0[j] + (c1[j]-c0[j])*k) for j in range(len(c0)))
                break
        col.putpixel((0, y), c)
    return col.resize((w, h), Image.BILINEAR)

def radial(size, inner=0.0, outer=1.0):
    """white center -> black edge L mask"""
    w, h = size
    img = Image.radial_gradient("L").resize((w, h), Image.BILINEAR)
    # radial_gradient is black center -> white edge; invert
    return ImageChops.invert(img)

def cloud_mask(size, parts, blur=0.0):
    """parts: list of (cx, cy, r) or (x0,y0,x1,y1,radius) in relative 0..1 coords"""
    m = Image.new("L", (size, size), 0)
    d = ImageDraw.Draw(m)
    for p in parts:
        if len(p) == 3:
            cx, cy, r = p
            d.ellipse([ (cx-r)*size, (cy-r)*size, (cx+r)*size, (cy+r)*size ], fill=255)
        else:
            x0, y0, x1, y1, rad = p
            d.rounded_rectangle([x0*size, y0*size, x1*size, y1*size], radius=rad*size, fill=255)
    if blur:
        m = m.filter(ImageFilter.GaussianBlur(blur*size))
    return m

def fill_with_gradient(size, mask, stops, shadow=False):
    g = vgrad((size, size), stops)
    g.putalpha(mask)
    return g

def draw_cloud(size, palette, scale=1.0, dy=0.0, shadow=True):
    """palette: (top_color, bottom_color)"""
    top, bot = palette
    stops = [(0.0, top), (1.0, bot)]
    parts = [
        (0.36, 0.62, 0.21),
        (0.60, 0.55, 0.25),
        (0.78, 0.66, 0.17),
        (0.20, 0.72, 0.14),
        (0.10, 0.55, 0.55, 0.92, 0.20),
    ]
    m = cloud_mask(size, parts, blur=0.004)
    img = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    if shadow:
        sh = Image.new("RGBA", (size, size), (0, 0, 0, 0))
        sm = m.point(lambda v: int(v*0.55))
        sh.paste((0, 0, 0, 120), (0, 0), sm.filter(ImageFilter.GaussianBlur(size*0.02)))
        img = Image.alpha_composite(img, ImageChops.offset(sh, 0, int(size*0.03)))
    img = Image.alpha_composite(img, fill_with_gradient(size, m, stops))
    # inner highlight on upper-left
    hi = cloud_mask(size, [(0.36, 0.56, 0.14), (0.60, 0.50, 0.17)], blur=0.01)
    hi = ImageChops.multiply(hi, m)
    hl = Image.new("RGBA", (size, size), (255, 255, 255, 40))
    hl.putalpha(ImageChops.multiply(hl.getchannel("A"), hi))
    return Image.alpha_composite(img, hl)

def draw_sun(size, colors=((255, 234, 170, 255), (245, 158, 11, 255)), with_rays=True, cx=0.5, cy=0.5, r=0.24):
    img = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    if with_rays:
        ray_mask = Image.new("L", (size, size), 0)
        d = ImageDraw.Draw(ray_mask)
        for i in range(8):
            a = math.pi/4*i + math.pi/8
            x0 = (cx + math.cos(a)*r*1.45)*size
            y0 = (cy + math.sin(a)*r*1.45)*size
            x1 = (cx + math.cos(a)*r*2.05)*size
            y1 = (cy + math.sin(a)*r*2.05)*size
            d.line([x0, y0, x1, y1], fill=255, width=int(size*0.045))
        ray_mask = ray_mask.filter(ImageFilter.GaussianBlur(size*0.004))
        rays = Image.new("RGBA", (size, size), (251, 191, 36, 0))
        rays.putalpha(ray_mask.point(lambda v: int(v * 0.92)))
        img = Image.alpha_composite(img, rays)
    # glow：只模糊 alpha 通道，避免 RGBA 直接模糊把透明区黑色混进来（黑边/黑圆）
    rr = int(min(r*1.55, 0.34) * size)
    glow_a = Image.new("L", (size, size), 0)
    gm = radial((rr*2, rr*2)).resize((rr*2, rr*2), Image.BILINEAR)
    gy = max(0, int(cy*size)-rr)
    gx = max(0, int(cx*size)-rr)
    glow_a.paste(gm, (gx, gy))
    glow_a = glow_a.filter(ImageFilter.GaussianBlur(size*0.02))
    glow_a = glow_a.point(lambda v: int(v * 0.14))
    gl = Image.new("RGBA", (size, size), (251, 191, 36, 0))
    gl.putalpha(glow_a)
    img = Image.alpha_composite(img, gl)
    # disk
    disk_mask = Image.new("L", (size, size), 0)
    ImageDraw.Draw(disk_mask).ellipse([(cx-r)*size, (cy-r)*size, (cx+r)*size, (cy+r)*size], fill=255)
    g = vgrad((size, size), [(max(0, cy-r), colors[0]), (min(1, cy+r), colors[1])])
    g.putalpha(disk_mask)
    img = Image.alpha_composite(img, g)
    return img

def save(img, name, final):
    # 把透明通道在画布边缘压到 0，去掉图标外圈的方形微光
    size = img.size[0]
    fade = Image.new("L", (size, size), 0)
    fd = ImageDraw.Draw(fade)
    inset = max(2, int(size * 0.012))
    fd.rectangle([inset, inset, size - inset - 1, size - inset - 1], fill=255)
    fade = fade.filter(ImageFilter.GaussianBlur(max(1, size * 0.012)))
    a = ImageChops.multiply(img.getchannel("A"), fade)
    # 清掉极低 alpha 的溢光（否则深色背景上会看到图标外圈的方形底）
    a = a.point(lambda v: 0 if v < 22 else v)
    img.putalpha(a)
    img = img.resize((final, final), Image.LANCZOS)
    img.save(os.path.join(OUT, name), "PNG", optimize=True)
    print("wrote", name, final)

# ---------- 天气图标 ----------
def weather_icon(kind, size=512):
    size = size  # supersampled canvas
    img = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    if kind == "clear":
        img = draw_sun(size, r=0.22)
    elif kind == "partly":
        img = draw_sun(size, r=0.15, cx=0.62, cy=0.34)
        img = Image.alpha_composite(img, draw_cloud(size, ((250, 250, 252, 255), (186, 200, 218, 255))))
    elif kind == "cloudy":
        img = draw_cloud(size, ((248, 250, 252, 255), (166, 183, 204, 255)))
    elif kind == "overcast":
        back = draw_cloud(size, ((148, 163, 184, 255), (100, 116, 139, 255)))
        back = back.resize((int(size*0.8), int(size*0.8)), Image.LANCZOS)
        back = back.crop((0, 0, size, size)) if False else back
        canvas = Image.new("RGBA", (size, size), (0, 0, 0, 0))
        canvas.paste(back, (int(size*0.16), int(size*0.02)))
        front = draw_cloud(size, ((226, 232, 240, 255), (148, 163, 184, 255)))
        canvas = Image.alpha_composite(canvas, front)
        img = canvas
    elif kind == "rain":
        img = draw_cloud(size, ((242, 245, 249, 255), (170, 186, 206, 255)))
        drops = Image.new("RGBA", (size, size), (0, 0, 0, 0))
        d = ImageDraw.Draw(drops)
        for i, x in enumerate((0.30, 0.50, 0.70)):
            top = 0.76 + (i % 2) * 0.04
            d.rounded_rectangle([x*size - size*0.022, top*size, x*size + size*0.022, (top+0.15)*size],
                                radius=size*0.022, fill=(96, 165, 250, 245))
        drops = drops.filter(ImageFilter.GaussianBlur(size*0.003))
        img = Image.alpha_composite(img, drops)
    elif kind == "wind":
        img = Image.new("RGBA", (size, size), (0, 0, 0, 0))
        d = ImageDraw.Draw(img)
        for i, y in enumerate((0.34, 0.5, 0.66)):
            pts = []
            x0 = 0.12 + i*0.04
            x1 = 0.72 - i*0.08
            for k in range(40):
                t = k/39
                xx = x0 + (x1-x0)*t
                yy = y + math.sin(t*math.pi*1.6 + i)*0.045
                pts.append((xx*size, yy*size))
            d.line(pts, fill=(147, 197, 253, 235), width=int(size*0.045), joint="curve")
        img = img.filter(ImageFilter.GaussianBlur(size*0.002))
    return img

for kind in ("clear", "partly", "cloudy", "overcast", "rain"):
    save(weather_icon(kind, 512), f"w-{kind}@2x.png", 128)
    save(weather_icon(kind, 192), f"w-{kind}.png", 48)

# ---------- 指标小图标 ----------
def metric_icon(kind, size=192):
    img = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    if kind == "humidity":
        # droplet: circle + curved top
        cx, cy, r = 0.5, 0.62, 0.20
        d.ellipse([(cx-r)*size, (cy-r)*size, (cx+r)*size, (cy+r)*size], fill=(103, 232, 249, 255))
        top = (0.5, 0.16)
        pts = []
        for k in range(24):
            t = k/23
            # bezier from left of circle up to tip and down to right
            p0 = ((cx-r), cy-r*0.2); p1 = (cx-r*0.9, cy-r*0.95); p2 = (cx, cy-r*1.06); p3 = (cx+r*0.9, cy-r*0.95)
            # simple: left curve then right curve
        # 水滴：底部圆 + 顶部尖角
        d.ellipse([(cx-r)*size, (cy-r*0.72)*size, (cx+r)*size, (cy+r)*size], fill=(103, 232, 249, 255))
        d.polygon([((cx-r*0.78)*size, (cy-r*0.2)*size), (cx*size, (cy-r*1.55)*size), ((cx+r*0.78)*size, (cy-r*0.2)*size)], fill=(103, 232, 249, 255))
        g = vgrad((size, size), [(0.2, (165, 243, 252, 255)), (0.8, (14, 165, 233, 255))])
        g.putalpha(img.getchannel("A"))
        img = g
    elif kind == "wind":
        for i, y in enumerate((0.34, 0.52, 0.70)):
            pts = []
            x0, x1 = 0.12 + i*0.03, 0.74 - i*0.06
            for k in range(30):
                t = k/29
                pts.append(((x0+(x1-x0)*t)*size, (y + math.sin(t*math.pi*1.7+i)*0.05)*size))
            d.line(pts, fill=(147, 197, 253, 255), width=int(size*0.055), joint="curve")
    elif kind == "uv":
        cx, cy, r = 0.5, 0.5, 0.19
        for i in range(8):
            a = math.pi/4*i + math.pi/8
            d.line([( (cx+math.cos(a)*r*1.35)*size, (cy+math.sin(a)*r*1.35)*size ),
                    ( (cx+math.cos(a)*r*1.85)*size, (cy+math.sin(a)*r*1.85)*size )],
                   fill=(251, 191, 36, 240), width=int(size*0.05))
        d.ellipse([(cx-r)*size, (cy-r)*size, (cx+r)*size, (cy+r)*size], fill=(255, 224, 138, 255))
        g = vgrad((size, size), [(0.31, (255, 236, 170, 255)), (0.69, (245, 158, 11, 255))])
        this = img.getchannel("A")
        img.paste(g, (0, 0), this)
    elif kind == "aqi":
        # leaf
        d.pieslice([0.16*size, 0.18*size, 0.84*size, 0.86*size], 110, 290, fill=(134, 239, 172, 255))
        d.polygon([(0.2*size, 0.3*size), (0.62*size, 0.8*size), (0.56*size, 0.86*size), (0.16*size, 0.38*size)], fill=(134, 239, 172, 255))
        g = vgrad((size, size), [(0.2, (187, 247, 208, 255)), (0.85, (34, 197, 94, 255))])
        g.putalpha(img.getchannel("A"))
        img = g
        d2 = ImageDraw.Draw(img)
        d2.line([(0.24*size, 0.5*size), (0.66*size, 0.7*size)], fill=(240, 253, 244, 220), width=int(size*0.035))
    elif kind in ("sunrise", "sunset"):
        horizon = 0.62
        d.line([(0.10*size, horizon*size), (0.90*size, horizon*size)], fill=(148, 163, 184, 255), width=int(size*0.045))
        r = 0.17
        cy = horizon - 0.05 if kind == "sunrise" else horizon + 0.06
        d.pieslice([(0.5-r)*size, (cy-r)*size, (0.5+r)*size, (cy+r)*size], 180 if kind == "sunrise" else 0, 360 if kind == "sunrise" else 180, fill=(251, 191, 36, 255))
        for dx in (-0.28, 0, 0.28):
            x = (0.5+dx)*size
            y0 = (horizon-0.16)*size if kind == "sunrise" else (horizon+0.16)*size
            y1 = (horizon-0.10)*size if kind == "sunrise" else (horizon+0.10)*size
            d.line([x, y0, x, y1], fill=(251, 191, 36, 220), width=int(size*0.04))
    elif kind == "location":
        d.ellipse([(0.24)*size, (0.12)*size, (0.76)*size, (0.64)*size], fill=(248, 250, 252, 255))
        d.polygon([(0.28*size, 0.50*size), (0.72*size, 0.50*size), (0.5*size, 0.84*size)], fill=(248, 250, 252, 255))
        d.ellipse([(0.40)*size, (0.26)*size, (0.60)*size, (0.46)*size], fill=(15, 23, 42, 255))
        g = vgrad((size, size), [(0.1, (255, 255, 255, 255)), (0.8, (148, 163, 184, 255))])
        g.putalpha(img.getchannel("A"))
        img = g
    elif kind == "clock":
        d.ellipse([0.1*size, 0.1*size, 0.9*size, 0.9*size], outline=(226, 232, 240, 255), width=int(size*0.06))
        d.line([(0.5*size, 0.5*size), (0.5*size, 0.26*size)], fill=(226, 232, 240, 255), width=int(size*0.05))
        d.line([(0.5*size, 0.5*size), (0.68*size, 0.58*size)], fill=(226, 232, 240, 255), width=int(size*0.05))
    return img

for kind in ("humidity", "wind", "uv", "aqi", "sunrise", "sunset", "location", "clock"):
    save(metric_icon(kind, 192), f"m-{kind}.png", 40)

# ---------- 背景 ----------
W, H = 336, 480
SS = 3
w, h = W*SS, H*SS
base = vgrad((w, h), [
    (0.00, (15, 34, 66, 255)),
    (0.30, (20, 46, 88, 255)),
    (0.55, (16, 36, 70, 255)),
    (0.78, (10, 23, 46, 255)),
    (1.00, (5, 11, 22, 255)),
])

def glow(cx, cy, rad, color, alpha):
    g = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    rr = int(rad)
    mask = radial((rr*2, rr*2)).resize((rr*2, rr*2), Image.LANCZOS).point(lambda v: int(v*alpha))
    g.paste(color + (255,), (int(cx)-rr, int(cy)-rr, int(cx)+rr, int(cy)+rr), mask)
    return g.filter(ImageFilter.GaussianBlur(w*0.01))

base = Image.alpha_composite(base, glow(w*0.76, h*0.15, w*0.62, (251, 191, 36), 0.30))
base = Image.alpha_composite(base, glow(w*0.16, h*0.50, w*0.7, (56, 189, 248), 0.18))
base = Image.alpha_composite(base, glow(w*0.5, h*0.88, w*0.55, (99, 102, 241), 0.12))

# 柔和云带
clouds = Image.new("RGBA", (w, h), (0, 0, 0, 0))
for cy, scale, a in ((0.26, 1.1, 34), (0.46, 1.5, 24), (0.66, 1.0, 18), (0.82, 1.7, 12)):
    m = cloud_mask(w, [
        (0.18, cy+0.01, 0.10*scale), (0.34, cy-0.015, 0.12*scale), (0.52, cy+0.02, 0.14*scale),
        (0.70, cy-0.01, 0.11*scale), (0.86, cy+0.015, 0.09*scale),
    ], blur=0.02)
    cm = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    cm.paste((255, 255, 255, a), (0, 0), m)
    clouds = Image.alpha_composite(clouds, cm)
base = Image.alpha_composite(base, clouds.filter(ImageFilter.GaussianBlur(w*0.012)))

# 星星
stars = Image.new("RGBA", (w, h), (0, 0, 0, 0))
d = ImageDraw.Draw(stars)
random.seed(7)
for _ in range(70):
    x = random.uniform(0, w); y = random.uniform(0, h*0.55)
    r = random.uniform(0.4, 1.2)*SS
    a = random.randint(25, 110)
    d.ellipse([x-r, y-r, x+r, y+r], fill=(255, 255, 255, a))
base = Image.alpha_composite(base, stars)

# 暗角
vig = radial((w, h)).point(lambda v: int(255 - v*0.55))
black = Image.new("RGBA", (w, h), (2, 6, 14, 255))
black.putalpha(vig)
base = Image.alpha_composite(base, black)

# 轻微噪点，避免色带
noise = Image.effect_noise((w//3, h//3), 6).resize((w, h), Image.BILINEAR)
noise_rgba = Image.new("RGBA", (w, h), (255, 255, 255, 0))
noise_rgba.putalpha(noise.point(lambda v: int(abs(v-128)/16)))
base = Image.alpha_composite(base, noise_rgba)

base = base.resize((W, H), Image.LANCZOS)
base.save(os.path.join(OUT, "bg-sky.png"), "PNG", optimize=True)
print("wrote bg-sky.png")

# ---------- 应用图标 ----------
icon = vgrad((256, 256), [(0.0, (17, 34, 64, 255)), (1.0, (8, 18, 36, 255))])
mask = Image.new("L", (256, 256), 0)
ImageDraw.Draw(mask).rounded_rectangle([0, 0, 255, 255], radius=56, fill=255)
icon.putalpha(mask)
gl = Image.new("RGBA", (256, 256), (0, 0, 0, 0))
gl.paste((251, 191, 36, 60), (60, 30, 240, 210), radial((180, 180)))
icon = Image.alpha_composite(icon, gl.filter(ImageFilter.GaussianBlur(8)))
sun = draw_sun(256, r=0.16, cx=0.62, cy=0.36)
cl = draw_cloud(256, ((250, 250, 252, 255), (186, 200, 218, 255)))
icon = Image.alpha_composite(icon, sun)
icon = Image.alpha_composite(icon, cl)
icon.putalpha(ImageChops.multiply(icon.getchannel("A"), mask))
icon.save(os.path.join(OUT, "app-icon.png"), "PNG", optimize=True)
print("wrote app-icon.png")
