/**
 * 协议层消息类型定义。
 * 与 Node 端 / 浏览器端运行时无关,纯枚举与数据结构。
 */
export enum EventType {
  None = 0,
  StartConnection = 1,
  FinishConnection = 2,
  ConnectionStarted = 50,
  ConnectionFailed = 51,
  ConnectionFinished = 52,
  StartSession = 100,
  CancelSession = 101,
  FinishSession = 102,
  SessionStarted = 150,
  SessionCanceled = 151,
  SessionFinished = 152,
  SessionFailed = 153,
  UsageResponse = 154,
  TaskRequest = 200,
  UpdateConfig = 201,
  AudioMuted = 250,
  SayHello = 300,
  TTSSentenceStart = 350,
  TTSSentenceEnd = 351,
  TTSResponse = 352,
  TTSEnded = 359,
  PodcastRoundStart = 360,
  PodcastRoundResponse = 361,
  PodcastRoundEnd = 362,
  ASRInfo = 450,
  ASRResponse = 451,
  ASREnded = 459,
  ChatTTSText = 500,
  ChatResponse = 550,
  ChatEnded = 559,
  SourceSubtitleStart = 650,
  SourceSubtitleResponse = 651,
  SourceSubtitleEnd = 652,
  TranslationSubtitleStart = 653,
  TranslationSubtitleResponse = 654,
  TranslationSubtitleEnd = 655,
}

export enum MsgType {
  Invalid = 0,
  FullClientRequest = 0b1,
  AudioOnlyClient = 0b10,
  FullServerResponse = 0b1001,
  AudioOnlyServer = 0b1011,
  FrontEndResultServer = 0b1100,
  Error = 0b1111,
}

export const MsgTypeServerACK = MsgType.AudioOnlyServer

export enum MsgTypeFlagBits {
  NoSeq = 0,
  PositiveSeq = 0b1,
  LastNoSeq = 0b10,
  NegativeSeq = 0b11,
  WithEvent = 0b100,
}

export enum VersionBits {
  Version1 = 1,
  Version2 = 2,
  Version3 = 3,
  Version4 = 4,
}

export enum HeaderSizeBits {
  HeaderSize4 = 1,
  HeaderSize8 = 2,
  HeaderSize12 = 3,
  HeaderSize16 = 4,
}

export enum SerializationBits {
  Raw = 0,
  JSON = 0b1,
  Thrift = 0b11,
  Custom = 0b1111,
}

export enum CompressionBits {
  None = 0,
  Gzip = 0b1,
  Custom = 0b1111,
}

export interface Message {
  version: VersionBits
  headerSize: HeaderSizeBits
  type: MsgType
  flag: MsgTypeFlagBits
  serialization: SerializationBits
  compression: CompressionBits
  event?: EventType
  sessionId?: string
  connectId?: string
  sequence?: number
  errorCode?: number
  payload: Uint8Array
}

export function getEventTypeName(eventType: EventType): string {
  return EventType[eventType] || `invalid event type: ${eventType}`
}

export function getMsgTypeName(msgType: MsgType): string {
  return MsgType[msgType] || `invalid message type: ${msgType}`
}

export function messageToString(msg: Message): string {
  const eventStr =
    msg.event !== undefined ? getEventTypeName(msg.event) : 'NoEvent'
  const typeStr = getMsgTypeName(msg.type)

  switch (msg.type) {
    case MsgType.AudioOnlyServer:
    case MsgType.AudioOnlyClient:
      if (
        msg.flag === MsgTypeFlagBits.PositiveSeq ||
        msg.flag === MsgTypeFlagBits.NegativeSeq
      ) {
        return `MsgType: ${typeStr}, EventType: ${eventStr}, Sequence: ${msg.sequence}, PayloadSize: ${msg.payload.length}`
      }
      return `MsgType: ${typeStr}, EventType: ${eventStr}, PayloadSize: ${msg.payload.length}`

    case MsgType.Error:
      return `MsgType: ${typeStr}, EventType: ${eventStr}, ErrorCode: ${msg.errorCode}, Payload: ${new TextDecoder().decode(msg.payload)}`

    default:
      if (
        msg.flag === MsgTypeFlagBits.PositiveSeq ||
        msg.flag === MsgTypeFlagBits.NegativeSeq
      ) {
        return `MsgType: ${typeStr}, EventType: ${eventStr}, Sequence: ${msg.sequence}, Payload: ${new TextDecoder().decode(msg.payload)}`
      }
      return `MsgType: ${typeStr}, EventType: ${eventStr}, Payload: ${new TextDecoder().decode(msg.payload)}`
  }
}

export function createMessage(
  msgType: MsgType,
  flag: MsgTypeFlagBits,
): Message {
  const msg = {
    type: msgType,
    flag,
    version: VersionBits.Version1,
    headerSize: HeaderSizeBits.HeaderSize4,
    serialization: SerializationBits.JSON,
    compression: CompressionBits.None,
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

  return msg as Message
}
