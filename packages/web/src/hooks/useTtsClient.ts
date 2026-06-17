import { useRef, useCallback, useEffect } from 'react';
import { PCMPlayer } from '@openz/speech/client';
import { socket } from '../socket';

/**
 * TTS 客户端 hook。
 *
 * 通过已有的 socket.io 连接（server 中继）接收 PCM 帧和控制事件，
 * 不再走裸 WebSocket 也不再硬编码 daemon 端口。
 *
 * server 端 tts:audio 是二进制帧（PCM Int16 LE），直接喂给 PCMPlayer 播放。
 */
export function useTtsClient() {
  const pcmPlayerRef = useRef<PCMPlayer | null>(null);
  const activeSessionIdRef = useRef<string | null>(null);

  const ensurePlayer = useCallback(() => {
    if (!pcmPlayerRef.current) {
      pcmPlayerRef.current = new PCMPlayer({
        inputCodec: 'Int16',
        channels: 1,
        sampleRate: 24000,
        flushTime: 200,
        volume: 1,
      });
    }
    return pcmPlayerRef.current;
  }, []);

  // 过滤：只处理当前活跃 session 的事件
  const onTtsEvent = useCallback(
    (data: { sessionId: string; type: string; [k: string]: any }) => {
      if (data.sessionId !== activeSessionIdRef.current) return;
      switch (data.type) {
        case 'session_start':
          console.log('[TtsClient] session_start:', data);
          break;
        case 'chunk':
          console.log(
            `[TtsClient] chunk #${data.index}: "${(data.text || '').slice(0, 20)}..."`,
          );
          break;
        case 'first_frame':
          console.log(`[TtsClient] first_frame +${data.at}ms`);
          break;
        case 'end':
          console.log(`[TtsClient] end: ${data.totalBytes} bytes`);
          break;
        case 'error':
          console.error('[TtsClient] error:', data.error);
          break;
      }
    },
    [],
  );

  const onTtsAudio = useCallback(
    (meta: { sessionId: string }, buffer: ArrayBuffer | Uint8Array) => {
      if (meta.sessionId !== activeSessionIdRef.current) return;
      const player = ensurePlayer();
      const bytes = buffer instanceof Uint8Array ? buffer.byteLength : buffer.byteLength;
      console.log(`[TtsClient] tts:audio received: ${bytes} bytes, feeding PCMPlayer`);
      player.feed(buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer));
    },
    [ensurePlayer],
  );

  useEffect(() => {
    socket.on('tts:event', onTtsEvent);
    socket.on('tts:audio', onTtsAudio);
    return () => {
      socket.off('tts:event', onTtsEvent);
      socket.off('tts:audio', onTtsAudio);
    };
  }, [onTtsEvent, onTtsAudio]);

  const connect = useCallback((sessionId: string, message: string) => {
    activeSessionIdRef.current = sessionId;
    // 防御性 resume：浏览器 autoplay policy 要求 AudioContext 在用户手势
    // 调用栈里 resume 才会出声。connect 通常在 send 点击后被调用，
    // 但中间可能跨过 async 边界丢失手势上下文；这里再调一次保险。
    const player = ensurePlayer();
    const ctx = (player as any).audioCtx as AudioContext | undefined;
    if (ctx && ctx.state === 'suspended') {
      ctx.resume().catch(() => {
        /* 仍不在手势上下文里，等到 TTS 真正开始时再试 */
      });
    }
    socket.emit(
      'tts:start',
      { sessionId, message },
      (res: { ok?: boolean; error?: string }) => {
        if (res?.error) {
          console.error('[TtsClient] tts:start error:', res.error);
          if (activeSessionIdRef.current === sessionId) {
            activeSessionIdRef.current = null;
          }
        }
      },
    );
  }, [ensurePlayer]);

  const disconnect = useCallback(() => {
    activeSessionIdRef.current = null;
  }, []);

  const destroy = useCallback(() => {
    disconnect();
    if (pcmPlayerRef.current) {
      pcmPlayerRef.current.destroy();
      pcmPlayerRef.current = null;
    }
  }, [disconnect]);

  useEffect(() => {
    return () => {
      activeSessionIdRef.current = null;
      if (pcmPlayerRef.current) {
        pcmPlayerRef.current.destroy();
        pcmPlayerRef.current = null;
      }
    };
  }, []);

  return { connect, disconnect, destroy };
}
