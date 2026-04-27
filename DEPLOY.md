# 花札在线对战 — 部署指南

## 一、服务端部署（微信云托管）

### 1. 开通微信云托管

1. 登录 [微信公众平台](https://mp.weixin.qq.com/)
2. 进入你的小程序 → **开发管理** → **开发设置**
3. 找到 **云开发** → 开通 **云托管**（CloudBase Run）

### 2. 准备代码

确保以下文件已提交到 Git 仓库：

```
game/hanafuda-online/
├── package.json
├── packages/core/          # 核心库
├── packages/server/        # 服务端
│   ├── Dockerfile          ← 部署关键
│   ├── package.json
│   └── src/
└── DEPLOY.md               ← 本文档
```

### 3. 构建 Docker 镜像

在项目根目录执行：

```bash
cd game/hanafuda-online
docker build -t hanafuda-server -f packages/server/Dockerfile .
```

### 4. 推送到腾讯云镜像仓库

```bash
# 登录腾讯云
docker login ccr.ccs.tencentyun.com

# 打 tag
docker tag hanafuda-server ccr.ccs.tencentyun.com/<你的命名空间>/hanafuda-server:latest

# 推送
docker push ccr.ccs.tencentyun.com/<你的命名空间>/hanafuda-server:latest
```

### 5. 云托管部署

1. 进入 **云托管控制台**
2. 创建服务 → 命名 `hanafuda`
3. 容器配置：
   - 镜像：选择刚才推送的镜像
   - 端口：**3000**
   - 环境变量：`NODE_ENV=production`
4. 部署 → 等待状态变为"运行中"
5. 获取服务地址：`wss://hanafuda-xxxxx.cloudbase.net`

### 6. 配置 WebSocket 域名

1. 小程序后台 → **开发管理** → **开发设置**
2. **服务器域名** → 添加 WebSocket 域名
3. 填入云托管地址（wss:// 前缀）

---

## 二、客户端配置

### 1. 修改服务器地址

编辑 `packages/client/src/main.ts`：

```typescript
const CONFIG = {
  SERVER_URL: 'wss://hanafuda-xxxxx.cloudbase.net',  // ← 替换为云托管地址
  CARD_W: 60,
  CARD_H: 96,
  SCREEN_W: 375,
  SCREEN_H: 667,
};
```

### 2. 修改 AppID

编辑 `packages/client/project.config.json`：

```json
{
  "appid": "wx1234567890abcdef",  // ← 替换为你的小程序 AppID
  "projectname": "hanafuda-online"
}
```

### 3. 安装微信开发者工具

1. 下载：https://developers.weixin.qq.com/miniprogram/dev/devtools/download.html
2. 安装后用微信扫码登录
3. 导入项目：
   - 点击 **导入项目**
   - 项目目录：`game/hanafuda-online/packages/client`
   - AppID：填入你的 AppID
   - 选择 **小游戏** 类型
4. 点击 **编译** 运行

---

## 三、联调测试清单

### 基础功能

- [ ] 服务端启动正常（云托管状态显示"运行中"）
- [ ] 客户端连接成功（控制台显示 `[Socket] 已连接`）
- [ ] 创建房间，获得 6 位房间号
- [ ] 第二个设备加入房间，双方看到对方
- [ ] 点击"开始游戏"，发牌正确（手8+场8+山24）

### 游戏流程

- [ ] 出牌 → 匹配 → 翻牌 → 状态同步正常
- [ ] 役达成 → 弹窗出现 → 选择结束/继续
- [ ] 结算正确，分数累加
- [ ] 达到 7 分 → 游戏结束

### 断线重连

- [ ] 模拟断网 → 显示断开提示
- [ ] 恢复网络 → 自动重连
- [ ] 重连后游戏状态恢复

### 三人模式

- [ ] 创建三人房间 → 3 人加入
- [ ] 开始游戏 → 发牌正确（手8×3+场9+山16）
- [ ] 三人轮流出牌正常
- [ ] 山札耗尽 → 三方结算

---

## 四、本地开发调试（可选）

如果不想立刻部署到云托管，可以先本地运行服务端：

```bash
cd game/hanafuda-online
npm install
cd packages/server
npx tsx watch src/index.ts
```

客户端 `main.ts` 的 `SERVER_URL` 改为：

```typescript
SERVER_URL: 'ws://localhost:3000',  // 本地调试用 ws://（不是 wss://）
```

注意：微信开发者工具需要在设置中勾选 **不校验合法域名** 才能连接 localhost。

---

## 五、常见问题

### Q: WebSocket 连接失败？
- 检查云托管服务状态是否为"运行中"
- 检查小程序后台是否已配置 WebSocket 域名
- 检查 `SERVER_URL` 是否以 `wss://` 开头

### Q: 客户端显示空白？
- 检查项目类型是否选择了 **小游戏**（不是小程序）
- 检查 `project.config.json` 中的 `compileType` 是否为 `"game"`

### Q: 牌面不显示？
- 检查 `packages/client/assets/cards/` 目录是否有 SVG 文件
- SVG 文件是否被正确打包到小游戏包中
