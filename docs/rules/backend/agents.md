# Agent 实现规范

## Agent 接口

`packages/cli/src/agents/mod.ts` 定义了 Agent 抽象接口：

```typescript
interface Agent {
  name: string;
  createSession(options: {
    id: string;
    cwd: string;
    model?: string;
    onEvent: (event: AgentEvent) => void;
  }): Promise<AgentSession>;
  sendMessage(sessionId: string, message: string): Promise<void>;
}

interface AgentSession {
  id: string;
  status: 'idle' | 'running' | 'interrupted' | 'done';
  onEvent?: (event: AgentEvent) => void;
  interrupt(): void;
  stop(): void;
}
```

## ClaudeAgent 实现

`packages/cli/src/agents/claude.ts` 是基于 `@anthropic-ai/claude-agent-sdk` 的实现。

### 核心流程

```
sendMessage(sessionId, message)
  │
  ├─► emit 'message_start'
  ├─► emit 'session_init'
  │
  ├─► query({ prompt, options })
  │     │
  │     ├─► for await (msg of q)
  │     │     ├─► 'assistant' → emit text_delta / tool_use_start
  │     │     ├─► 'stream_event' → handle content_block_delta
  │     │     └─► 'result' → emit assistant_complete
  │     │
  │     └─► interrupt / stop
  │
  └─► emit 'error' on exception
```

### 事件映射

SDK 事件 → AgentEvent：

| SDK msg.type | AgentEvent.type | 说明 |
|-------------|-----------------|------|
| `assistant` (content: text) | `text_delta` | 文本输出 |
| `assistant` (content: tool_use) | `tool_use_start` + `tool_use_input_delta` | 工具调用 |
| `stream_event` (content_block_delta, thinking_delta) | `thinking_delta` | 思考内容 |
| `stream_event` (content_block_delta, text_delta) | `text_delta` | 文本增量 |
| `stream_event` (content_block_start, tool_use) | `tool_use_start` | 工具块开始 |
| `stream_event` (content_block_start, thinking) | `thinking_start` | 思考块开始 |
| `system` (subtype: init) | `session_init` | 初始化 |
| `result` (subtype: error_*) | `error` | 错误 |
| `result` | `assistant_complete` | 完成 |
| - | `raw_stream_event` | 原始事件透传 |

### 多会话管理

`ClaudeAgent` 内部维护 `Map<sessionId, ClaudeSession>`，支持多并发会话。

### interrupt / stop

- `interrupt()` 调用 `query.interrupt()` 中断当前迭代
- `stop()` 调用 `query.close()` 完全停止查询

## OptimizerAgent 实现

`.agents/optimizer/` 是 OpenZ Squad 自优化 Agent，通过 Multica API 分析项目健康度并生成报告。

### 核心模块

```
.agents/optimizer/
├── optimizer.js          # 主优化循环
└── tasks/
    ├── collect_issues.js  # Issue 数据采集
    ├── detect_anomalies.js # 三维异常检测
    └── config_version.js   # 配置版本管理
```

### 优化流程

```
runOptimizer()
  │
  ├─► fetchDailyIssueStats()      # 采集 Issue 统计数据
  │     └─► 分页获取所有 Issue，按状态/代理分组
  │
  ├─► detectAnomalies()            # 异常检测
  │     ├─► detectTaskAllocationAnomalies()   # 任务分配异常
  │     ├─► detectAutomationAnomalies()       # 自动化异常
  │     └─► detectCollaborationAnomalies()     # 协作异常
  │
  ├─► generateDailyReport()        # 生成日报
  │
  ├─► postDailyReport()            # 发布到 PZ-124
  │
  └─► processHighConfidenceAnomalies()  # 处理高置信度异常
```

### 异常检测维度

| 维度 | 类型 | 阈值 | 严重度 |
|------|------|------|--------|
| task_allocation | unassigned_issue | >24h 未分配 | 高/>72h, 中/>24h |
| task_allocation | blocked_not_escalated | >3天 阻塞未升级 | 高/>7d, 中/>3d |
| automation | creation_storm | >10个/天创建 | 高/>50, 中/>20, 低>10 |
| automation | unprocessed_automation_issue | >7天 未处理 | 高/>14d, 中/>7d |
| collaboration | no_interaction | >14天 无互动 | 高/>30d, 中/>14d |
| collaboration | completed_without_review | <2h 完成无 review | 高/<1h, 中/<2h |

### 配置常量

```javascript
const THRESHOLDS = {
  unassigned_hours: 24,        // 未分配 issue 超时（小时）
  blocked_escalate_days: 3,    // 阻塞 issue 升级超时（天）
  creation_storm_count: 10,   // Issue 创建风暴阈值
  automation_process_days: 7,  // 自动化 issue 处理超时（天）
  no_interaction_days: 14,     // 无互动超时（天）
  review_window_hours: 2      // 快速完成审查窗口（小时）
};

const HIGH_CONFIDENCE_THRESHOLD = 0.8;  // 高置信度阈值
```

### Multica API 集成

- **Project ID**: `53387db1-782e-4b07-a190-d96c7ea787bc`
- **Parent Issue**: `ed796dfb-ef61-4b0e-9d78-3e549874d17a` (PZ-124)
- 使用 `multica issue list` 分页获取 Issue
- 使用 `multica issue comment list` 获取评论进行审查检测
- 使用 `multica issue comment add` 发布日报和配置变更记录
