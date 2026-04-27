# 花札在线对战 — 开发计划

创建时间: 2026-04-27 15:55
最后更新: 2026-04-28 01:21

## Phase 1: 后端核心 ✅

- [x] 1.1 项目骨架（Monorepo）
- [x] 1.2 牌组数据 — 48 张牌 + 洗牌 + 校验
- [x] 1.3 规则引擎 — 全部役判定
- [x] 1.4 计分系统 — Koi 翻倍 + 叠加
- [x] 1.5 游戏状态机 — 完整状态流转
- [x] 1.6 对战管理 — 房间 + 开始游戏

## Phase 2: 网络层 ✅

- [x] 2.1 Socket.io 服务端
- [x] 2.2 消息协议实现
- [x] 2.3 E2E 测试 — 13 tests ✅
- [x] 2.4 断线重连（基础）

## Phase 3: 前端 UI 🔄

- [x] 3.1 微信小游戏客户端骨架
- [x] 3.2 牌桌布局 + 手牌渲染
- [x] 3.3 Koi 决策弹窗
- [x] 3.4 结算/结果界面
- [x] 3.5 微信登录
- [ ] 3.6 真实牌面图片替换 SVG 占位
- [ ] 3.7 出牌动画

## Phase 4: 部署与联调 🔄

- [x] 4.1 Dockerfile + 部署文档
- [ ] 4.2 服务端实际部署
- [ ] 4.3 端到端联调

## Phase 5: 扩展

- [ ] 5.1 Hachi-Hachi 三人模式
- [ ] 5.2 音效系统
- [ ] 5.3 设置系统

## 文件清单

```
game/hanafuda-online/
├── DESIGN/                    ← 12 份 GDD 文档
│   └── gdd/                   (88KB 设计文档)
├── DEVELOPMENT_PLAN.md        ← 本文件
├── DEPLOY.md                  ← 部署指南
├── scripts/
│   └── generate-cards.sh      ← SVG 牌面生成脚本
├── packages/
│   ├── core/                  ← 后端核心库 ✅
│   │   ├── src/
│   │   │   ├── cards/         牌组数据
│   │   │   ├── rules/         役判定
│   │   │   ├── scoring/       计分
│   │   │   ├── state/         状态机
│   │   │   └── index.ts       统一导出
│   │   └── tests/             13 tests ✅
│   ├── server/                ← Socket.io 服务端 ✅
│   │   ├── src/
│   │   │   ├── rooms/
│   │   │   │   ├── manager.ts 房间管理
│   │   │   │   └── handler.ts Socket 事件
│   │   │   └── index.ts       入口
│   │   ├── tests/             13 tests ✅
│   │   └── Dockerfile         部署配置
│   └── client/                ← 微信小游戏客户端 🔄
│       ├── src/
│       │   ├── main.ts         主游戏逻辑
│       │   └── services/
│       │       ├── network.ts  网络通信
│       │       └── auth.ts     微信登录
│       ├── assets/cards/       48 张 SVG 牌面
│       └── project.config.json
```

## 测试状态

| 包 | 测试数 | 状态 |
|----|--------|------|
| @hanafuda/core | 13 | ✅ 全部通过 |
| @hanafuda/server | 13 | ✅ 全部通过 |
| **合计** | **26** | **✅ 26/26** |

## 当前进度

正在执行: Phase 3.6 — 替换真实牌面图片

## 下一步

1. 找/制作 48 张花札牌面 PNG 图片
2. 部署服务端到云托管
3. 客户端 ↔ 服务端联调
