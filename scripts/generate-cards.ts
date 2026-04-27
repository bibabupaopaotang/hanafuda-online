/**
 * SVG 牌面生成器
 * 生成 48 张花札牌的 SVG 占位图 + 牌背图
 */

import { ALL_CARDS, Month } from '@hanafuda/core';
import { mkdirSync, writeFileSync } from 'fs';
import { dirname } from 'path';

const OUTPUT_DIR = './assets/cards';
const CARD_W = 120;
const CARD_H = 192;

// 类别颜色
const CATEGORY_COLORS: Record<string, string> = {
  hikari: '#FFD700',  // 光 - 金色
  tane: '#4CAF50',    // 种 - 绿色
  tanzaku: '#E91E63', // 短册 - 粉色
  kasu: '#9E9E9E',    // カス - 灰色
};

// 月份名称
const MONTH_NAMES: Record<number, string> = {
  1: '松', 2: '梅', 3: '桜', 4: '藤',
  5: '菖蒲', 6: '牡丹', 7: '萩', 8: '芒',
  9: '菊', 10: '紅葉', 11: '柳', 12: '桐',
};

// 月份背景图案（简化 SVG）
const MONTH_PATTERNS: Record<number, string> = {
  1: '<circle cx="60" cy="80" r="30" fill="#2E7D32" opacity="0.3"/>',     // 松 - 绿色圆
  2: '<circle cx="60" cy="80" r="30" fill="#E91E63" opacity="0.3"/>',     // 梅 - 粉色圆
  3: '<circle cx="60" cy="80" r="30" fill="#F48FB1" opacity="0.3"/>',     // 桜 - 浅粉圆
  4: '<circle cx="60" cy="80" r="30" fill="#7B1FA2" opacity="0.3"/>',     // 藤 - 紫色圆
  5: '<circle cx="60" cy="80" r="30" fill="#1565C0" opacity="0.3"/>',     // 菖蒲 - 蓝色圆
  6: '<circle cx="60" cy="80" r="30" fill="#C62828" opacity="0.3"/>',     // 牡丹 - 红色圆
  7: '<circle cx="60" cy="80" r="30" fill="#6D4C41" opacity="0.3"/>',     // 萩 - 棕色圆
  8: '<circle cx="60" cy="80" r="30" fill="#FFC107" opacity="0.3"/>',     // 芒 - 黄色圆
  9: '<circle cx="60" cy="80" r="30" fill="#FF9800" opacity="0.3"/>',     // 菊 - 橙色圆
  10: '<circle cx="60" cy="80" r="30" fill="#D84315" opacity="0.3"/>',    // 紅葉 - 深橙圆
  11: '<circle cx="60" cy="80" r="30" fill="#37474F" opacity="0.3"/>',    // 柳 - 深蓝灰圆
  12: '<circle cx="60" cy="80" r="30" fill="#607D8B" opacity="0.3"/>',    // 桐 - 蓝灰圆
};

mkdirSync(OUTPUT_DIR, { recursive: true });

function generateCardSVG(card: typeof ALL_CARDS[0]): string {
  const color = CATEGORY_COLORS[card.category];
  const monthName = MONTH_NAMES[card.month];
  const pattern = MONTH_PATTERNS[card.month] || '';

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${CARD_W}" height="${CARD_H}" viewBox="0 0 ${CARD_W} ${CARD_H}">
  <!-- 背景 -->
  <rect width="${CARD_W}" height="${CARD_H}" rx="8" fill="#FFFDE7" stroke="#8D6E63" stroke-width="2"/>
  ${pattern}
  <!-- 类别标记 -->
  <rect x="8" y="8" width="24" height="20" rx="4" fill="${color}"/>
  <text x="20" y="23" text-anchor="middle" font-size="12" fill="#fff" font-family="sans-serif">${card.pointLabel}</text>
  <!-- 月份 -->
  <text x="60" y="75" text-anchor="middle" font-size="28" fill="#333" font-family="serif">${monthName}</text>
  <!-- 类别名 -->
  <text x="60" y="105" text-anchor="middle" font-size="14" fill="${color}" font-weight="bold" font-family="sans-serif">${card.category}</text>
  <!-- 牌名 -->
  <text x="60" y="140" text-anchor="middle" font-size="11" fill="#666" font-family="sans-serif">${card.name}</text>
  <!-- 底部装饰线 -->
  <line x1="20" y1="170" x2="100" y2="170" stroke="#8D6E63" stroke-width="1" opacity="0.5"/>
</svg>`;
}

function generateCardBackSVG(): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${CARD_W}" height="${CARD_H}" viewBox="0 0 ${CARD_W} ${CARD_H}">
  <rect width="${CARD_W}" height="${CARD_H}" rx="8" fill="#2E7D32" stroke="#1B5E20" stroke-width="2"/>
  <rect x="10" y="10" width="${CARD_W - 20}" height="${CARD_H - 20}" rx="6" fill="none" stroke="#4CAF50" stroke-width="1"/>
  <rect x="16" y="16" width="${CARD_W - 32}" height="${CARD_H - 32}" rx="4" fill="none" stroke="#66BB6A" stroke-width="0.5"/>
  <text x="60" y="106" text-anchor="middle" font-size="48" fill="#4CAF50" font-family="serif" opacity="0.6">花</text>
</svg>`;
}

// 生成 48 张牌
for (const card of ALL_CARDS) {
  const filename = `card_${String(card.id).padStart(2, '0')}.svg`;
  writeFileSync(`${OUTPUT_DIR}/${filename}`, generateCardSVG(card));
}

// 生成牌背
writeFileSync(`${OUTPUT_DIR}/card_back.svg`, generateCardBackSVG());

console.log(`✅ 已生成 ${ALL_CARDS.length + 1} 个 SVG 文件到 ${OUTPUT_DIR}/`);
