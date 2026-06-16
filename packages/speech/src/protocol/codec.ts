import {
  type Message,
  MsgType,
  MsgTypeFlagBits,
  messageToString,
  EventType,
} from './messages.js'

/**
 * 协议层编解码。
 * 纯函数:输入 Message 输出字节数组,或反向。
 * 不依赖 Node 端 Buffer,内部使用 TextEncoder/TextDecoder + Uint8Array。
 */
export function marshalMessage(msg: Message): Uint8Array {
  const buffers: Uint8Array[] = []

  const headerSize = 4 * msg.headerSize
  const header = new Uint8Array(headerSize)

  header[0] = (msg.version << 4) | msg.headerSize
  header[1] = (msg.type << 4) | msg.flag
  header[2] = (msg.serialization << 4) | msg.compression

  buffers.push(header)

  const writers = getWriters(msg)
  for (const writer of writers) {
    const data = writer(msg)
    if (data) buffers.push(data)
  }

  const totalLength = buffers.reduce((sum, buf) => sum + buf.length, 0)
  const result = new Uint8Array(totalLength)
  let offset = 0

  for (const buf of buffers) {
    result.set(buf, offset)
    offset += buf.length
  }

  return result
}

export function unmarshalMessage(data: Uint8Array): Message {
  if (data.length < 3) {
    throw new Error(
      `data too short: expected at least 3 bytes, got ${data.length}`,
    )
  }

  let offset = 0

  const versionAndHeaderSize = data[offset++]
  const typeAndFlag = data[offset++]
  const serializationAndCompression = data[offset++]

  const msg = {
    version: ((versionAndHeaderSize >> 4) & 0b1111) as Message['version'],
    headerSize: (versionAndHeaderSize & 0b00001111) as Message['headerSize'],
    type: ((typeAndFlag >> 4) & 0b1111) as Message['type'],
    flag: (typeAndFlag & 0b00001111) as Message['flag'],
    serialization: ((serializationAndCompression >> 4) & 0b1111) as Message['serialization'],
    compression: (serializationAndCompression & 0b00001111) as Message['compression'],
    payload: new Uint8Array(0),
  }

  Object.defineProperty(msg, 'toString', {
    enumerable: false,
    configurable: true,
    writable: true,
    value: function () {
      return messageToString(this)
    },
  })

  offset = 4 * msg.headerSize

  const readers = getReaders(msg as Message)
  for (const reader of readers) {
    offset = reader(msg as Message, data, offset)
  }

  return msg as Message
}

function getWriters(
  msg: Message,
): Array<(msg: Message) => Uint8Array | null> {
  const writers: Array<(msg: Message) => Uint8Array | null> = []

  if (msg.flag === MsgTypeFlagBits.WithEvent) {
    writers.push(writeEvent, writeSessionId)
  }

  switch (msg.type) {
    case MsgType.AudioOnlyClient:
    case MsgType.AudioOnlyServer:
    case MsgType.FrontEndResultServer:
    case MsgType.FullClientRequest:
    case MsgType.FullServerResponse:
      if (
        msg.flag === MsgTypeFlagBits.PositiveSeq ||
        msg.flag === MsgTypeFlagBits.NegativeSeq
      ) {
        writers.push(writeSequence)
      }
      break
    case MsgType.Error:
      writers.push(writeErrorCode)
      break
    default:
      throw new Error(`unsupported message type: ${msg.type}`)
  }

  writers.push(writePayload)
  return writers
}

function getReaders(
  msg: Message,
): Array<(msg: Message, data: Uint8Array, offset: number) => number> {
  const readers: Array<
    (msg: Message, data: Uint8Array, offset: number) => number
  > = []

  switch (msg.type) {
    case MsgType.AudioOnlyClient:
    case MsgType.AudioOnlyServer:
    case MsgType.FrontEndResultServer:
    case MsgType.FullClientRequest:
    case MsgType.FullServerResponse:
      if (
        msg.flag === MsgTypeFlagBits.PositiveSeq ||
        msg.flag === MsgTypeFlagBits.NegativeSeq
      ) {
        readers.push(readSequence)
      }
      break
    case MsgType.Error:
      readers.push(readErrorCode)
      break
    default:
      throw new Error(`unsupported message type: ${msg.type}`)
  }

  if (msg.flag === MsgTypeFlagBits.WithEvent) {
    readers.push(readEvent, readSessionId, readConnectId)
  }

  readers.push(readPayload)
  return readers
}

function writeEvent(msg: Message): Uint8Array | null {
  if (msg.event === undefined) return null
  const buffer = new ArrayBuffer(4)
  const view = new DataView(buffer)
  view.setInt32(0, msg.event, false)
  return new Uint8Array(buffer)
}

function writeSessionId(msg: Message): Uint8Array | null {
  if (msg.event === undefined) return null

  switch (msg.event) {
    case EventType.StartConnection:
    case EventType.FinishConnection:
    case EventType.ConnectionStarted:
    case EventType.ConnectionFailed:
      return null
  }

  const sessionId = msg.sessionId || ''
  const sessionIdBytes = new TextEncoder().encode(sessionId)
  const sizeBuffer = new ArrayBuffer(4)
  const sizeView = new DataView(sizeBuffer)
  sizeView.setUint32(0, sessionIdBytes.length, false)

  const result = new Uint8Array(4 + sessionIdBytes.length)
  result.set(new Uint8Array(sizeBuffer), 0)
  result.set(sessionIdBytes, 4)

  return result
}

function writeSequence(msg: Message): Uint8Array | null {
  if (msg.sequence === undefined) return null
  const buffer = new ArrayBuffer(4)
  const view = new DataView(buffer)
  view.setInt32(0, msg.sequence, false)
  return new Uint8Array(buffer)
}

function writeErrorCode(msg: Message): Uint8Array | null {
  if (msg.errorCode === undefined) return null
  const buffer = new ArrayBuffer(4)
  const view = new DataView(buffer)
  view.setUint32(0, msg.errorCode, false)
  return new Uint8Array(buffer)
}

function writePayload(msg: Message): Uint8Array | null {
  const payloadSize = msg.payload.length
  const sizeBuffer = new ArrayBuffer(4)
  const sizeView = new DataView(sizeBuffer)
  sizeView.setUint32(0, payloadSize, false)

  const result = new Uint8Array(4 + payloadSize)
  result.set(new Uint8Array(sizeBuffer), 0)
  result.set(msg.payload, 4)

  return result
}

function readEvent(msg: Message, data: Uint8Array, offset: number): number {
  if (offset + 4 > data.length) {
    throw new Error('insufficient data for event')
  }
  const view = new DataView(data.buffer, data.byteOffset + offset, 4)
  msg.event = view.getInt32(0, false)
  return offset + 4
}

function readSessionId(msg: Message, data: Uint8Array, offset: number): number {
  if (msg.event === undefined) return offset

  switch (msg.event) {
    case EventType.StartConnection:
    case EventType.FinishConnection:
    case EventType.ConnectionStarted:
    case EventType.ConnectionFailed:
    case EventType.ConnectionFinished:
      return offset
  }

  if (offset + 4 > data.length) {
    throw new Error('insufficient data for session ID size')
  }

  const view = new DataView(data.buffer, data.byteOffset + offset, 4)
  const size = view.getUint32(0, false)
  offset += 4

  if (size > 0) {
    if (offset + size > data.length) {
      throw new Error('insufficient data for session ID')
    }
    msg.sessionId = new TextDecoder().decode(data.slice(offset, offset + size))
    offset += size
  }

  return offset
}

function readConnectId(msg: Message, data: Uint8Array, offset: number): number {
  if (msg.event === undefined) return offset

  switch (msg.event) {
    case EventType.ConnectionStarted:
    case EventType.ConnectionFailed:
    case EventType.ConnectionFinished:
      break
    default:
      return offset
  }

  if (offset + 4 > data.length) {
    throw new Error('insufficient data for connect ID size')
  }

  const view = new DataView(data.buffer, data.byteOffset + offset, 4)
  const size = view.getUint32(0, false)
  offset += 4

  if (size > 0) {
    if (offset + size > data.length) {
      throw new Error('insufficient data for connect ID')
    }
    msg.connectId = new TextDecoder().decode(data.slice(offset, offset + size))
    offset += size
  }

  return offset
}

function readSequence(msg: Message, data: Uint8Array, offset: number): number {
  if (offset + 4 > data.length) {
    throw new Error('insufficient data for sequence')
  }
  const view = new DataView(data.buffer, data.byteOffset + offset, 4)
  msg.sequence = view.getInt32(0, false)
  return offset + 4
}

function readErrorCode(msg: Message, data: Uint8Array, offset: number): number {
  if (offset + 4 > data.length) {
    throw new Error('insufficient data for error code')
  }
  const view = new DataView(data.buffer, data.byteOffset + offset, 4)
  msg.errorCode = view.getUint32(0, false)
  return offset + 4
}

function readPayload(msg: Message, data: Uint8Array, offset: number): number {
  if (offset + 4 > data.length) {
    throw new Error('insufficient data for payload size')
  }

  const view = new DataView(data.buffer, data.byteOffset + offset, 4)
  const size = view.getUint32(0, false)
  offset += 4

  if (size > 0) {
    if (offset + size > data.length) {
      throw new Error('insufficient data for payload')
    }
    msg.payload = data.slice(offset, offset + size)
    offset += size
  }

  return offset
}
