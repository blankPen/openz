import { useState } from 'react';
import type { ReactNode } from 'react';

interface SettingsScreenProps {
  onBack: () => void;
}

type SettingsTab = 'account' | 'model' | 'appearance' | 'privacy' | 'history' | 'export' | 'about';

export function SettingsScreen({ onBack: _onBack }: SettingsScreenProps) {
  const [activeTab, setActiveTab] = useState<SettingsTab>('account');
  const [streamingOn, setStreamingOn] = useState(true);
  const [thinkingOn, setThinkingOn] = useState(true);
  const [autoSaveOn, setAutoSaveOn] = useState(true);
  const [trainingOn, setTrainingOn] = useState(false);
  const [twoFactorOn, setTwoFactorOn] = useState(true);
  const [activeTheme, setActiveTheme] = useState<'light' | 'dark' | 'auto'>('light');

  const tabs: { id: SettingsTab; label: string; icon: ReactNode }[] = [
    {
      id: 'account',
      label: '账号',
      icon: (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/>
          <circle cx="12" cy="7" r="4"/>
        </svg>
      ),
    },
    {
      id: 'model',
      label: '模型',
      icon: (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="12" cy="12" r="3"/>
          <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 01-2.83 2.83l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06a1.65 1.65 0 00.33-1.82 1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06a1.65 1.65 0 001.82.33H9a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06a1.65 1.65 0 00-.33 1.82V9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z"/>
        </svg>
      ),
    },
    {
      id: 'appearance',
      label: '外观',
      icon: (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="5"/>
          <line x1="12" y1="1" x2="12" y2="3"/>
          <line x1="12" y1="21" x2="12" y2="23"/>
          <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/>
          <line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/>
          <line x1="1" y1="12" x2="3" y2="12"/>
          <line x1="21" y1="12" x2="23" y2="12"/>
          <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/>
          <line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>
        </svg>
      ),
    },
    {
      id: 'privacy',
      label: '隐私',
      icon: (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
          <path d="M7 11V7a5 5 0 0110 0v4"/>
        </svg>
      ),
    },
    {
      id: 'history',
      label: '对话历史',
      icon: (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/>
        </svg>
      ),
    },
  ];

  const bottomTabs: { id: SettingsTab; label: string; icon: ReactNode }[] = [
    {
      id: 'export',
      label: '数据导出',
      icon: (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/>
          <polyline points="7,10 12,15 17,10"/>
          <line x1="12" y1="15" x2="12" y2="3"/>
        </svg>
      ),
    },
    {
      id: 'about',
      label: '关于 OpenZ',
      icon: (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="10"/>
          <line x1="12" y1="16" x2="12" y2="12"/>
          <line x1="12" y1="8" x2="12.01" y2="8"/>
        </svg>
      ),
    },
  ];

  return (
    <main className="main">
      <div className="settings-topbar">
        <h1>设置</h1>
      </div>

      <div className="settings-body">
        <nav className="settings-nav">
          {tabs.map(tab => (
            <div
              key={tab.id}
              className={`settings-nav-item ${activeTab === tab.id ? 'active' : ''}`}
              onClick={() => setActiveTab(tab.id)}
            >
              <span className="icon">{tab.icon}</span>
              {tab.label}
            </div>
          ))}
          <div className="settings-nav-divider" />
          {bottomTabs.map(tab => (
            <div
              key={tab.id}
              className={`settings-nav-item ${activeTab === tab.id ? 'active' : ''}`}
              onClick={() => setActiveTab(tab.id)}
            >
              <span className="icon">{tab.icon}</span>
              {tab.label}
            </div>
          ))}
        </nav>

        <div className="settings-content">
          <div className="settings-content-inner">
            {activeTab === 'account' && (
              <>
                <div className="settings-section">
                  <h2>账号</h2>
                  <div className="account-card">
                    <div className="account-avatar">A</div>
                    <div className="account-info">
                      <div className="account-name">Alex Chen</div>
                      <div className="account-email">alex.chen@openz.ai</div>
                      <div className="account-plan">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <polygon points="12,2 15,8.5 22,9.5 17,14.5 18.5,22 12,18.5 5.5,22 7,14.5 2,9.5 9,8.5"/>
                        </svg>
                        OpenZ Pro
                      </div>
                    </div>
                    <button className="btn">管理订阅</button>
                  </div>

                  <div className="settings-card">
                    <div className="settings-row">
                      <div className="settings-row-info">
                        <div className="settings-row-title">用户名</div>
                        <div className="settings-row-desc">登录与显示名称</div>
                      </div>
                      <div className="settings-row-action">
                        <button className="btn">编辑</button>
                      </div>
                    </div>
                    <div className="settings-row">
                      <div className="settings-row-info">
                        <div className="settings-row-title">邮箱</div>
                        <div className="settings-row-desc">alex.chen@openz.ai</div>
                      </div>
                      <div className="settings-row-action">
                        <button className="btn">更换</button>
                      </div>
                    </div>
                    <div className="settings-row">
                      <div className="settings-row-info">
                        <div className="settings-row-title">密码</div>
                        <div className="settings-row-desc">上次修改：3 个月前</div>
                      </div>
                      <div className="settings-row-action">
                        <button className="btn">修改</button>
                      </div>
                    </div>
                    <div className="settings-row">
                      <div className="settings-row-info">
                        <div className="settings-row-title">两步验证</div>
                        <div className="settings-row-desc">使用身份验证器 App</div>
                      </div>
                      <div className="settings-row-action">
                        <button className={`toggle ${twoFactorOn ? 'on' : ''}`} onClick={() => setTwoFactorOn(v => !v)} />
                      </div>
                    </div>
                  </div>
                </div>
              </>
            )}

            {activeTab === 'model' && (
              <div className="settings-section">
                <h2>模型</h2>
                <div className="settings-card">
                  <div className="settings-row">
                    <div className="settings-row-info">
                      <div className="settings-row-title">默认模型</div>
                      <div className="settings-row-desc">新建对话时使用的模型</div>
                    </div>
                    <div className="settings-row-action">
                      <select className="select" defaultValue="0">
                        <option value="0">OpenZ K2.6 思考</option>
                        <option>OpenZ K2.6 快速</option>
                        <option>OpenZ K2 联网</option>
                        <option>OpenZ K1.5</option>
                      </select>
                    </div>
                  </div>
                  <div className="settings-row">
                    <div className="settings-row-info">
                      <div className="settings-row-title">Agent 人格</div>
                      <div className="settings-row-desc">影响回复语气与风格</div>
                    </div>
                    <div className="settings-row-action">
                      <select className="select" defaultValue="0">
                        <option value="0">默认助手</option>
                        <option>编程专家</option>
                        <option>学术研究</option>
                        <option>创意写作</option>
                      </select>
                    </div>
                  </div>
                  <div className="settings-row">
                    <div className="settings-row-info">
                      <div className="settings-row-title">流式输出</div>
                      <div className="settings-row-desc">逐字显示回复内容</div>
                    </div>
                    <div className="settings-row-action">
                      <button className={`toggle ${streamingOn ? 'on' : ''}`} onClick={() => setStreamingOn(v => !v)} />
                    </div>
                  </div>
                  <div className="settings-row">
                    <div className="settings-row-info">
                      <div className="settings-row-title">思考过程</div>
                      <div className="settings-row-desc">显示 AI 规划与推理步骤</div>
                    </div>
                    <div className="settings-row-action">
                      <button className={`toggle ${thinkingOn ? 'on' : ''}`} onClick={() => setThinkingOn(v => !v)} />
                    </div>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'appearance' && (
              <div className="settings-section">
                <h2>外观</h2>
                <div className="theme-picker">
                  <div className={`theme-opt ${activeTheme === 'light' ? 'active' : ''}`} onClick={() => setActiveTheme('light')}>
                    <div className="theme-opt-preview light" />
                    <div className="theme-opt-name">浅色</div>
                  </div>
                  <div className={`theme-opt ${activeTheme === 'dark' ? 'active' : ''}`} onClick={() => setActiveTheme('dark')}>
                    <div className="theme-opt-preview dark" />
                    <div className="theme-opt-name">深色</div>
                  </div>
                  <div className={`theme-opt ${activeTheme === 'auto' ? 'active' : ''}`} onClick={() => setActiveTheme('auto')}>
                    <div className="theme-opt-preview auto" />
                    <div className="theme-opt-name">跟随系统</div>
                  </div>
                </div>

                <div className="settings-card" style={{ marginTop: 16 }}>
                  <div className="settings-row">
                    <div className="settings-row-info">
                      <div className="settings-row-title">字号</div>
                      <div className="settings-row-desc">影响所有文本显示大小</div>
                    </div>
                    <div className="settings-row-action">
                      <select className="select" defaultValue="1">
                        <option>小</option>
                        <option value="1">中（推荐）</option>
                        <option>大</option>
                        <option>特大</option>
                      </select>
                    </div>
                  </div>
                  <div className="settings-row">
                    <div className="settings-row-info">
                      <div className="settings-row-title">消息密度</div>
                      <div className="settings-row-desc">对话流紧凑度</div>
                    </div>
                    <div className="settings-row-action">
                      <select className="select" defaultValue="1">
                        <option>紧凑</option>
                        <option value="1">适中（推荐）</option>
                        <option>宽松</option>
                      </select>
                    </div>
                  </div>
                  <div className="settings-row">
                    <div className="settings-row-info">
                      <div className="settings-row-title">气泡样式</div>
                      <div className="settings-row-desc">用户气泡对齐方式</div>
                    </div>
                    <div className="settings-row-action">
                      <select className="select" defaultValue="0">
                        <option value="0">右对齐（推荐）</option>
                        <option>居中</option>
                        <option>全宽</option>
                      </select>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'history' && (
              <div className="settings-section">
                <h2>对话历史</h2>
                <div className="settings-card">
                  <div className="settings-row">
                    <div className="settings-row-info">
                      <div className="settings-row-title">自动保存</div>
                      <div className="settings-row-desc">所有对话自动保留 90 天</div>
                    </div>
                    <div className="settings-row-action">
                      <button className={`toggle ${autoSaveOn ? 'on' : ''}`} onClick={() => setAutoSaveOn(v => !v)} />
                    </div>
                  </div>
                  <div className="settings-row">
                    <div className="settings-row-info">
                      <div className="settings-row-title">训练数据</div>
                      <div className="settings-row-desc">允许使用对话改进模型</div>
                    </div>
                    <div className="settings-row-action">
                      <button className={`toggle ${trainingOn ? 'on' : ''}`} onClick={() => setTrainingOn(v => !v)} />
                    </div>
                  </div>
                  <div className="settings-row">
                    <div className="settings-row-info">
                      <div className="settings-row-title">清除所有对话</div>
                      <div className="settings-row-desc">不可恢复，请谨慎操作</div>
                    </div>
                    <div className="settings-row-action">
                      <button className="btn btn-danger">清除</button>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {(activeTab === 'privacy' || activeTab === 'export' || activeTab === 'about') && (
              <div className="settings-section">
                <h2>{activeTab === 'privacy' ? '隐私' : activeTab === 'export' ? '数据导出' : '关于 OpenZ'}</h2>
                <div className="settings-card">
                  <div className="settings-row">
                    <div className="settings-row-info">
                      <div className="settings-row-title">
                        {activeTab === 'privacy' ? '数据处理政策' : activeTab === 'export' ? '导出所有数据' : '版本信息'}
                      </div>
                      <div className="settings-row-desc">
                        {activeTab === 'privacy' ? '了解如何处理您的数据' : activeTab === 'export' ? '下载您的所有对话与设置' : 'OpenZ v1.0.0'}
                      </div>
                    </div>
                    <div className="settings-row-action">
                      <button className="btn">{activeTab === 'privacy' ? '查看' : activeTab === 'export' ? '导出' : '检查更新'}</button>
                    </div>
                  </div>
                </div>
              </div>
            )}

            <div className="watermark">内容由 AI 生成，请核查重要信息</div>
          </div>
        </div>
      </div>
    </main>
  );
}
