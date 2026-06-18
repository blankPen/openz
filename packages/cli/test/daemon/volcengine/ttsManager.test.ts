import { describe, it, expect, vi, beforeEach } from 'vitest'

// ---- protocols mock ----
const capturedPayloads: string[] = []

const {
  mockStartConnection,
  mockStartSession,
  mockTaskRequest,
  mockFinishSession,
  mockFinishConnection,
  mockReceive,
  mockWaitForEvent,
} = vi.hoisted(() => {
  /** 工厂：mock 带 payload 的协议函数（StartSession / TaskRequest） */
  const capturePayload = () =>
    vi.fn((_ws: any, payload: Uint8Array, _sessionId?: string) => {
      capturedPayloads.push(new TextDecoder().decode(payload))
      return Promise.resolve()
    })

  return {
    mockStartConnection: vi.fn((_ws: any) => Promise.resolve()),
    mockStartSession: capturePayload(),
    mockTaskRequest: capturePayload(),
    // FinishSession 签名: (ws, sessionId) — 无 payload
    mockFinishSession: vi.fn((_ws: any, _sessionId: string) => Promise.resolve()),
    mockFinishConnection: vi.fn((_ws: any) => Promise.resolve()),
    mockReceive: vi.fn(),
    mockWaitForEvent: vi.fn()
      .mockResolvedValueOnce({ type: 9, event: 50 })   // ConnectionStarted
      .mockResolvedValueOnce({ type: 9, event: 150 }), // SessionStarted
  }
})

vi.mock('../../../src/daemon/volcengine/protocols.js', () => ({
  MsgType: {
    FullServerResponse: 9,
    AudioOnlyServer: 11,
    Error: 15,
  },
  EventType: {
    StartConnection: 1,
    ConnectionStarted: 50,
    StartSession: 100,
    SessionStarted: 150,
    TaskRequest: 200,
    SessionFinished: 152,
    FinishSession: 102,
    FinishConnection: 2,
    ConnectionFinished: 52,
  },
  StartConnection: mockStartConnection,
  StartSession: mockStartSession,
  TaskRequest: mockTaskRequest,
  FinishSession: mockFinishSession,
  FinishConnection: mockFinishConnection,
  ReceiveMessage: mockReceive,
  WaitForEvent: mockWaitForEvent,
}))

import { TTSManager } from '../../../src/daemon/volcengine/ttsManager.js'

/** 创建 WebSocket mock 工厂 */
function makeMockWs() {
  return {
    on: vi.fn((event: string, handler: Function) => {
      if (event === 'open') handler()
    }),
    once: vi.fn(),
    removeListener: vi.fn(),
    send: vi.fn((_data: any, cb: any) => { if (cb) cb() }),
    close: vi.fn(),
  }
}

beforeEach(() => {
  vi.clearAllMocks()
  capturedPayloads.length = 0
  mockWaitForEvent
    .mockReset()
    .mockResolvedValueOnce({ type: 9, event: 50 })   // ConnectionStarted
    .mockResolvedValueOnce({ type: 9, event: 150 })  // SessionStarted
  mockReceive.mockReset()
})

describe('TTSManager PCM format', () => {
  it('feedText sends TaskRequest with format=pcm and sample_rate=24000', async () => {
    const manager = new TTSManager({
      appkey: 'test-key',
      resourceId: 'seed-tts-2.0',
      voiceType: 'saturn_zh_female_aojiaonvyou_tob',
      onAudio: vi.fn(),
      ws: makeMockWs() as any,
    })

    await manager.connect()
    await manager.feedText('测试中文')

    // TaskRequest 的 payload 在 capturedPayloads 中（StartSession 在前面）
    const taskPayload = capturedPayloads.find((p) => p.includes('测试中文'))
    expect(taskPayload).toBeDefined()
    const parsed = JSON.parse(taskPayload!)
    expect(parsed.req_params.audio_params.format).toBe('pcm')
    expect(parsed.req_params.audio_params.sample_rate).toBe(24000)
    expect(parsed.req_params.text).toBe('测试中文')
  })

  it('streamAudio calls onAudio for each AudioOnlyServer frame', async () => {
    const frames: Buffer[] = []

    const pcm1 = Buffer.from([1, 2, 3, 4])
    const pcm2 = Buffer.from([5, 6, 7, 8])
    mockReceive
      .mockResolvedValueOnce({ type: 11, event: 352, payload: pcm1 })
      .mockResolvedValueOnce({ type: 11, event: 352, payload: pcm2 })
      .mockResolvedValueOnce({ type: 9, event: 152 }) // SessionFinished

    const manager = new TTSManager({
      appkey: 'test-key',
      resourceId: 'seed-tts-2.0',
      voiceType: 'saturn_zh_female_aojiaonvyou_tob',
      onAudio: (frame: Buffer) => frames.push(frame),
      ws: makeMockWs() as any,
    })

    await manager.connect()
    await manager.run(['测试文本'])

    expect(frames.length).toBe(2)
    expect(frames[0].byteLength).toBe(4)
  })

  it('finish sends FinishSession then FinishConnection', async () => {
    const manager = new TTSManager({
      appkey: 'test-key',
      resourceId: 'seed-tts-2.0',
      voiceType: 'saturn_zh_female_aojiaonvyou_tob',
      onAudio: vi.fn(),
      ws: makeMockWs() as any,
    })

    await manager.connect()
    await manager.finish()

    // finish() 依次调用 FinishSession 和 FinishConnection
    expect(mockFinishSession).toHaveBeenCalled()
    expect(mockFinishConnection).toHaveBeenCalled()

    // 验证调用顺序：FinishSession 先于 FinishConnection
    const sessionIdx = mockFinishSession.mock.invocationCallOrder[0]
    const connIdx = mockFinishConnection.mock.invocationCallOrder[0]
    expect(sessionIdx).toBeLessThan(connIdx)
  })
})
