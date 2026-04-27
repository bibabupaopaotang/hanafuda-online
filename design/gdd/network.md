# 网络通信层 — 游戏设计文档

> 校验日期：2026-04-27

## 概述

- **系统名称**：网络通信层 (Network Communication Layer)
- **所属层级**：Foundation
- **优先级**：P0
- **设计目标**：实现微信小游戏环境下的实时对战网络通信，包括 WebSocket 连接管理、消息协议、房间系统、断线重连。

## 架构选型

### 客户端

| 技术 | 说明 |
|------|------|
| 微信小游戏 WebSocket API | `wx.connectSocket` / `wx.onSocketOpen` / `wx.onSocketMessage` 等 |
| 心跳机制 | 定时发送 ping，检测连接存活 |
| 消息队列 | 断线期间缓存消息，重连后重发 |

### 服务端方案（已确认 ✅ 2026-04-27）

| 技术 | 说明 |
|------|------|
| **微信云托管（CloudBase Run）+ Node.js** | 零运维保留，但提供完整 WebSocket/Redis 环境 |
| **Socket.io** | 做长连接管理 |
| **云数据库** | 存对局数据 |
| **云函数** | 做鉴权/结算 |

> **核心理由**：纯云开发 WebSocket 实时性差、状态同步困难。云托管提供完整 Node.js 环境，用 Socket.io 做实时对战，云数据库和云函数做数据持久化，兼顾开发效率和性能。

## 网络架构

```
┌──────────────┐      Socket.io (wss)       ┌──────────────────────────┐
│   客户端 A    │ ◄─────────────────────────► │  云托管 (CloudBase Run)   │
│ (微信小游戏)  │                             │  Node.js + Socket.io     │
└──────────────┘                             │                          │
                                             │  ┌────────────────────┐  │
┌──────────────┐      Socket.io (wss)       │  │  Redis (房间/状态)    │  │
│   客户端 B    │ ◄─────────────────────────► │  └────────────────────┘  │
│ (微信小游戏)  │                             │                          │
└──────────────┘                             │  ┌────────────────────┐  │
                                             │  │ 云数据库 (持久化)    │  │
                                             │  └────────────────────┘  │
                                             │                          │
                                             │  ┌────────────────────┐  │
                                             │  │ 云函数 (鉴权/结算)   │  │
                                             │  └────────────────────┘  │
                                             └──────────────────────────┘
```

## 连接管理

### 连接生命周期

```
[Idle] → [Connecting] → [Connected] → [Playing] → [Disconnected]
              │              │                        │
              │         [Heartbeat OK]          [Reconnecting]
              │              │                        │
              │              │                   [Reconnected]
              │              │                        │
              │              │                   [Reconnect Failed]
              │              │                        │
              └──────────────┴────────────────────────┴──→ [Idle]
```

### 心跳机制

| 参数 | 值 | 说明 |
|------|----|------|
| 心跳间隔 | 15 秒 | 每 15 秒发一次 ping |
| 超时时间 | 30 秒 | 30 秒未收到 pong 视为断线 |
| 最大重试 | 3 次 | 重连最多尝试 3 次 |
| 重试间隔 | 1s → 2s → 4s | 指数退避 |

### 微信小游戏 Socket.io 连接

```typescript
// 使用 Socket.io 客户端（小程序兼容版）
import { io } from 'socket.io-client';

const socket = io('wss://your-cloudbase-run-url', {
  transports: ['websocket'],
  auth: {
    token: await getWxLoginToken(),
  },
});

// 事件监听
socket.on('connect', () => { /* 连接成功 */ });
socket.on('message', (data) => { /* 收到消息 */ });
socket.on('disconnect', () => { /* 连接关闭 */ });
socket.on('connect_error', (err) => { /* 连接错误 */ });

// 发送消息
socket.emit('play_card', { cardId: 5 });

// 关闭连接
socket.disconnect();
```

## 消息协议

### 协议格式

所有消息使用 JSON 格式，统一结构：

```typescript
interface NetworkMessage {
  type: MessageType;       // 消息类型
  seq: number;             // 序列号（客户端递增，服务端回显）
  timestamp: number;       // 发送时间戳（毫秒）
  roomId: string;          // 房间 ID
  payload: any;            // 消息内容
}
```

### 消息类型

#### 连接类

| 消息类型 | 方向 | 说明 |
|----------|------|------|
| `connect` | C→S | 建立连接，携带玩家信息 |
| `connected` | S→C | 连接成功，分配玩家 ID |
| `ping` | C→S | 心跳 |
| `pong` | S→C | 心跳响应 |
| `disconnect` | C→S | 主动断开 |

#### 房间类

| 消息类型 | 方向 | 说明 |
|----------|------|------|
| `create_room` | C→S | 创建房间 |
| `join_room` | C→S | 加入房间（通过房间号） |
| `room_created` | S→C | 房间创建成功，返回房间号 |
| `room_joined` | S→C | 加入房间成功 |
| `player_joined` | S→C | 有新玩家加入（通知房间内其他人） |
| `player_left` | S→C | 有玩家离开房间 |
| `room_full` | S→C | 房间已满 |
| `room_not_found` | S→C | 房间不存在 |

#### 游戏类

| 消息类型 | 方向 | 说明 |
|----------|------|------|
| `game_start` | S→C | 游戏开始，携带初始状态 |
| `play_card` | C→S | 出牌，携带牌的 ID |
| `card_played` | S→C | 出牌结果（广播） |
| `draw_card` | C→S | 请求翻山札（自动触发） |
| `card_drawn` | S→C | 翻牌结果（广播） |
| `match_result` | S→C | 匹配结果（是否配对成功） |
| `koi_koi` | C→S | 喊 こいこい |
| `end_round` | C→S | 选择结束本局 |
| `round_end` | S→C | 本局结束，携带分数 |
| `game_end` | S→C | 游戏结束，携带最终结果 |
| `game_state` | S→C | 全量状态同步（断线重连用） |
| `reconnect` | C→S | 断线重连请求 |
| `reconnected` | S→C | 重连成功，返回当前状态 |

#### 错误类

| 消息类型 | 方向 | 说明 |
|----------|------|------|
| `error` | S→C | 通用错误 |
| `timeout` | S→C | 操作超时 |
| `invalid_action` | S→C | 非法操作 |

### 消息示例

```typescript
// 客户端 → 服务端：出牌
{
  "type": "play_card",
  "seq": 42,
  "timestamp": 1714200000000,
  "roomId": "room_abc123",
  "payload": {
    "cardId": 5
  }
}

// 服务端 → 客户端：出牌结果（广播）
{
  "type": "card_played",
  "seq": 42,
  "timestamp": 1714200000100,
  "roomId": "room_abc123",
  "payload": {
    "playerId": 0,
    "cardId": 5,
    "matched": true,
    "matchedCards": [5, 13],
    "field": [8, 21, 33, 40],
    "nextPlayer": 1
  }
}

// 服务端 → 客户端：全量状态同步（重连用）
{
  "type": "game_state",
  "seq": 0,
  "timestamp": 1714200001000,
  "roomId": "room_abc123",
  "payload": {
    "phase": "player_turn",
    "currentPlayer": 1,
    "hands": [[...], [...]],
    "field": [8, 21, 33, 40],
    "deckRemaining": 18,
    "captured": [[...], [...]],
    "scores": [3, 5],
    "koiKoiCount": 1,
    "koiKoiCaller": 0
  }
}
```

## 房间系统

### 房间数据结构

```typescript
interface Room {
  id: string;              // 房间号（6位数字或短字符串）
  hostId: string;          // 房主玩家 ID
  players: PlayerInfo[];   // 玩家列表
  maxPlayers: number;      // 最大人数（2 或 3）
  gameState: GameState | null; // 游戏状态（游戏中时）
  status: 'waiting' | 'playing' | 'finished';
  createdAt: number;
  settings: RoomSettings;
}

interface RoomSettings {
  mode: 'koi_koi' | 'hachi_hachi';
  targetScore: number;
  timeLimit: number;       // 每回合限时（秒），0=不限
}

interface PlayerInfo {
  id: string;
  nickname: string;
  avatar: string;
  isReady: boolean;
  isConnected: boolean;
}
```

### 房间生命周期

```
[创建] → [等待中] → [开始游戏] → [游戏中] → [游戏结束] → [解散]
              ↑                        │
              │                   [断线暂停]
              │                        │
              └───────────────── [重连恢复]
```

### 匹配方式

MVP 版本只支持 **房间号匹配**：

1. 玩家 A 创建房间 → 获得 6 位房间号
2. 玩家 A 将房间号分享给玩家 B（微信分享/聊天）
3. 玩家 B 输入房间号加入

后续可扩展：
- 快速匹配（自动匹配在线玩家）
- 好友对战（微信好友列表）

## 断线重连

### 断线检测

- 心跳超时（30 秒无响应）
- WebSocket 连接关闭
- 网络状态变化（微信 `wx.onNetworkStatusChange`）

### 重连流程

```
1. 检测到断线 → 显示"重新连接中..."
2. 尝试重连（最多 3 次，指数退避）
3. 重连成功 → 发送 reconnect 消息
4. 服务端返回当前全量游戏状态
5. 客户端同步状态 → 恢复游戏
6. 重连失败 → 判定断线玩家输（或暂停等待）
```

### 断线处理策略

| 场景 | 处理方式 |
|------|----------|
| 断线 < 30 秒 | 暂停游戏，等待重连 |
| 断线 30 秒 ~ 2 分钟 | 自动重连，恢复状态 |
| 断线 > 2 分钟 | 判定断线玩家输，对手获胜 |

### 状态同步

重连时服务端返回**全量游戏状态**，客户端直接覆盖本地状态：

```typescript
interface ReconnectPayload {
  gameState: GameState;      // 当前完整状态
  myPlayerId: number;        // 当前玩家 ID
  lastAction: LastAction;    // 上一步操作（用于回放提示）
  serverTime: number;        // 服务器时间戳
}
```

## 安全考虑

### 权威服务器

- **所有游戏规则在服务端执行**，客户端只负责展示
- 客户端发送的是"意图"（出哪张牌），不是"结果"
- 服务端验证每一步操作的合法性

### 防作弊

- 客户端不持有完整牌组信息（只知道自己手牌和场牌）
- 所有随机操作（洗牌、翻山札）在服务端执行
- 操作时序校验（防止乱序发送消息）

## 性能要求

| 指标 | 目标 |
|------|------|
| 消息延迟 | ≤ 100ms（国内） |
| 断线重连时间 | ≤ 3 秒 |
| 最大并发房间 | 1000（MVP 阶段） |
| 消息大小 | ≤ 2KB（单条） |

## 核心接口设计

```typescript
interface NetworkManager {
  // 连接管理
  connect(): Promise<void>;
  disconnect(): void;
  isConnected(): boolean;
  
  // 房间
  createRoom(settings: RoomSettings): Promise<string>;  // 返回房间号
  joinRoom(roomId: string): Promise<void>;
  leaveRoom(): void;
  
  // 游戏操作
  playCard(cardId: number): Promise<PlayCardResult>;
  callKoiKoi(): Promise<void>;
  endRound(): Promise<void>;
  
  // 事件
  onMessage(type: MessageType, handler: (payload: any) => void): void;
  onError(handler: (error: NetworkError) => void): void;
  onDisconnect(handler: () => void): void;
  onReconnect(handler: () => void): void;
  
  // 状态
  getState(): NetworkState;
}
```

## 微信小游戏网络限制

| 限制 | 说明 |
|------|------|
| 域名白名单 | WebSocket 域名必须在微信后台配置 |
| 并发连接 | 最多 2 个 WebSocket 连接 |
| TLS 要求 | 必须使用 wss://（不能使用 ws://） |
| 超时 | 连接超时 60 秒 |

## 测试要点

- [ ] 创建房间成功，返回房间号
- [ ] 加入房间成功，双方收到通知
- [ ] 出牌消息传递延迟 ≤ 100ms
- [ ] 断线后 30 秒内重连成功
- [ ] 断线超过 2 分钟判定输
- [ ] 重连后游戏状态正确同步
- [ ] 房间号错误时正确提示
- [ ] 网络切换后自动重连
- [ ] 消息乱序时服务端正确拒绝

## TBD — 待确认

- [x] 服务器方案：微信云托管（CloudBase Run）+ Node.js + Socket.io ✅
- [ ] WebSocket 服务器域名（云托管部署后确定）
- [ ] 是否需要支持观战模式
- [ ] 是否需要离线通知（微信服务通知推送对手出牌）

## 版本历史

| 版本 | 日期 | 变更 |
|------|------|------|
| v0.1 | 2026-04-27 | 初始版本 |
