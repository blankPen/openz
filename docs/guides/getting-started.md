# 快速入门

## 环境要求

- **Node.js**: >= 20
- **pnpm**: 最新版

## 安装

```bash
git clone git@github.com:blankPen/openz.git
cd openz
pnpm install
```

## 构建

```bash
pnpm build
```

## 启动守护进程

```bash
# 启动 daemon（默认端口 19999）
pnpm dev

# 或指定端口
DAEMON_PORT=20000 pnpm dev
```

守护进程启动后：
- 状态文件：`~/.uran/daemon.state.json`
- 会话文件：`~/.uran/sessions.json`
- 日志文件：`~/.uran/daemon.log`

## 启动 Web 前端

在另一个终端：

```bash
cd packages/web
pnpm dev
```

前端访问：`http://localhost:5173`（Vite 默认）

## 使用 Web 控制台

1. 打开 `http://localhost:5173`
2. 守护进程会自动创建新会话
3. 在输入框输入消息，Claude Agent 将处理并返回结果
4. 右侧显示会话历史

## 项目结构

```
uran/
├── packages/
│   ├── cli/          # 守护进程
│   │   └── src/
│   │       ├── daemon/     # Socket.IO 服务
│   │       └── agents/     # Agent 实现
│   ├── shared/       # 共享类型
│   │   └── src/
│   │       └── types.ts
│   └── web/          # React 前端
│       └── src/
│           ├── components/
│           └── hooks/
└── docs/             # 项目文档
```

## 常用命令

| 命令 | 说明 |
|------|------|
| `pnpm build` | 构建所有包 |
| `pnpm dev` | 启动守护进程 |
