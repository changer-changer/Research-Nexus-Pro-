import React from 'react';
import { useV3Store } from '../store/v3Store';
import { useAppStore } from '../store/appStore';
import { X, ExternalLink, BookOpen, Quote, FileText } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useTranslation } from 'react-i18next';

export default function EvidencePanel() {
  const { t } = useTranslation();
  const { activeEvidencePanel, closeEvidencePanel } = useV3Store();

  return (
    <AnimatePresence>
      {activeEvidencePanel && (
        <motion.div
          key="evidence-panel"
          initial={{ x: 400, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          exit={{ x: 400, opacity: 0 }}
          className="fixed top-0 right-0 w-full sm:w-[450px] h-full z-50 flex flex-col border-l"
          style={{ background: 'var(--bg-elevated)', borderColor: 'var(--border-subtle)', boxShadow: '-8px 0 24px rgba(0,0,0,0.2)' }}
        >
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b" style={{ borderColor: 'var(--border-subtle)', background: 'var(--bg-base)' }}>
            <div className="flex items-center gap-2 font-semibold" style={{ color: 'var(--text-primary)' }}>
              <BookOpen size={20} />
              <span>{t('evidence.trace')}</span>
            </div>
            <button
              onClick={closeEvidencePanel}
              className="p-1.5 rounded-full transition-colors"
              style={{ color: 'var(--text-secondary)' }}
            >
              <X size={18} />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-6 scroll-smooth">
            {/* Claim Block */}
            <div className="mb-8">
              <div className="text-xs font-mono mb-2" style={{ color: 'var(--text-muted)' }}>
                {t('evidence.claim')}: {activeEvidencePanel.claim_id}
              </div>
              <div className="rounded-xl p-5 text-sm leading-relaxed relative border" style={{ background: 'var(--bg-surface)', borderColor: 'var(--border-default)', color: 'var(--text-primary)' }}>
                <Quote className="absolute top-3 right-3" size={32} style={{ color: 'var(--text-muted)', opacity: 0.2 }} />
                {activeEvidencePanel.claim_text}
              </div>
            </div>

            {/* Paper Context */}
            <div className="mb-8">
              <h3 className="text-sm font-semibold uppercase tracking-wider mb-4 flex items-center gap-2" style={{ color: 'var(--text-secondary)' }}>
                <FileText size={16} />
                {t('evidence.sourcePaper')}
              </h3>
              <div className="rounded-xl p-5 border" style={{ background: 'var(--bg-surface)', borderColor: 'var(--border-default)' }}>
                <h4 className="font-bold text-sm mb-2 leading-snug" style={{ color: 'var(--text-primary)' }}>
                  {activeEvidencePanel.paper.title}
                </h4>
                <p className="text-xs mb-3 leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
                  {activeEvidencePanel.paper.authors.join(', ')} • {activeEvidencePanel.paper.year} • {activeEvidencePanel.paper.venue}
                </p>
                {activeEvidencePanel.paper.arxiv_id && (
                  <a
                    href={`https://arxiv.org/abs/${activeEvidencePanel.paper.arxiv_id}`}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1.5 rounded-lg transition-colors"
                    style={{ color: 'var(--text-tertiary)', background: 'var(--bg-hover)' }}
                  >
                    <ExternalLink size={14} />
                    arXiv:{activeEvidencePanel.paper.arxiv_id}
                  </a>
                )}
              </div>
            </div>

            {/* Evidence Spans */}
            <div>
              <h3 className="text-sm font-semibold uppercase tracking-wider mb-4" style={{ color: 'var(--text-secondary)' }}>
                {t('evidence.originalSpans')}
              </h3>
              <div className="space-y-4">
                {activeEvidencePanel.evidence.map((span, idx) => (
                  <div key={idx} className="rounded-xl border p-5" style={{ background: 'var(--bg-surface)', borderColor: 'var(--border-default)' }}>
                    <div className="flex justify-between items-center mb-4">
                      <span className={`text-xs font-mono px-2 py-1 rounded font-semibold ${
                        'text-emerald-400 bg-emerald-400/10'
                      }`}>
                        {span.section || t('evidence.unknownSection')}
                      </span>
                      <span className="text-xs font-medium" style={{ color: 'var(--text-muted)' }}>
                        {t('evidence.conf')}: {(span.confidence * 100).toFixed(0)}%
                      </span>
                    </div>
                    <p className="text-sm italic font-serif leading-relaxed relative pl-4 border-l-2" style={{ color: 'var(--text-tertiary)', borderColor: 'var(--border-default)' }}>
                      "{span.snippet}"
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
