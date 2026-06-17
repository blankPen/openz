// mock MMKV
jest.mock('react-native-mmkv', () => {
  const store: Record<string, string> = {};
  return {
    MMKV: jest.fn().mockImplementation(() => ({
      set: (k: string, v: string) => {
        store[k] = v;
      },
      getString: (k: string) => store[k],
      delete: (k: string) => {
        delete store[k];
      },
    })),
  };
});

import { useChatStore } from '../../src/stores/chatStore';
import type { ChatMessage } from '../../src/types/chat';

const makeMsg = (overrides: Partial<ChatMessage> = {}): ChatMessage => ({
  id: Math.random().toString(36).slice(2),
  role: 'user',
  type: 'text',
  content: 'hello',
  timestamp: '12:00',
  ...overrides,
});

describe('chatStore', () => {
  beforeEach(() => {
    useChatStore.setState({
      activeConversationId: null,
      conversations: {},
      chatState: 'idle',
    });
  });

  describe('createConversation', () => {
    test('创建新对话并设为活跃', () => {
      const id = useChatStore.getState().createConversation();
      expect(id).toBeTruthy();
      expect(useChatStore.getState().activeConversationId).toBe(id);
      expect(useChatStore.getState().conversations[id]).toMatchObject({
        id,
        title: '新对话',
        messages: [],
      });
    });
  });

  describe('deleteConversation', () => {
    test('删除对话并清除活跃状态', () => {
      const id = useChatStore.getState().createConversation();
      useChatStore.getState().deleteConversation(id);
      expect(useChatStore.getState().conversations[id]).toBeUndefined();
      expect(useChatStore.getState().activeConversationId).toBeNull();
    });

    test('删除非活跃对话不影响其他对话', () => {
      const id1 = useChatStore.getState().createConversation();
      const id2 = useChatStore.getState().createConversation();
      useChatStore.getState().deleteConversation(id1);
      expect(useChatStore.getState().conversations[id2]).toBeDefined();
      expect(useChatStore.getState().activeConversationId).toBe(id2);
    });
  });

  describe('renameConversation', () => {
    test('重命名对话标题', () => {
      const id = useChatStore.getState().createConversation();
      useChatStore.getState().renameConversation(id, '我的新标题');
      expect(useChatStore.getState().conversations[id].title).toBe('我的新标题');
    });
  });

  describe('addMessage', () => {
    test('向对话添加消息', () => {
      const id = useChatStore.getState().createConversation();
      const msg = makeMsg({ id: 'msg1', role: 'user', content: 'hi' });
      useChatStore.getState().addMessage(id, msg);
      expect(useChatStore.getState().conversations[id].messages).toHaveLength(1);
      expect(useChatStore.getState().conversations[id].messages[0].content).toBe('hi');
    });

    test('用户消息后 chatState 保持 idle', () => {
      const id = useChatStore.getState().createConversation();
      useChatStore.setState({ chatState: 'streaming' });
      useChatStore.getState().addMessage(id, makeMsg({ role: 'user' }));
      expect(useChatStore.getState().chatState).toBe('idle');
    });
  });

  describe('updateMessage', () => {
    test('更新已有消息', () => {
      const id = useChatStore.getState().createConversation();
      const msg = makeMsg({ id: 'msg1', content: 'old' });
      useChatStore.getState().addMessage(id, msg);
      useChatStore.getState().updateMessage(id, 'msg1', { content: 'new' });
      expect(useChatStore.getState().conversations[id].messages[0].content).toBe('new');
    });

    test('更新流式状态', () => {
      const id = useChatStore.getState().createConversation();
      const msg = makeMsg({ id: 'msg1', isStreaming: false });
      useChatStore.getState().addMessage(id, msg);
      useChatStore.getState().updateMessage(id, 'msg1', { isStreaming: true });
      expect(useChatStore.getState().conversations[id].messages[0].isStreaming).toBe(true);
    });
  });

  describe('removeMessage', () => {
    test('删除指定消息', () => {
      const id = useChatStore.getState().createConversation();
      useChatStore.getState().addMessage(id, makeMsg({ id: 'msg1' }));
      useChatStore.getState().addMessage(id, makeMsg({ id: 'msg2' }));
      useChatStore.getState().removeMessage(id, 'msg1');
      expect(useChatStore.getState().conversations[id].messages).toHaveLength(1);
      expect(useChatStore.getState().conversations[id].messages[0].id).toBe('msg2');
    });
  });

  describe('clearMessages', () => {
    test('清空对话消息', () => {
      const id = useChatStore.getState().createConversation();
      useChatStore.getState().addMessage(id, makeMsg());
      useChatStore.getState().addMessage(id, makeMsg());
      useChatStore.getState().clearMessages(id);
      expect(useChatStore.getState().conversations[id].messages).toHaveLength(0);
    });
  });

  describe('persistence (MMKV mock)', () => {
    test('createConversation 后冷启动能恢复', () => {
      useChatStore.getState().createConversation();
      jest.isolateModules(() => {
        const { useChatStore: fresh } = require('../../src/stores/chatStore');
        expect(Object.keys(fresh.getState().conversations)).toHaveLength(1);
      });
    });

    test('addMessage 后冷启动能恢复', () => {
      const id = useChatStore.getState().createConversation();
      useChatStore.getState().addMessage(id, makeMsg({ id: 'persist-msg', content: 'persisted' }));
      jest.isolateModules(() => {
        const { useChatStore: fresh } = require('../../src/stores/chatStore');
        expect(fresh.getState().conversations[id].messages[0].content).toBe('persisted');
      });
    });
  });
});
