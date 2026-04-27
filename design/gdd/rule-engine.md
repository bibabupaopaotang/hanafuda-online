# 游戏规则引擎 — 游戏设计文档

> 数据来源：搜狗百科 + 知乎 + 机核 + TapTap 花札物语 + 用户人工校验
> 校验日期：2026-04-27
> ✅ 规则核心逻辑已确认

## 概述

- **系统名称**：游戏规则引擎 (Game Rule Engine)
- **所属层级**：Foundation
- **优先级**：P0
- **设计目标**：实现花札的核心规则逻辑，包括发牌、出牌、匹配、役判定、计分。
  作为 Koi-Koi（两人）和 Hachi-Hachi（三人）两种模式的共享基础层。

## Koi-Koi（こいこい）规则

### 基本信息

- **人数**：2 人
- **牌数**：48 张花札
- **目标**：累计先到 **7 分** 者直接胜利

### 发牌流程

1. **决定亲/子**（庄家/闲家）：各抽一张牌，月份小者为"亲"
2. **发牌方式**："手八の场八"
   - 每人手牌 8 张
   - 场牌 8 张（正面朝上）
   - 剩余 24 张作为山札（牌堆）
3. **发牌顺序**：亲先拿 2 张 → 子拿 2 张 → 交替直到各 8 张
4. **特殊检查**：
   - 如果场中出现 **四张同月** → 流局重开
   - 如果玩家手牌中有 **四张同月**（手四）→ 该玩家直接胜利，得 6 分

### 回合流程

每回合玩家执行以下步骤：

```
1. 玩家从手牌打出一张牌到场中
   ↓
2. 判定：场中是否有同月份的牌？
   ├─ 有 → 将打出的牌和场中同月牌配对，收入自己的计分区
   └─ 无 → 牌留在场中
   ↓
3. 从山札翻一张牌到场中
   ↓
4. 判定：翻出的牌和场中是否有同月份的牌？
   ├─ 有 → 配对收入计分区
   └─ 无 → 牌留在场中
   ↓
5. 检查是否凑成"役"
   ├─ 有役 → 可选择"や～めた"（结束结算）或"こいこい"（继续赌更大）
   └─ 无役 → 轮到下一位玩家
```

### こいこい（继续）机制

**规则（标准）**：喊了こいこい是风险声明

| 场景 | 结果 |
|------|------|
| 自己喊 Koi → 自己先凑成役结束 | 基础分 × 2^(Koi次数) |
| 自己喊 Koi → 对手先凑成役结束 | 自己得 0 分，对手拿基础分（不翻倍） |
| 连续喊 2 次 Koi 后结束 | 基础分 × 4 |

> Koi 是 **风险声明**，非自动增益。仅在喊 Koi 的人先结束结算时翻倍生效。

### 游戏结束条件

1. 有玩家选择结束结算，且某一方累计得分 **≥ 目标分数（默认 7 分）**
2. 山札耗尽且双方都无法凑出役
3. 一方手牌耗尽

### 配置项

```typescript
interface KoiKoiConfig {
  targetScore: number;      // 默认 7
  koiMultiplier: boolean;   // 默认 true
  koiRisk: 'caller_zero';   // 默认：喊了Koi后输掉得0分
  hanamiTsukimiMerge: boolean; // 默认 true：花见酒+月见酒合并为呑み
}
```

## 役（Yaku）列表与计分

### 光牌役

| 役名 | 日语 | 条件 | 分数 | 备注 |
|------|------|------|------|------|
| 五光 | ごこう | 集齐全部 5 张光牌 | 10 分 | 最高役 |
| 四光 | しこう | 4 张光牌（**不含**小野道风） | 8 分 | |
| 雨四光 | あめしこう | 4 张光牌（**含**小野道风） | 7 分 | |
| 三光 | さんこう | 3 张光牌（**不含**小野道风） | 6 分 | |

> **光牌清单**（5 张）：1月鹤、3月幕、8月月、11月小野道风、12月凤凰

### 短册役

| 役名 | 日语 | 条件 | 分数 | 备注 |
|------|------|------|------|------|
| 赤短 | あかたん | 集齐 3 张红色短册 | **5** 分 | 固定：1月松 + 2月梅 + 3月桜 |
| 青短 | あおたん | 集齐 3 张青色短册 | **5** 分 | 固定：6月牡丹 + 7月萩 + 9月菊 |
| 短册×5 | — | 集齐任意 5 张短册 | 1 分 | 基础短册役 |
| 短册×6 | — | 集齐任意 6 张短册 | 2 分 | 每多1张+1分 |
| 短册×7 | — | 集齐任意 7 张短册 | 3 分 |
| 短册×8 | — | 集齐任意 8 张短册 | 4 分 |
| 短册×9 | — | 集齐任意 9 张短册 | 5 分 |
| 短册×10 | — | 集齐全部 10 张短册 | 6 分 |

> **⚠️ 短册归属确认**：
> - **赤短**（3 张）：1月、2月、3月
> - **青短**（3 张）：6月、7月、9月
> - **不计入5分役的短册**：4月(藤/紫)、5月(菖蒲)、8月(芒)、10月(楓)、12月(桐)
> - 这些短册仍计入短册总数（如短册×5），但不组成赤短/青短役

### 种牌役

| 役名 | 日语 | 条件 | 分数 | 备注 |
|------|------|------|------|------|
| 猪鹿蝶 | いのしかちょう | 猪(7月种) + 鹿(10月种) + 蝶(6月种) | **5** 分 | 经典组合 |
| 種×5 | — | 集齐任意 5 张种牌 | 1 分 | 基础种役 |
| 種×6 | — | 集齐任意 6 张种牌 | 2 分 | 每多1张+1分 |
| 種×7 | — | 集齐任意 7 张种牌 | 3 分 |
| 種×8 | — | 集齐任意 8 张种牌 | 4 分 |
| 種×9 | — | 集齐全部 9 张种牌 | 5 分 |

### カス役

| 役名 | 条件 | 分数 | 备注 |
|------|------|------|------|
| カス×10 | 集齐 10 张カス | 1 分 | 基础カ斯役 |
| カ斯×11 | 集齐 11 张カ斯 | 2 分 | 每多1张+1分 |
| ... | ... | ... | 以此类推 |
| カ斯×20 | 集齐 20 张カ斯 | 11 分 | |

### 特殊役

| 役名 | 日语 | 条件 | 分数 | 备注 |
|------|------|------|------|------|
| 呑み | のみ | 3月幕 + 8月月 + 9月杯 同时 | **4** 分 | 花见酒和月见酒不可共存 |
| 花见酒 | はなみざけ | 仅 3月幕 + 9月杯 | **3** 分 | 不含8月月时才触发 |
| 月见酒 | つきみざけ | 仅 8月月 + 9月杯 | **3** 分 | 不含3月幕时才触发 |
| 手四 | てし | 开局手牌含同月全部 4 张 | 6 分 | 直接胜利 |

> **呑み判定逻辑**：
> ```
> if (has(3月幕) && has(8月月) && has(9月杯)) → return 呑み(4分)
> else if (has(3月幕) && has(9月杯)) → return 花见酒(3分)
> else if (has(8月月) && has(9月杯)) → return 月见酒(3分)
> ```
> 三者互斥，不可叠加。

## 计分规则

### 叠加规则

- 所有役的分数 **可以叠加**（同时满足多个役时，分数累加）
- 例：五光(10) + 猪鹿蝶(5) + 短册×5(1) = 16 分

### こいこい 翻倍

- 喊 Koi 后先结束：得分 × 2^(Koi次数)
- 喊 Koi 后对手先结束：喊 Koi 的人得 0 分，对手拿基础分

### 胜负判定

- 累计得分先到 **7 分** 者直接胜利
- 可配置目标分数

## Hachi-Hachi（はちはち）三人模式

> **状态**：P2 优先级，MVP 之后实现

### 基本信息

- **人数**：3 人
- **发牌**：亲 9 张（弃 1 张至场后实际 8 张），其余各 8 张
- **场牌**：8 张
- **山札**：8 张
- **目标分**：30 分（可配置）

### 与 Koi-Koi 的核心差异

| 项目 | Koi-Koi（两人） | Hachi-Hachi（三人） |
|------|-----------------|---------------------|
| Koi 宣言 | 有 | 无 |
| 结算时机 | 任一玩家凑出役即可喊停 | 山札耗尽后统一结算 |
| 得分累积 | 先到 7 分胜 | 全程累加，先到 30 分胜 |
| 特殊役 | 标准役表 | 增加 手四、場四、カ斯20枚 |

### 三人模式役表

| 役名 | 条件 | 分数 |
|------|------|------|
| 四光 | 4 张光牌 | 10 分 |
| 赤短 | 3 张红色短册 | 5 分 |
| 青短 | 3 张青色短册 | 5 分 |
| 手四 | 手牌含同一月 4 张 | 4 分 |
| 場四 | 场札全为同一月 | 8 分 |
| カ斯20枚 | 累计收集 20 张カ斯 | 10 分 |
| カ斯10枚 | 累计收集 10 张カ斯 | 5 分 |

## 游戏状态机

```
[Init] → [Deal] → [Check 四手/流局]
                              ↓
                    ┌─────────────────┐
                    │                 │
                    ▼                 │
               [PlayerTurn] ←────────┤
                    │                 │
               [Match Check]         │
                    │                 │
               [Yaku Check]          │
                    │                 │
              ┌─────▼──────┐         │
              │ Yaku Found?│         │
              └──┬──────┬──┘         │
               Yes │    │ No         │
                   │    └────────────┤
              [KoiKoi Decision]      │
                │        │           │
          结束结算    继续(Koi)       │
                │        │           │
           [RoundEnd]   └──→[PlayerTurn]
                │
           [Score Check]
             ≥ 7分？
                │
           [GameEnd]
```

## 核心接口设计

### 牌组管理

```typescript
interface DeckManager {
  init(): HanafudaCard[];
  shuffle(deck: HanafudaCard[]): HanafudaCard[];
  deal(deck: HanafudaCard[]): DealResult;
  draw(deck: HanafudaCard[]): { card: HanafudaCard; remaining: HanafudaCard[] };
}

interface DealResult {
  hands: HanafudaCard[][];  // [player0[], player1[]]
  field: HanafudaCard[];    // 8 张场牌
  deck: HanafudaCard[];     // 剩余 24 张
}
```

### 匹配逻辑

```typescript
interface MatchEngine {
  // 检查场中是否有与打出牌同月份的牌
  findMatch(card: HanafudaCard, field: HanafudaCard[]): HanafudaCard[];
  // 执行匹配
  executeMatch(card: HanafudaCard, field: HanafudaCard[]): {
    matched: HanafudaCard[];  // 配对的牌
    remaining: HanafudaCard[]; // 剩余场牌
  };
}
```

### 役判定

```typescript
interface YakuChecker {
  // 判定所有满足的役
  check(captured: HanafudaCard[]): YakuResult[];
  // 计算总分（含 Koi 翻倍）
  calculateScore(yakuList: YakuResult[], koiCount: number, isWinnerKoiCaller: boolean): number;
}

interface YakuResult {
  type: YakuType;
  points: number;
  cards: HanafudaCard[];  // 构成该役的牌
}

enum YakuType {
  // 光牌役
  FiveLights = 'five_lights',       // 五光 (10)
  FourLights = 'four_lights',       // 四光 (8)
  RainFourLights = 'rain_four',     // 雨四光 (7)
  ThreeLights = 'three_lights',     // 三光 (6)
  // 短册役
  RedStrips = 'red_strips',         // 赤短 (5) — [1,2,3]月
  BlueStrips = 'blue_strips',       // 青短 (5) — [6,7,9]月
  Strips5 = 'strips_5',             // 短册×5 (1)
  Strips6 = 'strips_6',             // 短册×6 (2)
  Strips7 = 'strips_7',             // 短册×7 (3)
  Strips8 = 'strips_8',             // 短册×8 (4)
  Strips9 = 'strips_9',             // 短册×9 (5)
  Strips10 = 'strips_10',           // 短册×10 (6)
  // 种牌役
  BoarDeerButterfly = 'inoshikacho',// 猪鹿蝶 (5) — [7月猪,10月鹿,6月蝶]
  Seeds5 = 'seeds_5',               // 种×5 (1)
  Seeds6 = 'seeds_6',               // 种×6 (2)
  Seeds7 = 'seeds_7',               // 种×7 (3)
  Seeds8 = 'seeds_8',               // 种×8 (4)
  Seeds9 = 'seeds_9',               // 种×9 (5)
  // カス役
  Waste10 = 'waste_10',             // カ斯×10 (1)
  Waste11 = 'waste_11',             // カ斯×11 (2)
  // ... 以此类推到 カ斯×20
  // 特殊役
  FlowerSake = 'flower_sake',       // 花见酒 (3) — 3月幕 + 9月杯（不含8月月）
  MoonSake = 'moon_sake',           // 月见酒 (3) — 8月月 + 9月杯（不含3月幕）
  Nomu = 'nomu',                    // 呑み (4) — 3月幕 + 8月月 + 9月杯
  TeShi = 'te_shi',                 // 手四 (6) — 开局手牌含同月4张
}
```

### 役判定关键逻辑

```typescript
function checkYaku(captured: HanafudaCard[]): YakuResult[] {
  const results: YakuResult[] = [];
  const monthGroups = groupByMonth(captured);
  const lights = captured.filter(c => c.category === CardCategory.Light);
  const seeds = captured.filter(c => c.category === CardCategory.Seed);
  const strips = captured.filter(c => c.category === CardCategory.Strip);
  const wastes = captured.filter(c => c.category === CardCategory.Waste);

  // === 光牌役 ===
  const hasOno = lights.some(c => c.month === 11);
  if (lights.length === 5) {
    results.push({ type: YakuType.FiveLights, points: 10, cards: lights });
  } else if (lights.length === 4) {
    if (hasOno) {
      results.push({ type: YakuType.RainFourLights, points: 7, cards: lights });
    } else {
      results.push({ type: YakuType.FourLights, points: 8, cards: lights });
    }
  } else if (lights.length === 3 && !hasOno) {
    results.push({ type: YakuType.ThreeLights, points: 6, cards: lights });
  }

  // === 短册役 ===
  const akaMonths = strips.filter(c => [1, 2, 3].includes(c.month));
  const aoMonths = strips.filter(c => [6, 7, 9].includes(c.month));

  if (akaMonths.length === 3) {
    results.push({ type: YakuType.RedStrips, points: 5, cards: akaMonths });
  }
  if (aoMonths.length === 3) {
    results.push({ type: YakuType.BlueStrips, points: 5, cards: aoMonths });
  }

  // 短册累计役（5张起）
  if (strips.length >= 5) {
    const yakuType = `strips_${strips.length}` as YakuType;
    const points = strips.length - 4;
    results.push({ type: yakuType, points, cards: strips });
  }

  // === 种牌役 ===
  const hasBoar = seeds.some(c => c.month === 7);
  const hasDeer = seeds.some(c => c.month === 10);
  const hasButterfly = seeds.some(c => c.month === 6);
  if (hasBoar && hasDeer && hasButterfly) {
    const isc = seeds.filter(c => [6, 7, 10].includes(c.month));
    results.push({ type: YakuType.BoarDeerButterfly, points: 5, cards: isc });
  }

  if (seeds.length >= 5) {
    const yakuType = `seeds_${seeds.length}` as YakuType;
    const points = seeds.length - 4;
    results.push({ type: yakuType, points, cards: seeds });
  }

  // === カ斯役 ===
  if (wastes.length >= 10) {
    const yakuType = `waste_${wastes.length}` as YakuType;
    const points = wastes.length - 9;
    results.push({ type: yakuType, points, cards: wastes });
  }

  // === 特殊役（呑み / 花见酒 / 月见酒）===
  const hasMarchLight = lights.some(c => c.month === 3);  // 3月幕
  const hasAugustLight = lights.some(c => c.month === 8);  // 8月月
  const hasSepCup = seeds.some(c => c.month === 9);        // 9月杯

  if (hasMarchLight && hasAugustLight && hasSepCup) {
    // 呑み — 三者互斥
    results.push({ type: YakuType.Nomu, points: 4, cards: [] });
  } else if (hasMarchLight && hasSepCup) {
    results.push({ type: YakuType.FlowerSake, points: 3, cards: [] });
  } else if (hasAugustLight && hasSepCup) {
    results.push({ type: YakuType.MoonSake, points: 3, cards: [] });
  }

  return results;
}
```

### 游戏状态

```typescript
interface GameState {
  phase: GamePhase;
  mode: 'koi_koi' | 'hachi_hachi';
  currentPlayer: number;       // 0 = 亲, 1 = 子
  hands: HanafudaCard[][];     // 每个玩家的手牌
  field: HanafudaCard[];       // 场牌
  deck: HanafudaCard[];        // 剩余牌堆
  captured: HanafudaCard[][];  // 每个玩家收集的牌
  scores: number[];            // 累计得分
  currentRoundScores: number[]; // 当前局得分
  koiKoiCount: number;         // こいこい次数
  koiKoiCaller: number | null; // 喊了こいこい的玩家
  targetScore: number;         // 目标分数（默认7）
}

enum GamePhase {
  Init = 'init',
  Dealing = 'dealing',
  PlayerTurn = 'player_turn',
  DrawPhase = 'draw_phase',
  YakuCheck = 'yaku_check',
  KoiKoiDecision = 'koi_koi_decision',
  RoundEnd = 'round_end',
  GameEnd = 'game_end',
}
```

## 规则引擎配置

```json
{
  "hanafuda_rules": {
    "koi_koi": {
      "mode": "koi_koi",
      "targetScore": 7,
      "koiMultiplier": true,
      "koiRisk": "caller_zero",
      "hanamiTsukimiMerge": true,
      "tanzakuSets": {
        "aka": [1, 2, 3],
        "ao": [6, 7, 9]
      }
    },
    "hachi_hachi": {
      "mode": "hachi_hachi_3p",
      "targetScore": 30,
      "enableKoi": false,
      "specialYaku": ["te_shi", "ba_shi", "kasu_20"]
    }
  }
}
```

## 测试要点

- [ ] 发牌后每人 8 张、场 8 张、剩余 24 张
- [ ] 四张同月检查（流局）
- [ ] 四手检测（开局手牌含同月 4 张）
- [ ] 匹配逻辑正确（同月份配对）
- [ ] 五光判定正确
- [ ] 四光判定正确（不含小野道风）
- [ ] 雨四光判定正确（含小野道风）
- [ ] 三光判定正确（不含小野道风）
- [ ] 赤短判定正确（1+2+3月短册）
- [ ] 青短判定正确（6+7+9月短册）
- [ ] 猪鹿蝶判定正确
- [ ] 呑み/花见酒/月见酒互斥判定
- [ ] 短册累计役（5-10张）
- [ ] 种牌累计役（5-9张）
- [ ] カ斯累计役（10-20张）
- [ ] Koi 翻倍正确（2^n 倍）
- [ ] Koi 风险正确（输掉得 0 分）
- [ ] 目标分数到达后游戏结束
- [ ] 役分数叠加正确
- [ ] 山札耗尽后强制结束

## 版本历史

| 版本 | 日期 | 变更 |
|------|------|------|
| v0.1 | 2026-04-27 | 初始版本 |
| v1.0 | 2026-04-27 | 经人工校验确认：青短=[6,7,9]月、呑み互斥、Koi翻倍规则、7分胜利 |
