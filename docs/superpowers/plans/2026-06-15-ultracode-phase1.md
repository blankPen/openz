# Ultracode Phase 1 实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**目标：** 构建本地直连的 CLI + Daemon + Web 控制台，实现对 Claude Code 会话的远程控制。

**架构：** Monorepo（pnpm workspace），`packages/cli/` 内嵌 Daemon 逻辑（Socket.IO 服务器 + Agent 会话管理），`packages/web/` 为单文件 HTML 控制台，`packages/shared/` 提供共享类型。

**技术栈：** Node.js 20+, TypeScript 5, Socket.IO 4, @anthropic-ai/claude-code, Zod 3

---

## 文件结构

```
/Users/pz/workspace/claude-code-assistant/
├── pnpm-workspace.yaml                          # [新建]
├── package.json                                 # [新建] 根 workspace
├── packages/
│   ├── shared/                                 # [新建]
│   │   ├── package.json                        # [新建]
│   │   └── src/
│   │       └── types.ts                        # [新建] Session, AgentEvent 等共享类型
│   ├── cli/                                    # [新建]
│   │   ├── package.json                        # [新建]
│   │   └── src/
│   │       ├── index.ts                        # [新建] CLI 入口
│   │       ├── types/
│   │       │   └── index.ts                    # [新建] CLI 内部类型
│   │       ├── daemon/
│   │       │   ├── types.ts                    # [新建] Daemon 内部类型
│   │       │   ├── session.ts                  # [新建] 会话管理（Map<id, AgentSession>）
│   │       │   └── server.ts                   # [新建] Socket.IO 服务器
│   │       └── agents/
│   │           ├── mod.ts                      # [新建] Agent 抽象接口
│   │           └── claude.ts                   # [新建] Claude Code Agent 实现
│   └── web/                                    # [新建]
│       ├── package.json                        # [新建]
│       └── src/
│           └── index.html                      # [新建] 单文件 Web 控制台
└── docs/
    └── superpowers/
        └── specs/
            └── ultracode-phase1-design.md      # [已存在]
```

---

## Task 1: 初始化 Monorepo 结构

**Files:**
- Create: `pnpm-workspace.yaml`
- Create: `package.json`（根 workspace）
- Create: `packages/shared/package.json`
- Create: `packages/shared/src/types.ts`
- Create: `packages/cli/package.json`
- Create: `packages/cli/src/index.ts`（最小 stub）
- Create: `packages/cli/src/types/index.ts`（最小 stub）
- Create: `packages/cli/src/daemon/types.ts`（最小 stub）
- Create: `packages/cli/src/daemon/session.ts`（最小 stub）
- Create: `packages/cli/src/daemon/server.ts`（最小 stub）
- Create: `packages/cli/src/agents/mod.ts`（最小 stub）
- Create: `packages/cli/src/agents/claude.ts`（最小 stub）
- Create: `packages/web/package.json`
- Create: `packages/web/src/index.html`

---

- [ ] **Step 1: 创建 pnpm-workspace.yaml**

```yaml
packages:
  - 'packages/*'
```

文件：`/Users/pz/workspace/claude-code-assistant/pnpm-workspace.yaml`

---

- [ ] **Step 2: 创建根 package.json**

```json
{
  "name": "ultracode",
  "private": true,
  "version": "0.1.0",
  "engines": {
    "node": ">=20"
  },
  "scripts": {
    "dev": "pnpm -r run dev",
    "build": "pnpm -r run build"
  }
}
```

文件：`/Users/pz/workspace/claude-code-assistant/package.json`

---

- [ ] **Step 3: 创建 shared/package.json**

```json
{
  "name": "@ultracode/shared",
  "version": "0.1.0",
  "main": "src/types.ts",
  "types": "src/types.ts"
}
```

文件：`/Users/pz/workspace/claude-code-assistant/packages/shared/package.json`

---

- [ ] **Step 4: 创建 shared/src/types.ts**

```typescript
// Session 类型
export interface Session {
  id: string;
  engine: 'claude' | string;
  cwd: string;
  model?: string;
  status: 'idle' | 'running' | 'interrupted' | 'done';
  createdAt: number;
}

// AgentEvent 类型
export type AgentEvent =
  | { type: 'session_init'; sessionId: string; data: any }
  | { type: 'text_delta'; sessionId: string; data: { text: string } }
  | { type: 'thinking_delta'; sessionId: string; data: { text: string } }
  | { type: 'tool_use_start'; sessionId: string; data: any }
  | { type: 'tool_use_input_delta'; sessionId: string; data: any }
  | { type: 'assistant_complete'; sessionId: string; data: any }
  | { type: 'tool_result'; sessionId: string; data: any }
  | { type: 'turn_done'; sessionId: string; data: any }
  | { type: 'error'; sessionId: string; data: { error: string } };

// Socket.IO 请求类型
export interface CreateSessionRequest {
  id?: string;
  cwd?: string;
  model?: string;
}

export interface SendMessageRequest {
  sessionId: string;
  message: string;
}

export interface SessionRequest {
  sessionId: string;
}

// Socket.IO 响应类型
export interface SessionCreatedResponse {
  session: Session;
}

export interface SessionListResponse {
  sessions: Session[];
}

export interface SessionErrorResponse {
  sessionId: string;
  error: string;
}

export interface SessionEventResponse {
  sessionId: string;
  event: AgentEvent;
}
```

文件：`/Users/pz/workspace/claude-code-assistant/packages/shared/src/types.ts`

---

- [ ] **Step 5: 创建 packages/cli/package.json**

```json
{
  "name": "@ultracode/cli",
  "version": "0.1.0",
  "type": "module",
  "main": "src/index.ts",
  "scripts": {
    "dev": "tsx watch src/index.ts",
    "build": "tsc",
    "start": "node dist/index.js"
  },
  "dependencies": {
    "@anthropic-ai/claude-code": "^1.0.0",
    "socket.io": "^4.7.5",
    "socket.io-client": "^4.7.5",
    "zod": "^3.23.8"
  },
  "devDependencies": {
    "@types/node": "^20.0.0",
    "tsx": "^4.19.0",
    "typescript": "^5.6.0"
  }
}
```

文件：`/Users/pz/workspace/claude-code-assistant/packages/cli/package.json`

---

- [ ] **Step 6: 创建 packages/cli/tsconfig.json**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "outDir": "dist",
    "rootDir": "src",
    "declaration": true
  },
  "include": ["src/**/*"]
}
```

文件：`/Users/pz/workspace/claude-code-assistant/packages/cli/tsconfig.json`

---

- [ ] **Step 7: 创建 packages/cli/src/index.ts（最小 stub）**

```typescript
#!/usr/bin/env node

import { parseArgs } from 'parse_args';

async function main() {
  const { args } = parseArgs({
    options: {
      help: { type: 'boolean', default: false },
    },
  });

  const [command, ...subArgs] = args;

  if (!command || args.includes('--help')) {
    console.log(`
Ultracode CLI

Commands:
  daemon start     Start the daemon
  daemon stop      Stop the daemon
  daemon status    Check daemon status
  sessions list    List all sessions
  sessions delete <id>  Delete a session
    `.trim());
    process.exit(0);
  }

  if (command === 'daemon') {
    const action = subArgs[0];
    if (action === 'start') {
      const { startDaemon } = await import('./daemon/server.js');
      await startDaemon();
    } else if (action === 'stop') {
      console.log('Stopping daemon...');
    } else if (action === 'status') {
      console.log('Daemon status');
    }
  } else if (command === 'sessions') {
    console.log('Sessions command');
  }
}

main().catch(console.error);
```

文件：`/Users/pz/workspace/claude-code-assistant/packages/cli/src/index.ts`

---

- [ ] **Step 8: 创建 packages/cli/src/types/index.ts（最小 stub）**

```typescript
// CLI 内部类型占位
export type CLICommand = 'daemon' | 'sessions';
```

文件：`/Users/pz/workspace/claude-code-assistant/packages/cli/src/types/index.ts`

---

- [ ] **Step 9: 创建 packages/cli/src/daemon/types.ts（最小 stub）**

```typescript
// Daemon 内部类型占位
export interface DaemonState {
  pid: number;
  port: number;
  startedAt: number;
}
```

文件：`/Users/pz/workspace/claude-code-assistant/packages/cli/src/daemon/types.ts`

---

- [ ] **Step 10: 创建 packages/cli/src/daemon/session.ts（最小 stub）**

```typescript
// 会话管理占位
export class SessionManager {
  private sessions = new Map<string, any>();
}
```

文件：`/Users/pz/workspace/claude-code-assistant/packages/cli/src/daemon/session.ts`

---

- [ ] **Step 11: 创建 packages/cli/src/daemon/server.ts（最小 stub）**

```typescript
import { Server } from 'socket.io';
import { createServer } from 'http';

export async function startDaemon(port = 19999) {
  const httpServer = createServer();
  const io = new Server(httpServer);

  httpServer.listen(port, () => {
    console.log(`Ultracode daemon listening on port ${port}`);
  });
}
```

文件：`/Users/pz/workspace/claude-code-assistant/packages/cli/src/daemon/server.ts`

---

- [ ] **Step 12: 创建 packages/cli/src/agents/mod.ts（最小 stub）**

```typescript
import type { AgentEvent } from '@ultracode/shared';

export interface AgentSession {
  id: string;
  status: 'idle' | 'running' | 'interrupted' | 'done';
  interrupt(): void;
  stop(): void;
}

export interface Agent {
  name: string;
  createSession(options: {
    id: string;
    cwd: string;
    model?: string;
    onEvent: (event: AgentEvent) => void;
  }): Promise<AgentSession>;
  sendMessage(sessionId: string, message: string): Promise<void>;
}
```

文件：`/Users/pz/workspace/claude-code-assistant/packages/cli/src/agents/mod.ts`

---

- [ ] **Step 13: 创建 packages/cli/src/agents/claude.ts（最小 stub）**

```typescript
import type { Agent, AgentSession } from './mod.js';
import type { AgentEvent } from '@ultracode/shared';

export class ClaudeAgent implements Agent {
  name = 'claude';

  async createSession(options: {
    id: string;
    cwd: string;
    model?: string;
    onEvent: (event: AgentEvent) => void;
  }): Promise<AgentSession> {
    throw new Error('Not implemented');
  }

  async sendMessage(sessionId: string, message: string): Promise<void> {
    throw new Error('Not implemented');
  }
}
```

文件：`/Users/pz/workspace/claude-code-assistant/packages/cli/src/agents/claude.ts`

---

- [ ] **Step 14: 创建 packages/web/package.json**

```json
{
  "name": "@ultracode/web",
  "version": "0.1.0",
  "private": true
}
```

文件：`/Users/pz/workspace/claude-code-assistant/packages/web/package.json`

---

- [ ] **Step 15: 创建 packages/web/src/index.html（最小 stub）**

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Ultracode</title>
</head>
<body>
  <h1>Ultracode Web Console</h1>
  <script src="https://cdn.socket.io/4.7.5/socket.io.min.js"></script>
  <script>
    const socket = io('http://localhost:19999');
    socket.on('connect', () => console.log('Connected'));
  </script>
</body>
</html>
```

文件：`/Users/pz/workspace/claude-code-assistant/packages/web/src/index.html`

---

- [ ] **Step 16: 初始化项目，安装依赖**

```bash
cd /Users/pz/workspace/claude-code-assistant
pnpm install
```

验证：
```bash
node packages/cli/src/index.ts --help
# 应输出帮助信息
```

---

## Task 2: 实现 SessionManager（会话管理）

**Files:**
- Modify: `packages/shared/src/types.ts`
- Modify: `packages/cli/src/daemon/session.ts`
- Modify: `packages/cli/src/daemon/types.ts`
- Create: `packages/cli/src/daemon/session.test.ts`

---

- [ ] **Step 1: 更新 shared/src/types.ts（补充 UUID 生成）**

```typescript
import { randomUUID } from 'crypto';

export function generateSessionId(): string {
  return randomUUID();
}
```

在文件末尾追加到 `types.ts`：
```typescript
export { randomUUID as generateSessionId } from 'crypto';
```

文件：`/Users/pz/workspace/claude-code-assistant/packages/shared/src/types.ts`

---

- [ ] **Step 2: 实现 daemon/types.ts（完整 DaemonState）**

```typescript
export interface DaemonState {
  pid: number;
  port: number;
  version: string;
  startedAt: number;
}

export const DEFAULT_PORT = 19999;

export function getDaemonStatePath(): string {
  const home = process.env.HOME || process.env.USERPROFILE || '';
  return `${home}/.ultracode/daemon.state.json`;
}
```

文件：`/Users/pz/workspace/claude-code-assistant/packages/cli/src/daemon/types.ts`

---

- [ ] **Step 3: 实现 daemon/session.ts（完整 SessionManager）**

```typescript
import type { Session } from '@ultracode/shared';
import { generateSessionId } from '@ultracode/shared';
import type { Agent, AgentSession } from '../agents/mod.js';

export class SessionManager {
  private sessions = new Map<string, { session: Session; agentSession: AgentSession }>();

  constructor(private agent: Agent) {}

  async createSession(options: {
    id?: string;
    engine?: string;
    cwd?: string;
    model?: string;
  }): Promise<Session> {
    const id = options.id || generateSessionId();
    const cwd = options.cwd || process.cwd();

    const session: Session = {
      id,
      engine: options.engine || 'claude',
      cwd,
      model: options.model,
      status: 'idle',
      createdAt: Date.now(),
    };

    const agentSession = await this.agent.createSession({
      id,
      cwd,
      model: options.model,
      onEvent: (event) => {
        // 事件由 caller 通过 watchSession 订阅
      },
    });

    this.sessions.set(id, { session, agentSession });
    return session;
  }

  getSession(id: string): Session | undefined {
    return this.sessions.get(id)?.session;
  }

  getAllSessions(): Session[] {
    return Array.from(this.sessions.values()).map(v => v.session);
  }

  updateSessionStatus(id: string, status: Session['status']) {
    const entry = this.sessions.get(id);
    if (entry) {
      entry.session.status = status;
    }
  }

  deleteSession(id: string) {
    const entry = this.sessions.get(id);
    if (entry) {
      entry.agentSession.stop();
      this.sessions.delete(id);
    }
  }

  async sendMessage(sessionId: string, message: string) {
    const entry = this.sessions.get(sessionId);
    if (!entry) throw new Error(`Session ${sessionId} not found`);
    await this.agent.sendMessage(sessionId, message);
  }

  interruptSession(sessionId: string) {
    const entry = this.sessions.get(sessionId);
    if (entry) {
      entry.agentSession.interrupt();
    }
  }

  stopSession(sessionId: string) {
    const entry = this.sessions.get(sessionId);
    if (entry) {
      entry.agentSession.stop();
      entry.session.status = 'done';
    }
  }
}
```

文件：`/Users/pz/workspace/claude-code-assistant/packages/cli/src/daemon/session.ts`

---

- [ ] **Step 4: 编写 SessionManager 测试**

```typescript
import { describe, it, expect, vi } from 'vitest';
import { SessionManager } from './session.js';
import type { Agent, AgentSession } from '../agents/mod.js';
import type { AgentEvent } from '@ultracode/shared';

describe('SessionManager', () => {
  it('creates a session with generated id', async () => {
    const mockAgent: Agent = {
      name: 'test',
      createSession: vi.fn().mockResolvedValue({
        id: 'test-id',
        status: 'idle',
        interrupt: vi.fn(),
        stop: vi.fn(),
      } as AgentSession),
      sendMessage: vi.fn(),
    };

    const manager = new SessionManager(mockAgent);
    const session = await manager.createSession({ cwd: '/tmp' });

    expect(session.id).toBeDefined();
    expect(session.engine).toBe('claude');
    expect(session.cwd).toBe('/tmp');
    expect(session.status).toBe('idle');
  });

  it('returns all sessions', async () => {
    const mockAgent: Agent = {
      name: 'test',
      createSession: vi.fn().mockResolvedValue({
        id: 'test-id',
        status: 'idle',
        interrupt: vi.fn(),
        stop: vi.fn(),
      } as AgentSession),
      sendMessage: vi.fn(),
    };

    const manager = new SessionManager(mockAgent);
    await manager.createSession({ cwd: '/tmp' });
    await manager.createSession({ cwd: '/home' });

    const sessions = manager.getAllSessions();
    expect(sessions).toHaveLength(2);
  });

  it('deletes a session', async () => {
    const stopMock = vi.fn();
    const mockAgent: Agent = {
      name: 'test',
      createSession: vi.fn().mockResolvedValue({
        id: 'test-id',
        status: 'idle',
        interrupt: vi.fn(),
        stop: stopMock,
      } as AgentSession),
      sendMessage: vi.fn(),
    };

    const manager = new SessionManager(mockAgent);
    const session = await manager.createSession({ cwd: '/tmp' });
    manager.deleteSession(session.id);

    expect(manager.getAllSessions()).toHaveLength(0);
    expect(stopMock).toHaveBeenCalled();
  });
});
```

文件：`/Users/pz/workspace/claude-code-assistant/packages/cli/src/daemon/session.test.ts`

---

- [ ] **Step 5: 运行测试验证**

```bash
cd /Users/pz/workspace/claude-code-assistant/packages/cli
pnpm vitest run src/daemon/session.test.ts
```

预期：PASS

---

## Task 3: 实现 ClaudeAgent（Claude Code SDK 封装）

**Files:**
- Modify: `packages/cli/src/agents/claude.ts`
- Create: `packages/cli/src/agents/claude.test.ts`

---

- [ ] **Step 1: 实现 claude.ts（完整 ClaudeAgent）**

```typescript
import type { Agent, AgentSession } from './mod.js';
import type { AgentEvent } from '@ultracode/shared';
import { ClaudeCode, type ClaudeCodeMessage } from '@anthropic-ai/claude-code';
import { generateSessionId } from '@ultracode/shared';

interface ClaudeSession extends AgentSession {
  claudecode: ClaudeCode;
}

export class ClaudeAgent implements Agent {
  name = 'claude';
  private sessions = new Map<string, ClaudeSession>();

  async createSession(options: {
    id: string;
    cwd: string;
    model?: string;
    onEvent: (event: AgentEvent) => void;
  }): Promise<ClaudeSession> {
    const sessionId = options.id || generateSessionId();
    const onEvent = options.onEvent;

    const claudecode = new ClaudeCode({
      sessionId,
      cwd: options.cwd,
      model: options.model,
    });

    const session: ClaudeSession = {
      id: sessionId,
      status: 'idle',
      claudecode,
      interrupt: () => claudecode.interrupt(),
      stop: () => {
        claudecode.close();
        this.sessions.delete(sessionId);
      },
    };

    // 监听 Claude Code 事件并转发
    for await (const event of claudecode) {
      const agentEvent = this.mapEvent(sessionId, event);
      if (agentEvent) {
        onEvent(agentEvent);
      }
      if (event.type === 'assistant_complete' || event.type === 'error') {
        session.status = 'done';
        break;
      }
    }

    this.sessions.set(sessionId, session);
    return session;
  }

  async sendMessage(sessionId: string, message: string): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (!session) throw new Error(`Session ${sessionId} not found`);

    session.status = 'running';
    const msg: ClaudeCodeMessage = { role: 'user', content: message };

    for await (const event of session.claudecode) {
      const agentEvent = this.mapEvent(sessionId, event);
      if (agentEvent) {
        // 这里通过 SDK 内部的事件流已经通知过了
        // sendMessage 是触发新一轮对话的入口
      }
    }
  }

  private mapEvent(sessionId: string, event: any): AgentEvent | null {
    switch (event.type) {
      case 'session_init':
        return { type: 'session_init', sessionId, data: event };
      case 'user':
        return null; // 我们自己发的消息不转发
      case 'assistant':
        return { type: 'text_delta', sessionId, data: { text: event.message?.content?.[0]?.text || '' } };
      case 'assistant_complete':
        return { type: 'assistant_complete', sessionId, data: event };
      case 'tool_use':
        return { type: 'tool_use_start', sessionId, data: event };
      case 'tool_result':
        return { type: 'tool_result', sessionId, data: event };
      case 'error':
        return { type: 'error', sessionId, data: { error: event.error } };
      default:
        return null;
    }
  }
}
```

文件：`/Users/pz/workspace/claude-code-assistant/packages/cli/src/agents/claude.ts`

---

- [ ] **Step 2: 创建 claude.ts 单元测试（mock SDK）**

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ClaudeAgent } from './claude.js';

describe('ClaudeAgent', () => {
  it('reports name as claude', () => {
    const agent = new ClaudeAgent();
    expect(agent.name).toBe('claude');
  });
});
```

文件：`/Users/pz/workspace/claude-code-assistant/packages/cli/src/agents/claude.test.ts`

---

## Task 4: 实现 Socket.IO 服务器（daemon/server.ts）

**Files:**
- Modify: `packages/cli/src/daemon/server.ts`
- Create: `packages/cli/src/daemon/server.test.ts`

---

- [ ] **Step 1: 实现完整 server.ts**

```typescript
import { Server as HTTPServer } from 'http';
import { Server as SocketIOServer, type Socket } from 'socket.io';
import { createServer } from 'http';
import { SessionManager } from './session.js';
import { ClaudeAgent } from '../agents/claude.js';
import type {
  CreateSessionRequest,
  SendMessageRequest,
  SessionRequest,
  SessionCreatedResponse,
  SessionListResponse,
  SessionEventResponse,
  SessionErrorResponse,
} from '@ultracode/shared';
import { DEFAULT_PORT, getDaemonStatePath, type DaemonState } from './types.js';
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';

function saveDaemonState(state: DaemonState) {
  const home = process.env.HOME || process.env.USERPROFILE || '';
  const dir = `${home}/.ultracode`;
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  writeFileSync(getDaemonStatePath(), JSON.stringify(state, null, 2));
}

function loadDaemonState(): DaemonState | null {
  try {
    const path = getDaemonStatePath();
    if (!existsSync(path)) return null;
    return JSON.parse(readFileSync(path, 'utf-8')) as DaemonState;
  } catch {
    return null;
  }
}

export async function startDaemon(port = DEFAULT_PORT) {
  const httpServer = createServer();
  const io = new SocketIOServer(httpServer, {
    cors: { origin: '*' },
  });

  const agent = new ClaudeAgent();
  const sessionManager = new SessionManager(agent);

  // 保存 daemon 状态
  const state: DaemonState = {
    pid: process.pid,
    port,
    version: '0.1.0',
    startedAt: Date.now(),
  };
  saveDaemonState(state);

  // Socket.IO 事件处理
  io.on('connection', (socket: Socket) => {
    console.log(`Client connected: ${socket.id}`);

    socket.on('session:create', async (req: CreateSessionRequest, ack) => {
      try {
        const session = await sessionManager.createSession({
          id: req.id,
          cwd: req.cwd,
          model: req.model,
        });
        const response: SessionCreatedResponse = { session };
        ack?.(response);
        socket.emit('session:created', response);
      } catch (err: any) {
        const response: SessionErrorResponse = { sessionId: req.id || '', error: err.message };
        ack?.({ error: err.message });
      }
    });

    socket.on('session:send', async (req: SendMessageRequest, ack) => {
      try {
        await sessionManager.sendMessage(req.sessionId, req.message);
        ack?.({ ok: true });
      } catch (err: any) {
        ack?.({ error: err.message });
      }
    });

    socket.on('session:interrupt', (req: SessionRequest, ack) => {
      sessionManager.interruptSession(req.sessionId);
      ack?.({ ok: true });
    });

    socket.on('session:stop', (req: SessionRequest, ack) => {
      sessionManager.stopSession(req.sessionId);
      ack?.({ ok: true });
    });

    socket.on('session:list', (_, ack) => {
      const sessions = sessionManager.getAllSessions();
      const response: SessionListResponse = { sessions };
      ack?.(response);
    });

    socket.on('session:delete', (req: SessionRequest, ack) => {
      sessionManager.deleteSession(req.sessionId);
      ack?.({ ok: true });
    });

    socket.on('disconnect', () => {
      console.log(`Client disconnected: ${socket.id}`);
    });
  });

  httpServer.listen(port, () => {
    console.log(`Ultracode daemon listening on http://localhost:${port}`);
  });

  // 优雅退出
  process.on('SIGINT', () => {
    console.log('\nShutting down...');
    io.close();
    httpServer.close();
    process.exit(0);
  });
}
```

文件：`/Users/pz/workspace/claude-code-assistant/packages/cli/src/daemon/server.ts`

---

## Task 5: 实现 CLI 入口（完整 index.ts）

**Files:**
- Modify: `packages/cli/src/index.ts`
- Create: `packages/cli/src/index.test.ts`

---

- [ ] **Step 1: 实现完整 CLI 入口**

```typescript
#!/usr/bin/env node

import { parseArgs } from 'parse_args';
import { startDaemon } from './daemon/server.js';
import { DEFAULT_PORT, getDaemonStatePath } from './daemon/types.js';
import { existsSync, readFileSync, writeFileSync } from 'fs';

function getStatus() {
  const path = getDaemonStatePath();
  if (!existsSync(path)) {
    console.log('Daemon is not running');
    return;
  }
  try {
    const state = JSON.parse(readFileSync(path, 'utf-8'));
    console.log(`Daemon is running (PID: ${state.pid}, Port: ${state.port}, Started: ${new Date(state.startedAt).toISOString()})`);
  } catch {
    console.log('Daemon is not running');
  }
}

async function stopDaemon() {
  const path = getDaemonStatePath();
  if (!existsSync(path)) {
    console.log('Daemon is not running');
    return;
  }
  try {
    const state = JSON.parse(readFileSync(path, 'utf-8'));
    process.kill(state.pid, 'SIGTERM');
    console.log('Daemon stopped');
  } catch (err: any) {
    console.log(`Failed to stop daemon: ${err.message}`);
  }
}

async function main() {
  const { values, positionals } = parseArgs({
    options: {
      port: { type: 'string', default: String(DEFAULT_PORT) },
      help: { type: 'boolean', default: false },
    },
  });

  const [command, ...subArgs] = positionals;

  if (values.help || !command) {
    console.log(`
Ultracode CLI v0.1.0

Usage:
  ultracode <command> [options]

Commands:
  daemon start [--port <port>]   Start the daemon (default port: ${DEFAULT_PORT})
  daemon stop                    Stop the daemon
  daemon status                  Check daemon status
  sessions list                  List all sessions
  sessions delete <id>           Delete a session

Examples:
  ultracode daemon start
  ultracode daemon start --port 19999
  ultracode daemon status
  ultracode sessions list
    `.trim());
    process.exit(0);
  }

  if (command === 'daemon') {
    const action = subArgs[0];
    if (action === 'start') {
      const port = parseInt(values.port as string, 10);
      await startDaemon(port);
    } else if (action === 'stop') {
      await stopDaemon();
    } else if (action === 'status') {
      getStatus();
    } else {
      console.log(`Unknown daemon action: ${action}`);
      process.exit(1);
    }
  } else if (command === 'sessions') {
    const action = subArgs[0];
    if (action === 'list') {
      // TODO: 通过 HTTP API 获取会话列表
      console.log('Sessions list (via HTTP API)');
    } else if (action === 'delete' && subArgs[1]) {
      // TODO: 通过 HTTP API 删除会话
      console.log(`Delete session: ${subArgs[1]}`);
    }
  } else {
    console.log(`Unknown command: ${command}`);
    process.exit(1);
  }
}

main().catch(console.error);
```

文件：`/Users/pz/workspace/claude-code-assistant/packages/cli/src/index.ts`

---

## Task 6: 实现 Web 控制台（完整 index.html）

**Files:**
- Modify: `packages/web/src/index.html`

---

- [ ] **Step 1: 实现完整 Web 控制台**

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Ultracode Console</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #0f0f0f; color: #e0e0e0; height: 100vh; display: flex; flex-direction: column; }
    header { background: #1a1a1a; padding: 12px 20px; border-bottom: 1px solid #333; display: flex; align-items: center; gap: 16px; }
    header h1 { font-size: 16px; font-weight: 600; }
    .status { font-size: 12px; color: #888; }
    .status.connected { color: #4caf50; }
    .status.disconnected { color: #f44336; }
    main { flex: 1; display: flex; overflow: hidden; }
    .sidebar { width: 260px; background: #1a1a1a; border-right: 1px solid #333; display: flex; flex-direction: column; }
    .sidebar-header { padding: 12px 16px; font-size: 12px; font-weight: 600; color: #888; text-transform: uppercase; display: flex; justify-content: space-between; align-items: center; }
    .new-session-btn { background: #2563eb; color: white; border: none; padding: 6px 12px; border-radius: 4px; font-size: 12px; cursor: pointer; }
    .new-session-btn:hover { background: #1d4ed8; }
    .sessions-list { flex: 1; overflow-y: auto; }
    .session-item { padding: 10px 16px; border-bottom: 1px solid #252525; cursor: pointer; display: flex; flex-direction: column; gap: 4px; }
    .session-item:hover { background: #252525; }
    .session-item.active { background: #1e3a5f; }
    .session-item .engine { font-size: 11px; color: #888; }
    .session-item .cwd { font-size: 11px; color: #666; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .chat-area { flex: 1; display: flex; flex-direction: column; }
    .messages { flex: 1; overflow-y: auto; padding: 20px; display: flex; flex-direction: column; gap: 16px; }
    .message { max-width: 80%; padding: 10px 14px; border-radius: 8px; line-height: 1.5; }
    .message.user { align-self: flex-end; background: #2563eb; color: white; }
    .message.agent { align-self: flex-start; background: #252525; }
    .message.thinking { color: #888; font-style: italic; }
    .tool-use { background: #1a1a2e; border-left: 3px solid #2563eb; padding: 8px 12px; border-radius: 4px; font-size: 13px; }
    .input-area { padding: 16px 20px; background: #1a1a1a; border-top: 1px solid #333; display: flex; gap: 12px; }
    .input-area textarea { flex: 1; background: #252525; border: 1px solid #333; border-radius: 8px; padding: 10px 14px; color: #e0e0e0; font-size: 14px; resize: none; min-height: 44px; max-height: 120px; font-family: inherit; }
    .input-area textarea:focus { outline: none; border-color: #2563eb; }
    .input-area button { background: #2563eb; color: white; border: none; padding: 10px 20px; border-radius: 8px; font-size: 14px; cursor: pointer; }
    .input-area button:hover { background: #1d4ed8; }
    .input-area button:disabled { background: #333; cursor: not-allowed; }
    .toolbar { padding: 8px 20px; background: #1a1a1a; border-top: 1px solid #333; display: flex; gap: 8px; }
    .toolbar button { background: #333; color: #e0e0e0; border: none; padding: 6px 12px; border-radius: 4px; font-size: 12px; cursor: pointer; }
    .toolbar button:hover { background: #444; }
    .toolbar button.danger { background: #7f1d1d; }
    .toolbar button.danger:hover { background: #991b1b; }
    .empty-state { flex: 1; display: flex; align-items: center; justify-content: center; color: #666; }
  </style>
</head>
<body>
  <header>
    <h1>Ultracode</h1>
    <span id="status" class="status disconnected">Disconnected</span>
  </header>
  <main>
    <aside class="sidebar">
      <div class="sidebar-header">
        <span>Sessions</span>
        <button class="new-session-btn" id="newSessionBtn">+ New</button>
      </div>
      <div class="sessions-list" id="sessionsList"></div>
    </aside>
    <section class="chat-area">
      <div class="messages" id="messages"></div>
      <div class="toolbar" id="toolbar" style="display:none">
        <button id="interruptBtn">Interrupt</button>
        <button id="stopBtn" class="danger">Stop</button>
      </div>
      <div class="input-area">
        <textarea id="input" placeholder="Send a message..." rows="1"></textarea>
        <button id="sendBtn">Send</button>
      </div>
    </section>
  </main>

  <script src="https://cdn.socket.io/4.7.5/socket.io.min.js"></script>
  <script>
    const socket = io('http://localhost:19999');
    let currentSessionId = null;
    const sessions = new Map();

    const statusEl = document.getElementById('status');
    const messagesEl = document.getElementById('messages');
    const sessionsListEl = document.getElementById('sessionsList');
    const inputEl = document.getElementById('input');
    const sendBtn = document.getElementById('sendBtn');
    const toolbarEl = document.getElementById('toolbar');
    const newSessionBtn = document.getElementById('newSessionBtn');
    const interruptBtn = document.getElementById('interruptBtn');
    const stopBtn = document.getElementById('stopBtn');

    socket.on('connect', () => {
      statusEl.textContent = 'Connected';
      statusEl.className = 'status connected';
      refreshSessions();
    });

    socket.on('disconnect', () => {
      statusEl.textContent = 'Disconnected';
      statusEl.className = 'status disconnected';
    });

    socket.on('session:event', (data) => {
      const { sessionId, event } = data;
      if (sessionId !== currentSessionId) return;
      renderEvent(event);
    });

    socket.on('session:created', (data) => {
      refreshSessions();
      selectSession(data.session.id);
    });

    async function refreshSessions() {
      socket.emit('session:list', {}, (res) => {
        if (res.error) { console.error(res.error); return; }
        sessionsListEl.innerHTML = '';
        res.sessions.forEach(session => {
          sessions.set(session.id, session);
          const el = document.createElement('div');
          el.className = 'session-item' + (session.id === currentSessionId ? ' active' : '');
          el.innerHTML = `<span>${session.id.slice(0, 8)}...</span><span class="engine">${session.engine}</span><span class="cwd">${session.cwd}</span>`;
          el.onclick = () => selectSession(session.id);
          sessionsListEl.appendChild(el);
        });
      });
    }

    function selectSession(id) {
      currentSessionId = id;
      messagesEl.innerHTML = '';
      toolbarEl.style.display = 'flex';
      refreshSessions();
    }

    function renderEvent(event) {
      const div = document.createElement('div');
      switch (event.type) {
        case 'text_delta':
          div.className = 'message agent';
          div.textContent = event.data.text;
          messagesEl.appendChild(div);
          break;
        case 'thinking_delta':
          div.className = 'message thinking';
          div.textContent = event.data.text;
          messagesEl.appendChild(div);
          break;
        case 'tool_use_start':
          div.className = 'tool-use';
          div.textContent = `Tool: ${event.data.name || event.data.tool}`;
          messagesEl.appendChild(div);
          break;
        case 'assistant_complete':
          sendBtn.disabled = false;
          break;
        case 'error':
          div.className = 'message agent';
          div.style.color = '#f44336';
          div.textContent = `Error: ${event.data.error}`;
          messagesEl.appendChild(div);
          break;
      }
      messagesEl.scrollTop = messagesEl.scrollHeight;
    }

    newSessionBtn.onclick = () => {
      socket.emit('session:create', { cwd: process.cwd?.() || '/tmp' }, (res) => {
        if (res.error) { console.error(res.error); return; }
        selectSession(res.session.id);
      });
    };

    sendBtn.onclick = () => {
      const message = inputEl.value.trim();
      if (!message || !currentSessionId) return;
      sendBtn.disabled = true;

      const userMsg = document.createElement('div');
      userMsg.className = 'message user';
      userMsg.textContent = message;
      messagesEl.appendChild(userMsg);
      inputEl.value = '';

      socket.emit('session:send', { sessionId: currentSessionId, message }, (res) => {
        if (res.error) { console.error(res.error); sendBtn.disabled = false; }
      });
    };

    interruptBtn.onclick = () => {
      if (!currentSessionId) return;
      socket.emit('session:interrupt', { sessionId: currentSessionId }, () => {});
    };

    stopBtn.onclick = () => {
      if (!currentSessionId) return;
      socket.emit('session:stop', { sessionId: currentSessionId }, () => {
        toolbarEl.style.display = 'none';
        currentSessionId = null;
        refreshSessions();
      });
    };

    inputEl.onkeydown = (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        sendBtn.click();
      }
    };

    // 初始刷新
    socket.on('connect', refreshSessions);
  </script>
</body>
</html>
```

文件：`/Users/pz/workspace/claude-code-assistant/packages/web/src/index.html`

---

## Task 7: 端到端验证

- [ ] **Step 1: 启动 Daemon**

```bash
cd /Users/pz/workspace/claude-code-assistant/packages/cli
pnpm dev daemon start
```

预期：输出 `Ultracode daemon listening on http://localhost:19999`

---

- [ ] **Step 2: 打开 Web 控制台**

直接在浏览器打开：
```
file:///Users/pz/workspace/claude-code-assistant/packages/web/src/index.html
```

或者用 http-server/serve 提供服务：
```bash
npx serve packages/web/src
```

预期：页面加载，显示 "Connected"

---

- [ ] **Step 3: 创建会话并对话**

1. 点击 "+ New" 创建会话
2. 在输入框输入消息
3. 点击 "Send"
4. 预期：收到 Claude Code 的流式响应

---

## 验收清单

- [ ] `pnpm install` 成功
- [ ] `ultracode daemon start` 启动成功
- [ ] Web 控制台连接到 daemon
- [ ] 能创建会话
- [ ] 能发送消息并接收流式响应
- [ ] Interrupt 和 Stop 功能正常
- [ ] 多会话并发正常
- [ ] Windows + macOS 均能运行
