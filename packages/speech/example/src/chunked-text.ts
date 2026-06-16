/**
 * 把一段文本按句末标点(。！？；\n)切成多段,逐段 yield 出去。
 *
 * 不切分直接整段喂入的话,server 端只会看到 1 个 chunk,体现不出
 * sender/receiver 并发的优势。切成多段后:首段一合成完就开始推
 * PCM,后续段在浏览器已经播放时陆续合成出来,浏览器侧真正是
 * 边生成边听。
 *
 * `delayMs` 控制段间基础延时(毫秒),`jitter: true` 时叠加
 * ±50% 随机抖动,模拟 LLM 边生成边喂入的真实场景。首段不延迟
 * (用户已经点击播放,不该让前端等几百 ms 才开始)。
 */
export interface ChunkOptions {
  delayMs?: number
  jitter?: boolean
}

export function chunkedTextStream(
  text: string,
  opts: ChunkOptions = {},
): AsyncIterable<string> {
  const delayMs = opts.delayMs ?? 0
  const jitter = opts.jitter ?? false
  const chunks = text
    .split(/(?<=[。！？；\n])/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0)
  if (chunks.length === 0) {
    chunks.push(text)
  }
  return {
    [Symbol.asyncIterator]() {
      let i = 0
      return {
        async next(): Promise<IteratorResult<string>> {
          if (i >= chunks.length) {
            return { value: undefined, done: true }
          }
          if (i > 0 && delayMs > 0) {
            const ms = jitter ? delayMs * (0.5 + Math.random()) : delayMs
            await new Promise<void>((r) => setTimeout(r, ms))
          }
          return { value: chunks[i++], done: false }
        },
      }
    },
  }
}
