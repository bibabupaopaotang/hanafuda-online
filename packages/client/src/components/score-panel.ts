/**
 * 计分区组件（麻将风格）
 * 显示得分明细 + 役组合注释
 */

import { Area, COLORS } from '../layouts/horizontal-layout';

export interface YakuDetail {
  name: string;        // 役名（如"五光"）
  score: number;       // 分数
  cards: number[];     // 组成该役的牌 ID 列表
  description: string; // 注释说明
  isComplete: boolean; // 是否已成役
}

export interface ScorePanelData {
  totalScore: number;      // 总分
  currentRoundScore: number; // 本局得分
  yakuList: YakuDetail[];  // 役列表
  koiCount: number;        // Koi 次数
  koiMultiplier: number;   // Koi 倍数
  capturedCards: number[]; // 已收集的牌
}

/**
 * 绘制计分区面板（右侧 - 玩家）
 */
export function drawPlayerScorePanel(
  ctx: WechatMiniprogram.CanvasContext,
  area: Area,
  data: ScorePanelData,
  cardImages: Record<number, any>
) {
  const { x, y, width, height } = area;
  
  // 背景
  ctx.fillStyle = COLORS.captureBg;
  ctx.fillRect(x, y, width, height);
  
  // 边框
  ctx.strokeStyle = COLORS.captureBorder;
  ctx.lineWidth = 2;
  ctx.strokeRect(x + 2, y + 2, width - 4, height - 4);
  
  // 标题
  ctx.fillStyle = COLORS.captureText;
  ctx.font = 'bold 24px sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText('📊 得分明细', x + 15, y + 35);
  
  let currentY = y + 60;
  
  // 役列表
  data.yakuList.forEach((yaku) => {
    if (currentY > y + height - 100) return; // 空间不足
    
    // 役名 + 分数
    ctx.fillStyle = yaku.isComplete ? COLORS.yakuDarkRed : '#888';
    ctx.font = yaku.isComplete ? 'bold 20px sans-serif' : '18px sans-serif';
    ctx.fillText(
      `${yaku.name}${yaku.isComplete ? ' ✅' : ''}`,
      x + 15,
      currentY
    );
    
    ctx.textAlign = 'right';
    ctx.fillText(`${yaku.score}分`, x + width - 15, currentY);
    ctx.textAlign = 'left';
    
    // 注释说明
    ctx.fillStyle = '#666';
    ctx.font = '14px sans-serif';
    ctx.fillText(yaku.description, x + 15, currentY + 20);
    
    // 组成该役的牌（缩略图）
    if (yaku.cards.length > 0) {
      drawMiniCards(ctx, yaku.cards, x + 15, currentY + 30, cardImages);
    }
    
    currentY += 70;
  });
  
  // 分隔线
  ctx.strokeStyle = '#DDD';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(x + 10, currentY);
  ctx.lineTo(x + width - 10, currentY);
  ctx.stroke();
  currentY += 25;
  
  // Koi 加成
  if (data.koiCount > 0) {
    ctx.fillStyle = '#FF6B6B';
    ctx.font = 'bold 18px sans-serif';
    ctx.fillText(`Koi 次数：${data.koiCount}次`, x + 15, currentY);
    ctx.textAlign = 'right';
    ctx.fillText(`×${data.koiMultiplier}`, x + width - 15, currentY);
    ctx.textAlign = 'left';
    currentY += 30;
  }
  
  // 本局得分
  ctx.fillStyle = COLORS.yakuDarkRed;
  ctx.font = 'bold 24px sans-serif';
  ctx.fillText(`本局得分：${data.currentRoundScore}分`, x + 15, y + height - 50);
  
  // 累计总分
  ctx.fillStyle = COLORS.captureText;
  ctx.font = 'bold 28px sans-serif';
  ctx.textAlign = 'right';
  ctx.fillText(`累计总分：${data.totalScore}分`, x + width - 15, y + height - 20);
}

/**
 * 绘制对手计分区（左侧 - 简化版）
 */
export function drawOpponentScorePanel(
  ctx: WechatMiniprogram.CanvasContext,
  area: Area,
  data: ScorePanelData,
  cardImages: Record<number, any>
) {
  const { x, y, width, height } = area;
  
  // 背景（深色，区别于玩家）
  ctx.fillStyle = 'rgba(200, 200, 200, 0.9)';
  ctx.fillRect(x, y, width, height);
  
  // 边框
  ctx.strokeStyle = '#888';
  ctx.lineWidth = 2;
  ctx.strokeRect(x + 2, y + 2, width - 4, height - 4);
  
  // 标题
  ctx.fillStyle = '#333';
  ctx.font = 'bold 24px sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText('📊 对手得分', x + 15, y + 35);
  
  // 总分（大字）
  ctx.fillStyle = '#333';
  ctx.font = 'bold 36px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(`${data.totalScore}分`, x + width / 2, y + height / 2);
  
  // 收集牌数
  ctx.fillStyle = '#666';
  ctx.font = '16px sans-serif';
  ctx.fillText(`收集：${data.capturedCards.length}张`, x + width / 2, y + height / 2 + 40);
}

/**
 * 绘制小型牌组缩略图（麻将风格排列）
 * 参考：标准花札牌面布局
 */
function drawMiniCards(
  ctx: WechatMiniprogram.CanvasContext,
  cardIds: number[],
  startX: number,
  startY: number,
  cardImages: Record<number, any>
) {
  const cardW = 20;
  const cardH = 32;
  const gap = 2;
  
  // 最多显示 4 张（类似麻将的"吃碰杠"展示）
  const displayCards = cardIds.slice(0, 4);
  
  displayCards.forEach((id, i) => {
    const img = cardImages[id];
    if (img) {
      // 轻微重叠，类似麻将摆牌
      ctx.drawImage(img, startX + i * (cardW - 5), startY, cardW, cardH);
    }
  });
  
  // 超过 4 张显示"+N"
  if (cardIds.length > 4) {
    ctx.fillStyle = '#666';
    ctx.font = 'bold 12px sans-serif';
    ctx.fillText(`+${cardIds.length - 4}`, startX + 4 * (cardW - 5) + 5, startY + cardH / 2);
  }
}

/**
 * 绘制月份分组牌（用于计分区展示收集情况）
 * 按 12 个月份分组显示，类似参考图的布局
 */
export function drawMonthGroups(
  ctx: WechatMiniprogram.CanvasContext,
  area: Area,
  capturedCards: number[],
  cardImages: Record<number, any>
) {
  const { x, y, width, height } = area;
  
  // 月份标签（日文）
  const monthNames = [
    '松', '梅', '桜', '藤', '菖蒲', '牡丹',
    '萩', '芒', '菊', '紅葉', '柳', '桐'
  ];
  
  // 按月份分组
  const monthCards: Record<number, number[]> = {};
  for (let m = 1; m <= 12; m++) monthCards[m] = [];
  
  capturedCards.forEach((id: number) => {
    const month = getCardMonth(id);
    if (monthCards[month]) {
      monthCards[month].push(id);
    }
  });
  
  // 绘制有牌的月份（3×4 网格）
  let col = 0, row = 0;
  const cellW = width / 4;
  const cellH = height / 3;
  
  for (let m = 1; m <= 12; m++) {
    if (monthCards[m].length === 0) continue;
    
    const cellX = x + col * cellW;
    const cellY = y + row * cellH;
    
    // 月份名
    ctx.fillStyle = '#3C2415';
    ctx.font = 'bold 14px sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(monthNames[m - 1], cellX + 5, cellY + 18);
    
    // 牌数
    ctx.fillStyle = '#888';
    ctx.font = '12px sans-serif';
    ctx.textAlign = 'right';
    ctx.fillText(`×${monthCards[m].length}`, cellX + cellW - 5, cellY + 18);
    
    // 缩略图
    drawMiniCards(ctx, monthCards[m], cellX + 5, cellY + 22, cardImages);
    
    col++;
    if (col >= 4) {
      col = 0;
      row++;
    }
  }
}

/**
 * 根据牌 ID 获取月份（1-12）
 */
function getCardMonth(cardId: number): number {
  // 根据 card-data.md 的牌面数据映射
  const monthMap: Record<number, number> = {
    // 1 月松
    0: 1, 1: 1, 2: 1, 3: 1,
    // 2 月梅
    4: 2, 5: 2, 6: 2, 7: 2,
    // 3 月桜
    8: 3, 9: 3, 10: 3, 11: 3,
    // 4 月藤
    12: 4, 13: 4, 14: 4, 15: 4,
    // 5 月菖蒲
    16: 5, 17: 5, 18: 5, 19: 5,
    // 6 月牡丹
    20: 6, 21: 6, 22: 6, 23: 6,
    // 7 月萩
    24: 7, 25: 7, 26: 7, 27: 7,
    // 8 月芒
    28: 8, 29: 8, 30: 8, 31: 8,
    // 9 月菊
    32: 9, 33: 9, 34: 9, 35: 9,
    // 10 月紅葉
    36: 10, 37: 10, 38: 10, 39: 10,
    // 11 月柳
    40: 11, 41: 11, 42: 11, 43: 11,
    // 12 月桐
    44: 12, 45: 12, 46: 12, 47: 12,
  };
  return monthMap[cardId] || 1;
}

/**
 * 生成役详情列表（从 gameState 解析）
 */
export function parseYakuDetails(gameState: any): YakuDetail[] {
  const yakuList: YakuDetail[] = [];
  
  if (!gameState?.yaku) return yakuList;
  
  // 光牌役
  const lightCards = gameState.captured?.[gameState.mySeatIndex || 0]?.filter(
    (id: number) => [0, 8, 28, 40, 44].includes(id)
  ) || [];
  
  if (lightCards.length >= 5) {
    yakuList.push({
      name: '五光',
      score: 10,
      cards: lightCards,
      description: '集齐全部 5 张光牌',
      isComplete: true,
    });
  } else if (lightCards.length === 4) {
    const hasRain = lightCards.includes(40); // 11 月柳（雨）
    yakuList.push({
      name: hasRain ? '雨四光' : '四光',
      score: hasRain ? 7 : 8,
      cards: lightCards,
      description: hasRain ? '含小野道风的 4 张光牌' : '4 张光牌（不含雨）',
      isComplete: true,
    });
  } else if (lightCards.length === 3) {
    const hasRain = lightCards.includes(40);
    if (!hasRain) {
      yakuList.push({
        name: '三光',
        score: 6,
        cards: lightCards,
        description: '3 张光牌（不含雨）',
        isComplete: true,
      });
    }
  }
  
  // 短册役
  const akaStrips = [1, 5, 9, 45].filter(id => 
    gameState.captured?.[gameState.mySeatIndex || 0]?.includes(id)
  );
  const aoStrips = [16, 20, 24, 29, 32, 36].filter(id =>
    gameState.captured?.[gameState.mySeatIndex || 0]?.includes(id)
  );
  
  if (akaStrips.length >= 3) {
    yakuList.push({
      name: '赤短',
      score: 5,
      cards: akaStrips,
      description: `${akaStrips.length}张赤短（松梅樱桐）`,
      isComplete: true,
    });
  } else {
    yakuList.push({
      name: '赤短',
      score: 0,
      cards: akaStrips,
      description: `差${3 - akaStrips.length}张成役`,
      isComplete: false,
    });
  }
  
  if (aoStrips.length >= 3) {
    yakuList.push({
      name: '青短',
      score: 5,
      cards: aoStrips,
      description: `${aoStrips.length}张青/紫短册`,
      isComplete: true,
    });
  }
  
  // 种牌役
  const seedCards = gameState.captured?.[gameState.mySeatIndex || 0]?.filter(
    (id: number) => [2, 4, 13, 17, 21, 25, 30, 33, 37].includes(id)
  ) || [];
  
  if (seedCards.length >= 5) {
    yakuList.push({
      name: '种×' + seedCards.length,
      score: seedCards.length,
      cards: seedCards,
      description: `${seedCards.length}张种牌`,
      isComplete: true,
    });
  }
  
  return yakuList;
}
