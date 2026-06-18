interface AttachmentModalProps {
  onClose: () => void;
}

export function AttachmentModal({ onClose }: AttachmentModalProps) {
  return (
    <div className="backdrop" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal modal-attachment" role="dialog" aria-label="附件">
        <div className="modal-head">
          <div className="modal-title">添加附件</div>
          <button className="modal-close" aria-label="关闭" onClick={onClose}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18"/>
              <line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>

        <div className="modal-body">
          {/* Drop zone */}
          <div className="dropzone">
            <div className="dropzone-icon">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/>
                <polyline points="17,8 12,3 7,8"/>
                <line x1="12" y1="3" x2="12" y2="15"/>
              </svg>
            </div>
            <div className="dropzone-title">拖拽文件到此处，或<span className="accent">点击选择</span></div>
            <div className="dropzone-hint">支持图片、PDF、Word、Excel、PPT，单个文件 ≤ 50MB</div>
          </div>

          {/* Entry grid */}
          <div className="entries-label">添加方式</div>
          <div className="entries-grid">
            <div className="entry">
              <div className="entry-icon" style={{ background: 'var(--grad-blue)' }}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
                  <circle cx="8.5" cy="8.5" r="1.5"/>
                  <polyline points="21,15 16,10 5,21"/>
                </svg>
              </div>
              <div className="entry-body">
                <div className="entry-name">本地图片</div>
                <div className="entry-desc">JPG / PNG / WebP / GIF</div>
              </div>
            </div>

            <div className="entry">
              <div className="entry-icon" style={{ background: 'var(--grad-orange)' }}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/>
                  <polyline points="14,2 14,8 20,8"/>
                  <line x1="9" y1="13" x2="15" y2="13"/>
                  <line x1="9" y1="17" x2="15" y2="17"/>
                </svg>
              </div>
              <div className="entry-body">
                <div className="entry-name">本地文件</div>
                <div className="entry-desc">PDF / Word / Excel / PPT</div>
              </div>
            </div>

            <div className="entry">
              <div className="entry-icon" style={{ background: 'var(--grad-purple)' }}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z"/>
                  <circle cx="12" cy="13" r="4"/>
                </svg>
              </div>
              <div className="entry-body">
                <div className="entry-name">拍照</div>
                <div className="entry-desc">使用摄像头拍摄</div>
              </div>
            </div>

            <div className="entry">
              <div className="entry-icon" style={{ background: 'var(--grad-green)' }}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="9,17 4,12 9,7"/>
                  <path d="M20 18v-2a4 4 0 00-4-4H4"/>
                </svg>
              </div>
              <div className="entry-body">
                <div className="entry-name">卡片引用</div>
                <div className="entry-desc">引用上一轮内容 <span className="entry-badge">@回复</span></div>
              </div>
            </div>
          </div>

          {/* Recent files */}
          <div className="recent-section">
            <div className="entries-label">最近上传（3）</div>
            <div className="recent-list">
              <div className="recent-item">
                <div className="recent-icon" style={{ background: 'var(--grad-blue)' }}>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
                    <circle cx="8.5" cy="8.5" r="1.5"/>
                    <polyline points="21,15 16,10 5,21"/>
                  </svg>
                </div>
                <div className="recent-info">
                  <div className="recent-name">产品架构图-v2.png</div>
                  <div className="recent-meta">1.2 MB · 今天 14:22</div>
                </div>
                <button className="recent-remove" aria-label="移除">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="18" y1="6" x2="6" y2="18"/>
                    <line x1="6" y1="6" x2="18" y2="18"/>
                  </svg>
                </button>
              </div>

              <div className="recent-item">
                <div className="recent-icon" style={{ background: 'var(--grad-orange)' }}>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/>
                    <polyline points="14,2 14,8 20,8"/>
                  </svg>
                </div>
                <div className="recent-info">
                  <div className="recent-name">竞品分析报告-Q3.pdf</div>
                  <div className="recent-meta">4.8 MB · 昨天 17:05</div>
                </div>
                <button className="recent-remove" aria-label="移除">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="18" y1="6" x2="6" y2="18"/>
                    <line x1="6" y1="6" x2="18" y2="18"/>
                  </svg>
                </button>
              </div>

              <div className="recent-item">
                <div className="recent-icon" style={{ background: 'var(--grad-green)' }}>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="3" y="3" width="18" height="18" rx="2"/>
                    <line x1="3" y1="9" x2="21" y2="9"/>
                    <line x1="9" y1="3" x2="9" y2="21"/>
                  </svg>
                </div>
                <div className="recent-info">
                  <div className="recent-name">用户访谈记录.xlsx</div>
                  <div className="recent-meta">812 KB · 2 天前</div>
                </div>
                <button className="recent-remove" aria-label="移除">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="18" y1="6" x2="6" y2="18"/>
                    <line x1="6" y1="6" x2="18" y2="18"/>
                  </svg>
                </button>
              </div>
            </div>
          </div>
        </div>

        <div className="footer-hint">选择文件后直接附加到下一条消息 · <kbd>ESC</kbd> 关闭</div>
        <div className="watermark">内容由 AI 生成，请核查重要信息</div>
      </div>
    </div>
  );
}
