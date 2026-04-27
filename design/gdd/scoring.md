# 得分与役计算 — 游戏设计文档

> 校验日期：2026-04-27
> 依赖：`rule-engine.md`（役表已定义），本文档详细规定计分流程

## 概述

- **系统名称**：得分与役计算 (Scoring & Yaku Calculator)
- **所属层级**：Feature
- **优先级**：P2
- **设计目标**：实现完整的役判定、分数计算、叠加逻辑，输出结构化的计分结果。

## 计分流程

```
玩家收集的牌 → 分类统计 → 役判定 → 叠加计算 → Koi 翻倍 → 最终得分
```

### 详细步骤

```
1. 接收玩家收集的牌列表（captured: HanafudaCard[]）
   ↓
2. 按类别分组：
   - lights: CardCategory.Light[]
   - seeds: CardCategory.Seed[]
   - strips: CardCategory.Strip[]
   - wastes: CardCategory.Waste[]
   ↓
3. 按类别分别判定役：
   ├─ 光牌役（五光/四光/雨四光/三光）
   ├─ 短册役（赤短/青短/短册累计）
   ├─ 种牌役（猪鹿蝶/种累计）
   ├─ カ斯役（カ斯累计）
   └─ 特殊役（呑み/花见酒/月见酒）
   ↓
4. 役叠加：所有满足的役分数相加
   ↓
5. Koi 翻倍：如果本局喊过 Koi 且先结束 → × 2^n
   ↓
6. 输出最终得分
```

## 役判定规则（完整版）

### 光牌役

```typescript
function checkLights(lights: HanafudaCard[]): YakuResult | null {
  const hasOno = lights.some(c => c.month === 11); // 小野道风
  
  if (lights.length === 5) {
    return { type: YakuType.FiveLights, points: 10, cards: [...lights] };
  }
  if (lights.length === 4) {
    if (hasOno) {
      return { type: YakuType.RainFourLights, points: 7, cards: [...lights] };
    } else {
      return { type: YakuType.FourLights, points: 8, cards: [...lights] };
    }
  }
  if (lights.length === 3 && !hasOno) {
    return { type: YakuType.ThreeLights, points: 6, cards: [...lights] };
  }
  
  return null; // 3 张以下或含小野道风的 3 张，不成役
}
```

**互斥关系**：光牌役互斥，最多只触发一个。优先级：五光 > 四光 > 雨四光 > 三光。

### 短册役

```typescript
function checkStrips(strips: HanafudaCard[]): YakuResult[] {
  const results: YakuResult[] = [];
  
  // 赤短：1月 + 2月 + 3月
  const akaStrips = strips.filter(c => [1, 2, 3].includes(c.month));
  if (akaStrips.length === 3) {
    results.push({ type: YakuType.RedStrips, points: 5, cards: [...akaStrips] });
  }
  
  // 青短：6月 + 7月 + 9月
  const aoStrips = strips.filter(c => [6, 7, 9].includes(c.month));
  if (aoStrips.length === 3) {
    results.push({ type: YakuType.BlueStrips, points: 5, cards: [...aoStrips] });
  }
  
  // 短册累计役（5 张起，不含赤短/青短中已计算的牌）
  // 注意：短册累计是按总短册数，不论是否参与赤短/青短
  if (strips.length >= 5) {
    const totalStrips = strips.length;
    const points = totalStrips - 4; // 5张=1分, 6张=2分, ...
    results.push({ 
      type: `strips_${totalStrips}` as YakuType, 
      points, 
      cards: [...strips] 
    });
  }
  
  return results;
}
```

**叠加关系**：赤短 + 青短 + 短册累计 可以叠加。
例：同时有赤短(5) + 短册×6(2) = 7 分

### 种牌役

```typescript
function checkSeeds(seeds: HanafudaCard[]): YakuResult[] {
  const results: YakuResult[] = [];
  
  // 猪鹿蝶：7月猪 + 10月鹿 + 6月蝶
  const hasBoar = seeds.some(c => c.month === 7);
  const hasDeer = seeds.some(c => c.month === 10);
  const hasButterfly = seeds.some(c => c.month === 6);
  
  if (hasBoar && hasDeer && hasButterfly) {
    const iscCards = seeds.filter(c => [6, 7, 10].includes(c.month));
    results.push({ 
      type: YakuType.BoarDeerButterfly, 
      points: 5, 
      cards: iscCards 
    });
  }
  
  // 种牌累计役（5 张起）
  if (seeds.length >= 5) {
    const points = seeds.length - 4; // 5张=1分, ...9张=5分
    results.push({ 
      type: `seeds_${seeds.length}` as YakuType, 
      points, 
      cards: [...seeds] 
    });
  }
  
  return results;
}
```

**叠加关系**：猪鹿蝶 + 种累计 可以叠加。

### カ斯役

```typescript
function checkWastes(wastes: HanafudaCard[]): YakuResult | null {
  if (wastes.length < 10) return null;
  
  const points = wastes.length - 9; // 10张=1分, 11张=2分, ...
  return { 
    type: `waste_${wastes.length}` as YakuType, 
    points, 
    cards: [...wastes] 
  };
}
```

### 特殊役（呑み/花见酒/月见酒）

```typescript
function checkSpecial(captured: HanafudaCard[]): YakuResult | null {
  const hasMarchLight = captured.some(c => c.category === CardCategory.Light && c.month === 3);
  const hasAugustLight = captured.some(c => c.category === CardCategory.Light && c.month === 8);
  const hasSepCup = captured.some(c => c.category === CardCategory.Seed && c.month === 9);
  
  if (hasMarchLight && hasAugustLight && hasSepCup) {
    // 呑み — 最高优先级
    return { type: YakuType.Nomu, points: 4, cards: [] };
  } else if (hasMarchLight && hasSepCup) {
    return { type: YakuType.FlowerSake, points: 3, cards: [] };
  } else if (hasAugustLight && hasSepCup) {
    return { type: YakuType.MoonSake, points: 3, cards: [] };
  }
  
  return null;
}
```

**互斥关系**：呑み / 花见酒 / 月见酒 互斥，三者只能触发一个。

## 特殊开局判定

### 手四（开局即有同月 4 张）

```typescript
function checkTeShi(hands: HanafudaCard[][]): { winner: number; score: number } | null {
  for (let p = 0; p < hands.length; p++) {
    const months = hands[p].map(c => c.month);
    const counts = countBy(months);
    for (const [month, count] of Object.entries(counts)) {
      if (count === 4) {
        return { winner: p, score: 6 };
      }
    }
  }
  return null;
}
```

## 总分计算

```typescript
interface ScoreResult {
  baseScore: number;       // 基础分（所有役叠加）
  yakuList: YakuResult[];  // 所有满足的役
  koiCount: number;        // Koi 次数
  koiMultiplier: number;   // Koi 倍率 (2^n)
  finalScore: number;      // 最终得分
  isKoiCallerWinner: boolean; // 喊 Koi 的人是否赢了
}

function calculateScore(
  captured: HanafudaCard[],
  koiCount: number,
  isKoiCaller: boolean,
  isWinner: boolean
): ScoreResult {
  // 1. 判定所有役
  const yakuList = checkAllYaku(captured);
  
  // 2. 基础分 = 所有役分数叠加
  const baseScore = yakuList.reduce((sum, y) => sum + y.points, 0);
  
  // 3. Koi 翻倍（仅当喊 Koi 的人赢了才翻倍）
  let koiMultiplier = 1;
  let finalScore = baseScore;
  
  if (koiCount > 0 && isKoiCaller && isWinner) {
    koiMultiplier = Math.pow(2, koiCount);
    finalScore = baseScore * koiMultiplier;
  }
  
  // 喊 Koi 的人输了 → 得 0 分
  if (koiCount > 0 && isKoiCaller && !isWinner) {
    finalScore = 0;
  }
  
  return {
    baseScore,
    yakuList,
    koiCount,
    koiMultiplier,
    finalScore,
    isKoiCallerWinner: isKoiCaller && isWinner,
  };
}
```

## 役组合示例

| 场景 | 役 | 基础分 | Koi | 最终得分 |
|------|-----|--------|-----|----------|
| 仅三光 | 三光(6) | 6 | 0 次 | 6 |
| 四光 + 猪鹿蝶 | 四光(8) + 猪鹿蝶(5) | 13 | 0 次 | 13 |
| 五光 + 赤短 + 短册×5 | 五光(10) + 赤短(5) + 短册×5(1) | 16 | 1 次 | 32 |
| 青短 + 种×6 + 花见酒 | 青短(5) + 种×6(2) + 花见酒(3) | 10 | 0 次 | 10 |
| 呑み + カ斯×15 | 呑み(4) + カ斯×15(6) | 10 | 2 次 | 40 |
| 仅カ斯×12 | カ斯×12(3) | 3 | 0 次 | 3 |
| 手四 | 手四(6) | 6 | 不适用 | 6（直接胜利） |

## 计分 UI 展示

结算时需要展示：

```
┌─────────────────────────────┐
│         结算               │
├─────────────────────────────┤
│  役列表：                   │
│  🌟 四光 ................ 8 │
│  🦌 猪鹿蝶 .............. 5 │
│                             │
│  基础分：............... 13 │
│  Koi 次数：.............. 1 │
│  翻倍：................. ×2 │
│  ─────────────────────      │
│  最终得分：.............. 26 │
└─────────────────────────────┘
```

## 测试要点

- [ ] 五光判定：10 分
- [ ] 四光（不含小野）：8 分
- [ ] 雨四光（含小野）：7 分
- [ ] 三光（不含小野）：6 分
- [ ] 小野 3 张光：不成役
- [ ] 赤短：5 分
- [ ] 青短：5 分
- [ ] 赤短 + 青短：10 分
- [ ] 短册×5：1 分，×6：2 分，... ×10：6 分
- [ ] 猪鹿蝶：5 分
- [ ] 种×5：1 分，... ×9：5 分
- [ ] カ斯×10：1 分，... ×20：11 分
- [ ] 呑み：4 分（含 3月幕+8月月+9月杯）
- [ ] 花见酒：3 分（仅 3月幕+9月杯）
- [ ] 月见酒：3 分（仅 8月月+9月杯）
- [ ] 呑み/花见/月见 互斥
- [ ] 役叠加正确
- [ ] Koi 翻倍正确（2^n）
- [ ] Koi 喊了但输了 → 0 分
- [ ] 手四：6 分直接胜利

## 版本历史

| 版本 | 日期 | 变更 |
|------|------|------|
| v0.1 | 2026-04-27 | 初始版本 |
