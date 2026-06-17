import { useRef, useCallback, useEffect } from 'react';
import { PCMPlayer, TtsClient } from '@openz/speech/client';

const DAEMON_PORT = 19999;

export function useTtsClient() {
  const pcmPlayerRef = useRef<PCMPlayer | null>(null);
  const ttsClientRef = useRef<TtsClient | null>(null);

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

  const connect = useCallback((sessionId: string, message: string) => {
    const player = ensurePlayer();

    // Disconnect existing client if any
    if (ttsClientRef.current) {
      ttsClientRef.current.stop();
      ttsClientRef.current = null;
    }

    const wsUrl = `ws://${window.location.hostname}:${DAEMON_PORT}/api/tts/ws?sessionId=${encodeURIComponent(sessionId)}`;

    const client = new TtsClient({
      url: wsUrl,
      text: message,
      voiceType: 'saturn_zh_female_aojiaonvyou_tob',
      resourceId: 'seed-tts-2.0',
      simulateStream: false,
      onSessionStart: (info) => {
        console.log('[TtsClient] session_start:', info);
      },
      onChunk: (info) => {
        console.log(`[TtsClient] chunk #${info.index}: "${info.text.slice(0, 20)}..."`);
      },
      onFirstFrame: (at) => {
        console.log(`[TtsClient] first_frame +${at}ms`);
      },
      onAudioFrame: (data) => {
        // data is ArrayBuffer of raw Int16 PCM bytes
        player.feed(new Uint8Array(data));
      },
      onEnd: (info) => {
        console.log(`[TtsClient] end: ${info.totalFrames} frames, ${info.totalBytes} bytes`);
      },
      onError: (msg) => {
        console.error('[TtsClient] error:', msg);
      },
      onClose: () => {
        console.log('[TtsClient] closed');
        ttsClientRef.current = null;
      },
    });

    ttsClientRef.current = client;
    client.start();
  }, [ensurePlayer]);

  const disconnect = useCallback(() => {
    if (ttsClientRef.current) {
      ttsClientRef.current.stop();
      ttsClientRef.current = null;
    }
  }, []);

  const destroy = useCallback(() => {
    disconnect();
    if (pcmPlayerRef.current) {
      pcmPlayerRef.current.destroy();
      pcmPlayerRef.current = null;
    }
  }, [disconnect]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (ttsClientRef.current) {
        ttsClientRef.current.stop();
        ttsClientRef.current = null;
      }
      if (pcmPlayerRef.current) {
        pcmPlayerRef.current.destroy();
        pcmPlayerRef.current = null;
      }
    };
  }, []);

  return { connect, disconnect, destroy };
}
