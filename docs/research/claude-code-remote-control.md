# Claude Code 远程控制能力深度调研报告

**研究日期：2026年6月**
**信息来源：逆向工程分析（2026年4-5月）、官方文档、GitHub issues、CVE安全公告**

---

## 1. 执行摘要

Claude Code 提供三种远程控制模式（Server模式、交互式会话、现有会话），通过未文档化的 `--sdk-url` 参数实现与远程工作进程的通信。协议存在两个版本：CCR v1（原始WebSocket+NDJSON）和CCR v2（基于SSE/HTTPS）。安全方面，pre-1.0.24版本存在严重安全漏洞（CVE-2025-52882），允许任意 Origin 的 WebSocket 连接，当前版本已修复。工具调用通过 `control_request/control_response` 机制进行权限管理。截至调研时，官方未提供远程API暴露的开源实现，第三方实现依赖浏览器凭证提取，存在稳定性和合规风险。

---

## 2. API 接口机制分析

### 2.1 三种远程控制模式

| 模式 | 命令 | 描述 | 并发限制 |
|------|------|------|----------|
| **Server模式** | `claude remote-control` | 启动远程控制服务器 | 最多32个子进程 |
| **交互式会话** | `claude --rc` | 启动交互式远程会话 | 单会话 |
| **现有会话** | `/remote-control` (在会话内) | 控制已存在的会话 | 继承会话限制 |

### 2.2 Server模式架构

Server模式是功能最完整的远程控制实现：
- 启动后创建**最多32个子进程**
- 每个子进程通过 `--sdk-url` 参数连接主进程
- 连接端点：`worker/events/stream`
- 支持多路并发会话管理

**典型启动命令**
```bash
claude --print --sdk-url <url> --session-id <id> \
  --input-format stream-json --output-format stream-json \
  --replay-user-messages
```

### 2.3 协议版本分析

**CCR v1（原始协议）**
- 传输层：原始 WebSocket
- 消息格式：NDJSON（逐行JSON）
- 特点：低延迟，简单直接

**CCR v2（新版协议）**
- 传输层：HTTPS + SSE（Server-Sent Events）
- 消息格式：Envelope包装
- 切换方式：环境变量 `CLAUDE_CODE_USE_CCR_V2=1`
- 优势：更好的穿透性，兼容HTTP代理

---

## 3. 工具调用（Tools）机制

### 3.1 权限请求流程

当执行需要用户授权的操作时（如Bash命令、文件读写）：

**客户端发送**
```json
{
  "subtype": "can_use_tool",
  "tool": "Bash",
  "command": "ls -la"
}
```

**服务端响应**
```json
{
  "type": "control_response",
  "action": "allow" | "deny"
}
```

### 3.2 权限绕过模式

当 `mode: 'bypassPermissions'` 激活时：
- 所有工具调用直接执行
- 不生成 `control_request` 请求
- 适用于自动化脚本和高信任环境

### 3.3 支持的工具类型

基于协议分析，主要工具类型包括：
- `Bash` - 执行Shell命令
- `Read` - 读取文件
- `Write` / `Edit` - 写入或编辑文件
- `Glob` - 文件模式匹配
- `Grep` - 文本搜索
- `WebFetch` - 访问URL内容
- 各类MCP工具

---

## 4. 会话管理机制

### 4.1 上下文维护

- 每个会话由唯一 `session-id` 标识
- 上下文通过WebSocket/SSE长连接维持
- 支持流式输入输出（`stream-json` 格式）
- 历史消息在连接生命周期内保留

### 4.2 多轮对话支持

- Server模式支持多客户端并发连接同一会话
- 通过 `--session-id` 实现会话粘性
- 消息重放功能：`--replay-user-messages` 用于调试

---

## 5. 安全分析

### 5.1 CVE-2025-52882 安全漏洞

**漏洞概述**
- 影响版本：0.2.116 - 1.0.23
- 修复版本：1.0.24（2025年6月23日发布）
- CVSS评分：8.8（High）

**漏洞根因**
- WebSocket服务器缺少Origin验证
- 接受来自任意Origin的连接请求
- 无认证令牌或域名白名单机制

**攻击链（DataDog Security Labs验证）**
1. 恶意网页检测本地localhost端口
2. 发现MCP服务器（默认端口6277）
3. 建立无认证WebSocket连接
4. 发送JSON-RPC命令读取文件/执行代码

### 5.2 传输层安全

| 传输类型 | 验证状态 | 说明 |
|----------|----------|------|
| ws://（明文WebSocket） | 无任何验证 | 可连接任意地址 |
| wss://（TLS WebSocket） | TLS验证（可禁用） | `NODE_TLS_REJECT_UNAUTHORIZED=0` |
| https://（CCR v2） | TLS验证 | 相对安全 |

### 5.3 安全建议

1. **必须升级**：使用Claude Code >= 1.0.24
2. **网络隔离**：避免在公共网络暴露远程控制端口
3. **环境变量**：生产环境勿设置 `NODE_TLS_REJECT_UNAUTHORIZED=0`
4. **防火墙**：限制WebSocket连接来源

---

## 6. 第三方开源实现现状

### 6.1 已知第三方项目

| 项目 | 状态 | 方式 | 风险 |
|------|------|------|------|
| jsdvjx/claude-remote-protocol | 存档/维护停滞 | 浏览器凭证提取 | 高（cf_clearance过期问题） |

### 6.2 浏览器凭证提取方式（已过时/不推荐）

部分第三方实现尝试从浏览器DevTools提取：
- `organizationUuid` - 组织标识
- `sessionKey` - 会话密钥（sk-ant-sid02-前缀）
- `cfClearance` - Cloudflare验证cookie
- `userAgent` - 浏览器User-Agent字符串

**问题**：
- `cf_clearance` 会过期，需要周期性人工介入
- 违反Claude服务条款
- 长期自动化运行不可行

### 6.3 官方立场

截至调研时，Claude Code 官方：
- 未提供正式的远程API暴露方案
- `--sdk-url` 参数标记为内部实现
- 官方文档未记录远程控制协议细节

---

## 7. 替代方案

### 7.1 官方Agent SDK

Anthropic提供官方Agent SDK，支持：
- 标准HTTP API调用
- 工具调用能力
- 会话管理
- **推荐用于生产集成**

### 7.2 MCP（Model Context Protocol）

- Claude Code原生支持MCP
- 可通过MCP工具扩展能力
- 适合需要外部工具集成的场景

### 7.3 自建工作流

```
┌─────────────┐     MCP      ┌─────────────┐
│ Claude Code │ ◄───────────► │ 自建服务    │
│ (本地CLI)   │              │ (API暴露)   │
└─────────────┘              └─────────────┘
```

通过本地MCP服务器中转，间接实现远程控制能力。

### 7.4 方案选型建议

| 场景 | 推荐方案 |
|------|----------|
| 快速集成 | Agent SDK |
| 需要文件/终端操作 | Claude Code CLI + MCP中转 |
| 生产级稳定API | Agent SDK |
| 实验性/研究 | --sdk-url（风险自担） |

---

## 8. API Key 安全存储方案

### 8.1 官方最佳实践

1. **环境变量**
   ```bash
   export ANTHROPIC_API_KEY="sk-ant-..."
   ```

2. **配置文件**
   - 存储在 `~/.claude/`
   - 不要提交到Git

3. **密钥轮换**
   - 定期更换API Key
   - 监控使用量异常

### 8.2 企业级方案

| 方案 | 适用场景 | 实现难度 |
|------|----------|----------|
| HashiCorp Vault | 大规模KMS | 高 |
| AWS Secrets Manager | AWS环境 | 中 |
| Azure Key Vault | Azure环境 | 中 |
| 本地 .env 文件 | 个人/小规模 | 低 |

### 8.3 安全检查清单

- [ ] API Key不写入代码仓库
- [ ] API Key不出现在日志中
- [ ] 最小权限原则（Scope限制）
- [ ] 启用使用量告警
- [ ] 定期审计访问日志

---

## 9. 推荐结论

### 9.1 远程控制能力总结

| 能力 | 支持状态 | 备注 |
|------|----------|------|
| Server模式 | 支持（未文档化） | 最完整实现 |
| 多会话并发 | 支持（最多32个） | 适合批量任务 |
| WebSocket通信 | 支持 | CCR v1 |
| HTTPS/SSE通信 | 支持 | CCR v2 |
| 工具调用远程化 | 支持 | control_request机制 |
| 官方API | 不支持 | 无官方远程API |

### 9.2 使用建议

1. **学习研究**：可使用 `--sdk-url` 研究协议（注意版本安全）
2. **生产集成**：使用官方Agent SDK而非远程控制协议
3. **自动化场景**：MCP + 本地脚本组合
4. **避免**：使用第三方浏览器凭证提取方案（不稳定+违规）

### 9.3 架构决策树

```
需要远程调用Claude?
    │
    ├── 是 ──► 生产环境? ──► 是 ──► Agent SDK
    │                        │
    │                        └── 实验/研究 ──► MCP中转方案
    │
    └── 否 ──► 本地CLI使用即可
```

---

## 10. 风险与局限

1. **协议未文档化**：`--sdk-url` 为内部实现，随时可能变更
2. **安全漏洞历史**：pre-1.0.24版本存在严重漏洞，使用旧版本风险极高
3. **第三方方案不稳定**：依赖浏览器提取的实现不可用于生产
4. **官方态度不明**：Anthropic未明确表态是否会在未来支持远程API

---

## 11. 开放问题

1. Anthropic是否有官方远程API的路线图？
2. MCP协议是否能完全替代远程控制需求？
3. 企业场景下，如何实现审计日志和合规要求？
4. Claude Code的 `--sdk-url` 协议未来是否会正式文档化？
