import { useState } from 'react';

interface ModelSwitchModalProps {
  onClose: () => void;
}

export function ModelSwitchModal({ onClose }: ModelSwitchModalProps) {
  const [selectedModel, setSelectedModel] = useState('k2.6');
  const [selectedMode, setSelectedMode] = useState('thinking');
  const [selectedPersona, setSelectedPersona] = useState('default');

  return (
    <div className="backdrop" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal" role="dialog" aria-label="选择模型">
        <div className="modal-head">
          <div className="modal-title">选择模型</div>
          <button className="modal-close" aria-label="关闭" onClick={onClose}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18"/>
              <line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>

        <div className="modal-body">
          {/* Base Models */}
          <div className="section">
            <div className="section-head">
              <span className="section-label">基础模型</span>
              <span className="section-meta">3 个可选</span>
            </div>
            <div className="section-list">
              {[
                { id: 'k15', name: 'OpenZ K1.5', desc: '上一代旗舰模型，128K 上下文，免费', grad: 'var(--grad-blue)', icon: 'layers' },
                { id: 'k2', name: 'OpenZ K2', desc: '多模态增强版，支持图像理解，256K 上下文', grad: 'var(--grad-purple)', icon: 'layers' },
                { id: 'k2.6', name: 'OpenZ K2.6', desc: '最新旗舰模型，深度思考 + 多模态 + 工具调用', grad: 'var(--grad-blue)', icon: 'bolt', badge: '推荐' },
              ].map(m => (
                <div
                  key={m.id}
                  className={`option ${selectedModel === m.id ? 'selected' : ''}`}
                  onClick={() => setSelectedModel(m.id)}
                >
                  <div className="option-icon" style={{ background: m.grad }}>
                    {m.icon === 'bolt' ? (
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <polygon points="13,2 3,14 12,14 11,22 21,10 12,10"/>
                      </svg>
                    ) : (
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M12 2L2 7l10 5 10-5-10-5z"/>
                      </svg>
                    )}
                  </div>
                  <div className="option-body">
                    <div className="option-name">
                      {m.name}
                      {'badge' in m && m.badge && <span className="badge">{m.badge}</span>}
                    </div>
                    <div className="option-desc">{m.desc}</div>
                  </div>
                  <div className={`option-check ${selectedModel !== m.id ? 'empty' : ''}`}>
                    {selectedModel === m.id && (
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="20,6 9,17 4,12"/>
                      </svg>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="section-divider" />

          {/* Reasoning Modes */}
          <div className="section">
            <div className="section-head">
              <span className="section-label">推理模式</span>
              <span className="section-meta">影响响应速度与深度</span>
            </div>
            <div className="section-list">
              {[
                { id: 'thinking', name: '思考模式', desc: '深度推理 · 规划步骤 · 适合复杂任务', grad: 'var(--grad-blue)', icon: 'bolt' },
                { id: 'fast', name: '快速模式', desc: '秒级响应 · 简洁直接 · 适合日常对话', grad: 'var(--grad-orange)', icon: 'zap' },
                { id: 'web', name: '联网模式', desc: '实时搜索 · 引用来源 · 信息有时效保证', grad: 'var(--grad-green)', icon: 'search' },
                { id: 'pro', name: '专业模式', desc: '更长推理 · 多步工具链 · 适合研究与编程', grad: 'var(--grad-purple)', icon: 'tool', badge: 'PRO' },
              ].map(m => (
                <div
                  key={m.id}
                  className={`option ${selectedMode === m.id ? 'selected' : ''}`}
                  onClick={() => setSelectedMode(m.id)}
                >
                  <div className="option-icon" style={{ background: m.grad }}>
                    {m.icon === 'bolt' ? (
                      <svg viewBox="0 0 24 24" fill="currentColor">
                        <path d="M13 2L3 14h7l-1 8 10-12h-7l1-8z"/>
                      </svg>
                    ) : m.icon === 'zap' ? (
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <polygon points="13,2 3,14 12,14 11,22 21,10 12,10"/>
                      </svg>
                    ) : m.icon === 'search' ? (
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <circle cx="11" cy="11" r="8"/>
                        <line x1="21" y1="21" x2="16.65" y2="16.65"/>
                      </svg>
                    ) : (
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <circle cx="12" cy="12" r="3"/>
                        <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 01-2.83 2.83l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06a1.65 1.65 0 00.33-1.82 1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06a1.65 1.65 0 001.82.33H9a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06a1.65 1.65 0 00-.33 1.82V9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z"/>
                      </svg>
                    )}
                  </div>
                  <div className="option-body">
                    <div className="option-name">
                      {m.name}
                      {'badge' in m && m.badge && <span className="badge pro">{m.badge}</span>}
                    </div>
                    <div className="option-desc">{m.desc}</div>
                  </div>
                  <div className={`option-check ${selectedMode !== m.id ? 'empty' : ''}`}>
                    {selectedMode === m.id && (
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="20,6 9,17 4,12"/>
                      </svg>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="section-divider" />

          {/* Agent Personas */}
          <div className="section">
            <div className="section-head">
              <span className="section-label">Agent 人格</span>
              <span className="section-meta">影响回复语气与风格</span>
            </div>
            <div className="section-list">
              {[
                { id: 'default', name: '默认助手', desc: '平衡专业与亲切 · 通用场景', grad: 'var(--grad-blue)', icon: 'layers2' },
                { id: 'coder', name: '编程专家', desc: '代码优先 · 技术精确 · 多语言支持', grad: 'var(--grad-purple)', icon: 'code' },
                { id: 'academic', name: '学术研究', desc: '严谨求证 · 引用规范 · 适合论文写作', grad: 'var(--grad-orange)', icon: 'book' },
                { id: 'writer', name: '创意写作', desc: '想象力优先 · 文字优美 · 适合内容创作', grad: 'var(--grad-green)', icon: 'pen' },
              ].map(m => (
                <div
                  key={m.id}
                  className={`option ${selectedPersona === m.id ? 'selected' : ''}`}
                  onClick={() => setSelectedPersona(m.id)}
                >
                  <div className="option-icon" style={{ background: m.grad }}>
                    {m.icon === 'layers2' ? (
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M12 2L2 7l10 5 10-5-10-5z"/>
                        <path d="M2 17l10 5 10-5"/>
                        <path d="M2 12l10 5 10-5"/>
                      </svg>
                    ) : m.icon === 'code' ? (
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="16,18 22,12 16,6"/>
                        <polyline points="8,6 2,12 8,18"/>
                      </svg>
                    ) : m.icon === 'book' ? (
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M2 3h6a4 4 0 014 4v14a3 3 0 00-3-3H2z"/>
                        <path d="M22 3h-6a4 4 0 00-4 4v14a3 3 0 013-3h7z"/>
                      </svg>
                    ) : (
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M12 19l7-7 3 3-7 7-3-3z"/>
                        <path d="M18 13l-1.5-7.5L2 2l3.5 14.5L13 18l5-5z"/>
                        <path d="M2 2l7.586 7.586"/>
                        <circle cx="11" cy="11" r="2"/>
                      </svg>
                    )}
                  </div>
                  <div className="option-body">
                    <div className="option-name">{m.name}</div>
                    <div className="option-desc">{m.desc}</div>
                  </div>
                  <div className={`option-check ${selectedPersona !== m.id ? 'empty' : ''}`}>
                    {selectedPersona === m.id && (
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="20,6 9,17 4,12"/>
                      </svg>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="footer-hint">选择后立即生效，<kbd>ESC</kbd> 关闭</div>
        <div className="watermark">内容由 AI 生成，请核查重要信息</div>
      </div>
    </div>
  );
}
