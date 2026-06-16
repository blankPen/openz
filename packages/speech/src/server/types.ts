/**
 * 火山引擎大模型语音合成 双向流式 TTS 调用参数。
 *
 * 鉴权:使用「新版控制台」时仅需传入 appkey(API Key),握手时通过
 *      `X-Api-Key` 头发送。旧版控制台需要同时传 appid + access_key
 *      两个头,本模块不直接支持旧版控制台。
 *
 * 资源:resourceId 与 voiceType 必须匹配(同一代模型)。
 *      * 声音为 TTS 1.0 音色(如 `xxx_tob` 之前的老音色)时,
 *        配 `seed-tts-1.0` 或 `seed-tts-1.0-concurr`。
 *      * 声音为 TTS 2.0 音色(豆包语音合成模型 2.0 列表)时,
 *        配 `seed-tts-2.0`。
 */
export interface BidirectionTtsOptions {
  /** 新版控制台的 API Key */
  appkey: string
  /** 资源 ID,决定模型版本与计费方式 */
  resourceId: string
  /** 音色 ID,必须与 resourceId 同一代模型 */
  voiceType: string
  /**
   * 流式输入的文本片段:模拟「语音通话」场景,调用方按自己的节奏
   * 逐段喂入文本(可以是整句、几个字、或大模型流式吐出的 token 块),
   * 片段之间可以存在任意延迟。
   *
   * 用 `AsyncIterable<string>` 而非 `string[]` 是关键:函数会
   * `for await` 拉取每个片段,前一个 TaskRequest 发完之后才拉取
   * 下一段,因此 LLM 边生成边喂入的延迟会被自然吞掉,不会出现
   * 「攒齐再发」的等待。
   *
   * 所有片段最终合成到 **一个** 音频文件中(不是按 turn 切片)。
   */
  texts: AsyncIterable<string> | Iterable<string>
  /** 音频编码格式,默认 mp3。流式场景建议 pcm */
  encoding?: string
  /** 采样率(Hz),默认 24000。仅 pcm 时真正生效 */
  sampleRate?: number
  /** WebSocket 端点,默认官方 bidirection 地址 */
  endpoint?: string
  /**
   * 输出文件路径(含扩展名)。仅 `bidirectionTts`(落盘版本)使用。
   * 留空则默认 `<voiceType>.<encoding>`,写到当前工作目录。
   */
  outputFile?: string
}

export interface RunOptions extends BidirectionTtsOptions {
  /** 收到每一帧音频时立刻回调。用于实时转发。 */
  onAudioFrame?: (frame: Buffer) => void | Promise<void>
  /**
   * sender 协程每 yield 一段文本就回调。`at` 是相对会话开始的毫秒数。
   * 传 `simulateStream` 时这个回调尤其有用——能看到 sender 是不是
   * 真的在「边生成边喂」。
   */
  onChunk?: (index: number, text: string, at: number) => void
  /** receiver 协程收到第一个 AudioOnlyServer 帧时回调一次。`at` 同上。 */
  onFirstFrame?: (at: number) => void
}
