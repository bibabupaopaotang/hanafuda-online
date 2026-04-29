#!/usr/bin/env python3
"""
花札卡牌生成器 v2
使用 PIL/Pillow 生成 48 张精美花札卡牌 PNG 图片
每月独特配色 + 装饰图案，4 种类型明显标识，光牌金色发光
"""

from PIL import Image, ImageDraw
import math, os

CARD_W, CARD_H = 120, 192
OUT = "packages/client/assets/cards"
os.makedirs(OUT, exist_ok=True)

# 月份：(名称, 主色, 辅色, 背景色)
MONTHS = [
    None,
    ("松",   "#C62828", "#2E7D32", "#FFF8E1"),
    ("梅",   "#E91E63", "#8D6E63", "#FCE4EC"),
    ("桜",   "#F48FB1", "#FFFFFF", "#FFF0F5"),
    ("藤",   "#9C27B0", "#4A148C", "#F3E5F5"),
    ("菖蒲", "#673AB7", "#311B92", "#EDE7F6"),
    ("牡丹", "#E91E63", "#FCE4EC", "#FFF0F5"),
    ("萩",   "#F44336", "#4CAF50", "#FFEBEE"),
    ("芒",   "#FFC107", "#FF9800", "#FFFDE7"),
    ("菊",   "#FF9800", "#F57C00", "#FFF3E0"),
    ("紅葉", "#F44336", "#FF5722", "#FFEBEE"),
    ("柳",   "#2196F3", "#64B5F6", "#E3F2FD"),
    ("桐",   "#3F51B5", "#7986CB", "#E8EAF6"),
]

# 类型：(名称, 边框色, 徽标色)
CATS = [
    ("光", "#FFD700", "#FFD700"),  # 光牌 - 金色
    ("短", "#E91E63", "#E91E63"),  # 短册 - 红
    ("種", "#4CAF50", "#4CAF50"),  # 种牌 - 绿
    ("カ", "#9E9E9E", "#9E9E9E"),  # カス - 灰
]

LIGHTS = [0, 8, 28, 40, 44]  # 5 张光牌 ID

def hex_rgb(h):
    return tuple(int(h[i:i+2], 16) for i in (1, 3, 5))

def draw_pine(d, cx, cy, main, acc):
    d.polygon([(cx,cy-16),(cx-11,cy+8),(cx+11,cy+8)], fill=acc)
    d.line([(cx,cy-16),(cx,cy+12)], fill="#5D4037", width=2)

def draw_plum(d, cx, cy, main, acc):
    for a in range(0,360,72):
        r=math.radians(a); px=cx+int(10*math.cos(r)); py=cy+int(10*math.sin(r))
        d.ellipse([px-4,py-4,px+4,py+4], fill=main)
    d.ellipse([cx-3,cy-3,cx+3,cy+3], fill="#FFC107")

def draw_cherry(d, cx, cy, main, acc):
    for a in range(0,360,72):
        r=math.radians(a); px=cx+int(8*math.cos(r)); py=cy+int(8*math.sin(r))
        d.ellipse([px-4,py-4,px+4,py+4], fill=main)
    d.ellipse([cx-3,cy-3,cx+3,cy+3], fill="#FFF")
    d.ellipse([cx+16,cy-8,cx+22,cy-2], fill=main+"66")

def draw_wisteria(d, cx, cy, main, acc):
    d.arc([cx-12,cy-18,cx+12,cy+18], 0, 180, fill=main, width=2)
    for i in range(4):
        py=cy-8+i*5; d.ellipse([cx-5,py-2,cx+5,py+2], fill=main)

def draw_iris(d, cx, cy, main, acc):
    d.polygon([(cx,cy-18),(cx-12,cy+12),(cx+12,cy+12)], fill=acc)
    d.polygon([(cx,cy-8),(cx-6,cy+8),(cx+6,cy+8)], fill=main)

def draw_peony(d, cx, cy, main, acc):
    for r in [16,10,5]:
        d.ellipse([cx-r,cy-r,cx+r,cy+r], fill=main if r>12 else acc)

def draw_clover(d, cx, cy, main, acc):
    d.polygon([(cx,cy-10),(cx-7,cy),(cx+7,cy)], fill=main)
    d.polygon([(cx,cy+10),(cx-7,cy),(cx+7,cy)], fill=main)

def draw_susuki(d, cx, cy, main, acc):
    d.line([(cx,cy+12),(cx,cy-12)], fill="#8D6E63", width=2)
    for i in range(5):
        a=-50+i*20; r=math.radians(a)
        ex=cx+int(16*math.cos(r)); ey=cy-12+int(16*math.sin(r))
        d.line([(cx,cy-12),(ex,ey)], fill=main, width=1)

def draw_mum(d, cx, cy, main, acc):
    for a in range(0,360,30):
        r=math.radians(a); ex=cx+int(18*math.cos(r)); ey=cy+int(18*math.sin(r))
        d.line([(cx,cy),(ex,ey)], fill=main, width=2)
    d.ellipse([cx-4,cy-4,cx+4,cy+4], fill="#FFC107")

def draw_maple(d, cx, cy, main, acc):
    d.polygon([
        (cx,cy-16),(cx+7,cy-6),(cx+16,cy-4),(cx+8,cy+2),(cx+12,cy+10),
        (cx+4,cy+6),(cx,cy+16),(cx-4,cy+6),(cx-12,cy+10),
        (cx-8,cy+2),(cx-16,cy-4),(cx-7,cy-6)
    ], fill=main)

def draw_willow(d, cx, cy, main, acc):
    d.line([(cx,cy-18),(cx,cy+18)], fill=acc, width=2)
    for i in range(3):
        py=cy-10+i*8
        d.line([(cx,py),(cx+8,py+4)], fill=main, width=1)
        d.line([(cx,py),(cx-8,py+4)], fill=main, width=1)

def draw_paulownia(d, cx, cy, main, acc):
    for dx in [-10,0,10]:
        for dy in [-7,0,7]:
            d.ellipse([cx+dx-3,cy+dy-3,cx+dx+3,cy+dy+3], fill=main)

DECOR = [None, draw_pine, draw_plum, draw_cherry, draw_wisteria, draw_iris,
         draw_peony, draw_clover, draw_susuki, draw_mum, draw_maple, draw_willow, draw_paulownia]

def make_card(cid):
    m = cid // 4 + 1
    c = cid % 4
    is_light = cid in LIGHTS
    name, main, acc, bg = MONTHS[m]
    cname, bdr, badge = CATS[c]
    
    img = Image.new('RGBA', (CARD_W, CARD_H), (0,0,0,0))
    d = ImageDraw.Draw(img)
    
    # 背景
    d.rounded_rectangle([2,2,CARD_W-3,CARD_H-3], radius=8, fill=bg)
    
    cx, cy = CARD_W//2, CARD_H//2 - 5
    
    # 光牌光芒
    if is_light:
        for a in range(0,360,30):
            r=math.radians(a); ex=cx+int(28*math.cos(r)); ey=cy+int(28*math.sin(r))
            d.line([(cx,cy),(ex,ey)], fill="#FFD70044", width=1)
    
    # 装饰
    DECOR[m](d, cx, cy, main, acc)
    
    # 边框
    bw = 3 if is_light else 1
    d.rounded_rectangle([2,2,CARD_W-3,CARD_H-3], radius=8, outline=bdr, width=bw)
    if is_light:
        d.rounded_rectangle([5,5,CARD_W-6,CARD_H-6], radius=6, outline="#FFD700", width=1)
    
    # 类型徽标
    d.ellipse([8,8,22,22], fill=badge)
    bbox = d.textbbox((0,0), cname)
    tw = bbox[2]-bbox[0]; th = bbox[3]-bbox[1]
    d.text((15-tw//2, 15-th//2), cname, fill="#FFF")
    
    # 月份文字
    bbox = d.textbbox((0,0), name)
    tw = bbox[2]-bbox[0]
    d.text(((CARD_W-tw)//2, cy+25), name, fill="#333333")
    
    # 点数
    pts = 20 if is_light else (10 if c==2 else (5 if c==1 else 1))
    pt = f"{pts}pt"
    bbox = d.textbbox((0,0), pt)
    tw = bbox[2]-bbox[0]
    d.text(((CARD_W-tw)//2, CARD_H-16), pt, fill="#999999")
    
    return img

def make_back():
    img = Image.new('RGBA', (CARD_W, CARD_H), (0,0,0,0))
    d = ImageDraw.Draw(img)
    d.rounded_rectangle([2,2,CARD_W-3,CARD_H-3], radius=8, fill="#2E7D32")
    d.rounded_rectangle([6,6,CARD_W-7,CARD_H-7], radius=6, outline="#1B5E20", width=2)
    d.rounded_rectangle([10,10,CARD_W-11,CARD_H-11], radius=4, outline="#4CAF50", width=1)
    t="花"; bbox=d.textbbox((0,0),t); tw=bbox[2]-bbox[0]
    d.text(((CARD_W-tw)//2, CARD_H//2-8), t, fill="#4CAF50")
    return img

print("生成 48 张花札卡牌 + 牌背...")
for i in range(48):
    make_card(i).save(f"{OUT}/card_{i:02d}.png", "PNG")
    print(f"  ✓ card_{i:02d}.png")
make_back().save(f"{OUT}/card_back.png", "PNG")
print(f"  ✓ card_back.png")
print(f"✅ 完成！→ {OUT}/")
