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
# 前台运行
node packages/cli/dist/index.js daemon

# 后台运行（systemd）
```

### 数据目录

守护进程在 `$HOME/.uran/` 下创建：

```
~/.uran/
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

## Web 前端部署

### 构建

```bash
cd packages/web
pnpm build
```

产物在 `packages/web/dist/`，可部署到任意静态托管服务。

### 注意事项

1. **CORS**：Socket.IO 服务器配置了 `cors: { origin: '*' }`，生产环境建议限制
2. **端口**：确保前端能访问到守护进程端口（19999）
3. **网络**：守护进程和前端通常部署在同一机器

## 生产环境建议

1. **进程管理**：使用 systemd 或 pm2 管理守护进程
2. **日志轮转**：配置 logrotate 处理 `daemon.log`
3. **安全**：限制 CORS origin，添加认证
4. **监控**：监控 `daemon.state.json` 中的 PID 和端口
