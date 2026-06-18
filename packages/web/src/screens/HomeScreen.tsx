interface HomeScreenProps {
  onNewChat: () => void;
  onOpenModelSwitch: () => void;
  onOpenAttachment: () => void;
}

export function HomeScreen({ onNewChat, onOpenModelSwitch, onOpenAttachment }: HomeScreenProps) {
  return (
    <main className="main">
      <header className="topbar">
        <button className="model-pill" onClick={onOpenModelSwitch}>
          <svg className="bolt" viewBox="0 0 24 24" fill="currentColor">
            <path d="M13 2L3 14h7l-1 8 10-12h-7l1-8z"/>
          </svg>
          <span className="name">OpenZ</span>
          <span className="meta">K2.6 思考</span>
          <svg className="chev" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="4,2 8,6 4,10"/>
          </svg>
        </button>
        <div className="topbar-right">
          <button className="icon-btn" aria-label="语音播报">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polygon points="11,5 6,9 2,9 2,15 6,15 11,19"/>
              <path d="M15.54 8.46a5 5 0 010 7.07"/>
              <path d="M19.07 4.93a10 10 0 010 14.14"/>
            </svg>
          </button>
          <button className="icon-btn" aria-label="分享">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="18" cy="5" r="3"/>
              <circle cx="6" cy="12" r="3"/>
              <circle cx="18" cy="19" r="3"/>
              <line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/>
              <line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/>
            </svg>
          </button>
          <button className="icon-btn" aria-label="设置" onClick={() => {}}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="3"/>
              <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 01-2.83 2.83l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06a1.65 1.65 0 00.33-1.82 1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06a1.65 1.65 0 001.82.33H9a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06a1.65 1.65 0 00-.33 1.82V9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z"/>
            </svg>
          </button>
        </div>
      </header>

      <div className="content">
        <div className="content-inner">
          <section className="greeting-wrap">
            <svg className="greeting-avatar" viewBox="0 0 72 72">
              <defs>
                <linearGradient id="av1" x1="0" y1="0" x2="1" y2="1">
                  <stop offset="0" stopColor="#4A8BFF"/>
                  <stop offset="1" stopColor="#1A66FF"/>
                </linearGradient>
              </defs>
              <circle cx="36" cy="36" r="36" fill="url(#av1)"/>
              <path d="M 24 22 L 48 22 L 24 50 L 48 50" stroke="white" strokeWidth="3.5" fill="none" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            <h1 className="greeting-text">
              嗨 <span className="accent">Alex</span>，<br/>
              今天要和 <span className="accent">OpenZ</span> 一起做点什么？
            </h1>
            <p className="greeting-sub">写作、编程、分析、搜索——尽管问，带图也行</p>
          </section>

          <section className="recs">
            <div className="rec rec-blue">
              <div className="rec-icon">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polygon points="12,2 15,8.5 22,9.5 17,14.5 18.5,22 12,18.5 5.5,22 7,14.5 2,9.5 9,8.5"/>
                </svg>
              </div>
              <div className="rec-body">
                <div className="rec-title">升级 OpenZ Pro</div>
                <div className="rec-sub">解锁更长上下文与高级模型</div>
              </div>
            </div>

            <div className="rec rec-orange">
              <div className="rec-icon">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10"/>
                  <path d="M12 6v6l4 2"/>
                </svg>
              </div>
              <div className="rec-body">
                <div className="rec-title">双 11 创作大挑战</div>
                <div className="rec-sub">完成 5 个任务得会员月卡</div>
              </div>
            </div>

            <div className="rec rec-purple">
              <div className="rec-icon">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/>
                  <circle cx="12" cy="7" r="4"/>
                </svg>
              </div>
              <div className="rec-body">
                <div className="rec-title">让 OpenZ 扮演产品经理</div>
                <div className="rec-sub">用角色扮演梳理需求场景</div>
              </div>
            </div>
          </section>

          <section className="tools">
            <button className="tool">
              <div className="tool-icon" style={{ background: '#EAF1FF', color: '#1A66FF' }}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="3"/>
                  <path d="M12 1v6m0 6v6M4.22 4.22l4.24 4.24m7.07 7.07l4.25 4.25M1 12h6m6 0h6M4.22 19.78l4.24-4.24m7.07-7.07l4.25-4.25"/>
                </svg>
              </div>
              <span className="tool-name">通用 Agent</span>
            </button>
            <button className="tool">
              <div className="tool-icon" style={{ background: '#FFE8DB', color: '#FF7A45' }}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="3" width="18" height="18" rx="2"/>
                  <line x1="3" y1="9" x2="21" y2="9"/>
                  <line x1="9" y1="3" x2="9" y2="21"/>
                </svg>
              </div>
              <span className="tool-name">一键 PPT</span>
            </button>
            <button className="tool">
              <div className="tool-icon" style={{ background: '#F0E7FE', color: '#8B5CF6' }}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 2L2 7l10 5 10-5-10-5z"/>
                  <path d="M2 17l10 5 10-5"/>
                  <path d="M2 12l10 5 10-5"/>
                </svg>
              </div>
              <span className="tool-name">OpenZ Claw</span>
            </button>
            <button className="tool">
              <div className="tool-icon" style={{ background: '#E1F4E9', color: '#34A853' }}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M22 12h-4l-3 9L9 3l-3 9H2"/>
                </svg>
              </div>
              <span className="tool-name">健康助手</span>
            </button>
          </section>

          <div className="spacer" />
        </div>
      </div>

      <div className="input-zone">
        <div className="input-box">
          <textarea className="textfield" rows={2} placeholder="尽管问，带图也行" />
          <div className="input-actions">
            <div className="input-left">
              <button className="input-btn" aria-label="附件" onClick={onOpenAttachment}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                  <line x1="12" y1="5" x2="12" y2="19"/>
                  <line x1="5" y1="12" x2="19" y2="12"/>
                </svg>
              </button>
              <button className="input-btn" aria-label="语音输入">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 1a3 3 0 00-3 3v8a3 3 0 006 0V4a3 3 0 00-3-3z"/>
                  <path d="M19 10v2a7 7 0 01-14 0v-2"/>
                  <line x1="12" y1="19" x2="12" y2="23"/>
                  <line x1="8" y1="23" x2="16" y2="23"/>
                </svg>
              </button>
            </div>
            <div className="input-right">
              <button className="input-btn send" aria-label="发送">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="12" y1="19" x2="12" y2="5"/>
                  <polyline points="6,11 12,5 18,11"/>
                </svg>
              </button>
            </div>
          </div>
        </div>
        <div className="watermark">内容由 AI 生成，请核查重要信息</div>
      </div>
    </main>
  );
}
