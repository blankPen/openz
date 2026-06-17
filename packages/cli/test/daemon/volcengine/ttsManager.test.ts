import { describe, it, expect, vi, beforeEach } from 'vitest'

// protocols mock
const mockSend = vi.fn()
const mockReceive = vi.fn()

vi.mock('../../../protocols.js', () => ({
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
  StartConnection: mockSend,
  // Cycle through expected events: ConnectionStarted(50) then SessionStarted(150)
  WaitForEvent: vi.fn()
    .mockResolvedValueOnce({ type: 9, event: 50 })
    .mockResolvedValueOnce({ type: 9, event: 150 }),
  StartSession: mockSend,
  TaskRequest: mockSend,
  FinishSession: mockSend,
  FinishConnection: mockSend,
  ReceiveMessage: mockReceive,
}))

import { TTSManager } from '../../../src/daemon/volcengine/ttsManager.js'

const sentPayloads: any[] = []

beforeEach(() => {
  vi.clearAllMocks()
  sentPayloads.length = 0
})

describe('TTSManager PCM format', () => {
  it('feedText sends TaskRequest with format=pcm and sample_rate=24000', async () => {
    const mockWs = {
      on: vi.fn((event: string, handler: Function) => {
        if (event === 'open') handler() // fire open synchronously
      }),
      once: vi.fn((event: string, handler: Function) => {
        if (event === 'error') {} // no-op for error handler
      }),
      send: vi.fn((data: any, cb: any) => {
        sentPayloads.push(data)
        if (cb) cb()
      }),
      close: vi.fn(),
    }

    const manager = new TTSManager({
      appkey: 'test-key',
      resourceId: 'seed-tts-2.0',
      voiceType: 'saturn_zh_female_aojiaonvyou_tob',
      onAudio: vi.fn(),
      ws: mockWs as any,
    })

    await manager.connect()
    manager.feedText('测试中文')

    const taskPayload = sentPayloads.find((p) =>
      JSON.stringify(p).includes('TaskRequest'),
    )
    expect(taskPayload).toBeDefined()
    const parsed = JSON.parse(taskPayload as any)
    expect(parsed.req_params.format).toBe('pcm')
    expect(parsed.req_params.sample_rate).toBe(24000)
    expect(parsed.req_params.text).toBe('测试中文')
  })

  it('streamAudio calls onAudio for each AudioOnlyServer frame', async () => {
    const frames: Buffer[] = []
    const mockWs = {
      on: vi.fn((event: string, handler: Function) => {
        if (event === 'open') handler()
      }),
      send: vi.fn((_, cb) => { if (cb) cb() }),
      close: vi.fn(),
    }

    const manager = new TTSManager({
      appkey: 'test-key',
      resourceId: 'seed-tts-2.0',
      voiceType: 'saturn_zh_female_aojiaonvyou_tob',
      onAudio: (frame: Buffer) => frames.push(frame),
      ws: mockWs as any,
    })

    await manager.connect()
    manager.streamAudio()

    const pcm1 = Buffer.from([1, 2, 3, 4])
    const pcm2 = Buffer.from([5, 6, 7, 8])
    mockReceive
      .mockResolvedValueOnce({ type: 11, event: 352, payload: pcm1 })
      .mockResolvedValueOnce({ type: 11, event: 352, payload: pcm2 })
      .mockResolvedValueOnce({ type: 9, event: 152 }) // SessionFinished

    await new Promise((r) => setTimeout(r, 100))

    expect(frames.length).toBe(2)
    expect(frames[0].byteLength).toBe(4)
  })

  it('finish sends FinishSession then FinishConnection', async () => {
    const mockWs = {
      on: vi.fn((event: string, handler: Function) => {
        if (event === 'open') handler()
      }),
      send: vi.fn((data: any, cb: any) => {
        sentPayloads.push(data)
        if (cb) cb()
      }),
      close: vi.fn(),
    }

    const manager = new TTSManager({
      appkey: 'test-key',
      resourceId: 'seed-tts-2.0',
      voiceType: 'saturn_zh_female_aojiaonvyou_tob',
      onAudio: vi.fn(),
      ws: mockWs as any,
    })

    await manager.connect()
    await manager.finish()

    const hasSession = sentPayloads.some((p) =>
      JSON.stringify(p).includes('FinishSession'),
    )
    const hasConn = sentPayloads.some((p) =>
      JSON.stringify(p).includes('FinishConnection'),
    )
    expect(hasSession).toBe(true)
    expect(hasConn).toBe(true)
  })
})
