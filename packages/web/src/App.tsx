import { useState, useEffect } from 'react';
import type { ReactNode } from 'react';
import { HomeScreen } from './screens/HomeScreen';
import { ConversationScreen } from './screens/ConversationScreen';
import { SettingsScreen } from './screens/SettingsScreen';
import { ModelSwitchModal } from './components/ModelSwitchModal';
import { AttachmentModal } from './components/AttachmentModal';
import './styles/app.css';

export type Screen = 'home' | 'conversation' | 'settings';

function getScreenFromHash(): Screen {
  const hash = window.location.hash.replace('#', '');
  if (hash === 'conversation' || hash === 'settings') return hash;
  return 'home';
}

export function App() {
  const [screen, setScreen] = useState<Screen>(getScreenFromHash);
  const [showModelSwitch, setShowModelSwitch] = useState(false);
  const [showAttachment, setShowAttachment] = useState(false);
  const [activeSessionTitle] = useState('AI Agent 产品分析报告');

  useEffect(() => {
    const handler = () => setScreen(getScreenFromHash());
    window.addEventListener('hashchange', handler);
    return () => window.removeEventListener('hashchange', handler);
  }, []);

  const navigateTo = (s: Screen) => {
    window.location.hash = s;
    setScreen(s);
    setShowModelSwitch(false);
    setShowAttachment(false);
  };

  return (
    <>
      <div className="app">
        {/* Sidebar */}
        <Sidebar
          screen={screen}
          onNavigate={navigateTo}
          activeSessionTitle={screen === 'conversation' ? activeSessionTitle : undefined}
        />

        {/* Main content */}
        {screen === 'home' && (
          <HomeScreen
            onOpenModelSwitch={() => setShowModelSwitch(true)}
            onOpenAttachment={() => setShowAttachment(true)}
          />
        )}
        {screen === 'conversation' && (
          <ConversationScreen
            sessionTitle={activeSessionTitle}
            onOpenModelSwitch={() => setShowModelSwitch(true)}
            onOpenAttachment={() => setShowAttachment(true)}
          />
        )}
        {screen === 'settings' && (
          <SettingsScreen onBack={() => navigateTo('home')} />
        )}
      </div>

      {/* Modals */}
      {showModelSwitch && (
        <ModelSwitchModal onClose={() => setShowModelSwitch(false)} />
      )}
      {showAttachment && (
        <AttachmentModal onClose={() => setShowAttachment(false)} />
      )}
    </>
  );
}

// ── Sidebar ────────────────────────────────────────────────

interface SidebarProps {
  screen: Screen;
  onNavigate: (s: Screen) => void;
  activeSessionTitle?: string;
}

function Sidebar({ screen, onNavigate, activeSessionTitle }: SidebarProps) {
  const [projectsCollapsed, setProjectsCollapsed] = useState(false);

  return (
    <aside className="sidebar">
      <div className="sidebar-header">
        <div className="logo">
          <div className="logo-icon">Z</div>
          <span>OpenZ</span>
        </div>
        <button className="sidebar-toggle" aria-label="收起侧栏">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <line x1="4" y1="7" x2="20" y2="7"/>
            <line x1="4" y1="12" x2="20" y2="12"/>
            <line x1="4" y1="17" x2="20" y2="17"/>
          </svg>
        </button>
      </div>

      <button className="new-chat" onClick={() => onNavigate('conversation')}>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round">
          <line x1="12" y1="5" x2="12" y2="19"/>
          <line x1="5" y1="12" x2="19" y2="12"/>
        </svg>
        新建会话
      </button>

      <div className="search">
        <span className="search-icon">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="11" cy="11" r="8"/>
            <line x1="21" y1="21" x2="16.65" y2="16.65"/>
          </svg>
        </span>
        <input type="text" placeholder="搜索会话…" />
      </div>

      <nav className="sidebar-nav">
        <div className="nav-section">
          <div className="nav-item" onClick={() => onNavigate('home')}>
            <svg className="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="3"/>
              <path d="M12 1v6m0 6v6M4.22 4.22l4.24 4.24m7.07 7.07l4.25 4.25M1 12h6m6 0h6M4.22 19.78l4.24-4.24m7.07-7.07l4.25-4.25"/>
            </svg>
            <span className="text">通用 Agent</span>
          </div>
          <div className="nav-item">
            <svg className="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="3" width="18" height="18" rx="2"/>
              <line x1="3" y1="9" x2="21" y2="9"/>
              <line x1="9" y1="3" x2="9" y2="21"/>
            </svg>
            <span className="text">一键 PPT</span>
          </div>
          <div className="nav-item">
            <svg className="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polygon points="13,2 3,14 12,14 11,22 21,10 12,10"/>
            </svg>
            <span className="text">自动化工作流</span>
          </div>
        </div>

        <div className="nav-section">
          <div className="nav-section-title">
            <span>项目</span>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" onClick={() => setProjectsCollapsed(c => !c)}>
              <line x1="12" y1="5" x2="12" y2="19"/>
              <line x1="5" y1="12" x2="19" y2="12"/>
            </svg>
          </div>

          <div className={`project-group ${projectsCollapsed ? 'collapsed' : ''}`}>
            <div className="project-header" onClick={() => setProjectsCollapsed(c => !c)}>
              <svg className="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round">
                <path d="M3 7l9-4 9 4v10l-9 4-9-4V7z"/>
              </svg>
              <span>演示项目</span>
              <span className="count">3</span>
              <svg className="chev" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polyline points="6,9 12,15 18,9"/>
              </svg>
            </div>
            <div className="project-children">
              <div className={`nav-item ${screen === 'conversation' && activeSessionTitle === 'AI Agent 产品分析报告' ? 'active' : ''}`} onClick={() => onNavigate('conversation')}>
                <span className="text">AI Agent 产品分析报告</span>
              </div>
              <div className="nav-item">
                <span className="text">竞品功能矩阵整理</span>
              </div>
              <div className="nav-item">
                <span className="text">投资人路演稿改写</span>
              </div>
            </div>
          </div>

          <div className="project-group collapsed">
            <div className="project-header" onClick={() => {}}>
              <svg className="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round">
                <path d="M3 7l9-4 9 4v10l-9 4-9-4V7z"/>
              </svg>
              <span>内部工具</span>
              <span className="count">2</span>
              <svg className="chev" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polyline points="6,9 12,15 18,9"/>
              </svg>
            </div>
          </div>
        </div>

        <div className="nav-section">
          <div className="nav-section-title"><span>最近</span></div>
          <div className="nav-item" onClick={() => onNavigate('conversation')}>
            <svg className="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/>
            </svg>
            <span className="text">推荐三本产品书</span>
          </div>
          <div className="nav-item">
            <svg className="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/>
            </svg>
            <span className="text">翻译这封英文邮件</span>
          </div>
          <div className="nav-item">
            <svg className="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/>
            </svg>
            <span className="text">季度营销文案</span>
          </div>
        </div>
      </nav>

      <div className="sidebar-footer">
        <div className="user-avatar">A</div>
        <div className="user-info">
          <div className="user-name">Alex</div>
          <div className="user-plan">OpenZ Pro</div>
        </div>
        <button className="icon-btn" aria-label="设置" onClick={() => onNavigate('settings')}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="3"/>
            <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 01-2.83 2.83l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06a1.65 1.65 0 00.33-1.82 1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06a1.65 1.65 0 001.82.33H9a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06a1.65 1.65 0 00-.33 1.82V9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z"/>
          </svg>
        </button>
      </div>
    </aside>
  );
}
