# 游戏状态管理 — 游戏设计文档

> 校验日期：2026-04-27

## 概述

- **系统名称**：游戏状态管理 (Game State Manager)
- **所属层级**：Core
- **优先级**：P1
- **设计目标**：维护一局花札游戏的完整状态，管理状态机流转，确保客户端和服务端状态一致。

## 状态机设计

### 状态定义

```
┌─────────────────────────────────────────────────┐
│                                                 │
│  ┌─────────┐                                    │
│  │ LOBBY   │  ← 大厅：等待玩家加入              │
│  └────┬────┘                                    │
│       │ 所有玩家准备                             │
│       ▼                                         │
│  ┌─────────┐                                    │
│  │ DEALING │  ← 发牌阶段                        │
│  └────┬────┘                                    │
│       │ 发牌完成                                 │
│       ▼                                         │
│  ┌─────────────────┐                            │
│  │ CHECK_SPECIAL   │  ← 检查特殊开局（四手/流局）│
│  └────┬──────┬─────┘                            │
│    流局 │      │ 正常                            │
│         ▼      ▼                                 │
│  ┌─────────┐  ┌──────────────┐                  │
│  │  REDEAL │  │ PLAYER_TURN  │  ← 玩家回合       │
│  └─────────┘  └──────┬───────┘                  │
│                      │ 出牌                       │
│                      ▼                            │
│                ┌──────────────┐                  │
│                │ MATCH_CHECK  │  ← 匹配判定       │
│                └──────┬───────┘                  │
│                       │                           │
│                       ▼                            │
│                ┌──────────────┐                  │
│                │ DRAW_CARD    │  ← 翻山札         │
│                └──────┬───────┘                  │
│                       │                           │
│                       ▼                            │
│                ┌──────────────┐                  │
│                │ DRAW_MATCH   │  ← 翻牌匹配判定   │
│                └──────┬───────┘                  │
│                       │                           │
│                       ▼                            │
│                ┌──────────────┐                  │
│                │ YAKU_CHECK   │  ← 役判定         │
│                └──┬───────┬───┘                  │
│              有役  │       │ 无役                 │
│                   ▼       ▼                       │
│           ┌───────────┐  ┌──────────────┐        │
│           │KOI_DECISION│  │  NEXT_PLAYER │        │
│           └──┬─────┬───┘  └──────┬───────┘        │
│          继续 │     │ 结束        │                │
│              ▼     ▼             │                │
│      ┌───────────┐│    ┌────────▼──────┐         │
│      │ KOI_ACTIVE││    │  ROUND_END    │         │
│      └─────┬─────┘│    └──────┬────────┘         │
│            │      │           │ 达到目标分?        │
│            ▼      │           ▼                   │
│      ┌───────────┐│    ┌──────────────┐          │
│      │NEXT_PLAYER││    │  GAME_END    │          │
│      └─────┬─────┘│    └──────────────┘          │
│            │      │                               │
│            └──────┘                               │
│                                                   │
└───────────────────────────────────────────────────┘
```

### 状态流转表

| 当前状态 | 触发条件 | 下一状态 | 说明 |
|----------|----------|----------|------|
| LOBBY | 所有玩家准备 | DEALING | 开始发牌 |
| DEALING | 发牌完成 | CHECK_SPECIAL | 检查特殊开局 |
| CHECK_SPECIAL | 四张同月在场 | REDEAL | 流局重发 |
| CHECK_SPECIAL | 玩家手牌有四张同月 | GAME_END | 手四直接胜利 |
| CHECK_SPECIAL | 正常 | PLAYER_TURN | 开始第一回合 |
| PLAYER_TURN | 玩家出牌 | MATCH_CHECK | 执行匹配判定 |
| MATCH_CHECK | 匹配完成 | DRAW_CARD | 翻山札 |
| DRAW_CARD | 翻牌完成 | DRAW_MATCH | 翻牌匹配判定 |
| DRAW_MATCH | 匹配完成 | YAKU_CHECK | 检查役 |
| YAKU_CHECK | 无役 | NEXT_PLAYER | 换下一位玩家 |
| YAKU_CHECK | 有役 | KOI_DECISION | 提示选择继续/结束 |
| KOI_DECISION | 选择继续(こいこい) | NEXT_PLAYER | Koi 激活，继续游戏 |
| KOI_DECISION | 选择结束 | ROUND_END | 结算本局 |
| ROUND_END | 达到目标分 | GAME_END | 游戏结束 |
| ROUND_END | 未达目标分 | DEALING | 开始下一局 |
| NEXT_PLAYER | 轮到对手 | PLAYER_TURN | — |
| NEXT_PLAYER | 山札耗尽 | ROUND_END | 强制结束本局 |

## 完整状态数据结构

```typescript
interface GameState {
  // === 房间信息 ===
  roomId: string;
  mode: 'koi_koi' | 'hachi_hachi';
  
  // === 阶段信息 ===
  phase: GamePhase;
  round: number;              // 当前第几局（从 1 开始）
  
  // === 玩家信息 ===
  players: PlayerState[];
  currentPlayerIndex: number; // 当前轮到谁（0=亲，1=子）
  
  // === 牌组信息 ===
  deck: number[];             // 山札剩余牌的 ID 数组
  field: number[];            // 场牌 ID 数组
  hands: number[][];          // 每个玩家的手牌 ID 数组 [p0[], p1[]]
  captured: number[][];       // 每个玩家收集的牌 ID 数组 [p0[], p1[]]
  
  // === 得分信息 ===
  roundScores: number[];      // 当前局双方得分 [p0, p1]
  totalScores: number[];      // 累计总分 [p0, p1]
  targetScore: number;        // 目标分数（默认 7）
  
  // === Koi 信息 ===
  koiKoiCount: number;        // 当前 Koi 次数
  koiKoiCaller: number | null; // 喊 Koi 的玩家（null=无人喊过）
  koiKoiActive: boolean;      // Koi 是否生效中
  
  // === 特殊开局 ===
  specialResult: SpecialResult | null; // 四手/流局结果
  
  // === 时间信息 ===
  turnStartTime: number;      // 当前回合开始时间戳
  turnTimeLimit: number;      // 回合限时（秒），0=不限
  
  // === 序列化 ===
  lastActionSeq: number;      // 最后操作的序列号（用于状态同步校验）
}

enum GamePhase {
  Lobby = 'lobby',            // 大厅
  Dealing = 'dealing',        // 发牌
  CheckSpecial = 'check_special', // 特殊开局检查
  Redeal = 'redeal',          // 流局重发
  PlayerTurn = 'player_turn', // 玩家回合
  MatchCheck = 'match_check', // 匹配判定
  DrawCard = 'draw_card',     // 翻山札
  DrawMatch = 'draw_match',   // 翻牌匹配
  YakuCheck = 'yaku_check',   // 役判定
  KoiDecision = 'koi_decision', // Koi 选择
  KoiActive = 'koi_active',   // Koi 生效中
  NextPlayer = 'next_player', // 换人
  RoundEnd = 'round_end',     // 局结束
  GameEnd = 'game_end',       // 游戏结束
}

interface PlayerState {
  id: string;
  nickname: string;
  isReady: boolean;
  isConnected: boolean;
  isDealer: boolean;          // 是否为亲（庄家）
}

interface SpecialResult {
  type: 'te_shi' | 'field_four'; // 手四 / 场四
  winner: number | null;      // 手四时有值，场四时 null
  score: number;              // 得分
}
```

## 状态管理核心逻辑

### 初始化

```typescript
function initGame(roomId: string, players: PlayerInfo[], mode: GameMode): GameState {
  return {
    roomId,
    mode,
    phase: GamePhase.Lobby,
    round: 1,
    players: players.map((p, i) => ({
      id: p.id,
      nickname: p.nickname,
      isReady: false,
      isConnected: true,
      isDealer: i === 0, // 先入者为亲
    })),
    currentPlayerIndex: 0,
    deck: [],
    field: [],
    hands: [[], []],
    captured: [[], []],
    roundScores: [0, 0],
    totalScores: [0, 0],
    targetScore: 7,
    koiKoiCount: 0,
    koiKoiCaller: null,
    koiKoiActive: false,
    specialResult: null,
    turnStartTime: 0,
    turnTimeLimit: 0,
    lastActionSeq: 0,
  };
}
```

### 发牌

```typescript
function deal(state: GameState): GameState {
  const deck = shuffleDeck(createFullDeck()); // 洗牌
  const hands: number[][] = [[], []];
  const field: number[] = [];
  
  // 手八の场八
  // 先发手牌：每人 8 张
  for (let i = 0; i < 8; i++) {
    hands[0].push(deck.pop()!); // 亲先拿
    hands[1].push(deck.pop()!); // 子后拿
  }
  // 再发场牌：8 张
  for (let i = 0; i < 8; i++) {
    field.push(deck.pop()!);
  }
  
  return {
    ...state,
    phase: GamePhase.Dealing,
    deck,
    field,
    hands,
    captured: [[], []],
    roundScores: [0, 0],
    koiKoiCount: 0,
    koiKoiCaller: null,
    koiKoiActive: false,
    specialResult: null,
  };
}
```

### 特殊开局检查

```typescript
function checkSpecial(state: GameState): GameState {
  // 检查场牌是否有四张同月
  const fieldMonths = state.field.map(id => getCardById(id).month);
  const monthCounts = countBy(fieldMonths);
  
  for (const [month, count] of Object.entries(monthCounts)) {
    if (count === 4) {
      return { ...state, phase: GamePhase.Redeal, specialResult: {
        type: 'field_four',
        winner: null,
        score: 0,
      }};
    }
  }
  
  // 检查手牌是否有四张同月（手四）
  for (let p = 0; p < 2; p++) {
    const handMonths = state.hands[p].map(id => getCardById(id).month);
    const handCounts = countBy(handMonths);
    for (const [month, count] of Object.entries(handCounts)) {
      if (count === 4) {
        return { ...state, phase: GamePhase.GameEnd, specialResult: {
          type: 'te_shi',
          winner: p,
          score: 6,
        }};
      }
    }
  }
  
  return { ...state, phase: GamePhase.PlayerTurn };
}
```

### 玩家出牌

```typescript
function playCard(state: GameState, playerIndex: number, cardId: number): GameState {
  // 校验
  if (playerIndex !== state.currentPlayerIndex) {
    throw new Error('不是当前玩家的回合');
  }
  if (!state.hands[playerIndex].includes(cardId)) {
    throw new Error('手牌中没有这张牌');
  }
  
  const card = getCardById(cardId);
  
  // 匹配场牌
  const matched = state.field.filter(id => getCardById(id).month === card.month);
  
  let newCaptured = [...state.captured];
  let newField: number[];
  let newHands = [...state.hands];
  
  if (matched.length > 0) {
    // 匹配成功：打出牌 + 场中同月牌收入计分区
    newCaptured[playerIndex] = [
      ...newCaptured[playerIndex],
      cardId,
      ...matched,
    ];
    newField = state.field.filter(id => !matched.includes(id));
  } else {
    // 匹配失败：牌留在场中
    newField = [...state.field, cardId];
  }
  
  // 从手牌移除
  newHands[playerIndex] = newHands[playerIndex].filter(id => id !== cardId);
  
  return {
    ...state,
    phase: GamePhase.MatchCheck,
    hands: newHands,
    field: newField,
    captured: newCaptured,
    lastActionSeq: state.lastActionSeq + 1,
  };
}
```

### 翻山札

```typescript
function drawCard(state: GameState): GameState {
  if (state.deck.length === 0) {
    // 山札耗尽 → 强制结束本局
    return { ...state, phase: GamePhase.RoundEnd };
  }
  
  const drawnCard = state.deck[state.deck.length - 1];
  const newDeck = state.deck.slice(0, -1);
  
  return {
    ...state,
    phase: GamePhase.DrawCard,
    deck: newDeck,
    _drawnCard: drawnCard, // 临时存储翻出的牌
    lastActionSeq: state.lastActionSeq + 1,
  };
}
```

### 翻牌匹配

```typescript
function checkDrawMatch(state: GameState): GameState {
  const drawnCard = state._drawnCard!;
  const card = getCardById(drawnCard);
  
  const matched = state.field.filter(id => getCardById(id).month === card.month);
  
  let newCaptured = [...state.captured];
  let newField: number[];
  const currentPlayer = state.currentPlayerIndex;
  
  if (matched.length > 0) {
    // 匹配成功
    newCaptured[currentPlayer] = [
      ...newCaptured[currentPlayer],
      drawnCard,
      ...matched,
    ];
    newField = state.field.filter(id => !matched.includes(id));
  } else {
    // 匹配失败：翻出的牌留在场中
    newField = [...state.field, drawnCard];
  }
  
  return {
    ...state,
    phase: GamePhase.DrawMatch,
    field: newField,
    captured: newCaptured,
    _drawnCard: undefined,
    lastActionSeq: state.lastActionSeq + 1,
  };
}
```

### 役判定

```typescript
function checkYaku(state: GameState): GameState {
  const captured = state.captured[state.currentPlayerIndex];
  const yakuResults = YakuChecker.check(captured);
  
  if (yakuResults.length === 0) {
    return { ...state, phase: GamePhase.NextPlayer };
  }
  
  // 有役 → 进入 Koi 决策
  return {
    ...state,
    phase: GamePhase.KoiDecision,
    _currentYaku: yakuResults,
    lastActionSeq: state.lastActionSeq + 1,
  };
}
```

### Koi 决策

```typescript
function callKoiKoi(state: GameState): GameState {
  return {
    ...state,
    phase: GamePhase.KoiActive,
    koiKoiCount: state.koiKoiCount + 1,
    koiKoiCaller: state.currentPlayerIndex,
    koiKoiActive: true,
    lastActionSeq: state.lastActionSeq + 1,
  };
}

function endRound(state: GameState): GameState {
  const yakuResults = state._currentYaku || [];
  let score = yakuResults.reduce((sum, y) => sum + y.points, 0);
  
  // Koi 翻倍
  if (state.koiKoiActive && state.koiKoiCaller === state.currentPlayerIndex) {
    score *= Math.pow(2, state.koiKoiCount);
  }
  
  const newRoundScores = [...state.roundScores];
  newRoundScores[state.currentPlayerIndex] = score;
  
  const newTotalScores = state.totalScores.map((s, i) => s + newRoundScores[i]);
  
  // 判断是否达到目标分
  const winner = newTotalScores.findIndex(s => s >= state.targetScore);
  
  return {
    ...state,
    phase: winner >= 0 ? GamePhase.GameEnd : GamePhase.RoundEnd,
    roundScores: newRoundScores,
    totalScores: newTotalScores,
    lastActionSeq: state.lastActionSeq + 1,
  };
}
```

### 换人

```typescript
function nextPlayer(state: GameState): GameState {
  // 检查手牌是否耗尽
  const currentHand = state.hands[state.currentPlayerIndex];
  if (currentHand.length === 0 && state.deck.length === 0) {
    return { ...state, phase: GamePhase.RoundEnd };
  }
  
  // 如果手牌耗尽但山札还有，补牌
  if (currentHand.length === 0) {
    // 双方各补到满手（花札规则中通常是交替补牌）
    state = refillHands(state);
  }
  
  const nextIndex = (state.currentPlayerIndex + 1) % state.players.length;
  
  return {
    ...state,
    phase: GamePhase.PlayerTurn,
    currentPlayerIndex: nextIndex,
    turnStartTime: Date.now(),
  };
}
```

### 回合结束

```typescript
function endRoundPhase(state: GameState): GameState {
  // 结算亲权（上局赢家成为下局亲）
  const winner = state.roundScores[0] > state.roundScores[1] ? 0 :
                 state.roundScores[1] > state.roundScores[0] ? 1 :
                 state.currentPlayerIndex; // 平局时当前玩家（庄家）胜
  
  const newPlayers = state.players.map((p, i) => ({
    ...p,
    isDealer: i === winner,
  }));
  
  return {
    ...state,
    phase: GamePhase.Dealing,
    round: state.round + 1,
    players: newPlayers,
    currentPlayerIndex: winner,
  };
}
```

## 状态序列化

用于网络传输和断线重连：

```typescript
function serializeState(state: GameState): SerializedGameState {
  return {
    phase: state.phase,
    round: state.round,
    currentPlayerIndex: state.currentPlayerIndex,
    deck: state.deck,
    field: state.field,
    hands: state.hands,
    captured: state.captured,
    roundScores: state.roundScores,
    totalScores: state.totalScores,
    targetScore: state.targetScore,
    koiKoiCount: state.koiKoiCount,
    koiKoiCaller: state.koiKoiCaller,
    koiKoiActive: state.koiKoiActive,
    lastActionSeq: state.lastActionSeq,
  };
}
```

## 客户端与服务端状态同步

### 服务端权威

- 服务端维护唯一真实的游戏状态
- 客户端持有状态的**子集**（只看得到自己的手牌）
- 每次操作后服务端广播状态变更

### 乐观更新

```
客户端:                              服务端:
[本地状态]
  │ 用户出牌
  ▼
[乐观更新] ← 立即更新 UI 展示
  │ 发送 play_card 消息
  │────────────────────────────────▶
  │                                  [执行出牌]
  │                                  [验证操作]
  │  返回 card_played (权威状态)      │
  │◀────────────────────────────────│
  ▼
[覆盖为权威状态]
  │ 检查乐观更新与权威状态是否一致
  │ 不一致 → 回滚并提示
```

## 测试要点

- [ ] 状态机按正确顺序流转
- [ ] 发牌后数据正确（手 8 + 场 8 + 山 24）
- [ ] 四手检测正确
- [ ] 场四流局正确
- [ ] 出牌匹配逻辑正确
- [ ] 翻牌匹配逻辑正确
- [ ] 役判定后正确进入 Koi 决策
- [ ] Koi 翻倍计算正确
- [ ] 目标分数到达后游戏结束
- [ ] 亲权切换正确
- [ ] 状态序列化/反序列化一致
- [ ] 乐观更新与权威状态冲突时正确回滚

## 与系统索引的关联

| 依赖系统 | 交互方式 | 数据流向 |
|----------|----------|----------|
| 牌面数据系统 | 通过 cardId 查询牌信息 | 牌面数据 → 状态管理 |
| 游戏规则引擎 | 调用役判定、匹配逻辑 | 规则引擎 ↔ 状态管理 |
| 网络通信层 | 序列化状态传输、接收玩家操作 | 状态管理 ↔ 网络通信 |
| 对战管理 | 管理回合控制、超时 | 状态管理 ↔ 对战管理 |
| UI/牌桌渲染 | 读取当前状态渲染界面 | 状态管理 → UI |

## TBD — 待确认

- [x] 回合限时：MVP 不做，改用 90s 空闲心跳检测 ✅
- [x] 补牌规则：手牌耗尽后从山札交替补牌至 8 张 ✅
- [x] 平局时亲权：平局时当前玩家（庄家）继续做亲 ✅

## 版本历史

| 版本 | 日期 | 变更 |
|------|------|------|
| v0.1 | 2026-04-27 | 初始版本 |
