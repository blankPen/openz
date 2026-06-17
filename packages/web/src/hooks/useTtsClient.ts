import { useRef, useCallback, useEffect, useState } from 'react';
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
  // 当前是否有音频在播。PCMPlayer 通过 onplaystate 回调通知,
  // 这里翻译成 React state 给 UI 消费(显示"正在播放"指示等)。
  const [playing, setPlaying] = useState(false);

  const ensurePlayer = useCallback(() => {
    if (!pcmPlayerRef.current) {
      pcmPlayerRef.current = new PCMPlayer({
        inputCodec: 'Int16',
        channels: 1,
        sampleRate: 24000,
        flushTime: 200,
        volume: 1,
        onplaystate: (isPlaying) => setPlaying(isPlaying),
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

  const connect = useCallback((sessionId: string) => {
    // 仅设置 activeSessionId 过滤器 + 防御性 resume AudioContext。
    // emit 'tts:start' 的责任交给调用方(ChatView.send),避免 ChatView
    // 调 connectTts 后又自己 socket.emit('tts:start') 造成双触发。
    activeSessionIdRef.current = sessionId;
    const player = ensurePlayer();
    const ctx = (player as any).audioCtx as AudioContext | undefined;
    if (ctx && ctx.state === 'suspended') {
      ctx.resume().catch(() => {
        /* 仍不在手势上下文里，等到 TTS 真正开始时再试 */
      });
    }
  }, [ensurePlayer]);

  const disconnect = useCallback(() => {
    activeSessionIdRef.current = null;
    // 清空 PCMPlayer 内部残留(samples + 活跃 BufferSource),避免新一次
    // TTS 流的帧叠加到上一流的尾巴上导致音频重叠。AudioContext 保留,
    // 下次 ensurePlayer 复用同一个 ctx。
    pcmPlayerRef.current?.clear();
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

  return { connect, disconnect, destroy, playing };
}
