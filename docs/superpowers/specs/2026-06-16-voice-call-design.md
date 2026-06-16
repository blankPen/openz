# 语音通话功能设计

## 1. 背景与目标

为 Openz CLI 添加语音通话能力，实现类似豆包的实时可打断 AI 语音对话。

### 核心能力
- **连续语音对话**：用户持续说话，AI 实时理解并回复
- **可打断**：用户可随时打断 AI 的发言或生成过程
- **语音回复**：AI 回复以语音形式播报，而非文字

### 技术选型
- **STT（语音识别）**：火山引擎 ASR
- **TTS（语音合成）**：火山引擎 TTS（豆包同款）
- **AI 对话**：现有 Claude Agent SDK（daemon 现有能力）
- **语音处理位置**：TTS 放在 daemon 层（Node.js），客户端只接收音频流

---

## 2. 架构设计

### 2.1 整体架构

```
┌─────────────────────────────────────────────────────────┐
│                     客户端（浏览器 / App）                  │
│                                                          │
│  ┌──────────┐    ┌──────────┐    ┌──────────────────┐  │
│  │ 麦克风    │───→│ STT WebSocket │───→│  文字 → session:send │  │
│  │ 音频流   │    │ (实时识别)   │    │                   │  │
│  └──────────┘    └──────────┘    └────────┬───────────┘  │
│                                              │             │
│  ┌──────────┐    ┌──────────────────────────┐│             │
│  │ 扬声器    │←───│ Socket.IO audio stream ││             │
│  │ 音频播放  │    │ (daemon 推送音频帧)    ││             │
│  └──────────┘    └──────────────────────────┘│             │
│       ↑                                        │             │
│       │           ┌──────────────────┐         │             │
│       └───────────│ 打断控制器        │◀────────┘             │
│                   │ (中止播放/请求)    │                      │
│                   └──────────────────┘                      │
└─────────────────────────────────────────────────────────┘
                              │
                              │ Socket.IO
                              ▼
┌─────────────────────────────────────────────────────────┐
│                     Openz Daemon                          │
│                                                          │
│  ┌──────────────────────┐  ┌──────────────────────────┐ │
│  │  Claude Agent SDK     │  │  TTS Engine (Node.js ws)  │ │
│  │  query() → text       │→ │  文字边收边合成 → 音频帧   │ │
│  └──────────────────────┘  └──────────┬───────────────┘ │
│                                         │                  │
│  打断: session:interrupt → CancelSession(101)             │
└─────────────────────────────────────────────────────────┘
                              │
                              │ 流式音频帧
                              ▼
                      客户端接收播放
```

**为什么 TTS 放 daemon：**
- 火山引擎 V3 WebSocket API 需要自定义 HTTP headers（`X-Api-Key`）
- 浏览器原生 WebSocket 不支持自定义 headers
- Node.js `ws` 库支持自定义 headers，所以 TTS 必须在 daemon（Node.js 进程）运行

### 2.2 火山引擎 WebSocket API

火山引擎提供两个独立的 WebSocket 流：

**STT 流（语音 → 文字）：**
- 客户端持续发送麦克风音频流
- 服务端实时返回识别文字片段
- 支持**流式输出**，用户边说边看到识别结果

**TTS 流（文字 → 语音）：**
- 客户端发送文字
- 服务端流式返回音频帧
- 客户端实时播放，无需等待完整音频

### 2.3 通信协议

Socket.IO 新增事件：

| 事件名 | 方向 | 说明 |
|--------|------|------|
| `session:send` | client → server | 发送文字消息（现有） |
| `session:event` | server → client | AI 事件流（现有） |
| `session:interrupt` | client → server | 打断 AI 生成（现有） |
| `session:voice_reply` | client → server | 请求 AI 回复以语音播报（TTS） |
| `session:voice_audio` | server → client | 流式推送 TTS 音频帧（二进制） |
| `session:voice_interrupt` | server → client | TTS 被打断通知（前端停止播放） |

> **TTS 放在 daemon。** 客户端通过 `session:voice_reply` 请求语音回复，daemon 调火山引擎 TTS，将音频帧流式推送回客户端。客户端无需感知 TTS 存在，只需播放音频流。

---

## 3. 客户端实现

### 3.1 目录结构

```
packages/web/src/
├── hooks/
│   └── useAudioPlayer.ts         # [新建] Web Audio API 音频播放器（接收音频帧播放）
└── components/
    └── ChatView.tsx                # [修改] 集成语音回复开关 + 音频播放
```

> 注意：火山引擎 TTS 在 daemon 层（Node.js），前端只负责接收音频帧并播放，无需直接调用火山引擎 API。

### 3.2 核心状态机

```
                ┌────────────────────────────────────────┐
                │             IDLE                        │
                │  （未开始通话，显示麦克风按钮）             │
                └──────────────┬─────────────────────────┘
                               │ 点击开始
                               ▼
                ┌────────────────────────────────────────┐
                │        RECORDING                        │
                │  （正在录音，麦克风亮灯，识别文字显示）     │
                │                                          │
                │  ┌──────────────────────────────────┐   │
                │  │ STT WebSocket: 边录音边识别      │   │
                │  │ 识别结果实时追加到输入框          │   │
                │  └──────────────────────────────────┘   │
                │                                          │
                │  用户可随时：                            │
                │   - 点击"发送"→ 切换到 PROCESSING        │
                │   - 点击"打断"→ 切换到 INTERRUPTED      │
                │   - 点击"结束"→ 切换到 IDLE              │
                └──────────────┬──────────────────────────┘
                               │ 点击发送 / 自动标点触发
                               ▼
                ┌────────────────────────────────────────┐
                │        PROCESSING                       │
                │  （等待 AI 回复，显示思考动画）           │
                │                                          │
                │  ┌──────────────────────────────────┐   │
                │  │ session:send(识别文字)          │   │
                │  │ 监听 session:event              │   │
                │  │ 收到 text_delta → 累积回复文字  │   │
                │  └──────────────────────────────────┘   │
                │                                          │
                │  用户可随时：                            │
                │   - 点击"打断"→ 中止播放 + 中止生成     │
                └──────────────┬──────────────────────────┘
                               │ 收到 assistant_complete
                               ▼
                ┌────────────────────────────────────────┐
                │        SPEAKING                        │
                │  （AI 正在播报 TTS）                    │
                │                                          │
                │  ┌──────────────────────────────────┐   │
                │  │ TTS WebSocket: 文字 → 音频流   │   │
                │  │ 实时播放音频帧                   │   │
                │  │ 完整播完后 → 回到 RECORDING      │   │
                │  └──────────────────────────────────┘   │
                │                                          │
                │  用户可随时：                            │
                │   - 点击"打断"→ 中止 TTS，回到 RECORDING │
                │   - 点击"结束"→ 回到 IDLE                │
                └────────────────────────────────────────┘
```

### 3.3 打断实现

**打断 AI 生成（PROCESSING → RECORDING）：**
1. 调用 `session:interrupt` 事件，通知 daemon 中止当前请求
2. TTS 当前无播放，无需中止
3. 清空累积的 AI 回复文字
4. 重置 STT WebSocket（如需要）
5. 回到 RECORDING 状态

**打断 AI 播报（SPEAKING → RECORDING）：**
1. 立即关闭 TTS WebSocket（中止音频流）
2. 音频播放器的缓冲音频直接丢弃
3. 调用 `session:interrupt`（确保 daemon 侧也停止生成）
4. 清空 AI 回复文字
5. 回到 RECORDING 状态

### 3.4 火山引擎 TTS API 接入（V3 WebSocket 双向流式）

**接口**：WebSocket `wss://openspeech.bytedance.com/api/v3/tts/bidirection`

#### 鉴权（Request Headers）

| Key | 说明 | 必须 | 示例 |
|-----|------|------|------|
| `X-Api-Key` | 火山引擎控制台获取的 API Key | ✅ | `d098393c-32be-4b38-9814-c85da94dc6c6` |
| `X-Api-Resource-Id` | 资源 ID，决定模型版本和计费方式 | ✅ | `seed-tts-2.0`（豆包语音合成 2.0） |
| `X-Api-Connect-Id` | 连接追踪 ID，建议传递（每个 session 需唯一） | 可选 | `67ee89ba-7050-4c04-a3d7-ac61a63499b3` |

> `X-Api-Resource-Id` 可选值：`seed-tts-2.0`（2.0字符版）、`seed-tts-1.0`（1.0字符版）、`seed-icl-2.0`（声音复刻2.0）等

#### 二进制帧格式

协议为 4 字节 header + payload（大端序）：

```
Byte 0: [Protocol version (4bit)][Header size (4bit)]  → 固定 0x11
Byte 1: [Message type (8bit)][Flags (8bit)]
Byte 2: [Serialization (4bit)][Compression (4bit)]      → JSON=0x10, Raw=0x00
Byte 3: Reserved (0x00)
Bytes 4-7: Event number (int32) 或 session_id length
...
```

#### 消息类型

| Message type | 含义 | Flags |
|---|---|---|
| `0b0001` | Full-client request（上行） | `0b0100`（带 event number） |
| `0b1001` | Full-server response（下行） | `0b0100`（带 event number） |
| `0b1011` | Audio-only response | `0b0100` |
| `0b1111` | Error information | 无 flags |

#### Event 事件码

| Event | 名称 | 方向 | 说明 |
|-------|------|------|------|
| 1 | StartConnection | 上行 | 建立 WebSocket 连接 |
| 2 | FinishConnection | 上行 | 断开连接 |
| 50 | ConnectionStarted | 下行 | 建连成功 |
| 51 | ConnectionFailed | 下行 | 建连失败 |
| 100 | StartSession | 上行 | 开始会话 |
| 101 | CancelSession | 上行 | 取消会话（打断） |
| 102 | FinishSession | 上行 | 结束会话 |
| 150 | SessionStarted | 下行 | 会话开始成功 |
| 151 | SessionCanceled | 下行 | 会话已取消 |
| 152 | SessionFinished | 下行 | 会话结束 |
| 153 | SessionFailed | 下行 | 会话失败 |
| 200 | TaskRequest | 上行 | 发送合成文本 |
| 350 | TTSSentenceStart | 下行 | 句子开始 |
| 351 | TTSSentenceEnd | 下行 | 句子结束（含时间戳） |
| 352 | TTSResponse | 下行 | 音频数据帧 |

#### 完整交互流程

```
客户端                          服务端
  │                                │
  │  StartConnection (event=1)     │
  │ ─────────────────────────────► │
  │                                │
  │       ConnectionStarted (50)    │
  │ ◄───────────────────────────── │
  │                                │
  │  StartSession (event=100)       │
  │  + session_id + tts_params     │
  │ ─────────────────────────────► │
  │                                │
  │       SessionStarted (150)      │
  │ ◄───────────────────────────── │
  │                                │
  │  TaskRequest (event=200)       │
  │  + session_id + text           │
  │ ─────────────────────────────► │
  │                                │
  │  TTSSentenceStart (350)        │
  │ ◄───────────────────────────── │
  │  TTSSentenceEnd (351)          │
  │ ◄───────────────────────────── │
  │  TTSResponse (352) + audio     │ ← 音频流（mp3/ogg_opus/pcm）
  │ ◄───────────────────────────── │
  │  (重复 350/351/352 直到文本结束)│
  │                                │
  │  FinishSession (event=102)     │
  │ ─────────────────────────────► │
  │                                │
  │       SessionFinished (152)    │
  │ ◄───────────────────────────── │
  │                                │
  │  FinishConnection (event=2)    │
  │ ─────────────────────────────► │
  │                                │
  │       ConnectionFinished (52)  │
  │ ◄───────────────────────────── │
```

#### TaskRequest 文本请求体

```typescript
{
  user: { uid: "user_123" },
  event: 200,                    // TaskRequest 事件码
  req_params: {
    text: "你好，今天天气怎么样？",    // 待合成文本
    speaker: "zh_female_qingxin",    // 音色（见音色列表）
    audio_params: {
      format: "mp3",                  // mp3 / ogg_opus / pcm
      sample_rate: 24000,             // 采样率
      speed_ratio: 0,                 // 语速 [-50, 100]
      volume_ratio: 0,                // 音量 [-50, 100]
      emotion: "",                    // 情感（如 "happy"）
      emotion_scale: 4,                // 情绪强度 [1, 5]
    },
    model: "seed-tts-2.0-standard",  // 仅 2.0 有效：standard / expressive
  }
}
```

#### 关键特性

- **流式输出**：边合成边返回音频，无需等待完整文本
- **句子级时间戳**：开启 `enable_timestamp: true` 后，`TTSSentenceEnd` 事件含每字时间戳
- **打断支持**：发送 `CancelSession (101)` 立即终止当前合成
- **链接复用**：一次 WebSocket 连接可创建多个 session（但不支持并发）

> 参考文档：https://www.volcengine.com/docs/6561/1329505（V3 WebSocket 双向流式）

---

## 4. Daemon 改动

### 4.1 新增文件

```
packages/cli/src/
├── agents/
│   └── volcengine/
│       ├── bidirection.ts     # 从 resources/src 复制过来的 TTS 封装
│       └── protocols.ts       # V3 二进制协议 marshal/unmarshal
├── daemon/
│   ├── tts.ts                # [新建] TTS 管理器：接收 AI text_delta 流式送入 TTS
│   └── server.ts             # [修改] 新增 session:voice_reply 事件处理
```

### 4.2 新增 Socket.IO 事件

| 事件 | 方向 | 说明 |
|------|------|------|
| `session:voice_reply` | client → server | 请求语音回复（daemon 启动 TTS 流） |
| `session:voice_audio` | server → client | TTS 音频帧流（二进制） |
| `session:voice_interrupt` | server → client | TTS 被打断（前端停止播放） |

### 4.3 流式并行处理

Daemon 收到 `session:send` 后，同时：
1. 把 `text_delta` 事件实时转发给 TTS 引擎
2. TTS 边收边合成，音频帧通过 `session:voice_audio` 推回前端

```
session:send
    │
    ├─ query() ──────────────────────────► AI stream (text_delta)
    │                                              │
    │                                    ┌─────────▼─────────┐
    │                                    │  TTS Engine      │
    │                                    │  边收text边合成   │
    │                                    └─────────┬─────────┘
    │                                    session:voice_audio
    │                                              │
    └──────────────────────────────────────────────┴─────► 前端播放
```

---

## 5. Web Console UI 改动

### 5.1 新增语音通话面板

在现有 Chat UI 旁边或底部新增语音通话区域：

```
┌─────────────────────────────────────┐
│  🎤 语音通话                         │
├─────────────────────────────────────┤
│                                     │
│   ┌─────────────────────────────┐   │
│   │   "你好的，我可以帮你什么？"  │   │  ← AI 回复文字（实时）
│   └─────────────────────────────┘   │
│                                     │
│   ┌─────────────────────────────┐   │
│   │ 你：我想查询今天的天气       │   │  ← 用户识别文字（实时）
│   └─────────────────────────────┘   │
│                                     │
│        ● 录音中...  02:34           │  ← 录音时长 + 波形指示
│                                     │
│   [发送]  [打断]  [结束通话]        │
│                                     │
└─────────────────────────────────────┘
```

### 5.2 状态 UI

| 状态 | UI 表现 |
|------|---------|
| IDLE | 麦克风图标 + "开始通话" 按钮 |
| RECORDING | 麦克风亮红 + 波形动画 + 识别文字 + 3 个按钮 |
| PROCESSING | 旋转等待动画 + "AI 思考中..." |
| SPEAKING | 扬声器图标 + 音频波形 + "打断" 按钮 |

---

## 6. 扩展性设计

### 6.1 STT/TTS 提供商可插拔

所有火山引擎调用封装在独立 Hook 中：

```typescript
// useVolcEngineSTT.ts — STT 抽象接口
interface ISTTProvider {
  start(onText: (text: string) => void): void;
  stop(): void;
}

// useVolcEngineTTS.ts — TTS 抽象接口
interface ITTSProvider {
  speak(text: string, onClose: () => void): void;
  interrupt(): void;
}
```

未来切换到讯飞/阿里云，只需实现相同接口替换即可。

### 6.2 App 端复用

App 端实现相同的 `ISTTProvider` / `ITTSProvider` 接口，Openz Daemon 无需任何改动。

---

## 7. 实现计划

### Phase 1：TTS 语音回复（先做这个）
> 用户通过文字发送消息，AI 回复以语音形式播报
1. **Daemon**：集成火山引擎 TTS（Node.js `ws` 库 + protocols.ts）
2. **Daemon**：新增 `session:voice_reply` 事件，接收文字并流式推送音频
3. **前端**：新增音频帧接收和 Web Audio API 播放
4. **前端**：改造 UI，添加"语音回复"开关
5. 跑通：用户打字 → daemon AI 处理 → AI text_delta 边吐边给 TTS → TTS 音频流式回推 → 前端实时播放

### Phase 2：STT 语音输入
> 用户可以通过语音输入发送消息（按住说话，弹起发送）
1. 实现火山引擎 STT 接入（WebSocket 流式识别）
2. 新增麦克风录音组件（Web Audio API + MediaRecorder）
3. 改造 UI：添加按住说话按钮
4. 跑通：按住录音 → 实时识别文字 → 松开发送 → AI 文字回复 → TTS 播放

### Phase 3：完整语音通话（双向可打断）
> 建立通话长连接，用户可以随时说话，AI 随时回复，可打断
1. STT + TTS 同时工作，双向流式
2. 实现打断控制器（中断 TTS 播放 + 中止 daemon 生成）
3. 实现完整状态机（IDLE → RECORDING → PROCESSING → SPEAKING）
4. 优化实时性：边说边识别，边听边播放

### Phase 4：App 扩展（后续）
- App 端实现（复用同一套 Provider 接口）

---

## 8. 已确认信息

| 项目 | 值 |
|------|-----|
| 火山引擎 API Key | `d098393c-32be-4b38-9814-c85da94dc6c6` |
| 鉴权方式 | `X-Api-Key` + `X-Api-Resource-Id`（Node.js ws 库） |
| TTS Resource ID | `seed-tts-2.0` |
| TTS 实际可用音色 | `saturn_zh_female_aojiaonvyou_tob`（2.0 音色测试通过） |
| 参考实现 | `resources/src/volcengine/bidirection.ts` + `resources/src/protocols.ts` |
| 协议格式 | V3 WebSocket 二进制帧（4字节 header + payload） |

---

## 9. 参考资料

- 火山引擎 TTS 文档：https://www.volcengine.com/docs/6561/1329505
- 火山引擎 ASR 文档：火山引擎控制台
- **参考实现（已跑通）**：
  - `resources/src/volcengine/bidirection.ts` — TTS 调用入口
  - `resources/src/protocols.ts` — V3 二进制协议 marshal/unmarshal 完整实现
- Openz Daemon Socket.IO 协议：见 `packages/cli/src/daemon/server.ts`
