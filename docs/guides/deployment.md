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
# 前台运行（直接模式）
node packages/cli/dist/index.js daemon

# 后台运行（systemd）
```

### 中继模式

```bash
# 连接中继服务器
node packages/cli/dist/index.js daemon --server ws://relay.example.com:19998
```

### 数据目录

守护进程在 `$HOME/.openz/` 下创建：

```
~/.openz/
├── daemon.state.json   # 进程状态（PID、端口、版本）
├── sessions.json       # 会话持久化
└── daemon.log          # 运行日志
```

### XDG 配置

守护进程支持通过 `~/.config/openz/setting.json`（遵循 [XDG Base Directory 规范](https://specifications.freedesktop.org/basedir-spec/basedir-spec-latest.html)）进行全局配置：

```json
{
  "serverUrl": "ws://localhost:19998",
  "tts": {
    "appkey": "",
    "resourceId": "seed-tts-2.0",
    "voiceType": "saturn_zh_female_aojiaonvyou_tob",
    "sampleRate": 24000,
    "encoding": "pcm"
  },
  "daemon": {
    "port": 19999
  }
}
```

| 字段 | 说明 |
|------|------|
| `serverUrl` | 中继服务器 WebSocket URL（relay 模式连接） |
| `tts.appkey` | 火山引擎 TTS AppKey |
| `tts.resourceId` | TTS 资源 ID |
| `tts.voiceType` | 音色名称 |
| `tts.sampleRate` | 采样率（默认 24000） |
| `tts.encoding` | 编码格式（默认 pcm） |
| `daemon.port` | Daemon Socket.IO 端口（默认 19999） |

配置不存在或字段缺失时，使用上述缺省值。

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

默认端口：`19998`

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
http://web.example.com/?server=ws://relay.example.com:19998
```

中继 URL 可通过 `?server=` 查询参数指定。

### 注意事项

1. **CORS**：Socket.IO 服务器配置了 `cors: { origin: '*' }`，生产环境建议限制
2. **端口**：确保前端能访问到守护进程端口（19999）或中继服务器（19998）
3. **网络**：直接模式下守护进程和前端通常部署在同一机器；中继模式下可跨网络

## 生产环境建议

1. **进程管理**：使用 systemd 或 pm2 管理守护进程和中继服务器
2. **日志轮转**：配置 logrotate 处理 `daemon.log`
3. **安全**：限制 CORS origin，添加认证
4. **监控**：监控 `daemon.state.json` 中的 PID 和端口
5. **中继服务器**：建议使用 nginx 反向代理到 19998 端口，启用 TLS
