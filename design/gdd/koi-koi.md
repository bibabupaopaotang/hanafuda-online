# Koi-Koi 模块 — 游戏设计文档

> 校验日期：2026-04-27
> 依赖：`rule-engine.md`、`game-state.md`、`scoring.md`

## 概述

- **系统名称**：Koi-Koi 模块 (Koi-Koi Game Module)
- **所属层级**：Feature
- **优先级**：P2
- **设计目标**：实现 Koi-Koi（こいこい）两人对战模式的完整游戏流程，从开局到结算。

## 模式基本信息

| 项目 | 值 |
|------|----|
| 人数 | 2 人 |
| 牌数 | 48 张 |
| 目标分 | 7 分（可配置） |
| 发牌 | 手 8 + 场 8 + 山 24 |
| Koi 机制 | 有（翻倍/风险） |
| 结算时机 | 任一玩家凑出役后选择 |

## 完整游戏流程

```
═══════════════════════════════════════════════════
                    对局开始前
═══════════════════════════════════════════════════

1. 匹配/创建房间
2. 双方进入 → 确认亲/子（抽牌比大小，月小者为亲）
3. 双方准备 → 开始发牌

═══════════════════════════════════════════════════
                    每局流程
═══════════════════════════════════════════════════

Phase 1: 发牌
  - 手牌各 8 张，场牌 8 张，山札 24 张
  - 检查特殊开局：
    ├─ 手四 → 直接胜利（6 分），跳过本局
    └─ 场四 → 流局重发

Phase 2: 游戏循环（交替进行）
  亲方出牌 → 匹配判定 → 翻山札 → 匹配判定 → 役判定
    ├─ 有役 → Koi 决策
    │   ├─ 结束结算 → 进入 Phase 3
    │   └─ 继续(こいこい) → Koi 次数+1 → 轮到对方
    └─ 无役 → 轮到对方

Phase 3: 局结算
  - 计算役分 + Koi 翻倍
  - 累计总分
  - 检查是否达到目标分：
    ├─ 是 → 游戏结束，宣布胜者
    └─ 否 → 开始下一局（上一局赢家为亲）

═══════════════════════════════════════════════════
                    强制结束
═══════════════════════════════════════════════════

以下情况强制结束本局：
1. 山札耗尽 → 双方役分为 0 时 → 庄家胜
2. 山札耗尽 → 一方有役 → 有役方胜
3. 一方手牌耗尽 + 山札耗尽 → 役判定
4. 断线超时 → 断线方判负
```

## Koi 决策流程

```
玩家凑出役
    │
    ▼
┌─────────────────────────┐
│  界面提示：               │
│  "你凑出了役！            │
│   [结束结算] [こいこい] " │
└─────────┬───────┬───────┘
          │       │
    结束结算    继续(Koi)
          │       │
          ▼       ▼
    [结算分数]  [Koi次数+1]
          │       │
          │       ▼
          │   [对手回合继续]
          │       │
          │   如果对手也凑出役
          │       │
          │       ▼
          │   [对手选择结束]
          │       │
          │       ▼
          │   [结算：喊Koi的人得0分]
          │   [对手获得基础分]
          │
    [累计总分]
          │
    [检查 ≥ 7 分？]
          │
    [宣布结果]
```

## 亲权规则

| 场景 | 亲权归属 |
|------|----------|
| 首局 | 抽牌月小者 |
| 后续局 | 上局赢家（得分高者） |
| 平局 | 上局亲继续做亲 |
| 手四直接胜利 | 手四方做下局亲 |

## 山札耗尽处理

```typescript
function handleDeckEmpty(state: GameState): GameState {
  const [score0, score1] = state.roundScores;
  
  // 双方都没有役 → 庄家胜
  if (score0 === 0 && score1 === 0) {
    const dealer = state.currentPlayerIndex;
    state.totalScores[dealer] += 0; // 庄家胜但不得分（部分地区规则庄家得1分）
    return { ...state, phase: GamePhase.RoundEnd };
  }
  
  // 一方有役 → 有役方胜
  // 这已经在役判定时处理了，山札耗尽时最后检查一次役
  
  return { ...state, phase: GamePhase.RoundEnd };
}
```

## 客户端交互设计

### 出牌阶段

```
┌─────────────────────────────────┐
│          ┌───────┐              │
│          │ 场牌   │  (正面朝上)   │
│          └───────┘              │
│                                 │
│  ┌───┐ ┌───┐ ┌───┐ ┌───┐       │
│  │牌1│ │牌2│ │牌3│ │牌4│  ...   │  ← 玩家手牌
│  └───┘ └───┘ └───┘ └───┘       │
│                                 │
│  [你的回合]  剩余: 15张          │
└─────────────────────────────────┘
```

### 匹配成功提示

```
┌─────────────────────────┐
│  🎯 配对成功！            │
│  松 + 松 → 收入计分区     │
└─────────────────────────┘
```

### Koi 决策弹窗

```
┌─────────────────────────────┐
│  🎉 你凑出了役！             │
│                             │
│  役：三光 (6分)              │
│  当前局得分：6               │
│  Koi 次数：0                 │
│                             │
│  [ 结束结算 ]  [ こいこい ]  │
│                             │
│  ⚠️ こいこい：继续赌更大      │
│     如果对手先结束，你将     │
│     失去本局得分！           │
└─────────────────────────────┘
```

### 结算界面

```
┌─────────────────────────────┐
│         第 3 局 结算         │
├─────────────────────────────┤
│  役列表：                    │
│  🌟 三光 ................ 6 │
│                             │
│  基础分：............... 6  │
│  Koi 次数：.............. 1 │
│  翻倍：................. ×2 │
│  ─────────────────────      │
│  最终得分：.............. 12 │
│                             │
│  累计：你 8 - 对手 3        │
└─────────────────────────────┘
```

### 游戏结束

```
┌─────────────────────────────┐
│        🎊 游戏结束 🎊        │
│                             │
│  🏆 你赢了！                 │
│                             │
│  最终比分：8 - 3            │
│  总局数：5                  │
│  最大役：四光(8分)           │
│                             │
│  [ 再来一局 ]  [ 返回大厅 ]  │
└─────────────────────────────┘
```

## 服务端 Koi 逻辑

```typescript
class KoiKoiGame {
  private state: GameState;
  
  // 玩家出牌
  async playCard(playerIndex: number, cardId: number): Promise<PlayResult> {
    // 验证回合
    if (playerIndex !== this.state.currentPlayerIndex) {
      throw new Error('不是你的回合');
    }
    
    // 执行出牌 + 匹配
    this.state = executePlay(this.state, playerIndex, cardId);
    
    // 翻山札 + 匹配
    if (this.state.deck.length > 0) {
      this.state = executeDraw(this.state);
    }
    
    // 役判定
    const yakuList = YakuChecker.check(this.state.captured[playerIndex]);
    
    if (yakuList.length > 0) {
      return {
        state: this.state,
        yakuFound: true,
        yakuList,
        needDecision: true,
      };
    }
    
    // 无役 → 换人
    this.nextPlayer();
    return { state: this.state, yakuFound: false, needDecision: false };
  }
  
  // 玩家喊 Koi
  async callKoiKoi(playerIndex: number): Promise<PlayResult> {
    this.state.koiKoiCount++;
    this.state.koiKoiCaller = playerIndex;
    this.state.koiKoiActive = true;
    
    this.nextPlayer();
    return { state: this.state };
  }
  
  // 玩家选择结束
  async endRound(playerIndex: number): Promise<RoundResult> {
    const scoreResult = Scoring.calculateScore(
      this.state.captured[playerIndex],
      this.state.koiKoiCount,
      this.state.koiKoiCaller === playerIndex,
      true // 当前玩家赢了
    );
    
    // 更新总分
    this.state.totalScores[playerIndex] += scoreResult.finalScore;
    
    // 如果喊 Koi 的人不是结束的人
    if (this.state.koiKoiCaller !== null && this.state.koiKoiCaller !== playerIndex) {
      // 喊 Koi 的人得 0 分
      this.state.totalScores[this.state.koiKoiCaller] += 0;
    }
    
    // 检查是否达到目标分
    const winner = this.state.totalScores.findIndex(s => s >= this.state.targetScore);
    
    return {
      scoreResult,
      winner: winner >= 0 ? winner : null,
      gameOver: winner >= 0,
    };
  }
}
```

## 测试要点

- [ ] 完整一局流程无异常
- [ ] 手四检测正确
- [ ] 场四流局正确
- [ ] Koi 决策后正确翻倍
- [ ] Koi 后对手先结束 → 喊 Koi 的人得 0 分
- [ ] 连续 Koi 正确翻倍（2^n）
- [ ] 山札耗尽正确结算
- [ ] 亲权切换正确
- [ ] 目标分到达后游戏结束
- [ ] 断线重连后状态正确

## 版本历史

| 版本 | 日期 | 变更 |
|------|------|------|
| v0.1 | 2026-04-27 | 初始版本 |
