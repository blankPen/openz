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
} from './protocols.js';

const DEFAULT_ENDPOINT = 'wss://openspeech.bytedance.com/api/v3/tts/bidirection';

export interface TTSManagerOptions {
  appkey: string;
  resourceId: string;
  voiceType: string;
  endpoint?: string;
  onAudio?: (frame: Buffer) => void;
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
  }

  isConnected(): boolean {
    return this.connected && !this.destroyed;
  }

  async connect(): Promise<void> {
    if (this.destroyed) throw new Error('TTSManager already destroyed');

    return new Promise((resolve, reject) => {
      this.ws = new WebSocket(this.endpoint, {
        headers: this.headers,
        skipUTF8Validation: true,
      });

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
                    format: 'mp3',
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

  feedText(text: string): void {
    if (!this.ws || !this.sessionId || !this.connected) {
      return;
    }

    const payload = new TextEncoder().encode(
      JSON.stringify({
        user: { uid: 'openz-daemon' },
        req_params: {
          speaker: this.opts.voiceType,
          audio_params: {
            format: 'mp3',
            sample_rate: 24000,
          },
          text,
        },
        event: EventType.TaskRequest,
      }),
    );

    TaskRequest(this.ws, payload, this.sessionId);
  }

  async finish(): Promise<void> {
    if (!this.ws || !this.sessionId || !this.connected) {
      return;
    }

    this.connected = false;

    await FinishSession(this.ws, this.sessionId);

    // Collect all audio frames until SessionFinished
    while (true) {
      const msg = await ReceiveMessage(this.ws);

      if (msg.type === MsgType.AudioOnlyServer) {
        this.opts.onAudio?.(Buffer.from(msg.payload));
      } else if (msg.type === MsgType.FullServerResponse) {
        if (msg.event === EventType.SessionFinished) {
          break;
        }
      } else if (msg.type === MsgType.Error) {
        throw new Error(`TTS error: ${new TextDecoder().decode(msg.payload)}`);
      }
    }

    await FinishConnection(this.ws);
    this.ws.close();
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
