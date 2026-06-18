/**
 * useTtsClient —— TTS 客户端 hook
 *
 * 职责:
 * - 通过 socket.io 订阅 tts:audio (binary Buffer) + tts:event
 * - speak(sessionId, message) → emit 'tts:start' (ack 失败走 toast)
 * - 把收到的 tts:audio 喂给本地 PCMPlayer
 * - 收到 tts:event end / error 时停(isPlaying=false)
 * - stop() 立即清空 PCMPlayer + off tts 订阅
 * - 关闭 settingsStore.ttsAutoPlay 时 speak 立即返回不发请求
 *   (但 onText 仍触发,让 UI 渲染用户输入的文字)
 *
 * TTS 服务端协议:
 *   tts:start (ack: {ok: boolean, error?: string})
 *   tts:audio (binary Buffer)  ← 流式音频帧
 *   tts:event { type: 'first_frame' | 'chunk' | 'end' | 'error', error?: string }
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { getSocket } from '../lib/socket';
import { PCMPlayer } from '../lib/audio-player';
import { useSettingsStore } from '../stores/settingsStore';
// 注意:toastStore 由其他 agent 实现,这里暂时不直接依赖。

/** 日志开关 */
const LOG_ENABLED = true;
const log = (...args: unknown[]) => {
  if (LOG_ENABLED) console.log('[mobile/tts]', ...args);
};

export interface UseTtsClientOptions {
  /** 收到 message 时同步触发(让 UI 也能渲染文字) */
  onText?: (sessionId: string, message: string) => void;
  /**
   * 收到 tts:event end / error 时触发(让 UI 做"已读完"动画之类)
   */
  onEvent?: (event: { type: string; error?: string }) => void;
}

export interface TtsClient {
  speak: (sessionId: string, message: string) => void;
  stop: () => void;
  isPlaying: boolean;
}

export function useTtsClient(options: UseTtsClientOptions = {}): TtsClient {
  const { onText, onEvent } = options;
  const [isPlaying, setIsPlaying] = useState(false);
  /** player 实例跨渲染保持(只在第一次创建) */
  const playerRef = useRef<PCMPlayer | null>(null);
  /** 当前 speak 的 sessionId,用于在事件回调中判断是否同一会话 */
  const sessionIdRef = useRef<string | null>(null);
  /** 是否订阅中 */
  const subscribedRef = useRef(false);

  // 构造 player(惰性)
  if (playerRef.current === null) {
    playerRef.current = new PCMPlayer({ sampleRate: 24000, channels: 1 });
  }

  /**
   * 解除 tts 事件订阅并停掉本地 player 播放。
   * 不发任何服务端事件(服务端会在断开连接时自然停止)。
   */
  const teardown = useCallback(() => {
    const player = playerRef.current;
    if (player) {
      try {
        player.clear();
      } catch {
        /* 忽略 */
      }
    }
    if (subscribedRef.current) {
      try {
        const sock = getSocket();
        sock.off('tts:audio');
        sock.off('tts:event');
      } catch {
        /* socket 未初始化时忽略 */
      }
      subscribedRef.current = false;
    }
    sessionIdRef.current = null;
    setIsPlaying(false);
  }, []);

  const stop = useCallback(() => {
    teardown();
  }, [teardown]);

  /**
   * 订阅 tts:audio + tts:event。返回 true 表示已订阅。
   */
  const subscribe = useCallback(() => {
    if (subscribedRef.current) return true;
    const sock = getSocket();

    const onAudio = (buf: Uint8Array | ArrayBuffer) => {
      const player = playerRef.current;
      if (!player) return;
      // 兼容 Buffer / ArrayBuffer / Uint8Array
      const data =
        buf instanceof Uint8Array ? buf : new Uint8Array(buf as ArrayBuffer);
      try {
        player.enqueue(data);
      } catch (e) {
        log('✗ enqueue failed:', (e as Error).message);
      }
    };

    const onEvent = (ev: { type: string; error?: string }) => {
      const { type } = ev;
      log('  tts:event', type, ev.error ?? '');
      // chunk / first_frame 不改变 isPlaying;end / error 终止
      if (type === 'end' || type === 'error') {
        if (type === 'error' && ev.error) {
          console.error('[useTtsClient]', ev.error);
        }
        // 末尾冲一下缓冲,然后停
        const player = playerRef.current;
        if (player) {
          try {
            player.flush();
          } catch {
            /* 忽略 */
          }
        }
        setIsPlaying(false);
        // 解除订阅但保留 player(下次 speak 可复用)
        try {
          const sock = getSocket();
          sock.off('tts:audio', onAudio);
          sock.off('tts:event', onEvent);
        } catch {
          /* 忽略 */
        }
        subscribedRef.current = false;
        sessionIdRef.current = null;
      }
      if (onEvent) {
        try {
          onEvent(ev);
        } catch {
          /* 用户回调异常吞掉 */
        }
      }
    };

    sock.on('tts:audio', onAudio);
    sock.on('tts:event', onEvent);
    subscribedRef.current = true;
    return true;
  }, [onEvent]);

  const speak = useCallback(
    (sessionId: string, message: string) => {
      // 立即同步触发 onText,保证 UI 立刻拿到文字
      if (onText) {
        try {
          onText(sessionId, message);
        } catch {
          /* 忽略 */
        }
      }

      // 读最新的 ttsAutoPlay 设置
      const ttsAutoPlay = useSettingsStore.getState().ttsAutoPlay;
      if (!ttsAutoPlay) {
        log('speak: ttsAutoPlay=false, 跳过 tts:start (text 仍通过 onText 渲染)');
        // 关闭自动播报:不发请求
        return;
      }

      log('→ emit tts:start sessionId=', sessionId, 'message_len=', message.length);

      // 解除旧订阅再开始新一次
      teardown();

      sessionIdRef.current = sessionId;
      subscribe();
      setIsPlaying(true);

      // emit tts:start,带 ack
      try {
        const sock = getSocket();
        sock.emit(
          'tts:start',
          { sessionId, message },
          (resp: { ok: boolean; error?: string } | undefined) => {
            if (resp && resp.ok === false) {
              const msg = resp.error ?? 'TTS 启动失败';
              console.error('[useTtsClient]', msg);
              setIsPlaying(false);
              // 解除订阅
              try {
                const s = getSocket();
                s.off('tts:audio');
                s.off('tts:event');
              } catch {
                /* 忽略 */
              }
              subscribedRef.current = false;
              sessionIdRef.current = null;
            }
          }
        );
      } catch (e) {
        log('✗ tts:start emit failed:', (e as Error).message);
        setIsPlaying(false);
      }
    },
    [onText, subscribe, teardown]
  );

  // hook 卸载时关闭 player
  useEffect(() => {
    return () => {
      teardown();
      if (playerRef.current) {
        try {
          playerRef.current.close();
        } catch {
          /* 忽略 */
        }
        playerRef.current = null;
      }
    };
  }, [teardown]);

  return { speak, stop, isPlaying };
}
