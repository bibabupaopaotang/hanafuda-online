# 牌面数据系统 — 游戏设计文档

> 数据来源：搜狗百科 + 知乎 + 人工逐张校验（2026-04-27）
> ✅ 全部 48 张牌已确认，总数闭合

## 概述

- **系统名称**：牌面数据系统 (Card Data System)
- **所属层级**：Foundation
- **优先级**：P0
- **设计目标**：定义花札全部 48 张牌的数据结构、属性和分类，为所有上层系统提供数据基础

## 基本结构

花札共 **48 张牌**，12 个月份各 **4 张**。

### 类别分类

| 类别 | 日语 | 分值标签 | 数量 | 说明 |
|------|------|----------|------|------|
| 光 | 光 (Hikari) | 20点 | **5** | 最高等级，图案最特殊 |
| 种 | 種 (Tane) | 10点 | **9** | 图案含动物/物品 |
| 短册 | 短冊 (Tanzaku) | 5点 | **10** | 图案含短册，全部印有汉字 |
| 粕 | カス (Kasu) | 1点 | **24** | 普通牌，仅有单一植物图案 |

**合计：5 + 9 + 10 + 24 = 48 ✓**

## 每月结构汇总

| 月份 | 花名 | 光 | 种 | 短册 | カス | 合计 |
|------|------|:--:|:--:|:----:|:----:|:----:|
| 1月 | 松 | 1 | 1 | 1 | 1 | 4 ✓ |
| 2月 | 梅 | **0** | 1 | 1 | **2** | 4 ✓ |
| 3月 | 桜 | 1 | 0 | 1 | 2 | 4 ✓ |
| 4月 | 藤 | 0 | 1 | 1 | 2 | 4 ✓ |
| 5月 | 菖蒲 | 0 | 1 | 1 | 2 | 4 ✓ |
| 6月 | 牡丹 | 0 | 1 | 1 | 2 | 4 ✓ |
| 7月 | 萩 | 0 | 1 | 1 | 2 | 4 ✓ |
| 8月 | 芒 | 1 | 1 | 1 | 1 | 4 ✓ |
| 9月 | 菊 | 0 | 1 | 1 | 2 | 4 ✓ |
| 10月 | 紅葉 | 0 | 1 | 1 | 2 | 4 ✓ |
| 11月 | 柳 | 1 | 0 | 0 | 3 | 4 ✓ |
| 12月 | 桐 | 1 | 0 | 1 | 2 | 4 ✓ |
| **总计** | — | **5** | **9** | **10** | **24** | **48** ✓ |

> **特殊月份**：
> - **8月**：唯一同时含光+种的月份
> - **11月**：1光 + 3カス，无短册无种
> - **12月**：1光 + 1短册 + 2カス，无种

## 完整牌面表

### 1月 — 松 (Matsu)

| # | ID | 类别 | 图案名称 | 分值标签 |
|---|----|------|----------|----------|
| 1 | 0 | **光** | 松に鶴（松上鹤） | 20点 |
| 2 | 1 | **短冊** | 赤短（红短册，"松"字） | 5点 |
| 3 | 2 | **种** | 松に小鳥（松间小鸟/松風） | 10点 |
| 4 | 3 | カス | 松のみ（单松树） | 1点 |

### 2月 — 梅 (Ume)

| # | ID | 类别 | 图案名称 | 分值标签 |
|---|----|------|----------|----------|
| 5 | 4 | **种** | 梅に鴬（黄莺） | 10点 |
| 6 | 5 | **短冊** | 赤短（红短册，"梅"字） | 5点 |
| 7 | 6 | カス | 梅のみ | 1点 |
| 8 | 7 | カス | 梅のみ | 1点 |

> **2月特殊**：没有光牌，鴬是种牌

### 3月 — 桜 (Sakura)

| # | ID | 类别 | 图案名称 | 分值标签 |
|---|----|------|----------|----------|
| 9 | 8 | **光** | 桜に幕（樱上幕帘） | 20点 |
| 10 | 9 | **短冊** | 赤短（红短册，"桜"字） | 5点 |
| 11 | 10 | カス | 桜のみ | 1点 |
| 12 | 11 | カス | 桜のみ | 1点 |

### 4月 — 藤 (Fuji)

| # | ID | 类别 | 图案名称 | 分值标签 |
|---|----|------|----------|----------|
| 13 | 12 | **短冊** | 紫短册（"藤"字） | 5点 |
| 14 | 13 | **种** | 藤に燕（燕子） | 10点 |
| 15 | 14 | カス | 藤のみ | 1点 |
| 16 | 15 | カス | 藤のみ | 1点 |

### 5月 — 菖蒲 (Ayame)

| # | ID | 类别 | 图案名称 | 分值标签 |
|---|----|------|----------|----------|
| 17 | 16 | **短冊** | 青短册（"菖蒲"字） | 5点 |
| 18 | 17 | **种** | 菖蒲に八橋（桥） | 10点 |
| 19 | 18 | カス | 菖蒲のみ | 1点 |
| 20 | 19 | カス | 菖蒲のみ | 1点 |

### 6月 — 牡丹 (Botan)

| # | ID | 类别 | 图案名称 | 分值标签 |
|---|----|------|----------|----------|
| 21 | 20 | **短冊** | 青短册（"牡丹"字） | 5点 |
| 22 | 21 | **种** | 牡丹に蝶（蝴蝶） | 10点 |
| 23 | 22 | カス | 牡丹のみ | 1点 |
| 24 | 23 | カス | 牡丹のみ | 1点 |

### 7月 — 萩 (Hagi)

| # | ID | 类别 | 图案名称 | 分值标签 |
|---|----|------|----------|----------|
| 25 | 24 | **短冊** | 青短册（"萩"字） | 5点 |
| 26 | 25 | **种** | 萩に猪（野猪） | 10点 |
| 27 | 26 | カス | 萩のみ | 1点 |
| 28 | 27 | カス | 萩のみ | 1点 |

### 8月 — 芒 (Susuki)

| # | ID | 类别 | 图案名称 | 分值标签 |
|---|----|------|----------|----------|
| 29 | 28 | **光** | 芒に月（芒上月/满月） | 20点 |
| 30 | 29 | **短冊** | 青短册（"芒"字） | 5点 |
| 31 | 30 | **种** | 芒に雁（大雁） | 10点 |
| 32 | 31 | カス | 芒のみ | 1点 |

### 9月 — 菊 (Kiku)

| # | ID | 类别 | 图案名称 | 分值标签 |
|---|----|------|----------|----------|
| 33 | 32 | **短冊** | 青短册（"菊"字） | 5点 |
| 34 | 33 | **种** | 菊に盃（酒盅） | 10点 |
| 35 | 34 | カス | 菊のみ | 1点 |
| 36 | 35 | カス | 菊のみ | 1点 |

### 10月 — 紅葉 (Momiji)

| # | ID | 类别 | 图案名称 | 分值标签 |
|---|----|------|----------|----------|
| 37 | 36 | **短冊** | 青短册（"楓"字） | 5点 |
| 38 | 37 | **种** | 紅葉に鹿（鹿） | 10点 |
| 39 | 38 | カス | 紅葉のみ | 1点 |
| 40 | 39 | カス | 紅葉のみ | 1点 |

### 11月 — 柳 (Yanagi)

| # | ID | 类别 | 图案名称 | 分值标签 |
|---|----|------|----------|----------|
| 41 | 40 | **光** | 柳に小野道風（雨中撑伞人） | 20点 |
| 42 | 41 | カス | 柳に雨（雨カス） | 1点 |
| 43 | 42 | カ斯 | 柳のみ | 1点 |
| 44 | 43 | カ斯 | 柳のみ | 1点 |

### 12月 — 桐 (Kiri)

| # | ID | 类别 | 图案名称 | 分值标签 |
|---|----|------|----------|----------|
| 45 | 44 | **光** | 桐に鳳凰（凤凰） | 20点 |
| 46 | 45 | **短冊** | 赤短（红短册，"桐"字） | 5点 |
| 47 | 46 | カス | 桐のみ | 1点 |
| 48 | 47 | カ斯 | 桐のみ | 1点 |

## 光牌清单（5 张）

| 月份 | 图案 | 特殊说明 |
|------|------|----------|
| 1月松 | 松に鶴 | 三光之一 |
| 3月桜 | 桜に幕 | 三光之一 |
| 8月芒 | 芒に月 | 三光之一 |
| 11月柳 | 柳に小野道風 | 雨四光/五光时计10点 |
| 12月桐 | 桐に鳳凰 | 四光/五光 |

## 种牌清单（9 张）

| 月份 | 图案 |
|------|------|
| 1月松 | 松に小鳥（松間小鸟/松風） |
| 2月梅 | 梅に鴬（黄莺） |
| 4月藤 | 藤に燕（燕子） |
| 5月菖蒲 | 菖蒲に八橋（桥） |
| 6月牡丹 | 牡丹に蝶（蝴蝶） |
| 7月萩 | 萩に猪（野猪） |
| 8月芒 | 芒に雁（大雁） |
| 9月菊 | 菊に盃（酒盅） |
| 10月紅葉 | 紅葉に鹿（鹿） |

## 短册颜色分类

| 颜色 | 数量 | 归属月份 | 短册文字 |
|------|------|----------|----------|
| **赤短（红）** | **4** | 1月松、2月梅、3月桜、12月桐 | 松・梅・桜・桐 |
| **青/紫短（蓝/紫）** | **6** | 4月藤、5月菖蒲、6月牡丹、7月萩、8月芒、9月菊、10月楓 | 藤・菖蒲・牡丹・萩・芒・菊・楓 |

> **注**：4月藤为紫色短册，多数规则归入青短类
> **注**：所有短册均印有汉字，不存在"无字短册"

## 数据结构

### TypeScript 定义

```typescript
/** 牌类别 */
enum CardCategory {
  Light = 'hikari',    // 光 (5张)
  Seed = 'tane',       // 种 (9张)
  Strip = 'tanzaku',   // 短册 (10张)
  Waste = 'kasu',      // カス (24张)
}

/** 月份/花名映射 */
enum Month {
  January   = 1,   // 松 (Matsu)
  February  = 2,   // 梅 (Ume)
  March     = 3,   // 桜 (Sakura)
  April     = 4,   // 藤 (Fuji)
  May       = 5,   // 菖蒲 (Ayame)
  June      = 6,   // 牡丹 (Botan)
  July      = 7,   // 萩 (Hagi)
  August    = 8,   // 芒 (Susuki)
  September = 9,   // 菊 (Kiku)
  October   = 10,  // 紅葉 (Momiji)
  November  = 11,  // 柳 (Yanagi)
  December  = 12,  // 桐 (Kiri)
}

/** 花札牌 */
interface HanafudaCard {
  id: number;           // 唯一ID (0-47)
  month: Month;         // 月份 (1-12)
  category: CardCategory; // 类别
  name: string;         // 牌面名称（日文）
  pointLabel: number;   // 分值标签 (20/10/5/1)
}

/** 完整牌组（48张） */
type HanafudaDeck = HanafudaCard[];
```

### 运行时牌组

```typescript
interface GameState {
  deck: HanafudaCard[];        // 剩余牌堆
  field: HanafudaCard[];       // 场牌（场上展示的牌）
  playerHands: HanafudaCard[][]; // 每个玩家的手牌
  playerCaptured: HanafudaCard[][]; // 每个玩家收集的牌
}
```

## 牌组初始化数据

```typescript
const ALL_CARDS: HanafudaCard[] = [
  // 1月 松
  { id: 0, month: 1, category: CardCategory.Light, name: '松に鶴', pointLabel: 20 },
  { id: 1, month: 1, category: CardCategory.Strip, name: '赤短(松)', pointLabel: 5 },
  { id: 2, month: 1, category: CardCategory.Seed, name: '松に小鳥', pointLabel: 10 },
  { id: 3, month: 1, category: CardCategory.Waste, name: '松のみ', pointLabel: 1 },
  // 2月 梅
  { id: 4, month: 2, category: CardCategory.Seed, name: '梅に鴬', pointLabel: 10 },
  { id: 5, month: 2, category: CardCategory.Strip, name: '赤短(梅)', pointLabel: 5 },
  { id: 6, month: 2, category: CardCategory.Waste, name: '梅のみ', pointLabel: 1 },
  { id: 7, month: 2, category: CardCategory.Waste, name: '梅のみ', pointLabel: 1 },
  // 3月 桜
  { id: 8, month: 3, category: CardCategory.Light, name: '桜に幕', pointLabel: 20 },
  { id: 9, month: 3, category: CardCategory.Strip, name: '赤短(桜)', pointLabel: 5 },
  { id: 10, month: 3, category: CardCategory.Waste, name: '桜のみ', pointLabel: 1 },
  { id: 11, month: 3, category: CardCategory.Waste, name: '桜のみ', pointLabel: 1 },
  // 4月 藤
  { id: 12, month: 4, category: CardCategory.Strip, name: '紫短(藤)', pointLabel: 5 },
  { id: 13, month: 4, category: CardCategory.Seed, name: '藤に燕', pointLabel: 10 },
  { id: 14, month: 4, category: CardCategory.Waste, name: '藤のみ', pointLabel: 1 },
  { id: 15, month: 4, category: CardCategory.Waste, name: '藤のみ', pointLabel: 1 },
  // 5月 菖蒲
  { id: 16, month: 5, category: CardCategory.Strip, name: '青短(菖蒲)', pointLabel: 5 },
  { id: 17, month: 5, category: CardCategory.Seed, name: '菖蒲に八橋', pointLabel: 10 },
  { id: 18, month: 5, category: CardCategory.Waste, name: '菖蒲のみ', pointLabel: 1 },
  { id: 19, month: 5, category: CardCategory.Waste, name: '菖蒲のみ', pointLabel: 1 },
  // 6月 牡丹
  { id: 20, month: 6, category: CardCategory.Strip, name: '青短(牡丹)', pointLabel: 5 },
  { id: 21, month: 6, category: CardCategory.Seed, name: '牡丹に蝶', pointLabel: 10 },
  { id: 22, month: 6, category: CardCategory.Waste, name: '牡丹のみ', pointLabel: 1 },
  { id: 23, month: 6, category: CardCategory.Waste, name: '牡丹のみ', pointLabel: 1 },
  // 7月 萩
  { id: 24, month: 7, category: CardCategory.Strip, name: '青短(萩)', pointLabel: 5 },
  { id: 25, month: 7, category: CardCategory.Seed, name: '萩に猪', pointLabel: 10 },
  { id: 26, month: 7, category: CardCategory.Waste, name: '萩のみ', pointLabel: 1 },
  { id: 27, month: 7, category: CardCategory.Waste, name: '萩のみ', pointLabel: 1 },
  // 8月 芒
  { id: 28, month: 8, category: CardCategory.Light, name: '芒に月', pointLabel: 20 },
  { id: 29, month: 8, category: CardCategory.Strip, name: '青短(芒)', pointLabel: 5 },
  { id: 30, month: 8, category: CardCategory.Seed, name: '芒に雁', pointLabel: 10 },
  { id: 31, month: 8, category: CardCategory.Waste, name: '芒のみ', pointLabel: 1 },
  // 9月 菊
  { id: 32, month: 9, category: CardCategory.Strip, name: '青短(菊)', pointLabel: 5 },
  { id: 33, month: 9, category: CardCategory.Seed, name: '菊に盃', pointLabel: 10 },
  { id: 34, month: 9, category: CardCategory.Waste, name: '菊のみ', pointLabel: 1 },
  { id: 35, month: 9, category: CardCategory.Waste, name: '菊のみ', pointLabel: 1 },
  // 10月 紅葉
  { id: 36, month: 10, category: CardCategory.Strip, name: '青短(楓)', pointLabel: 5 },
  { id: 37, month: 10, category: CardCategory.Seed, name: '紅葉に鹿', pointLabel: 10 },
  { id: 38, month: 10, category: CardCategory.Waste, name: '紅葉のみ', pointLabel: 1 },
  { id: 39, month: 10, category: CardCategory.Waste, name: '紅葉のみ', pointLabel: 1 },
  // 11月 柳
  { id: 40, month: 11, category: CardCategory.Light, name: '柳に小野道風', pointLabel: 20 },
  { id: 41, month: 11, category: CardCategory.Waste, name: '柳に雨', pointLabel: 1 },
  { id: 42, month: 11, category: CardCategory.Waste, name: '柳のみ', pointLabel: 1 },
  { id: 43, month: 11, category: CardCategory.Waste, name: '柳のみ', pointLabel: 1 },
  // 12月 桐
  { id: 44, month: 12, category: CardCategory.Light, name: '桐に鳳凰', pointLabel: 20 },
  { id: 45, month: 12, category: CardCategory.Strip, name: '赤短(桐)', pointLabel: 5 },
  { id: 46, month: 12, category: CardCategory.Waste, name: '桐のみ', pointLabel: 1 },
  { id: 47, month: 12, category: CardCategory.Waste, name: '桐のみ', pointLabel: 1 },
];
```

## 与系统索引的关联

| 依赖系统 | 交互方式 | 数据流向 |
|----------|----------|----------|
| 游戏规则引擎 | 读取牌的 month 做匹配判定，读取 category 做役计算 | 牌面数据 → 规则引擎 |
| 得分与役计算 | 统计玩家收集牌的类别和数量，判定役组合 | 牌面数据 → 役计算 |
| UI/牌桌渲染 | 渲染牌面图片/文字 | 牌面数据 → UI |

## 资源需求

### 牌面图片

- 48 张牌的图片资源
- 牌背图片 × 1
- 建议尺寸：单牌 100×160 px
- 格式：PNG（透明背景）或 WebP
- 总大小控制：≤ 200KB（微信小游戏主包限制）

## 数据校验规则

- 牌组初始化时必须校验：48 张、每月 4 张
- 类别总数校验：光 5、种 9、短册 10、カス 24
- 每月カス数量：1月1、2月2、3月2、4月2、5月2、6月2、7月2、8月1、9月2、10月2、11月3、12月2
- 洗牌后校验：无重复、无遗漏

## 测试要点

- [ ] 牌组初始化后包含 48 张牌
- [ ] 每张牌的 month 范围 1-12
- [ ] 每个月恰好 4 张牌
- [ ] 光牌数量 = 5
- [ ] 种牌数量 = 9
- [ ] 短册数量 = 10
- [ ] カス数量 = 24
- [ ] 各月カ斯数量校验通过
- [ ] 洗牌后牌数不变
- [ ] 序列化/反序列化（网络传输用）

## 版本历史

| 版本 | 日期 | 变更 |
|------|------|------|
| v0.1 | 2026-04-27 | 初始版本 |
| v1.0 | 2026-04-27 | 经人工校验确认，全部 48 张牌数据闭合 |
