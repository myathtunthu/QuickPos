import React from 'react';
import { BookOpen, CheckCircle2, FileText, X } from 'lucide-react';
import { useLanguage } from '../../context/LanguageContext';

function renderInline(text = '') {
  const parts = [];
  const pattern = /(\*\*[^*]+\*\*|`[^`]+`)/g;
  let lastIndex = 0;
  let match;

  while ((match = pattern.exec(text)) !== null) {
    if (match.index > lastIndex) parts.push(text.slice(lastIndex, match.index));
    const token = match[0];
    if (token.startsWith('**')) {
      parts.push(<strong key={`${token}-${match.index}`} className="font-black text-white">{token.slice(2, -2)}</strong>);
    } else if (token.startsWith('`')) {
      parts.push(<code key={`${token}-${match.index}`} className="rounded-lg border border-white/10 bg-black/30 px-1.5 py-0.5 text-cyan-200">{token.slice(1, -1)}</code>);
    }
    lastIndex = pattern.lastIndex;
  }

  if (lastIndex < text.length) parts.push(text.slice(lastIndex));
  return parts;
}

function MarkdownGuide({ markdown }) {
  const lines = String(markdown || '').replace(/\r\n/g, '\n').split('\n');
  const blocks = [];
  let i = 0;

  while (i < lines.length) {
    const raw = lines[i];
    const line = raw.trim();

    if (!line) {
      i += 1;
      continue;
    }

    if (line.startsWith('```')) {
      const code = [];
      i += 1;
      while (i < lines.length && !lines[i].trim().startsWith('```')) {
        code.push(lines[i]);
        i += 1;
      }
      i += 1;
      blocks.push({ type: 'code', content: code.join('\n') });
      continue;
    }

    if (line.startsWith('# ')) {
      blocks.push({ type: 'h1', content: line.replace(/^#\s+/, '') });
      i += 1;
      continue;
    }

    if (line.startsWith('## ')) {
      blocks.push({ type: 'h2', content: line.replace(/^##\s+/, '') });
      i += 1;
      continue;
    }

    if (line.startsWith('### ')) {
      blocks.push({ type: 'h3', content: line.replace(/^###\s+/, '') });
      i += 1;
      continue;
    }

    if (line.startsWith('- ')) {
      const items = [];
      while (i < lines.length && lines[i].trim().startsWith('- ')) {
        items.push(lines[i].trim().replace(/^[-]\s+/, ''));
        i += 1;
      }
      blocks.push({ type: 'ul', items });
      continue;
    }

    if (/^\d+\.\s+/.test(line)) {
      const items = [];
      while (i < lines.length && /^\d+\.\s+/.test(lines[i].trim())) {
        items.push(lines[i].trim().replace(/^\d+\.\s+/, ''));
        i += 1;
      }
      blocks.push({ type: 'ol', items });
      continue;
    }

    const paragraph = [line];
    i += 1;
    while (
      i < lines.length &&
      lines[i].trim() &&
      !lines[i].trim().startsWith('#') &&
      !lines[i].trim().startsWith('- ') &&
      !/^\d+\.\s+/.test(lines[i].trim()) &&
      !lines[i].trim().startsWith('```')
    ) {
      paragraph.push(lines[i].trim());
      i += 1;
    }
    blocks.push({ type: 'p', content: paragraph.join(' ') });
  }

  return (
    <div className="space-y-4 text-sm leading-7 text-slate-300">
      {blocks.map((block, index) => {
        if (block.type === 'h1') {
          return <h1 key={index} className="text-2xl font-black text-white leading-tight">{renderInline(block.content)}</h1>;
        }
        if (block.type === 'h2') {
          return <h2 key={index} className="mt-6 rounded-2xl border border-cyan-500/20 bg-cyan-500/10 px-4 py-3 text-lg font-black text-cyan-200">{renderInline(block.content)}</h2>;
        }
        if (block.type === 'h3') {
          return <h3 key={index} className="mt-4 text-base font-black text-white">{renderInline(block.content)}</h3>;
        }
        if (block.type === 'ul') {
          return (
            <ul key={index} className="space-y-2 rounded-2xl border border-white/10 bg-black/20 p-4">
              {block.items.map((item, itemIndex) => (
                <li key={itemIndex} className="flex gap-2">
                  <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-cyan-300" />
                  <span>{renderInline(item)}</span>
                </li>
              ))}
            </ul>
          );
        }
        if (block.type === 'ol') {
          return (
            <ol key={index} className="space-y-2 rounded-2xl border border-white/10 bg-black/20 p-4">
              {block.items.map((item, itemIndex) => (
                <li key={itemIndex} className="flex gap-3">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-cyan-500/15 text-xs font-black text-cyan-200">{itemIndex + 1}</span>
                  <span>{renderInline(item)}</span>
                </li>
              ))}
            </ol>
          );
        }
        if (block.type === 'code') {
          return <pre key={index} className="overflow-x-auto rounded-2xl border border-white/10 bg-black/40 p-4 text-xs leading-6 text-cyan-100"><code>{block.content}</code></pre>;
        }
        return <p key={index} className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">{renderInline(block.content)}</p>;
      })}
    </div>
  );
}

function StepGuide({ guide }) {
  return (
    <>
      {(guide.steps || []).map((step, index) => (
        <div key={`${step.title}-${index}`} className="rounded-3xl border border-white/10 bg-black/25 p-4">
          <div className="flex items-start gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-cyan-500/15 text-cyan-300 font-black shrink-0">
              {index + 1}
            </div>
            <div className="min-w-0">
              <h3 className="font-black text-white leading-snug">{step.title}</h3>
              <p className="mt-2 text-sm leading-6 text-slate-400 whitespace-pre-line">{step.body}</p>
            </div>
          </div>
        </div>
      ))}

      {guide.tips?.length > 0 && (
        <div className="rounded-3xl border border-emerald-500/20 bg-emerald-500/10 p-4">
          <h3 className="flex items-center gap-2 text-emerald-300 font-black">
            <CheckCircle2 size={18} /> Tips
          </h3>
          <ul className="mt-3 space-y-2 text-sm leading-6 text-slate-300">
            {guide.tips.map((tip, index) => <li key={index}>• {tip}</li>)}
          </ul>
        </div>
      )}
    </>
  );
}

export default function GuideModal({ guide, onClose }) {
  const { t } = useLanguage();

  if (!guide) return null;

  return (
    <div className="fixed inset-0 z-[80] flex items-end sm:items-center justify-center bg-black/70 backdrop-blur-sm p-0 sm:p-4">
      <button type="button" aria-label={t('close')} className="absolute inset-0" onClick={onClose} />

      <div className="relative w-full sm:max-w-3xl max-h-[88vh] overflow-hidden rounded-t-[2rem] sm:rounded-[2rem] border border-cyan-500/20 bg-[#0b1020] shadow-2xl shadow-cyan-950/30">
        <div className="sticky top-0 z-10 flex items-start justify-between gap-4 border-b border-white/10 bg-[#0b1020]/95 p-5 backdrop-blur">
          <div className="flex items-start gap-3 min-w-0">
            <div className="rounded-2xl bg-cyan-500/10 p-3 text-cyan-300 border border-cyan-500/20 shrink-0">
              {guide.isMarkdownGuide ? <FileText size={24} /> : <BookOpen size={24} />}
            </div>
            <div className="min-w-0">
              <p className="text-[11px] font-black uppercase tracking-[0.25em] text-cyan-300">{t('guide')}</p>
              <h2 className="mt-1 text-xl sm:text-2xl font-black text-white leading-tight">{guide.title}</h2>
              {guide.description && <p className="mt-2 text-sm leading-6 text-slate-400">{guide.description}</p>}
              {guide.sourcePath && <p className="mt-2 text-[11px] font-bold text-slate-500">Source: {guide.sourcePath}</p>}
            </div>
          </div>

          <button type="button" onClick={onClose} className="rounded-2xl border border-white/10 bg-white/5 p-2 text-slate-300 hover:text-white hover:bg-white/10 active:scale-95">
            <X size={22} />
          </button>
        </div>

        <div className="max-h-[68vh] overflow-y-auto p-5 space-y-4 custom-scrollbar">
          {guide.markdown ? <MarkdownGuide markdown={guide.markdown} /> : <StepGuide guide={guide} />}
        </div>
      </div>
    </div>
  );
}
