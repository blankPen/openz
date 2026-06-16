import { useState } from 'react';
import { socket } from './socket';
import { useSocket, useSessions } from './hooks/useSocket';
import type { Session } from './types';
import { ChatView } from './components/ChatView';
import './styles/app.css';

export function App() {
  const connected = useSocket();
  const { sessions, refresh } = useSessions();
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);

  const createSession = () => {
    socket.emit(
      'session:create',
      { cwd: '/tmp' },
      (res: { session?: Session; error?: string }) => {
        if (res.error) {
          console.error(res.error);
          return;
        }
        if (res.session) {
          refresh();
          setActiveSessionId(res.session.id);
        }
      },
    );
  };

  const statusClass = connected ? 'connected' : 'disconnected';
  const statusText = connected ? 'Connected' : 'Disconnected';

  if (activeSessionId) {
    return <ChatView sessionId={activeSessionId} onBack={() => setActiveSessionId(null)} />;
  }

  return (
    <div className="app">
      <header className="app-header">
        <h1 className="app-header__title">Uran</h1>
        <span className="app-header__subtitle">Claude Code Remote Control</span>
        <span className={`app-header__status ${statusClass}`}>{statusText}</span>
      </header>

      <main className="app-main">
        <aside className="sidebar">
          <div className="sidebar-header">
            <span>Sessions</span>
            <button className="new-session-btn" onClick={createSession}>+ New</button>
          </div>
          <div className="sessions-list">
            {sessions.map(session => (
              <div
                key={session.id}
                className="session-item"
                onClick={() => setActiveSessionId(session.id)}
              >
                <div className="session-item__top">
                  <span>{session.id.slice(0, 8)}…</span>
                  <span className={`status-badge ${session.status}`}>{session.status}</span>
                </div>
                <span className="session-item__engine">{session.engine}</span>
                <span className="session-item__cwd">{session.cwd}</span>
              </div>
            ))}
            {sessions.length === 0 && (
              <div className="empty-state">
                <div className="empty-state-icon">💬</div>
                <div>No sessions yet</div>
              </div>
            )}
          </div>
        </aside>

        <section className="welcome-area">
          <div className="empty-state">
            <div className="empty-state-icon">💬</div>
            <div>Select a session or create a new one</div>
          </div>
        </section>
      </main>
    </div>
  );
}
