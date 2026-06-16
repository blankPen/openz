import { useEffect, useRef, useState, type RefObject } from 'react';
import { socket } from '../socket';
import type { AgentEvent, Session } from '../types';

export function useSocket() {
  const [connected, setConnected] = useState(socket.connected);

  useEffect(() => {
    socket.connect();
    const onConnect = () => setConnected(true);
    const onDisconnect = () => setConnected(false);
    socket.on('connect', onConnect);
    socket.on('disconnect', onDisconnect);
    return () => {
      socket.off('connect', onConnect);
      socket.off('disconnect', onDisconnect);
    };
  }, []);

  return connected;
}

export function useSessions() {
  const [sessions, setSessions] = useState<Session[]>([]);

  const refresh = () => {
    socket.emit('session:list', {}, (res: { sessions?: Session[]; error?: string }) => {
      if (!res.error && res.sessions) setSessions(res.sessions);
    });
  };

  useEffect(() => {
    refresh();
    socket.on('session:created', () => refresh());
    return () => {
      socket.off('session:created');
    };
  }, []);

  return { sessions, refresh };
}

export function useSessionEvents(
  sessionId: string | null,
  onEvent: (event: AgentEvent) => void,
  scrollRef?: RefObject<HTMLDivElement | null>,
) {
  const onEventRef = useRef(onEvent);
  onEventRef.current = onEvent;

  useEffect(() => {
    if (!sessionId) return;

    const handler = (data: { sessionId: string; event: AgentEvent }) => {
      if (data.sessionId === sessionId) {
        onEventRef.current(data.event);
        // Auto-scroll on new events
        scrollRef?.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
      }
    };

    socket.on('session:event', handler);
    return () => { socket.off('session:event', handler); };
  }, [sessionId, scrollRef]);
}
