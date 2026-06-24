# 部署指南

## 环境变量

| 变量 | 默认值 | 说明 |
|------|-------|------|
| `HOME` | 系统 HOME | 用于存储状态文件 |
| `DAEMON_PORT` | `19999` | Socket.IO 服务端口 |

## 守护进程部署

### 构建

```bash
pnpm build
```

### 启动

```bash
# 直接模式（默认，不连接 relay）
node packages/cli/dist/index.js daemon

# 连接中继服务器
node packages/cli/dist/index.js daemon --server ws://relay.example.com:8080
```

> **注意**：`--server` 参数缺省时，daemon 以直接模式启动，不连接任何 relay。此时 Web 控制台需通过 `?server=` 参数指定 daemon 地址。

### 数据目录

守护进程在 `$HOME/.openz/` 下创建：

```
~/.openz/
├── daemon.state.json   # 进程状态（PID、端口、版本）
├── sessions.json       # 会话持久化
└── daemon.log          # 运行日志
```

### 端口配置

确保守护进程端口与 Web 前端配置一致：

- 默认端口：`19999`
- 前端连接：`packages/web/src/socket.ts`

如需修改端口：
1. 修改 `packages/cli/src/daemon/types.ts` 中的 `DEFAULT_PORT`
2. 修改 `packages/web/src/socket.ts` 中的 `DAEMON_PORT`
3. 重新构建

## 中继服务器部署

### 构建

```bash
cd packages/server
pnpm build
```

### 启动

```bash
node packages/server/dist/index.js
```

默认端口：`8080`

## Web 前端部署

### 构建

```bash
cd packages/web
pnpm build
```

产物在 `packages/web/dist/`，可部署到任意静态托管服务。

### 公网部署（使用中继）

Web 前端连接中继服务器：

```
http://web.example.com/?server=ws://relay.example.com:8080
```

中继 URL 可通过 `?server=` 查询参数指定。

### 注意事项

1. **CORS**：Socket.IO 服务器配置了 `cors: { origin: '*' }`，生产环境建议限制
2. **端口**：确保前端能访问到守护进程端口（19999）或中继服务器（8080）
3. **网络**：直接模式下守护进程和前端通常部署在同一机器；中继模式下可跨网络

## 生产环境建议

1. **进程管理**：使用 systemd 或 pm2 管理守护进程和中继服务器
2. **日志轮转**：配置 logrotate 处理 `daemon.log`
3. **安全**：限制 CORS origin，添加认证
4. **监控**：监控 `daemon.state.json` 中的 PID 和端口
5. **中继服务器**：建议使用 nginx 反向代理到 8080 端口，启用 TLS
