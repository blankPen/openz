/**
 * Node 端火山引擎 TTS 业务封装。
 *
 * 依赖 `ws` 和 `uuid`,仅可在 Node 环境使用。
 * 浏览器端请用 `@openz/speech/client`。
 */
export {
  bidirectionTts,
  bidirectionTtsStream,
  DEFAULT_SAMPLE_RATE,
} from './bidirection.js'
export type { BidirectionTtsOptions, RunOptions } from './types.js'
