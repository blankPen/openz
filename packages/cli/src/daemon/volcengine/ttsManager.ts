import WebSocket from 'ws';
import * as uuid from 'uuid';
import {
  MsgType,
  EventType,
  StartConnection,
  StartSession,
  TaskRequest,
  FinishSession,
  FinishConnection,
  CancelSession,
  ReceiveMessage,
  WaitForEvent,
  type Message,
} from './protocols.js';

const DEFAULT_ENDPOINT = 'wss://openspeech.bytedance.com/api/v3/tts/bidirection';

const log = (...args: any[]) =>
  console.log(`[TTSManager]`, new Date().toISOString(), ...args);

export interface TTSManagerOptions {
  appkey: string;
  resourceId: string;
  voiceType: string;
  endpoint?: string;
  /** Optional WebSocket for testing */
  ws?: WebSocket;
  onAudio?: (frame: Buffer, chunkIndex: number) => void;
  onChunk?: (index: number, text: string, at: number) => void;
  onFirstFrame?: (at: number, chunkIndex: number) => void;
  onComplete?: () => void;
  onError?: (err: string) => void;
}

export class TTSManager {
  private ws: WebSocket | null = null;
  private sessionId = '';
  private headers: Record<string, string>;
  private endpoint: string;
  private opts: TTSManagerOptions;
  private connected = false;
  private destroyed = false;

  constructor(opts: TTSManagerOptions) {
    this.opts = opts;
    this.endpoint = opts.endpoint ?? DEFAULT_ENDPOINT;
    this.headers = {
      'X-Api-Key': opts.appkey,
      'X-Api-Resource-Id': opts.resourceId,
      'X-Api-Connect-Id': uuid.v4(),
    };
    if (opts.ws) {
      this.ws = opts.ws;
    }
  }

  isConnected(): boolean {
    return this.connected && !this.destroyed;
  }

  async connect(): Promise<void> {
    if (this.destroyed) throw new Error('TTSManager already destroyed');

    return new Promise((resolve, reject) => {
      if (!this.ws) {
        this.ws = new WebSocket(this.endpoint, {
          headers: this.headers,
          skipUTF8Validation: true,
        });
      }

      this.ws.on('open', async () => {
        try {
          await StartConnection(this.ws!);
          await WaitForEvent(this.ws!, MsgType.FullServerResponse, EventType.ConnectionStarted);

          this.sessionId = uuid.v4();
          const userId = uuid.v4();

          await StartSession(
            this.ws!,
            new TextEncoder().encode(
              JSON.stringify({
                user: { uid: userId },
                req_params: {
                  speaker: this.opts.voiceType,
                  audio_params: {
                    format: 'pcm',
                    sample_rate: 24000,
                    enable_timestamp: true,
                  },
                  additions: JSON.stringify({ disable_markdown_filter: false }),
                },
                event: EventType.StartSession,
              }),
            ),
            this.sessionId,
          );

          await WaitForEvent(this.ws!, MsgType.FullServerResponse, EventType.SessionStarted);
          this.connected = true;
          resolve();
        } catch (err) {
          this.opts.onError?.(`Connection error: ${err}`);
          reject(err);
        }
      });

      this.ws.on('error', (err) => {
        if (!this.connected) {
          reject(err);
        } else {
          this.opts.onError?.(`WebSocket error: ${err.message}`);
        }
      });

      this.ws.on('close', () => {
        this.connected = false;
        if (!this.destroyed) {
          this.opts.onError?.('Connection closed unexpectedly');
        }
      });
    });
  }

  /**
   * 发送单段文本的 TaskRequest（不启动完整的流式循环）。
   * 用于逐段推送文本到 TTS 引擎。
   */
  async feedText(text: string): Promise<void> {
    if (!this.ws || !this.sessionId || !this.connected) {
      throw new Error('not connected');
    }
    await TaskRequest(
      this.ws,
      new TextEncoder().encode(
        JSON.stringify({
          user: { uid: 'openz-daemon' },
          req_params: {
            speaker: this.opts.voiceType,
            audio_params: {
              format: 'pcm',
              sample_rate: 24000,
            },
            text,
          },
          event: EventType.TaskRequest,
        }),
      ),
      this.sessionId,
    );
  }

  /**
   * Run the full bidirectional TTS cycle:
   * - sender: pulls text chunks and sends TaskRequest
   * - receiver: collects audio frames and calls onAudio
   * - both run concurrently via Promise.all
   */
  async run(texts: AsyncIterable<string> | Iterable<string>): Promise<void> {
    if (!this.ws || !this.sessionId || !this.connected) {
      throw new Error('not connected');
    }

    const startedAt = Date.now();
    let chunkIndex = 0;
    let hasAnyChunk = false;

    const sender = (async () => {
      for await (const chunk of texts) {
        hasAnyChunk = true;
        chunkIndex += 1;
        const at = Date.now() - startedAt;
        if (this.opts.onChunk) {
          this.opts.onChunk(chunkIndex, chunk, at);
        } else {
          log(`[sender] chunk ${chunkIndex}: "${chunk.slice(0, 20)}..."`);
        }

        await TaskRequest(
          this.ws!,
          new TextEncoder().encode(
            JSON.stringify({
              user: { uid: 'openz-daemon' },
              req_params: {
                speaker: this.opts.voiceType,
                audio_params: {
                  format: 'pcm',
                  sample_rate: 24000,
                },
                text: chunk,
              },
              event: EventType.TaskRequest,
            }),
          ),
          this.sessionId,
        );
      }

      if (!hasAnyChunk) {
        throw new Error('texts 为空');
      }

      await FinishSession(this.ws!, this.sessionId);
    })();

    const receiver = (async () => {
      let firstFrameLogged = false;
      while (true) {
        const msg = await ReceiveMessage(this.ws!);

        if (msg.type === MsgType.AudioOnlyServer) {
          if (!firstFrameLogged) {
            firstFrameLogged = true;
            const elapsed = Date.now() - startedAt;
            this.opts.onFirstFrame?.(elapsed, chunkIndex);
            log(`[receiver] first frame at +${elapsed}ms (chunk ${chunkIndex})`);
          }
          this.opts.onAudio?.(Buffer.from(msg.payload), chunkIndex);
        } else if (msg.type === MsgType.FullServerResponse) {
          if (msg.event === EventType.SessionFinished) {
            break;
          }
        } else if (msg.type === MsgType.Error) {
          const errText = new TextDecoder().decode(msg.payload);
          this.opts.onError?.(`TTS error: ${errText}`);
          break;
        }
      }
    })();

    await Promise.all([sender, receiver]);
  }

  async finish(): Promise<void> {
    if (!this.ws || !this.sessionId || !this.connected) {
      return;
    }

    this.connected = false;
    this.destroyed = true;
    await FinishSession(this.ws, this.sessionId);
    await FinishConnection(this.ws);
    this.ws = null;
  }

  interrupt(): void {
    if (!this.ws || !this.sessionId) return;

    this.connected = false;
    this.destroyed = true;

    try {
      CancelSession(this.ws, this.sessionId);
    } catch {}

    this.ws.close();
    this.ws = null;
  }

  destroy(): void {
    this.destroyed = true;
    this.connected = false;

    if (this.ws) {
      try {
        this.ws.close();
      } catch {}
      this.ws = null;
    }
  }
}
