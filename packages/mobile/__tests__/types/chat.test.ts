import {
  MessageRole,
  MessageType,
  ThinkingStep,
  SourceItem,
  ToolCall,
  ChatMessage,
  ModelOption,
  ModeOption,
  PersonaOption,
} from '@/types/chat';

describe('chat types', () => {
  describe('MessageRole', () => {
    test('MessageRole 是 "user" | "ai"', () => {
      const role: MessageRole = 'user';
      expect(role).toBe('user');

      const aiRole: MessageRole = 'ai';
      expect(aiRole).toBe('ai');
    });
  });

  describe('MessageType', () => {
    test('MessageType 是 "text" | "thinking" | "tool-call" | "tool-result"', () => {
      const types: MessageType[] = ['text', 'thinking', 'tool-call', 'tool-result'];
      types.forEach((t) => expect(t).toBeDefined());
    });
  });

  describe('ThinkingStep', () => {
    test('ThinkingStep 包含 step 和 content', () => {
      const step: ThinkingStep = { step: 1, content: '思考中...' };
      expect(step.step).toBe(1);
      expect(step.content).toBe('思考中...');
    });
  });

  describe('SourceItem', () => {
    test('SourceItem 包含 index, title, url', () => {
      const source: SourceItem = { index: 0, title: '示例', url: 'https://example.com' };
      expect(source.index).toBe(0);
      expect(source.title).toBe('示例');
      expect(source.url).toBe('https://example.com');
    });
  });

  describe('ToolCall', () => {
    test('ToolCall 包含 name 和 description', () => {
      const toolCall: ToolCall = { name: 'search', description: '搜索工具' };
      expect(toolCall.name).toBe('search');
      expect(toolCall.description).toBe('搜索工具');
    });

    test('ToolCall 的 sources 是可选的', () => {
      const toolCallWithoutSources: ToolCall = { name: 'search', description: '搜索工具' };
      expect(toolCallWithoutSources.sources).toBeUndefined();

      const toolCallWithSources: ToolCall = {
        name: 'search',
        description: '搜索工具',
        sources: [{ index: 0, title: '结果', url: 'https://example.com' }],
      };
      expect(toolCallWithSources.sources).toHaveLength(1);
    });
  });

  describe('ChatMessage', () => {
    test('ChatMessage 必须包含所有必填字段', () => {
      const message: ChatMessage = {
        id: 'msg-1',
        role: 'user',
        type: 'text',
        content: '你好',
        timestamp: '10:30',
      };

      expect(message.id).toBe('msg-1');
      expect(message.role).toBe('user');
      expect(message.type).toBe('text');
      expect(message.content).toBe('你好');
      expect(message.timestamp).toBe('10:30');
    });

    test('ChatMessage 可选字段 thinkingSteps', () => {
      const message: ChatMessage = {
        id: 'msg-2',
        role: 'ai',
        type: 'thinking',
        content: '思考中...',
        timestamp: '10:31',
        thinkingSteps: [
          { step: 1, content: '第一步' },
          { step: 2, content: '第二步' },
        ],
      };

      expect(message.thinkingSteps).toHaveLength(2);
      expect(message.thinkingSteps?.[0].step).toBe(1);
    });

    test('ChatMessage 可选字段 toolCall', () => {
      const message: ChatMessage = {
        id: 'msg-3',
        role: 'ai',
        type: 'tool-call',
        content: '调用工具',
        timestamp: '10:32',
        toolCall: {
          name: 'search',
          description: '搜索工具',
          sources: [{ index: 0, title: '来源', url: 'https://example.com' }],
        },
      };

      expect(message.toolCall).toBeDefined();
      expect(message.toolCall?.name).toBe('search');
    });

    test('ChatMessage 可选字段 isStreaming', () => {
      const message: ChatMessage = {
        id: 'msg-4',
        role: 'ai',
        type: 'text',
        content: '流式响应',
        timestamp: '10:33',
        isStreaming: true,
      };

      expect(message.isStreaming).toBe(true);
    });

    test('ChatMessage 可同时包含多个可选字段', () => {
      const message: ChatMessage = {
        id: 'msg-5',
        role: 'ai',
        type: 'text',
        content: '完整消息',
        timestamp: '10:34',
        thinkingSteps: [{ step: 1, content: '思考' }],
        toolCall: { name: 'tool', description: '工具' },
        isStreaming: false,
      };

      expect(message.thinkingSteps).toBeDefined();
      expect(message.toolCall).toBeDefined();
      expect(message.isStreaming).toBe(false);
    });
  });

  describe('ModelOption', () => {
    test('ModelOption 包含所有必填字段', () => {
      const model: ModelOption = {
        id: 'claude-3-5',
        name: 'Claude 3.5',
        description: '最新模型',
        iconColor: '#ffffff',
        iconBg: '#000000',
      };

      expect(model.id).toBe('claude-3-5');
      expect(model.name).toBe('Claude 3.5');
    });

    test('ModelOption 的可选字段 tag, tagColor, isPro', () => {
      const model: ModelOption = {
        id: 'claude-3',
        name: 'Claude 3',
        description: '稳定版',
        iconColor: '#ffffff',
        iconBg: '#000000',
        tag: '稳定',
        tagColor: '#00ff00',
        isPro: true,
      };

      expect(model.tag).toBe('稳定');
      expect(model.tagColor).toBe('#00ff00');
      expect(model.isPro).toBe(true);
    });
  });

  describe('ModeOption', () => {
    test('ModeOption 包含所有必填字段', () => {
      const mode: ModeOption = {
        id: 'fast',
        name: '快速模式',
        description: '响应更快',
        iconColor: '#ffffff',
        iconBg: '#000000',
      };

      expect(mode.id).toBe('fast');
      expect(mode.name).toBe('快速模式');
    });
  });

  describe('PersonaOption', () => {
    test('PersonaOption 包含所有必填字段', () => {
      const persona: PersonaOption = {
        id: 'assistant',
        name: '助手',
        description: '默认助手人格',
        avatar: 'A',
        avatarBg: '#000000',
        avatarColor: '#ffffff',
      };

      expect(persona.id).toBe('assistant');
      expect(persona.name).toBe('助手');
      expect(persona.avatar).toBe('A');
      expect(persona.avatarBg).toBe('#000000');
      expect(persona.avatarColor).toBe('#ffffff');
    });
  });
});
