import { describe, it, expect } from 'vitest';
import { bidirectionTtsStream, DEFAULT_SAMPLE_RATE } from '@openz/speech/server';

// 「真实 API」集成测试：需直连火山引擎，依赖原生 ws 模块。
// Vite/vitest 和 tsx 的 esbuild 预构建都会破坏 ws 的 WebSocket 升级握手（401）。
// 独立验证（原生 Node，无 esbuild 干预）：
//   pnpm --filter @openz/cli test:tts
// 使用 OPENZ_TTS_APPKEY 环境变量（非 VOLCENGINE_API_KEY，避免与 pnpm 环境冲突）。

const API_KEY = process.env.OPENZ_TTS_APPKEY || 'd098393c-32be-4b38-9814-c85da94dc6c6';

describe('bidirectionTtsStream (real Volcengine API)', () => {
  it.skip('streams audio frames from real Volcengine TTS', async () => {
    const audioFrames: Buffer[] = [];

    const stream = bidirectionTtsStream({
      appkey: API_KEY,
      resourceId: 'seed-tts-2.0',
      voiceType: 'saturn_zh_female_aojiaonvyou_tob',
      texts: ['你好，测试流式合成。'],
      encoding: 'pcm',
      sampleRate: DEFAULT_SAMPLE_RATE,
      onAudioFrame: (frame: Buffer) => {
        audioFrames.push(frame);
      },
    });

    await new Promise<void>((resolve, reject) => {
      stream.on('end', resolve);
      stream.on('error', reject);
    });

    expect(audioFrames.length).toBeGreaterThan(0);
  }, 30000);

  it.skip('streams multiple text chunks', async () => {
    const audioFrames: Buffer[] = [];
    const chunks: { index: number; text: string; at: number }[] = [];

    async function* textChunks() {
      yield '第一句文本。';
      yield '第二句文本。';
    }

    const stream = bidirectionTtsStream({
      appkey: API_KEY,
      resourceId: 'seed-tts-2.0',
      voiceType: 'saturn_zh_female_aojiaonvyou_tob',
      texts: textChunks(),
      encoding: 'pcm',
      sampleRate: DEFAULT_SAMPLE_RATE,
      onAudioFrame: (frame: Buffer) => {
        audioFrames.push(frame);
      },
      onChunk: (index: number, text: string, at: number) => {
        chunks.push({ index, text, at });
      },
    });

    await new Promise<void>((resolve, reject) => {
      stream.on('end', resolve);
      stream.on('error', reject);
    });

    expect(audioFrames.length).toBeGreaterThan(0);
    expect(chunks.length).toBe(2);
  }, 30000);

  it.skip('receives first frame callback', async () => {
    let firstFrameAt = 0;

    const stream = bidirectionTtsStream({
      appkey: API_KEY,
      resourceId: 'seed-tts-2.0',
      voiceType: 'saturn_zh_female_aojiaonvyou_tob',
      texts: ['简短测试。'],
      encoding: 'pcm',
      sampleRate: DEFAULT_SAMPLE_RATE,
      onFirstFrame: (at: number) => {
        firstFrameAt = at;
      },
    });

    await new Promise<void>((resolve, reject) => {
      stream.on('end', resolve);
      stream.on('error', reject);
    });

    expect(firstFrameAt).toBeGreaterThan(0);
  }, 30000);
});
