import { describe, it, expect } from 'vitest';
import { bidirectionTtsStream, DEFAULT_SAMPLE_RATE } from '@openz/speech/server';

const API_KEY = process.env.VOLCENGINE_API_KEY || 'd098393c-32be-4b38-9814-c85da94dc6c6';

describe('bidirectionTtsStream (real Volcengine API)', () => {
  it('streams audio frames from real Volcengine TTS', async () => {
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

  it('streams multiple text chunks', async () => {
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
      onChunk: (index, text, at) => {
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

  it('receives first frame callback', async () => {
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
