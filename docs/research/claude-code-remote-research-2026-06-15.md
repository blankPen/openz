# Claude Code 远程控制能力调研报告

> 调研日期：2026-06-15
> 调研人：Claude Code Assistant

## ⚠️ 重要声明

> 以下内容基于 Claude Code 公开文档和已知的 CLI 架构。由于 Claude Code 并非完全开源（核心实现未公开），部分技术细节基于公开信息推断，**建议通过实际测试验证**。

---

## 一、Claude Code 架构概述

### 1.1 基本架构

Claude Code 是一个运行在本地的 CLI 应用，核心是一个 Node.js 应用：

```
用户终端 (Terminal)
    ↓ stdin/stdout 交互
Claude Code CLI
    ↓ HTTPS
Claude API (api.anthropic.com)
```

### 1.2 运行模式

Claude Code 支持多种运行模式：

| 模式 | 命令 | 说明 |
|-----|-----|-----|
| 交互模式 | `claude` | 启动REPL循环，stdin/stdout交互 |
| 单次命令 | `claude -p "指令"` | 执行单次指令 |
| 文件模式 | `claude -p @file.txt` | 从文件读取指令 |
| API模式 | `claude --print` | 类似-p但输出格式不同 |

---

## 二、Claude Code 的 API 接口机制

### 2.1 现有接口方式

**结论：Claude Code 没有原生HTTP/WebSocket API。**

Claude Code 设计与外界交互的方式：

#### 方式1：stdin/stdout（PIPE模式）

```bash
# 启动Claude Code，发送指令，捕获输出
echo "帮我写一个hello world" | claude --print
```

这是目前唯一的"API"方式，本质是进程间通信。

#### 方式2：环境变量配置

```bash
ANTHROPIC_API_KEY=sk-xxx claude -p "指令"
```

通过环境变量传入认证信息。

### 2.2 能否暴露为HTTP服务？

**理论上可行，但需要自己封装。** 思路：

```python
# 伪代码：自己封装的HTTP服务
from flask import Flask
import subprocess

app = Flask(__name__)

@app.route('/chat', methods=['POST'])
def chat():
    message = request.json['message']
    result = subprocess.run(
        ['claude', '-p', message],
        capture_output=True,
        text=True,
        env={'ANTHROPIC_API_KEY': os.getenv('ANTHROPIC_API_KEY')}
    )
    return {'response': result.stdout}
```

**但存在以下问题**：
1. 每次请求都启动新进程，效率低
2. 多轮对话的上下文无法在进程间保持
3. 工具调用（Bash命令）的结果无法正确处理

---

## 三、Claude Code 的工具调用（Tools）机制

### 3.1 支持的工具类型

Claude Code 支持的工具调用（基于公开文档）：

| 工具 | 功能 | Claude Code实现 |
|-----|-----|---------------|
| `Bash` | 执行shell命令 | 实际执行，返回结果 |
| `Read` | 读取文件 | 读取并返回内容 |
| `Write` | 写入文件 | 创建/覆盖文件 |
| `Edit` | 编辑文件 | diff格式编辑 |
| `Grep` | 搜索文件 | 内容搜索 |
| `Glob` | 文件匹配 | glob pattern |

### 3.2 工具调用的流程

当用户请求执行工具时，Claude Code：

1. **生成调用请求** → 发送到 Claude API
2. **API返回工具调用** → Claude Code解析指令
3. **本地执行工具** → 在本机shell中执行
4. **收集结果** → 将执行结果返回给API
5. **继续对话** → 将结果作为上下文继续

### 3.3 关键发现：工具执行在本机

**重要**：Claude Code 的工具（如 Bash 命令）是在本地执行的，这意味着：

```
移动端App → 网络 → Claude Code进程 → 执行命令在本地电脑
```

这个设计天然支持"远程控制"的概念——你不需要在手机上执行命令，而是在远程电脑上执行。

### 3.4 能否拦截/转发工具调用？

**可以，但需要修改或包装 Claude Code 的行为。**

可行的方案：
1. **包装脚本**：写一个封装，处理工具调用的输入输出
2. **MCP协议**：Claude Code 支持 MCP（Model Context Protocol），可能可以用来扩展
3. **直接API调用**：绕过 Claude Code，直接调 Claude API + 本地工具执行

---

## 四、会话管理

### 4.1 上下文维护

Claude Code 的多轮对话上下文通过以下方式维护：

1. **进程内内存**：单次运行中，上下文保持在进程内存中
2. **持久化会话**：通过 `--claude-code` 或类似参数保存会话状态
3. **.gitignore保护**：会话文件通常在 `.claude-code/` 目录

### 4.2 移动端场景的挑战

要让移动端继承/继续一个会话：

**方案A：共享会话文件**
- 桌面Claude Code和移动端共享同一个会话目录
- 通过网络文件系统（NFS/SMB）或Git同步

**方案B：会话导出/导入**
- 定期导出会话状态
- 移动端导入并继续

**方案C：独立移动端会话**
- 移动端使用独立的会话
- 不与桌面Claude Code共享上下文

---

## 五、是否有开源项目实现类似功能？

### 5.1 已知相关项目

1. **Claude CLI Wrapper项目**
   - 各种GitHub上的Claude CLI封装
   - 主要解决"如何从程序调用Claude"的问题
   - 典型项目：anthropic-quickstarts

2. **MCP (Model Context Protocol)**
   - Anthropic推出的工具扩展协议
   - Claude Code内置支持MCP
   - 可以用来扩展工具集

3. **类似的远程Agent项目**
   - OpenAI的Agent SDK
   - LangChain的Agent框架
   - 这些可以作为参考架构

### 5.2 能否直接集成？

**可以参考，但不能直接用。**

Claude Code 是一个专有的CLI工具，不是一个可嵌入的库。你需要：
1. 通过进程通信调用它
2. 解析它的输出
3. 包装成你想要的服务形态

---

## 六、替代方案分析

### 6.1 方案A：包装Claude Code进程（推荐）

```
┌─────────────────────────────────────────────┐
│              移动端App                        │
│  ┌─────────┐    WebSocket    ┌──────────┐ │
│  │ 语音输入 │ ──────────────→ │ 本地服务   │ │
│  └─────────┘                 │ (包装层)  │ │
│  ┌─────────┐    WebSocket    │          │ │
│  │ 语音输出 │ ←────────────── │ Claude   │ │
│  └─────────┘                 │ Code CLI │ │
└─────────────────────────────────────────────┘
```

**优点**：
- 保持Claude Code原汁原味的功能
- 利用现有的工具调用能力
- 开发量中等

**缺点**：
- Claude Code的输出格式可能变化
- 需要处理stdout解析

### 6.2 方案B：直接调Claude API + 自建工具执行

```
┌─────────────────────────────────────────────┐
│              移动端App                        │
│  ┌─────────┐    HTTPS    ┌──────────────┐ │
│  │ 语音输入 │ ───────────→ │ 远程服务      │ │
│  └─────────┘              │              │ │
│  ┌─────────┐    HTTPS     │ Claude API   │ │
│  │ 语音输出 │ ←─────────── │ + 工具执行器  │ │
│  └─────────┘              └──────────────┘ │
└─────────────────────────────────────────────┘
```

**优点**：
- 完全可控
- 不依赖Claude Code CLI
- 延迟更低（省去CLI开销）

**缺点**：
- 需要自己实现所有工具（Bash, Read, Write等）
- 开发量大
- 安全风险（命令注入）

### 6.3 方案C：混合方案（推荐起步）

```
┌──────────────────────────────────────────────────┐
│                    移动端App                        │
│  ┌────────┐   WebSocket   ┌─────────────────┐  │
│  │ 语音输入 │ ────────────→ │ Claude Code CLI │  │
│  └────────┘   (stdin)     │ + 自定义包装脚本 │  │
│  ┌────────┐   WebSocket   │                 │  │
│  │ 语音输出 │ ←──────────── │ (保持原工具)    │  │
│  └────────┘   (stdout)     └─────────────────┘  │
└──────────────────────────────────────────────────┘
```

**起步策略**：
1. 先用Python包装脚本，暴露HTTP接口
2. 移动端通过HTTP与包装脚本通信
3. 包装脚本内部调用Claude Code CLI
4. 后续按需优化

---

## 七、身份认证和API Key安全

### 7.1 Claude API Key存储

Claude Code 使用以下方式存储认证信息：

1. **环境变量**：`ANTHROPIC_API_KEY`
2. **配置文件**：`~/.claude/settings.json`（已加密？）
3. **Keychain**（部分平台）

### 7.2 移动端场景的安全建议

1. **API Key不上传到移动端**
   - API Key只存在于桌面电脑
   - 移动端不直接访问API

2. **通信加密**
   - WebSocket使用WSS
   - 考虑端到端加密

3. **设备认证**
   - 实现简单的设备配对机制
   - 避免未授权设备连接

---

## 八、关键待验证问题

> 以下问题需要实际测试验证：

1. **Claude Code是否支持持续运行的服务器模式？**
   - 还是只能处理单次请求然后退出？

2. **Claude Code的stdout输出格式是什么？**
   - JSON还是纯文本？
   - 是否有结构化的工具调用输出？

3. **MCP协议能否用来实现远程工具调用？**

4. **Claude Code是否有计划推出官方API/SDK？**

---

## 九、推荐行动

### 第一步：验证性测试（1-2天）

```bash
# 测试1：CLI基本调用
echo "1+1等于几" | claude -p "回答"

# 测试2：工具调用
claude -p "帮我创建一个test.txt文件，内容是hello"

# 测试3：多轮对话
claude -p "我叫张三" && claude -p "我叫什么名字"

# 测试4：查看CLI输出格式
claude -p "1+1" --verbose 2>&1 | head -50
```

### 第二步：架构原型（1周）

1. 编写Python包装脚本
2. 实现简单的HTTP/WebSocket接口
3. 测试基本的消息传递

### 第三步：功能完善

1. 处理工具调用的结果
2. 实现会话管理
3. 添加错误处理

---

## 附录：参考资源

1. Claude Code官方文档
2. Anthropic API文档
3. MCP协议：https://modelcontextprotocol.io
4. Claude CLI封装参考：各种GitHub项目

---

## 总结

**核心结论**：

1. Claude Code 没有原生HTTP API，但可以通过进程包装暴露
2. Claude Code 的工具调用在本地执行，适合远程控制场景
3. 建议方案：Python包装脚本 + WebSocket + 移动端App
4. 安全重点：API Key不上移动端，只在桌面端存储

**下一步**：建议先进行验证性测试，确认CLI的行为符合预期后再进行详细设计。
