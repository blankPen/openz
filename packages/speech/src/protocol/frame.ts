import { EventType, MsgType, MsgTypeFlagBits, createMessage, type Message } from './messages.js'
import { marshalMessage } from './codec.js'

/**
 * 帧构造:纯函数,输入字段 → 输出字节,不发送。
 * 用于 server 层把构造好的字节交给 ws 发送。
 * 也可在测试或浏览器端本地组包验证时直接使用。
 */
function serializeAndReturn(msg: Message): Uint8Array {
  return marshalMessage(msg)
}

export function buildStartConnection(): Uint8Array {
  const msg = createMessage(
    MsgType.FullClientRequest,
    MsgTypeFlagBits.WithEvent,
  )
  msg.event = EventType.StartConnection
  msg.payload = new TextEncoder().encode('{}')
  return serializeAndReturn(msg)
}

export function buildFinishConnection(): Uint8Array {
  const msg = createMessage(
    MsgType.FullClientRequest,
    MsgTypeFlagBits.WithEvent,
  )
  msg.event = EventType.FinishConnection
  msg.payload = new TextEncoder().encode('{}')
  return serializeAndReturn(msg)
}

export function buildStartSession(
  payload: Uint8Array,
  sessionId: string,
): Uint8Array {
  const msg = createMessage(
    MsgType.FullClientRequest,
    MsgTypeFlagBits.WithEvent,
  )
  msg.event = EventType.StartSession
  msg.sessionId = sessionId
  msg.payload = payload
  return serializeAndReturn(msg)
}

export function buildFinishSession(sessionId: string): Uint8Array {
  const msg = createMessage(
    MsgType.FullClientRequest,
    MsgTypeFlagBits.WithEvent,
  )
  msg.event = EventType.FinishSession
  msg.sessionId = sessionId
  msg.payload = new TextEncoder().encode('{}')
  return serializeAndReturn(msg)
}

export function buildCancelSession(sessionId: string): Uint8Array {
  const msg = createMessage(
    MsgType.FullClientRequest,
    MsgTypeFlagBits.WithEvent,
  )
  msg.event = EventType.CancelSession
  msg.sessionId = sessionId
  msg.payload = new TextEncoder().encode('{}')
  return serializeAndReturn(msg)
}

export function buildTaskRequest(
  payload: Uint8Array,
  sessionId: string,
): Uint8Array {
  const msg = createMessage(
    MsgType.FullClientRequest,
    MsgTypeFlagBits.WithEvent,
  )
  msg.event = EventType.TaskRequest
  msg.sessionId = sessionId
  msg.payload = payload
  return serializeAndReturn(msg)
}

export function buildFullClientRequest(payload: Uint8Array): Uint8Array {
  const msg = createMessage(MsgType.FullClientRequest, MsgTypeFlagBits.NoSeq)
  msg.payload = payload
  return serializeAndReturn(msg)
}

export function buildAudioOnlyClient(
  payload: Uint8Array,
  flag: MsgTypeFlagBits,
): Uint8Array {
  const msg = createMessage(MsgType.AudioOnlyClient, flag)
  msg.payload = payload
  return serializeAndReturn(msg)
}
