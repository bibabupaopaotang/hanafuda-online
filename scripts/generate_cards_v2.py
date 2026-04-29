#!/usr/bin/env python3
"""
花札卡牌生成器 v2
使用 PIL/Pillow 生成 48 张花札卡牌 PNG 图片 + 牌背
每月独立主色调 + 装饰图案，4 种类型有明显标识
"""

from PIL import Image, ImageDraw, ImageFont, ImageFilter
import math
import os

# ================= 配置 =================
CARD_W = 120
CARD_H = 192
OUTPUT_DIR = "packages/client/assets/cards"
os.makedirs(OUTPUT_DIR, exist_ok=True)

# 月份配置
MONTHS = {
    1:  {"name": "松", "main": "#C62828", "accent": "#2E7D32", "bg": "#FFF8E1"},
    2:  {"name": "梅", "main": "#E91E63", "accent": "#8D6E63", "bg": "#FCE4EC"},
    3:  {"name": "桜", "main": "#F48FB1", "accent": "#FFFFFF", "bg": "#FFF0F5"},
    4:  {"name": "藤", "main": "#9C27B0", "accent": "#4A148C", "bg": "#F3E5F5"},
    5:  {"name": "菖蒲", "main": "#673AB7", "accent": "#311B92", "bg": "#EDE7F6"},
    6:  {"name": "牡丹", "main": "#E91E63", "accent": "#FCE4EC", "bg": "#FFF0F5"},
    7:  {"name": "萩", "main": "#F44336", "accent": "#4CAF50", "bg": "#FFEBEE"},
    8:  {"name": "芒", "main": "#FFC107", "accent": "#FF9800", "bg": "#FFFDE7"},
    9:  {"name": "菊", "main": "#FF9800", "accent": "#F57C00", "bg": "#FFF3E0"},
    10: {"name": "紅葉", "main": "#F44336", "accent": "#FF5722", "bg": "#FFEBEE"},
    11: {"name": "柳", "main": "#2196F3", "accent": "#64B5F6", "bg": "#E3F2FD"},
    12: {"name": "桐", "main": "#3F51B5", "accent": "#7986CB", "bg": "#E8EAF6"},
}

# 4 种类型
CATEGORIES = {
    0: {"name": "光", "border": "#FFD700", "badge": "#FFD700", "glow": True},
    1: {"name": "短", "border": "#E91E63", "badge": "#E91E63", "glow": False},
    2: {"name": "種", "border": "#4CAF50", "badge": "#4CAF50", "glow": False},
    3: {"name": "カ", "border": "#9E9E9E", "badge": "#9E9E9E", "glow": False},
}

LIGHT_IDS = [0, 8, 28, 40, 44]

# ================= 绘图 =================
def hex_to_rgba(hex_color):
    h = hex_color.lstrip('#')
    return tuple(int(h[i:i+2], 16) for i in (0, 2, 4))

def create_card_bg(month):
    img = Image.new('RGBA', (CARD_W, CARD_H), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)
    bg_color = MONTHS[month]["bg"]
    draw.rounded_rectangle([2, 2, CARD_W-3, CARD_H-3], radius=8, fill=bg_color)
    return img, draw

def draw_decor(draw, month, cx, cy):
    m = MONTHS[month]
    main = m["main"]
    accent = m["accent"]
    decor = month
    
    # 背景圆形色块
    draw.ellipse([cx-22, cy-22, cx+22, cy+22], fill=main + "22")
    
    if decor == 1:  # 松
        draw.polygon([(cx, cy-15), (cx-10, cy+8), (cx+10, cy+8)], fill=accent)
        draw.line([(cx, cy-15), (cx, cy+10)], fill="#5D4037", width=2)
    elif decor == 2:  # 梅
        for a in range(0, 360, 72):
            r = math.radians(a)
            px, py = cx + int(10*math.cos(r)), cy + int(10*math.sin(r))
            draw.ellipse([px-4, py-4, px+4, py+4], fill=main)
        draw.ellipse([cx-3, cy-3, cx+3, cy+3], fill="#FFC107")
    elif decor == 3:  # 桜
        for a in range(0, 360, 72):
            r = math.radians(a)
            px, py = cx + int(8*math.cos(r)), cy + int(8*math.sin(r))
            draw.ellipse([px-4, py-4, px+4, py+4], fill=main)
        draw.ellipse([cx-3, cy-3, cx+3, cy+3], fill="#FFF")
        draw.ellipse([cx+16, cy-8, cx+22, cy-2], fill=main + "66")
    elif decor == 4:  # 藤
        draw.arc([cx-12, cy-18, cx+12, cy+18], 0, 180, fill=main, width=2)
        for i in range(4):
            py = cy - 8 + i * 5
            draw.ellipse([cx-5, py-2, cx+5, py+2], fill=main)
    elif decor == 5:  # 菖蒲
        draw.polygon([(cx, cy-18), (cx-12, cy+12), (cx+12, cy+12)], fill=accent)
        draw.polygon([(cx, cy-8), (cx-6, cy+8), (cx+6, cy+8)], fill=main)
    elif decor == 6:  # 牡丹
        for r in [16, 10, 5]:
            draw.ellipse([cx-r, cy-r, cx+r, cy+r], fill=main if r > 12 else accent)
    elif decor == 7:  # 萩
        draw.polygon([(cx, cy-10), (cx-7, cy), (cx+7, cy)], fill=main)
        draw.polygon([(cx, cy+10), (cx-7, cy), (cx+7, cy)], fill=main)
    elif decor == 8:  # 芒
        draw.line([(cx, cy+12), (cx, cy-12)], fill="#8D6E63", width=2)
        for i in range(5):
            a = -50 + i * 20
            r = math.radians(a)
            ex = cx + int(16 * math.cos(r))
            ey = cy - 12 + int(16 * math.sin(r))
            draw.line([(cx, cy-12), (ex, ey)], fill=main, width=1)
    elif decor == 9:  # 菊
        for a in range(0, 360, 30):
            r = math.radians(a)
            ex = cx + int(18 * math.cos(r))
            ey = cy + int(18 * math.sin(r))
            draw.line([(cx, cy), (ex, ey)], fill=main, width=2)
        draw.ellipse([cx-4, cy-4, cx+4, cy+4], fill="#FFC107")
    elif decor == 10:  # 紅葉
        draw.polygon([
            (cx, cy-16), (cx+7, cy-6), (cx+16, cy-4),
            (cx+8, cy+2), (cx+12, cy+10), (cx+4, cy+6),
            (cx, cy+16), (cx-4, cy+6), (cx-12, cy+10),
            (cx-8, cy+2), (cx-16, cy-4), (cx-7, cy-6)
        ], fill=main)
    elif decor == 11:  # 柳
        draw.line([(cx, cy-18), (cx, cy+18)], fill=accent, width=2)
        for i in range(3):
            py = cy - 10 + i * 8
            draw.line([(cx, py), (cx+8, py+4)], fill=main, width=1)
            draw.line([(cx, py), (cx-8, py+4)], fill=main, width=1)
    elif decor == 12:  # 桐
        for dx in [-10, 0, 10]:
            for dy in [-7, 0, 7]:
                draw.ellipse([cx+dx-3, cy+dy-3, cx+dx+3, cy+dy+3], fill=main)

def draw_card(card_id):
    month = card_id // 4 + 1
    cat = card_id % 4
    is_light = card_id in LIGHT_IDS
    
    img, draw = create_card_bg(month)
    cx, cy = CARD_W // 2, CARD_H // 2 - 5
    
    # 光牌光芒
    if is_light:
        for a in range(0, 360, 30):
            r = math.radians(a)
            ex = cx + int(28 * math.cos(r))
            ey = cy + int(28 * math.sin(r))
            draw.line([(cx, cy), (ex, ey)], fill="#FFD70044", width=1)
    
    # 装饰图案
    draw_decor(draw, month, cx, cy)
    
    # 边框
    cat_info = CATEGORIES[cat]
    border = cat_info["border"]
    bw = 3 if is_light else 1
    draw.rounded_rectangle([2, 2, CARD_W-3, CARD_H-3], radius=8, outline=border, width=bw)
    
    if is_light:
        draw.rounded_rectangle([5, 5, CARD_W-6, CARD_H-6], radius=6, outline="#FFD700", width=1)
    
    # 类型徽标
    badge = cat_info["badge"]
    draw.ellipse([8, 8, 22, 22], fill=badge)
    
    # 月份文字
    month_name = MONTHS[month]["name"]
    # 简单绘制文字（不使用系统字体）
    bbox = draw.textbbox((0, 0), month_name)
    tw = bbox[2] - bbox[0]
    draw.text(((CARD_W - tw) // 2, cy + 25), month_name, fill="#333333")
    
    # 点数
    points = 20 if is_light else (10 if cat == 2 else (5 if cat == 1 else 1))
    pt_text = f"{points}pt"
    bbox = draw.textbbox((0, 0), pt_text)
    tw = bbox[2] - bbox[0]
    draw.text(((CARD_W - tw) // 2, CARD_H - 16), pt_text, fill="#999999")
    
    return img

def draw_card_back():
    img = Image.new('RGBA', (CARD_W, CARD_H), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)
    draw.rounded_rectangle([2, 2, CARD_W-3, CARD_H-3], radius=8, fill="#2E7D32")
    draw.rounded_rectangle([6, 6, CARD_W-7, CARD_H-7], radius=6, outline="#1B5E20", width=2)
    draw.rounded_rectangle([10, 10, CARD_W-11, CARD_H-11], radius=4, outline="#4CAF50", width=1)
    
    text = "花"
    bbox = draw.textbbox((0, 0), text)
    tw = bbox[2] - bbox[0]
    draw.text(((CARD_W - tw) // 2, CARD_H // 2 - 8), text, fill="#4CAF50")
    
    return img

# ================= 主流程 =================
print("开始生成花札卡牌...")

for i in range(48):
    card = draw_card(i)
    filename = f"{OUTPUT_DIR}/card_{i:02d}.png"
    card.save(filename, "PNG")
    print(f"  ✓ card_{i:02d}.png")

back = draw_card_back()
back.save(f"{OUTPUT_DIR}/card_back.png", "PNG")
print(f"  ✓ card_back.png")

print(f"\n✅ 完成！共 49 个文件 → {OUTPUT_DIR}/")
