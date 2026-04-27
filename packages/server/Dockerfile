FROM node:20-slim

WORKDIR /app

# 复制 monorepo 全部代码
COPY package.json package-lock.json* ./
COPY packages/core/package.json packages/core/package.json
COPY packages/server/package.json packages/server/package.json

RUN npm install --registry=https://registry.npmmirror.com

# 复制源码
COPY packages/core/tsconfig.json packages/core/tsconfig.json
COPY packages/core/src packages/core/src
COPY packages/server/tsconfig.json packages/server/tsconfig.json
COPY packages/server/src packages/server/src

# 构建 core
RUN cd packages/core && npx tsc

# 构建 server
RUN cd packages/server && npx tsc

EXPOSE 3000

CMD ["node", "packages/server/dist/index.js"]
