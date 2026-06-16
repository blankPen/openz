/**
 * 浏览器端火山引擎 TTS 客户端。
 *
 * 零依赖,只用浏览器原生 API(AudioContext, WebSocket)。
 * ESM 输出,example 用 `<script type="module">` 引用。
 */
export { PCMPlayer } from './pcm-player.js'
export { TtsClient } from './tts-client.js'
export type {
  PCMPlayerOptions,
  TtsClientOptions,
  TtsClientState,
  SessionStartInfo,
  ChunkInfo,
  EndInfo,
} from './types.js'
