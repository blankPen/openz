import { create } from 'zustand';
import { MMKV } from 'react-native-mmkv';
import type { ChatMessage } from '../types/chat';

const STORAGE_KEY = 'openz-mobile-chat-v1';
const storage = new MMKV({ id: 'openz-chat' });

export type ChatState = 'idle' | 'loading' | 'streaming' | 'error';

export interface Conversation {
  id: string;
  title: string;
  messages: ChatMessage[];
  createdAt: number;
  updatedAt: number;
}

type Persisted = {
  activeConversationId: string | null;
  conversations: Record<string, Conversation>;
};

const DEFAULTS: Persisted = {
  activeConversationId: null,
  conversations: {},
};

function loadInitial(): Persisted {
  const raw = storage.getString(STORAGE_KEY);
  if (!raw) return DEFAULTS;
  try {
    return { ...DEFAULTS, ...JSON.parse(raw) };
  } catch {
    return DEFAULTS;
  }
}

type ChatStoreState = Persisted & {
  // chat state
  chatState: ChatState;
  // actions
  setChatState: (s: ChatState) => void;
  setActiveConversation: (id: string | null) => void;
  createConversation: () => string;
  deleteConversation: (id: string) => void;
  renameConversation: (id: string, title: string) => void;
  addMessage: (conversationId: string, message: ChatMessage) => void;
  updateMessage: (conversationId: string, messageId: string, updates: Partial<ChatMessage>) => void;
  removeMessage: (conversationId: string, messageId: string) => void;
  clearMessages: (conversationId: string) => void;
};

function persist(state: Persisted) {
  storage.set(
    STORAGE_KEY,
    JSON.stringify({
      activeConversationId: state.activeConversationId,
      conversations: state.conversations,
    }),
  );
}

function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

export const useChatStore = create<ChatStoreState>((set, get) => ({
  ...loadInitial(),
  chatState: 'idle',

  setChatState: (chatState) => set({ chatState }),

  setActiveConversation: (activeConversationId) => {
    set({ activeConversationId });
    persist(get());
  },

  createConversation: () => {
    const id = generateId();
    const now = Date.now();
    const conversation: Conversation = {
      id,
      title: '新对话',
      messages: [],
      createdAt: now,
      updatedAt: now,
    };
    set((state) => ({
      activeConversationId: id,
      conversations: { ...state.conversations, [id]: conversation },
    }));
    persist(get());
    return id;
  },

  deleteConversation: (id) => {
    set((state) => {
      const { [id]: _removed, ...rest } = state.conversations;
      const activeConversationId =
        state.activeConversationId === id ? null : state.activeConversationId;
      return { conversations: rest, activeConversationId };
    });
    persist(get());
  },

  renameConversation: (id, title) => {
    set((state) => {
      if (!state.conversations[id]) return state;
      return {
        conversations: {
          ...state.conversations,
          [id]: { ...state.conversations[id], title, updatedAt: Date.now() },
        },
      };
    });
    persist(get());
  },

  addMessage: (conversationId, message) => {
    set((state) => {
      const conv = state.conversations[conversationId];
      if (!conv) return state;
      return {
        chatState: message.role === 'user' ? 'idle' : state.chatState,
        conversations: {
          ...state.conversations,
          [conversationId]: {
            ...conv,
            messages: [...conv.messages, message],
            updatedAt: Date.now(),
          },
        },
      };
    });
    persist(get());
  },

  updateMessage: (conversationId, messageId, updates) => {
    set((state) => {
      const conv = state.conversations[conversationId];
      if (!conv) return state;
      return {
        conversations: {
          ...state.conversations,
          [conversationId]: {
            ...conv,
            messages: conv.messages.map((m) =>
              m.id === messageId ? { ...m, ...updates } : m,
            ),
            updatedAt: Date.now(),
          },
        },
      };
    });
    persist(get());
  },

  removeMessage: (conversationId, messageId) => {
    set((state) => {
      const conv = state.conversations[conversationId];
      if (!conv) return state;
      return {
        conversations: {
          ...state.conversations,
          [conversationId]: {
            ...conv,
            messages: conv.messages.filter((m) => m.id !== messageId),
            updatedAt: Date.now(),
          },
        },
      };
    });
    persist(get());
  },

  clearMessages: (conversationId) => {
    set((state) => {
      const conv = state.conversations[conversationId];
      if (!conv) return state;
      return {
        conversations: {
          ...state.conversations,
          [conversationId]: { ...conv, messages: [], updatedAt: Date.now() },
        },
      };
    });
    persist(get());
  },
}));
