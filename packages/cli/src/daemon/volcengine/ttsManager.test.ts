import { describe, it, expect, afterAll } from 'vitest';
import { TTSManager } from './ttsManager.js';

const API_KEY = process.env.VOLCENGINE_API_KEY || 'd098393c-32be-4b38-9814-c85da94dc6c6';

describe('TTSManager (real Volcengine API)', () => {
  afterAll(() => {
    // cleanup
  });

  it('connects to real Volcengine TTS and receives audio', async () => {
    const audioFrames: Buffer[] = [];

    const manager = new TTSManager({
      appkey: API_KEY,
      resourceId: 'seed-tts-2.0',
      voiceType: 'saturn_zh_female_aojiaonvyou_tob',
      onAudio: (frame: Buffer) => {
        audioFrames.push(frame);
      },
      onComplete: () => {},
      onError: (err: string) => {
        console.error('TTS error:', err);
      },
    });

    await manager.connect();
    expect(manager.isConnected()).toBe(true);

    manager.feedText('你好');
    await manager.finish();

    expect(audioFrames.length).toBeGreaterThan(0);
    manager.destroy();
  }, 30000);

  it('feeds multiple text chunks', async () => {
    const audioFrames: Buffer[] = [];

    const manager = new TTSManager({
      appkey: API_KEY,
      resourceId: 'seed-tts-2.0',
      voiceType: 'saturn_zh_female_aojiaonvyou_tob',
      onAudio: (frame: Buffer) => {
        audioFrames.push(frame);
      },
      onComplete: () => {},
      onError: (err: string) => {
        console.error('TTS error:', err);
      },
    });

    await manager.connect();
    manager.feedText('第一句');
    manager.feedText('第二句');
    await manager.finish();

    expect(audioFrames.length).toBeGreaterThan(0);
    manager.destroy();
  }, 30000);

  it('can be destroyed', async () => {
    const manager = new TTSManager({
      appkey: API_KEY,
      resourceId: 'seed-tts-2.0',
      voiceType: 'saturn_zh_female_aojiaonvyou_tob',
      onAudio: () => {},
      onComplete: () => {},
      onError: () => {},
    });

    await manager.connect();
    expect(manager.isConnected()).toBe(true);
    manager.destroy();
    expect(manager.isConnected()).toBe(false);
  }, 30000);
});
