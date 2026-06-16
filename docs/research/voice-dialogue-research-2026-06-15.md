# 语音对话开源/自研方案调研报告

> 调研日期：2026-06-15
> 调研人：Claude Code Assistant

## 一、端侧语音识别（STT）方案对比

### 1.1 主要候选方案

| 方案 | 开发方 | 模型大小 | 移动端支持 | 延迟 | 准确率 | 开源协议 |
|-----|-------|---------|-----------|-----|-------|---------|
| **Whisper** | OpenAI | ~3B (large) / 1.5B (medium) | ONNX Runtime, CoreML | 实时 | SOTA | Apache 2.0 |
| **Vosk** | AlphaFold authors | ~50MB (small) | Android/iOS | 实时 | 较好 | Apache 2.0 |
| **Paraformer** | Alibaba | ~220MB | ONNX | 实时 | 中文优化 | Apache 2.0 |
| **Faster-Whisper** | Guillaume Klein | (Whisper优化版) | ONNX Runtime | 更低延迟 | SOTA | MIT |

### 1.2 各方案深度分析

#### Whisper (OpenAI)
- **优势**：准确率最高，支持近百种语言，中英文表现优异
- **劣势**：大模型体积大（3B参数约6GB），移动端需要量化
- **移动端方案**：
  - 量化INT8后约1.5GB可运行
  - 可通过 ONNX Runtime 部署到 iOS/Android
  - 已有开源项目 whisper-ios-demo
- **延迟参考**：iPhone 14上量化Whisper Large约3-5秒处理10秒音频

#### Vosk
- **优势**：专为移动/嵌入式场景设计，模型极小（50MB），支持离线
- **劣势**：准确率不如Whisper，特别是中文
- **延迟参考**：实时转录，延迟<200ms

#### Paraformer (阿里)
- **优势**：中文场景专门优化，中文识别率高
- **劣势**：移动端生态不如Whisper成熟
- **适用场景**：对中文方言要求高时

### 1.3 推荐结论
- **首选**：Faster-Whisper + ONNX Runtime，可平衡准确率和性能
- **轻量选择**：Vosk，适合对包体积敏感的场景
- **中文优先**：Paraformer + 热词增强

---

## 二、端侧语音合成（TTS）方案对比

### 2.1 主要候选方案

| 方案 | 开发方 | 端侧支持 | 音色自然度 | 延迟 | 开源协议 |
|-----|-------|---------|-----------|-----|---------|
| **Coqui (XTTS)** | Coqui | ✅ Linux, 正在支持移动 | 极高 | 较低 | MPL 2.0 |
| **OpenVoice** | MyShell | ✅ 可转换 | 高 | 低 | MIT |
| **MeloTTS** | MyShell | ✅ iOS/Android | 高 | 低 | MIT |
| **Edge-TTS** | Microsoft | ❌ 需联网 | 高 | 云端延迟 | 禁止商用 |
| **VALL-E** | Microsoft | ❌ 仅论文 | - | - | 不可商用 |

### 2.2 各方案深度分析

#### OpenVoice
- **优势**：MIT协议可商用、极低延迟、支持多语言
- **劣势**：需要额外的音色克隆数据
- **架构**：基于VITS的轻量化模型，20M参数

#### MeloTTS
- **优势**：专为移动端优化，支持iOS/Android，C++后端
- **劣势**：中文支持相对较新
- **延迟**：流式输出，首包延迟<300ms

#### Coqui XTTS
- **优势**：语音自然度最高，支持情感控制
- **劣势**：端侧性能要求高，模型约1.2GB
- **注意**：Coqui公司2024年出现运营问题，长期维护存疑

### 2.3 推荐结论
- **首选**：MeloTTS，移动端支持最好，延迟低
- **质量优先**：OpenVoice（需解决部署问题）
- **备选**：Edge-TTS（如果接受云端）

---

## 三、流式语音AI框架对比

### 3.1 Pipecat

**定位**：开源语音AI框架，专注于构建多模态对话AI

**架构特点**：
```
用户语音 → STT → LLM → TTS → 用户
         ↓
      上下文管理 (Conversation Context)
         ↓
      工具调用 (Functions/Tools)
```

**核心能力**：
- 内置对多个STT/TTS提供商的适配（Whisper, ElevenLabs, OpenAI等）
- 支持多轮对话上下文管理
- 内置工具调用框架，可扩展
- 支持流式音频管道

**缺点**：
- 主要面向服务端部署
- 移动端案例较少
- Python框架，移动端集成需额外工作

### 3.2 LiveKit Voice SDK

**定位**：实时通信平台的AI语音代理

**架构特点**：
- 底层基于WebRTC，专注实时语音场景
- 提供完整的语音采集→处理→传输→播放链路
- 支持实时打断（用户可随时打断AI说话）
- 商业产品，有服务端组件

**核心能力**：
- 亚秒级端到端延迟
- 内置回声消除、噪声抑制
- 支持情感/语速控制
- 可与多种LLM集成（Claude, GPT等）

**缺点**：
- 需要部署LiveKit服务端
- 移动端SDK能力相对新

### 3.3 推荐结论

| 场景 | 推荐方案 | 理由 |
|-----|---------|-----|
| 快速原型 | Pipecat | Python生态，集成LLM简单 |
| 产品级移动端 | LiveKit Voice SDK | WebRTC优化，延迟更低 |
| 完全自研 | WebRTC + 自建流水线 | 最大灵活性，但开发量大 |

---

## 四、语音链路延迟优化

### 4.1 延迟构成分析

端到端延迟 = 语音采集(50ms) + VAD检测(100ms) + STT(500-2000ms) + LLM推理(500-3000ms) + TTS(300-1000ms) + 播放缓冲(100ms)

**最大瓶颈**：STT和LLM推理

### 4.2 优化策略

1. **流式STT**：不用等用户说完就开始识别
2. **预测性输出**：LLM边生成边合成，不等完整回复
3. **回声消除**：避免扬声器声音被重复识别
4. **VAD优化**：快速检测语音开始/结束
5. **并行化**：STT和LLT并行处理

### 4.3 参考指标

| 方案 | 端到端延迟 | 备注 |
|-----|----------|-----|
| 商业方案(OpenAI) | ~1-2秒 | 已高度优化 |
| 自研优化方案 | ~2-4秒 | 需要大量调优 |
| 未优化自研 | 5-10秒 | 用户体验差 |

---

## 五、商业备选方案对比

### 5.1 OpenAI Realtime API

**优势**：
- 端到端优化，延迟最低
- 内置STT+TTS+LLM一体化
- GPT-4o原生支持语音

**劣势**：
- 需要稳定网络连接
- 数据隐私需考虑
- 成本：约$0.006/分钟（输入）+ $0.024/分钟（输出）

### 5.2 阿里云语音AI

**优势**：
- 中文优化最好
- 国内外节点覆盖
- 完整语音+语义解决方案

**劣势**：
- 生态封闭
- 定价相对复杂

### 5.3 ElevenLabs

**优势**：
- 语音质量最高
- 音色定制能力强

**劣势**：
- 主要面向TTS，STT能力弱
- 价格较高

### 5.4 推荐结论

**短期/快速验证**：OpenAI Realtime API
**长期/成本控制**：自研端侧STT/TTS + 云端LLM
**中文场景**：阿里云语音AI

---

## 六、整体推荐方案

### 6.1 方案A：全自研（长期目标）

```
移动端 App
├── 语音采集 + AEC/ANS (WebRTC原生)
├── STT: Faster-Whisper (量化版, INT8)
├── 传输: WebSocket → 本地Claude Code服务
├── TTS: MeloTTS (流式输出)
└── 播放: 低延迟音频缓冲

本地电脑 (Claude Code服务)
├── WebSocket Server
├── Claude Code CLI封装
├── 工具调用代理
└── 会话管理
```

**优势**：数据隐私好，长期成本低
**劣势**：开发周期长，6-12个月

### 6.2 方案B：混合方案（推荐快速启动）

```
移动端 App
├── 语音采集 + AEC (WebRTC)
├── STT: 云端（阿里云/OpenAI）
├── LLM: 本地Claude Code
└── TTS: 云端（阿里云/ElevenLabs）

本地电脑
└── Claude Code (保持原样)
```

**优势**：快速上线，兼顾体验
**劣势**：依赖网络，部分数据上云

### 6.3 方案C：商业方案（最快上线）

使用 LiveKit + Claude API 完全商业化方案，2-4周可上线demo。

---

## 附录：参考资源

1. Whisper官方: https://github.com/openai/whisper
2. Faster-Whisper: https://github.com/SYSTRAN/faster-whisper
3. Vosk: https://alphacephei.com/vosk
4. MeloTTS: https://github.com/myshell-ai/MeloTTS
5. OpenVoice: https://github.com/myshell-ai/OpenVoice
6. Pipecat: https://pipecat.ai
7. LiveKit: https://livekit.io
8. OpenAI Realtime API: https://platform.openai.com/docs/guides/realtime
