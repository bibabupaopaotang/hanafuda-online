# 花札在线对战 — 阿里云轻量服务器部署指南

## 前置条件

- ✅ 阿里云轻量服务器（推荐 2核2G 起步）
- ✅ 域名（已解析到服务器 IP）
- ✅ 服务器开放端口：80、443、3000（仅内网）

## 一、服务器环境准备

SSH 登录服务器后执行：

```bash
# 1. 安装 Docker
curl -fsSL https://get.docker.com | bash -s docker
sudo systemctl enable docker
sudo systemctl start docker

# 2. 安装 Docker Compose
sudo apt install docker-compose-plugin -y

# 3. 安装 Nginx
sudo apt install nginx certbot python3-certbot-nginx -y

# 4. 安装 Git
sudo apt install git -y
```

## 二、部署代码

```bash
# 克隆项目（或直接用 scp 上传）
git clone <你的仓库地址> hanafuda
cd hanafuda

# 安装依赖
cd /home/admin/openclaw/workspace/game/hanafuda-online
npm install --registry=https://registry.npmmirror.com

# 构建 core
cd packages/core
npx tsc

# 构建 server
cd ../server
npx tsc
```

## 三、配置 Nginx 反向代理（提供 wss）

微信小程序要求 WebSocket 必须是 `wss://`，所以需要用 Nginx 做反向代理。

### 1. 创建 Nginx 配置

```bash
sudo nano /etc/nginx/sites-available/hanafuda
```

```nginx
server {
    listen 80;
    server_name your-domain.com;  # ← 替换为你的域名

    # HTTP → HTTPS 重定向
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl http2;
    server_name your-domain.com;  # ← 替换为你的域名

    # SSL 证书（先用 Let's Encrypt 免费证书）
    ssl_certificate     /etc/letsencrypt/live/your-domain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/your-domain.com/privkey.pem;

    # WebSocket 代理
    location /ws {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_read_timeout 86400;
    }

    # 静态资源（客户端文件）
    location / {
        root /home/admin/openclaw/workspace/game/hanafuda-online/packages/client;
        try_files $uri $uri/ =404;
    }
}
```

### 2. 启用配置

```bash
sudo ln -s /etc/nginx/sites-available/hanafuda /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

### 3. 申请 SSL 证书

```bash
sudo certbot --nginx -d your-domain.com
```

## 四、用 PM2 运行服务端

```bash
# 安装 PM2
sudo npm install -g pm2

# 启动服务端
cd /home/admin/openclaw/workspace/game/hanafuda-online/packages/server
pm2 start dist/index.js --name hanafuda-server

# 开机自启
pm2 startup
pm2 save

# 查看状态
pm2 status
pm2 logs hanafuda-server
```

## 五、客户端配置

编辑 `packages/client/src/main.ts`：

```typescript
const CONFIG = {
  SERVER_URL: 'wss://your-domain.com/ws',  // ← 替换为你的域名
  CARD_W: 60,
  CARD_H: 96,
  SCREEN_W: 375,
  SCREEN_H: 667,
};
```

## 六、微信开发者工具

1. 打开微信开发者工具
2. 导入 `packages/client` 目录
3. 项目类型选 **小游戏**
4. AppID 填你的小程序 AppID
5. 编译运行

## 七、快速一键部署脚本

```bash
#!/bin/bash
set -e

DOMAIN="your-domain.com"  # ← 修改这里
PROJECT_DIR="/home/admin/openclaw/workspace/game/hanafuda-online"

echo "=== 1. 构建项目 ==="
cd "$PROJECT_DIR"
npm install --registry=https://registry.npmmirror.com
cd packages/core && npx tsc && cd ../..
cd packages/server && npx tsc && cd ../..

echo "=== 2. 安装依赖 ==="
sudo apt update
sudo apt install -y nginx certbot python3-certbot-nginx
sudo npm install -g pm2

echo "=== 3. 配置 Nginx ==="
sudo tee /etc/nginx/sites-available/hanafuda > /dev/null <<EOF
server {
    listen 80;
    server_name $DOMAIN;
    return 301 https://\$host\$request_uri;
}

server {
    listen 443 ssl http2;
    server_name $DOMAIN;

    ssl_certificate     /etc/letsencrypt/live/$DOMAIN/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/$DOMAIN/privkey.pem;

    location /ws {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host \$host;
        proxy_read_timeout 86400;
    }

    location / {
        root $PROJECT_DIR/packages/client;
        try_files \$uri \$uri/ =404;
    }
}
EOF

sudo ln -sf /etc/nginx/sites-available/hanafuda /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx

echo "=== 4. 申请 SSL ==="
sudo certbot --nginx -d $DOMAIN --non-interactive --agree-tos --email your-email@example.com

echo "=== 5. 启动服务端 ==="
cd "$PROJECT_DIR/packages/server"
pm2 delete hanafuda-server || true
pm2 start dist/index.js --name hanafuda-server
pm2 save

echo "=== 部署完成 ==="
echo "WebSocket 地址: wss://$DOMAIN/ws"
echo "查看日志: pm2 logs hanafuda-server"
echo "查看状态: pm2 status"
```

## 八、常用运维命令

```bash
# 查看服务端日志
pm2 logs hanafuda-server

# 重启服务端
pm2 restart hanafuda-server

# 查看连接数
pm2 status

# 更新代码后重新部署
cd /home/admin/openclaw/workspace/game/hanafuda-online
git pull
cd packages/core && npx tsc && cd ../server && npx tsc
pm2 restart hanafuda-server

# Nginx 日志
sudo tail -f /var/log/nginx/access.log
sudo tail -f /var/log/nginx/error.log
```

## 九、服务器最低配置

| 配置 | 推荐 |
|------|------|
| CPU | 1 核（2 核更佳） |
| 内存 | 1GB（2GB 更佳） |
| 带宽 | 1Mbps（够用） |
| 系统 | Ubuntu 20.04 / 22.04 |
| 域名 | 必须（微信小程序要求 wss） |
