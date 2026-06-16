import { useRef, useCallback } from 'react';

export function useAudioPlayer() {
  const audioContextRef = useRef<AudioContext | null>(null);
  const audioQueueRef = useRef<AudioBuffer[]>([]);
  const sourceRef = useRef<AudioBufferSourceNode | null>(null);
  const isPlayingRef = useRef(false);
  const onFinishRef = useRef<(() => void) | null>(null);

  const init = useCallback(async () => {
    if (!audioContextRef.current) {
      audioContextRef.current = new AudioContext();
    }
    const ctx = audioContextRef.current;
    if (ctx.state === 'suspended') {
      await ctx.resume();
    }
    return ctx;
  }, []);

  const playNext = useCallback((ctx: AudioContext) => {
    if (audioQueueRef.current.length === 0) {
      isPlayingRef.current = false;
      sourceRef.current = null;
      return;
    }

    isPlayingRef.current = true;
    const buffer = audioQueueRef.current.shift()!;
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.connect(ctx.destination);
    source.onended = () => {
      playNext(ctx);
    };
    sourceRef.current = source;
    source.start();
  }, []);

  const playChunk = useCallback(async (base64Data: string) => {
    const ctx = await init();
    const arrayBuffer = Uint8Array.from(atob(base64Data), (c) => c.charCodeAt(0)).buffer;
    try {
      const audioBuffer = await ctx.decodeAudioData(arrayBuffer);
      audioQueueRef.current.push(audioBuffer);
      if (!isPlayingRef.current) {
        playNext(ctx);
      }
    } catch (e) {
      console.error('[AudioPlayer] decode error:', e);
    }
  }, [init, playNext]);

  const stop = useCallback(() => {
    if (sourceRef.current) {
      try {
        sourceRef.current.stop();
      } catch {}
      sourceRef.current = null;
    }
    audioQueueRef.current = [];
    isPlayingRef.current = false;
  }, []);

  const destroy = useCallback(() => {
    stop();
    if (audioContextRef.current) {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }
  }, [stop]);

  return { playChunk, stop, destroy };
}
