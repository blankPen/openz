/**
 * 火山引擎 v3 双向通信协议层。
 *
 * 纯函数模块,不依赖 Node 端运行时;浏览器和 Node 都可使用。
 * 不发送 WebSocket 帧,只构造和解析字节;ws 收发由 server 层负责。
 */

// 消息类型与枚举
export {
  EventType,
  MsgType,
  MsgTypeServerACK,
  MsgTypeFlagBits,
  VersionBits,
  HeaderSizeBits,
  SerializationBits,
  CompressionBits,
  type Message,
  getEventTypeName,
  getMsgTypeName,
  messageToString,
  createMessage,
} from './messages.js'

// 编解码
export { marshalMessage, unmarshalMessage } from './codec.js'

// 帧构造
export {
  buildStartConnection,
  buildFinishConnection,
  buildStartSession,
  buildFinishSession,
  buildCancelSession,
  buildTaskRequest,
  buildFullClientRequest,
  buildAudioOnlyClient,
} from './frame.js'
